# Task23 影響範圍分析（SA）

> 2026-07-21。涉及範圍標記：**backend ＋ frontend（含 UI）**——pipeline 走完整鏈：`sa_done` → backend → `backend_done` → frontend → `done` → QA。
> 對照基準：`SYSTEM_MAP.md`（v22 現況）＋ 2026-07-21 實際讀碼驗證（style.css / index.html / app.js / sw.js / qa_smoke_test.py / tripdata.js / import-data.js）。

---

## 1. PM 判定複核（四個指定重點）

### 1.1 E6：第 7 顆導覽鈕 390px 溢出風險——**推算結論：不會溢出，餘裕很大**（[推斷]→接近 [實測] 的計算確定性）

從現行 CSS 實算（style.css L105–164，2026-07-21 讀碼）：

| 事實 | 值 |
|------|-----|
| `#nav-bar` | `display:flex`，**無水平 padding**（只有 padding-bottom safe-area、border-top），可用寬 = 全視口 390px |
| `.nav-btn` | `flex: 1`（= grow 1 / shrink 1 / **basis 0%** → 七顆強制等寬分配）；`padding: 6px 2px`（水平共 4px） |
| `.nav-icon` | font-size 28px（emoji 實寬 ≈ 28–32px） |
| `.nav-label` | font-size 12px、`white-space: nowrap`、letter-spacing 0.03em |

計算：
- 每顆分得寬度 = 390 ÷ 7 ≈ **55.7px**。
- 每顆 min-content 下限 = max(icon ≈ 30px, 最長 label「折價券」3 字 × 12px ＋ letter-spacing ≈ 37.1px) ＋ 水平 padding 4px ≈ **41.1px**（新鈕「購物」僅 2 字，更窄；最長仍是折價券）。
- 41.1 × 7 ≈ **287.7px < 390px**——每顆還有約 14.6px 餘裕，總餘裕約 102px。
- flex-basis:0% 下七顆等寬，min-content 地板遠未觸及；**連 320px 老視口（45.7px/顆）都不會溢出**。
- 觸控目標：55.7px 寬 × min-height 56px，兩軸皆 ≥44px 續過。

**溢出只剩一種可能路徑**：frontend 自己給 nav-btn/nav-bar 加了額外水平 padding/margin/min-width。**本輪不得動 `.nav-btn`/`#nav-bar`/`.nav-icon`/`.nav-label` 任何既有規則**，新鈕沿用既有 class 零新樣式，即結構上不可能溢出。

**frontend 驗法（E6 仍必做，spec 硬性）**：Playwright 390×844 viewport 斷言——
1. `#nav-bar` `scrollWidth === clientWidth`（無水平溢出）；
2. 7 顆 `.nav-btn` `offsetWidth` 全等且 ≥44；
3. 各 `.nav-label` 單行未截斷（`scrollWidth <= clientWidth`）。

若真溢出（理論上不會）：**合法解法唯一＝縮 `.nav-btn` 水平 padding（2px→0，可回收 28px）**；icon 28px / label 12px 是 Task11 Olina 拍板放大，**禁縮字級**，要縮須回報 PM。

### 1.2 新檔連動完整性——載入序／頁籤註冊／PRECACHE 全鏈核對：**spec 定案成立，另抓到 2 個 spec 未明說的必改點**（見 §2 F1/F2）

