# Task18.impact.md — 影響範圍分析（SA）

> 對象：`Task18.spec.md`（2026-07-13 修訂版——加入時手選分類、自訂句併入既有分類；原 mine chip 設計已取消）
> 基線：v17 閉環現況（sw.js/version.js `'v17'` 逐字元相等已核對；PRECACHE 41 筆已機械數過）
> 涉及範圍：**backend＋frontend**（pipeline 走 backend → frontend → QA；含真 CSS 工作）

## 0. 權威版本澄清（先讀）

`Task18.ready` 與 `INDEX.md` 2026-07-13 開工註記仍是**修訂前**文字（mine chip、`phrasesCat` 值域擴充 `'mine'`、onShow「同步 mine chip」）。**以 `Task18.spec.md` 修訂版為準**：不新增任何 chip、`tokyotrip.phrasesCat` 值域維持六分類 id 零變更、自訂句併入所選分類。PM 閉環時 INDEX 閉環註記請依修訂版收尾，避免冷 context 誤讀（本項不阻擋開工）。

---

## 1. 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| Task5 文字翻譯（16 單元） | translate-tab.js 文字模式 | additive 擴充 4 個明確位點（§2.1 白名單），其餘零 diff | ✅ |
| Task12/13/15/16 對話模式 | translate-tab.js 對話區塊 | 零 diff（僅 showTab wrap 內 additive 一行收合，見 §2.1-D；`_onMicClick`/G4/unlock/`_abortTalk` 本體不動） | ✅ |
| Task8/9 常用句 chips 導覽 | phrases-tab.js | onShow 冪等契約擴充（no-op → 每次重繪當前分類）＋ `_renderListArea` 併入自訂句；chips shell、`phrasesCat` 讀寫、六分類 id 零變更 | ✅ |
| Task2 大字/播音契約 | App.showBigText / App.speak | 新呼叫點（自訂句 `{ja,zh}`／`speak(ja)`），零簽名變更 | ✅（輕） |
| Task14 版號/SW 更新機制 | sw.js / version.js / app.js | 兩檔三行 bump v17→v18、PRECACHE 41→42；app.js 零 diff | ✅（機械） |
| 載入序 | index.html | 插一支 `<script>`（bigtext.js 後、phrases-tab.js 前），其餘順序零變更 | ✅（機械） |
| trip / coupons / camera / map 分頁 | — | 零波及（不動任何相關檔） | 冒煙即可 |

---

## 2. 對話模式與文字模式零 diff 邊界（translate-tab.js）

### 2.1 additive diff 白名單（F4「逐行可解釋」的解釋清單，backend 照此施工、QA 照此驗）

- **A. `_buildDOM` 內新增碼**：`.translate-result-actions` append 第 4 顆鈕 `.translate-action-btn.translate-addphrase-btn`＋分類選擇列容器（插結果動作列下方）＋其 handler。既有 3 顆鈕（大字/播音/複製，L240–242 現況）與事件零 diff。
- **B. `_updateActionBtns()` 加一行**：`_el.addPhraseBtn.style.display = zh2ja ? '' : 'none'`（與大字/播音鈕同進退；`_showResult` 每次呼叫它，方向正確性自動維持）。
- **C. `_clearResultArea()` 尾端加一行** `_collapseCatPicker()`：一行同時覆蓋 spec B2a 的兩個收合觸發——「切換翻譯方向」（dirToggle handler 走 `_clearResultArea`）與「輸入新內容重翻」（translateBtn handler 走 `_clearResultArea`）。dirToggle/translateBtn handler 本體因此**零 diff**。
- **D. showTab wrap 區塊加一行** `_collapseCatPicker()`（覆蓋「切分頁」觸發；放在既有 `translateVisible` 判斷內、`_abortTalk()` 旁，`_abortTalk` 本體零 diff、call-through 零變更、wrap 鏈維持四層）。
- **E.（SA 補定案）`_switchMode` 加一行收合**：spec B2a 收合清單漏列「切到對話模式」——不收合則切回文字模式時選擇列殘留展開。additive 一行，列入白名單。
- **新增 closure 狀態**（純新增，不碰既有變數）：session 分類記憶變數（初值 `'dining'`，值域六 id；**不新增 localStorage key**）＋選擇列 DOM 參照/展開旗標＋ `_collapseCatPicker()` 函式本體。

