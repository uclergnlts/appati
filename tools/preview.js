// Arayüzü Electron olmadan, örnek veriyle tarayıcıda açıp ekran görüntüsü alır: npm run preview
// Çıktı: preview/*.png
const { chromium } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");
const { demoUygulamalar } = require("../src/main/demo");
const { ozetle } = require("../src/main/collect");
const { KAYNAKLAR, SABLONLAR } = require("../src/main/katalog");

(async () => {
  // Örnek verideki sayı ve tarihler de seçilen dille biçimlensin diye dil, veri üretilmeden önce kurulur.
  require("../src/main/dil").kur(process.env.PREVIEW_DIL || "tr", process.env.PREVIEW_DIL || "tr");
  const simdi = new Date();
  const uygulamalar = demoUygulamalar(simdi);
  // PREVIEW_DIL=en|es|ar verilirse arayüz o dilde çizilir ve sözlükte karşılığı olmayan metinler listelenir.
  const dilKod = process.env.PREVIEW_DIL || "tr";
  const { DILLER } = require("../src/ortak/ceviri");
  const sozluk = dilKod === "tr" ? {} : JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "ortak", "diller", `${dilKod}.json`), "utf8"));
  const dilPaketi = { kod: dilKod, yerel: DILLER[dilKod].yerel, yon: DILLER[dilKod].yon, sozluk };
  const eksikler = new Set();
  const paket = {
    dil: dilPaketi,
    durum: { uygulamalar, ozet: ozetle(uygulamalar), zaman: simdi.toISOString(), demo: true, yukleniyor: false },
    ayar: { genel: { yenilemeDk: 15, sabit: false, acilistaBaslat: false, tema: "sistem", saydamlik: 60, bildirim: true, cubukSayi: "aktifBugun", centik: true, medya: true, centikEn: 300, centikBoy: 32, centikSaydamlik: 0, otoGuncelle: true }, uygulamalar: [] },
    katalog: KAYNAKLAR, sablonlar: SABLONLAR, surum: "önizleme", vurgu: null, guncelleme: { durum: "hazir", surum: "0.2.1" },
  };
  const cikti = path.join(__dirname, "..", "preview", dilKod === "tr" ? "" : dilKod);
  fs.mkdirSync(cikti, { recursive: true });
  const tarayici = await chromium.launch();
  const hatalar = [];
  const cek = async (ad, gorunum, sonra, tema = "dark") => {
    const sayfa = await tarayici.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2, colorScheme: tema });
    sayfa.on("pageerror", (e) => hatalar.push(`${ad}: ${e.message}`));
    sayfa.on("console", (m) => { if (m.type() === "error") hatalar.push(`${ad}: ${m.text()}`); });
    await sayfa.addInitScript(([p, g]) => { window.__ONIZLEME__ = p; window.__GORUNUM__ = g; }, [paket, gorunum]);
    await sayfa.goto(`file://${path.join(__dirname, "..", "src", "renderer", "index.html")}`);
    await sayfa.waitForSelector(".govde");
    if (sonra) await sonra(sayfa);
    const yazi = await sayfa.evaluate(() => document.body.innerText);
    if (/\b(null|undefined|NaN)\b/.test(yazi)) hatalar.push(`${ad}: arayüzde ham değer görünüyor`);
    for (const m of await sayfa.evaluate(() => [...(window.__EKSIK__ || [])])) eksikler.add(m);
    await sayfa.screenshot({ path: path.join(cikti, `${ad}.png`) });
    await sayfa.close();
  };
  await cek("1-genel", { ad: "genel" });
  await cek("2-genel-alt", { ad: "genel" }, (s) => s.evaluate(() => { document.querySelector(".govde").scrollTop = 9999; }));
  for (const sekme of ["ozet", "kullanici", "arama", "youtube", "gelir", "yorum", "kaynak"]) await cek(`3-${sekme}`, { ad: "uyg", id: "demo-1", sekme });
  await cek("3-ozet-alt", { ad: "uyg", id: "demo-1", sekme: "ozet" }, (s) => s.evaluate(() => { document.querySelector(".govde").scrollTop = 9999; }));
  await cek("4-ayarlar", { ad: "ayar" });
  await cek("5-form", { ad: "ayar" }, async (s) => { await s.click(".eylem .btn:not(.ana)"); /* şablon düğmesi; metni dile göre değişir */ await s.waitForSelector("details"); });
  await cek("6-ipucu", { ad: "uyg", id: "demo-1", sekme: "kullanici" }, async (s) => { await s.mouse.move(250, 200); });
  await cek("7-acik-genel", { ad: "genel" }, null, "light");
  await cek("7-acik-kullanici", { ad: "uyg", id: "demo-1", sekme: "kullanici" }, null, "light");
  await cek("7-acik-ayarlar", { ad: "ayar" }, null, "light");
  // Eksik verili durumlar: kaynağı olmayan, yalnızca Supabase'i olan ve kaynağı bozuk uygulamalar; ayrıca boş liste.
  const { notlar } = require("../src/main/collect");
  const bos = (ek) => ({ renk: "#3987e5", demo: false, kaynaklar: [], kpi: {}, seri: {}, trafik: [], sayfalar: [], ulkeler: [], yorumlar: [], sayaclar: [], huni: [], olaylar: [], olayListeleri: [], siteHunisi: [], haftalik: [], arama: null, youtube: null, paraBirimi: "$", ...ek });
  const seyrek = [
    bos({ id: "s1", ad: "Kaynaksız" }),
    bos({ id: "s2", ad: "Yalnız Supabase", kaynaklar: [{ tur: "supabase", ad: "Supabase", tamam: true, hata: null, uyarilar: ["Sayaç \"x\" okunamadı (HTTP 404)"] }],
      kpi: { kayitli: 21, yeniKayitBugun: 0, yeniKayit7g: 0, yeniKayitOnceki7g: 0, aktifBugun: 1, aktif7g: 1 },
      seri: { kayit: uygulamalar[0].seri.kayit.map((n) => ({ g: n.g, v: 0 })), aktif: uygulamalar[0].seri.aktif.map((n, i) => ({ g: n.g, v: i === 29 ? 1 : 0 })) }, aktifGecmisGun: 1,
      huni: [{ etiket: "Kayıt olan", deger: 0 }, { etiket: "Eşitlenen", deger: 0 }] }),
    bos({ id: "s3", ad: "Bozuk", kaynaklar: [{ tur: "ganalytics", ad: "Google Analytics", tamam: false, hata: "Anahtar reddedildi: {\"error\":\"Unauthorized\"}", uyarilar: [] }] }),
  ];
  for (const u of seyrek) u.notlar = notlar(u);
  const asil = paket.durum;
  paket.durum = { uygulamalar: seyrek, ozet: ozetle(seyrek), zaman: simdi.toISOString(), demo: false, yukleniyor: false, hata: "İnternete bağlanılamadı; son okunan rakamlar gösteriliyor." };
  await cek("9-seyrek-genel", { ad: "genel" });
  for (const id of ["s1", "s2", "s3"]) for (const sekme of ["ozet", "kullanici", "arama", "youtube", "gelir", "yorum", "kaynak"]) await cek(`9-seyrek-${id}-${sekme}`, { ad: "uyg", id, sekme });
  paket.durum = { uygulamalar: [], ozet: null, zaman: null, demo: false, yukleniyor: true };
  await cek("9-bos-yukleniyor", { ad: "genel" });
  await cek("9-silinmis-uygulama", { ad: "uyg", id: "yok", sekme: "ozet" });
  paket.durum = asil;

  // Çentik adası: çalan şarkıyla ve boşken.
  const centik = async (ad, veri) => {
    const sayfa = await tarayici.newPage({ viewport: { width: 540, height: 150 }, deviceScaleFactor: 2 });
    sayfa.on("pageerror", (e) => hatalar.push(`${ad}: ${e.message}`));
    sayfa.on("console", (m) => { if (m.type() === "error") hatalar.push(`${ad}: ${m.text()}`); });
    await sayfa.addInitScript(([v, d]) => { window.__CENTIK__ = v; window.__DIL__ = d; }, [veri, dilPaketi]);
    await sayfa.goto(`file://${path.join(__dirname, "..", "src", "renderer", "centik.html")}`);
    await sayfa.waitForTimeout(400);
    const yazi = await sayfa.evaluate(() => document.body.innerText);
    if (/\b(null|undefined|NaN)\b/.test(yazi)) hatalar.push(`${ad}: arayüzde ham değer görünüyor: ${yazi.replace(/\s+/g, " ")}`);
    await sayfa.screenshot({ path: path.join(cikti, `${ad}.png`) });
    await sayfa.close();
  };
  const rakamlar = [{ etiket: "aktif bugün", deger: "299" }, { etiket: "ziyaretçi", deger: "413" }, { etiket: "yeni kayıt", deger: "31" }];
  const calan = { kaynak: "spotify", oynuyor: true, baslik: "Örnek Şarkı Adı (Uzun Sürüm)", alt: "Örnek Sanatçı", kapak: null };
  await centik("8-centik-kucuk", { acik: false, kb: 32, en: 300, alfa: 1, kucuk: { kaynak: "spotify", kapak: null }, rakamlar, demo: false, medyaAcik: true, medya: calan });
  await centik("8-centik-kucuk-saydam", { acik: false, kb: 40, en: 380, alfa: 0.5, kucuk: { kaynak: "spotify", kapak: null }, rakamlar, demo: false, medyaAcik: true, medya: calan });
  await centik("8-centik-calan", { acik: true, kb: 32, en: 300, alfa: 1, kucuk: { kaynak: "spotify", kapak: null }, rakamlar, demo: false, medyaAcik: true, medya: { kaynak: "spotify", oynuyor: true, baslik: "Örnek Şarkı Adı (Uzun Sürüm)", alt: "Örnek Sanatçı", kapak: null } });
  await centik("8-centik-youtube", { acik: true, kb: 24, kucuk: null, rakamlar: [], demo: false, medyaAcik: true, medya: { kaynak: "youtube", tarayici: "Safari", oynuyor: null, baslik: "Mol kavramı", alt: "YouTube · Safari", kapak: null } });
  await centik("8-centik-medyasiz", { acik: true, kb: 38, kucuk: null, rakamlar, demo: false, medyaAcik: false, medya: null });
  await centik("8-centik-bos", { acik: true, kb: 38, kucuk: null, rakamlar, demo: true, medyaAcik: true, medya: null });
  await tarayici.close();
  if (dilKod !== "tr") fs.writeFileSync(path.join(cikti, `eksik-${dilKod}.json`), JSON.stringify([...eksikler].sort(), null, 1));
  if (hatalar.length) { console.error(hatalar.join("\n")); process.exit(1); }
  console.log("Sayfa hatası yok. Görüntüler:", cikti);
})();
