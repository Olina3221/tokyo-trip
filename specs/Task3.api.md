# Task3.api.md — trip 分頁、匯入碼契約、App.privateData 介面

> Backend 定案輸出。供 frontend（Task3 UI）、QA、未來電腦端匯入碼生成器使用。
> 定案後簽名不得擅自更改；需異動回報 PM 另開 Task。

---

## 1. window.TRIP 最終 schema（js/tripdata.js）

```js
window.TRIP = {
  flights: [
    {
      label:    string,               // 「去程」/「回程」
      airline:  string,               // 航空公司名稱
      flightNo: string,               // 班號（如「MM626」）
      date:     string,               // 「2026/07/21（二）」
      from: { airport: string, terminal: string, time: string },
      to:   { airport: string, terminal: string, time: string },
      note:     string,               // 報到提醒等
    }
  ],
  hotels: [
    {
      name:       string,             // 飯店名稱
      checkin:    string,             // 「2026/07/21」
      checkout:   string,             // 「2026/07/25 08:30」
      address_ja: string,             // 日文地址（給司機／bigtext 用）
      address_zh: string,             // 中文地址
      tel:        string,             // 飯店電話（公開；格式如「+81-90-XXXX-XXXX」）
      note:       string,             // 公開備注，禁止含訂房姓名
    }
  ],
  itinerary: [
    {
      day:     string,                // 「Day 1」
      isoDate: string,                // 「2026-07-21」（用於預設定位當日，B8）
      theme:   string,                // 當日主題
      items: [
        {
          time:   string,             // 「10:50」或空字串
          title:  string,             // 項目標題
          detail: string,             // 展開詳情，\n 換行；可為空字串
        }
      ]
    }
  ],
  important: [
    {
      label: string,                  // 顯示標籤
      value: string,                  // 顯示值
      tel:   string | undefined,      // 有值時 frontend 渲染為 tel: 連結
    }
  ],
};
```

### schema 決策說明

- `members` 欄位已移除（spec B5，Task4 不依賴）。
- `itinerary.isoDate`（backend 補充欄位）：供「預設定位當日」邏輯使用，格式 `YYYY-MM-DD`；不影響既有契約。
- `flights.from / to` 為物件（`{ airport, terminal, time }`），提供比純字串更結構化的渲染來源。
- `window.COUPONS` 在同檔，原樣保留不動（Task4 依賴）。

---

## 2. 匯入碼格式權威定義（B1）

### 格式

```
TT1.<base64(UTF-8 JSON)>
```

- 前綴 `TT1.` 為版本標識與格式錨點。
- `base64` 為**標準 base64**（字符集 `A-Za-z0-9+/`，`=` padding）。

### 電腦端生成器實作須知（repo 外交付物唯一依據）

```
1. JSON 序列化（key 順序不限，可含空白）
2. UTF-8 encode → bytes
3. 標準 base64 encode（含 = padding）
4. 加前綴：「TT1.」+ base64 字串
```

Python 範例：
```python
import base64, json
data = { "passports": [...], ... }
code = "TT1." + base64.b64encode(json.dumps(data, ensure_ascii=False).encode("utf-8")).decode()
```

### 解析端容錯（APP 端已實作）

- 去除輸入字串的**全部** whitespace（換行、空格、Tab）後再解析。
- 自動容忍 URL-safe 變體：`-` → `+`、`_` → `/`、補缺 `=` padding。
- 任一步驟（base64 解碼 / TextDecoder / JSON.parse）失敗 → 回報錯誤文案，不動既有資料。

### 匯入碼 JSON schema（全欄位選填，未知欄位忽略）

```json
{
  "passports": [ { "name": "稱謂", "number": "護照號" } ],
  "insurance": { "company": "保險公司", "policy": "保單號", "tel": "緊急電話" },
  "bookings":  [ { "label": "訂位描述", "value": "訂位代號" } ],
  "contacts":  [ { "label": "稱謂", "tel": "電話" } ]
}
```

---

## 3. QA 假資料測試匯入碼（含中文值，驗 TextDecoder 路徑）

### 測試碼

