# Task32：匯入碼可帶「各人自己的航班」（航班卡＋行程當日內容覆蓋）

> 立案 2026-10-21（PM）。急件：10/22 出發前上線。雲端 session 跑（分支 `claude/task32-per-person-flight`），**本 Task 即本 repo 第一次實際走完雲端 pipeline**（編號處理見 §0）。

## 0. 編號衝突處理（給 Olina 與下游）

- `specs/STATE.md` Open Items 原把「Task32」預留給雲端 pipeline 實測（`行前檢查清單.md` 末加一行「雲端 pipeline 實測通過（10/21）」，出處 `specs/Task31.spec.md` 實測句 2）。
- 處理：**Task32 改為本需求（各人航班）**，並把它當成雲端 pipeline 的實際首跑；原「加一行」實測**撤銷、不另開編號**（真需求跑完整 pipeline 已涵蓋該實測目的，不再為測試而改 `行前檢查清單.md`）。
- `specs/STATE.md` 該 Open Item 由 PM 本次改寫為「Task32 雲端 pipeline 首跑」，結案條件改為本 Task 閉環＋PR 合併後的可機械檢查項。`specs/Task31.spec.md` 為已閉環歷史，**不改**。

## 功能描述

匯入碼（`TT1.`）新增三個選填 top-level key：`flights`（取代「航班」藥丸的航班卡）、`itineraryDays`（以日期整天取代「行程」單日層的內容）與 `importantOverrides`（v1.4：依標籤把重要資料公開段的指定列**原位取代**成匯入內容，或隱藏）。妹妹匯入自己的碼後看到她的航班，「樂桃報到提醒」那一列原位換成她的華航報到提醒；沒匯入、或碼裡沒有這三個 key（例如 Olina 現有的碼）時，畫面與 v28 完全一樣。

## 背景與已拍板決策（不重議）

- 已完成：Task3 匯入碼（`js/import-data.js`，`App.privateData.get()` 回傳解析後 JSON；schema 全欄選填、未知欄位忽略）；Task21 立下「本機層 top-level key 覆蓋/補充畫面＋型別防禦＋匯入/清除後冪等重繪」先例（`lodging`，`js/trip-tab.js` `_renderLodgingBlock`）。
- 已拍板（Olina 原話整理）：保險已在匯入碼 `insurance`，各人一份即可，不改；**航班要依匯入碼顯示各人自己的**；Olina 不匯入／匯入自己的碼時維持現狀（v28 不退化）；要改程式、走 pipeline、小顆粒度。
- 已拍板（PM 依 CLAUDE.md 個資鐵律）：航班號、時間不算個資，但訂位代號是個資——訂位代號照舊放既有 `bookings`（重要資料→本機資料段已會顯示），**不得進 `flights`／`itineraryDays` 以外的 tracked 檔，spec／api.md／冒煙／QA 假資料一律用明顯假值**（航班號用 `ZZ` 開頭，如 `ZZ901`；不得寫任何真實訂位代號、姓名、保單號）。
- 已拍板（PM 設計）：`import-data.js` 不需改（它只做解析/儲存，新 key 自動帶入）；公開層 `js/tripdata.js` 的 `flights`／`itinerary` **零 diff**（未匯入時的退回來源）。

## 現況實測（航班出現在哪裡）

指令：`git grep -n -e "MM62" -e "16:40" -e "10:50" -- ':!specs' ':!DEVELOPMENT_LOG.md'` `[實測]`

| 位置 | 內容 | 本 Task |
|---|---|---|
| `js/tripdata.js` `flights[]`（L12–31）→ `trip-tab.js` `buildFlightsSection`（L311） | 「航班」藥丸兩張卡 | **覆蓋**（`flights`） |
| `js/tripdata.js` `itinerary` Day 1（2026-10-22）items：出發機場/MM626 報到/起飛/抵成田/往上野 | 行程單日層（`_renderDayContent`，L110） | **可覆蓋**（`itineraryDays`） |
| `js/tripdata.js` `itinerary` Day 4（2026-10-25）items：Skyliner→成田/最晚抵成田 14:10/MM623 起飛/抵桃園 | 同上 | **可覆蓋**（`itineraryDays`） |
| `js/tripdata.js` `important[]`「樂桃報到提醒」（L152；結構 `{ label, value, tel? }`，由 `trip-tab.js` `buildImportantPublicList`（L707）於 init 渲染一次） | 重要資料公開段一行 | **可原位取代／隱藏**（`importantOverrides`，v1.4，D3 已由 Olina 推翻） |
| `js/mapdata.js` 成田 T1 兩個點（L9、L44） | 地圖路線點（機場位置，非航班） | 不動（D4） |
| `行前檢查清單.md` L90 | 文件，不在 App 內 | 不動 |
| `qa_smoke_test.py` L325–326、L459 | 公開層航班/行程斷言 | 不動（公開層零 diff，斷言應照舊綠） |

