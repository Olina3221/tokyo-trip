# Task21 — 民宿入住資訊（本機層 lodging）

> PM spec。行為權威。SA/backend/frontend/QA 依本檔執行。
> 前次最新 Task = Task20（已閉環，sw.js/version.js 現況 v20）。

---

## 模組：行程分頁 → 飯店區塊 → 民宿入住資訊（本機私密層）

### 功能描述

在「飯店」藥丸底下、現有 MAPLEHOUSE 卡片下方，新增一個「民宿入住資訊」區塊，顯示自助入住須知、門鎖密碼、四層 WiFi、住宿須知與房東電話，資料一律來自本機層匯入碼（`tokyotrip.privateData` 的新 key `lodging`），**不進 `js/tripdata.js`**。目的是讓同行家人各自在自己手機的 APP 上就能讀到入住須知與密碼，不必問 Olina。

---

### 背景與已拍板決策（不重議）

給冷 context 下游的最小背景。以下為 Olina 已拍板方向，SA/backend/frontend **不得重開討論**；有疑慮記入回報交 PM，不自行改走別條路。

**已完成（現況）**
- Task3 建立本機層機制：匯入碼格式 `TT1.<base64(UTF-8 JSON)>`（權威 `Task3.api.md` §2）、`App.privateData`（get/getRawCode/save/clear/isAvailable，`js/import-data.js`）、既有四個 top-level key `passports` / `insurance` / `bookings` / `contacts`。目前 `App.privateData` 的**唯一消費者是「重要資料」藥丸底下的 `.trip-private-section`**。
- Task20 修過 `.trip-private-row` 的「標籤寬度是資料驅動」重疊 bug，現為自適應雙模式排版（SYSTEM_MAP 第 103 行）。
- 公開層 `window.TRIP.hotels[0]` 已有 MAPLEHOUSE 淺草的 `name` / `checkin` / `checkout` / `address_ja` / `address_zh` / `tel` / `note`，飯店卡已有「複製地址 / 開地圖 / 大字給司機看」三顆鈕。

**已拍板（Olina）**
1. **資料分層：本輪全部內容走本機層匯入碼，一律不進 `js/tripdata.js`。**
   理由：內容含一樓入口門鎖密碼、房間門鎖密碼、四個樓層 WiFi 密碼、房東私人電話，而 `tripdata.js` 會公開部署到 GitHub Pages，違反 repo 級隱私硬約束（SYSTEM_MAP 第 83 行：**個資真值在任何 tracked 檔＝FAIL**）。連入住／退房時間、垃圾分類等純須知也一併放本機層——刻意不拆成公開／私密兩塊，避免家人站在門口還要跳頁找密碼。
2. **顯示位置：飯店藥丸底下、MAPLEHOUSE 卡片下方**，不是「重要資料」藥丸。
   → 這是本輪最大的架構變化：`buildHotelSection()` 開始消費 `App.privateData.get()`。在此之前 `App.privateData` 只被「重要資料」區塊消費（Task3 設計，SYSTEM_MAP 第 89 行「trip 分頁專用、非跨 Task 共用元件」的語意本輪擴大為「trip 分頁內兩個區塊共用」——**由本 spec 正當解除該行的單一消費者假設**，SA 須同步更新 SYSTEM_MAP）。
3. **既有四個 key 的 schema 零變更**（硬約束）。本輪只 additive 新增第五個 top-level key。

---

### 涉及範圍

- [x] 後端／核心邏輯：`js/trip-tab.js`（`buildHotelSection` 擴充＋新 `_renderLodgingBlock()`＋三個既有重繪呼叫點 additive 追加）、`sw.js` / `js/version.js` bump v20→v21。**backend 必寫 `Task21.api.md`**（新 DOM 結構與 class 名交 frontend）。
- [x] 前端／UI：`css/style.css` 新增 `.trip-lodging-*` 樣式節。
- 不需改 `js/import-data.js`（它只做 base64→JSON.parse，對 top-level key 無白名單，新 key 天然通過——**backend 須實際確認此點**，若有白名單則屬本輪範圍）。
- 不需改 `js/tripdata.js`（零 diff，硬約束）。
- PRECACHE_URLS 筆數零增減（無新檔），維持 42 筆。

---

## A. 匯入碼 JSON schema 擴充

### A1. 新增 top-level key：`lodging`（物件，非陣列）

命名定案 `lodging`（PM 定案）：與既有四個 key 同為小寫英文名詞；不用 `hotel` 以免與公開層 `TRIP.hotels` 混淆——一個是公開飯店卡、一個是私密入住資訊，命名分開可讓冷 context 讀者一眼分辨。

