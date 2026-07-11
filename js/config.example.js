// config.js 已納入版控隨站部署；金鑰須在 Google Cloud Console 設 HTTP 參照網址限制＋API 限制保護。
// 嚴禁在 config.js 放任何個資。
// 取得金鑰步驟見 README.md「Google API 金鑰設定」。
// 同一把 API key 可同時用於 翻譯(Cloud Translation) 與 拍照辨識(Cloud Vision)。
window.APP_CONFIG = {
  GOOGLE_API_KEY: "",   // 例如 "AIzaSyD....."
};