以上之外，translate-tab.js **任何一行 diff 都是越界**（含對話模式全區、`_lastInput`/`_lastResult`/五錯誤/防連點/500 上限/`tokyotrip.translateDir`/`translateMode`）。

### 2.2 行為正確性核對

- `add({zh: _lastInput, ja: _lastResult, catId})`：`_lastInput` 送出時已 trim（現碼 L275），與 A2 去重「zh trim 後」判準天然一致。守門 `if (!_lastResult) return` 比照複製鈕；錯誤路徑（`_showError`）resultArea 隱藏、加入鈕不可見；方向切換 `_clearResultArea` 清 `_lastResult` → 無舊配對誤存窗口。
- **「點選擇列外收合」實作邊界**（backend 注意）：document click listener **展開時掛、收合時卸**（不常駐）；target `closest` 檢查選擇列與加入鈕自身不收；防「開啟那一次點擊冒泡到 document 立即誤收」（stopPropagation 或掛 listener 前檢查 target）。listener 卸載紀律確保不干擾其他分頁/對話模式。
- duplicate 路徑：點分類 chip → `add` 回 `{ok:true,duplicate:true}` → **同樣收合選擇列**＋按鈕回饋「已在常用語」（視同一次存入嘗試，spec B2-3 文案表已列）。
- 回饋 1.5s 文字暫換期間再點加入鈕 → 照 toggle 展開/收合，無鎖需求（與複製鈕現況同一容忍度）。

---

## 3. phrases-tab.js onShow 冪等擴充（重點複核項）

### 3.1 前提確認（app.js 實讀）

`App.showTab` **每次呼叫都觸發 onShow、無同 id 守門**（含導覽列重按當前分頁）。故 onShow 擴充後：每次切到常用句（含重按）都重繪當前分類清單——`_renderListArea` 現況即整塊 `innerHTML=''` 後重建、listener 隨 DOM 消滅，**天然冪等不疊 DOM**。重繪成本 ≤ 十餘句 DOM，可忽略。

### 3.2 擴充形態（SA 定案，backend 照做）

```
onShow: 未初始化 → _render()（現況路徑，含 PHRASES 缺載錯誤文案的「_initialized 不設」行為零變更）
        已初始化 → _renderListArea(_findCatById(_currentCatId))   ← 直達重繪
```

- **不得走 `_selectCat`**（它會 `_saveCat` 多寫一次 `phrasesCat`——值雖相同，但 F3 要求「`tokyotrip.phrasesCat` 相關程式零 diff」，重繪路徑繞開寫入最乾淨；chips active 態本就未變，也無需 `_updateChipsActive`）。
- `_getInitialCat`/`_saveCat`/`_findCatById`/`_buildShell`/`_selectCat` 五函式本體零 diff；`_renderListArea` 是唯一擴充的既有函式（前置插入自訂句段，內建句 forEach 本體不動——見 §4）。
- 對 Task8/9 的不破壞：chips 集合恆六顆原順序（shell 只建一次）、`phrasesCat` 值域/初始/fallback 鏈零改動、內建句播放/大字簽名零變更、`ttsAvailable` 本就在每次 `_renderListArea` 重算（disabled 播放鈕切換後不復活的既有保證延續）。
- 跨分頁刷新達成：翻譯側 `add` → 切回常用句 → onShow 重繪 → 自訂句可見（spec C3 目標）。刪除鈕 confirm 後 `remove` → 同一直達重繪函式（同分頁內刷新）。

---

## 4. 自訂句併入內建分類渲染

- 每類清單 ＝ `App.myPhrases.getByCat(group.id)`（新→舊）前置 ＋ 內建 `group.items`（原順序）在後。自訂句 li 用**獨立輔助函式**建構（body：zh/ja/romaji `''` 沿用 `item.romaji || ''` 渲染、一律 `textContent` 防注入；點 body → `showBigText({ja, zh})`；播放鈕 → `speak(ja)`，**同守 `ttsAvailable` disabled 規則（比照內建，spec 未明說，SA 補）**；`.phrases-item-mine` 標記＋`.phrases-delete-btn` 刪除鈕 ≥44px＋`confirm('刪除這句常用語？')`）。**內建句 li 建構程式碼與渲染結果零 diff**（不長刪除鈕、無標記）。
- `App.myPhrases` 缺載或 `getByCat` 回 `[]` → 清單＝純內建，與現況逐位元相同（降級路徑 = 現況路徑）。
- **空分類 chip 判準（SA 定案）**：`_buildShell` 維持現碼（只看內建 `items`）。理由：六內建分類皆非空（實數 4/9/9/6/5/6），chips 恆全顯，與 spec C1「現況六分類內建皆非空，故實際上 chips 恆全顯」一致；「某分類只剩自訂句」需先有「內建句被清空」的前置（現況不存在，且 shell 只建一次、無法在 add 後動態長 chip——把 shell 改可重建是為理論死碼加冪等面積）。**限制記入 SYSTEM_MAP 人工補充區**：未來任何 Task 清空某內建分類時，該輪 SA 必須重新處理 chip 判準。

