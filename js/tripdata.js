/**
 * js/tripdata.js — 公開行程資料（公開層）
 *
 * ★ 隱私警告：本檔由 git 追蹤、會公開部署至 GitHub Pages。
 *    禁止寫入任何個資：護照號、保單號、訂位代號、旅客姓名、個人手機號碼。
 *    上述資料一律走本機匯入碼（localStorage tokyotrip.privateData），不進本檔。
 */

window.TRIP = {
  // ───── 航班 ─────
  // from/to 為物件 { airport, terminal, time }，frontend 依此渲染
  flights: [
    {
      label: "去程",
      airline: "樂桃航空 Peach",
      flightNo: "MM626",
      date: "2026/10/22（四）",
      from: { airport: "台北桃園", terminal: "T1", time: "10:50" },
      to:   { airport: "東京成田", terminal: "T1", time: "15:20" },
      note: "建議起飛前 2.5 小時（08:20 前）抵桃園 T1；A320、無餐點；託運 1 件 20kg（三邊和 ≤203cm）；個人物品＋手提合計 7kg（手提 50×40×25cm）",
    },
    {
      label: "回程",
      airline: "樂桃航空 Peach",
      flightNo: "MM623",
      date: "2026/10/25（日）",
      from: { airport: "東京成田", terminal: "T1", time: "16:40" },
      to:   { airport: "台北桃園", terminal: "T1", time: "20:00" },
      note: "建議起飛前 2.5 小時（14:10 前）抵成田 T1；A320、無餐點；行李額度同去程",
    },
  ],

  // ───── 飯店 ─────
  hotels: [
    {
      name: "Tabist上野39飯店（Tabist HOTEL UENO 39）",
      checkin: "2026/10/22 15:00",
      checkout: "2026/10/25 10:00",
      // address_ja：給計程車司機／店員看的日文地址（大字展示用）
      address_ja: "〒110-0005 東京都台東区上野6-8-11 Tabist HOTEL UENO 39",
      address_zh: "東京都台東區上野6-8-11",
      tel: "+81-3-5834-4820",
      note: "最近車站：東京 Metro 上野站 5b 出口步行 2 分、京成上野站 池の端口步行 3 分、JR 上野站 廣小路口步行 3 分",
    },
  ],

  // ───── 每日行程 ─────
  // items[].detail 允許 \n 換行，frontend 以 white-space:pre-wrap 或 <br> 渲染
  // isoDate 供「預設定位當日」邏輯使用（B8）
  itinerary: [
    {
      day: "Day 1",
      isoDate: "2026-10-22",
      theme: "抵達東京・入住上野",
      items: [
        {
          time: "06:10",
          title: "出發機場",
          detail: "公車→高鐵板橋站（15元）→高鐵板橋→桃園（125元）→機捷直達 A18→A12（35元），07:47 抵一航廈",
        },
        {
          time: "07:50",
          title: "樂桃 MM626 報到",
          detail: "08:30 出境，10:20 登機",
        },
        {
          time: "10:50",
          title: "MM626 起飛",
          detail: "台北桃園 T1 → 東京成田 T1，飛行約 3.5 小時",
        },
        {
          time: "15:20",
          title: "抵成田 T1",
          detail: "入境通關、領行李",
        },
        {
          time: "17:00",
          title: "成田 T1 → 上野住處入住",
          detail: "① 到第 1 航廈的京成「成田空港」駅\n② 車站窗口或售票機買 Skyliner：乘車券＋Skyliner 券（全車指定席），大人 1 人 ¥2,580（乘車券刷 IC 則 ¥2,567）；也可先在京成官網線上預訂\n③ 搭 Skyliner 到終點「京成上野」，約 44–45 分；平日例：15:59 發→16:43 抵、16:39 發→17:24 抵\n④ 京成上野走「池の端口」出站，步行約 3 分到飯店（台東区上野6-8-11）\n💰 便宜備案：京成本線 特急／快速特急（免特急券），刷 IC ¥1,052，約 1 小時 32–37 分，途中在京成成田或京成高砂轉車 1 次",
        },
      ],
    },
    {
      day: "Day 2",
      isoDate: "2026-10-23",
      theme: "明治神宮・東京車站・淺草寺・晴空塔",
      items: [
        { time: "05:30", title: "起床" },
        { time: "06:30", title: "抵原宿站，前往明治神宮" },
        { time: "09:00", title: "麥當勞早餐後前往東京地下街", detail: "🍔 麥當勞 原宿竹下通店（マクドナルド 原宿竹下通り店）\n📍 東京都渋谷区神宮前1-19-8 原宿ファミリービル\nJR 原宿站「竹下口」出站步行約 1 分\n⏰ 營業 07:00～22:00，早餐供應至 10:30（營業時間可能變動）" },
        { time: "中午", title: "於東京地下街用餐", detail: "🧸 扭蛋：ガシャポンバンダイオフィシャルショップ＠TOKYO STATION（扭蛋萬代官方店 東京車站一番街店）\n📍 東京都千代田区丸の内1-9-1 東京駅一番街 地下1階 東京キャラクターストリート内\n東京車站八重洲側「東京駅一番街」地下 1 樓（剪票口外）\n⏰ 營業 10:00～20:30（營業時間可能變動）" },
        { time: "14:30", title: "離開東京車站前往淺草寺", detail: "🧸 扭蛋：ガシャポンバンダイオフィシャルショップ 浅草花やしき店（扭蛋萬代官方店 淺草花屋敷店）\n📍 東京都台東区浅草2-28-1\n浅草花やしき 園外・免費入場區域（不用買樂園門票）\n⏰ 營業 10:00～18:00（營業時間可能變動）" },
        { time: "17:00", title: "離開淺草前往晴空塔", detail: "🧸 扭蛋：ガシャポンバンダイオフィシャルショップ 東京ソラマチ店（扭蛋萬代官方店 東京晴空街道店）\n📍 東京都墨田区押上1-1-2 東京ソラマチ4Fイーストヤード 10番地\n晴空塔底下的商場 4 樓東側\n⏰ 營業 10:00～21:00（營業時間可能變動）" },
        { time: "晚間", title: "於晴空塔用餐" },
        { time: "20:00", title: "回 Tabist HOTEL UENO 39" },
      ],
    },
    {
      day: "Day 3",
      isoDate: "2026-10-24",
      theme: "上野阿美橫・秋葉原・澀谷",
      items: [
        { time: "上午", title: "進上野、阿美橫" },
        { time: "中午", title: "於上野阿美橫用餐" },
        { time: "13:00", title: "前往秋葉原", detail: "🧸 扭蛋：ガシャポンバンダイオフィシャルショップ 秋葉原店（扭蛋萬代官方店 秋葉原店）\n📍 東京都千代田区外神田1-15-9 4F\n⏰ 營業 10:00～23:00（營業時間可能變動）" },
        { time: "16:00", title: "前往澀谷逛街" },
        { time: "19:00", title: "回 Tabist HOTEL UENO 39 整理行李" },
      ],
    },
    {
      day: "Day 4",
      isoDate: "2026-10-25",
      theme: "歸途",
      items: [
        {
          time: "早上",
          title: "退房・寄放行李",
          detail: "飯店退房時間 10:00",
        },
        {
          time: "約 12:00",
          title: "Skyliner → 成田 T1",
          detail: "① 從飯店步行約 3 分到京成上野駅「池の端口」\n② 車站窗口或售票機買 Skyliner：乘車券＋Skyliner 券（全車指定席），大人 1 人 ¥2,580（乘車券刷 IC 則 ¥2,567）\n③ 搭 Skyliner 到終點「成田空港」（第 1 航廈），約 43–44 分；週日例：12:00 發→12:44 抵、12:20 發→13:03 抵\n⏰ 最晚 13:05 離開住處（搭 13:20 京成上野發 Skyliner，14:03 抵 T1）",
        },
        {
          time: "14:10",
          title: "最晚抵成田 T1",
          detail: "起飛前 2.5 小時（訂單確認信建議）",
        },
        {
          time: "16:40",
          title: "MM623 起飛",
          detail: "東京成田 T1 → 台北桃園 T1",
        },
        {
          time: "20:00",
          title: "抵桃園 T1",
          detail: "入境提領約 40–50 分\n機捷 A12→A18（35元）→高鐵桃園→板橋（125元）→計程車到家",
        },
      ],
    },
  ],

  // ───── 重要資料（公開層：緊急電話與公開說明）─────
  // tel 欄位有值時，frontend 渲染為 tel: 連結（點擊直接撥號）
  // 護照號、保單號、緊急聯絡人手機 → 請由「重要資料→匯入」的本機層取得
  important: [
    { label: "日本報警",                             value: "110",              tel: "110"                },
    { label: "日本救護／火災",                       value: "119",              tel: "119"                },
    { label: "台北駐日經濟文化代表處",               value: "+81-3-3280-7811",  tel: "+81-3-3280-7811"    },
    { label: "台灣外交部旅外急難救助（免費）",       value: "0800-085-095",     tel: "0800-085-095"       },
    { label: "樂桃報到提醒",                         value: "建議起飛前 2.5 小時抵達機場（桃園、成田皆同）" },
    { label: "旅遊平安險（臺灣產物）",               value: "保單號、緊急電話請由「重要資料→匯入」的本機層取得" },
  ],
};

