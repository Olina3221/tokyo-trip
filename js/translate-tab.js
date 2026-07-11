/**
 * js/translate-tab.js — 翻譯分頁（中⇄日，Cloud Translation API v2）
 *
 * 依賴（依 index.html 載入順序）：
 *   app.js → tts.js → bigtext.js → api.js → translate-tab.js
 *
 * 職責：
 *   - App.registerTab('translate', { onShow })
 *   - 方向狀態（tokyotrip.translateDir，預設 zh2ja）
 *   - 呼叫 App.api.translate 並渲染結果
 *   - 五種錯誤碼各有固定友善訊息
 *   - 中→日結果接 App.showBigText({ ja, zh }) / App.speak / 複製
 *   - 防連點、輸入上限 500（text.length 計法）、方向切換清空結果
 *   - onShow 冪等：DOM 只建一次，跨分頁切換內容記憶體保留（不進 localStorage）
 *
 * DOM/class 定義（供 frontend CSS 與 Task5.api.md 參照）：
 *   .translate-container       最外層 wrapper
 *   .translate-input-area      輸入區（flex-shrink:0，非主捲動區）
 *   .translate-dir-row         方向列（label + toggle 鈕）
 *   .translate-dir-label       當前方向文字（例「中文 → 日文」）
 *   .translate-dir-toggle      方向切換按鈕
 *   .translate-textarea        輸入框（font-size ≥16px、rows=4）
 *   .translate-char-row        字數列
 *   .translate-char-count      已輸入字數提示
 *   .translate-char-error      超過上限時顯示的紅字（預設 display:none）
 *   .translate-btn             翻譯送出按鈕
 *   .translate-result-area     結果區（預設 display:none）
 *   .translate-result-text     翻譯結果文字
 *   .translate-result-actions  動作鈕列
 *   .translate-action-btn      動作鈕共用 class
 *   .translate-bigtext-btn     大字鈕（僅中→日方向顯示）
 *   .translate-speak-btn       播音鈕（僅中→日方向顯示）
 *   .translate-copy-btn        複製鈕（雙向皆顯示）
 *   .translate-error           錯誤訊息區（預設 display:none）
 */
