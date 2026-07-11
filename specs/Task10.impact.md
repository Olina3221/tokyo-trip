# Task10.impact.md — 影響範圍分析（SA）

> 對象：Task10（R1 行程頁字級統一＝`--fs-*` 五階 type scale 只套 `.trip-*`；R2 單日細節下鑽＝分頁內視圖切換）
> 依據：`specs/SYSTEM_MAP.md`＋實際盤點 `css/style.css`（Task11 閉環後現況，1533+ 行）、`js/trip-tab.js`（758 行全讀）、`sw.js`（實測 CACHE_VERSION='v8'）、Task11.impact.md（顏色改動點防回退）、Task1.api.md／Task2.api.md（registerTab／showBigText／載入順序／bump SOP）
> 涉及範圍：**後端（trip-tab.js 視圖狀態機＋sw.js bump）＋前端（style.css type scale＋R2 版面）——走完整 pipeline backend → frontend → QA**

---

## 1. 受影響的既有功能

| 功能 | 頁面 / 檔案 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 行程子區塊（五天日卡展開/收合） | trip-tab.js `buildItinerarySection`（:64–170）＋ style.css `.trip-day-*`/`.trip-item-*` | **整段重構**：展開/收合模式退場，換兩層視圖（總覽卡⇄單日時間軸）；B8 今日展開邏輯被「init 直進當日單日層」取代 | ✅ |
| 航班/飯店/重要資料三子區塊 | trip-tab.js（buildFlights/Hotel/Important 零變更）＋ style.css | **JS 零變更、CSS 只動 font-size/line-height**（R1）；Task11 剛定案的顏色一個不碰（§4） | ✅ |
| Pill 子區塊切換 | trip-tab.js `buildPills`（:653–692） | 零變更。pill 以 `s.hidden = (s.id !== …)` 切整個 section；R2 兩層都住 `#trip-sec-itinerary` **內部**，pill 邏輯完全不感知內層視圖 → 天然共存 | ✅（四 pill 切換＋切走切回內層視圖保留） |
| B6 冪等（onShow 不重建） | trip-tab.js `onShow`（:726–731） | `_initialized` 模式不變；視圖狀態存 closure 記憶體變數，跨分頁切回保留。匯入碼輸入中內容、pill 選擇不得丟失 | ✅ |
| 飯店大字鈕 → bigtext overlay | `.trip-btn-bigtext`＋`App.showBigText` | `showBigText` 只綁在飯店卡（trip-tab.js:315），行程子區塊兩層皆無 bigtext 觸發點 → 不誤觸；R1 只改該鈕 font-size | ✅ |
| 其他四分頁字級 | 常用句/翻譯/拍照/折價券＋導覽列 | **零影響**：`--fs-*` 變數放 `:root` 但未被引用前對任何元素零作用；本輪只授權 `.trip-*` 引用（機械判準 §6-2） | ✅（抽查無變化） |
| Task11 剛落地的改動 | `#nav-bar`/`--nav-h` 60px/`.phrases-chips-bar` flex-shrink/航班飯店卡淺色 | 全部零 diff（§4 逐點錨定） | ✅ |
| 深色 overlay | `.bigtext-*`/`.cv-*` | 零變更（含字級——spec Non-scope 明列） | ✅（diff 為零） |
| 離線快取 | sw.js | **v8→v9**（實測現值 v8，與 spec 閘解除註記一致）；PRECACHE 零增刪（trip-tab.js、style.css 均已在清單） | ✅ |
| 資料層 | tripdata.js | **零變更**（git diff 為零是硬判準）；既有 schema（day/isoDate/theme/items[{time,title,detail}]）足夠支撐下鑽 | ✅ |

---

## 2. R1 字級破口實測盤點（SA 實數，spec 說「二十餘處」，實測 **43 處**）

`.trip-*` 區塊（style.css :463–1197）內 `font-size` 硬編碼共 **43 條**，值域 10–26px；其中 **低於 13px 下限的 9 條**（10px×1、11px×3、12px×5）。全清單與歸階（★＝spec 表明列；其餘為 SA 依「就近歸階」建議，frontend 定案記回報）：