## 涉及範圍

- [x] 後端／核心邏輯：`js/trip-tab.js` 取「有效航班」與「有效單日 items」的邏輯（本機層優先、型別防禦、退回公開層）；匯入成功／清除後重繪航班區與行程單日層；（v1.4）重要資料公開段 `buildImportantPublicList` 依 `importantOverrides` 原位取代／隱藏並於匯入／清除後重繪；`Task32.api.md`（新 key schema 權威）；`qa_smoke_test.py`（T32 靜態斷言＋`scan_files` 加入 Task32 新檔）；版號 bump（`js/version.js` 兩行＋`sw.js` `CACHE_VERSION`）。
- [x] 前端／UI：被覆蓋時的一行小字提示（D2）與其樣式；覆蓋後航班卡、單日層沿用既有樣式與 DOM 結構。
（實際 backend／frontend 切分由 SA 依 `specs/INDEX.md` 角色對應決定；若 SA 判定 UI 改動可併 backend 檔內完成，仍照 PIPELINE「含 UI 須經 frontend」走。）

## 業務規則

### 1. 新 key：`flights`（選填）

- 型別：陣列，元素 schema 與公開層 `window.TRIP.flights[]` 相同：`{ label, airline, flightNo, date, from: { airport, terminal, time }, to: { airport, terminal, time }, note }`，所有欄位選填、皆為字串。
- 有效判定：`flights` 為陣列且至少含 1 個「物件且非陣列」元素 → **有效**；以這些物件元素（非物件元素略過）**整組取代**公開層航班卡，順序照匯入碼。
- 其他情況（無此 key、非陣列、空陣列、全是非物件）→ 退回公開層 `window.TRIP.flights`（＝v28 行為）。
- **去程／回程各自選填**：陣列可只放一段（例如只有去程）。採「整組取代」語意——有效時**只顯示匯入的那幾段**，公開層的航班卡一張都不混入（不會出現「自己的去程＋別人的回程」）。回程未知時要怎麼呈現，用資料表達、不需程式分支（見 D6）：不放＝不顯示回程卡；放一張只有 `label`＋`note` 的佔位卡（如 `{ "label": "回程", "note": "回程航班待確認" }`）＝顯示「待確認」卡；真要沿用公開層回程，就把那段照抄進碼。
- 渲染：沿用既有航班卡結構。缺欄位一律顯示空字串，**畫面不得出現 `undefined`、`null`、`[object Object]`**（現行 `escHtml(f.from.airport)` 遇缺欄位會印出 `undefined`，本機層路徑必須防住；`from`／`to` 非物件時視同未提供）。
- 範例（假值）：

```json
{
  "flights": [
    { "label": "去程", "airline": "假航空", "flightNo": "ZZ901", "date": "2026/10/22（四）",
      "from": { "airport": "台北桃園", "terminal": "T2", "time": "07:00" },
      "to":   { "airport": "東京羽田", "terminal": "T3", "time": "11:00" },
      "note": "假資料，僅供測試" }
  ]
}
```

### 2. 新 key：`itineraryDays`（選填）

- 型別：陣列，元素 `{ isoDate: "YYYY-MM-DD", theme?: 字串, items: [ { time?, title?, detail? } ] }`；items 元素 schema 與公開層 `itinerary[].items[]` 相同（`detail` 允許 `\n`）。
- 對應：以 `isoDate` 對公開層 `window.TRIP.itinerary[].isoDate`。對上的那一天，單日層內容**整天以匯入碼的 `items` 取代**；有給 `theme` 時，總覽日卡與單日層的主題字一併取代，沒給則沿用公開層 theme。
- 有效判定（逐筆）：元素為物件、`isoDate` 為字串且對得上公開層某天、`items` 為陣列 → 有效；`items` 內非物件元素略過。`items` 為空陣列（有效但無項目）→ 該天顯示既有「本日無排定行程」。
- 無效或對不上的元素**靜默略過**（不新增天數、不改天數順序、不報錯）；同一 `isoDate` 出現多筆時取第一筆有效者。
- 未覆蓋的天、以及整個 key 不存在/非陣列時 → 公開層原內容（＝v28 行為）。
- 天數、Day 標籤、日期、「今天」定位、前後天切換**一律照公開層**，本 key 只換內容與（選填）主題。

