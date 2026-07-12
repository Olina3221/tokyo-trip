# Task13.impact.md — 影響範圍分析（SA）

> 2026-07-12。對應 `Task13.spec.md`（對話模式日→中也自動播中文，翻轉 Task12 spec §3）。
> **涉及範圍標記：純 backend**（`js/translate-tab.js` G4 區塊＋`sw.js` bump）→ backend 完成後直接建 `Task13.done`，**跳過 frontend 階段**。
> 現況錨定：sw.js `CACHE_VERSION = 'v11'`（SA 開工實測），bump 目標 = **v12**，與 spec 預期一致。

---

## 1. 改動點精準定位（分析重點 1）

唯一改動點 = `js/translate-tab.js` `_processTalk()` 內 translate 成功回呼的 **G4 區塊（現況 L545–553）**：

```js
// 現況
// G4：自動播 ja 條件 = translate 為當前分頁 && 模式仍為 'talk'
if (lang === 'zh') {
  var section = document.getElementById('tab-translate');
  var curMode = _getMode();
  if (section && !section.hidden && curMode === 'talk') {
    App.speak(result, 'ja-JP');
  }
}
// 日→中不自動播（spec §3）
```

**最小改法（SA 定案形）**：守門提出為兩方向共用、依方向選 lang，過時註解一併更新：

```js
// G4：自動播條件 = translate 為當前分頁 && 模式仍為 'talk'（Task13：兩方向共用）
var section = document.getElementById('tab-translate');
var curMode = _getMode();
if (section && !section.hidden && curMode === 'talk') {
  App.speak(result, (lang === 'zh') ? 'ja-JP' : 'zh-TW');
}
```

滿足 spec 實作要求 1–3：守門碼**恰一份**（不複製兩份）、`App.speak` 直呼不加 isAvailable 檢查（B4 契約：不可用時 tts.js 自身靜默 return）、L553「日→中不自動播（spec §3）」註解改指向 Task13.spec.md。

播放時序不變：`_talkState = 'idle'` → `_updateTalkUI()` → `_appendBubble()` → 自動播——與現況中→日完全同序。in-flight Promise 在切走分頁／切回文字模式後才 resolve 時：氣泡照 append（DOM 隱藏中 append 無害，Task12 §5.5-4 既定），**兩方向都不自動播**（共用守門天然達成，防在別的分頁突然唸中文）。

邊界確認：translate 空結果（falsy `result`）時 `App.speak(falsy)` 為 no-op（tts.js:105 `if (!text) return`）——現況中→日即如此，日→中打開後同一特性，零新風險。

## 2. 中→日零變更保證（分析重點 2）

重構後 `lang === 'zh'` 路徑：同一守門條件（`!section.hidden && _getMode()==='talk'`）、同一呼叫 `App.speak(result, 'ja-JP')`、同一時序（append 氣泡後）——**行為逐位元等價**，僅程式碼形狀由「if(zh) 內含守門」變「守門外提」。QA 以 mock 驗行為等價（見 §5 判準 3），不以文字 diff 驗（G4 區塊本身授權重寫）。

G4 之外，translate-tab.js **全部既有單元零 diff**：Task5 的 16 個單元（Task12.impact.md §6.1 清單）＋Task12 的狀態機／`_onMicClick`／`_abortTalk`／`_appendBubble`／氣泡動作鈕／wrap 鏈／segmented 外殼，一行 diff 都不得有。

## 3. zh-TW TTS 降級路徑（分析重點 3，tts.js 零變更、僅驗證）

`App.speak(result, 'zh-TW')` 全路徑**無 throw 點**（SA 逐行確認 tts.js）：

1. 無 speechSynthesis → 開頭 return（靜默）。
2. `_pickVoice('zh-TW')`：正規化後**精確比對優先**（iOS zh-CN/zh-HK/zh-TW 並存、前綴 'zh' 首位常是 zh-CN——精確優先即 Task12 §2.2 防陸腔設計，本次自動播直接受益）→ 無精確時前綴 'zh' 第一個 → 全無 → **回 null，utterance 只設 `utt.lang='zh-TW'` 讓系統自選**（B4：找不到也要播）。
3. utterance 播放失敗 → `utt.onerror` 只 console.warn，不彈窗不壞狀態機。

結論：找不到中文語音時安靜降級，對話流程（已回 idle）零影響。**本 Task 不動 tts.js**（spec 已拍板），此節為驗證性分析。

## 4. 回授防護（分析重點 4，零變更、僅驗證）

新場景 =「自動播中文中，使用者立刻按麥克風」。既有防護鏈對 zh utterance 完全有效：

- `_onMicClick` idle→錄音路徑（L602）：`App.speak.cancel()` 先於 `App.recorder.start()`。
- `cancelSpeak()`（tts.js:86）= `clearTimeout(_pendingTimer)` ＋ `speechSynthesis.cancel()`——**語言無關**，同時覆蓋兩個狀態：中文 utterance 尚在 16ms pending 窗（timer 被清、根本不會播）與已在發聲（cancel 停播）。Task12 修的疊音縫（§2.4）在此場景同樣生效。
- 切分頁／切模式中斷：`_abortTalk()` 內含 `App.speak.cancel()`，自動播中文中切走同樣被停（wrap 鏈「translate 當前分頁」條件既有，不誤殺常用句播音）。

零程式變更，QA 迴歸確認 `_onMicClick` 開頭 cancel 仍在即可。

