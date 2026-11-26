// Umami (web analitiği): ziyaretçi, sayfa görüntüleme, nereden geldikleri, en çok açılan sayfalar, ülkeler.
// Ücretli API anahtarı yerine sitenin "paylaşım bağlantısı" (Share URL) kullanılır: Umami'de site ayarlarından
// açılır, ücretsizdir. Bu, Umami'nin kendi paylaşım sayfasının kullandığı uçtur; belgelenmiş bir API değildir,
// Umami değiştirirse bu okuyucunun güncellenmesi gerekir.
const { gunBasi, sonGunler, seri, topla, GUN } = require("../util");

// Sürüme göre { visitors: 12 } ya da { visitors: { value: 12, prev: 9 } } gelebilir.
const sayi = (v) => (v && typeof v === "object" ? Number(v.value) || 0 : Number(v) || 0);

// "https://cloud.umami.is/share/AbC123/ucler.app" ya da yalnızca "AbC123" → { kimlik, tabanlar }
function baglantiCoz(girdi) {
  const metin = String(girdi || "").trim();
  const e = /\/share\/([A-Za-z0-9_-]{6,64})/.exec(metin);
  const kimlik = e ? e[1] : /^[A-Za-z0-9_-]{6,64}$/.test(metin) ? metin : null;
  if (!kimlik) throw new Error("Paylaşım bağlantısı tanınmadı. Umami'de sitenin ayarlarından Share URL'yi açıp bağlantının tamamını yapıştır.");
  let kok = "https://cloud.umami.is";
  try { if (/^https:\/\//.test(metin)) kok = new URL(metin).origin; } catch {}
  // Umami Cloud veriyi bölgeye göre tutar (AB / ABD); kendi sunucunda tek adres vardır.
  const bulut = /(^|\.)umami\.is$/.test(new URL(kok).hostname);
  return { kimlik, tabanlar: bulut ? ["https://cloud.umami.is/analytics/eu/api", "https://cloud.umami.is/analytics/us/api"] : [`${kok}/api`] };
}

async function umami(ayar, gizli, { istek, simdi, onbellek }) {
  if (!gizli.paylasim) throw new Error("Paylaşım bağlantısı eksik");
  const { kimlik, tabanlar } = baglantiCoz(gizli.paylasim);

  const bugun = gunBasi(simdi).getTime();
  const son = simdi.getTime();
  const yedi = bugun - 6 * GUN, oncekiYedi = bugun - 13 * GUN, otuz = bugun - 29 * GUN;
  const dilim = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  // Doğru bölgeyi bul: paylaşım kaydı iki bölgede de dönebilir, ama veri yalnızca birinde okunur.
  const hatirlanan = onbellek.al(`umami.bolge.${kimlik}`);
  const sira = hatirlanan && tabanlar.includes(hatirlanan) ? [hatirlanan, ...tabanlar.filter((t) => t !== hatirlanan)] : tabanlar;
  let al = null, bugunOzet = null, sonHata = null;
  for (const taban of sira) {
    try {
      const p = await istek(`${taban}/share/${kimlik}`, { headers: { Accept: "application/json" } });
      if (!p || !p.token || !p.websiteId) throw new Error("Paylaşım bilgisi eksik döndü");
      const baslik = { "x-umami-share-token": p.token, "x-umami-share-context": "1", Accept: "application/json" };
      const sor = (yol, par = {}) => istek(`${taban}/websites/${encodeURIComponent(p.websiteId)}/${yol}?${new URLSearchParams(par)}`, { headers: baslik });
      bugunOzet = await sor("stats", { startAt: bugun, endAt: son });
      al = sor;
      onbellek.yaz(`umami.bolge.${kimlik}`, taban);
      break;
    } catch (e) {
      sonHata = e;
    }
  }
  if (!al) {
    if (sonHata && sonHata.durum === 404) throw new Error("Bu paylaşım bağlantısı bulunamadı. Umami'de Share URL'nin açık olduğunu ve bağlantının güncel olduğunu kontrol et.");
    throw sonHata || new Error("Umami okunamadı");
  }

  const [yediOzet, oncekiOzet, gunluk, aktif] = await Promise.all([
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

  // Olaylar (son 30 gün): hangi olay kaç kez gönderildi; ayarda istenirse bir olayın bir özelliğine göre döküm
  // (ör. "anlamadim" olayının "kart" özelliği → en çok anlaşılmayan kartlar).
  const otuzGun = { startAt: otuz, endAt: son };
  const tumOlaylar = await guvenli(
    al("metrics", { ...otuzGun, type: "event", limit: 100 }).then((r) => (Array.isArray(r) ? r : []).map((s) => ({ ad: s.x, v: Number(s.y) || 0 }))), "Olaylar");
  const olaylar = tumOlaylar.slice(0, 15);

  // Site hunisi (son 30 gün): ilk adım siteye gelen tekil ziyaretçi, sonrakiler ayarda yazılan olayların sayısı.
  let siteHunisi = [];
  const adimlar = (ayar.huniAdimlari || []).filter((x) => x.olay);
  if (adimlar.length) {
    try {
      const otuzOzet = await al("stats", otuzGun);
      const say = Object.fromEntries(tumOlaylar.map((o) => [o.ad, o.v]));
      siteHunisi = [{ etiket: "Siteye gelen", deger: sayi(otuzOzet.visitors) }, ...adimlar.map((x) => ({ etiket: x.etiket || x.olay, deger: say[x.olay] || 0 }))];
    } catch (e) {
      uyarilar.push(`Site hunisi okunamadı (${e.message})`);
    }
  }
  const olayListeleri = [];
  for (const t of ayar.olayDokumleri || []) {
    if (!t.olay || !t.ozellik) continue;
    try {
      const r = await al("event-data/values", { ...otuzGun, eventName: t.olay, propertyName: t.ozellik });
      olayListeleri.push({ etiket: t.etiket || `${t.olay} · ${t.ozellik}`,
        ogeler: (Array.isArray(r) ? r : []).map((s) => ({ ad: String(s.value), v: Number(s.total) || 0 })).sort((a, b) => b.v - a.v).slice(0, 12) });
    } catch (e) {
      uyarilar.push(`“${t.etiket || t.olay}” dökümü okunamadı (${e.message})`);
    }
  }

  // Günlük seri istenen saat diliminde gelir; tarih kısmı (YYYY-AA-GG) doğrudan gün anahtarıdır.
  const gunler = sonGunler(simdi, 30);
  const sozluk = (dizi) => Object.fromEntries((dizi || []).map((n) => [String(n.x).slice(0, 10), Number(n.y) || 0]));
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
    olaylar,
    olayListeleri,
    siteHunisi,
    uyarilar,
  };
}

module.exports = umami;
module.exports.baglantiCoz = baglantiCoz;
