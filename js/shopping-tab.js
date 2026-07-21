/**
 * js/shopping-tab.js — 購物分頁（Task23）
 *
 * 依賴：
 *   window.SHOPPING（shoppingdata.js，資料層）
 *   App.registerTab（app.js）
 *
 * 設計原則：
 *   - App.registerTab('shopping', { onShow }) — 不 wrap showTab（無錄音/TTS/overlay）
 *   - _initialized 模式（首次 onShow 建 DOM，後續只更新計數）
 *   - 勾選真相 = 記憶體 Set；localStorage key='tokyotrip.shoppingChecked' 為持久化後端
 *   - localStorage 全包 try/catch；無痕降級＝Set 照用、寫入失敗靜默
 *   - 資料注入一律 textContent（防 XSS；資料含 ¥/& 等字元）
 *   - 重置只准 removeItem 自己的 key（repo 禁止 clear 全域）
 *
 * DOM 結構（見 Task23.api.md §4）：
 *   #tab-shopping
 *     .shopping-header          (flex-shrink:0)
 *       .shopping-rate          匯率 + 圖例
 *       .shopping-summary       已買 n/20
 *     .shopping-list            (flex:1, overflow-y:auto)
 *       .shopping-group × 2
 *         .shopping-group-title
 *         .shopping-card × N
 *           .shopping-check     (≥44px 觸控目標)
 *           .shopping-content   (≥44px，點擊展開)
 *             .shopping-name
 *             .shopping-price
 *             .shopping-chevron
 *             .shopping-detail
 *       .shopping-clear-btn
 *     .shopping-empty           (SHOPPING 缺載時)
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'tokyotrip.shoppingChecked';

  var _initialized = false;
  var _checkedSet = new Set();   // 記憶體真相：已勾 item id 集合
  var _expandedSet = new Set();  // 記憶體：已展開 item id 集合（不持久化）

  // DOM 節點引用（init 後填入）
  var _summaryEl = null;         // .shopping-summary
  var _groupTitleEls = {};       // catId → .shopping-group-title element

  // ── localStorage 讀寫（全 try/catch）────────────────────────

  function _loadChecked() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      arr.forEach(function (id) {
        if (typeof id === 'string') _checkedSet.add(id);
      });
    } catch (e) {
      // parse 失敗視同空陣列
    }
  }

  function _saveChecked() {
    try {
      var arr = Array.from(_checkedSet);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      // 無痕降級：寫入失敗靜默，Set 仍有效
    }
  }

  function _clearChecked() {
    _checkedSet.clear();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  // ── 計數更新 ────────────────────────────────────────────────

  function _totalItems() {
    var total = 0;
    if (!window.SHOPPING || !window.SHOPPING.categories) return 0;
    window.SHOPPING.categories.forEach(function (cat) {
      total += (cat.items || []).length;
    });
    return total;
  }

  // 只計算現有品項中被勾選的數量；localStorage 殘留的孤兒 id（如 g07/g10）安全忽略
  function _validCheckedCount() {
    if (!window.SHOPPING || !window.SHOPPING.categories) return 0;
    var count = 0;
    window.SHOPPING.categories.forEach(function (cat) {
      (cat.items || []).forEach(function (item) {
        if (_checkedSet.has(item.id)) count++;
      });
    });
    return count;
  }

  function _catCheckedCount(catId) {
    var count = 0;
    var cat = (window.SHOPPING.categories || []).find(function (c) { return c.id === catId; });
    if (!cat) return 0;
    (cat.items || []).forEach(function (item) {
      if (_checkedSet.has(item.id)) count++;
    });
    return count;
  }

  function _updateCounts() {
    // 更新頁首總計（用 _validCheckedCount 而非 _checkedSet.size，排除孤兒 id 影響）
    if (_summaryEl) {
      var total = _totalItems();
      var checked = _validCheckedCount();
      _summaryEl.textContent = '已買 ' + checked + '/' + total;
    }
    // 更新各群組標題計數
    if (!window.SHOPPING || !window.SHOPPING.categories) return;
    window.SHOPPING.categories.forEach(function (cat) {
      var el = _groupTitleEls[cat.id];
      if (!el) return;
      var n = cat.items ? cat.items.length : 0;
      var c = _catCheckedCount(cat.id);
      el.textContent = '▍' + cat.name + '（已買 ' + c + '/' + n + '）';
    });
  }

  // ── 建構單張卡片 ─────────────────────────────────────────────

  function _buildCard(item) {
    var card = document.createElement('div');
    card.className = 'shopping-card' + (_checkedSet.has(item.id) ? ' is-checked' : '');
    card.setAttribute('data-id', item.id);

    // ── 左：勾選區 ──────────────────────────────────────────
    var checkArea = document.createElement('div');
    checkArea.className = 'shopping-check';
    checkArea.setAttribute('role', 'checkbox');
    checkArea.setAttribute('aria-checked', _checkedSet.has(item.id) ? 'true' : 'false');
    checkArea.setAttribute('aria-label', item.name + ' 已買');
    checkArea.setAttribute('tabindex', '0');

    var checkBox = document.createElement('div');
    checkBox.className = 'shopping-checkbox-visual' + (_checkedSet.has(item.id) ? ' checked' : '');
    checkArea.appendChild(checkBox);

    checkArea.addEventListener('click', function (e) {
      e.stopPropagation();
      _toggleCheck(item.id, card, checkArea, checkBox);
    });
    checkArea.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        _toggleCheck(item.id, card, checkArea, checkBox);
      }
    });

    // ── 右：內容區 ──────────────────────────────────────────
    var content = document.createElement('div');
    content.className = 'shopping-content';

    // 品名行（★ + 品名）
    var nameEl = document.createElement('div');
    nameEl.className = 'shopping-name';
    var nameText = (item.star ? '★ ' : '') + item.name;
    nameEl.textContent = nameText;
    if (item.star) nameEl.classList.add('has-star');

    // 價格行（¥日本售價 ≈ NT$換算）
    var priceEl = document.createElement('div');
    priceEl.className = 'shopping-price';
    var priceParts = [];
    if (item.jpPrice) priceParts.push(item.jpPrice);
    if (item.ntPrice) priceParts.push('≈ NT$' + item.ntPrice);
    priceEl.textContent = priceParts.join('  ');

    // 展開 chevron
    var chevron = document.createElement('span');
    chevron.className = 'shopping-chevron';
    chevron.textContent = _expandedSet.has(item.id) ? '▼' : '▶';

    // 展開詳情
    var detail = document.createElement('div');
    detail.className = 'shopping-detail';
    detail.hidden = !_expandedSet.has(item.id);
    _buildDetailRows(item, detail);

    content.appendChild(nameEl);
    content.appendChild(priceEl);
    content.appendChild(chevron);
    content.appendChild(detail);

    // 點擊內容區展開/收合
    content.addEventListener('click', function () {
      var expanded = _expandedSet.has(item.id);
      if (expanded) {
        _expandedSet.delete(item.id);
        detail.hidden = true;
        chevron.textContent = '▶';
      } else {
        _expandedSet.add(item.id);
        detail.hidden = false;
        chevron.textContent = '▼';
      }
    });

    card.appendChild(checkArea);
    card.appendChild(content);
    return card;
  }

  // ── 保存期限解析與分級 ──────────────────────────────────────
  // 輸入格式（實際資料）：「5天」「10天」「30天」「60天」
  //                       「約3個月」「3-6個月」「6個月」「1年」
  // 回傳天數（整數）或 null（無法解析 → 樸素呈現，不出錯）

  function _parseShelfDays(text) {
    if (!text) return null;
    var s = String(text).replace(/\s/g, '');
    var m;
    // X年
    m = s.match(/(\d+(?:\.\d+)?)年/);
    if (m) return Math.round(parseFloat(m[1]) * 365);
    // X-Y個月（取下限）
    m = s.match(/(\d+(?:\.\d+)?)-\d+個月/);
    if (m) return Math.round(parseFloat(m[1]) * 30);
    // 約?X個月
    m = s.match(/約?(\d+(?:\.\d+)?)個月/);
    if (m) return Math.round(parseFloat(m[1]) * 30);
    // 約?X天
    m = s.match(/約?(\d+(?:\.\d+)?)天/);
    if (m) return Math.round(parseFloat(m[1]));
    return null;  // 無法解析 → 樸素呈現
  }

  // 回傳 { cls, labelPrefix }
  // 分級：≤10天=critical（最強）、11–30天=warning（中等）、其餘=plain
  function _shelfTier(shelfText) {
    var days = _parseShelfDays(shelfText);
    if (days === null) return { cls: '', labelPrefix: '' };
    if (days <= 10) return { cls: 'shopping-detail-row--shelf-critical', labelPrefix: '⚠ ' };
    if (days <= 30) return { cls: 'shopping-detail-row--shelf-warning', labelPrefix: '' };
    return { cls: '', labelPrefix: '' };
  }

  // ── 建構展開詳情列 ───────────────────────────────────────────

  function _buildDetailRows(item, container) {
    var rows = [];

    if (item.desc) rows.push({ label: '說明', value: item.desc });
    if (item.twPrice) rows.push({ label: '台灣售價', value: item.twPrice });
    if (item.shelfLife) rows.push({ label: '保存期限', value: item.shelfLife, type: 'shelf' });
    if (item.where) rows.push({ label: '購買地點', value: item.where });
    if (item.notes) rows.push({ label: '備註', value: item.notes });

    rows.forEach(function (row) {
      var rowEl = document.createElement('div');
      var extraClass = '';
      var labelPrefix = '';

      if (row.type === 'shelf') {
        var tier = _shelfTier(row.value);
        extraClass = tier.cls ? (' ' + tier.cls) : '';
        labelPrefix = tier.labelPrefix;
      }

      rowEl.className = 'shopping-detail-row' + extraClass;

      var labelEl = document.createElement('span');
      labelEl.className = 'shopping-detail-label';
      labelEl.textContent = labelPrefix + row.label;

      var valueEl = document.createElement('span');
      valueEl.className = 'shopping-detail-value';
      valueEl.textContent = row.value;

      rowEl.appendChild(labelEl);
      rowEl.appendChild(valueEl);
      container.appendChild(rowEl);
    });
  }

  // ── 勾選切換 ────────────────────────────────────────────────

  function _toggleCheck(id, card, checkArea, checkBox) {
    if (_checkedSet.has(id)) {
      _checkedSet.delete(id);
      card.classList.remove('is-checked');
      checkArea.setAttribute('aria-checked', 'false');
      checkBox.classList.remove('checked');
    } else {
      _checkedSet.add(id);
      card.classList.add('is-checked');
      checkArea.setAttribute('aria-checked', 'true');
      checkBox.classList.add('checked');
    }
    _saveChecked();
    _updateCounts();
  }

  // ── 建構整個分頁 DOM ─────────────────────────────────────────

  function _init() {
    var section = document.getElementById('tab-shopping');
    if (!section) return;

    // SHOPPING 缺載失敗狀態
    if (!window.SHOPPING || !window.SHOPPING.categories) {
      var emptyEl = document.createElement('div');
      emptyEl.className = 'shopping-empty';
      emptyEl.textContent = '購物清單載入失敗，請重新整理頁面。';
      section.appendChild(emptyEl);
      return;
    }

    // ── 頁首列 ────────────────────────────────────────────────
    var header = document.createElement('div');
    header.className = 'shopping-header';

    var rateEl = document.createElement('div');
    rateEl.className = 'shopping-rate';
    var rateNote = window.SHOPPING.rateNote || '1¥ ≈ NT$0.18';
    rateEl.textContent = rateNote + '　★＝額外推薦';

    _summaryEl = document.createElement('div');
    _summaryEl.className = 'shopping-summary';

    header.appendChild(rateEl);
    header.appendChild(_summaryEl);

    // ── 捲動清單區 ────────────────────────────────────────────
    var list = document.createElement('div');
    list.className = 'shopping-list';

    window.SHOPPING.categories.forEach(function (cat) {
      if (!cat.items || cat.items.length === 0) return;

      var group = document.createElement('div');
      group.className = 'shopping-group';

      var groupTitle = document.createElement('div');
      groupTitle.className = 'shopping-group-title';
      _groupTitleEls[cat.id] = groupTitle;  // 存引用供 _updateCounts 用

      cat.items.forEach(function (item) {
        var card = _buildCard(item);
        group.appendChild(card);
      });

      // 群組標題插在卡片前
      group.insertBefore(groupTitle, group.firstChild);
      list.appendChild(group);
    });

    // 清除全部勾選按鈕（清單底部）
    var clearBtn = document.createElement('button');
    clearBtn.className = 'shopping-clear-btn';
    clearBtn.textContent = '清除全部勾選';
    clearBtn.addEventListener('click', function () {
      if (!confirm('確定清除全部已買勾選？')) return;
      _clearChecked();
      // 重繪所有卡片狀態
      var cards = section.querySelectorAll('.shopping-card');
      cards.forEach(function (card) {
        card.classList.remove('is-checked');
        var cb = card.querySelector('.shopping-checkbox-visual');
        if (cb) cb.classList.remove('checked');
        var ca = card.querySelector('.shopping-check');
        if (ca) ca.setAttribute('aria-checked', 'false');
      });
      _updateCounts();
    });

    list.appendChild(clearBtn);

    section.appendChild(header);
    section.appendChild(list);

    _updateCounts();
  }

  // ── 分頁註冊 ────────────────────────────────────────────────

  _loadChecked();

  App.registerTab('shopping', {
    onShow: function () {
      if (!_initialized) {
        _init();
        _initialized = true;
      } else {
        // 冪等：重複呼叫只更新計數
        _updateCounts();
      }
    }
  });

}());
