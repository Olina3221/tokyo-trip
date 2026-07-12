# Task15.spec.md — 對話面對面 UI（翻譯對話模式改為 Google 翻譯式面對面版面）

## 模組：translate 分頁 對話模式（talk mode 版面與呈現流程重排）

### 功能描述

把對話模式改成**面對面對話版面**：手機平放兩人中間，螢幕上下切半——上半（日方）內容旋轉 180°、下半（Olina，中文）正向，各自有自己的麥克風鈕與結果顯示，雙方隔桌都能讀到正向、大字的自己語言內容；**雙向自動播音（Task13）完整保留**。

### 背景與已拍板決策（不重議）

- 已完成：Task12（對話語音模式：錄音→STT→翻譯→氣泡歷史）＋Task13（雙向自動播音）皆已閉環（sw.js 現為 v13）。現況對話模式＝單向直式氣泡串＋底部雙麥克風鈕，兩人要輪流把手機轉來轉去看。
- **已拍板（Olina 實機使用後提出）：改成 Google 翻譯「面對面」模式的版面**——螢幕上下切半、上半旋轉 180° 給對面的人正向閱讀、各半有自己的麥克風鈕與結果。
- **已拍板：雙向自動播音一定保留。** Olina 明確說：Google 面對面只顯示文字，我們有自動唸出來更好用。G4 守門邏輯（translate 為當前分頁 && 模式 'talk'）與 lang 選擇（zh→ja-JP／ja→zh-TW）**語意零變更**，本 Task 只改「文字顯示到哪裡」。
- 已拍板：**文字模式（Task5）完全不動**——本任務只重排對話模式。
- Olina 附註：Google 截圖僅供概念參考、不是 100% 照抄，v1 由 PM 定案細節，她部署後實機再微調（微調屬後續調整，不阻擋本輪驗收）。
- 沿用既有能力零重寫：`App.recorder`、`App.api.speechToText`、`App.api.translate`、`App.speak(text, lang)`、`App.showBigText`、狀態機（idle→recording→recognizing→translating）、`_abortTalk()`、wrap 鏈三層、60 秒自動停、防回授 cancel、MAX_CHARS 截斷。
- SA/backend/frontend 不得重開已拍板的討論——有疑慮記入回報交 PM，不自行改走別條路。

### 涉及範圍

- [x] 後端／核心邏輯（`js/translate-tab.js` 對話模式 DOM 建構與流程改寫＋`sw.js`/`js/version.js` 兩檔 bump＋`Task15.api.md` DOM 契約）
- [x] 前端／UI（`css/style.css` 面對面版面：上下切半、上半 rotate 180°、兩側鈕/結果/狀態、淺色主題一致）

兩者皆有：backend 完成建 `Task15.backend_done` → frontend 完成建 `Task15.done`。

### 版面規格（PM 定案 v1）

`#tab-translate` section 結構（模式切換 segmented 沿用現位，不搬家）：

```
#tab-translate
  div.translate-mode-seg          ← 「文字/對話」segmented（現況保留，正向，Olina 操作；flex-shrink:0）
  div.translate-container         ← 文字模式（Task5，零 diff）
  div.talk-container              ← 對話模式（本 Task 整個重排為面對面）
    div.talk-side.talk-side-ja    ← 上半＝日方，整個容器 transform: rotate(180deg)
      div.talk-side-lang          ←   語言標示「日本語」
      div.talk-side-orig          ←   本側說話的辨識原文（小字；「認識：〜」）
      div.talk-side-result        ←   給本側讀的譯文（大字，主內容）
      div.talk-side-status        ←   狀態列（idle/錄音中/認識中/翻訳中，日文文案）
      div.talk-side-actions       ←   🔊 再生 ／ ⤢ 大きく（有結果才可用）
      button.talk-side-mic        ←   🎤 麥克風鈕（該側視角的最下方＝靠該側的人）
    div.talk-divider              ← 中央分隔帶（細帶，含 ⇄ 圖示；flex-shrink:0）
    div.talk-side.talk-side-zh    ← 下半＝Olina，正向（同構，中文文案）
      （talk-side-lang「中文」／orig「辨識：〜」／result／status／actions「🔊 重播／⤢ 大字」／mic）
```

要點：

