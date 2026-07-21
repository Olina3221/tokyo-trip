# Task23 Backend → Frontend 介面文件

> backend 完成時間：2026-07-21
> 目標：frontend 實作 `js/shopping-tab.js`、`index.html` 購物分頁、購物頁 CSS

---

## 1. window.SHOPPING 資料 Schema

```js
window.SHOPPING = {
  rateNote: string,        // 匯率文字，常駐頁首："1¥ ≈ NT$0.18"
  categories: [
    {
      id: string,          // "drug"（藥妝）或 "gift"（伴手禮）
      name: string,        // 顯示名稱
      items: [ item ]      // 見下方 item schema
    }
  ]
}
```

### item schema（兩分類欄位差異）

| 欄位 | 必填 | 藥妝 | 伴手禮 | 說明 |
|------|------|------|--------|------|
| `id` | 必填 | `d01`–`d12` | `g01`–`g10` | 勾選持久化錨點，**不得改** |
| `name` | 必填 | v | v | 品名 |
| `star` | 選填 | 有值則為 `true` | 有值則為 `true` | ★ 額外推薦，未設即無 star |
| `desc` | 必填 | v | v | 用途/特色說明 |
| `twPrice` | 選填 | v | — | 台灣售價（含「台灣買不到」「無此款」等字面值） |
| `jpPrice` | 選填 | v | v | 日本售價（含 `/箱`、`/ 500g` 等單位） |
| `ntPrice` | 選填 | v | v | 換算 NT$（含「約270-450」等字面值） |
| `where` | 選填 | v | v | 購買地點 |
| `shelfLife` | 選填 | — | v | 保存期限 |
| `notes` | 選填 | v | v | 備註 |

**有值才渲染該列**（選填欄位若未設，展開詳情時不顯示該行）。

---

## 2. localStorage

- **key**：`tokyotrip.shoppingChecked`（`shopping-tab.js` **獨占**，不得在其他檔讀寫）
- **值**：JSON 陣列，內容 = 已勾 item 的 `id` 字串，如 `["d01","g07"]`
- **讀寫**：全包 `try/catch`；parse 失敗/非陣列 → 視同空陣列
- **重置**：`removeItem('tokyotrip.shoppingChecked')` 清記憶體 Set + 重繪；**禁用 `localStorage.clear()`**（repo 級鐵律）
- **無痕降級**：checkbox 照常渲染，勾選當次 session 有效（localStorage 寫入失敗靜默）

---

## 3. 分頁框架整合

### app.js TAB_IDS
```js
// 現況 6 id，frontend 需插入 'shopping'：
var TAB_IDS = ['phrases', 'translate', 'camera', 'trip', 'map', 'shopping', 'coupons'];
// 'shopping' 插 'map' 與 'coupons' 之間，既有六 id 順序零改動
```

### index.html nav 鈕（第 6 位，地圖與折價券之間）
```html
<button class="nav-btn" data-tab="shopping">
  <span class="nav-icon">🛒</span>
  <span class="nav-label">購物</span>
</button>
```

### index.html section
```html
<section id="tab-shopping" class="tab-section" hidden>
  <!-- DOM 由 shopping-tab.js 動態建構，section 留空 -->
</section>
```
- **位置**：`<section id="tab-map" ...>` 之後、`<section id="tab-coupons" ...>` 之前
- **`hidden` 屬性必帶**（漏帶 = 載入瞬間雙 section 同顯）

### shopping-tab.js 載入位置（index.html）
```html
<!-- 插在 map-tab.js 之後 -->
<script src="js/shoppingdata.js"></script>  <!-- 已由 backend 建立 -->
<script src="js/shopping-tab.js"></script>
```
注意：`shoppingdata.js` 已建立並進 PRECACHE，`shopping-tab.js` 路徑亦已進 PRECACHE（由 frontend 建立檔案）。

---

## 4. DOM 結構與 CSS class 命名（backend 建議，frontend 可微調，QA 依 spec B4 驗）

```
#tab-shopping
  .shopping-header          （flex-shrink:0，頁首列固定不捲動）
    .shopping-rate          匯率文字 + 圖例文字
    .shopping-summary       已買 n/22
  .shopping-list            （flex:1，min-height:0，overflow-y:auto，唯一捲動區）
    .shopping-group         各分類群組（×2）
      .shopping-group-title  ▍藥妝（已買 n/12）
      .shopping-card        卡片（×N）
        .shopping-check     勾選區（左側，≥44px 觸控目標）
          input[type=checkbox] 或 div 模擬 checkbox
        .shopping-content   內容區（右側，≥44px，點擊展開/收合）
          .shopping-name    ★ + 品名
          .shopping-price   ¥日本售價 ≈ NT$換算
          .shopping-chevron 展開 chevron（▶/▼）
          .shopping-detail  展開詳情（有值才渲染各列）
            .shopping-detail-row  （label + value 各欄）
    .shopping-clear-btn     清除全部勾選（confirm 防誤觸，位於清單底部）
  .shopping-empty           （SHOPPING 缺載時的失敗文案，取代 .shopping-list）
```

### 已買態
- 整卡 `.shopping-card` 加 class `is-checked`，CSS 降 opacity ~0.45
- **不重排、不移動位置**（清單順序 = id 順序 = Excel 順序）

### 字級硬編碼規定
**禁用 `var(--fs-*)`**——type scale 授權範圍現況僅 `.trip-*`（SYSTEM_MAP 紀律）。購物頁字級用硬編碼 px。

### Task21 CSS 陷阱（SA F3）
購物頁 CSS **必須以自己的注解頭開場**（如 `/* ── Task23 購物分頁 ── */`），否則 Task21 type-scale 判準誤紅。

---

## 5. shopping-tab.js 行為合約

```js
// 分頁註冊方式（比照 map-tab.js）
App.registerTab('shopping', {
  onShow: function () {
    if (!_initialized) { _init(); _initialized = true; }
    // onShow 冪等：重複呼叫只更新已買計數，不重建 DOM
  }
});
```

- **不 wrap showTab**（shopping 無錄音/TTS/overlay，比照 map-tab.js）
- `window.SHOPPING` 缺載/空 → 顯示 `.shopping-empty` 失敗文案，不壞頁
- 勾選真相 = 記憶體 `Set`，localStorage 為持久化後端（降級時 Set 照用）
- 資料注入一律 `textContent`（資料含 `¥`/`&`/括號等字元，防 XSS）

---

## 6. 前端冒煙判準（需在 qa_smoke_test.py 通過）

frontend 完成後，以下項目自動被 `qa_smoke_test.py` 驗收：

- T23-C1：`App.TAB_IDS` 含 `'shopping'` 且長度 7
- T23-C3：`index.html` `data-tab` 鈕恰 7 顆
- T23-C4：nav 含 `shopping` 鈕
- T23-C5：`section#tab-shopping` 存在
- T23-C6：`shopping-tab.js` localStorage key = `tokyotrip.shoppingChecked`
- T23-C6b：`shopping-tab.js` 無 `localStorage.clear()`
- T23-C7：全 repo 已知 JS 無 `localStorage.clear()`（已過）

此外，frontend 需自行做 Playwright E6 驗收：390×844 viewport 斷言——
1. `#nav-bar` `scrollWidth === clientWidth`（無水平溢出）
2. 7 顆 `.nav-btn` `offsetWidth` 全等且 ≥44
3. 各 `.nav-label` 單行未截斷（`scrollWidth <= clientWidth`）

若溢出：合法解法唯一 = 縮 `.nav-btn` 水平 padding（2px→0）；禁縮 icon/label 字級（Task11 Olina 拍板），須回報 PM。
