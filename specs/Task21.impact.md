# Task21 — 影響範圍分析（SA）

> 依據 `Task21.spec.md`、`SYSTEM_MAP.md`、`Task3.api.md`、`Task3.impact.md`，並**實際讀碼**核實
> （`js/trip-tab.js` 895 行全檔、`js/import-data.js` 全檔、`css/style.css` trip 區段、`js/version.js`、`sw.js`）。
> 分析日：2026-07-20。基線：v20（`version.js` / `sw.js` 兩檔已核實皆為 `'v20'`）。

## 涉及範圍標記

**backend ＋ frontend 皆涉及**（非純後端）。

- backend：`js/trip-tab.js`（additive）、`js/version.js` ＋ `sw.js` bump、`Task21.api.md`
- frontend：`css/style.css` 新增 `.trip-lodging-*` 樣式節
- `js/import-data.js`：**零 diff 已確認**（見 §1.3，C9 解除）
- `js/tripdata.js`：零 diff（硬約束）

---

## 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 重要資料區塊（本機層渲染） | `trip-tab.js` `_renderPrivateSection` / `_renderPrivateFilled` / `_renderPrivateEmpty` | 本輪**不改其本體**，但三個呼叫點各要 additive 追加一行。追加位置錯誤（放進函式內）會破壞 B6 降級路徑 | ✅ |
| 飯店區塊 | `trip-tab.js` `buildHotelSection`（L359–462） | 新增容器與渲染；**L365 早退路徑是最大陷阱**（見 §2.2） | ✅ |
| 匯入／清除／重新匯入流程 | `_buildImportArea` confirmBtn（L741–757）、clearBtn（L697–701） | 行為零變更，僅在其後追加一次渲染呼叫 | ✅ |
| 匯出功能 | `_renderPrivateFilled` exportTa（L666） | 邏輯零 diff，但匯出碼內容自本輪起**含門鎖／WiFi 密碼**（見 §1.4） | ✅ |
| `.trip-private-*` 排版（Task20 成果） | `css/style.css` L1167–1210 | **不得修改**。新區塊另立 class，但須沿用同一自適應雙模式思路（見 §4） | ✅ |
| trip 分頁 pill 導覽 | `buildPills`（L789–828） | 零 diff。pill 切換只 toggle `hidden`、不重繪——此事實是 §2 分析的關鍵前提 | ✅ |
| 行程兩層視圖狀態機（Task10） | `_switchView` / `_itinView` | 零 diff、零交互（不同 section） | 冒煙即可 |
| 離線快取 | `sw.js` / `js/version.js` | v20→v21 兩檔三行；PRECACHE 42 筆零增減 | ✅ |

---

## §1 `App.privateData` 消費者從 1 → 2：契約變更評估

### 1.1 先修正一個前提——這不是「跨 Task 共用元件」的解除

PM 在 spec §背景 2 與 INDEX 開工註記把本輪定性為「SYSTEM_MAP 第 89 行『trip 分頁專用、非跨 Task 共用元件』的語意正當擴大」。**逐字核對後，這個定性偏重了。**

SYSTEM_MAP 第 89 行原文與 `Task3.impact.md`「對 Task5/6 的前向約束」第一條的實際規範內容是兩句：

1. 「Task5/6 不消費 `App.privateData`」——本輪**完全未觸碰**。全 repo grep 確認消費者仍只有 `js/trip-tab.js` 一個檔案（`import-data.js` 為定義端，`tripdata.js` 僅註解）。
2. 「trip 分頁專用、非跨 Task 共用元件」——本輪新消費者 `buildHotelSection()` **就在 `trip-tab.js` 同一檔、同一分頁內**。「trip 分頁專用」這句依然逐字為真。

**結論：`App.privateData` 的跨 Task 契約本輪零變更，不需要「正當解除」任何東西。** SYSTEM_MAP 第 89 行不必翻轉語意，只需補述現況。這點必須說清楚，否則下游冷 context 會以為 privateData 已升格為跨 Task 共用元件，進而在別的分頁直接消費它——那才是真正的契約破口，而本輪並未授權。

### 1.2 真正的架構變化是「重繪扇出」，這才是要記進 SYSTEM_MAP 的東西

本輪真正新增的耦合是：

