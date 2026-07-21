# Task23 — Day 2 巴士警語移除 ＋ 新增「購物」頁籤（藥妝/伴手禮清單，可勾選持久化）

> PM spec。急件：Olina 2026-07-22（明天）出發，且預計明天就把藥妝與伴手禮買齊——本 Task 今晚必須閉環部署。
> 版本 bump：v22 → **v23**（兩檔三行 SOP：`js/version.js` APP_VERSION/APP_VERSION_DATE ＋ `sw.js` CACHE_VERSION，backend 開工時以實際值 +1）。

---

## 模組：A. Day 2 巴士停駛警語移除（tripdata.js）／B. 購物頁籤（新分頁）

### 功能描述

A：把 Task22 加在 Day 2「電車→上野阿美橫丁」item detail 開頭的「⚠ Skytree Shuttle 平日停駛」警語整行刪除，只留可實際執行的電車動線。
B：新增第 7 個分頁「購物」——Olina Excel 購物清單（藥妝 12 項＋伴手禮 10 項）進 App，每項可勾「已買」且重開 App 不遺失，邊逛邊看還缺什麼。

### 背景與已拍板決策（不重議）

- 已完成：Task22 已閉環（Day 2 重寫為 11 筆詳細動線，含警語恰 1 次的冒煙判準）；Task21 已閉環（民宿資訊＋`qa_smoke_test.py` 冒煙基線 33 判準）。現況 v22 已上線。
- **已拍板（A）**：Olina 明確指示**直接刪除警語，不要寫在 App 裡**。原話：「停駛本來就無法搭乘，給我一個不能用的東西就沒必要了。」detail 只保留可執行的電車動線，**不要提巴士、不要提「改為」「原本」這類會讓人想起廢案的字眼**。
- **已拍板（B）**：購物清單兩分類都進去；★ 額外推薦標記保留；匯率註記 1¥ = NT$0.18 要呈現；可勾選＋本機持久化（比照 repo 既有 localStorage 模式）；要有清除全部勾選的重置手段；手機上不能一次全攤開成文字牆。
- SA/backend/frontend 不得重開已拍板討論；有疑慮記入回報交 PM，不自行改走別條路。

### 涉及範圍

- [x] 後端／核心邏輯（tripdata.js 資料修改、新資料檔、分頁註冊、localStorage 邏輯、冒煙基線更新、bump）
- [x] 前端／UI（index.html 第 7 顆導覽鈕＋section、購物頁樣式）

backend 必寫 `Task23.api.md`（資料 schema ＋ DOM/class 結構供 frontend）。

---

## A 部分：Day 2 警語移除

### A1. tripdata.js diff 範圍（唯一改動點）

`js/tripdata.js` Day 2（isoDate "2026-07-22"）12:40 item（title「電車→上野阿美橫丁」）的 `detail` 欄，**刪除首行警語＋其換行符**，其餘逐字元零 diff：

刪除（現況首行，[實測] 2026-07-21 讀檔定位於該 item detail 開頭）：

```
⚠ Excel 原定的 Skytree Shuttle 巴士平日停駛（僅六日假日行駛），7/22 週三改搭電車\n
```

改後 detail 全文（即現況去掉首行，①–④ 與懶人備案逐字保留）：

```
① 東武晴空塔線：東京晴空塔站 → 淺草，坐回 1 站約 3 分（¥157）
② 出東武改札後往雷門方向下地下道，轉「銀座線」淺草站（步行約 3–5 分；銀座線淺草是起點站，來的每班都可搭）
③ 銀座線：淺草 → 上野，坐 3 站約 5 分（¥178）
④ 上野站走「5b 出口」，出來就是 JR 高架下、阿美橫丁入口在眼前
💤 懶人備案：Solamachi 1F 計程車招呼站直接攔車到阿美橫丁（約 15 分／¥1,500–2,000 整台）
```

