# Task6.impact.md — 拍照辨識日文 影響範圍分析（SA）

> 對象 spec：`specs/Task6.spec.md`。
> **增量複核（2026-07-12，基線＝Task15 閉環後）**：本檔初版以 v12 基線撰寫；Task14/15 插隊改動基線後，原 `Task6.sa_done` 作廢、PM 重建 `.ready`。本次為**增量複核**——只更新基線變動處（§0-bis），其餘分析經對照現況程式碼確認仍成立、原文沿用。文中殘留的舊版號（v13/38 筆）皆以 §0-bis 為準。
> 涉及範圍標記：**後端／核心邏輯＋前端 UI 皆有** → pipeline 走 backend → frontend → QA 全程。

---

## 0-bis. 增量複核：新基線差異定案（凌駕本檔其餘處的舊數字）

| 項目 | 舊 impact（作廢值） | 新基線定案（2026-07-12 實讀程式碼） |
|------|--------------------|--------------------------------------|
| 版號 bump | 「只改 sw.js，v12→v13」 | **v14→v15，兩檔三行**（Task14 SOP，權威見 `Task14.api.md` §4／SYSTEM_MAP 人工補充區）：① `js/version.js` `APP_VERSION = 'v15'`（與 CACHE_VERSION **逐字元相等**＝QA 機械閘）② `js/version.js` `APP_VERSION_DATE = 'MM/DD'`（bump 當日台灣時區）③ `sw.js` `CACHE_VERSION = 'v15'` |
| PRECACHE_URLS | 「+camera-tab.js 成 38 筆」 | 現況 **38 筆**（Task14 已 +version.js，實數 grep 確認）→ 加 `./js/camera-tab.js` 成 **39 筆** |
| 檔案異動清單 | spec §8 六檔 | **七檔**：spec §8 六檔＋`js/version.js`（bump 兩行）。QA 的「diff 只觸及異動清單」判準以七檔為準 |
| app.js 基線 | 「app.js 零 diff」（對 v12 基線） | app.js 仍為 Task6 **零 diff 檔**，但基線內容已含 Task14 SW 更新機制段（updateViaCache:'none'、hadController 快照、visibilitychange/pageshow → `_triggerUpdate`、controllerchange＋updatefound 雙路 toast）。QA diff 基準＝當前 HEAD，非舊印象 |
| index.html 基線 | 插入點「index.html:142–143」 | 基線已含 version.js（script 最前，:133）＋`#app-version`（:120）＋`#update-toast`（:123）。camera-tab.js 插入點現況＝**:150（translate-tab.js）之後、:151 `<!-- Task4 功能模組 -->` comment 之前**（語意錨定不變：translate-tab 後、coupon-viewer 前；行號僅供參考，以 comment 錨定為準） |
| translate-tab.js 基線 | Task12 氣泡版 | Task15 已改面對面雙側版面，但 **wrap 層（:883–896）守門邏輯逐字未變**（`id !== 'translate'` ＋ `#tab-translate` 可見 → `_abortTalk()`，call-through）——§2 全部分析經實讀確認仍成立 |

### wrap 鏈層數確認（實讀現況）

現況**三層**：coupon-viewer.js:324（無條件關檢視器）→ translate-tab.js:884（守門 `_abortTalk`）→ bigtext.js:204（無條件關 overlay）→ app.js:60 原函式。camera-tab.js 依 §2.1 位置載入後成**四層**（外→內）：coupon-viewer → **camera-tab** → translate-tab → bigtext → app.js。§2.2 守門互斥分析（同時只有一個 section 非 hidden）在 Task15 新版面下不變——Task15 只改 `.talk-container` 內部 DOM，section 可見性機制與 `_abortTalk()` 統一清理入口未動。

### camera 的 visibilitychange 與 app.js（Task14）不互擾定案

新基線下 document 上已有 app.js 的 visibilitychange 監聽（visible → `_triggerUpdate()`，SW update 檢查）。camera-tab.js 的 visibilitychange（hidden → 停 track；visible＋camera 當前＋live 視圖 → 重啟，見 §3.1）是**獨立 listener、零共享狀態**——多 listener 並存各自觸發，順序無關（`Task14.api.md` §2-4 已預告此並存為設計內）。visible 時兩者同時動作（SW update 網路檢查＋getUserMedia 重啟）互不依賴；SW 更新偵測到新版也只彈 toast、**無自動 reload**，不會中斷取景。無需任何協調機制，backend 不得合併兩個 listener。

