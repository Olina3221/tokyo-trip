// 旅遊常用句庫（離線，不需網路）。
// 每句：zh 中文、ja 日文、romaji 羅馬拼音（給你自己看怎麼唸）。
// 之後要加句子，直接在對應分類的陣列裡加物件即可。
window.PHRASES = [
  {
    id: "greetings",
    cat: "溝通・語言",
    items: [
      { zh: "我不會說日文", ja: "日本語が話せません", romaji: "Nihongo ga hanasemasen" },
      { zh: "請說慢一點", ja: "ゆっくり話してください", romaji: "Yukkuri hanashite kudasai" },
      { zh: "可以用英文嗎？", ja: "英語は使えますか？", romaji: "Eigo wa tsukaemasu ka?" },
      { zh: "可以用中文對話嗎？", ja: "中国語が話せる方はいますか？", romaji: "Chūgokugo ga hanaseru kata wa imasu ka?" },
    ],
  },
  {
    id: "dining",
    cat: "餐廳・點餐",
    items: [
      { zh: "我要點這個（指菜單）", ja: "これをください", romaji: "Kore o kudasai" },
      { zh: "推薦是什麼？", ja: "おすすめは何ですか？", romaji: "Osusume wa nan desu ka?" },
      { zh: "請問有水嗎？（喝的水）", ja: "お水をいただけますか？", romaji: "Omizu o itadakemasu ka?" },
      { zh: "不要芥末", ja: "わさび抜きでお願いします", romaji: "Wasabi nuki de onegai shimasu" },
      { zh: "我對這個過敏", ja: "これにアレルギーがあります", romaji: "Kore ni arerugī ga arimasu" },
      { zh: "這個餐點裡有昆布或海苔嗎？請簡單回答就好", ja: "この料理に昆布や海苔は入っていますか？簡単に答えてもらえると助かります。", romaji: "Kono ryōri ni konbu ya nori wa haitte imasu ka? Kantan ni kotaete moraeru to tasukarimasu." },
      { zh: "小朋友不吃辣", ja: "子供は辛いものが食べられません", romaji: "Kodomo wa karai mono ga taberaremasen" },
      { zh: "請結帳", ja: "お会計をお願いします", romaji: "Okaikei o onegai shimasu" },
      { zh: "可以分開付嗎？", ja: "別々に払えますか？", romaji: "Betsubetsu ni haraemasu ka?" },
    ],
  },
  {
    id: "shopping",
    cat: "購物・付款",
    items: [
      { zh: "我可以試穿嗎？", ja: "試着してもいいですか？", romaji: "Shichaku shite mo ii desu ka?" },
      { zh: "有大一號的嗎？", ja: "大きいサイズはありますか？", romaji: "Ōkii saizu wa arimasu ka?" },
      { zh: "只是看看", ja: "見ているだけです", romaji: "Mite iru dake desu" },
      { zh: "這個要怎麼用？可以幫我操作嗎？", ja: "これはどうやって使いますか？操作を手伝ってもらえますか？", romaji: "Kore wa dō yatte tsukaimasu ka? Sōsa o tetsudatte moraemasu ka?" },
      { zh: "我要結帳，沒有會員卡，但有折價券", ja: "お会計をお願いします。会員カードはありませんが、クーポンがあります。", romaji: "Okaikei o onegai shimasu. Kaiin kādo wa arimasen ga, kūpon ga arimasu." },
      { zh: "袋子需要加錢嗎？", ja: "袋は有料ですか？", romaji: "Fukuro wa yūryō desu ka?" },
      { zh: "請給我袋子", ja: "袋をください", romaji: "Fukuro o kudasai" },
      { zh: "可以免稅嗎？", ja: "免税できますか？", romaji: "Menzei dekimasu ka?" },
      { zh: "我要辦退稅", ja: "免税手続きをお願いします", romaji: "Menzei tetsuzuki o onegai shimasu" },
    ],
  },
  {
    id: "transport",
    cat: "交通・問路",
    items: [
      { zh: "車站在哪裡？", ja: "駅はどこですか？", romaji: "Eki wa doko desu ka?" },
      { zh: "去這裡怎麼走？（給看地址）", ja: "ここへはどう行きますか？", romaji: "Koko e wa dō ikimasu ka?" },
      { zh: "這班車有到嗎？", ja: "この電車は行きますか？", romaji: "Kono densha wa ikimasu ka?" },
      { zh: "我要去晴空塔，搭這台公車可以到嗎？", ja: "このバスでスカイツリーに行けますか？", romaji: "Kono basu de sukaitsurī ni ikemasu ka?" },
      { zh: "請幫我叫計程車", ja: "タクシーを呼んでください", romaji: "Takushī o yonde kudasai" },
      { zh: "請到這個地址（給看手機）", ja: "この住所までお願いします", romaji: "Kono jūsho made onegai shimasu" },
    ],
  },
  {
    id: "hotel",
    cat: "飯店・住宿",
    items: [
      { zh: "我有訂房", ja: "予約しています", romaji: "Yoyaku shite imasu" },
      { zh: "可以寄放行李嗎？", ja: "荷物を預けられますか？", romaji: "Nimotsu o azukeraremasu ka?" },
      { zh: "幾點退房？", ja: "チェックアウトは何時ですか？", romaji: "Chekkuauto wa nanji desu ka?" },
      { zh: "冷氣壞了", ja: "エアコンが壊れています", romaji: "Eakon ga kowarete imasu" },
      { zh: "可以多一組毛巾嗎？", ja: "タオルをもう一組もらえますか？", romaji: "Taoru o mō hitokumi moraemasu ka?" },
    ],
  },
  {
    id: "emergency",
    cat: "緊急・求助",
    items: [
      { zh: "請幫幫我", ja: "助けてください", romaji: "Tasukete kudasai" },
      { zh: "我迷路了", ja: "道に迷いました", romaji: "Michi ni mayoimashita" },
      { zh: "我身體不舒服", ja: "気分が悪いです", romaji: "Kibun ga warui desu" },
      { zh: "附近有醫院／藥局嗎？", ja: "近くに病院／薬局はありますか？", romaji: "Chikaku ni byōin / yakkyoku wa arimasu ka?" },
      { zh: "請叫救護車", ja: "救急車を呼んでください", romaji: "Kyūkyūsha o yonde kudasai" },
      { zh: "我的東西掉了", ja: "落とし物をしました", romaji: "Otoshimono o shimashita" },
    ],
  },
];
