// Appati: menü çubuğunda duran, ekranın sağ kenarında açılan panel.
const { app, BrowserWindow, Notification, Tray, Menu, ipcMain, nativeImage, nativeTheme, systemPreferences, screen, globalShortcut, shell, safeStorage } = require("electron");
const path = require("node:path");
const { depo } = require("./store");
const { KAYNAKLAR, SABLONLAR } = require("./katalog");
const { uygulamayiTopla, ozetle } = require("./collect");
const { demoUygulamalar } = require("./demo");
const { istekci } = require("./util");
const { farkBul } = require("./bildirim");
const { centikKur } = require("./centik");
const { medya } = require("./medya");

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
let sonMedya = null;
const calan = medya();

// Çentikteki özet: bugünün birkaç rakamı ve çalan şarkı / video.
function centikVerisi() {
  const k = (durum.ozet && durum.ozet.kpi) || {};
  const birim = (durum.ozet && durum.ozet.paraBirimi) || "$";
  const rakamlar = [["aktifBugun", "aktif bugün"], ["ziyaretciBugun", "ziyaretçi"], ["yeniKayitBugun", "yeni kayıt"], ["mrr", "MRR"]]
    .filter(([a]) => k[a] !== undefined).slice(0, 3)
    .map(([a, etiket]) => ({ etiket, deger: `${a === "mrr" ? birim : ""}${Math.round(k[a]).toLocaleString("tr-TR")}` }));
  const medyaAcik = kayit.ayar().genel.medya;
  return { rakamlar, demo: durum.demo, medyaAcik, medya: medyaAcik ? (DEMO && !MAC ? ORNEK_MEDYA : sonMedya) : null };
}
const ORNEK_MEDYA = { kaynak: "spotify", oynuyor: true, baslik: "Örnek Şarkı", alt: "Örnek Sanatçı", kapak: null };

async function medyaYenile() {
  if (!kayit.ayar().genel.medya) return;
  sonMedya = await calan.durum();
  if (centik) centik.gonder(centikVerisi());
}

function centikAyarla() {
  if (!centik) return;
  if (kayit.ayar().genel.centik) centik.baslat(); else centik.durdur();
}

if (!app.requestSingleInstanceLock()) app.quit();

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
      { label: "Paneli aç / kapat", accelerator: "Alt+Command+A", click: ac_kapa },
      { label: "Şimdi yenile", click: () => yenile() },
      { type: "separator" },
      { label: "Appati'den çık", role: "quit" },
    ]));
  });
}

function yayinla() {
  if (pencere && !pencere.isDestroyed()) pencere.webContents.send("durum", durum);
  if (centik) centik.gonder(centikVerisi());
  if (tepsi && MAC) {
    // Simgenin yanındaki sayı: Ayarlar > Menü çubuğunda gösterilen sayı.
    const hangi = kayit.ayar().genel.cubukSayi;
    const d = hangi === "yok" || !durum.ozet ? undefined : durum.ozet.kpi[hangi];
    const yazi = d === undefined || d === null ? "" : Math.round(d).toLocaleString("tr-TR");
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
      const gizliler = kayit.gizliler();
      const ctx = { istek: istekci(fetch), simdi, onbellek: kayit.onbellek };
      uygulamalar = await Promise.all(tanimlar.map((u) => uygulamayiTopla(u, gizliler[u.id], ctx)));
      // Önceki okumayla farkı bildir (yeni düşük puanlı yorum, yeni abone, bozulan kaynak).
      const { bildirimler, iz } = farkBul(kayit.onbellek.al("bildirim.iz"), uygulamalar);
      kayit.onbellek.yaz("bildirim.iz", iz);
      kayit.onbellek.kaydet();
      if (kayit.ayar().genel.bildirim && Notification.isSupported()) {
        for (const b of bildirimler.slice(0, 5)) {
          const n = new Notification({ title: b.baslik, body: b.metin, silent: false });
          n.on("click", () => { goster(); pencere.webContents.send("git", { ad: "uyg", id: b.uygulamaId, sekme: "ozet" }); });
          n.show();
        }
      }
    }
    durum = { uygulamalar, ozet: ozetle(uygulamalar), zaman: simdi.toISOString(), demo, yukleniyor: false };
  })().catch((e) => {
    durum = { ...durum, yukleniyor: false, hata: e.message };
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

function ipcKur() {
  const paket = () => ({ durum, ayar: kayit.guvenliAyar(), katalog: KAYNAKLAR, sablonlar: SABLONLAR, surum: app.getVersion(), vurgu: vurguRengi() });
  ipcMain.handle("baslangic", paket);
  ipcMain.handle("yenile", async () => { await yenile(); return paket(); });
  ipcMain.handle("uygulama:kaydet", async (_o, gelen) => { kayit.uygulamaKaydet(gelen); yenile(); return paket(); });
  ipcMain.handle("uygulama:sil", async (_o, id) => { kayit.uygulamaSil(String(id)); yenile(); return paket(); });
  ipcMain.handle("genel:kaydet", async (_o, yeni) => {
    kayit.genelKaydet(yeni || {});
    sabitle();
    temaUygula();
    zamanla();
    centikAyarla();
    yayinla();
    if (MAC && app.isPackaged) app.setLoginItemSettings({ openAtLogin: kayit.ayar().genel.acilistaBaslat });
    return paket();
  });
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
  if (MAC && app.dock) app.dock.hide();
  // Yalnızca Linux'taki duman testi için: anahtar halkası olmayan makinede Chromium'un temel şifrelemesine izin ver.
  if (process.platform === "linux" && process.env.APPATI_TEST === "1") safeStorage.setUsePlainTextEncryption(true);
  kayit = depo(app.getPath("userData"), safeStorage);
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
    acildi: () => { medyaYenile(); clearInterval(medyaSayac); medyaSayac = setInterval(medyaYenile, 1500); },
    kapandi: () => { clearInterval(medyaSayac); medyaSayac = null; },
  });
  centikAyarla();
  globalShortcut.register("Alt+Command+A", ac_kapa);
  pencere.once("ready-to-show", goster);
  yenile();
  zamanla();
});

app.on("second-instance", () => pencere && goster());
app.on("window-all-closed", () => {});
app.on("will-quit", () => globalShortcut.unregisterAll());
