# Task19.impact.md — 影響範圍分析（SA）

> 對象：`Task19.spec.md`（內建常用句刪除＝隱藏＋一鍵總還原）
> 基線：v18 閉環現況（sw.js `CACHE_VERSION` 與 version.js `APP_VERSION` 皆 `'v18'` 逐字元相等已核對；PRECACHE 42 筆已機械數過；`localStorage.clear()` 執行呼叫全 repo = 0，僅 my-phrases.js/import-data.js 註解 3 處禁用字樣）
> 涉及範圍：**backend＋frontend**（pipeline 走 backend → frontend → QA；frontend 極輕＝僅 `.phrases-restore-btn` 一個新樣式）

---

## 1. 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| Task18 自訂常用語 | my-phrases.js / phrases-tab.js `_buildMyPhraseItem` | my-phrases.js additive 加 4 方法＋hidden 專用讀寫工具；既有五方法與 `tokyotrip.myPhrases` key 零變更；`_buildMyPhraseItem` 與自訂句渲染路徑零 diff | ✅ |
| Task8/9 常用句 chips 導覽 | phrases-tab.js `_renderListArea` | 內建句 forEach 加隱藏濾除＋刪除鈕；`<ul>` 後條件渲染還原鈕；chips shell、`phrasesCat` 讀寫、六分類 id、空分類早退判準全零變更 | ✅ |
| Task2 大字/播音契約 | App.showBigText / App.speak | 零新呼叫點、零簽名變更（內建句 body/播放鈕程式碼不動） | 冒煙即可 |
| Task18 翻譯側加入常用語 | translate-tab.js | **全檔零 diff**（唯一消費 `App.myPhrases.add`，物件加 4 個新 key 不影響既有方法） | ✅（迴歸） |
| Task14 版號/SW 更新機制 | sw.js / version.js | 兩檔三行 bump v18→v19；PRECACHE 零增減（維持 42）；app.js 零 diff | ✅（機械） |
| 載入序 | index.html | **零 diff**（無新檔；my-phrases.js 位置 L124 不變） | ✅（機械） |
| trip / coupons / camera / map / 對話模式 | — | 零波及（不動任何相關檔；wrap 鏈維持四層） | 冒煙即可 |
| 靜態句庫 | js/phrases.js | **零 diff**（隱藏只在渲染層濾除；`window.PHRASES` 物件不被改寫） | ✅（機械 grep） |

---

## 2. my-phrases.js 擴充零破壞分析（spec §A）

- **現碼結構確認（實讀）**：模組為 IIFE，`STORAGE_KEY = 'tokyotrip.myPhrases'`，內部工具 `_readAll`/`_writeAll` 綁定該 key，出口物件 `App.myPhrases = { isAvailable, getAll, getByCat, add, remove }`（L138–144）。擴充＝物件 literal 加 4 個 key（hide/isHidden/getHidden/unhideAll）＋新常數 `HIDDEN_KEY = 'tokyotrip.hiddenPhrases'`＋**hidden 專用** `_readHidden`/`_writeHidden`（比照 `_readAll`/`_writeAll` 手法另立，**不得與 myPhrases 的混用**——兩 key 兩套工具，防改壞既有路徑）。
- **零破壞判定**：既有五方法本體零 diff；`tokyotrip.myPhrases` schema/值域零變更；兩個消費者（phrases-tab/translate-tab）對既有方法的呼叫全部不受影響。`isAvailable` 為兩 key 共用（localStorage 層級探測，與 key 無關），不需第二支。
- **hidden 元素過濾判準**（比照 `_readAll` L58–63）：`item && typeof item.zh === 'string' && item.zh !== '' && typeof item.ja === 'string' && item.ja !== ''`——無 catId 欄（簽名不存 catId，spec A1）。壞資料（parse 失敗/非陣列/元素缺欄）回合法子集或 `[]`；下次 `hide` 以合法內容覆蓋整 key。
- **hide 冪等**：已在清單中（zh(trim)+ja 全等命中）→ 不重複寫入、回 `true`。zh/ja 缺或空 → `false`（不寫）。寫入 throw（無痕/配額）→ `false`。
- **unhideAll 鐵律**：實作**只准** `removeItem('tokyotrip.hiddenPhrases')` 包 try/catch——禁逐筆改寫、禁 `localStorage.clear()`（repo 級鐵律，QA 按執行呼叫計、既有註解禁用字樣不計——沿用 Task18 impact §8-8 判準）。
- 純資料層紀律沿用：不碰 DOM/API/TTS。

