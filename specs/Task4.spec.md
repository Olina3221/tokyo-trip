# Task4.spec.md — 折價券專區（coupons 分頁，離線可用）

> PM 產出。等待 SA 影響分析（`Task4.impact.md`）後 backend 才開工。
> 專案錨定：`specs/INDEX.md`（純靜態 PWA、無後端、GitHub Pages）。

## 模組：coupons 折價券分頁

### 功能描述

在 `coupons` 分頁以「原始券面圖片」為主體展示 18 張店家折價券，支援全螢幕檢視與放大（讓店員辨認券面、掃條碼/QR），完全離線可用。

### 背景與已拍板決策（不重議）

- 已完成：Task1 PWA 骨架（分頁框架、sw.js cache-first）、Task2 常用句＋大字＋語音、Task3 行程頁（tripdata.js 已載真實 TRIP 資料）。
- **已拍板（Olina 明確指示，硬約束）：折價券必須以「原始圖片」顯示，不可只萃取成文字/優惠碼。** 店員要看到實際券面/條碼/官方圖才會認。文字（店名、折扣、效期）只作列表瀏覽的標籤，不取代圖片。
- 已拍板：券圖為店家公開折價圖、無個資，可進公開層（git 追蹤、公開部署）。
- 已拍板：在店使用**一定要離線可看**（店家網路/訊號不可靠）。
- 資料來源：`C:\Olina\其它\東京\折價券\`（**唯讀，不得改動原檔**）。原 19 檔中 `cosmos2026 (1).jpg` 與 `cosmos2026.jpg` MD5 相同（B4EEB4E762CA1196AA15555E3928C9E6），已確認重複，**實際 18 張**。

### 涉及範圍

- [x] 後端／核心邏輯（`js/coupons-tab.js` 新檔、`tripdata.js` COUPONS 區重寫、圖片壓縮產出、sw.js PRECACHE＋bump v4、`Task4.api.md`）
- [x] 前端／UI（index.html script 標籤＋分頁內容、style.css 券卡列表與全螢幕檢視器樣式）

---

## 一、券資料（PM 已逐張辨識，backend 直接採用，不需重讀圖）

分類固定枚舉：`藥妝`｜`電器`｜`量販`｜`百貨`｜`運動`｜`免稅店`

| # | id | 店名 | 分類 | 折扣摘要 | 效期 | 需護照 | 門檻/地區備註 |
|---|----|------|------|----------|------|--------|----------------|
| 1 | biccamera | BicCamera / KOJIMA | 電器 | 免稅10%＋7%(家電相機手錶玩具)/5%(藥妝食品日用)/3%(清酒) | 2026-08-31 | 是（限免稅結帳） | 結帳須掃券面①②兩段條碼；Apple、遊戲主機、Outlet 等除外；獺祭/八海山除外 |
| 2 | laox | LAOX | 電器 | 免稅10%＋8% OFF | 2026-10-31 | 是（免稅店） | 滿 5,000 日圓；限指定門市；遊戲/奢侈品牌/藥品/特價品除外 |
| 3 | cosmos | 科摩思 COSMOS 藥妝 | 藥妝 | 免稅＋5%/7%/9%（滿1萬/3萬/5萬不含稅，最大19%） | 2026-12-31 | 是 | **限 5 分店**：歌舞伎町1丁目、道頓堀、天神大丸前、廣尾站、心齋橋南；一天限用一次；菸酒除外 |
| 4 | tsuruha | 鶴羽藥妝 ツルハドラッグ | 藥妝 | 免稅10%＋3%/5%/7%（滿1萬/3萬/5萬含稅） | 2027-12-31 | 是 | 結帳前出示；不可與其他優惠併用 |
| 5 | sundrug | 尚都樂客 Sundrug | 藥妝 | 免稅10%＋3%/5%/7%（滿1萬/3萬/5萬不含稅） | null | 是（限免稅結帳） | 券面未標效期；三段條碼依消費金額擇一掃 |
| 6 | drugeleven | DRUGELEVEN 藥妝11 | 藥妝 | 免稅＋3%/5%/7%（滿1萬/3萬/5萬含稅） | 2026-08-31 | 是 | **門市不在東京**：石垣四店、那霸國際通、福岡縣免稅店 |
| 7 | satudora | 札幌藥妝 サツドラ | 藥妝 | 免稅10%＋5%；滿 38,888（不含稅）＋7% | null | 是 | 券面未標效期；結帳前出示 |
| 8 | edion | EDION 愛電王 | 電器 | 免稅最大10%＋7%(家電手錶相機)/5%(食品藥妝) | 2026-12-31 | 是（免稅需護照） | 免稅門檻 5,000 日圓；Apple/Amazon/手機等除外 |
| 9 | donki | 唐吉訶德 ドン・キホーテ | 量販 | 免稅最高10%＋5%(滿1萬不含稅)/7%(滿3萬不含稅) | null | 是（免稅購買者） | 券面未標效期；**結帳後出示無效** |
| 10 | keio | 京王百貨 新宿店 | 百貨 | 95折（5% OFF） | 2027-03-31 | 是（限訪日遊客） | 滿 3,000 日圓不含稅；優待番號 76-76；特價品/食品/CHANEL/ROLEX 等除外 |
| 11 | seibu-sogo | 西武・SOGO 百貨 | 百貨 | 95折＋免稅 | 2026-12-31 | 是（券面＋本人護照） | 滿 1,000 日圓不含稅；指定店鋪（西武池袋/澀谷等）；精品品牌除外；免稅手續費 1.55% |
| 12 | odakyu | 小田急百貨 新宿 | 百貨 | 6% OFF | 2028-03-31 | 是（限海外居住外國人） | 滿 1,000 日圓含稅；**付款限現金/銀聯/支付寶/微信**（一般信用卡不適用）；食品/餐廳除外 |
| 13 | kintetsu | 近鐵百貨 | 百貨 | 95折 | 2026-12-31 | 是（退稅時出示） | 滿 2,000 日圓不含稅；**門市在關西**（海闊天空總店/奈良/和歌山等）；總店退稅加贈手帕 |
| 14 | daimaru | 大丸松坂屋百貨 | 百貨 | 退稅＋5% OFF＋贈美食券 | 2026-08-31 | 是（訪日外國顧客） | 滿 3,000 日圓含稅；效期內可重複使用；食品/餐廳/咖啡廳除外 |
| 15 | alpen | Alpen / Sports DEPO / GOLF5 | 運動 | 5% OFF＋免稅 | 2026-12-31 | 是（免稅時） | 全店可用；免稅門檻 5,500 日圓含稅；代碼 009Ta_FANTIME |
| 16 | victoria | Victoria / Victoria Golf / L-Breath | 運動 | 5% OFF＋免稅10% | 2026-12-31 | 是（免稅時） | 限東京、神奈川、埼玉、千葉店鋪 |
| 17 | lotte-ginza | 樂天免稅店 銀座 | 免稅店 | 免稅（消費稅+關稅+菸酒稅）＋滿1萬折¥1,000/滿2萬折¥2,000 | 2027-01-31 | 是 | 限銀座店；購買當天起 60 日內經羽田/成田出國；每次出國限用 1 次 |
| 18 | japandutyfree | JAPAN DUTY FREE（成田機場） | 免稅店 | 5% OFF（菸酒同享，加熱菸除外） | 2027-03-31 | 是（機場免稅店） | 結帳出示；條碼 a2833030a |

**渲染順序**：依上表分類分組（藥妝 → 電器 → 量販 → 百貨 → 運動 → 免稅店），組內依上表順序。

### 檔名對應（backend 壓縮產出用；來源唯讀）

| 來源檔（`C:\Olina\其它\東京\折價券\`） | repo 目標檔（`img/coupons/`） |
|---|---|
| BicCamera_260505.png | biccamera.jpg |
| LAOX_2026.jpg | laox.jpg |
| cosmos2026.jpg（`cosmos2026 (1).jpg` 為重複檔，**不搬**） | cosmos.jpg |
| tsuruha2026.jpg | tsuruha.jpg |
| sundrug _funtime.jpg | sundrug.jpg |
| DRUGELEVEN_2026.jpg | drugeleven.jpg |
| 2026sapporo.jpg | satudora.jpg |
| edion2025.jpg | edion.jpg |
| top_zhtw_renewal.jpg（內容實為唐吉訶德） | donki.jpg |
| Keio_2026.jpg | keio.jpg |
| seibu2026.png | seibu-sogo.jpg |
| odakyu.png | odakyu.jpg |
| kintetsu2026.jpg | kintetsu.jpg |
| 大丸松坂屋.jpg | daimaru.jpg |
| 2026Alpen.png | alpen.jpg |
| FunTime_Victoria_202612.jpg | victoria.jpg |
| Lottedutyfree_GINZA_FunTime2026.jpg | lotte-ginza.jpg |
| 成田機場免稅折價卷.jpg | japandutyfree.jpg |

目標檔名全部 ASCII 小寫（避免中文/空白/括號檔名在 GitHub Pages URL 編碼出問題）。

---

## 二、資料結構（取代 tripdata.js 內的 COUPONS 範例；schema 記進 `Task4.api.md`）

```js
// tripdata.js — window.COUPONS（Task4 起為真實資料，取代原文字範例）
window.COUPONS = [
  {
    id: "biccamera",              // 唯一 id，同圖片檔名主幹
    store: "BicCamera / KOJIMA",  // 店名（列表標籤主標）
    category: "電器",             // 固定枚舉：藥妝|電器|量販|百貨|運動|免稅店
    discount: "免稅10%＋最大7% OFF", // 折扣摘要（一行）
    expiry: "2026-08-31",         // ISO 日期字串；券面未標示 → null
    passport: true,               // 是否需護照/限免稅顧客
    notes: "結帳須掃兩段條碼；Apple、遊戲主機等除外",  // 門檻/地區/注意事項（一~兩行）
    area: "",                     // 地區警示標籤；非東京可用店時必填（如「門市在沖繩/福岡」），一般留空字串
    img: "./img/coupons/biccamera.jpg",  // 相對路徑（A5）
  },
  // ...共 18 筆，內容依上方辨識表
];
```

規則：
- `tripdata.js` 是單檔雙契約（SYSTEM_MAP）：**只改 COUPONS 區塊，`window.TRIP` 一個字元都不准動**；檔頭隱私警告保留。原「此區塊原樣保留不動」註解由本 Task 取代為正式資料。
- 內容變更必須 bump `CACHE_VERSION`（cache-first 吃舊資料症狀隱蔽）。
- 文案一律繁體中文。

---

## 三、影像處理與離線策略（PM 建議，SA 影響分析定案）

### 現況與風險（必須正視）

- 18 張原圖共約 29.5MB，最大 tsuruha2026.jpg 7.8MB（5386×9595）。
- **iOS Safari/PWA 有 Cache Storage 容量上限，30MB 全預快取有觸頂風險**；且首次載入重（飯店 wifi 下載 30MB）。
- 但離線可看是硬需求 → 結論：**先壓縮，再全量預快取**。

### 建議方案 A（PM 推薦）：壓縮 → 全部進 PRECACHE

1. **壓縮規格**：長邊 ≤ 2000px、等比縮放、不裁切，輸出 JPEG quality ≈ 82（PNG 一律轉 JPEG）。預估總量 4–7MB。
2. 工具：Python + Pillow（repo 已有 `make_icons.py` 先例）；壓縮腳本一次性使用，比照 make_icons.py **不進快取、不進 PRECACHE**。
3. **條碼清晰度守則**：壓縮後 backend 逐張目視檢查條碼/QR 與條碼下方數字是否清晰；模糊者該張放寬到長邊 2600px。條碼數字（如 sundrug `2 491000 149703`）是掃不到時的人工輸入備援，必須可讀。
4. 18 張壓縮圖＋`js/coupons-tab.js` 全部加入 `PRECACHE_URLS`，`CACHE_VERSION` `'v3'` → `'v4'`（A2 SOP）。
5. 原始大圖不進 repo；來源資料夾為長期存檔。

### 備選方案（列出供 SA 比較，PM 不推薦）

- B「cache-on-view」：看過才快取。風險：出發前沒點開過的券，到店裡離線就看不到——違反硬需求，否決理由明確。
- C「進 repo 但不預快取＋『一次下載全部』按鈕」：多做 UI 與下載狀態管理，僅在壓縮後仍超量時才值得；預估 4–7MB 用不到。

### 風險清單（SA 請在 impact.md 覆蓋）

1. 壓縮過度 → 條碼掃不出。緩解：2000px 底線＋逐張目視＋數字備援＋真機驗收（Task7/Olina 流程外）。
2. PRECACHE 一次加 19 筆 → install 時間變長；現有「單檔失敗不炸 install」（A4）機制已涵蓋，但需確認 19 筆逐檔 `cache.add` 在慢網下的表現。
3. iOS 儲存壓力清快取 → SW 重新 install 會重抓；離線期間被清則無救，屬 iOS 平台限制（與 Task3 localStorage 同款風險，文案不需特別處理）。

---

## 四、UI 規格

### 列表（coupons 分頁內）

- `App.registerTab('coupons', { onShow })`（A1），onShow 冪等（比照 trip-tab.js）。
- 依分類分組渲染，組標題：藥妝／電器／量販／百貨／運動／免稅店。
- 券卡（直向排列）：
  - **縮圖**：直接用壓縮圖（CSS 限高約 120–160px、object-fit: cover 或 contain，由 frontend 定），**加 `loading="lazy"`**（避免一次解碼 18 張大圖）。
  - 標籤：店名（主標）＋折扣摘要＋效期（`expiry` null → 顯示「效期：依券面」）＋「需護照」徽章（passport=true）＋ `area` 非空時顯示醒目地區警示（如「⚠ 門市在沖繩/福岡」）。
  - notes 以小字顯示。
- 點券卡 → 開全螢幕檢視器。

### 全螢幕圖片檢視器（新元件，非 showBigText）

`showBigText` 是文字版，不適用；本 Task 自建圖片檢視器，模式參照 Task2 overlay 範式：

- DOM：`#coupon-viewer`，lazy create、直掛 `document.body`、id 唯一、z-index ≥ 100（高於導覽列 10；與 `#bigtext-overlay` 互不依賴）。
- 開啟：顯示該券圖片，初始 fit-to-screen（contain，含 safe-area）。
- **縮放（核心需求，店員要看清條碼）**：
  - 雙擊切換 1x ↔ 約 2.5x；
  - 雙指 pinch 縮放＋單指拖曳平移（放大狀態下）；
  - 用 touch 事件＋CSS transform 自行實作，**不依賴瀏覽器頁面縮放**（PWA viewport 多為 user-scalable=no）；
  - 背景捲動鎖（touchmove preventDefault）**不得吃掉檢視器內的縮放/平移手勢**——鎖的是 overlay 背景，不是圖片手勢層。
