# Task14 影響分析（SA）— 版號可視化＋SW 更新機制可靠化

> 依據：`Task14.spec.md`＋`SYSTEM_MAP.md`＋實讀 sw.js / js/app.js / index.html / css/style.css。
> 涉及範圍：後端核心（version.js 新檔、app.js 更新機制、sw.js bump）＋前端 UI（index.html、style.css）→ **完整 pipeline：backend → frontend → QA**。

## 1. 現況確認（SA 實讀證據，backend 不必再驗）

| 項目 | 現況 | 結論 |
|------|------|------|
| sw.js `self.skipWaiting()` | **有**，install handler 尾（L79） | PM 前提正確；**零改動、保留原位** |
| sw.js `self.clients.claim()` | **有**，activate 的 waitUntil 鏈尾（L92） | 同上 |
| sw.js `CACHE_VERSION` | `'v12'`（L17） | bump → `'v13'` |
| sw.js `PRECACHE_URLS` | **實數 37 筆**（SA 逐筆點算） | ＋`'./js/version.js'` → 38 筆，QA 判準成立 |
| sw.js fetch handler | cache-first＋GET-only 直通（L98–122） | **零 diff**（B3 定案） |
| app.js SW 註冊 | DOMContentLoaded 內 L113–119，`register('./sw.js')` 無選項、registration 未保存、`.then` 只 log | 要加的最小改動見 §2 |
| app.js 既有更新機制 | `reg.update()`／`controllerchange`／`updatefound`／`visibilitychange`／`pageshow` **全 repo 生產碼零出現**（grep 證據，只出現在 specs/） | Task14 全部是**淨新增**，無既有監聽衝突 |
| `location.reload` | 全 repo 生產碼**零出現** | 「全檔恰一處」QA 判準起點乾淨 |
| index.html 版號字串 | 無任何版號元素或寫死版號 | 單一來源判準起點乾淨 |
| style.css z-index 分帶 | nav 10（L142）／bigtext 100／cv 110／Task5-6 保留 120+ | 徽章與 toast 落 **11–99 帶**（建議 20），合 A7 |
| `--nav-h` | `:root` 已有 `calc(60px + var(--safe-b))`（L35），`--safe-b`=env(safe-area-inset-bottom) | 徽章/toast 定位直接 `bottom: var(--nav-h)` 起算，**不必自己再算 safe-area** |

## 2. app.js 最小改動邊界（backend）

全部改動收在既有 DOMContentLoaded 的 SW 註冊段（L112–119）擴充＋同段新增的閉包變數，**不碰 registerTab/showTab/TAB_IDS/lastTab 任何既有邏輯**：

1. `register('./sw.js', { updateViaCache: 'none' })`；`.then` 保存 registration 至閉包變數（如 `_swReg`）。
2. 註冊**前**先快照 `var hadController = !!navigator.serviceWorker.controller;`——首裝防誤報的唯一依據，updatefound 路徑與 controllerchange 路徑**都**要用它守門。
3. `visibilitychange`(visible)＋`pageshow` → 呼叫 update；`updatefound`→新 worker `statechange` 至 `activated`、與 `controllerchange`，兩路匯流到同一個 `showUpdateToast()`（記憶體 flag 防重複）。
4. toast click → `location.reload()`（全檔唯一 reload）。
5. `#app-version` 填字：`window.APP_VERSION && window.APP_VERSION_DATE` 皆存在才填 `APP_VERSION + ' · ' + APP_VERSION_DATE`，否則 no-op；`#app-version`/`#update-toast` 元素缺失 no-op。

### SA 補充定案（spec 縫隙補完，backend 照做）