### 旋轉容器 fixed 陷阱（Task15 永續紀律）確認

camera 分頁（`#tab-camera` section）與 `.talk-side-ja` 旋轉容器無任何祖先關係——camera 分頁內容不受 transform containing block 影響。camera 分頁本身無 fixed 元素需求（取景為分頁內容、overlay 只重用掛 body 的 bigtext），紀律天然滿足，無新增約束。

---

## 0. 結論速覽

1. `App.api.ocr` 為**單參數** `ocr(imageBase64)`（Task6.spec §3 為權威；Task5.api.md 的 `(imageBase64, mimeType)` 是舊草描，作廢——Vision `image.content` 自動偵測格式，mimeType 無用）。api.js 其餘全部零 diff，Vision 2xx 內嵌錯誤在**端點層自查**，共用分類器不動。
2. wrap 鏈擴為四層（外→內）：coupon-viewer → **camera-tab** → translate-tab → bigtext → app.js。四層守門條件互斥或冪等，**不互殺**（§2 定案）。
3. 相機生命週期定案：track 停止時機四處（拍照後／離開分頁 wrap／visibilitychange hidden／pagehide）；重啟一律**新建 stream**（stopped track 不可復用）。iOS 七陷阱逐條落地約束見 §3。
4. onShow 冪等與相機重啟並存定案：DOM 一次、監聽一次；每次 onShow 依「當前視圖＋track 存活」決定是否重啟（§4）。
5. 隱私機械判準：camera-tab.js 全檔零 `localStorage`、零裸 `fetch`、base64 只流向 `App.api.ocr`、objectURL 建/撤配對（§5）。
6. **（增量複核追加）** 版號 bump＝v14→v15 兩檔三行、PRECACHE 38→39、異動清單擴為七檔（＋version.js）、camera 的 visibilitychange 與 app.js Task14 監聽並存不互擾——全部定案見 §0-bis。

---

## 1. api.js：只加 `ocr`，零 diff 邊界與 Vision 內嵌錯誤處理

### 1.1 允許的 diff（唯一）

- 端點層新增 `function ocr(imageBase64) { ... }`。
- 掛載物件加一行 `ocr: ocr,`，並移除既有預留註解行（api.js:170 `// Task6 在此追加：ocr: function(imageBase64, mimeType) { ... }`）——**這是全檔唯一允許刪除的一行**。（增量複核確認：該行現況仍在 :170；註解內的 `mimeType` 二參草描即 §7-a 作廢對象，隨行刪除。）
- 檔頭註解可補一行 ocr 說明（選擇性、additive）。

**零 diff 清單（QA 逐字驗）**：`_getKey` / `ErrorCode` 枚舉五碼 / `_classifyError` / `_postJson` / `translate` / `speechToText` 位元組級不變。

### 1.2 Vision 特有：2xx 內嵌逐圖錯誤（不改共用分類器的處理方式）

Vision 的錯誤有兩型，處理位置不同：

| 錯誤型 | 樣態 | 誰處理 |
|--------|------|--------|
| HTTP 級（403/429/其他非 2xx、網路失敗） | 頂層 `{ error: { message } }` ＋非 2xx 狀態碼 | `_postJson` → `_classifyError` 既有路徑，**零改動**（Vision 錯誤體格式與 Translation/Speech 相同，分類器天然通吃） |
| 逐圖級（圖太大/格式壞/內部錯誤） | **HTTP 2xx** 但 `responses[0].error = { code, message }`（code 是 gRPC 數字碼，非 HTTP 碼） | **ocr 端點層 `.then` 內自查**：發現即 `reject({ code: ErrorCode.HTTP_OTHER, message: error.message })` |

端點層取值順序（定案）：

```
_postJson(url, body).then(data =>
  1. data.responses?.[0]?.error 存在 → reject { HTTP_OTHER, error.message }
  2. responses[0].fullTextAnnotation?.text → resolve 之
  3. fallback responses[0].textAnnotations?.[0]?.description → resolve 之
  4. 皆無（含 responses 缺失/空陣列）→ resolve ''   ← 空結果非錯誤，比照 speechToText
)
```

