# Task30 — 雲端 session 入口 `CLAUDE.md`＋repo 交接檔 `specs/STATE.md`（旅程中手機改 App 用）

> PM spec v1，2026-10-21。**急件**：Olina 10/22 飛東京、不帶電腦，本 Task 須在今天出發前 commit＋push 到 origin/main。
> Olina 痛點（原話大意）：每個 session 都會忘記上一個 session 被交代的事，所以交接一定要寫、而且**交接要進 git**，她回到電腦 `git pull` 就能接續。

## 功能描述

讓手機 Claude App 的雲端 Claude Code（只看得到 repo 內容）一開工就知道本專案的規矩與現況、改完知道怎麼上線、結束前把交接寫進 git；Olina 回電腦 `git pull` 即可接續。

## 背景與已拍板決策（不重議）

- 已完成：repo 已推到 `https://github.com/Olina3221/tokyo-trip`，main＝origin/main＝`0238b70`（Task29），GitHub Pages 線上 v28 · 10/19，工作樹乾淨。
- 已完成（Olina 流程外）：手機 Claude App 雲端 Claude Code 已設好；Claude GitHub App 已裝在 `Olina3221/tokyo-trip`；公司 GitHub 帳號 `yuchin-coder` 已加為協作者（write）；雲端 session 實測讀得到 v28。
- 雲端 session 的限制（事實）：讀不到 Olina 電腦上的 `~/.claude/CLAUDE.md`、`OneDrive\my-agent\000_Agent\`（BOOTSTRAP／pipeline 規則／記憶），沒有 pm/sa/backend/frontend/qa agent 定義檔，也沒有 `my-agent` 的 `check_state.py`；只看得到 repo。雲端改動預設推到 `claude/...` 分支，要 PR→Merge 到 main 才會部署到 Pages。`東京/`（個資）在 `.gitignore`，雲端沒有。
- 已拍板（Olina）：三項全做（repo `CLAUDE.md`、`specs/STATE.md`、Layer 2 指針）；本批完成後由 main session **commit＋push 到 origin/main**（已授權）。

## PM 裁定

1. **雲端精簡流程**（雲端沒有 agent 定義檔時）：同一 session 依序扮演 PM→實作→QA，但**留痕不省**：先寫 `specs/TaskN.spec.md`（含「影響範圍」小節，取代獨立的 `.impact.md`）→ 實作 → 跑冒煙全綠 → 更新 INDEX／DEVELOPMENT_LOG／STATE → 同一個 PR。**雲端不建任何 sentinel（`.ready`／`.sa_done`／`.done`／`.tested`…）**——sentinel 是多 agent 接力信號，單一 session 建了只會變殘檔。INDEX 狀態欄註明「雲端精簡流程」以利日後追溯；**不要求回電腦後補跑完整 pipeline**（冒煙全綠即視同 QA 通過，Olina 驗收在流程外）。
2. **本機／雲端判別**：讀得到 `C:\Users\chin3\OneDrive\my-agent\000_Agent\context\BOOTSTRAP.md` ＝在 Olina 電腦上，照該處完整 pipeline；讀不到＝雲端，照本 repo `CLAUDE.md` 精簡流程。
3. **雲端 STATE 驗證**：雲端跑不到 `check_state.py`，故把 STATE 的核心紀律（≤4000 字元、四章固定且順序一致、Open Items 每條含「結案條件」）**做進 `qa_smoke_test.py` 新增 T30 判準**，雲端跑冒煙就順帶驗到。本機仍以 `check_state.py` 為權威。
4. **Merge 時機**：雲端開 PR 後把 PR 連結給 Olina；**Merge 只在 Olina 明確說「合併／上線」後才做**（她可自己在 GitHub 按，或叫 session 代按）。一次只開一個未合併 PR；前一個沒合併前不開新 Task（同一 Task 的修正續推同一分支）。開工前一律以最新 `origin/main` 為基底。
5. **版號**：本 Task **不 bump**——新增的 `CLAUDE.md`／`specs/STATE.md` 不在 `PRECACHE_URLS`、App 行為零變化，冒煙改動不影響使用者。（`CLAUDE.md` 內要寫明：凡改到使用者看得到的內容/行為才 bump，純文件不 bump。）
6. **Pages 公開性**：Pages 會把 repo 內 `.md` 一起公開成網址，`CLAUDE.md` 與 `specs/STATE.md` 視同公開文件——只寫規則與現況，不寫任何個資、訂位碼、帳密。

## 涉及範圍

- [x] 後端／核心邏輯（本 repo 角色對應：工程面——repo 根 `CLAUDE.md`、`specs/STATE.md`、`qa_smoke_test.py` 新判準；外加 my-agent Layer 2 兩檔指針）
- [ ] 前端／UI——**不勾**：零 UI 改動。backend 完成後直接建 `Task30.done`。

## §1 repo 根目錄新增 `CLAUDE.md`

給雲端與任何新 session 的入口。繁體中文、精簡（目標 ≤5000 字元，硬上限 6000，T30 機械驗），章節建議如下，**每項必含括號內關鍵字（T30 逐字 grep）**：

1. **語言與溝通**：一律繁體中文、簡短回覆、先給答案（`繁體中文`）。
2. **開工必讀**：依序讀 `specs/STATE.md`（現況與待辦）→ `specs/INDEX.md`（技術棧拍板、角色對應、Task Roadmap；任務編號＝Roadmap 最大 TaskN＋1）→ `specs/SYSTEM_MAP.md`（檔案與依賴；檔很大，用搜尋找相關段，不整讀）（`specs/STATE.md`、`specs/INDEX.md`、`specs/SYSTEM_MAP.md`）。
3. **本機／雲端判別**：見 PM 裁定 2（`BOOTSTRAP.md`）。
4. **雲端精簡流程**：PM 裁定 1 的步驟清單（`TaskN.spec.md`、`影響範圍`、`不建 sentinel` 或等義字句——T30 驗 `sentinel`）。spec 最少含：功能描述、Olina 原話、影響範圍、不在本次範圍、驗收判準。新 spec／新資料檔須加進 `qa_smoke_test.py` 的隱私掃描清單 `scan_files`（`scan_files`）。
5. **冒煙**：`PYTHONUTF8=1 python qa_smoke_test.py`，FAIL＝0 才能開 PR；動到 PRECACHE 要同步改基線的寫死筆數（指向 SYSTEM_MAP「冒煙基線含寫死斷言」段）（`qa_smoke_test.py`、`PYTHONUTF8=1`）。
6. **版號 bump 紀律**：改使用者看得到的內容/行為才 bump；兩檔三行同步——`js/version.js` 的 `APP_VERSION`／`APP_VERSION_DATE` 與 `sw.js` 的 `CACHE_VERSION`，`APP_VERSION` 與 `CACHE_VERSION` 逐字元相等；`APP_VERSION_DATE` 用當天日期 `MM/DD`（`js/version.js`、`APP_VERSION`、`APP_VERSION_DATE`、`sw.js`、`CACHE_VERSION`、`逐字元`）。
7. **個資鐵律**：個資（護照、訂位碼、電話、密碼、WiFi 等）嚴禁進任何 tracked 檔；`東京/` 在 `.gitignore`、雲端沒有；需要個資的需求一律走 App 內既有本機匯入機制，或留給回電腦後處理。冒煙有全 repo 舊個資字樣掃描（T25-7），禁止在任何文件中寫出該禁用字樣原文（`個資`、`東京/`）。`js/config.js` 的 API key 進版控是已拍板例外（靠 referer＋API 限制），不得移除或改動。
8. **上線方式**：從最新 `origin/main` 開 `claude/...` 分支 → commit → 開 PR（標題 `TaskN：…`）→ 給 Olina PR 連結 → Olina 說上線才 Merge → GitHub Pages 約 1～2 分鐘部署 → 開 `https://olina3221.github.io/tokyo-trip/` 看右下/畫面版號是否為新版（PWA 若還是舊版，關掉重開一次讓更新提示出現）（`PR`、`Merge`、`GitHub Pages`、`版號`）。實作者須核對實際版號顯示位置寫正確（`index.html` 的 `#app-version`）。
9. **Session 結束交接（強制）**：每個 session 結束前必須更新 `specs/STATE.md`（覆寫現況、≤4000 字元、四章固定）與 `DEVELOPMENT_LOG.md`（append 本次條目，標題含 TaskN 與「閉環」），並**跟改動同一個 PR 進 main**；沒進 main 的交接等於沒寫（`specs/STATE.md`、`DEVELOPMENT_LOG.md`、`同一個 PR`）。只討論沒改檔的 session，若有新決定或待辦，也要開一個只改 STATE 的 PR。
10. **不做的事**：不改 `.gitignore` 的 `東京/`、不跑 `make_mapdata.py`（會蓋回 7 月舊點，見 INDEX 技術債備註）、不 force push、不直接推 main。

