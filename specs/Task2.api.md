# Task2.api.md — TTS / BigText / showTab wrap 介面契約

> 供 Task2 Frontend、Task5（翻譯）、Task6（OCR）使用。
> 定案後介面簽名不得擅自更改；需異動回報 PM 另開 Task。
> 所有 API 皆掛在全域 `window.App` 物件上（不引入 ES module）。

---

## App.speak（js/tts.js）

### 簽名

```js
App.speak(jaText)   // 播放日文語音
```

| 參數 | 型別 | 說明 |
|------|------|------|
| `jaText` | string | 日文字串；空字串或 falsy → no-op |

### App.speak.isAvailable

```js
App.speak.isAvailable   // Boolean
```

- 語意：`'speechSynthesis' in window`
- **不綁「找到 ja voice」**（B4）——iOS 首次 getVoices() 回空陣列是常態，不得因此 disable 播放鈕
- Task5 播放鈕依此值決定 disabled 狀態

### App.speak.cancel()

```js
App.speak.cancel()   // 取消當前語音，無回傳值
```

- 供 bigtext.js overlay 關閉時呼叫（B6）
- Task5/6 若有需要也可呼叫（例如切分頁前清音）

### 行為契約

1. **cancel-then-speak**：每次 `speak()` 前先 cancel，防連點疊音（B4）
2. **16ms 微延遲**：iOS cancel 後立即 speak 偶發無聲，內部加 16ms setTimeout
3. **utterance 參照保留**：`_currentUtterance` 持到播畢，防 GC 斷音（B4）
4. **ja voice 降級**：`getVoices()` 找第一個 lang 以 `'ja'` 開頭者；找不到仍以 `lang='ja-JP'` 嘗試（iOS 系統自選，B4）
5. **voiceschanged**：冪等 listener，不作播放前置條件
6. **失敗靜默**：`utterance.onerror` 只 `console.warn`，不彈窗，UI 保持可再點

### 使用範例

```js
// Task5 翻譯結果播音
if (App.speak.isAvailable) {
  App.speak(translatedJa);
}

// Task6 OCR 結果播音
if (App.speak.isAvailable) {
  App.speak(ocrJaText);
}
```

---

## App.showBigText（js/bigtext.js）

### 簽名

```js
App.showBigText({ ja, zh, romaji })
```

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `ja` | string | **是** | 日文；空字串或 falsy → no-op（B3） |
| `zh` | string | 否 | 中文；缺或空 → 小字區不顯示 zh 行 |
| `romaji` | string | 否 | 羅馬拼音；缺或空 → 小字區不顯示 romaji 行 |

**`zh` 與 `romaji` 皆缺（ja-only）→ `.bigtext-sub` 整段不渲染，版面置中**（B3，Task6 OCR 情境）

### overlay DOM 結構

```
div#bigtext-overlay.bigtext-overlay      ← z-index ≥100，直掛 document.body（B1）
  div.bigtext-content
    p.bigtext-ja                         ← 超大日文（給店員看的主角）
    div.bigtext-sub                      ← 僅 zh 或 romaji 有值時顯示；否則隱藏（B3）
      p.bigtext-zh                       ← 中文小字
      p.bigtext-romaji                   ← 羅馬拼音小字
  div.bigtext-controls
    button.bigtext-speak-btn             ← 播音；無 speechSynthesis 時 disabled
    button.bigtext-close-btn             ← 關閉；frontend 須保證觸控目標 ≥44px
```

### 顯隱控制（Frontend 注意）

- JS 用 **inline `style.display`** 控制 show/hide
  - 隱藏：`display: none`（inline style，蓋過 CSS）
  - 顯示：移除 inline style（CSS 的 `display` 生效）
- Frontend 在 `.bigtext-overlay` 設 `display: flex`（或 `block`）即可，JS 的 inline none 會在隱藏時覆蓋

### 掛載位置

- 直接掛 `document.body`（B1）
- Lazy create：首次呼叫 `showBigText` 時建立 DOM，之後更新內容
- 元件 id 唯一：`#bigtext-overlay`（可用於 CSS 選取）

### 捲動鎖

- overlay 元素上有 `touchmove` listener（`passive: false`，`e.preventDefault()`）
- 防 iOS 橡皮筋效應穿透到底下 section

