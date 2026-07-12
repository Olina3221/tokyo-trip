/**
 * js/map-tab.js — 地圖分頁（map tab）邏輯層
 *
 * 依賴（載入順序，app.js 之後）：
 *   mapdata.js（window.MAPDATA）→ map-tab.js
 *   window.TRIP.itinerary（tripdata.js）唯讀 lookup，tripdata.js 零 diff
 *
 * 設計原則：
 *   - App.registerTab('map', { onShow }) ── onShow 冪等（_initialized 慣例）
 *   - init 建骨架一次；onShow 後續只刷新清單，不重置 A/B closure 狀態（G6）
 *   - getTodayIsoDate 自寫不 import（trip-tab.js closure 內部不可及）（G7）
 *   - 今天判斷 init 算一次，跨午夜不刷新（已知可接受的旅遊場景限制）
 *   - 全部 deep-link 帶 hl=zh-TW；開啟在同步手勢棧內 window.open（G3/iOS攔彈窗）
 *   - A/B 狀態全存 closure 記憶體（零新持久化 key）
 *   - 不 wrap App.showTab（無錄音/TTS/overlay 需離開清理）
 *
 * DOM 結構（由本模組動態建構）：
 *   #tab-map（flex-direction:column，交付 frontend 定高度+overflow）
 *     .map-chips-bar（flex-shrink:0）
 *     .map-ab-row（flex-shrink:0）
 *     .map-lang-hint（flex-shrink:0）
 *     .map-places-list（flex:1，唯一捲動區）
 *
 * deep-link 三形態（hl=zh-TW 全帶）：
 *   1. 單點查看：https://www.google.com/maps/search/?api=1&query={lat},{lon}&hl=zh-TW
 *   2. 路線 A=目前位置：https://www.google.com/maps/dir/?api=1&destination={lat},{lon}&travelmode=transit&hl=zh-TW
 *   3. 路線 A=地點：同上加 &origin={lat},{lon}
 *   B=自訂文字時 destination=encodeURIComponent(text)
 */
