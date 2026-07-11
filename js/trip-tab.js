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
 */
(function () {
  'use strict';

  var _initialized = false;
  var _privateSectionEl = null; // 本機資料容器（僅重繪此段）

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

  // ── 渲染：行程區塊 ──────────────────────────────────────────

  function buildItinerarySection(data) {
    var sec = document.createElement('div');
    sec.className = 'trip-section';
    sec.id = 'trip-sec-itinerary';

    if (!data || !data.itinerary || !data.itinerary.length) {
      sec.innerHTML = '<p class="trip-error">行程資料載入失敗</p>';
      return sec;
    }

    var todayIso = getTodayIsoDate();

    data.itinerary.forEach(function (dayObj, dayIdx) {
      var card = document.createElement('div');
      card.className = 'trip-day-card';
      card.dataset.isoDate = dayObj.isoDate || '';

      // 日卡標題（點擊展開／收合整天）
      var hdr = document.createElement('div');
      hdr.className = 'trip-day-header';
      hdr.setAttribute('role', 'button');
      hdr.setAttribute('aria-expanded', 'false');
      hdr.innerHTML =
        '<span class="trip-day-label">' + escHtml(dayObj.day || '') + '</span>' +
        '<span class="trip-day-date">' + escHtml(dayObj.isoDate ? isoToDisplay(dayObj.isoDate) : '') + '</span>' +
        '<span class="trip-day-theme">' + escHtml(dayObj.theme || '') + '</span>' +
        '<span class="trip-day-chevron" aria-hidden="true">▶</span>';

      var body = document.createElement('div');
      body.className = 'trip-day-body';
      body.hidden = true;

      // 行程項目
      (dayObj.items || []).forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'trip-item';

        var itemHdr = document.createElement('div');
        itemHdr.className = 'trip-item-header';
        itemHdr.setAttribute('role', 'button');
        itemHdr.setAttribute('aria-expanded', 'false');
        itemHdr.innerHTML =
          '<span class="trip-item-time">' + escHtml(item.time || '') + '</span>' +
          '<span class="trip-item-title">' + escHtml(item.title || '') + '</span>';
        if (item.detail) {
          itemHdr.innerHTML += '<span class="trip-item-chevron" aria-hidden="true">›</span>';
        }

        row.appendChild(itemHdr);

        if (item.detail) {
          var detail = document.createElement('div');
          detail.className = 'trip-item-detail';
          detail.hidden = true;
          // \n → <br>
          detail.innerHTML = escHtml(item.detail).replace(/\n/g, '<br>');
          row.appendChild(detail);

          itemHdr.addEventListener('click', function () {
            var open = !detail.hidden;
            detail.hidden = open;
            itemHdr.setAttribute('aria-expanded', String(!open));
            var ch = itemHdr.querySelector('.trip-item-chevron');
            if (ch) ch.textContent = open ? '›' : '‹';
          });
        }

        body.appendChild(row);
      });

      // 日卡展開／收合
      hdr.addEventListener('click', function () {
        var open = !body.hidden;
        body.hidden = open;
        hdr.setAttribute('aria-expanded', String(!open));
        var ch = hdr.querySelector('.trip-day-chevron');
        if (ch) ch.textContent = open ? '▼' : '▶';
      });

      card.appendChild(hdr);
      card.appendChild(body);
      sec.appendChild(card);

      // 預設展開今日日卡（B8）
      if (dayObj.isoDate === todayIso) {
        body.hidden = false;
        hdr.setAttribute('aria-expanded', 'true');
        var ch = hdr.querySelector('.trip-day-chevron');
        if (ch) ch.textContent = '▼';
      }
    });

    // 若今天不在行程範圍，預設展開 Day1
    var anyOpen = sec.querySelector('.trip-day-body:not([hidden])');
    if (!anyOpen) {
      var firstBody = sec.querySelector('.trip-day-body');
      var firstHdr = sec.querySelector('.trip-day-header');
      if (firstBody && firstHdr) {
        firstBody.hidden = false;
        firstHdr.setAttribute('aria-expanded', 'true');
        var ch2 = firstHdr.querySelector('.trip-day-chevron');
        if (ch2) ch2.textContent = '▼';
      }
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

    return sec;
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
      _renderPrivateSection();
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
        _renderPrivateSection();
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

    _renderPrivateSection();

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
    // B6：之後不重建 DOM，保留使用者狀態
  }

  // ── 工具：HTML 跳脫 ─────────────────────────────────────────

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ISO 日期轉顯示字串（YYYY-MM-DD → M/D）
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
