// Google Analytics 4 (Data API): site ziyaretçisi, sayfa görüntüleme, nereden geldikleri, sayfalar, ülkeler.
// Gerekli: GA4 mülk kimliği (sayısal Property ID) ve servis hesabı JSON'u. Servis hesabının e-postası
// Analytics'te mülke "Görüntüleyici" olarak eklenmiş, Cloud projesinde "Google Analytics Data API" açılmış olmalı.
// Not: Analytics bugünün verisini birkaç saat gecikmeyle işler; "şu an sitede" gerçek zamanlıdır.
const { sonGunler, seri } = require("../util");
const { hesapCoz, googleJeton } = require("./google");

const DOGRUDAN = "Doğrudan (adres yazan, yer imi)";
const metrik = (...adlar) => adlar.map((name) => ({ name }));
const sayi = (satir, i = 0) => Number(satir && satir.metricValues && satir.metricValues[i] && satir.metricValues[i].value) || 0;
const boyut = (satir, i = 0) => (satir && satir.dimensionValues && satir.dimensionValues[i] ? satir.dimensionValues[i].value : "");

module.exports = async function ganalytics(ayar, gizli, ctx) {
  const mulk = String(ayar.propertyId || "").replace(/^properties\//, "").trim();
  if (!mulk) throw new Error("Property ID eksik");
  if (!/^\d+$/.test(mulk)) throw new Error("Property ID yalnızca rakamlardan oluşur (G- ile başlayan ölçüm kimliği değil). Analytics > Yönetici > Mülk ayrıntıları'nda yazar.");
  if (!gizli.serviceAccount) throw new Error("Servis hesabı JSON'u eksik");
  const hesap = hesapCoz(gizli.serviceAccount);
  const jeton = await googleJeton(hesap, "https://www.googleapis.com/auth/analytics.readonly", ctx);
  const taban = `https://analyticsdata.googleapis.com/v1beta/properties/${mulk}`;

  const sor = async (yol, govde) => {
    try {
      return await ctx.istek(`${taban}:${yol}`, { method: "POST", headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" }, body: JSON.stringify(govde) });
    } catch (e) {
      const m = String(e.message || "");
      if (/has not been used in project|is disabled/i.test(m)) {
        throw new Error(`Google Cloud projesinde (${hesap.project_id || "?"}) “Google Analytics Data API” kapalı. Google Cloud Console > APIs & Services > Library'de bu API'yi bulup Enable de, birkaç dakika sonra yenile.`);
      }
      if (/sufficient permissions|PERMISSION_DENIED|does not have permission/i.test(m)) {
        throw new Error(`Servis hesabının bu Analytics mülküne erişimi yok. Analytics > Yönetici > Mülk erişim yönetimi'nde ${hesap.client_email} adresini Görüntüleyici olarak ekle.`);
      }
      if (e.durum === 404 || /NOT_FOUND/i.test(m)) throw new Error(`Analytics'te ${mulk} kimlikli bir mülk bulunamadı. Property ID'yi kontrol et.`);
      throw e;
    }
  };

  const yedi = { startDate: "6daysAgo", endDate: "today" };
  const sirala = (ad) => [{ metric: { metricName: ad }, desc: true }];
  const [ilk, ikinci, canli] = await Promise.all([
    sor("batchRunReports", { requests: [
      { dateRanges: [{ startDate: "today", endDate: "today" }], metrics: metrik("activeUsers", "screenPageViews") },
      { dateRanges: [yedi, { startDate: "13daysAgo", endDate: "7daysAgo" }], metrics: metrik("activeUsers", "screenPageViews") },
      { dateRanges: [{ startDate: "29daysAgo", endDate: "today" }], dimensions: [{ name: "date" }], metrics: metrik("sessions", "screenPageViews"), limit: 40 },
      { dateRanges: [yedi], dimensions: [{ name: "sessionSource" }], metrics: metrik("sessions"), orderBys: sirala("sessions"), limit: 12 },
      { dateRanges: [yedi], dimensions: [{ name: "pagePath" }], metrics: metrik("screenPageViews"), orderBys: sirala("screenPageViews"), limit: 12 },
    ] }),
    sor("batchRunReports", { requests: [
      { dateRanges: [yedi], dimensions: [{ name: "country" }], metrics: metrik("sessions"), orderBys: sirala("sessions"), limit: 12 },
    ] }),
    sor("runRealtimeReport", { metrics: metrik("activeUsers") }).catch(() => null),
  ]);
  const [bugun, haftalar, gunluk, kaynak, sayfa] = (ilk.reports || []).map((r) => r.rows || []);
  const ulke = ((ikinci.reports || [])[0] || {}).rows || [];

  // İki tarih aralıklı raporda satırlar "date_range_0" (son 7 gün) ve "date_range_1" (önceki 7 gün) diye gelir; boş aralık hiç gelmez.
  const aralik = (ad) => (haftalar || []).find((s) => (s.dimensionValues || []).some((d) => d.value === ad));

  const gunler = sonGunler(ctx.simdi, 30);
  const ziyaret = {}, goruntuleme = {};
  for (const s of gunluk || []) {
    const t = boyut(s); // YYYYMMDD
    const g = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
    ziyaret[g] = sayi(s, 0); goruntuleme[g] = sayi(s, 1);
  }
  const liste = (satirlar, cevir = (x) => x) => (satirlar || []).map((s) => ({ ad: cevir(boyut(s)), v: sayi(s) })).filter((x) => x.v > 0);

  return {
    kpi: {
      ziyaretciBugun: sayi((bugun || [])[0], 0),
      goruntulemeBugun: sayi((bugun || [])[0], 1),
      ziyaretci7g: sayi(aralik("date_range_0"), 0),
      ziyaretciOnceki7g: sayi(aralik("date_range_1"), 0),
      goruntuleme7g: sayi(aralik("date_range_0"), 1),
      sitedeSimdi: canli ? sayi((canli.rows || [])[0], 0) : undefined,
    },
    seri: { ziyaret: seri(gunler, ziyaret), goruntuleme: seri(gunler, goruntuleme) },
    kaynaklar: liste(kaynak, (x) => (!x || x === "(direct)" || x === "(not set)" ? DOGRUDAN : x)),
    sayfalar: liste(sayfa),
    ulkeler: liste(ulke, (x) => (x === "(not set)" ? "Bilinmiyor" : x)),
    uyarilar: [],
  };
};
