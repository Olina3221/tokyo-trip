/**
 * sw.js — Service Worker（cache-first 離線快取）
 *
 * 必須放 repo 根目錄（SW scope 才能涵蓋整個網站）。
 *
 * ── bump SOP（自 Task14 起）────────────────────────────────
 * 改版三行（兩檔三行紀律，QA 機械閘驗）：
 *   1. js/version.js → APP_VERSION（必須與 CACHE_VERSION 逐字元相等）
 *   2. js/version.js → APP_VERSION_DATE
 *   3. 本檔 CACHE_VERSION（全檔唯一，只改這裡）
 * 新增資源：另加路徑進 PRECACHE_URLS，同時 bump 以上三行
 *
 * ── 禁止項目 ────────────────────────────────────────────────
 * - make_icons.py、specs/ 不得列入快取
 */

// ─── 版本與快取清單（全檔唯一，改版只動這兩個常數）────────
var CACHE_VERSION = 'v17';
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
  // Task5（A2 SOP）：金鑰版控化（config.js 自 Task5 起納入 PRECACHE，A3 禁令廢止）＋翻譯模組
  './js/config.js',
  './js/api.js',
  './js/translate-tab.js',
  // Task12（A2 SOP）：錄音封裝模組（載入順序 api.js → recorder.js → translate-tab.js）
  './js/recorder.js',
  // Task14（A2 SOP）：版本常數模組（version.js → config.js → ... → app.js 載入順序）
  './js/version.js',
  // Task6（A2 SOP）：拍照 OCR 分頁（載入順序 translate-tab.js → camera-tab.js → coupon-viewer.js）
  './js/camera-tab.js',
  // Task17（A2 SOP）：地圖分頁資料與邏輯模組（載入順序 mapdata.js → map-tab.js，在 trip-tab.js 之後）
  './js/mapdata.js',
  './js/map-tab.js',
];

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

// ─── fetch：cache-first（POST 直通，不快取；googleapis 呼叫須用 POST）──
self.addEventListener('fetch', function (event) {
  // 只處理 GET（POST 直通，保證 googleapis 翻譯／OCR 呼叫不進快取）
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
