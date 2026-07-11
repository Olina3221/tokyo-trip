# Task4.api.md — 折價券專區 Backend 交付介面

> Backend 完成交付文件。Frontend（Task4 UI 層）與 Task5/6 依此文件實作。

---

## 1. COUPONS 資料 Schema

`js/tripdata.js` 的 `window.COUPONS`（陣列，16 筆）：

```js
{
  id:       string,   // 唯一識別碼，與 img 檔名主幹一致（全小寫 ASCII）
  store:    string,   // 店名（列表主標）
  category: string,   // 固定枚舉：藥妝 | 電器 | 量販 | 百貨 | 運動 | 免稅店
  discount: string,   // 折扣摘要（一行）
  expiry:   string | null,  // ISO 日期字串；券面未標示 -> null
  passport: boolean,  // 是否需護照 / 限免稅顧客
  notes:    string,   // 門檻/地區/注意事項
  area:     string,   // 地區警示；非東京可用時填（如「門市在關西」）；一般留 ""
  img:      string,   // 相對路徑 "./img/coupons/{id}.jpg"（A5）
}
```

### 16 筆 id 清單（與 img/coupons/ 檔名、PRECACHE 三處逐字元一致）

> 資料收斂（2026-07-11）：移除 drugeleven（東京 2022 已撤退，現只剩九州/沖繩）、kintetsu（東京 0 店，僅關西）；cosmos area 欄位清空（原誤標非東京警示，實際東京有 12 間店）。

| id | 店名 | 分類 |
|----|------|------|
| cosmos | 科摩思 COSMOS 藥妝 | 藥妝 |
| tsuruha | 鶴羽藥妝 ツルハドラッグ | 藥妝 |
| sundrug | 尚都樂客 Sundrug | 藥妝 |
| satudora | 札幌藥妝 サツドラ | 藥妝 |
| biccamera | BicCamera / KOJIMA | 電器 |
| laox | LAOX | 電器 |
| edion | EDION 愛電王 | 電器 |
| donki | 唐吉訶德 ドン・キホーテ | 量販 |
| keio | 京王百貨 新宿店 | 百貨 |
| seibu-sogo | 西武・SOGO 百貨 | 百貨 |
| odakyu | 小田急百貨 新宿 | 百貨 |
| daimaru | 大丸松坂屋百貨 | 百貨 |
| alpen | Alpen / Sports DEPO / GOLF5 | 運動 |
| victoria | Victoria / Victoria Golf / L-Breath | 運動 |
| lotte-ginza | 樂天免稅店 銀座 | 免稅店 |
| japandutyfree | JAPAN DUTY FREE（成田機場） | 免稅店 |

---

## 2. 壓縮圖片清單與放寬紀錄（C2）

目標目錄：`img/coupons/`，共 16 張，總量約 **4.37 MB**（目標 ≤8MB）。

> 資料收斂（2026-07-11）：drugeleven.jpg、kintetsu.jpg 已刪除（對應券移除）。

| 目標檔 | 尺寸（px）| 大小（KB） | 備註 |
|--------|----------|-----------|------|
| biccamera.jpg | 1414×2000 | 437 | |
| laox.jpg | 806×2000 | 231 | |
| cosmos.jpg | 640×1500 | 208 | |
| tsuruha.jpg | 1459×2600 | 518 | **放寬 2600px**：原 7.8MB 長圖多段條碼，確保條碼數字可讀 |
| sundrug.jpg | 1278×2048 | 346 | **放寬 2600px**：三段條碼依消費金額擇一掃，確保數字可讀 |
| satudora.jpg | 924×2000 | 297 | |
| edion.jpg | 751×1331 | 207 | |
| donki.jpg | 1332×1730 | 349 | **放寬 2600px**：三段條碼，確保數字可讀 |
| keio.jpg | 756×1209 | 193 | |
| seibu-sogo.jpg | 739×2000 | 243 | |
| odakyu.jpg | 683×1542 | 213 | |
| daimaru.jpg | 592×861 | 118 | |
| alpen.jpg | 1062×1999 | 309 | |
| victoria.jpg | 1122×2000 | 414 | |
| lotte-ginza.jpg | 1122×2000 | 307 | |
| japandutyfree.jpg | 1186×762 | 94 | |

