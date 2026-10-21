# Task32 API：匯入碼新 key 與覆蓋渲染介面（backend → frontend／QA）

> 2026-10-21 backend。依據 `specs/Task32.spec.md` v1.4 與 `specs/Task32.impact.md`。本檔為三個新 key 的 schema 權威。
> 個資：本檔範例一律假值（航班號 `ZZ` 開頭），不含任何真實航班、訂位代號、姓名、保單號、電話。

## 1. 匯入碼新 key（皆選填、皆 top-level；`js/import-data.js` 零 diff，新 key 原樣存入 localStorage）

### 1.1 `flights`

- 型別：陣列；元素 `{ label, airline, flightNo, date, from: { airport, terminal, time }, to: { airport, terminal, time }, note }`，全欄選填、字串。
- 有效＝陣列且至少 1 個「物件且非陣列」元素 → 只以這些物件元素**整組取代**公開層航班卡（順序照匯入碼，公開層一張都不混入）。
- 無效（無 key、非陣列、空陣列、全非物件）→ 公開層 `window.TRIP.flights`（v28 行為）。
- 防禦：非字串欄位一律當空字串；`from`／`to` 非物件視同未提供。整段為空時不輸出該 DOM 區塊：
  - `airline`／`flightNo`／`date` 皆空 → 不輸出 `.trip-flight-info`
  - `from`、`to` 三欄皆空 → 不輸出 `.trip-flight-route`
  - `note` 空 → 不輸出 `.trip-flight-note`（同 v28）
  - 因此佔位卡 `{ "label": "回程", "note": "回程航班待確認" }` 只顯示標籤與備註。
- 公開層資料欄位齊全，走同一渲染器，輸出與 v28 逐字相同。

```json
{
  "flights": [
    { "label": "去程", "airline": "假航空", "flightNo": "ZZ901", "date": "2026/10/22（四）",
      "from": { "airport": "台北桃園", "terminal": "T2", "time": "07:00" },
      "to":   { "airport": "東京羽田", "terminal": "T3", "time": "11:00" },
      "note": "假資料，僅供測試" },
    { "label": "回程", "note": "回程航班待確認" }
  ]
}
```

### 1.2 `itineraryDays`

- 型別：陣列；元素 `{ isoDate: "YYYY-MM-DD", theme?: 字串, items: [ { time?, title?, detail? } ] }`。
- 逐筆有效判定：物件、`isoDate` 為字串且對上公開層某天、`items` 為陣列；`items` 內非物件略過。同一 `isoDate` 取第一筆有效者；無效／對不上的元素靜默略過。
- 對上的那天：單日層內容整天以 `items` 取代（空陣列 → 「本日無排定行程」）；`theme` 為**非空字串**才取代總覽日卡與單日層主題字（SA 技術裁定），否則沿用公開層。
- 天數、Day 標籤、日期、「今天」定位、前後天切換一律照公開層。地圖分頁日期頭仍讀公開 theme（不 mutate `window.TRIP`）。

```json
{
  "itineraryDays": [
    { "isoDate": "2026-10-25", "theme": "假主題", "items": [ { "time": "09:00", "title": "假項目", "detail": "第一行\n第二行" } ] }
  ]
}
```

### 1.3 `importantOverrides`

- 型別：陣列；元素 `{ match: 字串, label?: 字串, value?: 字串, tel?: 字串 }`。
- 有效元素＝物件、`match` 為 trim 後非空字串；其他略過。
- 比對：公開層 `important[].label` trim 後與 `match` trim 後**完全相等**（不做部分比對）；同列取第一個有效命中元素；對不上不新增列。
- `label`、`value` 任一為非空字串 → **原位取代**，欄位全部取自元素（缺的為空字串，不沿用原列）；`tel` 為非空字串才渲染 `tel:` 連結。
- `label`、`value` 皆缺或空 → 該列**隱藏**。
- 全部隱藏 → 留空 `ul.trip-important-list`，不顯示「緊急電話資料載入失敗」（該訊息只給公開層缺載）。
- 沿用既有 `.trip-important-item`／`-label`／`-value`／`-tel` class，字串一律 `textContent`。無提示行、無新 CSS。

