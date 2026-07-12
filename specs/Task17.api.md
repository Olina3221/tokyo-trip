# Task17.api.md — 地圖分頁 Backend → Frontend 交接契約

> Backend 完成（map-tab.js、mapdata.js、app.js TAB_IDS、sw.js/version.js v17）後，Frontend 依本文件組裝 index.html + css/style.css。

---

## 1. window.MAPDATA schema

**路徑**：`js/mapdata.js`（由 `make_mapdata.py` 生成，手改會被覆蓋）

```js
window.MAPDATA = [
  {
    isoDate: "2026-07-21",          // string，格式 YYYY-MM-DD，依 isoDate 升冪
    places: [
      {
        name: "成田機場（成田第１航廈）",  // string，原始 KML 地點名（保留【】等備註）
        lat: 35.7658492,              // number，緯度（已由 KML 經度,緯度 對調）
        lon: 140.3864853              // number，經度
      },
      // ...
    ]
  },
  // ... 共 5 天（2026-07-21 ~ 07-25），總地點 49 筆
];
```

**不變式**：
- 5 天，總地點數 49，isoDate 升冪。
- 2026-07-24 包含築地（前9筆）＋橫濱（後8筆），共17筆。
- 每點 lat∈[35,36]、lon∈[139,141]（已自檢通過）。
- `name` 用 `textContent` 賦值（禁 innerHTML 插地名，防 XSS）。
- `lat`/`lon` 用 `encodeURIComponent(lat + ',' + lon)` 組 URL。

---

## 2. map-tab.js DOM/class 契約

map-tab.js 動態建構 `#tab-map` 的全部子元素（比照 camera-tab.js）。Frontend 須：
- 提供空的 `<section id="tab-map" class="tab-section" hidden></section>`（**hidden 必帶，G1**）。
- 提供 `.tab-section` 樣式（已有）+ `.map-*` 新增樣式。
- **不得**在 `#tab-map` 內寫任何靜態 HTML（由 JS 建構）。

### 2-1. 頂層結構

```
#tab-map（flex-direction:column；交付 frontend 定高度 + overflow）
  .map-chips-bar       ← 日期 chips 橫向 bar（flex-shrink: 0）
  .map-ab-row          ← A/B 選擇區（flex-shrink: 0）
  .map-lang-hint       ← 語言提示靜態段落（flex-shrink: 0）B3-1
  .map-places-list     ← 地點清單（flex: 1，唯一捲動區）
```

**Task11 U2 永續紀律**：`.map-chips-bar`、`.map-ab-row`、`.map-lang-hint` 三個非捲動子元素皆已由 JS 建構，Frontend 在 CSS 給這些元素加 `flex-shrink: 0`。

### 2-2. 日期 chips（.map-chips-bar）

```
.map-chips-bar（橫向捲動，flex-shrink: 0）
  .map-chip（button，data-iso="2026-07-21"）
    [.map-chip-today]（span，今天 badge，'今'，只在今天的 chip 出現）
  .map-chip.map-chip-active（選中狀態）
```

- chip textContent 格式：`Day1 07/21`（若 TRIP lookup 找到），否則 `07/21`。
- `.map-chip-active` 由 JS 管理，Frontend 提供樣式（accent 底色白字）。
- `.map-chip-today` 是 chip 內的 badge span，標「今」。

### 2-3. A/B 選擇區（.map-ab-row）

```
.map-ab-row（flex-shrink: 0）
  .map-ab-line           ← A 起點列
    .map-ab-label        ← 'A 起點'
    .map-ab-val          ← 目前選中值（text）
      .map-ab-val.map-ab-current  ← A=目前位置 狀態（JS 動態加/移 class）
      .map-ab-val.map-ab-empty    ← 未選狀態
    .map-ab-reset-btn    ← '還原位置' button
  .map-ab-line           ← B 終點列
    .map-ab-label        ← 'B 終點'
    .map-ab-val          ← 目前選中值
      .map-ab-val.map-ab-custom   ← B=自訂文字 狀態
  .map-ab-custom-row     ← B 自訂輸入列
    .map-custom-input    ← input[type=text]，font-size:16px（iOS縮放紅線，JS已設）
    .map-custom-use-btn  ← '使用' button
  .map-ab-actions-row    ← 操作列
    .map-swap-btn        ← 'A⇄B' button（disabled 受 JS 控制）
    .map-route-btn       ← '查大眾運輸路線' button（disabled 受 JS 控制）
  .map-leave-note        ← p，'會離開 APP 開啟 Google 地圖'
```

**觸控目標**：`.map-ab-reset-btn`、`.map-custom-use-btn`、`.map-swap-btn`、`.map-route-btn` 均 `min-height: 44px`（≥44px 觸控紅線）。`.map-custom-input` 已由 JS 設 `font-size: 16px`，CSS 不得覆蓋為更小值。

### 2-4. 語言提示（.map-lang-hint）B3-1

**已由 map-tab.js 建構**（動態 DOM）。Frontend 只需提供 CSS 樣式。

文字內容：「請把 Google 地圖 App 的語言設為繁體中文，主要車站站名才會顯示中文。小站或公車站若 Google 沒有中文資料，仍會顯示日文。」

這是「誠實告知的已知限制」，QA 不得以小站顯示日文判 FAIL（spec B3-1 拍板）。

### 2-5. 地點清單（.map-places-list）