> 「`tokyotrip.privateData` 內容改變」→「需要重繪」的**目標從 1 個變成 2 個**，且兩個目標分屬不同 pill section、由不同函式渲染，而 repo 內**沒有任何機制**（無 observer、無 storage event、無事件匯流排）保證兩者同步。同步全靠「人工記得在每個 mutation 點都補呼叫」。

這是典型的靜默失效結構：漏掉一個呼叫點，畫面不會壞、不會報錯，只會「資料舊掉」，而且要重開 APP 才發現——正是 PM 在 §B2 抓到的那個 bug 的一般化形式。本輪 additive 修法是對的，但它把扇出從 1 拉到 2，**下一個加第三個消費者的 Task 會更容易漏**。

因此 SYSTEM_MAP 要記的不是「89 行語意擴大」，而是一條新的永續紀律（條文見 §7）。

### 1.3 是否有其他 Task 依賴「只有重要資料區塊會讀 privateData」？

**機械查核結果：無功能性依賴。**

- 全 repo `privateData` 引用點僅 14 處，全落在 `import-data.js`（定義）＋ `trip-tab.js`（消費）＋ 兩處註解。Task4/5/6/12/13/15/16/17/18/19 皆零引用，與 `Task3.impact.md` 的前向約束一致。
- `js/import-data.js` 已逐行讀完：`parseImportCode` 只做 `atob → Uint8Array → TextDecoder → JSON.parse`，**對 top-level key 無白名單、無 schema 驗證**，直接回傳整個 parse 結果。新增 `lodging` key 天然通過。
  → **spec C9 就此解除，`import-data.js` 零 diff 成立**（G1-3 可直接驗零 diff，不需白名單擴充）。

唯一沾邊的是**隱私掃描判準**（SYSTEM_MAP 第 83 行）：三段式掃描的第二段「repo 內 `TT1.` 字串 base64 解碼後再 grep」自本輪起，解碼內容多了密碼類欄位。判準本身不變，但 G5-19 的重要性提高一級——見 §6 QA 清單。

### 1.4 一個 PM 未列、但實際存在的連帶影響：匯出區

`_renderPrivateFilled` 的匯出區（L654–685）把 `getRawCode()` 原字串顯示在 `textarea` 上並提供複製。自本輪起，這段**明碼顯示的內容包含一樓門鎖密碼、房間門鎖密碼與四組 WiFi 密碼**。

- 這**不是缺陷**：本機層本來就是明文，匯出功能的用途正是轉移給家人，內容變多是預期內。
- 但有兩個實務後果需記錄：
  1. QA 若為佐證截圖匯出區畫面，該截圖即含真值——**測試一律用 TEST 假值，截圖不得使用 Olina 真碼**（G5 既有紀律的延伸）。
  2. `行前檢查清單.md` 的「重要資料匯入」節，PM 閉環時宜補一句「匯出畫面含門鎖密碼，勿於公開場合展示」。屬 PM 閉環動作，不阻擋本輪。

---

## §2 重繪時機驗證（實際讀碼，非複述 PM 結論）

### 2.1 呼叫點機械盤點

`_renderPrivateSection()` 全檔**恰 3 個 lexical 呼叫點**（grep 實證，非估計）：

| # | 行號 | 位置 | 觸發時機 |
|---|------|------|---------|
| 1 | L700 | `_renderPrivateFilled` → clearBtn click handler | 清除成功後 |
| 2 | L755 | `_buildImportArea` → confirmBtn click handler | 匯入成功後 |
| 3 | L782 | `buildImportantSection` 函式體 | init 首繪（經 L847） |

**PM 的 §B2 列了「四個時機」、§涉及範圍卻寫「三個既有重繪呼叫點」——兩者不矛盾，是 3 個 lexical 點對應 4 個 runtime 時機**：`_buildImportArea` 被實例化兩次（L557 空狀態的「匯入」、L688 已匯入狀態的「重新匯入」），所以 #2 這一個 lexical 點同時覆蓋了「首次匯入」與「重新匯入」兩個時機。PM 的定案「每一個呼叫 `_renderPrivateSection()` 的位置都要在其後追加」在機械上等價於覆蓋四個時機，**表述無誤**。backend 在 `Task21.api.md` 列行號時須列 3 個點並註明 #2 覆蓋兩時機，避免 QA 找不到第四個點而誤判缺漏。

### 2.2 有沒有 PM 遺漏的第五個路徑？——逐路徑排查結果

