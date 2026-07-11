# Task11.impact.md — 影響範圍分析（SA）

> 對象：Task11（U1 底部導覽列淺色化＋放大、U2 常用句 chips 裁切修復、U3 航班/飯店卡淺色化）
> 依據：`specs/SYSTEM_MAP.md`＋實際盤點 `css/style.css`（1585 行）、`js/phrases-tab.js`、`index.html`、`sw.js`、Task8.impact.md/Task8.api.md、Task10.spec.md（界線確認）
> 涉及範圍：**前端為主（style.css）；後端僅 sw.js bump（v6→v7）**。U2 判定為純 CSS 修法（見 §2），**phrases-tab.js 零變更、不需 Task11.api.md**——backend 為近 no-op 過場（只 bump）。

---

## 1. 受影響的既有功能

| 功能 | 頁面 / 檔案 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 底部導覽列 | `#nav-bar`（五分頁常駐）＋ style.css :129–186 | U1：深藍底→白底、#7A8DB8→變數、icon/label 放大；z-index 10 與 `role="tablist"` 結構不變 | ✅ |
| 全部五個分頁的內容高度 | `.tab-section`（:74–85，`bottom: var(--nav-h)`） | 若 `--nav-h` 固定部分調高（§3 建議 60px），五分頁內容底界同步上移——`--nav-h` 全檔僅 :35 定義＋:79 引用，無他處硬編碼，自動連動安全 | ✅（五頁底部無遮蓋/無露空隙） |
| 常用句分頁 chips | `.phrases-chips-bar`（:1253）＋ phrases-tab.js（唯讀確認，零變更） | U2：加 `flex-shrink: 0`（§2）；橫向捲動、分類切換、`tokyotrip.phrasesCat` 記憶行為不變 | ✅ |
| 行程頁航班/飯店子區塊 | `.trip-flight-card`（:697）/`.trip-hotel-card`（:789）＋ A9 override block（:1198–1244） | U3：深藍卡→淺卡；override block 整塊刪除後卡內文字**自動回歸**基礎規則的全域變數（基礎規則從未改走硬編碼，見 §4） | ✅ |
| 卡內大字鈕→bigtext overlay | `.trip-btn-bigtext`（:907 全域淺色版自動接手）＋ `.bigtext-*`（零變更） | 刪 :1239–1244 覆寫後，卡內大字鈕回歸 A6 全域樣式；點開後的 overlay 規則零 diff | ✅ |
| 深色 overlay 解耦紀律 | `.bigtext-*` / `.cv-*` | 零變更。注意 :427、:1579 兩處 `#7A8DB8` 是 overlay 等值解耦硬編碼，**必須保留**（機械判準見 §5-3） | ✅（diff 為零即可） |
| 離線快取 | `sw.js` | v6→v7 bump（§6）；PRECACHE 零增刪 | ✅ |
| 佇列連動 | Task10 | 本任務閉環後 PM 重建 `Task10.ready`；Task10 的 CACHE_VERSION 自動吸收為 v7→v8 | —（PM 閉環動作） |

---

## 2. U2 chips 裁切成因判定（SA 定案，證據式）

**成因（一句話）：`.tab-section` 是 `display:flex; flex-direction:column` 的固定高度捲動容器，`.phrases-chips-bar` 作為其直接 flex 子項未設 `flex-shrink: 0`，且它因 `overflow-x: auto` 使 flex 自動最小尺寸（`min-height: auto`）降為 0——列表內容高於容器時，全部壓縮量都落在 chips bar 上，被壓到近 0 高只剩頂端一線。**

判定 spec 候選 1（flex 壓縮）成立，證據鏈：