- title「電車→上野阿美橫丁」不變（無廢案字眼）。
- Day 2 其他 10 筆 item、其他四天、flights/hotels/COUPONS 逐位元零 diff。
- 懶人備案（計程車）**保留**——它是可實際執行的備案，非廢案殘影。

### A2. 冒煙判準連動更新（qa_smoke_test.py，必做否則冒煙紅燈）

- **T22-3 就地改寫**：`Skytree Shuttle` 在 Day 2 段預期次數由 1 → **0**（判準名可改 T23-A1，註解註明「Task23 起警語移除，Task22 的恰 1 次判準由本輪正當解除」）。
- T22-1（items = 11）、T22-2（既有禁字串）、T22-4（時間軸單調遞增）**不變、必須續過**。
- 追加 Day 2 段禁字詞：`停駛`、`改搭`、`原定` grep=0（防警語殘影字眼；[實測] 改後 detail 全文不含此三詞，Day 2 其餘 items 亦不含）。
- `Task22.spec.md`／`Task22.impact.md` 為閉環存檔**不回改**（repo 慣例，比照 Task13/Task19）；「恰 1 次」判準的行為新權威＝本 spec。

### A3. mapdata.js 檢查結論

[實測] 2026-07-21 grep `js/mapdata.js` 0722 段：7 點＝東武浅草駅／東京晴空塔站／Solamachi／上野駅／三浦三崎港／秋葉原駅／麵屋武藏，**無任何巴士站牌／巴士相關點位**。→ **mapdata.js 本輪零 diff**（QA 以 git diff 驗證）。

---

## B 部分：購物頁籤

### B1. 分頁註冊與檔案

| 項目 | 定案 |
|------|------|
| 分頁 id | `shopping`（`App.TAB_IDS` additive 插入 `'map'` 與 `'coupons'` 之間，成 7 分頁；既有六 id 順序零改動——registerTab/showTab 本體 indexOf/forEach 自動支援，app.js 僅改 TAB_IDS 一行） |
| 導覽鈕 | index.html `#nav-bar` 第 6 位插入（地圖與折價券之間，與 TAB_IDS 順序對齊）：icon 🛒、label「購物」 |
| section | `<section id="tab-shopping" class="tab-section" hidden>`（tab-map 與 tab-coupons 之間；DOM 由 JS 動態建構，section 留空） |
| 資料檔 | 新檔 `js/shoppingdata.js` → `window.SHOPPING`（純靜態公開資料，比照 mapdata.js 定位；載入插 `mapdata.js` 之後、`app.js` 之前的資料層） |
| 功能檔 | 新檔 `js/shopping-tab.js`（`App.registerTab('shopping',{onShow})`，onShow 冪等比照 coupons-tab `_initialized` 模式；**不 wrap showTab**——無錄音/TTS/overlay，比照 map-tab.js；載入插 `map-tab.js` 之後） |
| PRECACHE | 42 → **44** 筆（+shoppingdata.js、+shopping-tab.js） |

排序理由：購物與折價券相鄰（逛藥妝店時兩頁互相參照——勾清單、出示折價券）。

### B2. 資料 schema（`window.SHOPPING`）

```js
window.SHOPPING = {
  rateNote: "1¥ ≈ NT$0.18",           // 匯率註記，頁首常駐顯示
  categories: [
    { id: "drug", name: "藥妝",   items: [ /* 12 筆 */ ] },
    { id: "gift", name: "伴手禮", items: [ /* 10 筆 */ ] }
  ]
};
```

item 統一 schema（兩分類欄位不同 → **選填欄位處理**，渲染時「有值才出該列」）：