---

## 5. App.myPhrases 封裝（js/my-phrases.js）

- 紀律比照 import-data.js：`isAvailable()` 用 `_tt_test` set/remove 手法（實讀確認 L51–59 現碼可照抄）；讀寫全包 try/catch；**清除只准 `removeItem('tokyotrip.myPhrases')`**（v1 無「全部清除」API，只有逐筆 `remove`）；純資料層不碰 DOM/API/TTS。
- **catId 白名單＝靜態六 id 陣列**（`greetings/dining/shopping/transport/hotel/emergency`——已實讀 phrases.js 核對一致；spec A1 已把六 id 寫成 schema 契約＋「六分類 id 永不因本功能變動」是既有鐵律，故不執行期讀 `window.PHRASES` 導出，保持零依賴）。非法 catId：`add` 回 `{ok:false}`、`getAll`/`getByCat` 過濾剔除。
- 去重：`zh`（trim）＋`ja` 雙欄全等、**跨分類亦重複**（catId 不參與）；重複不寫入不搬家，回 `{ok:true,duplicate:true}`。`remove(zh, ja)` 內部對 zh 補 trim 防禦（呼叫端傳已存資料天然全等，trim 是防禦層）。
- 寫入 unshift 最前（新→舊）＋`romaji:''`＋`ts:Date.now()`；`setItem` throw（無痕/配額）→ `{ok:false}`。壞資料（parse 失敗/非陣列/缺 zh 或 ja/catId 非法）→ 回合法子集或 `[]`，下次 `add` 以合法內容覆蓋整 key（spec A4）。

---

## 6. 載入序／版號／快取（機械基線）

- index.html：`<script src="./js/my-phrases.js">` 插**現況 L122（bigtext.js）與 L123（phrases-tab.js）之間**；app.js 在前（App 物件已存在）、兩消費者 phrases-tab（緊隨其後）與 translate-tab（L133）皆在其後 ✓。其餘 script 順序零變更（wrap 鏈四層不受影響——my-phrases 不 wrap、不碰 showTab）。
- sw.js：`CACHE_VERSION 'v17'→'v18'`＋PRECACHE 加 `./js/my-phrases.js`（**41→42 筆**，41 已機械數過）；version.js `APP_VERSION 'v18'` 逐字元相等＋`APP_VERSION_DATE` 改 bump 當天（MM/DD 台灣時區）。版號字串不得出現於其他任何檔。
- 舊 v17 快取下新檔不存在 → 舊 index.html 不引用它，離線不壞；bump 後全清單重載，標準新檔流程，無特殊風險（PRECACHE 重量前向成本照付，既有已知）。

---

## 7. 無痕（localStorage 不可用）降級

- `isAvailable()===false` 或 `add` 失敗 → 翻譯側按鈕回饋「無法儲存」（B2-3 文案表）。
- `getAll`/`getByCat` 回 `[]` → 常用句照顯六類純內建，與現況逐位元相同；全程不彈錯不壞頁。
- `phrasesCat`/`translateDir`/`translateMode` 既有 try/catch 降級零變更。

---

## 8. spec 縫隙補完（SA 定案，PM 有異議再改）

1. **權威版本**：`.ready`/INDEX 開工註記為修訂前文字，以 spec 修訂版為準（§0）。
2. **收合 hook 白名單**：`_clearResultArea` 尾行＋showTab wrap 一行＋`_switchMode` 一行（spec 漏列模式切換）——§2.1 C/D/E。
3. **空分類 chip 判準的 shell-only 限制**：維持現碼等效零 diff，理論限制記 SYSTEM_MAP（§4）。
4. **自訂句播放鈕比照內建守 `ttsAvailable`**（spec C2 未明說）。
5. **`remove` 內部 zh trim 防禦**（§5）。
6. **點外收合 listener 生命週期**：展開掛/收合卸、closest 守門、防開啟點擊立即誤收（§2.2）。
7. **duplicate 路徑也收合選擇列**（視同存入嘗試，§2.2）。
8. **QA 判準 F3 範圍明確化**：「`localStorage.clear()` 出現次數=0」以**執行呼叫**計——import-data.js 現有 2 處**註解**提及「禁用 localStorage.clear()」字樣（既有、合法），specs/ 內另有多處文字提及；純文字 grep 全 repo 會誤 FAIL。歷輪 QA 已按呼叫計，明文化。

