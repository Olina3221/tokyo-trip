# Task13.spec.md — 對話模式雙向自動播音（日→中也自動唸中文）

## 模組：translate 分頁 對話模式（voice conversation mode，自動播放行為調整）

### 功能描述

對話模式的日→中方向，辨識翻譯完成後**自動用中文語音（zh-TW）唸出譯文**，與中→日自動唸日文對稱——雙向都不用手動按重播，才是「隨行翻譯官」。

### 背景與已拍板決策（不重議）

- 已完成：Task12（對話語音模式）已閉環上線（sw.js v11）。現況：中→日自動播 ja ✓；日→中不自動播，要手動按氣泡 🔊 重播。
- **已拍板（Olina 實機使用後提出）：日→中也要自動播中文。** 她明確說：若日→中要手動按重播，那跟文字版沒兩樣、失去意義。
- **本 spec 正式翻轉 Task12 spec「對話流程 §3」的「日→中不自動播」決定**（該條當時即預留「Olina 實機若要自動播再開調整 Task」——即本 Task）。Task12.spec.md 為已閉環存檔，不回改；本檔為此行為的新權威。
- 中→日方向行為零變更。
- TTS 雙語能力已具備：`App.speak(text, lang)` 支援 `'zh-TW'`（Task12 建），`_pickVoice` 已處理中文音色挑選與 fallback。本 Task 純粹是把日→中方向的自動播放打開，**不動 tts.js**。
- 回授防護已存在：麥克風鈕按下（idle → 錄音）前既有 `App.speak.cancel()`（translate-tab.js `_onMicClick`，Task12 spec §1）——自動播中文中若立刻按錄音，TTS 會先被 cancel，不會喇叭聲進麥克風。**沿用，零變更。**

### 涉及範圍

- [x] 後端／核心邏輯（`js/translate-tab.js` 對話流程自動播放判斷＋`sw.js` CACHE_VERSION bump）
- [ ] 前端／UI（無——版面、氣泡、重播鈕、大字鈕全部維持）

純 backend：backend 完成後直接建 `Task13.done`，跳過 frontend 階段。

### 行為規格

現況（translate-tab.js L545–553，G4 區塊）：

```js
// G4：自動播 ja 條件 = translate 為當前分頁 && 模式仍為 'talk'
if (lang === 'zh') { ...檢查通過... App.speak(result, 'ja-JP'); }
// 日→中不自動播（spec §3）
```

改為**兩個方向都自動播，G4 守門條件（translate 為當前分頁 && 模式仍為 `'talk'`）對兩方向一體適用**：

| 方向 | 自動播 | lang 參數 |
|------|--------|-----------|
| 中→日（`lang === 'zh'`） | 譯文（日文） | `'ja-JP'`（現況，零變更） |
| 日→中（`lang === 'ja'`） | 譯文（中文） | `'zh-TW'`（本 Task 打開） |

實作要求：

1. G4 守門檢查（`#tab-translate` 非 hidden ＋ `_getMode() === 'talk'`）**提出為兩方向共用**，之後依方向選 lang 播——不要複製兩份守門碼。in-flight Promise 在切走分頁／切回文字模式後 resolve 時，氣泡照 append、但**兩方向都不自動播**（Task12 G4 語意延伸至 zh-TW，防在別的分頁突然唸中文）。
2. 播放一律 `App.speak(譯文, lang)` 直接呼叫，不加 isAvailable 檢查——與現況中→日對稱（B4 契約：不可用時靜默失敗）。
3. L553 的過時註解「日→中不自動播（spec §3）」更新為指向本 spec。
4. 氣泡 🔊 重播鈕、⤢ 大字鈕行為零變更（自動播之外仍可手動重播）。
5. **sw.js**：`CACHE_VERSION` bump（開工時實際值 +1；現況 v11 → 預期 v12）。PRECACHE_URLS 零變更（無新檔）。

### 邊界條件 / 錯誤處理

- 自動播中文後立刻按麥克風：既有 `_onMicClick` 開頭的 `App.speak.cancel()` 先清 TTS 再錄音（沿用，本 Task 零變更、QA 迴歸確認仍在）。
- iOS zh-TW 音色由系統決定（`_pickVoice` 精確比對優先→前綴→系統自選，Task12 已處理）；**真機音色與實際發聲由 Olina 部署後流程外驗**，QA 只驗呼叫路徑。
- 翻譯錯誤／辨識空結果路徑不涉自動播，零變更。

