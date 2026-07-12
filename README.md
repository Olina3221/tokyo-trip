# 東京自由行 — iPhone PWA

四人東京行隨身助手：常用句、中日翻譯、拍照辨識、行程、折價券。
加入 iPhone 主畫面後以全螢幕 APP 模式執行，主要功能（常用句、行程、折價券）完全離線可用。

---

## 本機啟動

Service Worker 需要 `localhost` 或 HTTPS，直接開 `file://` 不支援離線快取。

```bash
cd "C:\Python Project\tokyo-trip"
python -m http.server 8080
```

瀏覽器開啟 `http://localhost:8080/`

> **開發提示**：若 cache-first 讓你吃到舊版本，在 DevTools → Application → Service Workers 勾選「Update on reload」可強制重抓最新版。

---

## Google API 金鑰設定

翻譯（Task5）與拍照辨識（Task6）功能需要 Google API 金鑰；其他頁面完全離線可用，未設定金鑰不影響啟動。

**取得金鑰**

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立專案（或選現有專案）
3. 啟用以下兩個 API（同一把 key 即可）：
   - Cloud Translation API
   - Cloud Vision API
4. 建立「API 金鑰」，複製金鑰字串

**設定步驟**

```bash
# 複製範本
cp js/config.example.js js/config.js
```

開啟 `js/config.js`，填入金鑰：

```js
window.APP_CONFIG = {
  GOOGLE_API_KEY: "AIzaSy...",   // ← 填入你的金鑰
};
```

> `js/config.js` 已納入版控、隨站部署到 GitHub Pages（自 Task5 起）。
> 金鑰安全靠 Google Cloud Console 的兩層限制：
> - HTTP 參照網址限制 = `olina3221.github.io/*`
> - API 限制 = Cloud Translation + Cloud Vision
>
> 金鑰可隨時在 Google Cloud Console 重新產生作廢。
>
> **金鑰輪替 SOP**：修改 `js/config.js` 內的金鑰值 → bump `sw.js` 的 `CACHE_VERSION` → 部署 → 使用者 reload 兩次後生效。
> （過渡期間：舊金鑰作廢後、SW 更新前，翻譯功能可能暫時出現 403 錯誤，reload 兩次即恢復。）

---

## 加入 iPhone 主畫面

1. iPhone Safari 開啟網站網址（正式部署見 Task7；本機測試需與 iPhone 同一 Wi-Fi 後用電腦 IP）。
2. 底部工具列點「**分享**」按鈕（方框加上箭頭圖示）。
3. 捲動選單，點「**加入主畫面**」。
4. 輸入名稱（預設「東京行」），點右上角「**加入**」。
5. 返回主畫面，出現「東京行」圖示 → 點開即以全螢幕執行。

---

## 開發 SOP：加新 JS 檔到快取

Task2–6 每次新增或修改任何 app shell 檔案，必須同時更新 `sw.js`：

1. **把新檔路徑加入 `PRECACHE_URLS` 陣列**（位於 sw.js 頂部，全檔唯一）。
   ```js
   var PRECACHE_URLS = [
     // ... 既有清單 ...
     './js/api.js',   // ← 新增
   ];
   ```
2. **把 `CACHE_VERSION` 改成新版本字串**：
   ```js
   var CACHE_VERSION = 'v2';   // 'v1' → 'v2'
   ```
3. 提交並部署；使用者重新整理兩次後即取得新版快取，舊快取名自動刪除。

> `js/config.js` 自 Task5 起已在 PRECACHE_URLS 內，內容變更（金鑰輪替）同樣走 bump SOP。

---

## 地圖功能（Task17）

開路線前，請先到 Google 地圖 App 的設定 → 語言，選擇繁體中文，主要車站站名才會顯示中文；小站或公車站若無中文資料，仍會顯示日文，屬已知限制。

---

## 部署（GitHub Pages）

Task7 補充。

---

## 專案結構

詳見 `specs/SYSTEM_MAP.md`。

```
tokyo-trip/
├── index.html              App shell（iOS meta、分頁容器）
├── css/style.css           全站樣式（直式 iPhone、safe-area）
├── js/
│   ├── app.js              分頁框架、SW 註冊
│   ├── config.example.js   金鑰模板（上 git）
│   ├── config.js           真實金鑰（納入版控、隨站部署；受 referer＋API 限制保護）
│   ├── phrases.js          常用句庫（Task2）
│   └── tripdata.js         行程/折價券資料（Task3/4）
├── sw.js                   Service Worker（根目錄，scope 涵蓋全站）
├── manifest.webmanifest    PWA manifest
├── icons/                  APP 圖示
└── specs/                  spec 與信號檔（不進快取）
```
