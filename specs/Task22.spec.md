# Task22 — Day 2（2026-07-22）行程細節化與動線重排

## 模組：tripdata.js `window.TRIP.itinerary`（Day 2 段）

### 功能描述

把 Day 2（7/22）的壓縮摘要行程，依 Olina 的 Excel 行程表與四項拍板決策，重寫為「拿著手機照著做就會到」細節等級的完整時間軸；僅動 `isoDate: "2026-07-22"` 那一段的 `items` 陣列，其他四天零 diff。

### 背景與已拍板決策（不重議）

**急件背景**：Olina 2026-07-22（明天）出發使用本 App。現況 Day 2 items 只有壓縮摘要（「Skytree Shuttle 2 號站牌」一句話等級），外出抓不到細節。權威來源＝Olina 的 Excel 行程表（`C:\Olina\其它\東京\東京橫濱5天4夜究極行程表_最終防曬版.xlsx`，內容已比對）。

**Olina 已拍板四項（SA/backend 不得重開討論，有疑慮記入回報交 PM）**：

1. **移除合羽橋道具街**，連帶取消「分頭行動」——全家一起從淺草寺走到東武淺草駅，搭東武晴空塔線 1 站到晴空塔；不再有 11:10 Solamachi 會合。
2. **午餐固定「三浦三崎港 上野店」**（迴轉壽司），刪除宇奈とと鰻魚飯選項與「二選一」表述。
3. **時間軸重排**：09:15 分頭／09:30–11:10 道具街／11:10 會合全部作廢，晴空塔可提早開始，時間表前後不得矛盾。
4. **交通細節到「照著做就會到」**：每段移動含出發站名、進出站口、月台、路線名、坐幾站、下車站、出站步行、車資。

**PM 查證後的重大事實變更（本 spec 與 Excel 的唯一偏離，屬拍板 4 的授權範圍）**：
Excel 原定「晴空塔 → 上野搭東武巴士 Skytree Shuttle（1 樓轉運站 2 號站牌）」——**該路線現況為土休日（六、日、假日）限定運行，平日全便停駛；7/22 為星期三，當天無班次**。`[實測]`（2026-07-21 WebSearch 三方一致：東武バス官網 tobu-bus.com skytree_shuttle 頁、NAVITIME、駅探；Olina 拍板時已明示「巴士資訊不足以支撐就提供電車備案」，故電車動線升為主案、計程車列懶人備案，巴士不再出現在行程中）。

### 涉及範圍

- [x] 後端／核心邏輯（`js/tripdata.js` Day 2 資料段＋bump 兩檔三行＋qa_smoke_test.py additive 判準）
- [ ] 前端／UI（**零 diff**——理由見「顯示層確認」節）

只勾後端：backend 完成後直接建 `Task22.done`，跳過 frontend 階段。

### Day 2 改後完整 items 陣列（權威定義，backend 逐字落地）

`day`／`isoDate`／`theme` 三欄零變更（`isoDate` 不動 ⇒ MAPDATA↔TRIP 對齊契約不觸發，mapdata.js 免重生成）。`items` 整段替換為以下 11 筆：

