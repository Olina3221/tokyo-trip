# Task14 API 契約（Backend → Frontend 交接文件）

> 本文件定義 backend 完成後 frontend 需知道的所有契約。
> SA 定案 S1–S5 全數收錄，供 Task6 SA 複核引用。

---

## 1. js/version.js — 版本常數契約

**路徑**：`js/version.js`（新檔，自 Task14 起存在）

```js
window.APP_VERSION = 'v13';      // 格式：'vN'，必須與 sw.js CACHE_VERSION 逐字元相等
window.APP_VERSION_DATE = '07/12'; // 格式：'MM/DD'（台灣時區 bump 當天）
```

**語意與不變式**：
- `APP_VERSION` 逐字元等於 `sw.js` 的 `CACHE_VERSION`（QA 機械判準，不一致 = FAIL）。
- 兩常數為該檔唯二內容，無任何業務邏輯、DOM 操作、網路呼叫。
- 本檔無任何外部依賴，讀它的唯一消費者是 `app.js`（DOMContentLoaded 填徽章）。

**載入順序**（Task14 起定案，覆蓋 Task1 A6 舊順序）：
```
version.js → config.js (onerror) → phrases.js → tripdata.js → app.js → 功能模組（不變）
```
`version.js` 插所有 script 最前，`config.js` 之前，零依賴最安全位置。

**容錯**：
- `version.js` 404 / 載入失敗 → `window.APP_VERSION` 為 `undefined` → `app.js` 填徽章 no-op，全 App 其他功能零依賴，不壞頁。

---

## 2. js/app.js — 更新機制行為（Task14 擴充）

### 2-1. 事件時序

```
頁面載入
  │
  ├─ hadController = !!navigator.serviceWorker.controller   ← register() 前快照（S4）
  │
  DOMContentLoaded
  │
  ├─ 填 #app-version 文字（若元素存在且兩常數有值）
  ├─ 綁 #update-toast click → location.reload()（全 App 唯一 reload）
  ├─ 掛 visibilitychange（document）→ _triggerUpdate()
  ├─ 掛 pageshow（window）→ _triggerUpdate()
  ├─ 掛 controllerchange（navigator.serviceWorker）→ _showUpdateToast()  ← 路徑 A
  │
  └─ navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
        │ resolve
        ├─ _swReg = reg
        └─ watchForUpdate(reg)：updatefound → statechange('activated') → _showUpdateToast()  ← 路徑 B
```

### 2-2. 首裝守門（S4）

- `hadController` 在 `register()` **前**快照。
- 首次造訪：`navigator.serviceWorker.controller === null` → `hadController = false`。
- `_showUpdateToast()` 開頭 `if (!hadController) return;`，路徑 A 和路徑 B **兩路**皆用此守門。
- 理由：`clients.claim()` 在首裝也會觸發 `controllerchange`，守門防止首裝誤彈更新提示。

### 2-3. update() 呼叫規則（S1、S2）

- `_triggerUpdate()` 開頭 `if (!_swReg) return;`（S2：register resolve 前的 fire → no-op）。
- 呼叫形式：`_swReg.update().catch(function () {})`（S1：update 失敗是 promise rejection，ES5 同步 try/catch 接不到，必須 .catch）。
- `visibilitychange`：visible 時觸發。
- `pageshow`：每次 fire 觸發（含 bfcache restore，非 bfcache 普通載入多呼叫一次無害）。

### 2-4. 監聽掛載位置（S3）

- `visibilitychange` 掛 `document`，`pageshow` 掛 `window`。
- 全部在 `DOMContentLoaded` 內註冊一次（該段只跑一次，天然冪等）。
- 與 App 分頁框架（registerTab/showTab）零交集；未來 Task6 的 visibilitychange（camera track）是獨立 listener，互不干擾。

### 2-5. 更新 flag 規則

- `_updateShown` 為記憶體變數，**禁止持久化到 localStorage**（reload 後 flag 重算，防 flag 殘留誤判）。
- flag 設為 true 後，兩路偵測都靜默，確保提示只彈一次。

