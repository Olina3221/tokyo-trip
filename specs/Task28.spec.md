# Task28 — 10/23 早餐麥當勞（原宿竹下通店）加入 App

> PM spec v1，2026-10-19。Olina 原話：「可以 幫我+到 APP上。這樣找它比較快」（指 10/23 早餐的麥當勞）。**急件**：10/22 出發，須於出發前部署上線。

## 功能描述

把 10/23 早餐要去的「麥當勞 原宿竹下通店」放進 App：地圖分頁 10/23 多一個點（可一鍵開 Google 地圖導航），行程分頁 10/23「09:00 麥當勞早餐…」那筆附上店名、位置與營業時間。

## 背景與已拍板決策（不重議）

- 已完成：Task27（v26，commit cea7481，未 push）補齊 Day 2／Day 3 行程與地圖點，當時裁定「麥當勞 Excel 未指明哪一家，不建點」。Olina 已指定店家，本 Task 就是補這一點。
- 已拍板：
  1. **店家**＝マクドナルド 原宿竹下通り店（McDonald's 原宿竹下通店），東京都渋谷区神宮前1-19-8 原宿ファミリービル；JR 原宿站竹下口步行約 1 分（約 200m）；營業 07:00～22:00 每日（Tabelog 註明可能變動）；早餐一般至 10:30。來源（main 2026-10-19 網搜）：Tabelog https://tabelog.com/en/tokyo/A1306/A130601/13109923/ 、Tripadvisor、NAVITIME。
  2. **原宿表参道店（神宮前1-13-9）已歇業，不可用**——任何檔不得出現該店名或地址。
  3. 細節（建點位置、行程文字寫法）Olina 授權流程內裁定，不回問。

## 涉及範圍

- [x] 後端／核心邏輯（本 repo 角色對應：`js/tripdata.js` 資料、`js/mapdata.js` 手寫地點、冒煙基線、版號）
- [ ] 前端／UI——**不勾**：`trip-tab.js` 已支援 detail 多行（Day 1／Day 4 既有 `\n` 用法）、`map-tab.js` 已能渲染任意點數。backend 完成後直接建 `Task28.done`。

## §1 行程 `js/tripdata.js`（只動 Day 2 第 3 筆）

PM 裁定：**title 維持 Excel 逐字不改**（`麥當勞早餐後前往東京地下街`，延續 Task27 規則 1「time／title 逐字＝Excel」），店名改放 **detail**。理由：title 改了會與 Excel 確認版分歧；detail 本來就是放細節的欄位，展開單日即看到。

Day 2 第 3 筆改為（time／title 不變，新增 detail 鍵，內容逐字）：

```
{ time: "09:00", title: "麥當勞早餐後前往東京地下街",
  detail: "🍔 麥當勞 原宿竹下通店（マクドナルド 原宿竹下通り店）\n📍 東京都渋谷区神宮前1-19-8 原宿ファミリービル\nJR 原宿站「竹下口」出站步行約 1 分\n⏰ 營業 07:00～22:00，早餐供應至 10:30（營業時間可能變動）" }
```

規則：
1. 只動這一筆；Day 2 其餘 7 筆、Day 3 全部維持「無 detail 鍵」。
2. Day 1、Day 4、theme、`flights`、`hotels`、`important`、`COUPONS` 全部零 diff。
3. 不得出現「表参道店」「神宮前1-13-9」。

## §2 地圖 `js/mapdata.js`（手寫，⛔ 不跑 `make_mapdata.py`）

2026-10-23 段在 `明治神宮` 與 `東京駅（東京地下街）` 之間插入一點（順序＝當天行程時序：06:30 原宿／明治神宮 → 09:00 早餐 → 東京地下街）：

1. `Tabist上野39飯店（住處）`（不動）
2. `原宿駅`（不動）
3. `明治神宮`（不動）
4. **`マクドナルド 原宿竹下通り店（麥當勞早餐）`**（新增）
5. `東京駅（東京地下街）`（不動）
6. `浅草寺`（不動）
7. `東京スカイツリー（晴空塔）`（不動）