---

## 9. Backend 注意事項（彙總）

- translate-tab.js 只准動 §2.1 白名單 A–E 五個位點；對話模式全區、`_onMicClick`（unlock 唯一呼叫點紀律）、G4 150ms 延遲守門、`_abortTalk` 一律零 diff。
- phrases-tab.js：onShow 擴充走 §3.2 直達重繪，禁走 `_selectCat`；`_renderListArea` 前置插入自訂句段，內建 forEach 本體不動；`_buildShell` 零 diff。
- my-phrases.js 純資料層（§5 全條）；兩消費者一律經 `App.myPhrases`，禁自行 `localStorage.getItem('tokyotrip.myPhrases')`；呼叫前檢查 `App.myPhrases` 存在（缺載＝不可儲存降級）。
- 完成必寫 `Task18.api.md`：`App.myPhrases` 五方法契約、key 登記、新 DOM class 清單（`.translate-addphrase-btn`、分類選擇列 class、`.phrases-item-mine`、`.phrases-delete-btn`）、收合觸發點清單——供 frontend 與後續 Task。

## 10. Frontend 注意事項

- 動作列第 4 顆鈕：沿用 `.translate-action-btn` 基底 ≥44px；`.translate-result-actions` 允許 flex-wrap 換行、不得壓縮按鈕高度；`.translate-input-area` flex-shrink:0 紀律不動。
- 分類選擇列：六 chips flex-wrap、每顆 ≥44px；**預設高亮態（session 記憶/初值 dining）與選中態視覺可分**（描邊 vs 實底）；展開收合走自然文檔流，不做 overlay/動畫、無新增 z-index ≥100。
- `.phrases-item-mine`：「自訂」小標籤＋淺色底，**不靠顏色單獨傳達**、不壓縮句子可讀區；`.phrases-delete-btn` ≥44px、只自訂句有。
- 字級硬編碼，**禁 `var(--fs-*)`**（type scale 只授權 `.trip-*`）；文字色用 `--c-accent-text` 對比紀律；淺色主題全域變數可安全引用（非深底 overlay）。
- 常用句 section 是多子元素 flex 容器：新增元素若落在 chips bar/list area 之外（本輪應該沒有），須守 flex-shrink:0 紀律。

## 11. QA 迴歸測試清單

- [ ] spec §F 機械判準 1–10 逐項（版號 v18 逐字元／PRECACHE 42＋載入序／key 隔離＋clear=0（**按執行呼叫計**，§8-8）／Task5 16 單元＋白名單外零 diff／chips 六分類＋內建句渲染零 diff＋onShow 冪等／方向可見性＋選擇列三態／去重跨分類／壞資料注入／wrap 四層＋無新 overlay＋`--fs-*` 零越界／隱私三段式）
- [ ] Task8/9 迴歸：六分類切換、`phrasesCat` 記憶與 fallback、內建句播放/大字、39 句零增刪（phrases.js 零 diff）
- [ ] Task5 迴歸：方向切換清結果、500 上限、防連點、五錯誤文案、大字/播音/複製
- [ ] Task12/13/15/16 迴歸：對話面對面雙側、雙向自動播 G4（150ms 延遲守門）、unlock 全檔恰一處於 `_onMicClick`、錄音狀態機、切分頁 abort
- [ ] 跨分頁流程：文字模式加句（選分類）→ 切常用句 → 該分類最前可見帶標記；刪除 confirm → 消失；重按當前分頁不疊 DOM
- [ ] 收合三態＋模式切換收合（§2.1-E）；duplicate 第二次選不同分類 → 僅一筆、catId 不搬家、回饋「已在常用語」
- [ ] 無痕降級：加入鈕「無法儲存」、常用句純內建照常
- [ ] 離線冷 install（v18 全量 42 筆）
- 新功能驗收依 spec §F；真機手感（加入→切分頁→重播全流程）歸 Olina 部署後流程外、整併 Task7 清單。
