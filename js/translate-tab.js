/**
 * js/translate-tab.js — 翻譯分頁（Task5 文字翻譯 + Task12 對話語音模式 + Task15 面對面版面）
 *
 * 依賴（依 index.html 載入順序）：
 *   app.js → tts.js → bigtext.js → api.js → recorder.js → translate-tab.js
 *
 * Task5 職責（零 diff 保證）：
 *   - App.registerTab('translate', { onShow })
 *   - 方向狀態（tokyotrip.translateDir，預設 zh2ja）
 *   - 呼叫 App.api.translate 並渲染結果
 *   - 五種錯誤碼各有固定友善訊息
 *   - 中→日結果接 App.showBigText({ ja, zh }) / App.speak / 複製
 *   - 防連點、輸入上限 500、方向切換清空結果
 *   - onShow 冪等：DOM 只建一次
 *
 * Task12 追加：
 *   - 頂部 segmented「文字 / 對話」切換（外殼），不改 Task5 任何行為
 *   - 對話模式：錄音→STT→翻譯→TTS（Task13 雙向自動播）
 *   - tokyotrip.translateMode 記憶（預設 'talk'）
 *   - wrap App.showTab 三層（coupon-viewer→translate-tab→bigtext→原函式）
 *
 * Task15 對話模式版面改版（面對面）：
 *   - _buildTalkDOM 重寫為上半（日方旋轉）/ 下半（Olina 正向）雙側結構
 *   - 覆蓋式雙槽（退場氣泡歷史）、分側狀態文案與錯誤路由
 *   - G4 自動播守門語意零變更，顯示位置改聽話者側
 *
 * DOM/class 定義（完整見 Task15.api.md）：
 * ── 外殼 ──
 *   .translate-mode-seg          segmented control（flex-shrink:0）
 *   .translate-mode-btn          段落按鈕（共兩個）
 *   .translate-mode-btn-active   作用中按鈕
 *   .translate-container         文字模式容器（Task5 既有）
 *   .talk-container              對話模式容器（Task12/15）
 * ── 面對面對話模式（Task15）──
 *   .talk-side                   每側共用基底 class
 *   .talk-side-ja                上半（日方），CSS rotate(180deg)
 *   .talk-side-zh                下半（Olina，正向）
 *   .talk-side-lang              語言標示（「日本語」／「中文」）
 *   .talk-side-orig              辨識原文小字（前綴「認識：」／「辨識：」）
 *   .talk-side-result            譯文大字槽（overflow-y:auto，覆蓋更新）
 *   .talk-side-status            狀態列文案
 *   .talk-side-actions           動作鈕容器
 *   .talk-side-speak             🔊 重播 / 再生鈕
 *   .talk-side-bigtext           ⤢ 大字 / 大きく鈕
 *   .talk-side-mic               麥克風鈕（每側各一）
 *   .talk-mic-active             錄音中麥克風鈕 class（class 名保留，keyframes 重用）
 *   .talk-divider                中央分隔帶（含 ⇄ 圖示）
 */
