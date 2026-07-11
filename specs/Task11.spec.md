# Task11.spec — 底部導覽列淺色化＋放大（U1）、常用句分類 chips 裁切修復（U2）、航班/飯店卡淺色化（U3）

> **佇列位置：排在 Task10 之前**（Olina 第三批實機回饋；U2 是壞掉的既有功能、且 U1/U2 都是 css 快修，優先讓常用句可用；Task10 行程下鑽較大，順延。U3 為 Olina 後續實機回報，同屬「淺色收尾」批次併入本任務）。
> **同檔衝突防護（硬性）**：Task11 與 Task10 都改 `css/style.css`，必須依序執行——Task11 先、Task10 後。`Task10.ready` 已由 PM 收回，Task11 閉環後由 PM 重建。
> `CACHE_VERSION`：本任務 bump 為**開工時實際值 +1**（現況 v6，預期 v6→v7）；Task10 屆時再 +1（其 spec 已寫「實際值 +1」，自動吸收）。

## 模組：底部導覽列（index.html `#nav-bar`・css/style.css）＋常用句分頁 chips（css/style.css・必要時 js/phrases-tab.js）＋行程頁航班/飯店卡（css/style.css）

### 功能描述
Olina iPhone 實機（standalone）測試 Task8 淺色版後回報三個 UI 問題：U1 底部導覽列仍是深藍底、字與 icon 偏小、閱讀不直覺；U2 常用句分類 chips 列被裁切，「努力找了一下才看到一點點頂端」；U3 航班卡/飯店卡仍是深藍底＋白字，看了不舒服，要改成淺色底、深色字，與其他內容一致。本任務把導覽列與航班/飯店卡改為淺色、放大導覽列字級/icon，並診斷修復 chips 裁切。

### 背景與已拍板決策（不重議）
- 已完成：Task1–4、Task8 全部閉環並部署 GitHub Pages，Olina iPhone 實測中。
- 已拍板：純靜態 HTML+CSS+原生 JS+SW，無框架無後端；Task8 淺色主題（`:root` 變數已翻轉）；O1–O4 overlay 分帶紀律；淺底上 `--c-accent` 當**文字**用對比不足，文字場景一律用 `--c-accent-text`（#2E5BCC）。
- **已拍板（本任務，Olina 實機回饋）**：導覽列走**淺色主方向**（Olina 偏好）。深色備案（保留深底但字改純白，棄 #7A8DB8）只在淺色實作遇到不可解的問題時**回報 PM 重議**，執行者不得自行切回深色。
- **已拍板（U3，Olina 實機回饋）**：航班卡/飯店卡改**淺色底＋深色字**，與其他內容一致（Olina 明說深色不舒服）。品牌 accent 只作點綴（標籤、班次號、accent 線等），整體淺色。執行者不得自行保留深底或折衷成半深色。
- 本任務**取代** Task8 的兩個深底定案：(a) 導覽列「深底解耦」（`.nav-btn` 硬編碼 #7A8DB8）——導覽列轉淺後改用全域主題變數；(b) B1/A9「航班/飯店卡保留 `--c-primary` 深底＋卡內文字硬編碼白色系」——兩卡轉淺後回歸全域主題變數。`.bigtext-*` / `.cv-*` 兩個深色 overlay 的深底解耦紀律**完全不變**（結案後為深底清單僅存成員）。SA 須在影響分析中標記 SYSTEM_MAP「主題變數與深色元件解耦紀律」條目待更新（把導覽列與航班/飯店卡從深底清單移除），並於結案時反映進 SYSTEM_MAP。
- SA/backend/frontend 不得重開已拍板討論；有疑慮記入回報交 PM，不自行改走別條路。

### 涉及範圍
- [x] 後端／核心邏輯（`sw.js` 僅 bump CACHE_VERSION；**僅當** SA 判定 U2 成因在 phrases-tab.js DOM 結構時才動該檔，否則 backend 近乎 no-op 過場）
- [x] 前端／UI（`css/style.css` 主要；`index.html` 僅必要時——nav DOM 微調或 U2 診斷指向 meta 層）

---

## U1. 底部導覽列淺色化＋放大（frontend）

