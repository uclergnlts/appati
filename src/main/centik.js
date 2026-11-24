// Çentik görünümü: fare ekranın üst ortasına (MacBook çentiğine) gelince aşağı doğru açılan küçük özet.
// Bir şey çalarken kapalıyken de çentiğin iki yanında küçük bir ada kalır: solda kapak, sağda ses çubukları.
// Çentiksiz ekranda da aynı yerde çalışır. Pencere odak çalmaz; fare uzaklaşınca kapanır.
const { BrowserWindow, screen } = require("electron");
const path = require("node:path");

const EN = 540, BOY = 150;
const KUCUK_EN = 310;   // çalarken görünen küçük ada: çentik + iki yanda birer "kulak"
const BOLGE_EN = 200;   // çentiğin yaklaşık genişliği (pt)
const BOLGE_BOY = 6;    // üst kenardan itibaren tetikleyen şerit

// Saf karar işlevi: sınanabilir. d: { acik, girme, cikma } + imleç, ekran, pencere → yeni durum + eylem.
// bolge: tetikleyen alanın boyutu; küçük ada görünürken adanın tamamıdır.
function adim(d, imlec, ekran, pencere, bolge = { en: BOLGE_EN, boy: BOLGE_BOY }) {
  const merkez = ekran.x + ekran.width / 2;
  const bolgede = Math.abs(imlec.x - merkez) <= bolge.en / 2 && imlec.y >= ekran.y && imlec.y - ekran.y <= bolge.boy;
  if (!d.acik) {
    const girme = bolgede ? d.girme + 1 : 0;
    return girme >= 2 ? { acik: true, girme: 0, cikma: 0, eylem: "ac" } : { acik: false, girme, cikma: 0, eylem: null };
  }
  const p = 14;
  const icinde = imlec.x >= pencere.x - p && imlec.x <= pencere.x + pencere.width + p && imlec.y >= pencere.y && imlec.y <= pencere.y + pencere.height + p;
  const cikma = icinde || bolgede ? 0 : d.cikma + 1;
  return cikma >= 3 ? { acik: false, girme: 0, cikma: 0, eylem: "kapat" } : { acik: true, girme: 0, cikma, eylem: null };
}

// Küçük adanın yüksekliği menü çubuğununki kadardır (çentikli ekranda çentik yüksekliği).
const kucukBoy = (menuCubugu) => Math.min(40, Math.max(24, Math.round(menuCubugu) || 24));

function centikKur({ veriAl, acildi, kapandi }) {
  const pencere = new BrowserWindow({
    width: EN, height: BOY, show: false, frame: false, transparent: true, resizable: false, movable: false,
    minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, hasShadow: false,
    focusable: false, acceptFirstMouse: true, type: "panel", backgroundColor: "#00000000",
    enableLargerThanScreen: true, // pencere menü çubuğunun üstüne, ekranın en tepesine yerleşebilsin
    webPreferences: { preload: path.join(__dirname, "..", "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  pencere.setAlwaysOnTop(true, "screen-saver");
  pencere.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pencere.loadFile(path.join(__dirname, "..", "renderer", "centik.html"));
  pencere.webContents.on("will-navigate", (o) => o.preventDefault());
  pencere.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  let d = { acik: false, girme: 0, cikma: 0 };
  let sayac = null, gizleme = null, kucukGorunur = false, calisiyor = false, kapaniyor = false;

  // Çentik dahili ekrandadır; dahili ekran yoksa birincil ekranın üst ortası kullanılır.
  function olcu() {
    const e = screen.getAllDisplays().find((x) => x.internal) || screen.getPrimaryDisplay();
    return { ekran: e.bounds, kb: kucukBoy(e.workArea.y - e.bounds.y) };
  }

  function paket(acik) {
    const veri = veriAl();
    const caliyor = Boolean(veri.medya && veri.medya.oynuyor === true);
    return { acik, kb: olcu().kb, kucuk: caliyor ? { kapak: veri.medya.kapak, kaynak: veri.medya.kaynak } : null, ...veri };
  }

  // Kapalı hâl: bir şey çalıyorsa küçük ada görünür, çalmıyorsa pencere gizlenir.
  function dinlen() {
    if (d.acik || pencere.isDestroyed()) return;
    const p = paket(false);
    if (p.kucuk && calisiyor) {
      const { ekran, kb } = olcu();
      pencere.setBounds({ x: Math.round(ekran.x + ekran.width / 2 - KUCUK_EN / 2), y: ekran.y, width: KUCUK_EN, height: kb });
      if (!pencere.isVisible()) pencere.showInactive();
      kucukGorunur = true;
    } else {
      if (pencere.isVisible()) pencere.hide();
      kucukGorunur = false;
    }
    pencere.webContents.send("centik", p);
  }

  function kapat(zorla) {
    if (!d.acik && !zorla) return;
    d = { acik: false, girme: 0, cikma: 0 };
    if (pencere.isDestroyed()) return;
    pencere.webContents.send("centik", paket(false)); // kapanma canlandırması başlar
    clearTimeout(gizleme);
    kapaniyor = true; // canlandırma bitene kadar pencere küçültülmez
    gizleme = setTimeout(() => { kapaniyor = false; dinlen(); }, 240);
    kapandi();
  }

  function tik() {
    if (pencere.isDestroyed()) return;
    const { ekran, kb } = olcu();
    const bolge = kucukGorunur ? { en: KUCUK_EN, boy: kb } : undefined;
    const sonuc = adim(d, screen.getCursorScreenPoint(), ekran, pencere.getBounds(), bolge);
    d = { acik: sonuc.acik, girme: sonuc.girme, cikma: sonuc.cikma };
    if (sonuc.eylem === "ac") {
      clearTimeout(gizleme);
      kapaniyor = false;
      pencere.setBounds({ x: Math.round(ekran.x + ekran.width / 2 - EN / 2), y: ekran.y, width: EN, height: BOY });
      if (!pencere.isVisible()) pencere.showInactive();
      pencere.webContents.send("centik", paket(true));
      acildi();
    } else if (sonuc.eylem === "kapat") kapat(true);
  }

  // Sayfa yüklenmeden gönderilen ilk veri kaybolur; yüklenince bir kez daha gönder.
  pencere.webContents.on("did-finish-load", () => { if (calisiyor && !d.acik && !kapaniyor) dinlen(); });

  return {
    pencere,
    acik: () => d.acik,
    kapat: () => kapat(false),
    // Veri değişti (yeni rakamlar, yeni şarkı, duraklatıldı): açık adayı ya da küçük adayı güncelle.
    guncelle() {
      if (pencere.isDestroyed() || !calisiyor) return;
      if (d.acik) pencere.webContents.send("centik", paket(true)); else if (!kapaniyor) dinlen();
    },
    baslat() { calisiyor = true; clearInterval(sayac); sayac = setInterval(tik, 150); },
    durdur() {
      calisiyor = false; clearInterval(sayac); sayac = null; clearTimeout(gizleme); kapaniyor = false;
      const acikti = d.acik;
      d = { acik: false, girme: 0, cikma: 0 }; kucukGorunur = false;
      if (!pencere.isDestroyed()) pencere.hide();
      if (acikti) kapandi();
    },
  };
}

module.exports = { centikKur, adim, kucukBoy, EN, BOY, KUCUK_EN };