逐條檢查使用者指名的兩類可疑路徑，以及我自己補的三條：

| 候選路徑 | 讀碼結果 | 判定 |
|---------|---------|------|
| **localStorage 不可用的降級路徑** | `_renderPrivateSection` L524–530 在 `isAvailable()===false` 時渲染提示並 **early return**。但 PM 定案是在**函式外的呼叫點**追加，early return 影響不到追加的那一行 | ✅ PM 定案正確、天然覆蓋。**但衍生一條硬約束，見 §2.3** |
| **pill 切換（tab 切換）重繪路徑** | `buildPills` L809–822 的 click handler 只做 `s.hidden = (...)`，**無任何重繪呼叫**；`onShow` L862–867 只在 `!_initialized` 時 `init()`，之後純 no-op | ✅ **不需要第五個呼叫點**。單一 document 內資料只能經 save/clear 變動，兩者皆已覆蓋；切 pill 時資料不可能已變 |
| `App.registerTab` 的 onShow | 同上，B6 冪等設計，不重建 DOM | ✅ 無需追加 |
| 跨 context 變更（另一個 Safari 分頁改了 storage） | 全 repo **無 `storage` 事件監聽**。iOS 上 standalone APP 與 Safari 分頁本就不共用 localStorage（SYSTEM_MAP 第 104 行） | 理論缺口，實務不成立。**列為已知限制，不列入本輪範圍** |
| `_privateSectionEl` 為 null 時 | L513 有守衛；且 `buildImportantSection` 必於 init 執行，不會為 null | 無風險 |

**結論：PM 的四時機定案覆蓋完整，沒有第五個進入路徑。**

真正的風險不在「時機漏了一個」，而在**實作寫法**——有兩個會讓正確的定案落地成錯誤行為的陷阱，且現行 G 判準抓不到其中一個。

### 2.3 陷阱一（高風險）：追加位置必須在函式外，不得寫進 `_renderPrivateSection` 內

backend 極可能為了 DRY，把 `_renderLodgingBlock()` 寫進 `_renderPrivateSection()` 函式尾端——**一處改動取代三處**，看起來更乾淨。

**但這會壞掉**：L524–530 的 `isAvailable()===false` 分支在 L529 就 `return`，函式尾端的呼叫永遠執行不到。症狀＝無痕／localStorage 不可用時，民宿區塊**完全不渲染**（連 B6 第一列的降級文案都不出現），變成 spec §B6 明文禁止的「空白區塊」。

→ **硬約束（backend 必守）：`_renderLodgingBlock()` 必須在 L700 / L755 / L782 三處呼叫點之後 additive 追加，禁止寫入 `_renderPrivateSection()` 函式體內。** 已列入 QA 機械判準（§6 新增 M1）。

### 2.4 陷阱二（最高風險，且現行 G 判準抓不到）：`buildHotelSection` 的早退路徑

`buildHotelSection` L365–368：

```js
if (!data || !data.hotels || !data.hotels.length) {
  sec.innerHTML = '<p class="trip-error">飯店資料載入失敗</p>';
  return sec;
}
```

這個 early return 在**任何容器建立之前**就返回。spec §B1 要求「`buildHotelSection()` **恆建立**一個容器 `div.trip-lodging`」、§E 末條要求「`window.TRIP` 缺載時 `.trip-lodging` 容器仍須建立並正常渲染」——PM 的**要求本身正確**，但程式碼形狀與這個要求正面相衝：最自然的實作（在 `data.hotels.forEach` 迴圈之後 append 容器）會讓 TRIP 缺載時容器根本不存在，`_renderLodgingBlock()` 永久 no-op。

且此路徑**不是假想**：TRIP 缺載會發生在 `tripdata.js` 載入失敗、或 SW 快取到壞檔時；本機層與 TRIP 完全無依賴，這正是「公開資料掛了、私密入住資訊仍該看得到」最有價值的時刻——家人站在門口、網路不通、tripdata 沒載到，這時最需要門鎖密碼。

**連帶第二個陷阱**：`sec.innerHTML = '...'` 會**清空 `sec` 既有子節點**。若 backend 為求保險把容器建在函式開頭、guard 之前，這行 innerHTML 賦值會把容器直接抹掉。

