# Task17 — 地圖功能：依天地點清單＋A→B 一鍵開 Google 地圖（混合式）

## 模組：地圖分頁（map）＋ KML→mapdata 解析腳本

### 功能描述
新增第 6 個底部分頁「地圖」：依天列出當日行程地點（來自 Olina 的 Google My Maps KML，經腳本轉成 `js/mapdata.js`），選起點 A / 終點 B 後一鍵開 Google 地圖 App 算大眾運輸路線。**不自建路線 API、不做 APP 內互動地圖**——真導航交給 Google 地圖（Olina 自備離線地圖）。

### 背景與已拍板決策（不重議）
- 已完成：Task1–6、8–16 全數閉環，現況 v16；功能面（翻譯/對話/大字/常用句/拍照/行程/折價券/離線）全上線，剩 Task7 部署驗收。
- 已拍板（Olina 選定「混合」方向）：
  1. APP 內依天列出地點（可編輯、綁行程）＋ A→B 一鍵開 Google 地圖算大眾運輸路線。
  2. **不做** Google Directions/Routes API、**不做** APP 內互動地圖圖磚（Leaflet / Google Maps JS）。deep-link 純 URL，**無需任何 API 金鑰**。
  3. 資料來源＝`C:\Olina\其它\東京\2026東京.kml`（Google My Maps 匯出，6 資料夾分天、49 個 Placemark）。
  4. **地圖語言處理走 A：一鍵開 Google 地圖＋盡量中文化**——所有 deep-link 帶 `hl=zh-TW`，並提示 Olina 把 Google 地圖 App 語言設為繁體中文；不自建翻譯層。
- 自由行隨機性是需求核心：原規劃只是參考，A/B 要可自由改選、終點可自訂文字。
- Task17 排 Task7 之前（地圖做完再一起最終驗收）。
- SA/backend/frontend 不得重開已拍板討論；有疑慮記入回報交 PM。

### PM 定案：放新分頁，不併入行程單日視圖
**定案＝(b) 新增第 6 個底部分頁「地圖」**（tab id `map`）。理由：
1. `trip-tab.js` 已 894 行、Task10 兩層視圖狀態機剛閉環驗收——把「地點清單＋A/B 選擇器＋自訂終點輸入」塞進單日視圖，等於在已驗收的狀態機上動大刀，回歸面大、單日視圖也會過載（時間軸＋地點＋路線工具擠一屏）。
2. 新分頁＝全新隔離模組（`mapdata.js`＋`map-tab.js`），對既有已驗收程式的 diff 極小（index.html 加鈕加 section、app.js TAB_IDS +1、css 新節），QA 能單輪驗收。
3. 「只關注當天目標」在地圖分頁內同樣成立：進分頁預設定位今天（isoDate 比對，重用 Task10 的 init 邏輯精神），日期切換不離開分頁。
4. 「綁行程」的實質＝isoDate 對齊 `window.TRIP.itinerary`（日期頭可顯示該天 day/theme），不必實體住在行程分頁裡。
5. 底部 6 分頁在 iPhone 直式可行（390px/6≈65px/鈕，label 2 字 12px 放得下），見 §UI 註記。

---

### 涉及範圍
- [x] 後端／核心邏輯（`make_mapdata.py` 解析腳本、`js/mapdata.js` 生成、`js/map-tab.js` 邏輯層、`app.js` TAB_IDS、sw.js/version.js bump、`Task17.api.md`）
- [x] 前端／UI（index.html 導覽鈕＋`#tab-map` section＋**placeholder-card 清理**、css `.map-*` 樣式節、版面組裝）

---

## A. 資料層：KML → `js/mapdata.js`

