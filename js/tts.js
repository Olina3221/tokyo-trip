/**
 * tts.js — 語音共用模組（Task2 日文；Task12 擴充雙語；Task16 RC-H unlock）
 *
 * 公開 API（補掛在 App 物件）：
 *   App.speak(text, lang)        播放語音（lang 選填，預設 'ja-JP'）
 *   App.speak.isAvailable        Boolean = 'speechSynthesis' in window（不綁 voice 有無，B4）
 *   App.speak.cancel()           取消當前語音（供 overlay 關閉時呼叫，B6）
 *   App.speak.unlock()           Task16 RC-H：user gesture 內解鎖 iOS speechSynthesis（冪等）
 *
 * Task12 擴充（additive，不破壞既有契約）：
 *   App.speak(text, 'zh-TW')     播放中文語音
 *   App.speak(text, 'ja-JP')     播放日文語音（同原行為）
 *   既有呼叫 App.speak(jaText) 零 diff、行為完全不變（lang 預設 'ja-JP'）
 *
 * iOS 已知坑（B4）：
 *   - cancel 後立即 speak 偶發無聲 → 16ms 微延遲（附帶修：pending timer 保留 id，
 *     speak()/cancel() 開頭皆 clearTimeout，消除疊音縫——Task12 錄音前 cancel 場景升級此縫）
 *   - utterance GC 斷音 → _currentUtterance 保留參照至播畢
 *   - voiceschanged 不可靠 → 冪等 listener，不作播放前置條件
 *   - getVoices() 首次可能回空陣列 → 先同步取一次，voiceschanged 時再更新
 *   - 找不到精確 voice → 前綴退化 → null 讓系統自選（B4：找不到也要播，不放棄）
 *   - iOS zh-CN 可能搶 zh 前綴第一位 → 精確比對優先於前綴（Task12 §2.2）
 *
 * Task5（翻譯）直接重用本模組的所有行為與語意契約。
 *
 * Task16 追加（additive，既有四函式本體零 diff）：
 *   App.speak.unlock()           在 user gesture 脈絡內對 speechSynthesis 觸發空 utterance，
 *                                解除 iOS「首發聲需手勢」限制（RC-H）。
 *   - 冪等：旗標於 speak 呼叫成功發出當下即設，之後重複呼叫直接 return。
 *   - 不設 voice/lang：unlock 不依賴 _pickVoice/_voices（voices 首次可能空陣列）。
 *   - 獨立變數 _unlockUtterance：不得共用 _currentUtterance（防 onend 清 null 斷後續音）。
 *   - 無 speechSynthesis 時 no-op 不 throw。
 */

