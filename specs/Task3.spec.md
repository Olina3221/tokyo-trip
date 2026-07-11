# Task3.spec.md — 行程 / 航班 / 飯店 / 重要資料頁（trip 分頁，離線可用）

> PM 撰寫：2026-07-11。資料來源：`C:\Olina\其它\東京\` 實際材料（行程 xlsx、樂桃訂票單 jpg、要保書 jpg、行程總覽 png），已由 PM 逐檔萃取，見附錄 A。
> 下游必讀：`Task1.api.md`（A1–A8 契約）、`Task2.api.md`（showBigText/speak 契約）、`SYSTEM_MAP.md`。

## 模組：trip 分頁（行程 / 航班 / 飯店 / 重要資料）

### 功能描述

`trip` 分頁呈現四個子區塊：每日行程（7/21–7/25）、航班（去/回程卡片）、飯店（Maple House，地址可複製/開地圖/大字展示）、重要資料（緊急電話＋本機層個資匯入區）。全部離線可用。

### 背景與已拍板決策（不重議）

給冷 context 下游的最小背景。SA/backend/frontend 不得重開已拍板的討論——有疑慮記入回報交 PM，不自行改走別條路。

- 已完成：Task1（PWA 骨架、分頁框架、sw.js 離線快取、A1–A8 契約）、Task2（常用句、`App.showBigText`、`App.speak`、showTab wrap）皆已 QA PASS 閉環。現 `CACHE_VERSION='v2'`。
- 已拍板（技術棧）：純靜態 HTML + CSS + 原生 JS + SW，無框架無打包，部署 GitHub Pages（repo 內容 = 公開內容）。
- 已拍板（★ 資料隱私分層，本 Task 硬約束，違反 = QA FAIL）：
  - **公開層** = `js/tripdata.js`（git 追蹤、會公開部署）：只放每日行程、航班班次/時間、飯店名稱/地址。**禁止**任何個人識別資訊：訂位人姓名、訂位代號/confirmation number（含樂桃訂單編號——6 碼英數，真值不得出現在 repo 任何檔案，本 spec 亦同）、護照號、保單號、要保書內容、個人手機號碼。就算材料裡有也不准進 tripdata.js。**本 spec 與 repo 內任何檔案同樣不得含上述個資值。**
  - **本機層** = 手機 localStorage（前綴 `tokyotrip.`）：護照號、保單號/保險資訊、緊急聯絡人。絕不進 git、絕不部署。
  - 本機層取得方式 = **in-app 匯入碼貼上**（一次貼上、零逐欄輸入——Olina 討厭在手機打字）。匯入碼實際內容（含真實個資）由後續在電腦端另外產生、單獨交付，**不在本 Task 產出、不進 repo**。
  - 本機層不做加密（localStorage 明文存放，風險由手機鎖屏承擔）——已拍板，不重議。
- 已拍板（航班資料）：以樂桃官方訂票單（`航班資訊.jpg`）為準——去程 MM626 07/21 10:50→15:20、回程 MM625 07/25 16:55→19:40。行程表 xlsx 的回程「16:50 起飛」為舊值，不採用。

### 涉及範圍

- [x] 後端／核心邏輯（`js/tripdata.js` 真實資料替換與 schema 定案、`js/import-data.js` 匯入碼解析/儲存模組、`js/trip-tab.js` 渲染邏輯、`sw.js` bump、`Task3.api.md` 撰寫）
- [x] 前端／UI（index.html script 標籤與 tab-trip 佔位替換方式、style.css 新增 trip 分頁樣式、iOS 觸控/safe-area 細節）

---

## 一、UI 結構（trip 分頁）

`#tab-trip` section 內整塊替換佔位卡（依 A1 DOM 約定，不在 section 外加父層）：

