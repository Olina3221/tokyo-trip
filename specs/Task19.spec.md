# Task19 — 內建常用句也可刪除（隱藏機制＋一鍵總還原）

> 狀態：待 SA 影響分析
> 前置：Task18（自訂常用語＋刪除鈕）✅ 閉環（現況 v18）
> 佇列：Task7（最終驗收）之前

## 模組：常用句分頁＋自訂常用語儲存模組（擴充）

### 功能描述

常用句分頁的**內建六分類句子**也提供刪除鈕——「刪除內建句」實為**隱藏**（記入 localStorage，渲染時濾除），並在分頁提供**一鍵總還原**，把所有被隱藏的內建句找回來。

### 背景與已拍板決策（不重議）

- 已完成：Task18 閉環——自訂句經 `App.myPhrases` 併入所選分類顯示、帶 `.phrases-item-mine` 標記＋刪除鈕（confirm 防誤觸）；phrases-tab onShow 已擴充為直達重繪當前分類（冪等）。
- Olina 需求：內建句裡有已經會的（如「早安」）、覺得不實用的，要能刪掉讓清單清爽。現況只有自訂句能刪。
- 已拍板：
  - **內建句在靜態打包 `js/phrases.js`，執行期不可真刪**——「刪除」＝隱藏：被刪的內建句記在 localStorage，渲染時濾掉。`phrases.js` 本輪**零 diff**。
  - **識別內建句用 zh＋ja 當穩定簽名**（內建句無唯一 id；index 會因未來內容增刪位移，不可靠）。
  - **刪除 UI 一致**：內建句列也加刪除鈕，沿用 Task18 的 `.phrases-delete-btn`（含 confirm 防誤點）。使用者不需區分內建/自訂——點刪除、句子消失即可（內建刪＝加入隱藏清單；自訂刪＝既有 `App.myPhrases.remove`）。
- PM 定案（v1）：
  - **做一鍵總還原**：隱藏清單非空時，當前分類清單底部渲染輕量還原鈕（一鍵清空隱藏清單、全部內建句恢復）。不做逐類還原（列 Non-scope）。防誤刪後找不回——隱藏是 per-device（localStorage），無還原鈕等於永久，故 v1 必做。
  - **封裝擴充 `js/my-phrases.js`**（不開新檔）：隱藏清單與自訂句同屬「使用者對常用句的自訂」，同一模組管理，載入序/PRECACHE 皆零變動。
  - **無痕降級＝不渲染刪除鈕**：localStorage 不可用時隱藏功能整組無效果、內建句照全顯；為免「點了沒反應」，該情境下內建句**不渲染刪除鈕**（自訂句在無痕下本來就不存在，getByCat 回 `[]`，其刪除鈕天然不出現——兩者對稱）。
- SA/backend/frontend 不得重開已拍板方向；有疑慮記入回報交 PM。

### 涉及範圍

- [x] 後端／核心邏輯（my-phrases.js 擴充隱藏 API、phrases-tab.js 濾除＋內建句刪除鈕＋還原鈕、sw.js/version.js bump）
- [x] 前端／UI（**極輕**：僅新 class `.phrases-restore-btn` 還原鈕樣式；內建句刪除鈕沿用 `.phrases-delete-btn` 既有樣式零新增）

---

## A. 儲存設計（backend，擴充 `js/my-phrases.js`）

### A1. localStorage key（新增登記）

| Key | 值 | 說明 |
|-----|----|------|
| `tokyotrip.hiddenPhrases` | JSON 陣列字串 | 被隱藏的內建句簽名清單（本 Task 新增，本模組獨占） |
| `tokyotrip.myPhrases` | （既有） | **schema 與行為零變更** |

陣列元素 schema（簽名物件，不用分隔符拼接字串——防內容碰撞、可讀可除錯）：

| 欄位 | 型別 | 說明 | 必填 |
|------|------|------|------|
| zh | string | 內建句中文（trim 後存） | 是 |
| ja | string | 內建句日文 | 是 |

不存 catId、不存 ts——簽名唯一目的是渲染時比對濾除；zh+ja 全等即命中，跨分類同句（若有）一併隱藏亦符直覺。

### A2. 模組契約擴充 `App.myPhrases`

既有五方法（isAvailable/getAll/getByCat/add/remove）**零簽名變更**。新增四方法：

