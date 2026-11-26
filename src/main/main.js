// Appati: menü çubuğunda duran, ekranın sağ kenarında açılan panel.
const { app, BrowserWindow, Notification, Tray, powerMonitor, dialog, session, autoUpdater, Menu, ipcMain, nativeImage, nativeTheme, systemPreferences, screen, globalShortcut, shell, safeStorage } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { depo } = require("./store");
const { KAYNAKLAR, sablonlaTamamla } = require("./katalog");
const { uygulamayiTopla, ozetle, kaynakSina } = require("./collect");
const { demoUygulamalar } = require("./demo");
const { istekci } = require("./util");
const { farkBul, agHatasi } = require("./bildirim");
const { centikKur } = require("./centik");
const { medya } = require("./medya");
const { guncelleyici } = require("./guncelle");
const { haftaAnahtari, bildirimMetni } = require("./haftalik");
const dil = require("./dil");

const GENISLIK = 440;
const DEMO = process.env.APPATI_DEMO === "1";
const MAC = process.platform === "darwin";

let pencere = null;
let tepsi = null;
let kayit = null;
let durum = { uygulamalar: [], ozet: null, zaman: null, demo: false, yukleniyor: true };
let suren = null;
let zamanlayici = null;
let centik = null;
let medyaSayac = null;
let guncelle = null;
let sonMedya = null;
const calan = medya();
const ORNEK_MEDYA = { kaynak: "spotify", oynuyor: true, baslik: "Örnek Şarkı", alt: "Örnek Sanatçı", kapak: null };

// Kaynak istekleri için ayrı, bellekte duran bir ağ oturumu. Chromium'un ağ katmanını kullanır (sistemin vekil
// sunucu ve IPv4/IPv6 ayarlarına uyar) ama kendini tarayıcı olarak tanıtmaz: Supabase gibi servisler gizli
// anahtarı "tarayıcıdan geliyor" diye reddediyor ("Forbidden use of secret API key in browser").
let agOturum_ = null;
function agOturumu() {
  if (!agOturum_) {
    agOturum_ = session.fromPartition("appati-ag");
    agOturum_.setUserAgent(`Appati/${app.getVersion()} (macOS; masaustu uygulamasi)`);
    // Chromium'un eklediği tarayıcı ipuçlarını (sec-fetch-*, sec-ch-*) da gönderme.
    agOturum_.webRequest.onBeforeSendHeaders((ayrinti, geri) => {
      const basliklar = { ...ayrinti.requestHeaders };
      for (const ad of Object.keys(basliklar)) if (/^sec-/i.test(ad) || /^accept-language$/i.test(ad)) delete basliklar[ad];
      geri({ requestHeaders: basliklar });
    });
  }
  return agOturum_;
}

// Çentikteki özet: bugünün birkaç rakamı ve çalan şarkı / video.
function centikVerisi() {
  const k = (durum.ozet && durum.ozet.kpi) || {};
  const birim = (durum.ozet && durum.ozet.paraBirimi) || "$";
  const rakamlar = [["aktifBugun", "aktif bugün"], ["ziyaretciBugun", "ziyaretçi"], ["yeniKayitBugun", "yeni kayıt"], ["mrr", "MRR"]]
    .filter(([a]) => k[a] !== undefined).slice(0, 3)
    .map(([a, etiket]) => ({ etiket, deger: `${a === "mrr" ? birim : ""}${Math.round(k[a]).toLocaleString(dil.yerel())}` }));
  const medyaAcik = kayit.ayar().genel.medya;
  return { rakamlar, demo: durum.demo, medyaAcik, medya: medyaAcik ? (DEMO && !MAC ? ORNEK_MEDYA : sonMedya) : null };
}

// Bir sorgu sürerken yenisi başlamaz; yoksa yavaş kalan eski yanıt yenisinin üzerine yazabilir.
let medyaSoruluyor = false;
async function medyaYenile() {
  if (medyaSoruluyor) return;
  medyaSoruluyor = true;
  try {
    const g = kayit.ayar().genel;
    const yeni = g.medya && g.centik ? await calan.durum() : null;
    const simdiki = kayit.ayar().genel;
    sonMedya = simdiki.medya && simdiki.centik ? yeni : null; // sorgu sürerken ayar kapatıldıysa sonucu at
  } catch {
    sonMedya = null;
  } finally {
    medyaSoruluyor = false;
  }
  if (centik) centik.guncelle();
}

