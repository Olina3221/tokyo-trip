/**
 * js/coupons-tab.js -- 折價券分頁（coupons tab）渲染與互動邏輯
 *
 * 依賴（載入順序，app.js 之後）：
 *   coupon-viewer.js -> coupons-tab.js
 *   App.registerTab / App.openCouponViewer 須已定義
 *   window.COUPONS 由 tripdata.js 提供
 *
 * DOM 建構策略：
 *   首次 onShow 時建立整個 #tab-coupons 內部 DOM 並綁定事件。
 *   之後 onShow 不重建 DOM（冪等，比照 trip-tab.js _initialized 模式）。
 *
 * 分類渲染順序：藥妝 -> 電器 -> 量販 -> 百貨 -> 運動 -> 免稅店
 *
 * DOM 結構（class 名供 frontend 套樣式）：
 *
 *   div.coupons-container
 *     div.coupons-group                     <- 每個分類一個 group
 *       h2.coupons-group-title              <- 分類標題（藥妝 / 電器…）
 *       div.coupon-card                     <- 每張券一個 card
 *         div.coupon-card-thumb-wrap
 *           img.coupon-card-thumb           <- 縮圖 loading="lazy"
 *         div.coupon-card-info
 *           div.coupon-card-store           <- 店名（主標）
 *           div.coupon-card-discount        <- 折扣摘要
 *           div.coupon-card-expiry          <- 效期
 *           div.coupon-card-area            <- 地區警示（area 非空時顯示）
 *           span.coupon-card-badge-passport <- 「需護照」徽章（passport=true）
 *           div.coupon-card-notes           <- 注意事項小字
 *   p.coupons-error                         <- 資料載入失敗文案（COUPONS 缺/空）
 */

