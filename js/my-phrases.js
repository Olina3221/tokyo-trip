/**
 * js/my-phrases.js — 使用者自訂常用語儲存模組（Task18）
 *
 * 對外介面：App.myPhrases（掛在全域 window.App）
 * localStorage key：tokyotrip.myPhrases（JSON 陣列，此模組獨占）
 *
 * 元素 schema：{ zh, ja, romaji:'', catId, ts }
 * catId 白名單（靜態，不執行期讀 window.PHRASES，零依賴）：
 *   greetings / dining / shopping / transport / hotel / emergency
 *
 * 紀律：
 *   - 純資料層：不碰 DOM / API / TTS
 *   - 清除只准 removeItem 自己的 key，禁 localStorage.clear()
 *   - 新增放陣列最前（新→舊排序）
 *   - 去重：zh(trim)+ja 雙欄全等（跨分類亦重複）；重複不寫入不搬家
 *   - 缺載防禦：消費者呼叫前先檢查 App.myPhrases 存在
 *
 * 依賴：app.js 須在本檔之前載入（App 物件已存在）
 * 載入順序：bigtext.js < my-phrases.js < phrases-tab.js
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'tokyotrip.myPhrases';

  // catId 靜態白名單（與 phrases.js 六分類 id 一致，永不執行期讀 PHRASES）
  var VALID_CAT_IDS = [
    'greetings', 'dining', 'shopping', 'transport', 'hotel', 'emergency',
  ];

  // ── catId 合法性檢查 ─────────────────────────────────────────
  function _isValidCatId(catId) {
    for (var i = 0; i < VALID_CAT_IDS.length; i++) {
      if (VALID_CAT_IDS[i] === catId) return true;
    }
    return false;
  }

  // ── localStorage 可用性測試（比照 import-data.js _tt_test 手法）──
  function isAvailable() {
    try {
      localStorage.setItem('_tt_test', '1');
      localStorage.removeItem('_tt_test');
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── 讀取並過濾合法資料（內部工具）────────────────────────────
  // 壞資料（parse 失敗/非陣列/缺 zh 或 ja/catId 非法）→ 回合法子集或 []
  function _readAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (item) {
        return item &&
               typeof item.zh === 'string' && item.zh !== '' &&
               typeof item.ja === 'string' && item.ja !== '' &&
               _isValidCatId(item.catId);
      });
    } catch (e) {
      return [];
    }
  }

  // ── 寫入整個陣列（內部工具）──────────────────────────────────
  function _writeAll(arr) {
    // 可能 throw（無痕/配額）— 呼叫端包 try/catch
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  // ── getAll：回傳全部自訂句（新→舊，壞資料已過濾）────────────
  function getAll() {
    return _readAll();
  }

  // ── getByCat：回傳指定分類的自訂句（新→舊）──────────────────
  function getByCat(catId) {
    if (!_isValidCatId(catId)) return [];
    return _readAll().filter(function (item) {
      return item.catId === catId;
    });
  }

  // ── add：新增自訂句 ───────────────────────────────────────────
  // 回傳 {ok:true} | {ok:true, duplicate:true} | {ok:false}
  function add(opts) {
    if (!opts) return { ok: false };
    var zh  = typeof opts.zh  === 'string' ? opts.zh.trim() : '';
    var ja  = typeof opts.ja  === 'string' ? opts.ja        : '';
    var catId = opts.catId;

    if (!zh || !ja)          return { ok: false };
    if (!_isValidCatId(catId)) return { ok: false };

    try {
      var all = _readAll();

      // 去重：zh(trim)+ja 雙欄全等（跨分類亦重複，catId 不參與判準）
      for (var i = 0; i < all.length; i++) {
        if (all[i].zh.trim() === zh && all[i].ja === ja) {
          return { ok: true, duplicate: true };
        }
      }

      // 新增放最前（新→舊）
      var entry = {
        zh: zh, ja: ja, romaji: '', catId: catId, ts: Date.now(),
      };
      all.unshift(entry);
      _writeAll(all);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  // ── remove：刪除 zh+ja 全等的那一筆，回 boolean ─────────────
  function remove(zh, ja) {
    try {
      var zhTrim = typeof zh === 'string' ? zh.trim() : '';
      var all    = _readAll();
      var next   = all.filter(function (item) {
        return !(item.zh.trim() === zhTrim && item.ja === ja);
      });
      if (next.length === all.length) return false; // 沒有找到
      _writeAll(next);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── 掛到 App ──────────────────────────────────────────────────
  App.myPhrases = {
    isAvailable: isAvailable,
    getAll:      getAll,
    getByCat:    getByCat,
    add:         add,
    remove:      remove,
  };

}());
