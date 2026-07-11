# Task3 影響範圍分析（SA）

> 涉及範圍：後端（tripdata.js 真實資料替換、import-data.js、trip-tab.js 邏輯、sw.js bump v3、Task3.api.md）＋前端（tab-trip UI、style.css、iOS 細節）→ pipeline 走完整 backend → frontend → QA。
> 本 Task 的特殊性有二：(1) **隱私分層是硬約束**——repo 內容＝公開部署內容，任何真實個資進 git 追蹤檔即 QA FAIL，且 git 歷史不可洗，破口必須在 commit 前堵住；(2) 匯入碼格式 `TT1.` 是「repo 外的電腦端生成器 ↔ APP」的**跨界契約**，生成器不在本 Task 產出，`Task3.api.md` 是它未來唯一的權威依據——格式定義寫不精確，之後生成的真實匯入碼會貼不進去。

## 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 行程資料檔 | `js/tripdata.js` | 整檔替換為附錄 A 真實資料＋新 schema（itinerary items 字串→物件、移除 members）。**同檔的 `window.COUPONS` 必須原樣保留**（Task4 消費，見 P1/B5） | ✅（COUPONS 佔位仍在、結構未變） |
| 折價券分頁（未來） | Task4 ← `window.COUPONS` | tripdata.js 是**單檔雙契約**（TRIP + COUPONS）；本次整檔替換若動到 COUPONS = Task4 隱性返工 | ✅（同上） |
| 離線快取 | `sw.js` | `PRECACHE_URLS` 加 `./js/import-data.js`、`./js/trip-tab.js`；`CACHE_VERSION` v2→v3。**tripdata.js 檔名不變但內容全換，cache-first 下不 bump = 使用者永遠看到範例假行程**（症狀最隱蔽的一種「改了沒生效」，因為頁面不會壞，只是資料是舊的） | ✅（雙 reload 取新資料、舊快取名刪除） |
| App shell | `index.html` | `#tab-trip` 佔位卡整塊替換（A1，不動 section 本體）；script 插入順序定死：phrases-tab.js 之後依序 import-data.js → trip-tab.js（trip-tab 用到 `App.privateData` 與 `App.showBigText`，兩者都須先定義） | ✅（其餘四分頁不受影響） |
| 分頁框架 | `js/app.js`（不改本體） | trip-tab.js 掛 `App.registerTab('trip', { onShow })`；onShow **每次**切到 trip 都觸發，渲染必須冪等（見 B6） | ✅（五分頁切換、lastTab 還原） |
| 大字展示 | `js/bigtext.js`（不改本體） | 飯店地址重用 `App.showBigText({ ja: address_ja })`。**契約相容確認：fit**——B3 定案 ja 必填、zh/romaji 缺時 `.bigtext-sub` 整段不渲染、版面置中，正是 Task6 OCR 同款 ja-only 模式，Task2 QA 已驗過此路徑。不需也不得改 bigtext.js | ✅（ja-only 迴歸＋長地址不溢出，見 B7） |
| showTab wrap | `js/bigtext.js` wrap（不改） | 地址 overlay 開著時切分頁 → wrap 自動關 overlay＋cancel 語音（Task2 既有行為）。trip-tab 不需自己處理、也不得破壞 | ✅（overlay 開著切分頁） |
| localStorage 命名空間 | `tokyotrip.*`（A8） | 新增 key `tokyotrip.privateData`。**同 namespace 已有 `tokyotrip.lastTab`（app.js）、未來有 Task4 折價券狀態——清除操作只准刪單一 key，禁用 `localStorage.clear()`**（見 P6/B2） | ✅（清除後 lastTab 仍在） |
| 樣式 | `css/style.css` | 新增 trip 分頁樣式（pill、日卡、展開列、匯入區）；不動 `.bigtext-overlay` 與 z-index 層級（A7） | ✅（overlay 仍蓋過導覽列） |
| 常用句分頁 | `js/phrases-tab.js`（不動） | 無程式碼交集；共用 showBigText/speak，簽名不變 | ✅（固定迴歸） |

