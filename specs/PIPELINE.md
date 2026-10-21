# tokyo-trip 多 agent pipeline 協定（PIPELINE.md）

> **本檔為 tokyo-trip 的 pipeline 權威；本機與雲端同一套。** 角色定義在 `.claude/agents/{pm,sa,backend,frontend,qa}.md`，專案語境（技術棧、角色對應、冒煙跑法）在 `specs/INDEX.md` 與 `CLAUDE.md`，本檔不重述。
>
> **來源與同步規則**：本檔精簡自上游 my-agent `000_Agent/context/protocols/` 五檔——`signal-flow.md`、`qa.md`、`executor-discipline.md`、`code-change.md`、`diagnosis.md`；同步自上游日期 **2026-10-21**（Task31）。本機讀得到上游時，上游僅供同步參考，以本檔為準。上游改了本 repo 會用到的規則（信號流、修復迴圈、閉環清單、model 值）時，由改上游的那個 Task 同批重同步本檔與 `.claude/agents/` 五檔並更新日期。

## 0. 路徑錨定

- 本 repo 根＝`.claude/agents/` 的上兩層（含 `CLAUDE.md`、`specs/INDEX.md` 的那一層）。本檔所有 `specs/` 皆指本 repo 根的 `specs/`。
- cwd 就是本 repo 根（雲端，或本機坐在本 repo）時可用相對路徑；**cwd 不是本 repo 根時（例如本機從別的目錄派工），建／刪／讀 spec 與信號檔一律用本 repo 絕對路徑，禁止裸相對路徑 `specs/`**——否則信號會建進別處的 `specs/`，永遠沒有消費者。

## 1. 主 session＝router

- 主 session 只當 router：**不自己寫 spec、不自己實作、不自己測試**，依 `specs/` 信號檔自動派下一個角色（pm／sa／backend／frontend／qa）。
- 每個需求不分大小都走 pipeline（價值在留下 spec 與信號歷程，讓下一個 session 接得上）。
- 只有需要業務判斷（spec 標 `[待 Olina]`）才停下問 Olina；技術裁定在流程內解決。
- 完整性敏感問題（「為什麼 X 還在／又回來／清不掉／沒生效／時有時無」——同一症狀可能多條獨立成因）**主 session 不自行診斷**，先走第 2 節診斷前置。

## 2. 診斷前置階段（僅完整性敏感問題）

1. 主 session 派 general-purpose 擔任 diagnostician（本 repo 無 diagnostician 角色檔），依下列地板逐欄蒐證：
   - 狀態存活類：①死亡路徑 ②重生路徑 ③持久化路徑 ④獨立性檢查（關 A 不會關 B）。
   - 行為沒生效類：①實際生效路徑 ②覆蓋來源 ③快取／建置產物（PWA 特別注意 service worker 快取）。
   - 間歇偶發類：①觸發條件差異 ②競態／時序 ③環境／狀態相依。
   - 每欄填滿（附 檔案:行號／log／原文）或標 `N/A — <證據>`；空欄＝不完整。地板只能往上加、不能往下扣。
2. diagnostician **只列舉根因、不提修法**；輸出 `specs/TaskN.diagnosis.md`（含覆蓋宣告：還查了什麼、信心、已知盲點、根因數量、是否全部列舉），建 `TaskN.diagnosed`。
3. 【人肉閘】Olina 確認每欄填滿、無可疑空欄 → 建 `TaskN.diagnosis_approved`。
4. PM 基於已核准的 diagnosis 寫 spec、**覆蓋每一條根因**，建 `.ready` 時一併刪 `.diagnosed` 與 `.diagnosis_approved`，spec 註記「本 spec 基於已核准之 TaskN.diagnosis.md」。沒有 `diagnosis_approved`，PM 不得對完整性敏感問題建 `.ready`。
5. 一般單因 bug、純功能新增不走本階段。

## 3. 主信號流與信號檔一覽

```
PM 寫 specs/TaskN.spec.md（含「涉及範圍」與「不在本次範圍」）→ 建 TaskN.ready
  → SA 影響分析：輸出 TaskN.impact.md、spec 末尾補影響分析段，刪 .ready，建 TaskN.sa_done
  → backend 實作（只認 .sa_done，絕不認 .ready），刪 .sa_done：
      含 UI → 建 TaskN.backend_done → frontend 實作，刪 .backend_done，建 TaskN.done
      純後端 → 直接建 TaskN.done
  → QA 測試，刪 .done：
      通過 → 建 TaskN.tested（內含證據）→ PM 閉環
      失敗 → 建 TaskN.qa_failed.md（標歸屬）＋建／增列 TaskN.qa_history.md → 修復迴圈
```