// ───── 折價券（Task4，18 張真實券資料）─────
// schema: id / store / category / discount / expiry / passport / notes / area / img
// expiry: ISO 日期字串；券面未標示 -> null
// area:   非東京可用時填地區警示；一般留空字串
window.COUPONS = [
  // ── 藥妝 ──────────────────────────────────────────────────────
  {
    id: "cosmos",
    store: "科摩思 COSMOS 藥妝",
    category: "藥妝",
    discount: "免稅＋5%/7%/9%（滿1萬/3萬/5萬不含稅，最大19%）",
    expiry: "2026-12-31",
    passport: true,
    notes: "一天限用一次；菸酒除外",
    area: "",
    img: "./img/coupons/cosmos.jpg",
  },
  {
    id: "tsuruha",
    store: "鶴羽藥妝 ツルハドラッグ",
    category: "藥妝",
    discount: "免稅10%＋3%/5%/7%（滿1萬/3萬/5萬含稅）",
    expiry: "2027-12-31",
    passport: true,
    notes: "結帳前出示；不可與其他優惠併用",
    area: "",
    img: "./img/coupons/tsuruha.jpg",
  },
  {
    id: "sundrug",
    store: "尚都樂客 Sundrug",
    category: "藥妝",
    discount: "免稅10%＋3%/5%/7%（滿1萬/3萬/5萬不含稅）",
    expiry: null,
    passport: true,
    notes: "券面未標效期；三段條碼依消費金額擇一掃",
    area: "",
    img: "./img/coupons/sundrug.jpg",
  },
  {
    id: "satudora",
    store: "札幌藥妝 サツドラ",
    category: "藥妝",
    discount: "免稅10%＋5%；滿38,888（不含稅）再＋7%",
    expiry: null,
    passport: true,
    notes: "券面未標效期；結帳前出示",
    area: "",
    img: "./img/coupons/satudora.jpg",
  },
  // ── 電器 ──────────────────────────────────────────────────────
  {
    id: "biccamera",
    store: "BicCamera / KOJIMA",
    category: "電器",
    discount: "免稅10%＋7%(家電相機手錶玩具)/5%(藥妝食品日用)/3%(清酒)",
    expiry: "2026-08-31",
    passport: true,
    notes: "結帳須掃券面①②兩段條碼；Apple・遊戲主機・Outlet・獺祭/八海山除外",
    area: "",
    img: "./img/coupons/biccamera.jpg",
  },
  {
    id: "laox",
    store: "LAOX",
    category: "電器",
    discount: "免稅10%＋8% OFF",
    expiry: "2026-10-31",
    passport: true,
    notes: "滿5,000日圓；限指定門市；遊戲/奢侈品牌/藥品/特價品除外",
    area: "",
    img: "./img/coupons/laox.jpg",
  },
  {
    id: "edion",
    store: "EDION 愛電王",
    category: "電器",
    discount: "免稅最大10%＋7%(家電手錶相機)/5%(食品藥妝)",
    expiry: "2026-12-31",
    passport: true,
    notes: "免稅門檻5,000日圓；Apple/Amazon/手機等除外",
    area: "",
    img: "./img/coupons/edion.jpg",
  },
  // ── 量販 ──────────────────────────────────────────────────────
  {
    id: "donki",
    store: "唐吉訶德 ドン・キホーテ",
    category: "量販",
    discount: "免稅最高10%＋5%(滿1萬不含稅)/7%(滿3萬不含稅)",
    expiry: null,
    passport: true,
    notes: "券面未標效期；結帳後出示無效，請結帳前出示",
    area: "",
    img: "./img/coupons/donki.jpg",
  },
  // ── 百貨 ──────────────────────────────────────────────────────
  {
    id: "keio",
    store: "京王百貨 新宿店",
    category: "百貨",
    discount: "95折（5% OFF）",
    expiry: "2027-03-31",
    passport: true,
    notes: "滿3,000日圓不含稅；優待番號76-76；特價品/食品/CHANEL/ROLEX等除外",
    area: "",
    img: "./img/coupons/keio.jpg",
  },
  {
    id: "seibu-sogo",
    store: "西武・SOGO 百貨",
    category: "百貨",
    discount: "95折＋免稅",
    expiry: "2026-12-31",
    passport: true,
    notes: "滿1,000日圓不含稅；指定店鋪（西武池袋/澀谷等）；精品品牌除外；免稅手續費1.55%",
    area: "",
    img: "./img/coupons/seibu-sogo.jpg",
  },
  {
    id: "odakyu",
    store: "小田急百貨 新宿",
    category: "百貨",
    discount: "6% OFF",
    expiry: "2028-03-31",
    passport: true,
    notes: "滿1,000日圓含稅；付款限現金/銀聯/支付寶/微信（一般信用卡不適用）；食品/餐廳除外",
    area: "",
    img: "./img/coupons/odakyu.jpg",
  },
  {
    id: "daimaru",
    store: "大丸松坂屋百貨",
    category: "百貨",
    discount: "退稅＋5% OFF＋贈美食券",
    expiry: "2026-08-31",
    passport: true,
    notes: "滿3,000日圓含稅；效期內可重複使用；食品/餐廳/咖啡廳除外",
    area: "",
    img: "./img/coupons/daimaru.jpg",
  },
  // ── 運動 ──────────────────────────────────────────────────────
  {
    id: "alpen",
    store: "Alpen / Sports DEPO / GOLF5",
    category: "運動",
    discount: "5% OFF＋免稅",
    expiry: "2026-12-31",
    passport: true,
    notes: "全店可用；免稅門檻5,500日圓含稅；代碼009Ta_FANTIME",
    area: "",
    img: "./img/coupons/alpen.jpg",
  },
  {
    id: "victoria",
    store: "Victoria / Victoria Golf / L-Breath",
    category: "運動",
    discount: "5% OFF＋免稅10%",
    expiry: "2026-12-31",
    passport: true,
    notes: "限東京、神奈川、埼玉、千葉店鋪",
    area: "",
    img: "./img/coupons/victoria.jpg",
  },
  // ── 免稅店 ────────────────────────────────────────────────────
  {
    id: "lotte-ginza",
    store: "樂天免稅店 銀座",
    category: "免稅店",
    discount: "免稅（消費稅+關稅+菸酒稅）＋滿1萬折¥1,000/滿2萬折¥2,000",
    expiry: "2027-01-31",
    passport: true,
    notes: "限銀座店；購買當天起60日內經羽田/成田出國；每次出國限用1次",
    area: "",
    img: "./img/coupons/lotte-ginza.jpg",
  },
  {
    id: "japandutyfree",
    store: "JAPAN DUTY FREE（成田機場）",
    category: "免稅店",
    discount: "5% OFF（菸酒同享，加熱菸除外）",
    expiry: "2027-03-31",
    passport: true,
    notes: "結帳出示；條碼 a2833030a",
    area: "",
    img: "./img/coupons/japandutyfree.jpg",
  },
];
