# Task8.impact.md — 影響範圍分析（SA）

> 對象：Task8（B1 淺色主題全域翻轉 + B2 常用句分類導覽，內容零增刪）
> 依據：`specs/SYSTEM_MAP.md` + 全檔逐行掃描 `css/style.css`（1471 行）、`index.html`、`js/phrases.js`、`js/phrases-tab.js`、`sw.js`、`manifest.webmanifest`、Task1–4.api.md
> 涉及範圍：**後端（phrases.js schema / phrases-tab.js 邏輯 / sw.js bump）＋前端（style.css / index.html / manifest）皆有** → pipeline 走完整 SA → backend → frontend → QA。

---

## 1. 受影響的既有功能

| 功能 | 頁面 / 檔案 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 底部導覽列 | `#nav-bar`（全分頁常駐） | bg=`--c-primary`（保留）但字色走會翻轉的 `--c-text-muted` → 見 §2-C | ✅ |
| 常用句分頁 | phrases-tab.js + `.phrases-*` 樣式 | B2 重構渲染邏輯（單類顯示＋chips）；點句→bigtext、點喇叭→speak 必須不變 | ✅ |
| 大字 overlay | bigtext.js（**js 零變更**）+ `.bigtext-*` 樣式 | 維持深底，但樣式內有 3 處引用會翻轉的全域變數 → 見 §2-B（最高風險） | ✅ |
| 券圖檢視器 | coupon-viewer.js（**js 零變更**）+ `.cv-*` 樣式 | 維持深底，但樣式內有 4 處引用會翻轉的全域變數 → 見 §2-B | ✅ |
| 行程分頁（8 視覺區塊） | trip-tab.js（**js 零變更**）+ `.trip-*` 樣式 | 淺色化破口最多的區域：pill 導覽、日卡、航班/飯店深藍卡、私人段、匯入匯出區 → 見 §2-A | ✅ |
| 折價券分頁 | coupons-tab.js（**js 零變更**）+ `.coupon-*` 樣式 | 卡片、badge 色需淺色化；地區警示 badge 琥珀色對比會壞 | ✅ |
| 翻譯/拍照佔位頁 | `.placeholder-*` | 全走變數，翻轉後自動正確，順眼測即可 | ✅（順看） |
| PWA 外殼 | index.html meta / manifest / icons | theme-color、status-bar-style、manifest 雙色值；icons 不動（Non-scope） | ✅ |
| 離線快取 | sw.js | v5→v6 bump（見 §5），PRECACHE 清單零增刪 | ✅ |
| localStorage | `tokyotrip.lastTab` / `tokyotrip.privateData` | 新 key `tokyotrip.phrasesCat` 無衝突（見 §4）；禁 `localStorage.clear()` 紀律不變 | ✅ |

---

## 2. B1 淺色翻轉破口盤點（最高風險，逐行掃描結果）

主題色**大部分**集中在 `:root` 變數（style.css:18–35），變數翻轉可覆蓋約七成；但硬編碼色值與「深色元件引用會翻轉的變數」兩類破口共 20+ 處，逐一列出。

### 2-A. 主 UI：翻淺後會壞掉的硬編碼色（frontend 必須逐條處理）

「白色系半透明」在深底上是提亮、在淺底上是**隱形**；「亮色系語意色」在深底上可讀、在淺底上**對比不足**。

