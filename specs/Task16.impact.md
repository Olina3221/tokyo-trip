# Task16.impact.md — 影響範圍分析（SA，2026-07-12）

> 涉及範圍：**純後端**（`js/tts.js`＋`js/translate-tab.js`＋`js/recorder.js`＋兩檔版號）。零 UI 變更。
> backend 完成後直接建 `Task16.done`，跳過 frontend 階段。
> 依據：`Task16.spec.md`＋已核准診斷 `talk_autoplay.diagnosis.md`（RC-H＋RC-I 合修）。

---

## 1. `App.speak.unlock()` 不破壞既有契約的盤點（spec R1）

### 1.1 實作形態定案（SA）

unlock **不得走 `App.speak()` 路徑**（`speak('')` 會被 L105 `if (!text) return` 擋掉；改走 speak 又會觸發 cancel-then-speak 契約清掉正在播的音）。定案：unlock 內部**直接呼叫 `window.speechSynthesis.speak(utt)`**，utt 用**獨立模組變數**暫存（防 iOS GC，比照 B4），與 `_currentUtterance`／`_pendingTimer` 完全隔離：

- utt 文字建議用 `' '`（單一空白）——部分 WebKit 對 `''` 完全不排程，空白字元無聲且瞬間結束，兩種「呼叫即解鎖／須實際開講才解鎖」的 WebKit 行為都能滿足。細節（是否附 volume=0）backend 定案寫註解。
- **不設 `utt.voice`、不設 `utt.lang`**——unlock 不依賴 `_pickVoice`／`_voices`（voices 首次可能為空陣列，unlock 不得因 voice 未載入而行為分歧）。
- utt 的 `onend`/`onerror` 若要掛（清自己的獨立參照），**只准動獨立變數**，不得碰 `_currentUtterance`（spec R1.4）。
- **冪等旗標於「speak 發出」當下即設**（不等 onend）——因為空 utterance 可能被後續任何 `speechSynthesis.cancel()` 清掉而永遠等不到 onend（spec 邊界條件已建議此方向，SA 定案採納）。
- 開頭守門 `if (!window.speechSynthesis) return;`（no-op 不 throw）。

### 1.2 對既有五個內部機制的影響逐項確認

| 既有機制 | unlock 的影響 | 判定 |
|---|---|---|
| `speak(text, lang)` 本體（L103-142） | 函式本體零 diff；unlock 為獨立函式＋`speak.unlock = ...` 掛載（與 `speak.cancel`/`speak.isAvailable` 同掛法） | 無影響 |
| `speak.cancel()`（`cancelSpeak` L86-93） | cancel 會順帶清掉排程中的 unlock 空 utterance——**這正是時序定案要處理的點（§2）**；cancel 本體零 diff | 無影響（時序見 §2） |
| `_pickVoice` | unlock 不呼叫它 | 無影響 |
| `_pendingTimer` | unlock 不走 16ms timer 路徑、不 clearTimeout | 無影響 |
| `_currentUtterance` | unlock 用獨立變數；空 utterance 的 onend/onerror 不碰它——**若誤共用，空 utterance 的 onend 會把後續真 utterance 的參照清成 null 導致 GC 斷音**，此為 R1.4 的具體風險場景 | 無影響（backend 依 R1.4 用獨立變數） |

### 1.3 既有呼叫點零變更確認（QA 機械判準）

全庫 `App.speak(` 呼叫點（Grep 實測現況）：

| 檔案:行 | 呼叫 | 本次 |
|---|---|---|
| `phrases-tab.js:186` | `App.speak(capturedJa)` | 整檔零 diff |
| `bigtext.js:119` | `App.speak(jaEl.textContent, _lang)` | 整檔零 diff |
| `camera-tab.js:579` | `App.speak(_lastOcrText)` | 整檔零 diff |
| `camera-tab.js:646-647` | `App.speak.cancel()`（wrap 守門） | 整檔零 diff |
| `translate-tab.js:306` | 文字模式播音 | 零 diff |
| `translate-tab.js:535` | 對話自動播（G4 內） | 呼叫本身零 diff，外層加 RC-I 延遲包裹（§3） |
| `translate-tab.js:746/757` | 兩側重播鈕 | 零 diff |
| `translate-tab.js:379/585` | `_abortTalk`／`_onMicClick` 的 cancel | 379 零 diff；585 後插入 unlock（§2） |

**機械判準**：`git diff` 中 `phrases-tab.js`、`bigtext.js`、`camera-tab.js` 三檔零命中；`tts.js` 的 diff 只有「新增獨立變數＋unlock 函式＋掛載一行＋檔頭註解」的純新增行，`speak`/`cancelSpeak`/`_pickVoice`/`_updateVoices` 四個既有函式本體行零 +/-。