| 欄位 | 型別 | 藥妝 | 伴手禮 | 說明 |
|------|------|------|--------|------|
| `id` | string | 必填 | 必填 | 勾選持久化的穩定錨點：藥妝 `d01`–`d12`、伴手禮 `g01`–`g10`（依 B3 表順序）。**id 一經發佈不得改**（改＝使用者勾選狀態失配） |
| `name` | string | 必填 | 必填 | 品名 |
| `star` | bool | 選填 | 選填 | ★ 額外推薦品（Excel「藍色為額外推薦品」語意） |
| `desc` | string | 必填 | 必填 | 藥妝＝用途說明；伴手禮＝口味/特色說明 |
| `twPrice` | string | 有 | 無 | 台灣售價（NT$）；含「台灣買不到」「無此款」等字面值，**照 Excel 逐字轉載不正規化** |
| `jpPrice` | string | 有 | 有 | 日本售價（¥），照 Excel 逐字（含 `/箱`、`/500g` 等單位） |
| `ntPrice` | string | 有 | 有 | 換算 NT$，照 Excel 逐字（「約356」「約270-450」） |
| `where` | string | 有 | 有 | 建議購買/採購地點 |
| `shelfLife` | string | 無 | 有 | 保存期限 |
| `notes` | string | 有 | 有 | 備註 |

### B3. 資料內容（22 筆全量，權威來源＝Olina Excel「購物清單」工作表，[實測] 2026-07-21 dump 逐字轉載）

**藥妝（drug，12 筆；★＝d09–d12）**

| id | ★ | name | desc | twPrice | jpPrice | ntPrice | where | notes |
|----|---|------|------|---------|---------|---------|-------|-------|
| d01 | | Chocola BB Plus B群 180錠 | 補充維生素B群，改善口角炎、皮膚粗糙、慢性疲勞；長期服用效果明顯 | 1,400 | ¥1,980 | 約356 | 松本清、各藥妝店 | 台灣有賣但貴2.5倍，掃貨首選 |
| d02 | | TRANSINO White C Clear II 美白錠 240錠 | 美白專用複方錠，抑制黑色素生成，改善斑點、暗沉；需連續服用3個月以上見效 | 台灣買不到 | ¥2,880 | 約518 | 松本清、各藥妝店 | 針對肝斑、曬斑效果明顯 |
| d03 | | 白兔牌 HYTHIOL-C PLUS 270錠 | 高單位維生素C＋L-半胱胺酸複方，三管齊下美白、抗氧化、改善肝斑 | 台灣買不到 | ¥3,280 | 約590 | 松本清、各藥妝店 | 和TRANSINO搭配使用效果更強 |
| d04 | | 參天 Sante FX Neo 清涼眼藥水 | 高清涼度眼藥水，緩解眼睛疲勞、乾澀、充血；長時間盯螢幕後最有感 | 無此款 | ¥880 | 約158 | 各大藥妝、便利商店 | 清涼感強，第一次用要有心理準備 |
| d05 | | SS製藥 TravelMin 暈車暈船藥 | 預防動暈症（暈車/暈船/暈機），出發前30分服用，效果持續4-6小時，較不嗜睡 | 無此款 | ¥1,100 | 約198 | 藥妝店、便利商店 | 搭遊覽車、纜車、遊船前都適用 |
| d06 | | 大塚製藥 Oronine H 多功能軟膏 40g | 萬用抗菌消炎軟膏：輕微燙傷、痘痘、嘴角炎、皮膚乾裂、蚊蟲叮咬、富貴手皆可用 | 無此款 | ¥748 | 約135 | 各大藥妝 | 旅行必帶，一條搞定大部分皮膚小問題 |
| d07 | | 龍角傘 喉糖含片（薄荷） | 漢方草藥喉糖，舒緩喉嚨不適、止咳潤喉；粉末版效果更直接，老少皆宜 | 約200 | ¥880 | 約158 | 各大藥妝、便利商店 | 空調房喉嚨乾也很有效，旅行常備 |
| d08 | | 獅王 LION 休足時間 足貼 18片 | 薄荷涼感足貼，貼腳底8小時，消除腿部疲勞與水腫感；逛街一整天後貼超有感 | 約350 | ¥660 | 約119 | 各大藥妝 | 行程尾聲必買，晚上貼著睡一覺隔天又是新的腿 |
| d09 | ★ | 花王 Megurism 蒸氣眼罩 12片（薰衣草） | 40°C蒸氣熱敷眼部，持續約20分鐘，放鬆眼部肌肉；飛機上或睡前使用效果最好 | 約450 | ¥660 | 約119 | 各大藥妝 | 推薦薰衣草款助眠；無香款也有 |
| d10 | ★ | 肌研 極潤玻尿酸保濕乳液 200mL | 含三種玻尿酸的高保濕乳液，敏感肌可用，塗完皮膚立刻Q彈；台灣版容量小又貴 | 約750 | ¥1,078 | 約194 | 各大藥妝 | 全家人都能用，買兩瓶很正常 |
| d11 | ★ | 曼秀雷敦 口內炎貼（口腔潰瘍貼） | 直接貼在口腔潰瘍傷口上，藥膜隔絕刺激同時加速癒合；吃飯講話不會掉落 | 無此款 | ¥880 | 約158 | 各大藥妝 | 嘴巴破救星，效果比漱口水直接 |
| d12 | ★ | 池田模範堂 Muhi 無比滴 止癢液 | 清涼型止癢外用液，適用蚊蟲叮咬；兒童版（粉紅）較溫和，成人版清涼感更強 | 約200 | ¥680 | 約122 | 各大藥妝 | 夏天東京蚊子多，旅行必備 |

