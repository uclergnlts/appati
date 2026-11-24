// Umami (web analitiği): ziyaretçi, sayfa görüntüleme, nereden geldikleri, en çok açılan sayfalar, ülkeler.
// Umami Cloud API anahtarı gerekir (cloud.umami.is > Settings > API keys).
const { gunAnahtari, gunBasi, sonGunler, seri, topla, GUN } = require("../util");

// Sürüme göre { visitors: 12 } ya da { visitors: { value: 12, prev: 9 } } gelebilir.
const sayi = (v) => (v && typeof v === "object" ? Number(v.value) || 0 : Number(v) || 0);

module.exports = async function umami(ayar, gizli, { istek, simdi }) {
  if (!ayar.websiteId) throw new Error("Website ID eksik");
  if (!gizli.apiKey) throw new Error("API anahtarı eksik");
  const taban = String(ayar.host || "https://api.umami.is/v1").trim().replace(/\/+$/, "");
  const baslik = { "x-umami-api-key": gizli.apiKey, Accept: "application/json" };
  const site = `${taban}/websites/${encodeURIComponent(ayar.websiteId)}`;
  const al = (yol, p = {}) => istek(`${site}/${yol}?${new URLSearchParams(p)}`, { headers: baslik });

  const bugun = gunBasi(simdi).getTime();
  const son = simdi.getTime();
  const yedi = bugun - 6 * GUN, oncekiYedi = bugun - 13 * GUN, otuz = bugun - 29 * GUN;
  const dilim = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const [bugunOzet, yediOzet, oncekiOzet, gunluk, aktif] = await Promise.all([
    al("stats", { startAt: bugun, endAt: son }),
    al("stats", { startAt: yedi, endAt: son }),
    al("stats", { startAt: oncekiYedi, endAt: yedi - 1 }),
    al("pageviews", { startAt: otuz, endAt: son, unit: "day", timezone: dilim }),
    al("active").catch(() => null),
  ]);

  const metrik = async (tur) => {
    const r = await al("metrics", { startAt: yedi, endAt: son, type: tur, limit: 12 });
    return (Array.isArray(r) ? r : []).map((s) => ({ ad: s.x, v: Number(s.y) || 0 }));
  };
  const uyarilar = [];
  const guvenli = (soz, ad) => soz.catch((e) => { uyarilar.push(`${ad} okunamadı (${e.message})`); return []; });
  const [kaynak, sayfa, ulke] = await Promise.all([
    guvenli(metrik("referrer"), "Kaynaklar"),
    guvenli(metrik("path").catch(() => metrik("url")), "Sayfalar"),
    guvenli(metrik("country"), "Ülkeler"),
  ]);

  const gunler = sonGunler(simdi, 30);
  const sozluk = (dizi) => Object.fromEntries((dizi || []).map((n) => [gunAnahtari(new Date(String(n.x).replace(" ", "T"))), Number(n.y) || 0]));
  const ziyaretSeri = seri(gunler, sozluk(gunluk.sessions));
  const goruntulemeSeri = seri(gunler, sozluk(gunluk.pageviews));

  return {
    kpi: {
      ziyaretciBugun: sayi(bugunOzet.visitors),
      goruntulemeBugun: sayi(bugunOzet.pageviews),
      ziyaretci7g: sayi(yediOzet.visitors),
      ziyaretciOnceki7g: sayi(oncekiOzet.visitors),
      goruntuleme7g: sayi(yediOzet.pageviews) || topla(goruntulemeSeri, 23, 30),
      sitedeSimdi: aktif ? Number(aktif.visitors ?? aktif.x ?? 0) : undefined,
    },
    seri: { ziyaret: ziyaretSeri, goruntuleme: goruntulemeSeri },
    kaynaklar: kaynak.map((k) => ({ ...k, ad: k.ad || "Doğrudan (adres yazan, yer imi)" })),
    sayfalar: sayfa,
    ulkeler: ulke,
    uyarilar,
  };
};