1. **DOM 結構**（phrases-tab.js `_buildShell`，:208–241）：`.phrases-chips-bar` 與 `.phrases-list-area` 是 `section#tab-phrases` 的**直接子元素**——即直接 flex items。
2. **容器**（style.css :74–85）：`.tab-section` = `position: fixed`（高度被 top/bottom 釘死）＋ `overflow-y: auto` ＋ `display: flex; flex-direction: column`。
3. **壓縮量為何全砸在 chips bar**：flex item 預設 `flex-shrink: 1; min-height: auto`。`min-height: auto` 的自動最小值 = min-content，**但僅在 overflow 為 visible 時生效**；`.phrases-chips-bar` 設了 `overflow-x: auto`（:1260），依 CSS 規範另一軸的 visible 會被計算為 auto → 其自動最小高度為 **0**，可被壓到 0。`.phrases-list-area` overflow 維持 visible → 最小高度 = 全部句子的 min-content 高，**壓不下去**。兩者相加超過容器高時，唯一能縮的就是 chips bar。
4. **症狀吻合**：壓縮後殘高 ≈ 只露出 padding-top 與 chip 頂緣，正是「努力找了一下才看到一點點頂端」。sticky（候選 3）、z-index 疊蓋（候選 4）不會產生「元素在流內但高度趨近 0」的表現；safe-area（候選 2）在 `default` 狀態列下 inset-top=0，body 與 .tab-section 定位一致，無位移可言，均排除。
5. **為何 Task8 QA 沒抓到**：flex 壓縮只在「單類列表高度＋chips bar 高 > 容器高」時觸發。桌面高視窗、或句子少的分類（transport 6 句）下總高不足以觸發，QA 假陰性。→ QA 本輪必須用**矮 viewport（如 iPhone SE 667px）＋最大分類（dining 9 句）**重現修前症狀、確認修後消失（§8-3）。

**修法（一句話）：`css/style.css` 的 `.phrases-chips-bar` 加一行 `flex-shrink: 0;`——歸 frontend，純 CSS。**

分工裁決：**backend 不動 `js/phrases-tab.js`（DOM 結構正確，無需修正），不產 `Task11.api.md`；backend 僅執行 sw.js bump。** 候選 5（舊快取）非成因但列入 QA 驗證步驟：bump 至 v7 後以冷 install 確認吃到新 css。

**附帶盤點（不修，記錄防未來誤判）**：其他分頁無同型潛伏 bug——`.trip-container`/`.coupons-container` 是各自 section 的**唯一** flex 子項且 overflow visible（min-content 地板保護，壓不出此症狀）。但此結構性風險是永續紀律，已補進 SYSTEM_MAP 人工補充區（Task5/6 在 `.tab-section` 內放多個直接子元素時同樣要 `flex-shrink: 0`）。

---

## 3. U1 導覽列：改動點清單與 `--nav-h` 連動

改動點（全部在 style.css，index.html nav DOM 預期零變更）：

| # | 位置 | 現值 | 改為 |
|---|------|------|------|
| N1 | `#nav-bar` :138 | `background-color: var(--c-primary)` | `#FFFFFF`（比 `--c-bg` #F5F6F8 亮一階） |
| N2 | `#nav-bar` :139 | `border-top: 1px solid rgba(255,255,255,0.15)`（淺底上隱形） | `1px solid var(--c-divider)`＋新增 `box-shadow: 0 -2px 10px rgba(0,0,0,0.06)`（數值可微調記回報）；同步改掉 :139 過時註解 |
| N3 | `.nav-btn` :159 | `color: #7A8DB8`（深底解耦硬編碼） | `var(--c-text-muted)`；導覽列區塊不得殘留 #7A8DB8 |
| N4 | `.nav-btn.active` :165–167 | `color: var(--c-accent)`（淺底文字 3.5:1 不過 AA） | `var(--c-accent-text)`；可另加字重 700 或極淺 accent tint，frontend 定案記回報 |
| N5 | `.nav-icon` :175 | `font-size: 24px` | `28px`（emoji 靠 font-size 放大；`color` 對 emoji 無效，色彩規則實際作用於 `.nav-label`） |
| N6 | `.nav-label` :182 | `font-size: 10px` | `12px`（±1px frontend 可定案記回報） |

**`--nav-h` 連動判定（SA 實算，frontend 必看）**：

