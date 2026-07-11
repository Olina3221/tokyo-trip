# Task10.api.md — 行程子區塊兩層視圖 DOM 介面契約

> Backend 完成時間：Task10（R2 單日下鑽狀態機）
> Frontend 依本文件做 R1 字級與 R2 版面樣式。
> R1 字級施工必須以本文件最終 DOM 為準，不要基於舊的 `.trip-day-*` 展開模式施工。

---

## 一、視圖狀態機行為

| 狀態 | `_itinView` 值 | DOM 可見 |
|------|--------------|---------|
| 總覽層 | `'overview'` | `.trip-itin-overview` 可見，`.trip-itin-day` hidden |
| 單日層（第 N 天） | 數字 `0..N-1` | `.trip-itin-overview` hidden，`.trip-itin-day` 可見 |

- 狀態變數 `_itinView` 存 closure 記憶體，**禁 localStorage**，跨分頁切回保留。
- Init 時今日 isoDate 對上某天 → 直進該天單日層（`_itinView = dayIdx`）；對不上 → 總覽（`_itinView = 'overview'`）。
- 跨午夜不即時刷新（可接受的旅遊場景限制）。
- 單日層每次進入（換天或從總覽點入）時整段重繪（`.trip-itin-day` innerHTML 清空再填）。

---

## 二、DOM 結構

```
#trip-sec-itinerary.trip-section
│
├── .trip-itin-overview                      ← 總覽層（hidden 時隱藏）
│   ├── .trip-ov-card[data-day-idx="0"]      ← 第 0 天精簡日卡（整卡可點）
│   │   ├── .trip-ov-day-label               ← "Day 1"
│   │   ├── .trip-ov-day-date                ← "7/14（一）"（isoToDisplay 格式）
│   │   ├── .trip-ov-day-theme               ← 主題文字
│   │   └── .trip-ov-today-badge             ← "今天"（只在今天的卡出現）
│   ├── .trip-ov-card[data-day-idx="1"]
│   │   └── ...（無 .trip-ov-today-badge）
│   └── ...（共 N 張卡，現況 5 張）
│
└── .trip-itin-day                           ← 單日層（hidden 時隱藏）
    ├── .trip-day-nav                        ← 頂部導覽列（首版不 sticky）
    │   ├── button.trip-day-nav-back         ← "‹ 總覽"（點擊返回總覽）
    │   ├── .trip-day-nav-title              ← 標題區
    │   │   ├── span.trip-day-nav-label      ← "Day N"
    │   │   ├── span.trip-day-nav-sep        ← "・"（aria-hidden）
    │   │   ├── span.trip-day-nav-date       ← "M/D（週）"
    │   │   └── div.trip-day-nav-theme       ← 主題文字（有值才出現）
    │   └── .trip-day-nav-arrows             ← 前後天切換群組
    │       ├── button.trip-day-nav-prev     ← "‹ 前一天"（Day1 時 disabled）
    │       └── button.trip-day-nav-next     ← "後一天 ›"（末日時 disabled）
    └── .trip-itin-day-content               ← 時間軸內容
        ├── .trip-item                       ← 每條行程項目（非互動，無 role/aria）
        │   ├── span.trip-item-time          ← 時間
        │   ├── span.trip-item-title         ← 項目名稱
        │   └── div.trip-item-detail         ← 細節（有值才出現，直接可見，不 hidden）
        ├── .trip-item
        │   └── ...
        └── p.trip-itin-day-empty            ← "本日無排定行程"（items 空時替代）
```

---

## 三、新 class 清單（R2 新增，frontend 需要定義樣式）

### 3.1 總覽層

| Class | 元素 | 用途 | 字級建議 |
|-------|------|------|---------|
| `.trip-itin-overview` | `div` | 總覽層容器 | — |
| `.trip-ov-card` | `div` | 精簡日卡，整卡可點（觸控目標 ≥44px 由 CSS 保證） | — |
| `.trip-ov-day-label` | `div` | "Day 1"、"Day 2" 等 | `var(--fs-lg)` ★ |
| `.trip-ov-day-date` | `div` | "7/14（一）" | `var(--fs-sm)` ★ |
| `.trip-ov-day-theme` | `div` | 主題文字 | `var(--fs-sm)` ★ |
| `.trip-ov-today-badge` | `span` | "今天" badge | `var(--fs-xs)` ★ |

### 3.2 單日層