```json
{
  "passports": [ ... ],
  "insurance": { ... },
  "bookings":  [ ... ],
  "contacts":  [ ... ],
  "lodging": {
    "name":         "TEST 民宿名稱",
    "room":         "TEST-000",
    "addressZh":    "測試市測試區測試路 0 號",
    "addressEn":    "0-0-0 Testcho, Testku, Tokyo 000-0000, Japan",
    "entranceCode": "TEST0000",
    "roomCode":     "TEST1111",
    "checkinTime":  "15:00",
    "checkoutTime": "10:00",
    "selfCheckin":  "無人櫃檯，直接到房門口輸入房間密碼即可進房；門關上會自動上鎖，外出務必帶好手機。",
    "wifi": [
      { "floor": "1F", "ssid": "TEST-WIFI-1F", "password": "testpassword1" },
      { "floor": "2F", "ssid": "TEST-WIFI-2F", "password": "testpassword2" },
      { "floor": "3F", "ssid": "TEST-WIFI-3F", "password": "testpassword3" },
      { "floor": "4F", "ssid": "TEST-WIFI-4F", "password": "testpassword4" }
    ],
    "notes": [
      "垃圾請依可燃／不可燃分類，丟到五樓屋頂的垃圾區。",
      "備品（毛巾、盥洗用品）放在測試位置。",
      "行李寄放需事先告知房東。",
      "室內請穿拖鞋。",
      "22:00–06:00 請保持安靜。"
    ],
    "hostContacts": [
      { "name": "Test Taro",  "tel": "000-000-0000" },
      { "name": "Test Hanako", "tel": "000-000-0001" }
    ]
  }
}
```

> **本檔所有值皆為明顯假值**（TEST 前綴／`testpassword`／`000-000-0000`）。真值清單由 Olina 於流程外提供，只出現在最後產出的匯入碼字串裡，該字串不進 repo（見 §F）。

### A2. 欄位清單

| 欄位名 | 型別 | 說明 | 必填 |
|--------|------|------|------|
| `lodging` | object | 民宿入住資訊容器；缺此 key＝未提供，區塊顯示「未匯入」提示 | 否 |
| `lodging.name` | string | 民宿名稱 | 否 |
| `lodging.room` | string | 房號 | 否 |
| `lodging.addressZh` | string | 中文地址（渲染規則見 A4） | 否 |
| `lodging.addressEn` | string | 英文地址（給日本當地填單／叫車用） | 否 |
| `lodging.entranceCode` | string | 一樓入口門鎖密碼 | 否 |
| `lodging.roomCode` | string | 房間門鎖密碼 | 否 |
| `lodging.checkinTime` | string | 入住時間，如 `"15:00"`（純字串，不解析為時間物件） | 否 |
| `lodging.checkoutTime` | string | 退房時間，如 `"10:00"` | 否 |
| `lodging.selfCheckin` | string | 自助入住說明；允許 `\n` 換行 | 否 |
| `lodging.wifi` | array | WiFi 陣列，**可容納任意組數**（本行程為 4 組，schema 不寫死 4） | 否 |
| `lodging.wifi[].floor` | string | 樓層標示，如 `"1F"` | 否 |
| `lodging.wifi[].ssid` | string | 網路名稱 | 否 |
| `lodging.wifi[].password` | string | 連線密碼 | 否 |
| `lodging.notes` | array of string | 住宿須知條列，任意條數 | 否 |
| `lodging.hostContacts` | array | 房東聯絡人陣列 | 否 |
| `lodging.hostContacts[].name` | string | 姓名（羅馬拼音） | 否 |
| `lodging.hostContacts[].tel` | string | 電話 | 否 |

### A3. 契約精神（沿用 Task3.api.md，硬約束）

1. **全欄位選填**：任何欄位缺失都不得讓整段渲染崩掉，缺什麼就不渲染該行／該小節。
2. **未知欄位忽略**：`lodging` 內出現本表未列的 key，一律略過不渲染、不報錯。
3. **型別防禦**：`wifi` / `notes` / `hostContacts` 若非陣列，視同未提供（不得 `.forEach` 炸出 TypeError）；`lodging` 若非物件（字串、陣列、null）同樣視同未提供。`notes` 陣列內非字串元素略過該筆。
4. **既有四 key 零變更**：`passports` / `insurance` / `bookings` / `contacts` 的 schema 與渲染邏輯本輪逐位元零 diff。
5. **XSS 防護沿用**：所有值用 `textContent` 寫入（或既有 `escHtml`），與現有 trip-tab.js 一致。