- 放大後 `.nav-btn` 內容高 ≈ icon 28（line-height:1）＋ gap 3 ＋ label 12×預設行高(~1.2)≈14.4 ＋ 上下 padding 12 = **約 57–58px，超出現值 56px**。`#nav-bar` 無固定高、`align-items: stretch`，實際會被內容撐到 ~58px，而 `--nav-h` 仍算 56px → **導覽列會蓋住內容底部約 2px**。
- **必須二選一（frontend 定案記回報）**：(a) `--nav-h` 固定部分 56px → **60px**（spec 允許上限 64px，只准改 :35 這一處）；或 (b) `.nav-label` 設 `line-height: 1` 把內容壓回 56px 內。SA 建議 (a)——放大後多給呼吸空間，且不依賴字體渲染細節。
- 連動安全性已驗證：`--nav-h` 全 repo 僅 :35 定義＋:79 `.tab-section { bottom: var(--nav-h) }` 引用，無任何他處硬編碼導覽列高度 → 調 :35 一處，五分頁自動跟隨。QA 驗「內容底部不被蓋、不露空隙」（§8-2）。
- 觸控目標：`.nav-btn` min-height 56px 維持 ≥44px ✅。z-index 10、`role`/`aria-*`、`data-tab` 均不動。

---

## 4. U3 航班/飯店卡：要清的深色硬編碼與 accent 文字改點

**核心事實（讓 U3 變成小 diff）**：兩卡的**基礎規則從未改走硬編碼**——`.trip-flight-no`(:725)/`.trip-flight-endpoint`(:775) 等仍是 `var(--c-text)`，`.trip-flight-date`(:731)/`.trip-hotel-dates`(:807) 等仍是 `var(--c-text-muted)`，`.trip-flight-note` border(:784)/兩卡 border(:702/:794) 仍是 `var(--c-divider)`，`.trip-hotel-note` 底(:860)已是 `rgba(0,0,0,0.04)`，`.trip-btn-bigtext` 全域版(:907)已是淺色 A6 樣式。深色觀感完全來自 Task8 A9 override block 的**覆寫**。因此：

| # | 位置 | 動作 |
|---|------|------|
| T1 | **A9 override block :1198–1244 整塊刪除**（含區塊註解） | `#F0F4FF`×3 組、`#B0BDD8`×3 組、`rgba(255,255,255,0.10/0.12/0.06/0.10)`×4 全清；卡內主/次文字、note 區、divider 邊框、卡內大字鈕**自動回歸**上述基礎規則的全域變數與淺色慣例，不需逐條重寫 |
| T2 | `.trip-flight-card` :700 | `background-color: var(--c-primary)` → `#FFFFFF`（PM 建議值；border :702 已是 `var(--c-divider)`，T1 刪覆寫後自動生效） |
| T3 | `.trip-hotel-card` :792 | 同 T2 |
| T4 | `.trip-flight-label` :710 | `color: var(--c-accent)` → `var(--c-accent-text)`（11px 文字，accent 對比紀律） |
| T5 | `.trip-hotel-tel a` :846 | `color: var(--c-accent)` → `var(--c-accent-text)`（18px 文字連結） |
| T6 | `.trip-flight-arrow` :759 | `var(--c-accent)` 作 22px「→」圖形感元素——依 spec 可留 `--c-accent`，frontend 依對比定案記回報 |
| T7 | `.trip-flight-route` :740 | `background-color: rgba(0,0,0,0.20)`（深卡內深區）→ 淺 tint，建議對齊 A5 慣例 `rgba(0,0,0,0.04)` 量級，frontend 定案記回報 |
| T8 | 過時註解清理 | :19–20（`:root` 「導覽列/品牌卡保留 --c-primary 深色」）與 :698 前後的卡片註解一併更新——**U1+U3 後全檔已無任何 `var(--c-primary)` 直接引用**（:1503 `.cv-header` 是硬編碼 rgba(31,42,92,.90)，僅註解提及，零變更）。`--c-primary` 變數本身保留（品牌色定義） |

**只動色彩（Task10 界線）**：上表全部是 color / background-color / border-color / box-shadow / 整塊刪除；兩卡的 font-size（flight-no 24px、hotel-name 26px 等 10–26px 散值）**一個都不動**，字級統一歸 Task10 的 `--fs-*` type scale。

---

