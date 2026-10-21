# Task33.diagnosis.md — 翻譯顯示「沒有金鑰授權」診斷（妹妹 iPhone PWA）

> 2026-10-21 diagnostician（general-purpose 代理，本 repo 無角色檔）。依 `specs/PIPELINE.md` 第 2 節「行為沒生效類」地板。
> 只列根因、不提修法。基準：main `c260c2f`（含 Task32，v29）。
> 環境限制：本容器連不到 github.io 與 googleapis（proxy 403），**無法實呼叫 Google API、無法看線上回應體**；凡需外部實測者標 [推斷] 或 [待 Olina]。
> 證據等級：[碼證]＝repo 原始碼／git 可直接驗；[史證]＝specs／DEVELOPMENT_LOG 紀錄；[推斷]＝依瀏覽器／Google 平台一般行為推論，未實測；[待 Olina]＝只能由手機或 Google Cloud Console 確認。

## 症狀

妹妹 iPhone：Safari 開網址 → 加入主畫面 → 匯入她自己的匯入碼；在 App 內翻譯功能看到「說我沒有金鑰授權，所以不能使用」（Olina 轉述，**非原文**）。Olina 本人目前是否正常：未知。

---

## ① 實際生效路徑

### 1-1 請求發出點與金鑰讀取 [碼證]

| 項目 | 位置 | 內容 |
|---|---|---|
| 金鑰來源（唯一） | `js/config.js:4-6` | `window.APP_CONFIG = { GOOGLE_API_KEY: "…" }`（值不抄錄） |
| 載入 | `index.html:124` | `<script src="./js/config.js" onerror="window._configLoadError=true">`；`_configLoadError` 全 repo 只寫不讀（grep 僅此一處） |
| 讀金鑰 | `js/api.js:22-25` `_getKey()` | `(window.APP_CONFIG && window.APP_CONFIG.GOOGLE_API_KEY) \|\| ''`，每次呼叫即時讀，無快取、無其他來源 |
| 文字翻譯端點 | `js/api.js:95-118` `translate()` | 無金鑰 → reject `NO_KEY`（L97-98）；否則 POST `translation.googleapis.com/language/translate/v2?key=…`（L100-101） |
| 語音辨識端點 | `js/api.js:134-162` `speechToText()` | 同上邏輯，POST `speech.googleapis.com/v1/speech:recognize`（L139） |
| 拍照 OCR 端點 | `js/api.js:176-214` `ocr()` | 同上，POST `vision.googleapis.com/v1/images:annotate`（L181） |
| 傳輸／分類 | `js/api.js:48-53` `_classifyError`、`L62-82` `_postJson` | fetch 拋錯→`OFFLINE`；HTTP 403→`HTTP_403`；429→`HTTP_429`；**其餘（含 400）→`HTTP_OTHER`**。Google 回應體 `error.message` 存進 `err.message`（L71-72） |
| 呼叫端（文字模式） | `js/translate-tab.js:357-381` | `App.api.translate(...)` → catch → `_showError(err.code)`（L379）；`_showError` 只顯示對照文案（L141-145），**`err.message`（Google 真正原因）被丟棄不顯示** |
| 呼叫端（對話模式） | `js/translate-tab.js:593-667` `_processTalk` | 先 `speechToText`（L601），成功後 `translate`（L624）；兩段失敗**都用同一張 `TALK_ERROR_MSG` 表**（L657、L665） |
| 呼叫端（拍照） | `js/camera-tab.js:214`、`L282` | `App.api.translate`，錯誤對照 `camera-tab.js:54-60` |
| 預設模式 | `js/translate-tab.js:462-469` `_getMode()` | localStorage `tokyotrip.translateMode` 無值時回 `'talk'` → **新安裝第一次進翻譯分頁是「對話」模式** |

### 1-2 所有「沒有金鑰／未授權」類文案（原文＋觸發條件）[碼證]

