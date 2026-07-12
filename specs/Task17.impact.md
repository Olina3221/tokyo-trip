# Task17.impact.md — 地圖分頁＋KML→mapdata 影響範圍分析（SA）

> 對照 `specs/SYSTEM_MAP.md` v16 現況＋直接讀碼驗證（app.js / index.html / sw.js / style.css / trip-tab.js / tripdata.js）＋KML 原檔機械抽驗。
> 涉及範圍標記：**後端／核心邏輯 ＋ 前端／UI 皆有**（pipeline 走 backend → frontend → QA 全程）。

---

## 1. 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 分頁框架 | `app.js` TAB_IDS / showTab / registerTab / lastTab | TAB_IDS 加 `'map'`（additive）；讀碼確認框架無任何寫死 5 的邏輯（見 §2），既有五分頁零行為影響 | ✅（六分頁切換迴歸） |
| 底部導覽列 | `index.html` #nav-bar＋`style.css` .nav-btn | 加第 6 鈕；`.nav-btn { flex:1 }` 天然均分，無寫死寬度，390px→65px/鈕、375px→62.5px/鈕，「地圖」2 字 12px nowrap 放得下 | ✅（視覺確認無裁切） |
| wrap 鏈四層 | coupon-viewer→camera-tab→translate-tab→bigtext | **零變動**。map-tab 不 wrap（無錄音/TTS/overlay 需離開清理）。從 camera/translate 切到 map 時各層守門正常觸發（camera 停 track、translate abort 錄音）——這是既有行為對新 id 的自然生效，非新邏輯 | ✅（camera→map 停 track、translate 對話中→map abort） |
| 既有 4 分頁佔位卡 | `index.html` 4 處 `.placeholder-card`（phrases/translate/trip/coupons） | 一併清除。**讀碼確認安全**：四個 tab 的 JS 均以覆蓋式建構 DOM——phrases-tab.js:209/250 `section.innerHTML=''`、translate-tab.js:149 `section.innerHTML=''`（注釋明寫「清除佔位卡」）、trip-tab.js:837 `tabEl.innerHTML=''`、coupons-tab.js:175 `tabEl.innerHTML=''`——**無任何模組依賴佔位節點**，清除後視覺零影響 | ✅（四分頁渲染正常） |
| style.css 孤兒選擇器 | `.placeholder-card/-icon/-title/-desc`（style.css 約 104–131 行）＋80 行注釋 | 佔位 HTML 清除後成孤兒，一併刪；index.html 31 行「整塊替換 .placeholder-card」注釋同步改寫 | ✅（grep=0 機械閘） |
| SW 離線快取 | `sw.js` PRECACHE | 現值 39 筆（已逐筆點算），+mapdata.js +map-tab.js → 41；bump 付 16 張券圖重下成本（既知，行前 wifi 可接受） | ✅（冷 install 離線開地圖） |
| 版本機制 | `version.js`＋`sw.js` | 兩檔三行：v16→v17、DATE 更新；現值已確認 'v16'/'07/12' 兩檔一致 | ✅（逐字元機械閘） |
| 行程分頁 | `trip-tab.js` / `tripdata.js` | **零 diff**。map-tab 對 `window.TRIP.itinerary` 唯讀 lookup（day/theme 顯示）；TRIP isoDate 已讀碼確認為 `2026-07-21`～`2026-07-25` 五天，與 MAPDATA 合併後的 5 天完全對齊 | ✅（行程分頁功能不變） |
| api.js | — | **零 diff**。deep-link 是 URL 開啟非 fetch；且跨域頂層導航不經本站 SW fetch handler，無快取污染面 | ✅（git diff = 0） |

## 2. 分頁框架 additive 擴充安全性（讀碼結論）

app.js 全檔無寫死「5」：
- `registerTab`/`showTab` 均以 `TAB_IDS.indexOf(id)` 守門——陣列加 `'map'` 後自動合法。
- `showTab` 以 `TAB_IDS.forEach` 控 section hidden、`querySelectorAll('[data-tab]')` 控鈕狀態——皆隨 DOM/陣列自動擴。
- fallback `TAB_IDS[0]` 仍 `'phrases'`（'map' 插 trip 與 coupons 之間，不動首位）。
- `tokyotrip.lastTab` 存 `'map'` 是既有 key 的新合法值，**非新 key**；舊值仍全部合法。
- **對齊約束（backend/frontend 注意）**：TAB_IDS 陣列順序 `['phrases','translate','camera','trip','map','coupons']` 必須與 index.html 導覽鈕 DOM 順序一致（視覺順序由 DOM 決定，陣列順序只影響遍歷，但兩者不一致會造成維護誤導）。

## 3. KML→mapdata 機械抽驗（SA 已對原檔跑過）

