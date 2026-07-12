# Task14 — 版號可視化＋SW 更新機制可靠化

## 模組：app shell 更新基礎建設（sw.js / app.js / version.js / index.html / style.css）

### 功能描述

畫面上永遠看得到目前版號（`v13 · 07/12` 樣式），且部署新版後 App 能可靠偵測並以「有新版本，點一下更新」提示讓 Olina 一鍵拿到新版——解決「刷新近 10 次還是舊版、又不知道現在是哪一版」。

### 背景與已拍板決策（不重議）

- 已完成：Task13（對話模式日→中自動播）已閉環並部署。Olina iPhone 實機刷新近 10 次，Task13 變更沒出現；畫面無版號，她無法判斷刷新成沒成功、現在是哪一版。
- 已拍板（Olina）：本任務為基礎建設**插隊 Task6 之前**（會動 sw.js，與 Task6 衝突；Task6 順延，其「CACHE_VERSION 開工時實際值 +1」自動吸收本任務的版本變動）。
- 已拍板（Olina）：要版號顯示＋可靠更新機制；保留離線可用；重靜態資源（16 張券圖）不必每次強抓。
- **現況更正（PM 讀碼證據，冷 context 不得沿用錯誤前提）**：`sw.js` 自 Task1 起 install 尾已有 `self.skipWaiting()`、activate 尾已有 `self.clients.claim()`——「新版 SW 進 waiting 不啟用」**不是**本案根因。本 spec 依下方黏性路徑盤點設計，SW 生命週期兩行**確認保留、零改動**。
- SA/backend/frontend 不得重開已拍板方向；有疑慮記入回報交 PM，不自行改走別條路。

### 涉及範圍

- [x] 後端／核心邏輯（sw.js、app.js 更新機制、js/version.js 新檔、版本 bump）
- [x] 前端／UI（index.html 版號徽章＋更新提示元素與 script 行、css 樣式）

---

## 黏性路徑盤點（本 spec 的設計依據，每條都有對應修法）

「刷了拿不到新版」不是單一成因，以下為程式證據盤點；本任務不賭單一根因，全數覆蓋：

| # | 路徑 | 證據 | 本 spec 修法 |
|---|------|------|--------------|
| P1 | **更新檢查時機缺失**：app.js 只在 DOMContentLoaded 註冊 SW，從不呼叫 `reg.update()`。iOS 主畫面 PWA 從記憶體恢復（切出再切回）常**不觸發導航級更新檢查**——「下拉重整」可能只是 resume，SW 根本沒去比對新版 | app.js L112–119 | `visibilitychange`→visible 與 `pageshow` 時呼叫 `reg.update()`（需求 B1） |
| P2 | **無版本回饋**：刷新成功與否、現在哪一版，畫面上零資訊，只能盲刷 | index.html 無任何版號元素 | 版號徽章（需求 A） |
| P3 | **新 SW activate 前的盲刷窗口**：新 SW install 要重新精快取 37 筆（含 4.37MB 券圖，Task4 起已知前向成本），這段期間怎麼刷都是舊 cache、且無任何提示；activate＋claim 後**當前頁仍跑舊資產**，要再 reload 一次才換血 | sw.js install/fetch cache-first | 新 SW 接管後主動彈「有新版本，點一下更新」提示，點擊 reload（需求 B2） |
| P4 | **sw.js 自身的 HTTP cache**：GitHub Pages 回 `max-age=600`。主 sw.js 檔更新檢查預設繞過 HTTP cache（`updateViaCache` 預設 `'imports'`），風險低但未釘死 | GH Pages 行為＋規格預設值 | 註冊改帶 `{ updateViaCache: 'none' }` 一併釘死（需求 B1） |
| P5 | **部署側**（變更是否真的推上 GH Pages）：非本 repo 程式面，Non-scope——但版號徽章讓 Olina 能直接分辨「部署沒上」vs「快取黏住」，本身就是診斷儀表 | — | 需求 A 的附帶價值 |

> 若本任務閉環部署後症狀仍現，即升級為完整性敏感診斷案（走 diagnosis.md），屆時版號徽章是現成量測工具。

---

## 需求 A — 版號顯示

### A1. 版號單一來源：`js/version.js`（新檔）

```js
// bump SOP（自 Task14 起）：改本檔兩常數 ＋ 同步 sw.js CACHE_VERSION（QA 機械判準：APP_VERSION === CACHE_VERSION）
window.APP_VERSION = 'v13';
window.APP_VERSION_DATE = '07/12';
```