- **index.html 載入序**（現況 L114–140 實讀）：`shoppingdata.js` 插 `mapdata.js`（L118）之後、`app.js`（L119）之前——資料層位置正確（比照 mapdata）；`shopping-tab.js` 插 `map-tab.js`（L130）之後——功能層位置正確。`shopping-tab.js` **不 wrap showTab**，故其相對 coupon-viewer.js 的先後不影響 wrap 鏈（鏈維持四層零 diff）。
- **app.js**：`TAB_IDS`（L19）insert `'shopping'` 於 `'map'`/`'coupons'` 之間即可；`registerTab`/`showTab` 本體 indexOf/forEach 天然支援第 7 id（實讀確認無任何硬編碼 6/五分頁假設）；導覽鈕點擊綁定走 `data-tab` 掃描，additive 自動涵蓋。**`tokyotrip.lastTab` 值域自動擴含 `'shopping'`**；反向安全：若日後回退舊版，`lastTab='shopping'` 因 indexOf 驗證失敗 fallback phrases，不壞頁。
- **index.html DOM**：第 6 位插 nav 鈕（map 與 coupons 之間，與 TAB_IDS 順序對齊——冒煙判準 6 機械驗）；`<section id="tab-shopping" class="tab-section" hidden>` 插 tab-map/tab-coupons 之間，**`hidden` 屬性必帶**（現況除 tab-phrases 外全帶，漏帶＝載入瞬間雙 section 同顯）。
- **sw.js**：`PRECACHE_URLS` 現況 42 筆（實讀核對）→ +2 筆＝44；CACHE_VERSION v22→v23 與 version.js 兩檔三行 SOP。**PRECACHE 重量前向成本**（PM 指定複核第三點）：bump 一次＝16 張券圖 4.37MB 全重下（Task4 起已知成本，+2 支小 js 可忽略），今晚家用 wifi 部署可接受，不需優化。
- **命名衝突已排除**（實 grep 全 repo）：`window.SHOPPING` 未被占用；分頁 id `'shopping'` 與 phrases 分類 id `'shopping'`（phrases.js L31、my-phrases.js 白名單、translate-tab 分類選擇列）**分屬不同命名空間**（tab id 存 `tokyotrip.lastTab`、分類 id 存 `tokyotrip.phrasesCat`/`myPhrases.catId`，程式碼零交會），無衝突；但 QA 迴歸須確認常用句「購物・付款」分類與翻譯加入常用語功能不受影響（預期零 diff）。CSS `.shopping-*` 前綴無既有占用。

### 1.3 localStorage `tokyotrip.shoppingChecked`——**零衝突、匯入流程不會清掉勾選**（[實測]）

- 既有 key 實 grep 全 js/ 恰 7 個：`lastTab`／`privateData`／`phrasesCat`／`translateDir`／`translateMode`／`myPhrases`／`hiddenPhrases`——`shoppingChecked` 為第 8 個，零衝突，spec E4 成立。
- **與匯入碼本機層的互動（實讀 import-data.js 確認）**：`STORAGE_KEY = 'tokyotrip.privateData'` 為該檔唯一觸碰的 key，`save()` 整份覆蓋語意**只覆蓋 privateData 自己**、`clear()` 只 removeItem 該 key，全 repo `localStorage.clear()` grep=0——**家人／Olina 重匯入匯入碼（含 Task21 lodging 真值碼）不會動到購物勾選狀態**，反之「清除全部勾選」也只 removeItem 自己的 key，不會動到護照/訂位/民宿資料。兩機制完全隔離。
- 既有已知限制照舊：iOS 儲存壓力清除＝勾選歸零（商品資料在 repo 不受影響）、Safari 分頁與主畫面 APP 不共用（勾選要在 APP 內做）——spec B5 已覆蓋，不需額外機制。

### 1.4 冒煙判準連動——**T22-3 改 0 正確；另有一條 spec 措辭易漏的「必紅」判準**（本輪 SA 最重要發現，見 F1）

- **T22-3**：現況 qa_smoke_test.py L290–295 驗 `Skytree Shuttle` 在 Day 2 段恰 1 次（spec E5 [實測] 行號正確）。改 0 的連動**成立且乾淨**：實 grep 整份 tripdata.js，`Skytree Shuttle`／`停駛`／`改搭`／`原定` 四個字串**全檔僅出現在 L121 警語行這一處**——刪該行後不只 Day 2 段、是**全檔 grep=0**，追加禁字詞判準無誤殺風險。
- **T22-1（items=11）**：只刪 detail 字串內一行，`time:` 欄位數不變，續過。**T22-2**（分頭/合羽橋/宇奈とと/二選一/11:10）：與警語行無交集，續過。**T22-4**（時間軸）：time 值零變更，續過。
- **版本一致性判準**：動態比對 APP_VERSION==CACHE_VERSION，v23 自動吸收。
- **Task21 M1/M2/M4／CSS classes 判準**：本輪 trip-tab.js 零 diff、style.css Task21 節零 diff，續過。

---

## 2. SA 新發現（spec 未明說、漏做即紅或即漏的點）

