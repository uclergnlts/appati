// Appati: menü çubuğunda duran, ekranın sağ kenarında açılan panel.
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, nativeTheme, systemPreferences, screen, globalShortcut, shell, safeStorage } = require("electron");
const path = require("node:path");
const { depo } = require("./store");
const { KAYNAKLAR, SABLONLAR } = require("./katalog");
const { uygulamayiTopla, ozetle } = require("./collect");
const { demoUygulamalar } = require("./demo");
const { istekci } = require("./util");

const GENISLIK = 440;
const DEMO = process.env.APPATI_DEMO === "1";
const MAC = process.platform === "darwin";

let pencere = null;
let tepsi = null;
let kayit = null;
let durum = { uygulamalar: [], ozet: null, zaman: null, demo: false, yukleniyor: true };
let suren = null;
let zamanlayici = null;

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
  if (tepsi && MAC) {
    const a = durum.ozet && durum.ozet.kpi.aktifBugun;
    tepsi.setTitle(a === undefined || a === null ? "" : ` ${a.toLocaleString("tr-TR")}`);
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
      kayit.onbellek.kaydet();
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
    if (MAC && app.isPackaged) app.setLoginItemSettings({ openAtLogin: kayit.ayar().genel.acilistaBaslat });
    return paket();
  });
  ipcMain.handle("gizle", () => pencere.hide());
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
  globalShortcut.register("Alt+Command+A", ac_kapa);
  pencere.once("ready-to-show", goster);
  yenile();
  zamanla();
});

app.on("second-instance", () => pencere && goster());
app.on("window-all-closed", () => {});
app.on("will-quit", () => globalShortcut.unregisterAll());
