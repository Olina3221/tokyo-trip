/**
 * tts.js — 日文語音共用模組
 *
 * 公開 API（補掛在 App 物件）：
 *   App.speak(jaText)        播放日文語音（須在使用者手勢事件內呼叫，iOS 規定）
 *   App.speak.isAvailable    Boolean = 'speechSynthesis' in window（不綁 ja voice 有無，B4）
 *   App.speak.cancel()       取消當前語音（供 overlay 關閉時呼叫，B6）
 *
 * iOS 已知坑（B4）：
 *   - cancel 後立即 speak 偶發無聲 → 16ms 微延遲
 *   - utterance GC 斷音 → _currentUtterance 保留參照至播畢
 *   - voiceschanged 不可靠（可能不觸發或多次觸發）→ 冪等 listener，不作播放前置條件
 *   - getVoices() 首次可能回空陣列 → 先同步取一次，voiceschanged 時再更新
 *   - 找不到 ja voice → 仍以 lang='ja-JP' 嘗試（iOS 系統自選音，B4 規定）
 *
 * Task5（翻譯）會直接重用本模組的所有行為與語意契約。
 */

(function () {
  'use strict';

  var _voices = [];
  var _currentUtterance = null;

  // 更新語音清單（首次同步取 + voiceschanged 時再取，冪等）
  function _updateVoices() {
    if (window.speechSynthesis) {
      _voices = window.speechSynthesis.getVoices() || [];
    }
  }

  if (window.speechSynthesis) {
    _updateVoices(); // 有些瀏覽器首次同步即有值

    // voiceschanged：iOS 可能不觸發或觸發多次，冪等處理
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', _updateVoices);
    } else if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = _updateVoices;
    }
  }

  // 找第一個 lang 以 'ja' 開頭的 voice；找不到回傳 null
  // 找不到時 caller 仍以 lang='ja-JP' 嘗試（B4：不得因清單為空就放棄）
  function _pickJaVoice() {
    for (var i = 0; i < _voices.length; i++) {
      if (_voices[i].lang && _voices[i].lang.indexOf('ja') === 0) {
        return _voices[i];
      }
    }
    return null;
  }

  /**
   * 取消當前語音（公開，供 bigtext.js 關閉 overlay 時呼叫，B6）
   */
  function cancelSpeak() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    _currentUtterance = null;
  }

  /**
   * 播放日文語音。
   * cancel-then-speak 是契約（B4）：每次呼叫前先 cancel，防連點疊音。
   * @param {string} jaText  - 日文字串；空字串或 falsy → no-op
   */
  function speak(jaText) {
    if (!window.speechSynthesis) return;
    if (!jaText) return;

    // cancel 前音（防疊音，B4）
    window.speechSynthesis.cancel();
    _currentUtterance = null;

    // iOS：cancel 後立即 speak 偶發無聲 → 16ms 微延遲（B4）
    setTimeout(function () {
      var utt = new SpeechSynthesisUtterance(jaText);
      utt.lang = 'ja-JP';

      // 嘗試指定 ja voice；找不到讓系統自選（B4：找不到也要播，不放棄）
      var jaVoice = _pickJaVoice();
      if (jaVoice) utt.voice = jaVoice;

      // 保留參照防 GC 中途斷音（B4）
      _currentUtterance = utt;

      utt.onend = function () {
        if (_currentUtterance === utt) _currentUtterance = null;
      };

      // 失敗靜默（B4：只記 console，不彈窗，UI 保持可再點）
      utt.onerror = function (e) {
        console.warn('[TTS] speak error:', e.error, jaText);
        if (_currentUtterance === utt) _currentUtterance = null;
      };

      window.speechSynthesis.speak(utt);
    }, 16);
  }

  // 可用性：只檢查 API 是否存在，不綁「有無 ja voice」（B4）
  // Task5 的播放鈕也用同一語意；語意錯 → Task5 跟著錯
  speak.isAvailable = 'speechSynthesis' in window;

  // 公開取消方法（B6）
  speak.cancel = cancelSpeak;

  // 補掛 App（app.js 在本檔之前載入，App 物件已存在）
  window.App = window.App || {};
  App.speak = speak;

})();