### 現況
`#nav-bar` 背景 `var(--c-primary)`（深藍 #1F2A5C）＋深底白分隔線；`.nav-btn` 字色硬編碼 `#7A8DB8`（深底灰藍，Task8 解耦定案）；`.nav-icon` 24px（emoji）、`.nav-label` 10px。

### 設計定案（PM 主張，寫死進本 spec）
1. **背景**：`#nav-bar` 改 `#FFFFFF`——比內容底 `--c-bg`（#F5F6F8）亮一階，天然形成區隔；再加**上緣分隔線** `1px solid var(--c-divider)` ＋**向上淺陰影**（建議 `0 -2px 10px rgba(0, 0, 0, 0.06)`，數值 frontend 可微調記回報），讓導覽列在淺底上可辨識。
2. **字色**：`.nav-btn` 非 active 改 `var(--c-text-muted)`（移除硬編碼 #7A8DB8，全檔不得殘留此值於導覽列）；**active 改 `var(--c-accent-text)`**（淺底文字對比紀律；不得用 `--c-accent` 當文字色）。active 可另加輕量指示（如字重 700 或極淺 accent tint 底），frontend 定案記回報。
   - 注意：`.nav-icon` 是 emoji（💬🌐📷🗺️🎫），`color` 對其無效——色彩規則實際作用於 `.nav-label`；icon 的「放大」靠 font-size。
3. **放大**：`.nav-icon` 24px → **28px**；`.nav-label` 10px → **12px**。五個分頁（常用句/翻譯/拍照/行程/折價券）齊套。±1px 內 frontend 可定案記回報。
4. **高度**：若放大後 56px 擁擠，只准調 `:root` 裡 `--nav-h` 的固定部分（56px → 上限 64px）——`.tab-section` 的 bottom 吃同一變數會自動跟隨，**不得在別處另行硬編碼導覽列高度**。
5. 原深底分隔線 `rgba(255,255,255,0.15)`（淺底上隱形）隨第 1 點一併替換。
6. **不動** theme-color meta / manifest 色值（那是頂部狀態列與啟動畫面，與底部導覽無關）。
7. 觸控目標維持 ≥44px；`role="tablist"`/`aria-*` 既有結構不變。

---

## U2. 常用句分類 chips 被裁切（bug：先診斷後修，frontend 為主）

### 症狀（Olina 實機）
`.phrases-chips-bar`（sticky top:0，phrases-tab.js 渲染、Task8 建）在實機上顯示不完整——幾乎整條被裁掉/遮住，只看得到一點點頂端。

### 規則
**先診斷成因、拿到證據再修**，不許盲改碰運氣。成因與修法各一句話記入回報（若動 js 則同步記入 `Task11.api.md`）。候選成因方向（SA/frontend 逐一排除，不限於此）：

1. **flex 壓縮**（症狀最吻合，優先驗證）：`.tab-section` 是 `display:flex; flex-direction:column; overflow-y:auto` 容器，`.phrases-chips-bar` 未設 `flex-shrink: 0`——列表內容高時 chips bar 可能被 flex 壓縮到近 0 高度，只剩頂端一線。
2. **safe-area top 疊加/失效**：Task8 把狀態列 meta 改 `default`＋viewport-fit=cover 在實機 standalone 的互動——`env(safe-area-inset-top)` 是否如假設為 0；`.tab-section { top: var(--safe-t) }`（fixed）與 body `padding-top: var(--safe-t)` 的定位關係。
3. **sticky 與捲動容器互動**：sticky 元素在 `overflow-y:auto` flex 容器內的 iOS 實機表現。
4. **被蓋住**：chips bar z-index:2 與其他 sticky/fixed 元素的層疊關係。
5. **舊快取干擾**（驗證步驟，非修法）：確認實機吃到的是 v6 資產，排除 SW cache-first 供舊 css。

### 驗收標準
iPhone viewport（模擬）下 chips bar **完整高度可見**（含 44px 觸控目標整顆露出）、固定在常用句頁內容頂部、橫向可捲、切分類正常；修法須合理推定實機 standalone 同樣成立（真機最終確認由 Olina 流程外做）。

---

## U3. 航班/飯店卡淺色化（frontend，僅色彩）