| 現值 | 選擇器（行號） | 歸階 |
|------|--------------|------|
| 10px | `.trip-flight-arrow-label`:766 | ★ xs 13（「出發/抵達」小標，spec 點名） |
| 11px | `.trip-flight-label`:708 | ★ lg 19（spec 點名，11→19 大幅升級） |
| 11px | `.trip-day-chevron`:618 | **R2 退場刪除**（展開模式廢止） |
| 11px | `.trip-private-section-title`:1093 | sm 15（護照/保險小節標，比 section-title 低一級；歸 lg 會失衡——記回報） |
| 12px | `.trip-section-title`:533 | ★ lg 19（spec 點名） |
| 12px | `.trip-day-label`:593 | **R2 退場**（語意轉移到總覽卡新類 `.trip-ov-*`，Day 標籤套 ★lg） |
| 12px | `.trip-private-title`:969 | lg 19（與 section-title 同構「區塊主標」） |
| 12px | `.trip-private-info small`:1004 | xs 13 |
| 12px | `.trip-export-textarea`:1192 | xs 13（匯入碼 monospace 長串；readonly textarea <16px 的 iOS 聚焦縮放風險為既存現況，不在本任務擴大） |
| 13px | `.trip-tip`:549、`.trip-day-theme`:610（R2 轉移至總覽卡→★sm）、`.trip-flight-note`:782（★sm）、`.trip-hotel-note`:857（★sm）、`.trip-important-label`:933（★sm）、`.trip-private-row-label`:1113（★sm）、`.trip-import-textarea::placeholder`:1058（xs）、`.trip-export-note`:1177（xs 或 sm） | 各如註 |
| 14px | `.trip-pill`:495（sm）、`.trip-item-detail`:685（★md）、`.trip-flight-date`:732（★sm）、`.trip-hotel-dates`:808（★sm）、`.trip-hotel-address-zh`:833（★md 地址）、`.trip-important-value`:956（md）、`.trip-private-unavail`:981（sm）、`.trip-private-info`:990（sm）、`.trip-import-hint`:1031（sm）、`.trip-import-error`:1078（sm） | 各如註 |
| 15px | `.trip-error`:528（sm）、`.trip-day-date`:602（R2 轉移→★sm）、`.trip-item-time`:658（★sm）、`.trip-item-title`:669（★md）、`.trip-flight-endpoint`:775（★md 航班起降） | 各如註 |
| 16px | `.trip-btn`:883（md）、`.trip-import-textarea`:1047（**md 17，硬約束：此值不得 <16px**，iOS 聚焦自動縮放紅線——16px 註解要保留語意）、`.trip-private-row-value`:1121（★md） | 各如註 |
| 18px | `.trip-hotel-address-ja`:821（★md 地址 17，微降）、`.trip-hotel-tel a`:846（★md 電話 17）、`.trip-btn-confirm`:1073（md 或 lg，就近定案記回報）、`.trip-private-row-value a`:1135（★md 電話） | 各如註 |
| 19px | `.trip-btn-import`:1015 | lg 19（原值即中） |
| 20px | `.trip-item-chevron`:675 | **R2 退場刪除**（逐項 toggle 廢止） |
| 22px | `.trip-flight-arrow`:760（xl 22，「→」字形元素原值即中）、`.trip-important-tel`:944（★md 17——見 ⚠F1） |
| 24px | `.trip-flight-no`:725 | 表未列 → 就近歸 xl 22（記回報） |
| 26px | `.trip-hotel-name`:800 | ★ lg 19（spec 點名，26→19 降級） |

**⚠F1（記入回報交 PM，不擋工）**：spec 表把「緊急電話值」歸 md 17——`.trip-important-tel` 將由 22px **降**至 17px；同類降級還有 hotel-name 26→19、flight-no 24→22。與 R1「字要變大」的動機方向相反，但屬 PM 已拍板的表格內容，SA 不重開；建議 QA 實機截圖存證供 Olina 流程外驗收，若不符預期由 PM 另開調表 Task。觸控可用性不受影響（tel 連結 min-height 44px 未動）。

**新增元素歸階**（R2 新類）：單日層日期大標 → ★xl 22；day-nav 返回/前後天鈕 → md 17；總覽卡 Day 標籤 → ★lg、日期/theme → ★sm、「今天」badge → xs。

**R1×R2 交互（施工順序關鍵）**：43 條中 `.trip-day-label/date/theme/chevron`、`.trip-item-chevron` 共 5 條不是「換變數」而是**隨 R2 整條規則退場或轉移到新類**。frontend 必須以 backend `Task10.api.md` 定案的最終 DOM 為準做 R1，不要先逐條轉換再刪——白做且易留殘骸。