### A4. 兩層地址如何並存（PM 定案）

現況公開層 `TRIP.hotels[0]` 已有 `address_ja`（日文，給司機／店員看）＋ `address_zh`（中文）。本輪新增的是**英文地址**——這是既有兩層都沒有的新資訊。

定案（`[推斷]`，最晚拍板點＝backend 開工前）：

- **公開層零變更**：`tripdata.js` 的 `address_ja` / `address_zh` 原樣保留，MAPLEHOUSE 卡片渲染零 diff。日文地址仍是「給司機看」的正解，本輪不搬家、不重複。
- **私密層的 `addressZh` 是選填備援，預設不建議提供**：上方卡片已顯示中文地址，重複顯示只會讓同一張畫面出現兩份中文地址、看起來像資料打架。
- **渲染規則（機械可驗）**：`lodging.addressZh` 有值時才渲染該行；且渲染前與公開層 `TRIP.hotels[0].address_zh` 做**去除前後空白後的字串比對**，相等則略過不渲染（避免完全重複）。取不到公開層資料時（TRIP 缺載）不做比對、直接渲染。
- **`lodging.addressEn` 有值必渲染**：這是本輪的地址增量價值。
- **交付建議（給 §F 匯入碼生成）**：`lodging` 只填 `addressEn`，`addressZh` 留空。

---

## B. UI 呈現規格

### B1. 位置與容器

- 區塊掛在 `#trip-sec-hotel` 內、**所有 `.trip-hotel-card` 之後**（現況只有一張 MAPLEHOUSE 卡）。
- `buildHotelSection()` **恆建立**一個容器 `div.trip-lodging`（即使當下無資料也建，作為可重繪的空殼），backend 保留其參照供 `_renderLodgingBlock()` 使用。
- `_renderLodgingBlock()` 每次清空容器整塊重建（天然冪等），**禁做局部 patch**。

### B2. 重繪時機（重要——不做會出現「匯入完看不到」的隱蔽 bug）

現況 `buildHotelSection()` 在 `init()` 只跑一次，而匯入動作發生在「重要資料」區塊。若不處理，家人貼完匯入碼切到飯店藥丸會看到舊的「未匯入」畫面，必須重開 APP 才會出現——**這是本輪最容易漏掉的一條**。

定案：`_renderLodgingBlock()` 必須在下列**全部**時機被呼叫（additive 追加，既有 `_renderPrivateSection()` 呼叫點與行為零變更）：

1. `init()` 建完 DOM 之後（首繪）；
2. 匯入成功（`App.privateData.save()` 回 `ok:true`）之後；
3. 清除成功（`App.privateData.clear()`）之後；
4. 重新匯入成功之後。

即：**現有程式碼中每一個呼叫 `_renderPrivateSection()` 的位置，都要在其後追加一次 `_renderLodgingBlock()`**。backend 須在 `Task21.api.md` 列出實際呼叫點行號供 QA 機械核對。

### B3. 區塊標題與小節排版

標題：`民宿入住資訊`（h3，沿用 `.trip-section-title` 的視覺語言，class 用 `.trip-lodging-title`）。

小節順序（由上而下，缺資料的小節整段不渲染）：

| 順序 | 小節標題 | 內容 |
|------|----------|------|
| 1 | （無標題，直接顯示） | `name` ＋ `room`（房號）；同一行或上下兩行由 frontend 決定 |
| 2 | 入住／退房 | `入住 15:00 → 退房 10:00`（沿用飯店卡 `.trip-hotel-dates` 的「→」語彙；只有一邊有值就只顯示那一邊） |
| 3 | 門鎖密碼 | 兩行：`一樓入口` / `房間`，各帶複製鈕（見 B4） |
| 4 | 自助入住 | `selfCheckin` 純文字段落，`\n` 需換行（`white-space: pre-wrap`） |
| 5 | 地址 | `addressEn`（＋ 依 A4 條件顯示的 `addressZh`），各帶複製鈕 |
| 6 | WiFi | 每組一列：`樓層` / `SSID` / `密碼`，SSID 與密碼各帶複製鈕 |
| 7 | 住宿須知 | `notes` 條列（`ul`／`li`） |
| 8 | 房東聯絡電話 | 每筆一列：姓名 ＋ `tel:` 連結（觸控目標 ≥44px，沿用 `.trip-private-row-value a` 的既有語彙） |

### B4. 一鍵複製（定案：需要）

`[推斷]`——最晚拍板點：frontend 開工前。