對 `C:\Olina\其它\東京\2026東京.kml`（28,178 bytes）實測：
- `<Placemark>` = **49**、`<Folder>` = **6**（`0721/0722/0723/0724-築地/0724 橫濱/0725`，檔內順序築地在前）——與 spec 自檢基準完全吻合。
- 幾何全為 `<Point>`（49），**0 LineString / 0 Polygon**——無路線幾何混入，腳本可假設單點座標；但仍建議腳本遇非 Point 幾何 fail loud（防 Olina 日後改 My Maps 加路線）。
- 座標序實證為 `經度,緯度,高度`（首筆 `140.3864853,35.7658492,0`＝成田）；以 lon,lat 解讀全 49 筆落 lon∈[139,141]/lat∈[35,36]，**若忘記對調，49 筆將全數越界**——spec 的範圍自檢是有效的機械閘。
- 地名陷阱（腳本必須處理）：
  1. **1 筆 CDATA 包裹＋含撇號**：`<![CDATA[【Luke's Lobster 表参道店】午餐備案]]>`——`xml.etree` 的 `.text` 會透明解 CDATA，無需特判；但輸出 JS 時撇號/引號必須正確跳脫 → **建議 places 陣列用 `json.dumps(..., ensure_ascii=False)` 生成**，一次解決引號/反斜線/Unicode 跳脫。
  2. 地名含全形括號【】（）與空格——渲染端一律 `textContent`（禁 innerHTML 插地名）、URL 端一律 `encodeURIComponent`。
- MAPDATA 5 天 isoDate（07-21～25）與 `tripdata.js` TRIP.itinerary 五天逐一對得上，日期頭 day/theme lookup 全命中。

## 4. deep-link 正確性確認

- 三種 URL 形態（spec B2/B3）格式正確；`hl=zh-TW` 全帶；transit 模式；A=目前位置省略 origin ✓。
- **SW 面確認**：`sw.js` fetch handler 只攔本站 client 的 GET 資源請求；點外連是頂層導航（iOS standalone 交系統開 Google 地圖 App），導航請求依目標 URL 的 SW 配對，**不經本站 SW**——無金鑰、無快取污染、api.js 零 diff 成立。
- 開啟方式（backend/frontend 注意）：必須在點擊 handler 同步棧內 `window.open(url, '_blank')` 或 `<a href target="_blank" rel="noopener">`——任何 await/setTimeout 之後才開會被 iOS 攔。
- 座標輸出建議保留 KML 原始精度（7 位小數），不四捨五入。

## 5. wrap showTab——map-tab 不 wrap 的確認

- map 分頁無錄音、無 TTS、無 overlay、無 camera track——切走時**無任何需清理的資源**，不 wrap 是正確設計，四層鏈零變動。
- 反向確認：map 分頁切入/切出對四個守門層（camera：`id!=='camera'`、translate：`id!=='translate'`）而言只是又一個普通目標 id，行為與切去 trip/coupons 無異。
- index.html A6 載入順序注釋更新時，**wrap 鏈四層順序注釋不得改動**（map-tab.js 插 trip-tab.js 之後即可，位置在 api.js 之前，map-tab 對 api/recorder 零依賴故合法）。

## 6. 可編輯 A/B v1

- A/B 選擇與自訂終點全存 closure 記憶體，**零新 localStorage key** ✓——不觸發 key 登記紀律；QA 機械閘 `map-tab.js` 內 `localStorage` 出現次數＝0。
- onShow 冪等（`_initialized` 慣例）＋A/B 跨日期切換保留（closure 不隨 onShow 重置）——backend 實作時注意「冪等 init」與「每次 onShow 重渲清單」的分界：init 建骨架一次，onShow 可刷新選中日但**不得重置 A/B 狀態**。
- 「今天」判斷比照 trip-tab：init 算一次、跨午夜不刷新（已文件化的可接受限制）；`getTodayIsoDate` 自寫不 import（trip-tab closure 內部函式本來就不可及）。

## 7. Backend 注意事項

1. `make_mapdata.py`：資料夾名取開頭 4 位數字（`0724-築地` 與 `0724 橫濱` 兩種分隔都要吃）；解析不到 MMDD → fail loud；非 Point 幾何 → fail loud；places 用 `json.dumps(ensure_ascii=False)` 輸出；檔尾自檢摘要（總數 49／天數 5／範圍檢查）必印。輸出 UTF-8（無 BOM）。
2. `mapdata.js` 檔頭注釋含「生成檔勿手改＋KML 不進 repo」，**不得寫入 KML 本機路徑以外的本機資訊**（隱私紀律）；也**不得寫死版號字串**（Task14 紀律，含注釋）。
3. `app.js` 只動 TAB_IDS 一行；registerTab/showTab/SW 註冊段零 diff（QA 逐檔 git diff 驗）。
4. 產 `Task17.api.md`：MAPDATA schema、map-tab DOM/class 契約、三種 deep-link 組 URL 規則（含 hl=zh-TW 必帶、encodeURIComponent 邊界）。
5. 零 diff 清單（spec §C）：api.js / tts.js / bigtext.js / recorder.js / trip-tab.js / tripdata.js / translate-tab.js / camera-tab.js。