---

## 3. R2 單日下鑽：狀態機定案與 backend/frontend 分工邊界

### 3.1 狀態機（backend 實作，api.md 定案細節）

- **狀態變數**（closure 記憶體，禁 localStorage）：`_itinView ∈ {'overview'} ∪ {0..N-1}`（N＝itinerary.length，現況 5）。
- **初始態**（init 一次性）：`getTodayIsoDate()`（沿用既有函式:21）對上某天 `isoDate` → 該天 idx；對不上／缺 isoDate 的天不參與比對 → `'overview'`。**注意行為變更**：舊 B8 的「今天不在範圍→預設展開 Day1」fallback（trip-tab.js:156–167）**廢止**，範圍外一律落總覽，不自動進 Day1。「今天」只在 init 算一次，跨午夜不刷新（記入 api.md）。
- **轉移**：`OV_TAP(i)`：overview→day(i)｜`BACK`：day(i)→overview｜`PREV/NEXT`：day(i)→day(i∓1)，i=0 時 PREV disabled、i=N-1 時 NEXT disabled（**disabled 屬性，不隱藏**）。每次轉移後**捲動歸零的目標是 `#tab-trip`**（`.tab-section` 是 `position:fixed; overflow-y:auto` 的捲動容器——`window.scrollTo` 無效，須 `tabEl.scrollTop = 0`；spec 未指明，SA 補完 G2）。
- **DOM 策略建議**：總覽層 init 建一次；單日層用**單一容器、進入/換天時整段重繪**（內容是 dayIdx 的純函數、無逐項互動狀態，重繪無狀態損失，比預建五份省記憶體且簡單）。backend 可改採預建，api.md 記定案即可。
- **B6 共存**：onShow 照舊只擋 `_initialized`；兩層 hidden 狀態與 `_itinView` 天然跨分頁保留。pill 切到航班再切回行程子區塊同理保留。
- **邊界**（spec 已列，backend 照做）：itinerary 缺/空→既有「行程資料載入失敗」；某天 items 空→「本日無排定行程」；item.detail 缺→只渲染 time+title；detail `\n` 沿用 `escHtml(...).replace(/\n/g,'<br>')`（:119）。
- **a11y 收尾**：單日層時間軸列**不再是**可點 toggle——`role="button"`/`aria-expanded`（現 :84–85、:103–104）不得殘留在非互動列上。

### 3.2 分工邊界

| 角色 | 檔案 | 邊界 |
|------|------|------|
| backend | js/trip-tab.js | 重構 `buildItinerarySection` 為兩層建構＋狀態機＋事件（卡點入/返回/前後天/disabled）＋今日判斷進入點＋捲動歸零；**buildFlights/Hotel/Important/Pills 四函式零變更**；輸出 `Task10.api.md`（新 DOM class 全清單、狀態變數語意、沿用/退場類名對照、frontend 樣式掛點）；**不寫任何樣式**（總覽卡 ≥44px 觸控高度由 frontend 以 CSS 保證，backend 只保證整卡可點） |
| backend | sw.js | 僅 :19 一行 `'v8'`→`'v9'`；PRECACHE 零增刪；執行一次，frontend 不得重複 bump |
| frontend | css/style.css | `:root` 加五階 `--fs-*`＋43 條歸階套用（§2）＋R2 新類版面（總覽卡/badge/單日層/day-nav）＋孤兒清理（§5 白名單）；行高/間距可配合微調；**不動 JS、不動 DOM、不碰 §4 顏色錨定** |

### 3.3 沿用類名建議（backend api.md 定案）

單日層時間軸建議**沿用** `.trip-item`/`.trip-item-time`/`.trip-item-title`/`.trip-item-detail` 類名（樣式連續性、diff 最小）；孤兒＝`.trip-day-header` 家族＋`.trip-item-header` 的 toggle 態＋兩個 chevron（§5 白名單）。

### 3.4 day-nav sticky 判定（SA 補完 G3，spec 留給 frontend 的縫）