理由：WiFi 密碼與門鎖密碼是無意義隨機字串，在 iPhone 上照著螢幕手打極易出錯，而家人是在門口／剛進房的情境下操作，錯一次要重來。既有 `trip-tab.js` 已有 `copyToClipboard(text, onOk, onFail)` ＋ `showTip(el, msg)` 兩個現成工具（飯店卡「複製地址」在用），**直接重用，不新造機制**。

- 帶複製鈕的欄位：`entranceCode`、`roomCode`、每組 WiFi 的 `ssid` 與 `password`、`addressEn`（＋有渲染時的 `addressZh`）。
- 鈕文字：`複製`（短標籤，避免擠壓長字串值）。成功回饋 `已複製！`、失敗回饋 `請手動長按複製`——**與飯店卡既有文案逐字一致**。
- 複製鈕最小觸控目標 ≥44px（iOS 紅線，全 repo 既有紀律）。

### B5. 英文地址不做「大字給司機看」（定案：不做）

`[推斷]`——最晚拍板點：frontend 開工前。

理由：大字機制的用途是「隔著車窗給日本司機／店員看」，對日本人有效的是**日文**地址，而公開層飯店卡上方已有「大字給司機看」鈕（`address_ja`），本輪不重複造第二顆。英文地址的實際用途是**自己填單／輸入叫車 APP**，複製比大字有用。

連帶好處：`bigtext.js` 本輪零 diff，不觸碰 `App.showBigText` 跨 Task 契約（SYSTEM_MAP 第 79 行）。

### B6. 未匯入／不可用時的提示（不可空白、不可報錯）

三種狀態，語氣沿用既有 `.trip-private-info` / `.trip-private-unavail` 文案：

| 狀態 | 判斷 | 文案（class `.trip-lodging-empty`） |
|------|------|------|
| localStorage 不可用 | `App.privateData.isAvailable() === false` | `此環境無法讀取住宿資訊，請在加入主畫面後的 APP 內操作（Safari 分頁與 APP 的資料不互通）。` |
| 未匯入任何資料 | `get()` 回 `null` | `尚未匯入住宿資訊。請到「行程 → 重要資料」貼上匯入碼，門鎖密碼與 WiFi 會顯示在這裡。` |
| 已匯入但無 `lodging` | `get()` 有值但 `lodging` 缺／非物件 | 同上一列文案（家人拿到的是舊版匯入碼，動作一樣是重貼新碼） |

**禁止**：空白區塊、`undefined` 字樣、console error、整個飯店區塊壞掉。

### B7. 排版硬要求（長字串陷阱，源自 SYSTEM_MAP 第 103 行）

Task20 的教訓是「標籤寬度是資料驅動的」——本輪的 WiFi SSID、須知條文、英文地址同樣是**任意長度且來自匯入資料**，且密碼／SSID 多為**無空白的連續 ASCII 字串**（比中文更容易水平溢出，因為沒有自然斷點）。

frontend 必守：

1. 標籤欄**不得使用固定 `width`**（不得回退成 Task20 修掉的 `width:72px; flex-shrink:0` 模式）；沿用 Task20 的自適應雙模式思路（`flex-wrap` ＋ `min-width` ＋ `max-width:100%`）。
2. 值欄位必須設 **`overflow-wrap: anywhere`**（或等效），確保無空白長字串會斷行而非撐破容器。
3. 390px 視口下**零水平溢出**、標籤與值**零重疊**、複製鈕不被擠出容器。
4. 字級一律硬編碼、**禁用 `var(--fs-*)`**——type scale 變數只授權既有 `.trip-*` 已收斂區塊（SYSTEM_MAP 第 94 行紀律）。※ 註：新 class 雖為 `.trip-lodging-*` 前綴，但屬本輪新增、未經字級收斂，故比照其他新分頁規則走硬編碼；SA 若判定應納入 type scale，於 impact 提出。
5. 不新增 `z-index ≥ 100`（overlay 帶保留）。
6. 淺色主題：文字色遵 `--c-text` / `--c-text-muted`，accent 當文字用須用 `--c-accent-text`（SYSTEM_MAP 第 88 行）。

---

## C. 證據等級標註總表（依 signal-flow.md）

