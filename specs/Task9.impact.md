# Task9.impact.md — 常用句內容整理 影響範圍分析（SA）

> 日期：2026-07-12。對照 `SYSTEM_MAP.md`、`Task8.api.md`、`js/phrases.js`（現況已逐字核對）、`js/phrases-tab.js`（全文讀畢）、`sw.js`（CACHE_VERSION 現值 v7 已確認）。
> 涉及範圍標記：**純後端（資料層）**。frontend 階段跳過——backend 完成後直接建 `Task9.done` 交 QA。

## 結論摘要

低風險純資料任務。六個分類 `id` 全保留、移除後無空分類（最少 greetings 4 句）、`tokyotrip.phrasesCat` 記憶的是 **id 字串非顯示名**——greetings 改名「溝通・語言」不會使任何使用者的分類記憶失效。`phrases-tab.js` 確定零改動。唯一隱蔽風險是漏 bump `CACHE_VERSION`（舊句庫吃住不更新），已列必做。

## 1. 分類 id 契約與記憶值（逐條驗證）

| 檢查點 | 結論 | 證據 |
|--------|------|------|
| 六 id 保留 | ✅ spec 異動總表六 id 零改動 | spec 業務規則 1；`phrases-tab.js:60` 以 `PHRASES[i].id === id` 比對 |
| 空分類風險 | ✅ 無。移除後最少 4 句（greetings），空分類 chip 不渲染路徑（`phrases-tab.js:218`）不會觸發 | 異動總表 4/9/9/6/5/6 |
| 記憶值存 id 非顯示名 | ✅ `_saveCat(group.id)`（`phrases-tab.js:94-100`）寫入的是 id；`_getInitialCat` 用 id 查找。greetings 的 `cat` 改「溝通・語言」對已存記憶零影響 | `phrases-tab.js:75,96` |
| fallback 邏輯 | ✅ 不觸發。六 id 不變 → 既存 `tokyotrip.phrasesCat` 值（六 id 之一）改版後全部有效 | `phrases-tab.js:80-91` |
| 顯示名即時生效 | ✅ `chip.textContent = group.cat`（`phrases-tab.js:224`）動態讀，改字串零程式修改 | — |

## 2. phrases-tab.js 零改動（確定）

`phrases-tab.js` 對 `window.PHRASES` 是**純動態消費**：迭代陣列讀 `id`/`cat`/`items`，無任何硬編碼句數、分類名或索引假設。句數增刪、順序調整、顯示名改動皆不需動它。`_initialized` 冪等 flag 只影響同一 session 內重繪——本任務是資料檔換版（SW bump 後重載頁面），不受影響。

**bigtext.js / tts.js 同樣零波及**：消費的是單句 `{zh, ja, romaji}` 結構，結構不變。

## 3. 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 常用句 chips 導覽 | phrases-tab.js（零改） | greetings chip 文字變「溝通・語言」；各分類句數變動 | ✅（冒煙：六 chips 切換） |
| 分類記憶 | localStorage `tokyotrip.phrasesCat` | id 不變 → 記憶值全部有效，不觸發 fallback | ✅（改版後既存值仍選中原分類） |
| 大字展示＋語音 | bigtext.js / tts.js | 結構不變，零波及 | ✅（抽點新增句開大字＋播音） |
| 離線快取 | sw.js | phrases.js 在 PRECACHE 內、檔名不變內容變 → **必須 bump v7→v8** 否則舊句庫吃住（症狀隱蔽） | ✅ |

## 4. Backend 注意事項

1. **只動兩檔＋日誌**：`js/phrases.js`（照 spec「最終內容清單」逐字重寫六分類 items，含順序）、`sw.js`（僅 line 19 `CACHE_VERSION = 'v7'` → `'v8'`，PRECACHE_URLS 零增刪）、`DEVELOPMENT_LOG.md` 補條目。
2. hotel / emergency **零異動**——這兩塊在 git diff 中不應出現任何變更行。
3. 檔頭註解（phrases.js:1-3）保留不動。
4. 六個 `id`、分類順序、`{zh, ja, romaji}` 結構、陣列 of `{id, cat, items}` 外形零改動。
5. 新增句 ja/romaji 以 spec 定案版為準；若校正日文須在完成回報列出改動與理由，不得默改。
6. bump 副作用（已知成本，非本任務問題）：PRECACHE 全量重抓含 16 張券圖 4-7MB（SYSTEM_MAP 人工補充區「PRECACHE 重量前向成本」），行前家用 wifi 可接受。

## 5. Frontend 注意事項

無（本任務跳過 frontend 階段）。chips 文字、句數變動全由既有動態渲染吸收。

## 6. QA 機械判準（SA 校準版）

spec 判準全數有效，以下兩點**精確化**：

1. **「移除 11 句不再出現」的 grep 範圍 = `js/phrases.js` 單檔**，不是全 repo——`specs/Task9.spec.md`、`specs/Task8.spec.md`、`specs/Task2.api.md` 本來就含這些字串（歷史存檔，不得動）。
2. **移除驗證用 zh 全字串比對，不可用 ja**——例：移除句「麻煩你了」的 ja「お願いします」是多句保留句（お会計をお願いします 等）的子字串，用 ja grep 必假陽性。

完整清單：
- [ ] `js/phrases.js`：六分類 id 依序 = greetings/dining/shopping/transport/hotel/emergency，`PHRASES.length === 6`
- [ ] 句數 = 4/9/9/6/5/6，合計 39
- [ ] 移除 11 句 zh 字串在 `js/phrases.js` 內零出現；新增 9 句 zh/ja/romaji 與 spec 逐字一致（含順序）
- [ ] greetings `cat` = 「溝通・語言」；其餘五分類 `cat` 零改動
- [ ] 每句 zh/ja/romaji 三欄皆非空字串
- [ ] `git diff --stat` 只落在 `js/phrases.js`、`sw.js`、`DEVELOPMENT_LOG.md`；sw.js 的 diff 僅 CACHE_VERSION 一行（v7→v8），PRECACHE_URLS 零增刪；hotel/emergency 兩塊零 diff 行
- [ ] localStorage 相容冒煙：預存 `tokyotrip.phrasesCat = "dining"`（任一 id）→ 重載 → 仍選中該分類（不 fallback）
- [ ] 常用句分頁冒煙：六 chips 切換、greetings chip 顯示「溝通・語言」、抽點新增句開大字＋語音

## 7. spec 縫隙

無阻斷性縫隙。一點提醒（不影響 backend 開工）：**PM 閉環時同步更新 `SYSTEM_MAP.md`** 的 phrases.js 行（41 句 → 39 句、greetings 顯示名）與人工補充區 PHRASES 契約條目的句數描述，避免地圖漂移。Task10 與本任務檔案零交集但共用 sw.js bump，PM 已拍板 Task9 先行、`Task10.ready` 閉環後重建——順序契約已在 spec 檔頭，backend 無需處理。

## 8. QA 迴歸測試清單

- [ ] 常用句分頁全功能（chips 切換／大字／語音）——本次唯一波及頁
- [ ] 其餘分頁（行程／折價券）不受影響，全系統冒煙帶過即可
- [ ] 離線快取：bump 後更新生效（新句庫可見、舊句不見）