規則：
1. 10/23 由 6 點變 7 點；其他日零 diff；既有點名稱與座標逐字不動。
2. 座標延續 Task27 做法：backend 以可程式取得的來源（OSM Nominatim／Overpass 以 `brand=McDonald's` 或店名＋神宮前1-19-8 查詢等）查證，再以第二來源交叉（Tabelog 店頁地圖、NAVITIME 等），小數 ≥4 位；⛔ 不得憑記憶填座標。合理性檢查：與 `原宿駅` 點距離應約 100～400m（竹下口步行 1 分）；超出即停工回報 PM。
3. 證據寫入 `DEVELOPMENT_LOG.md` 實作條目：「名稱 ← 座標 ← 來源 URL／查詢條件 ← 交叉來源與差距 ← 查證日」。若 OSM 查到的是已歇業的表参道店（神宮前1-13-9）不得採用。
4. 檔頭註解改註明「Task25／Task27／Task28 手寫」，格式（`{name,lat,lon}`、isoDate 升冪）不變。

## §3 冒煙基線（`qa_smoke_test.py`，backend 維護）

既有斷言隨本 Task 修訂（v2 規格由本 spec 取代，舊 T27 意圖保留）：
- **T27-4 修訂**：Day 2 除 `09:00` 那筆外皆無 detail 鍵；Day 3 全部無 detail 鍵。
- **T27-5 修訂**：MAPDATA 2026-10-23 預期名稱清單改為 §2 的 7 點、`T27_MAP_COUNT['2026-10-23']` 改 7；其餘不變。
- T27-1／T27-2／T27-3 不改（title 逐字仍成立）。

新增：
- **T28-1** Day 2 `09:00` 那筆 detail 與 §1 逐字相同（含 `神宮前1-19-8`、`竹下口`、`10:30`）。
- **T28-2** MAPDATA 10/23 第 4 點名稱逐字＝`マクドナルド 原宿竹下通り店（麥當勞早餐）`，且與 `原宿駅` 點距離（haversine）介於 100～400m。
- **T28-3** TRIP 段＋mapdata.js `表参道店`、`1-13-9` grep＝0。
- scan_files 加入 `specs/Task28.spec.md`、`specs/Task28.impact.md`（若既有掃描機制需要）。

## §4 版號

`js/version.js` APP_VERSION `v26`→`v27`、APP_VERSION_DATE 填實作當日 `MM/DD`；`sw.js` CACHE_VERSION `v27`。PRECACHE 筆數零增減（44）。

## §5 文件

- `specs/SYSTEM_MAP.md`：tripdata.js、mapdata.js 描述若提到點數或「無 detail」，依實況更新（SA／PM 依慣例）。
- PM 閉環時把 `DEVELOPMENT_LOG.md` Task27 閉環條目「待 Olina」行中「是否把『麥當勞 原宿竹下通店』加進 10/23 地圖尚在考慮，未立案」改為「麥當勞 原宿竹下通店已由 Task28 加入（v27）」。
- `行前檢查清單.md` 零 diff。

## 邊界條件 / 錯誤處理

- 行程單日下鑽：該筆 detail 4 行正常換行顯示、390px 不溢出；其他筆不出現空白細節列。
- 地圖分頁：10/23 chips 出現新點；單點開圖、A→B 路線（明治神宮→麥當勞、麥當勞→東京駅）deep-link 帶 `hl=zh-TW`（既有行為）。
- 座標查證兩來源差距 >150m 或與原宿駅距離不在 100～400m：停工回報 PM，不自行取捨。

## 不在本次範圍（Non-scope）

