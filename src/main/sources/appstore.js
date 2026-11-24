// App Store Connect: yorumlar ve günlük ilk indirme sayısı (satış raporlarından).
// Gerekli: Issuer ID, Key ID, .p8 anahtarı. İndirme sayısı için ayrıca Vendor Number ve "Sales" yetkili anahtar.
const zlib = require("node:zlib");
const { jwtImzala, sonGunler, seri, topla, GUN } = require("../util");

// İlk indirme sayılan ürün türleri (Apple "Product Type Identifier"): uygulama, evrensel, iPad, Mac.
const INDIRME = new Set(["1", "1F", "1T", "F1"]);

function belirtec(ayar, p8, simdi) {
  const iat = Math.floor(simdi.getTime() / 1000);
  return jwtImzala("ES256", { kid: ayar.keyId }, { iss: ayar.issuerId, iat, exp: iat + 900, aud: "appstoreconnect-v1" }, p8);
}

// Sıkıştırılmış satış raporundan (TSV) bu uygulamanın ilk indirme sayısını çıkarır.
function raporuOku(tampon, appId) {
  const metin = zlib.gunzipSync(tampon).toString("utf8");
  const [ilk, ...satirlar] = metin.split(/\r?\n/).filter(Boolean);
  const sutun = ilk.split("\t").map((s) => s.trim());
  const i = { tur: sutun.indexOf("Product Type Identifier"), adet: sutun.indexOf("Units"), kimlik: sutun.indexOf("Apple Identifier") };
  if (i.tur < 0 || i.adet < 0 || i.kimlik < 0) throw new Error("Satış raporu biçimi tanınmadı");
  let adet = 0;
  for (const s of satirlar) {
    const h = s.split("\t");
    if (String(h[i.kimlik]).trim() === String(appId) && INDIRME.has(String(h[i.tur]).trim())) adet += Number(h[i.adet]) || 0;
  }
  return adet;
}

async function appstore(ayar, gizli, { istek, simdi, onbellek }) {
  for (const [alan, ad] of [["appId", "Apple ID"], ["issuerId", "Issuer ID"], ["keyId", "Key ID"]]) {
    if (!ayar[alan]) throw new Error(`${ad} eksik`);
  }
  if (!gizli.p8) throw new Error(".p8 anahtarı eksik");
  const baslik = { Authorization: `Bearer ${belirtec(ayar, gizli.p8, simdi)}` };
  const api = "https://api.appstoreconnect.apple.com/v1";
  const sonuc = { kpi: {}, seri: {}, yorumlar: [], uyarilar: [] };

  const y = await istek(`${api}/apps/${encodeURIComponent(ayar.appId)}/customerReviews?sort=-createdDate&limit=30`, { headers: baslik });
  sonuc.yorumlar = (y.data || []).map((d) => ({
    magaza: "App Store",
    puan: d.attributes.rating,
    baslik: d.attributes.title || "",
    metin: d.attributes.body || "",
    yazan: d.attributes.reviewerNickname || "",
    ulke: d.attributes.territory || "",
    tarih: d.attributes.createdDate,
  }));

  if (ayar.vendorNumber) {
    // Raporlar bir-iki gün gecikmeli gelir; kesinleşen günler bir daha indirilmez.
    const gunler = sonGunler(new Date(simdi.getTime() - GUN), 30);
    const taze = new Set(gunler.slice(-9));
    const adetler = {};
    let hata = null;
    for (const g of gunler) {
      const anahtar = `appstore.${ayar.appId}.${g}`;
      const eski = onbellek.al(anahtar);
      if (eski !== undefined) { adetler[g] = eski; continue; }
      if (!taze.has(g)) continue;
      const p = new URLSearchParams({
        "filter[frequency]": "DAILY", "filter[reportType]": "SALES", "filter[reportSubType]": "SUMMARY",
        "filter[vendorNumber]": ayar.vendorNumber, "filter[reportDate]": g, "filter[version]": "1_0",
      });
      const yanit = await istek(`${api}/salesReports?${p}`, { headers: { ...baslik, Accept: "application/a-gzip" } }, "yanit");
      if (yanit.status === 404) continue; // o gün için rapor henüz yok ya da satış olmadı
      if (!yanit.ok) { hata = `HTTP ${yanit.status}`; break; }
      adetler[g] = raporuOku(Buffer.from(await yanit.arrayBuffer()), ayar.appId);
      onbellek.yaz(anahtar, adetler[g]);
    }
    if (hata) sonuc.uyarilar.push(`İndirme raporu okunamadı (${hata}). Anahtarın "Sales" yetkisi ve Vendor Number doğru mu?`);
    const s = seri(gunler, adetler);
    sonuc.seri.kurulumIos = s;
    sonuc.kpi.kurulumIos7g = topla(s, 23, 30);
    sonuc.kpi.kurulumIosOnceki7g = topla(s, 16, 23);
    sonuc.kurulumSonGun = [...gunler].reverse().find((g) => adetler[g] !== undefined) || null;
  }
  return sonuc;
}

module.exports = appstore;
module.exports.raporuOku = raporuOku;