→ **硬約束（backend 必守）：`.trip-lodging` 容器的建立與 append 必須在正常路徑與 `飯店資料載入失敗` 早退路徑上各自發生一次，且都必須位於任何對 `sec` 的 `innerHTML` 賦值之後。** 建議寫法：把容器建立抽成區域函式，在 guard 內 `sec.innerHTML = ...` 之後、`return sec` 之前呼叫一次，正常路徑於 forEach 之後呼叫一次。

→ **QA 缺口：現行 G 判準 1–25 完全沒有「TRIP 缺載」的測試案例**（§E 有規格、G 無對應驗證）。已補為 §6 新增 M2。

### 2.5 陷阱三（低風險，防禦性）：`import-data.js` 缺載

`_renderLodgingBlock()` 會在 `buildHotelSection`（init L846）內執行，**早於** `buildImportantSection`（L847）。若 `import-data.js` 未載入，`App.privateData` 為 undefined——原本的失敗點在重要資料區塊，本輪起會提前到飯店區塊。

影響輕微（兩者都是「js 沒載到」的災難級情境），但既然新增了一個更早的存取點，建議 `_renderLodgingBlock()` 開頭加一行 `if (!App.privateData) return;` 型防禦。**建議性質，非硬約束。**

---

## §3 CSS 命名衝突與樣式繼承

### 3.1 命名衝突：零

全 repo grep `lodging` → **僅出現在 `specs/Task21.spec.md` / `Task21.ready` / `INDEX.md`，`css/style.css` 與所有 js 皆 0 次命中**。`.trip-lodging-*` 是完全乾淨的命名空間，與 `.trip-hotel-*`（L857–937）、`.trip-private-*`（L1029–1236）零撞名。

### 3.2 意外繼承：零（已機械核實）

檢查了三類可能造成「新元素自動吃到樣式」的結構：

| 檢查項 | 結果 |
|-------|------|
| `.trip-section` 是否有後代選擇器（如 `.trip-section > div`） | **無**。L491–498 只有 `width` / `padding-bottom` / `[hidden]`，不影響子元素 |
| `#trip-sec-hotel` 是否有專屬規則 | **無命中**。全檔零次 |
| 是否有 `:last-child` / `:first-child` / 相鄰兄弟選擇器會因「在最後一張卡片後插入新兄弟」而改變既有樣式 | 全檔 `:last-child` 僅 4 處：`.trip-ov-card` / `.trip-item` / `.phrases-chip` / `.map-place-row`——**皆與飯店區塊無關**。`.trip-hotel-card` **沒有** `:last-child` 規則 |

→ **在 `#trip-sec-hotel` 內、最後一張 `.trip-hotel-card` 之後插入新元素，不會改變任何既有元素的樣式。** 這條可直接寫進 `Task21.api.md` 供 QA 免驗。

### 3.3 但有一個「刻意繼承」的決策要 frontend 拿捏：`.trip-btn`

複製鈕若沿用既有 `.trip-btn`（L941–961），會連帶吃到：`min-height:48px`、`padding:0 20px`、`font-size:var(--fs-md)`（17px）、`white-space:nowrap`、accent 實心底＋白字。

在 390px 視口下算一次寬度（`.trip-private-row` padding 16px×2 → 可用 358px）：

```
標籤(min 72) + gap(14) + 值(min 200) + 複製鈕(「複製」2 字 ≈ 34 + padding 40 = 74)
= 360 > 358
```

**每個帶複製鈕的欄位都會擠到換行**。WiFi 四組各 2 顆鈕 ＝ 8 顆 48px 實心藍鈕，加上門鎖 2 顆、地址 1–2 顆，全區塊會被按鈕撐得極長，且視覺上 11 顆同等權重的實心主鈕會蓋過內容本身。

→ **建議（frontend 定奪）：另立輕量 `.trip-lodging-copy-btn`**——`min-height:44px`（iOS 紅線下限，非 48px）、`padding:0 12px`、字級 14px、改用 `.trip-btn-map` 式的淡色 tint（`rgba(77,124,244,0.18)` ＋ `var(--c-accent-text)`）而非實心 accent。實際排版由 frontend 決定，SA 只標「沿用 `.trip-btn` 原樣會在 390px 產生大量換行與視覺過重」這個已算過的事實。

---

## §4 Task20 排版契約（SYSTEM_MAP 第 103 行）適用性裁定

### 4.1 字面上不適用，因果上完全適用

