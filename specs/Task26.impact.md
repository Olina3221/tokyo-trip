# Task26 影響分析（SA v1，2026-10-18）

> spec：`specs/Task26.spec.md`。涉及範圍：**純後端（資料檔工程面，openpyxl）**，無 UI → pipeline 走 backend 完成後直接建 `Task26.done`（不經 frontend）。

## 結論

- 波及面：**零既有功能**。交付物是 `東京\` 下一份新建的 Excel，App（`js/`、`sw.js`、`index.html`、`css/`）、`qa_smoke_test.py`、`make_*.py`、`SYSTEM_MAP.md` 都沒有引用任何 `東京\*.xlsx`（[實測] grep `確認版`／`xlsx`，排除 `東京\` 後只命中 specs 文件與 DEVELOPMENT_LOG）。
- 與 Task25 **檔案零交集**：Task25 動 App 檔＋`.gitignore`；Task26 只讀 1 個 Excel、寫 1 個新 Excel。兩案可並行。唯一共用面＝`specs/INDEX.md`／`DEVELOPMENT_LOG.md`（PM／閉環時寫，寫前重讀、小幅編輯）。
- 不需 bump 版號（`js/version.js`／`sw.js` 不動）、PRECACHE 不變、冒煙基線不加判準。

## 開工前置實測（SA，2026-10-18，唯讀）

| 項目 | 結果 |
|------|------|
| 來源 SHA-256 | `ce62795b…3a9`，與 spec 記載一致 |
| 交付檔 `_v1.1.xlsx` | 不存在（可新建） |
| 目標鎖檔 `~$東京4天上野行程表…` | 不存在。**注意**：同目錄有 `~$東京收據整理.xlsx`（另一檔被 Excel 開著）——與本案無關，**不算停工條件**，backend 勿誤判、也勿刪它 |
| 工作表 | 4 張，與 spec 一致 |
| B19／C19 | 字串型（`s`）、現值 `16:55 → 19:40`／`MM625 成田 T1 → 桃園 T1`，與 spec 盤點一致；第 19 列無合併格 |
| A2／B2／C2／A17／B18／C18／D18 | 與 spec 盤點一致 |
| 公式 | 全活頁簿 0 個 |
| xlsx 內部 parts | 只有 worksheets／styles／sharedStrings／theme／docProps，**無 drawings、images、charts、外部連結、VBA** → openpyxl load→save 不會掉物件，驗收第 4 條（逐格比對）可達成 |

## 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| App 航班／行程顯示 | `js/tripdata.js`、`js/trip-tab.js` | 本案不動；回程 MM623 在 App 端屬 Task25 | ❌ |
| 冒煙基線 | `qa_smoke_test.py` | 不引用 Excel，本案不加判準 | ❌（App 檔零 diff，QA 只需確認 `git status` 中本案無 App 檔變更） |
| Task24 確認版 Excel（來源） | `東京\…確認版.xlsx` | 唯讀；hash 不得變 | ✅（驗收 1） |
| `行前檢查清單.md` | repo 根 | 有 MM62x 字樣但屬 App／7 月內容，本案不動 | ❌ |

## Backend 注意事項

1. 只 `load_workbook(來源)` → 改 `wb.worksheets[0]['B19']`、`['C19']` 的 `.value` → `save(交付路徑)`。⛔ 不對來源路徑 `save()`；以 index 0 取表（表名為中文，避免編碼誤配）。
2. 開工先重算來源 SHA-256；不符停工回報 PM。`_v1.1.xlsx` 已存在 → 停工。
3. 鎖檔判斷只看 `~$東京4天上野行程表` 開頭者；`~$東京收據整理.xlsx` 不相干。
4. Windows 主控台印中文會亂碼（SA 實測 cp950 輸出），回報印值時設 `PYTHONIOENCODING=utf-8` 或寫 UTF-8 檔再讀，以免誤判值錯。
5. 寫入值用與原格一致的字串，箭頭字元沿用原格的 `→`（U+2192）與空白排列——直接從原值做字串替換最保險（`16:55`→`16:40`、`19:40`→`20:00`、`MM625`→`MM623`），避免手打全形／半形差異。
6. Skyliner 核實：以京成官網時刻確認京成上野→成田機場（T1）所需時間，回報附來源 URL；12:00 出發若晚於 14:10 抵達，停工回報 PM。
7. `東京\` 其他檔禁讀禁動（`ls` 列檔名供鎖檔判斷可以，不開檔）。不寫入任何訂位代號／護照號。不 commit（`東京\` 不入版控；目前 `東京/` 在 git status 為 untracked，Task25 會加 `.gitignore`——本案勿 `git add`）。
8. 不需 `Task26.api.md`。完成後建 `Task26.done`（無 frontend 階段）。

## Frontend 注意事項

- 不涉及。

## QA 迴歸測試清單

- [ ] 來源 hash 仍為 `ce62795b5aad0bb1a385390d9a777ce8775bcdcbf3ac676d26c3670abff083a9`
- [ ] App 檔零 diff（本案未改 `js/`、`css/`、`index.html`、`sw.js`、`qa_smoke_test.py`；與 Task25 並行時以檔案清單區分，不以整體 git diff 判）
- [ ] `東京\` 目錄除新增 `_v1.1.xlsx` 外無其他新增／修改（比對 mtime；`~$東京收據整理.xlsx` 屬 Olina 開檔，不計）
- 新功能依 spec「驗收（QA）」1–6 條驗收；第 4 條逐格比對建議以 openpyxl 雙開遍歷四張表全部儲存格（value＋`_style`／number_format／font／fill／border／alignment）＋`merged_cells`＋`column_dimensions`／`row_dimensions`＋`page_setup`／`print_options`／`sheet_properties`。

## 業務層級依賴

- `東京\東京4天上野行程表_20261022-1025確認版_v1.1.xlsx` 與 App `js/tripdata.js` 的航班資料（Task25）是**兩份手動同步的航班副本**，無程式連動。日後航班再改，兩邊都要改（Excel 走另存遞增版號）。
- 「7.21 細節」表（`東京\…確認版.xlsx` 第 4 張）仍含 7 月 MM625 舊回程資訊，屬保留原樣的舊行程；搜尋新行程航班時須排除此表，避免誤判殘留。