| # | 原文 | 觸發條件 | 位置 |
|---|---|---|---|
| M1 | 尚未設定 Google API 金鑰，請見 README.md | 文字模式；`window.APP_CONFIG` 未定義或金鑰空（config.js 沒載到） | `translate-tab.js:82` |
| M2 | 金鑰未授權此網址（本機測試屬正常，請在正式網址使用） | 文字模式；Translation 回 **HTTP 403**（任何 403 原因皆同一句，不限網址） | `translate-tab.js:84` |
| M3 | 尚未設定 Google API 金鑰，請見 README.md | 對話模式；同 M1 條件（STT 或翻譯任一段） | `translate-tab.js:443` |
| M4 | 語音辨識服務未授權（API 未啟用、金鑰限制或網域限制） | 對話模式；**STT 回 403，或 STT 成功後 Translation 回 403**（後者會附「（辨識到：…）」字尾，L657-658） | `translate-tab.js:445` |
| M5 | 尚未設定 API 金鑰 | 拍照分頁；同 M1 條件 | `camera-tab.js:55` |
| M6 | API 拒絕存取（金鑰限制） | 拍照分頁；Vision 或其後 Translation 回 403 | `camera-tab.js:57` |

對照：金鑰被刪／值錯（Google 回 **400** API key not valid）→ 落 `HTTP_OTHER`，顯示「翻譯失敗，請重試」（`translate-tab.js:86`）或「語音辨識失敗，請重試」（L447），**不會**出現「金鑰／未授權」字樣 [碼證＋推斷：400 為 Google 對無效金鑰的一般回應碼]。

結論：「沒有金鑰授權」最接近 **M2／M4（403 類）**；若原文其實是「尚未設定…金鑰」則為 **M1／M3（NO_KEY 類）**。兩類根因完全不同，**必須拿到截圖原文**才能二分（見待確認 Q1）。

---

## ② 覆蓋來源

| 檢查項 | 結果 | 證據 |
|---|---|---|
| localStorage／設定頁可覆寫金鑰？ | **N/A**——不存在 | 全 repo `APP_CONFIG` 寫入者只有 `js/config.js:4`（與不載入的 `config.example.js:5`）；無設定頁輸入金鑰；`_getKey` 只讀 `window.APP_CONFIG`（`api.js:24`）[碼證] |
| 匯入碼（含 Task32）波及？ | **N/A** | `js/import-data.js` 只讀寫 `tokyotrip.privateData` 單一 key（L14、L105、L119），不碰 `APP_CONFIG`；Task31→main 期間程式 diff 只有 `js/trip-tab.js`、`js/version.js`、`sw.js`（`git diff --stat`），翻譯鏈 `api.js` 最後改於 Task12（2026-07-12）、`translate-tab.js` 最後改於 Task18（2026-07-13）、`config.js` 自 Task5 起未改 [碼證] |
| 金鑰值本身變過？ | repo 內**未變** | `git log -- js/config.js` 僅 Task5 一筆（2026-07-12）[碼證]；Console 端是否改過 → [待 Olina] |
| Referer 政策是否被頁面改寫 | **未改寫** | `index.html` 無 `<meta name="referrer">`、fetch 未帶 `referrerPolicy`（`api.js:63-67`）→ 瀏覽器預設 `strict-origin-when-cross-origin`，跨網域只送來源 `https://olina3221.github.io/`（不含路徑）[碼證＋推斷] |
| 金鑰限制設定（Console） | 文件記載：參照網址 `olina3221.github.io/*`；API 限制 Translation＋Vision＋Speech-to-Text 三個 | `specs/INDEX.md:6`、`Task12.spec.md:18`、`INDEX.md:79`[史證]。注意 `README.md:54` 與 `config.js:2` 仍寫兩個 API（文件落差，Task12.impact.md:261 已記）；實際 Console 現況 [待 Olina] |
| 過去實機成功紀錄 | Olina iPhone Safari 與主畫面 PWA 皆成功過 | `INDEX.md:79`（Speech 探針 Safari＋PWA 成功）、`INDEX.md:101`（v15 對話模式兩方向翻譯文字正常）[史證]；之後（2026-07-13～10-21）repo 無任何翻譯實測紀錄 |

