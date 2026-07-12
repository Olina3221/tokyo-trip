# Task15.impact.md — 對話面對面 UI 影響範圍分析（SA）

> 分析日期：2026-07-12
> 對照基準：`SYSTEM_MAP.md`＋`js/translate-tab.js`（Task13 閉環後現況，831 行）＋`css/style.css` L1854–2170＋`sw.js` v13
> 涉及範圍：**backend＋frontend 皆有**——backend 完成建 `Task15.backend_done` → frontend 完成建 `Task15.done`。
> **backend 必寫 `Task15.api.md`**（DOM/class 大改，frontend 施工唯一依據）。

---

## 1. 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 文字翻譯模式（Task5） | translate-tab.js L50–317（`_buildDOM`＋16 單元）＋`.translate-*` CSS | **零 diff 保證**——重寫區不含此段（邊界見 §2） | ✅ |
| segmented 外殼（Task12） | `_segInitialized` 塊＋`_switchMode`＋`.translate-mode-*` CSS | 零 diff（`_buildTalkDOM` 呼叫點簽名不變，只換內部實作） | ✅ |
| 雙向自動播（Task13） | `_processTalk` G4 區塊 L545–550 | **守門與 speak 呼叫逐字保留**，只換上一行的顯示寫入（§3） | ✅ |
| 對話狀態機／tap-tap | `_onMicClick`／`_abortTalk`／60s timer | 語意零變更；僅錯誤顯示呼叫換分側函式（§6） | ✅ |
| wrap 鏈三層 | translate-tab.js L815–828 | 零 diff（`_abortTalk` 內部 UI 復位隨 `_updateTalkUI` 改寫，介面不變） | ✅ |
| 大字 overlay | bigtext.js | 零 diff（overlay 掛 body、在旋轉容器外，不受 rotate 影響，§5） | ✅ |
| TTS／錄音／API 層 | tts.js／recorder.js／api.js | 零 diff（不動檔） | ✅ |
| 離線快取／版號 | sw.js＋version.js | 僅 bump v13→v14 兩檔三行；PRECACHE 38 筆零變更（實測確認 38） | ✅ |
| 其他分頁 | 常用句／行程／折價券／重要資料 | 不涉及（`_bubbles`/`.talk-*` 全 repo 僅 translate-tab.js＋style.css 引用，grep 實證零外部依賴） | 冒煙即可 |

---

## 2. 文字模式零 diff 邊界（backend 施工地圖，關鍵）

`js/translate-tab.js` 分四區，**只准動「重寫區」**：

### 2.1 零 diff 區（一個字元都不改）
- L54–317：Task5 全部——`DIR_KEY`/`DEFAULT_DIR`/`MAX_CHARS`/`DIRS`/`ERROR_MSG`、`_getDir`/`_saveDir`、`_initialized`/`_dir`/`_isTranslating`/`_lastInput`/`_lastResult`/`_el`、渲染輔助 5 函式、`_buildDOM` 全體含事件。
- L355–367：`MODE_KEY`（L323）＋`_getMode`/`_saveMode`（外殼與 G4 共用，動它＝模式記憶壞）。
- L715–805：`_segInitialized` 外殼與 `_switchMode`＋`registerTab onShow`（`_buildTalkDOM(_segEl.talkContainer)` 呼叫點簽名不變）。
- L815–828：wrap App.showTab 三層鏈。
- 共用常數唯讀重用：`MAX_CHARS`（G12 截斷）。

### 2.2 逐字保留但所在函式會動（語意零變更區）
- `_onMicClick` 骨架：G5 前置擋、tap-tap 同鈕判定（`_talkLang !== lang return`）、G2 雙鈕 pending disabled、開頭 `App.speak.cancel()`、60s timer 與 G3 雙觸發保護——全保留；**僅** catch 內 `_showTalkStatus(...)` 換成分側呼叫（§6）。
- `_processTalk`：STT→截斷→translate 流程與狀態轉移全保留；**G4 區塊四行（section 取得／`_getMode()`／if 守門／`App.speak(result, lang==='zh'?'ja-JP':'zh-TW')`）逐字保留**；只換顯示寫入行（§3）。
- `_abortTalk`：五個動作（clearTimeout／abort／cancel／回 idle／`_updateTalkUI()`）保留，函式簽名不變。
- `TALK_ERROR_MSG`／`STT_LANG` 常數保留（可新增文案常數，不得改既有值；`cmn-Hant-TW` 僅 STT 語境判準延續）。