**不得**把 gRPC 數字碼映射到 HTTP_403/429——spec 已釘 HTTP_OTHER，映射是過度設計且碼表語意不同。

### 1.3 其他約束確認

- URL：`https://vision.googleapis.com/v1/images:annotate?key=` + `encodeURIComponent(key)`；走 `_postJson` → POST-only 自動繼承，sw.js 零特例（method!==GET 直通檢查已涵蓋）。
- 無 key → `reject({ code: NO_KEY })`，與 translate/speechToText 同款前置檢查。
- 請求體照 spec §3：`TEXT_DETECTION` 單 feature ＋ `languageHints: ['ja']`。SA 評估：主用途是招牌/菜單（稀疏場景文字），`TEXT_DETECTION` 正確；`DOCUMENT_TEXT_DETECTION` 偏長文件密排版，**無證據需要改**，維持拍板值。機械判準：全 repo grep `DOCUMENT_TEXT_DETECTION` = 0 hits。
- `imageBase64` 必須是 raw base64（無 `data:image/jpeg;base64,` 前綴）——剝前綴責任在 camera-tab.js（呼叫端），api.js 不做防禦剝除（保持端點層薄）。

---

## 2. wrap 鏈四層：疊加順序與守門互斥定案（本次最高風險項）

### 2.1 載入順序 → 鏈序

`camera-tab.js` 載入行插在 `translate-tab.js` 之後、`coupon-viewer.js` 之前（現況 index.html:150–151 之間，即 comment「Task4 功能模組」之前；以 comment 錨定，行號僅參考）。wrap 是載入時捕獲當時的 `App.showTab`，故鏈序＝載入順序**反向**：

```
App.showTab(id) 呼叫時穿越（外→內）：
  coupon-viewer.js  無條件 _closeViewer()（未開時 no-op，冪等）
→ camera-tab.js     守門：#tab-camera 可見 && id !== 'camera' → 停 camera track ＋ App.speak.cancel()
→ translate-tab.js  守門：#tab-translate 可見 && id !== 'translate' → _abortTalk()（abort 錄音＋cancel TTS）
→ bigtext.js        無條件 _closeOverlay()（未開時 no-op，冪等）
→ app.js 原函式
```

### 2.2 為什麼不互殺（QA 迴歸依據）

- **camera 層與 translate 層守門條件互斥**：兩層都以「自己的 section 當前可見」為前提，而同一時刻只有一個 section 非 hidden（app.js showTab 保證）——離開 translate 時 camera 層必不觸發（camera hidden），反之亦然。translate 對話模式錄音中切去 camera 分頁：只有 translate 層動作（abort 錄音），camera 層 no-op。
- **兩個無條件層（coupon-viewer / bigtext）靠冪等自保**：關閉未開的 overlay 是 no-op，疊幾層都無害。
- **導覽列重按當前分頁**：`id === 'camera'` 時 camera 層不動作 → 取景不中斷（spec §7 釘死）；同理 translate 重按不斷錄音（Task12 既有）。
- **camera 層加 `App.speak.cancel()` 的守門正當性**（SA 補充定案，見 §7-e）：cancel 只在「camera 可見且要離開」時觸發，不可能誤殺常用句/翻譯分頁進行中的播音（那些情境下 camera 必為 hidden）。與 Task12 translate 層「cancel 限自己分頁可見」同一紀律。
- **call-through 鐵律**：camera 層必須 `return _prev(id)`，且捕獲時機在 IIFE 尾端（比照 translate-tab.js:815–828 範式：`if (App && typeof App.showTab === 'function')` 防禦）。

### 2.3 迴歸測試面（wrap 相關）

新第四層插入後，既有三層行為必須零變化：切分頁關券檢視器、關大字 overlay、translate 錄音 abort＋TTS cancel、app.js 記憶 lastTab＋觸發 onShow。QA 用計數 stub 驗四層各被穿越一次。

### 2.4 雙 overlay 互斥疑慮解除

SYSTEM_MAP 人工補充區曾預警「Task6 相機預覽→OCR 大字最可能踩同分頁雙 overlay」。**實際不會發生**：定案設計中取景區是分頁內容（非 overlay、不佔 z-index 分帶），camera 分頁唯一 overlay 是重用的 bigtext（z=100）——單 overlay，無互斥問題，**不需要 bigtext 公開 close API**，該預警對 Task6 解除（人工補充區已同步註記）。