## §2 新增 `specs/STATE.md`（Layer 3 交接檔）

格式依 `C:\Users\chin3\OneDrive\my-agent\000_Agent\context\ARCHITECTURE.md` Layer 3 段，比照 `C:\Python Project\win-update-scheduler\specs\STATE.md`：檔頭兩行引言（現在式、歷史在 DEVELOPMENT_LOG；紀律一句＋「本機驗證 `check_state.py`、雲端由冒煙 T30 驗」）、四個 H2 固定順序 `Current Status`／`In Progress`／`Open Items`／`Last Handoff`，≤4000 字元，Last Handoff 每筆 ≤260 字元，不得重述三層架構定義（check_state 會擋）。內容：

- **Current Status**：`Updated: 2026-10-21`、`Updated by: backend（Task30）`；線上 v28 · 10/19、main＝origin/main（Task30 commit 後實際 hash 由 main session commit 後不必回填，寫「Task30 之後」即可）；錨定檔 `specs/INDEX.md`、雲端入口 `CLAUDE.md`。
- **In Progress**：10/22～10/25 旅程中，期間改動走手機雲端 session（規則見 `CLAUDE.md`），改動以 `claude/*` 分支＋PR 進 main。
- **Open Items**（每條必帶「結案條件」字樣與可查證事實）：
  1. 回到電腦後同步本機：`git pull`，並確認沒有遺留的雲端分支／PR。**結案條件**：本機 `git status -sb` 顯示 main 與 origin/main 同步；`git branch -r --no-merged origin/main` 無 `origin/claude/*`；GitHub 上 `Olina3221/tokyo-trip` 無 open PR（`gh pr list --state open` 為空）。