### 3. 重繪時機

- 匯入成功、清除本機資料後：航班區與行程（總覽主題字＋目前開著的單日層）**立即**反映新狀態，不需重開 App（比照 Task21 `_renderLodgingBlock` 呼叫點 1／2）。重繪不得改變使用者目前所在的視圖（在總覽就留總覽、在某天就留該天）與目前選中的藥丸。
- 首次進入行程分頁（init）即依當下匯入碼渲染。

### 4. 覆蓋提示（D2 預設）

- 航班區使用本機層 `flights` 時，航班卡上方顯示一行小字：「以下為你匯入的航班」。
- 單日層該天使用本機層 `itineraryDays` 時，該天內容上方顯示一行小字：「本日行程依你匯入的資料顯示」。
- 退回公開層時兩行皆不出現（v28 畫面零差異）。

### 6. 新 key：`importantOverrides`（選填，v1.4；取代 v1.3 的 `hideImportantLabels` 設計）

- 背景：Olina 裁定（原話）「重要資料裡的『樂桃報到提醒』這個是我的，她的是華航，所以她的匯入要改成她的華航報到提醒」（v1.3 原話「樂桃是我的 不用給他」）。→ 妹妹匯入後，該列要被**取代**成她的報到提醒，位置不變。
- 型別：陣列，元素 `{ match: 字串, label?: 字串, value?: 字串, tel?: 字串 }`。範例（假值）：

```json
{
  "importantOverrides": [
    { "match": "樂桃報到提醒", "label": "假航空報到提醒", "value": "假資料：起飛前 2 小時抵達第 9 航廈" }
  ]
}
```

- 比對：公開層 `window.TRIP.important[]` 中，`label`（前後去空白）與某元素 `match`（前後去空白）**完全相等**的列受影響；同一列命中多個元素時取第一個有效元素。不做部分比對。
- **取代**：元素的 `label`、`value` 至少一個為非空字串 → 該列在**原位置**改渲染為 `{ label, value, tel }`（取自元素；缺的欄位為空字串，不沿用原列內容）；`tel` 為非空字串時照既有規則渲染為 `tel:` 連結，否則為純文字。
- **隱藏**：元素只有 `match`（`label`、`value` 皆缺或空字串）→ 該列不渲染（保留 v1.3 的隱藏能力，給 D9 這類只需拿掉的列）。
- 無效元素（非物件、`match` 非字串或空字串）略過；`match` 對不上任何列 → 略過（不新增列）。
- 無此 key、非陣列、空陣列、無任何相符 → 公開段與 v28 完全相同。其餘列順序、內容、`tel:` 連結照舊。
- 全部列都被隱藏 → 公開段顯示空清單，**不得**顯示「緊急電話資料載入失敗」（該訊息只保留給公開層缺載）。
- 只作用於公開段；本機資料段（護照／保險／訂位／緊急聯絡人）與民宿資訊不受影響。
- 重繪：匯入成功、清除本機資料後，公開段立即依新狀態重繪（比照 §3），不改變目前選中的藥丸。
- 不新增覆蓋提示行。字串一律以 `textContent` 寫入（不得注入 HTML）。

### 5. 不變式

- `js/import-data.js`、`js/tripdata.js` 零 diff；既有匯入碼 key（`passports`／`insurance`／`bookings`／`contacts`／`lodging` 等）行為零變更。
- 個資：新 key 的值只存在使用者 localStorage；任何 tracked 檔不得出現真實訂位代號、姓名、保單號、電話。

## 邊界條件 / 錯誤處理

- `App.privateData` 不存在、`isAvailable()` 為 false、`get()` 回 null 或非物件 → 全部退回公開層，不顯示錯誤（航班/行程是主功能，不得因本機層問題而空白）。
- 公開層 `window.TRIP` 缺載但本機層 `flights` 有效 → 航班區照常顯示本機層航班（比照 Task21「公開掛了私密仍看得到」）；行程區因天數來自公開層，維持既有「行程資料載入失敗」。
- 本機層字串含 `<`、`&` 等 → 照既有 `escHtml`／`textContent` 跳脫，不得注入 HTML。
- 匯入碼含 `flights` 但另一人（Olina）匯入的是不含此 key 的碼 → 只顯示公開層（各裝置各自 localStorage，互不影響）。
- `importantOverrides` 讀取失敗（本機層不可用等）→ 公開段照 v28 全部顯示，不報錯。

