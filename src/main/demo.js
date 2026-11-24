// Örnek veri: hiçbir kaynak bağlanmadan paneli denemek için. Gerçek değildir; arayüz bunu açıkça yazar.
const { sonGunler, topla } = require("./util");
const { notlar } = require("./collect");

// Tohumlu sözde rastgele: aynı gün içinde sayılar değişmesin.
function rastgele(tohum) {
  let s = tohum >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dizi(gunler, r, taban, egim, oynama) {
  return gunler.map((g, i) => ({ g, v: Math.max(0, Math.round(taban + egim * i + (r() - 0.5) * oynama + (i % 7 >= 5 ? taban * 0.25 : 0))) }));
}

const TANIM = [
  { id: "demo-1", ad: "Örnek Ders", renk: "#3987e5", olcek: 1, trafik: ["Doğrudan (adres yazan, yer imi)", "google.com", "instagram.com", "chatgpt.com", "tiktok.com"] },
  { id: "demo-2", ad: "Örnek Oyun", renk: "#d95926", olcek: 0.45, trafik: ["instagram.com", "Doğrudan (adres yazan, yer imi)", "google.com", "youtube.com"] },
  { id: "demo-3", ad: "Örnek Takip", renk: "#199e70", olcek: 0.18, trafik: ["google.com", "Doğrudan (adres yazan, yer imi)", "producthunt.com"] },
];

const YORUM = [
  [5, "Tam aradığım şey", "Kısa ve anlaşılır, her gün birkaç dakika açıyorum.", "App Store", "TUR"],
  [4, "", "Güzel uygulama, karanlık tema da çok iyi olmuş.", "Google Play", "tr"],
  [2, "Bildirimler", "Bildirimler çok sık geliyor, kapatma ayarını bulamadım.", "App Store", "TUR"],
  [5, "", "Sınava hazırlanırken çok işime yaradı.", "Google Play", "tr"],
];

function demoUygulamalar(simdi) {
  const gunler = sonGunler(simdi, 30);
  const gunNo = Math.floor(simdi.getTime() / 86400000);
  return TANIM.map((t, sira) => {
    const r = rastgele(gunNo * 7 + sira * 101);
    const o = t.olcek;
    const ziyaret = dizi(gunler, r, 220 * o, 2.2 * o, 90 * o);
    const kayit = dizi(gunler, r, 14 * o, 0.25 * o, 9 * o);
    const aktif = dizi(gunler, r, 130 * o, 1.4 * o, 40 * o);
    const kurulum = dizi(gunler, r, 26 * o, 0.3 * o, 14 * o);
    const z7 = topla(ziyaret, 23, 30);
    const u = {
      id: t.id, ad: t.ad, renk: t.renk, demo: true,
      kaynaklar: ["Supabase", "Google Analytics", "RevenueCat", "App Store Connect", "Google Play"].map((ad) => ({ tur: ad, ad, tamam: true, hata: null, uyarilar: [] })),
      kpi: {
        aktifBugun: aktif[29].v, aktif7g: Math.round(aktif[29].v * 3.1), kayitli: Math.round(4200 * o),
        yeniKayitBugun: kayit[29].v, yeniKayit7g: topla(kayit, 23, 30), yeniKayitOnceki7g: topla(kayit, 16, 23),
        ziyaretciBugun: ziyaret[29].v, goruntulemeBugun: Math.round(ziyaret[29].v * 3.4), ziyaretci7g: z7,
        ziyaretciOnceki7g: topla(ziyaret, 16, 23), goruntuleme7g: Math.round(z7 * 3.4), sitedeSimdi: Math.round(6 * o + r() * 4),
        abone: Math.round(86 * o), deneme: Math.round(12 * o), mrr: Math.round(412 * o), gelir28g: Math.round(520 * o),
        kurulumIos7g: topla(kurulum, 23, 30), kurulumIosOnceki7g: topla(kurulum, 16, 23),
      },
      seri: { ziyaret, kayit, aktif, kurulumIos: kurulum, goruntuleme: ziyaret.map((n) => ({ g: n.g, v: Math.round(n.v * 3.4) })) },
      trafik: t.trafik.map((ad, i) => ({ ad, v: Math.round((z7 * (0.42 - i * 0.08)) / (1 + i * 0.2)) })),
      sayfalar: ["/", "/ogren/", "/videolar/", "/fizik/hareket/", "/plus/"].map((ad, i) => ({ ad, v: Math.round((z7 * 1.6) / (i + 1.4)) })),
      ulkeler: ["TR", "DE", "US", "NL", "AZ"].map((ad, i) => ({ ad, v: Math.round((z7 * 0.8) / (i * i * 2 + 1)) })),
      yorumlar: YORUM.slice(0, sira === 2 ? 1 : 4).map(([puan, baslik, metin, magaza, ulke], i) => ({
        magaza, puan, baslik, metin, ulke, yazan: "", tarih: new Date(simdi.getTime() - (i * 2 + 1) * 86400000).toISOString(),
      })),
      sayaclar: sira === 0 ? [{ etiket: "Günün sorusunu çözen (bugün)", deger: 48 }, { etiket: "Ligde olan", deger: 310 }] : [],
      huni: [["Kayıt olan", 1], ["Hesabı eşitlenen", 0.81], ["Puan kazanan", 0.56], ["Bir aşama bitiren", 0.31], ["Plus abonesi", 0.0205]].map(([etiket, oran]) => ({ etiket, deger: Math.round(4200 * o * oran) })),
      paraBirimi: "$", aktifGecmisGun: 30, kurulumSonGun: gunler[28],
    };
    u.notlar = notlar(u);
    return u;
  });
}

module.exports = { demoUygulamalar };
