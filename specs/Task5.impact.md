# Task5.impact.md — 中⇄日翻譯＋config.js 版控化 影響範圍分析（SA）

> 對照 `specs/SYSTEM_MAP.md` 與全 repo grep 實掃（含 git 實測：`git check-ignore js/config.js` 現況命中、`git ls-files` 現況不含 config.js）。
> 涉及範圍：**後端／核心邏輯＋前端 UI 皆有**（pipeline 走 backend → frontend → QA）。

---

## 一、★ 金鑰納入版控——不變式翻轉全面掃描結果（最高優先）

spec 翻轉清單 #1–#10 逐項核實，另**新增一項 spec 未列的殘留（#11）**。以下為活文件（非歷史存檔）中所有「假設 config.js 不在 repo / 是秘密」的位置與定案改法：

| # | 檔案:行 | 現況原文（摘） | 改法 | 負責 |
|---|---------|---------------|------|------|
| 1 | `.gitignore` L1–2 | 「# Google API 金鑰——絕對不進 git」＋`js/config.js` | 兩行整段刪除；config.js 首次 `git add` 進版控 | backend |
| 2 | `README.md` L51 | 「已被 .gitignore 排除，不會上傳 GitHub」 | 改寫：「`js/config.js` 已納入版控、隨站部署到 GitHub Pages。金鑰安全靠 Google Cloud Console 的兩層限制：HTTP 參照網址限制＝`olina3221.github.io/*`、API 限制＝Cloud Translation＋Cloud Vision；金鑰可隨時重新產生作廢。」 | backend |
| 2b | `README.md` L53 安全提醒段 | 「若部署…請設定限制」（未然語氣） | 改為已然描述（限制已設）；補一段**金鑰輪替 SOP**：改 config.js 內容 → bump `CACHE_VERSION` → 部署 → 使用者 reload 兩次生效（見本檔二、） | backend |
| 3a | `README.md` L84 | 「禁止：config.js 永遠不得加入快取清單」 | 整句刪除，改為：「`js/config.js` 自 Task5 起在 PRECACHE_URLS 內，內容變更（金鑰輪替）同樣走 bump SOP」 | backend |
| 3b | `README.md` L105 | 「config.js 真實金鑰（gitignored，自行複製填入）」 | 改「真實金鑰（納入版控、隨站部署；受 referer＋API 限制保護）」 | backend |
| 4 | `js/config.example.js` L1–2 | 「config.js 不會上傳到 GitHub…只留在本機」 | 註解改寫：「config.js 已納入版控隨站部署；金鑰須在 Google Cloud Console 設 HTTP 參照網址限制＋API 限制；**嚴禁在 config.js 放任何個資**」。範本檔保留（在 PRECACHE 內，退場屬 non-scope） | backend |
| 5 | `sw.js` L13–14（檔頭禁止項）、L60（NOTE）、L94（節標題）、L98–109（fetch handler A3 特例整段） | config.js 雙重排除 | **SA 定案：進 PRECACHE、刪 A3 特例**（定案理由與實作約束見本檔二、） | backend |
| 6 | `specs/SYSTEM_MAP.md` L16/L34/L54–55/L64/L71/L74 | gitignored、雙重排除、舊隱私判準 | **SA 已於本次更新**（見 SYSTEM_MAP 現行版） | SA ✅ |
| 7 | `specs/INDEX.md` | — | PM 已更新（L5–6 已含翻轉註記，核實無殘留矛盾） | PM ✅ |
| 8 | QA 隱私判準 | 舊直覺「任何金鑰不得出現」 | 新判準見本檔五、 | QA |
| 9 | 歷史存檔：`Task1–4` 各 spec/api/impact、`DEVELOPMENT_LOG.md` 歷史條目、`INDEX.md` 舊閉環註記 | 多處「gitignored」 | **不改寫**（拍板）。⚠️ 特別注意 `Task1.api.md` L100/L124 是「活契約檔」但同屬存檔不改——**backend 必須在 `Task5.api.md` 開「A3 改版宣告」節**，明文「Task1.api.md 的 A3 永久禁止項自 Task5 起廢止、以本檔為準」，否則下游冷 context 讀 Task1.api.md 會誤守舊禁令 | backend（api.md 宣告） |
| 10 | git 歷史 | config.js 從未被追蹤（已實測 `git ls-files` 無此檔） | 無歷史洩漏；首次 add 即已限制金鑰，合法 | — |
| **11（SA 新掃出）** | **`js/config.js` L1–3 檔頭註解** | 「此檔已被 .gitignore 排除，不會上傳」＋未然語氣的限制提醒 | **spec 未列，必改**——這個檔案即將公開部署，檔頭卻自稱不會上傳，直接自相矛盾。改寫：「本檔納入版控、隨站公開部署。金鑰受 HTTP 參照網址限制（olina3221.github.io/*）＋API 限制保護，可隨時作廢重生。嚴禁在本檔加入任何個資。」 | backend |

其他 grep 命中皆屬：歷史存檔（#9 不改）、`js/app.js` L5 載入順序註解（只描述順序、無 gitignore 假設，不改）、`index.html` L121/L126 onerror 容錯（保留，見二、）。**掃描宣告：除上表外，工作樹活文件無其他「config.js 不在 repo」假設殘留。**

---

## 二、sw.js A3 定案（翻轉清單 #5，SA 裁決）

**定案：`./js/config.js` 加入 PRECACHE_URLS；刪除 fetch handler 的 A3 network-only 特例整段（L98–109）；同步刪改檔頭禁止項與 NOTE 註解。**

理由（採 PM 建議，加一條 SA 補強）：
1. config.js 現在納管、可版本化——與其他 app shell 檔完全同生命週期，金鑰輪替生效路徑＝「改 config.js 內容＋bump CACHE_VERSION＋部署」，與 tripdata.js 內容更新同一條已驗證的 SOP，無需特例。
2. 離線開 App 不再多一次網路失敗：現況 network-only 在離線時回傳空 config、`APP_CONFIG` 未定義。
3. **錯誤訊息正確性（SA 補強，原 spec 未點出）**：若 config.js 不進 PRECACHE，離線時 `APP_CONFIG` 未定義 → api.js 錯誤分類會落入「尚未設定 Google API 金鑰」而非「翻譯需要網路連線」——對使用者是**誤導訊息**。進 PRECACHE 後離線金鑰仍在，fetch reject 才是唯一離線症狀，訊息分類正確。此點列 QA 驗證項（mock：APP_CONFIG 存在＋fetch reject → 必須出「需要網路」訊息）。

backend 實作約束：
- PRECACHE_URLS 新增三筆：`./js/config.js`、`./js/api.js`、`./js/translate-tab.js`；`CACHE_VERSION` v9 → **v10**（開工時以實際值 +1 為準）。
- fetch handler 刪除特例後，`config.js` 走一般 cache-first（precache hit）；「只處理 GET」檢查成為 handler 第一道，**不得刪除**（POST 繞過快取依賴它，見三、）。
- `index.html` L126 的 `onerror` 容錯**保留**（防禦縱深不拆：clone 後未起 SW、iOS 清站點資料等情境下缺檔不阻斷）；「`APP_CONFIG` 未定義是合法狀態、可選鏈存取」契約（Task1.api.md A4）**繼續有效**。
- 金鑰輪替的過渡語意（README 註明）：舊金鑰作廢後、使用者尚未 reload 更新 SW 期間，快取中舊 config 會導致翻譯 403（「金鑰未授權」訊息）——reload 兩次即恢復，屬可接受過渡，不是 bug。

---

## 三、翻譯 API 的 sw.js 攔截風險（確認＋前向約束）

**現況核實**：sw.js fetch handler 中，A3 特例（L99 `url.indexOf('js/config.js')`）不會匹配 googleapis 網址；隨後 L112 `if (event.request.method !== 'GET') return;` ——**POST 一律直通瀏覽器預設處理，不進 cache-first、不回填**。A3 特例刪除後，method 檢查成為第一道，POST 行為不變。✅ 不需為 `translation.googleapis.com` 加任何排除特例。

**但「必須 POST」因此是硬約束而非偏好**：若誤用 GET 呼叫 Translation API，動態回填段（L119–131）對 **200 且非 opaque 的跨域 CORS 回應也會 `cache.put`**——金鑰（在 URL query）進 cache 索引、翻譯結果被 cache-first 固化（同句永遠回舊譯文，bump 也救不了動態快取以外的認知）。機械判準：api.js 對 googleapis 的 fetch 必帶 `method: 'POST'`，全檔 grep 不得有對 googleapis 的 GET。

**前向約束（Task6 繼承，已登記 SYSTEM_MAP 人工補充區）**：Cloud Vision `images:annotate` 同為 POST——Task6 沿用同一結論，同樣不加 sw 特例、同樣禁 GET。

---

## 四、api.js 重用邊界（Task6 前瞻設計，backend 實作、Task5.api.md 定案）

分層約束（Task6 的 OCR 呼叫要能掛進同一檔、零改動通用層）：

| 層 | 內容 | Task6 重用方式 |
|----|------|---------------|
| 金鑰層 | 金鑰存在性檢查（`window.APP_CONFIG?.GOOGLE_API_KEY`，可選鏈——A4 契約仍有效） | 直接重用 |
| 傳輸層 | POST 封裝：`fetch(url, {method:'POST', headers, body: JSON.stringify(...)})`＋回應 JSON 解析＋**錯誤分類**（建議錯誤碼枚舉：`NO_KEY` / `OFFLINE` / `HTTP_403` / `HTTP_429` / `HTTP_OTHER`，附 Google 回應體 `error.message`——Translation 與 Vision 的錯誤體同為 `{error:{code,message}}` 格式，分類器天然共用） | 直接重用 |
| 端點層 | `App.api.translate(text, {source, target})` → Promise<string> | Task6 另加 `App.api.ocr(...)`，不動上兩層 |

- 命名空間掛 `window.App.api`（避讓既有 `App.privateData` 等占用；SYSTEM_MAP 已登記）。
- api.js **不含 TTS、不碰 DOM、不碰 localStorage**——純呼叫層；UI 訊息對映（錯誤碼→文案）放 translate-tab.js。
- 錯誤碼枚舉與函式簽名記入 `Task5.api.md`，即為 Task6 的契約。

## 五、overlay / showBigText / speak 重用——契約相容確認

- `App.showBigText({ ja: 結果, zh: 原文 })`：Task2.api.md 簽名 `ja` 必填、`zh` 選填——相容 ✅。空結果字串 → spec 已定「視為失敗不開大字」，與 B3（ja 空 no-op）雙保險一致 ✅。
- `App.speak(結果)`＋`App.speak.isAvailable` 決定 disabled：相容 ✅；只播日文結果（僅中→日方向有鈕）符合 Task2 拍板 ✅；不得繞過 tts.js。
- 不做新 overlay → 無 z-index 120 帶占用、無多 overlay 互斥新議題（translate 分頁唯一 overlay 是 bigtext）。
- showTab wrap 連帶行為：使用者切分頁時大字 overlay 自動關＋語音 cancel（Task2 B2/B6）——對翻譯情境是預期行為，無需處理。
- bigtext 是合法深底 overlay（硬編碼色紀律）；translate 分頁本身是淺色 in-page UI，用全域變數＋`--c-accent-text`（文字場景），**不得引用 `--fs-*`**（Task10 授權僅 `.trip-*`）。

## 六、受影響的既有功能

| 功能 | 頁面/檔案 | 影響說明 | 需迴歸測試 |
|------|-----------|---------|-----------|
| SW 離線快取全站 | sw.js（PRECACHE +3、bump v10、刪 A3 特例） | fetch handler 結構變更，全站離線行為的共同依賴 | ✅（含冷 install 離線驗證，Task4 紀律） |
| 既有三分頁（常用句/行程/折價券） | 各 *-tab.js | 零 diff，但 bump 後重下全量 PRECACHE（含 18 張券圖 4–7MB，Task4 已知成本，家用 wifi 可接受） | ✅ 切換＋overlay 開關迴歸 |
| 大字展示/語音 | bigtext.js / tts.js | 零 diff，新消費者接入 | ✅（phrases 分頁原路徑不退化） |
| index.html 腳本鏈 | index.html | 新增兩個 `<script>`；插入點用既留的 L137–138 註解位（trip-tab.js 之後、coupon-viewer.js 之前），順序滿足「api.js 在 translate-tab.js 前、皆在 tts/bigtext 後」；config.js onerror 保留 | ✅ 雙 reload 取新版、console 零 error |
| git 版控狀態 | .gitignore / js/config.js | config.js 首次入 repo＝公開部署內容，隱私判準翻轉 | ✅（三段式掃描新判準） |
| README / config.example.js | 文件 | 金鑰語意全面改寫（見一、） | ✅ 殘句 grep |

## 七、Backend 注意事項

1. 施工順序建議：先 `.gitignore` 移除＋config.js 檔頭註解改寫（#11）→ `git add js/config.js`＋機械驗證（`git check-ignore` 無輸出、`git ls-files` 含之）→ 再動 sw.js/api.js/translate-tab.js。
2. sw.js 只動：PRECACHE_URLS（+3）、CACHE_VERSION（v10）、刪 A3 特例段與相關註解——**不動** install/activate 邏輯與「只處理 GET」檢查。
3. `Task5.api.md` 必含：`App.api` 簽名與錯誤碼枚舉（四、）、**A3 改版宣告**（一、#9）、`tokyotrip.translateDir` 讀寫語意、輸入上限計法定案（建議 `text.length`，UTF-16 code units，記入即可）。
4. 縫隙定案：**方向切換時清空結果區**（避免舊結果與新方向標示不一致、大字/播音鈕在日→中方向殘留）——backend 在分頁狀態邏輯落實，QA 驗。
5. 分頁內容/結果的跨分頁保留：記憶體 closure（同 Task10 `_itinView` 模式），不進 localStorage。
6. `tokyotrip.translateDir` 讀寫包 try/catch（私密瀏覽降級）、壞值 fallback `zh2ja`；禁 `localStorage.clear()`。

## 八、Frontend 注意事項

- `#tab-translate` 佔位卡整塊替換，不加 section 外父層（Task1 DOM 約定）。
- `.tab-section` flex 紀律：輸入區（非主捲動區）必設 `flex-shrink: 0`（Task11 教訓）。
- textarea 計算字級 ≥16px（iOS 聚焦縮放紅線）；不引用 `--fs-*`；文字用 accent 時取 `--c-accent-text`。
- 三動作鈕依方向顯隱：中→日＝大字/播音/複製，日→中＝僅複製；播音鈕依 `App.speak.isAvailable`。
- 複製成功短暫回饋、失敗靜默；觸控目標 ≥44px 慣例。

## 九、QA 迴歸測試清單＋機械判準

**隱私判準（翻轉後定義，取代舊直覺）**：
- 三段式掃描照跑（工作樹 grep＋`TT1.` base64 解碼再 grep＋`git log -p`）。
- **PASS**：API 金鑰字串（`AIzaSy...`）出現在 `js/config.js` ＝合法（唯一合法位置；出現在其他 tracked 檔仍應回報 PM 確認）。
- **FAIL**：個資真值（護照/保單/姓名/手機/訂位代號，清單 PM 流程外提供）出現在**任何** tracked 檔（含 config.js、specs/、commit message、diff）。

**靜態機械判準**：
- [ ] `git check-ignore js/config.js` 無輸出（exit 1）；`git ls-files` 含 `js/config.js`；`.gitignore` 無 config.js 行與相關註解。
- [ ] `js/config.js` 內容僅 `window.APP_CONFIG = { GOOGLE_API_KEY: "..." }`＋新版註解，無個資。
- [ ] sw.js：`CACHE_VERSION === 'v10'`；PRECACHE_URLS 含 `./js/config.js`、`./js/api.js`、`./js/translate-tab.js`；fetch handler 無 config.js 特例（grep sw.js 的 `config` 僅命中 PRECACHE 清單行）；`method !== 'GET'` 檢查仍在。
- [ ] api.js：對 googleapis 的 fetch 帶 `method: 'POST'`，無 GET 呼叫。
- [ ] index.html：api.js 在 translate-tab.js 之前、皆在 tts/bigtext 之後；config.js `onerror` 屬性保留。
- [ ] README / config.example.js / config.js 檔頭：grep 無「gitignored」「不會上傳」殘句。
- [ ] `App.registerTab('translate', ...)` 存在；localStorage 僅新增 `tokyotrip.translateDir`；全 repo 無 `localStorage.clear()`。
- [ ] A5：grep 無 `/` 開頭絕對路徑。

**行為（mock/stub fetch，實呼叫 403＝限制生效證據非 FAIL）**：
- [ ] 請求形狀（POST/URL/key/q/source/target/format）；`zh-TW⇄ja` 雙向。
- [ ] 成功渲染＋方向對應動作鈕；大字傳 `{ja:結果, zh:原文}`；播音走 `App.speak`。
- [ ] 四類錯誤訊息（金鑰空/斷網/403/429）；**APP_CONFIG 存在＋fetch reject → 必須出「需要網路」而非「未設定金鑰」**（二、之 3）。
- [ ] 空輸入/>500 字 disabled、翻譯中防連點、空結果不開大字。
- [ ] 方向切換清空結果區；`translateDir` 讀寫/壞值/私密瀏覽降級；onShow 冪等。
- [ ] 冷 install 離線迴歸（Task4 紀律）：清站點資料→install（不開 translate）→離線→既有三分頁全功能＋translate 頁顯示「需要網路」；config.js 離線可載入（APP_CONFIG 有值）。
- [ ] 既有分頁迴歸、雙 reload 取新版、console 零 error。

**流程外（Olina，部署後 iPhone）**：真翻譯成功、大字/播音手感、離線其他頁照常。

## 十、需回報 PM 的事項

- 無需裁決的新議題。#11（config.js 檔頭註解）為 spec 翻轉清單的補漏，已直接列 backend 必做；方向切換清結果、500 字計法為縫隙補完定案，若 PM 認定超出解釋範圍請於閉環時裁示。