- **S1（重要）`reg.update()` 的失敗是 promise rejection，不是同步例外**——spec 寫「try/catch 靜默」，但本 repo 全程 ES5 風格（無 async/await），同步 try/catch **接不到** update() 的 rejection，會噴 unhandled rejection。正確寫法：`_swReg.update().catch(function () {})`（外層可再包 try/catch 防 update 本身不存在，雙保險）。QA 判準相應為「update() 呼叫鏈上有 .catch」。
- **S2 handler 必須 null-check registration**：`pageshow` 在首次載入就會 fire（早於 register() resolve），`visibilitychange` 亦同——handler 開頭 `if (!_swReg) return;`。不需要過濾 `pageshow.persisted`：非 bfcache 的普通載入多呼叫一次 update() 無害且有益。
- **S3 監聽掛載位置**：`visibilitychange` 掛 document、`pageshow` 掛 window，都在 DOMContentLoaded 內註冊一次（該段本來只跑一次，天然冪等）。與 App 分頁框架零交集——不 wrap showTab、不碰 registerTab/onShow；未來 Task6 自己的 visibilitychange（camera track 管理）是另一個獨立 listener，互不干擾。
- **S4 controllerchange 在首裝也會 fire**（`clients.claim()` 使 controller 由 null → SW）：hadController 為 false 時兩路一律不彈，直到下次真更新（那時頁面載入時已有 controller）。桌機 Shift+硬重整會暫時 controller=null 導致該頁不彈提示——iOS standalone 無此操作，屬已知無害邊界，不處理。
- **S5 「activated 前的盲刷窗口」（P3）殘留說明**：新 SW install（重抓 38 筆含 4.37MB 券圖）期間刷新仍拿舊版且無提示——此為 cache-first 結構性成本，spec 已接受（B3 不改 SWR）；提示會在 activate 後出現，屬預期時序，QA 不得當 bug 報。

## 3. sw.js diff 邊界（backend）

僅三處：`CACHE_VERSION` `'v12'`→`'v13'`；`PRECACHE_URLS` 追加 `'./js/version.js'`（建議帶 `// Task14（A2 SOP）` 註解，37→38）；檔頭 SOP 註解改寫為「bump ＝ version.js 兩常數 ＋ CACHE_VERSION，共兩檔三行」。install/activate/fetch 邏輯**零 diff**。

## 4. version.js 同步機械閘（QA 每輪必跑，自本 Task 起永續）

- `js/version.js` 的 `APP_VERSION` 字串值 === sw.js `CACHE_VERSION` 字串值，**逐字元相等**（本次皆 `'v13'`）。grep 兩檔取值直接比對，不一致＝FAIL 退 backend。
- `APP_VERSION_DATE` 符合 `MM/DD`（本次 `'07/12'`）。
- 此紀律已登記 SYSTEM_MAP 人工補充區，Task6（順延中，其 spec 的「CACHE_VERSION 開工時實際值 +1」自動吸收 v13）與 Task15 之後所有 bump 一體適用。

## 5. 載入順序（frontend）

- `version.js` script 行插**所有 script 最前**（`config.js` 之前）；A6 註解同步改寫為：`version.js → config.js (onerror) → phrases.js → tripdata.js → app.js → 功能模組（不變）`。
- version.js 純常數零依賴：讀它的只有 app.js（DOMContentLoaded 填徽章），先於 app.js 即滿足；404 時 APP_VERSION undefined → app.js no-op，不壞頁（比照 config.js 容錯精神，但不需 onerror 屬性——無人依賴其載入狀態旗標）。

## 6. 徽章與 toast 不干擾既有 UI（frontend）

- `#app-version`：fixed、`bottom: var(--nav-h)` 起算貼右側角落、字級 11–12px **硬編碼**（`--fs-*` 僅授權 `.trip-*`，Task10 紀律，越界＝QA FAIL）、色 `--c-text-muted`（可半透明底）、`pointer-events: none`、z-index 建議 **20**（>nav 10、<100）。bigtext(100)/cv(110) 蓋過徽章＝預期。
- `#update-toast`：fixed 於導覽列上方、`min-height: 44px`、accent 底白字——**注意 accent 當底色白字合法（品牌色不翻轉），不得用 `--c-text` 系**（Task8 解耦紀律精神）、z-index 建議 **30**（同帶，蓋徽章可接受）、非 overlay 非 modal、不搶焦點。
- **S6（spec 縫隙）`hidden` 屬性 vs 自訂 display**：`#update-toast` 若 CSS 設了 `display: flex`（或任何非 none 的 display），會**覆蓋** `[hidden]` 的 UA 樣式導致永遠顯示。frontend 必須加 `#update-toast[hidden] { display: none; }` 防呆；QA 加驗一條：頁面初載（無更新）toast 不可見。
- 兩元素放 `</nav>` 之後、script 區之前，不進任何 `.tab-section`（fixed 掛 body，比照 bigtext B1 紀律）。

## 7. 受影響的既有功能（迴歸清單）