| 信號檔 | 建立者 | 刪除者 | 意義 |
|---|---|---|---|
| `TaskN.diagnosis.md` | diagnostician | 保留不刪 | 根因診斷報告 |
| `TaskN.diagnosed` | diagnostician | Olina 確認後 | 診斷完成待確認 |
| `TaskN.diagnosis_approved` | Olina | pm（建 `.ready` 時）；不走 pipeline 的修法由執行者完成時刪 | 診斷覆蓋已確認 |
| `TaskN.ready` | pm | sa | spec 完成，待影響分析 |
| `TaskN.approved` | Olina（經主 session） | 保留不刪，任何角色不得刪 | 擋工拍板點已裁定（內含授權人、時間、範圍、原話）；僅 spec 含擋工拍板點者需要，backend 須見 `.sa_done`＋`.approved` 才動工、只讀不刪 |
| `TaskN.sa_done` | sa | backend | 可開工 |
| `TaskN.backend_done` | backend | frontend | 後端完成待 UI（僅含 UI） |
| `TaskN.done` | backend／frontend／pm（僅 P-A 或異議撤銷） | qa | 實作完成待測試；含 UI 者只能由 frontend 建 |
| `TaskN.tested` | qa | pm（閉環時） | 測試通過，**內含證據** |
| `TaskN.qa_failed.md` | qa | 歸屬角色；多歸屬由最後修完者；P-A／P-C 由 pm | 失敗明細＋歸屬＋累計失敗次數 |
| `TaskN.qa_history.md` | 建 `.qa_failed.md` 的角色 | 保留不刪 | QA 退回紀錄（append-only） |
| `TaskN.impact.md` | sa | 保留不刪 | 影響分析報告 |

- 除 `.impact.md`／`.diagnosis.md`／`.qa_failed.md`／`.qa_history.md`／`.tested`／`.approved` 有內容外，其餘信號為空檔。
- **禁止自創信號檔名**；新信號需求先改本表。

## 4. 修復迴圈

**歸屬三值與條文引用鐵則**：歸 backend／frontend 的每個問題必須附「歸屬依據（條文）：」——被違反的 spec 章節、SA 段、`TaskN.api.md`、專案錨定（`specs/INDEX.md`／`CLAUDE.md`）或跨專案通則（冒煙基線、Non-scope、畫面中文）。引不出條文的不得歸實作方。判定順序：
1. spec 有條文且實作不符 → 實作方；spec 有條文、實作相符但 QA 有證據該行為錯（不可能成立、與另一條文衝突）→ **pm**（`spec 錯誤`／`spec 矛盾`）。
2. spec 無條文 → 錨定檔／通則有規定 → 實作方；無 → **pm**（`spec 缺漏`，須寫明為何此情境必須有行為，否則不列）。
3. 判準無法產生 PASS／FAIL 證據 → **pm**（`不可驗收`）；QA 不得因此判 PASS、不得自改判準。
4. 越界 Non-scope、冒煙基線未更新、畫面英文殘留 → 實作方。
5. 無法判定 → pm 先裁（讀 spec 與 QA 證據即可，裁定後轉派不增輪次）。

**修復規則**：
- 修復不得繞過 frontend：任務含 UI 且 backend 修復動到 frontend 呼叫的介面（`TaskN.api.md` 要改）→ 更新 api.md、重建 `.backend_done`；介面未變才可直接重建 `.done`。
- 多歸屬順序固定 **pm → backend → frontend**。各角色修完只在 `.qa_failed.md` 內把自己的問題標「✅ 已修復＋一句」，不刪檔、不建 `.done`；全部標完後由**最後完成的角色**刪檔重建 `.done`。
- 刪 `.qa_failed.md` 前，刪檔者先在 `TaskN.qa_history.md` 該輪列填「處置」欄。
- `.done` 重現時 QA **完整重跑**，不接受只補測失敗項。

**異議路**：實作方認為根源是 spec → 在該問題下標「異議→pm＋一句理由」、停工回報主 session 派 PM；不自改 spec、不自選一邊實作。PM 三選一：維持實作方／改歸 pm／該輪撤銷（`qa_history` 歸屬填 `qa`，PM 重建 `.done` 並註明撤銷理由後刪檔）。異議與轉派不增輪次。