---

## 2. unlock 與防回授 cancel 的時序定案（核心）

### 2.1 問題

spec R1.5 原建議 unlock 放 `_onMicClick` 開頭；但 idle 路徑 L585 有既有 `App.speak.cancel()`（Task12 防回授契約，不得移除）。若 unlock 在開頭、cancel 在其後同步執行，**首次 tap 的解鎖空 utterance 會在排程後數行內就被 `speechSynthesis.cancel()` 清掉**——在「須實際開講才算解鎖」的 WebKit 行為下，解鎖會被自己人抵銷。

### 2.2 SA 定案：**唯一呼叫點 = idle 路徑、L585 cancel 之後、`App.recorder.start()` 之前**

```
_onMicClick(lang)
  G5 守門（recognizing/translating → return）      ← 不動
  recording 分支（停止→stop→_processTalk）          ← 不加 unlock（理由見下）
  idle 分支：
    G2 雙鈕 disabled                                ← 不動
    App.speak.cancel()（L585 防回授，不動）
    App.speak.unlock()                              ← ★ 唯一插入點（同步、仍在手勢內）
    App.recorder.start() …                          ← 首個 async，在 unlock 之後
```

成立理由（三條，backend 依此寫定案註解）：

1. **首次 tap 必走 idle 分支**——不可能未 start 就處於 recording，所以「第一次手勢」一定經過此點，解鎖必然發生在 per-session 第一次互動。60 秒自動停與停止 tap 之後的自動播，靠的都是這次已立的冪等旗標，無需重複解鎖。
2. **cancel 之後才 unlock → 我們自己的防回授永遠清不掉解鎖 utterance**。空白 utterance 排程後即刻自然結束，對「呼叫即解鎖」與「須實際開講」兩種 iOS 行為皆成立。之後最近的 `speechSynthesis.cancel()` 要到下一輪 tap 或自動播的 cancel-then-speak，距離秒級，早已播畢。
3. **仍滿足 spec QA-2 的機械判準**：unlock 在同步手勢路徑上、在任何 async（`recorder.start`/`stop`）之前。（spec R1.5 的「開頭」字面與本定案不同；R1.5 子項已明文授權依 cancel 互動定案，本檔為時序新權威。）

### 2.3 明確禁止：「開頭＋cancel 後」雙呼叫

若 backend 保守起見在 handler 開頭與 cancel 後各呼叫一次：**開頭那次會把冪等旗標立起（發出即解鎖），cancel 後那次直接 no-op，而開頭的空 utterance 已被 L585 清掉**——雙呼叫組合反而讓解鎖失效。禁止。唯一呼叫點就是 §2.2 那一處。

### 2.4 recording 分支不加 unlock 的補充

停止錄音的 tap 也是手勢，但冪等旗標已在開始錄音的 tap 立起，加了也是 no-op；且該分支加 unlock 會誘使 backend 把旗標判定複雜化。不加。

---

## 3. RC-I 音訊釋放定案

### 3.1 現況確認

`recorder.js` `_release()`（L57-70）：processor/source disconnect＋tracks stop＋`_audioCtx.close()`——`close()` 回傳 Promise，現況 fire-and-forget；`stop()`（L178-218）呼叫 `_release()` 後同步做合併/重取樣/編碼即 resolve。**`stop()` resolve 時 iOS 音訊 session 可能尚未離開 record 類別**——RC-I 成立空間。

### 3.2 SA 定案：**(c) 併用——(a) 為主、(b) 為輔**

真機不可本機驗、一次修好價值高、(b) 邊際成本極低，belt-and-braces：

**(a) `stop()` await `audioCtx.close()` 完成後才 resolve**（結構正解）：

- `_release()` 改為**回傳 Promise**：close 的 Promise（內部先 `.catch(function(){})` 吞掉 rejection，防呼叫端忽略回傳值時 unhandled rejection）；無 `_audioCtx`／close 不存在／同步 throw 時回傳已 resolve 的 Promise。**R5 四件套 try/catch 包裹全部保留**。
- `abort()` 與 `start().catch` **忽略回傳值**——`abort()` 的同步簽名契約（Task12.api.md）零變更。
- `stop()`：先取 `var releaseP = _release()`，照舊同步做編碼鏈（零 diff），最後 `return releaseP.then(→result)`；**加逾時保險**（建議 `Promise.race` ~500ms fallback resolve）——`close()` 若在某 iOS 版本懸掛，不得讓「錄音→辨識」整條流程卡死、錄音結果不得因釋放失敗而丟失（spec 邊界條件）。
- 延遲代價：close 一般數十 ms，使用者感知 = 「辨識中…」早幾十 ms 出現前的空窗，可忽略（STT＋翻譯本身秒級）。

