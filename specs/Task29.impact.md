# Task29 影響分析（SA v1，2026-10-19）

> spec：`specs/Task29.spec.md`（v1.1，4 家萬代扭蛋官方店）。涉及範圍：**純後端（資料檔＋冒煙基線＋版號）**，無 UI → backend 完成後直接建 `Task29.done`（不經 frontend）。

## 結論

- 波及面＝**行程分頁 Day 2 三筆／Day 3 一筆的 detail 增量**與**地圖分頁 10/23（7→10）、10/24（4→5）點位增量**；渲染程式零 diff 可承接（[實測] 見下）。做法與 Task28 同型，無新機制。
- 「必壞」連動：**T27-4（`T28_DETAIL_TIME` 為 iso→單一 time 的 dict）與 T27-5（名稱清單＋`T27_MAP_COUNT`）在資料改完當下必 FAIL**——backend 須同批改寫；T27-4 須改為 iso→time **集合**，不是再加一個 key。
- 一個 spec 未點名的陷阱：**`js/tripdata.js` COUPONS 段 L272 已含「西武池袋」**（既有折價券 notes）。T29-3 掃描範圍必須是 TRIP 段（`trip_seg`）＋mapdata.js，不得掃整個 tripdata.js，否則必紅；COUPONS 依 spec 零 diff、不得刪該字。
- 主要風險＝店名／營業時間／座標查證品質（spec §4 已訂停工條件），與 Task28 相同。

## 開工前置實測（SA，2026-10-19，唯讀）

| 項目 | 結果 |
|------|------|
| `js/version.js`／`sw.js` | 現為 `v27`／`10/19`／`CACHE_VERSION='v27'`，與 spec §5 起點一致 |
| `js/tripdata.js` Day 2 | L91 `中午`、L92 `14:30`、L93 `17:00` 皆無 detail；L90 `09:00` 有 Task28 麥當勞 detail（須零 diff） |
| `js/tripdata.js` Day 3 | L105 `13:00 前往秋葉原` 無 detail；Day 3 另有 `中午`（L104），不得誤掛 |
| time 唯一性 | Day 2、Day 3 內各 time 唯一 → 以 (isoDate, time) 定位不會撞；Day 1 也有 `17:00`（有 detail）但 T27 系列只看 10/23、10/24 |
| `js/mapdata.js` | 10/23 恰 7 點、10/24 恰 4 點，順序與 spec §2 一致；檔頭註解現為「Task25／Task27／Task28 手寫」（L1、L3 兩處） |
| `trip-tab.js` detail 渲染 | L210–215：`escHtml(item.detail).replace(/\n/g,'<br>')`；`.trip-item-detail` `white-space:pre-wrap`（style.css L753–759）→ 多行、emoji、`@` 安全 |
| `map-tab.js` | 點名 `textContent` 顯示（L248），無依 index 邏輯；`.map-place-name` 有 `word-break: break-all`＋`overflow:hidden`（style.css L3115–3133）→ 30 字長名應會換行，不致水平溢出（仍由 QA 390px 目視） |
| 冒煙基線 | T27-4（L452–496）`T28_DETAIL_TIME={'2026-10-23':'09:00'}`、`h != (t == must_detail)`；T27-5（L506–538）`T27_MAP_COUNT` 10/23=7、10/24=4；T28-2 取 `pts23[3]`＝第 4 點（新點皆插在第 5 位之後，不受影響）；scan_files L223–243 |
| T25-4 禁字 | `駒形／民宿／橫濱／横浜／2026-07-／2026/07/` 掃 TRIP 段＋mapdata.js；4 家地址（丸の内／浅草2-28-1／押上1-1-2／外神田1-15-9）皆不觸發 |
| 「池袋」「歌舞伎」現況 | TRIP 段＋mapdata.js grep=0；**COUPONS 段 L272「西武池袋」1 處**（見結論） |
| 工作樹 | 未提交：`DEVELOPMENT_LOG.md`（PM 立案條目 L256）、`specs/INDEX.md`、`specs/Task29.*`；Task28 已 commit bfdb8dc |