(function () {
  'use strict';

  var DIR_KEY     = 'tokyotrip.translateDir';
  var DEFAULT_DIR = 'zh2ja';
  var MAX_CHARS   = 500;

  // ── localStorage helpers ─────────────────────────────────────────────────
  function _getDir() {
    try {
      var v = localStorage.getItem(DIR_KEY);
      return (v === 'zh2ja' || v === 'ja2zh') ? v : DEFAULT_DIR;
    } catch (e) {
      return DEFAULT_DIR;
    }
  }

  function _saveDir(dir) {
    try { localStorage.setItem(DIR_KEY, dir); } catch (e) { /* 私密瀏覽降級 */ }
  }

  // ── 方向設定 ─────────────────────────────────────────────────────────────
  var DIRS = {
    zh2ja: { fromCode: 'zh-TW', toCode: 'ja',   label: '中文 → 日文' },
    ja2zh: { fromCode: 'ja',    toCode: 'zh-TW', label: '日文 → 中文' },
  };

  // ── 錯誤訊息對照表 ────────────────────────────────────────────────────────
  var ERROR_MSG = {
    NO_KEY:     '尚未設定 Google API 金鑰，請見 README.md',
    OFFLINE:    '翻譯需要網路連線',
    HTTP_403:   '金鑰未授權此網址（本機測試屬正常，請在正式網址使用）',
    HTTP_429:   '翻譯額度暫時用盡，稍後再試',
    HTTP_OTHER: '翻譯失敗，請重試',
  };

  // ── 分頁狀態（記憶體，不進 localStorage） ─────────────────────────────────
  var _initialized   = false;
  var _dir           = DEFAULT_DIR;
  var _isTranslating = false;
  var _lastInput     = '';   // 最後一次送出翻譯的原文（trim 後）
  var _lastResult    = '';   // 最後一次翻譯結果

  // ── DOM 參照（_initialized 後填入） ──────────────────────────────────────
  var _el = {};

  // ── 渲染輔助 ─────────────────────────────────────────────────────────────
  function _updateDirLabel() {
    _el.dirLabel.textContent = DIRS[_dir].label;
  }

  function _updateCharRow() {
    var len = _el.textarea.value.length;
    _el.charCount.textContent = len + ' / ' + MAX_CHARS;
    _el.charError.style.display = (len > MAX_CHARS) ? '' : 'none';
  }

  function _updateTranslateBtn() {
    var raw   = _el.textarea.value;
    var empty = raw.trim().length === 0;
    var over  = raw.length > MAX_CHARS;
    _el.translateBtn.disabled    = empty || over || _isTranslating;
    _el.translateBtn.textContent = _isTranslating ? '翻譯中…' : '翻譯';
  }

  function _updateActionBtns() {
    var zh2ja = (_dir === 'zh2ja');
    _el.bigTextBtn.style.display = zh2ja ? '' : 'none';
    _el.speakBtn.style.display   = zh2ja ? '' : 'none';
    if (zh2ja) {
      _el.speakBtn.disabled = !App.speak.isAvailable;
    }
  }

  function _showResult(result) {
    _lastResult = result;
    _el.resultText.textContent   = result;
    _el.resultArea.style.display = '';
    _el.errorArea.style.display  = 'none';
    _updateActionBtns();
  }

  function _showError(code) {
    _el.errorArea.textContent    = ERROR_MSG[code] || ERROR_MSG.HTTP_OTHER;
    _el.errorArea.style.display  = '';
    _el.resultArea.style.display = 'none';
  }

  function _clearResultArea() {
    _lastResult = '';
    _el.resultArea.style.display = 'none';
    _el.errorArea.style.display  = 'none';
  }

  // ── DOM 建構（只跑一次）────────────────────────────────────────────────────
  function _buildDOM(section) {
    section.innerHTML = '';   // 清除佔位卡

    var container = document.createElement('div');
    container.className = 'translate-container';

    // ── 輸入區（flex-shrink:0，非主捲動區，Task11 紀律）────────────────────
    var inputArea = document.createElement('div');
    inputArea.className = 'translate-input-area';

    var dirRow = document.createElement('div');
    dirRow.className = 'translate-dir-row';

    var dirLabel = document.createElement('span');
    dirLabel.className = 'translate-dir-label';
    _el.dirLabel = dirLabel;

    var dirToggle = document.createElement('button');
    dirToggle.type = 'button';
    dirToggle.className   = 'translate-dir-toggle';
    dirToggle.textContent = '切換方向';
    _el.dirToggle = dirToggle;

    dirRow.appendChild(dirLabel);
    dirRow.appendChild(dirToggle);

    var textarea = document.createElement('textarea');
    textarea.className   = 'translate-textarea';
    textarea.placeholder = '輸入要翻譯的文字…';
    textarea.rows        = 4;
    _el.textarea = textarea;

    var charRow = document.createElement('div');
    charRow.className = 'translate-char-row';

    var charCount = document.createElement('span');
    charCount.className   = 'translate-char-count';
    charCount.textContent = '0 / ' + MAX_CHARS;
    _el.charCount = charCount;

    var charError = document.createElement('span');
    charError.className     = 'translate-char-error';
    charError.textContent   = '超過 ' + MAX_CHARS + ' 字';
    charError.style.display = 'none';
    _el.charError = charError;

    charRow.appendChild(charCount);
    charRow.appendChild(charError);

    var translateBtn = document.createElement('button');
    translateBtn.type = 'button';
    translateBtn.className   = 'translate-btn';
    translateBtn.textContent = '翻譯';
    translateBtn.disabled    = true;
    _el.translateBtn = translateBtn;

    inputArea.appendChild(dirRow);
    inputArea.appendChild(textarea);
    inputArea.appendChild(charRow);
    inputArea.appendChild(translateBtn);

    // ── 結果區（預設隱藏）────────────────────────────────────────────────
    var resultArea = document.createElement('div');
    resultArea.className     = 'translate-result-area';
    resultArea.style.display = 'none';
    _el.resultArea = resultArea;

    var resultText = document.createElement('p');
    resultText.className = 'translate-result-text';
    _el.resultText = resultText;

    var resultActions = document.createElement('div');
    resultActions.className = 'translate-result-actions';

    var bigTextBtn = document.createElement('button');
    bigTextBtn.type = 'button';
    bigTextBtn.className   = 'translate-action-btn translate-bigtext-btn';
    bigTextBtn.textContent = '大字';
    _el.bigTextBtn = bigTextBtn;

    var speakBtn = document.createElement('button');
    speakBtn.type = 'button';
    speakBtn.className   = 'translate-action-btn translate-speak-btn';
    speakBtn.textContent = '播音';
    _el.speakBtn = speakBtn;

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className   = 'translate-action-btn translate-copy-btn';
    copyBtn.textContent = '複製';
    _el.copyBtn = copyBtn;

    resultActions.appendChild(bigTextBtn);
    resultActions.appendChild(speakBtn);
    resultActions.appendChild(copyBtn);
    resultArea.appendChild(resultText);
    resultArea.appendChild(resultActions);

    // ── 錯誤區（預設隱藏）────────────────────────────────────────────────
    var errorArea = document.createElement('div');
    errorArea.className     = 'translate-error';
    errorArea.style.display = 'none';
    _el.errorArea = errorArea;

    container.appendChild(inputArea);
    container.appendChild(resultArea);
    container.appendChild(errorArea);
    section.appendChild(container);

    // ── 事件 ──────────────────────────────────────────────────────────────

    textarea.addEventListener('input', function () {
      _updateCharRow();
      _updateTranslateBtn();
    });

    dirToggle.addEventListener('click', function () {
      _dir = (_dir === 'zh2ja') ? 'ja2zh' : 'zh2ja';
      _saveDir(_dir);
      _updateDirLabel();
      _clearResultArea();   // 方向切換清空結果（防舊結果配錯方向鈕）
      _updateTranslateBtn();
    });

    translateBtn.addEventListener('click', function () {
      if (_isTranslating) return;                          // 防連點
      var raw  = textarea.value;
      var text = raw.trim();
      if (!text || raw.length > MAX_CHARS) return;        // 雙重防禦

      _isTranslating = true;
      _lastInput     = text;
      _updateTranslateBtn();
      _clearResultArea();

      var d = DIRS[_dir];
      App.api.translate(text, d.fromCode, d.toCode)
        .then(function (result) {
          _isTranslating = false;
          _updateTranslateBtn();
          if (!result) { _showError('HTTP_OTHER'); return; }
          _showResult(result);
        })
        .catch(function (err) {
          _isTranslating = false;
          _updateTranslateBtn();
          _showError((err && err.code) ? err.code : 'HTTP_OTHER');
        });
    });

    bigTextBtn.addEventListener('click', function () {
      if (!_lastResult) return;
      // 中→日：ja = 日文翻譯結果，zh = 原文中文（傳給店員看的雙語大字）
      App.showBigText({ ja: _lastResult, zh: _lastInput });
    });

    speakBtn.addEventListener('click', function () {
      if (!_lastResult || !App.speak.isAvailable) return;
      App.speak(_lastResult);
    });

    copyBtn.addEventListener('click', function () {
      if (!_lastResult) return;
      navigator.clipboard.writeText(_lastResult)
        .then(function () {
          var orig = copyBtn.textContent;
          copyBtn.textContent = '已複製';
          setTimeout(function () { copyBtn.textContent = orig; }, 1500);
        })
        .catch(function () { /* 複製失敗靜默，不彈窗 */ });
    });
  }

  // ── 分頁註冊 ──────────────────────────────────────────────────────────────
  App.registerTab('translate', {
    onShow: function () {
      if (_initialized) return;   // 冪等：DOM 只建一次
      _initialized = true;

      _dir = _getDir();
      var section = document.getElementById('tab-translate');
      _buildDOM(section);
      _updateDirLabel();
      _updateCharRow();
      _updateTranslateBtn();
    },
  });

}());