```js
items: [
  {
    time: "08:30",
    title: "淺草寺清晨散策",
    detail: "飯店步行 5–7 分到雷門，沿仲見世通走到本堂參拜\n趁太陽沒發威速戰速決，09:20 前收尾",
  },
  {
    time: "09:20",
    title: "全家步行→東武淺草駅",
    detail: "從本堂沿仲見世通折返、出雷門，往吾妻橋十字路口方向走，東武淺草駅在 EKIMISE 百貨大樓 1 樓（步行約 5–8 分）\n進站搭「東武晴空塔線」：普通／區間急行都可搭、每班都停晴空塔；勿上需另購特急券的特急列車（リバティ等）",
  },
  {
    time: "09:35",
    title: "東武晴空塔線 1 站→晴空塔",
    detail: "淺草 → とうきょうスカイツリー（東京晴空塔站），只坐 1 站約 3 分，刷 Suica ¥157/人\n出「正面改札」出站即直結晴空塔 Town／Solamachi，不會迷路",
  },
  {
    time: "09:45",
    title: "晴空塔＋Solamachi",
    detail: "10:00 先上展望台（天望Deck 350m：大人¥2,100／國中生¥1,200，建議官網預購省排隊）\n下來大逛 Solamachi：寶可夢中心 4F（晴空塔限定烈空坐）、卡比專賣店 4F、Jump Shop 3F、吉卜力橡子共和國 2F\n甜點：Qu'il fait bon 2F（寶盒水果塔）、祇園辻利 6F（抹茶霜淇淋）",
  },
  {
    time: "12:40",
    title: "電車→上野阿美橫丁",
    detail: "⚠ Excel 原定的 Skytree Shuttle 巴士平日停駛（僅六日假日行駛），7/22 週三改搭電車\n① 東武晴空塔線：東京晴空塔站 → 淺草，坐回 1 站約 3 分（¥157）\n② 出東武改札後往雷門方向下地下道，轉「銀座線」淺草站（步行約 3–5 分；銀座線淺草是起點站，來的每班都可搭）\n③ 銀座線：淺草 → 上野，坐 3 站約 5 分（¥178）\n④ 上野站走「5b 出口」，出來就是 JR 高架下、阿美橫丁入口在眼前\n💤 懶人備案：Solamachi 1F 計程車招呼站直接攔車到阿美橫丁（約 15 分／¥1,500–2,000 整台）",
  },
  {
    time: "13:15",
    title: "午餐：三浦三崎港 上野店",
    detail: "迴轉壽司，東京都台東区上野4-10-17（阿美橫丁內）\n約¥1,500–3,000/人；一盤一盤平放無堆疊，另有炙燒壽司、玉子燒等熟食",
  },
  {
    time: "14:15",
    title: "阿美橫丁散策",
    detail: "順著高架橋下大逛：二木的菓子（平價零食）、藥妝\n天氣熱可買路邊「100 日圓哈密瓜／西瓜串」邊走邊吃解暑",
  },
  {
    time: "16:00",
    title: "JR 2 站→秋葉原",
    detail: "JR 上野站進站（阿美橫丁這側走「不忍口」最近），刷 Suica\n搭山手線或京濱東北線南下方向（2 或 4 號月台），坐 2 站約 4 分（¥146）\n秋葉原站走「電氣街改札口」出站",
  },
  {
    time: "16:15",
    title: "秋葉原電氣街",
    detail: "全躲室內：Yodobashi Akiba（全棟 9 層，玩具扭蛋天堂）、Radio Kaikan（動漫公仔模型）（逛到 19:30）",
  },
  {
    time: "19:30",
    title: "晚餐：麵屋武藏 武仁",
    detail: "千代田区神田佐久間町2-18-5，約¥500–1,500/人\n招牌「武仁肉」豬五花燉肉塊拉麵／沾麵可免費加麵，全豬無牛；翻桌快排隊不久",
  },
  {
    time: "20:40",
    title: "計程車回飯店",
    detail: "秋葉原站前路邊攔車，直達 MAPLEHOUSE 正門\n約 2.5km／8–10 分／¥1,200–1,400（整台 4 人分攤）",
  },
],
```

### 顯示層確認（frontend 零 diff 的依據）

- `tripdata.js` 檔內註解（L48）明文：`items[].detail 允許 \n 換行，frontend 以 white-space:pre-wrap 或 <br> 渲染`；Task10 起單日視圖 detail 直接展開（非互動）、`.trip-item` grid 54px+1fr。本次 detail 最長 6 行（「電車→上野」項），屬既有渲染能力範圍，無新 class、無樣式變更。`[實測]`（已讀 tripdata.js 註解與 SYSTEM_MAP trip-tab.js 條目）
- QA 仍須以 390px 視口實看 Day 2 單日視圖：長 detail 換行正常、無水平溢出、無與相鄰 item 重疊。

### 業務規則

1. 只改 `isoDate: "2026-07-22"` 段的 `items`；Day 1/3/4/5 與 flights/hotels、`window.COUPONS` 逐位元零 diff。
2. Day 2 段內不得殘留：「分頭」「合羽橋」「宇奈とと」「二選一」「Skytree Shuttle ▸ 作為可搭方案」「11:10」字樣（巴士只允許以「平日停駛」警語形式出現一次）。
3. 時間軸單調遞增、無縫隙矛盾（09:20 步行 → 09:35 搭車 → 09:45 抵達，銜接已排定）。
4. **bump SOP 兩檔三行（repo 永續紀律）**：tripdata.js 內容變更必須同步 bump——`sw.js` `CACHE_VERSION` 與 `js/version.js` `APP_VERSION`（逐字元相等）＋`APP_VERSION_DATE`（bump 當天台灣時區 MM/DD）。現況 v21，開工時實際值 +1（預期 v21→v22）。漏 bump 的症狀＝改了沒生效（cache-first 吃住舊資料，頁面不壞、症狀隱蔽）。
5. **qa_smoke_test.py additive 維護（Task21 起 backend 權責）**：本輪至少加入機械判準——Day 2 items 筆數＝11；Day 2 段禁字串（規則 2 清單）grep=0；版號一致性沿用既有判準。