SYSTEM_MAP 第 103 行的硬約束原文限定在 **`.trip-private-*`**：「後續任何 Task 動 `.trip-private-*` 排版，必須同時用長短兩類標籤驗，不得回退成固定標籤欄寬。」

本輪新增的是 `.trip-lodging-*`，**字面上落在該條約束之外**。但該條的成因——「標籤／值來自使用者匯入資料、長度不可控，程式碼掃描看不出這條資料→排版依賴」——在本輪**成立得更強**：

- Task20 的長標籤是中文（如「MAPLEHOUSE 淺草 訂單編號」），中文**逐字皆可斷行**，天然有斷點；
- 本輪的 WiFi SSID 與密碼是**無空白的連續 ASCII**，**完全沒有自然斷點**，是比 Task20 更嚴苛的溢出來源。

→ **裁定：本輪新區塊落在第 103 行的因果範圍內，必須沿用相同的自適應雙模式排版。** 同時第 103 行的條文應由 class 專屬改寫為機制專屬（見 §7 條文），否則下一個開新 class 的 Task 會再一次合法地繞過這條教訓——這正是本輪暴露出的條文缺陷。

### 4.2 既有實作的可複製參數（已讀碼取得，frontend 直接沿用）

`.trip-private-row` 系列現況（L1167–1196）：

```
.trip-private-row       display:flex; align-items:flex-start; flex-wrap:wrap; gap:4px 14px; min-height:44px
.trip-private-row-label flex-shrink:0; width:auto; min-width:72px; max-width:100%
.trip-private-row-value flex:1; min-width:200px; word-break:break-all
```

雙模式的**觸發數學**：可用 358px；短標籤 72+14+200=286 < 358 → 同一行；標籤變長使 `label + gap + 200` 超過 358 → value 被擠到次行，形成上下堆疊。`max-width:100%` 是極長標籤的最後防線。

兩點提醒 frontend：

1. 既有用的是 **`word-break: break-all`**，spec B7-2 要求 **`overflow-wrap: anywhere`**。兩者皆可防溢出，但 `overflow-wrap:anywhere` 是**更正確的選擇**且不可換成 `break-word`——因為只有 `anywhere` 會影響 flex 容器的 min-content 計算，而本區塊的溢出正是 min-content 撐破容器造成的。spec 選對了，照做即可。
2. `min-width:200px` 是為「重要資料的值」調的。WiFi 那種「短標籤（`1F`）＋長值（SSID）＋複製鈕」的形狀比例不同，**不要無腦照抄 200px**，須自行取值並用長短兩類實測。

---

## §5 PWA 快取與版號

- 現況已核實：`js/version.js` L6/L7 ＝ `'v20'` / `'07/13'`；`sw.js` L18 ＝ `'v20'`。**兩檔逐字元相等，基線乾淨。**
- 本輪 bump **v20 → v21**，兩檔三行（`APP_VERSION` ＋ `APP_VERSION_DATE` ＋ `CACHE_VERSION`）。`APP_VERSION_DATE` 填 bump 當天台灣時區日期（若當日執行即 `'07/20'`，以實際 bump 日為準）。
- `PRECACHE_URLS` **42 筆零增減**——本輪無新檔（`.trip-lodging-*` 進既有 `style.css`，渲染邏輯進既有 `trip-tab.js`）。
- **必要性說明**：本輪改的是 `trip-tab.js` ＋ `style.css` 兩個既有 precache 檔，檔名不變。依 SYSTEM_MAP 第 72 行，cache-first 會吃住舊檔，不 bump 的症狀是「改了沒生效」且**頁面不壞、症狀隱蔽**。bump 非可選。
- 載入順序零變更、`App.showTab` wrap 鏈維持四層（本輪不 wrap，無資源需清理）。
- 零新增 localStorage key（沿用 `tokyotrip.privateData`）。

---

## §6 QA 迴歸測試清單

### 既有功能迴歸（本輪不得破壞）