**pm 退回三路徑**（PM 只修 spec、不動程式碼；修訂處標「v2（TaskN 第 k 輪退回修訂）」）：
- **P-A** 純 spec 修正、實作零改 → PM 刪 `.qa_failed.md`、重建 `.done`，QA 依修訂後 spec 完整重測。
- **P-B** 需實作改、影響範圍不變 → PM 把 pm 問題標「✅ spec 已修訂 v2」並新增轉派問題（歸屬實作方、引修訂後條文），交回修復迴圈。
- **P-C** 影響範圍擴大或方向改 → PM 把 `.qa_failed.md` 完整 append 進 `qa_history` 後刪檔、重建 `.ready`，SA 做 v2 影響分析（覆寫 impact.md、保留 v1 段）。
- 需業務判斷 → Task 停在 `.qa_failed.md`，PM 回報主 session 轉問 Olina。

**`TaskN.qa_history.md` 格式**（首次建 `.qa_failed.md` 時同步建立，之後只增列、只填空著的處置欄；首輪即 PASS 不建＝0 輪；欄位不得增減）：

```
# TaskN QA 退回紀錄（append-only）
| 輪 | 日期 | 結果 | 歸屬 | 原因類型 | 摘要（一句，含被違反／有誤的條文） | 處置 |
|----|------|------|------|----------|------------------------------------|------|
| 1 | 2026-10-21 | FAIL | backend | 新功能異常 | 判準 3：… 違反 spec §2 | backend 修… → 重建 .done |
| 2 | 2026-10-21 | PASS | — | — | 判準 1–N 全綠 | .tested |
```

一輪多問題＝每問題一列、同輪號；輪次＝相異輪號數。原因類型封閉枚舉：實作方＝`既有功能損壞`／`新功能異常`／`越界 Non-scope`／`冒煙基線未更新`／`畫面英文殘留`／`證據不足`；pm＝`spec 矛盾`／`spec 缺漏`／`spec 錯誤`／`不可驗收`；qa＝`誤判`／`測試方法錯誤`。

**閉環彙整行**（PM 寫進 `DEVELOPMENT_LOG.md` 閉環條目，0 輪也寫）：`QA 退回：N 輪（backend a／frontend b／pm c／qa d）→ TaskN.qa_history.md` 或 `QA 退回：0 輪`。

**熔斷**：`.qa_failed.md` 內記「累計失敗次數」＝QA 退回總輪次（不分歸屬、不因轉派／異議／撤銷／P-C 歸零）。同一 Task 連續退回 **3 輪** → 停止修復迴圈，回報主 session 分流：
- 主 session 可直接授權修復（修完告知 Olina）須同時滿足：缺陷明確且改法唯一、與需求語意無關、非修了又壞同一處、QA 其餘驗項全 PASS。
- 否則升級 Olina。三輪中任一輪歸屬 pm，或同一條文被修訂兩次 → 一律升級 Olina。撤銷輪照計一輪。

## 5. QA 要點與 `.tested` 證據

- QA 三階段依序：①全系統冒煙（`PYTHONUTF8=1 python qa_smoke_test.py`，FAIL 即停）＋impact.md 迴歸清單逐項確認＋檢查本次新功能已加入冒煙基線；②本次 spec 冒煙（入口可載入、核心可呼叫）；③整合測試（逐條判準、邊界、Non-scope 越界檢查、動到 UI 者驗畫面零英文鍵）。
- QA 只能把測試門檻往上加，不能往下扣；不修程式、不修 spec、不自改判準；不宣稱「需求已完成」（驗收屬 Olina）。
- **`.tested` 不得空檔**，須含：冒煙實跑輸出的 PASS／FAIL 數、本輪判準逐條結果、工作樹核對（`git status --porcelain` 只含 spec 許可的檔）。空 flag 判 FAIL。

## 6. PM 閉環檢查清單（取代本機 hook 的可重跑指令）

刪 `.tested` 前逐條跑、逐條成立：
1. `grep -n "TaskN 閉環" DEVELOPMENT_LOG.md` 非空——閉環條目標題行須主號與「閉環」同行（例：`- 2026-10-21 [TaskN 閉環: PM] 一句話`），且條目含 `QA 退回：` 彙整行。
2. 暫時性信號零殘留（`.tested` 本身刪除後再跑）：`ls specs | grep -E "^TaskN\.(ready|sa_done|backend_done|done|tested|diagnosed|diagnosis_approved)$|^TaskN\.qa_failed\.md$"` 輸出為空。只留 `.impact.md`／`.diagnosis.md`／`.qa_history.md`（與 `.approved`）。
3. `specs/INDEX.md` Roadmap 狀態欄、`specs/SYSTEM_MAP.md`（本 repo 無生成腳本，PM 手動更新）、`specs/STATE.md` 已更新。
4. 冒煙 FAIL＝0（PM 自己再跑一次看末段）。