### 2-1 Referer 各開啟方式對照（Google 參照網址限制看 Referer 標頭）

| 開啟方式 | 送出的 Referer | 是否吻合 `olina3221.github.io/*` | 等級 |
|---|---|---|---|
| Safari 一般分頁 `https://olina3221.github.io/tokyo-trip/` | `https://olina3221.github.io/` | 吻合；Olina 實測成功過 | [史證] |
| 主畫面 standalone PWA | 同上 | 吻合；Olina PWA 實測成功過（INDEX.md:79、101） | [史證] |
| 網址大小寫（如 `Olina3221.GitHub.io`） | 主機名由瀏覽器正規化為小寫 | 吻合；路徑大小寫錯（`/Tokyo-Trip/`）會是 GitHub Pages 404 頁，根本到不了翻譯分頁 | [推斷] |
| `http://` 開啟 | GitHub Pages 轉址到 https；即便 http，樣式無 scheme 亦吻合 | 吻合 | [推斷] |
| 帶／不帶尾斜線 | `/tokyo-trip` 由 Pages 轉 `/tokyo-trip/`；跨網域本就只送來源不含路徑 | 吻合 | [推斷] |
| LINE 內建瀏覽器（WKWebView） | 預設照常送來源 Referer | 多半吻合；但在 LINE 內「加入主畫面」不可行，妹妹說走 Safari，故與本案關係低 | [推斷] |
| 非 `olina3221.github.io` 的網址（他人 fork、github.com repo 頁、raw／預覽站、轉存檔案） | 他網域或無 | **不吻合 → 403** | [推斷] |
| 裝置裝了會移除／改寫 Referer 的內容阻擋器／隱私 App／VPN 過濾 | 無 Referer 或被改 | **不吻合 → 403** | [推斷] |

---

## ③ 快取／建置產物

| 檢查項 | 結果 | 證據 |
|---|---|---|
| PRECACHE 是否含 config.js | **含** | `sw.js:59` `./js/config.js`（Task5 起）[碼證] |
| CACHE_VERSION | `v29` | `sw.js:18`；與 `js/version.js` 同步由冒煙驗 [碼證] |
| SW 是否攔 Google API 呼叫 | **不攔**（POST 直通） | `sw.js:113` 非 GET 直接 return；三端點皆 POST（`api.js:64`）[碼證] |
| 舊版快取帶舊金鑰？ | **N/A（對妹妹）**——今日新裝，取到的就是現行 config.js；且 config.js 自 Task5 未改，任何版本快取內金鑰值都相同 | `git log -- js/config.js` [碼證]。唯一例外：Console 端已換新金鑰而 repo 未更新（→ RC-2，非快取問題） |
| config.js 載入失敗的落點 | 若 config.js 被擋／首次載入失敗 → `APP_CONFIG` 未定義 → NO_KEY（M1/M3/M5）；SW install 單檔失敗只 warn 不中斷（`sw.js:83-86`），失敗結果（非 200）不回填快取（`sw.js:121-124`） | [碼證] |
| 建置 | 純靜態、無 build step；Pages 以 Jekyll 發佈原檔 | `CLAUDE.md` 第 6 節 [史證] |

---

## 實測（2026-10-21 補）

- **[實測] T1 Olina 本人手機翻譯也不能用**（Olina 回報）→ 症狀為**全體性**，非妹妹裝置特有。
- **[實測] T2 主 session 直接呼叫三支 API**（2026-10-21 12:23 UTC，用 repo 內金鑰＋`Referer: https://olina3221.github.io/`，各 1～2 次；金鑰值與專案編號不寫入本文件）：

