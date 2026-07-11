/**
 * sw.js — Service Worker（cache-first 離線快取）
 *
 * 必須放 repo 根目錄（SW scope 才能涵蓋整個網站）。
 *
 * ── 加新檔案 SOP（A2）──────────────────────────────────────
 * Task2-6 新增任何 js 或資源：
 *   1. 把路徑加入下面的 PRECACHE_URLS（全檔唯一，只改這裡）
 *   2. 把 CACHE_VERSION 改成新版本字串（如 'v1' → 'v2'）
 *   3. 部署；使用者重新整理兩次後即取得新版
 *
 * ── 禁止項目 ────────────────────────────────────────────────
 * - js/config.js 不得列入 PRECACHE_URLS（A3）
 * - js/config.js 也不得進入動態快取回填（A3，fetch handler 已明確排除）
 * - make_icons.py、specs/ 不得列入快取
 */

// ─── 版本與快取清單（全檔唯一，改版只動這兩個常數）────────
var CACHE_VERSION = 'v7';
var CACHE_NAME = 'tokyo-trip-' + CACHE_VERSION;

var PRECACHE_URLS = [
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/phrases.js',
  './js/tripdata.js',
  './js/config.example.js',
  // Task2（A2 SOP）：三個功能模組
  './js/tts.js',
  './js/bigtext.js',
  './js/phrases-tab.js',
  // Task3（A2 SOP）：新增兩個功能模組；tripdata.js 內容全換靠 bump 生效
  './js/import-data.js',
  './js/trip-tab.js',
  // Task4（A2 SOP）：折價券模組 + 18 張券圖；tripdata.js COUPONS 更新靠 bump v4 生效
  './js/coupon-viewer.js',
  './js/coupons-tab.js',
  './img/coupons/biccamera.jpg',
  './img/coupons/laox.jpg',
  './img/coupons/cosmos.jpg',
  './img/coupons/tsuruha.jpg',
  './img/coupons/sundrug.jpg',
  './img/coupons/satudora.jpg',
  './img/coupons/edion.jpg',
  './img/coupons/donki.jpg',
  './img/coupons/keio.jpg',
  './img/coupons/seibu-sogo.jpg',
  './img/coupons/odakyu.jpg',
  './img/coupons/daimaru.jpg',
  './img/coupons/alpen.jpg',
  './img/coupons/victoria.jpg',
  './img/coupons/lotte-ginza.jpg',
  './img/coupons/japandutyfree.jpg',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];
// NOTE：js/config.js 不在此清單（gitignored，部署後可能不存在，金鑰不得進快取）

// ─── install：逐檔預快取，單檔失敗不炸整個 install（A4）────
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      var promises = PRECACHE_URLS.map(function (url) {
        return cache.add(url).catch(function (err) {
          // 單檔 404 或網路失敗：只記警告，不中斷 install
          console.warn('[SW] Precache failed:', url, err);
        });
      });
      return Promise.all(promises);
    })
  );
  // 立即接管，不等舊 SW 關閉
  self.skipWaiting();
});

// ─── activate：刪除舊版快取 ──────────────────────────────────
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// ─── fetch：cache-first；config.js 強制 network-only（A3）──
self.addEventListener('fetch', function (event) {
  var url = event.request.url;

  // A3：config.js 完全不快取（預快取 + 動態回填兩路均排除）
  if (url.indexOf('js/config.js') !== -1) {
    event.respondWith(
      fetch(event.request).catch(function () {
        // 離線且無快取：回傳空 config，保持 window.APP_CONFIG 未定義（合法）
        return new Response('/* config offline */', {
          headers: { 'Content-Type': 'application/javascript' },
        });
      })
    );
    return;
  }

  // 只處理 GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      // cache miss → 走網路，成功後回填動態快取
      return fetch(event.request).then(function (response) {
        if (
          response &&
          response.status === 200 &&
          response.type !== 'opaque'
        ) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