- **Last Handoff**：一筆，2026-10-21 Task30：建立雲端入口 `CLAUDE.md`＋本檔，指針 `DEVELOPMENT_LOG.md`。

## §3 Layer 2 指針（my-agent，repo 外）

1. `C:\Users\chin3\OneDrive\my-agent\000_Agent\context\PROJECTS.md` Tokyo-Trip 列「Related Context」欄末尾補 `；活狀態：`specs/STATE.md``（比照 ERP／POWER 寫法），其他欄不動。
2. `C:\Users\chin3\OneDrive\my-agent\000_Agent\context\STATE.md` Current Status「各 repo 活狀態」那行括號列舉（目前 `ERP／POWER／萊點／win-update-scheduler`）補 `／Tokyo-Trip`；改完跑 `python C:\Users\chin3\OneDrive\my-agent\000_Agent\scripts\check_state.py` 須 exit 0。其他行不動（該列舉漏了 ulinjia-platform 屬既有差異，不在本次範圍）。

## §4 冒煙新增 T30 判準（`qa_smoke_test.py`，additive）

1. `CLAUDE.md` 存在、≤6000 字元、§1 列出的每個關鍵字逐字出現（每字一條 PASS/FAIL）。
2. `specs/STATE.md` 存在、≤4000 字元；H2 標題恰為四個且順序＝`Current Status`／`In Progress`／`Open Items`／`Last Handoff`；含 `Updated:` 行；`Open Items` 章內每個頂層 `- ` 條目含「結案條件」。
3. 隱私掃描 `scan_files` additive 加入 `CLAUDE.md`、`specs/STATE.md`、`specs/Task30.spec.md`、`specs/Task30.impact.md`。
4. 既有判準一律不改。