**(b) 自動播 speak 前加 150ms 延遲**（僅 `_processTalk` 自動播路徑，SA 建議值 150ms，spec 授權區間 100–300ms 內 backend 可調）：

- 位置：`translate-tab.js` `_processTalk` translate resolve 內——`_setSideResult`（顯示寫入）**照舊立即執行**，只把「G4 守門＋`App.speak`」整塊包進 `setTimeout(…, 150)`。
- **守門必須移入延遲回呼內重新評估**（見 §5 縫隙 4，此為 (b) 能否安全落地的關鍵）：回呼內驗 `G4（section 非 hidden && mode==='talk'）` **＋新增 `_talkState === 'idle'`**。理由：
  - spec 邊界條件假設「`_abortTalk` 的 `speak.cancel()` 仍會清掉 pending 播音」——那只對 **tts.js 內部的 16ms pending timer** 成立；我們自己的 150ms timer 不歸 tts.js 管，cancel 清不到。若守門在延遲前評估，切分頁後 150ms 到點照樣在別的分頁發聲，破壞 G4 語意。守門移入回呼＝到點時重驗，天然自癒，不需新增 timer 追蹤狀態。
  - `_talkState === 'idle'` 守門堵新引入的回授窗：使用者在 150ms 窗內搶按 mic（L585 cancel 已放行、錄音將開始），無此守門則 speak 在錄音中才發出＝喇叭進麥克風。現況（無延遲）此窗不存在，是 (b) 新引入的，必須自己堵。
- 手動路徑（重播鈕 L746/757、常用句、大字、文字模式、camera）**一律不加延遲**（spec R2.4，它們在手勢內、無 RC-I 場景）。

### 3.3 recorder.js 紅線重申

R1–R8 檔頭陷阱清單不重排不「優化」；`_resample`/`_floatTo16`/`_toBase64`/`start`/`onaudioprocess` 錄音編碼鏈零 diff；diff 限縮在 `_release` 回傳值化＋`stop()` 尾端 Promise 鏈。**機械判準**：`recorder.js` git diff 只命中 `_release` 與 `stop` 兩個函式，`durationMs`/`base64` 產出邏輯行零 +/-。

---

## 4. 兩方向共用路徑確認（spec R3）

中→日與日→中共用唯一一條 `_processTalk(lang, base64)` → STT → translate → `_setSideResult` → G4 → `App.speak(result, lang==='zh'?'ja-JP':'zh-TW')`（L491-553）。RC-H 修在 `_onMicClick`（兩顆 mic L767-768 綁同一 handler）、RC-I(a) 修在 recorder 層、RC-I(b) 修在共用的 G4 區塊——**三處全部天然雙向覆蓋，修法不需分方向**。lang 選擇三元式（L535）零變更；`STT_LANG`／translate from/to 對照（L492-494）零變更。60 秒自動停路徑（L594-610）同樣匯入 `_processTalk`，同享修法；其自動播的手勢解鎖依賴「開始錄音那個 tap」的冪等旗標（§2.2 理由 1），已覆蓋。

---

## 5. spec 縫隙補完（SA 定案，backend 照此執行）

1. **unlock 呼叫點與 R1.5 字面的出入**：R1.5 寫「開頭」；本檔 §2.2 定案「L585 cancel 之後」為唯一呼叫點並禁止雙呼叫（§2.3）。R1.5 子項已授權此定案，本檔為時序權威。
2. **unlock 不設 voice/lang**：spec 未提；定案不依賴 `_pickVoice`／`_voices`（首次 getVoices 可能空陣列，unlock 不得受 voices 載入時序影響）。
3. **`_release()` 回傳 Promise 的漣漪**：`abort()` 同步契約保持（忽略回傳值）；回傳的 Promise 內部先吞 rejection，防 unhandled rejection 噪音。
4. **(b) 延遲的守門必須在回呼內**（G4＋`_talkState==='idle'`）：spec 邊界條件對 `_abortTalk` 清 pending 的假設只覆蓋 tts.js 內部 timer，不覆蓋本次新增的 150ms timer——守門移入回呼是 (b) 不破壞 G4 語意與防回授契約的必要條件（§3.2）。
5. **stop() 變 async-longer 對 UI 的影響**：「辨識中…」文案在 `stop()` resolve 後才由 `_processTalk` 設定，await close 使其晚數十 ms 出現，無需任何 UI 調整；逾時保險（~500ms race）保證上限。
6. **歷史判準失效聲明**：Task13.spec QA-4「tts.js／recorder.js 零 diff」是該 Task 的判準，**本 Task 正式解除**（spec 已拍板解除 tts.js 保護；recorder.js 釋放時序屬 R2 授權範圍）。QA 不得誤引歷史 spec 判 FAIL。
7. **PRECACHE 零變更**：本次全是既有檔內容修改，無新檔；`sw.js` 只動 CACHE_VERSION 一行。