- 關閉：✕ 按鈕（觸控目標 ≥ 44px）；**切分頁自動關閉**（比照 bigtext 的 showTab wrap 範式再疊一層 additive wrap，原簽名不變；與既有 wrap 疊加順序不得互相破壞）。
- 檢視器內顯示店名一行小標（可選，frontend 定）；不顯示其他文字，圖片是主角。
- 無 history/pushState 整合（沿 Task2 B5 定案）。

### 業務規則

1. 圖片是主體；任何文字標籤缺漏不得阻斷圖片顯示。
2. 全部 18 張券都收錄（含非東京的 drugeleven、kintetsu，以 area 警示標明——是否移除待 Olina 拍板，見回報）。
3. 不做效期過期判斷/隱藏邏輯（本次 label-only；到期券由 Olina 更新資料）。
4. 本 Task 無需 localStorage 狀態；若未來加「已使用」標記另開 Task（key 需依 A8 前綴登記）。

### 邊界條件 / 錯誤處理

- `window.COUPONS` 未定義或空陣列 → 分頁顯示「折價券資料載入失敗」，不壞頁（比照 phrases 契約）。
- 單張圖片載入失敗（404/快取缺）→ 該卡顯示店名標籤＋「圖片載入失敗」佔位，其餘券不受影響；檢視器對壞圖不開啟或顯示同款訊息。
- 資料筆缺 `img` 或缺 `store` → 該筆跳過渲染並 console.warn，不炸整列。
- 檢視器開啟中切分頁 → 自動關閉（見上）。