## 業務規則

1. 雲端與本機同一套留痕：spec、冒煙、INDEX、DEVELOPMENT_LOG、STATE 一樣不少，差別只在角色由同一 session 扮演、不建 sentinel。
2. 交接以 git main 為唯一真相：沒進 main 的 STATE／LOG 不算交接。

## 邊界條件 / 錯誤處理

- 雲端 session 若無法開 PR 或 merge（權限問題）：告知 Olina 卡在哪一步，交接照寫在分支上，不得改成直接推 main。
- 兩個 PR 都改 STATE.md 會衝突 → 由「一次只開一個未合併 PR」規則預防；萬一衝突，以後合併者重寫 STATE 現況為準。
- STATE 超過 4000 字元：歷史搬進 DEVELOPMENT_LOG，STATE 只留現況。

## 不在本次範圍（Non-scope）

- 不改任何 App 程式碼／資料（`index.html`、`js/*`、`css/*`、`sw.js`、`manifest`），不 bump 版號。
- 不改既有冒煙判準（只 additive 加 T30）。
- 不修 `PYTHONUTF8` 編碼技術債（INDEX 備註既有待辦，不併入）。
- 不在 repo 放 agent 定義檔、不複製 my-agent 的 BOOTSTRAP／signal-flow 內容（`CLAUDE.md` 只寫本 repo 雲端需要的最小規則）。
- 不改 Layer 2 STATE.md 其他行、不補 ulinjia-platform 列舉。
- 不設 GitHub branch protection、不改 Pages 設定。

## 驗收判準（QA 機械驗）

1. `PYTHONUTF8=1 python qa_smoke_test.py` FAIL＝0，且含 T30 全部判準 PASS、既有判準數不減（Task29 基線 93 PASS → 本輪 ≥93＋T30 條數）。
2. `python C:\Users\chin3\OneDrive\my-agent\000_Agent\scripts\check_state.py "C:\Python Project\tokyo-trip\specs\STATE.md"` exit 0；`python ...\check_state.py`（Layer 2）exit 0。
3. `git -C "C:\Python Project\tokyo-trip" status --porcelain` 只含：新增 `CLAUDE.md`、`specs/STATE.md`、`specs/Task30.spec.md`、`specs/Task30.impact.md`；修改 `qa_smoke_test.py`、`specs/INDEX.md`、`specs/SYSTEM_MAP.md`、`DEVELOPMENT_LOG.md`。`js/version.js`／`sw.js` 零 diff。
4. my-agent `git diff` 於 `PROJECTS.md` 只有 Tokyo-Trip 列一處、`000_Agent/context/STATE.md` 只有該列舉行一處。
5. `CLAUDE.md`、`specs/STATE.md` 不含個資（T25-7＋T21 隱私掃描涵蓋）。
6. 人工抽讀：`CLAUDE.md` 的上線步驟與版號位置描述與實際檔案一致。

## 閉環與上線（PM／main session）

- PM 閉環時：INDEX「檔案」區補 `CLAUDE.md`、`specs/STATE.md` 指針；SYSTEM_MAP 檔案結構手動補兩檔（本 repo 無索引生成腳本）；DEVELOPMENT_LOG 閉環條目（含 `QA 退回：N 輪`）；STATE.md Last Handoff 改為閉環後現況。
- **main session**：閉環後 commit（只 stage 上列 repo 檔）並 **push 到 origin/main（Olina 已授權）**；my-agent 那兩檔另行 commit（只 stage 該兩檔，工作樹有其他 session 的未提交變更，勿一併加入）。push 後確認 Pages 仍為 v28（本 Task 不 bump）。

## 影響範圍分析（SA）v1

