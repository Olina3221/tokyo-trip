/**
 * js/import-data.js — 本機層資料管理（匯入碼解析 / localStorage 存取）
 *
 * 對外介面：App.privateData（掛在全域 window.App）
 * 匯入碼格式：TT1.<base64(UTF-8 JSON)>
 *   - 標準 base64（+ / =）為權威格式；解析端容忍 URL-safe 變體（- _）
 *   - 儲存 key：tokyotrip.privateData（只刪此 key，禁用 localStorage.clear()）
 *
 * 依賴：app.js 須在本檔之前載入（App 物件已存在）
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'tokyotrip.privateData';

  // ── 解析匯入碼 ──────────────────────────────────────────────
  // 傳入原始字串（含換行／空白），回傳 { ok, data } 或 { ok:false, error }
  function parseImportCode(raw) {
    // 去除所有 whitespace（LINE 訊息軟體常夾換行、前後空白）
    var code = (raw || '').replace(/\s+/g, '');

    // 驗證前綴
    if (code.slice(0, 4) !== 'TT1.') {
      return { ok: false, error: '匯入碼格式不對，請確認是否完整貼上（應以 TT1. 開頭）' };
    }

    var b64 = code.slice(4);

    // 容忍 URL-safe 變體（- → +，_ → /），並補足 padding
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }

    try {
      // atob 還原 bytes（僅 latin-1 範圍）→ Uint8Array → TextDecoder(UTF-8) 處理中文
      var binaryStr = atob(b64);
      var bytes = new Uint8Array(binaryStr.length);
      for (var i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      var jsonStr = new TextDecoder('utf-8').decode(bytes);
      var data = JSON.parse(jsonStr);
      return { ok: true, data: data };
    } catch (e) {
      return { ok: false, error: '匯入碼格式不對，請確認是否完整貼上' };
    }
  }

  // ── localStorage 可用性測試 ─────────────────────────────────
  function isLocalStorageAvailable() {
    try {
      localStorage.setItem('_tt_test', '1');
      localStorage.removeItem('_tt_test');
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── App.privateData 介面 ────────────────────────────────────
  var privateData = {

    /**
     * 解析並回傳已儲存資料的 JSON 物件；無資料或解析失敗回傳 null。
     * 渲染時即時解碼（不在儲存時快取解析結果）。
     */
    get: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        var result = parseImportCode(raw);
        return result.ok ? result.data : null;
      } catch (e) {
        return null;
      }
    },

    /**
     * 取得已儲存的匯入碼原字串（用於匯出顯示）。
     * 未儲存時回傳 null。
     */
    getRawCode: function () {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch (e) {
        return null;
      }
    },

    /**
     * 驗證並儲存匯入碼。
     * @param {string} importCode 使用者貼入的原始字串
     * @returns {{ ok: boolean, data?: object, error?: string }}
     *   成功：{ ok: true, data: parsedObject }
     *   失敗：{ ok: false, error: '錯誤訊息' }（不動既有 localStorage 資料）
     */
    save: function (importCode) {
      var result = parseImportCode(importCode);
      if (!result.ok) return result;

      // 儲存去 whitespace 後的乾淨碼（單一真實來源）
      var cleanCode = (importCode || '').replace(/\s+/g, '');
      try {
        localStorage.setItem(STORAGE_KEY, cleanCode);
        return { ok: true, data: result.data };
      } catch (e) {
        return { ok: false, error: '儲存失敗，請確認裝置儲存空間是否足夠' };
      }
    },

    /**
     * 清除本機資料。
     * 只刪 tokyotrip.privateData 單一 key，禁用 localStorage.clear()。
     * @returns {boolean} 成功 true；失敗 false
     */
    clear: function () {
      try {
        localStorage.removeItem(STORAGE_KEY);
        return true;
      } catch (e) {
        return false;
      }
    },

    /**
     * 測試 localStorage 是否可用（Safari 無痕等場景回傳 false）。
     * @returns {boolean}
     */
    isAvailable: isLocalStorageAvailable,
  };

  // 掛到全域 App 物件
  App.privateData = privateData;

})();