### QA 驗收界線（機械判準）

1. mock `App.speak` 後走日→中對話流程（mock recorder＋speechToText＋translate）：譯文 append 氣泡後 `App.speak(中文譯文, 'zh-TW')` 被呼叫恰一次（translate 為當前分頁、模式 talk）。
2. 同流程但 translate 分頁 hidden 或模式已切 `'text'`：氣泡照 append、`App.speak` 不被呼叫（兩方向皆驗）。
3. 中→日流程迴歸：`App.speak(ja譯文, 'ja-JP')` 行為零變化。
4. diff 範圍僅 `js/translate-tab.js` 與 `sw.js`（版本字串一行）；tts.js／recorder.js／api.js／index.html／css 零 diff。
5. sw.js CACHE_VERSION = v12、PRECACHE_URLS 零變更。
6. 文字模式（Task5）與氣泡重播/大字鈕迴歸零變化；`_onMicClick` 的 `App.speak.cancel()` 仍在。
7. 真對話 E2E（真 TTS 中文發聲、音色）歸 Olina 部署後 iPhone 流程外驗收（referer 鎖 github.io，localhost 真呼叫必 403，QA 走 mock）。

### 不在本次範圍（Non-scope，必填護欄）

- 不改中→日自動播行為（含其 lang、時機、守門條件語意）。
- 不碰文字模式（Task5 行為零 diff）。
- 不動 tts.js／recorder.js／api.js／bigtext.js／index.html／css（UI 零變更，重播鈕、大字鈕維持）。
- 不做拍照 OCR（Task6）、不做部署（Task7）、不做 KML 地圖。
- 不動其他分頁（行程／常用句／折價券／重要資料）。
- 不加「自動播開關」設定項（Olina 要的就是預設雙向自動；若實機覺得吵再另開 Task）。
- 不做對話歷史持久化、不改氣泡上限、不動 localStorage key。
- 不改 schema／不碰正式資料（本專案無 DB）。

## 影響範圍分析（SA）

> 完整版見 `Task13.impact.md`（2026-07-12）。涉及範圍：**純 backend**（backend 完成後直接建 `Task13.done`，跳過 frontend）。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 對話 中→日自動播 | translate-tab.js `_processTalk` G4 | 守門外提重構，行為須逐位元等價 | ✅ |
| 對話 氣泡 🔊/⤢、錄音防回授 | `_appendBubble`／`_onMicClick` | 零 diff；cancel 對 zh utterance 有效 | ✅ |
| 文字模式（Task5）／TTS 全域 | translate-tab.js／tts.js | 零 diff（tts.js 不動檔） | ✅ |
| 離線快取 | sw.js | 僅 CACHE_VERSION v11→v12 一行 | ✅ |

### Backend 注意事項
- 唯一改動 = G4 區塊：守門（`!section.hidden && _getMode()==='talk'`）外提為兩方向共用，`App.speak(result, lang==='zh' ? 'ja-JP' : 'zh-TW')`；註解改指向本 spec；守門碼恰一份。
- `App.speak` 直呼不加 isAvailable／try-catch（tts.js 全靜默契約；`_pickVoice('zh-TW')` 精確→前綴→null 系統自選，無 throw 點）。
- sw.js 只改版本字串（開工實測現況 v11 → v12）；PRECACHE_URLS 零變更。

### Frontend 注意事項
- 無 frontend 階段（UI 零變更）。

### QA 迴歸測試清單
- [ ] 日→中 mock 流程：append 後 `App.speak(中文譯文,'zh-TW')` 恰一次；hidden／text 模式時兩方向皆不播
- [ ] 中→日迴歸：`App.speak(ja譯文,'ja-JP')` 行為零變化；守門邏輯恰一處
- [ ] diff 僅 translate-tab.js＋sw.js；CACHE_VERSION='v12'、PRECACHE 零變更
- [ ] `_onMicClick`／`_abortTalk` 的 `App.speak.cancel()` 仍在；文字模式與氣泡動作鈕迴歸
- [ ] `cmn-Hant-TW` 仍只在 speechToText 語境
- 真機 zh-TW 發聲歸 Olina 部署後流程外驗收
