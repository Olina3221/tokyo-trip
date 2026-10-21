# tokyo-trip 開工入口（CLAUDE.md）

> 本檔會隨 GitHub Pages 公開成網址：只寫規則與指路，不寫任何個資、訂位碼、帳密，也不寫會變動的現況數字（版號、筆數等現況住 `specs/STATE.md`）。

## 0. 先判別：本機還是雲端（最優先）

- **讀得到** `C:\Users\chin3\OneDrive\my-agent\000_Agent\context\BOOTSTRAP.md` ＝ 在 Olina 電腦上（本機）。
- **讀不到** ＝ 雲端 session（手機 Claude App 等，只看得到本 repo）。
- **兩者跑同一套多 agent pipeline**（第 3 節）。差異只剩：(a) 本 repo 的 pipeline 規則以 repo 內協定為準（讀得到 my-agent 時亦同，上游只供同步）；(b) 雲端多「每次交接 WIP commit＋push」與「閉環後開 PR」兩步。

## 1. 語言與溝通

一律繁體中文、簡短回覆、先給答案再說明。

## 2. 開工必讀（依序）

1. `specs/STATE.md`：現況、進行中、待辦、上次交接。
2. `specs/INDEX.md`：技術棧拍板、角色對應、Task Roadmap。新任務編號＝Roadmap 最大 TaskN＋1。
3. `specs/SYSTEM_MAP.md`：檔案與依賴。檔很大，用搜尋找相關段，不要整份讀。
4. `specs/PIPELINE.md`：pipeline 協定（信號檔、修復迴圈、閉環清單、本機／雲端差異）。
5. 雲端另加：先 `git fetch`，查 `git branch -r --no-merged origin/main`；有未合併的 `claude/*` 分支就 checkout 它、掃 `specs/` 殘留信號、從斷點接續，不開新 Task。

## 3. 多 agent pipeline（本機與雲端同一套）

- 主 session 只當 router：不自己寫 spec、實作或測試，依 `specs/` 的信號檔（sentinel）依序派 `pm` → `sa` → `backend` →（含 UI 才派 `frontend`）→ `qa` → `pm` 閉環。角色定義在 `.claude/agents/`，流程與信號檔規則在 `specs/PIPELINE.md`。
- 需求不分大小都走 pipeline：PM 寫 `specs/TaskN.spec.md`、SA 寫影響範圍（`TaskN.impact.md`）、backend 把新 spec／新資料檔加進 `qa_smoke_test.py` 的隱私掃描清單 `scan_files`、QA 實跑冒煙並留證據。
- 只有業務判斷才停下問 Olina；「為什麼 X 還在／沒生效」類問題先走 `specs/PIPELINE.md` 的診斷前置。
- 雲端：每次信號交接後立即 WIP commit＋push 到當前 `claude/*` 分支（信號隨分支入 git，閉環時刪光）；PM 閉環後才開 PR。WIP 與閉環都在同一個 PR。
- 退路（模型不可用、subagent 載入失敗）見 `specs/PIPELINE.md` 第 8 節。

## 4. 冒煙測試

```
PYTHONUTF8=1 python qa_smoke_test.py
```

FAIL＝0 才能開 PR。動到 `sw.js` 的 PRECACHE 清單時，要同步改冒煙裡寫死的筆數（見 `specs/SYSTEM_MAP.md`「冒煙基線含寫死斷言」段）。改本檔或 `specs/STATE.md` 時，冒煙 T30 會驗本檔關鍵字與 STATE 結構，刪字前先看 T30。

## 5. 版號 bump 紀律

- 改到使用者看得到的內容或行為才 bump；純文件、純冒煙不 bump。
- 兩檔三行一起改：`js/version.js` 的 `APP_VERSION`、`APP_VERSION_DATE`，與 `sw.js` 的 `CACHE_VERSION`。
- `APP_VERSION` 與 `CACHE_VERSION` 必須逐字元相等（例：都是同一個 vN）；`APP_VERSION_DATE` 填當天日期 `MM/DD`。

## 6. 個資鐵律

- 個資（護照、訂位碼、電話、密碼、WiFi 等）嚴禁進任何 git 追蹤的檔案。
- `東京/` 在 `.gitignore`，雲端沒有這個資料夾。需要個資的需求，一律走 App 內既有的本機匯入機制，或留給 Olina 回電腦後處理。
- 冒煙有全 repo 舊個資字樣掃描（T25-7）：任何文件都不得寫出該禁用字樣原文，也不得把它的比對規則抄進文件。
- `js/config.js` 的 API key 進版控是已拍板例外（靠參照網址＋API 限制保護），不得移除或改動。
- Pages 以 Jekyll 建置：任何 `.md` 都不得出現 Liquid 樣板開頭符號（兩個左大括號，或左大括號接百分號），否則整站部署失敗。

## 7. 上線方式

1. 以最新 `origin/main` 為基底開 `claude/...` 分支（一律不直接推 main、不 force push）。
2. commit → 開 PR，標題 `TaskN：…` → 把 PR 連結給 Olina。
3. **Merge 只在 Olina 明確說「合併」或「上線」後才做**（她可自己在 GitHub 按，或叫 session 代按）。
4. 一次只開一個未合併 PR；前一個沒合併前不開新 Task（同一 Task 的修正續推同一分支）。
5. Merge 後 GitHub Pages 約 1～2 分鐘部署。開 `https://olina3221.github.io/tokyo-trip/`，看畫面右下、導覽列正上方的版號徽章（`index.html` 的 `#app-version`，格式 `vN · MM/DD`）是否為新版號。PWA 若還是舊版，關掉重開一次讓更新提示出現。
6. 無法開 PR 或 Merge（權限問題）：告訴 Olina 卡在哪一步，交接照寫在分支上，不得改成直接推 main。

## 8. Session 結束交接（強制）

- 每個 session 結束前必須更新 `specs/STATE.md`（覆寫現況、≤4000 字元、四章固定：Current Status／In Progress／Open Items／Last Handoff，Open Items 每條帶「結案條件」）與 `DEVELOPMENT_LOG.md`（append 本次條目，標題含 TaskN 與「閉環」）。
- 交接**跟改動放同一個 PR** 進 main；沒進 main 的交接等於沒寫。
- 只討論、沒改檔的 session，若有新決定或待辦，也要開一個只改 `specs/STATE.md` 的 PR。
- STATE 超過 4000 字元：歷史搬進 `DEVELOPMENT_LOG.md`，STATE 只留現況。兩個 PR 都改 STATE 而衝突時，以後合併者重寫現況為準。

## 9. 不做的事

- 不改 `.gitignore` 的 `東京/` 那一行。
- 不跑 `make_mapdata.py`（會用舊 KML 蓋回 7 月舊地圖點，見 `specs/INDEX.md` 技術債備註）。
- 不 force push、不直接推 main。
- 不碰 spec「不在本次範圍」列的東西；發現順手可改的，寫進交接，由 Olina 決定。