## 8. Frontend 注意事項

1. `<section id="tab-map" class="tab-section" hidden></section>`——**hidden 屬性必帶**（比照 camera；漏掉會在首屏與 phrases 同時可見直到 showTab 跑完）。留空，DOM 由 map-tab.js 建構。
2. 導覽鈕插行程與折價券之間，DOM 順序與 TAB_IDS 對齊；六鈕擠壓護欄：label ≥11px、不動既有五鈕 id/結構、`--nav-h` 60px 不變。
3. `#tab-map` 多子元素 flex：chips 列、A/B 列、語言提示、離開 APP 小字全部 `flex-shrink: 0`，地點清單唯一捲動區（Task11 U2 永續紀律）。
4. 自訂終點輸入框字級 ≥16px（iOS 聚焦縮放紅線）；地點列兩鈕 ≥44px。
5. `.map-*` 前綴、字級全硬編碼禁 `var(--fs-`、無 z-index ≥100、淺色主題引用全域變數合法（map 無深底 overlay）。
6. placeholder 清理：index.html 4 處 `.placeholder-card` 區塊刪除（section 本體保留）＋style.css 四個孤兒選擇器＋兩處注釋（style.css:80、index.html:31）改寫。
7. B3-1 語言提示靜態文字＋README.md 補一句。
8. index.html A6 注釋更新：mapdata.js 插 tripdata.js 之後、map-tab.js 插 trip-tab.js 之後。

## 9. Spec 縫隙補完（SA 裁定，不涉業務規則）

| # | 縫隙 | SA 裁定 |
|---|------|---------|
| G1 | 新 section 未明寫 `hidden` 屬性 | 必帶（見 §8-1），比照 camera section 現況 |
| G2 | 地名含撇號/CDATA 的 JS 跳脫未明定 | 腳本用 json.dumps 生成 places（§3、§7-1） |
| G3 | deep-link 開啟 API 未明定 | 同步手勢棧內 `window.open(url,'_blank')` 或 anchor＋`rel="noopener"`（§4） |
| G4 | 非 Point 幾何未定義行為 | 現檔全 Point；腳本遇非 Point fail loud（防 KML 日後改版默默漏點） |
| G5 | TAB_IDS 順序 vs DOM 順序關係未明寫 | 兩者必須一致（§2 對齊約束） |
| G6 | onShow 刷新 vs A/B 狀態保留的分界 | init 建骨架、onShow 可刷新日期選中、A/B closure 狀態不重置（§6） |
| G7 | 「今天」跨午夜語意 | 比照 trip-tab：init 算一次不刷新，已知可接受限制（§6） |

## 10. QA 迴歸測試清單

- [ ] 既有五分頁切換全正常、渲染零視覺差（placeholder 清除後）；六分頁循環切換迴歸
- [ ] wrap 四層 call-through：camera 取景中→切 map（track 停）、translate 對話錄音中→切 map（abort）、券檢視器開啟時切 map（關閉）、大字 overlay 開啟時切 map（關閉）
- [ ] `tokyotrip.lastTab='map'` 重啟還原到地圖分頁；壞值 fallback phrases 不變
- [ ] v17 兩檔逐字元＋DATE；PRECACHE 41 筆；冷 install 斷網開地圖清單可見
- [ ] MAPDATA：5 天／49 點／0724 合併築地在前／全點 lat∈[35,36] lon∈[139,141]
- [ ] deep-link 三形態＋hl=zh-TW 全帶＋自訂文字 encodeURIComponent（含【】與空格地名）
- [ ] `map-tab.js` localStorage=0；`.map-*` 節 `var(--fs-`=0；無 z-index≥100；index.html `placeholder-card`=0（含 css 孤兒選擇器）
- [ ] 零 diff 清單逐檔 git diff：api/tts/bigtext/recorder/trip-tab/tripdata/translate-tab/camera-tab
- [ ] 隱私掃描三段式照常；mapdata.js 內無本機路徑資訊
- [ ] 小站/公車站日文顯示＝已知限制不判 FAIL（spec B3-1）
- 新功能驗收由 QA 依 spec §E 展開；真機外連手感＝Olina 部署後流程外驗收

---
（SYSTEM_MAP 人工補充區已同步新增 map 分頁相關依賴；本 Task 無新增業務層級隱蔽依賴——map 對 TRIP 的唯讀 lookup 已登錄。）
