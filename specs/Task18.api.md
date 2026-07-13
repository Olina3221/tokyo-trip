# Task18 API — 文字翻譯加入常用語

## 1. App.myPhrases（js/my-phrases.js）

### 掛載時機
`App.myPhrases` 由 `my-phrases.js` 同步賦值，在 `bigtext.js` 之後、`phrases-tab.js` 之前載入，
兩個消費者（`phrases-tab.js`、`translate-tab.js`）皆可同步呼叫，無需等待。

### localStorage key
- **`tokyotrip.myPhrases`**（此模組獨占，其餘模組禁止讀寫此 key）
- 禁止呼叫 `localStorage.clear()`（repo 全局鐵則）

### Schema（每筆記錄）
```js
{
  zh:     string,   // 中文原文（已 trim）
  ja:     string,   // 日文譯文
  romaji: '',       // 固定空字串（版本預留，勿期待有值）
  catId:  string,   // 分類 ID（六個合法值之一）
  ts:     number    // Date.now() 整數時戳
}
```

### 合法 catId 白名單
`greetings` / `dining` / `shopping` / `transport` / `hotel` / `emergency`

### 方法簽名

#### `App.myPhrases.isAvailable() → boolean`
檢查 localStorage 是否可用（setItem `_tt_test` 測試手法）。
大部分場景不需要手動呼叫，`add/getByCat` 等讀寫內部已含 try/catch 降級。

#### `App.myPhrases.getAll() → Array<item>`
回傳所有自訂句（壞資料過濾後），新→舊排序（unshift 順序）。
無資料或解析失敗回 `[]`。

#### `App.myPhrases.getByCat(catId) → Array<item>`
回傳指定分類的自訂句（新→舊）。
catId 非合法值回 `[]`；無資料或解析失敗回 `[]`。

#### `App.myPhrases.add(opts) → {ok, duplicate?}`
| 回傳值 | 含義 |
|--------|------|
| `{ok: true}` | 成功新增 |
| `{ok: true, duplicate: true}` | zh(trim)+ja 雙欄已存在（跨分類也算重複），不寫入不搬家 |
| `{ok: false}` | 參數缺失 / zh 或 ja 為空 / catId 非法 / 寫入失敗 |

opts 結構：
```js
{ zh: string, ja: string, catId: string }
```
- `zh` 會在內部 `.trim()` 後比對與儲存
- 新記錄 `unshift`（排在最前）
- `romaji` 固定存 `''`，`ts` 固定存 `Date.now()`

#### `App.myPhrases.remove(zh, ja) → boolean`
刪除第一筆 `zh.trim() === zh.trim() && ja === ja` 的記錄。
找到並刪除回 `true`，未找到回 `false`，例外回 `false`。

---

## 2. translate-tab.js 新增 DOM / Class

### 2-1. 加入鈕（第 4 顆 Action Button）

| 項目 | 值 |
|------|-----|
| 元素 | `<button>` |
| class | `translate-action-btn translate-addphrase-btn` |
| 顯示條件 | 同大字鈕與播音鈕——zh2ja 結果存在時顯示，無結果時 `display:none` |
| 初始文字 | `加入常用語` |
| 點擊行為 | 展開/收合 `.translate-cat-pick`（toggle）；連續點同一個方向各收合一次 |
| 成功回饋 | `加入常用語` → 分類名稱（例：`已加入 餐廳・點餐`）持續 1.5 s 後復原；duplicate 路徑也同樣回饋並收合 |
| 自動收合觸發點 | 切分頁（showTab wrap D）/ 切模式（_switchMode E）/ 新翻譯（clearResultArea C）|

### 2-2. 分類選擇列

| 項目 | 值 |
|------|-----|
| 元素 | `<div>` |
| class | `translate-cat-pick` |
| 掛載位置 | `resultArea`（與 `resultActions` 同層，在其後）|
| 初始狀態 | `display: none` |
| 子元素 | 六個 chip `<button>`，class `translate-catpick-chip` |

### 2-3. Chip 按鈕

| 項目 | 值 |
|------|-----|
| 元素 | `<button>` |
| class | `translate-catpick-chip` |
| data 屬性 | `data-cat-id="<catId>"` |
| 選中狀態 class | `translate-catpick-chip-highlight`（加在當前 `_lastCatId` 對應的 chip 上）|
| 六個 catId / 標籤對應 | 見下表 |

分類順序與顯示標籤：

