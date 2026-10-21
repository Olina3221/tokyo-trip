# Task30 影響分析（SA）v1

> 2026-10-21，SA。對象 spec：`specs/Task30.spec.md`（PM v1）。急件，10/22 出發前上線。
> 依據：`specs/SYSTEM_MAP.md`（本 repo 無生成腳本／查詢介面，以 grep 定位相關段）、`qa_smoke_test.py` 現況實跑、`check_state.py` 原始碼、my-agent `.claude/hooks/state_inject.ps1`。

## 涉及範圍標記

- **純工程／文件，零 UI**：不動 `index.html`、`js/*`、`css/*`、`sw.js`、`manifest.webmanifest`；不 bump（現況 v28 · 10/19 維持）。
- pipeline 走向：backend 完成後**直接建 `Task30.done`**（跳過 frontend，與 spec「涉及範圍」一致）。
- 不需 Playwright 真瀏覽器測：App 執行期零變化（SYSTEM_MAP 人工補充區 Task23 條的觸發條件「新增分頁／動顯隱／動導覽列」皆不成立）。

## 現況基線（SA 實跑，2026-10-21）

- `PYTHONUTF8=1 python qa_smoke_test.py` → **PASS 93／FAIL 0**（與 spec 引用的 Task29 基線一致）。
- 工作樹：`M DEVELOPMENT_LOG.md`、`M specs/INDEX.md`（PM 立案行）、`?? specs/Task30.spec.md`；main＝origin/main＝`0238b70`。
- Layer 2 `000_Agent/context/STATE.md`：`check_state.py` OK，2900 字元（補「／Tokyo-Trip」後仍遠低於 4000）。

## 受影響的既有功能

| 功能 | 頁面 / 函式 / 檔案 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| T25-7 全 repo 舊個資字樣掃描 | `qa_smoke_test.py` P_OLD 段（tracked ∪ 未追蹤非 ignore 檔） | **新增的 `CLAUDE.md`、`specs/STATE.md`、`Task30.*` 自動進入掃描範圍**（未追蹤檔也掃）。spec §1-7 要求 CLAUDE.md 描述這條掃描——**只能寫「T25-7 舊個資字樣掃描」這類代稱，不得寫出禁用字樣原文，也不得把 P_OLD 正規式抄進任何 .md**，否則立即 FAIL。新 T30 判準的程式碼本身也不得含該字樣 | ✅ |
| T21 隱私掃描 `scan_files` 白名單 | `qa_smoke_test.py` L223–246 | 白名單非全 repo（SYSTEM_MAP 人工補充區「冒煙基線含寫死斷言」條）；spec §4-3 additive 加 4 檔即可。注意 `suspicious_pw`／`suspicious_tel` 只抓「密碼/電話 ＝或： 引號包 8 位以上值」形式——CLAUDE.md 列舉個資類別名詞（護照、訂位碼、電話、密碼、WiFi）不會誤中，但**不要寫出「密碼＋冒號＋引號包 8 位以上值」這類範例**（backend 註：原文此處的範例本身即觸發 T21，已改為文字描述；PM 閉環追認 2026-10-21：改寫正確、語意不變，維持） | ✅ |
| PRECACHE 筆數斷言（寫死 44） | `qa_smoke_test.py` L58–78、`sw.js` `PRECACHE_URLS` | **不受影響**：`CLAUDE.md`／`specs/STATE.md` 不進 PRECACHE、`sw.js` 零 diff → 44 維持 | ✅（隨冒煙全跑） |
| 版號一致性閘 | `js/version.js` `APP_VERSION`／`APP_VERSION_DATE`、`sw.js` `CACHE_VERSION` | 不 bump，兩檔須零 diff；冒煙仍驗 v28==v28 | ✅（隨冒煙全跑） |
| T25-8 `.gitignore` 含 `東京/` | `.gitignore` | 不得改動；CLAUDE.md 只描述、不碰 | ✅（隨冒煙全跑） |
| T25-9 README／manifest 無「四人」 | `README.md`、`manifest.webmanifest` | 本次不動這兩檔；不受影響 | ❌ |
| T22／T27／T28／T29 grep 判準 | 範圍限 `js/tripdata.js` TRIP 段、`js/mapdata.js` | 範圍不含 .md，新文件不受牽連 | ❌ |
| GitHub Pages（Jekyll 建置） | repo 根無 `.nojekyll` → Pages 以 Jekyll 建置，`.md` 經 Liquid 處理後公開 | **新 `.md` 若含 Liquid 語法（雙左大括號、左大括號接百分號這兩種開頭）會讓整站建置失敗＝App 無法部署**。現有 .md 全 repo grep Liquid 開頭符號＝0；CLAUDE.md／STATE.md 須維持 0。公開性已由 PM 裁定 6 接受 | ✅ |
| 本機 Claude Code session 載入 repo `CLAUDE.md` | 本機 cwd 在 tokyo-trip 的 session 與 subagent（pm/sa/backend/qa）都會自動載入 repo 根 `CLAUDE.md` | **雲端精簡流程的文字會被本機多 agent pipeline 讀到**。若判別條款不在最前、措辭不夠硬，本機 backend/qa 可能誤照「不建 sentinel」而斷掉信號鏈。見 Backend 注意事項 1 | ✅（人工抽讀） |
| `check_state.py --all`／`state_overview.py` | my-agent `000_Agent/scripts/` | 以 glob `C:\Python Project\*\specs\STATE.md` 辨識 repo 狀態檔——新建後**自動納入 `--all` 全檢與一頁彙整**，PostToolUse hook（`--hook`）寫入時即驗 | ✅（驗收 2 已含） |
| UserPromptSubmit 注入 hook | my-agent `.claude/hooks/state_inject.ps1` `$triggerTable` | 該檔頭明文「日後新 repo 建 STATE 時，PM 同批補 PROJECTS.md 標註＋本表一列」；**spec §3 未含此列**。不補則本機 session（尤其 cwd 在 my-agent 的 orchestrator）提到東京專案時**不會自動注入** tokyo `specs/STATE.md`，Olina「回電腦接續」靠 session 自己記得去讀。見「待 PM 裁定」 | — |

