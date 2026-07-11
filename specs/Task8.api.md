# Task8.api.md — 常用句分類導覽介面契約

> 供 Task8 Frontend 套樣式用。
> 定案後介面簽名不得擅自更改；需異動回報 PM 另開 Task。

---

## 1. PHRASES schema 異動（js/phrases.js）

每個分類物件新增 `id` 欄位（位於 `cat` 之前）：

```js
{
  id: "transport",       // ← 新增（ASCII，穩定鍵，供 chips 與 localStorage 用）
  cat: "交通・問路",     // ← 不動
  items: [               // ← 不動
    { zh, ja, romaji },
    ...
  ]
}
```

**六個分類 id（依既有順序，不重排）：**

| id | cat（既有，不改） | items 數 |
|----|-----------------|---------|
| greetings | 問候・基本 | 8 |
| dining | 餐廳・點餐 | 9 |
| shopping | 購物・付款 | 7 |
| transport | 交通・問路 | 6 |
| hotel | 飯店・住宿 | 5 |
| emergency | 緊急・求助 | 6 |

**機械判準**（QA 執行）：
- `git diff --numstat js/phrases.js` 須恰好 `6   0`
- diff 每行僅 `id: "..."` 新增，無任何既有句子異動
- 改後 console 跑 `JSON.stringify(window.PHRASES.map(g=>({cat:g.cat,items:g.items})))` 與基線逐字元相等
- `PHRASES.length===6`，各分類 items.length=8/9/7/6/5/6

---

## 2. 分類導覽 DOM 結構（js/phrases-tab.js）

```
section#tab-phrases（既有 section，不動）
  div.phrases-chips-bar                ← chips 導覽列
    button.phrases-chip                ← 每個有句子的分類一個
    button.phrases-chip.phrases-chip-active   ← 當前選中分類（JS 加/移除 class）
  div.phrases-list-area                ← 分類切換時整塊重繪
    ul.phrases-list
      li.phrases-item
        button.phrases-item-body       ← 點擊開大字 overlay（簽名同 Task2）
          span.phrases-zh
          span.phrases-ja
          span.phrases-romaji
        button.phrases-speak-btn       ← 點擊播日文語音（簽名同 Task2）

錯誤狀態（PHRASES 缺/空）：
  section#tab-phrases
    p.phrases-error
```

**命名規範沿用** `.trip-pill` 模式（既有 pill 導覽）：

| 元素 | class | 說明 |
|------|-------|------|
| chips 容器 | `.phrases-chips-bar` | sticky 置頂、overflow-x scroll |
| 單一 chip | `.phrases-chip` | 觸控目標 ≥44px（建議 min-height 44px） |
| 選中 chip | `.phrases-chip` + `.phrases-chip-active` | JS 動態加/移除 |
| 句子列表容器 | `.phrases-list-area` | 切換分類時 innerHTML 整塊替換 |

**data 屬性：**
- `chip.getAttribute('data-cat-id')` — 分類 id 字串（JS 用於判斷 active 狀態）

**不含分類頭（`.phrases-cat`）**：單類顯示模式下移除 h2 分組頭，chips bar 即為分類指示，避免與 chips sticky 疊撞（two `top:0` 衝突）。

---

## 3. localStorage key：`tokyotrip.phrasesCat`

| 屬性 | 值 |
|------|---|
| key | `tokyotrip.phrasesCat` |
| value | 分類 `id` 字串（如 `"transport"`） |
| 讀取時機 | 首次渲染（onShow 觸發 _render） |
| 寫入時機 | 每次切換分類（包含初始化時寫入所選分類） |
| 與既有 key 的相容性 | 無衝突（既有：`tokyotrip.lastTab`、`tokyotrip.privateData`） |

**讀取邏輯（backend 已實作）：**
1. 有值且 id 存在 → 使用
2. 有值但 id 不存在（未來分類增刪）→ fallback `PHRASES[0]`
3. 無值（初次造訪）→ 預設 `transport`；transport 不存在時 fallback `PHRASES[0]`
4. localStorage 不可用（iOS 私密瀏覽）→ 靜默降級，預設 transport，不壞頁

**清除紀律**：只允許 `localStorage.removeItem('tokyotrip.phrasesCat')`，禁 `localStorage.clear()`。

---

## 4. 空分類行為定案

- 某分類 `items` 為空陣列 → **chip 不渲染**（與 Task2 skip 空分類行為對齊）
- `_renderListArea` 傳入空分類時不渲染任何句子（實際上因 chip 不建立，此路徑不觸發）

---

## 5. 分類頭（`.phrases-cat`）去留定案

**移除**：單類顯示模式下不渲染 `h2.phrases-cat` 分組頭。理由：chips bar 已清楚標示當前分類；保留分組頭需要讓其 sticky `top` 讓位給 chips bar 高度，增加 frontend 複雜度。如日後有展示需求（如在 list area 頂部顯示當前分類全名），可在 `.phrases-list-area` 內加 `h2.phrases-cat`，不影響本定案。

---

## 6. 點句 / 播音簽名（完全沿用 Task2，不動）

```js
// 點句 → App.showBigText（Task2.api.md 簽名不變）
App.showBigText({ ja: item.ja, zh: item.zh, romaji: item.romaji });

// 點播放鈕 → App.speak（Task2.api.md 簽名不變）
App.speak(item.ja);
```

切換分類後重新渲染的列表，`ttsAvailable`（`App.speak.isAvailable`）仍在渲染路徑上生效：disabled 播放鈕在切換後不會復活。

---

## 7. sw.js

```
CACHE_VERSION = 'v6'
PRECACHE_URLS = 零增刪（phrases.js / phrases-tab.js 內容變更靠 bump 生效）
```

Backend 已執行一次，**frontend 不得重複 bump**。

---

## 8. Frontend 交接指引（淺色主題，Task8 B1）

以下為 impact.md 整理的破口清單摘要，frontend 依序施工：

1. **翻 `:root` 五變數**（`--c-bg`、`--c-text`、`--c-text-muted`、`--c-divider`）+ 新增文字用深階 accent（`#4D7CF4` 當文字在淺底 AA 不過，建議 `#2E5BCC` 一帶）
2. **清主 UI 硬編碼色（impact.md §2-A，A1–A11）**：白色系 rgba 半透明 → 深色系 tint、琥珀黃 → 深琥珀、亮紅 → 深紅、深藍品牌卡（A9）二選一
3. **overlay 等值解耦（impact.md §2-B，B1–B5，7 處）**：僅允許變數 → 等值硬編碼，視覺語意不變
4. **導覽列解耦（impact.md §2-C）**：若保留深底，`--c-text-muted` 需區域性色值
5. **iOS 狀態列**：`apple-mobile-web-app-status-bar-style` 改 `default`；`theme-color` 改淺色；manifest 兩色值同步
6. **Chips 樣式建議**（參考 `.trip-pill` 既有模式）：
   - `.phrases-chips-bar`：`position: sticky; top: 0; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; z-index >= 1`
   - `.phrases-chip`：`min-height: 44px; padding: 0 16px; border-radius: pill; display: inline-flex; align-items: center`
   - `.phrases-chip-active`：明確 active 態（accent 底白字，或深色底）
   - inactive chip 底色在淺底用深色系 tint（勿沿用舊 `rgba(255,255,255,0.07)`）