- `APP_VERSION`：與 sw.js `CACHE_VERSION` **逐字元相等**（本 Task 定為 `'v13'`＝開工時實際值 v12 +1）。
- `APP_VERSION_DATE`：`MM/DD` 格式，＝bump 當天（台灣時區）。
- **同步機制定案（PM）**：採「雙常數＋機械閘」而非 importScripts 單一來源——sw.js 主檔 byte-diff 是所有引擎最可靠的更新偵測訊號（importScripts 匯入檔的 byte 比對行為在 Safari 上不保證），可靠性是本案目的，故 bump 必須讓 sw.js 本體變 bytes。不一致風險由 QA 機械判準攔（見 §QA）。
- 兩檔檔頭註解互相指向：sw.js 的「加新檔案 SOP」註解改寫為「bump ＝ version.js 兩常數 ＋ CACHE_VERSION，共兩檔三行」。

### A2. 徽章顯示

- 格式：`v13 · 07/12`（`APP_VERSION + ' · ' + APP_VERSION_DATE`）。
- 位置：**底部導覽列正上方、右側角落**的小字徽章（固定定位，五個分頁皆恆常可見）。
- 樣式約束（frontend）：
  - 字級 11–12px **硬編碼**（`--fs-*` 僅授權 `.trip-*`，Task10 紀律）；色用 `--c-text-muted`，可帶半透明底防疊在內容上難讀。
  - `pointer-events: none`——絕不擋任何觸控。
  - `z-index < 100`（overlay 分帶紀律；bigtext/券檢視器蓋過徽章是預期行為）。
  - 位置計算須含 `env(safe-area-inset-bottom)`（導覽列高度變數 `--nav-h` 已存在）。
- DOM 契約：`<div id="app-version"></div>`（frontend 建元素與樣式；**文字由 app.js 填**——單一來源，HTML 內不得寫死版號字串）。

## 需求 B — 更新機制可靠化

### B1. 更新檢查時機（app.js，backend）

- 註冊改為 `navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })`（不支援該選項的引擎會靜默忽略，無害）。
- 保存 registration；於 `visibilitychange`→`document.visibilityState === 'visible'` 與 `pageshow` 事件呼叫 `reg.update()`，try/catch 靜默（離線時 update 失敗屬預期）。效果：每次打開 App／從背景切回都做一次更新檢查，補上 P1 缺口。
- 不做定時輪詢（Non-scope）。

### B2. 更新提示與生效策略（定案：提示點擊更新，**不做自動 reload**）

- 偵測：`updatefound` → 新 worker `statechange` 至 `activated`，以及 `controllerchange`，兩路皆導向「顯示更新提示」（記憶體 flag 防重複顯示）。
- **首次安裝防誤報**：頁面載入當下 `navigator.serviceWorker.controller` 為 null（第一次造訪、無舊 SW）→ 後續 activate/controllerchange **不彈提示**（那是首裝不是更新）。
- 提示行為：畫面出現「有新版本，點一下更新」（文案定案，不含新版號——舊頁面無從得知新版號，reload 後徽章自會顯示）；**點擊 → `location.reload()`**。這是全 App 唯一的程式化 reload 路徑——無自動 reload ⇒ 無限重整風險結構性不存在，不需額外防呆計數。
- 提示不自動消失、不可滑掉（新版就是要拿到）；使用者自行重整也行——新頁載入時已是新版就不會再彈。
- DOM 契約：`<button id="update-toast" hidden>有新版本，點一下更新</button>`（frontend 建元素與樣式；顯示/隱藏與 click handler 由 app.js 控）。
- 提示樣式約束（frontend）：固定定位於導覽列上方（不遮徽章亦可遮，自行取捨）、`min-height: 44px` 觸控目標、accent 底白字醒目、`z-index < 100`、不搶焦點不擋其餘操作（非 overlay、非 modal）。

### B3. 快取策略（定案：**維持 cache-first，不改 stale-while-revalidate**）