---

## 3. 相機生命週期與 iOS 陷阱逐條細化（spec §5 七條 → backend 落地約束）

### 3.1 track 停止時機（四處，全走同一個 `_stopStream()`）

| 時機 | 觸發 | 說明 |
|------|------|------|
| 拍照取得幀後 | 快門 handler 內，drawImage 完成即停 | 省電＋隱私（spec 釘死） |
| 離開 camera 分頁 | wrap showTab 第四層（§2） | 守門條件見上 |
| App 進背景/鎖屏 | `document.addEventListener('visibilitychange')`：`document.hidden` 為 true 且 track 存活 → 停 | **SA 定案：要做**。iOS 背景本會 mute/end camera stream，但主動停讓狀態機確定、綠點熄滅。（增量複核：與 app.js Task14 的 visibilitychange SW 更新監聽為獨立 listener 並存，零共享狀態不互擾，見 §0-bis；**不得合併進 app.js 的 listener**） |
| 頁面卸載 | `pagehide` 同一 handler | belt-and-braces 一行，成本近零 |

`_stopStream()` 範式比照 recorder.js `_release()`（R5 精神）：`getTracks().forEach(t => t.stop())` 包 try/catch、`video.srcObject = null`、stream 參照歸 null。visibilitychange/pagehide 監聽**在 init 註冊一次**（冪等，掛 document 不掛 section）。

**背景返回**：visibilitychange 轉 visible 時，若 camera 為當前分頁且視圖＝live 取景 → 自動重啟 stream（否則使用者看到黑畫面）；其餘情況不動。

### 3.2 七條陷阱落地約束

1. **video 三件套＋顯式 play()**：`<video>` 同時設 HTML attribute（`playsinline muted autoplay`）與 JS property（`video.playsInline = true; video.muted = true`）——iOS 版本間有只認其一的歷史；`srcObject` 設定後顯式 `video.play()`，其 Promise **reject 時降級**（muted 下程式化 play 一般被允許，reject 即視同 live 不可用）。
2. **權限被拒分類**：`NotAllowedError`/`SecurityError`/`NotFoundError`/`NotReadableError`/`OverconstrainedError`/`AbortError` 全部 → 降級模式＋友善訊息（spec §6 文案），**不壞頁**（比照 recorder.js `_classifyGumError` 分類面，但 camera 不需細分錯誤碼——一律進降級）。
3. **standalone 可用性**：iOS standalone PWA 的相機權限**不跨啟動持久**（每次冷啟可能重新彈窗）；使用者拒絕或版本不支援都走同一條降級路。**降級 UI 的兩個 file input（相簿＋capture）必須無條件建在 DOM**（不依賴 live 偵測結果），這是降級無條件可用的結構保證。
4. **12MP 防爆記憶體**：先算目標尺寸（長邊 ≤1600 等比），**直接建目標尺寸 canvas、單次 `drawImage(src, 0, 0, tw, th)` 縮圖一步到位**——禁止先建全尺寸中介 canvas。live 幀取 `videoWidth/Height`（為 0 時 no-op 防未就緒）；用完把大圖參照歸 null。
5. **EXIF 方向（相簿/原生拍照路徑）**：**定案走 `<img>` 解碼路徑**——`URL.createObjectURL(file)` → `<img>` onload → drawImage 到目標 canvas → `revokeObjectURL`。iOS 13.4+ 的 `<img>` 解碼與 drawImage 遵循 EXIF 方向（iOS 16 假設下安全）；**禁用 `createImageBitmap(file)`**——iOS 對其 EXIF 方向支援殘缺（`imageOrientation` 選項晚至近版才有），是本條陷阱的具體形狀。live video 幀無 EXIF 問題。若 Olina 真機驗收發現橫圖，回報 PM 屬新證據再議。
6. **重啟＝新建 stream**（比照 recorder R2 紀律，且技術上必然）：`track.stop()` 後的 track 不可復活，每次重啟取景一律重新 `getUserMedia`；`<video>` 元素本身重用（只換 srcObject），DOM 不重建。
7. **file input 取消選圖**：iOS 取消不觸發 `change` → **開啟選擇器前不得先進 processing 狀態**，只在 `change` 且 `files.length > 0` 才進；讀取後 `input.value = ''` 重置（否則同一張照片選第二次不觸發 change）。開相簿期間 live track 不主動停（iOS 系統選擇器蓋上時多半觸發 visibilitychange，走 3.1 的統一路徑）。
   - 附註（非阻斷）：iOS 對 `accept="image/*"` 的 file input 預設會把 HEIC 轉 JPEG 交付；即使原生 HEIC 滲入，`<img>` 解碼→canvas 再編碼 JPEG 的管線仍成立。

