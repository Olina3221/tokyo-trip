/**
 * js/api.js — Google API 呼叫層（Task5 翻譯；Task6 OCR 重用同一檔；Task12 Speech）
 *
 * 三層設計：
 *   金鑰層：window.APP_CONFIG?.GOOGLE_API_KEY 可選鏈（A4 契約延續）
 *   傳輸層：POST 封裝 + 錯誤碼枚舉 NO_KEY/OFFLINE/HTTP_403/HTTP_429/HTTP_OTHER
 *            + 共用 Google 錯誤分類器（Translation / Vision / Speech 錯誤體格式相同）
 *   端點層：App.api.translate(text, source, target)
 *            App.api.speechToText(base64Audio, languageCode)（Task12 追加）
 *            App.api.ocr(imageBase64)（Task6 追加）
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

  /**
   * App.api.speechToText(base64Audio, languageCode)
   *
   * @param {string} base64Audio  LINEAR16@16kHz 的 base64（App.recorder.stop() 產物）
   * @param {string} languageCode 'cmn-Hant-TW'（中文）| 'ja-JP'（日文）
   *                              ⚠️  語言碼兩套不可混用：STT 用 cmn-Hant-TW/ja-JP，
   *                                  翻譯用 zh-TW/ja。見 Task12.api.md §語言碼對照。
   * @returns {Promise<string>}   辨識文字；回應正常但無 results 時 resolve ''（空字串，
   *                              沒聽清楚不是錯誤）
   *          或 reject({ code: ErrorCode.*, message })
   *
   * 注意：空結果語意與 translate 相反——translate 空結果 reject HTTP_OTHER；
   *       speechToText 2xx 但無 results 則 resolve ''，由呼叫端決定顯示文案。
   */
  function speechToText(base64Audio, languageCode) {
    var key = _getKey();
    if (!key) {
      return Promise.reject({ code: ErrorCode.NO_KEY, message: '' });
    }
    var url = 'https://speech.googleapis.com/v1/speech:recognize?key='
              + encodeURIComponent(key);
    return _postJson(url, {
      config: {
        encoding:        'LINEAR16',
        sampleRateHertz: 16000,
        languageCode:    languageCode,
      },
      audio: { content: base64Audio },
    }).then(function (data) {
      // 2xx 有 results → 取第一段第一候選的 transcript
      if (
        data &&
        data.results &&
        data.results[0] &&
        data.results[0].alternatives &&
        data.results[0].alternatives[0]
      ) {
        return data.results[0].alternatives[0].transcript || '';
      }
      // 2xx 但無 results（沒聽清楚）→ resolve ''，不 reject
      return '';
    });
  }

  /**
   * App.api.ocr(imageBase64)
   *
   * @param {string} imageBase64  JPEG raw base64（不含 data:image/jpeg;base64, 前綴）
   * @returns {Promise<string>}   辨識出的全文；2xx 但無文字時 resolve ''（非錯誤）
   *          或 reject({ code: ErrorCode.*, message: string })
   *
   * Vision 特有：2xx 但 responses[0].error 存在 → reject HTTP_OTHER（逐圖內嵌錯誤）
   * 取值優先序：responses[0].fullTextAnnotation.text
   *             → responses[0].textAnnotations[0].description
   *             → resolve ''（含 responses 缺失/空陣列）
   */
  function ocr(imageBase64) {
    var key = _getKey();
    if (!key) {
      return Promise.reject({ code: ErrorCode.NO_KEY, message: '' });
    }
    var url = 'https://vision.googleapis.com/v1/images:annotate?key='
              + encodeURIComponent(key);
    return _postJson(url, {
      requests: [{
        image: { content: imageBase64 },
        features: [{ type: 'TEXT_DETECTION' }],
        imageContext: { languageHints: ['ja'] },
      }],
    }).then(function (data) {
      var resp = data && data.responses && data.responses[0];
      // 1. 2xx 但 responses[0].error 存在（逐圖內嵌錯誤）→ reject HTTP_OTHER
      if (resp && resp.error) {
        return Promise.reject({
          code: ErrorCode.HTTP_OTHER,
          message: resp.error.message || '',
        });
      }
      // 2. fullTextAnnotation.text
      if (resp && resp.fullTextAnnotation && resp.fullTextAnnotation.text) {
        return resp.fullTextAnnotation.text;
      }
      // 3. fallback textAnnotations[0].description
      if (
        resp &&
        resp.textAnnotations &&
        resp.textAnnotations[0] &&
        resp.textAnnotations[0].description
      ) {
        return resp.textAnnotations[0].description;
      }
      // 4. 皆無（含 responses 缺失/空陣列）→ resolve ''（沒辨識到文字，非錯誤）
      return '';
    });
  }

  // ── 掛載 ────────────────────────────────────────────────────────────────
  window.App = window.App || {};
  window.App.api = {
    ErrorCode:    ErrorCode,
    translate:    translate,
    speechToText: speechToText,
    ocr:          ocr,
  };

}());