（d07「龍角傘」疑為「龍角散」之 Excel 筆誤——預設照 Excel 逐字轉載 [實測]；Olina 若要改字，流程外告知即可，不擋工、不影響任何機制。）

**伴手禮（gift，10 筆；★＝g07–g10）**

| id | ★ | name | desc | where | jpPrice | ntPrice | shelfLife | notes |
|----|---|------|------|-------|---------|---------|-----------|-------|
| g01 | | 干貝糖（各口味） | 整顆帆立貝柱（干貝）乾燥調味製成，濃郁鮮甜高蛋白，Q彈口感、個別包裝；可當零嘴/下酒菜，也能切碎入菜或熬湯 | 上野阿美橫丁、成田機場北海道物產 | ¥1,500-2,500 / 500g | 約270-450 | 3-6個月 | 台灣蝦皮約NT$1,385-1,500/500g，日本現場約NT$270-450，省900-1,200元！阿美橫量大可議價；試吃需主動問攤主 |
| g02 | | Calbee 薯條三兄弟 | 北海道馬鈴薯製，三種粗細口感同一盒，鹹香不油膩，分量多好分送同事 | 成田機場、各大超市 | ¥594/箱 | 約107 | 約3個月 | 機場版有多口味禮盒，方便 |
| g03 | | Kanro Pure 夾心軟糖 | 外層細砂糖包覆，內層濃縮果汁軟糖，口感Q彈酸甜；葡萄/蜜桃/草莓最受歡迎 | 便利商店、藥妝店 | ¥270/袋 | 約49 | 1年 | 大袋在藥妝更划算，買5袋以上 |
| g04 | | MAPLE BUTTER BOY 楓糖奶油餅乾 | 楓糖風味奶油夾心薄餅，香氣濃郁、酥脆中帶鹹甜平衡；比砂糖奶油樹更有特色 | 東京車站 GRANSTA、成田機場 | ¥1,080/12入 | 約194 | 30天 | 機場也有，最後一天掃貨 |
| g05 | | GRAPESTONE 砂糖奶油樹 | 輕盈酥脆的奶油焦糖千層餅，甜而不膩，最多人帶的東京伴手禮之一 | 機場、百貨、7-11 | ¥756/8入 | 約136 | 60天 | 7-11就買得到，不用特別跑 |
| g06 | | 楓糖長崎蛋糕（東京車站限定） | 傳統長崎蛋糕加入楓糖香氣，口感濕潤綿密帶焦糖甜香；效期極短需注意 | 東京車站 GRANSTA（需確認） | ¥1,200/盒 | 約216 | 10天 | 效期短，最後一天才買；先確認是否還有販售 |
| g07 | ★ | 東京香蕉 TOKYO BANANA | 海綿蛋糕包覆香蕉奶油餡，輕甜不膩、口感鬆軟；最具代表性的東京限定甜點 | 成田機場、東京車站 | ¥1,080/8入 | 約194 | 5天 | 效期5天，最後一天在機場買 |
| g08 | ★ | Press Butter Sand 奶油焦糖夾心餅 | 酥脆外皮夾入奶油焦糖醬，層次豐富鹹甜交織；近年爆紅，常需排隊或早到才有 | 東京車站 GRANSTA | ¥1,080/9入 | 約194 | 30天 | 機場較少見；東京車站開門前去排 |
| g09 | ★ | 東京牛奶起司工廠 Milk Cheese | 牛奶與起司雙層夾心薄餅，清爽微鹹甜不膩；長輩接受度高，分送最保險 | 成田機場、COREDO、百貨 | ¥980/10入 | 約176 | 30天 | 機場有賣，最後集中採購 |
| g10 | ★ | 白色戀人（北海道產） | 白巧克力夾心薄脆餅，口感細緻甜而不膩；注意：這是北海道名產，不是東京限定 | 成田機場免稅店 | ¥1,800/18片 | 約324 | 6個月 | 機場免稅最便宜；買給特別重要的人 |