---

## 3. DOM 契約（Frontend 須建的元素）

### 3-1. 版號徽章

```html
<div id="app-version"></div>
```

- `app.js` 在 DOMContentLoaded 填文字，格式：`APP_VERSION + ' · ' + APP_VERSION_DATE`（如 `v13 · 07/12`）。
- HTML 內**不得**寫死任何版號字串（含 HTML 註解），版號唯一來源 = `js/version.js`。
- 元素缺失 → no-op，不噴錯。
- 樣式約束（frontend 施工）：fixed 定位、底部導覽列正上方右角、`font-size: 11px` 或 `12px` **硬編碼**（`--fs-*` 僅授權 `.trip-*`，Task10 紀律）、`color: var(--c-text-muted)`、`pointer-events: none`、`z-index < 100`（建議 20）、`bottom: var(--nav-h)` 起算（含 safe-area）。

### 3-2. 更新提示 Toast

```html
<button id="update-toast" hidden>有新版本，點一下更新</button>
```

- `app.js` 控制 `hidden` 屬性（`false` = 顯示），**不控制 display 樣式**。
- `app.js` 的 click handler 已綁定 `location.reload()`（全 App 唯一 reload）。
- **S6（重要）**：若 CSS 給 `#update-toast` 設了非 `none` 的 `display`（如 `display: flex`），會覆蓋 UA 的 `[hidden]` 隱藏效果，造成初載就顯示。Frontend 必須加：
  ```css
  #update-toast[hidden] { display: none; }
  ```
- 樣式約束（frontend 施工）：fixed 定位於導覽列上方、`min-height: 44px`（觸控目標）、accent 底白字醒目、`z-index < 100`（建議 30）、非 overlay 非 modal，不搶焦點不擋操作。

### 3-3. 元素放置位置

兩個元素放 `</nav>` 之後、`<script>` 區之前，不進任何 `.tab-section`（fixed 掛 body，比照 bigtext B1 紀律）。

---

## 4. sw.js bump SOP（自 Task14 起，兩檔三行）

每次改版執行以下三行：
1. `js/version.js`：`APP_VERSION = 'vN'`（與下方 CACHE_VERSION 逐字元相同）
2. `js/version.js`：`APP_VERSION_DATE = 'MM/DD'`
3. `sw.js`：`CACHE_VERSION = 'vN'`

QA 每輪機械判準：grep 兩檔取值直接比對，不一致 = FAIL 退 backend。
新增資源：另加路徑進 PRECACHE_URLS，同時 bump 以上三行。
Task6、Task15 之後所有 bump 一體適用。

---

## 5. SA 定案事項（S1–S5，供 Task6 SA 複核引用）

| 編號 | 事項 | 定案內容 |
|------|------|---------|
| S1 | update() 的錯誤處理 | `reg.update().catch(function () {})` —— 失敗為 promise rejection，ES5 try/catch 接不到 |
| S2 | update() 的 null-check | `if (!_swReg) return;` 守門，防 pageshow/visibilitychange 早於 register resolve 時的 null crash |
| S3 | 監聽掛載位置 | visibilitychange 掛 document，pageshow 掛 window，DOMContentLoaded 內各一次（天然冪等） |
| S4 | hadController 快照時機 | register() **前**快照；updatefound 路徑與 controllerchange 路徑兩路都用此值守門 |
| S5 | 新 SW install 期盲刷窗口 | cache-first 結構性成本（B3 定案不改 SWR），提示在 activate 後出現屬預期時序，QA 不得當 bug 報 |

---

## 6. Non-scope（不屬本 Task 的介面）

- 不做定時輪詢 `reg.update()`。
- 不做自動 reload（無自動 reload = 無限重整風險結構性不存在）。
- 不改 sw.js fetch 策略（cache-first 維持，S5）。
- 翻譯/對話/行程/常用句/折價券任何功能邏輯 = Non-scope，零 diff。