- **F1（必做，否則冒煙必紅）**：`qa_smoke_test.py` **L58–78 硬編碼斷言 `PRECACHE_URLS == 42`**（含 L58 注解「必須保持 42」）。spec 冒煙節寫「backend additive 加入」，但這一條是**就地改寫**（42→44），不是 additive——不改則 backend 一加 PRECACHE 兩筆、基線立即 FAIL。與 T22-3 同屬本輪僅有的兩處「改既有判準」，其餘才是 additive。
- **F2（必做，否則冒煙判準 8 落空）**：隱私掃描段（L219–254）**掃描範圍是寫死的 5 檔清單 `scan_files`**（trip-tab/tripdata/import-data/Task21.spec/Task21.api），不是全 repo——spec 說「新檔一併納入掃描範圍」，落地動作＝backend 把 `js/shoppingdata.js`、`js/shopping-tab.js`、`specs/Task23.spec.md`、`specs/Task23.api.md` additive 加進 `scan_files`。
- **F3（frontend CSS 擺位陷阱）**：Task21 type-scale 判準（L197–201）用 regex 取「Task21 注解 → **下一個 `/*` 注解**」之間的 CSS 為檢查區塊。購物頁樣式**必須以自己的注解頭（如 `/* ── Task23 購物分頁 ── */`）開場**——若直接接在 Task21 節之後無注解分隔，購物節的硬編碼 font-size px（本輪**必須**硬編碼，`.shopping-*` 不在 `var(--fs-*)` 授權範圍，SYSTEM_MAP 紀律）會被吞進 Task21 區塊、該判準誤紅。
- **F4（`.tab-section` 多子元素紀律，Task11 U2）**：購物頁「頁首列＋捲動清單」＝多直接子元素模式——頁首列必設 `flex-shrink: 0`，清單區 `flex:1 / min-height:0 / overflow-y:auto`，比照 `#tab-map` 模式（section 設 overflow:hidden 讓清單成唯一捲動區）。spec B4 已註記，此處確認為硬約束並入 QA 驗收。
- **F5（tripdata.js 單檔雙契約）**：警語刪除動的是 TRIP 契約，同檔 `window.COUPONS`（折價券 16 筆）零 diff 必驗——cache-first 下此檔內容變更靠 v23 bump 生效（已涵蓋）。

---

## 3. 受影響的既有功能

| 功能 | 頁面 / 檔案 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 行程頁 Day 2 12:40 卡 | trip-tab（tripdata.js detail 字串刪 1 行） | 渲染邏輯零改動，僅資料變短；①–④＋計程車備案保留 | ✅ |
| 折價券頁 | coupons-tab（同檔 COUPONS＋nav 鄰位右移一格） | 資料零 diff；nav DOM 插入使其位置右移，data-tab 綁定不受影響 | ✅ |
| 分頁框架／lastTab | app.js TAB_IDS 一行 | 7 id 自動支援；lastTab 值域擴含 shopping | ✅ |
| wrap 鏈（coupon-viewer→camera→translate→bigtext） | 四檔零 diff | shopping-tab 不 wrap；各層守門為 id-agnostic（目標≠自己即清理），切到 shopping 時翻譯/相機清理照常觸發 | ✅（抽驗一條：對話錄音中切購物頁） |
| SW 更新流程／版號徽章 | sw.js＋version.js v23 | 標準 bump；PRECACHE 44；16 張券圖重下成本已知 | ✅（冷 install 離線驗） |
| 地圖頁 | mapdata.js／map-tab.js | **零 diff**（E2 [實測] 0722 段無巴士點）——QA 以 git diff 機械驗 | ✅（git diff=0 即可） |
| 常用句／翻譯／相機 | phrases*／translate-tab／camera-tab／my-phrases／tts／bigtext／recorder／api | 全零 diff；phrases 分類 id 'shopping' 與新分頁 id 不同命名空間已排除衝突 | ✅（git diff=0＋七頁切換冒煙） |
| 匯入碼本機層 | import-data.js 零 diff | shoppingChecked 與 privateData 完全隔離（§1.3 實證） | ✅（重匯入後勾選仍在） |

## 4. Backend 注意事項