### B4. UI 設計（資訊密度定案＋理由）

**版面＝「主資訊常駐＋詳情展開」的卡片清單**，單一捲動頁、兩個分類群組（coupons-tab 分組渲染模式）：

```
[頁首列]（flex-shrink:0，.tab-section 多子元素 U2 紀律）
  匯率 1¥ ≈ NT$0.18 ｜ ★＝額外推薦 ｜ 已買 n/22
[捲動清單區]
  ▍藥妝（已買 n/12）
    卡片 ×12
  ▍伴手禮（已買 n/10）
    卡片 ×10
  [清除全部勾選]（清單底部，confirm 防誤觸，比照 .phrases-restore-btn 定位）
```

**卡片結構**（左右兩個獨立觸控目標，皆 ≥44px）：

- **左：勾選區**（checkbox 樣式，點擊＝切換已買）——與展開觸控目標分離，逛街單手操作不誤觸。
- **右：內容區**（點擊＝展開/收合詳情）：
  - 收合態（預設）：`★?＋品名`＋`¥日本售價 ≈ NT$換算`＋展開 chevron——每卡兩行。
  - 展開態追加列（有值才渲染，處理兩分類欄位差異）：說明（desc）／台灣售價（藥妝）／購買地點／保存期限（伴手禮）／備註。
- 已買態：整卡降 opacity（約 0.45）＋checkbox 打勾；**不重排、不移動位置**（清單順序＝Excel 順序，逛街時位置記憶比分區整齊重要）。
- 展開狀態存記憶體（closure），不持久化。

**設計理由**：22 項 × 5–7 欄全攤開約 130+ 列文字，手機上必成文字牆。逛街現場的決策迴圈是「找到品項 → 確認價格 → 勾掉」——所以常駐資訊只留品名＋價格＋★；用途/口味說明是行前閱讀性質，收進展開層。收合態每卡兩行，一個分類約一個螢幕高，掃視得動。

（實作樣式細節——checkbox 視覺、chevron、群組標題樣式——frontend 依 `Task23.api.md` DOM 結構自行發揮，遵守既有淺色主題與觸控 ≥44px；**字級硬編碼禁用 `var(--fs-*)`**——type scale 授權範圍現況僅 `.trip-*`，SYSTEM_MAP 紀律。）