### 邊界條件／錯誤處理

- 資料檔純字面值變更，無執行邏輯分支；唯一風險＝JS 字面值語法錯誤導致 `window.TRIP` 整檔掛掉（trip 分頁降級顯示失敗文案）。backend 完成後必跑 `node --check` 或瀏覽器 console 零錯誤確認。
- detail 內含 `⚠`／`💤`／`①–④` 等 Unicode 字元：檔案必須維持 UTF-8 編碼；QA 實看渲染非亂碼。

### 證據等級標註（最晚拍板點＝本次全部不擋工；`[推斷]` 項出發當天以 Google Maps 現場複核）

| # | 資訊 | 等級 | 依據 |
|---|------|------|------|
| E1 | Skytree Shuttle 上野・淺草線平日全便停駛（7/22 週三無班次） | **[實測]** | 2026-07-21 WebSearch：[東武バス官網路線頁](https://www.tobu-bus.com/pc/skytree_shuttle/01.html)、[NAVITIME](https://www.navitime.co.jp/bus/company/00001062/route/00021447/)、[駅探](https://ekitan.com/timetable/route-bus/company/5083/1070384/1011487/d1) 三方一致「土休日のみ運行、平日は全便運休」 |
| E2 | 東武晴空塔線 淺草⇄東京晴空塔 1 站約 3 分、IC ¥157 | **[實測]** | 2026-07-21 WebSearch：[駅探運賃查詢](https://ekitan.com/transit/fare/sf-1491/st-2693) 157 円、3 分無轉乘 |
| E3 | 銀座線上野站「5b 出口」最近阿美橫丁（出口即高架下入口） | **[實測]** | 2026-07-21 WebSearch：[阿美橫商店街官方 access 頁](https://www.ameyoko.net/access/) 等多來源一致 |
| E4 | 銀座線 淺草→上野 3 站約 5 分、IC ¥178 | [推斷] | Metro 初乘運賃區間（1–6km）；站數依路線圖（田原町・稲荷町・上野） |
| E5 | 東武淺草駅⇄銀座線淺草站轉乘步行 3–5 分；東武站在 EKIMISE 1 樓 | [推斷] | 兩站相鄰為公知地理事實，分鐘數為估值 |
| E6 | 東武淺草發車皆停晴空塔站、特急需另購券 | [推斷] | 東武車種常識；保守寫法（引導搭普通／區間急行）即使有誤也只是多等一班，安全方向 |
| E7 | 淺草寺本堂→東武淺草駅步行 5–8 分 | [推斷] | Excel 寫 5 分，PM 加緩衝 |
| E8 | 展望台票價（¥2,100／¥1,200） | [推斷] | 依 Excel；官網預購時會見到現價 |
| E9 | JR 上野→秋葉原 2 站約 4 分、月台 2 或 4（南下）、電氣街改札口、IC ¥146 | [推斷] | 站序／月台／改札依 Excel，車資依 JR 初乘區間 |
| E10 | 晴空塔→阿美橫計程車約 15 分／¥1,500–2,000；Solamachi 1F 有招呼站 | [推斷] | 距離約 4km 估算；備案性質，現場攔不到改走主案電車 |
| E11 | 店家地址／價位（三浦三崎港、麵屋武藏、二木的菓子等） | [推斷] | 逐字取自 Excel（Olina 的權威來源），未另行查證 |

### 隱私確認

本次寫入 `js/tripdata.js`（公開部署）的內容全部為公開行程資訊：站名、路線、車資、店家地址、票價。**零個資**（無護照號、訂位代號、姓名、個人手機；MAPLEHOUSE 名稱與公開地址為既有內容零變更）。QA 隱私三段式掃描照常執行。

### 不在本次範圍（Non-scope，護欄）

- 不動 Day 1/3/4/5 任何內容（含 Day 1 已過期事實——今天已 7/21，不回頭「順手」整理）。
- 不動 `flights`／`hotels`／`COUPONS`、不動 schema（Task3.api.md 契約零變更，items 仍為 `{time,title,detail}`）。
- 不動 `js/mapdata.js`（`isoDate` 未變，MAPDATA↔TRIP 契約不觸發；0722 地點清單若含合羽橋，僅是地圖分頁多一個可選地點，不構成矛盾，要清理由日後 Task 帶 KML 重生成一併做）。
- 不動 trip-tab.js／css／index.html 任何一行（顯示層確認已排除必要性）。
- 不重排其他天的交通細節等級（Day 3–5 的同型細節化若 Olina 要，另開 Task 排隊）。
- 不改 `行前檢查清單.md`（閉環時由 PM 依需要增修，非 backend 範圍）。

### 給 SA 的提示

- 影響面預期極小：單一資料檔字面值＋兩檔三行 bump＋冒煙基線 additive。請重點複核：PRECACHE 42 筆零增減、`tokyotrip.*` localStorage 零觸碰、Task10 單日視圖「今日 isoDate 直進單日層」邏輯與新 items 相容（純資料替換，應天然相容）。
- 本 spec 無擋工拍板點（P-N），不需 `.approved` 信號。

## 影響範圍分析（SA，2026-07-21）

> 完整版＝`specs/Task22.impact.md`。**SA 複核結論：PM 判定「純 backend、顯示層零 diff、backend 完成後直接建 `Task22.done` 跳過 frontend」成立。**

### 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| Day 2 單日視圖 | trip-tab.js 單日層 | items 5→11 筆、detail 最長 6 行；渲染路徑不變 | ✅（390px 實看） |
| 今日直進單日層 | trip-tab.js init | 7/22 當天直落 Day 2 新內容；isoDate 未變天然相容 | ✅ |
| 總覽層五日卡 | `.trip-itin-overview` | 只消費 day/isoDate/theme（零變更） | ✅（快驗） |
| COUPONS（同檔契約） | Task4 折價券分頁 | 單檔雙契約，COUPONS 段須逐位元零 diff | ✅（機械 diff） |
| SW 快取 | sw.js/version.js | 必 bump v21→v22 兩檔三行，漏 bump 症狀隱蔽 | ✅（版號閘） |
| 地圖分頁 | map-tab.js | 只讀 day/theme → 零影響；mapdata 0722 合羽橋殘留點屬已知偏差、不清理（Non-scope 定案） | ❌ |
| 匯入碼本機層 | import-data.js/privateData | 零觸碰 | ✅（Task21 基線續過） |

### Backend 注意事項

- 顯示層撐得住已實測（trip-tab.js L210–216 escHtml＋\n→`<br>` 完整展開；`.trip-item-detail` 無 max-height/裁切，grid row 自動生長；`⚠💤①–④` 不在 escHtml 轉義集內原樣通過）。
- **冒煙 additive 判準的禁字串 grep 必須限定 Day 2 items 區段**——「二選一」在 Day 1（L83）與 L177 為合法既有內容，全檔 grep 必誤殺；「Skytree Shuttle」Day 2 段恰 1 次（警語）。
- detail 含 `Qu'il fait bon` 單引號，維持雙引號字串即安全；完成後必跑 `node --check js/tripdata.js`。
- 完成後直接建 `Task22.done`（跳過 frontend）。

### Frontend 注意事項

- 本輪零 diff、零工作；trip-tab.js／style.css／index.html 不得動任何一行。

### QA 迴歸測試清單（摘要，完整版見 impact.md §5）

- [ ] `python qa_smoke_test.py` 全過（既有 25 判準＋本輪 additive）
- [ ] 版號 v22 兩檔逐字元一致、PRECACHE 42 筆零增減
- [ ] git diff 僅落 Day 2 items＋bump 三行＋qa_smoke additive；COUPONS/flights/hotels/其他四天逐位元零 diff
- [ ] Day 2 items 11 筆、時間軸單調遞增、禁字串 grep=0（限 Day 2 段）
- [ ] 390px 實看 Day 2：最長 detail 6 行完整換行、無溢出無重疊、Unicode 非亂碼
- [ ] 模擬 2026-07-22 今日直進 Day 2 單日層＋今天 badge
- [ ] 既有功能快掃（折價券/地圖/其他四天/民宿區塊）＋隱私三段式掃描
- 新功能（Day 2 新內容正確性）由 QA 依 spec 權威定義逐字驗收