### 現況
- 基礎規則：`.trip-flight-card`（style.css 約 697）與 `.trip-hotel-card`（約 789）背景 `var(--c-primary)`（深藍 #1F2A5C）。
- Task8 B1/A9 override block（style.css 約 1198–1244）：卡內文字硬編碼白色系（主文字 `#F0F4FF`、次要 `#B0BDD8`）、divider/邊框/tint 用 `rgba(255,255,255,…)`、卡內大字鈕保留白色系樣式。
- 卡內另有以 `--c-accent` 作前景色處：`.trip-flight-label`、`.trip-flight-arrow`、`.trip-hotel-tel a`；`.trip-flight-route` 背景 `rgba(0,0,0,0.20)`（深卡內的更深區塊）。

### 設計方向（細節 frontend 定案記回報）
1. **移除/改寫整個深藍 override block**（約 1198–1244）：`#F0F4FF`、`#B0BDD8`、`rgba(255,255,255,…)` 系硬編碼全清，卡內文字/divider/note 區/大字鈕回歸全域主題變數與既有淺色慣例（`--c-text` / `--c-text-muted` / `--c-divider`；大字鈕回歸 A6 全域淺色樣式；note 區回歸基礎規則的 `rgba(0,0,0,0.04)` 深色 tint）。
2. **卡底色**：兩卡 `background-color` 改淺色。PM 建議 `#FFFFFF` 卡面＋`var(--c-divider)` 邊框（與 U1 導覽列同一亮階邏輯：比 `--c-bg` 亮一階自然成卡）；frontend 可微調記回報，但必須是淺底深字。
3. **accent 對比紀律（沿用既有拍板）**：卡轉淺後，卡內所有以 `--c-accent` 作**文字**的地方（`.trip-flight-label`、`.trip-hotel-tel a` 等）一律改 `var(--c-accent-text)`；非文字裝飾（accent 線、箭頭圖形感元素）可用 `--c-accent`，由 frontend 依對比判斷定案記回報。
4. **卡內深色 tint 區**（`.trip-flight-route` 的 `rgba(0,0,0,0.20)`）：淺卡上改淺 tint（建議對齊 A5 慣例 `rgba(0,0,0,0.04)` 量級），frontend 定案記回報。
5. **品牌 accent 點綴保留**：標籤（FLIGHT/HOTEL label）、班次號、accent 線等可用品牌色點綴，但整體必須是淺色卡，與 U1 導覽列、既有淺色主題一致。
6. **只准動色彩類屬性**（color、background、border-color、tint、必要的 box-shadow）：**不得動 font-size / line-height / font-weight 層級 / spacing / DOM 結構**——兩卡的字級統一歸 Task10 的 type scale。

### 驗收標準
行程頁航班卡與飯店卡為淺底深字、與周邊內容觀感一致；卡內主/次文字、divider、note 區、電話連結、大字鈕在淺底上對比清晰可讀；大字鈕點開的 `.bigtext-*` overlay 行為與樣式零變更。

---

### 分工

| 角色 | 檔案 | 工作 |
|------|------|------|
| backend | `sw.js` | 僅 bump `CACHE_VERSION`（開工時實際值 +1，預期 v6→v7）；PRECACHE_URLS 零增刪（style.css、index.html、phrases-tab.js 均已在清單）。backend 執行一次，frontend 不得重複 bump |
| backend | `js/phrases-tab.js` | **僅當** SA 影響分析判定 U2 成因在 DOM 結構——做最小結構修正並輸出 `Task11.api.md`；否則零變更 |
| frontend | `css/style.css` | U1 全部＋U2 的 css 側修復＋U3 全部（航班/飯店卡色彩） |
| frontend | `index.html` | 僅必要時：nav DOM 微調、或 U2 診斷證據指向 meta 層的最小修正（不得動 viewport meta 的既有全域設定如縮放行為） |

沿用契約：分頁 id、`registerTab`/`showBigText`/`speak` 簽名、localStorage key、O1–O4 z-index 分帶（導覽列維持 z-index 10）全部不變。

