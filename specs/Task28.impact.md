# Task28 影響分析（SA v1，2026-10-19）

> spec：`specs/Task28.spec.md`。涉及範圍：**純後端（資料檔＋冒煙基線＋版號）**，無 UI → backend 完成後直接建 `Task28.done`（不經 frontend）。

## 結論

- 波及面＝**行程分頁 Day 2 單日下鑽第 3 筆**（新增 detail）與**地圖分頁 10/23 點位清單**（6→7 點）兩處資料增量；渲染程式零 diff 可承接（[實測] 見下）。
- 唯一「必壞」連動：**冒煙基線 T27-4（Day 2 無 detail 鍵）與 T27-5（10/23 名稱清單＋點數 6）在資料改完當下必 FAIL**——backend 必須同批改寫，否則 QA 第一階段即退回。
- 主要風險＝座標查證品質（OSM 可能抓到已歇業表参道店）與 detail 字串在冒煙比對時的跳脫層級。

## 開工前置實測（SA，2026-10-19，唯讀）

| 項目 | 結果 |
|------|------|
| `js/version.js`／`sw.js` | 現為 `v26`／`10/19`／`CACHE_VERSION='v26'`，與 spec §4 起點一致 |
| `js/tripdata.js` Day 2 | L90 `{ time: "09:00", title: "麥當勞早餐後前往東京地下街" }`，無 detail，與 spec 描述一致 |
| `js/mapdata.js` 10/23 | L15–23 恰 6 點，順序與 spec §2 一致；檔頭註解現為「Task25／Task27 手寫」 |
| `trip-tab.js` detail 渲染 | L210–215：`if (item.detail)` → `escHtml(item.detail).replace(/\n/g,'<br>')`；`\n` 換行、全形字與 emoji 安全（tripdata 已有 emoji 先例） |
| `map-tab.js` | 全檔無依點位 index 的邏輯（grep `places[`／`idx` 無命中）；deep-link 一律 lat,lon、`name` 只做顯示 → 插在第 4 位不影響 A/B 預設與 URL |
| 冒煙基線 | T27-4（L477–481）任何 Day 2 item 含 detail 即 FAIL；T27-5（L491–498）10/23 名稱逐字清單＋`T27_MAP_COUNT['2026-10-23']=6`；T27-1/2 用 `\{[^{}]*\}` 切 item、`"([^"]*)"` 抓字串 |
| T25-4 禁字／隱私 regex | 新內容（原宿竹下通、神宮前1-19-8、營業時間）不觸發 `駒形／民宿／橫濱／横浜／2026-07-` 與 `密碼=`／`電話=` 模式；P-OLD 不觸發 |
| `表参道`／`1-13-9` 現況 | `js/` 全部 grep=0（僅 Task17.impact.md 有無關的「Luke's Lobster 表参道店」，不在 T28-3 掃描範圍） |
| 工作樹 | 未提交：`DEVELOPMENT_LOG.md`（PM 立案條目）、`specs/Task28.*`；Task27 已 commit cea7481 未 push |

## 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 行程單日下鑽 Day 2 | `trip-tab.js` L129–215 | 09:00 筆新增 4 行 detail；其他 7 筆仍無 detail，不得出現空白細節列 | ✅ |
| 行程總覽日卡 | `trip-tab.js` 總覽（theme） | theme 不動，零影響 | ✅（順帶看） |
| 行程 Day1／Day3／Day4、航班、飯店、重要資料 | `tripdata.js` 其他段 | 零 diff，靠 T25／T27 系列與 git diff 範圍守 | ✅ |
| 折價券 | `tripdata.js` COUPONS＋`coupon-viewer.js` | 同檔不同段零 diff；bump 後券圖重快取（既知成本） | ✅（開 1 張券） |
| 地圖點位清單＋deep-link | `map-tab.js` L83–104、L248 | 10/23 6→7 點；新點名稱 20 字（`マクドナルド 原宿竹下通り店（麥當勞早餐）`）為目前最長點名，390px 換行需目視 | ✅ |
| 地圖 A→B 路線 | `map-tab.js` | 明治神宮→麥當勞、麥當勞→東京駅 URL 帶 `hl=zh-TW`、座標 lat,lon | ✅ |
| 地圖其他日 | `mapdata.js` 10/22、10/24、10/25 | 零 diff（T27-5 守） | ✅ |
| 版號徽章／更新 toast | `version.js`＋`sw.js`＋`app.js` | v26→v27 兩檔三行；PRECACHE 44 不變 | ✅ |
| 購物、常用句、翻譯、拍照 | 各 tab | 不碰 | ❌ |

## Backend 注意事項

