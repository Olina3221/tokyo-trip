# Task9 — 常用句內容整理（移除 11 句國民基本用語＋新增 9 句實用句）

> 狀態：spec 完成（2026-07-12，PM）。
> 來源：Olina 提供之移除清單（11 句）與新增清單（`常用句.txt`，9 句），皆已拍板。
> `CACHE_VERSION` 現況實際值 = `v7`，本任務 bump 為**開工時實際值 +1**（預期 v7 → v8）。
> 順序拍板：**Task9 先、Task10 後**（兩任務檔案零交集，但都 bump `sw.js`，依序執行避免版本號互踩）。`Task10.ready` 已由 PM 收回，Task9 閉環後重建。

## 模組：常用句資料層（`js/phrases.js`）

### 功能描述

依 Olina 確認的清單整理 `window.PHRASES` 內容：移除 11 句「國民基本用語」（太基本、用不到）、新增 9 句實際旅途會用到的句子，並將 greetings 分類的顯示名改為「溝通・語言」（該分類移除寒暄句後只剩語言溝通句）。

### 背景與已拍板決策（不重議）

- 已完成：Task2 建常用句分頁（41 句、大字展示＋語音）；Task8 為每分類加 `id` 欄位並重構為分類 chips 導覽（一次只顯示一類、localStorage `tokyotrip.phrasesCat` 記憶）；Task11 修復 chips 裁切。
- 已拍板：移除清單 11 句、新增清單 9 句由 Olina 確認，**去留不再重議**；本 spec 已列出每分類最終完整內容，backend 照抄，不自行判斷增刪。
- 已拍板：**分類 `id` 六值（greetings/dining/shopping/transport/hotel/emergency）不得更動**——chips 導覽（`data-cat-id`）與 localStorage 分類記憶依賴它（SYSTEM_MAP 前向警告）。`cat` 顯示字串可調。
- PM 定案：greetings 的 `cat` 顯示名由「問候・基本」改為 **「溝通・語言」**（移除寒暄後只剩「我不會說日文／請說慢一點／可以用英文嗎／可以用中文對話嗎」四句，全是語言溝通；不用「溝通・求助」以免與 emergency「緊急・求助」混淆）。
- PM 定案：新增第 9 句「這個要怎麼用？可以幫我操作嗎？」歸 **shopping**（典型場景是店內自助結帳機／販賣機／退稅機，不是緊急事件）。
- 新增句的日文以本 spec 定案版為準；backend 若發現日文錯誤可校正，但**須在完成回報中列出改動與理由**，不得默默改。

### 涉及範圍

- [x] 後端／核心邏輯（`js/phrases.js` 資料內容、`sw.js` bump）
- [ ] 前端／UI（**無**——chips 由 `phrases-tab.js` 動態讀 `cat` 字串與 `id` 渲染，分類數不變、無空分類，顯示名改動零程式修改；backend 完成後直接建 `Task9.done`，跳過 frontend 階段）

### 異動總表

| 分類 id | cat 顯示名 | 移除 | 新增 | 句數變化 |
|---------|-----------|------|------|---------|
| greetings | 「問候・基本」→**「溝通・語言」** | 5 | 1 | 8 → 4 |
| dining | 餐廳・點餐（不變） | 3 | 3 | 9 → 9 |
| shopping | 購物・付款（不變） | 2 | 4 | 7 → 9 |
| transport | 交通・問路（不變） | 1 | 1 | 6 → 6 |
| hotel | 飯店・住宿（不變） | 0 | 0 | 5 → 5 |
| emergency | 緊急・求助（不變） | 0 | 0 | 6 → 6 |
| **合計** | | **11** | **9** | **41 → 39** |

### 最終內容清單（backend 照抄，含順序；每句 `{ zh, ja, romaji }` 結構不變）

#### greetings（cat: 溝通・語言）— 4 句

| # | zh | ja | romaji | 來源 |
|---|----|----|--------|------|
| 1 | 我不會說日文 | 日本語が話せません | Nihongo ga hanasemasen | 保留 |
| 2 | 請說慢一點 | ゆっくり話してください | Yukkuri hanashite kudasai | 保留 |
| 3 | 可以用英文嗎？ | 英語は使えますか？ | Eigo wa tsukaemasu ka? | 保留 |
| 4 | 可以用中文對話嗎？ | 中国語が話せる方はいますか？ | Chūgokugo ga hanaseru kata wa imasu ka? | **新增** |

#### dining（cat: 餐廳・點餐）— 9 句