### 業務規則
1. 導覽列淺色底、與內容區有可辨識區隔（亮階差＋分隔線＋陰影），active 分頁用品牌 accent 深階文字色。
2. 五個分頁的字與 icon 放大到本 spec 定案值，觸控目標 ≥44px。
3. chips bar 在常用句頁完整可見、置頂好按。
4. 航班/飯店卡淺底深字、與其他內容一致；品牌 accent 僅作點綴，accent 作文字一律 `--c-accent-text`。
5. `.bigtext-*` / `.cv-*` 兩個深色 overlay 零變更。

### 邊界條件 / 錯誤處理
- 桌面/模擬器（safe-area env 回退 0px）與實機 standalone 兩種環境版面都不得壞。
- 若調了 `--nav-h`：全部五個分頁的內容底部不得被導覽列蓋住（`.tab-section` bottom 變數帶動，QA 迴歸驗）。
- U2 修法不得破壞 chips 橫向捲動與分類記憶（`tokyotrip.phrasesCat`）既有行為。

### QA 驗收重點
1. 迴歸：Task1–4＋Task8 全功能（分頁切換、大字、語音、常用句分類切換與記憶、券圖檢視、匯入碼）；`phrases.js`、`tripdata.js`、`trip-tab.js`、`coupons-tab.js`、`coupon-viewer.js`、`import-data.js`、`app.js`、`tts.js`、`bigtext.js`、`manifest.webmanifest` git diff 零變更（`phrases-tab.js` 僅在 SA 判定動它時允許 diff）。
2. U1 機械驗證：`#nav-bar` 背景非 `--c-primary`/深藍；style.css 導覽列區塊無 `#7A8DB8` 殘留；非 active＝`--c-text-muted`、active＝`--c-accent-text`；`.nav-icon` 28px、`.nav-label` 12px（含 frontend ±1px 定案記錄）；觸控目標 ≥44px。
3. U2：iPhone viewport 模擬下 chips bar 完整可見、sticky 置頂、橫向可捲、切分類正常；回報中已有成因與修法各一句話（含候選成因排除證據）。
4. U3 機械驗證：`.trip-flight-card` / `.trip-hotel-card` 背景非 `--c-primary`/深藍；style.css 兩卡相關區塊無 `#F0F4FF`、`#B0BDD8`、`rgba(255,255,255,…)` 深底殘留；卡內 accent 作文字處＝`--c-accent-text`。
5. U3 界線驗證：`.trip-*` 的 git diff **僅含色彩類屬性**（color/background/border-color/tint/box-shadow），無 font-size、line-height、spacing、DOM/結構 diff；`.trip-flight-*` / `.trip-hotel-*` 以外的 `.trip-*` 規則（日卡、總覽、section 等）零變更。
6. `CACHE_VERSION` 已 +1、PRECACHE_URLS 零增刪。
7. `.bigtext-*` / `.cv-*` 相關規則 git diff 零變更（含卡內大字鈕點開後的 overlay 迴歸）。
8. Non-scope 無越界。

（導覽列淺色觀感、chips 實機顯示、航班/飯店卡淺色觀感的最終目視，由 Olina 部署後流程外確認。）

### 不在本次範圍（Non-scope，必填護欄）
- **不動常用句內容**：`phrases.js` 零變更（句子增刪改屬 Task9，等 Olina 清單）。
- **與 Task10 的界線（本輪已因 U3 放寬，界線如下，不得再擴）**：Task11 只准動 `.trip-flight-*` / `.trip-hotel-*` 的**色彩類屬性**（底色/字色/邊框色/tint）；**字級統一（`--fs-*` type scale、font-size/line-height 層級）與單日下鑽（結構、行為、trip-tab.js）仍全數歸 Task10**，Task11 一律不碰。其餘 `.trip-*` 規則（日卡、總覽、section 標題等）任何屬性都不動。
- 不做翻譯（Task5）/ OCR（Task6），不接任何網路 API。
- 不改折價券與其他分頁的邏輯、結構、內容（U1 只動導覽列本身的視覺）。
- **不動兩個深色 overlay**（`.bigtext-*`、`.cv-*`）的深底設計與任何規則。
- 不改 schema / 不動資料檔（tripdata.js）/ 不新增或修改 localStorage key。
- 不改全域 viewport meta 既有設定（縮放行為等）；不改 theme-color / manifest 色值。
- 不重構 phrases-tab.js（若 U2 需動，僅限裁切成因的最小結構修正）。