```
.map-places-list（flex: 1，overflow-y: auto，唯一捲動區）
  .map-day-header        ← 日期頭（渲染每次選 chip 後重建）
    .map-day-header-main ← 'Day 1 · 2026-07-21'
    .map-day-theme       ← 行程 theme（如有）
    .map-today-badge     ← '今天' badge（今天才出現）
  .map-empty             ← p，'本日無地點'（places 為空時）
  .map-place-row * N
    .map-place-name      ← button，地點名（點→單點開地圖）
    .map-place-actions
      .map-place-btn     ← '設起點' button（min-height: 44px）
      .map-place-btn     ← '設終點' button（min-height: 44px）
  .map-error             ← p，MAPDATA 缺載錯誤文案
```

---

## 3. Deep-link 三形態（hl=zh-TW 必帶）

| 情境 | URL 格式 |
|------|---------|
| 單點查看（點地點名） | `https://www.google.com/maps/search/?api=1&query={encodeURI(lat,lon)}&hl=zh-TW` |
| 路線 A=目前位置 | `https://www.google.com/maps/dir/?api=1&destination={encodeURI(lat,lon)}&travelmode=transit&hl=zh-TW` |
| 路線 A=地點 | 同上加 `&origin={encodeURI(lat,lon)}` |
| 路線 B=自訂文字 | destination 使用 `encodeURIComponent(text)`（地名/地址皆可） |

**開啟規則（G3）**：`window.open(url, '_blank', 'noopener')`，必須在使用者點擊 handler 的**同步呼叫棧**內執行。iOS standalone PWA 任何 await/setTimeout 後的 `window.open` 都會被攔截。

---

## 4. A/B 可編輯 v1 行為摘要

- A 預設「目前位置」；從清單點「設起點」改為地點；點「還原位置」恢復 current。
- B 從清單點「設終點」；或在輸入框打文字後點「使用」（自訂文字 B）。
- A⇄B 互換：兩端皆為地點時可用，disabled 否則（A=current 或 B=custom 時）。
- A/B 狀態存 closure 記憶體，切換日期 chip 或離開分頁再回來均保留（G6）。
- 零新 key 在 `tokyotrip.*` 命名空間（spec 要求，QA 機械閘）。

---

## 5. Frontend 施工清單

### 5-1. index.html 新增

```html
<!-- 資料檔區，在 tripdata.js 之後 -->
<script src="./js/mapdata.js"></script>

<!-- 功能模組區，在 trip-tab.js 之後、api.js 之前 -->
<script src="./js/map-tab.js"></script>
```

導覽列加第 6 鈕（行程與折價券之間）：
```html
<button class="nav-btn" data-tab="map" aria-selected="false">
  <span class="nav-icon">🗺</span>
  <span class="nav-label">地圖</span>
</button>
```
（icon 與既有五鈕同型式，emoji 或 SVG 均可）

新 section（**hidden 必帶，G1**）：
```html
<section id="tab-map" class="tab-section" hidden></section>
```

### 5-2. placeholder-card 清理（Frontend 責任）

index.html 4 處 `.placeholder-card` 佔位 HTML 刪除（section 本體保留留空）：
- `#tab-phrases`、`#tab-translate`、`#tab-trip`、`#tab-coupons` 各一處

style.css 孤兒選擇器刪除：
- `.placeholder-card`、`.placeholder-icon`、`.placeholder-title`、`.placeholder-desc`
- 對應注釋兩處（style.css:80 與 index.html:31 附近）

QA 判準：`grep placeholder-card index.html` 結果為 0。

### 5-3. style.css 新增 .map-* 樣式節

工程紀律：
- `.map-*` 前綴，不用 `.trip-*` 等其他前綴。
- 字級全**硬編碼**，**禁 `var(--fs-`**（type scale 變數只授權 `.trip-*`）。
- 淺色主題，全域變數（`var(--c-bg)` 等）合法（map 無深底 overlay）。
- 無 `z-index >= 100`（無 overlay 需求）。
- 非捲動子元素（`.map-chips-bar`、`.map-ab-row`、`.map-lang-hint`）加 `flex-shrink: 0`。
- `.map-places-list`：`flex: 1; overflow-y: auto;`（唯一捲動區）。
- 觸控目標 `min-height: 44px`（行動裝置 HIG 要求）。

### 5-4. README.md 補一句（B3-1）

> 「地圖功能：開路線前，請先到 Google 地圖 App 的設定 → 語言，選擇繁體中文，主要車站站名才會顯示中文；小站或公車站若無中文資料，仍會顯示日文，屬已知限制。」

---

## 6. 版本與快取

- `sw.js CACHE_VERSION = 'v17'`（與 `js/version.js APP_VERSION = 'v17'` 逐字元相等）
- `js/version.js APP_VERSION_DATE = '07/12'`
- PRECACHE_URLS：39 → **41** 筆（+`./js/mapdata.js`、`./js/map-tab.js`）

---

## 7. 零 diff 清單（backend 已確認）

以下檔案 git diff = 0，frontend 施工時不得動到：

`js/api.js` / `js/tts.js` / `js/bigtext.js` / `js/recorder.js` /
`js/trip-tab.js` / `js/tripdata.js` / `js/translate-tab.js` / `js/camera-tab.js`

---

## 8. Non-scope（frontend 施工護欄）

- 不做 Google Directions/Routes API、不做 APP 內互動地圖圖磚。
- 不做地點庫增刪改名排序。
- 不接 showBigText/speak（bigtext.js/tts.js 零 diff）。
- 不改 trip-tab.js/tripdata.js/全域 viewport/既有五分頁 id 結構/四層 wrap 鏈。
- 不做部署（Task7）。