- `hide(zh, ja)` → boolean（成功寫入或已在清單皆 `true`（冪等）；zh/ja 缺或寫入失敗 `false`）
- `isHidden(zh, ja)` → boolean（簽名命中即 `true`；讀取失敗/壞資料一律 `false`）
- `getHidden()` → 陣列（`{zh, ja}` 簽名，壞資料過濾後；失敗回 `[]`）
- `unhideAll()` → boolean（**只准 `removeItem('tokyotrip.hiddenPhrases')`**；成功 `true`，例外 `false`）

實作紀律（沿用 Task18 模組既有慣例）：

1. 比對判準：`zh`（trim 後）與 `ja` **雙欄全等**（與 remove 的防禦一致：hide/isHidden 內部對 zh 做 trim 防禦；ja 全等）。
2. 讀寫全包 try/catch（私密瀏覽降級）；**禁 `localStorage.clear()`**（repo 級鐵律）。
3. 壞資料（parse 失敗/非陣列/元素缺 zh 或 ja/非字串）→ 視為不存在，回合法子集或 `[]`；下次 `hide` 以合法內容覆蓋整個 key（比照既有 `_readAll` 手法，另立 hidden 專用讀寫工具函式，不與 myPhrases 的混用）。
4. 純資料層：不碰 DOM／API／TTS。
5. 效能備註：渲染路徑建議 `getHidden()` 一次讀出後本地比對（避免每句 parse 一次 localStorage）；是否逐句 `isHidden` 由 backend 定（句庫僅 39 句，兩者皆可接受），但 API 四支都要提供。

### A3. 載入順序與快取（零變動）

- `index.html` script 順序**零 diff**（my-phrases.js 位置不變）。
- `sw.js` `PRECACHE_URLS` **零增減**（維持 42 筆，無新檔）。

---

## B. 常用句分頁（backend＋frontend）

### B1. 渲染濾除（`_renderListArea` 內建句迴圈）

- 渲染每類內建句時，**濾掉 `zh+ja` 簽名在隱藏清單中的句子**（`App.myPhrases` 缺載或 localStorage 不可用 → 不濾、全顯）。
- 濾除只發生在渲染層：`window.PHRASES` 物件與 `phrases.js` 檔案**零改動**。
- 自訂句渲染路徑（Task18 `_buildMyPhraseItem`）**零 diff**——隱藏機制只針對內建句（自訂句要消失走既有 remove 真刪）。

### B2. 內建句刪除鈕

- 每個內建句列表項**加刪除鈕**：沿用 class `.phrases-delete-btn`、文字 `🗑`、`confirm('刪除這句常用語？')` 文案與自訂句**完全一致**（使用者不需區分）。
- 確認後 → `App.myPhrases.hide(item.zh, item.ja)` → 直達 `_renderListArea(_findCatById(_currentCatId))` 重繪（比照自訂句刪除路徑）。
- **降級**：`App.myPhrases` 缺載或 `isAvailable() === false` → 內建句**不渲染刪除鈕**（每次 `_renderListArea` 判一次即可）。
- 本條**正當解除 Task18 spec §F5「內建句列表項渲染零 diff」判準**——內建句列自本輪起帶刪除鈕、且渲染前經隱藏濾除；行為新權威＝本 spec（Task18.spec.md 為閉環存檔不回改）。內建句**其餘結構零變更**：本體/播放鈕/順序/內容、無 `.phrases-item-mine` 標記、無「自訂」標籤。

### B3. 一鍵總還原鈕

- 位置：`.phrases-list-area` 內、句子清單 `<ul>` 之後（隨 `_renderListArea` 整塊重繪，天然冪等）。
- 顯示條件：`getHidden().length > 0`（**全域**判準，不分類——任一分類有隱藏句，每個分類底部都顯示）；隱藏清單空 → 不渲染。
- 元素：`<button class="phrases-restore-btn">`，文字「還原已隱藏的常用句（N 句）」（N＝`getHidden().length`）。
- 點擊 → `confirm('還原所有已隱藏的常用句？')` → 確認則 `App.myPhrases.unhideAll()` → 重繪當前分類。
- 定位輕量：文字鈕視覺（不做成主要按鈕），但觸控目標 ≥44px。

### B4. 邊界條件

- **某分類內建句全被隱藏＋無自訂句** → 清單區只剩還原鈕（chips bar 恆六分類——`_buildShell` 判的是靜態 `group.items` 非空，零改動；`_renderListArea` 開頭的空分類早退判準亦零改動，濾除發生在其後）。
- **未來 phrases.js 內容改字**（如 Task9 式增刪修句）→ 舊簽名失配、該句重新出現——安全方向（寧可多顯示，不會憑空消失），可接受，不做遷移。
- 壞資料注入 `tokyotrip.hiddenPhrases` → 視同無隱藏、內建句全顯、不壞頁。
- 無痕/私密瀏覽 → 內建句全顯、無刪除鈕（B2 降級）、無還原鈕（getHidden 回 `[]`）、不壞頁。
- onShow 冪等沿用 Task18 擴充（直達重繪當前分類），重複進入不疊 DOM。