| # | 位置（style.css 行號） | 現值 | 淺底下的症狀 | 處理方向 |
|---|------|------|------|------|
| A1 | `.trip-pill` :488 | `rgba(255,255,255,0.07)` 底 | pill 完全隱形，只剩浮字 | 改深色系 tint（如 `rgba(0,0,0,0.05)`）或實色淺灰 |
| A2 | `.trip-item` 分隔線 :631 | `rgba(255,255,255,0.05)` | 列表分隔線消失 | 改深色系 tint |
| A3 | `.trip-item-header:active` :651 | `rgba(255,255,255,0.04)` | 按壓回饋消失 | 改深色系 tint |
| A4 | `.trip-item-detail` :686–687 | 底 `rgba(0,0,0,0.18)`＋頂線 `rgba(255,255,255,0.05)` | 底色偏重、頂線隱形 | 底色減淡、頂線改深 tint |
| A5 | `.trip-hotel-note` 底 :859、`.trip-export-textarea` 底 :1187、`.coupon-card-thumb-wrap` 底 :1249 | `rgba(255,255,255,0.04)` | 區塊底色消失（輕微） | 改深色系 tint |
| A6 | `.trip-btn-bigtext` :906、`.trip-btn-export` :1153 | 底 `rgba(255,255,255,0.10)`＋字 `var(--c-text)` | 淺底頁上按鈕底隱形，失去按鈕樣貌 | 改深色系 tint（注意 `.trip-btn-bigtext` 在深藍飯店卡內，見 A9） |
| A7 | `.trip-private-unavail` :975（`#E8B84B` 字）、`.coupon-card-badge-area` :1327（`#E8B84B` 字） | 琥珀亮黃字 | 淺底上黃字對比嚴重不足（約 1.9:1） | 換深琥珀（如 `#8A6A00` 一帶）；tint 底可留 |
| A8 | `.trip-import-error` :1076、`.trip-btn-clear` :1158 | `#FF6B6B` 亮紅字 | 淺底上約 2.9:1，AA 不過 | 換深紅（如 `#C63A3A` 一帶） |
| A9 | `.trip-flight-card` :695 / `.trip-hotel-card` :787 | 底 `var(--c-primary)`（深藍，spec 允許保留為品牌色塊）但**內部全部文字走 `--c-text`/`--c-text-muted`/`--c-divider`** | 變數翻轉後＝深字在深藍卡上，**整卡不可讀**。這是「保留深色元件引用翻轉變數」的最大陷阱 | 二選一：(a) 卡片也淺色化（最省事，品牌感靠 accent 邊框/標籤）；(b) 保留深藍底則卡內文字/分隔線**全部改卡片區域性色值**（含 `.trip-flight-no/-endpoint/-date/-note/-arrow-label`、`.trip-hotel-name/-dates/-address-ja/-address-zh/-note`、route 區 :739、`.trip-btn-bigtext`）。frontend 定案記入回報 |
| A10 | `.trip-import-textarea:focus` 邊框 `#7AA6FF` :1060 | 亮藍框 | 淺底上偏弱但可見 | 可留可深化，frontend 順手定 |
| A11 | `--c-divider: rgba(255,255,255,0.10)` :25 | 白色系變數 | 變數本身要翻成深色系（如 `rgba(0,0,0,0.12)`），**但被鎖定的深色元件也引用它**（見 B4） | 翻變數＋深色元件解耦 |

**加碼（AA 對比抽查結論）**：品牌強調色 `--c-accent #4D7CF4` **當文字用**在近白底上約 3.5:1，AA（4.5:1）不過。引用處很多：`.trip-item-time`、`.trip-day-label`、`.trip-flight-label`、電話連結、`.phrases-speak-btn`、`.coupon-card-discount`、passport badge、`.trip-tip` 等。建議 frontend 新增一個**文字用深階 accent**（例 `#2E5BCC` 一帶，≥4.5:1），`--c-accent` 保留給色塊填充（白字在 accent 填充上 3.8:1，屬大字/粗體 3:1 範圍，按鈕字級 16px+ semi-bold 勉強可過，QA 以可讀為準）。

### 2-B. 深底 overlay 的「變數穿透」——必須鎖住不受主題翻轉影響（本次分析最重要發現）

spec 規定 `.bigtext-*`/`.cv-*`「一行都不改」，但**兩個 overlay 內部共 7 處引用了會被翻轉的全域變數**，字面上不改＝翻轉變數後 overlay 直接壞：

| # | 位置 | 現值 | 翻轉後症狀 |
|---|------|------|-----------|
| B1 | `.bigtext-close-btn` color :443 | `var(--c-text)` | 深字打在深底半透明白鈕上，關閉鈕近乎隱形 |
| B2 | `.bigtext-speak-btn:disabled` bg :426 | `var(--c-text-muted)` | disabled 鈕底色變淺色系灰（輕微，但屬穿透） |
| B3 | `.cv-title` color :1398、`.cv-close-btn` color :1417 | `var(--c-text)` | 深字在近黑 header 上，店名與關閉鈕隱形——**給店員掃碼時關不掉檢視器** |
| B4 | `.cv-header` border :1390 | `var(--c-divider)` | 深色系分隔線在深 header 上隱形（外觀輕微） |
| B5 | `.cv-img-error` color :1465 | `var(--c-text-muted)` | 壞圖文案在近黑底上不可讀 |

已硬編碼、天然安全者：`.bigtext-overlay` 底 `#0A1020`、`.bigtext-ja` `#fff`、`.bigtext-zh/.bigtext-romaji` rgba 白系、`.cv-overlay` 底 `rgba(0,0,0,0.96)`、`.cv-header` 底 `rgba(31,42,92,0.90)`、兩個關閉鈕的 `rgba(255,255,255,0.14)` 底。`--c-accent`（bigtext 播放鈕底）不翻轉，安全。