1. **旋轉只做一次**：`transform: rotate(180deg)` 打在 `.talk-side-ja` 整個容器上，內部所有鈕、文字、狀態自動繼承正確方向——不逐元素旋轉。下半無任何 rotate。
2. **每側版面（以該側的人的視角）**：語言標示在最上 → 辨識原文（小）→ 譯文（大）→ 狀態 → 動作鈕 → 麥克風鈕在最下（最靠自己）。整半容器旋轉後兩側視覺自然對稱。
3. 兩半各佔可用高度約一半（`flex: 1` 均分），中央 `.talk-divider` 細帶 `flex-shrink: 0`。
4. 舊版面元素退場：`.talk-lang-bar`（靜態「🇹🇼 中文 ⇄ 🇯🇵 日文」列）、`.talk-history` 氣泡串、`.talk-bubble*` 全套、`.talk-status*`、`.talk-mic-row`/`.talk-mic-zh`/`.talk-mic-ja`——JS 不再建構，**CSS 孤兒樣式一併刪除**（Task10 孤兒退場紀律）。
5. 字級（硬編碼，禁 `--fs-*`——type scale 僅授權 `.trip-*`）：譯文主字 **≥28px**（隔桌可讀，比舊氣泡 22px 大）、辨識原文 ≥15px、狀態 ≥15px。觸控目標：麥克風鈕 min-height 60px、動作鈕 ≥44px。
6. 淺色主題一致：文字色用 `--c-text`/`--c-accent-text`（不用 `--c-accent` 當文字色）；不新增深底 overlay；錄音中紅色沿用 `#C63A3A` 系。

### 結果呈現流程（PM 定案 v1：譯文顯示在聽話者那一側）

| 流程 | 說話側顯示 | 聽話側顯示 | 自動播 |
|------|-----------|-----------|--------|
| Olina 按下半 🎤（中文）說完 | 下半 `talk-side-orig`：「辨識：<中文原文>」 | 上半 `talk-side-result`：<日文譯文>（大字，旋轉側） | `App.speak(譯文, 'ja-JP')`（G4 守門，零變更） |
| 日方按上半 🎤（日文）說完 | 上半 `talk-side-orig`：「認識：<日文原文>」 | 下半 `talk-side-result`：<中文譯文>（大字） | `App.speak(譯文, 'zh-TW')`（G4 守門，零變更） |

1. **每側只保留最近一則**：新一輪對話覆蓋該側的 orig/result 槽（不做捲動歷史——歷史檢視列 Non-scope，實機若想要再開 Task）。記憶體氣泡陣列（`_bubbles`/`MAX_BUBBLES`）與 `_appendBubble` 隨之退場。
2. **每側動作鈕作用於該側 result 槽**：ja 側 🔊 = `App.speak(ja譯文, 'ja-JP')`、zh 側 🔊 = `App.speak(zh譯文, 'zh-TW')`；⤢ 大字 = `App.showBigText`（ja 側沿用 `{ ja: ja譯文, zh: zh原文 }`、zh 側沿用 `{ ja: zh譯文, lang: 'zh-TW' }`——Task12.api.md 契約擴充語意）。該側無結果時鈕隱藏或 disabled。動作鈕僅 idle 時作用（沿用 Task12 §7）。
3. **大字 overlay 不旋轉（v1 定案）**：`App.showBigText` 維持全螢幕正向——定位為「拿起手機展示」情境，bigtext.js 零 diff。實機若覺得旋轉側開大字不好用，屬後續微調 Task。
4. **狀態機共用不變**：仍是全域單一狀態機（同時只有一路錄音），`_talkLang` 決定哪側活躍。錄音/處理中：說話側狀態列顯示進行狀態，另一側維持 idle 文案；雙鈕 disable 規則沿用（G2/G5）。
5. **G4 in-flight 語意延續**：切走分頁或切回文字模式後才 resolve 的結果，照常寫入兩側顯示槽（DOM 隱藏中更新無妨），但**不自動播**——守門條件與 Task13 逐字元同語意。

### 兩側文案（PM 定案，Olina 實機可再改字）

| 槽位 | 下半（中文） | 上半（日文） |
|------|-------------|-------------|
| 語言標示 | 中文 | 日本語 |
| mic idle | 🎤 點我說中文 | 🎤 タップして話す |
| mic 錄音中 | ■ 停止 | ■ ストップ |
| 狀態 idle | 按下麥克風開始說話 | マイクを押して話してください |
| 狀態 錄音中 | 🔴 錄音中…說完再按一次 | 🔴 録音中…もう一度押すと停止 |
| 狀態 辨識中/翻譯中 | 辨識中…／翻譯中… | 認識中…／翻訳中… |
| 辨識原文前綴 | 辨識： | 認識： |
| 動作鈕 | 🔊 重播／⤢ 大字 | 🔊 再生／⤢ 大きく |
| 空辨識 | 沒有聽清楚，請再說一次 | 聞き取れませんでした。もう一度お願いします |

### 邊界條件 / 錯誤處理