### 3.3 降級黏性（SA 補充定案）

單一 App session 內，getUserMedia 一旦因權限拒絕/不可用而降級，**本 session 不再自動重試**（sticky 旗標存記憶體）——避免每次進分頁重彈權限窗騷擾。下次冷啟自然重置。play() reject 或 track 意外 ended 造成的降級同樣黏性處理（簡單一致）。

---

## 4. onShow 冪等 vs 相機重啟：並存定案

相機是有生命週期的資源，與既有分頁「一次性建 DOM」不同，拆成兩層：

- **冪等層（只做一次）**：DOM 建構、事件監聽（含 visibilitychange/pagehide）、file input 建立——`_initialized` 旗標守門，比照 translate-tab 範式。
- **生命週期層（每次 onShow 執行）**，依「當前視圖＋track 存活」分派：

| 進入時狀態 | onShow 行為 |
|------------|-------------|
| 首次進入 / 視圖＝取景、track 已停（曾拍照或被 wrap/背景停掉） | 嘗試 `getUserMedia` 重啟（受 §3.3 黏性降級旗標約束） |
| 視圖＝取景、track 存活（導覽列重按 camera → wrap 不停 → onShow 再觸發） | **no-op**（不重建 stream、不閃畫面）——track 存活判準：`_stream?.getVideoTracks().some(t => t.readyState === 'live')` |
| 視圖＝結果視圖（上次拍完離開又回來） | **保留結果視圖、不重啟相機**（原文/譯文仍有價值）；使用者按「重拍」才回取景並重啟 |
| 降級模式（黏性旗標已立） | 顯示降級取景區，不呼叫 getUserMedia |
| 處理中（辨識/翻譯 fetch 在途中離開又回來） | 維持 processing UI；fetch resolve 後照常轉結果視圖（對 hidden section 更新 DOM 無害，不需 AbortController，見 §7-f） |

---

## 5. 隱私機械判準（QA 可執行）

1. `localStorage` 在 `js/camera-tab.js` 全檔 grep = **0 hits**（連 try/catch 包裝都不准有——本 Task 零新增 key）。
2. `fetch(` 在 camera-tab.js grep = **0 hits**（所有網路呼叫只准經 `App.api.*`；base64 唯一出口＝`App.api.ocr` 引數）。
3. `console.log`/`console.warn` 不得輸出 base64/圖像變數（避免 remote-debug 殘留）；grep 檢查 log 引數無 `base64`/`dataUrl` 類變數名。
4. `URL.createObjectURL` 與 `revokeObjectURL` 出現次數配對（建一個撤一個）。
5. 影像參照（canvas/blob/img.src/base64 變數）在「重拍」與離開分頁時歸 null / 清空；不掛任何 `window.*` 全域。
6. `git status`：無新增 tracked 圖檔/二進位；diff 只觸及 §8 異動清單六檔。
7. 既有三段式隱私掃描照常（工作樹 grep＋TT1 base64 解碼＋`git log -p`）。

---