---

## 6. 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 全域 TTS（常用句/大字/文字翻譯/camera 播音） | `App.speak` 各呼叫點（§1.3 表） | tts.js 只加 unlock，既有函式本體零 diff | ✅ |
| 對話防回授 | `_onMicClick` L585 cancel | 保留不動，unlock 插其後 | ✅ |
| 對話錄音→辨識→翻譯鏈 | `recorder.stop()`→`_processTalk` | stop 改 await close（+逾時保險），編碼鏈零 diff | ✅ |
| 對話雙向自動播 | `_processTalk` G4 | G4＋speak 包 150ms 延遲、守門移入回呼＋idle 守門 | ✅ |
| 切分頁/切模式中止（`_abortTalk`、wrap 鏈四層） | L379／L885-896 | 零 diff；延遲播音由回呼內重驗守門自癒 | ✅ |
| 60 秒自動停 | L594-610 | 零 diff；經 `_processTalk` 同享修法 | ✅ |
| 離線快取 | `sw.js`／`js/version.js` | v15→v16 兩檔三行 SOP | ✅ |
| 文字翻譯模式（Task5） | translate-tab.js 前段 | 零 diff | ✅ |

## 7. Backend 注意事項

- unlock：獨立變數、發出即設冪等旗標、不碰 `_currentUtterance`/`_pendingTimer`、無 speechSynthesis 時 no-op；唯一呼叫點＝L585 cancel 之後（§2.2 三條理由寫進註解）；禁雙呼叫（§2.3）。
- recorder：`_release()` 回傳吞過 rejection 的 Promise；`abort()`/`start().catch` 忽略回傳值；`stop()` 尾端 `releaseP`（含 ~500ms race）後才 resolve；R1–R8 註解與編碼鏈零 diff。
- `_processTalk`：`_setSideResult` 不延遲；G4＋speak 進 150ms 回呼並在回呼內重驗 G4＋`_talkState==='idle'`；L535 三元式 lang 零變更。
- 版號：`sw.js` CACHE_VERSION `'v15'`→`'v16'`；`version.js` APP_VERSION `'v16'`＋APP_VERSION_DATE 實作當日。
- 純後端：完成後直接建 `Task16.done`（跳過 frontend）。

## 8. Frontend 注意事項

- 無 frontend 階段。零 DOM/CSS/index.html 變更（QA 以 diff 驗證）。

## 9. QA 迴歸測試清單（程式碼側；真發聲歸 Olina 真機）

- [ ] `App.speak.unlock` 存在；mock speechSynthesis 連呼兩次，底層 `speak` 只被叫一次（冪等）；無 speechSynthesis 時不 throw
- [ ] unlock 呼叫點：`_onMicClick` idle 路徑、`App.speak.cancel()` 之後、`App.recorder.start()` 之前（同步手勢路徑）；全檔恰一處呼叫
- [ ] tts.js diff 純新增；`speak`/`cancelSpeak`/`_pickVoice`/`_updateVoices` 本體行零 +/-；`_currentUtterance`/`_pendingTimer` 未被 unlock 引用
- [ ] phrases-tab.js／bigtext.js／camera-tab.js 三檔零 diff；translate-tab.js:306/746/757 呼叫行零 diff；文字模式（Task5 區塊）零 diff
- [ ] recorder.js diff 限 `_release`/`stop`；`abort` 仍同步簽名；stop 的 resolve 在 release Promise 之後（mock close 驗順序）；close reject／懸掛（race 逾時）時錄音結果照常 resolve；編碼鏈與 R1–R8 註解零 diff
- [ ] 自動播延遲：mock 流程走完 translate resolve，`_setSideResult` 立即、`App.speak` 於延遲後發出；延遲窗內切分頁（section.hidden）或 `_talkState!=='idle'` 時 speak 不發出（兩方向皆驗）
- [ ] 兩方向 lang 迴歸：zh→`'ja-JP'`／ja→`'zh-TW'` 各恰一次；`cmn-Hant-TW` 只在 speechToText 語境
- [ ] `_abortTalk`（L379）與 wrap 鏈四層 call-through 零 diff
- [ ] 版號機械閘：CACHE_VERSION === APP_VERSION === `'v16'`、DATE 已更新；PRECACHE 清單無增減
- [ ] 面對面 DOM 建構（`_buildTalkDOM`）零 diff

**真機驗收（流程外，Olina）**：部署後 iPhone 一進 App 直接用對話模式（不先按任何播放鈕），中→日與日→中各說一句，確認兩方向自動出聲；一次沒修好依 spec 迭代條款由 PM 另開修復輪。
