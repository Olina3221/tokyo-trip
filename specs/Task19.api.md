# Task19 API — 內建常用句隱藏機制（隱藏＋一鍵總還原）

## 1. App.myPhrases 新增方法（js/my-phrases.js）

### localStorage key（新增）

| Key | 值 | 說明 |
|-----|-----|------|
| `tokyotrip.hiddenPhrases` | JSON 陣列字串 | 被隱藏的內建句簽名清單，此模組獨占 |
| `tokyotrip.myPhrases` | （既有） | schema 與行為零變更（Task18 原定義） |

隱藏句簽名元素 schema：

```js
{ zh: string, ja: string }  // zh 已 trim 後存；不存 catId/ts
```

### 既有五方法（零簽名變更，Task18 原定義）

`isAvailable()` / `getAll()` / `getByCat(catId)` / `add(opts)` / `remove(zh, ja)` — 見 Task18.api.md

### 新增四方法

#### `App.myPhrases.hide(zh, ja) → boolean`

隱藏一個內建句，將 zh(trim)+ja 簽名寫入 `tokyotrip.hiddenPhrases`。

| 條件 | 回傳值 |
|------|--------|
| 成功寫入 | `true` |
| 已在清單（冪等） | `true` |
| zh 或 ja 缺／為空字串 | `false` |
| 寫入失敗（無痕/配額） | `false` |

- zh 內部做 `.trim()` 防禦（與 remove 同慣例）
- 失敗靜默容忍，不拋錯不 UI 提示

#### `App.myPhrases.isHidden(zh, ja) → boolean`

查詢一個內建句是否在隱藏清單中。

| 條件 | 回傳值 |
|------|--------|
| zh(trim)+ja 全等命中 | `true` |
| 未命中 / 壞資料 / 讀取失敗 / 缺參數 | `false` |

注意：渲染路徑（`_renderListArea`）不逐句呼叫此方法——開頭一次 `getHidden()` 後本地陣列比對。此方法供外部呼叫者與測試使用。

#### `App.myPhrases.getHidden() → Array<{zh, ja}>`

回傳隱藏簽名清單（壞資料過濾後）。失敗或無資料回 `[]`。

元素保證：`item.zh` 為非空字串（已 trim）、`item.ja` 為非空字串。

#### `App.myPhrases.unhideAll() → boolean`

清空隱藏清單。**唯一實作**：`localStorage.removeItem('tokyotrip.hiddenPhrases')`；禁 `localStorage.clear()`。

| 條件 | 回傳值 |
|------|--------|
| 成功清除 | `true` |
| 例外 | `false` |

---

## 2. phrases-tab.js `_renderListArea` 擴充（Task19）

唯一擴充函式；其餘九函式本體零 diff（`_buildMyPhraseItem`、`onShow`、`_selectCat`、`_buildShell`、`_getInitialCat`、`_saveCat`、`_findCatById`、`_updateChipsActive`、`_render`）。

### 2-1. 開頭一次讀取（禁放進迴圈）

```js
var hiddenList = (App.myPhrases && typeof App.myPhrases.getHidden === 'function')
  ? App.myPhrases.getHidden()
  : [];
var canHide = !!(App.myPhrases && typeof App.myPhrases.hide === 'function' && App.myPhrases.isAvailable());
```

- `hiddenList` 壞資料/缺載/無痕 → `[]`（內建句全顯）
- `canHide` false（缺載/無痕）→ 不渲染刪除鈕與還原鈕

### 2-2. 內建句刪除鈕（新增）

每個未被隱藏的內建句 `<li>` 末尾（`speakBtn` 之後），`canHide` 為 true 時追加：

| 項目 | 值 |
|------|-----|
| 元素 | `<button>` |
| class | `phrases-delete-btn`（沿用既有，零新 CSS） |
| aria-label | `'刪除這句常用語'` |
| 文字 | `🗑` |
| 點擊行為 | `confirm('刪除這句常用語？')` → 取消 return；確認 → `App.myPhrases.hide(item.zh, item.ja)` → `_renderListArea(_findCatById(_currentCatId))` |
| 降級 | `canHide === false`（無痕）→ 不建此元素 |

### 2-3. 一鍵總還原鈕（新增）

位置：`<ul>` append 進 `_listArea` 之後，條件渲染。

| 項目 | 值 |
|------|-----|
| 元素 | `<button>` |
| class | `phrases-restore-btn`（**唯一新 class，需 frontend 補樣式**） |
| 顯示條件 | `hiddenList.length > 0 && canHide` |
| 文字 | `還原已隱藏的常用句（N 句）`（N = `hiddenList.length`，全域計數不分類） |
| 點擊行為 | `confirm('還原所有已隱藏的常用句？')` → 確認 → `App.myPhrases.unhideAll()` → `_renderListArea(_findCatById(_currentCatId))` |

---

## 3. Frontend 待做事項（唯一）

### `.phrases-restore-btn` 樣式（spec §B5）

- 觸控目標 ≥ 44px（含 padding 撐足）
- 文字色：`var(--c-accent-text)`（`#2E5BCC`）
- 字級：**硬編碼 px/rem**，禁 `var(--fs-*)`（type scale 只授權 `.trip-*`）
- 定位：輕量文字鈕（次要視覺，描邊或純文字），置中或靠左由 frontend 定
- 不做 overlay / 動畫；無新增 z-index

內建句刪除鈕 `.phrases-delete-btn`：沿用既有樣式，**零新 CSS**。

---

## 4. 版本資訊

- sw.js CACHE_VERSION：`v19`
- js/version.js APP_VERSION：`v19`，APP_VERSION_DATE：`07/13`（同日 bump 合法，QA 不得因無 diff 判 FAIL）
- PRECACHE 筆數：42（零增減）

---

## 5. 邊界行為彙整（frontend 施工參考）

| 情境 | 行為 |
|------|------|
| 無痕 / localStorage 不可用 | 內建句全顯，不渲染刪除鈕，不渲染還原鈕，不壞頁 |
| 某分類內建句全被隱藏 + 無自訂句 | 清單區 = 空 `<ul>` + 還原鈕（只要 hiddenList.length > 0） |
| hide() 失敗（極端寫入窗口） | 靜默容忍，重繪後該句仍在，無 UI 提示 |
| unhideAll() 失敗 | 靜默容忍，重繪後原樣 |
| 壞資料注入 `tokyotrip.hiddenPhrases` | 視同無隱藏，內建句全顯，不壞頁 |
| onShow 重複呼叫 | 整塊重建（`_listArea.innerHTML = ''`）天然冪等，不疊 DOM |