### B5. localStorage（已買狀態持久化）

| 項目 | 定案 |
|------|------|
| key | **`tokyotrip.shoppingChecked`**（[實測] 與既有 7 key——lastTab/privateData/phrasesCat/translateDir/translateMode/myPhrases/hiddenPhrases——零衝突） |
| 值 | JSON 陣列，內容＝已勾 item 的 `id` 字串（如 `["d01","g07"]`）。以 id 為錨（資料在 repo 內、id 由我們控制，不需 Task19 式 zh+ja 簽名） |
| 讀寫 | **`shopping-tab.js` 獨占此 key**（單一消費者，不另立資料層檔——my-phrases.js 分檔是因雙消費者，此處無此需求）；讀寫全包 try/catch |
| 壞資料 | parse 失敗/非陣列 → 視同空陣列（全未買）；陣列內非法 id 忽略不清洗 |
| 無痕/私密瀏覽降級 | checkbox 照常渲染、勾選**當次 session 有效**（記憶體 Set 為真相，localStorage 寫入失敗靜默）——購物頁核心就是勾選，不可因降級把功能藏掉 |
| 重置 | 「清除全部勾選」鈕：confirm 後 `removeItem('tokyotrip.shoppingChecked')`＋清記憶體 Set＋重繪。**只准 removeItem 自己的 key，全 repo 禁 `localStorage.clear()`**（repo 級鐵律） |
| iOS 兩坑 | 沿既有已知限制（SYSTEM_MAP）：Safari 分頁與主畫面 APP 不共用 localStorage——勾選要在 APP 內做；儲存壓力清除＝勾選重來（商品資料在 repo 不受影響），不需額外救濟機制 |

### B6. 隱私確認（硬性）

[實測] 2026-07-21 逐筆檢視 22 筆資料：全部為公開商品資訊（品名/價格/店名/效期），**無任何個資**（無姓名/電話/證件/訂位號）→ `shoppingdata.js` 落公開層合法。QA 沿既有三段式隱私掃描（工作樹 grep＋TT1. base64 解碼＋git log -p），新檔一併納入掃描範圍。

---

## 業務規則

1. 資料照 Excel 逐字轉載（含「台灣買不到」「無此款」「需確認」等字面值），**不正規化、不腦補補值**——這是 Olina 自己整理的採購決策資料，改字＝改她的決策依據。
2. ★ 標記語意＝「額外推薦品」（Excel 藍色標記），頁首圖例註明。
3. 勾選狀態是 per-device 本機資料，不進匯入碼、不同步家人手機（採購由 Olina 主導，單機即可）。
4. 匯率註記常駐頁首（所有換算價的前提）。

## 邊界條件 / 錯誤處理

- `window.SHOPPING` 缺載/空 → 顯示「購物清單載入失敗」文案不壞頁（比照 coupons-tab）。
- 分類 items 為空陣列 → 該群組不渲染（防未來資料調整壞頁）。
- localStorage 讀寫失敗 → 靜默降級（見 B5），不彈錯誤。
- 所有使用者可見文字經 textContent 或 escHtml 注入（資料含 `&`、`'` 等字元）。

## 不在本次範圍（Non-scope，護欄）

- **不做**購物清單的 App 內編輯（新增/刪除/改品項）——資料源是 Excel，改資料＝改 shoppingdata.js 重新部署。
- **不做**已勾項目重排/分區（沉底、隱藏皆不做）。
- **不做**勾選狀態跨裝置同步或進匯入碼。
- **不動** `js/mapdata.js`（A3 已實測零殘留）、`js/phrases.js`（「我要去晴空塔，搭這台公車可以到嗎？」是通用常用句、Task9 Olina 拍板清單內容，與 Day 2 行程警語無關，保留；要刪需 Olina 另行拍板）。
- **不動** COUPONS 資料與折價券頁、翻譯/對話/拍照/地圖全區、`App.privateData` 全機制。
- **不回改** `Task22.spec.md`/`Task22.impact.md`（閉環存檔）。
- 不改 schema 以外的既有資料、不重構既有模組、不提前做任何 Roadmap 項目。

