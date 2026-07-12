/**
 * js/camera-tab.js — 拍照辨識日文（Task6）
 *
 * 功能：getUserMedia 取景 → 快門抓幀（或 file input 相簿/原生拍照）
 *       → 縮圖（長邊≤1600、JPEG q=0.85）→ App.api.ocr → App.api.translate
 *       → 顯示原文＋譯文＋動作鈕
 *
 * 生命週期：
 *   track 四停時機：拍照後／離開分頁（wrap showTab）／visibilitychange hidden／pagehide
 *   重啟一律新建 stream；停用 createImageBitmap（iOS EXIF 支援殘缺），用 <img>+objectURL 路徑
 *
 * 隱私硬約束：
 *   零 localStorage、零裸 fetch（全走 App.api.*）、base64 只送 App.api.ocr
 *   objectURL 建撤配對、log 不輸出 base64/圖像變數
 *
 * wrap 鏈（外→內）：coupon-viewer → camera-tab → translate-tab → bigtext → app.js
 *   本檔在 translate-tab.js 之後、coupon-viewer.js 之前載入
 */
(function () {
  'use strict';

  // ── 狀態 ─────────────────────────────────────────────────────────────────
  var _initialized    = false;
  var _fallbackSticky = false;   // §3.3 降級黏性：session 內不重複彈權限窗
  var _stream         = null;
  var _view           = 'viewfinder';  // 'viewfinder' | 'processing' | 'result'
  var _isProcessing   = false;
  var _lastOcrText    = null;
  var _lastTranslation = null;

  // ── DOM 引用 ─────────────────────────────────────────────────────────────
  var _container       = null;
  var _video           = null;
  var _scanFrame       = null;
  var _scanHint        = null;
  var _fallbackHolder  = null;
  var _fallbackText    = null;
  var _viewfinderArea  = null;
  var _processingArea  = null;
  var _statusText      = null;
  var _resultArea      = null;
  var _resultOrigText  = null;
  var _resultTransText = null;
  var _resultError     = null;
  var _retryTransBtn   = null;
  var _shutterBtn      = null;
  var _albumBtn        = null;
  var _captureInput    = null;   // capture=environment（原生相機）
  var _albumInput      = null;   // 無 capture（相簿）
  var _imgDecode       = null;   // EXIF 解碼用隱藏 <img>
  var _currentObjectUrl = null;

  // ── 錯誤文案（各分頁自維護，不 import translate-tab 私有常數）─────────────
  var ERROR_MSG = {
    NO_KEY:     '尚未設定 API 金鑰',
    OFFLINE:    '目前離線，拍照辨識需要網路',
    HTTP_403:   'API 拒絕存取（金鑰限制）',
    HTTP_429:   '請求太頻繁，稍後再試',
    HTTP_OTHER: '服務發生錯誤，請再試一次',
  };

  // ── 工具 ─────────────────────────────────────────────────────────────────

  /** 統一停止 stream（比照 recorder.js _release 精神）*/
  function _stopStream() {
    try {
      if (_stream) {
        _stream.getTracks().forEach(function (t) { t.stop(); });
      }
    } catch (e) {}
    try { if (_video) { _video.srcObject = null; } } catch (e) {}
    _stream = null;
  }

  /** 判斷目前是否有 live video track */
  function _isLive() {
    return !!(
      _stream &&
      _stream.getVideoTracks().some(function (t) { return t.readyState === 'live'; })
    );
  }

  /** 撤銷上一次建立的 objectURL */
  function _revokeObjectUrl() {
    if (_currentObjectUrl) {
      URL.revokeObjectURL(_currentObjectUrl);
      _currentObjectUrl = null;
    }
  }

  /** 將 ErrorCode 映射到友善訊息 */
  function _errorMsg(err) {
    if (!err) { return ERROR_MSG.HTTP_OTHER; }
    return ERROR_MSG[err.code] || ERROR_MSG.HTTP_OTHER;
  }

  // ── 視圖切換 ─────────────────────────────────────────────────────────────

  function _showView(v) {
    _view = v;
    _viewfinderArea.style.display  = (v === 'viewfinder') ? '' : 'none';
    _processingArea.style.display  = (v === 'processing') ? '' : 'none';
    _resultArea.style.display      = (v === 'result')     ? '' : 'none';
  }

  /** 切換為降級模式（黏性，session 內不復原）*/
  function _activateFallback() {
    _fallbackSticky = true;
    _video.style.display       = 'none';
    _scanFrame.style.display   = 'none';
    _scanHint.style.display    = 'none';
    _fallbackHolder.style.display = '';
  }

  // ── 相機啟動 ─────────────────────────────────────────────────────────────

  function _startCamera() {
    if (_fallbackSticky) { return; }
    if (_isLive()) { return; }  // 已有 live stream → no-op

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      _activateFallback();
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(function (stream) {
        _stream = stream;
        _video.srcObject = stream;
        _video.playsInline = true;  // 確保 iOS 屬性已設
        _video.muted = true;
        return _video.play();       // iOS 需要顯式 play()
      })
      .then(function () {
        // Live 模式就緒
        _video.style.display       = '';
        _scanFrame.style.display   = '';
        _scanHint.style.display    = '';
        _fallbackHolder.style.display = 'none';
      })
      .catch(function () {
        // getUserMedia 失敗或 play() 失敗 → 黏性降級（SA §3.2-1/2/3）
        _stopStream();
        _activateFallback();
      });
  }

  // ── 縮圖（一步完成，禁 createImageBitmap，SA §3.2-4/5）────────────────────

  /**
   * 將影像來源縮圖並轉出 JPEG raw base64（不含前綴）
   * @param {HTMLVideoElement|HTMLImageElement} src  影像來源
   * @param {number} srcW  來源寬度
   * @param {number} srcH  來源高度
   * @returns {string} raw base64 字串
   */
  function _captureFrame(src, srcW, srcH) {
    var tw = srcW || 1;
    var th = srcH || 1;
    var longEdge = Math.max(tw, th);
    if (longEdge > 1600) {
      var scale = 1600 / longEdge;
      tw = Math.round(srcW * scale);
      th = Math.round(srcH * scale);
    }
    // 直接建目標尺寸 canvas，單次 drawImage 縮圖一步到位（SA §3.2-4）
    var canvas = document.createElement('canvas');
    canvas.width  = tw;
    canvas.height = th;
    canvas.getContext('2d').drawImage(src, 0, 0, tw, th);
    var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    canvas = null;  // 釋放大物件參照
    // 剝除 "data:image/jpeg;base64," 前綴，回傳 raw base64
    return dataUrl.split(',')[1];
  }

  // ── 核心處理流程 ──────────────────────────────────────────────────────────

  function _processImage(base64) {
    _isProcessing = true;
    _shutterBtn.disabled = true;
    _albumBtn.disabled   = true;
    _lastOcrText     = null;
    _lastTranslation = null;
    _showView('processing');
    _statusText.textContent = '辨識中…';

    /* global App */
    App.api.ocr(base64)
      .then(function (text) {
        if (!text) {
          // 空結果：回取景 + 友善提示（SA 定案：resolve '' 非錯誤）
          _isProcessing = false;
          _shutterBtn.disabled = false;
          _albumBtn.disabled   = false;
          _showView('viewfinder');
          var noTextMsg = '沒辨識到文字，請對準文字再拍一次';
          if (_fallbackSticky) {
            _fallbackText.textContent = noTextMsg;
            setTimeout(function () {
              _fallbackText.textContent = '無法使用即時取景，可用下方快門開相機拍照';
            }, 3000);
          } else {
            _scanHint.textContent = noTextMsg;
            setTimeout(function () { _scanHint.textContent = '對準要翻譯的文字'; }, 3000);
            _startCamera();
          }
          return;
        }

        _lastOcrText = text;
        _statusText.textContent = '翻譯中…';

        return App.api.translate(text, 'ja', 'zh-TW')
          .then(function (translated) {
            _lastTranslation = translated;
            _isProcessing = false;
            _shutterBtn.disabled = false;
            _albumBtn.disabled   = false;
            _showResult(text, translated, null);
          })
          .catch(function (err) {
            // OCR 成功、翻譯失敗 → 保留原文 + 重試翻譯（spec §2）
            _isProcessing = false;
            _shutterBtn.disabled = false;
            _albumBtn.disabled   = false;
            _showResult(text, null, _errorMsg(err));
          });
      })
      .catch(function (err) {
        // OCR 本身失敗（HTTP/網路錯誤）
        _isProcessing = false;
        _shutterBtn.disabled = false;
        _albumBtn.disabled   = false;
        _resultOrigText.textContent  = '';
        _resultTransText.textContent = '';
        _resultError.textContent     = _errorMsg(err);
        _resultError.style.display   = '';
        _retryTransBtn.style.display = 'none';
        _setActionBtnState(false, false);
        _showView('result');
      });
  }

  function _showResult(origText, transText, errorMsg) {
    _resultOrigText.textContent  = origText  || '';
    _resultTransText.textContent = transText || '';
    if (errorMsg) {
      _resultError.textContent     = errorMsg;
      _resultError.style.display   = '';
      _retryTransBtn.style.display = '';
    } else {
      _resultError.textContent     = '';
      _resultError.style.display   = 'none';
      _retryTransBtn.style.display = 'none';
    }
    _setActionBtnState(!!origText, !!transText);
    _showView('result');
  }

  function _setActionBtnState(hasOrig, hasTrans) {
    var speakBtn = _resultArea.querySelector('.camera-speak-btn');
    if (speakBtn) { speakBtn.disabled = !hasOrig || !App.speak.isAvailable; }

    var bigtextOrigBtn = _resultArea.querySelector('.camera-bigtext-orig-btn');
    if (bigtextOrigBtn) { bigtextOrigBtn.disabled = !hasOrig; }

    var bigtextTransBtn = _resultArea.querySelector('.camera-bigtext-trans-btn');
    if (bigtextTransBtn) { bigtextTransBtn.disabled = !hasTrans; }

    var copyOrigBtn = _resultArea.querySelector('.camera-copy-orig-btn');
    if (copyOrigBtn) { copyOrigBtn.disabled = !hasOrig; }

    var copyTransBtn = _resultArea.querySelector('.camera-copy-trans-btn');
    if (copyTransBtn) { copyTransBtn.disabled = !hasTrans; }
  }

  function _onRetryTranslate() {
    if (!_lastOcrText || _isProcessing) { return; }
    _isProcessing = true;
    _retryTransBtn.disabled = true;
    App.api.translate(_lastOcrText, 'ja', 'zh-TW')
      .then(function (translated) {
        _lastTranslation = translated;
        _isProcessing = false;
        _retryTransBtn.disabled = false;
        _showResult(_lastOcrText, translated, null);
      })
      .catch(function (err) {
        _isProcessing = false;
        _retryTransBtn.disabled = false;
        _resultError.textContent   = _errorMsg(err);
        _resultError.style.display = '';
      });
  }

  function _onRetake() {
    _lastOcrText     = null;
    _lastTranslation = null;
    _revokeObjectUrl();
    _showView('viewfinder');
    if (!_fallbackSticky) {
      _startCamera();
    }
  }

  // ── 事件 ─────────────────────────────────────────────────────────────────

  function _onShutter() {
    if (_isProcessing) { return; }
    if (_fallbackSticky) {
      // 降級模式：觸發原生相機 file input
      _captureInput.click();
      return;
    }
    if (!_isLive()) { return; }
    if (_video.videoWidth === 0) { return; }  // 尚未出幀（SA §7-g）

    var base64 = _captureFrame(_video, _video.videoWidth, _video.videoHeight);
    _stopStream();  // 拍照後立即停 track（省電＋隱私，spec §2）
    _processImage(base64);
  }

  /**
   * file input change handler（相簿＋原生拍照共用）
   * iOS 取消選圖不觸發 change，所以只在 change 且 files.length > 0 才處理（SA §3.2-7）
   */
  function _onFileChange(e) {
    // 先讀 file ref，再 reset value（reset 後 files 會清空）
    var file = e.target && e.target.files && e.target.files[0];
    if (e.target) { e.target.value = ''; }  // 同張圖可重選（SA §3.2-7）
    if (!file || _isProcessing) { return; }

    // 鎖定 processing（在 img decode 期間也阻止新觸發）
    _isProcessing = true;
    _shutterBtn.disabled = true;
    _albumBtn.disabled   = true;

    // 使用 <img>+objectURL 路徑（EXIF 方向由瀏覽器自動修正，禁 createImageBitmap，SA §3.2-5）
    _revokeObjectUrl();
    var url = URL.createObjectURL(file);
    _currentObjectUrl = url;

    _imgDecode.onload = function () {
      var base64 = _captureFrame(_imgDecode, _imgDecode.naturalWidth, _imgDecode.naturalHeight);
      _revokeObjectUrl();
      _imgDecode.src    = '';
      _imgDecode.onload = null;
      _imgDecode.onerror = null;
      // _isProcessing 仍為 true，由 _processImage 在完成後清除
      _processImage(base64);
    };
    _imgDecode.onerror = function () {
      _revokeObjectUrl();
      _imgDecode.src    = '';
      _imgDecode.onload = null;
      _imgDecode.onerror = null;
      _isProcessing = false;
      _shutterBtn.disabled = false;
      _albumBtn.disabled   = false;
      _resultOrigText.textContent  = '';
      _resultTransText.textContent = '';
      _resultError.textContent     = '無法讀取圖片，請再試一次';
      _resultError.style.display   = '';
      _retryTransBtn.style.display = 'none';
      _setActionBtnState(false, false);
      _showView('result');
    };
    _imgDecode.src = url;
  }

  // ── DOM 建構（冪等層，_initialized 旗標守門）────────────────────────────

  function _buildDOM(section) {
    _container = document.createElement('div');
    _container.className = 'camera-container';

    // ── 語言列（靜態）────────────────────────────────────────────────────
    var langBar = document.createElement('div');
    langBar.className = 'camera-lang-bar';
    langBar.textContent = '日文 → 中文';
    _container.appendChild(langBar);

    // ── 取景區 ───────────────────────────────────────────────────────────
    _viewfinderArea = document.createElement('div');
    _viewfinderArea.className = 'camera-viewfinder-area';

    // <video>：三件套 attribute＋JS 屬性（iOS 版本間有只認其一的歷史，SA §3.2-1）
    _video = document.createElement('video');
    _video.setAttribute('playsinline', '');
    _video.setAttribute('muted', '');
    _video.setAttribute('autoplay', '');
    _video.playsInline = true;
    _video.muted       = true;
    _video.className   = 'camera-video';
    _viewfinderArea.appendChild(_video);

    // 掃描框四角（CSS 負責角括號樣式）
    _scanFrame = document.createElement('div');
    _scanFrame.className = 'camera-scan-frame';
    _viewfinderArea.appendChild(_scanFrame);

    // 提示文字（live 模式顯示，降級時隱藏）
    _scanHint = document.createElement('div');
    _scanHint.className   = 'camera-scan-hint';
    _scanHint.textContent = '對準要翻譯的文字';
    _viewfinderArea.appendChild(_scanHint);

    // 降級佔位（初始隱藏）
    _fallbackHolder = document.createElement('div');
    _fallbackHolder.className     = 'camera-fallback-holder';
    _fallbackHolder.style.display = 'none';
    _fallbackText = document.createElement('p');
    _fallbackText.className   = 'camera-fallback-text';
    _fallbackText.textContent = '無法使用即時取景，可用下方快門開相機拍照';
    _fallbackHolder.appendChild(_fallbackText);
    _viewfinderArea.appendChild(_fallbackHolder);

    _container.appendChild(_viewfinderArea);

    // ── 處理中視圖（初始隱藏）────────────────────────────────────────────
    _processingArea = document.createElement('div');
    _processingArea.className     = 'camera-processing-area';
    _processingArea.style.display = 'none';
    _statusText = document.createElement('p');
    _statusText.className   = 'camera-status-text';
    _statusText.textContent = '辨識中…';
    _processingArea.appendChild(_statusText);
    _container.appendChild(_processingArea);

    // ── 結果視圖（初始隱藏）──────────────────────────────────────────────
    _resultArea = document.createElement('div');
    _resultArea.className     = 'camera-result-area';
    _resultArea.style.display = 'none';

    // 原文卡（日文）
    var origCard = document.createElement('div');
    origCard.className = 'camera-result-card camera-result-orig-card';
    var origLabel = document.createElement('div');
    origLabel.className   = 'camera-result-card-label';
    origLabel.textContent = '原文（日文）';
    _resultOrigText = document.createElement('div');
    _resultOrigText.className = 'camera-result-orig-text';
    origCard.appendChild(origLabel);
    origCard.appendChild(_resultOrigText);
    _resultArea.appendChild(origCard);

    // 譯文卡（中文，字級由 CSS 控制為較大主體）
    var transCard = document.createElement('div');
    transCard.className = 'camera-result-card camera-result-trans-card';
    var transLabel = document.createElement('div');
    transLabel.className   = 'camera-result-card-label';
    transLabel.textContent = '翻譯（中文）';
    _resultTransText = document.createElement('div');
    _resultTransText.className = 'camera-result-trans-text';
    transCard.appendChild(transLabel);
    transCard.appendChild(_resultTransText);
    _resultArea.appendChild(transCard);

    // 錯誤訊息（預設隱藏）
    _resultError = document.createElement('div');
    _resultError.className     = 'camera-result-error';
    _resultError.style.display = 'none';
    _resultArea.appendChild(_resultError);

    // 重試翻譯鈕（預設隱藏；OCR 成功翻譯失敗時顯示）
    _retryTransBtn = document.createElement('button');
    _retryTransBtn.className     = 'camera-action-btn camera-retry-trans-btn';
    _retryTransBtn.textContent   = '重試翻譯';
    _retryTransBtn.style.display = 'none';
    _resultArea.appendChild(_retryTransBtn);

    // 動作鈕列
    var actions = document.createElement('div');
    actions.className = 'camera-result-actions';

    var bigtextOrigBtn = document.createElement('button');
    bigtextOrigBtn.className   = 'camera-action-btn camera-bigtext-orig-btn';
    bigtextOrigBtn.textContent = '大字（原文）';

    var bigtextTransBtn = document.createElement('button');
    bigtextTransBtn.className   = 'camera-action-btn camera-bigtext-trans-btn';
    bigtextTransBtn.textContent = '大字（譯文）';

    var speakBtn = document.createElement('button');
    speakBtn.className   = 'camera-action-btn camera-speak-btn';
    speakBtn.textContent = '播音';
    if (!App.speak.isAvailable) { speakBtn.disabled = true; }  // SA §7-c

    var copyOrigBtn = document.createElement('button');
    copyOrigBtn.className   = 'camera-action-btn camera-copy-orig-btn';
    copyOrigBtn.textContent = '複製原文';

    var copyTransBtn = document.createElement('button');
    copyTransBtn.className   = 'camera-action-btn camera-copy-trans-btn';
    copyTransBtn.textContent = '複製譯文';

    var retakeBtn = document.createElement('button');
    retakeBtn.className   = 'camera-action-btn camera-retake-btn';
    retakeBtn.textContent = '重拍';

    actions.appendChild(bigtextOrigBtn);
    actions.appendChild(bigtextTransBtn);
    actions.appendChild(speakBtn);
    actions.appendChild(copyOrigBtn);
    actions.appendChild(copyTransBtn);
    actions.appendChild(retakeBtn);
    _resultArea.appendChild(actions);
    _container.appendChild(_resultArea);

    // ── 底部操作列（flex-shrink:0 由 CSS 保證，Task11 U2 紀律）───────────
    var bottomBar = document.createElement('div');
    bottomBar.className = 'camera-bottom-bar';

    _albumBtn = document.createElement('button');
    _albumBtn.className = 'camera-album-btn';
    var albumIcon = document.createElement('span');
    albumIcon.className   = 'camera-btn-icon';
    albumIcon.textContent = '🖼';
    var albumLabel = document.createElement('span');
    albumLabel.className   = 'camera-btn-label';
    albumLabel.textContent = '相簿';
    _albumBtn.appendChild(albumIcon);
    _albumBtn.appendChild(albumLabel);

    _shutterBtn = document.createElement('button');
    _shutterBtn.className = 'camera-shutter-btn';
    _shutterBtn.setAttribute('aria-label', '拍照');

    bottomBar.appendChild(_albumBtn);
    bottomBar.appendChild(_shutterBtn);
    _container.appendChild(bottomBar);

    // ── 隱藏的 file input（必須無條件建於 DOM，SA §3.2-3）────────────────
    // capture=environment：原生相機（降級快門觸發）
    _captureInput = document.createElement('input');
    _captureInput.type   = 'file';
    _captureInput.accept = 'image/*';
    _captureInput.setAttribute('capture', 'environment');
    _captureInput.style.cssText =
      'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
    _container.appendChild(_captureInput);

    // 無 capture：相簿（album 鈕觸發）
    _albumInput = document.createElement('input');
    _albumInput.type   = 'file';
    _albumInput.accept = 'image/*';
    _albumInput.style.cssText =
      'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
    _container.appendChild(_albumInput);

    // EXIF 解碼用隱藏 <img>（SA §3.2-5：禁 createImageBitmap）
    _imgDecode = document.createElement('img');
    _imgDecode.alt       = '';
    _imgDecode.style.cssText =
      'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
    _container.appendChild(_imgDecode);

    section.appendChild(_container);

    // ── 事件監聽（各一次）────────────────────────────────────────────────
    _shutterBtn.addEventListener('click', _onShutter);
    _albumBtn.addEventListener('click', function () { _albumInput.click(); });
    _captureInput.addEventListener('change', _onFileChange);
    _albumInput.addEventListener('change', _onFileChange);
    _retryTransBtn.addEventListener('click', _onRetryTranslate);
    retakeBtn.addEventListener('click', _onRetake);

    bigtextOrigBtn.addEventListener('click', function () {
      // SA §7-d：ja-only 呼叫（B3 置中路徑）
      if (_lastOcrText) { App.showBigText({ ja: _lastOcrText }); }
    });
    bigtextTransBtn.addEventListener('click', function () {
      // SA §7-d：主文字槽放中文譯文，lang='zh-TW'（Task12 契約）
      if (_lastTranslation) { App.showBigText({ ja: _lastTranslation, lang: 'zh-TW' }); }
    });
    speakBtn.addEventListener('click', function () {
      // 單參預設 ja-JP（Task12 契約；Task12.api.md「既有單參呼叫零 diff」）
      if (_lastOcrText) { App.speak(_lastOcrText); }
    });
    copyOrigBtn.addEventListener('click', function () {
      if (_lastOcrText && navigator.clipboard) {
        navigator.clipboard.writeText(_lastOcrText).catch(function () {});
      }
    });
    copyTransBtn.addEventListener('click', function () {
      if (_lastTranslation && navigator.clipboard) {
        navigator.clipboard.writeText(_lastTranslation).catch(function () {});
      }
    });

    // ── 生命週期監聽（init 時各一次，掛 document/window 不掛 section）────
    // ⚠ 獨立 listener，不得與 app.js Task14 的 visibilitychange 合併（SA §0-bis 定案）
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        _stopStream();
      } else {
        // 背景返回：camera 當前分頁 + live 取景視圖 → 重啟 stream（SA §3.1）
        var sec = document.getElementById('tab-camera');
        if (sec && !sec.hidden && _view === 'viewfinder' && !_fallbackSticky) {
          _startCamera();
        }
      }
    });
    window.addEventListener('pagehide', function () { _stopStream(); });
  }

  // ── onShow（冪等層 + 生命週期層，SA §4 定案）─────────────────────────────

  function onShow() {
    // 冪等層：DOM 與監聽只建一次
    if (!_initialized) {
      var section = document.getElementById('tab-camera');
      if (!section) { return; }
      _buildDOM(section);
      _initialized = true;
    }

    // 生命週期層：依「當前視圖＋track 存活」分派（SA §4 狀態表）
    if (_view === 'viewfinder' && !_fallbackSticky && !_isLive()) {
      _startCamera();
    }
    // view === 'result'      → 保留結果，不重啟相機（使用者可按重拍）
    // view === 'processing'  → fetch 在途，讓它完成後更新 DOM（SA §7-f：無需 AbortController）
  }

  // ── registerTab ──────────────────────────────────────────────────────────

  /* global App */
  window.App = window.App || {};
  App.registerTab('camera', { onShow: onShow });

  // ── additive wrap：App.showTab 第四層 ────────────────────────────────────
  // 載入位置：translate-tab.js 之後、coupon-viewer.js 之前（Task6.spec §7 定案）
  // 執行鏈（外→內）：coupon-viewer → camera-tab → translate-tab → bigtext → app.js
  //
  // 守門：camera 當前可見 && 目標 id !== 'camera'（重按不中斷取景）
  // 動作：停 track ＋ App.speak.cancel()（SA §2.1/§7-e 定案，守門保證不誤殺他頁）
  (function () {
    if (App && typeof App.showTab === 'function') {
      var _prev = App.showTab;
      App.showTab = function (id) {
        var section = document.getElementById('tab-camera');
        if (section && !section.hidden && id !== 'camera') {
          _stopStream();
          if (App.speak && typeof App.speak.cancel === 'function') {
            App.speak.cancel();
          }
        }
        return _prev(id);
      };
    }
  }());

}());