### A1. 解析腳本 `make_mapdata.py`（一次性工具，比照 make_coupons.py／make_icons.py）
- 放 repo 根目錄，**不進 PRECACHE**。輸入：KML 路徑（CLI 參數，預設 `C:\Olina\其它\東京\2026東京.kml`）。**KML 原檔不進 repo**。
- 解析（`xml.etree`，namespace `http://www.opengis.net/kml/2.2`）：
  - 每個 `<Folder>`：`<name>` 取**開頭 4 位數字** `MMDD` → isoDate `2026-MM-DD`（`0721`→`2026-07-21`…）。同日多資料夾（`0724-築地`＋`0724 橫濱`）**依檔案內順序合併**為同一天（築地在前）。資料夾名無法解析出 MMDD → **腳本報錯中止**（fail loud，不默默略過）。
  - 每個 `<Placemark>`：取 `<name>` 全文（保留原標註如「【駒形泥鰍鍋 本店】晚餐A」——括號備註有導覽價值，不清洗）＋`<coordinates>`。
  - **座標順序陷阱**：KML 格式為 `經度,緯度,高度`（例 `140.3864853,35.7658492,0`）→ 存成 `{ lat: 35.7658492, lon: 140.3864853 }`。**lat/lon 必須對調**，高度丟棄。
- 輸出 `js/mapdata.js`（UTF-8）：檔頭注釋「由 make_mapdata.py 生成，手改會被覆蓋；資料來源 KML 不進 repo」＋
  ```js
  window.MAPDATA = [
    { isoDate: "2026-07-21", places: [ { name: "成田機場（成田第１航廈）", lat: 35.76..., lon: 140.38... }, ... ] },
    ...  // 依 isoDate 升冪，共 5 天
  ];
  ```
- **腳本自檢（跑完必印摘要）**：總地點數須等於 KML `<Placemark>` 數（現值 49）；天數 5；每點 lat ∈ [35, 36]、lon ∈ [139, 141]（東京/成田/橫濱合理範圍——這是抓 lat/lon 對調錯誤的機械判準），越界即報錯中止。
- 隱私：KML 內容為公開地點名與座標，無個資，`mapdata.js` 入版控合法；腳本不得把 KML 本機路徑以外的任何本機資訊寫進輸出檔。

### A2. 載入與快取
- `index.html`：`mapdata.js` 插 `tripdata.js` 之後（資料檔區）；`map-tab.js` 插 `trip-tab.js` 之後（功能模組區）。**map-tab.js 不 wrap `App.showTab`**（切走分頁無需清理動作），四層 wrap 鏈零變動；index.html A6 載入順序注釋同步更新。
- `sw.js` PRECACHE 加 `./js/mapdata.js`＋`./js/map-tab.js` 兩筆（39→41），離線可看地點清單。

## B. 地圖分頁 UI 與行為

### B1. 分頁註冊與導覽
- `app.js`：`TAB_IDS` 加 `'map'` → `['phrases','translate','camera','trip','map','coupons']`（陣列順序＝導覽視覺順序；`TAB_IDS[0]` fallback 不變仍 phrases）。registerTab/showTab 函式本體**零 diff**——這是 Task1 契約的 additive 擴充，既有五 id 一字不改。
- `index.html`：導覽列**行程與折價券之間**加 `data-tab="map"` 鈕（label「地圖」，icon 與既有五鈕同型式）；新 `<section id="tab-map">` 留空（DOM 由 map-tab.js 動態建構，比照 camera）。
- 6 鈕擠壓註記（frontend）：`--nav-h` 60px 不變；若 12px label 或 28px icon 在 375px 寬裝置出現裁切，允許縮 padding，**不得縮 label 字級至 <11px、不得動既有五鈕的 id/結構**。

### B2. 依天地點清單（「只關注當天目標」）
- `registerTab('map', { onShow })`，onShow 冪等（`_initialized` 慣例）。
- 頂部**日期 chips**（5 顆：`07/21`…`07/25`，可加 Day N）：預設選中＝今天（`getTodayIsoDate` 比對 MAPDATA，比照 trip-tab 邏輯**自寫不 import**——trip-tab.js 零 diff）；今天不在範圍 → 預設第一天。選中日可加「今天」badge。日期選擇存 closure 記憶體，**禁 localStorage**。
- 日期頭：以 isoDate 反查 `window.TRIP.itinerary`（**唯讀** lookup，tripdata.js 零 diff）顯示該天 `day`＋`theme`（查不到 → 只顯示日期，不壞頁）。
- 地點清單：該天 places 依 mapdata 順序渲染，每列＝地點名＋「設起點」「設終點」兩鈕（≥44px 觸控高）。
- **點地點名 → 單點開 Google 地圖**：`https://www.google.com/maps/search/?api=1&query=<lat>,<lon>&hl=zh-TW`（精確座標 pin，先看位置用；`hl=zh-TW` 請 Google 盡量以中文顯示）。
- `#tab-map` 為多子元素 flex 容器（chips＋A/B 列＋清單）：**非內容區子元素一律 `flex-shrink: 0`**（Task11 U2 永續紀律），清單為唯一捲動區。

