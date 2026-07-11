# Task8.spec — UX 調整：全 App 淺色主題 + 常用句分類導覽

> 修訂紀錄（2026-07-11，PM）：B2 縮小範圍——**只做分類切換導覽 UI，不動任何句子內容**。原訂「移除寒暄句 5 句、移入 3 句、增補 11 句」全部撤下；Olina 表示部分寒暄其實實用、全部保留，且她將另外整理一份「她可能會用到的句子」清單，內容整理（增/刪/改）待清單到位後**另開任務**（已登錄 INDEX.md roadmap）。B1（淺色主題）維持原訂不變。

## 模組：全域主題（css/style.css・index.html・manifest）＋ 常用句分頁（js/phrases.js・js/phrases-tab.js）

### 功能描述
依 Olina iPhone 實機使用回饋做兩項 UX 調整：(B1) 全 App 由深色底改為淺色底深色字，戶外強光下可讀；(B2) 常用句分頁改為分類切換導覽（一次只顯示一類，不再全部混在一起），**句子內容一字不增不刪不改**。

### 背景與已拍板決策（不重議）
- 已完成：Task1–4 全部閉環（PWA 骨架、常用句+大字+語音、行程頁、折價券 16 張）。Olina 已自行部署 GitHub Pages 並在 iPhone 實測中。
- 已拍板：純靜態 HTML+CSS+原生 JS+SW，無框架；改淺色主題是 Olina 明確要求（「手機上看太吃力」「旅遊在戶外大太陽下淺底更好讀」）；分類導覽是 Olina 明確要求（「幫我分區——交通、用餐、購物」）。
- 已拍板（2026-07-11 修訂）：**常用句內容本 Task 零增刪**。原 spec 的寒暄句精簡與 11 句增補撤下——Olina 表示有些寒暄實用、全留；她會另提供句子清單，內容整理另開任務（見 INDEX.md roadmap）。SA/backend 不得依本 spec 舊版或任何理由「順手」動句子內容。
- 本 Task 插隊優先於 Task5（翻譯）/Task6（OCR）/Task7（部署）——她正在用，先好用。
- SA/backend/frontend 不得重開已拍板討論；有疑慮記入回報交 PM。

### 涉及範圍
- [x] 後端／核心邏輯（phrases.js 僅加結構性 `id` 欄位、phrases-tab.js 分類導覽邏輯、sw.js bump）
- [x] 前端／UI（style.css 主題翻轉＋分類 chips 樣式、index.html theme-color、manifest 色值）

---

## B1. 淺色主題

### 設計定案（PM 主張，寫死進本 spec）

**主 UI 全面淺色；「展示型 overlay」維持深色。** 理由：
- 主 UI（列表、卡片、表單）是 Olina 自己在戶外看的 → 淺底深字。
- **coupon-viewer（券圖檢視器）維持近黑底不動**：券圖本身是白底圖片，黑底燈箱讓圖片邊界清楚、條碼對比最大化，是給店員掃碼的場景，不是閱讀場景。
- **bigtext（大字展示 overlay）維持深底白字不動**：這是「舉起手機給店員看」的場景，深底白超大字是此類展示卡的最高對比慣例（計程車地址卡同理），且與燈箱風格一致。

### 實作範圍（frontend）

1. `css/style.css` `:root` 變數翻轉（主題色集中在變數，以變數翻轉為主）：
   - `--c-bg`：深藍黑 → 淺色（建議近白帶暖/中性灰調，如 `#F5F6F8` 一帶，frontend 定案）
   - `--c-text`：近白 → 深色（可用品牌深藍 `#1F2A5C` 或近黑，frontend 定案，對比度須達 WCAG AA）
   - `--c-text-muted`、`--c-divider` 同步翻轉
   - `--c-primary`（`#1F2A5C`）與 `--c-accent`（`#4D7CF4`）為品牌色，**保留**；用途從「大面積底色」轉為「導覽列/強調元素」