## 待 PM 裁定（不阻擋 backend 開工）

- **D1：是否同批在 `state_inject.ps1` `$triggerTable` 補一列**（例 `'tokyo-trip' = 'tokyo-trip|Tokyo-Trip|東京自由行'`，避免裸「東京」誤觸發）。SA 建議**補**：成本一行、直接服務 Olina 痛點「回電腦接續」，且是該 hook 自己寫明的建 STATE 同批義務。若補，spec 驗收 4「my-agent diff 只兩檔」須同步改為三檔。（ulinjia-platform 同樣缺列屬既有差異，不在本次範圍。）

## Backend 注意事項

1. **CLAUDE.md 第一段就是本機／雲端判別**（PM 裁定 2），且明寫「在 Olina 電腦上（讀得到 `BOOTSTRAP.md`）時，本檔『雲端精簡流程』與『不建 sentinel』**一律不適用**，照 my-agent 完整 pipeline 與信號檔」。原因：本機 subagent 以 tokyo-trip 為 cwd 時會自動載入本檔。
2. **禁用字樣**：CLAUDE.md §7、impact／spec、T30 程式碼一律不得出現 T25-7 的禁用字樣原文或其 regex；寫「T25-7 舊個資字樣掃描」即可。寫完先跑冒煙看 T25-7。
3. **Liquid 安全**：CLAUDE.md、STATE.md 不得含 Liquid 開頭符號（雙左大括號、左大括號接百分號）（Jekyll 建置失敗會擋全站部署）。可考慮 T30 additive 加一條「兩檔不含 Liquid 開頭符號」——spec 未列，屬 backend 自選加強，不強制。
4. **T30 STATE 判準與 `check_state.py` 同一套判定**：字元數用 Python `len(text)`（`open` 預設文字模式，CRLF 會正規化，與 check_state 的 `read_text` 一致）；H2 用 `^## (.+)$` 全檔 findall 須**恰等於**四章清單；Open Items 條目切分直接沿用 check_state 的 `^- .*(?:\n(?!^[-#>]).*)*`。兩邊判定不一致會出現「本機過、雲端紅」或反之。Last Handoff ≤260 與禁重述 pattern spec 未要求進 T30，可不加；但 STATE.md 內容本身仍須過本機 check_state（驗收 2）——**不要寫 `Layer 3 —` 這種破折號定義句**（RESTATEMENT_PATTERNS 會擋）。
5. **CLAUDE.md 不寫死會漂移的現況值**：不寫目前版號（v28）、不寫 PRECACHE 筆數（44）、不寫冒煙判準總數——現況住 STATE.md、基線值住 SYSTEM_MAP「冒煙基線含寫死斷言」條，CLAUDE.md 只指路。
6. **版號位置描述**：徽章元素 `index.html` `#app-version`（L108），文字由 `js/app.js` 填入 `APP_VERSION + ' · ' + APP_VERSION_DATE`，CSS 為 fixed、`bottom: var(--nav-h)`、`right: 8px`＝**導覽列正上方右側**。CLAUDE.md 寫「畫面右下、導覽列上方的版號徽章」即正確。
7. **T30 關鍵字逐條 PASS**：依 spec §1 去重後 25 個關鍵字（`繁體中文`、`specs/STATE.md`、`specs/INDEX.md`、`specs/SYSTEM_MAP.md`、`BOOTSTRAP.md`、`TaskN.spec.md`、`影響範圍`、`sentinel`、`scan_files`、`qa_smoke_test.py`、`PYTHONUTF8=1`、`js/version.js`、`APP_VERSION`、`APP_VERSION_DATE`、`sw.js`、`CACHE_VERSION`、`逐字元`、`個資`、`東京/`、`PR`、`Merge`、`GitHub Pages`、`版號`、`DEVELOPMENT_LOG.md`、`同一個 PR`）。T30 新增判準數＝存在/長度＋25＋STATE 各項，回報實際條數給 QA 對帳（基線 93 不得減）。
8. **既有判準零改動**：只在 `scan_files` 尾端 additive 加 4 檔＋新增 T30 區塊（放在「結果彙總」之前）；不動 PRECACHE 44、版號閘、T25-7 邏輯。
9. **Layer 2 兩檔只改一處**：my-agent 工作樹有其他 session 未提交變更（`.claude-user/settings.json`、`TAG_INDEX.md`、`specs/STATE.md` 等），backend 只做精準 Edit；改 `000_Agent/context/STATE.md` 時 PostToolUse hook 會自動跑 check_state，須 exit 0。