### 2.3 重寫區（面對面版面）
- `_buildTalkDOM`（L636–709）→ spec 版面規格的雙側結構。
- `_updateTalkUI`（L382–428）→ 驅動兩側（狀態文案分語言、mic 標籤依文案表、disabled 規則沿用）。
- `_showTalkStatus`（L431–437）→ 退場，改分側函式（§6 命名建議）。
- `_appendBubble`（L440–509）＋`_bubbles`/`MAX_BUBBLES`（L324, 351）→ 全數退場，改覆蓋式槽寫入（§4）。
- 檔頭註解 L22–45 的 DOM/class 清單→ 同步改寫為新結構（QA grep 判準含註解）。

### 2.4 QA 機械判準對應
文字模式 16 單元迴歸＋`.translate-*` CSS 選擇器 diff 應為零；`git diff` 中 L50–317 段零改動可直接機械驗。

---

## 3. 自動播／G4 守門語意不變的保證方式

- **G4 守門四行逐字保留**（`var section = document.getElementById('tab-translate'); var curMode = _getMode(); if (section && !section.hidden && curMode === 'talk') { App.speak(result, (lang === 'zh') ? 'ja-JP' : 'zh-TW'); }`）。改動點只有它**上方那一行**：`_appendBubble(dir, text, result)` → 聽話側 result 槽寫入。
- **顯示寫入必須在守門之外**（無條件執行）：in-flight 於切分頁／切回文字模式後 resolve → 槽照寫（DOM 隱藏中更新無妨）、不播——與 Task13 語意逐字元相同。
- `App.speak` 直呼不加 isAvailable/try-catch（B4 靜默契約，Task13 定案沿用）。
- 兩側 🔊 動作鈕 = `App.speak(該側 result, 該側 lang)`，僅 idle 作用（Task12 §7 沿用）——與自動播共用 tts.js，無新路徑。
- backend 紅線：**不得動 tts.js、不得動 G4 條件式、不得把守門複製成兩份**（Task13 已定案守門碼恰一份）。

---

## 4. 氣泡歷史退場 → 每側覆蓋式（含定案）

### 4.1 退場物（JS）
`_bubbles` 陣列、`MAX_BUBBLES`、`_appendBubble` 整函式（含氣泡動作鈕建構——動作鈕改為每側固定鈕）、G9 捲到最底邏輯、`.talk-history` DOM 建構。全 repo 僅 translate-tab.js 引用（grep 實證），退場無外部波及。

### 4.2 新結構：每側狀態（記憶體，禁 localStorage）
建議 `_side = { zh: { orig: '', result: '' }, ja: { orig: '', result: '' } }` 一類的雙槽狀態＋對應 DOM 參照（`_talkEl` 鍵改為分側：如 `zhOrig/zhResult/zhStatus/zhMic/zhActions`＋ja 同構；`micZh`/`micJa` 鍵名可沿用以縮小 `_onMicClick` diff）。

**槽語意（依 spec 流程表）**：說話側 orig 槽＝辨識原文（前綴「辨識：」／「認識：」）；聽話側 result 槽＝譯文。ja 側 result 的大字參數需連 zh 原文（`{ ja: ja譯文, zh: zh原文 }`），故 ja 側槽需同時存 `{ result, origZh }`；zh 側大字 `{ ja: zh譯文, lang: 'zh-TW' }`。

### 4.3 SA 定案（spec 縫隙補完，backend 照此做）
1. **跨分頁切回保留最後狀態＝保留**。機制：talk DOM 建一次不重建（`_talkDOMBuilt` 冪等沿用），槽內容天然存留；切走分頁 wrap 鏈只 abort 進行中錄音/TTS，不清已完成結果。與 Task10 `_itinView` B6 精神一致（記憶體、禁 localStorage）。App 重啟即清空——歷史持久化屬 Non-scope。
2. **新一輪錄音開始時不清前值**：兩側槽維持上一輪內容直到新結果覆蓋（面對面情境保留「最後一句」有用）；進行狀態由狀態列表達。
3. **orig 槽寫入時機＝STT 成功當下**（進 translating 前）——翻譯失敗時說話側 orig 已在、錯誤進下半狀態列（含「（辨識到：原文）」，spec §邊界沿用）。
4. **空辨識不動槽**：只在說話側狀態列顯示空辨識文案，orig/result 槽維持前值。
5. **記憶體影響**：50 則氣泡陣列＋無上限 DOM 節點 → 固定雙槽 textContent 覆蓋，嚴格變好；連續兩輪同向不累積節點（QA #6 判準的實作基礎）。
6. **onShow 冪等不變**：`_switchMode`／`_buildTalkDOM` 冪等結構沿用，重進分頁不重建、不清槽。