### B5. 樣式（frontend，極輕）

- `.phrases-restore-btn`：**唯一新樣式**——輕量文字鈕（次要視覺，如描邊或純文字＋accent 色），置中或靠左由 frontend 定，觸控 ≥44px，淺色主題協調。
- 內建句刪除鈕：沿用 `.phrases-delete-btn` 既有樣式，**零新 CSS**。
- 字級硬編碼，**禁用 `--fs-*`**（type scale 只授權 `.trip-*`，永續紀律）；文字色用既有變數（如 `--c-accent-text`）。

---

## C. 版號 bump（兩檔三行 SOP，repo 級永續紀律）

- `sw.js` `CACHE_VERSION`：開工時實際值 +1（現況 **v18→v19**）。
- `js/version.js` `APP_VERSION` 同步（逐字元相等＝QA 機械閘）＋ `APP_VERSION_DATE` 更新為 bump 當天（MM/DD，台灣時區）。
- `PRECACHE_URLS` 零增減（維持 42 筆）。
- 版號字串不得出現在其他任何檔（含註解）。

## D. 業務規則彙總

1. 內建句「刪除」＝隱藏（localStorage 簽名清單），可逆；自訂句刪除＝真刪（Task18 既有）。使用者介面上兩者無差別。
2. 簽名＝zh(trim)＋ja 雙欄全等；不用 index、不用 catId。
3. 刪除一律 confirm 防誤觸（文案兩類句一致）。
4. 還原＝一鍵全還原（清空隱藏清單）；隱藏清單非空才顯示還原鈕。
5. 靜態 `PHRASES` 與六分類 id 永不因本功能變動。
6. 隱藏是 per-device：換手機/清資料即全部恢復，不做雲端同步。

## E. QA 機械判準（backend 完成時逐項可驗）

1. `js/version.js` APP_VERSION === `sw.js` CACHE_VERSION === `'v19'`；APP_VERSION_DATE 為 bump 當天。
2. PRECACHE_URLS **42 筆零增減**；index.html script 順序零 diff。
3. `tokyotrip.hiddenPhrases` 讀寫只出現在 `js/my-phrases.js`；全 repo `localStorage.clear()` 出現次數 = 0（**按執行呼叫計**，import-data.js/my-phrases.js 既有註解禁用字樣不計——沿用 Task18 impact §8-8 判準）；`unhideAll` 實作為 `removeItem` 非逐筆改寫。
4. `tokyotrip.myPhrases` 既有 schema 與五方法行為零變更（Task18 迴歸：add 去重跨分類/getByCat 新→舊/remove）。
5. `phrases.js` 零 diff；chips bar 恆六分類原順序；`tokyotrip.phrasesCat` 相關程式零 diff。
6. 隱藏流程：內建句點 🗑 → confirm 確認 → 該句消失；**重新整理/重進分頁仍消失**（localStorage 持久）；confirm 取消 → 不消失。
7. 還原流程：隱藏 ≥1 句後每分類底部見「還原已隱藏的常用句（N 句）」；confirm 確認 → 所有被隱藏內建句恢復、還原鈕消失；隱藏清單空時還原鈕不渲染。
8. 自訂句路徑零回歸：自訂句仍排該類最前、帶標記＋刪除鈕、刪除走 remove 真刪（不進 hiddenPhrases）。
9. 壞資料注入 `tokyotrip.hiddenPhrases`（非 JSON／非陣列／元素缺欄）→ 內建句全顯、不壞頁。
10. 無痕降級：內建句全顯、內建句列**無刪除鈕**、無還原鈕、不壞頁。
11. `translate-tab.js` 全檔零 diff（含文字/對話兩模式）；wrap 鏈維持四層零 diff；無新 overlay；無新增 z-index ≥100；`var(--fs-` 不出現在非 `.trip-*` 規則。
12. onShow 重複呼叫不疊 DOM（含隱藏/還原後）。
13. 隱私三段式照常（本輪無個資面，但屬每輪必跑）。

## F. 不在本次範圍（Non-scope，護欄）