### B3. A→B 一鍵大眾運輸路線
- A/B 選擇列（固定不捲動）：
  - **A 預設「目前位置」**（deep-link 省略 `origin` 參數時 Google 地圖自動用目前位置——自由行主場景零操作）；可從清單改選任一地點；可一鍵還原「目前位置」。
  - **B**：從清單選，或**自訂終點**——free-text 輸入框（地名/地址皆可，`destination` 接受文字）＋「使用」鈕。輸入框字級 ≥16px（iOS 聚焦縮放紅線）。
  - A⇄B 互換鈕（回程一鍵反向；A=目前位置時互換鈕 disabled）。
  - 跨天混選合法：A/B 選擇在切換日期後**保留**（closure 記憶體），清單只是挑選來源。
- 「查大眾運輸路線」鈕（B 未定時 disabled 非隱藏）：
  - A=目前位置：`https://www.google.com/maps/dir/?api=1&destination=<lat>,<lon>&travelmode=transit&hl=zh-TW`
  - A=地點：加 `&origin=<lat>,<lon>`（`hl=zh-TW` 同樣保留）
  - B=自訂文字：`destination=<encodeURIComponent(text)>`
  - **`hl=zh-TW` 為所有 deep-link（含 B2 單點連結）必帶參數**——請 Google 地圖盡量以中文呈現介面與地名。
  - **必須在使用者手勢的同步呼叫棧內開啟**（iOS 攔彈窗）；iOS standalone PWA 點外部 URL 會跳出 APP 由系統轉交 Google 地圖 App。
- 按鈕旁固定小字：「會離開 APP 開啟 Google 地圖」。
- 離線註記：清單離線可看（precache）；開路線那步需 Google 地圖 App（Olina 自備離線地圖），APP 端不做網路守門、不擋。

### B3-1. Google 地圖語言提示（已拍板決策 4 的落地）
- **frontend 在地圖分頁放一則固定小提示**（靜態文字，位置建議 A/B 選擇列下方或分頁底部，`.map-*` 前綴、不佔清單捲動區、`flex-shrink: 0`）：
  > 「請把 Google 地圖 App 的語言設為繁體中文，主要車站站名才會顯示中文。小站或公車站若 Google 沒有中文資料，仍會顯示日文。」
- 同一段說明**同步補進 repo `README.md` 使用說明**（一句即可，內容同上）。
- 定位：這是「誠實告知的已知限制」，不是 bug——`hl=zh-TW` 只影響 Google 端顯示語言偏好，無中文資料的小站/公車站仍為日文，QA 不得以此判 FAIL。

### B4. 「可編輯」的 v1 範圍（PM 定案）
- **v1 做**：任選當天（或跨天）任一地點當 A/B＋自訂文字終點。這已覆蓋「自由行隨機、原規劃只是參考」的當下需求。
- **v1 不做**（列 Non-scope）：地點庫增刪改名排序（點庫編輯）、A/B 與自訂終點的持久化。**本 Task 零新 localStorage key**——不新增即不用登記、隱私與 QA 面最小。行中若真需要自建點，Google 地圖 App 內直接搜尋即可；點庫編輯若有實需另開 Task。
- **v1 不做地點大字展示**：KML 地點名多為中文標註（含【】備註格式），給日本司機看價值低；showBigText 不接（bigtext.js 零 diff）。後續有真需求（如補日文地址欄）另開 Task。