## 不在本次範圍（Non-scope）

- **要 bump 版號**（使用者看得到的行為改變）：`APP_VERSION`／`CACHE_VERSION` 同步改為下一版、`APP_VERSION_DATE` 填當天，依 CLAUDE.md 第 5 節。`sw.js` PRECACHE 清單零增減（不新增檔案）。
- 不改 `js/tripdata.js`（公開航班、行程、`important` 各列內容都不動；「樂桃報到提醒」只在匯入碼要求時於畫面原位取代或隱藏，資料不刪）、不改 `js/mapdata.js` 與地圖頁（機場點不隨航班變，D4）。
- `importantOverrides` 只能原位取代或隱藏既有列，不支援新增列、排序；不用它隱藏本機資料段或其他分頁內容。
- 不改 `js/import-data.js`、不改匯入/匯出/清除 UI 流程與文案。
- 不新增天數、不支援「只改某天的某一筆」的局部修補（整天取代即可）。
- 不新增「匯入碼產生器」或任何產碼工具進 repo；**妹妹的實際匯入碼不進任何 tracked 檔**——上線後由 session 在對話中依 Olina 提供的資料現場產生（只存 scratchpad、不 commit），屬流程外工作。
- 不改 `行前檢查清單.md`（含原 Task32 實測那一行，已撤銷，見 §0）。
- 不重構 `trip-tab.js` 既有結構、不改其他分頁。
- 冒煙既有斷言一律不放寬、不改別的 Task 的檢查；`scan_files` 新增 Task32 檔時**不得改變 `T31_SCAN_ADDED = scan_files[-8:]` 所指的 8 個 Task31 檔**（例如插在 Task31 區塊之前；作法由 SA 定）。

## [待 Olina]（皆**不擋工**：已採 PM 建議預設實作；Olina 推翻任一項都不改 schema，可在 QA 前一句話改）

