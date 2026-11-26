// Supabase: kayıtlı kullanıcı, günlük yeni kayıt, aktif kullanıcı ve isteğe bağlı tablo sayaçları.
// Gizli anahtar (service_role / sb_secret_...) gerekir; yalnızca okuma yapılır.
const { gunAnahtari, gunBasi, sonGunler, seri, topla, GUN } = require("../util");

async function say(istek, taban, baslik, tablo, filtre) {
  const yanit = await istek(`${taban}/rest/v1/${encodeURIComponent(tablo)}?select=*${filtre ? `&${filtre}` : ""}`,
    { headers: { ...baslik, Prefer: "count=exact", Range: "0-0" } }, "yanit");
  if (!yanit.ok && yanit.status !== 416) throw new Error(`${tablo}: HTTP ${yanit.status}`);
  const aralik = yanit.headers.get("content-range") || "";
  const n = Number(aralik.split("/")[1]);
  if (!Number.isFinite(n)) throw new Error(`${tablo}: sayı okunamadı`);
  return n;
}

module.exports = async function supabase(ayar, gizli, { istek, simdi }) {
  const taban = String(ayar.url || "").trim().replace(/\/+$/, "");
  if (!taban) throw new Error("Proje adresi eksik");
  if (!gizli.key) throw new Error("Gizli anahtar eksik");
  const baslik = { apikey: gizli.key, Authorization: `Bearer ${gizli.key}` };

  const kullanicilar = [];
  for (let sayfa = 1; sayfa <= 30; sayfa++) {
    const r = await istek(`${taban}/auth/v1/admin/users?page=${sayfa}&per_page=1000`, { headers: baslik });
    const liste = r.users || [];
    kullanicilar.push(...liste);
    if (liste.length < 1000) break;
  }

  const gunler = sonGunler(simdi, 30);
  const kayit = {};
  for (const k of kullanicilar) {
    if (!k.created_at) continue;
    const g = gunAnahtari(new Date(k.created_at));
    kayit[g] = (kayit[g] || 0) + 1;
  }
  const kayitSeri = seri(gunler, kayit);
  const bugunBasi = gunBasi(simdi);
  const yediGun = new Date(bugunBasi.getTime() - 6 * GUN);

  const sonuc = {
    kpi: {
      kayitli: kullanicilar.length,
      yeniKayitBugun: kayitSeri[29].v,
      yeniKayit7g: topla(kayitSeri, 23, 30),
      yeniKayitOnceki7g: topla(kayitSeri, 16, 23),
    },
    seri: { kayit: kayitSeri },
    sayaclar: [],
    huni: [],
    uyarilar: [],
  };

  // Aktiflik: uygulamanın her kullanımda güncellediği bir zaman sütunu varsa onu, yoksa son girişi kullan.
  if (ayar.aktifTablo && ayar.aktifSutun) {
    const s = encodeURIComponent(ayar.aktifSutun);
    sonuc.kpi.aktifBugun = await say(istek, taban, baslik, ayar.aktifTablo, `${s}=gte.${encodeURIComponent(bugunBasi.toISOString())}`);
    sonuc.kpi.aktif7g = await say(istek, taban, baslik, ayar.aktifTablo, `${s}=gte.${encodeURIComponent(yediGun.toISOString())}`);
  } else {
    const girisler = kullanicilar.map((k) => (k.last_sign_in_at ? new Date(k.last_sign_in_at) : null)).filter(Boolean);
    sonuc.kpi.aktifBugun = girisler.filter((d) => d >= bugunBasi).length;
    sonuc.kpi.aktif7g = girisler.filter((d) => d >= yediGun).length;
  }

  // Filtre yer tutucuları: {simdi} / {now} şu anki zaman, {bugun} / {today} bugünün tarihi.
  const doldur = (f) => String(f || "")
    .replaceAll("{simdi}", encodeURIComponent(simdi.toISOString())).replaceAll("{now}", encodeURIComponent(simdi.toISOString()))
    .replaceAll("{bugun}", gunAnahtari(simdi)).replaceAll("{today}", gunAnahtari(simdi));

  // Huni: ilk adım kayıtlı kullanıcı; bir adım okunamazsa huni yarım gösterilmez.
  const adimlar = (ayar.huni || []).filter((a) => a.tablo);
  if (adimlar.length) {
    try {
      const huni = [{ etiket: "Kayıt olan", deger: kullanicilar.length }];
      for (const a of adimlar) huni.push({ etiket: a.etiket || a.tablo, deger: await say(istek, taban, baslik, a.tablo, doldur(a.filtre)) });
      sonuc.huni = huni;
    } catch (e) {
      sonuc.uyarilar.push(`Dönüşüm hunisi okunamadı (${e.message})`);
    }
  }

  for (const s of ayar.sayaclar || []) {
    if (!s.tablo) continue;
    const filtre = doldur(s.filtre);
    try {
      sonuc.sayaclar.push({ etiket: s.etiket || s.tablo, deger: await say(istek, taban, baslik, s.tablo, filtre) });
    } catch (e) {
      sonuc.uyarilar.push(`Sayaç "${s.etiket || s.tablo}" okunamadı (${e.message})`);
    }
  }
  return sonuc;
};