**SA 定案（解決 spec 自我矛盾，見 §6-G1）**：overlay 兩區塊允許且**僅允許**「變數→等值硬編碼（或 overlay 區域性變數）」的解耦 diff，視覺結果必須與現狀逐像素同義（`--c-text`→`#F0F4FF`、`--c-text-muted`→`#7A8DB8`、`--c-divider`→`rgba(255,255,255,0.10)`）。QA 驗收準則第 2 條同步修正：從「git diff 零變更」改為「diff 僅限上述 7 處解耦、無任何色值語意變更」。

### 2-C. 導覽列陷阱（spec B1 第 7 點 frontend 定案，但有一條必守約束）

`#nav-bar` 底＝`--c-primary`（不翻），非 active 按鈕字色＝`--c-text-muted`（**會翻**）:158。若 frontend 選「維持品牌深藍底」，翻轉後未選中分頁的 icon/label 變深灰在深藍上＝隱形。**約束：導覽列若保留深底，字色必須與全域 muted 變數解耦（區域性色值）；若改淺底，active 態需另給清楚樣式（`--c-accent` 在淺底上當 icon 色可過 3:1 圖形對比）。**

### 2-D. 翻轉後自動正確、無需動的部分（降低 frontend 掃描負擔）

- 全部 `var(--c-bg)`/`var(--c-text)`/`var(--c-text-muted)` 的正向引用（placeholder、phrases 列表、trip 標題、coupons 卡文字、sticky 分組頭底色 :209/:473/:1218 等）——變數翻了就對。
- accent 系半透明 tint（`.phrases-item-body:active` :248、`.trip-tip` :544、`.trip-day-header` :581/:586、`.coupon-card:active` :1241、passport badge :1322、`.trip-btn-map` :899、`.trip-btn-reimport` :1147、import textarea 底 :1045）——藍 tint 在淺底上仍成立，可留（frontend 順眼微調不強制）。
- `.trip-pill.active`/`.trip-btn`/`.bigtext-speak-btn` 的白字配 accent 實色底——不翻，成立。

---

## 3. iOS 狀態列定案（spec B1 第 6 點，SA 定案供 frontend 直接執行）

**定案：`apple-mobile-web-app-status-bar-style` 由 `black-translucent` 改為 `default`。**（index.html:13，並同步改 :6–10 的註解）

理由與影響：
- `black-translucent` 下狀態列文字**永遠白色**且無法改——淺底下必然隱形，此路不通；「頂部保留深色帶」與淺色主題目標自相矛盾，否決。
- 改 `default` 後 standalone 模式狀態列變**不透明、黑字**，背景由 iOS 取頁面頂部背景/theme-color——搭配淺色 `theme-color` 與淺色 body 正確可讀。
- **連帶效應（frontend 須知，已驗證安全）**：`default` 下 webview 不再延伸到狀態列底下，standalone 的 `safe-area-inset-top` 歸 0。全站 safe-area 皆走 `env(..., 0px)` 回退模式（桌面本來就以 0 運行），body padding-top、`.tab-section` top、兩 overlay 的 `calc(var(--safe-t) + 20px)` 全部自動退化為 0/20px，版面不壞。
- 可接受的外觀讓步：開深色 overlay 時狀態列仍是淺色（系統層，蓋不到）——展示場景秒級使用，接受，QA 不列缺陷。
- `theme-color`（index.html:19）與 manifest `background_color`/`theme_color` 依 spec 改為與新 `--c-bg` 一致的淺色值，三處一致。

---

## 4. B2 分類導覽：零增刪機械判準與 localStorage

### 零增刪機械判準（QA 直接照抄執行）

現況基線（本次掃描實數）：**6 分類、41 句**——問候8／餐廳9／購物7／交通6／飯店5／緊急6。

1. `git diff --numstat js/phrases.js` → **恰好 6 insertions、0 deletions**。
2. 6 行新增內容逐行比對：僅形如 `id: "greetings",` 等 6 個 id（值依 spec 表：greetings/dining/shopping/transport/hotel/emergency），各插在對應分類物件內、順序不重排。
3. 機械複核（防「同行改字」盲區）：改後在 console 跑
   `JSON.stringify(window.PHRASES.map(g => ({cat: g.cat, items: g.items})))`
   與改前基線字串**逐字元相等**（可由 git stash/show 舊版取基線）；並驗 `PHRASES.length===6`、各分類 items.length＝8/9/7/6/5/6。