- [ ] 重要資料區塊：用 `Task3.api.md` §3 既有測試碼匯入，四小節顯示與 v20 完全一致（G1-1）
- [ ] 重要資料：匯入 → 清除 → 重新匯入三流程行為零變更
- [ ] 匯出區：`getRawCode` 原碼正確顯示、複製鈕正常
- [ ] `.trip-private-row` 長短兩類標籤排版仍為 Task20 雙模式（**不得因新增樣式節而回歸**）
- [ ] 飯店卡 MAPLEHOUSE：三顆鈕（複製地址／開地圖／大字給司機看）行為零 diff
- [ ] 行程兩層視圖狀態機（Task10）、pill 導覽四區塊切換正常
- [ ] 六分頁全開；常用句／翻譯（文字＋對話）／拍照／地圖／折價券零 diff（G6-24）
- [ ] `bigtext.js` / `tts.js` / `api.js` / `my-phrases.js` / `phrases-tab.js` / `translate-tab.js` / `map-tab.js` / `camera-tab.js` / `coupons-tab.js` 全檔零 diff（G6-25）
- [ ] `js/tripdata.js` 全檔零 diff（G1-2）
- [ ] `js/import-data.js` 全檔零 diff（G1-3；SA 已確認無白名單，應為單純零 diff）

### 新功能驗收

依 spec §G 判準 1–25 全數執行。以下為 **SA 新增的機械判準**，補現行 G 系列的缺口：

- [ ] **M1（補 §2.3）**：`_renderLodgingBlock()` 的呼叫**必須恰為 3 處**，且皆位於 `_renderPrivateSection()` 呼叫點**之後的同層**（L700／L755／L782 對應位置）。機械判準：`_renderPrivateSection` 函式體（L512–541）內 `_renderLodgingBlock` 出現次數 **= 0**。
- [ ] **M2（補 §2.4，現行 G 完全缺此案例）**：以 `window.TRIP = undefined`（或 `{}`）模擬 tripdata 缺載 → 飯店區塊顯示「飯店資料載入失敗」，**且 `.trip-lodging` 容器仍存在於 DOM 中並正常渲染 B6 提示或已匯入內容**；零 console error。
- [ ] **M3（補 §2.3 降級路徑）**：stub `App.privateData.isAvailable()` 回 `false` → 重要資料區塊顯示既有降級文案，**且民宿區塊顯示 B6 第一列文案（非空白）**、不渲染任何複製鈕。
- [ ] **M4（補 §2.1）**：backend 於 `Task21.api.md` 列出的呼叫點行號須為 **3 個**並註明 `_buildImportArea` 該點覆蓋「首次匯入」與「重新匯入」兩時機——QA 不得因找不到「第四個呼叫點」而判缺漏。
- [ ] **M5（補 §3.2）**：`.trip-hotel-card` 無 `:last-child` 規則，新元素插入後既有飯店卡樣式零變化（目視 + 對照 v20 截圖）。

### 排版重點（SYSTEM_MAP 第 103 行，本輪最高風險區）

- [ ] 長字串注入（SSID 40 字元**無空白**、密碼 32 字元無空白、須知單條 100 字中文、英文地址 80 字元、民宿名 30 字元）於 390px：`scrollWidth <= 390`、標籤與值 boundingRect 零交疊、複製鈕完整可見且 ≥44px（G4-14）
- [ ] 短字串（`1F` / `15:00`）同一組 class 下排版正常——**長短必須同驗**（G4-15）
- [ ] 測試資料測畢清除（G4-17）

### 隱私（每輪必做，本輪權重提高）

- [ ] 工作樹 grep 無真實密碼／門鎖碼／WiFi 密碼／房東電話（G5-18）
- [ ] **repo 內所有 `TT1.` 字串 base64 解碼後再 grep**，解碼結果須全為 TEST 假值（G5-19；本輪解碼內容含密碼欄位，此段為最關鍵一段）
- [ ] `git log -p` 掃本輪 commit 無真值（G5-20）
- [ ] `js/tripdata.js` 內無任何密碼／門鎖碼／WiFi 欄位（G5-21）
- [ ] QA 佐證截圖不得使用 Olina 真實匯入碼（含匯出區畫面，見 §1.4）

### 版本

- [ ] `APP_VERSION` 與 `CACHE_VERSION` 逐字元相等且 = `'v21'`；`APP_VERSION_DATE` 為 bump 當天（G6-22）
- [ ] `PRECACHE_URLS` 42 筆零增減（G6-23）

---

## §7 SYSTEM_MAP 更新項（SA 已同步寫入人工補充區）