## 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 行程單日下鑽 Day 2 | `trip-tab.js` L129–215 | `中午`／`14:30`／`17:00` 各加 3～4 行 detail；`09:00` 麥當勞 detail 零 diff；`05:30`／`06:30`／`晚間`／`20:00` 仍無 detail，不得出現空白細節列 | ✅ |
| 行程單日下鑽 Day 3 | 同上 | `13:00` 加 detail；其餘 4 筆無 | ✅ |
| 行程總覽日卡 | `trip-tab.js` 總覽（theme） | theme 不動 | ✅（順帶看） |
| 行程 Day1／Day4、航班、飯店、重要資料 | `tripdata.js` 其他段 | 零 diff，靠 T25／T27 系列與 git diff 範圍守 | ✅ |
| 折價券 | `tripdata.js` COUPONS＋`coupon-viewer.js` | 同檔不同段零 diff（含 L272「西武池袋」不得動）；bump 後券圖重快取（既知成本） | ✅（開 1 張券） |
| 地圖點位清單＋deep-link | `map-tab.js` L83–104、L245–287 | 10/23 7→10、10/24 4→5；新點名約 30 字為目前最長，依賴 `word-break:break-all` 換行 | ✅ |
| 地圖 A→B 路線 | `map-tab.js` | 東京駅→@TOKYO STATION、浅草寺→花やしき店、秋葉原駅→秋葉原店 URL 帶 `hl=zh-TW`、座標 lat,lon | ✅ |
| 地圖其他日 | `mapdata.js` 10/22、10/25 | 零 diff（點數 3／3） | ✅ |
| Task28 麥當勞 | `tripdata.js` L90、`mapdata.js` 10/23 第 4 點 | 位置序號不變（新點全在第 5 位之後）；T28-1／2／3 不改仍須綠 | ✅ |
| 版號徽章／更新 toast | `version.js`＋`sw.js`＋`app.js` | v27→v28 兩檔三行；PRECACHE 44 不變 | ✅ |
| 購物、常用句、翻譯、拍照 | 各 tab | 不碰 | ❌ |

## Backend 注意事項

1. **tripdata.js 只改 L91、L92、L93、L105 四行**，各加 `detail` 鍵（Edit 精準替換，比照 L90 單行寫法）。detail 為雙引號字串、以 `\n` 跳脫換行；**內文不得含 ASCII `"`、`{`、`}`**（T27-1/2 用 `\{[^{}]*\}` 切 item、`"([^"]*)"` 抓字串）。`@` 安全。
2. **@TOKYO STATION 寫法一致**：spec 格式模板「ガシャポンバンダイオフィシャルショップ <分店名>」中間有半形空格，但 PM 裁定 2 寫「`@` 前無空格照官方」。以官方查證寫法為準，**detail 第一行、mapdata 點名、T29-1／T29-2 斷言三處逐字一致**；另三家分店名前有半形空格（同 spec §2 範例）。
3. **T27-4 修訂**：`T28_DETAIL_TIME` 改為 iso→**集合**，例 `{'2026-10-23': {'09:00','中午','14:30','17:00'}, '2026-10-24': {'13:00'}}`，判斷改 `h != (t in must_set)`；白名單式「有該有、無該無」保留（防放寬）。ok 訊息與段落註明「Task29 修訂」。
4. **T27-5 修訂**：10/23 名稱清單改 spec §2 的 10 點、10/24 改 5 點；`T27_MAP_COUNT` 10/23=10、10/24=5（10/22、10/25 仍 3）。座標範圍檢查 lat∈[35,36]、lon∈[139,141] 新點皆在內。
5. **T29-1**：以 (isoDate, time) 取 item 再驗 detail 含店名日文＋地址關鍵字；比對前同 Task28 處理跳脫層級（原始碼是字面 `\n`，二擇一寫清楚，勿混用）。
6. **T29-2**：名稱逐字＋位置序號（10/23 第 6／8／10 點、10/24 第 4 點，1-based）＋haversine 距離（spec §2 規則 3 四條）；可重用 T28-2 的 haversine。
7. **T29-3**：掃描範圍＝`trip_seg`＋`mapdata_js`，**不得掃整個 `tripdata_js`**——COUPONS L272「西武池袋」會讓整檔掃描必紅；specs 不掃（spec 合法含池袋字樣）。
8. **scan_files** additive 加 `specs/Task29.spec.md`、`specs/Task29.impact.md`。PRECACHE `== 44` 不改。
9. **mapdata.js**：手寫，⛔ 不跑 `make_mapdata.py`。既有點行逐字不動；新行格式比照 `{"name": "...","lat": ...,"lon": ...}`（小數 ≥4 位）；檔頭 L1、L3 兩處註解改「Task25／Task27／Task28／Task29」。座標雙來源、>150m 或合理性距離超界 → 停工回報 PM（spec §2）。
10. **查證停工條件**（spec §4）：店已歇業或地址不符截圖 → 停工回報 PM；分店名與 PM 預期不同 → 以官方為準、同步改 detail／點名／斷言並記 LOG，不需回報。營業時間兩來源不一致 → 整行不寫（T29-1 不得斷言營業時間）。
11. **DEVELOPMENT_LOG**：實作條目 append 在 L256 PM 立案條目之後，寫 4 店證據鏈；不提舊住宿名稱（T25-7 P-OLD 全 repo 掃描含 LOG）。
12. **版號**：`APP_VERSION='v28'`、`APP_VERSION_DATE` 實作當日、`CACHE_VERSION='v28'`，三處逐字元。
13. 不需 `Task29.api.md`（無介面變更）。完成後跑 `PYTHONUTF8=1 python qa_smoke_test.py` 全綠，建 `Task29.done`。

