# tokyo-trip Work State（Layer 3 狀態檔）

> 本檔只放**現在式**（最新、覆寫）；歷史一律在本 repo `DEVELOPMENT_LOG.md`（閉環條目），本檔不留。定義見 my-agent `000_Agent/context/ARCHITECTURE.md` Layer 3 段，本檔不重述。
> 紀律：≤4000 字元、四章固定、Open Items 每條帶結案條件、Last Handoff 每筆 ≤260 字元；本機由 my-agent `check_state.py` 驗證，雲端由冒煙 `qa_smoke_test.py` T30 驗。

## Current Status

- Updated: 2026-10-21
- Updated by: PM（Task32 閉環）
- 線上 v28 · 10/19（GitHub Pages）；分支 `claude/task32-per-person-flight` 為 v29 · 10/21（Task32，未合併）。
- 錨定檔：`specs/INDEX.md`；session 入口：repo 根 `CLAUDE.md`；流程：`specs/PIPELINE.md`＋`.claude/agents/` 五角色（本機與雲端同一套）。

## In Progress

- Task32（匯入碼可帶各人航班＋重要資料原位取代）：PM 閉環完成，暫時性信號已清；閉環待 Olina 合併（主 session 開 PR，Olina 說「合併／上線」才 Merge）。
- 10/22～10/25 旅程中：改動走手機雲端 session，照完整 pipeline，每次信號交接 WIP commit＋push `claude/*` 分支，閉環後開 PR；規則見 `specs/PIPELINE.md` 第 8 節。

## Open Items

- Task32 上線：PR 合併並部署。**結案條件**：origin/main 含 `specs/Task32.spec.md` 與 `DEVELOPMENT_LOG.md`「Task32 閉環」行；`git ls-tree -r --name-only origin/main specs` 無 `Task32.(ready|sa_done|backend_done|done|tested)`；Pages 徽章顯示 v29。
- 妹妹的匯入碼：由 session 在對話中依 Olina 提供的資料產生交付（只存 scratchpad、不進任何 tracked 檔），內容依 `specs/Task32.spec.md` D1／D3／D7／D8（航班去回程、10/22 與 10/25 整天、樂桃提醒原位換華航提醒）；D9 保險列視她保險公司決定。民宿房號／門鎖／WiFi 等 `lodging` 待 Olina 補齊後重產一次。**結案條件**：Olina 回報妹妹手機匯入最終版後，行程頁航班、Day 1／Day 4、重要資料報到提醒皆為她的內容，且 `git grep` 全 repo 無她的訂位代號。
- Task32 D2（提示小字顯示）、D4（地圖機場點不動）Olina 未明確回覆，已照建議預設上線。**結案條件**：Olina 明確表示接受，或另開 Task 改動。
- 回到電腦後同步本機：`git pull`，並確認沒有遺留的雲端分支／PR。**結案條件**：本機 `git status -sb` 顯示 main 與 origin/main 同步；`git branch -r --no-merged origin/main` 無 `origin/claude/*`；`gh pr list --state open` 為空。

## Last Handoff

- 2026-10-21 Task32 閉環（QA 1 輪 PASS，冒煙 181/0、整合 54/54，v29）：匯入碼新 key `flights`／`itineraryDays`／`importantOverrides`，未匯入＝v28；雲端 pipeline 首跑；詳見 `DEVELOPMENT_LOG.md`。
