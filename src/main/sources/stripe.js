// Stripe: aktif abonelik, deneme, MRR, son 28 günün tahsilatı ve yeni müşteri (RevenueCat'in web karşılığı).
// Kısıtlı (restricted) bir anahtar yeterlidir: Subscriptions, Balance transactions ve Customers için okuma izni.
// MRR, aktif aboneliklerin liste fiyatından hesaplanır; indirim kuponları ve vergiler hesaba katılmaz.
const API = "https://api.stripe.com/v1";
const ONDALIKSIZ = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
const SIMGE = { usd: "$", eur: "€", gbp: "£", try: "₺", jpy: "¥", cad: "CA$", aud: "A$", brl: "R$", inr: "₹" };
const AYLIK = { day: 30.4375, week: 4.348125, month: 1, year: 1 / 12 };

const tutar = (kucukBirim, para) => (ONDALIKSIZ.has(para) ? kucukBirim : kucukBirim / 100);

module.exports = async function stripe(ayar, gizli, { istek, simdi }) {
  if (!gizli.apiKey) throw new Error("API anahtarı eksik");
  const baslik = { Authorization: `Bearer ${gizli.apiKey}` };
  const uyarilar = [];

  // Sayfalı listeyi dolaşır; sinir aşılırsa uyarı ekleyip elindekini döndürür.
  const hepsi = async (yol, parametre, sinir, ne) => {
    const liste = [];
    let sonra = null;
    for (let sayfa = 0; sayfa < sinir; sayfa++) {
      const p = new URLSearchParams({ limit: "100", ...parametre });
      if (sonra) p.set("starting_after", sonra);
      let r;
      try {
        r = await istek(`${API}/${yol}?${p}`, { headers: baslik });
      } catch (e) {
        if (/does not have the required permissions|permission/i.test(String(e.message))) {
          throw new Error(`Stripe anahtarının “${ne}” için okuma izni yok. Stripe > Developers > API keys'te kısıtlı anahtarı düzenleyip Subscriptions, Balance transactions ve Customers için Read ver.`);
        }
        throw e;
      }
      liste.push(...(r.data || []));
      if (!r.has_more || !r.data || !r.data.length) return liste;
      sonra = r.data[r.data.length - 1].id;
    }
    uyarilar.push(`${ne}: ilk ${sinir * 100} kayıt sayıldı; gerçek sayı daha yüksek.`);
    return liste;
  };

  const yirmiSekiz = Math.floor(simdi.getTime() / 1000) - 28 * 86400;
  const [aktif, deneme, tahsilat, musteri] = await Promise.all([
    hepsi("subscriptions", { status: "active" }, 30, "Subscriptions"),
    hepsi("subscriptions", { status: "trialing" }, 10, "Subscriptions"),
    hepsi("balance_transactions", { type: "charge", "created[gte]": String(yirmiSekiz) }, 30, "Balance transactions"),
    hepsi("customers", { "created[gte]": String(yirmiSekiz) }, 30, "Customers"),
  ]);

  // MRR: her abonelik kalemi aylığa çevrilir; para birimleri ayrı toplanır.
  const mrr = {};
  for (const a of aktif) {
    for (const k of (a.items && a.items.data) || []) {
      const f = k.price || k.plan;
      if (!f || !f.recurring && !f.interval) continue;
      const aralik = (f.recurring && f.recurring.interval) || f.interval;
      const adet = (f.recurring && f.recurring.interval_count) || f.interval_count || 1;
      const para = f.currency || a.currency || "usd";
      const birim = f.unit_amount ?? f.amount ?? 0;
      mrr[para] = (mrr[para] || 0) + (tutar(birim, para) * (k.quantity || 1) * (AYLIK[aralik] || 1)) / adet;
    }
  }
  const paralar = Object.entries(mrr).sort((x, y) => y[1] - x[1]);
  const para = (paralar[0] && paralar[0][0]) || (tahsilat[0] && tahsilat[0].currency) || "usd";
  if (paralar.length > 1) uyarilar.push(`Abonelikler birden çok para biriminde; MRR yalnızca ${para.toUpperCase()} olanları gösteriyor.`);

  return {
    kpi: {
      abone: aktif.length,
      deneme: deneme.length,
      mrr: Math.round(mrr[para] || 0),
      gelir28g: Math.round(tahsilat.filter((t) => t.currency === para || !paralar.length).reduce((t, x) => t + tutar(x.amount || 0, x.currency), 0)),
      yeniMusteri28g: musteri.length,
    },
    paraBirimi: SIMGE[para] || `${para.toUpperCase()} `,
    uyarilar,
  };
};
