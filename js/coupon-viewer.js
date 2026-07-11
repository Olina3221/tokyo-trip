/**
 * js/coupon-viewer.js -- 全螢幕折價券圖片檢視器
 *
 * 公開 API（補掛在 App 物件）：
 *   App.openCouponViewer({ src, storeName })
 *     src       必填（圖片路徑）
 *     storeName 選填（顯示於檢視器頂部小標）
 *   App.closeCouponViewer()
 *
 * 設計要點（impact.md O1–O4 + spec 假設修正）：
 *   O1  additive wrap App.showTab：切分頁時自動關閉，wrap call-through 原函式
 *   O2  同分頁最多一個 overlay 同時開（coupons 分頁不呼叫 showBigText，天然互斥）
 *   O3  z-index = 110（bigtext 100、導覽列 10；Task5/6 overlay 從 120 起跳）
 *   O4  捲動鎖（touchmove preventDefault）掛在 overlay 背景層；
 *       圖片手勢（pinch/pan）在 .cv-img-wrap 內層處理並 stopPropagation，
 *       不被背景鎖吃掉
 *
 * viewport 修正（impact.md「spec 假設修正」）：
 *   本 repo viewport 無 user-scalable=no。
 *   檢視器開啟時在 overlay 上 preventDefault gesturestart + 雙指 touchstart
 *   來抑制 Safari 頁面縮放，關閉時解除。
 *
 * 手勢實作：
 *   - 雙擊：1x <-> 2.5x 切換
 *   - 雙指 pinch：縮放（1x ~ 4x）
 *   - 單指拖曳：平移（scale > 1 時）
 *   - 以 CSS transform: scale() translate() 自行實作，不依賴瀏覽器頁面縮放
 *
 * DOM 結構（class 名供 frontend 套樣式）：
 *
 *   div#coupon-viewer.cv-overlay       <- z-index 110，直掛 body
 *     div.cv-header
 *       span.cv-title                  <- 店名小標
 *       button.cv-close-btn            <- ✕，min-width/height >= 44px
 *     div.cv-img-wrap                  <- 手勢層（pinch/pan 在此）
 *       img.cv-img                     <- 主圖
 *       p.cv-img-error                 <- 壞圖時顯示（初始 hidden）
 *
 * 壞圖行為（impact.md 縫隙 2 定案）：開啟並顯示「圖片載入失敗」訊息
 */

