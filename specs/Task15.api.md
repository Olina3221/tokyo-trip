# Task15.api.md — 面對面對話 UI DOM/class 契約

> Task15 Backend 交 Frontend 的介面說明。
> Task12.api.md 外殼與 wrap 鏈契約仍有效；本檔為 Task15 對話 DOM 大改後的唯一權威。

---

## 1. 對話模式完整 DOM 樹（.talk-container 以下）

```
div.talk-container                        ← Task12 外殼建立，對話模式根容器
  div.talk-side.talk-side-ja              ← 上半（日方）；CSS: transform:rotate(180deg)
    div.talk-side-lang                    ←   語言標示（文字：「日本語」）
    div.talk-side-orig                    ←   辨識原文小字（前綴「認識：」）；初始空
    div.talk-side-result                  ←   譯文大字槽（overflow-y:auto）；初始空
    div.talk-side-status                  ←   狀態列（初始：「マイクを押して話してください」）
    div.talk-side-actions                 ←   動作鈕容器
      button.talk-side-speak              ←     🔊 再生（初始 disabled）
      button.talk-side-bigtext            ←     ⤢ 大きく（初始 disabled）
    button.talk-side-mic                  ←   麥克風鈕（初始：「🎤 タップして話す」）
  div.talk-divider                        ← 中央分隔帶（含文字「⇄」）
  div.talk-side.talk-side-zh             ← 下半（Olina，正向；無 rotate）
    div.talk-side-lang                    ←   語言標示（文字：「中文」）
    div.talk-side-orig                    ←   辨識原文小字（前綴「辨識：」）；初始空
    div.talk-side-result                  ←   譯文大字槽（overflow-y:auto）；初始空
    div.talk-side-status                  ←   狀態列（初始：「按下麥克風開始說話」）
    div.talk-side-actions                 ←   動作鈕容器
      button.talk-side-speak              ←     🔊 重播（初始 disabled）
      button.talk-side-bigtext            ←     ⤢ 大字（初始 disabled）
    button.talk-side-mic                  ←   麥克風鈕（初始：「🎤 點我說中文」）
```

### 旋轉說明

- `transform:rotate(180deg)` **只打在 `.talk-side-ja` 整個容器**，其內所有子元素自動繼承，不逐元素旋轉。
- `.talk-side-zh` 無任何 rotate。
- 容器內禁 `position:fixed`（transform 建立 containing block，fixed 後代會相對容器定位）。

---

## 2. 各槽語意與顯示路由

| 槽 | 寫入時機 | 寫入內容 |
|---|---|---|
| `.talk-side-zh .talk-side-orig` | Olina（zh）說完 STT 成功時 | 「辨識：＋中文原文」 |
| `.talk-side-ja .talk-side-result` | zh→ja 翻譯成功時 | 日文譯文（大字） |
| `.talk-side-ja .talk-side-orig` | 日方（ja）說完 STT 成功時 | 「認識：＋日文原文」 |
| `.talk-side-zh .talk-side-result` | ja→zh 翻譯成功時 | 中文譯文（大字） |

**覆蓋式更新**：每輪新結果直接覆寫該槽 `textContent`；不累積 DOM 節點；新一輪錄音開始前保留前值（不清空）。覆寫時 `scrollTop = 0`。

---

## 3. 動作鈕 disabled 規則

| 狀態 | disabled 值 |
|---|---|
| 無結果（初始 / 尚無任何成功翻譯） | `true`（disabled） |
| 有結果（至少一次成功翻譯後） | `false`（enabled） |

- `disabled` 而非 `hidden`（版面穩定，避免 layout jump）。
- 事件處理器內部額外守門 `_talkState !== 'idle'`：enabled 狀態下非 idle 時點擊亦無動作。

---

## 4. 動作鈕呼叫參數（Task12.api.md 契約延伸）

### ja 側（上半，旋轉側）

```js
// 🔊 再生
App.speak(_side.ja.result, 'ja-JP');

// ⤢ 大きく — ja 側存 origZh（zh 說話的原文），供雙語大字
App.showBigText({ ja: _side.ja.result, zh: _side.ja.origZh });
```

### zh 側（下半，正向）

```js
// 🔊 重播
App.speak(_side.zh.result, 'zh-TW');

// ⤢ 大字 — zh 側大字：ja 槽放中文（歷史命名），lang = zh-TW
App.showBigText({ ja: _side.zh.result, lang: 'zh-TW' });
```

---

## 5. 狀態機文案表（`_updateTalkUI` 驅動，frontend 不需產生）

| 側 | 狀態 | 狀態列文案 | 麥克風鈕文案 |
|---|---|---|---|
| zh | idle | 按下麥克風開始說話 | 🎤 點我說中文 |
| zh | zh 錄音中 | 🔴 錄音中…說完再按一次 | ■ 停止 (+.talk-mic-active) |
| zh | zh 辨識中 | 辨識中… | 🎤 點我說中文 (disabled) |
| zh | zh 翻譯中 | 翻譯中… | 🎤 點我說中文 (disabled) |
| zh | ja 錄音/辨識/翻譯中 | 按下麥克風開始說話 | disabled |
| ja | idle | マイクを押して話してください | 🎤 タップして話す |
| ja | ja 錄音中 | 🔴 録音中…もう一度押すと停止 | ■ ストップ (+.talk-mic-active) |
| ja | ja 辨識中 | 認識中… | 🎤 タップして話す (disabled) |
| ja | ja 翻譯中 | 翻訳中… | 🎤 タップして話す (disabled) |
| ja | zh 錄音/辨識/翻譯中 | マイクを押して話してください | disabled |