1. **第 89 行 `App.privateData` 條**：改為記錄現況——消費者仍只有 `trip-tab.js` 一個檔案，「trip 分頁專用、非跨 Task 共用元件」**維持有效未解除**；Task21 起變化為「trip 分頁**內**兩個區塊消費」。明確標注「其他分頁仍不得消費」，防冷 context 誤讀為已升格。
2. **新增條目：privateData 重繪扇出紀律（Task21 SA 起）**——記錄 mutation 點（save/clear）與渲染目標（`_renderPrivateSection` / `_renderLodgingBlock`）的多對多關係、無自動同步機制、以及三個呼叫點的位置約束（函式外、非函式內）。
3. **第 103 行 Task20 條**：由 `.trip-private-*` class 專屬改寫為機制專屬——「任何標籤或值來自匯入資料的 row 式排版」皆受約束，並補記本輪的無空白 ASCII 更嚴苛特性。

---

## §8 Backend 注意事項

1. **硬約束（§2.3）**：`_renderLodgingBlock()` 追加在 **L700／L755／L782 三處呼叫點之後**，**禁止**寫入 `_renderPrivateSection()` 函式體內（會被 L529 early return 跳過，破壞降級路徑）。
2. **硬約束（§2.4）**：`.trip-lodging` 容器在 `buildHotelSection` 的**正常路徑與 L365 早退路徑上各建立一次**，且**必須位於任何 `sec.innerHTML = ...` 賦值之後**（innerHTML 會清空既有子節點）。
3. `import-data.js` **零 diff 已由 SA 核實**（無 top-level key 白名單），C9 解除；backend 仍可自行複核一次，不需改動。
4. `_renderLodgingBlock()` **每次清空整塊重建**（`innerHTML = ''` 後重建），天然冪等，禁局部 patch。
5. 全部值用 `textContent` 寫入（或既有 `escHtml`）；`selfCheckin` 的 `\n` 交由 CSS `white-space: pre-wrap` 處理，**不要用 `innerHTML` + `<br>` 替換**（既有 `_renderDayContent` L213 用了 innerHTML+br，但那是 escHtml 過的既有寫法，新程式碼走 textContent 更安全）。
6. 型別防禦逐條對齊 spec §A3／§E：`lodging` 非物件、`wifi`/`notes`/`hostContacts` 非陣列、空陣列、單欄缺失，皆不得 throw。
7. `addressZh` 去重比對（§A4）：與 `window.TRIP.hotels[0].address_zh` 做 **trim 後字串比對**；TRIP 缺載時**不比對、直接渲染**（此路徑與 §2.4 的早退路徑會同時發生，須一併測）。
8. 建議加 `if (!App.privateData) return;` 防禦（§2.5，非硬約束）。
9. 重用既有 `copyToClipboard(text, onOk, onFail)`（L43）與 `showTip(el, msg)`（L64），**不新造機制**；回饋文案逐字沿用 `已複製！` / `請手動長按複製`。注意 `showTip` 用 `el.parentNode.insertBefore`，複製鈕**必須有 parentNode**（不可為容器根元素）。
10. bump v20→v21 兩檔三行；PRECACHE 42 筆零增減。
11. **`Task21.api.md` 必寫**：`lodging` schema 權威副本（全 TEST 假值）、`.trip-lodging-*` DOM 結構與 class 名、`_renderLodgingBlock()` 三個呼叫點行號＋註明 #2 覆蓋兩時機、以及「`.trip-hotel-card` 無 `:last-child` 規則、插入新兄弟安全」這條供 frontend/QA 免驗。

## §9 Frontend 注意事項

1. **新增 class 一律 `.trip-lodging-*` 前綴**；命名空間已確認乾淨（§3.1），無撞名風險。
2. **禁止修改 `.trip-private-*` 與 `.trip-hotel-*` 任何既有規則**（Task20 成果 ＋ 飯店卡淺色化成果）。
3. **排版沿用 Task20 自適應雙模式**（§4.2 已提供可複製參數）：標籤欄 `width:auto` + `min-width` + `max-width:100%` + `flex-shrink:0`，容器 `flex-wrap:wrap`；**嚴禁固定 `width` + `flex-shrink:0` 的舊模式**。
4. 值欄位設 **`overflow-wrap: anywhere`**（不可用 `break-word`，理由見 §4.2-1）。
5. `min-width` 的門檻值**不要照抄 200px**，WiFi 行的形狀比例不同，自行取值並長短同驗（§4.2-2）。
6. **複製鈕建議另立輕量 class**，不沿用 `.trip-btn` 原樣——已算出 390px 下會全面換行且視覺過重（§3.3 有完整算式與建議參數）。觸控目標仍須 ≥44px。
7. `selfCheckin` 段落設 `white-space: pre-wrap`。
8. 不新增 `z-index >= 100`；文字色遵 `--c-text` / `--c-text-muted`，accent 當文字用一律 `--c-accent-text`（#2E5BCC）。
9. **字級：見 §10 的 SA 裁定**（本輪由 SA 裁定改為可用 type scale 變數，與 spec B7-4 原文相反，請以此為準）。
10. `.trip-lodging-title` 若要對齊 `.trip-section-title` 的視覺語言，對應階為 **lg = 19px**。

