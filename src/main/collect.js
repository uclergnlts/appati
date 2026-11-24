// Bir uygulamanın bütün kaynaklarını okuyup tek bir tabloda birleştirir; "neye bakmalı" notlarını üretir.
const { KAYNAKLAR, gizliAlanlar } = require("./katalog");
const { gunAnahtari, sonGunler, seri } = require("./util");

const OKUYUCU = {
  supabase: require("./sources/supabase"),
  ganalytics: require("./sources/ganalytics"),
  revenuecat: require("./sources/revenuecat"),
  appstore: require("./sources/appstore"),
  googleplay: require("./sources/googleplay"),
};

// "Etiket | tablo | filtre" satırlarını sayaç listesine çevirir.
function sayaclariOku(metin) {
  if (Array.isArray(metin)) return metin;
  return String(metin || "").split("\n").map((s) => s.trim()).filter(Boolean).map((s) => {
    const [etiket, tablo, ...kalan] = s.split("|").map((p) => p.trim());
    return { etiket, tablo, filtre: kalan.join("|") };
  }).filter((s) => s.tablo);
}

// Bir kaynak ayarı doldurulmuş mu? (en az bir açık alan ya da bir gizli alan girilmiş)
function kaynakDolu(tur, ayar, gizli) {
  const tanim = KAYNAKLAR.find((k) => k.tur === tur);
  const zorunluGizli = gizliAlanlar(tur);
  return zorunluGizli.every((a) => gizli && gizli[a]) && tanim.alanlar.some((a) => !a.gizli && ayar && ayar[a.ad]);
}

function degisim(yeni, eski) {
  if (yeni === undefined || eski === undefined || !eski) return null;
  return Math.round(((yeni - eski) / eski) * 100);
}

function notlar(u) {
  const n = [];
  const k = u.kpi;
  for (const kay of u.kaynaklar) if (!kay.tamam) n.push({ tur: "kotu", metin: `${kay.ad} okunamadı: ${kay.hata}` });
  const z = degisim(k.ziyaretci7g, k.ziyaretciOnceki7g);
  if (z !== null && z <= -25) n.push({ tur: "uyari", metin: `Site ziyaretçisi geçen haftaya göre %${Math.abs(z)} düştü (${k.ziyaretciOnceki7g} → ${k.ziyaretci7g}).` });
  if (z !== null && z >= 25) n.push({ tur: "iyi", metin: `Site ziyaretçisi geçen haftaya göre %${z} arttı (${k.ziyaretciOnceki7g} → ${k.ziyaretci7g}).` });
  const y = degisim(k.yeniKayit7g, k.yeniKayitOnceki7g);
  if (y !== null && y <= -25) n.push({ tur: "uyari", metin: `Yeni kayıt geçen haftaya göre %${Math.abs(y)} düştü (${k.yeniKayitOnceki7g} → ${k.yeniKayit7g}).` });
  if (y !== null && y >= 25) n.push({ tur: "iyi", metin: `Yeni kayıt geçen haftaya göre %${y} arttı (${k.yeniKayitOnceki7g} → ${k.yeniKayit7g}).` });
  if (k.ziyaretci7g >= 30 && k.yeniKayit7g !== undefined) {
    const oran = (k.yeniKayit7g / k.ziyaretci7g) * 100;
    if (oran < 1) n.push({ tur: "uyari", metin: `Son 7 günde ${k.ziyaretci7g} ziyaretçiden yalnızca ${k.yeniKayit7g} kişi kayıt oldu (%${oran.toFixed(1)}). Kayıt adımına bak.` });
  }
  if (k.kayitli >= 10 && k.aktif7g !== undefined && k.aktif7g / k.kayitli < 0.1) {
    n.push({ tur: "uyari", metin: `${k.kayitli} kayıtlı kullanıcıdan yalnızca ${k.aktif7g} kişi son 7 günde aktif.` });
  }
  const haftaOnce = Date.now() - 7 * 86400000;
  const kotu = u.yorumlar.filter((r) => r.puan && r.puan <= 2 && r.tarih && new Date(r.tarih).getTime() > haftaOnce);
  if (kotu.length) n.push({ tur: "uyari", metin: `Son 7 günde ${kotu.length} düşük puanlı yorum geldi.` });
  if (k.deneme) n.push({ tur: "bilgi", metin: `${k.deneme} kişi şu an deneme süresinde.` });
  if (!n.length && u.kaynaklar.length) n.push({ tur: "iyi", metin: "Dikkat isteyen bir şey görünmüyor." });
  return n;
}