## 5. 界線機械判準（QA 直接照抄執行）

1. **`.trip-*` diff 白名單**：`git diff css/style.css` 中出現在 `.trip-` 選擇器的變更**僅允許**：(a) :1198–1244 整塊刪除；(b) :700、:792 的 `background-color`；(c) :710、:846 的 `color`；(d) :759 的 `color`（若 frontend 定案改）；(e) :740 的 `background-color`；(f) 純註解行。屬性種類僅限 color/background(-color)/border-color/box-shadow——出現任何 `font-size`/`line-height`/`font-weight`/padding/margin/DOM 結構 diff 即 FAIL。
2. **其餘 `.trip-*` 零變更**：日卡（`.trip-day-*`）、pill（`.trip-pill*`）、項目列（`.trip-item-*`）、重要資料/私人段/匯入匯出（`.trip-important-*`/`.trip-private-*`/`.trip-import-*`/`.trip-export-*`/`.trip-btn-*` 全域規則）全部零 diff。
3. **`#7A8DB8` 計數判準**：改前全檔 3 處（:159 nav、:427 bigtext、:1579 cv）；改後**恰好 2 處且行號語意為 bigtext disabled 鈕與 cv 壞圖文案**——:159 消失、overlay 兩處原樣保留。`.bigtext-*`/`.cv-*` 全部規則 git diff 為零。
4. **js 零變更清單**：`phrases.js`、`phrases-tab.js`（依 §2 裁決）、`trip-tab.js`、`tripdata.js`、`coupons-tab.js`、`coupon-viewer.js`、`import-data.js`、`app.js`、`tts.js`、`bigtext.js`、`manifest.webmanifest` git diff 全零；`sw.js` diff 恰好一行（v6→v7）。
5. **index.html**：預期零變更（nav DOM 現況即可承載 U1；U2 成因不在 meta 層）。若 frontend 確需動，僅限 nav 區塊且記回報。
6. **U2 修法定位**：`.phrases-chips-bar` 區塊（:1253–1264）新增 `flex-shrink: 0;` 一行（±格式）；`.phrases-chip*` 其餘規則與 `.phrases-list-area` 不強制動（若 frontend 順手加 `.phrases-list-area { flex-shrink: 0 }` 之類**不必要防禦，不准**——最小修法紀律）。

---

## 6. sw.js bump 定案

- 現值實測 `CACHE_VERSION = 'v6'`（sw.js:19）→ **bump 'v7'**（spec「開工時實際值 +1」，與預期一致）。
- 本次變更檔：`css/style.css`（確定）、`index.html`（預期零變更）——均已在 PRECACHE_URLS，**零增刪**。
- backend 執行一次，frontend 不得重複 bump；QA 驗 `CACHE_VERSION === 'v7'`＋PRECACHE 零增刪。
- 已知成本：bump 觸發 16 張券圖重下載（4.37MB），既有拍板接受。

---

## 7. Spec 縫隙補完

| # | 縫隙 | SA 補完 |
|---|------|---------|
| G1 | U2 分工懸置（spec 寫「僅當 SA 判定成因在 DOM 才動 js」） | §2 定案：成因在 CSS（flex 壓縮），**phrases-tab.js 零變更、無 Task11.api.md**；backend 僅 bump |
| G2 | U1 放大後 56px 是否夠高，spec 只給「若擁擠可調上限 64px」 | §3 實算：放大後內容 ~58px **必然**超出 56px（非「若」），已給二選一定案路徑（建議 --nav-h 60px），QA 驗蓋/縫 |
| G3 | U3 後 `--c-primary` 全檔零引用，:root 註解過時 | §4-T8：變數保留、註解更新；:139 nav 深底註解同步清 |
| G4 | `#7A8DB8` 驗收語意模糊（spec 寫「導覽列區塊無殘留」，但 overlay 有兩處合法同值） | §5-3 計數判準：3→2，overlay 兩處必須原樣保留，不得誤刪 |
| G5 | U2 為何 Task8 QA 沒抓到／本輪如何避免假陰性 | §2-5：flex 壓縮有觸發條件；QA 必須矮 viewport＋最大分類（dining 9 句）先重現修前症狀再驗修後（§8-3） |
| G6 | 其他分頁是否有同型潛伏 bug | §2 附帶盤點：無（唯一子元素＋min-content 地板）；結構性紀律已補 SYSTEM_MAP 人工補充區供 Task5/6 |
| G7 | SYSTEM_MAP 解耦紀律條目更新時點 | 人工補充區已標「Task11 進行中」註記；閉環時由 PM 把導覽列與航班/飯店卡自深底清單正式移除（結案後深底清單僅存 `.bigtext-*`/`.cv-*`） |