(function () {
  'use strict';

  // ════════════════════════════════════════════════════════════════════════════
  // Task5 文字模式常數與輔助（零 diff 清單起點）
  // ════════════════════════════════════════════════════════════════════════════

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

  // ════════════════════════════════════════════════════════════════════════════
  // Task12/15 對話模式
  // ════════════════════════════════════════════════════════════════════════════

  var MODE_KEY     = 'tokyotrip.translateMode';

  // STT 語言碼（與 translate / TTS 碼分開，§4.3 grep 判準）
  var STT_LANG = {
    zh: 'cmn-Hant-TW',   // ← 只准出現在 speechToText 的 languageCode 引數
    ja: 'ja-JP',
  };

  // 對話錯誤訊息
  var TALK_ERROR_MSG = {
    MIC_DENIED:    '麥克風權限被拒。請到 iOS 設定開啟本 APP 的麥克風權限後，再按一次麥克風重試',
    MIC_UNAVAILABLE: '找不到可用的麥克風',
    NO_AUDIO:      '沒錄到聲音，請再按一次麥克風重試',
    NOT_SUPPORTED: '此瀏覽器不支援錄音，請改用文字模式',
    OTHER:         '錄音失敗，請重試',
    // STT API 錯誤
    NO_KEY:        '尚未設定 Google API 金鑰，請見 README.md',
    OFFLINE:       '語音辨識需要網路連線',
    HTTP_403:      '語音辨識服務未授權（API 未啟用、金鑰限制或網域限制）',
    HTTP_429:      '今日用量已滿，請稍後再試',
    HTTP_OTHER:    '語音辨識失敗，請重試',
  };

  // 對話狀態機：'idle' | 'recording' | 'recognizing' | 'translating'
  var _talkState    = 'idle';
  var _talkLang     = null;   // 'zh' | 'ja'，本次錄音語言
  var _talkTimer    = null;   // 60 秒計時器

  // 每側最新結果（記憶體，不進 localStorage）
  var _side = { zh: { result: '' }, ja: { result: '', origZh: '' } };

  var _talkEl       = {};     // 對話 DOM 參照
  var _talkDOMBuilt = false;

  // ── localStorage：模式記憶 ────────────────────────────────────────────────
  function _getMode() {
    try {
      var v = localStorage.getItem(MODE_KEY);
      return (v === 'text' || v === 'talk') ? v : 'talk';
    } catch (e) {
      return 'talk';
    }
  }

  function _saveMode(mode) {
    try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}
  }

  // ── _abortTalk()：清 timer + abort + cancel + 回 idle + UI 復位 ──────────
  // G3：所有離開 recording 的路徑都必須呼叫此函式
  function _abortTalk() {
    clearTimeout(_talkTimer);
    _talkTimer = null;
    if (App.recorder) App.recorder.abort();
    if (App.speak && typeof App.speak.cancel === 'function') App.speak.cancel();
    _talkState = 'idle';
    _talkLang  = null;
    if (_talkDOMBuilt) _updateTalkUI();
  }

  // ── 對話 UI 狀態更新（驅動兩側）──────────────────────────────────────────
  function _updateTalkUI() {
    if (!_talkDOMBuilt) return;

    var idle        = (_talkState === 'idle');
    var recording   = (_talkState === 'recording');
    var unavailable = (!App.recorder || !App.recorder.isAvailable);

    // 麥克風鈕 disabled 規則（G2/G5 沿用；unavailable 永久 disabled）
    _talkEl.micZh.disabled = (_talkState === 'recognizing' || _talkState === 'translating')
                             || (recording && _talkLang === 'ja') || unavailable;
    _talkEl.micJa.disabled = (_talkState === 'recognizing' || _talkState === 'translating')
                             || (recording && _talkLang === 'zh') || unavailable;

    // 麥克風鈕文案 + active class
    if (recording && _talkLang === 'zh') {
      _talkEl.micZh.textContent = '■ 停止';
      _talkEl.micZh.classList.add('talk-mic-active');
    } else {
      _talkEl.micZh.textContent = '🎤 點我說中文';
      _talkEl.micZh.classList.remove('talk-mic-active');
    }
    if (recording && _talkLang === 'ja') {
      _talkEl.micJa.textContent = '■ ストップ';
      _talkEl.micJa.classList.add('talk-mic-active');
    } else {
      _talkEl.micJa.textContent = '🎤 タップして話す';
      _talkEl.micJa.classList.remove('talk-mic-active');
    }

    // 狀態列文案（兩側分語言）
    if (unavailable) {
      _talkEl.zhStatus.textContent = TALK_ERROR_MSG.NOT_SUPPORTED;
      _talkEl.jaStatus.textContent = 'マイクを押して話してください';
      return;
    }

    if (idle) {
      _talkEl.zhStatus.textContent = '按下麥克風開始說話';
      _talkEl.jaStatus.textContent = 'マイクを押して話してください';
    } else if (_talkLang === 'zh') {
      // zh 說話中：zh 側顯示進行狀態，ja 側維持 idle
      if (recording) {
        _talkEl.zhStatus.textContent = '🔴 錄音中…說完再按一次';
      } else if (_talkState === 'recognizing') {
        _talkEl.zhStatus.textContent = '辨識中…';
      } else {
        _talkEl.zhStatus.textContent = '翻譯中…';
      }
      _talkEl.jaStatus.textContent = 'マイクを押して話してください';
    } else if (_talkLang === 'ja') {
      // ja 說話中：ja 側顯示進行狀態，zh 側維持 idle
      if (recording) {
        _talkEl.jaStatus.textContent = '🔴 録音中…もう一度押すと停止';
      } else if (_talkState === 'recognizing') {
        _talkEl.jaStatus.textContent = '認識中…';
      } else {
        _talkEl.jaStatus.textContent = '翻訳中…';
      }
      _talkEl.zhStatus.textContent = '按下麥克風開始說話';
    }
  }

  // ── 分側狀態文案寫入 ───────────────────────────────────────────────────────
  function _setSideStatus(side, msg) {
    if (!_talkDOMBuilt) return;
    if (side === 'ja') {
      _talkEl.jaStatus.textContent = msg;
    } else {
      _talkEl.zhStatus.textContent = msg;
    }
  }

  // ── 說話側辨識原文寫入 ────────────────────────────────────────────────────
  function _setSideOrig(side, text) {
    if (!_talkDOMBuilt) return;
    if (side === 'ja') {
      _talkEl.jaOrig.textContent = text;
    } else {
      _talkEl.zhOrig.textContent = text;
    }
  }

  // ── 聽話側譯文寫入（覆蓋式，scrollTop 歸 0）──────────────────────────────
  function _setSideResult(listenerLang, result, origZh) {
    if (listenerLang === 'ja') {
      _side.ja.result = result;
      if (origZh !== undefined) _side.ja.origZh = origZh;
      if (_talkDOMBuilt) {
        _talkEl.jaResult.textContent  = result;
        _talkEl.jaResult.scrollTop    = 0;
        _talkEl.jaSpeakBtn.disabled   = !result;
        _talkEl.jaBigtextBtn.disabled = !result;
      }
    } else {
      _side.zh.result = result;
      if (_talkDOMBuilt) {
        _talkEl.zhResult.textContent  = result;
        _talkEl.zhResult.scrollTop    = 0;
        _talkEl.zhSpeakBtn.disabled   = !result;
        _talkEl.zhBigtextBtn.disabled = !result;
      }
    }
  }

  // ── 處理錄音結果：STT → 翻譯 → 顯示槽 → TTS ─────────────────────────────
  function _processTalk(lang, base64) {
    var sttLang   = STT_LANG[lang];  // cmn-Hant-TW or ja-JP
    var transFrom = (lang === 'zh') ? 'zh-TW' : 'ja';
    var transTo   = (lang === 'zh') ? 'ja'    : 'zh-TW';

    _talkState = 'recognizing';
    _updateTalkUI();

    App.api.speechToText(base64, sttLang)
      .then(function (transcript) {
        // 空結果（沒聽清楚）→ 說話側狀態列，槽不動
        if (!transcript || !transcript.trim()) {
          _talkState = 'idle';
          _updateTalkUI();
          _setSideStatus(lang, lang === 'zh'
            ? '沒有聽清楚，請再說一次'
            : '聞き取れませんでした。もう一度お願いします');
          return;
        }

        // G12：transcript > 500 字截斷
        var text = transcript.length > MAX_CHARS
                   ? transcript.slice(0, MAX_CHARS)
                   : transcript;

        // 說話側原文（STT 成功當下，進 translating 前）
        _setSideOrig(lang, (lang === 'zh' ? '辨識：' : '認識：') + text);

        _talkState = 'translating';
        _updateTalkUI();

        App.api.translate(text, transFrom, transTo)
          .then(function (result) {
            _talkState = 'idle';
            _updateTalkUI();

            // 顯示寫入（守門外，無條件執行；in-flight 結果照寫，不播）
            var listenerLang = (lang === 'zh') ? 'ja' : 'zh';
            _setSideResult(listenerLang, result, lang === 'zh' ? text : undefined);

            // G4：自動播條件 = translate 為當前分頁 && 模式仍為 'talk'（Task13：兩方向共用）
            var section = document.getElementById('tab-translate');
            var curMode = _getMode();
            if (section && !section.hidden && curMode === 'talk') {
              App.speak(result, (lang === 'zh') ? 'ja-JP' : 'zh-TW');
            }
          })
          .catch(function (err) {
            _talkState = 'idle';
            _updateTalkUI();
            var code = (err && err.code) ? err.code : 'HTTP_OTHER';
            // 辨識到的原文保留顯示（spec §8）
            _setSideStatus('zh', (TALK_ERROR_MSG[code] || TALK_ERROR_MSG.HTTP_OTHER)
                            + '\n（辨識到：' + text + '）');
          });
      })
      .catch(function (err) {
        _talkState = 'idle';
        _updateTalkUI();
        var code = (err && err.code) ? err.code : 'HTTP_OTHER';
        _setSideStatus('zh', TALK_ERROR_MSG[code] || TALK_ERROR_MSG.HTTP_OTHER);
      });
  }

  // ── 麥克風鈕點擊處理（tap-tap 狀態機）──────────────────────────────────
  function _onMicClick(lang) {
    if (_talkState === 'recognizing' || _talkState === 'translating') return; // G5

    if (_talkState === 'recording') {
      // 再按同一顆 → 停止並辨識
      if (_talkLang !== lang) return; // 另一顆鈕在 recording 中應為 disabled
      clearTimeout(_talkTimer);
      _talkTimer = null;

      App.recorder.stop()
        .then(function (result) {
          _processTalk(lang, result.base64);
        })
        .catch(function (err) {
          _talkState = 'idle';
          _talkLang  = null;
          _updateTalkUI();
          var code = (err && err.code) ? err.code : 'OTHER';
          _setSideStatus('zh', TALK_ERROR_MSG[code] || TALK_ERROR_MSG.OTHER);
        });
      return;
    }

    // idle → 開始錄音
    // G2：立刻雙鈕 disabled（pending 期間防重入）
    _talkEl.micZh.disabled = true;
    _talkEl.micJa.disabled = true;

    // 先 cancel TTS（防喇叭聲進麥克風，spec §1）
    if (App.speak && typeof App.speak.cancel === 'function') App.speak.cancel();

    App.recorder.start()
      .then(function () {
        _talkState = 'recording';
        _talkLang  = lang;
        _updateTalkUI();

        // 60 秒上限自動停（G3：逾時等同按停止）
        _talkTimer = setTimeout(function () {
          if (_talkState !== 'recording') return; // G3：雙觸發保護
          clearTimeout(_talkTimer);
          _talkTimer = null;

          App.recorder.stop()
            .then(function (result) {
              _processTalk(lang, result.base64);
            })
            .catch(function (err) {
              _talkState = 'idle';
              _talkLang  = null;
              _updateTalkUI();
              var code = (err && err.code) ? err.code : 'OTHER';
              _setSideStatus('zh', TALK_ERROR_MSG[code] || TALK_ERROR_MSG.OTHER);
            });
        }, 60000);
      })
      .catch(function (err) {
        _talkState = 'idle';
        _talkLang  = null;
        _updateTalkUI();
        var code = (err && err.code) ? err.code : 'OTHER';
        _setSideStatus('zh', TALK_ERROR_MSG[code] || TALK_ERROR_MSG.OTHER);
      });
  }

  // ── 對話模式 DOM 建構（面對面版面，首次進入時建，冪等）──────────────────
  function _buildTalkDOM(talkContainer) {
    if (_talkDOMBuilt) return;
    _talkDOMBuilt = true;

    // ── 上半（日方）— 整個容器 CSS rotate(180deg) ─────────────────────────
    var jaSide = document.createElement('div');
    jaSide.className = 'talk-side talk-side-ja';

    var jaLang = document.createElement('div');
    jaLang.className = 'talk-side-lang';
    jaLang.textContent = '日本語';

    var jaOrig = document.createElement('div');
    jaOrig.className = 'talk-side-orig';
    _talkEl.jaOrig = jaOrig;

    var jaResult = document.createElement('div');
    jaResult.className = 'talk-side-result';
    _talkEl.jaResult = jaResult;

    var jaStatus = document.createElement('div');
    jaStatus.className = 'talk-side-status';
    jaStatus.textContent = 'マイクを押して話してください';
    _talkEl.jaStatus = jaStatus;

    var jaActions = document.createElement('div');
    jaActions.className = 'talk-side-actions';

    var jaSpeakBtn = document.createElement('button');
    jaSpeakBtn.type = 'button';
    jaSpeakBtn.className = 'talk-side-speak';
    jaSpeakBtn.textContent = '🔊 再生';
    jaSpeakBtn.disabled = true;
    _talkEl.jaSpeakBtn = jaSpeakBtn;

    var jaBigtextBtn = document.createElement('button');
    jaBigtextBtn.type = 'button';
    jaBigtextBtn.className = 'talk-side-bigtext';
    jaBigtextBtn.textContent = '⤢ 大きく';
    jaBigtextBtn.disabled = true;
    _talkEl.jaBigtextBtn = jaBigtextBtn;

    jaActions.appendChild(jaSpeakBtn);
    jaActions.appendChild(jaBigtextBtn);

    var jaMic = document.createElement('button');
    jaMic.type = 'button';
    jaMic.className = 'talk-side-mic';
    jaMic.textContent = '🎤 タップして話す';
    _talkEl.micJa = jaMic;  // key 沿用 micJa（G2 相容）

    jaSide.appendChild(jaLang);
    jaSide.appendChild(jaOrig);
    jaSide.appendChild(jaResult);
    jaSide.appendChild(jaStatus);
    jaSide.appendChild(jaActions);
    jaSide.appendChild(jaMic);

    // ── 中央分隔帶 ──────────────────────────────────────────────────────────
    var divider = document.createElement('div');
    divider.className = 'talk-divider';
    divider.textContent = '⇄';

    // ── 下半（中文 / Olina）— 正向 ─────────────────────────────────────────
    var zhSide = document.createElement('div');
    zhSide.className = 'talk-side talk-side-zh';

    var zhLang = document.createElement('div');
    zhLang.className = 'talk-side-lang';
    zhLang.textContent = '中文';

    var zhOrig = document.createElement('div');
    zhOrig.className = 'talk-side-orig';
    _talkEl.zhOrig = zhOrig;

    var zhResult = document.createElement('div');
    zhResult.className = 'talk-side-result';
    _talkEl.zhResult = zhResult;

    var zhStatus = document.createElement('div');
    zhStatus.className = 'talk-side-status';
    zhStatus.textContent = '按下麥克風開始說話';
    _talkEl.zhStatus = zhStatus;

    var zhActions = document.createElement('div');
    zhActions.className = 'talk-side-actions';

    var zhSpeakBtn = document.createElement('button');
    zhSpeakBtn.type = 'button';
    zhSpeakBtn.className = 'talk-side-speak';
    zhSpeakBtn.textContent = '🔊 重播';
    zhSpeakBtn.disabled = true;
    _talkEl.zhSpeakBtn = zhSpeakBtn;

    var zhBigtextBtn = document.createElement('button');
    zhBigtextBtn.type = 'button';
    zhBigtextBtn.className = 'talk-side-bigtext';
    zhBigtextBtn.textContent = '⤢ 大字';
    zhBigtextBtn.disabled = true;
    _talkEl.zhBigtextBtn = zhBigtextBtn;

    zhActions.appendChild(zhSpeakBtn);
    zhActions.appendChild(zhBigtextBtn);

    var zhMic = document.createElement('button');
    zhMic.type = 'button';
    zhMic.className = 'talk-side-mic';
    zhMic.textContent = '🎤 點我說中文';
    _talkEl.micZh = zhMic;  // key 沿用 micZh（G2 相容）

    zhSide.appendChild(zhLang);
    zhSide.appendChild(zhOrig);
    zhSide.appendChild(zhResult);
    zhSide.appendChild(zhStatus);
    zhSide.appendChild(zhActions);
    zhSide.appendChild(zhMic);

    talkContainer.appendChild(jaSide);
    talkContainer.appendChild(divider);
    talkContainer.appendChild(zhSide);

    // ── 動作鈕事件（Task12 §7：僅 idle 時作用）──────────────────────────────
    jaSpeakBtn.addEventListener('click', function () {
      if (_talkState !== 'idle' || !_side.ja.result) return;
      App.speak(_side.ja.result, 'ja-JP');
    });

    jaBigtextBtn.addEventListener('click', function () {
      if (_talkState !== 'idle' || !_side.ja.result) return;
      // ja 側大字：ja = 日文譯文，zh = 中文原文（Task12.api.md 契約）
      App.showBigText({ ja: _side.ja.result, zh: _side.ja.origZh });
    });

    zhSpeakBtn.addEventListener('click', function () {
      if (_talkState !== 'idle' || !_side.zh.result) return;
      App.speak(_side.zh.result, 'zh-TW');
    });

    zhBigtextBtn.addEventListener('click', function () {
      if (_talkState !== 'idle' || !_side.zh.result) return;
      // zh 側大字：ja 槽放中文（歷史命名），lang = zh-TW（Task12.api.md 契約）
      App.showBigText({ ja: _side.zh.result, lang: 'zh-TW' });
    });

    // ── 麥克風鈕事件 ─────────────────────────────────────────────────────────
    jaMic.addEventListener('click', function () { _onMicClick('ja'); });
    zhMic.addEventListener('click', function () { _onMicClick('zh'); });

    // ── NOT_SUPPORTED 初始狀態 ──────────────────────────────────────────────
    if (!App.recorder || !App.recorder.isAvailable) {
      jaMic.disabled = true;
      zhMic.disabled = true;
      zhStatus.textContent = TALK_ERROR_MSG.NOT_SUPPORTED;
      // jaStatus 維持 idle 日文文案（錯誤決策歸機主，spec §6.2）
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Task12 外殼：segmented + 模式切換
  // ════════════════════════════════════════════════════════════════════════════

  var _segInitialized = false;
  var _segEl          = {};   // segmented DOM 參照

  // 切換模式顯示（切模式時若 state ≠ idle 先 abortTalk，G1）
  function _switchMode(mode) {
    if (mode === _getMode() && _segInitialized) {
      // 同一模式重按：僅確保容器可見性正確
    }
    // G1：切模式即 abort
    if (_talkState !== 'idle') {
      _abortTalk();
    }
    _saveMode(mode);

    var showText = (mode === 'text');
    _segEl.textContainer.style.display = showText ? '' : 'none';
    _segEl.talkContainer.style.display = showText ? 'none' : '';

    _segEl.btnText.classList.toggle('translate-mode-btn-active', showText);
    _segEl.btnTalk.classList.toggle('translate-mode-btn-active', !showText);

    // 首次進入對話模式時建 DOM
    if (!showText && !_talkDOMBuilt) {
      _buildTalkDOM(_segEl.talkContainer);
    }
  }

  // ── 分頁註冊 ──────────────────────────────────────────────────────────────
  App.registerTab('translate', {
    onShow: function () {
      var section = document.getElementById('tab-translate');

      if (!_initialized) {
        _initialized = true;
        _dir = _getDir();

        // _buildDOM 清除佔位卡、append .translate-container
        _buildDOM(section);
        _updateDirLabel();
        _updateCharRow();
        _updateTranslateBtn();
      }

      // Task12 外殼（只建一次）
      if (!_segInitialized) {
        _segInitialized = true;

        // segmented control
        var seg = document.createElement('div');
        seg.className = 'translate-mode-seg';

        var btnText = document.createElement('button');
        btnText.type      = 'button';
        btnText.className = 'translate-mode-btn';
        btnText.textContent = '文字';

        var btnTalk = document.createElement('button');
        btnTalk.type      = 'button';
        btnTalk.className = 'translate-mode-btn';
        btnTalk.textContent = '對話';

        seg.appendChild(btnText);
        seg.appendChild(btnTalk);

        _segEl.btnText = btnText;
        _segEl.btnTalk = btnTalk;

        // talk container（與 .translate-container 平行直接子元素，§6.2）
        var talkContainer = document.createElement('div');
        talkContainer.className = 'talk-container';

        _segEl.talkContainer = talkContainer;

        // .translate-container 已由 _buildDOM append 到 section
        // 取出它的參照（section 的第一個子元素）
        var textContainer = section.querySelector('.translate-container');
        _segEl.textContainer = textContainer;

        // 把 seg 插到 section 最前面（.translate-container 之前）
        section.insertBefore(seg, textContainer);
        // 把 talk-container 追加到 section（.translate-container 之後）
        section.appendChild(talkContainer);

        btnText.addEventListener('click', function () { _switchMode('text'); });
        btnTalk.addEventListener('click', function () { _switchMode('talk'); });

        // 依記憶模式初始化
        _switchMode(_getMode());
      }
    },
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Task12 wrap App.showTab（三層鏈：coupon-viewer → translate-tab → bigtext → 原函式）
  // §5.5 四條約束：
  //   1. abort 條件：目標 id !== 'translate'（同分頁重按不中斷錄音）
  //   2. TTS cancel 必加「translate 為當前分頁」條件（不誤殺常用句播音）
  //   3. 統一走 _abortTalk()
  //   4. call-through（O1 紀律）
  // ════════════════════════════════════════════════════════════════════════════
  if (App && typeof App.showTab === 'function') {
    var _origShowTabFromTranslate = App.showTab;
    App.showTab = function (id) {
      // 條件：translate 為當前分頁 && 目標 id !== 'translate'
      if (id !== 'translate') {
        var section = document.getElementById('tab-translate');
        var translateVisible = section && !section.hidden;
        if (translateVisible) {
          _abortTalk();  // 包含 abort + cancel + 清 timer + 回 idle
        }
      }
      return _origShowTabFromTranslate(id);
    };
  }

}());
