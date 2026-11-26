// Plausible (web analitiği): ziyaretçi, sayfa görüntüleme, nereden geldikleri, sayfalar, ülkeler.
// Umami ve Google Analytics'in karşılığıdır. Stats API anahtarı gerekir (Plausible > Account settings > API keys).
// Kendi sunucundaki Plausible için adres alanını doldur.
const { gunAnahtari, sonGunler, seri, GUN } = require("../util");

module.exports = async function plausible(ayar, gizli, { istek, simdi }) {
  const site = String(ayar.siteId || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!site) throw new Error("Site alan adı eksik");
  if (!gizli.apiKey) throw new Error("API anahtarı eksik");
  const taban = String(ayar.host || "https://plausible.io").trim().replace(/\/+$/, "");
  const baslik = { Authorization: `Bearer ${gizli.apiKey}`, "Content-Type": "application/json" };

  const sor = async (govde) => {
    try {
      const r = await istek(`${taban}/api/v2/query`, { method: "POST", headers: baslik, body: JSON.stringify({ site_id: site, ...govde }) });
      return r.results || [];
    } catch (e) {
      if (e.durum === 401) throw new Error("Plausible API anahtarı geçersiz ya da bu siteye erişimi yok. Plausible > Account settings > API keys'ten Stats API anahtarı oluştur.");
      if (e.durum === 404) throw new Error(`Plausible'da “${site}” diye bir site bulunamadı. Alan adını Plausible'da göründüğü gibi yaz.`);
      throw e;
    }
  };
  const gun = (n) => gunAnahtari(new Date(simdi.getTime() - n * GUN));
  const ilk = (r, i) => Number(((r[0] || {}).metrics || [])[i]) || 0;
  const liste = (r) => r.map((s) => ({ ad: String(s.dimensions[0] || ""), v: Number(s.metrics[0]) || 0 })).filter((x) => x.v > 0);
  const sirali = (boyut, metrik) => sor({ metrics: [metrik], date_range: "7d", dimensions: [boyut], order_by: [[metrik, "desc"]], pagination: { limit: 12 } });

  const uyarilar = [];
  const guvenli = (soz, ad) => soz.catch((e) => { uyarilar.push(`${ad} okunamadı (${e.message})`); return []; });
  const [bugun, yedi, onceki, gunluk] = await Promise.all([
    sor({ metrics: ["visitors", "pageviews"], date_range: "day" }),
    sor({ metrics: ["visitors", "pageviews"], date_range: "7d" }),
    sor({ metrics: ["visitors"], date_range: [gun(13), gun(7)] }),
    sor({ metrics: ["visitors", "pageviews"], date_range: "30d", dimensions: ["time:day"] }),
  ]);
  const [kaynak, sayfa, ulke, canli] = await Promise.all([
    guvenli(sirali("visit:source", "visitors"), "Kaynaklar"),
    guvenli(sirali("event:page", "pageviews"), "Sayfalar"),
    guvenli(sirali("visit:country", "visitors"), "Ülkeler"),
    istek(`${taban}/api/v1/stats/realtime/visitors?site_id=${encodeURIComponent(site)}`, { headers: baslik }).catch(() => null),
  ]);

  const gunler = sonGunler(simdi, 30);
  const ziyaret = {}, goruntuleme = {};
  for (const s of gunluk) { const g = String(s.dimensions[0]).slice(0, 10); ziyaret[g] = Number(s.metrics[0]) || 0; goruntuleme[g] = Number(s.metrics[1]) || 0; }

  return {
    kpi: {
      ziyaretciBugun: ilk(bugun, 0), goruntulemeBugun: ilk(bugun, 1),
      ziyaretci7g: ilk(yedi, 0), goruntuleme7g: ilk(yedi, 1), ziyaretciOnceki7g: ilk(onceki, 0),
      sitedeSimdi: typeof canli === "number" ? canli : undefined,
    },
    seri: { ziyaret: seri(gunler, ziyaret), goruntuleme: seri(gunler, goruntuleme) },
    kaynaklar: liste(kaynak).map((k) => ({ ...k, ad: /^direct/i.test(k.ad) || !k.ad ? "Doğrudan (adres yazan, yer imi)" : k.ad })),
    sayfalar: liste(sayfa),
    ulkeler: liste(ulke),
    uyarilar,
  };
};