---

## P — 隱私破口盤點（最高風險項，backend/QA 逐條對照）

「敏感真值絕不進 git 追蹤檔」在實作面的所有可能破口。真值清單（護照號、保單號、樂桃訂位代號 6 碼英數、被保險人姓名拼音、個人手機）由 PM 於流程外交 QA，不進 repo。

### P1. tripdata.js 整檔替換時把個資帶進來／現有佔位本身就是個資形態
**現有佔位檔就含個資形態內容**：`members: ["Olina", …]`、hotels note `"訂房大名：OLINA"`、important 的「護照號碼（自行填）」「旅遊保險保單號」佔位列。整檔替換時 backend 必須確認：
- `members` 欄位消失（spec 已拍板移除）；
- hotel `note` 不得帶訂房姓名（真實姓名拼音是禁值）；
- `important` 不得留「護照號碼＝———」這種**等待手填的空欄**——它會引誘日後直接把真值填進公開層。spec A4 的寫法（「保單號在本機層，不在此顯示」）是正確樣板；
- 檔頭加隱私警告註解（spec 已定）。
另外附錄 A 行程 detail 轉寫時只搬行程性內容，不得把材料裡的訂票單編號、要保書欄位「順手」抄進 detail。

### P2. 假測試匯入碼其實是真值／base64 讓 grep 失效（機械檢查關鍵）
Task3.api.md 要附 QA 假資料匯入碼。兩個破口：
- backend 圖方便**拿真資料去編碼**，或假訂位代號「隨機」寫成 6 碼英數而碰撞真值 → 一律用明顯假值（`TEST000000`、`AAA111` 這類非 6 碼或明顯樣板）；
- **base64 是 grep 的盲區**：真值若被包進 `TT1.xxx` 字串，純文字 grep 零命中但實際已洩漏。**QA 機械檢查必須加一步：找出 repo 內所有 `TT1\.` 樣式字串 → 逐一 base64 解碼 → 對解碼後內容再 grep 真值清單**。這一步不做，隱私掃描形同虛設。

### P3. spec / api.md / impact.md / QA 證據檔同受禁令
specs/ 目錄整個在 git 追蹤內。Task3.api.md、QA 的 `.tested` 證據檔與 `.qa_failed.md`、DEVELOPMENT_LOG.md 都不得引用真值——QA 寫證據時只能寫「真值清單 N 項全 repo grep 零命中」，**不得把掃了哪些值貼進證據檔**；匯入流程測試證據一律用假資料碼的畫面/輸出。

### P4. git commit message 與 git 歷史
GitHub Pages 部署 = repo 公開，commit message 也公開。真值不得出現在 commit message。且 **git 歷史不可洗**（洗歷史成本高且 OneDrive 外多副本），所以檢查時點必須在 **commit 前**：backend 每次 commit 前自跑 grep；QA 除工作樹外，對本 Task 產生的 commits 跑 `git log -p` 掃描。事後才發現 = 只能重寫歷史，列為事故。

