/**
 * phrases-tab.js — 常用句分頁（Task8 B2：分類 chips 導覽）
 *
 * 讀 window.PHRASES（六分類，每句 { zh, ja, romaji }，每分類有 id 欄位），
 * 渲染頂部 chips 導覽列 + 單分類句子列表，並掛 App.registerTab('phrases', { onShow })。
 *
 * 互動行為（與 Task2 簽名完全相同，不得更動）：
 *   點句子本體（.phrases-item-body） → App.showBigText({ ja, zh, romaji })
 *   點播放鈕（.phrases-speak-btn）    → App.speak(ja)
 *
 * 分類導覽：
 *   - 頂部 chips bar（.phrases-chips-bar）sticky 置頂、橫向可捲
 *   - 每個 chip（.phrases-chip）對應一個分類；active 狀態加 .phrases-chip-active
 *   - 一次只顯示一類句子，切換即重繪 .phrases-list-area
 *   - 預設分類 = transport；localStorage key = "tokyotrip.phrasesCat"
 *   - 已儲存的 id 不存在時 fallback 到 PHRASES[0]
 *   - localStorage 不可用（私密瀏覽）→ 靜默降級，預設 transport，功能照常
 *   - 空分類 chip 不渲染（與 Task2 既有行為對齊）
 *
 * 冪等策略：
 *   - _initialized flag：shell（chips bar + list area 容器）只建一次
 *   - onShow 重複觸發不疊 DOM
 *   - 切換分類只重繪 .phrases-list-area 內容，不重建 shell
 *
 * DOM 結構（class 名供 frontend 套樣式）：
 *
 *   section#tab-phrases（既有 section，不動）
 *     div.phrases-chips-bar                ← sticky 置頂，overflow-x scroll，觸控目標 ≥44px
 *       button.phrases-chip                ← 每個有句子的分類一個 chip
 *       button.phrases-chip.phrases-chip-active  ← 當前選中分類
 *     div.phrases-list-area                ← 分類切換時整塊重繪
 *       ul.phrases-list
 *         li.phrases-item
 *           button.phrases-item-body       ← 點擊開大字 overlay
 *             span.phrases-zh
 *             span.phrases-ja
 *             span.phrases-romaji
 *           button.phrases-speak-btn       ← 點擊播日文語音
 *
 *   錯誤狀態（PHRASES 缺/空）：
 *     section#tab-phrases
 *       p.phrases-error
 *
 * 注：分類頭（.phrases-cat h2）在單類顯示模式下已移除，chips bar 即為分類指示。
 *     若日後需求改成顯示當前分類名稱，在 .phrases-list-area 頂部加 h2.phrases-cat 即可。
 */

