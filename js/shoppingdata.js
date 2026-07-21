// js/shoppingdata.js — 購物清單靜態資料（Task23 新增）
// 公開商品資訊，無個資，可公開部署至 GitHub Pages
// id 一經發佈不得改（改＝使用者勾選狀態失配）
// 隱私確認（[實測] 2026-07-21）：全 20 筆均為公開商品資訊，無姓名/電話/證件/訂位號
// v24 移除：g07 東京香蕉 TOKYO BANANA、g10 白色戀人（id 不重編，localStorage 勾選錨不失效）

window.SHOPPING = {
  rateNote: "1¥ ≈ NT$0.18",
  categories: [
    {
      id: "drug",
      name: "藥妝",
      items: [
        {
          id: "d01",
          name: "Chocola BB Plus B群 180錠",
          desc: "補充維生素B群，改善口角炎、皮膚粗糙、慢性疲勞；長期服用效果明顯",
          twPrice: "1,400",
          jpPrice: "¥1,980",
          ntPrice: "約356",
          where: "松本清、各藥妝店",
          notes: "台灣有賣但貴2.5倍，掃貨首選"
        },
        {
          id: "d02",
          name: "TRANSINO White C Clear II 美白錠 240錠",
          desc: "美白專用複方錠，抑制黑色素生成，改善斑點、暗沉；需連續服用3個月以上見效",
          twPrice: "台灣買不到",
          jpPrice: "¥2,880",
          ntPrice: "約518",
          where: "松本清、各藥妝店",
          notes: "針對肝斑、曬斑效果明顯"
        },
        {
          id: "d03",
          name: "白兔牌 HYTHIOL-C PLUS 270錠",
          desc: "高單位維生素C＋L-半胱胺酸複方，三管齊下美白、抗氧化、改善肝斑",
          twPrice: "台灣買不到",
          jpPrice: "¥3,280",
          ntPrice: "約590",
          where: "松本清、各藥妝店",
          notes: "和TRANSINO搭配使用效果更強"
        },
        {
          id: "d04",
          name: "參天 Sante FX Neo 清涼眼藥水",
          desc: "高清涼度眼藥水，緩解眼睛疲勞、乾澀、充血；長時間盯螢幕後最有感",
          twPrice: "無此款",
          jpPrice: "¥880",
          ntPrice: "約158",
          where: "各大藥妝、便利商店",
          notes: "清涼感強，第一次用要有心理準備"
        },
        {
          id: "d05",
          name: "SS製藥 TravelMin 暈車暈船藥",
          desc: "預防動暈症（暈車/暈船/暈機），出發前30分服用，效果持續4-6小時，較不嗜睡",
          twPrice: "無此款",
          jpPrice: "¥1,100",
          ntPrice: "約198",
          where: "藥妝店、便利商店",
          notes: "搭遊覽車、纜車、遊船前都適用"
        },
        {
          id: "d06",
          name: "大塚製藥 Oronine H 多功能軟膏 40g",
          desc: "萬用抗菌消炎軟膏：輕微燙傷、痘痘、嘴角炎、皮膚乾裂、蚊蟲叮咬、富貴手皆可用",
          twPrice: "無此款",
          jpPrice: "¥748",
          ntPrice: "約135",
          where: "各大藥妝",
          notes: "旅行必帶，一條搞定大部分皮膚小問題"
        },
        {
          id: "d07",
          name: "龍角散 喉糖含片（薄荷）",
          desc: "漢方草藥喉糖，舒緩喉嚨不適、止咳潤喉；粉末版效果更直接，老少皆宜",
          twPrice: "約200",
          jpPrice: "¥880",
          ntPrice: "約158",
          where: "各大藥妝、便利商店",
          notes: "空調房喉嚨乾也很有效，旅行常備"
        },
        {
          id: "d08",
          name: "獅王 LION 休足時間 足貼 18片",
          desc: "薄荷涼感足貼，貼腳底8小時，消除腿部疲勞與水腫感；逛街一整天後貼超有感",
          twPrice: "約350",
          jpPrice: "¥660",
          ntPrice: "約119",
          where: "各大藥妝",
          notes: "行程尾聲必買，晚上貼著睡一覺隔天又是新的腿"
        },
        {
          id: "d09",
          star: true,
          name: "花王 Megurism 蒸氣眼罩 12片（薰衣草）",
          desc: "40°C蒸氣熱敷眼部，持續約20分鐘，放鬆眼部肌肉；飛機上或睡前使用效果最好",
          twPrice: "約450",
          jpPrice: "¥660",
          ntPrice: "約119",
          where: "各大藥妝",
          notes: "推薦薰衣草款助眠；無香款也有"
        },
        {
          id: "d10",
          star: true,
          name: "肌研 極潤玻尿酸保濕乳液 200mL",
          desc: "含三種玻尿酸的高保濕乳液，敏感肌可用，塗完皮膚立刻Q彈；台灣版容量小又貴",
          twPrice: "約750",
          jpPrice: "¥1,078",
          ntPrice: "約194",
          where: "各大藥妝",
          notes: "全家人都能用，買兩瓶很正常"
        },
        {
          id: "d11",
          star: true,
          name: "曼秀雷敦 口內炎貼（口腔潰瘍貼）",
          desc: "直接貼在口腔潰瘍傷口上，藥膜隔絕刺激同時加速癒合；吃飯講話不會掉落",
          twPrice: "無此款",
          jpPrice: "¥880",
          ntPrice: "約158",
          where: "各大藥妝",
          notes: "嘴巴破救星，效果比漱口水直接"
        },
        {
          id: "d12",
          star: true,
          name: "池田模範堂 Muhi 無比滴 止癢液",
          desc: "清涼型止癢外用液，適用蚊蟲叮咬；兒童版（粉紅）較溫和，成人版清涼感更強",
          twPrice: "約200",
          jpPrice: "¥680",
          ntPrice: "約122",
          where: "各大藥妝",
          notes: "夏天東京蚊子多，旅行必備"
        }
      ]
    },
    {
      id: "gift",
      name: "伴手禮",
      items: [
        {
          id: "g01",
          name: "干貝糖（各口味）",
          desc: "整顆帆立貝柱（干貝）乾燥調味製成，濃郁鮮甜高蛋白，Q彈口感、個別包裝；可當零嘴/下酒菜，也能切碎入菜或熬湯",
          where: "上野阿美橫丁、成田機場北海道物產",
          jpPrice: "¥1,500-2,500 / 500g",
          ntPrice: "約270-450",
          shelfLife: "3-6個月",
          notes: "台灣蝦皮約NT$1,385-1,500/500g，日本現場約NT$270-450，省900-1,200元！阿美橫量大可議價；試吃需主動問攤主"
        },
        {
          id: "g02",
          name: "Calbee 薯條三兄弟",
          desc: "北海道馬鈴薯製，三種粗細口感同一盒，鹹香不油膩，分量多好分送同事",
          where: "成田機場、各大超市",
          jpPrice: "¥594/箱",
          ntPrice: "約107",
          shelfLife: "約3個月",
          notes: "機場版有多口味禮盒，方便"
        },
        {
          id: "g03",
          name: "Kanro Pure 夾心軟糖",
          desc: "外層細砂糖包覆，內層濃縮果汁軟糖，口感Q彈酸甜；葡萄/蜜桃/草莓最受歡迎",
          where: "便利商店、藥妝店",
          jpPrice: "¥270/袋",
          ntPrice: "約49",
          shelfLife: "1年",
          notes: "大袋在藥妝更划算，買5袋以上"
        },
        {
          id: "g04",
          name: "MAPLE BUTTER BOY 楓糖奶油餅乾",
          desc: "楓糖風味奶油夾心薄餅，香氣濃郁、酥脆中帶鹹甜平衡；比砂糖奶油樹更有特色",
          where: "東京車站 GRANSTA、成田機場",
          jpPrice: "¥1,080/12入",
          ntPrice: "約194",
          shelfLife: "30天",
          notes: "機場也有，最後一天掃貨"
        },
        {
          id: "g05",
          name: "GRAPESTONE 砂糖奶油樹",
          desc: "輕盈酥脆的奶油焦糖千層餅，甜而不膩，最多人帶的東京伴手禮之一",
          where: "機場、百貨、7-11",
          jpPrice: "¥756/8入",
          ntPrice: "約136",
          shelfLife: "60天",
          notes: "7-11就買得到，不用特別跑"
        },
        {
          id: "g06",
          name: "楓糖長崎蛋糕（東京車站限定）",
          desc: "傳統長崎蛋糕加入楓糖香氣，口感濕潤綿密帶焦糖甜香；效期極短需注意",
          where: "東京車站 GRANSTA（需確認）",
          jpPrice: "¥1,200/盒",
          ntPrice: "約216",
          shelfLife: "10天",
          notes: "效期短，最後一天才買；先確認是否還有販售"
        },
        {
          id: "g08",
          star: true,
          name: "Press Butter Sand 奶油焦糖夾心餅",
          desc: "酥脆外皮夾入奶油焦糖醬，層次豐富鹹甜交織；近年爆紅，常需排隊或早到才有",
          where: "東京車站 GRANSTA",
          jpPrice: "¥1,080/9入",
          ntPrice: "約194",
          shelfLife: "30天",
          notes: "機場較少見；東京車站開門前去排"
        },
        {
          id: "g09",
          star: true,
          name: "東京牛奶起司工廠 Milk Cheese",
          desc: "牛奶與起司雙層夾心薄餅，清爽微鹹甜不膩；長輩接受度高，分送最保險",
          where: "成田機場、COREDO、百貨",
          jpPrice: "¥980/10入",
          ntPrice: "約176",
          shelfLife: "30天",
          notes: "機場有賣，最後集中採購"
        }
      ]
    }
  ]
};
