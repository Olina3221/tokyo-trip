/**
 * app.js — 分頁框架 + Service Worker 註冊
 *
 * 載入位置（index.html 定死，Task2-6 不得更動前四項）：
 *   config.js (onerror) → phrases.js → tripdata.js → app.js
 *   → [Task2-6 功能模組，在 app.js 之後、</body> 之前]
 *
 * 公開 API（詳見 specs/Task1.api.md）：
 *   App.registerTab(id, { onShow })   -- app.js 載入後可立即同步呼叫
 *   App.showTab(id)                   -- DOMContentLoaded 後可用
 *   App.TAB_IDS                       -- 唯讀，五個定案 id 陣列
 */

(function () {
  'use strict';

  // ─── 常數 ───────────────────────────────────────────────────
  // A1：五個分頁 id 定案，Task2-6 直接引用，改名 = 全鏈返工
  var TAB_IDS = ['phrases', 'translate', 'camera', 'trip', 'coupons'];

  // A8：localStorage key 命名空間
  var STORAGE_KEY = 'tokyotrip.lastTab';

  // ─── 內部狀態 ─────────────────────────────────────────────
  var _registrations = {};   // id → { onShow }
  var _initialized = false;
  var _pendingQueue = [];    // DOMContentLoaded 前的 registerTab 呼叫暫存

  // ─── 公開 API ────────────────────────────────────────────
  window.App = {
    TAB_IDS: TAB_IDS,

    /**
     * 註冊分頁生命週期 hook。
     * 在 app.js 載入後（即本腳本 <script> 標籤執行完畢後）可立即同步呼叫，
     * DOMContentLoaded 之前均有效（進入內部佇列）。
     *
     * @param {string} id       - 分頁 id（必須是 TAB_IDS 之一）
     * @param {object} options
     * @param {function} [options.onShow] - 切到此分頁時呼叫（每次都觸發）
     */
    registerTab: function (id, options) {
      if (TAB_IDS.indexOf(id) === -1) {
        console.warn('[App] Unknown tab id:', id);
        return;
      }
      if (_initialized) {
        _registrations[id] = options || {};
      } else {
        _pendingQueue.push({ id: id, options: options || {} });
      }
    },

    /**
     * 程式化切換到指定分頁（DOMContentLoaded 後可用）。
     * 一般情況下導覽列點擊已內建切換，功能模組需要跨頁跳轉時才呼叫。
     *
     * @param {string} id
     */
    showTab: function (id) {
      if (TAB_IDS.indexOf(id) === -1) return;

      // 更新 section 顯示（frontend 使用 id="tab-{id}"）
      TAB_IDS.forEach(function (tabId) {
        var section = document.getElementById('tab-' + tabId);
        if (section) section.hidden = (tabId !== id);
      });

      // 更新導覽列選中狀態（frontend 使用 data-tab="{id}"）
      document.querySelectorAll('[data-tab]').forEach(function (btn) {
        var isActive = btn.dataset.tab === id;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      // A8：記住最後分頁
      try { localStorage.setItem(STORAGE_KEY, id); } catch (_) {}

      // 觸發 onShow hook
      var reg = _registrations[id];
      if (reg && typeof reg.onShow === 'function') {
        try { reg.onShow(); } catch (e) {
          console.warn('[App] onShow error for tab', id, e);
        }
      }
    },
  };

  // ─── DOMContentLoaded 初始化 ────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    _initialized = true;

    // 收割 DOMContentLoaded 前的 registerTab 呼叫
    _pendingQueue.forEach(function (item) {
      _registrations[item.id] = item.options;
    });
    _pendingQueue.length = 0;

    // 導覽列點擊
    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        App.showTab(btn.dataset.tab);
      });
    });

    // 還原最後分頁，預設第一個（phrases）
    var lastTab;
    try { lastTab = localStorage.getItem(STORAGE_KEY); } catch (_) {}
    var initialTab = (lastTab && TAB_IDS.indexOf(lastTab) !== -1) ? lastTab : TAB_IDS[0];
    App.showTab(initialTab);

    // A5：Service Worker 註冊＋更新機制（Task14 擴充）
    if ('serviceWorker' in navigator) {

      // Task14 首裝守門：在 register() 前快照；
      // clients.claim() 首裝也會觸發 controllerchange，hadController=false 時兩路一律不彈
      var hadController = !!navigator.serviceWorker.controller;
      var _swReg = null;         // register resolve 後填入
      var _updateShown = false;  // 記憶體 flag，防重複顯示（禁 localStorage）

      // ── 版號徽章 ────────────────────────────────────────────
      // 缺元素或缺常數（version.js 載入失敗）→ no-op，不壞頁
      var _badge = document.getElementById('app-version');
      if (_badge && window.APP_VERSION && window.APP_VERSION_DATE) {
        _badge.textContent = window.APP_VERSION + ' · ' + window.APP_VERSION_DATE;
      }

      // ── 更新提示 Toast ───────────────────────────────────────
      function _showUpdateToast() {
        if (_updateShown) return;
        if (!hadController) return; // 首裝不彈
        _updateShown = true;
        var _toast = document.getElementById('update-toast');
        if (_toast) _toast.hidden = false;
      }

      // Toast click → reload（全檔唯一 location.reload）
      var _toastEl = document.getElementById('update-toast');
      if (_toastEl) {
        _toastEl.addEventListener('click', function () {
          location.reload();
        });
      }

      // ── 更新檢查觸發 ─────────────────────────────────────────
      // S2：register resolve 前 pageshow/visibilitychange 就會 fire → null-check → no-op
      // S1：update() 失敗是 promise rejection，不能靠 try/catch，必須 .catch()
      function _triggerUpdate() {
        if (!_swReg) return;
        _swReg.update().catch(function () {});
      }

      // S3：visibilitychange 掛 document，pageshow 掛 window，DOMContentLoaded 內各一次
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') _triggerUpdate();
      });
      window.addEventListener('pageshow', function () {
        _triggerUpdate();
      });

      // ── 更新偵測（兩路）────────────────────────────────────
      // 路徑 A：controllerchange（S4：hadController=false 首裝不彈）
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        _showUpdateToast();
      });

      // 路徑 B：updatefound → 新 worker statechange 至 activated
      function _watchForUpdate(reg) {
        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'activated') {
              _showUpdateToast();
            }
          });
        });
      }

      // ── 註冊（P4：updateViaCache:'none' 釘死，避免 sw.js 被 HTTP cache 黏住）──
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function (reg) {
        console.log('[App] SW registered, scope:', reg.scope);
        _swReg = reg;
        _watchForUpdate(reg);
      }).catch(function (err) {
        console.warn('[App] SW registration failed (offline mode unavailable):', err);
      });

    }
  });

})();