| API | HTTP | Google 回應（原文摘錄） | App 內落點 |
|---|---|---|---|
| Translation v2 | 403 | reason `userRateLimitExceeded`、message「User Rate Limit Exceeded」（連打 2 次皆同） | 文字模式 M2「金鑰未授權此網址…」；對話模式（STT 成功時）M4 |
| Vision images:annotate | 403 `PERMISSION_DENIED` | 「This API method requires billing to be enabled. Please enable billing on project …」 | 拍照 M6「API 拒絕存取（金鑰限制）」 |
| Speech recognize | 403 `PERMISSION_DENIED` | 同上，requires billing to be enabled | 對話模式 M4「語音辨識服務未授權…」 |

- 判讀：帶正確 Referer 仍得到「需啟用帳單」而非參照網址被拒 → **Referer 限制本身通過**，金鑰存在且有效（無效金鑰會回 400）。三支全 403，與妹妹／Olina 看到的「未授權」類文案（M2／M4／M6）一致。
- Translation 回的是 rate limit 而非 billing 字樣：[推斷] 為帳單停用後該專案配額歸零的表現；與 RC-4「公開金鑰被盜用燒光額度」**不能完全排除**，需看主控台用量圖。

### 實測後各 RC 信心更新

| RC | 實測前 | 實測後 | 依據 |
|---|---|---|---|
| RC-1 帳單停用／試用到期 | 中高 [推斷] | **成立，主因 [實測]** | Vision、Speech 明確回 requires billing to be enabled；Translation 同時 403 |
| RC-2 金鑰被停用／API 限制被改 | 中 | **極低** | 金鑰仍被接受並進到帳單檢查層（非 400、非 API_KEY_SERVICE_BLOCKED） |
| RC-3 API 服務被停用 | 低中 | **極低** | 回的是 billing 而非 SERVICE_DISABLED |
| RC-4 配額耗盡／盜用 | 低中 | **低～中，未排除（從屬）** | Translation 回 userRateLimitExceeded；可能只是帳單停用的連帶表現，是否另有盜用待看主控台用量 [待 Olina] |
| RC-5 Referer 不符（裝置性） | 中 | **不成立** | Olina 本人也壞（T1）；帶正確 Referer 仍 403 且原因非參照網址（T2） |
| RC-6 config.js 未載入（NO_KEY） | 低 | **不成立／極低** | 症狀全體性；NO_KEY 不會發出網路請求，與實測 403 路徑不同 |

**實測後結論：主因＝RC-1（Google Cloud 專案帳單停用，試用到期的可能性高），已實測；RC-4（盜用燒額度）為唯一未排除的從屬可能，需主控台用量確認；其餘 RC-2／3／5／6 不成立或極低。A-1／A-2 放大因子不變（使用者看到的「金鑰未授權」文案掩蓋了真正原因是帳單）。**

---

## 根因清單（全部列舉）

依「誰會中」分兩群：**全體性**（Google Cloud 專案／金鑰端，Olina 也會壞）與**裝置性**（只有妹妹壞）。

### 全體性（Olina 若現在試也會壞）

- **RC-1 Google Cloud 帳單停用／免費試用到期 → API 回 403** [推斷，信心中高]
  - 金鑰與 API 皆於 2026-07-12 建立（`git log -- js/config.js`、`INDEX.md:87`）；Google Cloud 新帳戶免費試用期一般為 90 天，**約 10 月上中旬到期**，與今天（10-21）時點吻合。帳單停用時 Translation／Speech／Vision 回 403（BILLING_DISABLED 類）→ 文字模式 M2、對話模式 M4。repo 內無任何帳單／試用紀錄（grep「試用／billing／帳單」零命中）。
- **RC-2 Console 端金鑰被停用、重新產生或限制被改（repo 未同步）** [推斷，信心中]
  - 例：Olina 自行輪替、或因金鑰在公開 repo 而收到外洩通知後處理。若改了「API 限制」移除 Translation 或 Speech → 403（M2/M4）；若金鑰被刪／重產 → 多半回 400 → 「翻譯失敗，請重試」，**與「未授權」字樣不吻合**，此子情境較不可能。repo 端 `config.js` 未改 [碼證]，Console 現況 [待 Olina]。