(function () {
  'use strict';

  // ─── 檢視器元件狀態 ───────────────────────────────────────────
  var _overlayEl = null;
  var _titleEl = null;
  var _imgEl = null;
  var _errorEl = null;
  var _imgWrapEl = null;
  var _isOpen = false;

  // 手勢 / 縮放狀態
  var _scale = 1;
  var _tx = 0;          // translate X
  var _ty = 0;          // translate Y
  var _MIN_SCALE = 1;
  var _MAX_SCALE = 4;

  // 雙擊
  var _lastTapTime = 0;
  var _tapTimer = null;

  // pinch
  var _pinchStartDist = 0;
  var _pinchStartScale = 1;

  // pan（單指）
  var _panStartX = 0;
  var _panStartY = 0;
  var _panStartTx = 0;
  var _panStartTy = 0;
  var _isPanning = false;
  var _isPinching = false;

  // ─── transform 工具 ──────────────────────────────────────────

  function _applyTransform() {
    if (!_imgEl) return;
    // clamp translate 使圖片不超出 viewport（scale > 1 時才有意義）
    if (_scale <= 1) {
      _tx = 0;
      _ty = 0;
    } else {
      var wrapW = _imgWrapEl ? _imgWrapEl.clientWidth  : window.innerWidth;
      var wrapH = _imgWrapEl ? _imgWrapEl.clientHeight : window.innerHeight;
      var maxX = wrapW  * (_scale - 1) / 2;
      var maxY = wrapH  * (_scale - 1) / 2;
      if (_tx < -maxX) _tx = -maxX;
      if (_tx >  maxX) _tx =  maxX;
      if (_ty < -maxY) _ty = -maxY;
      if (_ty >  maxY) _ty =  maxY;
    }
    _imgEl.style.transform = 'scale(' + _scale + ') translate(' + _tx / _scale + 'px, ' + _ty / _scale + 'px)';
  }

  function _resetTransform() {
    _scale = 1;
    _tx = 0;
    _ty = 0;
    if (_imgEl) _imgEl.style.transform = '';
  }

  // 兩點距離
  function _dist(t1, t2) {
    var dx = t1.clientX - t2.clientX;
    var dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ─── 關閉 ────────────────────────────────────────────────────

  function _closeViewer() {
    if (!_isOpen) return;
    _isOpen = false;
    if (_overlayEl) _overlayEl.style.display = 'none';
    _resetTransform();
    // 解除 Safari 頁面縮放抑制
    if (_overlayEl) {
      _overlayEl.removeEventListener('gesturestart', _preventGesture);
    }
  }

  function _preventGesture(e) {
    e.preventDefault();
  }

  // ─── Lazy 建立 overlay DOM ───────────────────────────────────

  function _createOverlay() {
    var el = document.createElement('div');
    el.id = 'coupon-viewer';
    el.className = 'cv-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', '折價券圖片');
    el.style.display = 'none';

    // ── Header（店名 + 關閉鈕）─────────────────────────────────
    var header = document.createElement('div');
    header.className = 'cv-header';

    var titleEl = document.createElement('span');
    titleEl.className = 'cv-title';
    header.appendChild(titleEl);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'cv-close-btn';
    closeBtn.setAttribute('aria-label', '關閉');
    closeBtn.textContent = '✕'; // ✕
    closeBtn.addEventListener('click', function () {
      App.closeCouponViewer();
    });
    header.appendChild(closeBtn);

    el.appendChild(header);

    // ── 圖片手勢層 ────────────────────────────────────────────
    var wrap = document.createElement('div');
    wrap.className = 'cv-img-wrap';

    var imgEl = document.createElement('img');
    imgEl.className = 'cv-img';
    imgEl.alt = '';
    imgEl.draggable = false;

    // 壞圖處理（縫隙 2 定案：開啟並顯示訊息）
    var errorEl = document.createElement('p');
    errorEl.className = 'cv-img-error';
    errorEl.textContent = '圖片載入失敗';
    errorEl.style.display = 'none';

    imgEl.addEventListener('error', function () {
      imgEl.style.display = 'none';
      errorEl.style.display = '';
    });
    imgEl.addEventListener('load', function () {
      imgEl.style.display = '';
      errorEl.style.display = 'none';
    });

    wrap.appendChild(imgEl);
    wrap.appendChild(errorEl);
    el.appendChild(wrap);

    // ── 圖片手勢事件（O4：在 wrap 內層處理，stopPropagation 不讓背景鎖吃到）
    wrap.addEventListener('touchstart', _onWrapTouchStart, { passive: false });
    wrap.addEventListener('touchmove',  _onWrapTouchMove,  { passive: false });
    wrap.addEventListener('touchend',   _onWrapTouchEnd,   { passive: false });

    // ── 背景捲動鎖（O4：掛在 overlay，但 wrap 的事件不會冒泡至此）
    el.addEventListener('touchmove', function (e) {
      // wrap 內部事件已 stopPropagation，到這裡的只有背景觸碰
      e.preventDefault();
    }, { passive: false });

    // O1 直接掛 body
    document.body.appendChild(el);

    _overlayEl  = el;
    _titleEl    = titleEl;
    _imgEl      = imgEl;
    _errorEl    = errorEl;
    _imgWrapEl  = wrap;
  }

  // ─── 手勢處理 ─────────────────────────────────────────────────

  function _onWrapTouchStart(e) {
    e.stopPropagation(); // O4：不讓背景鎖吃到

    if (e.touches.length === 2) {
      // Safari 頁面縮放抑制（雙指時 preventDefault）
      e.preventDefault();
      _isPinching = true;
      _isPanning = false;
      _pinchStartDist  = _dist(e.touches[0], e.touches[1]);
      _pinchStartScale = _scale;
    } else if (e.touches.length === 1) {
      _isPinching = false;
      _isPanning = false;

      // 雙擊偵測
      var now = Date.now();
      if (now - _lastTapTime < 280 && !_tapTimer) {
        // 雙擊：1x <-> 2.5x
        _lastTapTime = 0;
        if (_scale > 1.1) {
          _scale = 1;
        } else {
          _scale = 2.5;
        }
        _applyTransform();
        return;
      }
      _lastTapTime = now;

      // pan 起始（放大狀態下）
      if (_scale > 1) {
        _isPanning = true;
        _panStartX  = e.touches[0].clientX;
        _panStartY  = e.touches[0].clientY;
        _panStartTx = _tx;
        _panStartTy = _ty;
      }
    }
  }

  function _onWrapTouchMove(e) {
    e.stopPropagation(); // O4

    if (_isPinching && e.touches.length === 2) {
      e.preventDefault(); // 抑制頁面縮放
      var newDist = _dist(e.touches[0], e.touches[1]);
      var ratio = newDist / _pinchStartDist;
      _scale = Math.min(_MAX_SCALE, Math.max(_MIN_SCALE, _pinchStartScale * ratio));
      _applyTransform();
    } else if (_isPanning && e.touches.length === 1 && _scale > 1) {
      e.preventDefault();
      var dx = e.touches[0].clientX - _panStartX;
      var dy = e.touches[0].clientY - _panStartY;
      _tx = _panStartTx + dx;
      _ty = _panStartTy + dy;
      _applyTransform();
    }
  }

  function _onWrapTouchEnd(e) {
    e.stopPropagation(); // O4
    if (e.touches.length < 2) {
      _isPinching = false;
    }
    if (e.touches.length === 0) {
      _isPanning = false;
      // pinch 結束若 scale 低於 1 自動 reset
      if (_scale < 1) {
        _scale = 1;
        _applyTransform();
      }
    }
  }

  // ─── 公開 API ─────────────────────────────────────────────────

  /**
   * 開啟全螢幕折價券圖片檢視器。
   * @param {{ src: string, storeName?: string }} params
   *   src       圖片路徑（必填）
   *   storeName 店名（選填，顯示頂部小標）
   */
  function openCouponViewer(params) {
    if (!params || !params.src) return;

    // Lazy 建立
    if (!_overlayEl) _createOverlay();

    // 重置縮放狀態
    _resetTransform();

    // 填入資料
    _titleEl.textContent = params.storeName || '';
    _imgEl.style.display = '';
    _errorEl.style.display = 'none';
    _imgEl.src = params.src;

    // 顯示
    _overlayEl.style.display = '';
    _isOpen = true;

    // 抑制 Safari 頁面縮放（gesturestart）
    _overlayEl.addEventListener('gesturestart', _preventGesture, { passive: false });
  }

  function closeCouponViewer() {
    _closeViewer();
  }

  // ─── O1: additive wrap App.showTab ───────────────────────────
  // 切分頁時自動關閉。wrap 為 additive（在 bigtext wrap 之後再疊）。
  // 載入時捕獲當前 App.showTab（可能已是 bigtext 的 wrap 版）。
  // 切分頁順序：coupons wrap 關檢視器 -> bigtext wrap 關大字 -> app.js 原函式。
  if (App && typeof App.showTab === 'function') {
    var _prevShowTab = App.showTab;
    App.showTab = function (id) {
      _closeViewer(); // overlay 未開時為 no-op
      return _prevShowTab(id);
    };
  }

  // ─── 補掛 App ─────────────────────────────────────────────────
  window.App = window.App || {};
  App.openCouponViewer  = openCouponViewer;
  App.closeCouponViewer = closeCouponViewer;

})();