1. **tripdata.js 只改 L90 一行**：加 `detail` 鍵，用 Edit 精準替換。detail 在 JS 原始碼中以 `\n` 跳脫表示（雙引號字串），**內文不得含 ASCII 雙引號**（spec 用的是「」全形，OK）——否則 T27-1/2 的 `"([^"]*)"` 與 `\{[^{}]*\}` 會切壞；也不得含 `{` `}`。
2. **冒煙 T28-1 跳脫層級**：基線是讀 JS 原始碼字串做比對，原始碼裡是字面 `\n`（反斜線＋n）。比對時二擇一並寫清楚：預期值用 Python raw 字面 `\\n`，或抽出後 `.replace('\\n','\n')` 再與 spec 逐字比。勿兩邊混用導致假綠／假紅。
3. **T27-4 修訂**：Day 2 改為「除 time=`09:00` 那筆外皆無 detail」，且 09:00 那筆**必須有** detail（防退化成無條件放行）；Day 3 維持全無。**T27-5 修訂**：10/23 名稱清單插第 4 位、`T27_MAP_COUNT['2026-10-23']=7`。T27-1/2/3 不改。同一段落註明「Task28 修訂」。
4. **T28-2 haversine**：從 MAPDATA 解析 `原宿駅` 與第 4 點座標算距離，100～400m 才 ok；名稱比對逐字（含半形空格與全形括號）。
5. **T28-3**：掃描範圍＝TRIP 段＋`js/mapdata.js`（不含 specs——spec／impact 本身合法含「表参道店」字樣說明禁用）。
6. **scan_files** additive 加 `specs/Task28.spec.md`、`specs/Task28.impact.md`（SYSTEM_MAP「scan_files 寫死白名單」紀律）。PRECACHE `== 44` 不改。
7. **mapdata.js**：手寫，⛔ 不跑 `make_mapdata.py`。既有 6 點行逐字不動；新行格式比照 `{"name": "...","lat": ...,"lon": ...}`；檔頭第 1、3 行註解改為 Task25／Task27／Task28。座標查證：OSM 若回多筆麥當勞，以地址 `神宮前1-19-8`／`原宿ファミリービル` 篩；命中 `1-13-9` 一律捨棄。兩來源差距 >150m 或距原宿駅不在 100～400m → 停工回報 PM。
8. **DEVELOPMENT_LOG**：實作條目依 spec §2 規則 3 寫證據鏈；條目內不要提舊住宿名稱（T25-7 全 repo P-OLD 掃描會掃 LOG）。PM 立案條目已在工作樹中（未提交），append 在其後即可。
9. **版號**：`APP_VERSION='v27'`、`APP_VERSION_DATE` 實作當日、`CACHE_VERSION='v27'`，三處逐字元。
10. 不需 `Task28.api.md`（無介面變更）。完成後建 `Task28.done`。

## Frontend 注意事項

- 不涉及（`trip-tab.js`／`map-tab.js`／`style.css`／`index.html` 零 diff）。新點名稱較長的換行觀感由 QA 目視；若溢出屬新 Task，不在本輪改 CSS。

## QA 迴歸測試清單

- [ ] `PYTHONUTF8=1 python qa_smoke_test.py` 全綠（T25 全系列、T27-1～5（含 Task28 修訂）、T28-1～3、版號一致、PRECACHE 44、隱私掃描含 Task28 兩檔）
- [ ] `git diff --stat` 只含 spec 驗收第 2 條白名單；`tripdata.js` diff 恰 1 行（Day 2 09:00）、COUPONS 段零 diff；`mapdata.js` diff＝檔頭註解＋1 新行
- [ ] 行程 Day 2 下鑽：09:00 筆 4 行 detail 正常換行、390px 不溢出；其他 7 筆無空白細節列；Day1／Day3／Day4 下鑽與 v26 相同
- [ ] 地圖：10/23 7 點且順序同 spec §2；新點長名稱 390px 換行可讀；單點開圖與兩段 A→B URL 帶 `hl=zh-TW`；10/22、10/24、10/25 點數 3／4／3 不變
- [ ] 折價券開 1 張券圖可載（tripdata.js 雙契約迴歸）
- [ ] 版號徽章 `v27 · MM/DD`；console 無錯誤
- 新功能由 QA 依 spec 驗收 1～6 條（座標以 Google 地圖抽查 100m 內）

## SYSTEM_MAP 更新（交 PM 閉環時做；本 repo 無生成腳本、手動維護）

PM 閉環時依實況改 `specs/SYSTEM_MAP.md`：
- L15 `version.js`、L35 `sw.js`：Task 清單加 28、現況改 `'v27'`。
- L19 `tripdata.js`：Task 清單加 28；Task27 段「無 detail」後補「（Task28 起 Day2 09:00 那筆有 detail：麥當勞原宿竹下通店店名／地址／營業時間）」。
- L20 `mapdata.js`：Task 清單加 28；「Day2（10/23）6 點」改 7 點（Task28 插第 4 點麥當勞）。
- L42 `qa_smoke_test.py`：Task 清單加 28、補 T28-1～3 與 T27-4/5 修訂。
- 另：`specs/INDEX.md` roadmap 加 Task28 列（PM）。

## 業務層級依賴

- `js/tripdata.js` Day 2 09:00 那筆 title 與 `東京\東京4天上野行程表_20261022-1025確認版_v1.1.xlsx` 仍逐字一致；店名／地址／營業時間**只存在 App（detail）**，Excel 不同步——日後若以 Excel 重刷 Day 2，必須保留此 detail，否則麥當勞資訊消失。
- `js/mapdata.js` 10/23 第 4 點與 `js/tripdata.js` Day 2 09:00 筆為人工對應（無程式連動）；店家若再換（例如改其他分店），兩處須同批改，且 `qa_smoke_test.py` T28-1／T28-2／T27-5 寫死值同批改寫。
- `qa_smoke_test.py` T28-3 把「原宿表参道店（神宮前1-13-9）已歇業禁用」寫成機械閘——日後若該店重開或 Olina 改選，需先改此斷言。
- `make_mapdata.py` 重生成風險不變（KML 仍為 7 月版，跑了會蓋掉本點與 Task25／27 全部手寫點）。
