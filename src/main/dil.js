// Ana süreçte etkin dil: çeviri, sayı ve tarih biçimi. Kaynak okuyucular sayıları bu dille biçimlendirir.
const path = require("node:path");
const fs = require("node:fs");
const { DILLER, dilSec, cevirici } = require("../ortak/ceviri");

let etkin = "tr";
let sozluk = {};
let cevir = cevirici({});

function sozlukOku(dil) {
  if (dil === "tr") return {};
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "ortak", "diller", `${dil}.json`), "utf8")); } catch { return {}; }
}

module.exports = {
  DILLER,
  // ayar: "sistem" | "tr" | "en" | "es" | "ar"; sistem: app.getLocale()
  kur(ayar, sistem) {
    etkin = ayar && ayar !== "sistem" ? dilSec(ayar, sistem) : dilSec(null, sistem);
    sozluk = sozlukOku(etkin);
    cevir = cevirici(sozluk);
    return etkin;
  },
  dil: () => etkin,
  yerel: () => DILLER[etkin].yerel,
  yon: () => DILLER[etkin].yon,
  sozluk: () => sozluk,
  c: (metin) => cevir(metin),
};
