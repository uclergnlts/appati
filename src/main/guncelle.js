// Otomatik güncelleme: GitHub'daki son yayının besleme dosyasına bakar, yeni sürümü arka planda indirir.
// macOS'un yerleşik güncelleyicisi (Squirrel.Mac) kullanılır; yalnızca Developer ID ile imzalı paketlerde çalışır.
const BESLEME = "https://github.com/uclergnlts/appati/releases/latest/download/releases.json";

// durum: "kapali" (geliştirme / desteklenmeyen sistem) | "bekliyor" | "denetleniyor" | "guncel" | "indiriliyor" | "hazir" | "hata"
function guncelleyici({ autoUpdater, etkin, bildir, gunluk }) {
  let d = { durum: etkin ? "bekliyor" : "kapali", surum: null, mesaj: null, zaman: null };
  const yay = (yeni) => { d = { ...d, ...yeni, zaman: new Date().toISOString() }; bildir(d); };

  if (etkin) {
    try {
      autoUpdater.setFeedURL({ url: BESLEME, serverType: "json" });
      autoUpdater.on("checking-for-update", () => yay({ durum: "denetleniyor", mesaj: null }));
      autoUpdater.on("update-available", () => yay({ durum: "indiriliyor", mesaj: null }));
      autoUpdater.on("update-not-available", () => yay({ durum: "guncel", mesaj: null }));
      autoUpdater.on("update-downloaded", (_o, _not, ad) => yay({ durum: "hazir", surum: String(ad || "").replace(/^Appati\s*/, "") || null, mesaj: null }));
      autoUpdater.on("error", (h) => {
        gunluk("güncelleme", h);
        // İndirilmiş bir güncelleme varken sonraki denetimin hatası onu geçersiz kılmaz.
        if (d.durum !== "hazir") yay({ durum: "hata", mesaj: String((h && h.message) || h).slice(0, 200) });
      });
    } catch (h) {
      gunluk("güncelleme kurulumu", h);
      d = { ...d, durum: "hata", mesaj: String((h && h.message) || h).slice(0, 200) };
    }
  }

  return {
    durum: () => d,
    denetle() {
      if (!etkin || d.durum === "denetleniyor" || d.durum === "indiriliyor" || d.durum === "hazir") return;
      try { autoUpdater.checkForUpdates(); } catch (h) { gunluk("güncelleme denetimi", h); yay({ durum: "hata", mesaj: String((h && h.message) || h).slice(0, 200) }); }
    },
    kur() { if (d.durum === "hazir") autoUpdater.quitAndInstall(); },
  };
}

module.exports = { guncelleyici, BESLEME };
