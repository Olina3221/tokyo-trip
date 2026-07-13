# Task20 Spec：重要資料匯入後訂位資訊排版重疊修復（純 CSS layout fix）

## 模組：行程分頁「重要資料」區塊（`.trip-private-*` 排版樣式）

### 功能描述
修復「重要資料」區塊在匯入含長標籤的訂位資料後，標籤與資料值排版重疊的問題——讓長標籤（訂位）與短標籤（護照/保單）都能不重疊、好讀。

### 背景與已拍板決策（不重議）
- 已完成：Task19 已閉環（v19），功能面全數完成，剩 Task7 部署驗收。本 Task 為 Olina 實機回報 bug，插隊 Task7 之前，**與 Task19 一起部署**（閉環後由 orchestrator 一次 commit Task19+Task20）。
- 症狀（Olina 實機）：匯入重要資料後，「訂位資料」小節的飯店訂位資訊排版重疊。
- 成因（已核實到碼）：`.trip-private-row`（css/style.css L1167）為 flex 橫排，`.trip-private-row-label`（L1176）固定 `width: 72px; flex-shrink: 0`。此設計給短標籤（護照號碼/保單號/公司，≤4 個中文字）；但訂位小節的標籤來自匯入資料本身（trip-tab.js L617 `b.label`，如「MAPLEHOUSE 淺草 訂單編號」「MAPLEHOUSE 房型編號」），任意長度，塞不進 72px → 溢出擠壓/與 value 重疊。**單因、路徑唯一（同一 CSS 規則），非完整性敏感問題，不走診斷前置。**
- 已拍板：純 CSS 修復。不改資料、不改匯入碼格式、不改 trip-tab.js 渲染邏輯、**不需重匯**——修好後 Olina 現有已匯入資料直接顯示正常（資料在 localStorage，本 Task 完全不碰）。
- 沿用契約：淺色主題；`--fs-sm/md` type scale（Task10 授權 `.trip-*` 用五階變數，維持）；safe-area；相對路徑；觸控目標 ≥44px。

### 涉及範圍
- [x] 後端／核心邏輯：**僅版號 bump**（sw.js + version.js 兩檔三行，v19→v20），無任何邏輯變更，不需 `Task20.api.md`
- [x] 前端／UI：`css/style.css` 的 `.trip-private-row` 系列排版修復（本 Task 主體）

分工定案（維持 repo 慣例：sw.js/version.js 歸 backend）：
- backend：兩檔三行 bump v19→v20 ＋ APP_VERSION_DATE 更新為當日 → 建 `Task20.backend_done`
- frontend：CSS 修復 → 刪 `.backend_done`、建 `Task20.done`

### 修法定案（行為要求；具體屬性值由 frontend 定，以下方驗收判準為準）

`.trip-private-row` 由「固定 72px 標籤欄硬橫排」改為**自適應雙模式**：

1. **短標籤**（內容寬 ≤ 既有標籤欄位寬度，即護照號碼/保單號/公司/緊急電話這類）：維持既有觀感——標籤左欄、值右欄、同列橫排，各小節標籤欄視覺對齊不變。
2. **長標籤**（如訂位資料的「MAPLEHOUSE 淺草 訂單編號」）：**自動上下堆疊**——label 完整顯示在上（可換行）、value 全寬顯示在下（沿用既有 `word-break: break-all` 換行），兩者零重疊。

建議實作（frontend 可用等效替代，例如 grid auto 欄，判準為準）：`.trip-private-row` 加 `flex-wrap: wrap`；`.trip-private-row-label` 改 `width: auto; min-width: 72px`（保短標籤對齊）並允許換行；`.trip-private-row-value` 設適當 `flex-basis`/`min-width`，使剩餘空間不足時整體換行到下一行成堆疊。**臨界寬度的取捨以「短標籤觀感不變、長標籤不重疊」兩判準為準，不硬性規定數值。**

### 業務規則
1. 只動 `css/style.css` 中 `.trip-private-*` 排版相關樣式（預期集中在 `.trip-private-row` / `-row-label` / `-row-value`；如需微調同族群選擇器亦限 `.trip-private-*` 前綴）。
2. 電話 `tel:` 連結（緊急聯絡人/旅遊保險）維持可點且觸控目標 ≥44px（既有 `.trip-private-row-value a { min-height: 44px }` 不得弱化）；row `min-height: 44px` 維持。
3. 字級維持既有 type scale：label `--fs-sm`、value `--fs-md`，不改字級指派。
4. 淺色主題配色零變更（只動排版盒模型，不動顏色）。

### 邊界條件 / 錯誤處理
- 長標籤本身超過整行寬（極長字串）：label 自身換行，不得水平溢出容器。
- 混合小節（同一小節內有長有短標籤）：逐列各自判定，允許同節內兩種模式並存。
- iPhone 視口（390px 級）不得出現水平捲動/溢出。
- value 為 `tel:` 連結時的堆疊情境：連結仍完整可點。