| # | 預設方案 | 證據等級 | 最晚拍板點 |
|---|----------|----------|-----------|
| C1 | key 命名 `lodging`、物件而非陣列 | `[推斷]` | backend 開工前 |
| C2 | 全部走本機層、不進 tripdata.js | `[實測]`（隱私硬約束已由 SYSTEM_MAP 第 83 行與歷次 QA 三段式掃描確立；Olina 已拍板） | 已定案 |
| C3 | 顯示在飯店藥丸、MAPLEHOUSE 卡下方 | `[實測]`（Olina 已拍板） | 已定案 |
| C4 | `buildHotelSection` 消費 `App.privateData` | `[實測]`（程式碼已核實：`buildHotelSection` 位於 `trip-tab.js` L359，`App.privateData` 於同檔 L524/532 已被使用，同模組內可直接呼叫） | 已定案 |
| C5 | B2 四個重繪時機（含匯入後刷新） | `[實測]`（程式碼已核實：`buildHotelSection` 於 `init()` L846 只呼叫一次，不重繪則匯入後不更新） | 已定案 |
| C6 | 密碼類欄位加一鍵複製 | `[推斷]`（`copyToClipboard`/`showTip` 已存在於 trip-tab.js 並在飯店卡運作中；「iPhone 手打密碼很痛苦」為使用情境推斷，未經真機實測） | frontend 開工前 |
| C7 | 英文地址不做大字、只做複製 | `[推斷]` | frontend 開工前 |
| C8 | `addressZh` 與公開層重複則不渲染 | `[推斷]` | backend 開工前 |
| C9 | `import-data.js` 對新 top-level key 無白名單、零 diff | `[推斷]`——backend 開工第一步須讀 `js/import-data.js` 核實解析層無 key 白名單；若有，補改屬本輪範圍並回報 PM | backend 開工當下 |
| C10 | WiFi 為陣列、不寫死 4 組 | `[實測]`（Olina 明確指出四個樓層各有一組，且未來組數可能變動） | 已定案 |
| C11 | 未匯入提示文案內容 | `[推斷]`（語氣對齊既有文案，未經 Olina 逐字確認） | Olina 真機驗收時可調，不阻擋本輪 |

---

## D. 版本與工程紀律

- **bump SOP 兩檔三行**（SYSTEM_MAP 第 73 行永續紀律）：`js/version.js` 的 `APP_VERSION`（與 `sw.js` 的 `CACHE_VERSION` **逐字元相等**＝QA 機械閘）＋ `APP_VERSION_DATE`（`MM/DD`，bump 當天台灣時區）＋ `sw.js` 的 `CACHE_VERSION`。預期 v20→v21；**以開工時實際值 +1 為準**。
- `PRECACHE_URLS` 筆數零增減（維持 42 筆，無新檔）。
- 載入順序零變更；`App.showTab` wrap 鏈維持四層（本輪不 wrap，無需清理資源）。
- 零新增 localStorage key（沿用既有 `tokyotrip.privateData`，不新開 key）。
- **backend 必寫 `Task21.api.md`**：`lodging` schema 權威副本、`.trip-lodging-*` DOM 結構與 class 名、`_renderLodgingBlock()` 呼叫點行號。

---

## E. 邊界條件 / 錯誤處理

- `lodging` 缺、為 `null`、為字串或陣列 → 視同未提供，顯示 B6 提示。
- `wifi` / `notes` / `hostContacts` 非陣列 → 該小節不渲染，其餘小節正常。
- `wifi` 為空陣列、`notes` 為空陣列 → 該小節不渲染（不顯示空標題）。
- `wifi[]` 某筆缺 `ssid` 或 `password` → 只渲染有值的欄位，不顯示空白行與空複製鈕。
- `hostContacts[].tel` 缺 → 只顯示姓名，不生成空 `tel:` 連結。
- `checkinTime` / `checkoutTime` 只有一邊 → 只顯示有值的一邊，不出現 `入住  → 退房`。
- 極長字串（SSID 40 字元、須知 100 字、英文地址 80 字元）→ 換行不溢出，見 B7。
- 剪貼簿 API 不可用（HTTP 非安全環境／iOS 舊版）→ `copyToClipboard` 既有失敗回呼顯示 `請手動長按複製`，不報錯。
- localStorage 無痕降級 → B6 第一列文案，且**不渲染任何複製鈕**（避免點了沒反應）。
- `window.TRIP` 缺載 → 飯店區塊既有的「飯店資料載入失敗」路徑維持；此時 `.trip-lodging` 容器仍須建立並正常渲染（本機層資料與 TRIP 無依賴關係）。

---

## F. 交付前提（後續節點必須遵守）

### F1. 匯入碼必須合併既有四 key（硬要求）

產生新匯入碼時，**必須把 Olina 現有的 `passports` / `insurance` / `bookings` / `contacts` 資料一併併入同一份 JSON**，不可只產 `lodging` 一段。