### P5. 素材檔誤入 repo
資料來源在 `C:\Olina\其它\東京\`（訂票單 jpg 含訂位代號與姓名、要保書 jpg 含保單號）。**禁止把任何素材原檔複製進 repo**（含「放進 specs/ 供參」「放 icons/ 暫存」）。KML/座標素材同樣不進（non-scope 已列）。

### P6. 真實匯入碼的後續交付路徑（本 Task 外，先立規則）
真實匯入碼由電腦端另行產生、單獨交付（LINE/AirDrop 等），**永不進 repo、永不進 specs、永不進 commit**。本機層資料只活在手機 localStorage；「匯出」功能只在螢幕上顯示，不落任何檔案。

**QA 機械檢查定版（寫進測試步驟）**：(1) 全 repo（含 specs/、README、DEVELOPMENT_LOG、.gitignore 外的一切追蹤檔）case-insensitive grep 真值清單 → 零命中；(2) repo 內所有 `TT1.` 字串解碼後再 grep → 零命中；(3) 本 Task commits 的 message 與 diff（`git log -p`）→ 零命中。

---

## 匯入碼 / localStorage 風險分析（使用者實際匯得進去嗎）

| 風險 | 分析 | 處置 |
|------|------|------|
| LINE 斷行/前後空白 | 訊息軟體換行、複製夾雜空白是常態 | spec 已定：解析前去除**全部** whitespace（不只 trim 頭尾）。QA 用「人工插入換行的假碼」驗 |
| base64 變體不匹配 | 生成器在 repo 外、未來才寫；若它輸出 URL-safe base64（`-`/`_`）而 APP 只吃標準 base64，真碼永遠貼不進去，**且這個失敗要到出發前才會被發現** | 見 B1：api.md 定死權威編碼＋解析端容忍兩種變體 |
| 中文編碼 | `atob` 只還原 bytes，直接當字串用中文必亂碼 | spec 已定 TextDecoder 路徑；QA 假資料碼**必須含中文值**（如稱謂「媽媽」），否則這條驗不到 |
| 壞碼毀既有資料 | 解析失敗若先清再寫 = 舊資料陪葬 | spec 規則 6 已定「失敗不動既有資料」——backend 實作序必須是「解析成功才寫入」，QA 用壞碼對「已有資料」狀態驗 |
| 重複匯入 | 整份覆蓋（spec 拍板），無合併歧義 | QA 驗覆蓋後舊值消失 |
| Safari ↔ standalone 不共用 | 在 Safari 貼的資料，主畫面 APP 看不到——使用者最可能踩的坑 | spec 已定寫進空狀態文案。Windows QA 驗不了此項 → **列入 Task7 真機驗收清單**（Olina 流程外） |
| localStorage 非永久 | iOS 儲存壓力下可能清除網站資料；standalone 雖較穩但無保證 | 見 B3：文案提醒保留匯入碼原文；「匯出」鈕本身就是救濟管道 |
| localStorage 不可用 | Safari 無痕等 | spec 已定顯示引導文案不 throw；QA 以 stub 驗 |
| 清除誤傷同 namespace | `localStorage.clear()` 會把 `tokyotrip.lastTab`（Task1）與未來 Task4 折價券狀態一起殺掉 | 見 B2：只刪 `tokyotrip.privateData` 單一 key |

---

## 對 Task5/6 的前向約束

- **Task5/6 不消費 `App.privateData`**——它是 trip 分頁專用，不是跨 Task 共用元件（與 showBigText/speak 不同層級）。但它掛在 `window.App` 上，命名已占用，記入 api.md 供後續 Task 避讓。
- **`tokyotrip.` namespace 使用登記**：本 Task 後 namespace 內有 `lastTab`（Task1）、`privateData`（Task3）；Task4 將再加折價券狀態。**任何 Task 的「清除」類操作都只准刪自己的 key**——此規則自本 Task 起入 SYSTEM_MAP 人工補充區，Task4/5/6 繼承。
- **showBigText ja-only 路徑經本 Task 再次實戰**：Task3 是繼 Task2 QA 之後第一個真實的 ja-only 呼叫方（Task6 OCR 是下一個）。本輪若發現長字串版面問題（見 B7），修法只准動 css/呼叫端，不得動 bigtext.js 簽名——否則 Task5/6 返工。
- **sw.js bump 鏈**：本 Task v3；Task4 起接續 v4…。「資料檔內容變更也要 bump」這條經驗（tripdata.js 檔名不變）對 Task4 同樣適用（COUPONS 換真資料時）。

## spec 縫隙補完（B 系列，backend 定案後記入 Task3.api.md）

### B1. 匯入碼編碼權威定義＋解析端容錯（生成器在 repo 外，api.md 是唯一契約）
spec 只寫 `TT1.<base64(UTF-8 JSON)>`。api.md 必須定死：**標準 base64（`+`/`/`、含 `=` padding）為權威輸出格式**（給未來電腦端生成器遵循），同時**解析端容忍 URL-safe 變體**（`-`→`+`、`_`→`/`、自動補 padding）與缺 padding——成本三行，換掉「出發前真碼貼不進去」的整條風險。api.md 另附一段「電腦端生成器實作須知」（UTF-8 encode → base64 → 前綴 `TT1.`），這是 repo 外交付物未來唯一能對齊的文件。

### B2. 清除操作的爆炸半徑——只刪單一 key
spec 只說「confirm 後刪 localStorage key」。定案：`App.privateData.clear()` 只執行 `localStorage.removeItem('tokyotrip.privateData')`，**全模組禁止 `localStorage.clear()`**。QA 驗清除後 `tokyotrip.lastTab` 仍在。

### B3. localStorage 耐久性告知
iOS 對網站儲存無永久保證（儲存壓力清除；standalone 較穩但非絕對）。不加密不備份已拍板，不重議；補救措施已天然存在（重貼匯入碼）。定案：空狀態/說明文案加一句「匯入碼原文請自行留存（如 LINE 收藏），資料若消失可重新匯入」。

### B4. 隱私機械檢查含 base64 解碼步（P2 定版）
QA 測試步驟明載三段式掃描（工作樹 grep＋`TT1.` 解碼再 grep＋git log -p），backend 每次 commit 前自跑前兩段。

### B5. tripdata.js 替換的保留與刪除清單
整檔替換 = 「`window.TRIP` 全換新 schema＋`window.COUPONS` 原樣保留」。刪除確認：members 欄、訂房姓名 note、important 等待手填佔位列（P1）。api.md 記最終 schema（含 itinerary items `{time,title,detail}` 物件化與 `detail` 多行約定），Task4 之後動同檔時有據可查。

### B6. onShow 冪等與使用者狀態保留
`onShow` 每次切到 trip 都觸發。若每次都全量重渲染＋重跑「預設定位當日」，使用者剛展開的行程項、剛選的子區塊、**正在輸入匯入碼的 textarea** 都會被重置——匯入流程做到一半切去別頁再回來就得重貼。定案建議：首次渲染做預設定位與建 DOM；之後 onShow 不重建 DOM、不重置子區塊/展開狀態（資料層變更時才重渲染，如匯入成功後）。具體策略 backend 定案記入 api.md，QA 驗「切走再切回，展開狀態與輸入中內容不消失」。

### B7. 長地址在 bigtext overlay 的版面
`東京都台東区駒形1-2-10` 含數字與連字號，比句庫最長句短，但 ja-only 模式字級最大。frontend 確認換行不溢出、數字不被斷在詭異位置；只准調 css/呼叫端。QA 加驗此字串實際渲染。

### B8. 行程預設定位的日期判定
「裝置日期落在 2026/07/21–07/25」用裝置本地日期即可（台日時差 1 小時、行程判定粒度為「日」，誤差視窗僅深夜 23:00–24:00，不值得做時區處理）。記入 api.md 免 backend 過度設計。

## Backend 注意事項

- 不改 app.js、tts.js、bigtext.js、phrases-tab.js 本體；showTab wrap 行為不得破壞。
- tripdata.js 整檔替換照 B5 清單；檔頭隱私警告；COUPONS 原樣保留。
- import-data.js：解析採「trim 全 whitespace → 驗 `TT1.` 前綴 → base64 解碼（容 URL-safe，B1）→ TextDecoder('utf-8') → JSON.parse」，任一步失敗回錯誤、不動既有資料；`App.privateData` 簽名（get/save/clear）定案記入 api.md；clear 照 B2。
- 假資料測試碼：值全用明顯假值、**含中文值**（驗 TextDecoder 路徑）、附解碼後 JSON 原文於 api.md 供 QA 對照。
- sw.js 只動兩常數：PRECACHE_URLS 加兩新檔、CACHE_VERSION v2→v3；config.js 排除邏輯（A3）不得波及。
- commit 前自跑隱私掃描（P 節三段式前兩段）；commit message 不含任何真值（P4）。
- Task3.api.md 至少含：TRIP 最終 schema、匯入碼格式權威定義＋生成器須知（B1）、`App.privateData` 簽名、onShow 狀態策略（B6）、假資料碼＋解碼原文、localStorage key 登記與 clear 紀律（B2）。

## Frontend 注意事項

- `#tab-trip` 整塊替換佔位卡，不動 section 本體與 id（A1）；pill 與展開列觸控目標 ≥44px；safe-area 沿用 `--safe-*` 變數。
- 匯入 textarea 在 iOS 鍵盤彈出時不被導覽列/鍵盤遮住（standalone 無瀏覽器 UI，鍵盤直接頂上來）；「會離開 APP」標示照 spec 規則 4。
- 大字地址呼叫 `App.showBigText({ ja: address_ja })`，不傳 zh/romaji（ja-only 版面才最大）；長地址版面照 B7。
- 剪貼簿 fallback（spec 邊界條件）與複製成功提示；tel: 連結樣式可點擊區 ≥44px。
- 空狀態文案含兩則提醒：standalone 內操作（spec 拍板）＋匯入碼原文自行留存（B3）。

