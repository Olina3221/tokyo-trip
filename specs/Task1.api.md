# Task1.api.md — app.js 對外介面契約

> 供 frontend（Task1 UI 組裝）與 Task2–6（功能模組掛載）使用。
> 定案後介面簽名不得擅自更改；需異動回報 PM 另開 Task。

---

## 五個分頁 ID 定案（A1）

| id | 中文名 | 對應 Task |
|----|--------|-----------|
| `phrases` | 常用句 | Task2 |
| `translate` | 翻譯 | Task5 |
| `camera` | 拍照 | Task6 |
| `trip` | 行程 | Task3 |
| `coupons` | 折價券 | Task4 |

**DOM 約定**（frontend 必須遵守）：
- section 容器：`id="tab-{id}"`，例 `id="tab-phrases"`
- 導覽按鈕：`data-tab="{id}"`，例 `data-tab="phrases"`
- 每個 section 就是掛載容器，Task2–6 整塊替換佔位卡內容，不要在 section 外包多餘父層

---

## App.registerTab（A1）

```js
App.registerTab(id, options);
```

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `id` | string | 是 | 分頁 id，必須是五個定案 id 之一 |
| `options.onShow` | function | 否 | 使用者切到此分頁時呼叫（**每次**切換都觸發） |

**呼叫時機**：app.js 的 `<script>` 標籤執行完畢後即可同步呼叫（進入內部佇列，DOMContentLoaded 時統一處理）。

---

## App.showTab

```js
App.showTab(id);
```

程式化切換到指定分頁。DOMContentLoaded 後可用。
一般情況下導覽列點擊已內建，功能模組需要跨頁跳轉（如「翻譯完成自動跳大字頁」）時呼叫。

---

## App.TAB_IDS

```js
App.TAB_IDS  // ['phrases', 'translate', 'camera', 'trip', 'coupons']
```

唯讀陣列，供需要遍歷分頁 id 的程式碼使用。

---

## 腳本載入順序（A6）

index.html `<body>` 末尾的腳本載入順序（**前四項位置定死，Task2–6 不得更動**）：

```html
<!-- 必須在 </body> 前，依序載入 -->
<script src="./js/config.js" onerror="window._configLoadError=true"></script>
<script src="./js/phrases.js"></script>
<script src="./js/tripdata.js"></script>
<script src="./js/app.js"></script>
<!-- Task2-6 功能模組插這裡，在 app.js 之後、</body> 之前 -->
<!-- 例：<script src="./js/api.js"></script> -->
```

**規則**：
- config.js 永遠第一，掛 `onerror` 容錯（A4）
- 資料 js（phrases.js、tripdata.js）在 app.js 之前
- app.js 在所有資料 js 之後
- **功能模組在 app.js 之後**，可直接同步呼叫 `App.registerTab()`

**功能模組呼叫範式**（Task2–6 的 js 檔，在 app.js 之後載入）：

```js
// 例：js/phrases-tab.js（Task2）
App.registerTab('phrases', {
  onShow: function () {
    // 切到常用句分頁時執行（每次切換都觸發）
    renderPhrases();
  }
});
```

---

## window.APP_CONFIG 缺席契約（A4）

- `window.APP_CONFIG` **未定義是合法狀態**（使用者未設定 config.js）。
- 任何模組存取金鑰時必須用可選鏈：`window.APP_CONFIG?.GOOGLE_API_KEY`
- 無金鑰時功能頁顯示「請設定 API 金鑰」提示，**不得** throw 或中斷其他功能頁。
- sw.js 的預快取清單不含 config.js；fetch handler 已明確對 config.js 使用 network-only（不回填快取）。

---

## localStorage 命名空間（A8）

所有 localStorage key 一律前綴 `tokyotrip.`：

| Key | 用途 | 建立者 |
|-----|------|--------|
| `tokyotrip.lastTab` | 最後選中的分頁 | app.js（Task1） |

Task4 折價券狀態等後續需持久化的數據，均沿用此前綴。

---

## sw.js 版本 bump SOP（A2）

新增或修改任何 app shell 檔案（加入 js、換圖示等）：

1. 把新檔路徑加入 `sw.js` 頂部的 `PRECACHE_URLS` 陣列（全檔唯一，只改這裡）。
2. 把 `CACHE_VERSION` 改成新版本字串（`'v1'` → `'v2'` → ...）。
3. 提交部署；使用者重新整理兩次後取得新版，舊快取名自動刪除。

**永久禁止**：`js/config.js` 不得進入 PRECACHE_URLS，也不得被動態快取回填（A3）。

---

## z-index 層級預留（A7，frontend 實作，此處存檔供 Task2+ 查閱）

- 底部導覽列：z-index: 10
- 全螢幕 overlay（Task2 大字展示、Task5/6 相機/翻譯結果層）：z-index ≥ 100
