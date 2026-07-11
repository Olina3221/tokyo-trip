/**
 * bigtext.js — 全螢幕大字展示共用元件
 *
 * 公開 API（補掛在 App 物件）：
 *   App.showBigText({ ja, zh, romaji })
 *     ja 必填（空字串或 falsy → no-op）；zh / romaji 可缺，缺欄不渲染小字區（B3）
 *
 * 副作用（B2）：
 *   App.showTab(id) 被外掛 wrap，切分頁時自動關閉 overlay。
 *   wrap 保持原簽名與回傳行為；overlay 未開時為 no-op；
 *   初始 DOMContentLoaded 的 App.showTab(initialTab) 也走 wrap（overlay 未開 → no-op）。
 *
 * 設計要點：
 *   B1  overlay 直接掛 document.body（不掛 section，避免被 hidden/overflow 裁切）
 *   B2  外掛 wrap App.showTab 實現切分頁自動關閉
 *   B3  僅 ja 必填；缺 zh/romaji 時 .bigtext-sub 整段不渲染（Task6 OCR 情境）
 *   B5  不做 history pushState 整合；關閉僅靠關閉鈕 + 切分頁
 *   B6  關閉 overlay 一律 cancel 語音（App.speak.cancel）
 *
 * DOM 結構（class 名供 frontend 套樣式，結構不得自行修改）：
 *
 *   div#bigtext-overlay.bigtext-overlay      ← z-index ≥100，直掛 body（B1）
 *     div.bigtext-content
 *       p.bigtext-ja                         ← 超大日文（給店員看的主角）
 *       div.bigtext-sub                      ← 僅 zh 或 romaji 有值才存在於 DOM 流
 *         p.bigtext-zh                       ← 中文小字（有值才顯示）
 *         p.bigtext-romaji                   ← 羅馬拼音小字（有值才顯示）
 *     div.bigtext-controls
 *       button.bigtext-speak-btn             ← 播音；無 speechSynthesis 時 disabled
 *       button.bigtext-close-btn             ← 關閉；frontend 須保證觸控目標 ≥44px
 *
 * JS 控制顯隱：
 *   - overlay 隱藏：inline style display:none（蓋過 CSS）
 *   - overlay 顯示：移除 inline style（CSS 的 display 生效，frontend 設定 flex/block）
 *   - .bigtext-sub 隱藏：inline style display:none（ja-only 情境）
 *   - .bigtext-sub 顯示：移除 inline style
 *
 * 捲動鎖：
 *   overlay 上加 touchmove preventDefault（passive:false）防 iOS 橡皮筋穿透。
 *
 * Task5/6 重用契約：見 specs/Task2.api.md
 */