## 證據等級標註（signal-flow 硬性規定）

| # | 假設/預設方案 | 等級 | 依據／最晚拍板點 |
|---|--------------|------|------------------|
| E1 | 警語現況位置＝Day 2 12:40 item detail 首行；刪除後餘文如 A1 | **[實測]** | 2026-07-21 讀 `js/tripdata.js` L118–122 |
| E2 | mapdata.js 0722 段無巴士殘留（7 點全為電車動線） | **[實測]** | 2026-07-21 grep 0722 段逐點檢視 |
| E3 | 22 筆資料內容與 ★ 歸屬（藥妝 4＋伴手禮 4） | **[實測]** | 2026-07-21 Excel dump 逐字轉載（`購物清單`工作表） |
| E4 | `tokyotrip.shoppingChecked` 無 key 衝突 | **[實測]** | SYSTEM_MAP localStorage 登記表＋grep 既有 7 key |
| E5 | 冒煙 T22-3 現驗恰 1 次、位於 qa_smoke_test.py L290–295 | **[實測]** | 2026-07-21 讀檔 |
| E6 | 390px 視口 7 顆導覽鈕不溢出不換行（每顆約 55.7px，現行 icon 28px/label 12px 內容需求約 40px） | **[推斷]** | **frontend 實作時必實測**（Playwright 390px viewport）。若溢出：優先縮 nav-btn padding，**不得縮 icon/label 字級**（Task11 Olina 拍板放大），縮字級需回報 PM |
| E7 | 「主資訊常駐＋詳情展開」是 Olina 要的掃視密度 | **[推斷]** | 依她「不能一次全攤開變文字牆」指示的合理實現；實機手感由 Olina 部署後流程外回饋，不擋本輪驗收 |

## 冒煙判準（機械可驗，backend additive 加入 `qa_smoke_test.py`）

1. **T22-3 改寫**：Day 2 段 `Skytree Shuttle` 次數 == **0**。
2. Day 2 段禁字詞追加：`停駛`、`改搭`、`原定` grep=0；既有 T22-1/T22-2/T22-4 續過。
3. `js/mapdata.js` 零 diff（QA 以 git diff 驗，不入 smoke 腳本亦可）。
4. `shoppingdata.js`：分類恰 2（drug/gift）、items 12＋10、`star: true` 恰 4＋4、id 集合恰 `d01–d12`＋`g01–g10` 無重複、含 `0.18` 匯率註記。
5. 版號兩檔逐字元相等＝`v23`；PRECACHE 恰 **44** 筆且含 `shoppingdata.js`/`shopping-tab.js`。
6. `app.js` TAB_IDS 含 `'shopping'` 且長度 7；index.html `data-tab` 鈕恰 7 顆、`section#tab-shopping` 存在；nav 順序與 TAB_IDS 一致。
7. `shopping-tab.js` 中 localStorage key 字面值恰為 `tokyotrip.shoppingChecked`；全 repo `localStorage.clear()` grep=0。
8. 隱私三段式掃描續過（新檔納入）。

## 交接與閉環註記

- 流程：本 spec → `Task23.ready`（SA 影響分析，重點：TAB_IDS 第 7 分頁對 wrap 鏈/lastTab 值域的波及、`.tab-section` 多子元素 flex-shrink 紀律、PRECACHE 重量成本）→ backend（A＋B 資料與邏輯、冒煙基線、bump、`Task23.api.md`）→ `Task23.backend_done` → frontend（index.html＋樣式、E6 實測）→ `Task23.done` → QA 三階段。
- PM 閉環時：更新 `行前檢查清單.md` A 節（購物頁真機驗收項：勾選→殺 App 重開仍在、清除全部勾選、7 顆導覽鈕顯示正常）＋ SYSTEM_MAP（新分頁/新 key 登記）＋ INDEX 閉環註記。
- 本 Task 無擋工拍板點（P-N），不建 `.approved`。