```
#tab-trip
├── 子區塊切換 pill（4 顆，橫向）：行程｜航班｜飯店｜重要資料
│     └── 觸控目標 ≥44px；當前選中以 aria-selected 標示
├── 區塊一【行程】（預設顯示）
│     └── 依日分段（Day1 7/21 … Day5 7/25），每日一張日卡
│           ├── 日卡標題列：Day N・M/D（週X）＋當日主題
│           └── 行程項目列（依時間排序）：時間｜標題
│                 └── 點擊展開 detail（交通指引/餐廳選項/備註），再點收合
├── 區塊二【航班】
│     └── 去程卡＋回程卡：航空公司/班號、日期、出發（機場+航廈+時間）、
│         抵達（機場+航廈+時間）、note（報到提醒）
├── 區塊三【飯店】
│     └── 飯店卡：名稱、入住/退房日期、日文地址、中文地址
│           ├── [複製地址] 鈕：複製 address_ja 到剪貼簿，成功顯示短暫提示
│           ├── [開地圖] 鈕：外部連結開 Google Maps（會離開 APP，鈕上須標示）
│           └── [大字展示] 鈕：App.showBigText({ ja: address_ja })（ja-only 模式，
│               給計程車司機/店員看）
└── 區塊四【重要資料】
      ├── 公開段：緊急電話清單（tripdata.js important 陣列），電話以 tel: 連結呈現
      └── 本機段（localStorage）：
            ├── 已匯入 → 逐列顯示 label/value（護照、保單、緊急聯絡人等）
            │     ├── [重新匯入] 鈕（走同一匯入流程，成功後整份覆蓋）
            │     ├── [匯出] 鈕：顯示現存匯入碼＋複製鈕（供第二支手機轉移）
            │     └── [清除] 鈕：confirm 後刪 localStorage key
            └── 空狀態 → 「尚未匯入，點『匯入』貼上匯入碼」＋ [匯入] 鈕
                  └── 匯入流程：開輸入區（textarea）→ 長按貼上匯入碼 → [確認匯入]
                      → 解析 → 存 localStorage → 渲染。解析失敗顯示錯誤文案、
                      不動既有資料。
```

行程區塊預設捲動定位：若裝置日期落在 2026/07/21–07/25，預設展開對應的當日日卡；否則預設 Day1。

## 二、資料來源與 schema

### 公開層：`window.TRIP`（js/tripdata.js，backend 用附錄 A 真實資料**整檔替換**現有範例佔位）

現有範例 schema 需調整（itinerary items 由純字串升級為物件以承載時間與展開詳情）。**backend 定案後必須寫進 `Task3.api.md`**，frontend 依 api.md 渲染。PM 建議 schema：

```js
window.TRIP = {
  flights: [ { label, airline, flightNo, date, from, to, note } ],
  hotels:  [ { name, checkin, checkout, address_ja, address_zh, tel, note } ],
  itinerary: [ { day, theme, items: [ { time, title, detail } ] } ],
  important: [ { label, value, tel } ],   // tel 有值時渲染成 tel: 連結
};
```

- `detail` 允許多行字串（`\n` 換行），frontend 以換行渲染。
- `members` 欄位自本版 schema 移除（人數矛盾未決，見缺口 G5；UI 不依賴它）。
- `window.COUPONS` 佔位資料**原樣保留不動**（Task4 範圍）。
- tripdata.js 檔頭註解必須加註隱私分層警告：「本檔會公開部署，禁止寫入任何個資（護照/保單/訂位代號/姓名/手機）」。

### 本機層：localStorage

| Key | 內容 | 建立者 |
|-----|------|--------|
| `tokyotrip.privateData` | 通過驗證的**匯入碼原字串** | import-data.js |

只存匯入碼原字串（單一真實來源），渲染時即時解碼；匯出 = 顯示此字串。

### 匯入碼格式（本 Task 定義格式與解析；真實內容不在本 Task 產出）

```
TT1.<base64( UTF-8 JSON )>
```

- 前綴 `TT1.` 為版本號＋格式驗證錨點；解析前先 trim 全部空白與換行（LINE/訊息軟體傳送常夾雜）。
- base64 內容為 UTF-8 JSON，**編碼端與解碼端都必須走 UTF-8 bytes**（原生 `atob` 只還原 bytes，中文須經 `TextDecoder`；backend 實作解碼須處理此點，不得用 `atob` 直接當字串用）。
- JSON schema（所有欄位皆選填；未知欄位忽略——向前相容）：

