# Task21.api.md — 民宿入住資訊 backend 介面文件

> backend 定案輸出。供 frontend（CSS）、QA 使用。
> 定案後 DOM class 名不得擅自更改；需異動回報 PM 另開 Task。
> 本檔所有範例值均為明顯假值（TEST 前綴 / testpassword / 000-000-0000）。

---

## 1. `lodging` key schema（匯入碼 JSON 第五個 top-level key）

```json
{
  "lodging": {
    "name":         "TEST 民宿名稱",
    "room":         "TEST-000",
    "addressZh":    "測試市測試區測試路 0 號",
    "addressEn":    "0-0-0 Testcho, Testku, Tokyo 000-0000, Japan",
    "entranceCode": "TEST0000",
    "roomCode":     "TEST1111",
    "checkinTime":  "15:00",
    "checkoutTime": "10:00",
    "selfCheckin":  "無人櫃檯，直接到房門口輸入房間密碼即可進房。\n外出務必帶好手機。",
    "wifi": [
      { "floor": "1F", "ssid": "TEST-WIFI-1F", "password": "testpassword1" },
      { "floor": "2F", "ssid": "TEST-WIFI-2F", "password": "testpassword2" },
      { "floor": "3F", "ssid": "TEST-WIFI-3F", "password": "testpassword3" },
      { "floor": "4F", "ssid": "TEST-WIFI-4F", "password": "testpassword4" }
    ],
    "notes": [
      "垃圾請依可燃／不可燃分類，丟到五樓屋頂的垃圾區。",
      "備品（毛巾、盥洗用品）放在測試位置。"
    ],
    "hostContacts": [
      { "name": "Test Taro",  "tel": "000-000-0000" },
      { "name": "Test Hanako", "tel": "000-000-0001" }
    ]
  }
}
```

### 契約精神
- **全欄位選填**：任何欄位缺失不得讓渲染崩掉，缺什麼就不渲染該行/小節。
- **型別防禦**：`wifi`/`notes`/`hostContacts` 非陣列→該小節不渲染；`lodging` 非物件（null/字串/陣列）→視同未提供，顯示 B6 提示。
- **既有四 key 零變更**：`passports`/`insurance`/`bookings`/`contacts` 逐位元零 diff。
- **`import-data.js` 零 diff 已由 SA 核實**（C9 解除）——`parseImportCode` 對 top-level key 無白名單，新 key 天然通過。

---

## 2. DOM 結構與 class 名

`_renderLodgingBlock()` 在 `.trip-lodging` 容器內每次清空整塊重建（天然冪等）。

```
div.trip-lodging                          ← buildHotelSection 恆建立的容器（早退/正常路徑各一次）

  ── B6 空狀態（三種之一）：
  p.trip-lodging-empty

  ── B3 已匯入狀態（有 lodging 物件）：
  h3.trip-lodging-title                   ← 「民宿入住資訊」

  div.trip-lodging-name-row               ← § B3-1（name/room 有值才渲染）
    span.trip-lodging-name
    span.trip-lodging-room

  div.trip-lodging-dates                  ← § B3-2（checkinTime/checkoutTime 有值才渲染）

  div.trip-lodging-section                ← § B3-3 門鎖密碼
    h4.trip-lodging-section-title
    div.trip-lodging-row                  ← 一樓入口（+複製鈕）
      span.trip-lodging-row-label
      span.trip-lodging-row-value
      button.trip-lodging-copy-btn
    div.trip-lodging-row                  ← 房間（+複製鈕）

  div.trip-lodging-section                ← § B3-4 自助入住
    h4.trip-lodging-section-title
    p.trip-lodging-selfcheckin            ← white-space:pre-wrap（\n 換行）

  div.trip-lodging-section                ← § B3-5 地址（showZh/showEn 有值才渲染）
    h4.trip-lodging-section-title
    div.trip-lodging-row                  ← 中文地址（+複製鈕；§A4 去重才渲染）
    div.trip-lodging-row                  ← 英文地址（+複製鈕）

  div.trip-lodging-section                ← § B3-6 WiFi（wifi 非空陣列才渲染）
    h4.trip-lodging-section-title
    div.trip-lodging-wifi-entry           ← 每樓層一張卡
      div.trip-lodging-wifi-floor         ← 樓層標示（如「1F」）
      div.trip-lodging-row                ← SSID（+複製鈕；有值才渲染）
      div.trip-lodging-row                ← 密碼（+複製鈕；有值才渲染）

  div.trip-lodging-section                ← § B3-7 住宿須知（notes 非空才渲染）
    h4.trip-lodging-section-title
    ul.trip-lodging-notes
      li.trip-lodging-note-item

  div.trip-lodging-section                ← § B3-8 房東聯絡電話（hostContacts 非空才渲染）
    h4.trip-lodging-section-title
    div.trip-lodging-host-row             ← 每筆聯絡人
      span.trip-lodging-host-name
      a.trip-lodging-host-tel[href="tel:…"]   ← 無 tel 欄位時不渲染
```