## Frontend 注意事項

- 本 Task 無 frontend 工作，不經 frontend。

## QA 迴歸測試清單

- [ ] 全系統冒煙 `PYTHONUTF8=1 python qa_smoke_test.py`：FAIL＝0，PASS ≥ 93＋T30 條數（既有 93 條逐條仍在）
- [ ] T25-7 舊個資字樣掃描：掃描檔數比基線多出新增的 .md 檔、命中＝0
- [ ] T21 隱私掃描：`scan_files` 含 4 個新檔、全過
- [ ] 版號閘：`js/version.js`、`sw.js` `git diff` 為空；PRECACHE 44 維持
- [ ] `check_state.py "C:\Python Project\tokyo-trip\specs\STATE.md"` exit 0；`check_state.py`（Layer 2）exit 0；`check_state.py --all` exit 0（新 repo STATE 被納入）
- [ ] `git status --porcelain` 範圍符合 spec 驗收 3（若 D1 採納，my-agent 側多 `state_inject.ps1` 一檔）
- [ ] CLAUDE.md／STATE.md 不含 Liquid 開頭符號（Jekyll）
- [ ] 人工抽讀 CLAUDE.md：判別條款位於最前且明寫本機不適用精簡流程；上線步驟、版號徽章位置（右下、導覽列上方）與實檔一致；未寫死 v28／44
- 新功能（T30 判準本身、STATE 內容）由 QA 依 spec 驗收

## 業務層級依賴

- `CLAUDE.md` 的文字內容 ↔ `qa_smoke_test.py` T30 關鍵字判準：日後任何 session 改寫 `CLAUDE.md` 若刪掉關鍵字，冒煙即紅——兩者須同批改（T30 判準即為入口檔的內容鎖）。
- `specs/STATE.md` 結構 ↔ 雙驗證器：本機 my-agent `000_Agent/scripts/check_state.py`（權威）與雲端 `qa_smoke_test.py` T30（鏡像）；改 STATE 章節規則須兩邊同步，T30 判定以 check_state 為準。
- `CLAUDE.md` ↔ 本機多 agent pipeline：本機 subagent cwd 在本 repo 時會自動載入 `CLAUDE.md`，雲端精簡流程條款必須以判別條款隔離，否則會干擾 `specs/` 信號檔接力。
- `CLAUDE.md`、`specs/STATE.md`、所有 `specs/*.md` ↔ GitHub Pages Jekyll 建置（repo 無 `.nojekyll`）：任一 .md 含 Liquid 語法即擋全站部署（`index.html` 等 App 檔同受影響）。
- `specs/STATE.md` ↔ my-agent `.claude/hooks/state_inject.ps1` 觸發表（D1 待裁）與 `000_Agent/context/PROJECTS.md` 活狀態標註。