(function () {
  'use strict';

  var _initialized = false;
  var _currentCatId = null;
  var _chipsBar = null;
  var _listArea = null;

  // ─── 依 id 找分類物件 ─────────────────────────────────────
  function _findCatById(id) {
    if (!window.PHRASES) return null;
    for (var i = 0; i < window.PHRASES.length; i++) {
      if (window.PHRASES[i] && window.PHRASES[i].id === id) {
        return window.PHRASES[i];
      }
    }
    return null;
  }

  // ─── 決定初始分類 ─────────────────────────────────────────
  // 讀 localStorage；有效 id → 用；無效 id → PHRASES[0]；
  // 無儲存值 → transport；transport 不存在 → PHRASES[0]
  function _getInitialCat() {
    if (!window.PHRASES || !window.PHRASES.length) return null;

    var savedId = null;
    try {
      savedId = localStorage.getItem('tokyotrip.phrasesCat');
    } catch (e) {
      // 私密瀏覽或 localStorage 不可用，靜默降級
    }

    if (savedId) {
      var found = _findCatById(savedId);
      if (found) return found;
      // 已儲存的 id 已不存在（未來分類增刪）→ fallback 第一類
      return window.PHRASES[0];
    }

    // 初次造訪，無儲存值 → 預設 transport
    var transport = _findCatById('transport');
    if (transport) return transport;
    return window.PHRASES[0];
  }

  // ─── 儲存分類記憶 ──────────────────────────────────────────
  function _saveCat(id) {
    try {
      localStorage.setItem('tokyotrip.phrasesCat', id);
    } catch (e) {
      // 私密瀏覽，靜默降級
    }
  }

  // ─── 更新 chips active 狀態 ────────────────────────────────
  function _updateChipsActive(activeId) {
    if (!_chipsBar) return;
    var chips = _chipsBar.querySelectorAll('.phrases-chip');
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      if (chip.getAttribute('data-cat-id') === activeId) {
        chip.classList.add('phrases-chip-active');
      } else {
        chip.classList.remove('phrases-chip-active');
      }
    }
  }

  // ─── 建立自訂句列表項（Task18）────────────────────────────
  function _buildMyPhraseItem(item, ttsAvailable) {
    var li = document.createElement('li');
    li.className = 'phrases-item phrases-item-mine';

    // ── 句子本體（點擊開大字 overlay）────────────────────────
    var bodyBtn = document.createElement('button');
    bodyBtn.type      = 'button';
    bodyBtn.className = 'phrases-item-body';
    bodyBtn.setAttribute('aria-label', (item.zh || item.ja));

    var mineLabel = document.createElement('span');
    mineLabel.className   = 'phrases-mine-label';
    mineLabel.textContent = '自訂';

    var zhSpan = document.createElement('span');
    zhSpan.className   = 'phrases-zh';
    zhSpan.textContent = item.zh || '';

    var jaSpan = document.createElement('span');
    jaSpan.className   = 'phrases-ja';
    jaSpan.textContent = item.ja;

    var romajiSpan = document.createElement('span');
    romajiSpan.className   = 'phrases-romaji';
    romajiSpan.textContent = item.romaji || '';

    bodyBtn.appendChild(mineLabel);
    bodyBtn.appendChild(zhSpan);
    bodyBtn.appendChild(jaSpan);
    bodyBtn.appendChild(romajiSpan);

    // 閉包捕捉 item（防注入：一律 textContent，內容來自使用者輸入+API）
    (function (capturedItem) {
      bodyBtn.addEventListener('click', function () {
        App.showBigText({ ja: capturedItem.ja, zh: capturedItem.zh });
      });
    })(item);

    li.appendChild(bodyBtn);

    // ── 播放鈕（比照內建守 ttsAvailable，spec Task18 §4 補定案）────
    var speakBtn = document.createElement('button');
    speakBtn.type      = 'button';
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

    // ── 刪除鈕（只自訂句有，confirm 確認防誤觸）─────────────
    var deleteBtn = document.createElement('button');
    deleteBtn.type      = 'button';
    deleteBtn.className = 'phrases-delete-btn';
    deleteBtn.setAttribute('aria-label', '刪除這句自訂常用語');
    deleteBtn.textContent = '🗑';

    (function (capturedItem) {
      deleteBtn.addEventListener('click', function () {
        if (!confirm('刪除這句常用語？')) return;
        App.myPhrases.remove(capturedItem.zh, capturedItem.ja);
        _renderListArea(_findCatById(_currentCatId));   // 重繪當前分類
      });
    })(item);

    li.appendChild(deleteBtn);

    return li;
  }

  // ─── 重繪句子列表（分類切換時觸發）────────────────────────
  // 每次重繪整塊丟棄後重建，listener 隨 DOM 消滅，無殘留問題。
  function _renderListArea(group) {
    if (!_listArea) return;
    _listArea.innerHTML = '';

    if (!group || !group.items || !group.items.length) {
      // 空分類：不渲染任何內容（此路徑理論上不觸發，因空分類 chip 不建立）
      return;
    }

    var ttsAvailable = App.speak && App.speak.isAvailable;

    var listEl = document.createElement('ul');
    listEl.className = 'phrases-list';

    // ── Task18: 自訂句（排最前，新→舊；缺載或 [] 時跳過）────
    var myItems = (App.myPhrases && typeof App.myPhrases.getByCat === 'function')
      ? App.myPhrases.getByCat(group.id)
      : [];
    myItems.forEach(function (item) {
      if (!item || !item.ja) return;
      listEl.appendChild(_buildMyPhraseItem(item, ttsAvailable));
    });

    // ── 內建句（原順序，零 diff）──────────────────────────────
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

    _listArea.appendChild(listEl);
  }

  // ─── 切換至指定分類 ────────────────────────────────────────
  function _selectCat(group) {
    if (!group) return;
    _currentCatId = group.id;
    _saveCat(group.id);
    _updateChipsActive(group.id);
    _renderListArea(group);
  }

  // ─── 建立 shell（chips bar + list area 容器），只做一次 ──
  function _buildShell(section) {
    section.innerHTML = '';

    // chips bar
    _chipsBar = document.createElement('div');
    _chipsBar.className = 'phrases-chips-bar';

    window.PHRASES.forEach(function (group) {
      if (!group || !group.id) return;
      // 空分類不渲染 chip（與 Task2 既有行為對齊）
      if (!group.items || !group.items.length) return;

      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'phrases-chip';
      chip.setAttribute('data-cat-id', group.id);
      chip.textContent = group.cat || group.id;

      (function (capturedGroup) {
        chip.addEventListener('click', function () {
          _selectCat(capturedGroup);
        });
      })(group);

      _chipsBar.appendChild(chip);
    });

    section.appendChild(_chipsBar);

    // list area 容器（切換分類時只改這個區域）
    _listArea = document.createElement('div');
    _listArea.className = 'phrases-list-area';
    section.appendChild(_listArea);
  }

  // ─── 主渲染（首次呼叫）────────────────────────────────────
  function _render() {
    var section = document.getElementById('tab-phrases');
    if (!section) return;

    // PHRASES 缺/空 → 顯示失敗文案（spec 邊界條件）
    if (!window.PHRASES || !window.PHRASES.length) {
      section.innerHTML = '';
      var errEl = document.createElement('p');
      errEl.className = 'phrases-error';
      errEl.textContent = '句庫載入失敗';
      section.appendChild(errEl);
      return;
    }

    _buildShell(section);
    _initialized = true;

    var initialCat = _getInitialCat();
    _selectCat(initialCat);
  }

  // ─── 掛載分頁（A1：必須用 App.registerTab）──────────────────
  App.registerTab('phrases', {
    onShow: function () {
      if (_initialized) {
        // Task18 冪等擴充：直達重繪當前分類（自訂句可能剛從翻譯側新增）
        // 禁走 _selectCat（避免多寫 phrasesCat）；_renderListArea 整塊重建天然冪等
        _renderListArea(_findCatById(_currentCatId));
        return;
      }
      _render();
    },
  });

})();