### QA 驗收判準（機械優先）
1. **diff 邊界**：git diff 僅 `css/style.css`（限 `.trip-private-*` 樣式）＋ `sw.js`＋`js/version.js`（三行 bump）；`js/trip-tab.js`、`index.html` 及其他一切檔案零 diff。
2. **版號閘**：`CACHE_VERSION === APP_VERSION === 'v20'` 逐字元相等，DATE 已更新；PRECACHE 42 筆零增減。
3. **長標籤不重疊**：以既有匯入機制（`App.privateData.save(測試匯入碼)`）或直接注入含 bookings 長標籤（「MAPLEHOUSE 淺草 訂單編號」「MAPLEHOUSE 房型編號」等）的測試資料，於 iPhone viewport 驗證 label/value 零重疊、內容完整可讀、無水平溢出（建議 Playwright 量測兩元素 boundingBox 不相交）。測畢清除測試資料。
4. **短標籤觀感不變**：護照/保險/緊急聯絡人等短標籤列維持單行橫排、標籤欄對齊。
5. **tel 連結**：可點且高度 ≥44px。
6. 對話/翻譯/常用句/折價券/地圖分頁零 diff（由判準 1 機械涵蓋）。

### 不在本次範圍（Non-scope，必填護欄）
- 不改重要資料的資料內容、資料結構、匯入碼格式（private.js／匯入解析零 diff）
- 不改 `js/trip-tab.js` 渲染邏輯（全檔零 diff）
- 不做重匯、不碰 localStorage 既有資料
- 不動對話/翻譯/常用句/折價券/地圖等其他分頁
- 不重構 `.trip-*` 其他區塊樣式、不調整字級指派或配色
- 不改 PRECACHE 清單、不加新檔

---
（PM 2026-07-13 立案；佇列順序 1，Task7 之前；與 Task19 一起部署。）

## 影響範圍分析（SA）

> 全文見 `Task20.impact.md`；此為摘要。修法定案核實：**spec 建議的 flex-wrap 方案可行，trip-tab.js DOM（label span＋value span）零改**——重疊成因是 label 文字溢出 72px 固定盒，改自適應＋可 wrap 後，flex 佈局引擎保證任何長度組合不重疊。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 重要資料—短標籤列（護照/保險/緊急聯絡人） | `.trip-private-row` 四小節共用 | 同組 CSS 被改，觀感必須不變（單行橫排、72px 對齊） | ✅ |
| 重要資料—tel: 連結 | `.trip-private-row-value a` | 選擇器零 diff 但父佈局變，橫排/堆疊兩情境驗 ≥44px 可點 | ✅ |
| 重要資料—訂位小節（bug 主體） | label＝匯入資料任意長度 | 長標籤堆疊零重疊、無水平溢出 | ✅ |
| trip 其餘區塊＋其他五分頁 | — | 選擇器隔離零影響 | ❌（diff 邊界機械涵蓋） |

### Backend 注意事項
- 兩檔 bump v19→v20；**`APP_VERSION_DATE` 現值已是 '07/13'＝當日，該行可能零 diff 屬合法**——QA 判準為「值＝當日」非「行有 diff」。PRECACHE 42 零增減。

### Frontend 注意事項（約束，全文 impact §2）
- 白名單：僅 `.trip-private-row`/`-row-label`/`-row-value`（微調限 `.trip-private-*` 前綴）。
- **極長標籤防溢出（必要）**：label 保留 `flex-shrink:0` 時必須加 `max-width:100%`（或等效）；不得改用「拿掉 flex-shrink 讓 label 被壓縮」——那是兩窄欄並排、違反堆疊定案。
- value 的換行門檻（min-width/flex-basis）取 180–220px 區間可同時滿足兩判準；具體值 frontend 定，QA 只驗判準。
- 字級（--fs-sm/--fs-md）與 color 行零 diff；row 與 a 的 min-height:44px 不得弱化。
- 堆疊垂直間距：`gap:14px` wrap 後行間偏鬆，建議雙值 `gap: <row-gap> 14px`（白名單內合法）。

### QA 迴歸測試清單（全文 impact §4）
- [ ] diff 邊界＋版號閘（v20 逐字元相等、DATE 值當日、PRECACHE 42）
- [ ] 長標籤堆疊零重疊（boundingBox 不相交）＋極長 label 自身換行不溢出＋混合小節兩模式並存
- [ ] 短標籤列觀感不變（單行橫排、72px 對齊）
- [ ] tel 連結橫排＋堆疊兩情境 ≥44px 可點；長 value break-all 換行正常
- [ ] 測試匯入資料測畢清除＋隱私三段式照常
- 新功能（長標籤堆疊）由 QA 依 spec 判準 3 驗收
