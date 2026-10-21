# Task32 影響分析（SA，v1 初稿——未定稿：D3 推翻待 PM 修訂 spec 後補完）

> 2026-10-21 SA。依據：`specs/Task32.spec.md`（v1.2，PM 已 commit）、`specs/SYSTEM_MAP.md`（L27 trip-tab、L95–97 privateData 紀律、L113 冒煙寫死斷言）、實讀 `js/trip-tab.js`、`js/import-data.js`、`js/map-tab.js`、`css/style.css`、`qa_smoke_test.py`。
> 個資：本檔只用 spec 既有公開值與 `ZZ` 假值，不含任何真實航班以外的個人資料或訂位代號。

## 涉及範圍標記

**含 UI（backend ＋ frontend）**，走 `sa_done → backend → backend_done → frontend → done → qa`。

| 角色 | 檔案 | 內容 |
|---|---|---|
| backend | `js/trip-tab.js` | 有效航班／有效單日的取值邏輯、型別防禦、重繪函式與呼叫點、提示行 DOM（含 class 名與中文文案） |
| backend | `js/version.js`、`sw.js` | v28 → v29、`APP_VERSION_DATE` 當天 `MM/DD`；PRECACHE 零增減 |
| backend | `specs/Task32.api.md`（新） | `flights`／`itineraryDays` schema 權威（全假值）、提示行 DOM 結構與 class 名、重繪函式名與呼叫點行號 |
| backend | `qa_smoke_test.py` | `scan_files` 加 Task32 三檔（位置見下）、T32 靜態斷言 |
| frontend | `css/style.css` | 提示行樣式（新樣式節） |

分工依據：`specs/INDEX.md` 角色對應（frontend＝`css/style.css`）＋ Task21 先例（trip-tab.js 由 backend 改、`.trip-lodging-*` 樣式由 frontend 加，見 `specs/Task21.impact.md` L11–12）。

## 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|---|---|---|---|
| 航班藥丸 | `trip-tab.js` `buildFlightsSection`（L311–356） | 改為走「有效航班」；公開層路徑輸出須與 v28 逐字相同 | ✅ |
| 行程總覽日卡主題字 | `buildItinerarySection`（L227–307，theme L264–266） | 主題字改取有效 theme；匯入／清除後需就地更新 | ✅ |
| 行程單日層 | `_renderDayContent`（L110–223） | 內容與 theme 改取有效單日；換天、前後天、返回總覽、空日文案不得退化 | ✅ |
| 行程初始視圖（今天直進單日層） | `buildItinerarySection` L296–304 | 天數／isoDate 仍取公開層，不受影響；需確認 | ✅ |
| 匯入／重新匯入／清除 | `_buildImportArea` confirmBtn（L983–1000）、clearBtn（L938–943） | 新增航班＋行程重繪呼叫 | ✅ |
| 重要資料本機段、民宿入住資訊 | `_renderPrivateSection`、`_renderLodgingBlock` | 不改；但呼叫點相鄰，冒煙 M1／M4 會掃到 | ✅ |
| 地圖分頁日期頭主題字 | `js/map-tab.js` `findItinDay`（L67–77）、L214–218 | 唯讀 `window.TRIP.itinerary`；本 Task 不改地圖（Non-scope D4），匯入的 theme **不會**出現在地圖頭——符合 spec；前提是 backend 不得 mutate `window.TRIP` | ✅（確認地圖頭仍顯示公開 theme） |
| 重要資料公開段「樂桃報到提醒」 | `buildImportantPublicList` | 不動（D3） | ❌ |

## Backend 注意事項

