# Task20 影響分析（SA）

> spec：`Task20.spec.md`（重要資料訂位標籤過長重疊，純 CSS layout fix）
> 涉及範圍標記：**backend＝僅版號 bump（兩檔，無邏輯）＋ frontend＝css/style.css `.trip-private-*`**。含 UI，走完整 pipeline（backend → frontend → QA）。

## 0. 修法定案核實（SA 結論：spec 建議的 flex-wrap 方案可行，DOM 零改）

DOM 結構（trip-tab.js L574–594、契約見 `Task3.api.md`）：
`div.trip-private-row > span.trip-private-row-label + span.trip-private-row-value`，四小節（護照/旅遊保險/訂位資料/緊急聯絡人）共用同一組 class，逐列獨立盒 → **純 CSS flex-wrap 即可達成雙模式，`js/trip-tab.js` 不需任何改動**。

重疊成因機理（核實到碼）：`.trip-private-row-label`（style.css L1176）`width:72px; flex-shrink:0`——span 內容超過 72px 時**文字溢出固定盒、壓到右側 value 上**（不是 flex 分配問題，是 overflow）。拿掉固定 width、讓 row 可 wrap，溢出路徑即消失；flex-wrap 佈局下任何長度組合都不可能重疊（放不下就換行，這是佈局引擎保證，非數值調參保證）。

雙模式機制（frontend 可等效替代，判準為準）：
- `.trip-private-row` 加 `flex-wrap: wrap`；
- `.trip-private-row-label` 改 `width: auto; min-width: 72px`（短標籤仍佔 72px → 各小節標籤欄對齊觀感不變）＋ **`max-width: 100%`（必要，見 §2 F2）**，`flex-shrink: 0` 保留；
- `.trip-private-row-value` 維持 `flex: 1` 並加一個 `min-width`（或 flex-basis）門檻：剩餘空間 ≥ 門檻 → 同列橫排；長標籤吃掉空間後剩餘 < 門檻 → value 整體換行到下一行、flex:1 撐滿全寬 = 堆疊。

門檻值試算（390px 視口、row 左右 padding 16px×2、gap 14px）：內容寬 358px；短標籤（label 72px）時 value 可用 272px。門檻取 **180–220px 區間**皆可同時滿足兩判準——短標籤列（272 ≥ 門檻）恆橫排；「MAPLEHOUSE 淺草 訂單編號」級長標籤（--fs-sm 15px × 約 13 字 ≈ 190px+）剩餘空間必 < 門檻 → 堆疊。**具體數值由 frontend 定，QA 只驗兩判準（短橫排不變／長堆疊零重疊），不驗數值本身。**

## 1. 受影響的既有功能

| 功能 | 頁面 / 選擇器 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 重要資料—短標籤列（護照號碼/保險公司/保單號/緊急電話/聯絡人） | trip 分頁 `.trip-private-row`（四小節共用） | 同一組 CSS 規則被改，短標籤列觀感必須不變（單行橫排、標籤欄 72px 對齊） | ✅（spec 判準 4） |
| 重要資料—tel: 連結（旅遊保險緊急電話、緊急聯絡人） | `.trip-private-row-value a` | 該選擇器本身零 diff，但父容器佈局改變，須驗可點＋≥44px（橫排與堆疊兩種情境） | ✅（spec 判準 5） |
| 重要資料—訂位資料小節（本次 bug 主體） | 同上，label 來源＝匯入資料 `b.label` 任意長度 | 修復目標：長標籤堆疊零重疊、無水平溢出 | ✅（spec 判準 3） |
| trip 分頁其餘區塊（行程/航班/飯店/pill 導覽/匯入匯出區） | `.trip-itin-*`/`.trip-flight-*`/`.trip-hotel-*`/`.trip-import-*` 等 | 選擇器完全隔離，零影響 | ❌（由判準 1 diff 邊界機械涵蓋） |
| 其他五分頁（常用句/翻譯/拍照/地圖/折價券） | — | 零影響 | ❌（同上機械涵蓋） |
| 版號徽章／SW 更新 | `#app-version`、sw.js | 常規 bump v19→v20，無機制變更 | ✅（版號閘機械判準） |

## 2. Frontend 注意事項（約束清單）

