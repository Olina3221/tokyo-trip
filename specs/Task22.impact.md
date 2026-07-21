# Task22 影響範圍分析（SA）

> 分析日：2026-07-21（急件：Olina 7/22 出發）
> 對象 spec：`specs/Task22.spec.md`
> 涉及範圍標記：**純後端**（`js/tripdata.js` Day 2 資料段＋兩檔三行 bump＋qa_smoke additive）。
> **SA 複核結論：PM 判定「只動 backend、顯示層零 diff、backend 完成後直接建 `Task22.done` 跳過 frontend」成立**，依據見 §2。

## 1. 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 行程分頁 Day 2 單日視圖 | trip-tab.js 單日層（Task10 狀態機） | items 5 筆→11 筆、detail 大幅變長（最長 6 行）；渲染路徑不變，純資料替換 | ✅（390px 實看，見 §5） |
| 行程分頁「今日直進單日層」 | trip-tab.js init 今日 isoDate 比對 | 7/22 當天開 APP 會**直接落在 Day 2 新內容**——本次改動的實際使用入口；isoDate 未變，邏輯天然相容 | ✅ |
| 行程分頁總覽層五日卡 | trip-tab.js `.trip-itin-overview` | 日卡只消費 day/isoDate/theme（三欄零變更），items 筆數變化不影響 | ✅（快驗） |
| tripdata.js 同檔另一契約 | `window.COUPONS`（Task4 折價券分頁） | 單檔雙契約：改 TRIP 段時 COUPONS 段必須逐位元零 diff | ✅（機械 diff） |
| Day 1/3/4/5、flights/hotels | trip-tab.js 其餘區塊 | spec 業務規則 1：逐位元零 diff | ✅（機械 diff） |
| 地圖分頁 | map-tab.js（TRIP 唯讀 isoDate lookup） | 只讀 day/theme，兩者零變更 → **零影響**；0722 地點清單殘留「合羽橋」屬已知偏差（見 §4） | ❌（免測） |
| SW 快取 | sw.js / version.js | tripdata.js 內容變更必須 bump v21→v22（兩檔三行），否則 cache-first 吃舊資料、症狀隱蔽；PRECACHE 42 筆零增減（無新檔） | ✅（版號機械閘） |
| 匯入碼本機層 | import-data.js / privateData / lodging | **零觸碰**——本次不動任何 localStorage 消費端與 `_renderPrivateSection`/`_renderLodgingBlock` | ✅（冒煙基線 Task21 M1/M2/M4 續過即可） |
| QA 冒煙基線 | qa_smoke_test.py | backend 須 additive 加入 Task22 判準（見 §3），既有 25 判準不得被本次改動打破 | ✅ |

## 2. 顯示層零 diff 複核（本次重點，PM 判定成立的證據）

PM 要求特別驗證：detail 明顯變長且多行，Task10 渲染路徑是否撐得住。**逐項實測（讀碼）確認撐得住**：

1. **渲染路徑**（trip-tab.js L210–216）`[實測]`：`detailEl.innerHTML = escHtml(item.detail).replace(/\n/g, '<br>')`——detail 直接完整展開、非互動、無 `hidden`、無截斷/省略邏輯。
2. **CSS**（style.css L753–761）`[實測]`：`.trip-item-detail` 在 grid 第 2 欄第 2 列，**無 max-height、無 overflow 裁切、無 line-clamp**；grid row 高度自動生長，6 行 detail 只是卡片變高，垂直捲動由既有容器吸收。`white-space: pre-wrap` 為保底（\n 已先轉 `<br>`，字串中不再有殘留 \n，不會雙重換行）。
3. **水平溢出**：新 detail 無長串無空白 ASCII（最長 token 如「Solamachi」「MAPLEHOUSE」遠短於欄寬），中文自然逐字斷行；不需要 Task21 的 `overflow-wrap:anywhere` 處置。
4. **特殊字元**：`escHtml` 只轉義 `& < > "`（L1116–1120）`[實測]`——`⚠`／`💤`／`①–④`／`¥`／`→` 全部原樣通過，經 textNode 等價路徑渲染，唯一前提＝檔案維持 UTF-8（spec 已列邊界條件）。
5. **無新 class、無樣式變更、index.html 零動** → frontend 階段無事可做，跳過成立。

**結論：不需要 frontend 介入。**唯一保留條件＝QA 以 390px 視口實看 Day 2（spec 已列），此為驗收動作而非改碼需求。

## 3. Backend 注意事項