1. **不得 mutate `window.TRIP` 或 `_itinData`**。有效單日請組新物件（例：`{ day, isoDate, theme, items, overridden }`）。直接改寫會 (a) 讓清除後無法回到 v28 內容、(b) 漏到地圖分頁的 theme（越界 D4）。
2. **本機層讀取集中成一個 helper**（例 `_getPrivateObj()`）：`App.privateData` 存在、`isAvailable()` 為真、`get()` 回「物件且非陣列」才回傳，否則回 null；外層再包 try/catch。`import-data.js` 的 `get()` 已自帶 try/catch（L68–76，失敗回 null），但 `isAvailable` 也要防，滿足判準 12。
3. **航班區重繪不得換掉 section 元素**：`buildPills` 的 `sections` 陣列抓的是 init 時的 `sec` 參照，pill 切換靠 `sec.hidden`。重繪＝保留 `sec`（存成模組變數，例 `_flightsSecEl`），清空其子節點後重建；不得動 `sec.hidden`，以保住目前藥丸（spec §3）。
4. **`buildFlightsSection` 早退路徑要改**（`specs/SYSTEM_MAP.md` L97 已記同型陷阱）：現行 `!data.flights` 直接 `innerHTML='航班資料載入失敗'; return`。spec 邊界條件要求「`window.TRIP` 缺載但本機 `flights` 有效 → 照常顯示本機航班」；兩者都無效才顯示載入失敗。建議把渲染抽成 `_renderFlights()`，`buildFlightsSection` 只建 `sec` 後呼叫它，匯入／清除也呼叫它。
5. **缺欄位防禦統一走同一個渲染器**：每欄 `typeof v === 'string' ? v : ''`；`from`／`to` 非「物件且非陣列」視同空物件。公開層資料欄位齊全，走同一渲染器輸出與 v28 相同（判準 4 會逐字比）。注意現行 `f.from ? ... : escHtml(String(f.from || ''))` 對字串 `from` 會原樣印出，本機層路徑要改成視同未提供（spec §1）。
6. **航班卡 HTML 仍用 `escHtml` 組字串**（現行結構），提示行與單日 items 用 `textContent`；`detail` 照現行 `escHtml(...).replace(/\n/g,'<br>')`。非字串的 item 欄位一律當空字串，避免 `[object Object]`。
7. **`itineraryDays` 對應規則**：逐筆檢查（物件、`isoDate` 字串且對上公開層某天、`items` 為陣列），同 isoDate 取第一筆有效者；`items` 內非物件略過。**theme 覆蓋條件（SA 技術裁定）**：`theme` 為非空字串才取代，否則沿用公開層（spec「有給 theme 時」的機械化定義，空字串視同未給）。PM 若不同意，閉環前一句話改即可，不動 schema。
8. **行程重繪**（例 `_renderItineraryOverride()`）：(a) 總覽：逐張 `.trip-ov-card` 依 `dataset.dayIdx` 更新 `.trip-ov-day-theme` 的 `textContent`；(b) 單日層：僅當 `typeof _itinView === 'number'` 時呼叫 `_renderDayContent(_itinView)`，**不呼叫 `_switchView`／`_showDayView`**（那兩個會改 hidden 與捲動），也不改 `_itinView`。`_itinOverviewEl` 為 null（公開行程缺載）時直接 return。`_renderDayContent` 本身只動 `_itinDayEl` 內容、不碰 hidden，可安全重入。
9. **呼叫點（冒煙 M1／M4 寫死，必守）**：
   - 新重繪呼叫加在 clearBtn 與 confirmBtn 兩處 `_renderLodgingBlock();` **之後**（函式外、additive），**不得寫進 `_renderPrivateSection()` 函式體**（SYSTEM_MAP L96 扇出紀律 (1)）。
   - `_renderLodgingBlock()` 全檔呼叫次數必須仍為 3（M4 寫死）；不得為 DRY 把三者包成一個新函式而移走既有呼叫。
   - init 首繪：航班與行程在各自 build 函式內依當下本機層渲染（`buildFlightsSection`／`buildItinerarySection` 在 `buildImportantSection` 之前執行），不需在呼叫點 3 加呼叫。
   - 這是 privateData 第 3、4 個渲染目標，`specs/SYSTEM_MAP.md` L96 扇出紀律的「每個 mutation 點補齊每個渲染呼叫」適用；`Task32.api.md` 須列出兩個呼叫點行號並註明 confirmBtn 點覆蓋首次匯入＋重新匯入兩時機。