---

## 8. Backend / Frontend 注意事項與 QA 迴歸清單

### Backend 注意事項
1. 僅動 sw.js :19 一行（'v6'→'v7'）；PRECACHE_URLS 一個字不動。
2. **不動 phrases-tab.js**（§2 裁決）、不產 Task11.api.md。
3. 完成後建 `Task11.backend_done`（絕對路徑 `C:\Python Project\tokyo-trip\specs\`）。

### Frontend 注意事項
1. 施工順序建議：U2 一行修（§5-6）→ U1 照 §3 N1–N6＋`--nav-h` 二選一定案 → U3 照 §4 T1–T8。三者都在 style.css，一次做完。
2. `--nav-h` 只准改 :35 的固定部分（56px→建議 60px，上限 64px），不得在別處硬編碼導覽列高度。
3. 刪 A9 block 時**整塊刪**（:1198–1244 含區塊註解），不要逐條留殘骸；刪後靠基礎規則自動回歸，不要重複補寫等值規則。
4. overlay 兩處 `#7A8DB8`（:427、:1579）與 `.bigtext-*`/`.cv-*` 全區**碰都不碰**。
5. 定案記回報：陰影值、active 指示方式、--nav-h 選項、icon/label ±1px、T6 箭頭色、T7 route tint 值。
6. 完成後刪 `Task11.backend_done`、建 `Task11.done`。

### QA 迴歸測試清單
- [ ] U1：導覽列白底＋分隔線＋上陰影可辨識；非 active=`--c-text-muted`、active=`--c-accent-text`；icon 28px、label 12px（±1px 記錄）；觸控 ≥44px；五分頁切換正常、`tokyotrip.lastTab` 記憶正常
- [ ] `--nav-h` 連動：五個分頁捲到最底，內容不被導覽列蓋住、導覽列上緣無空隙（若 frontend 選 60px，驗 `.tab-section` bottom 實測值一致）
- [ ] U2：**先在矮 viewport（iPhone SE 667px 模擬）＋ dining 分類重現修前裁切（git stash 舊版或註解掉 flex-shrink 驗證），再驗修後** chips bar 完整高度可見（44px 觸控整顆露出）、sticky 置頂、橫向可捲、切分類正常、`tokyotrip.phrasesCat` 記憶正常
- [ ] U3：航班/飯店卡淺底深字；卡內主/次文字、divider、note 區、電話連結、大字鈕對比清晰；FLIGHT/HOTEL 標籤與班次號 accent 點綴正確（文字處=`--c-accent-text`）
- [ ] 卡內大字鈕點開 `.bigtext-*` overlay：深底白字原樣、關閉/播放正常（overlay diff 為零）
- [ ] 券圖檢視器 `.cv-*`：店名/關閉鈕/壞圖文案原樣（diff 為零）
- [ ] 界線機械判準 §5 全部執行（`.trip-*` 白名單、#7A8DB8 計數 3→2、js 零變更清單、sw.js 單行）
- [ ] `CACHE_VERSION === 'v7'`、PRECACHE 零增刪；冷 install 後確認吃到新 css（順帶消化 U2 候選 5 的快取排除驗證）
- [ ] Task1–4＋Task8 全功能迴歸（分頁切換、大字、語音、常用句分類切換與記憶、券圖 pinch/pan、匯入/匯出/清除）
- [ ] 隱私掃描三段式照常（SYSTEM_MAP 既有紀律）
- 新功能（淺色觀感）由 QA 依 spec 驗收；最終目視由 Olina 部署後流程外確認