### B5. 邊界條件 / 錯誤處理
- `window.MAPDATA` 缺載/空陣列 → 分頁顯示失敗文案不壞頁（比照 PHRASES 紀律）。
- 某天 places 為空 → 顯示「本日無地點」。
- 自訂終點輸入空字串/純空白 → 「使用」不生效。
- A、B 同一點 → 允許（Google 地圖自行處理，不值得擋）。
- 地點名含 URL 特殊字元 → 一律 `encodeURIComponent`。

## C. 工程紀律（沿用契約）
- **bump SOP 兩檔三行**：`sw.js` `CACHE_VERSION` v16→**v17** ＋ `js/version.js` `APP_VERSION`＝'v17'（逐字元相等，QA 機械閘）＋ `APP_VERSION_DATE` 更新為 bump 當天。
- 淺色主題；`.map-*` 前綴；字級全硬編碼**禁 `var(--fs-`**（只授權 .trip-*）；無新增 z-index ≥100（本分頁無 overlay）；全路徑相對 `./`。
- **api.js 零 diff**（本 Task 無任何 API 呼叫、無 fetch——deep-link 是 URL 開啟不是請求）；tts.js/bigtext.js/recorder.js/trip-tab.js/tripdata.js/translate-tab.js/camera-tab.js 零 diff。
- backend 產 `Task17.api.md`（MAPDATA schema、map-tab DOM/class 契約、deep-link 組 URL 規則）供 frontend。

## D. placeholder-card 清理（明列納入本 spec 範圍）
依 INDEX.md roadmap 備註的既定決策（動 index.html 的 Task 必須明列一併清、不得「順手」）：本 Task 動 index.html，**將 4 處 Task1 殘留 `.placeholder-card` 佔位 HTML 一併清除**（各 section 本體保留、留空；各分頁 DOM 皆由 JS 建構，視覺零影響）。QA 判準：`grep placeholder-card index.html` ＝ 0；css 若有對應孤兒選擇器一併刪。

## E. QA 機械判準（摘要，QA 自行展開）
1. v17 兩檔逐字元相等＋DATE 更新；PRECACHE 41 筆（+mapdata.js +map-tab.js）。
2. MAPDATA：5 天、總地點數＝49（與腳本自檢摘要一致）、0724 兩資料夾已合併且築地在前、全部 lat∈[35,36]/lon∈[139,141]。
3. deep-link：transit 模式、A=目前位置時無 origin 參數、自訂文字 destination 有 encodeURIComponent、**所有 deep-link（dir＋單點 search）皆含 `hl=zh-TW`**。
4. `map-tab.js` 內 `localStorage` 出現次數＝0；`.map-*` 樣式節內 `var(--fs-` ＝0；無 z-index≥100。
5. 零 diff 清單（§C）逐檔 git diff 驗證；TAB_IDS 六 id 且既有五 id 原樣。
6. index.html `placeholder-card` ＝0；六分頁切換迴歸（wrap 四層 call-through 不受影響）。
7. 離線冷 install：斷網開地圖分頁，清單可見。
7-1. 語言提示：地圖分頁含 B3-1 提示文字；README.md 有對應一句。小站/公車站顯示日文＝已知限制，不判 FAIL。
8. 實際點開 Google 地圖（外部跳轉行為）與 iPhone standalone 手感＝Olina 部署後流程外驗收。

## 不在本次範圍（Non-scope，護欄）
- 不做 Google Directions/Routes API、不做 APP 內互動地圖圖磚（Leaflet / Google Maps JS SDK）——已拍板，執行者不得「升級」。
- 不做地點庫編輯（增/刪/改名/排序/自建點持久化）；不持久化 A/B 與自訂終點（零新 localStorage key）。
- 不接 showBigText/speak（地點名不做大字/播音）；bigtext.js/tts.js 零 diff。
- 不改 trip-tab.js/tripdata.js（TRIP 只唯讀 lookup）；不動翻譯/對話/常用句/折價券/拍照任何邏輯。
- 不改全域 viewport、不動既有五分頁 id/結構、不動四層 wrap 鏈。
- 不做部署（Task7）；不碰個資與隱私分層機制；KML 原檔不進 repo。
- KML 內含的交通「方案A/方案B」等備註列僅原樣呈現為地點，不做方案選擇 UI。

