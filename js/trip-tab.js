/**
 * js/trip-tab.js — 行程分頁（trip tab）渲染與互動邏輯
 *
 * 依賴（載入順序，app.js 之後）：
 *   import-data.js → trip-tab.js
 *   App.registerTab / App.showBigText / App.privateData 須已定義
 *
 * DOM 建構策略（B6 冪等）：
 *   首次 onShow 時建立整個 #tab-trip 內部 DOM 並綁定事件。
 *   之後 onShow 不重建 DOM，保留使用者的展開狀態、子分頁選擇、輸入中的匯入碼。
 *   只有「匯入成功」或「清除成功」後才重繪本機資料段（_renderPrivateSection()）。
 *
 * R2 行程子區塊兩層視圖狀態機（Task10）：
 *   _itinView ∈ {'overview'} ∪ {0..N-1}，存 closure 記憶體，禁 localStorage。
 *   init 時今日 isoDate 對上行程某天 → 直接進該日單日層；否則總覽。
 *   舊 B8「今天不在範圍→展開 Day1」fallback 已廢止：範圍外一律落總覽。
 *   今天判斷只在 init 算一次，跨午夜不刷新（可接受的旅遊場景限制）。
 */
(function () {
  'use strict';

  var _initialized = false;
  var _privateSectionEl = null;   // 本機資料容器（僅重繪此段）
  var _lodgingContainerEl = null; // 民宿入住資訊容器（Task21，恆建立）

  // R2 行程視圖狀態機（Task10）
  var _itinView = 'overview'; // 'overview' | 數字 dayIdx
  var _itinData = null;       // window.TRIP.itinerary 快照（init 後固定）
  var _itinOverviewEl = null; // .trip-itin-overview 元素
  var _itinDayEl = null;      // .trip-itin-day 元素（進入時整段重繪）

  // ── 日期工具 ────────────────────────────────────────────────

  function getTodayIsoDate() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ── 剪貼簿複製（含 fallback）──────────────────────────────────

  function copyToClipboard(text, onSuccess, onFail) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess, onFail);
    } else {
      // fallback：選取 textarea
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
      if (ok) { onSuccess(); } else { onFail(); }
    }
  }

  // ── 暫時顯示訊息（按鈕旁提示）─────────────────────────────────

  function showTip(el, msg, durationMs) {
    var tip = document.createElement('span');
    tip.className = 'trip-tip';
    tip.textContent = msg;
    el.parentNode.insertBefore(tip, el.nextSibling);
    setTimeout(function () {
      if (tip.parentNode) tip.parentNode.removeChild(tip);
    }, durationMs || 1800);
  }

  // ── R2 捲動歸零 ──────────────────────────────────────────────
  // 捲動容器是 #tab-trip（position:fixed; overflow-y:auto）
  // 須用 tabEl.scrollTop = 0，window.scrollTo 無效（SA 補完 G2）

  function _scrollToTripTab() {
    var tabEl = document.getElementById('tab-trip');
    if (tabEl) tabEl.scrollTop = 0;
  }

  // ── R2 視圖切換（狀態機轉移）──────────────────────────────────

  function _switchView(newView) {
    _itinView = newView;
    if (newView === 'overview') {
      _showOverview();
    } else {
      _showDayView(newView, true);
    }
  }

  function _showOverview() {
    if (_itinOverviewEl) _itinOverviewEl.hidden = false;
    if (_itinDayEl) _itinDayEl.hidden = true;
    _scrollToTripTab();
  }

  function _showDayView(dayIdx, doScroll) {
    _renderDayContent(dayIdx);
    if (_itinOverviewEl) _itinOverviewEl.hidden = true;
    if (_itinDayEl) _itinDayEl.hidden = false;
    if (doScroll) _scrollToTripTab();
  }

  // ── R2 單日層內容渲染（進入/換天時整段重繪）──────────────────

  function _renderDayContent(dayIdx) {
    if (!_itinData || dayIdx < 0 || dayIdx >= _itinData.length) return;
    var dayObj = _itinData[dayIdx];
    var N = _itinData.length;

    _itinDayEl.innerHTML = '';

    // 頂部導覽列 .trip-day-nav
    var nav = document.createElement('div');
    nav.className = 'trip-day-nav';

    // 返回鈕「‹ 總覽」
    var backBtn = document.createElement('button');
    backBtn.className = 'trip-day-nav-back';
    backBtn.textContent = '‹ 總覽';
    backBtn.addEventListener('click', function () {
      _switchView('overview');
    });

    // 標題區：Day N・M/D（週）+ theme
    var titleDiv = document.createElement('div');
    titleDiv.className = 'trip-day-nav-title';

    var labelSpan = document.createElement('span');
    labelSpan.className = 'trip-day-nav-label';
    labelSpan.textContent = dayObj.day || '';

    var sepSpan = document.createElement('span');
    sepSpan.className = 'trip-day-nav-sep';
    sepSpan.textContent = '・';
    sepSpan.setAttribute('aria-hidden', 'true');

    var dateSpan = document.createElement('span');
    dateSpan.className = 'trip-day-nav-date';
    dateSpan.textContent = dayObj.isoDate ? isoToDisplay(dayObj.isoDate) : '';

    titleDiv.appendChild(labelSpan);
    titleDiv.appendChild(sepSpan);
    titleDiv.appendChild(dateSpan);

    if (dayObj.theme) {
      var themeDiv = document.createElement('div');
      themeDiv.className = 'trip-day-nav-theme';
      themeDiv.textContent = dayObj.theme;
      titleDiv.appendChild(themeDiv);
    }

    // 前一天／後一天切換鈕（disabled 不隱藏）
    var arrowsDiv = document.createElement('div');
    arrowsDiv.className = 'trip-day-nav-arrows';

    var prevBtn = document.createElement('button');
    prevBtn.className = 'trip-day-nav-prev';
    prevBtn.textContent = '‹ 前一天';
    prevBtn.disabled = (dayIdx === 0);
    prevBtn.addEventListener('click', function () {
      if (dayIdx > 0) _switchView(dayIdx - 1);
    });

    var nextBtn = document.createElement('button');
    nextBtn.className = 'trip-day-nav-next';
    nextBtn.textContent = '後一天 ›';
    nextBtn.disabled = (dayIdx === N - 1);
    nextBtn.addEventListener('click', function () {
      if (dayIdx < N - 1) _switchView(dayIdx + 1);
    });

    arrowsDiv.appendChild(prevBtn);
    arrowsDiv.appendChild(nextBtn);
    nav.appendChild(backBtn);
    nav.appendChild(titleDiv);
    nav.appendChild(arrowsDiv);
    _itinDayEl.appendChild(nav);

    // 時間軸內容 .trip-itin-day-content
    var content = document.createElement('div');
    content.className = 'trip-itin-day-content';

    var items = dayObj.items || [];
    if (items.length === 0) {
      var emptyP = document.createElement('p');
      emptyP.className = 'trip-itin-day-empty';
      emptyP.textContent = '本日無排定行程';
      content.appendChild(emptyP);
    } else {
      items.forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'trip-item';
        // 單日層為瀏覽模式（非互動），不加 role="button" / aria-expanded

        var timeEl = document.createElement('span');
        timeEl.className = 'trip-item-time';
        timeEl.textContent = item.time || '';
        row.appendChild(timeEl);

        var titleEl = document.createElement('span');
        titleEl.className = 'trip-item-title';
        titleEl.textContent = item.title || '';
        row.appendChild(titleEl);

        if (item.detail) {
          var detailEl = document.createElement('div');
          detailEl.className = 'trip-item-detail';
          // detail 直接完整顯示（不 hidden），\n → <br>
          detailEl.innerHTML = escHtml(item.detail).replace(/\n/g, '<br>');
          row.appendChild(detailEl);
        }

        content.appendChild(row);
      });
    }

    _itinDayEl.appendChild(content);
  }

  // ── 渲染：行程區塊（Task10 R2 重構為兩層視圖）──────────────────

  function buildItinerarySection(data) {
    var sec = document.createElement('div');
    sec.className = 'trip-section';
    sec.id = 'trip-sec-itinerary';

    if (!data || !data.itinerary || !data.itinerary.length) {
      sec.innerHTML = '<p class="trip-error">行程資料載入失敗</p>';
      return sec;
    }

    _itinData = data.itinerary;
    var todayIso = getTodayIsoDate();
    var todayIdx = -1;

    // 總覽層 .trip-itin-overview
    _itinOverviewEl = document.createElement('div');
    _itinOverviewEl.className = 'trip-itin-overview';

    _itinData.forEach(function (dayObj, idx) {
      // 找今天 index（缺 isoDate 的天不參與比對）
      if (dayObj.isoDate && dayObj.isoDate === todayIso) {
        todayIdx = idx;
      }

      // 精簡日卡：Day＋日期＋theme，不顯示 items
      var card = document.createElement('div');
      card.className = 'trip-ov-card';
      card.dataset.dayIdx = String(idx);

      var labelEl = document.createElement('div');
      labelEl.className = 'trip-ov-day-label';
      labelEl.textContent = dayObj.day || '';

      var dateEl = document.createElement('div');
      dateEl.className = 'trip-ov-day-date';
      dateEl.textContent = dayObj.isoDate ? isoToDisplay(dayObj.isoDate) : '';

      var themeEl = document.createElement('div');
      themeEl.className = 'trip-ov-day-theme';
      themeEl.textContent = dayObj.theme || '';

      card.appendChild(labelEl);
      card.appendChild(dateEl);
      card.appendChild(themeEl);

      // 今天 badge（判斷只在 init 算一次，跨午夜不刷新）
      if (dayObj.isoDate && dayObj.isoDate === todayIso) {
        var badge = document.createElement('span');
        badge.className = 'trip-ov-today-badge';
        badge.textContent = '今天';
        card.appendChild(badge);
      }

      // 整卡可點 → 進入單日層
      card.addEventListener('click', function () {
        _switchView(idx);
      });

      _itinOverviewEl.appendChild(card);
    });

    sec.appendChild(_itinOverviewEl);

    // 單日層（初始隱藏，進入時整段重繪）
    _itinDayEl = document.createElement('div');
    _itinDayEl.className = 'trip-itin-day';
    _itinDayEl.hidden = true;
    sec.appendChild(_itinDayEl);

    // 初始視圖：今天對上某天 → 直進單日層；範圍外/對不上 → 總覽
    // 廢止舊 B8「範圍外→展開 Day1」fallback
    if (todayIdx >= 0) {
      _itinView = todayIdx;
      _showDayView(todayIdx, false); // init 不捲動
    } else {
      _itinView = 'overview';
      // 總覽層已可見（hidden 預設 false）
    }

    return sec;
  }

  // ── 渲染：航班區塊 ──────────────────────────────────────────

  function buildFlightsSection(data) {
    var sec = document.createElement('div');
    sec.className = 'trip-section';
    sec.id = 'trip-sec-flights';
    sec.hidden = true;

    if (!data || !data.flights || !data.flights.length) {
      sec.innerHTML = '<p class="trip-error">航班資料載入失敗</p>';
      return sec;
    }

    data.flights.forEach(function (f) {
      var card = document.createElement('div');
      card.className = 'trip-flight-card';

      var fromStr = f.from
        ? escHtml(f.from.airport) + ' ' + escHtml(f.from.terminal) + '&nbsp;&nbsp;' + escHtml(f.from.time)
        : escHtml(String(f.from || ''));
      var toStr = f.to
        ? escHtml(f.to.airport) + ' ' + escHtml(f.to.terminal) + '&nbsp;&nbsp;' + escHtml(f.to.time)
        : escHtml(String(f.to || ''));

      card.innerHTML =
        '<div class="trip-flight-label">' + escHtml(f.label || '') + '</div>' +
        '<div class="trip-flight-info">' +
          '<span class="trip-flight-no">' + escHtml(f.airline || '') + '&nbsp;' + escHtml(f.flightNo || '') + '</span>' +
          '<span class="trip-flight-date">' + escHtml(f.date || '') + '</span>' +
        '</div>' +
        '<div class="trip-flight-route">' +
          '<div class="trip-flight-from">' +
            '<span class="trip-flight-arrow-label">出發</span>' +
            '<span class="trip-flight-endpoint">' + fromStr + '</span>' +
          '</div>' +
          '<div class="trip-flight-arrow">→</div>' +
          '<div class="trip-flight-to">' +
            '<span class="trip-flight-arrow-label">抵達</span>' +
            '<span class="trip-flight-endpoint">' + toStr + '</span>' +
          '</div>' +
        '</div>' +
        (f.note ? '<div class="trip-flight-note">' + escHtml(f.note) + '</div>' : '');

      sec.appendChild(card);
    });

    return sec;
  }

  // ── 渲染：飯店區塊 ──────────────────────────────────────────

  function buildHotelSection(data) {
    var sec = document.createElement('div');
    sec.className = 'trip-section';
    sec.id = 'trip-sec-hotel';
    sec.hidden = true;

    if (!data || !data.hotels || !data.hotels.length) {
      sec.innerHTML = '<p class="trip-error">飯店資料載入失敗</p>';
      // [Task21 §2.4] 容器必須在 innerHTML 賦值之後建立，且早退路徑也要建立。
      // 「公開資料掛了、私密入住資訊仍該看得到」——本機層與 TRIP 無依賴關係。
      _lodgingContainerEl = document.createElement('div');
      _lodgingContainerEl.className = 'trip-lodging';
      sec.appendChild(_lodgingContainerEl);
      return sec;
    }

    data.hotels.forEach(function (h) {
      var card = document.createElement('div');
      card.className = 'trip-hotel-card';

      // 名稱、入退房
      card.innerHTML =
        '<div class="trip-hotel-name">' + escHtml(h.name || '') + '</div>' +
        '<div class="trip-hotel-dates">' +
          '<span class="trip-hotel-checkin">入住 ' + escHtml(h.checkin || '') + '</span>' +
          '<span class="trip-hotel-sep"> → </span>' +
          '<span class="trip-hotel-checkout">退房 ' + escHtml(h.checkout || '') + '</span>' +
        '</div>';

      // 日文地址（bigtext 用）
      if (h.address_ja) {
        var addrJaDiv = document.createElement('div');
        addrJaDiv.className = 'trip-hotel-address-ja bigtext-addressline';
        addrJaDiv.textContent = h.address_ja;
        card.appendChild(addrJaDiv);
      }

      // 中文地址
      if (h.address_zh) {
        var addrZhDiv = document.createElement('div');
        addrZhDiv.className = 'trip-hotel-address-zh';
        addrZhDiv.textContent = h.address_zh;
        card.appendChild(addrZhDiv);
      }

      // 電話
      if (h.tel) {
        var telDiv = document.createElement('div');
        telDiv.className = 'trip-hotel-tel';
        var telLink = document.createElement('a');
        telLink.href = 'tel:' + h.tel;
        telLink.textContent = h.tel;
        telDiv.appendChild(telLink);
        card.appendChild(telDiv);
      }

      // 備注
      if (h.note) {
        var noteDiv = document.createElement('div');
        noteDiv.className = 'trip-hotel-note';
        noteDiv.textContent = h.note;
        card.appendChild(noteDiv);
      }

      // 操作按鈕列
      var btnRow = document.createElement('div');
      btnRow.className = 'trip-hotel-actions';

      // [複製地址]
      var copyBtn = document.createElement('button');
      copyBtn.className = 'trip-btn trip-btn-copy';
      copyBtn.textContent = '複製地址';
      copyBtn.addEventListener('click', function () {
        copyToClipboard(
          h.address_ja || h.address_zh || '',
          function () { showTip(copyBtn, '已複製！'); },
          function () { showTip(copyBtn, '請手動長按複製'); }
        );
      });
      btnRow.appendChild(copyBtn);

      // [開地圖]（外部 URL，Google Maps）
      if (h.address_ja || h.address_zh) {
        var mapBtn = document.createElement('a');
        mapBtn.className = 'trip-btn trip-btn-map';
        mapBtn.href = 'https://maps.google.com/?q=' + encodeURIComponent(h.address_ja || h.address_zh);
        mapBtn.target = '_blank';
        mapBtn.rel = 'noopener noreferrer';
        mapBtn.textContent = '開地圖（↗ 離開 APP）';
        btnRow.appendChild(mapBtn);
      }

      // [大字展示]（給司機看，ja-only 模式）
      if (h.address_ja) {
        var bigBtn = document.createElement('button');
        bigBtn.className = 'trip-btn trip-btn-bigtext';
        bigBtn.textContent = '大字給司機看';
        bigBtn.addEventListener('click', function () {
          App.showBigText({ ja: h.address_ja });
        });
        btnRow.appendChild(bigBtn);
      }

      card.appendChild(btnRow);
      sec.appendChild(card);
    });

    // [Task21 §2.4] 正常路徑——飯店卡全部 append 後再建容器（順序後於任何 .trip-hotel-card）
    _lodgingContainerEl = document.createElement('div');
    _lodgingContainerEl.className = 'trip-lodging';
    sec.appendChild(_lodgingContainerEl);

    return sec;
  }

  // ── 渲染：民宿入住資訊（Task21，冪等重繪）────────────────────

  function _renderLodgingBlock() {
    if (!_lodgingContainerEl) return;
    // §2.5 防禦：import-data.js 尚未載入時安全 no-op
    if (!App.privateData) return;

    _lodgingContainerEl.innerHTML = '';

    // ── B6 狀態一：localStorage 不可用 ──
    if (!App.privateData.isAvailable()) {
      var unavailP = document.createElement('p');
      unavailP.className = 'trip-lodging-empty';
      unavailP.textContent = '此環境無法讀取住宿資訊，請在加入主畫面後的 APP 內操作（Safari 分頁與 APP 的資料不互通）。';
      _lodgingContainerEl.appendChild(unavailP);
      return;
    }

    var pdata = App.privateData.get();
    // §A3 型別防禦：lodging 非物件（null / 字串 / 陣列）視同未提供
    var ld = (pdata && typeof pdata === 'object' && !Array.isArray(pdata)) ? pdata.lodging : undefined;
    var lodgingValid = ld && typeof ld === 'object' && !Array.isArray(ld);

    // ── B6 狀態二三：未匯入 or 已匯入但無 lodging ──
    if (!pdata || !lodgingValid) {
      var emptyP = document.createElement('p');
      emptyP.className = 'trip-lodging-empty';
      emptyP.textContent = '尚未匯入住宿資訊。請到「行程 → 重要資料」貼上匯入碼，門鎖密碼與 WiFi 會顯示在這裡。';
      _lodgingContainerEl.appendChild(emptyP);
      return;
    }

    var l = ld; // 已確認為物件

    // ── 標題 ──
    var titleEl = document.createElement('h3');
    titleEl.className = 'trip-lodging-title';
    titleEl.textContent = '民宿入住資訊';
    _lodgingContainerEl.appendChild(titleEl);

    // ── 工具：建立標籤-值列（含選填複製鈕）──
    // 複製鈕用 btn.parentNode（= row）觸發 showTip，parentNode 必存在。
    function makeRow(labelTxt, valueTxt, copyValue) {
      var row = document.createElement('div');
      row.className = 'trip-lodging-row';
      var lbl = document.createElement('span');
      lbl.className = 'trip-lodging-row-label';
      lbl.textContent = labelTxt;
      var val = document.createElement('span');
      val.className = 'trip-lodging-row-value';
      val.textContent = valueTxt;
      row.appendChild(lbl);
      row.appendChild(val);
      if (copyValue) {
        var btn = document.createElement('button');
        btn.className = 'trip-lodging-copy-btn';
        btn.textContent = '複製';
        (function (text, b) {
          b.addEventListener('click', function () {
            copyToClipboard(
              text,
              function () { showTip(b, '已複製！'); },
              function () { showTip(b, '請手動長按複製'); }
            );
          });
        })(copyValue, btn);
        row.appendChild(btn);
      }
      return row;
    }

    // ── 區段工具 ──
    function makeSection(titleTxt) {
      var sec = document.createElement('div');
      sec.className = 'trip-lodging-section';
      var h = document.createElement('h4');
      h.className = 'trip-lodging-section-title';
      h.textContent = titleTxt;
      sec.appendChild(h);
      return sec;
    }

    // §B3-1：名稱 + 房號
    if (l.name || l.room) {
      var nameRow = document.createElement('div');
      nameRow.className = 'trip-lodging-name-row';
      if (l.name) {
        var nameSpan = document.createElement('span');
        nameSpan.className = 'trip-lodging-name';
        nameSpan.textContent = l.name;
        nameRow.appendChild(nameSpan);
      }
      if (l.room) {
        var roomSpan = document.createElement('span');
        roomSpan.className = 'trip-lodging-room';
        roomSpan.textContent = '房號：' + l.room;
        nameRow.appendChild(roomSpan);
      }
      _lodgingContainerEl.appendChild(nameRow);
    }

    // §B3-2：入住／退房
    if (l.checkinTime || l.checkoutTime) {
      var datesDiv = document.createElement('div');
      datesDiv.className = 'trip-lodging-dates';
      var datesTxt;
      if (l.checkinTime && l.checkoutTime) {
        datesTxt = '入住 ' + l.checkinTime + ' → 退房 ' + l.checkoutTime;
      } else if (l.checkinTime) {
        datesTxt = '入住 ' + l.checkinTime;
      } else {
        datesTxt = '退房 ' + l.checkoutTime;
      }
      datesDiv.textContent = datesTxt;
      _lodgingContainerEl.appendChild(datesDiv);
    }

    // §B3-3：門鎖密碼
    if (l.entranceCode || l.roomCode) {
      var doorSec = makeSection('門鎖密碼');
      if (l.entranceCode) doorSec.appendChild(makeRow('一樓入口', l.entranceCode, l.entranceCode));
      if (l.roomCode)     doorSec.appendChild(makeRow('房間',     l.roomCode,     l.roomCode));
      _lodgingContainerEl.appendChild(doorSec);
    }

    // §B3-4：自助入住（CSS white-space:pre-wrap 處理 \n）
    if (l.selfCheckin) {
      var selfSec = makeSection('自助入住');
      var selfP = document.createElement('p');
      selfP.className = 'trip-lodging-selfcheckin';
      selfP.textContent = l.selfCheckin;
      selfSec.appendChild(selfP);
      _lodgingContainerEl.appendChild(selfSec);
    }

    // §B3-5：地址（§A4 去重規則）
    var showZh = false;
    if (l.addressZh) {
      var pubZh = '';
      try {
        if (window.TRIP && window.TRIP.hotels && window.TRIP.hotels.length) {
          pubZh = (window.TRIP.hotels[0].address_zh || '').trim();
        }
      } catch (e) { /* TRIP 缺載時不比對，直接渲染 */ }
      showZh = (pubZh === '') || (l.addressZh.trim() !== pubZh);
    }
    var showEn = !!l.addressEn;
    if (showZh || showEn) {
      var addrSec = makeSection('地址');
      if (showZh) addrSec.appendChild(makeRow('中文', l.addressZh, l.addressZh));
      if (showEn) addrSec.appendChild(makeRow('英文', l.addressEn, l.addressEn));
      _lodgingContainerEl.appendChild(addrSec);
    }

    // §B3-6：WiFi（任意組數）
    var wifiArr = Array.isArray(l.wifi) ? l.wifi : null;
    if (wifiArr && wifiArr.length > 0) {
      var wifiSec = makeSection('WiFi');
      wifiArr.forEach(function (w) {
        if (!w || typeof w !== 'object' || Array.isArray(w)) return;
        if (!w.floor && !w.ssid && !w.password) return;
        var entry = document.createElement('div');
        entry.className = 'trip-lodging-wifi-entry';
        if (w.floor) {
          var floorDiv = document.createElement('div');
          floorDiv.className = 'trip-lodging-wifi-floor';
          floorDiv.textContent = w.floor;
          entry.appendChild(floorDiv);
        }
        if (w.ssid)     entry.appendChild(makeRow('SSID', w.ssid,     w.ssid));
        if (w.password) entry.appendChild(makeRow('密碼', w.password, w.password));
        wifiSec.appendChild(entry);
      });
      // 若所有 wifi 項目都無效（只留了標題），則不渲染
      if (wifiSec.children.length > 1) {
        _lodgingContainerEl.appendChild(wifiSec);
      }
    }

    // §B3-7：住宿須知
    var notesArr = Array.isArray(l.notes) ? l.notes : null;
    if (notesArr && notesArr.length > 0) {
      var ul = document.createElement('ul');
      ul.className = 'trip-lodging-notes';
      notesArr.forEach(function (note) {
        if (typeof note !== 'string') return;
        var li = document.createElement('li');
        li.className = 'trip-lodging-note-item';
        li.textContent = note;
        ul.appendChild(li);
      });
      if (ul.children.length > 0) {
        var notesSec = makeSection('住宿須知');
        notesSec.appendChild(ul);
        _lodgingContainerEl.appendChild(notesSec);
      }
    }

    // §B3-8：房東聯絡電話
    var hostsArr = Array.isArray(l.hostContacts) ? l.hostContacts : null;
    if (hostsArr && hostsArr.length > 0) {
      var hostSec = makeSection('房東聯絡電話');
      var hostCount = 0;
      hostsArr.forEach(function (h) {
        if (!h || typeof h !== 'object' || Array.isArray(h)) return;
        if (!h.name && !h.tel) return;
        var hostRow = document.createElement('div');
        hostRow.className = 'trip-lodging-host-row';
        if (h.name) {
          var nameEl = document.createElement('span');
          nameEl.className = 'trip-lodging-host-name';
          nameEl.textContent = h.name;
          hostRow.appendChild(nameEl);
        }
        if (h.tel) {
          var telLink = document.createElement('a');
          telLink.href = 'tel:' + h.tel;
          telLink.className = 'trip-lodging-host-tel';
          telLink.textContent = h.tel;
          hostRow.appendChild(telLink);
        }
        hostSec.appendChild(hostRow);
        hostCount++;
      });
      if (hostCount > 0) {
        _lodgingContainerEl.appendChild(hostSec);
      }
    }
  }

  // ── 渲染：重要資料區塊（公開段）──────────────────────────────

  function buildImportantPublicList(data) {
    var wrap = document.createElement('div');
    wrap.className = 'trip-important-public';

    if (!data || !data.important || !data.important.length) {
      var err = document.createElement('p');
      err.className = 'trip-error';
      err.textContent = '緊急電話資料載入失敗';
      wrap.appendChild(err);
      return wrap;
    }

    var list = document.createElement('ul');
    list.className = 'trip-important-list';

    data.important.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'trip-important-item';

      var label = document.createElement('span');
      label.className = 'trip-important-label';
      label.textContent = item.label || '';
      li.appendChild(label);

      var valEl;
      if (item.tel) {
        valEl = document.createElement('a');
        valEl.href = 'tel:' + item.tel;
        valEl.className = 'trip-important-tel';
        valEl.textContent = item.value || item.tel;
      } else {
        valEl = document.createElement('span');
        valEl.className = 'trip-important-value';
        valEl.textContent = item.value || '';
      }
      li.appendChild(valEl);

      list.appendChild(li);
    });

    wrap.appendChild(list);
    return wrap;
  }

  // ── 渲染：本機資料段（可重繪，B6）──────────────────────────────

  function _renderPrivateSection() {
    if (!_privateSectionEl) return;

    // 清空重繪
    _privateSectionEl.innerHTML = '';

    var title = document.createElement('h3');
    title.className = 'trip-private-title';
    title.textContent = '本機私人資料';
    _privateSectionEl.appendChild(title);

    // 檢查 localStorage 是否可用
    if (!App.privateData.isAvailable()) {
      var unavail = document.createElement('p');
      unavail.className = 'trip-private-unavail';
      unavail.textContent = '此環境無法儲存資料，請在加入主畫面後的 APP 內操作（Safari 分頁與 APP 的 localStorage 不互通）。';
      _privateSectionEl.appendChild(unavail);
      return;
    }

    var data = App.privateData.get();

    if (!data) {
      // ── 空狀態 ──
      _renderPrivateEmpty(_privateSectionEl);
    } else {
      // ── 已匯入狀態 ──
      _renderPrivateFilled(_privateSectionEl, data);
    }
  }

  function _renderPrivateEmpty(container) {
    var info = document.createElement('p');
    info.className = 'trip-private-info';
    info.innerHTML =
      '尚未匯入個人資料。<br>' +
      '<strong>請在加入主畫面後的 APP 內操作</strong>（Safari 分頁與 APP 的資料不互通）。<br>' +
      '<small>匯入碼原文請自行留存（如 LINE 收藏），資料若消失可重新匯入。</small>';
    container.appendChild(info);

    var importBtn = document.createElement('button');
    importBtn.className = 'trip-btn trip-btn-import';
    importBtn.textContent = '匯入';
    container.appendChild(importBtn);

    var importArea = _buildImportArea(container, importBtn, true);
    container.appendChild(importArea);
  }

  function _renderPrivateFilled(container, data) {
    // 顯示各欄位
    var fieldsDiv = document.createElement('div');
    fieldsDiv.className = 'trip-private-fields';

    function addSection(title, items) {
      if (!items || !items.length) return;
      var sh = document.createElement('h4');
      sh.className = 'trip-private-section-title';
      sh.textContent = title;
      fieldsDiv.appendChild(sh);

      items.forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'trip-private-row';
        var lbl = document.createElement('span');
        lbl.className = 'trip-private-row-label';
        lbl.textContent = item.label || item.name || '';
        var val = document.createElement('span');
        val.className = 'trip-private-row-value';
        var valText = item.number || item.value || item.policy || item.company || item.tel || '';
        if (item.tel && (title === '緊急聯絡人' || title === '旅遊保險')) {
          var a = document.createElement('a');
          a.href = 'tel:' + item.tel;
          a.textContent = item.tel;
          val.appendChild(a);
          if (valText && valText !== item.tel) {
            val.insertBefore(document.createTextNode(valText + '  '), a);
          }
        } else {
          val.textContent = valText;
        }
        row.appendChild(lbl);
        row.appendChild(val);
        fieldsDiv.appendChild(row);
      });
    }

    // 護照
    if (data.passports && data.passports.length) {
      addSection('護照', data.passports.map(function (p) {
        return { label: p.name || '護照', value: p.number || '' };
      }));
    }
    // 保險
    if (data.insurance) {
      var ins = data.insurance;
      addSection('旅遊保險', [
        { label: '保險公司', value: ins.company || '' },
        { label: '保單號',   value: ins.policy  || '' },
        { label: '緊急電話', value: ins.tel      || '', tel: ins.tel || '' },
      ].filter(function (r) { return r.value; }));
    }
    // 訂位
    if (data.bookings && data.bookings.length) {
      addSection('訂位資料', data.bookings.map(function (b) {
        return { label: b.label || '訂位', value: b.value || '' };
      }));
    }
    // 緊急聯絡人
    if (data.contacts && data.contacts.length) {
      addSection('緊急聯絡人', data.contacts.map(function (c) {
        return { label: c.label || '聯絡人', value: c.tel || '', tel: c.tel || '' };
      }));
    }

    container.appendChild(fieldsDiv);

    // 操作按鈕
    var actDiv = document.createElement('div');
    actDiv.className = 'trip-private-actions';

    // [重新匯入]
    var reimportBtn = document.createElement('button');
    reimportBtn.className = 'trip-btn trip-btn-reimport';
    reimportBtn.textContent = '重新匯入';
    actDiv.appendChild(reimportBtn);

    // [匯出]
    var exportBtn = document.createElement('button');
    exportBtn.className = 'trip-btn trip-btn-export';
    exportBtn.textContent = '匯出';
    actDiv.appendChild(exportBtn);

    // [清除]
    var clearBtn = document.createElement('button');
    clearBtn.className = 'trip-btn trip-btn-clear';
    clearBtn.textContent = '清除';
    actDiv.appendChild(clearBtn);

    container.appendChild(actDiv);

    // 匯出區（預設隱藏）
    var exportArea = document.createElement('div');
    exportArea.className = 'trip-export-area';
    exportArea.hidden = true;

    var exportNote = document.createElement('p');
    exportNote.className = 'trip-export-note';
    exportNote.textContent = '複製以下匯入碼，貼到另一支手機的「匯入」即可轉移：';
    exportArea.appendChild(exportNote);

    var exportTa = document.createElement('textarea');
    exportTa.className = 'trip-export-textarea';
    exportTa.readOnly = true;
    exportTa.value = App.privateData.getRawCode() || '';
    exportArea.appendChild(exportTa);

    var exportCopyBtn = document.createElement('button');
    exportCopyBtn.className = 'trip-btn trip-btn-copy';
    exportCopyBtn.textContent = '複製匯入碼';
    exportArea.appendChild(exportCopyBtn);

    exportCopyBtn.addEventListener('click', function () {
      copyToClipboard(
        exportTa.value,
        function () { showTip(exportCopyBtn, '已複製！'); },
        function () {
          exportTa.select();
          showTip(exportCopyBtn, '請手動長按複製');
        }
      );
    });

    container.appendChild(exportArea);

    // 重新匯入區（預設隱藏）
    var reimportArea = _buildImportArea(container, reimportBtn, true);
    container.appendChild(reimportArea);

    // 按鈕事件
    exportBtn.addEventListener('click', function () {
      reimportArea.hidden = true;
      exportArea.hidden = !exportArea.hidden;
    });

    clearBtn.addEventListener('click', function () {
      if (!confirm('確定清除本機所有個人資料？（護照號、保單號等均會刪除，無法復原）')) return;
      App.privateData.clear();
      _renderPrivateSection();   // Task21 呼叫點 1（clearBtn）
      _renderLodgingBlock();
    });
  }

  // ── 匯入區 DOM（空狀態 / 重新匯入 共用）──────────────────────

  function _buildImportArea(parentContainer, triggerBtn, startHidden) {
    var area = document.createElement('div');
    area.className = 'trip-import-area';
    area.hidden = startHidden !== false; // 空狀態預設隱藏；有資料時預設隱藏

    var hint = document.createElement('p');
    hint.className = 'trip-import-hint';
    hint.textContent = '貼上匯入碼（格式：TT1.xxxx…）：';
    area.appendChild(hint);

    var ta = document.createElement('textarea');
    ta.className = 'trip-import-textarea';
    ta.placeholder = 'TT1.eyJwYXNzcG9ydH…';
    ta.rows = 4;
    area.appendChild(ta);

    var confirmBtn = document.createElement('button');
    confirmBtn.className = 'trip-btn trip-btn-confirm';
    confirmBtn.textContent = '確認匯入';
    area.appendChild(confirmBtn);

    var errMsg = document.createElement('p');
    errMsg.className = 'trip-import-error';
    errMsg.hidden = true;
    area.appendChild(errMsg);

    // 觸發按鈕：顯示／隱藏匯入區
    triggerBtn.addEventListener('click', function () {
      area.hidden = !area.hidden;
      if (!area.hidden) {
        ta.focus();
      }
    });

    // 確認匯入
    confirmBtn.addEventListener('click', function () {
      var raw = ta.value;
      if (!raw.trim()) {
        errMsg.textContent = '請先貼上匯入碼';
        errMsg.hidden = false;
        return;
      }
      var result = App.privateData.save(raw);
      if (!result.ok) {
        errMsg.textContent = result.error || '匯入碼格式不對，請確認是否完整貼上';
        errMsg.hidden = false;
      } else {
        errMsg.hidden = true;
        // 匯入成功：重繪本機資料段
        _renderPrivateSection();   // Task21 呼叫點 2（confirmBtn，覆蓋首次匯入＋重新匯入）
        _renderLodgingBlock();
      }
    });

    return area;
  }

  // ── 重要資料整體區塊 ────────────────────────────────────────

  function buildImportantSection(data) {
    var sec = document.createElement('div');
    sec.className = 'trip-section';
    sec.id = 'trip-sec-important';
    sec.hidden = true;

    // 公開段：緊急電話
    var pubTitle = document.createElement('h3');
    pubTitle.className = 'trip-section-title';
    pubTitle.textContent = '緊急電話';
    sec.appendChild(pubTitle);
    sec.appendChild(buildImportantPublicList(data));

    // 本機段：個人資料
    _privateSectionEl = document.createElement('div');
    _privateSectionEl.className = 'trip-private-section';
    sec.appendChild(_privateSectionEl);

    _renderPrivateSection();   // Task21 呼叫點 3（init 首繪）
    _renderLodgingBlock();

    return sec;
  }

  // ── Pill 導覽 ────────────────────────────────────────────────

  function buildPills(sections) {
    var pillBar = document.createElement('div');
    pillBar.className = 'trip-pills';
    pillBar.setAttribute('role', 'tablist');

    var pills = [
      { id: 'itinerary', label: '行程'    },
      { id: 'flights',   label: '航班'    },
      { id: 'hotel',     label: '飯店'    },
      { id: 'important', label: '重要資料' },
    ];

    pills.forEach(function (p, idx) {
      var btn = document.createElement('button');
      btn.className = 'trip-pill' + (idx === 0 ? ' active' : '');
      btn.dataset.sectionId = 'trip-sec-' + p.id;
      btn.textContent = p.label;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');

      btn.addEventListener('click', function () {
        // 切換 pill active
        pillBar.querySelectorAll('.trip-pill').forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        // 切換 section 顯示
        sections.forEach(function (s) {
          s.hidden = (s.id !== btn.dataset.sectionId);
        });
      });

      pillBar.appendChild(btn);
    });

    return pillBar;
  }

  // ── 初始化（首次 onShow 時執行）──────────────────────────────

  function init() {
    var tabEl = document.getElementById('tab-trip');
    if (!tabEl) return;

    // 清掉佔位卡
    tabEl.innerHTML = '';

    var container = document.createElement('div');
    container.className = 'trip-container';

    var tripData = window.TRIP || null;

    var secItinerary = buildItinerarySection(tripData);
    var secFlights   = buildFlightsSection(tripData);
    var secHotel     = buildHotelSection(tripData);
    var secImportant = buildImportantSection(tripData);

    var allSections = [secItinerary, secFlights, secHotel, secImportant];

    var pillBar = buildPills(allSections);
    container.appendChild(pillBar);

    allSections.forEach(function (s) { container.appendChild(s); });

    tabEl.appendChild(container);
    _initialized = true;
  }

  // ── onShow（每次切到 trip 分頁都觸發）──────────────────────

  function onShow() {
    if (!_initialized) {
      init();
    }
    // B6：之後不重建 DOM，保留使用者狀態（含 _itinView 跨分頁保留）
  }

  // ── 工具：HTML 跳脫 ─────────────────────────────────────────

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ISO 日期轉顯示字串（YYYY-MM-DD → M/D（週））
  function isoToDisplay(iso) {
    var parts = iso.split('-');
    if (parts.length < 3) return iso;
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    var date = new Date(parseInt(parts[0], 10), m - 1, d);
    return m + '/' + d + '（' + weekdays[date.getDay()] + '）';
  }

  // ── 掛載 ─────────────────────────────────────────────────────

  App.registerTab('trip', { onShow: onShow });

})();