## 3. phrases-tab.js：濾除＋內建句刪除鈕＋還原鈕（spec §B）

### 3.1 唯一擴充點＝`_renderListArea`

`_renderListArea` 是本輪 phrases-tab.js **唯一動到的既有函式**；`onShow`（Task18 直達重繪版）、`_buildMyPhraseItem`、`_selectCat`、`_buildShell`、`_getInitialCat`、`_saveCat`、`_findCatById`、`_updateChipsActive`、`_render` 九處全部零 diff。擴充三段：

1. **開頭一次讀取（SA 定案，spec A2-5 效能備註落地）**：`_renderListArea` 開頭讀一次隱藏清單＋算一次可用性：
   - `var hiddenList = (App.myPhrases && typeof App.myPhrases.getHidden === 'function') ? App.myPhrases.getHidden() : [];`
   - `var canHide = !!(App.myPhrases && typeof App.myPhrases.hide === 'function' && App.myPhrases.isAvailable());`
   - **禁把 `isAvailable()`（setItem 探測）或 `getHidden()`（parse localStorage）放進 39 句迴圈**；迴圈內用本地陣列比對（zh trim＋ja 雙欄全等，與 hide/isHidden 判準一字不差）。四支 API 照 spec 全數提供（isHidden 給外部/測試用，渲染路徑不逐句呼叫）。
2. **內建句 forEach 內**（L223 起既有迴圈）：
   - 濾除：簽名命中 hiddenList → `return`（該 li 不建）。`hiddenList` 為 `[]`（無隱藏/缺載/無痕/壞資料）→ 不濾、全顯＝現況路徑。
   - 刪除鈕：`canHide` 為 true 時 append `.phrases-delete-btn`（`type='button'`、文字 `🗑`、`confirm('刪除這句常用語？')` 與自訂句逐字一致、≥44px 由既有樣式保證）；confirm 確認 → `App.myPhrases.hide(item.zh, item.ja)` → `_renderListArea(_findCatById(_currentCatId))` 直達重繪（與自訂句刪除路徑同形）。`canHide` false → 不 append（無痕降級，見 §5）。
   - 內建句**其餘結構零變更**：body/zh/ja/romaji span、播放鈕與 `ttsAvailable` disabled 規則、`showBigText({ja,zh,romaji})` 簽名、無 `.phrases-item-mine`、無「自訂」標籤。
3. **`<ul>` append 之後**：`hiddenList.length > 0` 時建 `<button class="phrases-restore-btn">`，文字 `還原已隱藏的常用句（N 句）`（N＝`hiddenList.length`，**全域**計數不分類），append 進 `_listArea`（ul 之後）；click → `confirm('還原所有已隱藏的常用句？')` → 確認 → `App.myPhrases.unhideAll()` → 直達重繪。清單空 → 不建（含無痕：getHidden 回 `[]` 天然不渲染）。

### 3.2 冪等與邊界（實碼核對）

- **冪等**：`_renderListArea` 開頭 `_listArea.innerHTML = ''` 整塊丟棄重建（L201），還原鈕/刪除鈕 listener 隨 DOM 消滅——onShow 重複進入、隱藏/還原後重繪皆不疊 DOM，Task18 冪等契約直接沿用，零新機制。
- **某分類全隱藏＋無自訂句**：`group.items`（靜態）恆非空 → L203 早退**不觸發**（判的是靜態陣列，濾除在其後）——清單區＝空 `<ul>`＋還原鈕，符合 spec B4。`_buildShell` chips 判準（靜態 items 非空）零改動，chips 恆六顆。
- **自訂句與隱藏互不干涉**：濾除只套內建 forEach；自訂句迴圈（`myItems.forEach`）零 diff。邊界：使用者隱藏某內建句後又從翻譯側加入一模一樣的 zh+ja 自訂句 → 自訂句照顯（帶「自訂」標籤）、內建句仍隱藏——兩機制獨立（自訂刪＝真刪 remove、內建刪＝hide），行為自洽非 bug，QA 不得誤判。
- **Task18 §F5「內建句列表項渲染零 diff」判準本輪正當解除**：內建句列自 v19 起帶刪除鈕＋渲染前濾除，行為新權威＝`Task19.spec.md` B2（Task18.spec.md/impact.md 為閉環存檔不回改；冷 context 讀到舊判準不得誤守）。
- **hide/unhideAll 失敗容忍（SA 定案）**：`hide()` 回 false（探測可用但寫入瞬間失敗的極端窗口）→ 重繪後該句仍在，靜默不提示（與自訂句 `remove` 失敗同容忍度，零新 UI）；`unhideAll()` 回 false → 重繪後原樣。