```json
{
  "passports": [ { "name": "稱謂", "number": "護照號" } ],
  "insurance": { "company": "保險公司", "policy": "保單號", "tel": "客服/緊急電話" },
  "bookings":  [ { "label": "樂桃訂位代號", "value": "xxx" } ],
  "contacts":  [ { "label": "台灣緊急聯絡人", "tel": "電話" } ]
}
```

- QA 測試用假資料匯入碼由 backend 於 Task3.api.md 提供一組（值一律用明顯假值如 `TEST000000`，不得用真值）。
- iOS 注意（spec 拍板，寫進 UI 空狀態文案或說明列）：**匯入必須在加入主畫面後的 standalone APP 內操作**——Safari 分頁與主畫面 APP 的 localStorage 不共用，在 Safari 貼的資料 APP 裡看不到。

## 三、新檔案與載入順序

| 檔案 | 負責 | 內容 |
|------|------|------|
| `js/import-data.js` | backend | 匯入碼 parse/驗證、localStorage 存取、匯出；對外介面掛 `App.privateData`（get/save/clear，簽名由 backend 在 Task3.api.md 定案） |
| `js/trip-tab.js` | backend 邏輯＋frontend 組裝 | `App.registerTab('trip', { onShow })`、四子區塊渲染 |

index.html script 順序（A6：功能模組在 app.js 之後；trip-tab 用到 showBigText 與 App.privateData，故序為）：

```html
<script src="./js/tts.js"></script>
<script src="./js/bigtext.js"></script>
<script src="./js/phrases-tab.js"></script>
<!-- Task3 新增（順序定死：import-data 在 trip-tab 之前）-->
<script src="./js/import-data.js"></script>
<script src="./js/trip-tab.js"></script>
```

sw.js（A2 SOP，backend 執行）：`PRECACHE_URLS` 加入 `./js/import-data.js`、`./js/trip-tab.js`；`CACHE_VERSION` `'v2'` → `'v3'`。tripdata.js 已在清單中，內容更新靠 bump 生效。

## 四、業務規則

1. **隱私分層是硬規則**：QA 必驗「tripdata.js／trip-tab.js／import-data.js／spec 內不得出現任何真實個資值」（護照號、保單號、訂位代號、姓名、個人手機）。grep 得到 = FAIL。
2. 航班以樂桃訂票單為準（去 MM626 10:50→15:20；回 MM625 16:55→19:40，皆第一航廈）。
3. 行程日卡依日期排序；每項目點擊展開/收合 detail；預設全收合（只看得到時間＋標題），版面才塞得下五天。
4. 開地圖 = 外部 URL（`https://maps.google.com/?q=<encodeURIComponent(address_ja)>`），不算 API 呼叫；鈕上或旁邊標示「會離開 APP」。
5. 大字展示地址走 `App.showBigText({ ja: address_ja })`，ja-only 模式（Task2 契約 B3），不自建 overlay。
6. 本機層匯入成功 = 整份覆蓋（不做逐欄合併）；解析失敗 = 顯示「匯入碼格式不對，請確認是否完整貼上」並保留既有資料。
7. 匯出鈕只在已有資料時顯示；清除需 `confirm()` 二次確認。
8. 電話號碼（important 與本機層 contacts）一律 `tel:` 連結，點了直接撥號。

## 五、邊界條件 / 錯誤處理

- `window.TRIP` 未定義或欄位缺/空 → 該區塊顯示「資料載入失敗」文案，不壞整頁（比照 PHRASES 契約）。
- localStorage 不可用（Safari 無痕等）→ 本機段顯示「此環境無法儲存，請在加入主畫面的 APP 內操作」，不 throw。
- 剪貼簿：`navigator.clipboard.writeText` 失敗或不存在 → fallback（選取文字＋提示手動複製），不壞頁。
- 匯入碼含前後空白/換行/被斷行 → trim＋去除所有 whitespace 後再解析。
- 匯入碼 JSON 各欄位皆選填：缺的段落不渲染，不顯示 undefined。
- 切分頁時 overlay 自動關（Task2 wrap 既有行為，不需自己處理，但不得破壞）。

## 六、不在本次範圍（Non-scope，必填護欄）

