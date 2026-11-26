// Özel uç nokta: kendi sunucundan JSON döndüren bir adres. Hangi altyapıyı kullanırsan kullan (kendi veritabanın,
// Firebase, Appwrite, PocketBase, Laravel, Rails…) rakamlarını panele bağlamanın genel yoludur.
// Adres şu alanların istediğin kadarını içeren bir JSON nesnesi döndürür (hepsi isteğe bağlı):
//   { "registeredUsers": 4200, "activeToday": 177, "activeUsers7d": 549, "newSignupsToday": 12,
//     "newSignups7d": 155, "newSignupsPrev7d": 141, "subscribers": 86, "trials": 12, "mrr": 412, "revenue28d": 520,
//     "currency": "$", "counters": [{ "label": "Açık sipariş", "value": 8 }],
//     "signups": [{ "date": "2026-11-25", "value": 9 }], "funnel": [{ "label": "Kayıt olan", "value": 4200 }] }
const { sonGunler, seri } = require("../util");

const ALAN = { registeredUsers: "kayitli", activeToday: "aktifBugun", activeUsers7d: "aktif7g", newSignupsToday: "yeniKayitBugun",
  newSignups7d: "yeniKayit7g", newSignupsPrev7d: "yeniKayitOnceki7g", subscribers: "abone", trials: "deneme", mrr: "mrr", revenue28d: "gelir28g" };

module.exports = async function ozel(ayar, gizli, { istek, simdi }) {
  const adres = String(ayar.url || "").trim();
  if (!adres) throw new Error("Adres eksik");
  if (!/^https:\/\//.test(adres) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(adres)) throw new Error("Adres https:// ile başlamalı.");
  const r = await istek(adres, { headers: { Accept: "application/json", ...(gizli.token ? { Authorization: `Bearer ${gizli.token}` } : {}) } });
  if (!r || typeof r !== "object" || Array.isArray(r)) throw new Error("Adres bir JSON nesnesi döndürmeli.");

  const kpi = {};
  for (const [gelen, ic] of Object.entries(ALAN)) if (typeof r[gelen] === "number" && Number.isFinite(r[gelen])) kpi[ic] = r[gelen];
  const liste = (dizi) => (Array.isArray(dizi) ? dizi : []).filter((x) => x && typeof x.value === "number" && Number.isFinite(x.value)).slice(0, 20)
    .map((x) => ({ etiket: String(x.label ?? "").slice(0, 80), deger: x.value }));
  const sonuc = { kpi, sayaclar: liste(r.counters), uyarilar: [] };
  const huni = liste(r.funnel);
  if (huni.length > 1) sonuc.huni = huni;
  if (Array.isArray(r.signups)) {
    const sozluk = Object.fromEntries(r.signups.filter((x) => x && typeof x.value === "number" && /^\d{4}-\d{2}-\d{2}/.test(String(x.date))).map((x) => [String(x.date).slice(0, 10), x.value]));
    if (Object.keys(sozluk).length) sonuc.seri = { kayit: seri(sonGunler(simdi, 30), sozluk) };
  }
  if (typeof r.currency === "string" && r.currency.length <= 4) sonuc.paraBirimi = r.currency;
  if (!Object.keys(kpi).length && !sonuc.sayaclar.length && !sonuc.huni && !sonuc.seri) {
    throw new Error("Yanıtta tanınan bir alan yok. Beklenen alanlar: registeredUsers, activeToday, newSignups7d, subscribers, mrr, revenue28d, counters…");
  }
  return sonuc;
};
module.exports.ALAN = ALAN;