---

## 3. `_renderLodgingBlock()` 三個呼叫點（M4 機械判準依據）

| # | 行號（目前） | 位置 | 覆蓋的 runtime 時機 |
|---|-------------|------|---------------------|
| 1 | L942 | `clearBtn` click handler（在 `_renderPrivateSection()` 之後） | 清除後 |
| 2 | L998 | `_buildImportArea` `confirmBtn` click handler（在 `_renderPrivateSection()` 之後） | **首次匯入＋重新匯入**（`_buildImportArea` 被實例化兩次）|
| 3 | L1026 | `buildImportantSection` 函式體（在 `_renderPrivateSection()` 之後） | init 首繪 |

> **QA 注意**：3 個 lexical 點對應 4 個 runtime 時機（#2 覆蓋兩個）。不得誤找「第四個呼叫點」。

---

## 4. 陷阱記錄

### A1（SA 硬約束）：`_renderLodgingBlock()` 禁寫進 `_renderPrivateSection()` 函式體內

`_renderPrivateSection()` L765–770 的 `isAvailable()===false` 分支在 L770 就 `return`，寫在函式尾端的呼叫永遠執行不到，會讓降級路徑產生空白區塊（spec §B6 明文禁止）。

**機械判準 M1**：`_renderPrivateSection` 函式體（L753–782）內 `_renderLodgingBlock` 出現次數 = 0。✅ 已落地。

### A2（SA 硬約束）：`.trip-lodging` 容器在 `buildHotelSection` 兩條路徑均建立

`buildHotelSection` L366-374（早退路徑）：`sec.innerHTML` 賦值後立即建立容器並 append。
`buildHotelSection` L467-470（正常路徑）：`data.hotels.forEach` 迴圈後建立容器。

兩處都必須在 `sec.innerHTML` 賦值之後（innerHTML 賦值會清空既有子節點）。

**機械判準 M2**：`window.TRIP = undefined` 模擬缺載 → 飯店區塊顯示載入失敗，`.trip-lodging` 容器仍存在並正常渲染。✅ 已落地。

---

## 5. Frontend CSS 注意事項

- 新 class 一律 `.trip-lodging-*`（命名空間全 repo 零衝突，SA 已機械確認）。
- 值欄位 `.trip-lodging-row-value` 必用 **`overflow-wrap: anywhere`**（不可換 `break-word`——只有 `anywhere` 影響 flex min-content 計算）。
- 標籤欄 `.trip-lodging-row-label`：`flex-shrink:0`、`width:auto`、`min-width:56px`、`max-width:100%`（不得固定寬）。
- 複製鈕 `.trip-lodging-copy-btn`：另立輕量 class，不沿用 `.trip-btn`（SA §3.3 已算出 390px 下換行＋視覺過重）；`min-height: 44px`；accent tint 背景。
- `.trip-lodging-selfcheckin`：`white-space: pre-wrap`。
- 字級：`var(--fs-*)` 五階（SA 裁定，G4-16 已作廢）；`.trip-lodging-title` = `var(--fs-lg)`（= 19px）。
- 禁改 `.trip-private-*` 與 `.trip-hotel-*` 任何既有規則。
- 禁加 `z-index >= 100`；accent 當文字用一律 `var(--c-accent-text)`。

---

## 6. 複製鈕文案（與飯店卡逐字一致）

- 鈕文字：`複製`
- 成功：`已複製！`
- 失敗：`請手動長按複製`

---

## 7. B6 空狀態文案（class `.trip-lodging-empty`）

| 狀態 | 文案 |
|------|------|
| localStorage 不可用 | `此環境無法讀取住宿資訊，請在加入主畫面後的 APP 內操作（Safari 分頁與 APP 的資料不互通）。` |
| 未匯入 or lodging 缺/非物件 | `尚未匯入住宿資訊。請到「行程 → 重要資料」貼上匯入碼，門鎖密碼與 WiFi 會顯示在這裡。` |

---

## 8. 版本

Task21 bump：`js/version.js` APP_VERSION = `'v21'`、APP_VERSION_DATE = `'07/20'`；`sw.js` CACHE_VERSION = `'v21'`。PRECACHE_URLS 42 筆零增減。