```
TT1.eyJwYXNzcG9ydHMiOlt7Im5hbWUiOiLlqpLlqpIiLCJudW1iZXIiOiJURVNUMDAwMDAxIn0seyJuYW1lIjoi54i154i1IiwibnVtYmVyIjoiVEVTVDAwMDAwMiJ9XSwiaW5zdXJhbmNlIjp7ImNvbXBhbnkiOiLmuKzoqabkv53pmqrlhazlj7giLCJwb2xpY3kiOiJURVNULVBPTElDWS0wMDEiLCJ0ZWwiOiIwODAwLTAwMC0wMDAifSwiYm9va2luZ3MiOlt7ImxhYmVsIjoi5qiC5qGD6KiC5L2N77yI5ris6Kmm77yJIiwidmFsdWUiOiJURVNUQUIifV0sImNvbnRhY3RzIjpbeyJsYWJlbCI6IuWPsOeBo+e3iuaApeiBr+e1oeS6uu+8iOa4rOippu+8iSIsInRlbCI6IjA5MTItMDAwLTAwMCJ9XX0=
```

### 解碼後 JSON（供 QA 對照驗證）

```json
{
  "passports": [
    { "name": "媒媒", "number": "TEST000001" },
    { "name": "爵爵", "number": "TEST000002" }
  ],
  "insurance": {
    "company": "測試保險公司",
    "policy":  "TEST-POLICY-001",
    "tel":     "0800-000-000"
  },
  "bookings": [
    { "label": "樂桃訂位（測試）", "value": "TESTAB" }
  ],
  "contacts": [
    { "label": "台灣緊急聯絡人（測試）", "tel": "0912-000-000" }
  ]
}
```

- 所有值均為明顯假值（TEST 開頭 / 000-000-000 電話）。
- 含「媒媒」「爵爵」「測試保險公司」「樂桃訂位（測試）」等中文，驗證 TextDecoder UTF-8 路徑。
- `bookings[0].value = "TESTAB"`（6 字元英數但前四字元為 TEST，明顯非真值）。

---

## 4. App.privateData 介面（js/import-data.js）

掛在全域 `window.App.privateData`。

### App.privateData.get()

```js
App.privateData.get()
// 回傳：已解析的 JSON 物件（object）；無資料或解析失敗回傳 null
```

### App.privateData.getRawCode()

```js
App.privateData.getRawCode()
// 回傳：localStorage 儲存的原始匯入碼字串（string）；無資料回傳 null
// 用途：匯出顯示
```

### App.privateData.save(importCode)

```js
App.privateData.save(importCode)
// importCode：使用者貼入的原始字串（含換行、前後空白均可）
// 回傳：{ ok: true, data: object }   成功，data 為解析後物件
//       { ok: false, error: string }  失敗，error 為使用者可讀錯誤文案
// 失敗時不動既有 localStorage 資料
```

### App.privateData.clear()

```js
App.privateData.clear()
// 只執行 localStorage.removeItem('tokyotrip.privateData')
// 禁用 localStorage.clear()（保護 tokyotrip.lastTab 與 Task4 折價券狀態）
// 回傳：boolean（true 成功；false 例外）
```

### App.privateData.isAvailable()

```js
App.privateData.isAvailable()
// 回傳：boolean，localStorage 是否可用（Safari 無痕等場景回傳 false）
```

---

## 5. trip-tab.js DOM 結構與 class 名

frontend 負責 CSS 樣式；backend 保證 class 名穩定。