- 不做翻譯 / OCR / 語音新功能（Task5/6）
- 不碰折價券：`window.COUPONS` 與 `折價券\` 素材資料夾完全不動（Task4）
- 不接任何網路 API（地圖為外部連結開啟，非 API 呼叫）
- **不產生真實個資匯入碼**——那是本 Task 外、電腦端的另行交付；repo 內只允許假資料測試碼
- 不改 Task1/2 既有邏輯（app.js、tts.js、bigtext.js、phrases-tab.js 本體不動；showTab wrap 不動）
- 不做本機層加密、不做 iCloud/雲端備份
- 不做 KML 地圖渲染（座標素材留參考，不進本 Task）
- 不改 schema 以外的既有契約（分頁 id、A1–A8、Task2 API 簽名）

## 七、QA 驗收重點（QA 冒煙據此展開）

1. 離線（SW v3 生效後斷網）：trip 分頁四區塊全部可看、可展開、可切換。
2. 隱私掃描：對 repo 全檔 grep 真實個資特徵值 → 必須零命中。真值清單由 PM 於流程外提供 QA（不進 repo）；至少涵蓋：護照號、保單號、樂桃訂位代號、被保險人姓名拼音。
3. 匯入流程：假資料碼 → 匯入 → 顯示 → 重整仍在（localStorage）→ 匯出碼與原碼一致 → 清除後回空狀態。
4. 壞匯入碼（缺前綴/斷行/亂碼）→ 錯誤文案、既有資料不受損。
5. 大字地址：overlay 開啟、ja-only 版面置中、關閉/切分頁行為正常（Task2 迴歸）。
6. 既有功能迴歸：常用句分頁、大字、語音不受影響；CACHE_VERSION='v3'、PRECACHE 含兩新檔。

---

## 附錄 A — PM 已萃取之真實資料（公開層允許內容，backend 據此改寫 tripdata.js）

> 出處：行程 xlsx（主）＋樂桃訂票單 jpg（航班權威）＋總覽 png（對照一致）。以下不含任何個資。

### A1. 航班（樂桃 Peach）

| | 班號 | 日期 | 出發 | 抵達 | 備註 |
|--|------|------|------|------|------|
| 去程 | MM626 | 2026/07/21（二） | 台北桃園 T1 10:50 | 東京成田 T1 15:20 | 國際線起飛前 120–50 分完成報到；建議 07:50 抵一航廈辦託運；含 20kg 託運額度 |
| 回程 | MM625 | 2026/07/25（六） | 東京成田 T1 16:55 | 台北桃園 T1 19:40 | 建議 13:50 抵成田；14:50 開櫃、北翼 4 樓自助機台；Check-in 截止起飛前 60 分 |

### A2. 飯店

- 名稱：Maple House（淺草）
- 入住 2026/07/21（約 17:00 抵達）→ 退房 2026/07/25（08:30 早鳥退房）
- 地址（中文，出自行程表）：台東區駒形 1-2-10；距淺草站步行約 5–10 分鐘
- 地址（日文）：東京都台東区駒形1-2-10（由中文地址機械轉換，**待 Olina 核對**，見缺口 G1）
- 電話：材料中無（缺口 G2）

### A3. 每日行程（詳版見行程 xlsx；backend 轉寫為 itinerary 結構，detail 保留餐廳/交通要點）

**Day1・7/21（二）淺草基地與河岸夜色**
- 06:10 出門｜06:20 公車→高鐵板橋站（15元）｜07:00 高鐵板橋→桃園（125元）｜07:32 機捷直達 A18→A12（35元）｜07:47 抵一航廈
- 07:50 樂桃託運｜08:30 出境｜10:20 登機｜10:50 MM626 起飛
- 15:20 抵成田｜17:00 抵飯店 Maple House
- 18:00 晚餐（二選一）：駒形どぜう 本店（江戶泥鰍鍋，台東区駒形1-7-12，約¥2,000–5,000）／淺草 尾張屋 本店（天婦羅蕎麥麵，台東区浅草1-7-1，約¥800–2,500）
- 19:30 淺草夜間散步：雷門→隅田川看晴空塔夜景

**Day2・7/22（三）下町風情與動漫巡禮**
- 08:30–09:30 淺草寺與雷門清晨散策
- 09:15 分頭：家人→晴空塔（推薦東武晴空塔線 1 站）；Olina→合羽橋道具街（飯田屋、田中熱器具工業所買烘焙模具），11:10 於 Solamachi 會合
- 09:30–13:00 晴空塔＋Solamachi（寶可夢中心4F、卡比4F、Jump Shop 3F、吉卜力2F；甜點 Qu'il fait bon 2F、祇園辻利6F；展望台大人¥2,100/國中生¥1,200）
- 13:00 東武巴士 Skytree Shuttle 2號站牌→上野
- 13:30 午餐（二選一）：三浦三崎港 上野店（迴轉壽司，上野4-10-17）／名代 宇奈とと 上野店（鰻魚飯¥550起，上野6-7-12）
- 14:30–16:00 阿美橫丁散策（二木的菓子等）
- 16:00 JR 山手線/京濱東北線 上野→秋葉原（2 站）
- 16:15–19:30 秋葉原：Yodobashi Akiba、Radio Kaikan
- 19:30 晚餐：麵屋武藏 武仁（千代田区神田佐久間町2-18-5，武仁肉拉麵，全豬無牛）
- 20:40 計程車回飯店（約¥1,200–1,400／8–10 分）

**Day3・7/23（四）潮流與動漫天堂**
- 08:15 銀座線淺草→表參道（14 站）轉千代田線→明治神宮前（2號出口）
- 09:00–10:15 明治神宮森林散策
- 10:15–11:30 原宿竹下通（下坡順向流）
- 11:30 副都心線→池袋（3 站，地下連通不出地面）
- 11:50 午餐（二選一，皆無牛）：和幸豬排／邁泉豬排 Maisen（池袋百貨/Sunshine City）
- 13:30–18:30 池袋 Sunshine City（寶可夢中心、Jump Shop、動漫雜貨）
- 18:30 晚餐：根室花丸 或 活美登利壽司（池袋百貨美食區）
- 20:00 JR 山手線池袋→上野（8 站）轉銀座線→淺草（3 站）

**Day4・7/24（五）海鮮饗宴與橫濱海港動線**
- 08:30 都營淺草線 淺草→東銀座（4 站，6號出口，步行 5–8 分到築地）
- 09:00–12:00 築地場外市場：まぐろや黒銀（生魚片，中央区築地4-10-12）、築地どんぶり市場（鮪魚臉頰肉丼，熟食）、丸豊（飯糰）、鳥藤分店（雞肉串）、築地コロッケ（可樂餅）、さのきや（鮪魚燒）
- 12:30 東銀座（淺草線直通京急）→橫濱→JR 根岸線 1 站→櫻木町
- 櫻木町【南改札東口】→ YOKOHAMA AIR CABIN 空中纜車（單程¥1,000/來回¥2,000）→ 步行 2 分到杯麵博物館
- 13:40 杯麵博物館（大人¥500/高中以下¥400）；**14:30 預約 DIY 杯麵**（My CUPNOODLES Factory ¥500/個，約 45 分）
- 15:15–17:15 Queen's Square／World Porters 商場
- 17:15 JR 根岸線 櫻木町→石川町（2 站，中華街口北口）
- 17:30–18:45 橫濱中華街：江戶清 本店（肉包，山下町192）、王府井 本店（生煎包，山下町191-24）
- 18:45 JR 石川町→新橋（約 45 分，逆向有位）轉都營淺草線→淺草（6 站）

**Day5・7/25（六）歸途與最後採購（三方案自選）**
- 08:30 Maple House 退房｜08:50 都營淺草線 Access特急 淺草→成田機場 T1（直達）
- 09:50 機場 B1 行李寄存（大型約¥700–800/件/天）
- 方案A：京成本線回頭 1 站→京成成田站，成田山表參道老街（川豊本店/駿河屋鰻魚飯、近江屋、なごみの米屋、林田のせんべい；14:21 前搭車回機場）
- 方案B：機場 T1 4 樓商場＋5 樓展望台（Pokemon Store、UNIQLO、Hello Kitty、Sky Food Court）
- 方案C：行李寄飯店→東京車站 GRANSTA 掃貨（09:00 開門：Press Butter Sand、MAPLE BUTTER BOY、東京香蕉…）；12:15 離開→12:35 取行李→13:00 最晚離淺草→日暮里搭 Skyliner→14:00 抵成田 T1
- 14:50 樂桃開櫃（北翼 4 樓自助機台）｜15:40–16:10 免稅衝刺（Fa-So-La）｜16:20 登機｜16:55 MM625 起飛
- 19:40 抵桃園 T1｜入境提領約 40–50 分｜機捷 A12→A18（¥—，35元）→高鐵桃園→板橋（125元）→計程車到家（約 21:20）

### A4. 重要資料（公開層 important）

| label | value / tel |
|-------|-------------|
| 日本報警 | 110 |
| 日本救護／火災 | 119 |
| 台北駐日經濟文化代表處 | +81-3-3280-7811 |
| 台灣外交部旅外急難救助（免費） | 0800-085-095 |
| 樂桃報到提醒 | 國際線起飛前 120–50 分完成手續（成田 T1 北翼 4 樓） |
| 旅遊平安險 | 臺灣產物保險（保單號在「重要資料→匯入」的本機層，不在此顯示） |

---

## 附錄 B — 缺口清單（PM 已回報 Olina，backend 不得腦補補值）

| # | 缺口 | 現況處理 |
|---|------|----------|
| G1 | 飯店官方名稱與日文地址（「Maple House」是否為正式名？日文地址為中文機械轉換） | 先用轉換值上線，Olina 核對後修正 |
| G2 | 飯店電話 | `tel` 欄留空字串，UI 缺值不渲染 |
| G3 | 飯店 check-in 時間（材料只有「17:00 抵達」） | 只顯示日期不顯示 check-in 時刻 |
| G4 | 保險公司 24hr 緊急/客服電話（要保書上只有回傳管道） | 留給匯入碼 `insurance.tel`，公開層不放 |
| G5 | 同行人數矛盾：行程表寫「4 人分攤/4 件行李」，Checklist 寫「護照 3 本/手機 3 支」 | schema 移除 members 欄，UI 不依賴；待 Olina confirm |

## 影響分析（SA 補寫）

> 全文見 `Task3.impact.md`（2026-07-11）。涉及範圍：backend＋frontend → pipeline 走完整 backend → frontend → QA。摘要：

- **隱私破口盤點（P1–P6，最高風險）**：現有 tripdata.js 佔位檔本身含個資形態內容（members 名單、「訂房大名：OLINA」note、等待手填的護照/保單佔位列），整檔替換時必須確認清除；**base64 是 grep 盲區**——QA 機械檢查定版為三段式：工作樹 grep 真值清單零命中＋repo 內所有 `TT1.` 字串解碼後再 grep＋本 Task commits `git log -p` 與 message 掃描。檢查時點在 commit 前（git 歷史不可洗）。specs/、QA 證據檔、DEVELOPMENT_LOG、commit message 同受禁令；素材原檔（訂票單/要保書 jpg）禁入 repo。
- **匯入碼跨界契約（B1）**：格式權威定義必須寫死在 Task3.api.md（標準 base64＋padding），因為電腦端生成器在 repo 外、未來才寫，api.md 是它唯一依據；解析端容忍 URL-safe 變體。假測試碼必須含中文值（驗 TextDecoder 路徑）。
- **localStorage 紀律（B2）**：清除只准 `removeItem('tokyotrip.privateData')`，禁 `localStorage.clear()`（會誤殺 lastTab 與 Task4 折價券狀態）；耐久性提醒文案（B3）。
- **showBigText 契約相容確認**：地址走 ja-only 模式與 Task2 B3 定案完全 fit，不改 bigtext.js；長地址版面 frontend 驗（B7）。
- **sw.js（A2）**：v2→v3、PRECACHE 加兩新檔；tripdata.js 檔名不變內容全換，不 bump = 使用者永遠看到範例假行程（頁面不壞、最隱蔽的失效）。
- **單檔雙契約**：tripdata.js 同檔的 `window.COUPONS` 原樣保留（Task4 依賴）。
- **onShow 冪等（B6）**：切走再切回不得重置展開狀態與輸入中匯入碼。
- Safari↔standalone 不共用、真機貼上、G1 日文地址核對 → 移交 Task7 真機清單（Olina 流程外）。