4. 每分類物件含 `id`（string、ASCII、非空）且 6 個 id 互異。

### localStorage key：`tokyotrip.phrasesCat`

- 既有登記（Task3.api.md §8＋SYSTEM_MAP）：`tokyotrip.lastTab`（app.js）、`tokyotrip.privateData`（import-data.js）。**`tokyotrip.phrasesCat` 無衝突**，前綴合規，本檔登記＋backend 寫入 Task8.api.md，SYSTEM_MAP 已標註（Task8 進行中）。
- 清除紀律沿用：phrases-tab.js 只准 `removeItem('tokyotrip.phrasesCat')`（實際上本 Task 無清除需求），全 repo 禁 `localStorage.clear()`。
- 邊界依 spec：不可用（iOS 私密瀏覽）→ 靜默降級預設 transport；存了不存在的 id → fallback 第一類。注意 fallback 是「PHRASES 第一個分類」不是寫死 greetings——未來內容整理任務可能重排分類。

### 與既有互動的相容確認

- 點句 → `App.showBigText({ja,zh,romaji})`、點喇叭 → `App.speak(ja)`：**簽名照 Task2.api.md 原樣沿用**，切分類只是換渲染的資料子集，不碰 bigtext.js/tts.js。切分頁自動關 overlay 的 wrap 行為（O1）不受影響——phrases-tab.js 不碰 `App.showTab`。
- 現行 `_rendered` 一次性 flag（phrases-tab.js:38,148）將改為「shell 一次＋列表區隨分類切換重繪」：**每次重繪列表都重掛句子的 click listener，舊 DOM 整塊丟棄，無殘留 listener 問題**；`ttsAvailable` 判定（:56）在重繪路徑上仍須生效（disabled 播放鈕不可在切換後復活）。
- PHRASES 缺/空失敗文案容錯保留；**新增邊界**：某分類 `items` 空陣列時現行程式直接 skip 該分類（:62）——chips 模式下建議「該分類 chip 不渲染」與現行行為對齊，backend 記入 api.md。
- chips sticky 置頂會與原 `.phrases-cat` sticky 分組頭疊撞（兩者都 `top:0`）——單類顯示下 spec 已允許移除分組頭或留單一標題，backend 定案記入 api.md；若保留標題，sticky `top` 必須讓位給 chips 高度或取消 sticky。

---

## 5. sw.js bump 定案

- 本次全部改動檔（`css/style.css`、`index.html`、`manifest.webmanifest`、`js/phrases.js`、`js/phrases-tab.js`）**均已在 PRECACHE_URLS**（sw.js:23–55 逐一核對），檔名不變、零新增檔 → **PRECACHE_URLS 零增刪，只 bump `CACHE_VERSION` 'v5' → 'v6'**（sw.js:19）。
- **必守項**：這是「內容變更也要 bump」的典型案——cache-first 下漏 bump 的症狀是「Olina 的 iPhone 上改了沒生效」且頁面不壞、極隱蔽（SYSTEM_MAP 既有紅字紀律）。由 **backend 執行一次**，frontend 不得重複 bump（spec 已寫死，QA 驗 `CACHE_VERSION === 'v6'`）。
- 已知成本：bump 觸發 16 張券圖重下載（4.37MB），spec 已接受。
- **manifest 的 iOS 特性（QA/Olina 預期管理）**：iOS 對 `manifest.webmanifest` 的讀取主要發生在「加入主畫面」當下；已安裝的 APP 圖標啟動畫面/底色**可能沿用舊值**，直到移除重加主畫面。這不是 bug，QA 不列缺陷；真機若見啟動瞬間残留深色底，屬此特性。

---

## 6. Spec 縫隙補完（G1 為必要修正，其餘為補充定案）