- **API 錯誤（NO_KEY/OFFLINE/HTTP_*／錄音錯誤 MIC_*）一律顯示在下半（中文，沿用 `TALK_ERROR_MSG`）**——錯誤處理（權限、網路、重試決策）永遠是機主 Olina 的事；上半狀態復位 idle 文案。翻譯失敗時「（辨識到：原文）」保留顯示（Task12 §8 沿用，顯示於下半錯誤訊息內）。
- **空辨識訊息顯示在說話側**（zh 側中文／ja 側日文，見文案表），回 idle。
- 錄音不支援（`App.recorder.isAvailable === false`）：兩側 mic 皆 disabled，下半狀態顯示既有 NOT_SUPPORTED 文案。
- 防回授：`_onMicClick` 開頭 `App.speak.cancel()` 沿用零變更（自動播中按任一側 mic 先清 TTS）。
- 60 秒自動停、MAX_CHARS 截斷、切分頁 `_abortTalk()`（wrap 鏈三層）全部沿用零變更。
- 直式為準（App 鎖 portrait）；旋轉半邊內若文字過長，`talk-side-result` 自行內部捲動（該側容器內 overflow-y:auto），不得撐破半邊高度、不得產生頁面級橫向捲動。

### 版號連動（bump SOP＝兩檔三行，Task14 永續紀律）

- `sw.js` `CACHE_VERSION`：開工時實際值 +1（現況 v13 → 預期 **v14**）。
- `js/version.js`：`APP_VERSION` 同步（與 CACHE_VERSION 逐字元相等＝QA 機械閘）＋ `APP_VERSION_DATE` 改 bump 當天（MM/DD，台灣時區）。
- `PRECACHE_URLS` 零變更（38 筆，無新檔——translate-tab.js/style.css 已在清單）。

### 分工

- **backend**（`js/translate-tab.js`＋兩檔 bump＋契約文件）：
  - 對話模式 DOM 建構改寫（`_buildTalkDOM` → 面對面雙側結構）、每側顯示槽狀態管理（orig/result 覆蓋式更新）、兩側 mic 事件接既有 `_onMicClick`、狀態/錯誤依本 spec 分側路由、`_appendBubble`/`_bubbles` 退場；G4 自動播區塊**零語意變更**。
  - **DOM/class 大改，必寫 `Task15.api.md`** 供 frontend（完整 class 樹＋各槽語意＋文案表）。
  - `sw.js`＋`js/version.js` 兩檔 bump（v14）。
- **frontend**（`css/style.css`）：
  - `.talk-side-*` 面對面版面：上下 flex 均分、`.talk-side-ja { transform: rotate(180deg) }`、中央分隔帶、字級/觸控目標下限、錄音中視覺（沿用紅色系動畫語彙）、淺色主題與對比紀律、flex-shrink 紀律（非捲動子元素 flex-shrink:0）。
  - 舊 `.talk-lang-bar`/`.talk-history`/`.talk-bubble*`/`.talk-status*`/`.talk-mic-row|zh|ja` 孤兒樣式刪除。

### QA 驗收界線（機械判準）

1. 文字模式（Task5）迴歸：16 個既有單元零 diff、行為零變化。
2. mock 流程（recorder＋speechToText＋translate＋speak 全 mock）中→日：下半 orig 槽＝辨識中文、上半 result 槽＝日文譯文、`App.speak(譯文,'ja-JP')` 恰一次；日→中反向對稱（zh-TW）。
3. G4 守門迴歸：translate 分頁 hidden 或模式 'text' 時，兩方向結果照寫入顯示槽、`App.speak` 不被呼叫。
4. `.talk-side-ja` 規則含 `rotate(180deg)`；`.talk-side-zh` 無 rotate。
5. 兩側 🔊 重播 lang 正確（ja 側 ja-JP／zh 側 zh-TW）、僅 idle 作用；⤢ 大字呼叫參數符合 Task12.api.md 契約；該側無結果時不可觸發。
6. 連續兩輪同向對話：該側槽為覆蓋（不累積 DOM 節點）；`_bubbles`/`_appendBubble`/`.talk-history` 全 repo 零殘留引用（JS＋CSS）。
7. 錯誤路由：API 錯誤顯示於下半（中文）＋上半復位；空辨識顯示於說話側（兩語言各驗一次）。
8. `_onMicClick` 開頭 `App.speak.cancel()` 仍在；`_abortTalk` 路徑與 wrap 鏈三層迴歸；60 秒 timer 邏輯零變更。
9. diff 範圍僅 `js/translate-tab.js`、`css/style.css`、`sw.js`、`js/version.js`（＋specs 文件）；index.html／tts.js／recorder.js／api.js／bigtext.js 零 diff。
10. `CACHE_VERSION === APP_VERSION === 'v14'` 逐字元相等、`APP_VERSION_DATE` 為 bump 當日；PRECACHE_URLS 38 筆零變更。
11. localStorage key 零新增；`cmn-Hant-TW` 仍只出現在 speechToText 語境；`var(--fs-` 不出現在 `.talk-*` 規則（type scale 越界判準）。
12. 隱私三段式掃描照常；真機面對面手感（平放可讀性、旋轉側操作、字級）由 Olina 部署後 iPhone 流程外驗收。