---

## 5. 旋轉半邊的互動陷阱盤點（frontend/backend 須知）

1. **事件座標無虞**：CSS transform 不影響 hit-testing，瀏覽器自動反算——旋轉容器內按鈕點擊、:active、tap-highlight 在 iOS Safari 正常，無需 JS 座標處理。
2. **旋轉打在 `.talk-side-ja` 一次**（spec 已定）：內部鈕/文字/動畫自動繼承。錄音中 ripple 動畫（scale＋box-shadow）在旋轉容器內渲染正常——transform 疊加（父 rotate＋子 keyframe scale）各自獨立，無衝突。
3. **內部捲動方向**：`.talk-side-result` overflow-y:auto 在旋轉容器內，捲動手勢相對「對面讀者」是自然方向（他往自己方向滑＝內容前進）——這正是面對面要的行為，不是 bug，QA 不得誤報。覆蓋新結果時該槽 `scrollTop` 歸 0（讓讀者從頭讀）。
4. **transform 建立 containing block**：旋轉容器內若有 `position: fixed` 後代會相對容器定位——**新結構內禁放 fixed 元素**（現設計無；frontend 勿用 fixed 做狀態浮層）。大字 overlay／券檢視器／update-toast 全掛 body、在容器外，不受影響——**bigtext.js 零 diff 確認成立**。
5. **`-webkit-overflow-scrolling: touch`** 在旋轉容器內於舊 iOS 有渲染毛邊史；iOS 16+（本專案基線）無此問題，沿用即可。
6. **flex 紀律（Task11 U2 延伸）**：`.talk-container` 維持 flex column；`.talk-side { flex: 1; min-height: 0; display: flex; flex-direction: column }`；每側內非捲動子元素（lang/orig/status/actions/mic）`flex-shrink: 0`，唯一彈性/捲動＝result 槽。`.talk-divider` flex-shrink:0。不得產生頁面級橫向捲動。
7. **大字鈕在旋轉側**：overlay 正向為 v1 定案（「拿起手機展示」），不是縫隙——QA 不得當 bug 報。

---

## 6. 雙側麥克風狀態機與錯誤路由（定案實作點）

### 6.1 狀態機：零新增狀態
全域單一狀態機沿用——舊版本來就是 zh/ja 兩顆鈕，**`_talkLang` 已完整編碼「哪一側在錄音」**，面對面只是把兩顆鈕搬進兩個容器，`_onMicClick('zh'|'ja')` 綁定語意不變。沿用即成立的守門：
- G2 pending 雙鈕 disabled、G5 processing 雙鈕 disabled、錄音中另一側鈕 disabled（L404–405 邏輯照搬到新鈕參照）。
- tap-tap 同鈕停止（`_talkLang !== lang` return）、60s 自動停、`_abortTalk`、wrap 離開 abort——全部零調整。
- **`_updateTalkUI` 是唯一要擴的點**：改為驅動兩側（mic 標籤/active class 依文案表分語言；說話側狀態列顯示進行狀態（zh 中文／ja 日文文案）、另一側維持 idle 文案）。`.talk-mic-active` class 名沿用（JS diff 最小），frontend 對 `.talk-side-mic.talk-mic-active` 寫新規則、keyframes 重用（§7）。

### 6.2 錯誤路由（逐 catch 點定案）
| 錯誤點（現行行號） | 路由 |
|---|---|
| `_onMicClick` recorder start/stop catch（L583/617/626） | 下半 zh 狀態列（`TALK_ERROR_MSG`，機主的事）；若說話側是 ja，其狀態列由 `_updateTalkUI()` 復位 idle 日文文案（先 updateUI 再寫錯誤的既有順序沿用） |
| `_processTalk` STT catch（L561） | 下半 zh 狀態列；上半復位 idle |
| `_processTalk` translate catch（L552） | 下半 zh 狀態列＋「（辨識到：原文）」保留；上半復位 idle |
| 空辨識（L524） | **說話側**狀態列（zh 側中文／ja 側日文，文案表）；槽不動（§4.3-4） |
| NOT_SUPPORTED（`_buildTalkDOM` 初始） | 兩側 mic disabled；下半狀態列＝NOT_SUPPORTED 中文文案；上半＝idle 日文文案（錯誤決策歸機主，日方不需讀錯誤） |

