// Haftalık özet: son 7 günün rakamları ve bir önceki haftaya göre değişim.
// Ziyaretçi, kayıt, arama ve indirme için kaynaklar önceki haftayı zaten verir. Abone, MRR ve kayıtlı kullanıcı
// için geçmiş hiçbir kaynakta yoktur; her gün gördüğümüz değer saklanır ve 7 gün önceki değerle karşılaştırılır.
const { gunAnahtari, GUN } = require("./util");

const SAKLANAN = ["abone", "mrr", "kayitli"];
const sayi = (n) => Math.round(n).toLocaleString("tr-TR");

// ISO hafta anahtarı: "2026-W48" (hafta pazartesi başlar).
function haftaAnahtari(tarih) {
  const d = new Date(Date.UTC(tarih.getFullYear(), tarih.getMonth(), tarih.getDate()));
  const gun = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - gun);
  const yilBasi = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${String(Math.ceil(((d - yilBasi) / GUN + 1) / 7)).padStart(2, "0")}`;
}

// Bugünün değerlerini günlük kayda ekler, 15 günden eskileri atar. gecmis: { "YYYY-AA-GG": { abone, mrr, kayitli } }
function gunlukKaydet(gecmis, simdi, kpi) {
  const yeni = { ...(gecmis || {}) };
  const bugun = {};
  for (const a of SAKLANAN) if (typeof kpi[a] === "number") bugun[a] = kpi[a];
  if (Object.keys(bugun).length) yeni[gunAnahtari(simdi)] = bugun;
  const sinir = gunAnahtari(new Date(simdi.getTime() - 15 * GUN));
  for (const g of Object.keys(yeni)) if (g < sinir) delete yeni[g];
  return yeni;
}

// 7 gün önceki (yoksa 6-10 gün arası en yakın) kayıttaki değer; bir haftalık geçmiş birikmediyse undefined.
function haftaOnce(gecmis, simdi, alan) {
  for (const n of [7, 8, 6, 9, 10]) {
    const k = (gecmis || {})[gunAnahtari(new Date(simdi.getTime() - n * GUN))];
    if (k && typeof k[alan] === "number") return k[alan];
  }
  return undefined;
}

function yuzdeSatiri(etiket, yeni, eski) {
  if (yeni === undefined) return null;
  const satir = { etiket, deger: sayi(yeni), degisim: null, yon: null };
  if (eski !== undefined && eski > 0) {
    const y = Math.round(((yeni - eski) / eski) * 100);
    satir.degisim = `%${Math.abs(y)}`; satir.yon = y > 0 ? "yukari" : y < 0 ? "asagi" : null;
    satir.aciklama = `önceki 7 gün ${sayi(eski)}`;
  }
  return satir;
}

function farkSatiri(etiket, yeni, eski, bicim = sayi) {
  if (yeni === undefined) return null;
  const satir = { etiket, deger: bicim(yeni), degisim: null, yon: null };
  if (eski !== undefined) {
    const f = yeni - eski;
    satir.degisim = f === 0 ? "değişmedi" : `${f > 0 ? "+" : "−"}${bicim(Math.abs(f)).replace(/^[^\d]+/, "")}`;
    satir.yon = f > 0 ? "yukari" : f < 0 ? "asagi" : null;
    satir.aciklama = `bir hafta önce ${bicim(eski)}`;
  }
  return satir;
}

// u: birleştirilmiş uygulama verisi → [{ etiket, deger, degisim, yon, aciklama? }]
function haftalikSatirlar(u, gecmis, simdi) {
  const k = u.kpi;
  const para = (n) => `${u.paraBirimi || "$"}${sayi(n)}`;
  const satirlar = [
    yuzdeSatiri("Site ziyaretçisi", k.ziyaretci7g, k.ziyaretciOnceki7g),
    yuzdeSatiri("Yeni kayıt", k.yeniKayit7g, k.yeniKayitOnceki7g),
    yuzdeSatiri("Aramadan tıklama", k.aramaTiklama7g, k.aramaTiklamaOnceki7g),
    yuzdeSatiri("iOS indirme", k.kurulumIos7g, k.kurulumIosOnceki7g),
    farkSatiri("Abone", k.abone, haftaOnce(gecmis, simdi, "abone")),
    farkSatiri("Aylık yinelenen gelir", k.mrr, haftaOnce(gecmis, simdi, "mrr"), para),
    farkSatiri("Kayıtlı kullanıcı", k.kayitli, haftaOnce(gecmis, simdi, "kayitli")),
  ].filter(Boolean);
  if (u.sayfalar && u.sayfalar[0]) satirlar.push({ etiket: "En çok açılan sayfa", deger: u.sayfalar[0].ad, degisim: `${sayi(u.sayfalar[0].v)} görüntüleme`, yon: null, metin: true });
  const takilan = (u.olayListeleri || []).find((l) => l.ogeler && l.ogeler.length);
  if (takilan) satirlar.push({ etiket: takilan.etiket, deger: takilan.ogeler[0].ad, degisim: `${sayi(takilan.ogeler[0].v)} kez · 30 gün`, yon: null, metin: true });
  return satirlar;
}

// Pazartesi bildirimi için tek satırlık özet: "ziyaretçi 1.937 (▲ %8), kayıt 142 (▼ %3), abone 86 (+2)"
function bildirimMetni(u) {
  const ok = (s) => (s.yon === "yukari" ? "▲ " : s.yon === "asagi" ? "▼ " : "");
  return (u.haftalik || []).filter((s) => !s.metin).slice(0, 4)
    .map((s) => `${s.etiket.toLocaleLowerCase("tr-TR")} ${s.deger}${s.degisim ? ` (${s.degisim.startsWith("%") ? ok(s) : ""}${s.degisim})` : ""}`).join(", ");
}

module.exports = { haftaAnahtari, gunlukKaydet, haftaOnce, haftalikSatirlar, bildirimMetni };