(function () {
  'use strict';

  var _voices           = [];
  var _currentUtterance = null;
  var _pendingTimer     = null;  // 16ms pending timer id，用於修疊音縫（§2.4）

  // Task16 RC-H：unlock 專用獨立變數（禁止共用 _currentUtterance，防其 onend 清 null 斷音）
  var _unlocked        = false;  // 冪等旗標：per page session 解鎖一次即永久
  var _unlockUtterance = null;   // 解鎖空 utterance 參照（防 iOS GC；僅供 unlock 使用）

  // 更新語音清單（首次同步取 + voiceschanged 時再取，冪等）
  function _updateVoices() {
    if (window.speechSynthesis) {
      _voices = window.speechSynthesis.getVoices() || [];
    }
  }

  if (window.speechSynthesis) {
    _updateVoices();
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', _updateVoices);
    } else if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = _updateVoices;
    }
  }

  /**
   * 挑選最合適的 voice（Task12 §2.2 精確優先 → 前綴 → null）
   *
   * 挑選順位：
   *   1. 完整 lang 精確比對（正規化底線 → 連字號、不分大小寫）
   *   2. 前綴比對（lang.split('-')[0]）
   *   3. null → utterance 只設 utt.lang 讓系統自選（B4 精神）
   *
   * iOS 陷阱：zh-CN / zh-HK / zh-TW 並存且順序不保證，
   *   前綴 'zh' 第一位常是 zh-CN → 精確必須優先（否則中文譯文用陸腔唸）。
   * 日文退化驗證：_pickVoice('ja-JP') 精確失敗時前綴 'ja' 命中 = 舊行為。
   *
   * @param {string} lang  BCP-47，例 'ja-JP' / 'zh-TW'
   * @returns {SpeechSynthesisVoice|null}
   */
  function _pickVoice(lang) {
    if (!lang || !_voices.length) return null;

    // 正規化：底線 → 連字號，小寫比對
    var normTarget = lang.replace('_', '-').toLowerCase();
    var prefix     = normTarget.split('-')[0];

    var prefixMatch = null;
    for (var i = 0; i < _voices.length; i++) {
      var vl = String(_voices[i].lang || '').replace('_', '-').toLowerCase();
      if (vl === normTarget) return _voices[i];  // 精確命中，立即回傳
      if (prefixMatch === null && vl.indexOf(prefix) === 0) {
        prefixMatch = _voices[i];                // 前綴：記第一個，繼續找精確
      }
    }
    return prefixMatch; // 無精確 → 前綴 or null
  }

  /**
   * 取消當前語音（公開，供 bigtext.js 關閉 overlay / translate-tab 錄音前呼叫，B6）
   * 同時清除 pending timer，避免 <16ms 疊音縫（§2.4）
   */
  function cancelSpeak() {
    clearTimeout(_pendingTimer);
    _pendingTimer = null;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    _currentUtterance = null;
  }

  /**
   * Task16 RC-H：在 user gesture 脈絡內解鎖 iOS speechSynthesis（additive，不破壞既有契約）
   *
   * iOS 限制：speechSynthesis 首次 speak() 必須源自 user gesture 同步呼叫鏈；
   * 自動播發生在 async fetch 回呼（STT+translate），iOS 判非手勢脈絡而靜音。
   * 在 mic 按鈕 click handler（_onMicClick idle 分支）內呼叫此函式，
   * 以空 utterance 解鎖後，後續 async 自動播才能正常發聲。
   *
   * 設計要點：
   *   1. 直接呼叫 speechSynthesis.speak()，不走 App.speak()（會被空字串守門擋且觸發 cancel-then-speak）
   *   2. 文字用 ' '（單一空白）——部分 WebKit 對 '' 完全不排程；空白字元無聲且瞬間結束
   *   3. 不設 voice/lang，避免依賴 _pickVoice/_voices（首次 getVoices 可能空陣列）
   *   4. 用獨立變數 _unlockUtterance 防 GC（不碰 _currentUtterance，防其 onend 斷後續音）
   *   5. 冪等旗標於 speak 呼叫發出當下即設（不等 onend，因空 utterance 可能被後續 cancel 清掉）
   *   6. 無 speechSynthesis 時 no-op 不 throw
   */
  function unlock() {
    if (!window.speechSynthesis) return;  // no-op（環境不支援）
    if (_unlocked) return;                // 冪等：已解鎖，直接 return

    var utt = new SpeechSynthesisUtterance(' ');  // 空白字元：無聲、瞬間結束
    // 不設 utt.voice / utt.lang：不依賴 _pickVoice 與 voices 載入時序
    _unlockUtterance = utt;  // 保留參照防 iOS GC（獨立變數，不碰 _currentUtterance）

    utt.onend = function () {
      if (_unlockUtterance === utt) _unlockUtterance = null;
    };
    utt.onerror = function (e) {
      // 解鎖失敗靜默（B4 精神）；旗標已設，冪等不受影響
      console.warn('[TTS] unlock utterance error:', e.error);
      if (_unlockUtterance === utt) _unlockUtterance = null;
    };

    _unlocked = true;  // 發出當下即設（不等 onend），防後續 cancel 清掉 utterance 後永遠等不到
    window.speechSynthesis.speak(utt);
  }

  /**
   * 播放語音。
   * cancel-then-speak 是契約（B4）：每次呼叫前先 cancel，防連點疊音。
   *
   * @param {string} text  語音文字；空字串或 falsy → no-op
   * @param {string} [lang='ja-JP']  BCP-47 語言碼（選填，預設 'ja-JP'）
   *   既有呼叫 App.speak(jaText) 完全不變，行為與原本逐位元相同。
   */
  function speak(text, lang) {
    if (!window.speechSynthesis) return;
    if (!text) return;

    // lang 預設 'ja-JP'（既有行為不變）
    var targetLang = lang || 'ja-JP';

    // cancel 前音（防疊音，B4）+ 清 pending timer（§2.4 疊音縫修復）
    clearTimeout(_pendingTimer);
    _pendingTimer = null;
    window.speechSynthesis.cancel();
    _currentUtterance = null;

    // iOS：cancel 後立即 speak 偶發無聲 → 16ms 微延遲（B4）
    _pendingTimer = setTimeout(function () {
      _pendingTimer = null;

      var utt      = new SpeechSynthesisUtterance(text);
      utt.lang     = targetLang;

      // 嘗試指定精確 voice；找不到讓系統自選（B4：找不到也要播，不放棄）
      var voice = _pickVoice(targetLang);
      if (voice) utt.voice = voice;

      // 保留參照防 GC 中途斷音（B4）
      _currentUtterance = utt;

      utt.onend = function () {
        if (_currentUtterance === utt) _currentUtterance = null;
      };

      // 失敗靜默（B4：只記 console，不彈窗，UI 保持可再點）
      utt.onerror = function (e) {
        console.warn('[TTS] speak error:', e.error, text);
        if (_currentUtterance === utt) _currentUtterance = null;
      };

      window.speechSynthesis.speak(utt);
    }, 16);
  }

  // 可用性：只檢查 API 是否存在，不綁「有無 voice」（B4）
  speak.isAvailable = 'speechSynthesis' in window;

  // 公開取消方法（B6）
  speak.cancel = cancelSpeak;

  // Task16 RC-H：公開解鎖方法（additive，與 cancel/isAvailable 同掛法）
  speak.unlock = unlock;

  // 補掛 App（app.js 在本檔之前載入，App 物件已存在）
  window.App = window.App || {};
  App.speak = speak;

})();