async function uygulamayiTopla(uyg, gizliler, ctx) {
  const u = {
    id: uyg.id, ad: uyg.ad, renk: uyg.renk || "#3987e5", demo: false,
    kaynaklar: [], kpi: {}, seri: {}, trafik: [], sayfalar: [], ulkeler: [], yorumlar: [], sayaclar: [], huni: [], paraBirimi: "$",
  };
  const isler = KAYNAKLAR.map(async (tanim) => {
    const ayar = { ...((uyg.kaynaklar || {})[tanim.tur] || {}) };
    let gizli = (gizliler || {})[tanim.tur] || {};
    // Bir kaynağın gizli alanı boşsa ve "yedek" tanımlıysa başka kaynağınki kullanılır
    // (Google Analytics, Google Play'e girilen servis hesabını paylaşabilir).
    for (const a of tanim.alanlar) {
      if (a.gizli && a.yedek && !gizli[a.ad] && (gizliler || {})[a.yedek] && gizliler[a.yedek][a.ad]) gizli = { ...gizli, [a.ad]: gizliler[a.yedek][a.ad] };
    }
    if (!kaynakDolu(tanim.tur, ayar, gizli)) return null;
    if (tanim.tur === "supabase") { ayar.sayaclar = sayaclariOku(ayar.sayaclar); ayar.huni = sayaclariOku(ayar.huni); }
    try {
      return { tanim, veri: await OKUYUCU[tanim.tur](ayar, gizli, ctx) };
    } catch (e) {
      return { tanim, hata: e.message || String(e) };
    }
  });
  for (const s of await Promise.all(isler)) {
    if (!s) continue;
    u.kaynaklar.push({ tur: s.tanim.tur, ad: s.tanim.ad, tamam: !s.hata, hata: s.hata || null, uyarilar: (s.veri && s.veri.uyarilar) || [] });
    if (!s.veri) continue;
    for (const [a, d] of Object.entries(s.veri.kpi || {})) if (d !== undefined) u.kpi[a] = d;
    Object.assign(u.seri, s.veri.seri || {});
    if (s.veri.kaynaklar) u.trafik = s.veri.kaynaklar;
    if (s.veri.sayfalar) u.sayfalar = s.veri.sayfalar;
    if (s.veri.ulkeler) u.ulkeler = s.veri.ulkeler;
    if (s.veri.yorumlar) u.yorumlar.push(...s.veri.yorumlar);
    if (s.veri.sayaclar) u.sayaclar.push(...s.veri.sayaclar);
    if (s.veri.huni && s.veri.huni.length) u.huni = s.veri.huni;
    if (s.veri.paraBirimi) u.paraBirimi = s.veri.paraBirimi;
    if (s.veri.kurulumSonGun) u.kurulumSonGun = s.veri.kurulumSonGun;
  }
  u.yorumlar.sort((a, b) => String(b.tarih || "").localeCompare(String(a.tarih || "")));

  // Aktif kullanıcının geçmişi hiçbir kaynakta yok; her gün gördüğümüz değeri saklayıp seriyi kendimiz kurarız.
  if (u.kpi.aktifBugun !== undefined) {
    const gecmis = ctx.onbellek.al(`gecmis.${u.id}`) || {};
    gecmis[gunAnahtari(ctx.simdi)] = u.kpi.aktifBugun;
    const gunler = sonGunler(ctx.simdi, 30);
    for (const g of Object.keys(gecmis)) if (!gunler.includes(g)) delete gecmis[g];
    ctx.onbellek.yaz(`gecmis.${u.id}`, gecmis);
    u.seri.aktif = seri(gunler, gecmis);
    u.aktifGecmisGun = Object.keys(gecmis).length;
  }
  u.notlar = notlar(u);
  return u;
}

const TOPLANAN = ["aktifBugun", "aktif7g", "kayitli", "yeniKayitBugun", "yeniKayit7g", "yeniKayitOnceki7g", "ziyaretciBugun",
  "ziyaretci7g", "ziyaretciOnceki7g", "sitedeSimdi", "abone", "deneme", "mrr", "gelir28g", "kurulumIos7g", "kurulumIosOnceki7g"];

// Bütün uygulamaların toplamı (Tümü görünümü).
function ozetle(uygulamalar) {
  const kpi = {};
  const seriler = {};
  const trafik = {};
  for (const u of uygulamalar) {
    for (const a of TOPLANAN) if (u.kpi[a] !== undefined) kpi[a] = (kpi[a] || 0) + u.kpi[a];
    for (const [ad, dizi] of Object.entries(u.seri)) {
      seriler[ad] = seriler[ad] || {};
      for (const n of dizi) seriler[ad][n.g] = (seriler[ad][n.g] || 0) + n.v;
    }
    for (const t of u.trafik) trafik[t.ad] = (trafik[t.ad] || 0) + t.v;
  }
  return {
    kpi,
    seri: Object.fromEntries(Object.entries(seriler).map(([ad, s]) => [ad, Object.keys(s).sort().map((g) => ({ g, v: s[g] }))])),
    trafik: Object.entries(trafik).map(([ad, v]) => ({ ad, v })).sort((a, b) => b.v - a.v).slice(0, 8),
    notlar: uygulamalar.flatMap((u) => u.notlar.filter((n) => n.tur === "kotu" || n.tur === "uyari").map((n) => ({ ...n, uygulama: u.ad, uygulamaId: u.id }))),
    paraBirimi: (uygulamalar.find((u) => u.kpi.mrr !== undefined) || {}).paraBirimi || "$",
  };
}

module.exports = { uygulamayiTopla, ozetle, sayaclariOku, kaynakDolu, notlar };