| 功能 | 頁面/檔案 | 影響說明 | 需迴歸測試 |
|------|-----------|---------|-----------|
| SW 離線快取 | sw.js 全站 | bump v13＋清單 38 筆；fetch 零 diff，離線行為必須不變 | ✅ 冷 install 離線驗法照舊 |
| 分頁框架/lastTab | app.js | 同檔擴充，registerTab/showTab/localStorage 邏輯零 diff | ✅ 五分頁切換＋lastTab 記憶 |
| 五分頁全部 | index.html/style.css | 新增兩個 fixed 元素；不進 section、不佔 flex 流、pointer-events 防呆 | ✅ 各分頁操作不被遮擋（尤其導覽列上緣觸控） |
| bigtext / 券檢視器 overlay | bigtext.js/coupon-viewer.js | z-index 100/110 蓋過徽章(20)/toast(30)＝預期 | ✅ 開 overlay 時徽章被蓋、關閉復現 |
| 翻譯對話模式（Task12/13） | translate-tab.js | 零 diff；toast 非 modal 不中斷錄音/播音；點更新 reload 中止錄音屬預期 | ✅ 冒煙：錄音→翻譯→自動播 |
| config.js 容錯鏈 | index.html | version.js 插其前，onerror 機制不動 | ✅ 無 config.js 時頁面照常 |
| Task6（順延中） | specs/Task6.* | 其「開工時實際值+1」寫法自動吸收 v13→開工時 bump v14；spec/impact 檔本 Task 不碰，閉環後 SA 複核 | —（閉環後 SA 工作） |

## 8. Backend 注意事項（彙總）

- §2 全部（尤其 S1 promise .catch、S2 null-check、S4 hadController 雙路守門）；§3 sw.js 三處 diff 邊界。
- `Task14.api.md` 必產：version.js 常數契約、事件時序（hadController 快照→register→update 觸發點→兩路偵測→toast→reload）、DOM 契約與 no-op 防禦、**S1–S5 的定案**（供 Task6 SA 複核引用）。
- 零新增 localStorage key（更新 flag 用記憶體變數，禁持久化——持久化會造成 reload 後 flag 殘留誤判）。

## 9. Frontend 注意事項（彙總）

- §5 載入順序＋A6 註解改寫；§6 兩元素樣式約束（含 S6 `[hidden]` 防呆）。
- HTML 內**不得**寫死版號字串（含註解裡也別寫 `v13`——避免下次 bump 漏改造成誤導；QA grep 判準是「無版號字串」）。

## 10. QA 迴歸測試清單

- [ ] 機械閘：APP_VERSION === CACHE_VERSION（`'v13'`）；APP_VERSION_DATE 格式 `MM/DD`
- [ ] sw.js diff 僅三處；skipWaiting/claim 原位；fetch handler 零 diff；PRECACHE 38 筆
- [ ] index.html：version.js 為第一個 script；`#app-version`/`#update-toast` 存在且在 section 外；無寫死版號
- [ ] app.js：`updateViaCache:'none'`；visibilitychange＋pageshow 皆呼叫 update 且帶 `.catch`＋reg null-check；`location.reload` 全檔恰一處在 toast click 內；hadController 守門兩路皆有
- [ ] 徽章 pointer-events:none、z<100、字級硬編碼零 `var(--fs-` 越界；toast min-height≥44px、z<100、`[hidden]{display:none}` 防呆、初載不可見
- [ ] 零新增 localStorage key；全 repo 無 `localStorage.clear()`
- [ ] Non-scope 零 diff 清單（spec §QA 列舉的 14 檔）
- [ ] 冷 install 離線：清站點資料→install→離線→app shell 開、五分頁切、徽章顯示 `v13 · 07/12`
- [ ] 更新流程模擬（localhost 可驗）：v13 在跑→改 CACHE_VERSION 假 bump→切回/重整→toast 出現→點擊 reload 拿新版；首裝（清資料重進）**不**彈 toast
- [ ] 既有冒煙：五分頁、常用句播音、翻譯文字/對話、行程兩層視圖、券檢視器 pinch
- [ ] 隱私三段式照常

## 11. 新紀律登記（已寫入 SYSTEM_MAP 人工補充區）

**bump SOP 自 Task14 起 = 兩檔三行**：`js/version.js` 的 `APP_VERSION`＋`APP_VERSION_DATE`＋`sw.js` 的 `CACHE_VERSION`，QA 機械閘驗逐字元相等。取代舊「只改 sw.js 兩常數」SOP。
