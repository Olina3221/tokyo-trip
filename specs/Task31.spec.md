# Task31 — 雲端與本機同一套多 agent pipeline（repo 內 `.claude/agents/` 五角色＋`specs/PIPELINE.md`，取代 Task30 雲端精簡流程）

> PM spec v1，2026-10-21。**急件**：Olina 10/22 飛東京，今天須上線（main session commit＋push origin/main，已授權），並由 Olina 用手機雲端 session 實測。
> Olina 原話：「要 現在就做 把流程跟電腦版一樣」。

## 功能描述

讓手機雲端 Claude Code session（claude.ai/code，只看得到本 repo）改東京專案時，走**跟電腦版一樣**的多 agent pipeline：主 session 只當 router，依信號檔依序派 PM → SA → backend →（frontend）→ QA → PM 閉環，信號檔照舊；取代 Task30 的「雲端精簡流程」（同一 session 扮演全部角色、不建 sentinel）。

## 背景與已拍板決策（不重議）

- 已完成：Task30 已上線 repo 根 `CLAUDE.md`（本機／雲端判別＋雲端精簡流程＋版號／個資／上線／交接規則）、`specs/STATE.md`、冒煙 T30（34 條，冒煙基線 127／0）。
- 事實：電腦版五角色定義在 `C:\Users\chin3\.claude\agents\`（junction → `C:\Users\chin3\OneDrive\my-agent\.claude-user\agents\`，於 my-agent 版控），內文引用 my-agent `000_Agent/context/protocols/`（`signal-flow.md`、`qa.md`、`executor-discipline.md`、`code-change.md`、`diagnosis.md`）——雲端讀不到。
- 事實：電腦版 model 欄位現值＝pm／sa／backend／frontend：`claude-opus-5-5`；qa：`claude-fable-5-1`。
- 已拍板（Olina）：本機與雲端同一套 pipeline；做法＝repo 內建 `.claude/agents/{pm,sa,backend,frontend,qa}.md`（以電腦版為來源、改寫為自足）；雲端上線方式沿用 Task30 裁定 4（`claude/*` 分支＋PR、Olina 說「合併／上線」才 Merge、一次只留一個未合併 PR）；不 bump App 版號。

## PM 裁定

1. **本機優先序（採納主 session 建議）**：Claude Code 專案層 `.claude/agents/` 會覆蓋同名使用者層定義。裁定：**tokyo-trip 的工作一律以 repo 版五角色＋`specs/PIPELINE.md` 為準**，本機（cwd＝tokyo-trip）與雲端同一套，避免兩套行為。
   - 從 my-agent cwd 派工到 tokyo-trip 時，Claude Code 會用使用者層版本。差異評估：使用者層是**上游原版**（讀 OneDrive 完整協定，規則是 repo 版的超集），短期行為一致、無害；風險只在**日後漂移**（上游改了、repo 版沒跟）。為消除此風險，本 Task 在使用者層五檔「路徑錨定」段各 additive 一行：「目標 repo 有 `.claude/agents/<本角色>.md` 者（目前：tokyo-trip），開工先讀該檔＋其指向的 repo 協定；兩者衝突時以 repo 版為準」。如此不論從哪個 cwd 派工，tokyo-trip 都收斂到 repo 版。
   - **同步規則**（寫進每個 repo 版 agent 檔頭與 `specs/PIPELINE.md` 檔頭）：來源＝my-agent `.claude-user/agents/<角色>.md`＋`000_Agent/context/protocols/` 上列五檔；檔頭記「同步自上游日期 2026-10-21」。上游改了影響 tokyo-trip 會用到的規則（信號流、修復迴圈、閉環清單、model 值）時，由改上游的那個 Task 同批重同步 repo 版並更新日期。model 值漂移由冒煙本機限定判準（§4 T31-7）機械抓。
2. **信號檔跨 session 接續（雲端）**：雲端容器在 session 結束即消失，未 commit 的信號檔會遺失。裁定：
   - **雲端**：每次信號交接（建／刪任一 sentinel、或角色完成產出）後，主 session 立即 commit＋push 到當前 `claude/*` 分支（WIP commit，訊息 `TaskN WIP：<角色> 完成，建 <信號>`），sentinel **隨分支入 git**；PM 閉環時刪除所有暫時性 sentinel（只留 `.impact.md`／`.diagnosis.md`／`.qa_history.md`），閉環 commit 後 PR 的最終 diff 不含任何暫時性 sentinel。
   - **開工接續**：雲端主 session 開工第一步 `git fetch`，查 `git branch -r --no-merged origin/main`；若有未合併的 `origin/claude/*` 分支，**checkout 該分支、掃 `specs/` 殘留信號、從斷點接續**，不開新 Task、不開新分支。
   - **本機**：沿用現行——sentinel 不 commit（本機 session 持續存在，不需要）。
3. **雲端收尾**：PM 閉環後主 session：最終 commit → push `claude/*` 分支 → 開 PR（標題 `TaskN：…`）→ 給 Olina PR 連結；Merge 只在 Olina 明說「合併」或「上線」後；一次只留一個未合併 PR（沿用 Task30 裁定 4）。PR 開在閉環之後（WIP 期間只推分支、不開 PR）。
4. **`CLAUDE.md` 改寫**：拿掉第 3 節「雲端精簡流程」與「雲端不建 sentinel」條；改為「本機與雲端同一套 pipeline：主 session 只當 router，角色定義在 `.claude/agents/`，流程與信號檔規則在 `specs/PIPELINE.md`」。本機／雲端判別**保留**，語意改為：差異只剩 (a) 讀不到 my-agent 時以 repo 內協定為準（讀得到時亦以 repo 版為準，上游只供同步）；(b) 雲端多「每次交接 WIP commit＋push」與「閉環後開 PR」兩步。其他節（語言、開工必讀、冒煙、版號、個資、上線、交接、不做的事）保留。字元上限維持 ≤6000（T30-2），多出的流程細節放 `specs/PIPELINE.md`，不塞進 `CLAUDE.md`。
5. **雲端無 hook 的補位**：本機有 my-agent hook 機械攔截（例：刪 `.tested` 前檢 `DEVELOPMENT_LOG.md` 閉環條目、開場掃殘留 sentinel），雲端沒有。裁定：`specs/PIPELINE.md` 把這幾道閘寫成**可重跑的檢查指令**放進對應角色的必做清單（PM 閉環前、主 session 開工時），不寫腳本。
6. **模型在雲端不可用時的退路**：若雲端派某角色時因 model 不可用報錯，主 session 以同一 `subagent_type` 重派並帶 `model` 參數＝主 session 自身模型，交接（STATE Last Handoff）記一句「覆寫理由：雲端無 <model>」；⛔ 不改 agent 檔的 model 欄位。
7. **subagent 完全載入失敗時的退路**（雲端看不到 pm/sa/… 可派）：主 session 依 `specs/PIPELINE.md` 各角色段**依序自行扮演**，但**照建／刪信號檔、照 WIP commit**（留痕與接續能力不打折），INDEX 狀態欄註明「雲端單 session 代跑（subagent 未載入）」。這是退路不是常態；Task30 的「不建 sentinel」不復活。
8. **公開性**：GitHub Pages（Jekyll）預設不發布 `.` 開頭目錄 ⇒ `.claude/` 應不公開，列為上線後驗收項（實測 404）。`specs/PIPELINE.md` 在 `specs/` 下會公開，與既有 specs 同等級（只寫規則，不寫個資／帳密）。所有新檔仍受 T25-7（全 repo，含 `.claude/`）與 T21（`scan_files`）隱私掃描。
9. **版號**：不 bump（新檔皆不在 `PRECACHE_URLS`，App 行為零變化）。

## 涉及範圍

- [x] 後端／核心邏輯（本 repo 角色對應：工程面——`.claude/agents/` 五檔、`specs/PIPELINE.md`、`CLAUDE.md`、`qa_smoke_test.py`、`.gitignore`；外加 my-agent 使用者層五檔各一行）
- [ ] 前端／UI——**不勾**：零 UI 改動。backend 完成後直接建 `Task31.done`。

## §1 新增 `.claude/agents/{pm,sa,backend,frontend,qa}.md`（repo 版五角色）

1. **來源**：逐檔以 `C:\Users\chin3\OneDrive\my-agent\.claude-user\agents\<角色>.md` 為底改寫。
2. **frontmatter**：`name` 與檔名一致；`model` 照上游現值（pm／sa／backend／frontend＝`claude-opus-5-5`、qa＝`claude-fable-5-1`）；`description` 沿用上游（觸發條件、信號語意不變），可補「本 repo（tokyo-trip）專用」字樣。上游若有 `tools` 欄位則照抄，無則不加。
3. **檔頭（frontmatter 之後）**：一段「來源與同步規則」：來源路徑（my-agent `.claude-user/agents/<角色>.md`）、同步日期 2026-10-21、同步規則（PM 裁定 1）、「本檔為 tokyo-trip 權威；本機與雲端同一套」。須含字樣 `同步規則`（T31 驗）。
4. **改寫為自足**：
   - 路徑錨定段：改為「目標 repo＝本 repo 根目錄（含 `.claude/` 的那一層）；`specs/` 一律指 repo 根的 `specs/`」，拿掉查 PROJECTS.md 的步驟。
   - 所有指向 my-agent `000_Agent/context/protocols/*` 的引用，改指 `specs/PIPELINE.md` 對應章節（必含字樣 `specs/PIPELINE.md`，T31 驗）。可保留一句「本機讀得到上游時，上游僅供同步參考，以本 repo 版為準」。
   - 專案語境（技術棧、角色對應、冒煙指令）一律指 `specs/INDEX.md` 與 `CLAUDE.md`，不內嵌第二份。
   - 刪除只適用其他專案的內容（ERP／POWER 特例、my-agent 自身例外、索引生成腳本等）；本 repo 無索引生成腳本，閉環時 PM 手動更新 `SYSTEM_MAP.md`、INDEX。
   - 角色行為（誰建／刪哪個信號、不得越權、QA 歸屬判定、修復迴圈、pm 退回三路徑 P-A/P-B/P-C）**語意不得弱化**。

## §2 新增 `specs/PIPELINE.md`（repo 自足協定）

把上游協定中**本 repo 用得到的部分**精簡寫進一檔（目標 ≤15000 字元，硬上限 20000，T31 驗）。檔頭：來源五檔、同步日期、同步規則。必含章節：

1. **主 session＝router**：不自己寫 spec／實作／測試；依信號檔自動推進下一個 agent，只有業務判斷（`[待 Olina]`）才停下問；完整性敏感問題（「為什麼 X 還在／又回來／沒生效」）先走診斷前置。
2. **診斷前置階段**（精簡）：列舉所有獨立成因＋覆蓋聲明 → 寫 `TaskN.diagnosis.md`、建 `TaskN.diagnosed` → Olina 確認後建 `TaskN.diagnosis_approved` → PM 才建 `.ready`。
3. **主信號流與信號檔一覽表**：`.ready`（PM→SA）→ `.sa_done`（SA→backend）→ `.backend_done`（backend→frontend，僅含 UI）或 `.done`（→QA）→ `.tested`（QA→PM）或 `TaskN.qa_failed.md`（QA→歸屬方）；存檔類 `.impact.md`／`.diagnosis.md`／`.qa_history.md` 永不刪。每個信號：誰建、誰刪、意義。
4. **修復迴圈**：歸屬 backend／frontend／pm 的判準與處理；多歸屬順序 pm → backend → frontend；異議路；pm 退回三路徑 P-A／P-B／P-C；`TaskN.qa_history.md` 格式（append-only）與閉環彙整行 `QA 退回：N 輪（backend a／frontend b／pm c／qa d）→ TaskN.qa_history.md` 或 `QA 退回：0 輪`；**熔斷**：同一 Task 連續退回 3 輪停下回報主 session（主 session 分流：明確單一改法的小缺陷可直接授權修復並告知 Olina，否則問 Olina）。
5. **`.tested` 須攜帶證據**（冒煙實跑輸出 PASS/FAIL 數、本輪判準逐條結果、工作樹核對），不得空檔。
6. **PM 閉環檢查清單**（取代本機 hook 的可重跑指令，PM 裁定 5）：`DEVELOPMENT_LOG.md` 有閉環條目（主號與「閉環」同一標題行，含 QA 退回彙整行）——檢查指令 `grep -n "TaskN 閉環" DEVELOPMENT_LOG.md` 非空；暫時性 sentinel 零殘留——`ls specs | grep -E "^TaskN\.(ready|sa_done|backend_done|done|tested|diagnosed|diagnosis_approved)$|^TaskN\.qa_failed\.md$"` 為空；INDEX 狀態欄、`SYSTEM_MAP.md`、`specs/STATE.md` 已更新；冒煙 FAIL＝0。
7. **Task 顆粒度與 Non-scope 護欄**（各一段）。
8. **本機／雲端差異（只有這幾條）**：(a) 雲端每次信號交接後 WIP commit＋push 到 `claude/*` 分支（PM 裁定 2）；(b) 雲端開工先查未合併 `claude/*` 分支並接續；(c) 雲端閉環後開 PR、等 Olina 說「合併／上線」；(d) 本機 sentinel 不 commit、閉環後由主 session commit（push 依 Olina 指示）；(e) 模型不可用與 subagent 載入失敗兩條退路（PM 裁定 6、7）。
9. **交接**：每個 session 結束前更新 `specs/STATE.md`（雲端：In Progress 寫明目前停在哪個信號、哪條分支）並隨分支 commit。

## §3 改寫 repo 根 `CLAUDE.md`

- 依 PM 裁定 4 改寫。**T30 既有 25 個關鍵字全部保留**（含 `sentinel`、`BOOTSTRAP.md`、`TaskN.spec.md`、`影響範圍`、`scan_files`、`同一個 PR` 等——改寫後語意可變，字樣須仍在），T30-2 字元上限 6000 不放寬。
- 新增必含字樣：`.claude/agents`、`specs/PIPELINE.md`、`router`。
- 必須**不再出現**：`雲端精簡流程`、`不建 sentinel`、`雲端不建`（T31 驗）。
- 第 2 節開工必讀加入 `specs/PIPELINE.md`；雲端開工加「先 `git fetch` 查未合併 `claude/*` 分支並接續」。
- 第 8 節交接規則保留；「只討論沒改檔也開 STATE-only PR」保留。

## §4 冒煙新增 T31 判準（`qa_smoke_test.py`，additive）

1. T31-1：五個 agent 檔皆存在（每檔一條）。
2. T31-2：每檔 frontmatter 有 `name:` 且值＝檔名、有非空 `model:`、有 `description:`（每檔一條）。
3. T31-3：每檔含 `specs/PIPELINE.md` 與 `同步規則`（每檔一條）。
4. T31-4：`specs/PIPELINE.md` 存在、≤20000 字元、含關鍵字 `.ready`、`.sa_done`、`.backend_done`、`.done`、`.tested`、`.qa_failed.md`、`qa_history`、`diagnosis_approved`、`QA 退回：`、`claude/`、`router`、`同步規則`（每字一條）。
5. T31-5：`CLAUDE.md` 含 `.claude/agents`、`specs/PIPELINE.md`、`router`（每字一條）；不含 `雲端精簡流程`、`不建 sentinel`、`雲端不建`（每字一條）。
6. T31-6：`specs/PIPELINE.md` 與五個 agent 檔無 Liquid 樣板開頭符號（沿用 T30 拼接寫法，本檔自身不含字面）。
7. T31-7（**本機限定**）：使用者層 `C:\Users\chin3\.claude\agents\<角色>.md` 讀得到時，逐檔比對 `model:` 值與 repo 版相等（每檔一條）；讀不到（雲端）印 `SKIP` 一行、**不計入 PASS/FAIL**。⇒ 本機與雲端 PASS 總數相差 5，屬預期，SYSTEM_MAP 記明。
8. `scan_files` additive 加：`specs/PIPELINE.md`、`specs/Task31.spec.md`、`specs/Task31.impact.md`、`.claude/agents/` 五檔。確認 T25-7 的檔案列舉有涵蓋 `.claude/` 下檔案（若未涵蓋則 additive 補，不改既有邏輯）。
9. **既有判準一律不改、不減**；T30 25 個關鍵字判準須仍全 PASS。backend 回報須附**對帳**：改前 127（本機）→ 改後 127＋T31 條數（逐項列 T31 各子項條數），並各附本機實跑一次、以及「模擬雲端」（暫時讓 T31-7 讀不到使用者層，例如以環境變數或參數切換，方法由 backend 定、須不影響正式執行）的 PASS 數。

## §5 `.gitignore`（additive）

- 加一行 `.claude/settings.local.json`（防本機 Claude Code 個人設定誤入版控）。`東京/` 那一行不得動。

## §6 my-agent 使用者層五檔（repo 外）

- `C:\Users\chin3\OneDrive\my-agent\.claude-user\agents\{pm,sa,backend,frontend,qa}.md`：各在「路徑錨定」段末 additive 一行（PM 裁定 1 原句）。其他內容零 diff。
- ⚠ my-agent 工作樹有其他 session 的未提交變更，只動這五檔；main session commit 時只 stage 這五檔。

## 業務規則

1. 本機與雲端同一套角色與信號；唯一差異見 §2 第 8 點。
2. 交接以 git 為唯一真相：雲端的信號檔與 STATE 沒 push 到分支＝沒交接。
3. 一次只一條未合併 `claude/*` 分支／PR；有未合併分支時先接續，不開新 Task。

## 邊界條件 / 錯誤處理

- 雲端 push 被拒或開 PR 失敗：告訴 Olina 卡在哪一步，不改成直接推 main、不 force push。
- 雲端 session 中途結束：下一個 session 依 PM 裁定 2 從分支接續；若最後一次 WIP commit 之後的工作遺失，從最後一個信號重做該角色。
- 兩 session 同時接續同一分支（理論上）：以先 push 者為準，後者 pull 後重判信號狀態。
- 模型不可用、subagent 未載入：PM 裁定 6、7。

## 不在本次範圍（Non-scope）

- 不改任何 App 程式碼／資料（`index.html`、`js/*`、`css/*`、`sw.js`、`manifest.webmanifest`），不 bump 版號，PRECACHE 零動。
- 不改既有冒煙判準（只 additive 加 T31）；不修 `PYTHONUTF8` 編碼技術債。
- 不改 my-agent `000_Agent/context/protocols/*`、`PROJECTS.md`、Layer 2 `STATE.md`、hooks；使用者層五檔只加一行。
- 不在 repo 放 hooks、settings.json（`.claude/` 下只放 `agents/`）。
- 不設 GitHub branch protection、不改 Pages 設定、不加 `.nojekyll` 或 `_config.yml`（除非上線後實測 `.claude/` 被公開，另開 Task）。
- 不新增 diagnostician 角色檔（診斷前置由主 session 派 general-purpose 依 `specs/PIPELINE.md` 第 2 章執行）。
- 不做其他 repo 的同類改造。

## 驗收判準（QA 機械驗）

1. `PYTHONUTF8=1 python qa_smoke_test.py` FAIL＝0；既有 127 條不減、T30 全 PASS；T31 全 PASS；本機總數＝127＋T31 本機條數，與 backend 對帳一致。另跑 backend 提供的「模擬雲端」方式一次：FAIL＝0、PASS 數＝本機數−5。
2. `.claude/agents/` 五檔：frontmatter `model` 與使用者層現值逐檔相等；人工抽讀每檔無「必須讀 OneDrive／my-agent 才能工作」的依賴句（可有「上游僅供同步」說明）；信號建刪語意與上游一致（抽 sa、qa 兩檔對照上游）。
3. `CLAUDE.md`：本機／雲端判別仍在開頭；無精簡流程殘字；≤6000 字元。
4. `git -C "C:\Python Project\tokyo-trip" status --porcelain` 只含：新增 `.claude/agents/` 五檔、`specs/PIPELINE.md`、`specs/Task31.spec.md`、`specs/Task31.impact.md`（及 QA 若退回產生的 `specs/Task31.qa_history.md`）；修改 `CLAUDE.md`、`qa_smoke_test.py`、`.gitignore`、`specs/INDEX.md`、`specs/SYSTEM_MAP.md`、`DEVELOPMENT_LOG.md`、`specs/STATE.md`。`js/version.js`／`sw.js` 零 diff。
5. my-agent `git diff --stat -- .claude-user/agents` 只有五檔、各 +1 行（或 +1 行附空行）。
6. 新檔全數無個資（T25-7＋T21 涵蓋）、無 Liquid 開頭符號。

## 上線後驗收（main session，push origin/main 後）

1. GitHub Pages 部署完成後：`https://olina3221.github.io/tokyo-trip/.claude/agents/pm.md` 回 **404**；`https://olina3221.github.io/tokyo-trip/` 版號徽章仍為 v28（本 Task 不 bump）。若 `.claude/` 回 200：內容無個資、不擋上線，於 STATE Open Items 記一條並另開 Task 處理。
2. 交給 Olina 手機實測（下節）。

## 給 Olina 的手機實測（main session 轉交）

**前提**：push 完成後，**新開**一個雲端 session（舊 session 開場時還沒有 `.claude/agents/`，不會載入），repo 選 `Olina3221/tokyo-trip`、分支 main。

**實測句 1（確認角色有載入，10 秒）**：

> 列出你現在可以派工的 subagent，以及各自的 model。

預期：看到 `pm`、`sa`、`backend`、`frontend`、`qa` 五個（描述是 tokyo-trip 專用版），pm／sa／backend／frontend 為 Opus、qa 為 Fable。

**實測句 2（走一次完整 pipeline，極小需求，不 bump 版號）**：

> 實測 pipeline：在 行前檢查清單.md 最後面加一行「雲端 pipeline 實測通過（10/21）」。照 CLAUDE.md 的流程跑完，最後給我 PR 連結。

預期：
1. 主 session 不自己改檔，畫面依序出現派工卡片：`pm` → `sa` → `backend` → `qa` → `pm`（無 UI，跳過 frontend）。
2. 每派完一個角色，分支 `claude/...` 上多一個 WIP commit（可在 GitHub 該分支 commits 看到）。
3. 結尾給一個 PR 連結（標題 `Task32：…`），PR 的檔案清單含 `行前檢查清單.md`、`specs/Task32.spec.md`、`specs/Task32.impact.md`、INDEX／DEVELOPMENT_LOG／STATE／SYSTEM_MAP，**不含**任何 `.ready`／`.sa_done`／`.done`／`.tested` 檔。
4. Olina 回「合併」→ session 代按 Merge（或她自己按）。合併後才算這次實測結束（否則「一次只一個未合併 PR」會擋下一個需求）。

**失敗退路**：
- 句 1 看不到五角色：確認是**新開**的 session、分支是 main 且 GitHub 上 main 已有 `.claude/agents/`；仍看不到 ⇒ 照 PM 裁定 7 退路（主 session 依 `specs/PIPELINE.md` 自行依序扮演、照建信號、照 WIP commit），旅程中照用不受影響，回電腦後另開 Task 查原因。
- 派工報模型錯誤：照 PM 裁定 6（同角色帶主 session 模型重派），實測句 2 照跑。
- 中途 session 斷掉：新開 session 說「接續上一個雲端分支」，應自動找到未合併 `claude/*` 分支並從殘留信號接續。
- 卡在開 PR／Merge 權限：session 會說明卡在哪一步；改動已在分支上，回電腦再處理，旅程中不影響 App 使用（App 本身未改）。

## 閉環與上線（PM／main session）

- PM 閉環：INDEX Roadmap Task31 列、「檔案」區補 `.claude/agents/`、`specs/PIPELINE.md` 指針並改寫 `CLAUDE.md` 指針描述（拿掉「雲端精簡流程」）；SYSTEM_MAP 手動補兩處（檔案結構＋人工補充區 Task30 外部耦合條第 (3) 點改寫為「本機與雲端同一套，repo 版 agents 覆蓋使用者層」，並記 T31-7 本機／雲端 PASS 數差 5）；DEVELOPMENT_LOG 閉環條目（含 `QA 退回：` 行）；`specs/STATE.md` 改寫現況（In Progress 旅程期改動走雲端 pipeline、Last Handoff 一筆 Task31）。
- main session：閉環後 commit（只 stage 上列 repo 檔）並 push origin/main（Olina 已授權）；my-agent 五檔另行 commit（只 stage 該五檔）；然後做「上線後驗收」與轉交實測句。

## 影響範圍分析（SA）

> SA v1，2026-10-21。完整查證事實（F1～F9）、受影響表、業務層級依賴見 `specs/Task31.impact.md`。涉及範圍：純後端／工程面，跳過 frontend。改前冒煙實跑 127/0。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 其他 repo 派工 | `~/.claude/agents/*.md`（junction → my-agent `.claude-user/agents/`，已實查） | 除 tokyo-trip 外無任何 repo 有 `.claude/agents/`（ERP／POWER／萊點／my-agent 實查）⇒ 條件句新行對其他 repo 無作用 | ✅ |
| 路徑錨定 | repo 版五檔 | 從 my-agent 派工時 cwd 也有 `.claude/`，「含 `.claude/` 的那一層」會指錯 ⇒ 須補 cwd≠repo 根用絕對路徑（B1） | ✅ |
| Agent model 覆寫閘 | my-agent `agent_model_guard.py` | 正常派工不帶 model ⇒ 放行；裁定 6 重派須 prompt 內含「覆寫理由：」才與本機閘相容（B5） | ✅ |
| 其他 my-agent hook | `gate_tested_delete.py`／`sentinel_scan.ps1`／`state_inject.ps1` 等 | 無衝突（`.claude/` 只放 agents、不放 progress_gate.json／settings.json） | ❌ |
| 冒煙 T30 | `qa_smoke_test.py` T30-3 | 25 字須保留；`TaskN.spec.md`／`影響範圍`／`scan_files` 目前只在第 3 節，易誤刪 | ✅ |
| 冒煙 T25-7／T25-8 | `qa_smoke_test.py` | `git ls-files` 含未追蹤 ⇒ `.claude/agents/` 自動涵蓋；`東京/` 行不動 | ✅ |
| 冒煙 T21 | `scan_files` 寫死白名單 | additive 8 筆；缺檔靜默 continue，路徑須自檢（B4） | ✅ |
| Liquid／Pages | `specs/PIPELINE.md` | 無 `_config.yml`／`.nojekyll`／workflow ⇒ Jekyll 預設排除 dot 目錄；PIPELINE.md 會被建置，不得含 Liquid 開頭符號 | ✅ |
| PRECACHE／版號／App | `sw.js`、`js/version.js`、全 App 檔 | 零改動 | ✅（零 diff） |
| 文件指針 | `specs/INDEX.md` L134、`specs/SYSTEM_MAP.md` L46、L116(3) | 仍寫「精簡流程」，PM 閉環改寫（L46 spec 未列，補） | ✅ |

### Backend 注意事項
- B1 repo 版路徑錨定：repo 根＝本檔所在 `.claude/agents/` 上兩層；cwd≠repo 根時一律絕對路徑。
- B2 使用者層新行為條件句（檔案存在才觸發），五檔各 +1 行。
- B3 my-agent 只動 `.claude-user/agents/` 五檔；`.claude-user/settings.json` 有他 session 變更，不讀寫不 stage。
- B4 `scan_files` additive 8 筆並自檢存在。
- B5 PIPELINE.md 模型退路：重派 prompt 內含「覆寫理由：雲端無 <model>」。
- B6 T31-7 用 `expanduser('~/.claude/agents')`、模擬雲端以環境變數開關。
- B7 回報逐子項列 T31 條數；`.done` 為 `.sa_done` 子字串，判準天然成立（可改驗 `TaskN.done`）。
- B8 CLAUDE.md 保留 T30 25 字（特別是第 3 節獨有三字＋`sentinel`、`同一個 PR`），禁三字串連引述也不可出現。
- B9 repo 版去掉 `C:\Users\chin3` 絕對路徑與 POWER 特例。
- B10 PIPELINE.md 壓縮砍特例與緣由，不砍規則。
- B11 `.gitignore` 只加一行，`東京/` 不動。

### Frontend 注意事項
- 不適用（零 UI），backend 完成直接建 `Task31.done`。

### QA 迴歸測試清單
- [ ] 冒煙 FAIL＝0、既有 127 不減、T30 全 PASS、T31 全 PASS；模擬雲端 PASS＝本機−5
- [ ] tokyo-trip 工作樹只含驗收判準 4 所列檔；App 檔零 diff
- [ ] my-agent 五檔各 +1、`settings.json` diff 未被動、無多餘 staged
- [ ] ERP／POWER 無 `.claude\agents\`（新行不觸發）
- [ ] repo 版五檔：B1 條款在、無 `C:\Users\chin3`、model 相等、無 tools 欄；抽 sa／qa 對照上游信號語意
- [ ] PIPELINE.md ≤20000、含「覆寫理由：」；CLAUDE.md ≤6000、禁字 0
- [ ] 新 `.md` 無 Liquid 開頭符號、無 P-OLD
- 新功能由 QA 依 spec 驗收

### 待主 session 裁定
1. B1 路徑錨定補條（SA 建議採納，技術措辭）。
2. 使用者層新行的「（目前：tokyo-trip）」括註：建議拿掉（避免漂移清單），保留亦無功能影響。