- 不改 Day 2 任何 title／time／theme；不改其他天、航班、飯店、折價券、購物清單、常用句。
- 不改 `trip-tab.js`／`map-tab.js`／`style.css`／`index.html`。
- 不加其他早餐備案店家、不寫菜單／價格。
- 不讀、不改 `東京\` 任何檔（含 Excel；Excel 不同步店名）。
- 不跑 `make_mapdata.py`、不建 KML；不新增 localStorage key。
- 不做 git push（閉環後依慣例 commit）。

## 驗收（QA）

1. `PYTHONUTF8=1 python qa_smoke_test.py` 全綠（T25、T27（含修訂）、T28 全系列）。
2. `git diff` 範圍只含：`js/tripdata.js`（僅 Day 2 第 3 筆）、`js/mapdata.js`（檔頭註解＋10/23 新增 1 點）、`qa_smoke_test.py`、`js/version.js`、`sw.js`、`specs/`、`DEVELOPMENT_LOG.md`。
3. Playwright headless（390px）：行程 Day 2 下鑽看到 §1 detail；地圖 10/23 顯示 7 點、新點可開 Google 地圖；版號 v27；console 無錯誤。
4. 座標證據：LOG 有 §2 規則 3 要求的來源；QA 以 Google 地圖查「マクドナルド 原宿竹下通り店」抽查座標落在 100m 內。
5. 隱私：T25-7／T25-8 續綠。
6. 真機顯示由 Olina 部署後流程外確認。

## 影響範圍分析（SA）

> SA v1，2026-10-19。完整版（含開工前置實測、SYSTEM_MAP 更新清單）見 `specs/Task28.impact.md`。涉及範圍：純後端，backend 完成直接建 `Task28.done`。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 行程單日下鑽 Day 2 | `trip-tab.js` L129–215 | 09:00 筆新增 4 行 detail（`\n`→`<br>` 既有行為）；其他筆無空白細節列 | ✅ |
| 行程其他天／航班／飯店／重要資料 | `tripdata.js` 其他段 | 零 diff | ✅ |
| 折價券 | `tripdata.js` COUPONS | 同檔零 diff，bump 後重快取 | ✅ |
| 地圖 10/23 點位＋deep-link | `map-tab.js` | 6→7 點；無 index 依賴；新點名 20 字最長，390px 換行目視 | ✅ |
| 地圖其他日 | `mapdata.js` | 零 diff | ✅ |
| 版號徽章／更新 toast | `version.js`＋`sw.js` | v26→v27，PRECACHE 44 不變 | ✅ |
| 購物／常用句／翻譯／拍照 | 各 tab | 不碰 | ❌ |

### Backend 注意事項
- T27-4／T27-5 在資料改完當下必 FAIL，須同批修訂；T27-4 改為「09:00 那筆必有 detail、其餘無」，防退化成無條件放行。
- detail 內文不得含 ASCII `"`、`{`、`}`（會切壞 T27-1/2 的 regex）；T28-1 比對注意原始碼是字面 `\n`，跳脫層級擇一寫清楚。
- T28-3 掃描範圍限 TRIP 段＋mapdata.js（specs 合法含「表参道店」說明字樣）。
- 座標：OSM 多筆時以 `神宮前1-19-8` 篩、`1-13-9` 一律捨棄；差距 >150m 或距原宿駅不在 100～400m 停工回報。LOG 不提舊住宿名稱（T25-7）。

### Frontend 注意事項
- 不涉及。

### QA 迴歸測試清單
- [ ] `PYTHONUTF8=1 python qa_smoke_test.py` 全綠（含 T27 修訂、T28-1～3）
- [ ] git diff：tripdata.js 恰 1 行、mapdata.js＝檔頭＋1 新行
- [ ] 行程 Day 2 下鑽 detail 4 行 390px 正常；Day1／3／4 同 v26
- [ ] 地圖 10/23 7 點、A→B 兩段 URL 帶 `hl=zh-TW`；其他日 3／4／3
- [ ] 折價券開 1 張；版號 `v27 · MM/DD`；console 無錯
- 新功能由 QA 依 spec 驗收