## 5. 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 對話模式 中→日自動播 | translate-tab.js `_processTalk` G4 | 守門碼外提重構，行為須逐位元等價 | ✅ |
| 對話模式 日→中氣泡 🔊/⤢ | translate-tab.js `_appendBubble` | 零 diff；自動播之外手動重播/大字仍可用 | ✅ |
| 對話模式 錄音防回授 | translate-tab.js `_onMicClick` | 零 diff；cancel 對 zh utterance 有效（§4） | ✅ |
| 翻譯文字模式（Task5 全部） | translate-tab.js | 零 diff | ✅ |
| TTS 全域（常用句/大字/文字模式播音） | tts.js | **零 diff**（本 Task 不動檔） | ✅（抽測即可） |
| 離線快取 | sw.js | 僅 CACHE_VERSION v11→v12 一行；PRECACHE_URLS 零變更 | ✅ |

不受影響（判準：檔案零 diff）：tts.js、recorder.js、api.js、bigtext.js、index.html、css/style.css、app.js、phrases.js、phrases-tab.js、trip-tab.js、import-data.js、tripdata.js、coupon-viewer.js、coupons-tab.js、manifest.webmanifest。

## 6. Backend 注意事項

1. 改動範圍**只有** G4 區塊（§1 定案形）＋該處註解＋sw.js 版本字串一行。不要順手動任何其他單元。
2. 守門碼恰一份——若寫成兩個 if 各帶一份守門即違反 spec 實作要求 1。
3. `App.speak` 直呼、不加 `isAvailable` 檢查、不加 try/catch（tts.js 自身已是全靜默契約）。
4. 語言碼紀律（Task12 §4.3 grep 判準仍有效）：新增的 TTS 引數只能是 `'zh-TW'`；`cmn-Hant-TW` 不得出現在 `App.speak` 語境。
5. sw.js：只改 `CACHE_VERSION = 'v12'`；PRECACHE_URLS 一筆都不動。
6. 純 backend：完成自驗後直接建 `Task13.done`（刪自己的觸發信號），不經 frontend。

## 7. Frontend 注意事項

本 Task 無 frontend 階段（UI 零變更：版面、氣泡、重播鈕、大字鈕、segmented 全維持）。此節僅存檔備查。

## 8. QA 迴歸測試清單（機械判準）

- [ ] **日→中自動播**：mock `App.recorder`/`App.api.speechToText`/`App.api.translate`/`App.speak`，走日→中對話流程——氣泡 append 後 `App.speak(中文譯文, 'zh-TW')` 被呼叫**恰一次**（translate 當前分頁＋模式 talk）。
- [ ] **G4 守門兩方向**：translate 分頁 hidden 或模式已切 `'text'` 時，in-flight resolve → 氣泡照 append、`App.speak` **不被呼叫**（zh、ja 兩方向皆驗）。
- [ ] **中→日迴歸**：同 mock 走中→日流程，`App.speak(ja譯文, 'ja-JP')` 恰一次、時序（append 後）與 Task12 驗收基線一致。
- [ ] **守門碼唯一性**：`_processTalk` 內 `!section.hidden`＋`_getMode() === 'talk'` 守門邏輯恰出現一處。
- [ ] **diff 範圍**：git diff 僅 `js/translate-tab.js`（G4 區塊）與 `sw.js`（版本字串一行）；§5 不受影響清單全數零 diff。
- [ ] **sw.js**：`CACHE_VERSION === 'v12'`；PRECACHE_URLS 與 v11 逐筆相同（37 筆）。
- [ ] **回授防護迴歸**：`_onMicClick` idle 路徑開頭 `App.speak.cancel()` 仍在；`_abortTalk` 內 cancel 仍在。
- [ ] **文字模式迴歸**（Task5）：方向記憶／切換清空／500 上限／五錯誤文案／大字／播音／複製零變化。
- [ ] **氣泡動作鈕迴歸**：日→中氣泡 🔊（zh-TW）／⤢（lang:'zh-TW'）、中→日氣泡 🔊（ja-JP）／⤢（ja+zh）零變化。
- [ ] **語言碼判準**：`cmn-Hant-TW` 仍只出現在 speechToText 語境（Task12 §4.3 grep 重跑）。
- [ ] 真機發聲／音色（zh-TW voice 實際挑選）歸 Olina 部署後 iPhone 流程外驗收（referer 鎖 github.io，QA 走 mock）。

## 9. spec 縫隙

**無阻擋性縫隙**——spec 已把守門共用、直呼契約、註解更新、非範圍護欄寫死。兩則驗證性補註（零碼、供 QA 對照）：

- translate 空結果時 `App.speak(falsy)` no-op（tts.js 既有守門），兩方向同特性，非新風險。
- 自動播中文中按錄音／切分頁的中斷路徑全靠既有 cancel 鏈（§4），本 Task 零新增清理碼。

## 10. 閉環時同步事項（回報 PM，不阻擋開工）

- `Task12.api.md` 語言碼對照表 TTS 欄「`zh-TW`（僅重播鈕）」自本 Task 起成為歷史語意——該檔為閉環存檔不回改，行為新權威 = `Task13.spec.md`（spec 已載，此處提醒閉環時 SYSTEM_MAP 同步）。
- SYSTEM_MAP `translate-tab.js` 條目「中→日自動播 ja（限 translate 當前分頁）」須於 PM 閉環時更新為「雙向自動播（zh→ja-JP／ja→zh-TW，G4 守門共用）」；sw.js 條目版本註記 v11→v12。
