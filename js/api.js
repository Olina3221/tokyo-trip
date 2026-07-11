/**
 * js/api.js — Google API 呼叫層（Task5 翻譯；Task6 OCR 重用同一檔）
 *
 * 三層設計：
 *   金鑰層：window.APP_CONFIG?.GOOGLE_API_KEY 可選鏈（A4 契約延續）
 *   傳輸層：POST 封裝 + 錯誤碼枚舉 NO_KEY/OFFLINE/HTTP_403/HTTP_429/HTTP_OTHER
 *            + 共用 Google 錯誤分類器（Translation / Vision 錯誤體格式相同）
 *   端點層：App.api.translate(text, source, target)
 *            Task6 在此追加 App.api.ocr(...)，不動上兩層
 *
 * 掛 window.App.api；不含 TTS、不碰 DOM/localStorage。
 *
 * POST-only 硬約束：GET 呼叫會被 sw.js cache-first 動態回填，
 *   金鑰（在 URL query）進 cache 索引、翻譯結果被固化。
 *   Task6 Vision 同此約束，不需 sw.js 排除特例。
 */
(function () {
  'use strict';

  // ── 金鑰層 ─────────────────────────────────────────────────────────────
  function _getKey() {
    /* global APP_CONFIG */
    return (window.APP_CONFIG && window.APP_CONFIG.GOOGLE_API_KEY) || '';
  }

  // ── 傳輸層 ─────────────────────────────────────────────────────────────

  /**
   * 對外可讀的錯誤碼枚舉（Task6 繼承，不得更名）
   * translate-tab.js / ocr-tab.js 據此對映友善訊息。
   */
  var ErrorCode = {
    NO_KEY:     'NO_KEY',
    OFFLINE:    'OFFLINE',
    HTTP_403:   'HTTP_403',
    HTTP_429:   'HTTP_429',
    HTTP_OTHER: 'HTTP_OTHER',
  };

  /**
   * 共用 Google 錯誤分類器
   * @param {Error|null}  fetchErr       fetch() 本身拋的 Error（網路失敗），否則 null
   * @param {number|null} status         HTTP 狀態碼（HTTP 錯誤時），否則 null
   * @param {string}      googleMessage  Google 回應體 error.message（選填）
   * @returns {{ code: string, message: string }}
   */
  function _classifyError(fetchErr, status, googleMessage) {
    if (fetchErr)      return { code: ErrorCode.OFFLINE,    message: String(fetchErr) };
    if (status === 403) return { code: ErrorCode.HTTP_403,   message: googleMessage || '' };
    if (status === 429) return { code: ErrorCode.HTTP_429,   message: googleMessage || '' };
    return               { code: ErrorCode.HTTP_OTHER, message: googleMessage || ('HTTP ' + status) };
  }

  /**
   * POST JSON → Promise<responseBody>
   * 成功（2xx）→ resolve 解析後的 JSON object
   * HTTP 失敗或 fetch 失敗 → reject({ code, message })
   *
   * 絕對不得改成 GET：見檔頭 POST-only 硬約束。
   */
  function _postJson(url, body) {
    return fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            var msg = (data && data.error && data.error.message) || '';
            return Promise.reject(_classifyError(null, res.status, msg));
          }
          return data;
        });
      })
      .catch(function (e) {
        // 若已是 { code, message } 分類物件直接傳遞；否則為網路層 Error
        if (e && e.code) return Promise.reject(e);
        return Promise.reject(_classifyError(e, null, ''));
      });
  }

  // ── 端點層 ─────────────────────────────────────────────────────────────

  /**
   * App.api.translate(text, source, target)
   *
   * @param {string} text   原文字串（非空）
   * @param {string} source BCP-47 語言碼，例 'zh-TW'
   * @param {string} target BCP-47 語言碼，例 'ja'
   * @returns {Promise<string>} 翻譯結果字串
   *          或 reject({ code: ErrorCode.*, message: string })
   */
  function translate(text, source, target) {
    var key = _getKey();
    if (!key) {
      return Promise.reject({ code: ErrorCode.NO_KEY, message: '' });
    }
    var url = 'https://translation.googleapis.com/language/translate/v2?key='
              + encodeURIComponent(key);
    return _postJson(url, {
      q:      text,
      source: source,
      target: target,
      format: 'text',
    }).then(function (data) {
      var result = data &&
                   data.data &&
                   data.data.translations &&
                   data.data.translations[0] &&
                   data.data.translations[0].translatedText;
      if (!result) {
        return Promise.reject({ code: ErrorCode.HTTP_OTHER, message: '空翻譯結果' });
      }
      return result;
    });
  }

  // ── 掛載 ────────────────────────────────────────────────────────────────
  window.App = window.App || {};
  window.App.api = {
    ErrorCode: ErrorCode,
    translate:  translate,
    // Task6 在此追加：ocr: function(imageBase64, mimeType) { ... }
  };

}());
