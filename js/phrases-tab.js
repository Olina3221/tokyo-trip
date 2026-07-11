/**
 * phrases-tab.js — 常用句分頁
 *
 * 讀 window.PHRASES（六分類，每句 { zh, ja, romaji }），
 * 渲染 DOM 並掛 App.registerTab('phrases', { onShow })。
 *
 * 互動行為：
 *   點句子本體（.phrases-item-body） → App.showBigText({ ja, zh, romaji })
 *   點播放鈕（.phrases-speak-btn）    → App.speak(ja)
 *
 * 規則：
 *   - 渲染冪等：onShow 重複觸發不疊 DOM（_rendered flag，只渲染一次）
 *   - window.PHRASES 缺/空 → 顯示「句庫載入失敗」文案，不 throw，不影響其他分頁
 *   - App.speak.isAvailable 為 false → 播放鈕 disabled + title 提示
 *
 * DOM 結構（class 名供 frontend 套樣式）：
 *
 *   section#tab-phrases（既有 section，不動）
 *     div.phrases-container
 *       div.phrases-group                     ← 每個分類一個
 *         h2.phrases-cat                      ← 分類名稱
 *         ul.phrases-list
 *           li.phrases-item                   ← 每句
 *             button.phrases-item-body        ← 點擊開大字 overlay
 *               span.phrases-zh               ← 中文（主標，醒目）
 *               span.phrases-ja               ← 日文
 *               span.phrases-romaji           ← 羅馬拼音
 *             button.phrases-speak-btn        ← 點擊播日文語音
 *
 *   錯誤狀態（PHRASES 缺/空）：
 *     section#tab-phrases
 *       p.phrases-error                       ← 顯示「句庫載入失敗」
 */

(function () {
  'use strict';

  var _rendered = false;

  function _renderPhrases() {
    var section = document.getElementById('tab-phrases');
    if (!section) return;

    // 清空佔位卡（第一次渲染才會跑到這，因 _rendered flag 保證冪等）
    section.innerHTML = '';

    // PHRASES 缺/空 → 顯示失敗文案（spec 邊界條件）
    if (!window.PHRASES || !window.PHRASES.length) {
      var errEl = document.createElement('p');
      errEl.className = 'phrases-error';
      errEl.textContent = '句庫載入失敗';
      section.appendChild(errEl);
      return;
    }

    var ttsAvailable = App.speak && App.speak.isAvailable;

    var container = document.createElement('div');
    container.className = 'phrases-container';

    window.PHRASES.forEach(function (group) {
      if (!group || !group.items || !group.items.length) return;

      var groupEl = document.createElement('div');
      groupEl.className = 'phrases-group';

      var catEl = document.createElement('h2');
      catEl.className = 'phrases-cat';
      catEl.textContent = group.cat || '';
      groupEl.appendChild(catEl);

      var listEl = document.createElement('ul');
      listEl.className = 'phrases-list';

      group.items.forEach(function (item) {
        if (!item || !item.ja) return; // ja 缺則略過

        var li = document.createElement('li');
        li.className = 'phrases-item';

        // ── 句子本體按鈕（點擊開大字 overlay）────────────────
        var bodyBtn = document.createElement('button');
        bodyBtn.type = 'button';
        bodyBtn.className = 'phrases-item-body';
        bodyBtn.setAttribute('aria-label', (item.zh || item.ja));

        var zhSpan = document.createElement('span');
        zhSpan.className = 'phrases-zh';
        zhSpan.textContent = item.zh || '';

        var jaSpan = document.createElement('span');
        jaSpan.className = 'phrases-ja';
        jaSpan.textContent = item.ja;

        var romajiSpan = document.createElement('span');
        romajiSpan.className = 'phrases-romaji';
        romajiSpan.textContent = item.romaji || '';

        bodyBtn.appendChild(zhSpan);
        bodyBtn.appendChild(jaSpan);
        bodyBtn.appendChild(romajiSpan);

        // 閉包捕捉 item，避免迴圈變數共享問題
        (function (capturedItem) {
          bodyBtn.addEventListener('click', function () {
            App.showBigText({
              ja: capturedItem.ja,
              zh: capturedItem.zh,
              romaji: capturedItem.romaji,
            });
          });
        })(item);

        li.appendChild(bodyBtn);

        // ── 播放鈕（點擊播日文語音）──────────────────────────
        var speakBtn = document.createElement('button');
        speakBtn.type = 'button';
        speakBtn.className = 'phrases-speak-btn';
        speakBtn.setAttribute('aria-label', '播放日文語音');
        speakBtn.textContent = '🔊';

        if (!ttsAvailable) {
          speakBtn.disabled = true;
          speakBtn.setAttribute('title', '此裝置不支援語音');
        } else {
          (function (capturedJa) {
            speakBtn.addEventListener('click', function () {
              App.speak(capturedJa);
            });
          })(item.ja);
        }

        li.appendChild(speakBtn);
        listEl.appendChild(li);
      });

      groupEl.appendChild(listEl);
      container.appendChild(groupEl);
    });

    section.appendChild(container);
  }

  // ─── 掛載分頁（A1：必須用 App.registerTab）──────────────────
  App.registerTab('phrases', {
    onShow: function () {
      if (_rendered) return; // 冪等：只渲染一次，重複切分頁不疊 DOM
      _rendered = true;
      _renderPhrases();
    },
  });

})();