評估結論（PM）：
- 更新可靠性已由 B1＋B2 解決（檢查時機＋主動提示＋一鍵 reload）；SWR 會製造「頁面舊、快取新」的不確定中間態，版號徽章反而失去判讀意義（畫面 v12 但快取已 v13）。
- 改 fetch handler 波及全站已驗收離線行為與 16 張券圖（Olina 已拍板不必每次強抓——cache-first 天然滿足）。
- 故 **sw.js 的 fetch handler 零改動**；install/activate 的 skipWaiting/claim 確認保留、零改動。sw.js 本次 diff 僅限：`CACHE_VERSION` v12→v13、`PRECACHE_URLS` 追加 `'./js/version.js'`（37→38 筆）、檔頭 SOP 註解改寫。

---

## 契約與載入順序定案

- **A6 載入順序契約修訂（Task1 契約異動，PM 授權）**：`version.js` 插在**所有 script 最前**（`config.js` 之前）——純常數、零依賴、最不可能被後續錯誤波及。修訂後定死順序：`version.js → config.js → phrases.js → tripdata.js → app.js →（功能模組不變）`。index.html A6 註解同步改寫。
- 新檔 `js/version.js` 進 PRECACHE（A2 SOP）。
- `#app-version`、`#update-toast` 為本 Task DOM 契約；app.js 對兩元素皆做**存在性防禦**（元素缺失 → no-op，不噴錯）。
- backend 完成後產 `Task14.api.md`：記 version.js 常數契約、app.js 更新機制行為（事件時序、guard 條件）、DOM 契約，供 frontend 與後續 Task（含 Task6 的 SA 複核）引用。

## 分工

- **backend**：`js/version.js` 新檔；`app.js` SW 註冊段擴充（B1/B2 全部邏輯，含填徽章文字、控 toast 顯示與 click reload）；`sw.js` bump v13＋PRECACHE＋SOP 註解；`Task14.api.md`。
- **frontend**：`index.html`（version.js script 行插最前＋A6 註解修訂；`#app-version`、`#update-toast` 元素）；`css/style.css`（徽章＋提示樣式，守 A2/B2 樣式約束）。

## 業務規則

1. 版號格式恆為 `vN · MM/DD`；版號與日期只存在 `js/version.js` 一處（HTML/CSS/其他 js 不得寫死版號字串）。
2. `APP_VERSION` 與 `CACHE_VERSION` 逐字元相等是 repo 級永續紀律（自本 Task 起入 QA 每輪機械判準與 SYSTEM_MAP 人工補充區）。
3. 徽章五分頁恆常可見；overlay（z≥100）蓋過屬預期。
4. 更新提示只在「真更新」出現（首裝不彈）；reload 只由點擊提示觸發。
5. 離線可用不變：app shell precache cache-first 照舊；離線開 App、reg.update() 失敗皆靜默不擾動。

## 邊界條件 / 錯誤處理

- **SW 不可用**（非 https/localhost、瀏覽器不支援）：徽章照常顯示（版號來自 version.js，不依賴 SW）；提示永不出現。
- **version.js 載入失敗**：`window.APP_VERSION` undefined → app.js 徽章填字 no-op（徽章留空或隱藏），全 App 其他功能零依賴、不壞頁。
- **首次造訪**：precache 進行中無提示、無徽章異常；裝完後照常。
- **提示顯示中使用者自行手動重整**：新頁面載入即為新版，flag 重算、不再彈。
- **錄音/播音進行中彈出提示**：提示非 overlay 不搶焦點、不中斷任何進行中操作；使用者點更新導致 reload 而中止錄音屬預期（她主動點的）。
- **快速連續部署兩版**：以最後 activate 的 SW 為準，提示只彈一次（flag），reload 後拿最新。

## QA 判準（機械優先）

- [ ] `grep` 相等判準：version.js `APP_VERSION` 值 === sw.js `CACHE_VERSION` 值（本次皆 `'v13'`）；`APP_VERSION_DATE` 符合 `MM/DD`。
- [ ] sw.js diff 僅三處：CACHE_VERSION、PRECACHE +`./js/version.js`（38 筆）、檔頭註解；**fetch handler 與 install/activate 邏輯零 diff**（skipWaiting/claim 仍在原位）。
- [ ] index.html：version.js 為第一個 `<script>`；`#app-version`/`#update-toast` 存在；HTML 內無寫死版號字串。
- [ ] app.js：register 帶 `updateViaCache:'none'`；visibilitychange＋pageshow 皆有 `reg.update()`；`location.reload` 全檔恰一處且在 toast click handler 內；首裝 guard（controller null → 不彈）可由 stub 驗。
- [ ] 徽章：`pointer-events:none`、z-index<100、字級硬編碼（`var(--fs-` 越界＝0）；提示 min-height≥44px、z-index<100。
- [ ] 零新增 localStorage key；全 repo 仍無 `localStorage.clear()`。
- [ ] Non-scope 零 diff：translate-tab.js / recorder.js / tts.js / bigtext.js / api.js / coupon-viewer.js / coupons-tab.js / phrases.js / phrases-tab.js / trip-tab.js / import-data.js / tripdata.js / config.example.js / manifest.webmanifest。
- [ ] 冷 install 離線驗法照舊（清站點資料→install→離線→app shell 可開、五分頁可切）。
- [ ] 隱私三段式照常（版號無個資；version.js 兩常數為唯二內容）。