| # | zh | ja | romaji | 來源 |
|---|----|----|--------|------|
| 1 | 我要點這個（指菜單） | これをください | Kore o kudasai | 保留 |
| 2 | 推薦是什麼？ | おすすめは何ですか？ | Osusume wa nan desu ka? | 保留 |
| 3 | 請問有水嗎？（喝的水） | お水をいただけますか？ | Omizu o itadakemasu ka? | **新增** |
| 4 | 不要芥末 | わさび抜きでお願いします | Wasabi nuki de onegai shimasu | 保留 |
| 5 | 我對這個過敏 | これにアレルギーがあります | Kore ni arerugī ga arimasu | 保留 |
| 6 | 這個餐點裡有昆布或海苔嗎？請簡單回答就好 | この料理に昆布や海苔は入っていますか？簡単に答えてもらえると助かります。 | Kono ryōri ni konbu ya nori wa haitte imasu ka? Kantan ni kotaete moraeru to tasukarimasu. | **新增** |
| 7 | 小朋友不吃辣 | 子供は辛いものが食べられません | Kodomo wa karai mono ga taberaremasen | **新增** |
| 8 | 請結帳 | お会計をお願いします | Okaikei o onegai shimasu | 保留 |
| 9 | 可以分開付嗎？ | 別々に払えますか？ | Betsubetsu ni haraemasu ka? | 保留 |

#### shopping（cat: 購物・付款）— 9 句

| # | zh | ja | romaji | 來源 |
|---|----|----|--------|------|
| 1 | 我可以試穿嗎？ | 試着してもいいですか？ | Shichaku shite mo ii desu ka? | 保留 |
| 2 | 有大一號的嗎？ | 大きいサイズはありますか？ | Ōkii saizu wa arimasu ka? | 保留 |
| 3 | 只是看看 | 見ているだけです | Mite iru dake desu | 保留 |
| 4 | 這個要怎麼用？可以幫我操作嗎？ | これはどうやって使いますか？操作を手伝ってもらえますか？ | Kore wa dō yatte tsukaimasu ka? Sōsa o tetsudatte moraemasu ka? | **新增** |
| 5 | 我要結帳，沒有會員卡，但有折價券 | お会計をお願いします。会員カードはありませんが、クーポンがあります。 | Okaikei o onegai shimasu. Kaiin kādo wa arimasen ga, kūpon ga arimasu. | **新增** |
| 6 | 袋子需要加錢嗎？ | 袋は有料ですか？ | Fukuro wa yūryō desu ka? | **新增** |
| 7 | 請給我袋子 | 袋をください | Fukuro o kudasai | 保留 |
| 8 | 可以免稅嗎？ | 免税できますか？ | Menzei dekimasu ka? | 保留 |
| 9 | 我要辦退稅 | 免税手続きをお願いします | Menzei tetsuzuki o onegai shimasu | **新增** |

#### transport（cat: 交通・問路）— 6 句

| # | zh | ja | romaji | 來源 |
|---|----|----|--------|------|
| 1 | 車站在哪裡？ | 駅はどこですか？ | Eki wa doko desu ka? | 保留 |
| 2 | 去這裡怎麼走？（給看地址） | ここへはどう行きますか？ | Koko e wa dō ikimasu ka? | 保留 |
| 3 | 這班車有到嗎？ | この電車は行きますか？ | Kono densha wa ikimasu ka? | 保留 |
| 4 | 我要去晴空塔，搭這台公車可以到嗎？ | このバスでスカイツリーに行けますか？ | Kono basu de sukaitsurī ni ikemasu ka? | **新增** |
| 5 | 請幫我叫計程車 | タクシーを呼んでください | Takushī o yonde kudasai | 保留 |
| 6 | 請到這個地址（給看手機） | この住所までお願いします | Kono jūsho made onegai shimasu | 保留 |

#### hotel（cat: 飯店・住宿）— 5 句：**零異動**（我有訂房／可以寄放行李嗎？／幾點退房？／冷氣壞了／可以多一組毛巾嗎？）

#### emergency（cat: 緊急・求助）— 6 句：**零異動**（請幫幫我／我迷路了／我身體不舒服／附近有醫院／藥局嗎？／請叫救護車／我的東西掉了）

### 移除清單（11 句，供 backend/QA 核對「確實不在最終檔內」）

greetings：你好、謝謝、不好意思／請問一下、對不起、麻煩你了（5）
dining：四位、請給我菜單、很好吃！（3）
shopping：這個多少錢？、可以刷卡嗎？（2）
transport：廁所在哪裡？（1）

### 檔案異動表

| 角色 | 檔案 | 異動 |
|------|------|------|
| backend | `js/phrases.js` | 依「最終內容清單」重寫六分類 items（含順序）；greetings 的 `cat` 改「溝通・語言」；六個 `id` 與整體結構（陣列 of `{id, cat, items[{zh,ja,romaji}]}`）零改動 |
| backend | `sw.js` | 僅 bump `CACHE_VERSION`（開工時實際值 +1，預期 v7→v8）；`PRECACHE_URLS` 零增刪（phrases.js 已在清單） |
| backend | `DEVELOPMENT_LOG.md` | 補完成條目（閉環閘依賴） |

### 業務規則