## 6. 受影響的既有功能（影響表）

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 分頁切換框架 | 全五分頁 / `App.showTab` | wrap 鏈三層→四層，穿越順序與守門見 §2 | ✅（四層 call-through＋lastTab＋onShow 觸發） |
| 翻譯對話模式 | translate / `_abortTalk` wrap 層 | 新層插其外側，錄音 abort/TTS cancel 行為必須零變化 | ✅（錄音中切 camera 分頁→abort 正常；重按 translate 不斷錄） |
| 券圖檢視器 | coupons / coupon-viewer wrap 層 | 最外層不變，開著檢視器切分頁自動關 | ✅ |
| 大字展示 | 常用句/翻譯/行程/`App.showBigText` | camera 重用 ja-only 路徑（`.bigtext-sub` 不渲染，Task2 B3）＋預設 lang='ja-JP'；元件零 diff | ✅（camera 開大字→切分頁自動關＋cancel） |
| TTS | 常用句/翻譯 / `App.speak` | camera 呼叫 `speak(原文)` 單參預設 ja-JP；元件零 diff；camera wrap 的 cancel 有守門不外溢 | ✅（常用句播音中進出 camera 不被 cancel） |
| API 呼叫層 | translate 雙模式 / `api.js` | 端點層加 ocr；translate/speechToText 零 diff（§1） | ✅（文字翻譯＋對話 STT 冒煙） |
| 離線快取＋版號機制 | 全站 / `sw.js`＋`js/version.js` | **v14→v15 兩檔三行**（§0-bis）＋PRECACHE +`./js/camera-tab.js`（**39 筆**）；bump 付 16 券圖重下成本（已知，行前 wifi 可接受）；version.js 只動兩常數值，app.js 更新機制/徽章/toast 零 diff | ✅（冷 install 驗法照 SYSTEM_MAP 紀律＋APP_VERSION 逐字元相等閘） |
| App shell | 全站 / `index.html` | `#tab-camera` 佔位換實體＋插一行 script（:150–151 之間，comment 錨定）；section 本體/分頁 id/其餘載入順序（含 version.js 最前）/#app-version/#update-toast 不動 | ✅（五分頁可切、載入無 console error） |
| 全站樣式 | 全站 / `css/style.css` | 只增 `.camera-*` 節；既有選擇器零 diff | ✅（`--fs-*` 越界掃描＋既有頁面目視） |

## 6a. Backend 注意事項

- **bump 用兩檔三行 SOP（§0-bis）**：`version.js` APP_VERSION='v15'＋APP_VERSION_DATE＝bump 當日＋`sw.js` CACHE_VERSION='v15'，三行同 commit；漏 version.js＝QA 逐字元相等閘 FAIL。
- api.js 唯一允許刪除的行＝掛載處預留註解（:170）；其餘見 §1 零 diff 清單。
- camera-tab.js 結構比照 translate-tab.js 範式：IIFE、`registerTab('camera', { onShow })`、檔尾 additive wrap。
- 取景區若做深底（video 上的掃描框/提示字），文字/框線色**區域硬編碼**，不得引用 `--c-bg`/`--c-text` 等會翻轉的全域變數（Task8 解耦紀律，SYSTEM_MAP 深底清單將僅在 QA 確認後維持不變——video 區塊不是 overlay，不入 z-index 分帶）。
- 快門/相簿鈕 processing 期間 disabled 防連點（比照 translate `_isTranslating` 範式）。
- 「重試翻譯」鈕：保留 OCR 原文變數重呼叫 `App.api.translate(text,'ja','zh-TW')`，期間鈕 disabled；重拍即清空。
- 錯誤文案照 spec §6 對映表；camera 自己維護對照表（不 import translate-tab 的私有常數——各檔 IIFE 隔離）。

## 6b. Frontend 注意事項

- 本次涉及的既有頁面：僅 `index.html` 的 `#tab-camera` section 內容替換（整塊換 `.placeholder-card`，**不改 section 標籤本體與 id**）。
- `.camera-*` 前綴、字級全硬編碼（禁 `--fs-*`）、底部操作列 `flex-shrink: 0`（`.tab-section` flex 壓縮風險，Task11 U2 紀律）、快門 ≥64px、動作鈕 ≥44px。
- 文字色用 `--c-accent-text` 不用 `--c-accent`（對比紀律）；無新增 z-index ≥100。
- script 行插入位置：`translate-tab.js` 之後、`<!-- Task4 功能模組 -->` comment 之前。

## 6c. QA 迴歸測試清單