---

## 6. 錯誤路由

| 錯誤點 | zh 側狀態列 | ja 側狀態列 |
|---|---|---|
| 空辨識（zh 說話） | 沒有聽清楚，請再說一次 | 維持前值 |
| 空辨識（ja 說話） | 維持前值 | 聞き取れませんでした。もう一度お願いします |
| STT API 錯誤 | TALK_ERROR_MSG[code] | 由 `_updateTalkUI()` 復位 idle 文案 |
| translate API 錯誤 | TALK_ERROR_MSG[code]＋「（辨識到：原文）」 | 由 `_updateTalkUI()` 復位 idle 文案 |
| recorder start/stop 錯誤 | TALK_ERROR_MSG[code] | 由 `_updateTalkUI()` 復位 idle 文案 |
| NOT_SUPPORTED（初始） | 此瀏覽器不支援錄音，請改用文字模式 | マイクを押して話してください |

錯誤時兩側麥克風鈕 disabled（由 `_updateTalkUI()` 設回 idle 狀態後，狀態列再由 `_setSideStatus` 覆寫錯誤訊息）。

---

## 7. 退場孤兒清單（frontend CSS 須刪除）

以下舊 class 在 Task15 js 中**不再產生**，style.css 對應規則屬孤兒，一併刪除：

| 孤兒 class／選擇器 | 舊行號（style.css） |
|---|---|
| `.talk-lang-bar` | 1933–1945 |
| `.talk-history` | 1949–1959 |
| `.talk-bubble` | 1963–1972 |
| `.talk-zh2ja` / `.talk-ja2zh` | 1975–1990 |
| `.talk-bubble-orig` / `.talk-bubble-trans` | 1993–2004 |
| `.talk-bubble-actions` | 2008–2013 |
| `.talk-bubble-speak` / `.talk-bubble-bigtext`（含 :active 變體） | 2016–2055 |
| `.talk-status` / `.talk-status-idle` / `.talk-status-processing` | 2059–2079 |
| `.talk-status-recording` | 2103–2108 |
| `.talk-mic-row` | 2112–2117 |
| `.talk-mic-zh` / `.talk-mic-ja`（含 :active/:disabled/.talk-mic-active 變體） | 2120–2170 |

**保留重用**：
- `.talk-container`（1923–1929）保留
- `@keyframes talk-recording-blink`（2086–2089）保留重用
- `@keyframes talk-mic-ripple`（2091–2100）保留重用
- `.talk-mic-active` class 名保留（JS 仍 toggle），但舊規則刪除，frontend 對 `.talk-side-mic.talk-mic-active` 重寫

---

## 8. Frontend CSS 施工要點

- `.talk-container`：`flex:1; min-height:0; display:flex; flex-direction:column`（貼合 section 高度）。
- `.talk-side`：`flex:1; min-height:0; display:flex; flex-direction:column`（均分兩半）。
- `.talk-side-ja { transform: rotate(180deg) }`（旋轉整個上半；一處，不逐元素）。
- `.talk-divider`：`flex-shrink:0`。
- 每側非捲動子元素（lang/orig/status/actions/mic）：`flex-shrink:0`（Task11 U2 紀律）。
- `.talk-side-result`：唯一彈性/捲動=`flex:1; overflow-y:auto; min-height:0`。
- 字級硬編碼（禁 `var(--fs-*)`，type scale 僅授權 `.trip-*`）：
  - `.talk-side-result`：`font-size: ≥28px`（隔桌可讀）
  - `.talk-side-orig`：`font-size: ≥15px`
  - `.talk-side-status`：`font-size: ≥15px`
  - `.talk-side-lang`：建議 ≥15px
- 觸控目標：`.talk-side-mic { min-height: 60px }`；動作鈕 `min-height: 44px`。
- 對比紀律：文字用 `--c-text`/`--c-accent-text`；不用 `--c-accent` 當文字色；不新增深底 overlay。
- 錄音中視覺：沿用 `#C63A3A` 紅色系＋`@keyframes talk-recording-blink`/`talk-mic-ripple`，打在 `.talk-side-mic.talk-mic-active` 與狀態列。

---

## 9. QA 殘留 grep 判準（零命中）

```
_bubbles|_appendBubble|MAX_BUBBLES|talk-history|talk-lang-bar|talk-bubble|talk-mic-row|_showTalkStatus
```

全 repo（JS＋CSS＋非 specs 目錄）零命中。

---

## 10. localStorage key（無新增）

本 Task 零新增 localStorage key。既有 `tokyotrip.translateMode` 沿用不變。