10. **提示行**：航班區在第一張卡之前、單日層在 `.trip-itin-day-content` 內最上方（items 為空時提示行在「本日無排定行程」之上）。建議單一 class `trip-override-hint`（`<p>`，`textContent`），文案逐字照 spec §4：「以下為你匯入的航班」「本日行程依你匯入的資料顯示」。class 名寫進 `Task32.api.md` 給 frontend。
11. **冒煙 `qa_smoke_test.py`**：
    - `scan_files` 新增 `specs/Task32.spec.md`、`specs/Task32.impact.md`、`specs/Task32.api.md`，**插在 `# Task31 additive` 註解區塊之前**（Task30 區塊之後），使 `T31_SCAN_ADDED = scan_files[-8:]`（L261）仍指原 8 檔（判準 14）。
    - 新增 T32 段（放在 T31-8 之後、結果彙總之前）：T32-1 三檔存在（比照 T31-8，因 scan 迴圈缺檔靜默 continue）；T32-2 `trip-tab.js` 含兩句提示文案逐字；T32-3 新重繪函式在 clearBtn 與 confirmBtn 兩處 `_renderLodgingBlock()` 之後各被呼叫一次；T32-4 `css/style.css` 含提示行 class（frontend 未完成時允許依 T23-C 先例優雅跳過或由 backend 先只加 1–3，frontend 完成後 QA 跑全）。斷言名稱與數量由 backend 定，不得放寬既有斷言。
    - 版號：冒煙 L40–55 只驗相等與日期存在，bump 後自動通過；PRECACHE 寫死 44（L58–78）不變。
12. `js/import-data.js`、`js/tripdata.js`、`js/mapdata.js` 零 diff（SA 已核：`import-data.js` 無 top-level key 白名單，新 key 會原樣帶入 `get()`）。

## Frontend 注意事項

1. 只改 `css/style.css`：為提示行 class（以 `Task32.api.md` 為準）加樣式，建議比照 `.trip-lodging-empty`（L1462）／`.trip-flight-note`（L847）：`font-size: var(--fs-sm)`、`color: var(--c-text-muted)`；**不得用硬編碼 px 字級、不得小於 `--fs-xs`**（L38 行程頁下限）。航班區提示行左右邊距對齊 `.trip-flight-card` 的 `margin: 14px 12px 0`。
2. **新樣式節注解頭陷阱（冒煙 Task21 type-scale，`qa_smoke_test.py` L197–201）**：該 regex 抓「全檔第一個含字串 `Task21` 的注解」之後到下一個 `/*`。新樣式節必須以自己的 `/* ... */` 注解頭開場，且**若放在 L1271 Task21 節之前，注解內不得出現字樣 `Task21`**（例如寫「比照 Task21」會讓 regex 改抓你的節，Task21 判準誤判）。建議放在航班卡樣式（L847 `.trip-flight-note`）之後、飯店卡注解之前，注解頭寫「Task32 — 匯入覆蓋提示行」。
3. 不改 `index.html`、不動既有航班卡與單日層 class 的樣式（覆蓋後沿用既有 DOM 與樣式，spec §「涉及範圍」）。
4. 390px 視口驗提示行不換行溢出、不擋卡片；畫面零英文。

## QA 迴歸測試清單