> 目視條碼/QR 與條碼下方數字確認留由 Olina 真機驗收（QA Task7 流程）。

---

## 3. coupon-viewer.js 公開 API

```js
App.openCouponViewer({ src, storeName })
  // src:       string（必填，圖片相對路徑）
  // storeName: string（選填，顯示於檢視器頂部）

App.closeCouponViewer()
  // 關閉檢視器；未開時 no-op
```

### 檢視器行為定案

| 行為 | 說明 |
|------|------|
| 開啟 | `openCouponViewer()` 呼叫，初始 fit-to-screen（scale=1）|
| 壞圖 | 開啟並顯示「圖片載入失敗」文字（不採「不開啟」）|
| 雙擊 | 1x ↔ 2.5x 切換 |
| Pinch | 縮放 1x~4x（CSS transform，不依賴瀏覽器頁面縮放）|
| 單指拖曳 | scale > 1 時平移；clamp 至圖片邊界 |
| ✕ 關閉 | `App.closeCouponViewer()`，觸控目標 ≥44px（frontend 保證）|
| 切分頁 | additive wrap App.showTab 自動關閉（O1）|
| 背景捲動鎖 | overlay 背景 touchmove preventDefault；圖片手勢 stopPropagation 不被吃掉（O4）|
| Safari 頁面縮放 | overlay gesturestart + 雙指 touchstart 均 preventDefault（viewport 修正）|

---

## 4. coupon-viewer DOM 結構（class 名供 frontend 套樣式）

```
div#coupon-viewer.cv-overlay          z-index: 110（O3）；直掛 body；初始 display:none
  div.cv-header
    span.cv-title                     店名小標（storeName）
    button.cv-close-btn               ✕；frontend 須保證 min-width/height >= 44px
  div.cv-img-wrap                     手勢層（pinch/pan 在此 element 上）
    img.cv-img                        主圖（fit-to-screen 由 frontend CSS 控制）
    p.cv-img-error                    壞圖訊息；初始 display:none
```

---

## 5. coupons-tab.js DOM 結構（class 名供 frontend 套樣式）

```
div.coupons-container                 替換 #tab-coupons placeholder-card
  div.coupons-group                   每個分類一個 group
    [data-category="藥妝|電器|..."]
    h2.coupons-group-title            分類標題
    div.coupon-card                   每張券
      [role="button"][tabindex="0"]
      div.coupon-card-thumb-wrap
        img.coupon-card-thumb         縮圖；loading="lazy"
        div.coupon-card-thumb-error   縮圖壞時顯示（optional）
      div.coupon-card-info
        div.coupon-card-store         店名（主標）
        div.coupon-card-discount      折扣摘要
        div.coupon-card-expiry        效期（null -> 「效期：依券面」）
        div.coupon-card-badges
          span.coupon-card-badge-passport   「需護照」（passport=true 時出現）
          span.coupon-card-badge-area       「⚠ {area}」（area 非空時出現）
        div.coupon-card-notes         注意事項小字
p.coupons-error                       COUPONS 缺/空時顯示
```

### onShow 冪等

- 首次 onShow 建 DOM；之後 onShow 為 no-op（保留使用者捲動位置）。
- 比照 trip-tab.js `_initialized` 模式。

---

## 6. Frontend Script 標籤與載入順序

index.html 在 `<!-- Task5-6 功能模組插這裡，在 trip-tab.js 之後、</body> 之前 -->` 後插入：

```html
<!-- Task4 功能模組（coupon-viewer 須在 coupons-tab 之前，O1 wrap 依賴）-->
<script src="./js/coupon-viewer.js"></script>
<script src="./js/coupons-tab.js"></script>
```