### 6.3 建議函式形態（Task15.api.md 定案時命名可調）
`_showTalkStatus(msg)` → `_setSideStatus(side, msg)`（side='zh'|'ja'）；譯文/原文寫入 `_setSideOrig(side, text)`／`_setSideResult(side, text, extra)`。舊 `_showTalkStatus` 退場列入孤兒清單。

---

## 7. 孤兒清理清單（frontend CSS＋backend JS）

### 7.1 CSS 退場（style.css，現行行號）
| 選擇器 | 行號 |
|---|---|
| `.talk-lang-bar` | 1933–1945 |
| `.talk-history` | 1949–1959 |
| `.talk-bubble` | 1963–1972 |
| `.talk-zh2ja`／`.talk-ja2zh` | 1975–1990 |
| `.talk-bubble-orig`／`.talk-bubble-trans` | 1993–2004 |
| `.talk-bubble-actions` | 2008–2013 |
| `.talk-bubble-speak`/`.talk-bubble-bigtext`（含 :active 與 zh2ja/ja2zh 域內變體） | 2016–2055 |
| `.talk-status`/`.talk-status-idle`/`.talk-status-processing` | 2059–2079 |
| `.talk-status-recording` | 2103–2108 |
| `.talk-mic-row` | 2112–2117 |
| `.talk-mic-zh`/`.talk-mic-ja` 全部規則（含 :active/:disabled/.talk-mic-active 變體） | 2120–2170 |

### 7.2 CSS 保留/重用
- `.talk-container`（1923–1929）保留（spec 結構仍以它為根，內容改雙側）。
- `@keyframes talk-recording-blink`（2086–2089）＋`@keyframes talk-mic-ripple`（2091–2100）**保留重用**於新 `.talk-side-*` 錄音視覺（spec「沿用紅色系動畫語彙」；`#C63A3A` 色值沿用）。
- `.talk-mic-active` **class 名保留**（JS toggle 沿用），但舊規則（2163–2170 綁 `.talk-mic-zh/.talk-mic-ja`）刪除、frontend 對新 mic class 重寫。

### 7.3 JS 退場（translate-tab.js）
`_bubbles`、`MAX_BUBBLES`、`_appendBubble`、`_showTalkStatus`（改分側函式）、`_buildTalkDOM` 內舊結構（lang-bar/history/status 三態/mic-row）、檔頭註解 L22–45 舊 DOM 清單、G9 scroll-to-bottom。

### 7.4 QA 殘留 grep 判準
`_bubbles|_appendBubble|MAX_BUBBLES|talk-history|talk-lang-bar|talk-bubble|talk-mic-row|_showTalkStatus` 全 repo（JS＋CSS＋註解）零命中（specs/ 歷史文件除外）。新舊 class 無同名遮蔽：新結構用 `.talk-side-*` 前綴，與退場清單零交集。

---

## 8. 版號 bump（機械閘）

- 開工實測現況：`sw.js` L18 `CACHE_VERSION='v13'`、`version.js` `APP_VERSION='v13'`／`APP_VERSION_DATE='07/12'` → bump **v14**（兩檔三行：APP_VERSION、APP_VERSION_DATE=bump 當日 MM/DD 台灣時區、CACHE_VERSION）。
- PRECACHE_URLS 零變更（實測 38 筆；translate-tab.js/style.css 已在清單，無新檔）。
- QA 機械判準：`CACHE_VERSION === APP_VERSION === 'v14'` 逐字元相等。

---

## 9. Backend 注意事項（彙總）

