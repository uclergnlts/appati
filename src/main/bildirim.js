// İki yenileme arasındaki farktan Mac bildirimi çıkarır: düşük puanlı yeni yorum, yeni abone, bozulan kaynak.
// İlk okumada (iz yokken) hiçbir şey bildirilmez; yalnızca sonradan değişenler haber olur.
const crypto = require("node:crypto");

const yorumKimligi = (y) => crypto.createHash("sha1").update(`${y.magaza}|${y.tarih}|${y.metin}`).digest("hex").slice(0, 16);

function izCikar(u) {
  return {
    abone: u.kpi.abone,
    bozuk: u.kaynaklar.filter((k) => !k.tamam).map((k) => k.tur),
    yorumlar: u.yorumlar.map(yorumKimligi),
  };
}

// onceki: { [uygulamaId]: iz } | undefined  →  { bildirimler: [{ baslik, metin, uygulamaId }], iz }
function farkBul(onceki, uygulamalar) {
  const bildirimler = [];
  const iz = {};
  for (const u of uygulamalar) {
    const yeni = izCikar(u);
    const eski = onceki && onceki[u.id];
    if (eski) {
      for (const y of u.yorumlar) {
        if (y.puan && y.puan <= 2 && !eski.yorumlar.includes(yorumKimligi(y))) {
          bildirimler.push({ uygulamaId: u.id, baslik: `${u.ad}: ${y.puan} yıldızlı yorum (${y.magaza})`, metin: (y.baslik ? `${y.baslik}. ` : "") + String(y.metin || "").slice(0, 140) });
        }
      }
      if (typeof yeni.abone === "number" && typeof eski.abone === "number" && yeni.abone > eski.abone) {
        bildirimler.push({ uygulamaId: u.id, baslik: `${u.ad}: yeni abone`, metin: `Aktif abone ${eski.abone} → ${yeni.abone}` });
      }
      for (const k of u.kaynaklar) {
        if (!k.tamam && !eski.bozuk.includes(k.tur)) bildirimler.push({ uygulamaId: u.id, baslik: `${u.ad}: ${k.ad} okunamıyor`, metin: String(k.hata || "").slice(0, 140) });
      }
      // Okunamayan kaynağın eski bilgisi korunur; yoksa kaynak düzelince eski yorumlar "yeni" sanılır.
      if (yeni.abone === undefined) yeni.abone = eski.abone;
      yeni.yorumlar = [...new Set([...yeni.yorumlar, ...eski.yorumlar])].slice(0, 300);
    }
    iz[u.id] = yeni;
  }
  return { bildirimler, iz };
}

module.exports = { farkBul };