```
#tab-trip
  div.trip-container
    div.trip-pills[role=tablist]
      button.trip-pill(.active)[role=tab][aria-selected][data-section-id]  × 4
    div.trip-section#trip-sec-itinerary
      div.trip-day-card[data-iso-date]
        div.trip-day-header[role=button][aria-expanded]
          span.trip-day-label
          span.trip-day-date
          span.trip-day-theme
          span.trip-day-chevron
        div.trip-day-body[hidden?]
          div.trip-item
            div.trip-item-header[role=button][aria-expanded]
              span.trip-item-time
              span.trip-item-title
              span.trip-item-chevron          ← 僅 detail 有值時存在
            div.trip-item-detail[hidden?]     ← 僅 detail 有值時存在
    div.trip-section#trip-sec-flights[hidden?]
      div.trip-flight-card
        div.trip-flight-label
        div.trip-flight-info
          span.trip-flight-no
          span.trip-flight-date
        div.trip-flight-route
          div.trip-flight-from
            span.trip-flight-arrow-label
            span.trip-flight-endpoint
          div.trip-flight-arrow
          div.trip-flight-to
            (同 from)
        div.trip-flight-note
    div.trip-section#trip-sec-hotel[hidden?]
      div.trip-hotel-card
        div.trip-hotel-name
        div.trip-hotel-dates
          span.trip-hotel-checkin
          span.trip-hotel-sep
          span.trip-hotel-checkout
        div.trip-hotel-address-ja.bigtext-addressline   ← B7 長地址用
        div.trip-hotel-address-zh
        div.trip-hotel-tel
          a[href="tel:…"]
        div.trip-hotel-note
        div.trip-hotel-actions
          button.trip-btn.trip-btn-copy       ← 複製地址
          a.trip-btn.trip-btn-map[target=_blank]  ← 開地圖（外部，含「↗ 離開 APP」文字）
          button.trip-btn.trip-btn-bigtext    ← 大字給司機看
    div.trip-section#trip-sec-important[hidden?]
      h3.trip-section-title                  ← 「緊急電話」
      div.trip-important-public
        ul.trip-important-list
          li.trip-important-item
            span.trip-important-label
            a.trip-important-tel[href="tel:…"]  ← 有 tel 欄位時
            span.trip-important-value           ← 無 tel 時
      div.trip-private-section
        h3.trip-private-title                ← 「本機私人資料」
        ── 不可用狀態：
        p.trip-private-unavail
        ── 空狀態：
        p.trip-private-info
        button.trip-btn.trip-btn-import      ← [匯入]
        div.trip-import-area[hidden?]
          p.trip-import-hint
          textarea.trip-import-textarea
          button.trip-btn.trip-btn-confirm
          p.trip-import-error[hidden?]
        ── 已匯入狀態：
        div.trip-private-fields
          h4.trip-private-section-title      ← 「護照」/「旅遊保險」等
          div.trip-private-row
            span.trip-private-row-label
            span.trip-private-row-value
              a[href="tel:…"]                ← 電話欄位
        div.trip-private-actions
          button.trip-btn.trip-btn-reimport
          button.trip-btn.trip-btn-export
          button.trip-btn.trip-btn-clear
        div.trip-export-area[hidden?]
          p.trip-export-note
          textarea.trip-export-textarea[readonly]
          button.trip-btn.trip-btn-copy
        div.trip-import-area[hidden?]        ← 重新匯入區，同空狀態結構
  span.trip-tip                              ← 暫時提示（動態插入）
```

---

## 6. onShow 狀態策略（B6）

- `_initialized` 旗標：首次 `onShow` 執行 `init()`，之後的 `onShow` 為 no-op。
- `init()` 建 DOM、綁事件、呼叫 `_renderPrivateSection()` 一次。
- `_renderPrivateSection()` 重繪 `.trip-private-section` 內容，僅在以下時機呼叫：
  - `init()`（首次）
  - 匯入成功（save 回傳 ok:true）
  - 清除成功（clear 後）
- 切走再切回（onShow 重觸發）：不重建 DOM，使用者的展開狀態、子 pill 選擇、輸入中的 textarea 均保留。

---

## 7. 預設定位當日（B8）

- 取裝置本地日期（`new Date()`）的 YYYY-MM-DD 字串。
- 與 `itinerary[].isoDate` 比對；命中則展開對應日卡（aria-expanded=true，body.hidden=false）。
- 若無命中（行程前後或非行程期間）→ 展開 Day1（`itinerary[0]`）。
- 所有日卡預設收合，僅展開一日；使用者可手動再展開其他日卡。
- 不做時區處理（台日時差 1 小時、粒度為「日」，誤差窗口僅深夜 23–24 時，不值得處理）。

---

## 8. localStorage key 登記與 clear 紀律（B2）

| Key                       | 建立者       | 清除者                    |
|---------------------------|--------------|---------------------------|
| `tokyotrip.lastTab`       | app.js       | 不清（由 app.js 管理）    |
| `tokyotrip.privateData`   | import-data.js | `App.privateData.clear()` 只刪此 key |
| （Task4 折價券，待定）     | Task4        | Task4 只刪自己的 key      |

**全模組禁用 `localStorage.clear()`**（會誤殺同 namespace 的所有 key）。

---

## 9. frontend 需加入的 script 標籤（index.html）

在 `phrases-tab.js` 之後、`</body>` 之前，依序加入：

```html
<!-- Task3 功能模組（順序定死：import-data 必須在 trip-tab 之前）-->
<script src="./js/import-data.js"></script>
<script src="./js/trip-tab.js"></script>
```

**載入順序邏輯（不得更動）：**
1. `import-data.js` — 定義 `App.privateData`；trip-tab.js 呼叫 `App.privateData.get()`，須先定義。
2. `trip-tab.js` — 呼叫 `App.registerTab('trip', ...)`、`App.showBigText`、`App.privateData.*`，須在兩者之後。

---

## 10. sw.js 版本

Task3 後：`CACHE_VERSION = 'v3'`

PRECACHE_URLS 新增：
- `./js/import-data.js`
- `./js/trip-tab.js`

`tripdata.js` 檔名不變但內容全換，靠 `CACHE_VERSION` bump 強制使用者取新版。