- **RC-3 API 服務本身被停用（Cloud Translation 或 Speech-to-Text API disabled）→ 403** [推斷，信心低中]
  - 與 RC-2 不同層：金鑰沒動，但專案內 API 被關。只關 Speech 時，**對話模式壞、文字模式正常**（M4 無「辨識到」字尾）。
- **RC-4 配額耗盡或額度上限被觸發 → 403** [推斷，信心低中]
  - Translation v2 舊式錯誤（每日上限／使用者頻率上限）回 **403** 而非 429，會落 M2「金鑰未授權此網址」；若 Olina 在 Console 設了每日字元上限、或公開金鑰被他人盜用（Referer 可被伺服器端偽造）燒光額度，皆會如此。

### 裝置性（只有妹妹壞）

- **RC-5 妹妹手機送出的 Referer 不是 `olina3221.github.io` → 403** [推斷，信心中]
  - (a) 開的不是正式網址（別人 fork、github.com repo 頁、預覽網址等），(b) 裝置裝了會移除 Referer 的內容阻擋器／隱私 App／過濾型 VPN。頁面本身未改 Referer 政策（`index.html` 無 meta referrer）[碼證]；大小寫／http／尾斜線／standalone 均已排除（見 2-1）。
- **RC-6 config.js 沒載到 → NO_KEY（「尚未設定 Google API 金鑰」）** [推斷，信心低]
  - 內容阻擋器擋 `config.js`、或首次載入時網路中斷且 SW 未成功預快取。只有當截圖原文是 M1/M3/M5（「尚未設定…」）時才成立；`_configLoadError` 有寫入但無人讀取，無 UI 區別 [碼證]。

### 非獨立根因，但會誤導判讀（放大因子，供 PM 覆蓋時參考）

- **A-1 文案不分原因**：所有 403（帳單、API 停用、配額、Referer）在文字模式都顯示同一句「金鑰未授權此網址（本機測試屬正常…）」（`translate-tab.js:84`），Google 回應的真正原因 `err.message` 被丟棄（`translate-tab.js:379`、`L141-145`）。
- **A-2 對話模式誤標**：新安裝預設對話模式（`translate-tab.js:465`），且翻譯段 403 也顯示「語音辨識服務未授權…」（`L657`），使用者無法分辨是 Speech 還是 Translation 被拒。

**根因數量：6 條獨立候選（RC-1～RC-6）＋2 條放大因子（A-1、A-2）。**

---

## 覆蓋宣告