(function () {
  'use strict';

  var _initialized = false;

  // 分類渲染順序（spec 定案）
  var CATEGORY_ORDER = ['藥妝', '電器', '量販', '百貨', '運動', '免稅店'];

  // ── HTML 跳脫 ───────────────────────────────────────────────

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── 渲染：單張券卡 ──────────────────────────────────────────

  function buildCouponCard(coupon) {
    var card = document.createElement('div');
    card.className = 'coupon-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', '查看 ' + (coupon.store || '') + ' 折價券圖片');

    // 縮圖區
    var thumbWrap = document.createElement('div');
    thumbWrap.className = 'coupon-card-thumb-wrap';

    var thumbImg = document.createElement('img');
    thumbImg.className = 'coupon-card-thumb';
    thumbImg.alt = coupon.store || '';
    thumbImg.loading = 'lazy'; // 避免一次解碼 18 張大圖（spec 規定）

    if (coupon.img) {
      thumbImg.src = coupon.img;
      // 壞圖時縮圖顯示 alt 文字（不阻斷其他券）
      thumbImg.addEventListener('error', function () {
        thumbImg.style.display = 'none';
        var errMsg = document.createElement('div');
        errMsg.className = 'coupon-card-thumb-error';
        errMsg.textContent = '圖片載入失敗';
        thumbWrap.appendChild(errMsg);
      });
    } else {
      thumbImg.style.display = 'none';
    }

    thumbWrap.appendChild(thumbImg);
    card.appendChild(thumbWrap);

    // 文字資訊區
    var info = document.createElement('div');
    info.className = 'coupon-card-info';

    // 店名
    var storeEl = document.createElement('div');
    storeEl.className = 'coupon-card-store';
    storeEl.textContent = coupon.store || '';
    info.appendChild(storeEl);

    // 折扣摘要
    if (coupon.discount) {
      var discountEl = document.createElement('div');
      discountEl.className = 'coupon-card-discount';
      discountEl.textContent = coupon.discount;
      info.appendChild(discountEl);
    }

    // 效期（null -> 「效期：依券面」）
    var expiryEl = document.createElement('div');
    expiryEl.className = 'coupon-card-expiry';
    expiryEl.textContent = '效期：' + (coupon.expiry || '依券面');
    info.appendChild(expiryEl);

    // 徽章列
    var badgeRow = document.createElement('div');
    badgeRow.className = 'coupon-card-badges';

    if (coupon.passport) {
      var passportBadge = document.createElement('span');
      passportBadge.className = 'coupon-card-badge-passport';
      passportBadge.textContent = '需護照';
      badgeRow.appendChild(passportBadge);
    }

    // 地區警示（area 非空）
    if (coupon.area) {
      var areaBadge = document.createElement('span');
      areaBadge.className = 'coupon-card-badge-area';
      areaBadge.textContent = '⚠ ' + coupon.area; // ⚠
      badgeRow.appendChild(areaBadge);
    }

    if (badgeRow.children.length > 0) {
      info.appendChild(badgeRow);
    }

    // notes 小字
    if (coupon.notes) {
      var notesEl = document.createElement('div');
      notesEl.className = 'coupon-card-notes';
      notesEl.textContent = coupon.notes;
      info.appendChild(notesEl);
    }

    card.appendChild(info);

    // 點擊/鍵盤 -> 開圖片檢視器
    function openViewer() {
      if (!coupon.img) {
        // 無圖：開啟並顯示失敗訊息（spec 邊界處理）
        if (App.openCouponViewer) {
          App.openCouponViewer({ src: '', storeName: coupon.store || '' });
        }
        return;
      }
      if (App.openCouponViewer) {
        App.openCouponViewer({ src: coupon.img, storeName: coupon.store || '' });
      }
    }

    card.addEventListener('click', openViewer);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openViewer();
      }
    });

    return card;
  }

  // ── 渲染：整個分頁 ──────────────────────────────────────────

  function init() {
    var tabEl = document.getElementById('tab-coupons');
    if (!tabEl) return;

    // 清掉佔位卡
    tabEl.innerHTML = '';

    // 資料驗證
    var coupons = window.COUPONS;
    if (!coupons || !Array.isArray(coupons) || coupons.length === 0) {
      var errEl = document.createElement('p');
      errEl.className = 'coupons-error';
      errEl.textContent = '折價券資料載入失敗';
      tabEl.appendChild(errEl);
      return;
    }

    var container = document.createElement('div');
    container.className = 'coupons-container';

    // 依分類分組
    var groups = {};
    coupons.forEach(function (coupon) {
      // 欄位守門：缺 img 或缺 store 的筆資料跳過並警告
      if (!coupon.store) {
        console.warn('[coupons-tab] 缺 store 欄位，略過:', coupon);
        return;
      }
      if (!coupon.img) {
        console.warn('[coupons-tab] 缺 img 欄位，略過:', coupon);
        return;
      }
      var cat = coupon.category || '其他';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(coupon);
    });

    // 依 CATEGORY_ORDER 渲染，未知分類附在最後
    var renderedCats = [];
    CATEGORY_ORDER.forEach(function (cat) {
      if (groups[cat]) {
        renderGroup(container, cat, groups[cat]);
        renderedCats.push(cat);
      }
    });
    // 未在 CATEGORY_ORDER 內的分類
    Object.keys(groups).forEach(function (cat) {
      if (renderedCats.indexOf(cat) === -1) {
        renderGroup(container, cat, groups[cat]);
      }
    });

    tabEl.appendChild(container);
    _initialized = true;
  }

  function renderGroup(container, category, coupons) {
    var groupEl = document.createElement('div');
    groupEl.className = 'coupons-group';
    groupEl.dataset.category = category;

    var titleEl = document.createElement('h2');
    titleEl.className = 'coupons-group-title';
    titleEl.textContent = category;
    groupEl.appendChild(titleEl);

    coupons.forEach(function (coupon) {
      groupEl.appendChild(buildCouponCard(coupon));
    });

    container.appendChild(groupEl);
  }

  // ── onShow（每次切到 coupons 分頁都觸發）────────────────────

  function onShow() {
    if (!_initialized) {
      init();
    }
    // 之後不重建 DOM，保留使用者捲動位置
  }

  // ── 掛載 ─────────────────────────────────────────────────────

  App.registerTab('coupons', { onShow: onShow });

})();
