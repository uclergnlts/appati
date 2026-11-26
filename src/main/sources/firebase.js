// Firebase: Authentication kullanıcıları (kayıtlı, günlük yeni kayıt, aktif) ve Firestore koleksiyon sayaçları.
// Supabase'in karşılığıdır. Firebase konsolunda Project settings > Service accounts > Generate new private key
// ile inen servis hesabı JSON'u gerekir; yalnızca okuma yapılır.
const { gunAnahtari, gunBasi, sonGunler, seri, topla, GUN } = require("../util");
const { hesapCoz, googleJeton } = require("./google");

function hataCevir(e, hesap) {
  const m = String(e.message || "");
  if (/has not been used in project|is disabled/i.test(m)) {
    return new Error(`Google Cloud projesinde (${hesap.project_id || "?"}) gereken API kapalı (Identity Toolkit API ya da Cloud Firestore API). Google Cloud Console > APIs & Services > Library'de açıp birkaç dakika sonra yenile.`);
  }
  if (/PERMISSION_DENIED|does not have permission|insufficient/i.test(m)) {
    return new Error(`Servis hesabının (${hesap.client_email}) bu Firebase projesinde okuma yetkisi yok. Firebase konsolundan indirilen Admin SDK anahtarını kullan ya da hesaba “Firebase Viewer” rolü ver.`);
  }
  return e;
}

module.exports = async function firebase(ayar, gizli, ctx) {
  if (!gizli.serviceAccount) throw new Error("Servis hesabı JSON'u eksik");
  const hesap = hesapCoz(gizli.serviceAccount);
  const proje = String(ayar.projectId || hesap.project_id || "").trim();
  if (!proje) throw new Error("Project ID eksik");
  const jeton = await googleJeton(hesap, "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore", ctx);
  const baslik = { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" };
  const uyarilar = [];

  // Authentication kullanıcıları (sayfa başına 1000).
  const kullanicilar = [];
  let sayfa = "";
  for (let i = 0; i < 30; i++) {
    let r;
    try {
      r = await ctx.istek(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(proje)}/accounts:batchGet?maxResults=1000${sayfa ? `&nextPageToken=${encodeURIComponent(sayfa)}` : ""}`, { headers: baslik });
    } catch (e) { throw hataCevir(e, hesap); }
    kullanicilar.push(...(r.users || []));
    sayfa = r.nextPageToken || "";
    if (!sayfa) break;
    if (i === 29) uyarilar.push("İlk 30.000 kullanıcı sayıldı; gerçek sayı daha yüksek.");
  }

  const simdi = ctx.simdi;
  const gunler = sonGunler(simdi, 30);
  const kayit = {};
  for (const k of kullanicilar) {
    const ms = Number(k.createdAt);
    if (!ms) continue;
    const g = gunAnahtari(new Date(ms));
    kayit[g] = (kayit[g] || 0) + 1;
  }
  const kayitSeri = seri(gunler, kayit);
  const bugun = gunBasi(simdi), yedi = new Date(bugun.getTime() - 6 * GUN);
  // Etkinlik: oturum yenileme zamanı (uygulama her açıldığında güncellenir), yoksa son giriş.
  const son = kullanicilar.map((k) => (k.lastRefreshAt ? new Date(k.lastRefreshAt) : Number(k.lastLoginAt) ? new Date(Number(k.lastLoginAt)) : null)).filter(Boolean);

  // Firestore sayaçları: "Etiket | koleksiyon"
  const sayaclar = [];
  for (const s of ayar.sayaclar || []) {
    if (!s.tablo) continue;
    try {
      const r = await ctx.istek(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(proje)}/databases/(default)/documents:runAggregationQuery`, {
        method: "POST", headers: baslik,
        body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: s.tablo }] }, aggregations: [{ alias: "n", count: {} }] } }),
      });
      const n = Number((((r[0] || {}).result || {}).aggregateFields || {}).n?.integerValue);
      if (!Number.isFinite(n)) throw new Error("sayı okunamadı");
      sayaclar.push({ etiket: s.etiket || s.tablo, deger: n });
    } catch (e) {
      uyarilar.push(`Sayaç "${s.etiket || s.tablo}" okunamadı (${hataCevir(e, hesap).message})`);
    }
  }

  return {
    kpi: {
      kayitli: kullanicilar.length,
      yeniKayitBugun: kayitSeri[29].v,
      yeniKayit7g: topla(kayitSeri, 23, 30),
      yeniKayitOnceki7g: topla(kayitSeri, 16, 23),
      aktifBugun: son.filter((d) => d >= bugun).length,
      aktif7g: son.filter((d) => d >= yedi).length,
    },
    seri: { kayit: kayitSeri },
    sayaclar,
    uyarilar,
  };
};