`.trip-pills` 已是 `position:sticky; top:0; z-index:1`（:469–472）。若 `.trip-day-nav` 也做 sticky top:0 會與 pills 疊撞；要 sticky 必須 `top` 錨在 pills 實高之下（pills 高度隨內容 ~64px，硬編碼有漂移風險）。**SA 建議首版不做 sticky**——單日內容量一天份不長，返回/前後天鈕在頂部＋轉移自動捲頂已夠用；若 frontend 仍要做，定案值記回報且 QA 加驗「單日層長捲動時 day-nav 與 pills 不互蓋」。

---

## 4. 與 Task11 顏色改動不衝突的保證（防回退錨定，QA 逐點驗）

Task11 剛落地、本任務**必須原樣保留**的點（`git diff css/style.css` 中這些行不得出現）：

| # | 錨定 | 現值 |
|---|------|------|
| P1 | `.trip-flight-card`:702／`.trip-hotel-card`:794 background | `#FFFFFF`（T2/T3） |
| P2 | `.trip-flight-label`:712／`.trip-hotel-tel a`:848 color | `var(--c-accent-text)`（T4/T5） |
| P3 | `.trip-flight-route`:742 background | `rgba(0,0,0,0.04)`（T7） |
| P4 | `.trip-flight-arrow`:761 color | `var(--c-accent)`（T6 定案保留）——R1 只改它的 font-size 行 |
| P5 | `--nav-h`:35 | `calc(60px + var(--safe-b))`；`#nav-bar`/`.nav-btn`/`.nav-icon` 28px/`.nav-label` 12px 全零 diff（**nav 字級不屬 `.trip-*`，本輪不收斂，硬編碼合法**） |
| P6 | `.phrases-chips-bar` | `flex-shrink: 0` 原樣；`.phrases-*` 全零 diff |
| P7 | `#7A8DB8` 計數 | 全檔恰 2 處（bigtext:429、cv:1534），零增減 |
| P8 | Task8 A1–A10 淺色定案 | `.trip-*` 內所有 color/background/border-color/box-shadow **一律零 diff**（孤兒整條刪除除外，見 §5） |

結構性保證：R1 依 spec 規則只允許動 `.trip-*` 內的 font-size／line-height／間距屬性；R2 新增的是**新類名**規則（不覆寫既有色彩）；`:root` 只**新增** `--fs-*` 五行、不改既有變數任何一行。三者交集為零 → 顏色不可能被合法 diff 碰到，任何色彩屬性 diff 即越界 FAIL。

---

## 5. 孤兒 CSS 清理白名單（整條規則刪除僅限此清單）

R2 廢止展開/收合後允許整條刪除（或改造為 `.trip-ov-*` 新類）：`.trip-day-card`、`.trip-day-header`（含 `:active`、`[aria-expanded="true"]`）、`.trip-day-label`、`.trip-day-date`、`.trip-day-theme`、`.trip-day-chevron`、`.trip-day-body`（含 `[hidden]`）、`.trip-item-header`（含 `:active`；若單日層沿用此類名改非互動樣式則為改造）、`.trip-item-chevron`、`.trip-item-detail[hidden]`；`.trip-item-detail` 的 `padding-left:76px`（為 toggle 縮排設計）可隨新版面調整。**白名單以外的 `.trip-*` 既有規則整條消失＝FAIL**（QA 判準 §6-4）。

---

## 6. 機械判準（QA 直接照抄執行）