2. 逐一掃描 style.css 中**未走變數的硬編碼色值**（已知至少 style.css:332 附近有「深色高對比」註解區塊、各 Task 樣式區塊內的半透明白 rgba 等），凡屬主 UI 一律配合淺色化；凡屬 `.bigtext-*` 與 `.cv-*`（overlay）一律**不動**。
3. 深色卡片塊（如航班卡 `trip-flight-card` 的 primary 深藍底白字）：**可保留為品牌色塊**——淺色頁面上少量深藍卡片是合理的視覺強調；frontend 判斷整體協調性，QA 以「可讀」為準。
4. `index.html` `<meta name="theme-color">`：`#1F2A5C` → 與新 `--c-bg` 一致的淺色值。
5. `manifest.webmanifest`：`background_color` / `theme_color` 同步改為淺色值（啟動畫面與狀態列跟著變）。
6. iOS 狀態列：現用 `black-translucent`，淺背景下狀態列文字為白色會看不見——frontend 須驗證並處理（可改 `apple-mobile-web-app-status-bar-style` 為 `default`，或在 safe-area 頂部保留深色帶；擇一，記入回報）。
7. 導覽列（`#nav-bar`）配色 frontend 定案：淺底深字或維持品牌深藍底皆可，但 active 分頁狀態必須清楚。

### 固定淺色，不做自動切換
不做 `prefers-color-scheme` 深淺自動切換（單一使用者、單一場景，做雙主題是無人要求的複雜度）。

---

## B2. 常用句分類切換導覽（僅 UI，內容零增刪）

### 資料層（backend）：`js/phrases.js`

**唯一允許的變更＝結構性 schema 欄位**：每個分類物件新增 `id` 欄位（ASCII，穩定鍵，供分類導覽與 localStorage 記憶用）：

```js
{ id: "transport", cat: "交通・問路", items: [ { zh, ja, romaji }, ... ] }
```

**內容鐵則：phrases.js 現有句子一字不刪不改不加。** 全部 6 個既有分類、全部句子（含「問候・基本」的你好/謝謝等寒暄）原樣保留；分類順序、分類名稱（`cat` 字串）、每句的 zh/ja/romaji 均不動。為支援分類切換所需的結構性欄位（分類 `id`）允許新增，但**不得增刪或改動任何句子文字**。QA 以 git diff 驗證：phrases.js 的 diff 只能是每分類新增一行 `id`。

**分類 `id` 指定（backend 照列，順序＝既有檔案順序，不重排）**：

| id | cat（既有，不改） |
|----|------|
| greetings | 問候・基本 |
| dining | 餐廳・點餐 |
| shopping | 購物・付款 |
| transport | 交通・問路 |
| hotel | 飯店・住宿 |
| emergency | 緊急・求助 |

> 內容整理（依 Olina 將提供的句子清單做增/刪/改）**不在本 Task**，已登錄 INDEX.md roadmap 為未來任務，排在 Task8 之後。

### UI 邏輯層（backend）：`js/phrases-tab.js`

1. 頂部**分類 chips 導覽**：sticky 置頂、橫向可捲，比照 trip-tab pill 導覽既有模式（觸控目標 ≥44px）。
2. **選一類只顯示該類**的句子列表；切換即重繪列表區（分類頭 sticky 樣式可簡化——單類顯示下原 `.phrases-cat` 分組頭可移除或保留單一標題，backend 定案記入 api.md）。
3. **預設分類 = transport（交通）**；並以 localStorage 記住上次選的分類，key：`tokyotrip.phrasesCat`（新 key，須登記進 Task8.api.md 與 SYSTEM_MAP key 清單；清除只准 removeItem 自己的 key，全 repo 禁 `localStorage.clear()` 紀律不變）。存值為分類 `id`；讀到不存在的 id（未來分類增刪）時 fallback 到第一類，不壞頁。
4. 點句 → `App.showBigText`、點喇叭 → `App.speak` 行為**完全不變**（沿用 Task2.api.md 簽名）；PHRASES 缺/空顯失敗文案不壞頁的容錯**保留**。
5. 渲染冪等策略沿用（`_initialized` 模式），但分類切換屬使用者操作、允許重繪列表區。

### sw.js（backend）
`phrases.js`、`phrases-tab.js`、`css/style.css`、`index.html`、`manifest.webmanifest` 均已在 PRECACHE_URLS（檔名不變、零新增檔），**只須 bump `CACHE_VERSION` v5 → v6**（A2 SOP；漏 bump 症狀=改了沒生效）。由 backend 執行一次，frontend 不得重複 bump。注意 PRECACHE 重量前向成本：本次 bump 會重載 16 張券圖（約 4.4MB，已知成本，可接受）。

---