- [ ] 冒煙全綠；T25-2 航班斷言（L315–352）、T25 行程斷言、T27／T28／T29 Day 2／3 斷言照舊 PASS；M1／M2／M4（M4 呼叫數仍為 3）、Task21 type-scale、T31-8（仍檢查原 8 檔）PASS。
- [ ] 未匯入：航班藥丸 2 張公開卡逐字同 v28；Day 1～4 單日層與總覽主題字同 v28；無提示行。
- [ ] 行程初始視圖：今天在 10/22～25 內直進該天、否則停總覽（Task10 行為），匯入後亦不變。
- [ ] 單日層前一天／後一天、首末日 disabled、返回總覽、捲動歸零仍正常（Task10）。
- [ ] 重要資料本機段（護照／保險／訂位／聯絡人）、匯出、清除流程與文案不變（Task3／Task20）。
- [ ] 飯店藥丸民宿入住資訊（Task21）匯入／清除後仍即時重繪。
- [ ] 地圖分頁日期頭主題字仍顯示公開層 theme（匯入 `itineraryDays.theme` 後也不變）。
- [ ] 匯入／清除時目前藥丸與視圖（總覽或某天）不被重設。
- 新功能由 QA 依 spec 判準 1–16 驗收。

## 業務層級依賴

- **privateData 渲染扇出從 2 增為 4**：`js/trip-tab.js` 的 `_renderPrivateSection`、`_renderLodgingBlock`、新航班重繪、新行程重繪，mutation 點仍只有 clearBtn 與 confirmBtn 兩處，沒有自動同步機制；漏一處＝靜默舊資料。延續 `specs/SYSTEM_MAP.md` L96 紀律，閉環時 PM 應把「消費者 4 個」寫進該條。
- **地圖頭 theme 與行程 theme 可能不一致**：`js/map-tab.js` L214–218 只讀 `js/tripdata.js` 公開 theme；匯入碼帶 `itineraryDays.theme` 時，行程頁與地圖頁會顯示不同主題字。屬 D4 Non-scope 的已知差異，非 bug。
- **公開層 `js/tripdata.js` 仍是天數與 isoDate 的唯一來源**：`itineraryDays` 只能覆蓋既有 4 天；`js/mapdata.js` 的 isoDate 對齊契約（SYSTEM_MAP L108）不受影響。日後若行程改期，舊匯入碼的 `itineraryDays` 會因 isoDate 對不上被靜默略過（設計如此，症狀是「匯入了卻沒變」）。
- **冒煙寫死斷言交集**：`qa_smoke_test.py` L261 `T31_SCAN_ADDED = scan_files[-8:]` 依清單尾端位置定義——Task32 新檔若 append 在尾端會讓 T31-8 改檢查錯的檔（假陽性/假陰性），必須插在 Task31 區塊之前；L58–78 PRECACHE 44 不變；L141–160 M4 寫死 `_renderLodgingBlock` 呼叫數 3；L197–201 Task21 type-scale regex 對 `css/style.css` 注解字樣敏感。
- **`buildFlightsSection` 早退吞內容**（`js/trip-tab.js` L317–320，SYSTEM_MAP L97 已登記同型陷阱）：本 Task 必須改寫此早退，否則「公開層掛了仍看得到自己的航班」不成立。
- **使用者 localStorage 內的匯入碼是唯一資料來源**：妹妹的實際碼不進 repo（spec Non-scope）；`js/import-data.js` 無 key 白名單是本 Task「零 diff」的前提，日後若有人加白名單，`flights`／`itineraryDays` 會被靜默丟棄。

## 備註（交 PM）

- spec v1.2 的 D6 已由 PM 修正為通則，SA 無過時敘述需回報。
- SA 技術裁定一條：theme 覆蓋以「非空字串」為準（Backend 注意事項 7）。
- 判準 16 工作樹清單未列 `specs/Task32.api.md`、`specs/Task32.impact.md` 以外的 Task32 檔——「specs/ 下 Task32 相關檔」已涵蓋，無需改。
- `specs/SYSTEM_MAP.md` 本輪未發現與程式碼脫節之處，未手改；閉環時由 PM 更新 L27（trip-tab 新函式）、L96（扇出 4 個）。