- [ ] api.js diff 審查：只加 ocr＋掛載行，§1.1 零 diff 清單逐項過
- [ ] Non-scope 檔零 diff（**對當前 HEAD 基線**，含 Task14/15 已落地內容）：translate-tab / recorder / tts / bigtext / app / coupon-viewer / coupons-tab / phrases* / trip* / import-data / tripdata / config* / manifest；version.js **只准動兩常數值**（其餘結構零 diff）
- [ ] diff 總範圍＝七檔（spec §8 六檔＋version.js），無其他檔案觸及
- [ ] wrap 四層 call-through（計數 stub）＋三個既有 wrap 行為零變化（券檢視器關閉、大字關閉、translate abort）
- [ ] translate 錄音中切 camera → abort 正常；常用句播音中進出 camera → 不被 cancel
- [ ] camera track：拍照後停、離開分頁停（wrap）、visibilitychange hidden 停；重按 camera 導覽鈕不中斷取景
- [ ] mock Vision：成功／空結果（resolve ''）／2xx 內嵌 `responses[0].error`（reject HTTP_OTHER）／403／429／offline 六情境
- [ ] 降級路徑：模擬 getUserMedia reject → 降級 UI＋兩個 file input 存在可觸發；file input 取消選圖不卡 processing
- [ ] OCR 成功＋翻譯失敗 → 顯示原文＋錯誤文案＋重試翻譯鈕
- [ ] 版號機械閘：sw.js `CACHE_VERSION='v15'`＋version.js `APP_VERSION='v15'` **逐字元相等**＋`APP_VERSION_DATE`＝bump 當日；PRECACHE **39 筆**含 `./js/camera-tab.js`；冷 install 離線驗法
- [ ] 靜態掃描：POST-only（camera-tab 零裸 fetch）、`--fs-*` 越界＝0、零新增 localStorage key、z-index ≥100 新增＝0、`DOCUMENT_TEXT_DETECTION`＝0、`cmn-Hant-TW` 仍只在 speechToText 語境
- [ ] 隱私：§5 判準 1–7 逐條＋三段式掃描
- [ ] 真 OCR E2E 不在 QA 範圍（referer 鎖，localhost 403 屬預期）；由 Olina 部署後流程外驗收

---

## 7. spec 縫隙補完（SA 定案，backend 依此施工）

- **a. `ocr` 簽名衝突收斂**：Task5.api.md「Task6 重用邊界」寫 `ocr(imageBase64, mimeType)` ——作廢，以 Task6.spec §3 單參數為準（Vision 自動偵測格式）。Task5.api.md 為閉環存檔不回改，冷 context 讀到不得誤守。
- **b. `responses` 整體缺失/空陣列**（2xx）：spec 只列 responses[0] 下欄位缺失——**一併 resolve `''`**（視同沒辨識到，見 §1.2 順序 4）。
- **c. 播音鈕可用性**：spec 未提——比照 translate-tab，`!App.speak.isAvailable` 時播音鈕 disabled。
- **d. 大字鈕呼叫形**：原文大字＝`App.showBigText({ ja: 原文 })`（ja-only，B3 置中路徑）；譯文大字＝`App.showBigText({ ja: 譯文, lang: 'zh-TW' })`（主文字槽放中文，Task12 契約）。
- **e. camera wrap 連帶 `App.speak.cancel()`**：spec 只寫停 track——SA 補定案：離開 camera 分頁同時 cancel TTS（OCR 原文播音不跨頁殘響），守門同 track（camera 可見才觸發），與 Task12 translate 層語意一致、不誤殺他頁播音。
- **f. 在途 fetch 不需 AbortController**：處理中離開分頁，fetch 照常完成、更新 hidden section DOM（無害、無自動播音副作用——camera 結果不自動播）；回到分頁看得到結果，屬可接受行為。不引入 abort 機制（避免過度設計）。
- **g. 快門防未就緒**：live 模式 `videoWidth === 0` 時快門 no-op（stream 尚未出幀）。
- **h. 降級黏性**：§3.3（session 內不重複彈權限窗）。
- **i. 背景返回自動重啟**：§3.1（visible＋camera 當前＋live 取景視圖才重啟）。

---

## 8. SYSTEM_MAP 同步

人工補充區已更新（初版分析時完成，增量複核確認仍在）：wrap 鏈條目「Task6 立案後擴為四層」與 camera 層守門條件；雙 overlay 預警對 Task6 解除（取景為分頁內容非 overlay）。bump SOP 兩檔三行、SW 更新機制、旋轉容器 fixed 陷阱三條目 Task14/15 已補、與本次分析一致，無需再改。實作完成、PM 閉環時再把檔案結構表的 camera-tab.js/sw.js **v15**/PRECACHE 39 落成現況（本 repo 無生成腳本，全人工維護）。