1. 施工地圖照 §2 四區——零 diff 區一個字元不動，G4 四行逐字保留（§3）。
2. 覆蓋式槽依 §4.3 六條定案（跨分頁保留、新一輪不清前值、orig 於 STT 成功寫入、空辨識不動槽）。
3. 錯誤路由逐 catch 點照 §6.2 表。
4. `_updateTalkUI` 為狀態機唯一擴點；`_onMicClick`/`_abortTalk`/timer 骨架零調整。
5. **必寫 `Task15.api.md`**：完整新 DOM/class 樹、`_talkEl` 分側鍵、每側槽語意與大字/重播參數（ja 側 `{ja, zh}`、zh 側 `{ja, lang:'zh-TW'}`）、文案表全文、動作鈕「無結果時 disabled」定案（SA 建議 disabled 而非隱藏——版面高度穩定，避免旋轉側 layout jump；PM spec 兩者皆許，取 disabled）。
6. 檔頭註解 DOM 清單同步改寫（QA grep 含註解）。
7. 兩檔三行 bump v14；不動 tts.js/recorder.js/api.js/bigtext.js/index.html。

## 10. Frontend 注意事項（彙總）

1. 版面依 spec 版面規格＋§5.6 flex 紀律；rotate 只打 `.talk-side-ja` 一處；容器內禁 fixed（§5.4）。
2. 字級硬編碼：譯文 ≥28px／orig ≥15px／狀態 ≥15px；mic ≥60px／動作鈕 ≥44px；禁 `var(--fs-*)`（QA 機械判準）。
3. 對比紀律：文字用 `--c-text`/`--c-accent-text`；錄音紅 `#C63A3A` 系＋重用兩組既有 keyframes。
4. 孤兒清理照 §7.1 清單整段刪除；`.talk-container` 保留改寫。
5. `.talk-side-result` overflow-y:auto＋不得撐破半邊、不得頁面級橫向捲動。

## 11. QA 迴歸測試清單

- [ ] 文字模式（Task5）16 單元零 diff 迴歸（git diff L50–317 段零改動＋行為驗證）；segmented 外殼零 diff
- [ ] mock 中→日：下半 orig=辨識中文、上半 result=日文譯文、`App.speak(譯文,'ja-JP')` 恰一次；日→中對稱（zh-TW）
- [ ] G4 迴歸：hidden／'text' 模式時兩方向槽照寫、speak 零呼叫；守門碼恰一份
- [ ] `.talk-side-ja` 含 `rotate(180deg)`、`.talk-side-zh` 無 rotate；容器內無 fixed
- [ ] 兩側 🔊 lang 正確、僅 idle 作用；⤢ 參數符合契約（ja 側 {ja,zh}／zh 側 {ja,lang}）；無結果 disabled
- [ ] 連續兩輪同向＝覆蓋不累積節點；§7.4 殘留 grep 零命中
- [ ] 錯誤路由：API 錯誤下半＋上半復位；空辨識說話側（兩語言）；NOT_SUPPORTED 雙 mic disabled
- [ ] `_onMicClick` 開頭 cancel 仍在；`_abortTalk`/wrap 三層/60s timer 迴歸
- [ ] diff 僅四檔＋specs；v14 逐字元相等＋日期＋PRECACHE 38 筆
- [ ] localStorage key 零新增；`cmn-Hant-TW` 僅 STT 語境；`.talk-*` 無 `var(--fs-`
- [ ] 隱私三段式掃描
- 真機面對面手感（平放可讀、旋轉側操作、字級、捲動方向）歸 Olina 部署後流程外驗收

## 12. Spec 縫隙補完（SA 定案彙總，未重開任何已拍板事項）

| # | 縫隙 | 定案 |
|---|------|------|
| 1 | 覆蓋式跨分頁切回是否保留 | 保留（DOM 存留天然行為，B6 精神，§4.3-1） |
| 2 | 新一輪錄音是否清前值 | 不清，新結果才覆蓋（§4.3-2） |
| 3 | orig 槽寫入時機 | STT 成功當下（§4.3-3） |
| 4 | 空辨識對槽的影響 | 槽不動、只動說話側狀態列（§4.3-4） |
| 5 | 動作鈕無結果時隱藏 vs disabled | disabled（版面穩定，§9-5） |
| 6 | NOT_SUPPORTED 上半顯示 | idle 日文文案（錯誤歸機主，§6.2） |
| 7 | ja 側大字需 zh 原文 | ja 側槽存 `{result, origZh}`（§4.2） |
| 8 | 覆蓋時捲動位置 | result 槽 scrollTop 歸 0（§5.3） |
| 9 | 旋轉側捲動方向「反向」 | 對面讀者的自然方向，非 bug（§5.3，QA 判讀依據） |
| 10 | `.talk-mic-active`/keyframes 去留 | class 名與兩組 keyframes 保留重用（§7.2） |