**順序限制**：
- `coupon-viewer.js` 必須在 `coupons-tab.js` 之前（後者呼叫 `App.openCouponViewer`）
- 兩者都必須在 `bigtext.js` 之後（coupon-viewer.js 的 O1 wrap 疊在 bigtext wrap 之上）
- 已保證：trip-tab.js（現在最後）→ coupon-viewer.js → coupons-tab.js

---

## 7. sw.js PRECACHE 新增（Task4）

```
CACHE_VERSION: v5（資料收斂 bump：移除 drugeleven/kintetsu 兩筆 + cosmos 修正）
現存 18 筆（coupon 相關）：
  ./js/coupon-viewer.js
  ./js/coupons-tab.js
  ./img/coupons/biccamera.jpg
  ./img/coupons/laox.jpg
  ./img/coupons/cosmos.jpg
  ./img/coupons/tsuruha.jpg
  ./img/coupons/sundrug.jpg
  ./img/coupons/satudora.jpg
  ./img/coupons/edion.jpg
  ./img/coupons/donki.jpg
  ./img/coupons/keio.jpg
  ./img/coupons/seibu-sogo.jpg
  ./img/coupons/odakyu.jpg
  ./img/coupons/daimaru.jpg
  ./img/coupons/alpen.jpg
  ./img/coupons/victoria.jpg
  ./img/coupons/lotte-ginza.jpg
  ./img/coupons/japandutyfree.jpg
```

**DevTools Cache 驗查指令**（供 QA 機械驗證）：

```js
// DevTools Console → Application → Cache Storage
// 或執行：
caches.open('tokyo-trip-v5').then(c => c.keys()).then(ks => {
  var couponKeys = ks.filter(k => k.url.includes('img/coupons'));
  console.log('coupon images in cache:', couponKeys.length, '/ expected: 16');
  console.log(couponKeys.map(k => k.url.split('/').pop()).sort());
});
```

---

## 8. 多 overlay 紀律（O1–O4）——Task5/6 繼承必讀

**所有後續 Task 在加入新 overlay 時必須遵守以下四條。**

| # | 紀律 | 說明 |
|---|------|------|
| O1 | **Additive wrap App.showTab** | 每個 overlay 模組載入時捕獲當前 `App.showTab`，wrap = 關自己（未開 no-op）→ 必須呼叫捕獲的前層函式並原樣回傳。禁止覆蓋不 call-through。切分頁時觸發順序（由後往前 wrap 解開）：coupon-viewer 關檢視器 → bigtext 關大字 → app.js 原函式切頁。 |
| O2 | **同時最多一個 overlay，互斥責任在「開啟方」** | 若某分頁要在已有 overlay 時再開另一個，開啟方必須先明確關前一個。bigtext.js 目前**無公開 close API**——若 Task6 需要「先關大字再開相機預覽」，屆時補 API 並回報 PM，不得偷改 bigtext.js。 |
| O3 | **z-index 分帶** | 導覽列 10 / bigtext-overlay 100 / coupon-viewer 110 / Task5/6 新 overlay 從 120 起跳。 |
| O4 | **捲動鎖各自為政、只鎖自己** | 各 overlay 在自身背景層掛 `touchmove.preventDefault()`；手勢目標元素的事件 `stopPropagation()`，不被背景鎖吃掉。 |

**viewport 注意**：本 repo viewport 無 `user-scalable=no`。各 overlay 若有 pinch 手勢，開啟時自行以 `gesturestart + 雙指 touchstart` preventDefault 抑制 Safari 頁面縮放，關閉時解除。**不得改全域 viewport meta**。

---

## 9. localStorage 登記

Task4 零 key。`tokyotrip.lastTab`（Task3.api.md A8 既有登記）記住 lastTab，切到 coupons 分頁即更新為 `"coupons"`，行為正常。