- **D1 覆蓋範圍**（v1.3：Olina 已確認妹妹同住同一飯店、Day 2／Day 3 同行）：航班卡＋行程當日內容都可覆蓋，帶哪幾天屬產碼內容、不影響程式。**已定**：妹妹的碼 `flights` 帶去程＋回程兩段；`itineraryDays` 只帶 2026-10-22（D7）與 2026-10-25（D8），**不帶 10/23、10/24**；`importantOverrides` 帶一筆 `match`「樂桃報到提醒」→ 她的華航報到提醒（D3）。
- **D2 覆蓋提示文字**：建議預設＝顯示（§4 兩行小字），方便一眼確認「匯入生效」。可改為「不顯示」。（v1.3：Olina 未回覆，維持建議預設）
- **D3 「樂桃報到提醒」那行**（v1.4：Olina 裁定推翻原預設並細化，原話「重要資料裡的『樂桃報到提醒』這個是我的，她的是華航，所以她的匯入要改成她的華航報到提醒」）：妹妹匯入後該列原位換成她的華航報到提醒 → §6 `importantOverrides`。**已定**：妹妹的碼帶 `{ match: "樂桃報到提醒", label: 華航報到提醒, value: 她的報到建議 }`；value 文字產碼時依華航確認信／官網建議寫（`[待 Olina]` 產碼時核對，不影響程式），比照原列寫法如「建議起飛前 N 小時抵達機場（桃園 T2、成田 T2）」。
- **D9 「旅遊平安險（臺灣產物）」那行**（v1.3 PM 提出，不擋工）：該列標籤寫的是 Olina 的保險公司，妹妹保險不同時可能誤導。同一機制即可處理，不需改程式：建議預設＝妹妹保險公司若不同，碼再加一筆 `{ match: "旅遊平安險（臺灣產物）", label: "旅遊平安險（她的保險公司）", value: "保單號、緊急電話請由「重要資料→匯入」的本機層取得" }`（原位取代），她自己的保單照舊放 `insurance` 顯示在本機資料段。
- **D4 地圖機場點**：建議預設＝不動（地圖是成田 T1）。已知妹妹去程抵達航廈與 Olina 不同（[待 Olina] 實值只在對話、不進 repo），地圖點對她的抵達會偏一個航廈；要改需另開 Task。（v1.3：Olina 未回覆，維持建議預設）
- **D6 回程**（v1.2：妹妹回程資料已到，本項改為通則）：去程／回程各自選填、整組取代、不混入公開層回程。妹妹的碼建議預設＝去程＋回程兩段都放，不需佔位卡；「回程航班待確認」佔位卡寫法保留給日後只有單程資料的人。
- **D7 Day 1 往上野交通**（v1.1：Olina 補充「兩人都搭 Skyliner 進上野」）：路線相同，差在出發航廈、抵達航廈與時間。現有 Day 1 的出發機場、報到、起飛、抵達時間與「從 T1 的京成『成田空港』駅上車」對她都不適用。本設計只支援整天取代、不支援只改某幾筆的時間（Non-scope），所以**建議預設仍是她的碼帶 2026-10-22 整天**：往上野那一項沿用 Olina 的 Skyliner 步驟文字（買票方式、票價、到京成上野、步行到飯店），只把上車站換成她抵達航廈對應的京成車站（Skyliner 第 2 航廈停「空港第2ビル」駅 `[推斷]`，產碼時再核對），報到／起飛／抵達改成她的時間與航廈，出發往桃園的交通＝捷運到台北車站轉機場捷運直達車（v1.3 Olina 確認），時間依她的起飛時間往前推。產碼後給 Olina 過目。備選：Day 1 不覆蓋（她會看到 Olina 的時間與 T1）。
- **D8 Day 4 歸途**（v1.2：妹妹回程起飛比 Olina 早約 2 小時、航廈不同）：Day 4 現有內容（約 12:00 Skyliner、14:10 最晚抵機場、從第 1 航廈出發、MM623 起飛、抵桃園後往板橋）對她不適用。兩人都搭 Skyliner（上野→成田），路線相同。建議預設＝她的碼帶 2026-10-25 整天：退房・寄放行李照舊；Skyliner 一項沿用 Olina 的步驟文字，下車站改成她的出發航廈對應的京成車站（第 2 航廈＝「空港第2ビル」駅 `[推斷]`，產碼時核對），出發時間依她的起飛時間往前推（比照 Olina「起飛前 2.5 小時抵機場」再扣 Skyliner 車程與上野步行，約比 Olina 早 2 小時）；「最晚抵機場」改為她起飛前 2.5 小時；起飛／抵桃園改成她的時間與航廈；抵台後回家＝機場捷運直達車到台北車站轉捷運（v1.3 Olina 確認）。產碼後給 Olina 過目。（v1.3 已確認同住同行，Day 2／Day 3 不覆蓋。）
- **D5 妹妹的日期**（v1.2：已確認妹妹去回程都在 10/22～10/25 內，本項不成立、無需處理）：本設計只覆蓋這四天內的日子。

## 驗收判準（QA 機械驗）