| # | 縫隙 | SA 補完 |
|---|------|---------|
| G1 | **spec 自我矛盾**：業務規則 1「overlay 一行都不改」＋QA 第 2 條「git diff 確認 overlay 區塊未動」vs. 事實：overlay 內 7 處引用會翻轉的變數（§2-B），字面不改＝翻轉後 overlay 壞掉 | 修正為「**配色語意一行都不變**」：僅允許 §2-B 所列 7 處做變數→等值硬編碼解耦；QA 第 2 條改為「diff 僅限該 7 處解耦且視覺等值」。此為達成 spec 業務意圖（overlay 維持深底不變）的唯一實作路徑 |
| G2 | spec 第 2 點「掃描硬編碼色值」無清單 | §2-A 已給全量清單（A1–A11＋accent 對比加碼），frontend 照表施工，QA 照表抽查 |
| G3 | 導覽列「frontend 定案」無護欄 | §2-C 給出必守約束：深底方案必須解耦 muted 變數 |
| G4 | 狀態列「擇一」未定 | §3 定案 `default`，含 safe-area 歸 0 的連帶驗證 |
| G5 | 零增刪只有原則沒有可執行判準 | §4 給 numstat＋JSON 逐字元比對雙判準與 41 句基線數 |
| G6 | 空分類、chips 與舊 sticky 分組頭疊撞未提 | §4 相容確認段，backend 定案記入 api.md |
| G7 | fallback「第一類」語意 | 明確為 PHRASES[0]，不寫死 greetings |
| G8 | manifest 在已安裝 iOS APP 上的更新時機 | §5 預期管理，不列缺陷 |

---

## 7. Backend 注意事項

1. phrases.js **只加 6 行 id**，動任何其他字元都會被 §4 機械判準抓到；發現句子有錯字也不修，記回報。
2. phrases-tab.js 重構時：`registerTab('phrases')` 簽名、失敗文案容錯、`ttsAvailable` disabled 邏輯、`App.showBigText`/`App.speak` 呼叫方式全部保持；只新增 chips 渲染＋列表區重繪＋`tokyotrip.phrasesCat` 讀寫（try/catch 包 localStorage，私密瀏覽降級）。
3. sw.js 只動 :19 一行（v5→v6）；PRECACHE_URLS 一個字都不動。
4. 八檔零變更清單（spec Non-scope）照守：app.js/tts.js/bigtext.js/coupon-viewer.js/coupons-tab.js/import-data.js/trip-tab.js/tripdata.js。
5. Task8.api.md 需載明：新 PHRASES schema、chips DOM class 清單（供 frontend 套樣式，建議比照 `.trip-pill` 命名慣例）、`tokyotrip.phrasesCat` 登記、空分類行為定案、分組頭去留定案、CACHE_VERSION=v6。

## 8. Frontend 注意事項

1. 施工順序建議：先翻 `:root` 五變數（bg/text/text-muted/divider＋新增文字用深階 accent）→ 照 §2-A 表逐條清硬編碼 → 照 §2-B 表做 overlay 解耦（僅 7 處、等值）→ §2-C 導覽列 → §3 狀態列＋theme-color＋manifest。
2. 深藍品牌卡（A9）二選一並記入回報；選保留深底就必須整卡解耦。
3. chips 樣式：sticky 置頂、橫向捲、觸控 ≥44px、active 態清楚（比照 `.trip-pill` 既有模式；淺底下 inactive chip 底色用深色系 tint，勿沿用白色系 tint）。
4. 不動 icons/、不加 prefers-color-scheme、不動 viewport meta、不重複 bump sw.js。

## 9. QA 迴歸測試清單

- [ ] Task1：分頁切換 5 頁、`tokyotrip.lastTab` 記憶、SW 註冊
- [ ] Task2：點句開大字（深底白字不變）、播音、關閉鈕**可見可點**（§2-B B1）、切分頁自動關 overlay
- [ ] Task3：trip 四子區塊 pill 導覽（淺底下 pill 可見，A1）、日卡展開、航班/飯店卡**整卡可讀**（A9）、匯入/匯出/清除流程、私密瀏覽提示（A7 琥珀）、錯誤文案（A8 紅）
- [ ] Task4：券卡列表、badge 兩種（A7）、點卡開檢視器——**深底不變、店名/關閉鈕可見**（§2-B B3）、pinch/pan/雙擊、壞圖文案（B5）、切分頁自動關
- [ ] Task8 B1：全分頁淺底深字目視＋對比抽查（含 accent 當文字處）；theme-color/manifest 兩色值/:root 三處一致；iOS 真機狀態列黑字可見（`default`）
- [ ] Task8 B2：預設 transport、chips 切換只顯示該類、記憶 key、壞 id fallback PHRASES[0]、私密瀏覽降級、切類後點句/播音正常、disabled 播放鈕不復活
- [ ] 零變更驗證：八檔 git diff 為零；phrases.js 依 §4 雙判準；overlay 樣式 diff 僅限 §2-B 7 處解耦
- [ ] `CACHE_VERSION==='v6'`、PRECACHE_URLS 零增刪；bump 後更新流程真機驗（重整兩次取得新樣式）
- [ ] 隱私掃描三段式照常（SYSTEM_MAP 既有紀律）