1. A 部分：只刪 tripdata.js L121 detail 首行警語＋其 `\n`，餘逐字元零 diff（spec A1 全文已 [實測] 對齊現況）。
2. 冒煙基線改動恰 2 處就地改寫（T22-3→0、PRECACHE 42→44 含 L58 注解）＋其餘 additive（Day 2 禁字詞三個、T23 shoppingdata 判準、TAB_IDS/nav/section 判準、隱私 scan_files 補 4 檔）——見 §2 F1/F2。
3. `shoppingdata.js` 22 筆照 spec B3 逐字轉載（含「台灣買不到」「龍角傘」等字面值，不正規化）；`shopping-tab.js` 獨占 `tokyotrip.shoppingChecked`、記憶體 Set 為真相、清除只准 removeItem、全檔禁 `localStorage.clear()`。
4. `Task23.api.md` 必寫：SHOPPING schema＋DOM/class 結構（含頁首列/群組/卡片/勾選區/展開區/清除鈕 class 名）供 frontend。
5. 兩檔三行 bump v22→v23（APP_VERSION_DATE=07/21，若跨午夜完工依台灣時區實際日）。

## 5. Frontend 注意事項

1. **nav 零新樣式**：新鈕沿用既有 `.nav-btn`/`.nav-icon`/`.nav-label`，不動四個既有 nav 規則——這是「390px 必不溢出」推算成立的前提（§1.1）；E6 Playwright 三斷言仍必跑並留證據。
2. `<section id="tab-shopping" class="tab-section" hidden>` 的 `hidden` 必帶。
3. 購物頁 CSS：自己的注解頭開場（F3）；字級**硬編碼禁 `var(--fs-*)`**；頁首列 `flex-shrink:0`＋清單唯一捲動區（F4）；勾選區/展開區觸控目標各 ≥44px；已買降 opacity 不重排；淺色主題變數可用（非深底 overlay，無解耦問題）；無新增 z-index ≥100 需求。
4. 資料注入一律 textContent（比照 coupons-tab），資料含 `¥`/`&`/括號等字元。

## 6. QA 迴歸測試清單

- [ ] `python qa_smoke_test.py` 全過（更新後基線：v23 兩檔逐字元、PRECACHE=44、T22-1/2/4 續過、T23-A1（Skytree Shuttle=0）＋Day 2 禁字詞三個、Task21 全判準續過、隱私掃描含新檔）
- [ ] git diff 機械驗：mapdata.js=0；tripdata.js 僅刪警語一行（COUPONS/flights/hotels/其他四天零 diff）；trip-tab/translate-tab/camera-tab/map-tab/coupons-tab/phrases-tab/my-phrases/tts/bigtext/recorder/api/import-data 全零 diff
- [ ] 七分頁切換全走一輪；重開 App 還原 lastTab='shopping'
- [ ] 行程 Day 2 12:40 卡：警語消失、①–④＋💤 計程車備案完整、無「停駛/改搭/原定」殘影
- [ ] 購物頁功能：22 筆兩群組、★ 恰 4＋4、匯率頁首常駐、勾選→重整持久、展開/收合、已買計數、清除全部勾選（confirm＋removeItem）、SHOPPING 缺載失敗文案
- [ ] 勾選×匯入碼隔離：勾數項→執行匯入碼重匯→勾選仍在；清除全部勾選→privateData 完好
- [ ] 390px viewport：nav 無水平溢出、7 顆等寬 ≥44px、label 不截斷；購物頁整頁無水平溢出
- [ ] wrap 鏈迴歸：對話模式錄音中切購物頁→錄音 abort＋TTS cancel；購物頁開著切走再切回狀態正常（onShow 冪等）
- [ ] 離線冷 install：清站點資料→install（不開購物頁）→離線→44 筆全可用含購物頁
- [ ] 隱私三段式（工作樹 grep＋TT1. base64 解碼＋git log -p，新檔納入）
- 新功能驗收由 QA 依 spec B4/B5 邊界條件執行；真機手感（E7）歸 Olina 部署後流程外。

## 7. SYSTEM_MAP 同步

本輪影響分析結論已同步更新 SYSTEM_MAP：檔案結構（shoppingdata.js/shopping-tab.js/index.html/app.js/sw.js 條目）、分頁表加購物列、localStorage 登記表加 `tokyotrip.shoppingChecked`、人工補充區追加「冒煙基線含寫死斷言」一條（F1/F2 教訓：基線內 PRECACHE 筆數與隱私 scan_files 是寫死的，任何加檔 Task 必連動改基線）。