## 4. 簽名失配安全方向（spec B4，SA 核可）

- 未來 `phrases.js` 改字（Task9 式內容整理）→ 舊簽名 zh+ja 失配 → `isHidden` 回 false → 該句**重新顯示**。失效方向＝「多顯示」，不會憑空消失、不會誤隱藏別句——安全方向確認無誤，不做遷移。
- 失配殘留簽名留在 `tokyotrip.hiddenPhrases` 不回收（每筆數十 bytes，上限 39 句規模）——`unhideAll` 全清即歸零；不做 GC（QA 不驗）。
- **跨分類同句現況為空集**（機械核對：39 句 zh(trim)+ja 全域無重複）——spec「跨分類同句一併隱藏」條款現況不觸發，屬正確預留。

## 5. 無痕（localStorage 不可用）降級

- `isAvailable() === false` → `canHide` false → 內建句**不渲染刪除鈕**（防「點了沒反應」）；`getHidden()` 內部 try/catch 回 `[]` → 不濾（全顯）＋還原鈕不渲染。自訂句在無痕下 `getByCat` 回 `[]` 本就不出現——內建/自訂兩側對稱，整頁與 v17 前純內建現況逐位元相同，不彈錯不壞頁。
- `App.myPhrases` 整支缺載（script 失敗極端）→ 上述 guard（`typeof ... === 'function'`）全走降級分支，行為同上。實作點＝§3.1 的 `hiddenList`/`canHide` 兩個開頭判定，**每次 `_renderListArea` 判一次**（spec B2 原文），不做模組級快取（無痕態可能中途變化，每次重繪重判最穩）。

## 6. 零 diff 邊界（QA 越界判準）

以下任何一行 diff 都是越界：

- `js/translate-tab.js` **全檔**（含文字/對話兩模式、Task18 加入常用語流程）。
- `js/phrases.js` 全檔（`window.PHRASES` 物件執行期也不得被改寫——濾除只在渲染層）。
- `index.html`（無新 script、順序零變更）、`js/app.js`、wrap 鏈四層相關檔（bigtext/coupon-viewer/camera-tab）。
- trip / coupons / camera / map 分頁全部檔案；tts.js / recorder.js / api.js / import-data.js。
- phrases-tab.js 中 `_renderListArea` 以外的九個函式本體（§3.1 清單）。
- my-phrases.js 既有五方法本體與 `tokyotrip.myPhrases` 讀寫路徑。
- 既有 localStorage key（myPhrases/phrasesCat/lastTab/translateDir/translateMode/privateData）schema 與值域。

## 7. 版號／快取（機械基線）

- sw.js `CACHE_VERSION 'v18'→'v19'`；version.js `APP_VERSION 'v19'` 逐字元相等＋`APP_VERSION_DATE` 更新為 bump 當天（MM/DD 台灣時區）。**同日特例**：現值 `'07/13'` 為 Task18 同日 bump——若 backend 當天完成，該行零 diff 合法（「為 bump 當天」判準仍成立），QA 不得因該行無 diff 判 FAIL。
- PRECACHE_URLS **零增減**（維持 42 筆，已機械數過；本輪無新檔）。
- 版號字串 `v19` 不得出現在其他任何檔（含註解）。

## 8. spec 縫隙補完（SA 定案，PM 有異議再改）