## QA 迴歸測試清單

- Task1/2 固定迴歸項（每輪必跑）：
  - [ ] A2：CACHE_VERSION=v3、PRECACHE 含 import-data.js/trip-tab.js、雙 reload 取新版、舊快取名刪除
  - [ ] A5：新檔資源引用無 `/` 開頭絕對路徑
  - [ ] 刪 config.js 後頁面正常、SW install 成功
  - [ ] 五分頁切換、lastTab 還原；常用句分頁、大字、語音不受影響
  - [ ] `App.showBigText`/`App.speak` 簽名未變（api.md 為準）
- 本次隱私掃描（P 節定版，三段式）：
  - [ ] 工作樹全追蹤檔 grep 真值清單（PM 流程外提供）零命中
  - [ ] repo 內所有 `TT1.` 字串解碼後 grep 零命中
  - [ ] 本 Task commits `git log -p` 與 message 零命中
  - [ ] tripdata.js 無 members、無訂房姓名、無等待手填個資佔位列（P1/B5）
- 本次 spec 驗收（照 spec 七、SA 加強項）：
  - [ ] 離線（v3 生效後斷網）四子區塊可看可切可展開
  - [ ] 假資料碼（含中文值）匯入→顯示→重整仍在→匯出碼一致→清除回空狀態，且清除後 `tokyotrip.lastTab` 仍在（B2）
  - [ ] 壞碼三態（缺前綴/斷行插入/亂碼 base64）→ 錯誤文案、既有資料不受損；URL-safe 變體碼可匯入（B1）
  - [ ] 大字地址：ja-only 置中、長地址不溢出（B7）、overlay 開著切分頁自動關＋語音 cancel（Task2 迴歸）
  - [ ] trip 分頁切走再切回：展開狀態/子區塊選擇/輸入中匯入碼不被重置（B6）
  - [ ] `window.TRIP` 缺欄/未定義 → 區塊級失敗文案不壞頁；localStorage 不可用 stub → 引導文案不 throw
  - [ ] `window.COUPONS` 佔位原樣保留（Task4 前置）
- 移交 Task7 真機清單：Safari↔standalone localStorage 不共用之文案實效、真機貼上流程、日文地址 G1 核對（Olina 流程外）。

## 疑慮回報 PM（不重開拍板，僅記錄）

- B1（解析端容忍 URL-safe base64）、B2（clear 只刪單一 key）、B3（耐久性提醒文案）、B6（onShow 狀態保留）為 spec 未明載處的補完，均不牴觸已拍板決策，由 backend 定案記入 Task3.api.md；若 PM 認定超出解釋範圍，請於閉環時裁示。
- G1–G5 缺口照 spec 附錄 B 處理，backend 不腦補；G1（日文地址正確性）QA 無法驗，屬 Olina 流程外核對項，已列入 Task7 移交清單。