// Çalan içerik: ada açıkken sık, kapalıyken seyrek sorulur (küçük ada bunun sayesinde belirir ve kaybolur).
function medyaDongu() {
  clearInterval(medyaSayac);
  medyaSayac = null;
  const g = kayit.ayar().genel;
  if (!g.medya || !g.centik) { sonMedya = null; return; }
  medyaSayac = setInterval(medyaYenile, centik && centik.acik() ? 1500 : 4000);
  medyaYenile();
}

function centikAyarla() {
  if (!centik) return;
  if (kayit.ayar().genel.centik) centik.baslat(); else centik.durdur();
  medyaDongu();
}

if (!app.requestSingleInstanceLock()) app.quit();

// Sessiz kalan hatalar hata.log dosyasına yazılır (Ayarlar > Sorun giderme'de yolu görünür).
const gunlukYolu = () => path.join(app.getPath("userData"), "hata.log");
function gunluk(ne, hata) {
  try { fs.appendFileSync(gunlukYolu(), `${new Date().toISOString()} ${ne}: ${(hata && hata.stack) || hata}\n`); } catch {}
}
process.on("unhandledRejection", (h) => gunluk("yakalanmamış söz", h));
process.on("uncaughtException", (h) => { gunluk("yakalanmamış hata", h); dialog.showErrorBox(dil.c("Appati bir hatayla karşılaştı"), String((h && h.message) || h)); });

function yerlestir() {
  const imlec = screen.getCursorScreenPoint();
  const alan = screen.getDisplayNearestPoint(imlec).workArea;
  pencere.setBounds({ x: alan.x + alan.width - GENISLIK - 10, y: alan.y + 10, width: GENISLIK, height: alan.height - 20 });
}

function goster() {
  yerlestir();
  pencere.show();
  pencere.focus();
}

function ac_kapa() {
  if (pencere.isVisible() && pencere.isFocused()) pencere.hide(); else goster();
}