(function () {
  'use strict';

  // ── closure 狀態 ────────────────────────────────────────────
  var _initialized = false;
  var _todayIso = null;       // init 算一次，跨午夜不刷新
  var _selectedDay = null;    // 目前選中的 isoDate

  // A/B 狀態（closure 記憶體；切換日期後保留，零持久化）
  // _aMode: 'current' | 'place'
  // _bMode: 'place' | 'custom'
  var _aMode = 'current';
  var _aPlace = null;   // { name, lat, lon }
  var _bMode = 'place';
  var _bPlace = null;   // { name, lat, lon }
  var _bCustomText = '';

  // DOM 節點引用
  var _chipsBarEl = null;
  var _aDisplayEl = null;
  var _bDisplayEl = null;
  var _swapBtn = null;
  var _routeBtn = null;
  var _bInputEl = null;
  var _listEl = null;

  // ── 日期工具（自寫，不 import trip-tab）──────────────────────

  function getTodayIsoDate() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ── 行程唯讀 lookup ──────────────────────────────────────────

  function findItinDay(isoDate) {
    // 唯讀查 window.TRIP.itinerary，查不到回 null（不壞頁）
    if (!window.TRIP || !Array.isArray(window.TRIP.itinerary)) return null;
    for (var i = 0; i < window.TRIP.itinerary.length; i++) {
      if (window.TRIP.itinerary[i].isoDate === isoDate) {
        return window.TRIP.itinerary[i];
      }
    }
    return null;
  }

  // ── deep-link 工具 ───────────────────────────────────────────

  /**
   * 單點查看 URL。
   * https://www.google.com/maps/search/?api=1&query={lat},{lon}&hl=zh-TW
   */
  function buildSearchUrl(place) {
    return 'https://www.google.com/maps/search/?api=1'
      + '&query=' + encodeURIComponent(place.lat + ',' + place.lon)
      + '&hl=zh-TW';
  }

  /**
   * A→B 路線 URL（大眾運輸）。
   * origin: { lat, lon } | null（null = 目前位置，省略 origin 參數）
   * destination: { lat, lon } | string（字串 = 自訂文字）
   */
  function buildDirectionsUrl(destination, origin) {
    var url = 'https://www.google.com/maps/dir/?api=1';
    if (origin) {
      url += '&origin=' + encodeURIComponent(origin.lat + ',' + origin.lon);
    }
    if (typeof destination === 'string') {
      url += '&destination=' + encodeURIComponent(destination);
    } else {
      url += '&destination=' + encodeURIComponent(destination.lat + ',' + destination.lon);
    }
    url += '&travelmode=transit&hl=zh-TW';
    return url;
  }

  /**
   * 在同步手勢棧內開啟 URL（iOS standalone PWA 攔彈窗需同步）。
   */
  function openUrl(url) {
    window.open(url, '_blank', 'noopener');
  }

  // ── UI 更新 ──────────────────────────────────────────────────

  function updateADisplay() {
    if (!_aDisplayEl) return;
    if (_aMode === 'current') {
      _aDisplayEl.textContent = '目前位置';
      _aDisplayEl.className = 'map-ab-val map-ab-current';
    } else {
      _aDisplayEl.textContent = _aPlace ? _aPlace.name : '（未選）';
      _aDisplayEl.className = 'map-ab-val';
    }
    _updateSwapBtn();
    _updateRouteBtn();
  }

  function updateBDisplay() {
    if (!_bDisplayEl) return;
    if (_bMode === 'custom' && _bCustomText) {
      _bDisplayEl.textContent = '自訂：' + _bCustomText;
      _bDisplayEl.className = 'map-ab-val map-ab-custom';
    } else if (_bMode === 'place' && _bPlace) {
      _bDisplayEl.textContent = _bPlace.name;
      _bDisplayEl.className = 'map-ab-val';
    } else {
      _bDisplayEl.textContent = '（未選）';
      _bDisplayEl.className = 'map-ab-val map-ab-empty';
    }
    _updateRouteBtn();
  }

  function _updateSwapBtn() {
    if (!_swapBtn) return;
    // swap 僅在 A=place 且 B=place（兩端皆有 lat/lon）時啟用
    var canSwap = (_aMode === 'place' && _aPlace !== null)
               && (_bMode === 'place' && _bPlace !== null);
    _swapBtn.disabled = !canSwap;
  }

  function _updateRouteBtn() {
    if (!_routeBtn) return;
    var bReady = (_bMode === 'place' && _bPlace !== null)
              || (_bMode === 'custom' && _bCustomText.trim() !== '');
    _routeBtn.disabled = !bReady;
  }

  function _updateChips() {
    if (!_chipsBarEl) return;
    var chips = _chipsBarEl.querySelectorAll('.map-chip');
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      var isActive = chip.dataset.iso === _selectedDay;
      if (isActive) {
        chip.classList.add('map-chip-active');
      } else {
        chip.classList.remove('map-chip-active');
      }
    }
  }

  // ── 清單渲染 ─────────────────────────────────────────────────

  function renderPlacesList() {
    if (!_listEl) return;
    _listEl.innerHTML = '';

    if (!window.MAPDATA || window.MAPDATA.length === 0) {
      var errEl = document.createElement('p');
      errEl.className = 'map-error';
      errEl.textContent = '地圖資料載入失敗，請重新整理頁面。';
      _listEl.appendChild(errEl);
      return;
    }

    // 找當天資料
    var dayData = null;
    for (var i = 0; i < window.MAPDATA.length; i++) {
      if (window.MAPDATA[i].isoDate === _selectedDay) {
        dayData = window.MAPDATA[i];
        break;
      }
    }

    // 日期頭（含 TRIP 唯讀 lookup）
    var itinDay = findItinDay(_selectedDay);
    var headerEl = document.createElement('div');
    headerEl.className = 'map-day-header';

    var headerMain = document.createElement('span');
    headerMain.className = 'map-day-header-main';
    if (itinDay) {
      // "Day 1 · 2026-07-21"
      headerMain.textContent = itinDay.day + ' · ' + _selectedDay;
    } else {
      headerMain.textContent = _selectedDay;
    }
    headerEl.appendChild(headerMain);

    if (itinDay && itinDay.theme) {
      var themeEl = document.createElement('span');
      themeEl.className = 'map-day-theme';
      themeEl.textContent = itinDay.theme;
      headerEl.appendChild(themeEl);
    }

    if (_selectedDay === _todayIso) {
      var todayBadge = document.createElement('span');
      todayBadge.className = 'map-today-badge';
      todayBadge.textContent = '今天';
      headerEl.appendChild(todayBadge);
    }

    _listEl.appendChild(headerEl);

    // 本日無地點
    if (!dayData || !dayData.places || dayData.places.length === 0) {
      var emptyEl = document.createElement('p');
      emptyEl.className = 'map-empty';
      emptyEl.textContent = '本日無地點';
      _listEl.appendChild(emptyEl);
      return;
    }

    // 地點列表
    dayData.places.forEach(function (place) {
      var rowEl = document.createElement('div');
      rowEl.className = 'map-place-row';

      // 地點名：點擊開單點地圖
      var nameBtn = document.createElement('button');
      nameBtn.className = 'map-place-name';
      nameBtn.type = 'button';
      nameBtn.textContent = place.name;  // textContent 安全，無 XSS
      nameBtn.addEventListener('click', (function (p) {
        return function () {
          openUrl(buildSearchUrl(p));
        };
      }(place)));

      // 操作按鈕組
      var actionsEl = document.createElement('div');
      actionsEl.className = 'map-place-actions';

      var setABtn = document.createElement('button');
      setABtn.className = 'map-place-btn';
      setABtn.type = 'button';
      setABtn.textContent = '設起點';
      setABtn.addEventListener('click', (function (p) {
        return function () {
          _aMode = 'place';
          _aPlace = p;
          updateADisplay();
        };
      }(place)));

      var setBBtn = document.createElement('button');
      setBBtn.className = 'map-place-btn';
      setBBtn.type = 'button';
      setBBtn.textContent = '設終點';
      setBBtn.addEventListener('click', (function (p) {
        return function () {
          _bMode = 'place';
          _bPlace = p;
          if (_bInputEl) _bInputEl.value = '';
          _bCustomText = '';
          updateBDisplay();
        };
      }(place)));

      actionsEl.appendChild(setABtn);
      actionsEl.appendChild(setBBtn);
      rowEl.appendChild(nameBtn);
      rowEl.appendChild(actionsEl);
      _listEl.appendChild(rowEl);
    });
  }

  // ── DOM 建構 ─────────────────────────────────────────────────

  function _buildChipsBar(section) {
    var bar = document.createElement('div');
    bar.className = 'map-chips-bar';
    _chipsBarEl = bar;

    if (!window.MAPDATA || window.MAPDATA.length === 0) {
      section.appendChild(bar);
      return;
    }

    window.MAPDATA.forEach(function (day) {
      var chip = document.createElement('button');
      chip.className = 'map-chip';
      chip.type = 'button';
      chip.dataset.iso = day.isoDate;

      // 格式：Day1 07/21（或 07/21 if no TRIP lookup）
      var dateShort = day.isoDate.substring(5).replace('-', '/');
      var itinDay = findItinDay(day.isoDate);
      var dayNum = itinDay ? itinDay.day.replace('Day ', 'Day') : '';
      chip.textContent = dayNum ? dayNum + ' ' + dateShort : dateShort;

      if (day.isoDate === _todayIso) {
        var badge = document.createElement('span');
        badge.className = 'map-chip-today';
        badge.textContent = '今';
        chip.appendChild(badge);
      }

      chip.addEventListener('click', (function (iso) {
        return function () {
          _selectedDay = iso;
          _updateChips();
          renderPlacesList();
        };
      }(day.isoDate)));

      bar.appendChild(chip);
    });

    section.appendChild(bar);
  }

  function _buildABRow(section) {
    var abRow = document.createElement('div');
    abRow.className = 'map-ab-row';

    // ─ A 起點 ─
    var aLine = document.createElement('div');
    aLine.className = 'map-ab-line';

    var aLabel = document.createElement('span');
    aLabel.className = 'map-ab-label';
    aLabel.textContent = 'A 起點';

    var aVal = document.createElement('span');
    aVal.className = 'map-ab-val map-ab-current';
    aVal.textContent = '目前位置';
    _aDisplayEl = aVal;

    var aResetBtn = document.createElement('button');
    aResetBtn.className = 'map-ab-reset-btn';
    aResetBtn.type = 'button';
    aResetBtn.textContent = '還原位置';
    aResetBtn.title = '還原為「目前位置」（路線起點使用 GPS）';
    aResetBtn.addEventListener('click', function () {
      _aMode = 'current';
      _aPlace = null;
      updateADisplay();
    });

    aLine.appendChild(aLabel);
    aLine.appendChild(aVal);
    aLine.appendChild(aResetBtn);

    // ─ B 終點 ─
    var bLine = document.createElement('div');
    bLine.className = 'map-ab-line';

    var bLabel = document.createElement('span');
    bLabel.className = 'map-ab-label';
    bLabel.textContent = 'B 終點';

    var bVal = document.createElement('span');
    bVal.className = 'map-ab-val map-ab-empty';
    bVal.textContent = '（未選）';
    _bDisplayEl = bVal;

    bLine.appendChild(bLabel);
    bLine.appendChild(bVal);

    // ─ B 自訂輸入 ─
    var bCustomRow = document.createElement('div');
    bCustomRow.className = 'map-ab-custom-row';

    var bInput = document.createElement('input');
    bInput.type = 'text';
    bInput.className = 'map-custom-input';
    bInput.placeholder = '或輸入自訂終點（地名/地址）';
    // iOS 聚焦縮放紅線：font-size >= 16px
    bInput.style.fontSize = '16px';
    _bInputEl = bInput;

    var bUseBtn = document.createElement('button');
    bUseBtn.className = 'map-custom-use-btn';
    bUseBtn.type = 'button';
    bUseBtn.textContent = '使用';
    bUseBtn.addEventListener('click', function () {
      var text = bInput.value.trim();
      if (!text) return;
      _bMode = 'custom';
      _bCustomText = text;
      _bPlace = null;
      updateBDisplay();
    });

    bCustomRow.appendChild(bInput);
    bCustomRow.appendChild(bUseBtn);

    // ─ Swap + Route ─
    var actionsRow = document.createElement('div');
    actionsRow.className = 'map-ab-actions-row';

    var swapBtn = document.createElement('button');
    swapBtn.className = 'map-swap-btn';
    swapBtn.type = 'button';
    swapBtn.textContent = 'A⇄B';
    swapBtn.title = '互換起點與終點（兩端皆為地點時可用）';
    swapBtn.disabled = true;
    _swapBtn = swapBtn;
    swapBtn.addEventListener('click', function () {
      // 只在兩端皆為 place 時才執行
      if (_aMode !== 'place' || !_aPlace || _bMode !== 'place' || !_bPlace) return;
      var tmp = _aPlace;
      _aPlace = _bPlace;
      _bPlace = tmp;
      // modes 維持 'place'，bCustomText 清空
      _bCustomText = '';
      if (_bInputEl) _bInputEl.value = '';
      updateADisplay();
      updateBDisplay();
    });

    var routeBtn = document.createElement('button');
    routeBtn.className = 'map-route-btn';
    routeBtn.type = 'button';
    routeBtn.textContent = '查大眾運輸路線';
    routeBtn.disabled = true;
    _routeBtn = routeBtn;
    routeBtn.addEventListener('click', function () {
      var destination;
      if (_bMode === 'custom') {
        var text = _bCustomText.trim();
        if (!text) return;
        destination = text;  // string → encodeURIComponent in buildDirectionsUrl
      } else {
        if (!_bPlace) return;
        destination = _bPlace;  // { lat, lon }
      }
      var origin = (_aMode === 'place' && _aPlace) ? _aPlace : null;
      openUrl(buildDirectionsUrl(destination, origin));
    });

    actionsRow.appendChild(swapBtn);
    actionsRow.appendChild(routeBtn);

    var leaveNote = document.createElement('p');
    leaveNote.className = 'map-leave-note';
    leaveNote.textContent = '會離開 APP 開啟 Google 地圖';

    abRow.appendChild(aLine);
    abRow.appendChild(bLine);
    abRow.appendChild(bCustomRow);
    abRow.appendChild(actionsRow);
    abRow.appendChild(leaveNote);

    section.appendChild(abRow);
  }

  function _buildLangHint(section) {
    // B3-1：語言提示（固定，flex-shrink:0，不佔清單捲動區）
    var hint = document.createElement('p');
    hint.className = 'map-lang-hint';
    hint.textContent = '請把 Google 地圖 App 的語言設為繁體中文，主要車站站名才會顯示中文。'
      + '小站或公車站若 Google 沒有中文資料，仍會顯示日文。';
    section.appendChild(hint);
  }

  function _buildPlacesList(section) {
    var list = document.createElement('div');
    list.className = 'map-places-list';
    _listEl = list;
    section.appendChild(list);
  }

  // ── init（首次 onShow 時執行一次）────────────────────────────

  function _init() {
    var section = document.getElementById('tab-map');
    if (!section) return;

    // 計算今天（G7：init 算一次，跨午夜不刷新）
    _todayIso = getTodayIsoDate();

    // 處理 MAPDATA 缺載
    if (!window.MAPDATA || window.MAPDATA.length === 0) {
      section.innerHTML = '';
      var errEl = document.createElement('p');
      errEl.className = 'map-error';
      errEl.textContent = '地圖資料載入失敗，請重新整理頁面。';
      section.appendChild(errEl);
      _initialized = true;
      return;
    }

    // 預設選中今天，今天不在範圍則第一天（G7）
    _selectedDay = window.MAPDATA[0].isoDate;  // fallback = first day
    for (var i = 0; i < window.MAPDATA.length; i++) {
      if (window.MAPDATA[i].isoDate === _todayIso) {
        _selectedDay = _todayIso;
        break;
      }
    }

    // 清空（移除 placeholder-card 若有殘留）並建骨架
    section.innerHTML = '';
    _buildChipsBar(section);
    _buildABRow(section);
    _buildLangHint(section);
    _buildPlacesList(section);

    // 首次渲染
    _updateChips();
    renderPlacesList();
    updateADisplay();
    updateBDisplay();

    _initialized = true;
  }

  // ── 分頁註冊 ─────────────────────────────────────────────────

  App.registerTab('map', {
    onShow: function () {
      if (!_initialized) {
        _init();
        return;
      }
      // 後續 onShow：刷新 chip 高亮與清單，不重置 A/B closure 狀態（G6）
      _updateChips();
      renderPlacesList();
    }
  });

})();
