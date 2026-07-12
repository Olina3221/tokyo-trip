/**
 * js/recorder.js — 錄音封裝模組（Task12）
 *
 * 公開 API（掛在 window.App.recorder）：
 *   App.recorder.isAvailable     Boolean：環境支援錄音
 *   App.recorder.isRecording     Boolean getter：是否錄音中
 *   App.recorder.start()         Promise<void>：開始錄音
 *   App.recorder.stop()          Promise<{base64, durationMs}>：停止並編碼
 *   App.recorder.abort()         同步：停止並丟棄
 *   App.recorder.ErrorCode       錯誤碼枚舉
 *
 * iOS 陷阱清單（speech-test.html 已實證，照搬不得「優化」）：
 *   R1  processor.connect(audioCtx.destination) 必接，否則 onaudioprocess 不觸發
 *   R2  每次錄音新建 AudioContext，用完即 close（iOS 常駐 context 不友善）
 *   R3  webkitAudioContext 前綴 fallback；state==='suspended' 時 resume()
 *   R4  getUserMedia 必在 user gesture handler 內呼叫；getUserMedia resolve 後才建
 *       AudioContext（順序不得反轉）
 *   R5  資源釋放四件套全包 try/catch：processor.disconnect / source.disconnect /
 *       tracks.stop / audioCtx.close
 *   R6  audioCtx.sampleRate 必須在 close 前讀取
 *   R7  base64 編碼分塊 0x8000，防 call stack 爆
 *   R8  onaudioprocess 以 recording 旗標守門
 *
 * 純錄音＋編碼層，不碰 DOM / localStorage / API 呼叫 / TTS。
 * 60 秒上限計時器由 translate-tab.js 管理，recorder 純被動。
 */