- **不改 `phrases.js` 內容**（零 diff——隱藏只在渲染層濾除）。
- 不做內建句編輯（只隱藏）。
- 不做逐類/逐句還原（v1 只做一鍵總還原；若旅途實際需要，登 BACKLOG 後補）。
- 不做隱藏句總覽/回收桶 UI。
- 不做雲端同步（per-device 已拍板）。
- 不碰 `translate-tab.js`（含 Task18 加入常用語流程）、對話模式、Task5 文字翻譯。
- 不碰行程／折價券／地圖／拍照分頁。
- 不改既有 localStorage key 的 schema 與值域（myPhrases/phrasesCat/lastTab/privateData 全零變更；本輪唯一新 key＝`tokyotrip.hiddenPhrases`）。
- 不動 `App.showTab` wrap 鏈、不改 viewport/全域主題、不新增 script 檔。

## G. 分工

- **backend**：`js/my-phrases.js` 擴充四方法（A 全節）、`phrases-tab.js` 內建句濾除＋刪除鈕＋還原鈕（B1–B4）、sw.js/version.js bump（C）。完成必寫 `Task19.api.md`（hide/isHidden/getHidden/unhideAll 契約、`tokyotrip.hiddenPhrases` 登記、`.phrases-restore-btn` DOM 說明）供 frontend/後續 Task。
- **frontend**：僅 `.phrases-restore-btn` 樣式（B5）——內建句刪除鈕沿用既有樣式零新增。工作量極輕但仍走完整階段（backend 建 `.backend_done` → frontend 補樣式 → 建 `.done`）。
- 真機手感（隱藏/還原全流程）由 Olina 部署後流程外驗，併入 Task7 行前檢查清單。

---

## 影響範圍分析（SA）

> 全文見 `Task19.impact.md`；基線 v18 兩檔逐字元相等、PRECACHE 42 筆已機械核對。

### 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| Task18 自訂常用語 | my-phrases.js / `_buildMyPhraseItem` | additive 加 4 方法＋hidden 專用讀寫工具；既有五方法、`tokyotrip.myPhrases`、自訂句渲染路徑零 diff | ✅ |
| Task8/9 chips 導覽 | phrases-tab.js `_renderListArea`（唯一擴充函式） | 內建句 forEach 濾除＋刪除鈕；ul 後條件渲染還原鈕；chips shell/`phrasesCat`/六分類 id/空分類早退全零變更 | ✅ |
| Task18 翻譯側加入 | translate-tab.js | **全檔零 diff** | ✅ |
| Task14 版號機制 | sw.js / version.js | v18→v19 兩檔三行；PRECACHE 維持 42 | ✅（機械） |
| 其他分頁 | trip/coupons/camera/map/對話 | 零波及；wrap 鏈四層零 diff | 冒煙 |

### Backend 注意事項（詳 impact §9）
- 只准動四檔：my-phrases.js／phrases-tab.js（僅 `_renderListArea`＋內建句刪除鈕；禁動 `_buildMyPhraseItem`）／sw.js／version.js。
- `getHidden()` 每次 `_renderListArea` 讀一次＋本地比對（zh trim＋ja 全等），禁逐句 isHidden/迴圈內 isAvailable；hidden 讀寫工具與 myPhrases 的分立；`unhideAll` 只准 removeItem。
- 內建句刪除鈕 aria-label `'刪除這句常用語'`；hide/unhideAll 失敗靜默容忍；全隱藏時空 ul 照建、還原鈕在其後。
- APP_VERSION_DATE 同日 bump（現值 07/13）該行零 diff 合法。

### Frontend 注意事項（詳 impact §10）
- 唯一新樣式 `.phrases-restore-btn`：≥44px、`--c-accent-text`、字級硬編碼禁 `--fs-*`；`.phrases-delete-btn` 零改動。

### QA 迴歸測試清單（詳 impact §11）
- [ ] spec §E 1–13 逐項（含同日 DATE 特例、clear=0 按執行呼叫計）
- [ ] Task18 迴歸：加入常用語全流程；自訂句刪除走 remove 真刪、不進 hiddenPhrases
- [ ] Task8/9 迴歸：分類切換/記憶/播放/大字、39 句零增刪、phrases.js 零 diff
- [ ] 邊界：某分類全隱藏只剩還原鈕、隱藏×自訂同句共存屬自洽行為（非 bug）、無痕降級、壞資料注入
- [ ] translate-tab 全檔零 diff＋其他分頁冒煙＋離線冷 install（42 筆）
- 新功能由 QA 依 spec §E 驗收；真機手感歸 Olina 流程外（Task7 清單）。
