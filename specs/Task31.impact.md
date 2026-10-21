# Task31 影響範圍分析（SA）

> SA v1，2026-10-21。對象 spec：`specs/Task31.spec.md`（PM v1）。
> 涉及範圍：**純後端／工程面**（零 UI；backend 完成直接建 `Task31.done`，跳過 frontend）。
> 改前基線實跑：`PYTHONUTF8=1 python qa_smoke_test.py` → `PASS: 127  FAIL: 0`（2026-10-21 SA 實跑）。

## 查證事實（本輪實查，非記憶）

| # | 查證項 | 結果 | 證據 |
|---|--------|------|------|
| F1 | `~/.claude/agents` 是否就是 my-agent `.claude-user/agents` | 是。`C:\Users\chin3\.claude\agents` LinkType＝Junction，Target＝`C:\Users\chin3\OneDrive\my-agent\.claude-user\agents` | `Get-Item` 實查；`claude-user-sync.ps1`／`sync-health.ps1` 只驗 junction，不同步 agents 內容 ⇒ 改 `.claude-user/agents/*.md` 即改活側，無鏡像衝突 |
| F2 | 其他 repo 有無 `.claude/agents/` | 無。`C:\Python Project\*\.claude` 只有 Laiten（skills）、Ulinjia_Power（hooks、settings.json）、ulinjia_CRM_ERP（hooks、settings*.json）；my-agent `.claude\` 也無 agents | `ls` 實查 |
| F3 | 使用者層五檔 frontmatter | pm／sa／backend／frontend `model: claude-opus-5-5`、qa `claude-fable-5-1`；**皆無 `tools` 欄** ⇒ repo 版不加 tools | head 實讀 |
| F4 | my-agent 工作樹 | `.claude-user/settings.json` 有他 session 未提交變更（+1/-1）；index 目前無 staged 檔 | `git status`／`git diff --cached --stat` |
| F5 | Pages 公開性 | repo 無 `_config.yml`、無 `.nojekyll`、無 `.github/` workflow、tracked 無 `_` 開頭檔 ⇒ 分支直出、Jekyll 預設設定，dot 目錄預設排除 ⇒ `.claude/` 預期 404（仍依 spec 上線後實測） | `git ls-files` 實查 |
| F6 | 上游五檔＋五協定 Liquid／P-OLD | 雙左大括號、左大括號接百分號：0 檔命中；P-OLD：0 檔命中 | grep 實查 |
| F7 | 上游協定體量 | signal-flow 24.6k＋qa 9.8k＋executor 4.3k＋code-change 3.2k＋diagnosis 9.1k ≈ 51k 字元 ⇒ PIPELINE.md 須壓到 ≤15k（硬上限 20k），約 1/3～1/4 | `wc -m` |
| F8 | `CLAUDE.md` 現況 | 2919 字元（上限 6000，餘裕約 3000） | python `len()` |
| F9 | DEVELOPMENT_LOG 閉環行格式 | `- 日期 [TaskN 閉環: PM] …`，子字串 `TaskN 閉環` 成立 ⇒ spec §2-6 的 `grep -n "TaskN 閉環"` 可用 | grep 實查 |

## 受影響的既有功能

| 功能 | 頁面 / 函式 / 檔案 | 影響說明 | 需迴歸測試 |
|------|-------------------|---------|-----------|
| 其他 repo（ERP／POWER／萊點／work-hours／rental-pricing／win-update-scheduler／ulinjia-platform／my-agent）派工 | `~/.claude/agents/*.md`（junction 實體＝my-agent `.claude-user/agents/*.md`） | 加的那行以「目標 repo 有 `.claude/agents/<角色>.md`」為觸發；F2 證實目前除 tokyo-trip 外無任何 repo 有此目錄 ⇒ **對其他 repo 完全無作用**。前提：措辭必須是條件句（無該檔＝本行不適用），不得寫成無條件「先找 repo 版」導致 agent 在 ERP 等 repo 做多餘搜尋或誤讀別處 | ✅（QA 抽讀五檔 diff 為 +1 行條件句） |
| 本機 cwd＝tokyo-trip 的 session | Claude Code 專案層 `.claude/agents/` | 專案層同名定義覆蓋使用者層 ⇒ 該 session 派 pm/sa/… 一律用 repo 版。⚠ agent 清單於 session 開場載入，**既有 session 不會即時看到**，須新開 session | ❌（流程外；上線後由 Olina 雲端新 session 實測句 1 驗） |
| 本機 cwd＝my-agent 派工到 tokyo-trip（含本 Task 自己的 backend／QA／PM 閉環） | 使用者層五檔＋新增一行 | 仍用使用者層定義與 model；新行導向先讀 repo 版。**本 Task 的 QA／PM 閉環就是第一個實例**（backend 改完 `.claude-user/agents/` 後，下一個派出的 agent 即讀到新行） | ✅（QA 抽讀） |
| 路徑錨定（signal_residue 根因） | repo 版五檔「路徑錨定」段 | ⚠ **新風險**：spec §1-4 要求 repo 版改為「目標 repo＝含 `.claude/` 的那一層、`specs/` 指 repo 根」並拿掉 PROJECTS.md 查表。但 **my-agent 自己的 cwd 也有 `.claude/`**——從 my-agent 派工、agent 依新行讀 repo 版後若照字面用相對 `specs/`，會把信號檔建進 `my-agent\specs\`（正是 `signal_residue.diagnosis.md` 的前例）。見 Backend 注意事項 B1 | ✅ |
| my-agent hook：Agent model 覆寫閘 | `.claude/hooks/agent_model_guard.py`（PreToolUse `Agent|Task`，使用者層，全 repo 生效） | repo 版 agent 檔帶 `model:` frontmatter、派工時不帶 `model` 參數 ⇒ 放行，無衝突。PM 裁定 6（雲端模型不可用、帶 `model` 重派）在雲端無 hook；但若同句在**本機**照做會被擋——因為閘只看 **prompt** 內的 `覆寫理由：`，spec 只寫「STATE 記一句」 | ✅（PIPELINE.md 措辭，B5） |
| my-agent hook：`.tested` 刪除閘 | `.claude/hooks/gate_tested_delete.py` | 由 `.tested` 路徑反推 repo、讀 `DEVELOPMENT_LOG.md` 找 `Task31` 字樣；另會讀 `<repo>/.claude/progress_gate.json` 覆寫。本 Task `.claude/` 下只放 `agents/` ⇒ 無影響。閘的比對比 PIPELINE.md 的 `TaskN 閉環` grep 寬，兩者並存無矛盾（本機兩道、雲端一道） | ❌ |
| my-agent hook：sentinel 掃描 | `.claude/hooks/sentinel_scan.ps1`（SessionStart） | 合法位置用 `C:\Python Project\*\specs` glob，tokyo-trip 本就在內。雲端 WIP commit 的 sentinel 只有在本機 checkout 未合併 `claude/*` 分支時才會出現在本機工作樹，此時被報為殘留＝正確訊號（提醒接續），非誤報 | ❌ |
| my-agent hook：state_inject | `.claude/hooks/state_inject.ps1`（UserPromptSubmit） | 觸發表 `tokyo-trip = 'tokyo|東京'`（Task30 補）、只讀 `specs/STATE.md`；本 Task 不改 STATE 位置 ⇒ 無影響 | ❌ |
| my-agent hook：bootstrap_inject／diagnosis_trigger／check_state／claude-user-sync | 使用者層 SessionStart／UserPromptSubmit／PostToolUse | 皆不讀 agent 檔內容或 repo `.claude/`；check_state 驗 `specs/STATE.md`（PM 閉環改寫時照舊受驗） | ❌ |
| 冒煙 T30（CLAUDE.md 關鍵字鎖 25 字＋≤6000＋STATE 結構＋Liquid） | `qa_smoke_test.py` L816–882 | `CLAUDE.md` 改寫須保留 25 字：`繁體中文`、`specs/STATE.md`、`specs/INDEX.md`、`specs/SYSTEM_MAP.md`、`BOOTSTRAP.md`、`TaskN.spec.md`、`影響範圍`、`sentinel`、`scan_files`、`qa_smoke_test.py`、`PYTHONUTF8=1`、`js/version.js`、`APP_VERSION`、`APP_VERSION_DATE`、`sw.js`、`CACHE_VERSION`、`逐字元`、`個資`、`東京/`、`PR`、`Merge`、`GitHub Pages`、`版號`、`DEVELOPMENT_LOG.md`、`同一個 PR`。拿掉第 3 節時 `TaskN.spec.md`、`影響範圍`、`scan_files` 三字目前**只出現在第 3 節**，最容易一起被刪 | ✅ |
| 冒煙 T25-7（全 repo P-OLD 掃描） | `qa_smoke_test.py` L378–414（`git ls-files` tracked ∪ `--others --exclude-standard`） | `.claude/agents/*.md` 未被 ignore ⇒ 未追蹤期與 commit 後**自動涵蓋**，spec §4-8「若未涵蓋則補」不需動作。新 `.gitignore` 行 `.claude/settings.local.json` 只排除該單檔，不影響 agents 涵蓋 | ✅ |
| 冒煙 T25-8（`.gitignore` 含 `東京/`） | `qa_smoke_test.py` L416–426 | `.gitignore` additive 一行，`東京/` 行不動 ⇒ 仍 PASS | ✅ |
| 冒煙 T21 隱私掃描 `scan_files` | `qa_smoke_test.py` L223–262 | 寫死白名單（SYSTEM_MAP 人工區 L112 紀律）⇒ 須 additive 加 `specs/PIPELINE.md`、`specs/Task31.spec.md`、`specs/Task31.impact.md`、`.claude/agents/` 五檔。注意：清單內缺檔是**靜默 continue**，路徑打錯不會紅 ⇒ 見 B4 | ✅ |
| Liquid 樣板開頭符號（Pages 建置） | 全 repo `.md`（repo 無 `.nojekyll`） | `specs/PIPELINE.md` 會被 Jekyll 處理，含 Liquid 開頭符號即擋全站部署；`.claude/` 不被 Jekyll 處理，但 T31-6 照驗無害。上游原文 0 命中（F6），改寫時勿以範例形式引入 | ✅ |
| PRECACHE／版號 | `sw.js` PRECACHE_URLS 44 筆、`CACHE_VERSION`／`APP_VERSION` v28 | 新檔皆不入 PRECACHE、不 bump ⇒ 冒煙 PRECACHE 筆數寫死斷言與版號一致性判準不受影響 | ✅（`js/version.js`／`sw.js` 零 diff） |
| App 功能（全分頁） | `index.html`、`js/*`、`css/*`、`sw.js`、`manifest.webmanifest` | 零改動 | ❌（冒煙 127 涵蓋即足） |
| 文件指針漂移 | `specs/INDEX.md` L134、`specs/SYSTEM_MAP.md` L46、L116(3) | 三處仍寫「雲端精簡流程／本機不適用精簡流程」——PM 閉環須改寫（spec「閉環與上線」已列 INDEX 檔案區與 SYSTEM_MAP L116；**L46 CLAUDE.md 列未列**，補列） | ✅（QA 核 grep） |

## Backend 注意事項

- **B1（路徑錨定，最重要）**：repo 版「路徑錨定」段不可只寫「目標 repo＝含 `.claude/` 的那一層」。改為：「本 repo 根＝本檔所在 `.claude/agents/` 的上兩層（含 `specs/INDEX.md`、`CLAUDE.md` 的 tokyo-trip 根）。cwd 就是本 repo 根（雲端、或本機坐在本 repo）時可用相對 `specs/`；**cwd 不是本 repo 根時（例如本機從 my-agent 派工），一律用本 repo 絕對路徑操作 `specs/`，禁止裸相對路徑**。」不需 PROJECTS.md 查表（派工者已以絕對路徑指到本檔）。這在 spec §1-4「改為本 repo 根」的範圍內，只是補上 cwd≠repo 的分支，語意不弱化上游第 2 條；若主 session 不同意，回 PM。
- **B2（使用者層一行措辭）**：必須是條件句、以檔案存在為觸發，例如 spec 原句「目標 repo 有 `.claude/agents/<本角色>.md` 者（目前：tokyo-trip），開工先讀該檔＋其指向的 repo 協定；兩者衝突時以 repo 版為準」。放在「路徑錨定」段第 3 條之後（作第 4 條或段末一行皆可），五檔 `<本角色>` 各換成 pm／sa／backend／frontend／qa。其他內容零 diff；`git diff --stat -- .claude-user/agents` 五檔各 +1（可附 +1 空行）。
- **B3（my-agent 不得碰的檔）**：只寫 `.claude-user/agents/{pm,sa,backend,frontend,qa}.md`；`.claude-user/settings.json` 有他 session 未提交變更，**不讀寫、不 stage**。commit 由 main session 做，建議用 `git commit -- <五檔路徑>` 或 `git add -- <五檔>` 後先 `git diff --cached --stat` 確認只有五檔。可透過 `C:\Users\chin3\.claude\agents\` 或 `.claude-user\agents\` 任一路徑編輯（同一實體，F1）。
- **B4（冒煙 scan_files）**：additive 加 8 筆，並自檢「清單內每檔都存在」（目前缺檔靜默 continue，打錯路徑＝假陰性）——建議 T31 加一條「scan_files 新增 8 檔皆存在」或在 T31-1/T31-4 已涵蓋存在性時於回報說明。不改既有 scan 邏輯。
- **B5（PIPELINE.md 模型退路措辭）**：PM 裁定 6 寫進 PIPELINE.md 時，規定重派的 **prompt 內**含「覆寫理由：雲端無 <model>」（同時記 STATE）——本機 `agent_model_guard.py` 只認 prompt 內此標記，寫在 prompt 才能本機雲端一致、不被擋。
- **B6（T31-7 路徑）**：使用者層路徑用 `os.path.expanduser('~/.claude/agents')`，不寫死 `C:\Users\chin3`（repo 公開、雲端 home 不同）；「模擬雲端」開關建議環境變數（如 `T31_SIMULATE_CLOUD=1`）只影響 T31-7，未設時行為與正式一致。讀不到時 SKIP 不計 PASS/FAIL，總數差恰 5。
- **B7（T31 條數口徑）**：spec §4-4「存在、≤20000、每關鍵字一條」——存在與字數是否各算一條由 backend 定，但回報須逐子項列條數（T31-1～7 各幾條）與本機／模擬雲端兩次實跑 PASS 數；注意 `.done` 是 `.sa_done` 的子字串，T31-4 對 `.done` 的關鍵字判準天然成立，若要有意義可改驗 `` `.done` `` 或 `TaskN.done`（不強制）。
- **B8（CLAUDE.md 改寫）**：拿掉第 3 節時把 `TaskN.spec.md`、`影響範圍`、`scan_files` 三字移到新段落（例如「PM 寫 `specs/TaskN.spec.md`、SA 寫影響範圍、新檔加入 `scan_files`」），`sentinel`、`同一個 PR` 也保留（新語意：信號檔＝sentinel；雲端 WIP 與閉環都在同一個 PR）。新增 `.claude/agents`、`specs/PIPELINE.md`、`router`；禁三字串 `雲端精簡流程`、`不建 sentinel`、`雲端不建`（含「Task30 的『不建 sentinel』不復活」這類引述也不可出現在 CLAUDE.md，只能放 PIPELINE.md）。第 0 節判別仍置頂、仍含 `BOOTSTRAP.md`。
- **B9（repo 版去個人化）**：上游五檔各含 2～3 處 `C:\Users\chin3\...` 絕對路徑、qa.md 有 POWER 特例（L114）——repo 版公開於 GitHub（`.claude/` 雖不上 Pages，repo 本身仍可見度依 repo 設定），自足改寫時一併拿掉；同步規則的「來源路徑」用 `my-agent/.claude-user/agents/<角色>.md` 相對寫法即可。
- **B10（語意不弱化）**：PIPELINE.md 從約 51k 壓到 ≤15k，信號建刪權責表、修復迴圈歸屬判準、P-A/P-B/P-C、熔斷、`.tested` 證據要求、`QA 退回：` 彙整行格式須逐條保留；壓縮砍的是 ERP／POWER／my-agent 特例與歷史緣由，不是規則本身。
- **B11（.gitignore）**：只 additive `.claude/settings.local.json` 一行；`東京/` 行與其註解不動（T25-8）。

## Frontend 注意事項

- 不適用（零 UI）。frontend 不派；backend 完成直接建 `Task31.done`。

## QA 迴歸測試清單

- [ ] 冒煙全量 FAIL＝0，既有 127 不減（PRECACHE 44／版號 v28 一致性／T21／T25-7／T25-8／T30 34 條全 PASS），本機總數＝127＋T31 本機條數，與 backend 對帳一致
- [ ] 模擬雲端一次：FAIL＝0、PASS＝本機數−5、T31-7 印 SKIP
- [ ] `git status --porcelain`（tokyo-trip）只含 spec「驗收判準 4」所列檔；`js/version.js`、`sw.js`、`index.html`、`js/*`、`css/*`、`manifest.webmanifest` 零 diff
- [ ] my-agent `git diff --stat -- .claude-user/agents` 五檔各 +1（±空行）；`.claude-user/settings.json` 的 diff 與 SA 時點相同（他 session 的 +1/-1，未被本 Task 動）；index 無本 Task 以外 staged 檔
- [ ] 使用者層新行為條件句；在 ERP（`C:\Python Project\ulinjia_CRM_ERP`）、POWER（`C:\Python Project\Ulinjia_Power`）確認無 `.claude\agents\` ⇒ 該行不觸發（`Test-Path` 兩次即可）
- [ ] repo 版五檔：路徑錨定含 cwd≠repo 根時用絕對路徑的條款（B1）；無 `C:\Users\chin3`、無 ERP／POWER 特例；frontmatter `name`＝檔名、`model` 與使用者層逐檔相等、無 `tools` 欄
- [ ] 抽 sa、qa 兩檔對照上游：信號建刪語意一致
- [ ] `specs/PIPELINE.md`：≤20000 字元；模型退路段規定 prompt 內含「覆寫理由：」（B5）
- [ ] `CLAUDE.md`：≤6000、第 0 節判別置頂、禁三字串 grep＝0
- [ ] 新 `.md` 全數無 Liquid 開頭符號、無 P-OLD
- [ ] 新功能其餘由 QA 依 spec 驗收

## 業務層級依賴

- `.claude/agents/pm.md`、`.claude/agents/sa.md`、`.claude/agents/backend.md`、`.claude/agents/frontend.md`、`.claude/agents/qa.md` ↔ 上游 `C:\Users\chin3\OneDrive\my-agent\.claude-user\agents\<角色>.md`（＝`~/.claude/agents` junction 實體）：手動同步、無機械比對內容，只有 `qa_smoke_test.py` T31-7 本機比對 `model:`。上游改信號流／修復迴圈／閉環清單時，改上游的 Task 須同批重同步 repo 版（同步規則寫在各檔頭）。
- `specs/PIPELINE.md` ↔ my-agent `000_Agent/context/protocols/{signal-flow,qa,executor-discipline,code-change,diagnosis}.md`：同上，手動同步、無機械檢查（漂移只靠同步規則自律）。
- `specs/PIPELINE.md` 模型退路 ↔ my-agent `.claude/hooks/agent_model_guard.py`：重派 prompt 必含「覆寫理由：」才與本機閘相容。
- `CLAUDE.md` ↔ `qa_smoke_test.py` T30-3 25 字＋T31-5 必含／禁字：改入口檔必同批核兩組判準。
- `.gitignore` ↔ `qa_smoke_test.py` T25-7（`--exclude-standard` 決定掃描集合）：日後若 ignore `.claude/` 整目錄，agents 會掉出 T25-7 掃描。
- 本 repo `.claude/` 下只可放 `agents/`：放 `progress_gate.json` 會改變 my-agent `gate_tested_delete.py` 對本 repo 的進度檔判定；放 `settings.json` 會在本機 cwd＝tokyo-trip 時疊加專案層 hooks（spec Non-scope 已禁）。

## 需主 session 裁定的待決

1. **B1 路徑錨定補條（建議採納）**：spec §1-4 字面「目標 repo＝含 `.claude/` 的那一層」在本機從 my-agent 派工時有建錯位置風險（my-agent 也有 `.claude/`）。建議採 B1 措辭（repo 根＝本檔上兩層；cwd≠repo 根時用絕對路徑）。屬技術措辭、不改業務規則，主 session 可直接採納告知；不採納則回 PM。
2. **使用者層新行的「（目前：tokyo-trip）」括註（可選）**：使用者層定義的原則是「不內嵌任何單一專案語境」，括註日後會成漂移清單（新 repo 加 agents 時沒人回來改）。觸發條件已由「檔案存在」機械決定，建議拿掉括註；保留亦無功能影響。主 session 二擇一即可，不必問 Olina。