1. 分類 `id` 六值一字不改——`phrases-tab.js` 的 `data-cat-id` 比對與 `tokyotrip.phrasesCat` 記憶值都是 id 字串，改名 = 使用者已存的分類記憶失效＋chips 導覽壞。
2. 只增刪 `items` 與改 greetings 的 `cat` 字串；不動分類順序、不增刪分類、不改資料結構。
3. 新增句的 ja/romaji 以本 spec 定案版為準；backend 校正須回報，不默改。
4. `zh` 欄寫乾淨中文；僅 dining #3 保留短括號「（喝的水）」助辨識（要冰水/熱水時指這句再比手勢即可），其餘不帶情境註記。

### 邊界條件 / 錯誤處理

- 移除後無任何分類變空（最少 4 句），`phrases-tab.js` 的「空分類 chip 不渲染」與 fallback 邏輯不會被觸發，行為不變。
- `localStorage` 既存的 `tokyotrip.phrasesCat` 值（六 id 之一）在改版後仍全部有效，不觸發 fallback。
- `cat` 顯示名改動即時反映在 chips 文字（`chip.textContent = group.cat`），零程式修改。
- 快取：檔名不變、內容變 → 不 bump `CACHE_VERSION` 則舊句庫吃住不更新（症狀隱蔽），故 bump 為必做項。

### QA 機械判準

1. `phrases.js`：六分類 id 依序 = greetings/dining/shopping/transport/hotel/emergency（零改動）。
2. 句數 = 4/9/9/6/5/6，合計 39。
3. 移除清單 11 句的 zh 字串全數不存在；新增 9 句的 zh/ja/romaji 與 spec 逐字一致。
4. greetings 的 `cat` = 「溝通・語言」；其餘五分類 `cat` 零改動。
5. 每句三欄齊全（zh/ja/romaji 皆非空字串）。
6. `sw.js` `CACHE_VERSION` 已 +1（預期 v8），`PRECACHE_URLS` 零增刪。
7. 常用句分頁冒煙：六 chips 正常切換、點句開大字＋語音、greetings chip 顯示「溝通・語言」。

### 不在本次範圍（Non-scope，必填護欄）

- 不改 `phrases-tab.js`／`bigtext.js`／`tts.js` 任何邏輯（分類顯示名改動不需要）。
- 不改分類 `id`、不增刪分類、不改 `{zh, ja, romaji}` 資料結構。
- 不做淺色主題／導覽相關調整（Task8/Task11 已完成閉環）。
- 不做行程頁字級／單日下鑽（Task10）。
- 不做翻譯／OCR、不接網路（Task5/6）。
- 不動 `css/style.css`、`index.html`、`tripdata.js`。

## 影響範圍分析（SA，2026-07-12）

> 完整分析見 `specs/Task9.impact.md`。涉及範圍：**純後端（資料層）**，backend 完成後直接建 `Task9.done`，跳過 frontend。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 常用句 chips 導覽 | phrases-tab.js（零改） | greetings chip 文字變「溝通・語言」、句數變動，全由動態渲染吸收 | ✅ |
| 分類記憶 | localStorage `tokyotrip.phrasesCat` | 記憶值是 **id 非顯示名**（`_saveCat(group.id)`），六 id 不變 → 既存記憶全部有效、不觸發 fallback | ✅ |
| 大字展示＋語音 | bigtext.js / tts.js | 單句結構 `{zh,ja,romaji}` 不變，零波及 | ✅（抽點新增句） |
| 離線快取 | sw.js | phrases.js 在 PRECACHE 內、檔名不變內容變 → 必 bump v7→v8，否則舊句庫吃住（症狀隱蔽） | ✅ |

### Backend 注意事項
- 只動 `js/phrases.js`＋`sw.js`（僅 CACHE_VERSION 一行）＋`DEVELOPMENT_LOG.md`；hotel/emergency 兩塊 git diff 零變更行；phrases.js 檔頭註解保留。
- 空分類風險：無（移除後最少 greetings 4 句），`phrases-tab.js` 空分類與 fallback 路徑均不觸發。

### Frontend 注意事項
- 無（本任務跳過 frontend 階段）。

### QA 迴歸測試清單（機械判準兩點精確化，全文見 impact.md §6）
- **移除 11 句的 grep 範圍 = `js/phrases.js` 單檔**（specs/ 歷史檔本來就含這些字串，不得動）；**比對用 zh 全字串，不可用 ja**（「麻煩你了」的 ja「お願いします」是多句保留句的子字串，ja grep 必假陽性）。
- [ ] 六 id 依序零改動、句數 4/9/9/6/5/6=39、新增 9 句逐字一致、greetings cat=「溝通・語言」
- [ ] `git diff` 只落在 phrases.js / sw.js（僅 v7→v8 一行）/ DEVELOPMENT_LOG.md
- [ ] 預存 `tokyotrip.phrasesCat` 任一 id → 重載仍選中該分類（記憶不失效）
- [ ] 常用句分頁冒煙＋其餘分頁全系統冒煙帶過
- 提醒 PM 閉環：同步更新 SYSTEM_MAP（41→39 句、greetings 顯示名）。