理由：`App.privateData.save()` 是**整份覆蓋**語意（存的是整條匯入碼字串），家人貼上只含 `lodging` 的新碼會**弄丟既有的護照號、保單、訂位代號與緊急聯絡人**。Olina 現有匯入碼原文可由「行程 → 重要資料 → 匯出」取得，作為合併基礎。

### F2. 匯入碼與生成腳本不進 repo、不落 my-agent 根目錄

- 真值清單與產出的 `TT1.` 匯入碼字串**不得寫入任何 git 追蹤檔**（含 specs/、DEVELOPMENT_LOG.md、commit message）。
- 匯入碼生成腳本本身**不得落在 `C:\Python Project\tokyo-trip\` repo 內**，也**不得落在 `C:\Users\chin3\OneDrive\my-agent\` 根目錄**（workspace boundary 規則）——寫到 Olina 指定的位置。
- 匯入碼交付方式由 Olina 於流程外決定（如 LINE 傳給家人）。

### F3. spec 與 tracked 檔零真值（違反即 FAIL）

本檔及任何 git 追蹤檔禁止出現真實密碼、真實門鎖碼、真實 WiFi 密碼、房東真實電話。本檔範例值一律 `TEST` 前綴／`testpassword`／`000-000-0000`。

---

## G. 驗收判準（QA 機械可驗，逐條 PASS/FAIL）

### G1. schema 與相容性
1. 既有四 key（`passports`/`insurance`/`bookings`/`contacts`）渲染邏輯逐位元零 diff；用 `Task3.api.md` §3 的既有測試碼匯入，「重要資料」區塊顯示與 v20 完全一致。
2. `js/tripdata.js` 全檔零 diff。
3. `js/import-data.js` 零 diff（或若有白名單須改，改動僅限白名單擴充，並記入 `Task21.api.md`）。
4. 只含舊四 key 的匯入碼（無 `lodging`）→ 重要資料正常、民宿區塊顯示 B6 提示、零 console error。

### G2. 渲染正確性（用假值測試碼）
5. 完整 `lodging` 假值匯入 → 八個小節依 B3 順序全部渲染，位置在 MAPLEHOUSE 卡片**下方**、在飯店藥丸內。
6. WiFi 四組全部渲染；改成 2 組與 6 組的測試碼各測一次，組數正確且不寫死。
7. `notes` 五條全部渲染為條列。
8. `hostContacts` 兩筆各自顯示姓名與可點的 `tel:` 連結。
9. 逐欄位缺漏測試：對照 §E 每一條邊界，缺欄位時該行／該小節不渲染且**零 console error**。
10. `lodging` 為字串／陣列／`null` 三種壞型別各測一次，不炸頁。

### G3. 重繪時機（B2）
11. 從「未匯入」狀態切到飯店藥丸看到提示 → 到重要資料貼上含 `lodging` 的碼 → **不重整頁面**切回飯店藥丸 → 民宿區塊已顯示內容。
12. 執行「清除」後切回飯店藥丸 → 回到 B6 提示狀態。
13. 「重新匯入」換一份不同假值的碼 → 飯店藥丸內容跟著更新。

### G4. 長字串排版（SYSTEM_MAP 第 103 行紀律，本輪重點）
14. 注入長字串測試資料（SSID 40 字元無空白、密碼 32 字元無空白、須知單條 100 字中文、英文地址 80 字元、民宿名稱 30 字元），於 **390px 視口**：
    - a. `document.documentElement.scrollWidth <= 390`（零水平溢出）；
    - b. 標籤與值**零重疊**（相鄰元素 boundingRect 不交疊）；
    - c. 複製鈕完整可見、未被擠出容器、觸控目標 ≥44px。
15. 短字串資料（`1F` / `15:00`）同一組 class 下排版仍正常——**長短兩類必須同驗**，不得只驗一種。
16. `.trip-lodging-*` 規則中 `var(--fs-` 出現次數 = 0。
17. 測試資料測畢須清除（`App.privateData.clear()` 或還原原資料）。

### G5. 隱私三段式掃描（SYSTEM_MAP 第 83 行，每輪必做）
18. 工作樹 grep：全 repo 無真實密碼／門鎖碼／WiFi 密碼／房東電話。
19. repo 內所有 `TT1.` 字串 **base64 解碼後再 grep**（base64 是純 grep 的盲區）——本輪 spec 與 api.md 內若出現測試碼，解碼後須全為 TEST 假值。
20. `git log -p` 掃描本輪 commit 無個資真值。
21. `js/tripdata.js` 內無任何密碼／門鎖碼／WiFi 欄位（確認未誤放公開層）。

### G6. 版本與迴歸
22. `js/version.js` 的 `APP_VERSION` 與 `sw.js` 的 `CACHE_VERSION` **逐字元相等**，且較 v20 遞增；`APP_VERSION_DATE` 為 bump 當天。
23. `PRECACHE_URLS` 筆數 42 筆零增減。
24. 全系統迴歸冒煙：六分頁皆可開、常用句／翻譯（文字＋對話）／拍照／地圖／折價券零 diff 行為；`App.showTab` wrap 鏈仍為四層。
25. `bigtext.js` / `tts.js` / `api.js` / `my-phrases.js` / `phrases-tab.js` / `translate-tab.js` / `map-tab.js` / `camera-tab.js` / `coupons-tab.js` 全檔零 diff。

---

## H. 不在本次範圍（Non-scope 護欄——不是備註）

- **不改 `js/tripdata.js`**（公開層飯店卡 `address_ja`/`address_zh`/`tel`/`note` 一律零 diff）。
- **不改既有四個 top-level key 的 schema 或渲染**。
- **不改 `App.privateData` 的五個方法簽名**（get/getRawCode/save/clear/isAvailable），不新增方法。
- **不改匯入碼格式 `TT1.<base64>`**（改格式＝已發出的真實匯入碼全部作廢）。
- **不新增 localStorage key**。
- **不重構 trip-tab.js**（Task10 兩層視圖狀態機、四子區塊 pill 導覽、`_renderPrivateSection` 既有邏輯一律不動刀；本輪只做 additive）。
- **不動 `bigtext.js` / `App.showBigText` 契約**；不為英文地址新增大字功能（B5）。
- **不做「重要資料」藥丸內的任何顯示變更**（民宿資訊只出現在飯店藥丸）。
- **不做分享／QR code／自動填 WiFi**（iOS 無此 Web API，屬幻想功能）。
- **不做 lodging 的編輯 UI**（資料只能由匯入碼帶入，APP 內不可編輯）。
- **不做多間住宿**（本行程單一民宿；`lodging` 為物件而非陣列即體現此決定，未來要多間屬新 Task）。
- **不在本輪產生真實匯入碼**（Olina 流程外提供真值後另行產出，見 §F）。
- **不做字級 type scale 收斂**（新 class 走硬編碼，見 B7-4）。
- **不做真機驗收**——iPhone 實機目視（長 SSID 觀感、複製鈕手感、門口實際使用流程）由 Olina 部署後流程外執行；不過不回改本輪存檔，另開新 Task 迭代。同時 PM 於閉環時將本輪驗收項併入 repo 根目錄 `行前檢查清單.md`。

---

## 影響範圍分析（SA）

> 完整分析見 `Task21.impact.md`（含逐路徑讀碼實證、CSS 機械核實、判準缺口補完）。本節為摘要與硬約束。
> SA 分析日 2026-07-20，基線 v20（`version.js` / `sw.js` 兩檔已核實）。**涉及範圍＝backend ＋ frontend。**

### 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 重要資料區塊 | `_renderPrivateSection` / `_renderPrivateFilled` / `_renderPrivateEmpty` | 本體零 diff，三個呼叫點各 additive 追加一行 | ✅ |
| 飯店區塊 | `buildHotelSection`（L359–462） | 新增容器與渲染；L365 早退路徑為最大陷阱 | ✅ |
| 匯入／清除／重新匯入 | confirmBtn（L741–757）、clearBtn（L697–701） | 行為零變更 | ✅ |
| 匯出功能 | `_renderPrivateFilled` exportTa（L666） | 邏輯零 diff，但匯出碼自本輪起含門鎖／WiFi 密碼 | ✅ |
| `.trip-private-*` 排版（Task20） | `style.css` L1167–1210 | 不得修改；新區塊須沿用同一雙模式思路 | ✅ |
| trip pill 導覽 | `buildPills`（L789–828） | 零 diff（只 toggle hidden、不重繪——此為重繪分析關鍵前提） | ✅ |
| 離線快取 | `sw.js` / `version.js` | v20→v21 兩檔三行；PRECACHE 42 筆零增減 | ✅ |

### 三項關鍵裁定

1. **`App.privateData` 跨 Task 契約本輪零變更**（impact §1.1）。新消費者 `buildHotelSection` 在 `trip-tab.js` 同檔同分頁內，SYSTEM_MAP 第 89 行「trip 分頁專用、非跨 Task 共用元件」**維持有效、未解除**，其他分頁仍不得消費。真正的架構變化是「重繪扇出 1→2」，已入 SYSTEM_MAP 新條目。
2. **§B2 四時機定案經逐路徑讀碼驗證＝完整正確，無遺漏的第五個路徑**（impact §2.2）。pill 切換與 onShow 皆不重繪但也不需要重繪（資料只能經 save/clear 變動，兩者皆已覆蓋）；localStorage 降級路徑因追加點在函式外而天然覆蓋。`_renderPrivateSection()` 全檔恰 **3 個 lexical 呼叫點**（L700／L755／L782），對應 4 個 runtime 時機（`_buildImportArea` 實例化兩次）。
3. **字級改用 type scale 變數**（impact §10，依 B7-4 的 SA 授權裁定）：`.trip-lodging-*` 屬 `.trip-*`，SYSTEM_MAP 第 94 行判準本就允許；且本區塊與 `.trip-hotel-*` 在同一畫面相鄰，硬編碼會製造未來靜默字級斷層。**B7-4 第 4 點與 G4-16 由本裁定取代，QA 本輪不執行 G4-16。**

### Backend 硬約束

- **A1**：`_renderLodgingBlock()` 追加在 L700／L755／L782 三處呼叫點**之後**，**禁止寫入 `_renderPrivateSection()` 函式體內**——L529 的 early return 會跳過它，破壞 §B6 降級路徑（判準 M1）。
- **A2**：`.trip-lodging` 容器須在 `buildHotelSection` 的**正常路徑與 L365「飯店資料載入失敗」早退路徑上各建立一次**，且**必須位於任何 `sec.innerHTML = ...` 賦值之後**（innerHTML 會清空子節點）。此路徑正是「tripdata 掛了但家人仍需門鎖密碼」的最高價值情境（判準 M2）。
- **A3**：`js/import-data.js` **零 diff 已由 SA 核實**——`parseImportCode` 對 top-level key 無白名單，新 key 天然通過，**C9 解除**。
- 其餘（textContent 寫入、型別防禦、`addressZh` trim 比對、重用 `copyToClipboard`/`showTip`、bump、api.md 內容）見 impact §8。

### Frontend 注意事項

- 新 class 一律 `.trip-lodging-*`（命名空間已機械確認乾淨，全 repo 0 命中）；禁改 `.trip-private-*` / `.trip-hotel-*` 既有規則。
- 排版沿用 Task20 雙模式（可複製參數見 impact §4.2）；值欄用 `overflow-wrap: anywhere`（不可用 `break-word`——只有 `anywhere` 影響 flex min-content 計算）；`min-width` 門檻不要照抄 200px。
- **複製鈕建議另立輕量 class**，不沿用 `.trip-btn` 原樣——390px 下已算出會全面換行且 11 顆實心藍鈕視覺過重（算式見 impact §3.3）；觸控目標仍 ≥44px。
- 字級用 `var(--fs-*)`（見上方裁定 3）；`.trip-lodging-title` 對應階為 lg = 19px。

### QA 迴歸測試清單

既有功能迴歸：
- [ ] 重要資料四小節以 Task3 既有測試碼驗，顯示與 v20 一致；匯入／清除／重新匯入三流程零變更
- [ ] `.trip-private-row` 長短兩類標籤仍為 Task20 雙模式（不得回歸）
- [ ] 飯店卡三顆鈕零 diff；Task10 兩層視圖與 pill 導覽正常
- [ ] 六分頁全開、其餘九支 js 全檔零 diff、`tripdata.js` / `import-data.js` 零 diff

SA 新增機械判準（補現行 G 系列缺口）：
- [ ] **M1**：`_renderPrivateSection` 函式體（L512–541）內 `_renderLodgingBlock` 出現次數 **= 0**；呼叫恰 3 處
- [ ] **M2**：`window.TRIP` 缺載 → 飯店區塊顯示載入失敗，**`.trip-lodging` 容器仍存在並正常渲染**、零 console error（**現行 G 判準完全缺此案例**）
- [ ] **M3**：`isAvailable()` 回 false → 民宿區塊顯示 B6 第一列文案（非空白）、不渲染複製鈕
- [ ] **M4**：api.md 呼叫點行號為 3 個並註明 #2 覆蓋兩時機（QA 不得因找不到第四點而判缺漏）
- [ ] **M5**：`.trip-hotel-card` 無 `:last-child` 規則，插入新兄弟後既有卡片樣式零變化

其餘依 spec §G 判準 1–25 全數執行（**G4-16 除外，已由裁定 3 作廢**）。隱私 G5-18～21 為本輪最高權重，QA 佐證截圖不得使用 Olina 真實匯入碼。