- **還查了什麼**：`js/api.js`、`js/config.js`、`js/config.example.js`、`js/translate-tab.js`（錯誤表、文字／對話兩呼叫鏈、模式預設）、`js/camera-tab.js`（錯誤表、翻譯呼叫）、`js/import-data.js`（storage key 範圍）、`index.html`（載入序、meta、onerror）、`sw.js`（PRECACHE、fetch handler、install／activate）、`manifest.webmanifest`（start_url／scope）、全 repo grep `APP_CONFIG`／`referrer`／`googleapis`；`git log` 對 config.js／api.js／translate-tab.js；Task31→main 程式 diff stat；specs：Task5（spec／api／impact：403 文案、referer 測試分工、輪替過渡 403 坑 `Task5.impact.md:45`）、Task6、Task12（Speech 403 文案、API 限制三個）、Task13、`talk_autoplay.diagnosis.md`、`INDEX.md`、`STATE.md`、`README.md`、`DEVELOPMENT_LOG.md`、`行前檢查清單.md`。
- **信心**：程式碼側（①②③欄）高——金鑰只有一個來源、無覆寫者、Task32 未觸及翻譯鏈、SW 不攔 API 呼叫、快取不可能帶不同金鑰。根因排序（哪一條是真兇）低到中，因為無法實呼叫 Google、看不到回應體。
- **已知盲點**：(1) 看不到 Google 實際回應（403 細分原因 reason 欄）；(2) 看不到 Google Cloud Console（帳單、試用、金鑰限制、API 啟用、配額、用量圖）；(3) 未拿到錯誤訊息原文，M1 與 M2/M4 尚無法二分；(4) 不知 Olina 本人現在是否正常（決定全體性 vs 裝置性）；(5) 不知妹妹 iOS 版本、是否裝內容阻擋器、實際開啟的網址；(6) 「網頁裡面的翻譯功能」也可能被誤指為 Safari 內建的網頁翻譯，而非 App 翻譯分頁（機率低，但未排除）。
- **是否全部列舉**：就 repo 可見範圍，程式碼側能產生「金鑰／未授權」字樣的路徑已全部列出（M1～M6）；Google 平台側 403 成因依一般知識列舉（帳單、金鑰限制、API 停用、配額、Referer），**可能仍有未列的平台側成因**（例如專案被停權）。
- **最快二分法**：Olina 用自己手機現在試一次文字翻譯。她也壞 → 全體性（RC-1～4）；她正常 → 裝置性（RC-5／6）。→ **已完成：她也壞（見「實測」段），且直呼 API 已實測 RC-1。**
- **實測後剩餘盲點**：主控台帳單狀態（試用到期 vs 付款失敗 vs 手動關閉）與 Translation 近期用量（判斷 RC-4 是否同時存在）仍 [待 Olina]。下方 Q1～Q6、Q8 已非必要（症狀已確定為全體性），Q7 的帳單與用量兩項仍需確認。

---

## 要請 Olina 從妹妹手機（與 Google Cloud）確認的事

1. **Q1 錯誤訊息原文截圖**：是「金鑰未授權此網址…」、「語音辨識服務未授權…」、「尚未設定 Google API 金鑰…」、還是「API 拒絕存取（金鑰限制）」？有沒有「（辨識到：…）」字尾？
2. **Q2 在哪個畫面出錯**：翻譯分頁的「文字」還是「對話（麥克風）」模式？還是拍照分頁？兩種模式都試一次各自的結果。
3. **Q3 版號徽章**：畫面右下、導覽列正上方的 `vN · MM/DD` 是多少（應為 v29）。
4. **Q4 開啟方式與網址**：是從 Safari 開哪個網址加入主畫面（請截 Safari 網址列，或說明連結從哪裡來）；現在是從主畫面圖示開，還是 Safari 分頁開？兩種都試一次。
5. **Q5 妹妹裝置**：iOS 版本；有無安裝廣告阻擋／內容阻擋器（設定 → App → Safari → 延伸功能／內容阻擋器）、VPN 或隱私類 App；是否開著 Safari 無痕。
6. **Q6 Olina 本人現在試**：用自己手機在同一版 App 試文字翻譯與對話各一次，正常或錯誤（附原文）。
7. **Q7 Google Cloud Console（Olina 電腦）**：
   - 帳單：帳單帳戶是否有效、免費試用是否已到期／是否已升級為付費帳戶。
   - API 與服務：Cloud Translation API、Speech-to-Text API、Vision API 是否仍為「已啟用」。
   - 憑證 → 該金鑰：是否仍存在／未停用；應用程式限制是否仍為 `olina3221.github.io/*`；API 限制是否仍含 Translation＋Vision＋Speech-to-Text 三個；金鑰值是否與 repo 內 `js/config.js` 相同（只比對，不要貼出值）。
   - 配額／用量：近幾天 Translation 用量是否異常暴增、是否有自訂每日上限。
   - 是否收過 Google 的「金鑰外洩／公開曝光」通知信。
8. **Q8 妹妹說的「翻譯功能」**是指 App 下方導覽列的「翻譯」分頁，還是 Safari 自帶的「翻譯網頁」？