### 交接
- SA 依本 spec＋`SYSTEM_MAP.md` 做影響分析，輸出 `Task11.impact.md`（含 U2 成因判定與分工裁決：backend 是否需動 phrases-tab.js），完成後刪 `Task11.ready`、建 `Task11.sa_done`。
- Backend 完成（bump＋條件性 js 修正）建 `Task11.backend_done`（若動 js 附 `Task11.api.md`）。
- Frontend 依 impact.md（＋api.md 若有）完成 U1/U2/U3，刪 `Task11.backend_done`、建 `Task11.done`。
- QA 依上方驗收重點測試。
- **本任務閉環後，PM 重建 `Task10.ready`**（Task10 佇列恢復為下一個）。

---

## 影響範圍分析（SA）

> 全文見 `Task11.impact.md`（2026-07-11）。涉及範圍定案：**前端為主（style.css）；後端僅 sw.js bump v6→v7**。

### U2 成因判定（分工裁決）
`.tab-section` 是 flex column 固定高捲動容器，`.phrases-chips-bar` 未設 `flex-shrink: 0` 且因 `overflow-x: auto` 使自動最小高度歸 0——列表高於容器時壓縮量全落在 chips bar，被壓到只剩頂端一線（候選 1 成立；候選 2/3/4 排除，候選 5 轉為 QA 驗證步驟）。**修法：`.phrases-chips-bar` 加 `flex-shrink: 0;` 一行，歸 frontend（純 CSS）；phrases-tab.js 零變更、不產 Task11.api.md，backend 僅 bump。**

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 底部導覽列 | `#nav-bar`（五分頁常駐） | 深藍→白底、#7A8DB8→變數、icon/label 放大 | ✅ |
| 五分頁內容高度 | `.tab-section` bottom | 放大後內容 ~58px **必超** 56px，`--nav-h` 固定部分須調（建議 60px，僅 :35 一處，:79 自動連動） | ✅ |
| 常用句 chips | `.phrases-chips-bar` | 加 flex-shrink:0；捲動/切換/記憶行為不變 | ✅ |
| 航班/飯店卡 | `.trip-flight-*`/`.trip-hotel-*` | 刪 A9 block（:1198–1244）後卡內文字自動回歸全域變數；卡底 :700/:792 改白、accent 文字 :710/:846 改 `--c-accent-text` | ✅ |
| 卡內大字鈕→overlay | `.trip-btn-bigtext`＋`.bigtext-*` | 鈕回歸 A6 全域淺色版；overlay 零 diff | ✅ |
| 離線快取 | sw.js | v6→v7、PRECACHE 零增刪 | ✅ |

### Backend 注意事項
- 僅 sw.js :19 一行（'v6'→'v7'）；不動 phrases-tab.js、無 api.md。

### Frontend 注意事項
- U1 改點 N1–N6 與 `--nav-h` 二選一定案（建議 60px）見 impact.md §3；U3 改點 T1–T8 見 §4（A9 block 整塊刪、不補等值殘骸）。
- overlay 兩處 `#7A8DB8`（:427、:1579）為合法解耦硬編碼，**保留勿刪**（計數判準 3→2）。
- `--c-primary` 於 U1+U3 後全檔零直接引用：變數保留、:19–20/:139 過時註解更新。

### QA 迴歸測試清單（要點；全文見 impact.md §8）
- [ ] U2 須先於矮 viewport（667px）＋ dining 分類**重現修前症狀**再驗修後完整可見（Task8 QA 假陰性根因：flex 壓縮有觸發條件）
- [ ] 五分頁捲到底：內容不被導覽列蓋、無空隙（--nav-h 連動）
- [ ] 界線機械判準：`.trip-*` diff 白名單（僅色彩類＋A9 整塊刪）、其餘 `.trip-*` 零變更、#7A8DB8 計數 3→2、js 零變更清單、`.bigtext-*`/`.cv-*` 零 diff、sw.js 單行 v7
- [ ] Task1–4＋Task8 全功能迴歸＋隱私掃描三段式