- **F1 diff 白名單**：只准動 `css/style.css` 的 `.trip-private-row`／`.trip-private-row-label`／`.trip-private-row-value` 三條規則（如需微調限 `.trip-private-*` 前綴）；`.trip-private-row-value a` 及 `:active`、`.trip-private-section-title`、`.trip-private-fields`、`.trip-private-actions` 以下**建議零 diff**。
- **F2 極長標籤防溢出（spec 邊界條件的落地約束）**：label 保留 `flex-shrink: 0` 時**必須**加 `max-width: 100%`（或等效），否則超過整行寬的極長字串會水平溢出容器——這是「label 自身換行」判準的實作前提。不得改用「拿掉 flex-shrink 讓 label 被壓縮」的做法：那會變成兩窄欄並排而非堆疊，違反修法定案。
- **F3 不得動的字級/顏色行**：label `font-size: var(--fs-sm)`、value `font-size: var(--fs-md)` 及所有 color 行零 diff（type scale 授權與淺色主題紀律，SYSTEM_MAP 既有兩條）。
- **F4 觸控**：row `min-height: 44px` 與 `.trip-private-row-value a { min-height: 44px }` 不得弱化。
- **F5 堆疊時的垂直間距（spec 縫隙，SA 補完）**：`gap: 14px` 在 wrap 後同時作用於行間（row-gap）——堆疊列的 label 與 value 之間會出現 14px 垂直空隙，偏鬆。建議改雙值 `gap: <row-gap> <column-gap>`（如 `gap: 4px 14px`），row-gap 具體值由 frontend 依觀感定；此屬 `.trip-private-row` 白名單內，合法。
- **F6 label 的 `padding-top: 2px`**（與 value 大一號字的光學對齊補償）：橫排模式仍需要，堆疊模式下無害，保留即可，不必做模式分支。

## 3. Backend 注意事項

- 僅 `sw.js` `CACHE_VERSION 'v19'→'v20'`＋`js/version.js` `APP_VERSION 'v19'→'v20'`；**注意：`APP_VERSION_DATE` 現值已是 `'07/13'`＝當日（Task19 同日 bump），數值正確、該行可能零 diff**——SOP 名義「兩檔三行」，本次實際 diff 可能只有兩行，QA 判準應為「DATE 值＝bump 當日」而非「該行有 diff」。
- PRECACHE 42 筆零增減、無新檔；fetch/install/activate handler 零 diff。
- 不需 `Task20.api.md`（無介面變更）。

## 4. QA 迴歸測試清單

- [ ] **診斷閘**：diff 僅 `css/style.css`（限 `.trip-private-*`）＋`sw.js`＋`js/version.js`；`js/trip-tab.js`、`index.html` 及其他全部檔案零 diff（spec 判準 1）。
- [ ] 版號閘：`CACHE_VERSION === APP_VERSION === 'v20'` 逐字元相等；`APP_VERSION_DATE` 值＝bump 當日（07/13，該行可能零 diff 屬合法，見 §3）；PRECACHE 42 筆零增減（spec 判準 2）。
- [ ] 長標籤堆疊：注入含 bookings 長標籤（「MAPLEHOUSE 淺草 訂單編號」「MAPLEHOUSE 房型編號」）的測試資料（走 `App.privateData.save`），iPhone 視口（390px）驗 label/value boundingBox 不相交、無水平捲動；**加驗極長 label（>整行寬字串）自身換行不溢出**（F2）。測畢清除（spec 判準 3＋邊界條件）。
- [ ] 混合小節：同一小節同時含長短標籤時兩模式並存、互不影響（spec 邊界條件）。
- [ ] 短標籤觀感不變：護照/保險/緊急聯絡人列單行橫排、各小節標籤欄 72px 對齊如舊（spec 判準 4）。
- [ ] tel 連結：橫排（保險緊急電話）與堆疊（長標籤聯絡人情境，測試資料造一筆長 label 的 contact）兩情境皆可點、高度 ≥44px（spec 判準 5＋邊界條件）。
- [ ] 長 value（房型編號級）：既有 `word-break: break-all` 換行正常，兩模式皆不溢出。
- [ ] 隱私掃描三段式照常（測試匯入資料不得殘留任何 tracked 檔）。
- [ ] 其他分頁零 diff 由第一條機械涵蓋，不需逐頁點測。

## 5. spec 縫隙補完（SA 裁定，frontend/QA 依此執行）

1. **堆疊時 tel: 連結排版**：value 換行到全寬行後，`a` 仍為 inline-flex ≥44px，無需額外處理；QA 以長 label contact 測試資料實測（見 §4）。
2. **長 value 換行**：沿用既有 `word-break: break-all`，兩模式通用，零新樣式。
3. **極長標籤**：F2 的 `max-width: 100%` 為必要實作約束（spec 只寫行為「label 自身換行」，未寫實作前提）。
4. **堆疊垂直間距**：F5 雙值 gap 建議。
5. **DATE 行可能零 diff**：§3 註記，QA 判準改「值正確」。
6. **passports/contacts 的 label 同樣來自匯入資料**（p.name／c.label 任意長度）——雙模式對四小節一體生效，這是 feature 不是 side effect；已入 SYSTEM_MAP 人工補充區。

---
（SA 2026-07-13；`Task20.ready` 已消費刪除、`Task20.sa_done` 已建，backend 可開工。）