(function () {
  'use strict';

  var ACc = window.AudioContext || window.webkitAudioContext;

  // ── 錯誤碼枚舉 ─────────────────────────────────────────────────────────────
  var ErrorCode = {
    MIC_DENIED:    'MIC_DENIED',     // NotAllowedError / SecurityError
    MIC_UNAVAILABLE: 'MIC_UNAVAILABLE', // NotFoundError / NotReadableError 等
    NO_AUDIO:      'NO_AUDIO',       // stop 時 buffers 為空
    NOT_SUPPORTED: 'NOT_SUPPORTED',  // isAvailable === false 仍被呼叫
    OTHER:         'OTHER',          // 其餘
  };

  // ── 可用性判斷 ──────────────────────────────────────────────────────────────
  var isAvailable = !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    ACc
  );

  // ── 內部狀態 ────────────────────────────────────────────────────────────────
  var _recording  = false;  // R8：onaudioprocess 守門旗標
  var _audioCtx   = null;
  var _stream     = null;
  var _source     = null;
  var _processor  = null;
  var _buffers    = [];

  // ── 資源釋放（R5：四件套全包 try/catch）────────────────────────────────────
  function _release() {
    try { if (_processor) _processor.disconnect(); } catch (e) {}
    try { if (_source)    _source.disconnect();    } catch (e) {}
    try {
      if (_stream) {
        _stream.getTracks().forEach(function (t) { t.stop(); });
      }
    } catch (e) {}
    try { if (_audioCtx)  _audioCtx.close();       } catch (e) {}
    _processor = null;
    _source    = null;
    _stream    = null;
    _audioCtx  = null;
  }

  // ── 線性內插重取樣 ─────────────────────────────────────────────────────────
  function _resample(data, fromRate, toRate) {
    if (fromRate === toRate) return data;
    var ratio = fromRate / toRate;
    var outLen = Math.round(data.length / ratio);
    var out    = new Float32Array(outLen);
    for (var i = 0; i < outLen; i++) {
      var idx = i * ratio;
      var i0  = Math.floor(idx);
      var i1  = Math.min(i0 + 1, data.length - 1);
      var f   = idx - i0;
      out[i]  = data[i0] * (1 - f) + data[i1] * f;
    }
    return out;
  }

  // ── Float32 → Int16 LINEAR16 ───────────────────────────────────────────────
  function _floatTo16(floats) {
    var out = new Int16Array(floats.length);
    for (var i = 0; i < floats.length; i++) {
      var s = Math.max(-1, Math.min(1, floats[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  }

  // ── Uint8Array → base64（R7：分塊防 call stack 爆）────────────────────────
  function _toBase64(bytes) {
    var bin   = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  // ── getUserMedia 錯誤分類 ───────────────────────────────────────────────────
  function _classifyGumError(e) {
    if (!e) return ErrorCode.OTHER;
    var name = e.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return ErrorCode.MIC_DENIED;
    }
    if (name === 'NotFoundError' || name === 'NotReadableError' ||
        name === 'OverconstrainedError' || name === 'AbortError') {
      return ErrorCode.MIC_UNAVAILABLE;
    }
    return ErrorCode.OTHER;
  }

  // ── abort()：停止並丟棄（同步，靜默無回傳）────────────────────────────────
  function abort() {
    _recording = false;  // R8：先關門，onaudioprocess 不再收 buffer
    _buffers   = [];
    _release();
  }

  // ── start()：開始錄音 → Promise<void> ────────────────────────────────────
  // R4：必須在 user gesture handler 內呼叫
  function start() {
    if (!isAvailable) {
      return Promise.reject({ code: ErrorCode.NOT_SUPPORTED, message: '' });
    }

    // 同時只允許一個錄音實例：先 abort 舊的（spec §實作要點）
    if (_recording) {
      abort();
    }

    _buffers = [];

    // R4：getUserMedia 先呼叫，resolve 後才建 AudioContext（順序不得反轉）
    return navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function (stream) {
        _stream = stream;

        // R2：每次錄音新建 AudioContext（R3：含 webkitAudioContext fallback）
        _audioCtx = new ACc();

        // R3：state==='suspended' 時 resume()
        if (_audioCtx.state === 'suspended' && _audioCtx.resume) {
          _audioCtx.resume();
        }

        _source    = _audioCtx.createMediaStreamSource(stream);
        _processor = _audioCtx.createScriptProcessor(4096, 1, 1);

        // R8：以 _recording 旗標守門
        _processor.onaudioprocess = function (e) {
          if (!_recording) return;
          _buffers.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        };

        // R1：processor 必須 connect destination，iOS 才會觸發 onaudioprocess
        _source.connect(_processor);
        _processor.connect(_audioCtx.destination);

        _recording = true;
      })
      .catch(function (e) {
        _release();
        return Promise.reject({ code: _classifyGumError(e), message: String(e && e.message || e) });
      });
  }

  // ── stop()：停止 → Promise<{base64, durationMs}> ────────────────────────
  function stop() {
    if (!_recording) {
      return Promise.reject({ code: ErrorCode.OTHER, message: 'not recording' });
    }

    _recording = false;  // R8：先關門

    // R6：sampleRate 必須在 close 前讀取
    var sr = _audioCtx ? _audioCtx.sampleRate : 44100;

    // R5：釋放資源
    _release();

    // 合併 buffers
    var totalLen = 0;
    var i;
    for (i = 0; i < _buffers.length; i++) totalLen += _buffers[i].length;

    if (totalLen === 0) {
      _buffers = [];
      return Promise.reject({ code: ErrorCode.NO_AUDIO, message: '' });
    }

    // durationMs 定義 = 合併樣本數 / 原始 sampleRate * 1000（重取樣前計）
    var durationMs = Math.round(totalLen / sr * 1000);

    var merged = new Float32Array(totalLen);
    var offset = 0;
    for (i = 0; i < _buffers.length; i++) {
      merged.set(_buffers[i], offset);
      offset += _buffers[i].length;
    }
    _buffers = [];

    // 重取樣至 16000Hz → Int16 LINEAR16 → base64
    var down   = _resample(merged, sr, 16000);
    var pcm    = _floatTo16(down);
    var base64 = _toBase64(new Uint8Array(pcm.buffer));

    return Promise.resolve({ base64: base64, durationMs: durationMs });
  }

  // ── 掛載 App.recorder ───────────────────────────────────────────────────────
  window.App = window.App || {};
  window.App.recorder = {
    isAvailable: isAvailable,
    get isRecording() { return _recording; },
    start:     start,
    stop:      stop,
    abort:     abort,
    ErrorCode: ErrorCode,
  };

}());