1. **渲染路徑效能定案**：`getHidden()` 每次 `_renderListArea` 讀一次＋本地比對，禁逐句 `isHidden`/迴圈內 `isAvailable`（§3.1；四 API 照 spec 全提供）。
2. **內建句刪除鈕 aria-label**：`'刪除這句常用語'`（不沿用自訂句的「自訂」字樣；class/文字/confirm 三者與自訂句一致已滿足 spec「使用者不需區分」，aria 描述據實即可）。
3. **hide/unhideAll 失敗靜默容忍**（§3.2 末項）：不加錯誤 UI，重繪後所見即所得。
4. **全隱藏＋無自訂時空 `<ul>` 照建**：ul 空也 append，還原鈕在其後——不為空清單加特例分支（B4「只剩還原鈕」自然達成）。
5. **hidden 讀寫工具獨立**：`_readHidden`/`_writeHidden` 與 `_readAll`/`_writeAll` 分立、`HIDDEN_KEY` 獨立常數（spec A2-3 已列，落成實作紀律：兩 key 禁共用工具函式）。
6. **APP_VERSION_DATE 同日 bump 特例明文化**（§7）。
7. **隱藏×自訂同句共存行為自洽宣告**（§3.2）：QA 遇「隱藏後又加同句自訂」場景以本條為準，非 bug。
8. **失配殘留簽名不回收**（§4）：不做 GC、QA 不驗。

## 9. Backend 注意事項（彙總）

- 只准動四檔：`js/my-phrases.js`（§2）、`js/phrases-tab.js`（§3，唯一擴充函式 `_renderListArea`＋內建句刪除鈕建構程式碼——**不得共用/改動 `_buildMyPhraseItem`**）、`sw.js`、`js/version.js`（§7）。
- 比對判準全檔統一：zh **trim 後**＋ja **全等**，hide/isHidden 內部對 zh trim 防禦（與 remove 同慣例）；渲染側本地比對用同一判準。
- guard 風格沿用現碼：`App.myPhrases && typeof App.myPhrases.getHidden === 'function'`（缺載防禦，比照 L214）。
- 完成必寫 `Task19.api.md`：hide/isHidden/getHidden/unhideAll 四方法契約、`tokyotrip.hiddenPhrases` key 登記（schema `{zh,ja}`）、內建句刪除鈕與 `.phrases-restore-btn` DOM 說明、降級行為——供 frontend 與後續 Task。
- 完成後建 `Task19.done` 前置信號依 signal-flow（本輪含 UI → 建 `.backend_done` 交 frontend）。

## 10. Frontend 注意事項

- **唯一新樣式 `.phrases-restore-btn`**：輕量文字鈕（描邊或純文字＋accent），觸控目標 ≥44px（含 padding 撐足），文字色用 `--c-accent-text`（淺底對比 ≥4.5:1 紀律），置中或靠左自定；淺色主題協調、不做 overlay/動畫、無新增 z-index。
- 內建句刪除鈕沿用 `.phrases-delete-btn`（style.css L3059 既有，52px）——**零新 CSS、零改動**。
- 字級硬編碼，禁 `var(--fs-*)`（type scale 只授權 `.trip-*`，機械判準沿用）。
- `.phrases-list-area` 是捲動內容區非 section 直接子元素，還原鈕隨清單捲動——不涉 `.tab-section` flex-shrink 紀律（chips bar 既有設定不動）。

## 11. QA 迴歸測試清單

- [ ] spec §E 機械判準 1–13 逐項（版號 v19 逐字元＋同日 DATE 特例（§7）／PRECACHE 42＋index.html 零 diff／hiddenPhrases 只在 my-phrases.js＋clear=0 按執行呼叫計＋unhideAll=removeItem／myPhrases 五方法迴歸／phrases.js 零 diff＋chips 六分類／隱藏持久性＋confirm 取消／還原全流程＋還原鈕顯隱／自訂句零回歸／壞資料注入／無痕降級／translate-tab 全檔零 diff＋wrap 四層／onShow 冪等／隱私三段式）
- [ ] Task18 迴歸：翻譯側加入常用語全流程（選分類/duplicate/回饋）、自訂句排最前帶標記、自訂句刪除走 remove 真刪（**不進 hiddenPhrases**——兩 key 互不污染）
- [ ] Task8/9 迴歸：六分類切換、`phrasesCat` 記憶與 fallback、內建句播放/大字、39 句零增刪
- [ ] 邊界：某分類內建句全部隱藏（+無自訂）→ 只剩還原鈕、chips 不消失；隱藏×自訂同句共存（§8-7 自洽行為）；隱藏後切分類/切分頁/重新整理三態持久
- [ ] 冒煙：對話模式、trip/coupons/camera/map 分頁載入正常；離線冷 install（v19 全量 42 筆）
- 新功能驗收依 spec §E；真機手感（隱藏/還原全流程）歸 Olina 部署後流程外、併入 Task7 行前檢查清單。
