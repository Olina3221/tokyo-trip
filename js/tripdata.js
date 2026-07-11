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
      date: "2026/07/21（二）",
      from: { airport: "台北桃園", terminal: "T1", time: "10:50" },
      to:   { airport: "東京成田", terminal: "T1", time: "15:20" },
      note: "國際線起飛前 120–50 分完成手續；建議 07:50 抵一航廈辦託運；含 20kg 託運額度",
    },
    {
      label: "回程",
      airline: "樂桃航空 Peach",
      flightNo: "MM625",
      date: "2026/07/25（六）",
      from: { airport: "東京成田", terminal: "T1", time: "16:55" },
      to:   { airport: "台北桃園", terminal: "T1", time: "19:40" },
      note: "建議 13:50 抵成田；14:50 開櫃（北翼 4 樓自助機台）；Check-in 截止起飛前 60 分",
    },
  ],

  // ───── 飯店 ─────
  hotels: [
    {
      name: "MAPLEHOUSE 浅草",
      checkin: "2026/07/21",
      checkout: "2026/07/25 08:30",
      // address_ja：給計程車司機／店員看的日文地址（大字展示用）
      address_ja: "〒111-0043 東京都台東区駒形1-2-10 MAPLEHOUSE 浅草",
      address_zh: "東京都台東區駒形1-2-10",
      tel: "+81-90-8343-3688",
      note: "近雷門，淺草站步行約 5–10 分鐘",
    },
  ],

  // ───── 每日行程 ─────
  // items[].detail 允許 \n 換行，frontend 以 white-space:pre-wrap 或 <br> 渲染
  // isoDate 供「預設定位當日」邏輯使用（B8）
  itinerary: [
    {
      day: "Day 1",
      isoDate: "2026-07-21",
      theme: "淺草基地與河岸夜色",
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
          detail: "入境通關後前往飯店",
        },
        {
          time: "17:00",
          title: "抵 MAPLEHOUSE 淺草",
          detail: "辦理入住手續",
        },
        {
          time: "18:00",
          title: "晚餐（二選一）",
          detail: "• 駒形どぜう 本店（江戶泥鰍鍋，台東区駒形1-7-12，約¥2,000–5,000）\n• 淺草 尾張屋 本店（天婦羅蕎麥麵，台東区浅草1-7-1，約¥800–2,500）",
        },
        {
          time: "19:30",
          title: "淺草夜間散步",
          detail: "雷門→仲見世通→隅田川→晴空塔夜景",
        },
      ],
    },
    {
      day: "Day 2",
      isoDate: "2026-07-22",
      theme: "下町風情與動漫巡禮",
      items: [
        {
          time: "08:30",
          title: "淺草寺清晨散策",
          detail: "雷門與仲見世通清晨散步",
        },
        {
          time: "09:15",
          title: "分頭行動",
          detail: "家人→晴空塔（東武晴空塔線 1 站）\n我→合羽橋道具街（飯田屋、田中熱器具工業所，買烘焙模具）\n11:10 Solamachi 會合",
        },
        {
          time: "09:30",
          title: "晴空塔＋Solamachi",
          detail: "寶可夢中心 4F、卡比 4F、Jump Shop 3F、吉卜力 2F\n甜點：Qu'il fait bon 2F、祇園辻利 6F\n展望台：大人¥2,100 / 國中生¥1,200",
        },
        {
          time: "13:00",
          title: "東武巴士→上野",
          detail: "Skytree Shuttle 2 號站牌",
        },
        {
          time: "13:30",
          title: "午餐（二選一）",
          detail: "• 三浦三崎港 上野店（迴轉壽司，上野4-10-17）\n• 名代 宇奈とと 上野店（鰻魚飯¥550起，上野6-7-12）",
        },
        {
          time: "14:30",
          title: "阿美橫丁散策",
          detail: "二木的菓子等",
        },
        {
          time: "16:00",
          title: "JR 山手線→秋葉原",
          detail: "上野→秋葉原（2 站）",
        },
        {
          time: "16:15",
          title: "秋葉原",
          detail: "Yodobashi Akiba、Radio Kaikan（至 19:30）",
        },
        {
          time: "19:30",
          title: "晚餐",
          detail: "麵屋武藏 武仁（千代田区神田佐久間町2-18-5，武仁肉拉麵，全豬無牛）",
        },
        {
          time: "20:40",
          title: "計程車回飯店",
          detail: "約¥1,200–1,400 ／ 8–10 分",
        },
      ],
    },
    {
      day: "Day 3",
      isoDate: "2026-07-23",
      theme: "潮流與動漫天堂",
      items: [
        {
          time: "08:15",
          title: "前往原宿",
          detail: "銀座線淺草→表參道（14 站）轉千代田線→明治神宮前（2 號出口）",
        },
        {
          time: "09:00",
          title: "明治神宮森林散策",
          detail: "",
        },
        {
          time: "10:15",
          title: "原宿竹下通",
          detail: "下坡順向流",
        },
        {
          time: "11:30",
          title: "前往池袋",
          detail: "副都心線→池袋（3 站，地下連通不出地面）",
        },
        {
          time: "11:50",
          title: "午餐（二選一，皆無牛）",
          detail: "• 和幸豬排\n• 邁泉豬排 Maisen（池袋百貨／Sunshine City）",
        },
        {
          time: "13:30",
          title: "池袋 Sunshine City",
          detail: "寶可夢中心、Jump Shop、動漫雜貨（至 18:30）",
        },
        {
          time: "18:30",
          title: "晚餐",
          detail: "根室花丸 或 活美登利壽司（池袋百貨美食區）",
        },
        {
          time: "20:00",
          title: "返回淺草",
          detail: "JR 山手線池袋→上野（8 站）轉銀座線→淺草（3 站）",
        },
      ],
    },
    {
      day: "Day 4",
      isoDate: "2026-07-24",
      theme: "海鮮饗宴與橫濱海港動線",
      items: [
        {
          time: "08:30",
          title: "前往築地",
          detail: "都營淺草線 淺草→東銀座（4 站，6 號出口，步行 5–8 分到築地）",
        },
        {
          time: "09:00",
          title: "築地場外市場",
          detail: "まぐろや黒銀（生魚片，中央区築地4-10-12）、築地どんぶり市場（鮪魚臉頰肉丼）、丸豊（飯糰）、鳥藤分店（雞肉串）、築地コロッケ（可樂餅）、さのきや（鮪魚燒）",
        },
        {
          time: "12:30",
          title: "前往橫濱",
          detail: "東銀座（淺草線直通京急）→橫濱→JR 根岸線 1 站→桜木町",
        },
        {
          time: "13:00",
          title: "YOKOHAMA AIR CABIN 空中纜車",
          detail: "桜木町【南改札東口】出發\n單程¥1,000 / 來回¥2,000\n步行 2 分到杯麵博物館",
        },
        {
          time: "13:40",
          title: "杯麵博物館",
          detail: "大人¥500 / 高中以下¥400\n14:30 預約 DIY 杯麵（My CUPNOODLES Factory，¥500/個，約 45 分）",
        },
        {
          time: "15:15",
          title: "Queen's Square／World Porters",
          detail: "商場購物（至 17:15）",
        },
        {
          time: "17:15",
          title: "前往中華街",
          detail: "JR 根岸線 桜木町→石川町（2 站，中華街口北口）",
        },
        {
          time: "17:30",
          title: "橫濱中華街",
          detail: "江戶清 本店（肉包，山下町192）、王府井 本店（生煎包，山下町191-24）",
        },
        {
          time: "18:45",
          title: "返回淺草",
          detail: "JR 石川町→新橋（約 45 分，逆向有位）轉都營淺草線→淺草（6 站）",
        },
      ],
    },
    {
      day: "Day 5",
      isoDate: "2026-07-25",
      theme: "歸途與最後採購（三方案自選）",
      items: [
        {
          time: "08:30",
          title: "MAPLEHOUSE 淺草退房",
          detail: "",
        },
        {
          time: "08:50",
          title: "前往成田機場",
          detail: "都營淺草線 Access特急 淺草→成田機場 T1（直達）",
        },
        {
          time: "09:50",
          title: "行李寄存",
          detail: "機場 B1（大型約¥700–800/件/天）",
        },
        {
          time: "10:00",
          title: "自選方案",
          detail: "【方案A】京成本線回頭 1 站→成田山表參道老街（川豊本店／駿河屋鰻魚飯、近江屋、なごみの米屋、林田のせんべい）；14:21 前搭車回機場\n【方案B】機場 T1 4 樓商場＋5 樓展望台（Pokemon Store、UNIQLO、Hello Kitty、Sky Food Court）\n【方案C】行李寄飯店→東京車站 GRANSTA（Press Butter Sand、MAPLE BUTTER BOY、東京香蕉，09:00 開門）；12:15 離開→取行李→日暮里搭 Skyliner→14:00 抵成田 T1",
        },
        {
          time: "14:50",
          title: "樂桃開櫃",
          detail: "北翼 4 樓自助機台",
        },
        {
          time: "15:40",
          title: "免稅衝刺",
          detail: "Fa-So-La（16:10 截止）",
        },
        {
          time: "16:20",
          title: "登機",
          detail: "",
        },
        {
          time: "16:55",
          title: "MM625 起飛",
          detail: "東京成田 T1 → 台北桃園 T1",
        },
        {
          time: "19:40",
          title: "抵桃園 T1",
          detail: "入境提領約 40–50 分\n機捷 A12→A18（35元）→高鐵桃園→板橋（125元）→計程車到家（約 21:20）",
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
    { label: "樂桃報到提醒",                         value: "國際線起飛前 120–50 分完成手續（成田 T1 北翼 4 樓）" },
    { label: "旅遊平安險（臺灣產物）",               value: "保單號、緊急電話請由「重要資料→匯入」的本機層取得" },
  ],
};

// ───── 折價券（Task4 範圍，此區塊原樣保留不動）─────
// type: "code" 顯示可複製的優惠碼；"barcode" 之後可擴充條碼；一般就填 title + detail。
window.COUPONS = [
  {
    title: "範例藥妝店 7% OFF",
    detail: "出示此畫面＋護照，滿 5000 日圓可用。到 2026-08-31。",
    code: "TOKYO7",
  },
  {
    title: "範例電器行免稅＋5%",
    detail: "免稅專櫃結帳出示，與其他折扣不可併用。",
    code: "",
  },
  {
    title: "範例餐廳飲料招待",
    detail: "四人同行出示，每人一杯飲料。",
    code: "",
  },
];