1. **只換 Day 2 `items` 陣列**，`day`/`isoDate`/`theme` 三欄與檔內其他所有內容（Day 1/3/4/5、flights、hotels、COUPONS、檔頭註解）逐位元零 diff。建議完成後 `git diff` 目視確認 diff 只落在 Day 2 items 區間。
2. **bump 兩檔三行 v21→v22**：`sw.js` `CACHE_VERSION` 與 `js/version.js` `APP_VERSION`（現況兩檔皆 `'v21'` `[實測]`）＋ `APP_VERSION_DATE` 改 bump 當天（台灣時區 MM/DD）。
3. **qa_smoke_test.py additive 判準（Task21 起 backend 權責），本輪至少加**：
   - Day 2 段 items 筆數 ＝ 11；
   - Day 2 段禁字串 grep ＝ 0：「分頭」「合羽橋」「宇奈とと」「二選一」「11:10」；
   - 「Skytree Shuttle」於 Day 2 段**恰出現 1 次**（平日停駛警語形式）；
   - ⚠ **grep 範圍必須限定 Day 2 items 區段、不可全檔**——「二選一」在 Day 1（L83）與後段某日（L177「午餐（二選一，皆無牛）」）為合法既有內容 `[實測]`，全檔 grep 必誤殺。建議判準實作＝先切出 `isoDate: "2026-07-22"` 至下一個 `isoDate:` 之間的文字再 grep。
   - 既有 25 判準（版號一致性／PRECACHE 42／Task21 M1/M2/M4／CSS class）必須續過——本次改動不觸及其任何檢查對象，若有 FAIL 即為改壞。
4. **語法安全**：純字面值變更，完成後必跑 `node --check js/tripdata.js`（或瀏覽器 console 零錯誤）——唯一系統性風險是字面值語法錯誤使 `window.TRIP` 整檔掛掉。
5. detail 字串內含單引號（`Qu'il fait bon`）——tripdata.js 現行以雙引號包字串，維持雙引號即無轉義問題。
6. 完成後建 `Task22.done`（跳過 frontend，spec 涉及範圍已定）。

## 4. Frontend 注意事項

- **本輪零 diff、零工作**（§2 已排除必要性）。trip-tab.js／style.css／index.html 不得動任何一行。
- 已知偏差留檔：`js/mapdata.js` 0722 清單含「合羽橋道具街（Olina 09:30分頭）」（L18 `[實測]`）——Task22 後與 TRIP Day 2 不再對應，屬地圖分頁多一個可選地點，**不構成矛盾、本輪不清理**（mapdata 為 KML 生成檔勿手改，清理由日後帶 KML 重生成的 Task 一併做；spec Non-scope 已定案）。

## 5. QA 迴歸測試清單

- [ ] **冒煙基線**：`python qa_smoke_test.py` 全過（既有 25 判準＋backend 本輪 additive 判準）。
- [ ] **版號機械閘**：APP_VERSION === CACHE_VERSION === 'v22'（逐字元）；PRECACHE 42 筆零增減。
- [ ] **零 diff 機械驗**：git diff 僅落在 `js/tripdata.js` Day 2 items 區間＋sw.js/version.js 三行＋qa_smoke_test.py additive 段；COUPONS／flights／hotels／Day 1/3/4/5 逐位元零 diff。
- [ ] **Day 2 內容驗**：items 11 筆、時間軸單調遞增（08:30→09:20→09:35→09:45→12:40→13:15→14:15→16:00→16:15→19:30→20:40）、與 spec 權威定義逐字一致。
- [ ] **禁字串**：Day 2 段內「分頭／合羽橋／宇奈とと／二選一／11:10」grep=0；「Skytree Shuttle」恰 1 次（警語）。
- [ ] **390px 實看 Day 2 單日視圖**（Playwright 或瀏覽器模擬）：最長 detail（12:40 電車→上野，6 行）完整換行顯示、無水平溢出、無與相鄰 item 重疊、⚠💤①–④ 非亂碼。
- [ ] **今日直進邏輯**：模擬系統日 2026-07-22 開 trip 分頁直落 Day 2 單日層＋今天 badge；總覽層五日卡日期/theme 零變化。
- [ ] **既有功能快掃**：折價券分頁 16 張正常、地圖分頁 chips/清單正常（合羽橋殘留點可選屬預期）、行程分頁其他四天與航班/飯店/重要資料/民宿區塊零變化。
- [ ] **隱私三段式掃描**照常（本次內容全公開行程資訊、零個資——spec 隱私確認節已宣告）。
- [ ] `node --check js/tripdata.js` 通過（或等效 console 零錯誤）。

## 6. SYSTEM_MAP 更新

- 人工補充區「MAPDATA↔TRIP isoDate 對齊契約」條目已由 SA 補註：Task22 起 0722 存在**地點層**偏差（合羽橋殘留點），isoDate 層契約不受影響。
- tripdata.js 條目的 Task 標記由 PM 閉環時隨例行更新（Task3–4 → 含 Task22）。