### 業務規則
1. 主 UI 淺底深字；`.bigtext-*` 與 `.cv-*` 兩個 overlay 維持深色，一行都不改其配色。
2. 常用句既有句子**全部保留、零增刪、零改字**（含「問候・基本」寒暄句）；唯一允許的 phrases.js 變更是每分類新增 `id` 欄位。發現句子有誤只記入回報交 PM，不自行修改。
3. 分類 chips 一次只顯示一類；預設交通；記住上次分類。
4. 品牌色 `#1F2A5C` / `#4D7CF4` 保留為強調色。

### 邊界條件 / 錯誤處理
- `window.PHRASES` 缺/空 → 失敗文案不壞頁（沿用 Task2 契約）。
- localStorage 不可用（iOS 私密瀏覽）→ 分類記憶靜默降級，預設交通，功能照常。
- `tokyotrip.phrasesCat` 存了已不存在的 id → fallback 第一類。
- 淺色主題下所有既有頁面（trip 分頁 8 視覺區塊、coupons 卡片、badge 色）文字對比必須可讀——QA 逐分頁目視 + 對比度抽查。
- iOS 狀態列文字在淺背景下不可隱形（見 B1 第 6 點）。

### QA 驗收重點
1. 迴歸：Task1–4 功能全過（分頁切換、大字、語音、行程、匯入碼、券圖檢視器）；`app.js`/`tts.js`/`bigtext.js`/`coupon-viewer.js`/`coupons-tab.js`/`import-data.js`/`trip-tab.js`/`tripdata.js` git diff 應為零變更。
2. `.bigtext-overlay` 與 `.cv-overlay` 仍為深色（git diff 確認 overlay 樣式區塊未動）。
3. theme-color / manifest 兩色值 / :root 變數三處一致為淺色系。
4. PHRASES：**內容零增刪零改字**——`js/phrases.js` git diff 只能是每分類新增一行 `id`（6 個分類、id 值依上表）；分類數、句子數、每句 zh/ja/romaji 與修改前完全一致。
5. chips 導覽：預設交通、切換只顯示該類、`tokyotrip.phrasesCat` 記憶、fallback 行為。
6. `CACHE_VERSION === 'v6'`，PRECACHE_URLS 零增刪。
7. Non-scope 無越界。

### 不在本次範圍（Non-scope，必填護欄）
- **不增刪常用句內容**：不移除任何寒暄句、不增補任何新句、不改任何句子的 zh/ja/romaji 文字。內容整理待 Olina 提供清單後另開任務（INDEX.md roadmap 已登錄）。
- 不做翻譯（Task5）/ OCR（Task6）/ 部署自動化（Task7）——不接任何網路 API、不建 `js/api.js`。
- 不重做折價券與行程功能——`tripdata.js`、`coupon-viewer.js`、`coupons-tab.js`、`import-data.js`、`trip-tab.js`、`app.js`、`tts.js`、`bigtext.js` 八檔**零變更**（樣式層淺色化只在 style.css 做）。
- 不改分頁 id、`registerTab`/`showBigText`/`speak`/`openCouponViewer` 任何簽名，不動 O1–O4 overlay 紀律與 z-index 分帶。
- 不改全域 viewport meta（既有硬約束）。
- 不做深淺色自動切換（prefers-color-scheme）、不做主題設定 UI。
- 不新增任何圖片資產、不動 icons/（PWA 圖示不隨主題重做）。
- 不做 `prefers-reduced-motion` 等無人要求的無障礙擴充。

### 交接
- Backend 完成後輸出 `Task8.api.md`（新 PHRASES schema、chips DOM class 清單、`tokyotrip.phrasesCat` 登記、CACHE_VERSION=v6），建 `Task8.backend_done`。
- Frontend 依 api.md 做主題翻轉與 chips 樣式，建 `Task8.done`。
- QA 依上方驗收重點測試。

---

## 影響範圍分析（SA）

> 完整分析見 `specs/Task8.impact.md`（逐行掃描 style.css 1471 行＋index.html＋phrases 兩檔＋sw.js＋manifest）。以下為摘要與**對本 spec 的必要修正**。

