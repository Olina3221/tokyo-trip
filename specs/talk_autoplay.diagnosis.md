# Diagnosis — 對話模式（面對面 v15）自動播放消失

- Date: 2026-07-12
- Diagnostician session: Claude（冷 context，未背修復動能）
- 目標 repo: `C:\Python Project\tokyo-trip\`（HEAD 25dba8d = Task6，畫面版號 v15·07/12）
- 問題類型: **行為沒生效類**（「改版後（Task15 面對面）舊行為（Task13 雙向自動播）不見了」）。地板 = ①實際生效路徑 ②覆蓋來源 ③快取／建置產物 ＋ 獨立性檢查。
  - 註：本症狀同時帶「狀態消失」語氣，故加驗死亡／覆蓋路徑，fail-closed 往上加。
- 症狀（Olina 實機）: v15「面對面」對話模式**沒有自動播語音**了。Task13（雙向自動播）她曾實機確認正常；Task15 改面對面版面後回報自動播沒了。已排除「更新沒吃到」（她看到 v15 徽章＋確實看到面對面版面）。未明確是單向或雙向都沒。

---

## 關鍵前提事實（貫穿全部根因判定）

1. **自動播程式碼在 v15 逐位元等同 Task13。** `git diff 5b685c1(Task13) e3bbd01(Task15)` 對 `_processTalk` 的 G4 守門＋speak 呼叫是「四行 context、零 +/- 」；Task15 只改「顯示寫入」那一行（`_appendBubble` → `_setSideResult`）。現檔 `js/translate-tab.js:531-536`：
   ```js
   // G4：自動播條件 = translate 為當前分頁 && 模式仍為 'talk'
   var section = document.getElementById('tab-translate');
   var curMode = _getMode();
   if (section && !section.hidden && curMode === 'talk') {
     App.speak(result, (lang === 'zh') ? 'ja-JP' : 'zh-TW');
   }
   ```
2. **她看到的面對面版面，就是同一支 v15 `translate-tab.js` 畫出來的**（`_buildTalkDOM` 面對面雙側結構在同檔 L621-777）。版面出現 = 該檔已載入並執行 = 上面的 autoplay 區塊也在同一份已載入的碼裡。這一條把「版本／快取供舊碼」在證據上釘死為排除。
3. **`speak` 收的是原始 `result` 字串，與 DOM 無關。** `App.speak(result, lang)` 傳入的是翻譯 API 回傳字串，不讀任何 DOM 節點。旋轉容器（`.talk-side-ja` rotate 180）、覆蓋槽 `.talk-side-result` 是純顯示，改不動送進 `speechSynthesis` 的字串。
4. **真機「發聲」從未被 mock QA 覆蓋。** Task12/13/15 三次 QA 都只驗「`App.speak` 被呼叫恰一次」，真機 zh-TW/ja-JP 實際出聲一律標「歸 Olina 部署後 iPhone 流程外驗收」（DEVELOPMENT_LOG L74/L96、Task13.spec §QA-7、Task15.impact §3）。故「speak 有被呼叫」與「iPhone 真的出聲」之間那段，程式碼側從來沒有證據，只有 Olina 的實機觀察。
5. **tts.js 自 Task12 後未再被動過**（`git log -- js/tts.js` 僅 Task1-3、Task12 兩筆）。全域 `App.speak` 契約無變。

---

## 根因路徑（地板逐欄 + 每欄證據 + 成立/排除判定）

### ① 實際生效路徑（speak 真正被呼叫的地方）
- **RC-A　v15 缺自動播邏輯（版本/快取供舊碼）** — **確認排除**。
  證據：前提 1+2。autoplay 區塊在 v15 現檔 `translate-tab.js:531-536`，與 Task13 逐位元相同；面對面版面出現證明該檔已載入執行。sw.js 為 per-version atomic cache（`sw.js:88-100` activate 刪舊 cache、install 重抓全 `PRECACHE_URLS`），`translate-tab.js` 在清單內（`sw.js:61`），v15 啟用時必被重抓，不可能與 `version.js` 分屬不同世代。
- **RC-B　顯示寫入在 speak 前 throw、擋掉 speak** — **確認排除**（程式碼實證）。
  證據：resolve 回呼是線性無 early-return（`translate-tab.js:523-536`）。speak 前只有 `_updateTalkUI()`（L525）與 `_setSideResult()`（L529）。兩者只寫 `_buildTalkDOM` 已建的 `_talkEl.*` 節點的 `.textContent`/`.disabled`/`.scrollTop`（L469-488、L386-446），無取用可能為 null 的節點、無會 throw 的呼叫；`textContent=` 賦值在旋轉/overflow 容器上不會拋例外。
- **RC-C　G4 守門條件在面對面版失真（section.hidden / mode 判錯）** — **確認排除**。
  證據：`section.hidden` 由 `app.js:64-66` `showTab` 設為 `(tabId !== id)`；她停在 translate 分頁時 = `false`，故 `!section.hidden` = true。`_getMode()` 預設 `'talk'`（`translate-tab.js:360-367`），她正在用對話模式 = `'talk'`。守門與 Task13 同語意（Task15 QA 已逐字驗，DEVELOPMENT_LOG L96「守門碼恰一份 L534」）。
- **RC-D　旋轉/覆蓋槽 DOM 破壞導致 speak 收到空字串** — **確認排除**。
  證據：前提 3。speak 讀 `result`（translate 回傳字串），非讀 DOM。只有 `result` 本身為空才 no-op（`tts.js:105` `if(!text)return`），但那同時代表「連譯文都沒顯示」——與她「看得到面對面版面」不符（若連翻譯都失敗，會走 catch 顯示錯誤文案 L538-545，不是靜默）。

### ② 覆蓋來源（誰在 speak 之後把它 cancel 掉）
- **RC-E　speak 排程後被 `App.speak.cancel()`／`speechSynthesis.cancel()` 蓋掉** — **正常聆聽流程確認排除**。
  證據：全庫 cancel 呼叫點＝(a)`_onMicClick` idle→錄音開頭（`translate-tab.js:585`，需她再按一次 mic 才觸發）；(b)`_abortTalk`（L379，僅切分頁 `showTab` wrap L889 或切模式 L792 觸發）；(c)camera-tab 切走 camera 分頁（`camera-tab.js:646`，守門限 camera 可見）；(d)bigtext 關 overlay（`bigtext.js:61`）。「說完→聽譯文」這條正常流程中，speak 排 16ms timer（`tts.js:117`）後無任一 cancel 會在該窗口內或之後自發觸發。
  - 殘留可疑（需真機驗）：若她**自動播才剛出聲就立刻按對面 mic 想回話**，(a) 會先 `cancel()` 清掉正在播的 TTS——這是設計上的防回授（Task12 §1），非 bug，但實機上會讓「聽到一半被切斷」被感知成「沒播」。列為 RC-E' 供真機釐清。
- **RC-F　tts.js/App.speak 被 Task14/Task6 全域改壞** — **確認排除**。
  證據：前提 5（tts.js 未動）。Task14 只加版號徽章＋PWA 更新（`app.js:112-189`，不碰 speechSynthesis）；Task6 camera 的 speak.cancel 有 camera 守門（`camera-tab.js:638-647`）。phrases/bigtext 的 `App.speak` 呼叫路徑仍在（`phrases-tab.js:186`、`bigtext.js:119`），全域 TTS 未壞。

### ③ 快取／建置產物（讀到舊的）
- **RC-G　GitHub Pages/SW 供中繼舊版（含自動播前的版本）** — **確認排除**。
  證據：同 RC-A。她看到 v15 徽章（`version.js` APP_VERSION='v15'）＋面對面版面（v15 `translate-tab.js`），兩檔同世代同 cache（`sw.js` CACHE_VERSION='v15'，`sw.js:18`）。

### 獨立性檢查
- 已排除的 RC-A~G 彼此獨立確認：關掉任一條不會連帶造成另一條的排除失效（版本、DOM-throw、守門、字串來源、cancel、全域 tts、快取分屬不同機制，各自單獨蒐證）。
- **未排除的 RC-H/I/J（見下）彼此獨立**：iOS 手勢解鎖（RC-H）、錄音後音訊 session 卡 record（RC-I）、單向 voice 缺失（RC-J）是三個獨立的 iOS runtime 機制，堵一條不影響另兩條——這正是本題必須交 Olina 真機逐條排除、不能由碼自證「找齊了」的核心。

---

## 程式碼側無法判定、需真機驗證的根因（本題真正的存活路徑）

程式碼側整條鏈（mic tap → recorder → STT fetch → translate fetch → G4 守門 → `App.speak` → `speechSynthesis.speak`）每一環都確認完好且會被走到。症狀若為真，只能落在「`speechSynthesis.speak()` 被呼叫之後、iPhone 實際出聲之前」這段 **iOS runtime 黑箱**——而這段從未被任何 mock QA 覆蓋（前提 4）。以下三條為獨立的 iOS 機制，**只能真機驗**：

- **RC-H　iOS speechSynthesis 首次發聲需 user gesture，自動播發生在 async fetch 回呼（非直接手勢）** — **需真機驗證（最可疑之一）**。
  依據：Task12 已知 iOS 紅線只針對 `getUserMedia`（Task12.spec §94、impact R4），**speechSynthesis 自身的「首個 utterance 必須由使用者手勢觸發」限制從未被處理或測過**。自動播的 `App.speak` 在 `translate(...).then` 回呼裡跑（`translate-tab.js:535`），距離按 mic 的手勢已隔了兩個 await（STT＋translate fetch），iOS 可能判定非手勢脈絡而靜默 `speechSynthesis`。
  為何 Task13「曾正常」而現在沒了：極可能是**是否先被手動 speak「解鎖」過**的差異——Task13 直式氣泡版她可能先按過氣泡 🔊 重播、或先用了常用句/大字的播放鈕，把該 session 的 speechSynthesis 解鎖了，之後自動播才響；面對面版她直接進對話、雙方輪流講，可能整場沒先手動觸發過任一 speak，第一次自動播就被 iOS 擋。屬「有時會有時不會」的手勢相依，非碼可判。
  驗證方向（非修法）：真機做兩組對照——(甲) 一進 App 直接對話、全程不按任何播放鈕，看首次自動播是否無聲；(乙) 先在常用句/大字手動播一次再進對話。若甲無聲乙有聲 → RC-H 成立。

- **RC-I　錄音（getUserMedia）後 iOS 音訊 session 停在 record 類別，speechSynthesis 被靜音/導到聽筒** — **需真機驗證**。
  依據：`recorder.js` `_release()`（L57-70）close AudioContext、stop tracks，但無法保證 iOS AVAudioSession 從 record/playAndRecord 切回 playback；此為已知 iOS 行為，會使緊接的 `speechSynthesis` 無聲或音量極小。此機制 Task13 亦存在，但表現隨 iOS 版本／是否插耳機／靜音鍵而異，可能近期才顯現。
  驗證方向：真機比對「錄音→自動播」與「純手動按播放（未先錄音）」兩情境音量差；試切換手機靜音實體鍵。

- **RC-J　單一方向 voice 在她裝置缺失（zh-TW 或 ja-JP）** — **需真機驗證（若為單向失效）**。
  依據：`_pickVoice`（`tts.js:64-80`）精確→前綴→null，找不到回 null 讓系統自選；若系統缺該語言 voice，該方向靜默、另一方向正常。Olina 未明確單/雙向，這條專門覆蓋「只有一個方向沒播」的可能。
  驗證方向：真機分別測中→日（聽日文）與日→中（聽中文），確認是雙向皆無或單向無。

---

## 覆蓋宣告

- **檢查方式**：從 Olina 的操作手勢起點（按 mic）沿唯一那條非同步鏈逐環追到 `speechSynthesis.speak()`，每一環用 file:line＋git diff（Task13↔Task15/現檔）驗其是否被改動、是否被走到、是否會 throw、是否被覆蓋。另橫向掃全庫所有 `speak`/`cancel`/`speechSynthesis` 呼叫點確認無旁路干擾。
- **清單以外是否還有其他機制**：我把成因分成三段——(1) 碼是否還在且被走到（RC-A~D、RC-G）、(2) 是否被別的碼覆蓋掉（RC-E、RC-F）、(3) 碼呼叫了但 iOS runtime 沒出聲（RC-H~J）。第 (1)(2) 段可由碼實證，全部排除；第 (3) 段本質是 OS 黑箱，程式碼側不可判，已列齊我所知的三條獨立 iOS 機制。
- **信心**：對「這不是 translate-tab.js/tts.js 的程式碼回歸」信心高（git diff 逐位元＋面對面版面出現的反證）。對「iOS runtime 三條哪一條成立」信心低——刻意不猜，交真機。
- **已知盲點**：
  1. 我無 iPhone 實機與該 iOS 版本，RC-H/I/J 無法由我收斂，須 Olina 真機。
  2. 未實際跑起本機頁面做動態 console 觀察（本機 referer 非 github.io，Google API 必 403，talk 全鏈無法真跑；且真機是 Safari/iOS，本機 Chrome 重現不了 iOS 音訊限制，動態重現價值低，故以靜態＋git 實證為主）。
  3. 「Task13 曾正常」僅有 Olina 口述，無當時 session 錄影；RC-H 的「是否先解鎖」假設無法回溯驗證，只能靠對照實驗前瞻確認。

## 結論

- 根因數量：**已排除 7 條（RC-A~G，皆程式碼實證）＋ 存活待真機 3 條（RC-H iOS 手勢解鎖／RC-I 錄音後音訊 session／RC-J 單向 voice 缺失，彼此獨立）**。
- 全部已列舉：**是**（程式碼側鏈路窮舉完畢並全排除；iOS runtime 側列齊三條已知獨立機制）。
- 最可疑：**RC-H（iOS speechSynthesis 首發聲需手勢、自動播在 async 回呼）**，其次 RC-I；若 Olina 回報為單向失效則 RC-J 升為首位。三者需 Olina 依上述對照實驗逐條排除後，才由 Olina 蓋章確認覆蓋完整（`.diagnosis_approved`），再進 pipeline。

> 協定備註：diagnosis.md 明訂 Diagnostician 不得提修法；本檔「驗證方向」是把 needs-verification 根因轉為 confirmed/ruled-out 的**排查動作**，非 patch/實作，僅為滿足本次任務「每根因對應方向但不實作」的要求，未觸及程式變更設計。

---

## Olina 真機確認（2026-07-12，orchestrator 代記）

- 症狀確認為 **(a)**：按麥克風、說完話後，**翻譯文字有出現，只是沒有唸出聲**。→ 整條辨識/翻譯/顯示鏈正常，症狀**純粹落在 speechSynthesis 發聲這一步**。
- **兩個方向（中→日、日→中）都沒有自動發聲** → 排除 RC-J（單一方向 voice 缺失）。
- **確認要修的存活根因＝ RC-H（iOS speechSynthesis 首發聲需 user gesture，自動播在 async 回呼被擋）＋ RC-I（錄音後 iOS 音訊 session 未切回 playback）**，兩條一起修（無法在本機廉價區分、且併修安全）。
- 程式碼側 RC-A~G 全數排除（見上）。
- Olina 已口頭核准此診斷完整性並同意修法方向 → 建立 `.diagnosis_approved`。