| catId | 顯示標籤 |
|-------|---------|
| `greetings` | 溝通・語言 |
| `dining` | 餐廳・點餐 |
| `shopping` | 購物・付款 |
| `transport` | 交通・問路 |
| `hotel` | 飯店・住宿 |
| `emergency` | 緊急・求助 |

### 2-4. Document click 收合守門
`_catPickDocListener` 守門邏輯：
```js
if (catPick.contains(ev.target) || addPhraseBtn.contains(ev.target)) return;
_collapseCatPicker();
```
展開時 addPhraseBtn click 有 `stopPropagation()`，不會觸發文件監聽器。

---

## 3. phrases-tab.js 新增 DOM / Class

### 3-1. 自訂句列表項

| 項目 | 值 |
|------|-----|
| 元素 | `<li>` |
| class | `phrases-item phrases-item-mine` |
| 出現位置 | 各分類列表最前面（內建句之前），`getByCat(group.id)` 回傳陣列依序插入 |

### 3-2. 主體按鈕（點擊開大字）

| 項目 | 值 |
|------|-----|
| 元素 | `<button>` |
| class | `phrases-item-body` |
| 子元素 1 | `<span class="phrases-mine-label">自訂</span>`（辨識用標籤）|
| 子元素 2 | zh span（`class="phrases-item-zh"`）|
| 子元素 3 | ja span（`class="phrases-item-ja"`）|
| 子元素 4 | romaji span（`class="phrases-item-romaji"`，值為 `''`，可能為空）|
| 點擊行為 | `App.showBigText({ ja: item.ja, zh: item.zh })` |

### 3-3. 播放鈕

| 項目 | 值 |
|------|-----|
| 元素 | `<button>` |
| class | `phrases-speak-btn` |
| 行為 | 比照內建句：`ttsAvailable` 為 false 時不掛 handler 且有視覺降級（與現有 phrases-speak-btn 一致）|

### 3-4. 刪除鈕

| 項目 | 值 |
|------|-----|
| 元素 | `<button>` |
| class | `phrases-delete-btn` |
| 文字 | `🗑` |
| 點擊行為 | `confirm('刪除這句常用語？')` → 取消則 return；確認則 `App.myPhrases.remove(item.zh, item.ja)` → 直達 `_renderListArea` 重繪當前分類 |
| 防注入 | 所有文字均用 `textContent` 設值 |

---

## 4. Frontend 待做事項

### 4-1. CSS（全部 Non-scope for Backend）
Backend 不寫 CSS，以下樣式需 frontend 補足：

**translate-tab 相關：**
- `.translate-addphrase-btn`：第 4 顆 action 按鈕外觀（與 `.translate-action-btn` 其他三顆協調，不得使用 `--fs-*` 變數）
- `.translate-cat-pick`：選擇列容器（例：flex wrap、padding、背景、圓角）
- `.translate-catpick-chip`：chip 按鈕外觀（字型、padding、圓角、邊框）
- `.translate-catpick-chip-highlight`：當前選中分類的高亮狀態

**phrases-tab 相關：**
- `.phrases-item-mine`：自訂句項目的容器（與 `.phrases-item` 基礎外觀相同，可能加左邊框或背景色以區分）
- `.phrases-mine-label`：「自訂」標籤 badge 外觀（例：小圓角、淺色背景）
- `.phrases-delete-btn`：刪除按鈕外觀（建議右側對齊、trash icon 大小）

**CSS 規範提醒：**
- 禁止使用 `--fs-*` CSS 變數（全 repo 限制，font size 用硬碼 px/rem）
- 樣式應跟隨現有 `.trip-*` / `.phrases-*` / `.translate-*` 選擇器命名風格

### 4-2. index.html 腳本順序（已由 Backend 完成，勿更動）
```html
<script src="./js/bigtext.js"></script>
<!-- Task18: my-phrases.js 在 bigtext.js 之後、phrases-tab.js 之前 -->
<script src="./js/my-phrases.js"></script>
<script src="./js/phrases-tab.js"></script>
```
`my-phrases.js` 必須在 `phrases-tab.js` **和** `translate-tab.js` 兩者之前（index.html 中 `translate-tab.js` 在更後面，已滿足）。

---

## 5. 版本資訊
- sw.js CACHE_VERSION：`v18`
- js/version.js APP_VERSION：`v18`，APP_VERSION_DATE：`07/13`
- PRECACHE 筆數：42（新增 `./js/my-phrases.js`）