1. **R1 無硬編碼**：以區塊 parser（切 `}`，選擇器含 `.trip-` 或 `#trip-`——含 R2 新類 `.trip-ov-*`/`.trip-itin-*`/`.trip-day-nav*`）驗證：區塊內每條 `font-size` 皆為 `var(--fs-*)`，出現任何 `數字+px` 即 FAIL（`clamp()`/`calc()` 內含 px 亦算）。
2. **變數域**：`:root` 恰有 `--fs-xl/lg/md/sm/xs` 五個新變數，值＝22/19/17/15/13（frontend ±1px 定案記回報為準）、全部 ≥13px；`var(--fs-` 在 `.trip-` 區塊**之外**出現次數＝0（scope 保證）。
3. **iOS 縮放紅線**：`.trip-import-textarea` 的計算字級 ≥16px（歸 md 17 即過；若 --fs-md 被 -1px 微調成 16 仍過，15 即 FAIL）。
4. **孤兒白名單**：`git diff` 中整條消失的 `.trip-*` 規則 ⊆ §5 清單。
5. **Task11 防回退**：§4 P1–P8 逐點過（含 #7A8DB8 計數＝2、--nav-h 60px、.phrases-* 零 diff）。
6. **js 零變更清單**：`tripdata.js`、`phrases.js`、`phrases-tab.js`、`coupons-tab.js`、`coupon-viewer.js`、`import-data.js`、`app.js`、`tts.js`、`bigtext.js`、`index.html`、`manifest.webmanifest` git diff 全零；改動檔僅 `js/trip-tab.js`、`css/style.css`、`sw.js`。
7. **sw.js**：diff 恰一行，`CACHE_VERSION === 'v9'`（實測現值 v8）；PRECACHE_URLS 零增刪。已知成本：bump 觸發 16 張券圖（4.37MB）重下載，既有拍板接受。
8. **R2 功能**：總覽恰 5 卡（Day/日期 M/D（週）/theme，無 items）；逐卡點入日期正確；單日層只含該日 items、detail 全展開含 `\n` 換行、無 aria-expanded 殘留；返回/前後天正確；Day1「前一天」與 Day5「後一天」為 `disabled`（存在且不可點，非隱藏）；items 空天顯示「本日無排定行程」。
9. **當日快捷**：mock 系統日期（建議 Playwright `clock` 或暫改裝置日期）——行程期間內某日→init 直落該日單日層＋總覽對應卡有「今天」badge；期間外→落總覽且**不**自動進 Day1（行為變更點）。
10. **B6 迴歸**：進單日層→切折價券分頁→切回＝仍在同一天；匯入碼輸入一半→切分頁切回＝內容還在；pill 選航班→切回＝仍在航班。
11. **overlay 隔離**：R2 新類無 `position:fixed`/z-index ≥100；飯店大字鈕開 `.bigtext-*` 照常、行程子區塊操作全程不觸發 overlay；`.bigtext-*`/`.cv-*` diff 為零。
12. **全迴歸＋隱私**：Task1–4/8/9/11 全功能冒煙（含冷 install 離線驗證吃到新 css/js）；隱私掃描三段式照 SYSTEM_MAP 紀律。

**失敗歸屬指引**：視圖切換/狀態保留/disabled/今日判斷/DOM 結構 → backend；字級/歸階/版面/孤兒殘骸/顏色回退 → frontend；雙歸屬照 signal-flow 修復迴圈規則。

---

## 7. Spec 縫隙補完

| # | 縫隙 | SA 補完 |
|---|------|---------|
| G1 | 「二十餘處」實數與下限違規清單 | §2：實測 43 處、<13px 共 9 處，全數列表歸階；5 處隨 R2 退場非轉換 |
| G2 | 「捲動至區塊頂部」未指明捲動容器 | §3.1：`.tab-section#tab-trip` 是 fixed+overflow-y 容器，須 `tabEl.scrollTop=0`，window 捲動無效 |
| G3 | day-nav「sticky 可選」與 `.trip-pills` sticky 疊撞 | §3.4：建議首版不 sticky；要做須錨 pills 實高以下＋QA 加驗不互蓋 |
| G4 | 舊 B8 的 Day1 fallback 去向 | §3.1：廢止——範圍外落總覽，不自動進 Day1（行為變更，QA §6-9 驗） |
| G5 | 表未列元素歸階 | §2 逐條給 SA 建議階（flight-no→xl、trip-btn→md、private-section-title→sm 等），frontend 定案記回報 |
| G6 | 緊急電話 22→17 等三處「變小」與 R1 動機相反 | ⚠F1：不重開拍板，記回報＋QA 截圖存證交 Olina 流程外驗收 |
| G7 | iOS textarea ≥16px 紅線 vs 歸階 | §2/§6-3：`.trip-import-textarea` 歸 md 且機械驗 ≥16px；--fs-md 微調不得低於 16 |
| G8 | 單日層列殘留 button 語意 | §3.1：非互動列不得留 `role="button"`/`aria-expanded` |
| G9 | 孤兒清理無邊界 | §5 白名單＋§6-4 判準，防誤刪合法規則 |

---

## 8. SYSTEM_MAP 同步

人工補充區已新增「type scale 變數紀律（Task10 起）」條目（`--fs-*` 本輪只授權 `.trip-*`，其他分頁硬編碼字級屬「尚未收斂」非破口；`var(--fs-` 出現在非 trip 區塊＝越界）。檔案結構列（trip-tab.js/style.css/sw.js 現況描述）由 PM 閉環時更新。