1. 冒煙 `PYTHONUTF8=1 python qa_smoke_test.py` FAIL＝0；既有 Task3 航班斷言（L325–326）與行程斷言照舊 PASS。
2. `git diff origin/main --stat` 中 `js/tripdata.js`、`js/import-data.js`、`js/mapdata.js`、`行前檢查清單.md` 皆不出現；PRECACHE 筆數不變。
3. 版號：`js/version.js` `APP_VERSION` 與 `sw.js` `CACHE_VERSION` 逐字元相等且較 main 前進一版，`APP_VERSION_DATE` 為當天 `MM/DD`。
4. **未匯入**：行程頁航班卡為公開層 2 張（MM626／MM623，時間同 v28），Day 1／Day 4 單日層內容與 v28 逐筆相同；兩行覆蓋提示皆不存在。
5. **匯入不含新 key 的碼**（只含 `insurance`／`bookings` 假值）：同判準 4。
6. **只給去程**：匯入含 `flights` 的假碼（§1 範例，只有 1 段去程）→ 航班區只顯示 1 張卡、內容為 ZZ901／07:00／東京羽田 T3 等假值，MM626／MM623 皆不出現（公開層回程不混入）；顯示「以下為你匯入的航班」。再加一段佔位卡 `{label:"回程", note:"回程航班待確認"}` → 顯示 2 張卡，第 2 張只有標籤與備註、無 `undefined`。
7. **缺欄位防禦**：`flights` 元素缺 `to`、`from` 缺 `terminal`、或 `from` 為字串 → 卡片照常渲染，航班區 innerText 不含 `undefined`／`null`／`[object Object]`。
8. **無效 `flights`**（`[]`、`"x"`、`[1,"a"]`）→ 退回公開層 2 張卡，無提示行。
9. **`itineraryDays` 覆蓋**：假碼帶 `{isoDate:"2026-10-25", theme:"假主題", items:[{time:"09:00",title:"假項目"}]}` → Day 4 單日層只有「09:00 假項目」與提示行，MM623 不出現；總覽 Day 4 主題字為「假主題」；Day 1～3 與 v28 相同。不給 `theme` 時沿用「歸途」。
10. **對不上／無效的 `itineraryDays` 元素**（`isoDate:"2026-12-31"`、缺 `items`、非物件）→ 靜默略過，天數仍 4 天、無錯誤、無提示行。
11. **重繪**：在 Day 4 單日層開著時匯入判準 9 的碼 → 不重開 App 即變；按清除本機資料 → 航班與 Day 4 立即回到 v28 內容，視圖仍停在 Day 4、藥丸選擇不變。
12. **本機層不可用**（模擬 localStorage 拋錯）→ 航班與行程顯示公開層、無錯誤訊息。
13. **XSS**：`flights[0].flightNo` 為 `<img src=x onerror=alert(1)>` → 以文字顯示、不產生 `img` 元素。
14. **隱私**：`scan_files` 含 `specs/Task32.spec.md`、`specs/Task32.impact.md`、`specs/Task32.api.md`，且 T31-8 仍檢查原 8 個 Task31 檔；全 repo 無真實訂位代號（冒煙既有掃描 PASS）。
15. **畫面零英文鍵**：新增提示文字為中文，無 i18n key 外露。
16. 工作樹核對：`git status --porcelain` 只含 `js/trip-tab.js`、`css/style.css`（若 frontend 有加樣式）、`js/version.js`、`sw.js`、`qa_smoke_test.py`、`specs/` 下 Task32 相關檔與 INDEX／STATE／SYSTEM_MAP、`DEVELOPMENT_LOG.md`。
17. **（v1.4）未匯入／碼無 `importantOverrides`**：重要資料公開段 6 列與 v28 逐列相同，第 5 列為「樂桃報到提醒」。
18. **（v1.4）原位取代**：匯入 §6 範例（可與 §1 假航班同碼）→ 公開段仍 6 列；第 5 列為「假航空報到提醒／假資料：起飛前 2 小時抵達第 9 航廈」；公開段 innerText **不含「樂桃」字樣**；其餘 5 列順序、內容、`tel:` 連結不變；不重開 App 即生效。
19. **（v1.4）清除恢復**：判準 18 狀態下按清除本機資料 → 立即回到 6 列、第 5 列恢復「樂桃報到提醒」原文。
20. **（v1.4）隱藏與無效值**：元素只有 `match:"樂桃報到提醒"` → 剩 5 列、無樂桃字樣；`importantOverrides` 為字串、`[1, null]`、`[{match:"樂桃"}]`（部分字串）、`[{match:""}]` → 6 列全同 v28；`match` 前後含空白仍命中；取代元素帶 `tel` → 該列為 `tel:` 連結；取代字串含 `<img src=x onerror=alert(1)>` → 以文字顯示、不產生 `img`。
21. **（v1.4）全部隱藏／不影響其他段**：6 個標籤全以只有 `match` 的元素隱藏 → 公開段無列且不出現「緊急電話資料載入失敗」；本機資料段（假 `insurance`／`bookings`）與民宿資訊照常顯示。

## 影響範圍分析（SA）