> 2026-10-21 SA。完整版（含業務層級依賴、基線實跑）見 `specs/Task30.impact.md`。純工程／文件、零 UI → backend 完成直接建 `Task30.done`。基線實跑 PASS 93／FAIL 0。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| T25-7 全 repo 舊個資字樣掃描 | `qa_smoke_test.py` P_OLD 段 | 新 .md（含未追蹤）自動進掃描；文件與 T30 程式碼不得寫出禁用字樣原文或其 regex | ✅ |
| T21 隱私掃描 | `scan_files` 白名單 | additive 加 4 檔；勿寫「密碼: 引號長值」形式範例 | ✅ |
| PRECACHE 44／版號閘 | `sw.js`、`js/version.js` | 不受影響，須零 diff | ✅（隨冒煙） |
| GitHub Pages Jekyll 建置 | repo 無 `.nojekyll` | 新 .md 含 Liquid 開頭符號會擋全站部署 | ✅ |
| 本機 session 載入 repo `CLAUDE.md` | 本機 pm/sa/backend/qa（cwd＝本 repo） | 精簡流程條款若未被判別條款隔離，會干擾本機信號接力 | ✅（人工抽讀） |
| `check_state.py --all`／`state_overview.py` | my-agent scripts | 新 STATE 自動納入全檢 | ✅ |
| `state_inject.ps1` 注入 hook | my-agent `.claude/hooks/` | 觸發表無 tokyo-trip → 本機不自動注入 STATE（D1 待 PM 裁定） | — |

### 待 PM 裁定（不阻擋 backend）
- D1：同批於 `state_inject.ps1` `$triggerTable` 補 tokyo-trip 一列（SA 建議補；採納則驗收 4 改三檔）。

### Backend 注意事項
- CLAUDE.md 開頭先放本機／雲端判別，明寫本機時精簡流程與「不建 sentinel」不適用。
- 禁用字樣、Liquid 開頭符號一律不入 CLAUDE.md／STATE.md／T30 程式碼。
- T30 的 STATE 判定沿用 `check_state.py` 同一套 regex 與 `len(text)`；STATE 內容不得有「Layer N —」定義句。
- CLAUDE.md 不寫死 v28、PRECACHE 44、判準總數；版號徽章＝`#app-version`，畫面右下、導覽列正上方。
- 既有判準零改；Layer 2 兩檔精準 Edit，勿碰 my-agent 其他未提交變更。

### Frontend 注意事項
- 無（不經 frontend）。

### QA 迴歸測試清單
- [ ] 全冒煙 FAIL＝0、PASS ≥ 93＋T30 條數
- [ ] T25-7、T21 隱私掃描全過（含新檔）
- [ ] `js/version.js`／`sw.js` 零 diff、PRECACHE 44
- [ ] check_state：repo STATE、Layer 2、`--all` 皆 exit 0
- [ ] CLAUDE.md／STATE.md 無 Liquid 開頭符號
- [ ] 人工抽讀 CLAUDE.md 判別條款位置與上線／版號描述
- 新功能由 QA 依 spec 驗收

## PM 閉環（2026-10-21）

- QA 第 1 輪 PASS（冒煙 127／0，既有 93 條不減＋T30 34 條；check_state repo／Layer 2／`--all` 皆 exit 0）。QA 退回 0 輪。
- **D1 已採納**（main session 裁定）：my-agent `.claude/hooks/state_inject.ps1` `$triggerTable` 補 `'tokyo-trip' = 'tokyo|東京'`；驗收 4 因此改為 my-agent **三檔**（`PROJECTS.md`、`000_Agent/context/STATE.md`、`state_inject.ps1`），QA 已依三檔驗。
- 追認：backend 改 `Task30.impact.md` T21 列一句（原範例本身會觸發 T21，改為文字描述），語意不變，維持。
- QA 觀察 2（觸發 regex 用裸「東京」，非 SA D1 例句的收窄版）：**PM 裁定保留**。理由：Olina 說「東京」即指本專案；誤觸代價只是多注入一份 ≤4000 字元的 STATE，漏觸則失去「回電腦接續」的本意；同表 POWER 列已有「電費／台電」裸字先例。
- QA 觀察 3（CLAUDE.md §4 引 SYSTEM_MAP 段名為簡稱）：不處理，「寫死斷言」可 grep 定位。