### 不在本次範圍（Non-scope，必填護欄）

- 不做 Task6 拍照 OCR（順延中）、不做部署自動化、不做 KML 地圖。
- 不碰翻譯/對話/行程/常用句/折價券任何功能邏輯（上列零 diff 清單）。
- 不改 sw.js fetch 策略（不做 SWR / network-first——B3 已定案不採用，執行者不得「順手」改）。
- 不做自動 reload、不做定時輪詢 `reg.update()`。
- 不改 schema／資料檔、不動 manifest 與 icons、無新增 localStorage key、不碰個資。
- 不動 Task6 已產出的 spec 與 impact 檔（其複核屬 Task14 閉環後的 SA 工作，不屬本 Task 執行者）。

---

## 影響範圍分析（SA）

> 全文見 `Task14.impact.md`。現況經 SA 實讀確認：sw.js skipWaiting（L79）/claim（L92）確在，CACHE_VERSION='v12'，PRECACHE 實數 37 筆；app.js 生產碼零 update()/controllerchange/updatefound/visibilitychange/pageshow、全 repo 零 `location.reload`——本 Task 全為淨新增，無既有監聽衝突。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| SW 離線快取 | sw.js 全站 | bump v13＋PRECACHE 38 筆，fetch 零 diff | ✅ 冷 install 離線驗法 |
| 分頁框架 | app.js | 同檔擴充，registerTab/showTab 零 diff | ✅ 五分頁＋lastTab |
| 五分頁 UI | index.html/style.css | 兩個 fixed 元素（section 外、pointer-events/z-index 防呆） | ✅ 觸控不被遮擋 |
| overlay 分帶 | bigtext/coupon-viewer | 100/110 蓋過徽章(建議 20)/toast(建議 30)＝預期 | ✅ 開關 overlay |
| 翻譯對話模式 | translate-tab.js | 零 diff；toast 非 modal 不中斷錄音 | ✅ 冒煙 |
| Task6（順延） | specs/Task6.* | 「開工實際值+1」自動吸收→屆時 v14；本 Task 不碰其檔 | 閉環後 SA 複核 |

### Backend 注意事項（SA 定案 S1–S5，詳見 impact §2）
- **S1**：`reg.update()` 失敗是 promise rejection——ES5 同步 try/catch 接不到，必須 `.catch(function(){})`。
- **S2**：pageshow/visibilitychange handler 開頭 `if (!_swReg) return;`（register resolve 前就會 fire）。
- **S4**：`hadController` 在 register **前**快照，updatefound 與 controllerchange **兩路**都用它守門（claim 在首裝也觸發 controllerchange）。
- 更新 flag 用記憶體變數，禁 localStorage。

### Frontend 注意事項（詳見 impact §5–6）
- version.js script 插所有 script 最前＋A6 註解改寫；HTML（含註解）不寫任何版號字串。
- **S6**：`#update-toast` 若 CSS 設非 none 的 display 會蓋掉 `[hidden]`——必須加 `#update-toast[hidden]{display:none}`；QA 加驗初載 toast 不可見。
- 兩元素 fixed 掛 body（section 外）；定位用 `bottom: var(--nav-h)` 起算（已含 safe-area）。

### QA 迴歸測試清單
見 impact §10（機械閘＋sw.js 三處 diff＋更新流程模擬＋首裝不彈＋冷 install 離線＋既有五分頁冒煙＋隱私三段式）。

### 新紀律（已登記 SYSTEM_MAP 人工補充區）
bump SOP 自 Task14 起＝**兩檔三行**（version.js APP_VERSION/APP_VERSION_DATE＋sw.js CACHE_VERSION），QA 每輪機械閘驗逐字元相等；Task6/Task15 起一體適用。
