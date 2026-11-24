// Arayüzü Electron olmadan, örnek veriyle tarayıcıda açıp ekran görüntüsü alır: npm run preview
// Çıktı: preview/*.png
const { chromium } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");
const { demoUygulamalar } = require("../src/main/demo");
const { ozetle } = require("../src/main/collect");
const { KAYNAKLAR, SABLONLAR } = require("../src/main/katalog");

(async () => {
  const simdi = new Date();
  const uygulamalar = demoUygulamalar(simdi);
  const paket = {
    durum: { uygulamalar, ozet: ozetle(uygulamalar), zaman: simdi.toISOString(), demo: true, yukleniyor: false },
    ayar: { genel: { yenilemeDk: 15, sabit: false, acilistaBaslat: false }, uygulamalar: [] },
    katalog: KAYNAKLAR, sablonlar: SABLONLAR, surum: "önizleme",
  };
  const cikti = path.join(__dirname, "..", "preview");
  fs.mkdirSync(cikti, { recursive: true });
  const tarayici = await chromium.launch();
  const hatalar = [];
  const cek = async (ad, gorunum, sonra) => {
    const sayfa = await tarayici.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 });
    sayfa.on("pageerror", (e) => hatalar.push(`${ad}: ${e.message}`));
    sayfa.on("console", (m) => { if (m.type() === "error") hatalar.push(`${ad}: ${m.text()}`); });
    await sayfa.addInitScript(([p, g]) => { window.__ONIZLEME__ = p; window.__GORUNUM__ = g; }, [paket, gorunum]);
    await sayfa.goto(`file://${path.join(__dirname, "..", "src", "renderer", "index.html")}`);
    await sayfa.waitForSelector(".govde");
    if (sonra) await sonra(sayfa);
    await sayfa.screenshot({ path: path.join(cikti, `${ad}.png`) });
    await sayfa.close();
  };
  await cek("1-genel", { ad: "genel" });
  await cek("2-genel-alt", { ad: "genel" }, (s) => s.evaluate(() => { document.querySelector(".govde").scrollTop = 9999; }));
  for (const sekme of ["ozet", "kullanici", "gelir", "yorum", "kaynak"]) await cek(`3-${sekme}`, { ad: "uyg", id: "demo-1", sekme });
  await cek("4-ayarlar", { ad: "ayar" });
  await cek("5-form", { ad: "ayar" }, async (s) => { await s.click("text=ucler. şablonuyla ekle"); await s.waitForSelector("details"); });
  await cek("6-ipucu", { ad: "uyg", id: "demo-1", sekme: "kullanici" }, async (s) => { await s.mouse.move(250, 200); });
  await tarayici.close();
  if (hatalar.length) { console.error(hatalar.join("\n")); process.exit(1); }
  console.log("Sayfa hatası yok. Görüntüler:", cikti);
})();