(function () {
  'use strict';

  var _overlayEl = null;
  var _jaEl = null;
  var _subEl = null;
  var _zhEl = null;
  var _romajiEl = null;
  var _isOpen = false;

  // ─── 關閉 overlay（B6：同時 cancel 語音）────────────────────
  function _closeOverlay() {
    if (!_isOpen) return; // overlay 未開時 no-op（B2 規定）
    _isOpen = false;
    if (_overlayEl) _overlayEl.style.display = 'none';
    // B6：關 overlay 一律 cancel 語音
    if (App.speak && typeof App.speak.cancel === 'function') {
      App.speak.cancel();
    }
  }

  // ─── Lazy 建立 overlay DOM（首次 showBigText 時建，B1）───────
  function _createOverlay() {
    var el = document.createElement('div');
    el.id = 'bigtext-overlay';
    el.className = 'bigtext-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', '大字展示');
    el.style.display = 'none'; // 初始隱藏

    // ── 內容區 ──────────────────────────────────────────────
    var content = document.createElement('div');
    content.className = 'bigtext-content';

    var jaEl = document.createElement('p');
    jaEl.className = 'bigtext-ja';
    content.appendChild(jaEl);

    // .bigtext-sub：僅在有 zh 或 romaji 時顯示（B3）
    var subEl = document.createElement('div');
    subEl.className = 'bigtext-sub';
    subEl.style.display = 'none'; // 預設隱藏，showBigText 依欄位決定

    var zhEl = document.createElement('p');
    zhEl.className = 'bigtext-zh';
    subEl.appendChild(zhEl);

    var romajiEl = document.createElement('p');
    romajiEl.className = 'bigtext-romaji';
    subEl.appendChild(romajiEl);

    content.appendChild(subEl);
    el.appendChild(content);

    // ── 控制區 ──────────────────────────────────────────────
    var controls = document.createElement('div');
    controls.className = 'bigtext-controls';

    // 播放鈕
    var speakBtn = document.createElement('button');
    speakBtn.type = 'button';
    speakBtn.className = 'bigtext-speak-btn';
    speakBtn.setAttribute('aria-label', '播放日文語音');
    speakBtn.textContent = '🔊';

    var ttsAvailable = App.speak && App.speak.isAvailable;
    if (!ttsAvailable) {
      speakBtn.disabled = true;
      speakBtn.setAttribute('title', '此裝置不支援語音');
    }
    speakBtn.addEventListener('click', function () {
      if (App.speak && App.speak.isAvailable && jaEl && jaEl.textContent) {
        App.speak(jaEl.textContent);
      }
    });
    controls.appendChild(speakBtn);

    // 關閉鈕（frontend 須保證 min-width/min-height ≥44px，B2/spec 規則 7）
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'bigtext-close-btn';
    closeBtn.setAttribute('aria-label', '關閉');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', _closeOverlay);
    controls.appendChild(closeBtn);

    el.appendChild(controls);

    // 防 touchmove 穿透（spec 規則 7：overlay 開啟時鎖定背景捲動）
    el.addEventListener('touchmove', function (e) {
      e.preventDefault();
    }, { passive: false });

    // B1：直接掛 body，不掛任何 section（避免 hidden/overflow 裁切）
    document.body.appendChild(el);

    _overlayEl = el;
    _jaEl = jaEl;
    _subEl = subEl;
    _zhEl = zhEl;
    _romajiEl = romajiEl;
  }

  // ─── 公開 API：showBigText ───────────────────────────────────
  /**
   * 開啟全螢幕大字展示 overlay。
   *
   * @param {{ ja: string, zh?: string, romaji?: string }} params
   *   ja   必填；空字串或 falsy → no-op（Task6 OCR 失敗傳空值的安全處理，B3）
   *   zh   選填；缺或空 → 小字區不顯示 zh 行（B3）
   *   romaji 選填；缺或空 → 小字區不顯示 romaji 行（B3）
   *   zh 與 romaji 皆缺 → .bigtext-sub 整段不渲染（B3）
   *
   * 若 overlay 已開啟，直接更新內容（不關閉再開，避免閃爍）。
   * Task5/6 從各自分頁呼叫，因 overlay 掛 body，跨分頁正常顯示（B1）。
   */
  function showBigText(params) {
    var ja = params && params.ja;
    var zh = params && params.zh;
    var romaji = params && params.romaji;

    // ja 必填；空字串或 falsy → no-op（B3）
    if (!ja) return;

    // Lazy 建立（首次呼叫時）
    if (!_overlayEl) _createOverlay();

    // 填入日文主文
    _jaEl.textContent = ja;

    // B3：zh 或 romaji 有值才顯示小字區；否則整段不渲染（ja-only 版面置中）
    if (zh || romaji) {
      _zhEl.textContent = zh || '';
      _romajiEl.textContent = romaji || '';
      _subEl.style.display = '';
    } else {
      _zhEl.textContent = '';
      _romajiEl.textContent = '';
      _subEl.style.display = 'none';
    }

    // 顯示 overlay
    _overlayEl.style.display = '';
    _isOpen = true;
  }

  // ─── B2：外掛 wrap App.showTab ───────────────────────────────
  // 切分頁時自動關閉 overlay。
  // 保持原簽名與回傳行為；overlay 未開時 _closeOverlay 為 no-op。
  // 初始 DOMContentLoaded 的 App.showTab(initialTab) 亦走此 wrap：
  //   overlay 未開 → _closeOverlay no-op → 原函式執行 → 行為完全不變。
  // Task5/6 呼叫 App.showTab(...) 會連帶關閉 overlay（預期行為，見 Task2.api.md）。
  if (App && typeof App.showTab === 'function') {
    var _origShowTab = App.showTab;
    App.showTab = function (id) {
      _closeOverlay(); // overlay 未開時 no-op
      return _origShowTab(id);
    };
  }

  // 補掛 App
  window.App = window.App || {};
  App.showBigText = showBigText;

})();