### 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 大字 overlay | `.bigtext-*`（bigtext.js 零變更） | 樣式內 3 處引用會翻轉的全域變數（close-btn 字色等），字面不改＝翻轉後關閉鈕隱形 | ✅ |
| 券圖檢視器 | `.cv-*`（coupon-viewer.js 零變更） | 4 處變數穿透（cv-title/cv-close-btn/cv-img-error/header border），翻轉後店員場景關不掉檢視器 | ✅ |
| 行程分頁 | `.trip-*`（trip-tab.js 零變更） | 硬編碼破口最多：pill 隱形、白系分隔線消失、琥珀/亮紅語意色對比壞、**深藍航班/飯店卡內文字走翻轉變數＝整卡不可讀** | ✅ |
| 折價券分頁 | `.coupon-*` | badge 琥珀色（#E8B84B）淺底對比壞、縮圖底白系 tint 隱形 | ✅ |
| 導覽列 | `#nav-bar` | 底色 `--c-primary` 不翻但字色 `--c-text-muted` 會翻；保留深底方案必須解耦字色 | ✅ |
| 常用句分頁 | phrases-tab.js 重構 | 點句→showBigText、播音→speak 簽名不變；chips 與舊 sticky 分組頭 top:0 疊撞需定案 | ✅ |
| 離線快取 | sw.js | 五個改動檔全在 PRECACHE（零增刪），只 bump v5→v6 | ✅ |

### 對本 spec 的必要修正（G1，SA 定案）

業務規則 1「overlay 一行都不改」與 QA 第 2 條「git diff 確認 overlay 區塊未動」**與程式現實矛盾**：`.bigtext-*`/`.cv-*` 內共 7 處引用會翻轉的全域變數（`--c-text`×3、`--c-text-muted`×2、`--c-divider`×1、`:disabled` 底×1），字面不動＝翻轉後 overlay 直接壞。修正為：**配色語意一行都不變**——僅允許該 7 處做「變數→等值硬編碼」解耦（`#F0F4FF`/`#7A8DB8`/`rgba(255,255,255,0.10)`），QA 第 2 條改驗「overlay diff 僅限此 7 處解耦且視覺等值」。清單見 impact.md §2-B。

### 已定案的 spec 開放點

- **iOS 狀態列（B1 第 6 點）**：定案改 `default`（黑字不透明）。連帶 `safe-area-inset-top` 歸 0 已驗證安全（全站 env() 回退 0 模式）；深 overlay 開啟時狀態列維持淺色屬系統限制，接受、QA 不列缺陷。
- **零增刪機械判準（B2）**：基線 6 分類 41 句（8/9/7/6/5/6）。雙判準：`git diff --numstat js/phrases.js` 恰 +6/−0 且逐行僅 id；改後 `JSON.stringify(PHRASES.map(g=>({cat:g.cat,items:g.items})))` 與基線逐字元相等。
- **`tokyotrip.phrasesCat`**：與既有 `tokyotrip.lastTab`/`tokyotrip.privateData` 無衝突，已登記；fallback「第一類」＝ PHRASES[0]，不寫死 greetings。
- **sw.js**：PRECACHE_URLS 零增刪、僅 bump `CACHE_VERSION` v5→v6（backend 執行一次）；「內容變更也要 bump」必守，漏 bump 症狀＝iPhone 上改了沒生效。manifest 色值在已安裝 APP 上可能待「移除重加主畫面」才更新，屬 iOS 特性非缺陷。

### Backend / Frontend 注意事項（摘要）

- Backend：phrases.js 只加 6 行 id；phrases-tab.js 保留容錯/disabled/簽名，新增 chips＋列表重繪＋key 讀寫（try/catch）；空分類 chip 不渲染與分組頭去留定案記入 api.md；sw.js 只動一行。
- Frontend：先翻 :root 變數（含新增文字用深階 accent，`#4D7CF4` 當文字在淺底僅 3.5:1 AA 不過）→ 照 impact.md §2-A 表清 20+ 處硬編碼 → §2-B 做 overlay 等值解耦 → 導覽列解耦 → 狀態列/theme-color/manifest 三處一致淺色。深藍品牌卡二選一（淺色化或整卡解耦）記入回報。

### QA 迴歸測試清單（完整版見 impact.md §9）

- [ ] Task1–4 全功能迴歸（八檔 git diff 零變更）
- [ ] 兩 overlay 深底不變且**關閉鈕/店名/壞圖文案可見**（變數穿透修復驗證）
- [ ] 航班/飯店卡、pill、badge、錯誤文案等 §2-A 破口逐條可讀
- [ ] 真機狀態列黑字可見；theme-color/manifest/:root 三處一致
- [ ] phrases.js 雙判準零增刪；chips 預設 transport/記憶/fallback/私密瀏覽降級
- [ ] `CACHE_VERSION==='v6'`、PRECACHE 零增刪
