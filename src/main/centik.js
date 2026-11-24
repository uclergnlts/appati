// Çentik görünümü: fare ekranın üst ortasına (MacBook çentiğine) gelince aşağı doğru açılan küçük özet.
// Çentiksiz ekranda da aynı yerde çalışır. Pencere odak çalmaz; fare uzaklaşınca kapanır.
const { BrowserWindow, screen } = require("electron");
const path = require("node:path");

const EN = 540, BOY = 150;
const BOLGE_EN = 200;   // çentiğin yaklaşık genişliği (pt)
const BOLGE_BOY = 6;    // üst kenardan itibaren tetikleyen şerit

// Saf karar işlevi: sınanabilir. d: { acik, girme, cikma }, olay: imleç ve ekran → yeni durum + eylem.
function adim(d, imlec, ekran, pencere) {
  const merkez = ekran.x + ekran.width / 2;
  const bolgede = Math.abs(imlec.x - merkez) <= BOLGE_EN / 2 && imlec.y >= ekran.y && imlec.y - ekran.y <= BOLGE_BOY;
  if (!d.acik) {
    const girme = bolgede ? d.girme + 1 : 0;
    return girme >= 2 ? { acik: true, girme: 0, cikma: 0, eylem: "ac" } : { acik: false, girme, cikma: 0, eylem: null };
  }
  const p = 14;
  const icinde = imlec.x >= pencere.x - p && imlec.x <= pencere.x + pencere.width + p && imlec.y >= pencere.y && imlec.y <= pencere.y + pencere.height + p;
  const cikma = icinde || bolgede ? 0 : d.cikma + 1;
  return cikma >= 3 ? { acik: false, girme: 0, cikma: 0, eylem: "kapat" } : { acik: true, girme: 0, cikma, eylem: null };
}

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
  let sayac = null, gizleme = null;

  // Çentik dahili ekrandadır; dahili ekran yoksa birincil ekranın üst ortası kullanılır.
  const ekranBul = () => (screen.getAllDisplays().find((e) => e.internal) || screen.getPrimaryDisplay()).bounds;

  function kapat() {
    d = { acik: false, girme: 0, cikma: 0 };
    if (pencere.isDestroyed()) return;
    pencere.webContents.send("centik", { acik: false });
    clearTimeout(gizleme);
    gizleme = setTimeout(() => { if (!d.acik && !pencere.isDestroyed()) pencere.hide(); }, 240);
    kapandi();
  }

  function tik() {
    if (pencere.isDestroyed()) return;
    const ekran = ekranBul();
    const sonuc = adim(d, screen.getCursorScreenPoint(), ekran, pencere.getBounds());
    d = { acik: sonuc.acik, girme: sonuc.girme, cikma: sonuc.cikma };
    if (sonuc.eylem === "ac") {
      clearTimeout(gizleme);
      pencere.setBounds({ x: Math.round(ekran.x + ekran.width / 2 - EN / 2), y: ekran.y, width: EN, height: BOY });
      pencere.showInactive();
      pencere.webContents.send("centik", { acik: true, ...veriAl() });
      acildi();
    } else if (sonuc.eylem === "kapat") kapat();
  }

  return {
    pencere,
    acik: () => d.acik,
    kapat,
    gonder: (veri) => { if (d.acik && !pencere.isDestroyed()) pencere.webContents.send("centik", { acik: true, ...veri }); },
    baslat() { clearInterval(sayac); sayac = setInterval(tik, 150); },
    durdur() { clearInterval(sayac); sayac = null; if (d.acik) kapat(); },
  };
}

module.exports = { centikKur, adim, EN, BOY };