### 行為契約

1. `ja` 空/缺 → no-op（overlay 不開，不報錯）
2. overlay 已開時再次呼叫 → 直接更新內容（不閃爍）
3. 關閉 → cancel 語音（B6，`App.speak.cancel()`）
4. 切分頁 → 自動關閉（B2，見下方 showTab wrap）
5. 無 history pushState 整合（B5）；關閉僅靠關閉鈕或切分頁

### 使用範例

```js
// Task2 phrases-tab：三欄俱全
App.showBigText({ ja: 'こんにちは', zh: '你好', romaji: 'Konnichiwa' });

// Task5 翻譯結果：有 zh
App.showBigText({ ja: '翻訳結果', zh: '翻譯結果', romaji: '' });

// Task6 OCR：只有 ja（.bigtext-sub 不渲染，版面置中）
App.showBigText({ ja: 'OCR 辨識文字' });
// or
App.showBigText({ ja: 'OCR 辨識文字', zh: undefined, romaji: undefined });
```

---

## App.showTab wrap（js/bigtext.js）

### 行為

`bigtext.js` 載入後，`App.showTab` 被替換為外掛包裝：

```js
// 等效行為（原簽名不變）
App.showTab = function(id) {
  _closeOverlay();   // overlay 未開時 no-op
  return _origShowTab(id);  // 呼叫 app.js 原函式
};
```

- **原簽名不變**：`App.showTab(id)` 仍接受一個字串 id，回傳值與原函式相同
- **初始呼叫安全**：app.js DOMContentLoaded 的 `App.showTab(initialTab)` 也走 wrap；overlay 未開 → `_closeOverlay` no-op → 行為完全不變
- **切分頁時自動關閉 overlay**（若 overlay 開著則關閉並 cancel 語音）

### Task5/6 注意

若 Task5 需「翻譯完成 → 開大字」，呼叫順序必須是：

```js
// 正確順序
App.showBigText({ ja: '...', zh: '...' });
// 不要在 showBigText 之前呼叫 showTab（showTab 會先關 overlay）
```

若需「切換到大字分頁然後顯示內容」，目前沒有「大字專屬分頁」，overlay 是全域層，不需切分頁。

---

## Frontend 需加入的 script 標籤（index.html）

在 `app.js` 之後、`</body>` 之前，依序加入：

```html
<!-- Task2 功能模組（順序定死：tts 在最前，phrases-tab 在最後）-->
<script src="./js/tts.js"></script>
<script src="./js/bigtext.js"></script>
<script src="./js/phrases-tab.js"></script>
```

**載入順序邏輯（不得更動）：**
1. `tts.js` — 定義 `App.speak`；bigtext.js 建 DOM 時需要 `App.speak.isAvailable`
2. `bigtext.js` — 定義 `App.showBigText` + wrap `App.showTab`；phrases-tab.js 呼叫 `App.showBigText`
3. `phrases-tab.js` — 呼叫 `App.registerTab`、`App.showBigText`、`App.speak`，須在兩者之後

---

## 已定案事項（B5/B6，Task5/6 繼承，不得各自修改）

| 事項 | 定案 |
|------|------|
| history 整合（B5） | **不做**；App 無 pushState，返回手勢在 standalone 模式不觸發；關閉僅靠關閉鈕＋切分頁 |
| 關 overlay 時語音（B6） | **一律 cancel**（`App.speak.cancel()`）；無論手動關或切分頁自動關 |
| Task5/6 也遵守 | Task5/6 重用 overlay 時自動繼承上述行為，不得各自加 pushState |

---

## QA 驗收重點（Backend 交 Frontend 前的技術驗證）

- `App.showBigText({ ja: 'text' })`（ja-only）：overlay 開啟、`.bigtext-sub` 不渲染、無 undefined 字樣
- `App.showBigText({ ja, zh, romaji })`：三欄俱全正常渲染
- `App.speak.isAvailable` 在無 speechSynthesis 環境為 false
- `App.showTab('translate')` 在 overlay 開啟時：overlay 自動關閉、語音 cancel、分頁正常切換
- `sw.js` CACHE_VERSION = 'v2'、PRECACHE_URLS 含 tts.js / bigtext.js / phrases-tab.js