---
（本 spec 為一般功能新增，非完整性敏感問題，無診斷前置。`Task17.ready` 建立後交 SA 影響分析；backend 見 `.sa_done` 才開工。）

---

## 影響範圍分析（SA）

> 全文見 `specs/Task17.impact.md`；此處摘要。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 分頁框架 | app.js TAB_IDS | 加 'map' additive；讀碼確認框架無寫死 5（indexOf 守門＋forEach 遍歷），TAB_IDS[0] fallback 不變，既有五分頁零行為影響 | ✅ |
| 底部導覽列 | index.html #nav-bar | 加第 6 鈕；`.nav-btn{flex:1}` 天然均分無寫死寬度 | ✅ |
| wrap 鏈四層 | coupon-viewer→camera→translate→bigtext | 零變動；map-tab 無錄音/TTS/overlay 故不 wrap 正確；切去 map 觸發既有守門屬自然生效 | ✅ |
| 4 處 placeholder-card | index.html＋style.css 孤兒選擇器 | 讀碼確認四 tab 皆 `innerHTML=''` 覆蓋式建構、無模組依賴佔位節點，清除安全 | ✅ |
| SW/版本 | sw.js＋version.js | PRECACHE 已點算現值 39 → 41；v16→v17 兩檔三行 | ✅ |
| 行程/api | trip-tab.js/tripdata.js/api.js | 全零 diff；TRIP isoDate 07-21～25 與 MAPDATA 5 天完全對齊；deep-link 為頂層導航不經本站 SW | ✅ |

### KML 機械抽驗（SA 已對原檔實測）
49 Placemark／6 Folder（0724 兩夾、築地在前）／全 Point 無 LineString／座標實證 lon,lat 序（忘對調則 49 筆全越界，範圍自檢有效）；1 筆地名 CDATA＋撇號（Luke's Lobster）→ 腳本 places 用 `json.dumps(ensure_ascii=False)` 輸出。

### Backend 注意事項（摘）
MMDD 解析吃 `-` 與空格兩種分隔、解析失敗與非 Point 皆 fail loud；mapdata.js 禁本機資訊/版號字串；app.js 只動 TAB_IDS 一行；產 Task17.api.md；零 diff 清單見 §C。

### Frontend 注意事項（摘）
`#tab-map` section **必帶 `hidden`**（G1，比照 camera）；TAB_IDS 順序與導覽鈕 DOM 順序必須一致（G5）；deep-link 於同步手勢棧 `window.open(url,'_blank')`/anchor＋noopener（G3）；非捲動子元素全 `flex-shrink:0`；自訂終點輸入 ≥16px；placeholder 清理含 style.css 四孤兒選擇器＋兩處注釋。

### Spec 縫隙補完（G1–G7）
G1 section hidden／G2 地名 JS 跳脫用 json.dumps／G3 開啟 API 明定／G4 非 Point fail loud／G5 TAB_IDS-DOM 順序對齊／G6 onShow 刷新不重置 A/B closure 狀態／G7 「今天」init 算一次跨午夜不刷新（比照 trip-tab）。

### QA 迴歸測試清單
- [ ] 六分頁切換迴歸＋既有五分頁渲染零視覺差（placeholder 清除後）
- [ ] wrap 四層守門：camera 取景中／translate 錄音中／券檢視器／大字 overlay 開啟時切 map
- [ ] lastTab='map' 重啟還原；壞值 fallback phrases
- [ ] v17 兩檔＋PRECACHE 41＋冷 install 離線清單
- [ ] MAPDATA 5 天/49 點/合併序/座標範圍；deep-link 三形態 hl=zh-TW 全帶
- [ ] map-tab localStorage=0、var(--fs- =0、placeholder-card=0、零 diff 清單逐檔
- 新功能由 QA 依 spec §E 驗收