```json
{
  "importantOverrides": [
    { "match": "樂桃報到提醒", "label": "假航空報到提醒", "value": "假資料：起飛前 2 小時抵達第 9 航廈" }
  ]
}
```

## 2. 給 frontend：提示行 DOM 與 class

| 位置 | DOM | 文案（逐字） | 出現條件 |
|---|---|---|---|
| 航班 section `#trip-sec-flights` 第一個子元素（第一張 `.trip-flight-card` 之前） | `<p class="trip-override-hint">` | 以下為你匯入的航班 | 使用本機層 `flights` |
| 單日層 `.trip-itin-day-content` 第一個子元素（在 `.trip-item` 或 `.trip-itin-day-empty` 之前） | `<p class="trip-override-hint">` | 本日行程依你匯入的資料顯示 | 該天使用本機層 `itineraryDays` |

- 單一 class `trip-override-hint`，兩處共用；`textContent` 寫入。退回公開層時不產生該元素（v28 DOM 零差異）。
- 樣式由 frontend 加在 `css/style.css`（見 `specs/Task32.impact.md` Frontend 注意事項 1–2）。航班區提示行為 section 直接子元素，與 `.trip-flight-card`（margin 14px 12px 0）並列，左右邊距需自行對齊；單日層提示行在 `.trip-itin-day-content` 內。
- 冒煙 T32-7 驗 `css/style.css` 含 `.trip-override-hint`；frontend 完成前印 SKIP（不計入 PASS），QA 時必須 PASS。

## 3. `js/trip-tab.js` 函式（皆為 IIFE 內部，不對外暴露）

| 函式 | 作用 |
|---|---|
| `_getPrivateObj()` | 本機層讀取 helper：`App.privateData` 存在、`isAvailable()` 為真、`get()` 為物件非陣列才回傳，否則 null；外包 try/catch |
| `_getEffectiveFlights()` | 回 `{ list, overridden }`；兩層皆無效時 `list` 為 null |
| `_getEffectiveDay(dayIdx)` | 回新物件 `{ day, isoDate, theme, items, overridden }`，不 mutate `_itinData` |
| `_getEffectiveImportant(list)` | 回取代／隱藏後的新陣列；無有效 override 時回原陣列（DOM 同 v28） |
| `_buildOverrideHint(text)` | 建 `p.trip-override-hint` |
| `_renderFlights()` | 重繪航班 section（保留 section 元素、只換子節點、不動 `hidden`）；兩層皆無效才顯示「航班資料載入失敗」 |
| `_renderItineraryOverride()` | 依 `dataset.dayIdx` 更新總覽 `.trip-ov-day-theme`；`_itinView` 為數字時只重繪該天 `_renderDayContent`，不切視圖、不捲動 |
| `_renderImportantPublic()` | 重繪重要資料公開段 wrap |
| `_renderImportOverrides()` | 包裝：依序呼叫上面三個重繪 |

## 4. 重繪呼叫點（privateData 渲染目標 5 個：既有 2＋本 Task 3）

| 呼叫點 | 位置（`js/trip-tab.js`） | 說明 |
|---|---|---|
| clearBtn | L1106 `_renderImportOverrides();` | 緊接 `_renderLodgingBlock();` 之後 |
| confirmBtn | L1163 `_renderImportOverrides();` | 緊接 `_renderLodgingBlock();` 之後；覆蓋首次匯入＋重新匯入兩時機 |
| init 首繪 | `buildFlightsSection`／`buildItinerarySection`（總覽主題字＋今日直進的單日層）／`buildImportantPublicList` 內各自完成 | 不在 Task21 呼叫點 3 加呼叫 |

- `_renderLodgingBlock()` 呼叫數仍為 3（冒煙 M4）；`_renderPrivateSection()` 函式體未改（M1）。
- `js/import-data.js`、`js/tripdata.js`、`js/mapdata.js` 零 diff；PRECACHE 零增減（44）。

## 5. 版號

v28 → v29（`js/version.js` `APP_VERSION`／`APP_VERSION_DATE` = `10/21`，`sw.js` `CACHE_VERSION`）。