function pencereKur() {
  pencere = new BrowserWindow({
    width: GENISLIK, height: 800, show: false, frame: false, resizable: false, movable: false,
    minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true,
    // "popover" malzemesi açık ve koyu görünüme kendiliğinden uyar; arkadaki pencereler bulanık görünür.
    transparent: true, hasShadow: true, vibrancy: "popover", visualEffectState: "active", roundedCorners: true,
    backgroundColor: "#00000000",
    webPreferences: { preload: path.join(__dirname, "..", "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  pencere.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pencere.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  pencere.on("blur", () => { if (!kayit.ayar().genel.sabit) pencere.hide(); });
  // Panel kendi dosyasından başka bir yere gitmesin; dış bağlantılar tarayıcıda açılır.
  pencere.webContents.on("will-navigate", (o) => o.preventDefault());
  pencere.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  sabitle();
}

const TEMA = { sistem: "system", acik: "light", koyu: "dark" };
function temaUygula() {
  nativeTheme.themeSource = TEMA[kayit.ayar().genel.tema] || "system";
}

// macOS'ta Sistem Ayarları > Görünüm'de seçilen vurgu rengi (#rrggbb); başka sistemlerde null.
function vurguRengi() {
  try { return MAC ? `#${systemPreferences.getAccentColor().slice(0, 6)}` : null; } catch { return null; }
}

function sabitle() {
  pencere.setAlwaysOnTop(Boolean(kayit.ayar().genel.sabit), "floating");
}

function tepsiKur() {
  const simge = nativeImage.createFromPath(path.join(__dirname, "..", "..", "assets", "trayTemplate.png"));
  simge.setTemplateImage(true);
  tepsi = new Tray(simge);
  tepsi.setToolTip("Appati");
  tepsi.on("click", ac_kapa);
  tepsi.on("right-click", () => {
    tepsi.popUpContextMenu(Menu.buildFromTemplate([
      { label: dil.c("Paneli aç / kapat"), accelerator: "Alt+Command+A", click: ac_kapa },
      { label: dil.c("Şimdi yenile"), click: () => yenile() },
      { type: "separator" },
      { label: dil.c("Appati'den çık"), role: "quit" },
    ]));
  });
}

function yayinla() {
  if (pencere && !pencere.isDestroyed()) {
    pencere.webContents.send("durum", durum);
    pencere.webContents.send("ayar", kayit.guvenliAyar());
  }
  if (centik) centik.guncelle();
  if (tepsi && MAC) {
    // Simgenin yanındaki sayı: Ayarlar > Menü çubuğunda gösterilen sayı.
    const hangi = kayit.ayar().genel.cubukSayi;
    const d = hangi === "yok" || !durum.ozet ? undefined : durum.ozet.kpi[hangi];
    const yazi = d === undefined || d === null ? "" : Math.round(d).toLocaleString(dil.yerel());
    tepsi.setTitle(yazi ? ` ${hangi === "mrr" ? durum.ozet.paraBirimi : ""}${yazi}` : "");
  }
}

async function yenile() {
  if (suren) return suren;
  durum = { ...durum, yukleniyor: true };
  yayinla();
  suren = (async () => {
    const simdi = new Date();
    const tanimlar = kayit.ayar().uygulamalar;
    let uygulamalar;
    const demo = DEMO || tanimlar.length === 0;
    if (demo) {
      uygulamalar = demoUygulamalar(simdi);
    } else {
      // Anahtarların ilk okunuşunda macOS Anahtar Zinciri izin sorabilir ve cevaplanana kadar uygulama bekler.
      // Önce paneli ve açıklamayı göster, uygulamayı öne al ki izin penceresi arkada kalmasın.
      if (kayit.cozmeBekliyor()) {
        durum = { ...durum, yukleniyor: true, hata: "macOS Anahtar Zinciri izni isteyebilir. Şifre penceresi çıkarsa Mac şifreni girip “Her Zaman İzin Ver” de." };
        yayinla();
        if (MAC) app.focus({ steal: true });
        await new Promise((r) => setTimeout(r, 400));
      }
      const gizliler = kayit.gizliler();
      // İstekler Chromium'un ağ katmanından gider (net.fetch): sistemin vekil sunucu ayarına ve IPv4/IPv6 seçimine uyar.
      // Node'un kendi fetch'i bozuk IPv6'lı ağlarda bazı sunuculara bağlanırken zaman aşımına düşüyordu.
      const ctx = { istek: istekci((adres, secenek) => agOturumu().fetch(adres, secenek)), simdi, onbellek: kayit.onbellek };
      uygulamalar = await Promise.all(tanimlar.map((u) => uygulamayiTopla(u, gizliler[u.id], ctx)));
      // İnternet yoksa (uyku sonrası, Wi-Fi kopuk) eldeki son rakamlar silinmesin.
      const kaynaklar = uygulamalar.flatMap((u) => u.kaynaklar);
      if (kaynaklar.length && kaynaklar.every((k) => !k.tamam && agHatasi(k.hata)) && durum.zaman && !durum.demo) {
        durum = { ...durum, yukleniyor: false, hata: "İnternete bağlanılamadı; son okunan rakamlar gösteriliyor." };
        return;
      }
      // Önceki okumayla farkı bildir (yeni düşük puanlı yorum, yeni abone, bozulan kaynak).
      const { bildirimler, iz } = farkBul(kayit.onbellek.al("bildirim.iz"), uygulamalar);
      kayit.onbellek.yaz("bildirim.iz", iz);
      // Haftalık özet: yeni haftanın ilk okumasında bir kez bildirilir (ilk kurulumda değil).
      const hafta = haftaAnahtari(simdi);
      const sonHafta = kayit.onbellek.al("haftalik.sonHafta");
      if (sonHafta !== hafta) {
        kayit.onbellek.yaz("haftalik.sonHafta", hafta);
        if (sonHafta) for (const u of uygulamalar) { const m = bildirimMetni(u, dil.c); if (m) bildirimler.push({ uygulamaId: u.id, baslik: `${u.ad}: geçen hafta`, metin: m }); }
      }
      kayit.onbellek.kaydet();
      if (kayit.ayar().genel.bildirim && Notification.isSupported()) {
        for (const b of bildirimler.slice(0, 5)) {
          const n = new Notification({ title: dil.c(b.baslik), body: dil.c(b.metin), silent: false });
          n.on("click", () => { goster(); pencere.webContents.send("git", { ad: "uyg", id: b.uygulamaId, sekme: "ozet" }); });
          n.show();
        }
      }
    }
    durum = { uygulamalar, ozet: ozetle(uygulamalar), zaman: simdi.toISOString(), demo, yukleniyor: false };
    if (!demo && kayit.kilitli()) durum.hata = "Anahtar Zinciri izni verilmediği için kayıtlı anahtarlar okunamadı. Yenile düğmesine basıp izin ver.";
  })().catch((e) => {
    gunluk("yenileme", e);
    durum = { ...durum, yukleniyor: false, hata: `Yenileme başarısız: ${e.message}` };
  }).finally(() => {
    suren = null;
    yayinla();
  });
  return suren;
}

function zamanla() {
  clearInterval(zamanlayici);
  zamanlayici = setInterval(yenile, kayit.ayar().genel.yenilemeDk * 60000);
}

// Arayüze giden dil bilgisi: kod, sayı/tarih yereli, yazı yönü ve sözlük.
const dilPaketi = () => ({ kod: dil.dil(), yerel: dil.yerel(), yon: dil.yon(), sozluk: dil.sozluk() });

// Dil ayarı değişince (ya da açılışta) etkin dili kurar; değiştiyse pencerelere bildirir ve menüyü yeniler.
function dilKur() {
  const once = dil.dil();
  // İlk kullanımda Türkçe sistemde Türkçe, diğerlerinde sistem diline göre açılır.
  const yeni = dil.kur(kayit.ayar().genel.dil, app.getLocale());
  if (yeni !== once && centik && !centik.pencere.isDestroyed()) centik.pencere.webContents.send("dil", dilPaketi());
  return yeni !== once;
}

function ipcKur() {
  const paket = () => ({ dil: dilPaketi(), guncelleme: guncelle ? guncelle.durum() : { durum: "kapali" }, gunluk: gunlukYolu(), durum, ayar: kayit.guvenliAyar(), katalog: KAYNAKLAR, sablonlar: [], surum: app.getVersion(), vurgu: vurguRengi() });
  ipcMain.handle("baslangic", paket);
  ipcMain.handle("yenile", async () => { kayit.kilidiSifirla(); await yenile(); return paket(); });
  ipcMain.handle("uygulama:kaydet", async (_o, gelen) => { kayit.uygulamaKaydet(gelen); yenile(); return paket(); });
  ipcMain.handle("uygulama:sil", async (_o, id) => { kayit.uygulamaSil(String(id)); yenile(); return paket(); });
  ipcMain.handle("genel:kaydet", async (_o, yeni) => {
    const once = kayit.ayar().genel;
    kayit.genelKaydet(yeni || {});
    const sonra = kayit.ayar().genel;
    if (dilKur()) yenile(); // kaynak mesajları ve biçimler yeni dille yeniden üretilsin
    sabitle();
    temaUygula();
    zamanla();
    centikAyarla();
    if (centik && ["centikEn", "centikBoy", "centikSaydamlik"].some((a) => once[a] !== sonra[a])) centik.onizle();
    yayinla();
    if (MAC && app.isPackaged) app.setLoginItemSettings({ openAtLogin: kayit.ayar().genel.acilistaBaslat });
    return paket();
  });
  ipcMain.handle("kaynak:sina", async (_o, tur, taslak) => {
    const t = taslak || {};
    const kayitli = t.id ? kayit.gizliler()[String(t.id)] : {};
    return kaynakSina(String(tur), t, kayitli, { istek: istekci((adres, secenek) => agOturumu().fetch(adres, secenek)), simdi: new Date() });
  });
  ipcMain.handle("guncelle:denetle", () => { if (guncelle) guncelle.denetle(); return paket(); });
  ipcMain.handle("guncelle:kur", () => { if (guncelle) guncelle.kur(); });
  ipcMain.handle("gizle", () => pencere.hide());
  ipcMain.handle("panel:ac", () => { if (centik) centik.kapat(); goster(); });
  ipcMain.handle("medya:komut", async (_o, komut) => {
    if (!sonMedya || !["oynat", "sonraki", "onceki"].includes(komut)) return { tamam: false };
    const sonuc = await calan.komut(sonMedya.kaynak, komut, sonMedya.tarayici);
    setTimeout(medyaYenile, 350);
    return sonuc;
  });
  ipcMain.handle("medya:ac", (_o, hangi) => {
    if (hangi === "spotify") shell.openExternal("spotify:");
    if (hangi === "youtube") shell.openExternal("https://www.youtube.com/");
  });
  ipcMain.handle("cik", () => app.quit());
  ipcMain.handle("disari", (_o, adres) => {
    if (typeof adres === "string" && /^https:\/\//.test(adres)) shell.openExternal(adres);
  });
}

app.whenReady().then(() => {
  try {
  if (MAC && app.dock) app.dock.hide();
  // Yalnızca Linux'taki duman testi için: anahtar halkası olmayan makinede Chromium'un temel şifrelemesine izin ver.
  if (process.platform === "linux" && process.env.APPATI_TEST === "1") safeStorage.setUsePlainTextEncryption(true);
  kayit = depo(app.getPath("userData"), safeStorage);
  // Şablondan eklenmiş kayıtlarda şablonun sonradan kazandığı alanlar kalıcı olarak yazılır.
  kayit.uygulamalariDonustur(sablonlaTamamla);
  dilKur();
  temaUygula();
  ipcKur();
  pencereKur();
  const vurguGonder = () => pencere && !pencere.isDestroyed() && pencere.webContents.send("vurgu", vurguRengi());
  nativeTheme.on("updated", vurguGonder);
  systemPreferences.on("accent-color-changed", vurguGonder);
  tepsiKur();
  // Çentik açıkken çalan içerik saniyede bir sorulur; kapalıyken hiç sorulmaz.
  centik = centikKur({
    veriAl: centikVerisi,
    olculer: () => { const g = kayit.ayar().genel; return { en: g.centikEn, boy: g.centikBoy, alfa: 1 - g.centikSaydamlik / 100 }; },
    acildi: medyaDongu,
    kapandi: medyaDongu,
  });
  centikAyarla();
  globalShortcut.register("Alt+Command+A", ac_kapa);
  // İlk okuma panel göründükten sonra başlar; Anahtar Zinciri izni beklenirken ekran boş kalmasın.
  let ilkOkuma = false;
  const basla = () => { if (ilkOkuma) return; ilkOkuma = true; goster(); setTimeout(yenile, 300); };
  pencere.once("ready-to-show", basla);
  setTimeout(basla, 4000); // pencere olayı gelmezse yine de başla
  zamanla();
  // Güncelleme: yalnızca paketlenmiş Mac uygulamasında. Açılıştan kısa süre sonra ve altı saatte bir denetlenir.
  guncelle = guncelleyici({
    autoUpdater, etkin: MAC && app.isPackaged, gunluk,
    bildir: (d) => { if (pencere && !pencere.isDestroyed()) pencere.webContents.send("guncelleme", d); },
  });
  const guncellemeDenetle = () => { if (kayit.ayar().genel.otoGuncelle) guncelle.denetle(); };
  setTimeout(guncellemeDenetle, 20000);
  setInterval(guncellemeDenetle, 6 * 3600000);
  // Uykudan uyanınca ağın gelmesini kısa süre bekleyip yenile.
  powerMonitor.on("resume", () => setTimeout(yenile, 8000));
  } catch (h) {
    // then() içindeki hata sessizce yutulur; görünür kıl.
    gunluk("açılış", h);
    dialog.showErrorBox(dil.c("Appati açılamadı"), String((h && h.stack) || h));
  }
});

app.on("second-instance", () => pencere && goster());
app.on("window-all-closed", () => {});
app.on("will-quit", () => globalShortcut.unregisterAll());