## Frontend 注意事項

- 不涉及（`trip-tab.js`／`map-tab.js`／`style.css`／`index.html` 零 diff）。長點名換行由 QA 390px 目視；若溢出屬新 Task，本輪不改 CSS。

## QA 迴歸測試清單

- [ ] `PYTHONUTF8=1 python qa_smoke_test.py` 全綠（T25 全系列、T27-1～5（含 Task29 修訂）、T28-1～3 不改仍綠、T29-1～3、版號一致、PRECACHE 44、隱私掃描含 Task29 兩檔）
- [ ] 突變抽查（建議）：任一新 detail 刪掉、或 Day 2 `晚間` 多掛 detail，T27-4 須紅（確認集合式白名單未放寬）
- [ ] `git diff --stat` 只含 spec 驗收第 2 條白名單；`tripdata.js` diff 恰 4 行（L91/92/93/105）、L90 與 COUPONS 段零 diff；`mapdata.js` diff＝檔頭 2 行註解＋4 新行
- [ ] 行程 Day 2／Day 3 下鑽：4 筆新 detail 正常換行、390px 不溢出；麥當勞 detail 不變；其他筆無空白細節列；Day1／Day4 下鑽與 v27 相同
- [ ] 地圖：10/23 10 點、10/24 5 點且順序同 spec §2；長名 390px 換行可讀、無水平溢出；單點開圖與三段 A→B URL 帶 `hl=zh-TW`；10/22、10/25 各 3 點不變
- [ ] 折價券開 1 張券圖可載（tripdata.js 雙契約迴歸）
- [ ] 版號徽章 `v28 · MM/DD`；console 無錯誤
- 新功能由 QA 依 spec 驗收 1～6 條（座標 Google 地圖抽查 150m 內，商場／地下街店可用建物位置）

## SYSTEM_MAP 更新（交 PM 閉環時做；本 repo 無生成腳本、手動維護）

PM 閉環時依實況改 `specs/SYSTEM_MAP.md`：
- `version.js`、`sw.js` 列：Task 清單加 29、現況改 `'v28'`。
- `tripdata.js` 列：Task 清單加 29；detail 現況補「Task29 起 Day2 中午／14:30／17:00、Day3 13:00 有扭蛋店 detail」。
- `mapdata.js` 列：Task 清單加 29；10/23 改 10 點、10/24 改 5 點。
- `qa_smoke_test.py` 列：Task 清單加 29、補 T29-1～3 與 T27-4（集合式）／T27-5 修訂。
- 另：`specs/INDEX.md` roadmap 加 Task29 列（PM）。

## 業務層級依賴

- `js/tripdata.js` Day 2 `中午`／`14:30`／`17:00`、Day 3 `13:00` 的 title 仍與 `東京\東京4天上野行程表_20261022-1025確認版_v1.1.xlsx` 逐字一致；扭蛋店資訊**只存在 App（detail）**，Excel 不同步——日後以 Excel 重刷 Day 2／Day 3 必須保留這 4 筆 detail（及 Task28 的 09:00）。
- `js/mapdata.js` 4 個扭蛋點與 `js/tripdata.js` 對應 4 筆 detail 為人工對應（無程式連動）；換店或刪店時兩處須同批改，`qa_smoke_test.py` T29-1／T29-2／T27-4／T27-5 寫死值同批改寫。
- `qa_smoke_test.py` T29-3 把「池袋 2 家、歌舞伎町店不加」寫成機械閘（範圍 TRIP 段＋mapdata.js）；`js/tripdata.js` COUPONS 段既有「西武池袋」是折價券適用店說明，與本閘無關，日後若有人把 T29-3 擴到整檔會誤紅。
- `make_mapdata.py` 重生成風險不變（KML 仍為 7 月版，跑了會蓋掉 Task25／27／28／29 全部手寫點）。