---

## 五、sw.js 異動（A2 SOP）

- `PRECACHE_URLS` 新增：`./js/coupons-tab.js` ＋ `./img/coupons/` 下 18 張。
- `CACHE_VERSION`：`'v3'` → `'v4'`。
- config.js 禁令（A3）不變。

## 六、腳本載入順序（A6）

`index.html` 在既有功能模組之後、`</body>` 之前加：

```html
<script src="./js/coupons-tab.js"></script>
```

（tripdata.js 位置不動；coupons-tab.js 在 app.js 之後即可同步呼叫 registerTab。）

---

### 不在本次範圍（Non-scope，必填護欄）

- 不做翻譯/OCR 功能分頁（Task5/6），不建 `js/api.js`。
- 不接任何網路 API、不用任何金鑰。
- 不碰行程（trip-tab.js / import-data.js / `window.TRIP`）與常用句（phrases*）既有邏輯。
- 不處理個資（折價圖無個資；本機層 privateData 不碰）。
- 不做部署（Task7）。
- 不做券的過期自動判斷、已使用標記、排序切換等進階功能。
- 不改五個分頁 id、不動 A1–A8 既有契約簽名。
- 不改動來源資料夾 `C:\Olina\其它\東京\折價券\` 的任何原檔。

---

## QA 驗收重點

1. `CACHE_VERSION === 'v4'`；PRECACHE 含 coupons-tab.js＋18 張圖；config.js 仍不在清單。
2. 離線模擬：coupons 分頁完整可用，18 張圖全部顯示、檢視器可開。
3. `img/coupons/` 總量 ≤ 8MB；逐張抽查條碼/QR 與條碼數字在最大放大下清晰可讀（真機掃碼驗收歸 Task7/Olina 流程外）。
4. 檢視器：雙擊縮放、pinch＋平移、✕ 關閉（≥44px）、切分頁自動關閉、背景不捲動；與 bigtext overlay 互不干擾（先開 bigtext 再開檢視器等交叉情境）。
5. `window.TRIP` 位元級未變（tripdata.js 只動 COUPONS 區）；行程/常用句迴歸冒煙全過。
6. 邊界：COUPONS 清空、單圖改壞路徑 → 依上述邊界行為，不壞頁。
7. 隱私掃描三段式照常跑（qa.md）；另確認 repo 無中文/含空白圖片檔名。
8. Scope 檢查：未越出 Non-scope。

---

## 影響範圍分析（SA）

> 全文見 `Task4.impact.md`（約束編號 C/T/F/O 以該檔為準）。摘要：

### 定案

1. **離線策略：採方案 A（壓縮後全量 PRECACHE + bump v4）**。iOS 配額餘裕數倍，方案 B 違反硬需求否決；方案 C 保留為熔斷退路——`img/coupons/` 目標 ≤8MB、**硬上限 10MB，超過停工回報 PM 改走 C**（C1）。壓縮須處理 EXIF 方向（exif_transpose）與 PNG alpha 鋪白底（C3/C4）。
2. **多 overlay 紀律：additive wrap 疊加＋同分頁互斥責任在開啟方，不建集中式 closeAllOverlays**（O1/O2）。`#coupon-viewer` z-index=110（bigtext 100、未來 overlay 120 起跳，O3）；捲動鎖只鎖背景不吃手勢層（O4）。**Task5/6 前向約束**：同分頁先後開兩種 overlay（Task6 高風險）時開啟方須先關前一個；bigtext 現無公開 close API，屆時需回報 PM 補。O1–O4 全文須寫入 `Task4.api.md`。
3. **spec 假設修正**：本 repo viewport **沒有** user-scalable=no——檢視器須自行以雙指 preventDefault＋gesturestart 抑制頁面縮放，**不得改全域 viewport meta**。
4. **壞圖時檢視器行為定案**：開啟並顯示「圖片載入失敗」訊息（不採「不開啟」）。

### 受影響既有功能（QA 必迴歸）

- **行程分頁**：tripdata.js 單檔共爆——COUPONS 區語法錯誤會讓 TRIP 陪葬（T2）。合法編輯區僅第 316 行起的 COUPONS 區塊，git diff 須單 hunk（T1）。
- **大字 overlay／分頁框架**：showTab 疊第二層 wrap，wrap 必須 call-through（O1）；初始 lastTab 恢復與「切分頁自動關大字」行為不得變。
- **QA 離線驗法升級**：動態回填會掩蓋 precache 失敗，必須**冷 install**（清資料→重 install 不開 coupons→離線→驗 18 張），否則測到假陽性。
- **檔名一致性**：id／img 欄位／PRECACHE 三處逐字元一致、全小寫 ASCII（GitHub Pages 大小寫敏感、本機不敏感，唯一會上線才爆的路徑，F2）。

### 前向成本記錄（不在本 Task 修）

每次 bump CACHE_VERSION 全部券圖重新下載 4–7MB（cache.add 不走自己 fetch handler）；Task5/6/7 各 bump 一次，行前家用 wifi 可接受。已記 SYSTEM_MAP。