> 2026-10-21 SA v1（依 spec v1.4）。完整內容與業務層級依賴見 `specs/Task32.impact.md`。**涉及範圍：含 UI**——backend（`js/trip-tab.js`、`js/version.js`、`sw.js`、`specs/Task32.api.md`、`qa_smoke_test.py`）→ `Task32.backend_done` → frontend（`css/style.css` 提示行樣式；`importantOverrides` 沿用既有 `.trip-important-*`，無新樣式）→ `Task32.done`。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 航班藥丸 | `trip-tab.js` `buildFlightsSection` | 改走有效航班；公開層輸出須與 v28 逐字相同；早退路徑需改寫 | ✅ |
| 行程總覽主題字 | `buildItinerarySection` | 主題字改取有效 theme，匯入／清除後就地更新 | ✅ |
| 行程單日層 | `_renderDayContent` | 內容與 theme 改取有效單日；換天／空日不得退化 | ✅ |
| 重要資料公開段 | `buildImportantPublicList` | 依 `importantOverrides` 原位取代／隱藏；改為可重繪；缺載訊息只留給公開層缺載 | ✅ |
| 匯入／清除重繪 | confirmBtn、clearBtn | 新增航班＋行程＋重要資料公開段重繪（在 `_renderLodgingBlock()` 之後） | ✅ |
| 重要資料本機段、民宿資訊 | `_renderPrivateSection`、`_renderLodgingBlock` | 不改；冒煙 M1／M4 寫死呼叫數 3 | ✅ |
| 地圖日期頭主題字 | `map-tab.js` `findItinDay` | 唯讀公開層；不得 mutate `window.TRIP`，地圖頭維持公開 theme | ✅ |

### Backend 注意事項
- 不得 mutate `window.TRIP`（`flights`／`itinerary`／`important`）或 `_itinData`，有效資料一律組新物件／新陣列。
- 本機層讀取集中成一個 helper（存在＋`isAvailable()`＋`get()` 為物件非陣列，外包 try/catch）。
- 航班重繪保留原 `sec` 元素、只換子節點、不動 `sec.hidden`；早退路徑改為「公開與本機皆無效才顯示載入失敗」。
- 缺欄位一律字串化防禦（非字串→空字串，`from`／`to` 非物件→空），公開層走同一渲染器且輸出不變。
- 行程重繪：總覽依 `dataset.dayIdx` 更新主題字；`_itinView` 為數字時只呼叫 `_renderDayContent(_itinView)`，不呼叫 `_switchView`／`_showDayView`。theme 覆蓋＝非空字串才取代（SA 技術裁定）。
- 重要資料公開段：保留 `wrap` 抽出 `_renderImportantPublic()` 可重繪；trim 後完全比對 `label`；`label`／`value` 任一非空＝取代（欄位全取自元素），皆空＝隱藏；`tel` 非空字串才建 `tel:` 連結；全隱藏留空 `ul`、不顯示載入失敗；無 override 時 DOM 與 v28 相同。
- 三個新重繪建議包成一個函式，放 clearBtn／confirmBtn 的 `_renderLodgingBlock();` 之後、不入 `_renderPrivateSection()` 體；`_renderLodgingBlock()` 呼叫數維持 3。init 首繪在各自 build 函式內完成。
- 提示行建議 class `trip-override-hint`、`textContent`、文案逐字照 §4；寫入 `Task32.api.md`。
- `scan_files` 三個 Task32 檔插在 `# Task31 additive` 區塊之前，`T31_SCAN_ADDED` 不變；新增 T32 斷言段。冒煙無 `important` 寫死斷言（SA 已核）。
- bump v28→v29；PRECACHE 44 不變。

### Frontend 注意事項
- 本次涉及的既有頁面：行程分頁航班藥丸與單日層。只改 `css/style.css` 加提示行樣式，用 `var(--fs-sm)` 等 token、不得硬編碼 px 字級、不低於 `--fs-xs`。
- 新樣式節以自己的注解頭開場；放在 Task21 節之前時，注解內不得含字樣 `Task21`（冒煙 type-scale regex 會誤抓）。建議放在 `.trip-flight-note` 之後。
- 重要資料公開段無新 class、不改 `.trip-important-*` 樣式；不改既有航班卡／單日層樣式與 `index.html`。

### QA 迴歸測試清單
- [ ] 冒煙全綠（T25 航班／行程、T27–T29、M1／M2／M4、Task21 type-scale、T31-8 照舊 PASS）
- [ ] 未匯入：航班 2 張公開卡、Day 1～4 與總覽主題字、重要資料公開段 6 列（含 tel 連結）同 v28，無提示行
- [ ] 行程初始視圖（今天直進單日層／否則總覽）、前後天、返回總覽正常（Task10）
- [ ] 重要資料本機段、匯出、清除流程不變（Task3／Task20）
- [ ] 民宿入住資訊匯入／清除即時重繪（Task21）
- [ ] 地圖分頁日期頭主題字仍為公開 theme
- [ ] 匯入／清除時藥丸與視圖不被重設
- 新功能由 QA 依 spec 驗收（判準 1–21）