### 不在本次範圍（Non-scope，必填護欄）

- 不碰文字翻譯模式（Task5 行為與 DOM 零 diff）。
- 不改雙向自動播的既有邏輯（G4 守門條件、lang 選擇、`App.speak` 呼叫語意零變更——只改文字顯示位置）。
- 不動 tts.js／recorder.js／api.js／bigtext.js／index.html（載入順序、wrap 鏈層數不變）。
- 不旋轉大字 overlay（bigtext 維持正向＝「拿起手機展示」定位；實機不好用再開調整 Task）。
- 不做對話歷史檢視／持久化（每側只留最近一則；想要歷史再開 Task）。
- 不做橫向 landscape 版面（維持直式）。
- 不做拍照 OCR（Task6）、不做部署（Task7）、不做 KML 地圖。
- 不動其他分頁（行程／常用句／折價券／重要資料）。
- 不加語言選擇器（固定中⇄日）、不加自動播開關。
- 不動版號/更新機制本體（Task14 徽章與 toast 零 diff；僅照 SOP bump 版號值）。
- 不改 localStorage key、不改 schema／正式資料（本專案無 DB）。

## 影響範圍分析（SA）

> 完整版見 `Task15.impact.md`（2026-07-12）。涉及範圍：**backend＋frontend 皆有**（backend 建 `Task15.backend_done` → frontend 建 `Task15.done`；backend 必寫 `Task15.api.md`）。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 文字模式（Task5）＋segmented 外殼 | translate-tab.js L50–317／`_switchMode` | 零 diff（重寫區不含此段，四區施工地圖見 impact §2） | ✅ |
| 雙向自動播（Task13）G4 | `_processTalk` L545–550 | 守門四行＋speak 呼叫逐字保留，只換上方顯示寫入行 | ✅ |
| 狀態機／tap-tap／wrap 鏈 | `_onMicClick`/`_abortTalk`/L815–828 | 骨架零調整（`_talkLang` 已編碼「哪側在錄音」，雙側鈕綁定語意同舊雙鈕）；唯一擴點=`_updateTalkUI` 驅動兩側 | ✅ |
| 大字 overlay／TTS／錄音／API | bigtext/tts/recorder/api.js | 零 diff（overlay 掛 body 在旋轉容器外） | ✅ |
| 離線快取 | sw.js＋version.js | 兩檔三行 bump v13→v14；PRECACHE 38 筆零變更（實測） | ✅ |

### Backend 注意事項
- G4 四行逐字保留；顯示寫入在守門外無條件執行（in-flight 照寫不播，Task13 語意逐字元同）。
- 覆蓋式定案：跨分頁保留最後狀態（記憶體）、新一輪不清前值、orig 於 STT 成功寫入、空辨識不動槽（impact §4.3）。
- 錯誤路由逐 catch 點定案表見 impact §6.2；`_showTalkStatus` → 分側函式。
- ja 側槽需存 `{result, origZh}`（大字 `{ja, zh}` 契約）；動作鈕無結果時 **disabled**（非隱藏）。

### Frontend 注意事項
- rotate(180deg) 只打 `.talk-side-ja` 一處；容器內禁 fixed（transform 建立 containing block）；事件座標 iOS 無虞。
- 每側 flex 紀律：非捲動子元素 flex-shrink:0，唯一捲動=`.talk-side-result`（覆蓋時 scrollTop 歸 0；旋轉側捲動方向對讀者自然，非 bug）。
- 孤兒清理清單（含行號）見 impact §7.1；`.talk-container`、兩組 keyframes、`.talk-mic-active` class 名保留重用。

### QA 迴歸測試清單
- [ ] 文字模式 16 單元＋外殼零 diff；G4 迴歸（hidden/text 槽照寫零播、守門恰一份）
- [ ] mock 雙向流程分側顯示＋speak lang 各恰一次；覆蓋不累積節點；殘留 grep（impact §7.4）零命中
- [ ] 錯誤路由三型（API→下半、空辨識→說話側、NOT_SUPPORTED）；cancel/_abortTalk/wrap/60s 迴歸
- [ ] rotate 判準、v14 逐字元、PRECACHE 38、localStorage 零新增、`cmn-Hant-TW` 語境、`--fs-*` 越界、隱私三段式
- 真機面對面手感歸 Olina 部署後流程外驗收