---

## 影響範圍分析（SA，2026-07-21）

> 全文＝`Task23.impact.md`（權威）。本節摘要結論；涉及範圍＝backend＋frontend，走完整鏈。

### PM 判定複核結論（四指定重點）

1. **E6 導覽鈕溢出：不會溢出，餘裕大**——實算現行 CSS（#nav-bar 無水平 padding、.nav-btn flex:1 basis 0% 等寬）：390px 下每顆 55.7px、min-content 上限約 41.1px（最長 label 仍是「折價券」），7 顆合計約 288px < 390px，總餘裕約 102px；連 320px 視口都安全。前提＝**新鈕沿用既有 class、不動 nav 四個既有規則**。E6 Playwright 三斷言（scrollWidth==clientWidth／7 顆等寬 ≥44／label 不截斷）仍必跑。溢出時唯一合法解＝縮 .nav-btn 水平 padding，禁縮字級（Task11 拍板）。
2. **新檔連動完整**：載入序（shoppingdata 插 mapdata 後/app.js 前、shopping-tab 插 map-tab 後）、TAB_IDS 第 7 id（registerTab/showTab 天然支援、lastTab 值域自動擴含且回退安全）、PRECACHE 42→44、wrap 鏈四層零 diff（shopping-tab 不 wrap）皆成立；`window.SHOPPING` 與 `.shopping-*` 無占用；分頁 id 'shopping' 與 phrases 分類 id 'shopping' 分屬不同命名空間，零衝突。
3. **`tokyotrip.shoppingChecked` 零衝突且與匯入碼完全隔離**（[實測] import-data.js 只觸碰 `tokyotrip.privateData` 單一 key）——重匯入不清勾選、清勾選不動私密資料。
4. **T22-3 改 0 正確且乾淨**：`Skytree Shuttle`/`停駛`/`改搭`/`原定` 全檔僅在警語行一處，刪後全檔 grep=0；T22-1/2/4 續過。

### SA 新發現（spec 未明說、必做）

- **F1**：qa_smoke_test.py **L58–78 寫死 `PRECACHE==42`**——backend 必須**就地改寫**為 44（含 L58 注解），否則冒煙必紅。本輪「改既有判準」恰 2 處（T22-3、PRECACHE），其餘 additive。
- **F2**：隱私掃描段 scan_files 是**寫死 5 檔清單**——須 additive 加入 shoppingdata.js/shopping-tab.js/Task23.spec.md/Task23.api.md，否則「新檔納入掃描」落空。
- **F3**：Task21 type-scale 判準的 regex 以「下一個 `/*` 注解」為區塊終點——**購物頁 CSS 必須以自己的注解頭開場**，否則其（必要的）硬編碼字級被吞進 Task21 區塊誤紅。
- **F4**：購物頁「頁首列＋清單」多子元素模式——頁首 `flex-shrink:0`、清單唯一捲動區（Task11 U2 紀律，比照 #tab-map）。
- **F5**：tripdata.js 單檔雙契約——COUPONS 零 diff 必驗。

### QA 迴歸清單（摘要，全文見 impact.md §6）

- [ ] 更新後冒煙基線全過（v23／PRECACHE 44／T22 續過／T23 新判準）
- [ ] git diff 機械驗：mapdata.js=0、tripdata.js 僅刪一行、其餘 13 支 js 零 diff
- [ ] 七分頁切換＋lastTab='shopping' 還原；Day 2 12:40 卡無警語殘影
- [ ] 購物頁全功能＋勾選×匯入碼隔離實測；390px 無溢出
- [ ] wrap 鏈迴歸（錄音中切購物頁）；離線冷 install 44 筆；隱私三段式含新檔