| Class | 元素 | 用途 | 字級建議 |
|-------|------|------|---------|
| `.trip-itin-day` | `div` | 單日層容器 | — |
| `.trip-day-nav` | `div` | 頂部導覽列（首版不 sticky，見 impact §3.4） | — |
| `.trip-day-nav-back` | `button` | "‹ 總覽" 返回鈕 | `var(--fs-md)` |
| `.trip-day-nav-title` | `div` | 標題區（Day N・日期 + theme） | — |
| `.trip-day-nav-label` | `span` | "Day N" | `var(--fs-xl)` ★（單日層日期大標） |
| `.trip-day-nav-sep` | `span` | "・"（aria-hidden） | 同 label 繼承 |
| `.trip-day-nav-date` | `span` | "M/D（週）" | `var(--fs-xl)` ★ |
| `.trip-day-nav-theme` | `div` | 主題（次行） | `var(--fs-sm)` |
| `.trip-day-nav-arrows` | `div` | 前後天鈕容器 | — |
| `.trip-day-nav-prev` | `button` | "‹ 前一天"（Day1 時 `disabled`） | `var(--fs-md)` |
| `.trip-day-nav-next` | `button` | "後一天 ›"（末日時 `disabled`） | `var(--fs-md)` |
| `.trip-itin-day-content` | `div` | 時間軸內容容器 | — |
| `.trip-itin-day-empty` | `p` | "本日無排定行程"（空天） | `var(--fs-sm)` |

### 3.3 沿用類（單日層時間軸重用，樣式連續性）

| Class | 用途 | 注意 |
|-------|------|------|
| `.trip-item` | 行程項目列 | 單日層為非互動，無 role/aria |
| `.trip-item-time` | 時間 | `var(--fs-sm)` ★ |
| `.trip-item-title` | 項目名稱 | `var(--fs-md)` ★ |
| `.trip-item-detail` | 細節文字 | `var(--fs-md)` ★；**直接可見（不 hidden）**，detail `\n` 已轉 `<br>` |

---

## 四、退場的舊 class（孤兒 CSS，frontend 可整條刪除或改造）

以下 class 在 R2 重構後不再由 JS 輸出：

| 舊 Class | 退場原因 |
|----------|---------|
| `.trip-day-card` | 展開/收合日卡退場 |
| `.trip-day-header` | 展開/收合日卡標題退場 |
| `.trip-day-label` | 移至 `.trip-ov-day-label` |
| `.trip-day-date` | 移至 `.trip-ov-day-date` |
| `.trip-day-theme` | 移至 `.trip-ov-day-theme` |
| `.trip-day-chevron` | 展開箭頭退場 |
| `.trip-day-body` | 展開內容容器退場 |
| `.trip-item-header` | 逐項 toggle 標題退場 |
| `.trip-item-chevron` | 逐項 toggle 箭頭退場 |
| `.trip-item-detail[hidden]` | detail 現在直接可見，不 hidden |

完整孤兒白名單見 `Task10.impact.md §5`。

---

## 五、disabled 按鈕行為

- `.trip-day-nav-prev`：Day 0（第一天）時 `button.disabled = true`，**存在但不可點（不隱藏）**。
- `.trip-day-nav-next`：最後一天（Day N-1）時 `button.disabled = true`，**存在但不可點（不隱藏）**。
- Frontend 須為 `button:disabled` 提供視覺降調樣式（如 `opacity: 0.4`）。

---

## 六、捲動行為

每次視圖切換（總覽→單日、換天、返回總覽）時，JS 執行：
```js
document.getElementById('tab-trip').scrollTop = 0;
```
`window.scrollTo` 無效（`#tab-trip` 是 `position:fixed; overflow-y:auto` 容器）。

---

## 七、飯店大字鈕（不受影響）

`App.showBigText({ ja: h.address_ja })` 只在飯店卡（`buildHotelSection`）內觸發，行程子區塊兩層均無 bigtext 觸發點，不誤觸。

---

## 八、今天判斷（單次 init）

- Init 時呼叫 `getTodayIsoDate()`（`YYYY-MM-DD`）與各天 `isoDate` 比對。
- 僅在 init 算一次，跨午夜不刷新。
- 比對失敗（isoDate 缺值、行程外）→ 落總覽，不進 Day1（舊 B8 fallback 廢止）。

---

## 九、Frontend 施工要點

1. R1 字級：以本 api.md 的最終 DOM class 為準逐條歸階，勿基於舊的 `.trip-day-*` 展開模式施工。
2. `.trip-ov-card` 觸控目標高度須 ≥44px（CSS min-height 保證）。
3. `.trip-day-nav` 首版不做 sticky（避免與 `.trip-pills` sticky 疊撞，見 impact §3.4）。
4. `.trip-import-textarea` 計算字級須 ≥16px（iOS 聚焦縮放紅線）。
5. 退場孤兒整條刪除只限 §四 清單，其他 `.trip-*` 規則整條消失＝QA FAIL。
6. `--fs-*` 變數只授權 `.trip-*` 區塊引用；在其他選擇器引用＝越界 FAIL。