---

## §10 SA 裁定：字級是否納入 type scale（PM 於 spec B7-4 明文授權 SA 判定）

spec B7-4 要求 `.trip-lodging-*` 硬編碼字級、禁 `var(--fs-*)`，G4-16 據此設「`var(--fs-` 出現次數 = 0」的機械判準；PM 同時註明「**SA 若判定應納入 type scale，於 impact 提出**」。此為 PM 明示委派，SA 裁定如下。

**裁定：`.trip-lodging-*` 應使用 type scale 變數 `var(--fs-*)`，B7-4 第 4 點與 G4-16 由本裁定取代。**

理由三條：

1. **SYSTEM_MAP 第 94 行的機械判準本身就允許。** 原文：「`var(--fs-` 出現在**非 `.trip-*` 規則**＝越界」。`.trip-lodging-*` 就是 `.trip-*` 規則，**使用變數不構成越界**。B7-4 是比 SYSTEM_MAP 更嚴的自訂規則，並非既有紀律的要求。
2. **歷次硬編碼的理由在本輪不成立。** Task5/6/12/15/17 硬編碼是因為那些是**尚未字級收斂的獨立新分頁**（translate/camera/map）。本輪不是新分頁——它是**已完成收斂的 trip 分頁內部**、與 `.trip-hotel-*`（同一 section 內、上下相鄰）並排的新內容。
3. **硬編碼在此處會製造未來的靜默不一致。** 民宿區塊與 MAPLEHOUSE 卡片在**同一個捲動畫面內上下相鄰**。若上方卡片吃 `--fs-*`、下方民宿區塊硬編碼，未來任何調整 type scale 的 Task 會讓上半縮放、下半不動，在同一畫面產生字級斷層，且沒有任何機械判準抓得到。

附帶好處：§3.3 建議的複製鈕若沿用或參考 `.trip-btn`（其本身即用 `var(--fs-md)`），在原 B7-4 下會產生「重用既有 class 就技術性違規」的判準灰區，本裁定一併消除。

**對 QA 的明確指示：G4-16（`var(--fs-` 出現次數 = 0）本輪不執行，已由本裁定作廢。** 改驗：`.trip-lodging-*` 規則使用的字級變數限於既有五階 `--fs-xl/lg/md/sm/xs`，不得自創新變數。

**PM 可否決權**：此為 PM 委派範圍內的裁定，SA 直接定案不阻擋 backend 開工；PM 若不同意，於閉環前一句話推翻即可，frontend 改回硬編碼的成本是數行 CSS。

---

## §11 給 PM 的回報事項（不阻擋開工）

1. **spec 定性建議修正（§1.1）**：「`App.privateData` 由 trip 分頁專用擴大為跨 Task 共用」的表述偏重——本輪消費者仍全在 `trip-tab.js` 內，跨 Task 契約零變更、無須解除。SYSTEM_MAP 第 89 行 SA 已按實況更新，未做語意翻轉。建議 INDEX 開工註記的對應措辭同步緩和，避免下游誤以為已授權其他分頁消費。
2. **`行前檢查清單.md` 補充（§1.4）**：匯出畫面自本輪起含門鎖與 WiFi 密碼明文，建議閉環時於「重要資料匯入」節補一句勿於公開場合展示。
3. **§10 字級裁定**：已依 PM 授權定案為「使用 type scale」，G4-16 作廢。若不同意請直接推翻。
4. **無實質錯誤需停工**：PM 的 §B2 重繪定案經逐路徑讀碼驗證**完整正確、無遺漏的第五個路徑**；本輪風險集中在實作寫法（§2.3／§2.4）與 QA 判準缺口（M1–M5），皆已補齊，**backend 可依 `Task21.sa_done` 開工**。