主 session 開工時也跑一次第 2 條的通配版（`ls specs | grep -E "\.(ready|sa_done|backend_done|done|tested|diagnosed|diagnosis_approved)$|\.qa_failed\.md$"`），有殘留＝有未完成 Task，先接續、不開新 Task。

## 7. Task 顆粒度、Non-scope 與執行者紀律

- **顆粒度**：一個 Task 小到 QA 能單輪驗收；需求含多個獨立可驗收單位就拆成多個 TaskN 依序排。
- **Non-scope 護欄**：spec「不在本次範圍」是必填護欄（全不適用也寫「無」）。執行者發現 Non-scope 內的順手改善 → 記入完成回報、不執行，由 PM 決定是否另開 Task；QA 越界即 FAIL（歸實作方），即使改動本身是好的。
- **證據等級**：spec 涉及外部現實的假設標 `[實測]`（附指令與輸出）／`[推斷]`（拍板點前須轉實測）／`[待 Olina]`（只有業務端知道，任何 agent 不得自行推定）。能實測的不得標推斷。
- **執行者紀律**：動手前先讀現況、不靠記憶；遇到任務未涵蓋的狀況停下回報、不自選替代方案；完成回報「做了什麼、改了哪裡、實跑輸出」，不自稱「已驗收」；不確定的狀態不做不可逆動作；**不得把紅燈改綠**（不放寬斷言、不加豁免、不改別的 Task 的檢查，只能修好成因）；測項必須真的被執行才計入通過數；有紀錄的裁定不得自行推翻，覺得過期就回報請裁。
- **PM 不寫程式、SA 不寫程式不改業務規則、backend 不寫 UI、frontend 不寫業務邏輯、QA 不修程式**。

## 8. 本機／雲端差異（只有這幾條）

- **(a) 雲端 WIP commit**：每次信號交接（建／刪任一信號、或角色完成產出）後，主 session 立即 commit＋push 到當前 `claude/*` 分支，訊息 `TaskN WIP：<角色> 完成，建 <信號>`；信號隨分支入 git（雲端容器 session 結束即消失，沒 push＝沒交接）。PM 閉環時刪光暫時性信號，閉環 commit 後 PR 的最終 diff 不含任何暫時性信號。
- **(b) 雲端開工接續**：第一步 `git fetch`，查 `git branch -r --no-merged origin/main`；有未合併的 `origin/claude/*` 分支 → checkout 該分支、掃 `specs/` 殘留信號、從斷點接續，不開新 Task、不開新分支。最後一次 WIP commit 之後的工作若遺失，從最後一個信號重做該角色。兩 session 同時接續時以先 push 者為準，後者 pull 後重判信號。
- **(c) 雲端收尾**：PM 閉環後主 session 最終 commit → push `claude/*` 分支 → 開 PR（標題 `TaskN：…`）→ 給 Olina PR 連結。WIP 期間只推分支不開 PR。Merge 只在 Olina 明說「合併」或「上線」後；一次只留一個未合併 PR。push 被拒或開 PR 失敗：告訴 Olina 卡在哪一步，不改推 main、不 force push。
- **(d) 本機**：信號不 commit（本機 session 持續存在）；閉環後由主 session commit，push 依 Olina 指示。
- **(e) 退路**：
  - 模型不可用：派某角色時因 model 不可用報錯 → 主 session 以同一 `subagent_type` 重派、帶 `model` 參數＝主 session 自身模型，**重派的 prompt 內必含「覆寫理由：雲端無 <model>」**（本機 model 覆寫閘只認 prompt 內此標記），並在 `specs/STATE.md` Last Handoff 記同一句；不改 agent 檔的 model 欄位。
  - subagent 完全載入失敗（看不到 pm／sa／… 可派）：主 session 依本檔與各角色檔**依序自行扮演**，但照建／刪信號、照 WIP commit（留痕與接續能力不打折），INDEX 狀態欄註明「雲端單 session 代跑（subagent 未載入）」。這是退路不是常態。

## 9. 交接

- 每個 session 結束前更新 `specs/STATE.md`（≤4000 字元、四章固定、Open Items 每條帶結案條件）；雲端在 In Progress 寫明目前停在哪個信號、哪條分支，並隨分支 commit＋push。
- 交接以 git 為唯一真相。
