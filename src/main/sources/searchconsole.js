// Google Search Console: sitenin Google aramasındaki tıklama ve gösterimleri, en çok getiren sorgular ve sayfalar.
// Gerekli: Search Console'daki mülk (ör. "sc-domain:ucler.app" ya da "https://ucler.app/") ve servis hesabı JSON'u.
// Servis hesabının e-postası Search Console > Ayarlar > Kullanıcılar ve izinler'e eklenmiş, Cloud projesinde
// "Google Search Console API" açılmış olmalı. Google bu veriyi 2-3 gün gecikmeyle verir.
const { yerel } = require("../dil");
const { gunAnahtari, GUN } = require("../util");
const { hesapCoz, googleJeton } = require("./google");

// "ucler.app" → "sc-domain:ucler.app"; tam adres ve sc-domain: biçimi olduğu gibi kalır.
function mulkCoz(girdi) {
  const m = String(girdi || "").trim();
  if (!m) throw new Error("Mülk adresi eksik");
  if (/^sc-domain:/.test(m)) return m;
  if (/^https?:\/\//.test(m)) return m.endsWith("/") ? m : `${m}/`;
  return `sc-domain:${m.replace(/\/+$/, "")}`;
}

module.exports = async function searchconsole(ayar, gizli, ctx) {
  const mulk = mulkCoz(ayar.siteUrl);
  if (!gizli.serviceAccount) throw new Error("Servis hesabı JSON'u eksik");
  const hesap = hesapCoz(gizli.serviceAccount);
  const jeton = await googleJeton(hesap, "https://www.googleapis.com/auth/webmasters.readonly", ctx);
  const adres = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(mulk)}/searchAnalytics/query`;

  const sor = async (govde) => {
    try {
      const r = await ctx.istek(adres, { method: "POST", headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" }, body: JSON.stringify(govde) });
      return r.rows || [];
    } catch (e) {
      const m = String(e.message || "");
      if (/has not been used in project|is disabled/i.test(m)) {
        throw new Error(`Google Cloud projesinde (${hesap.project_id || "?"}) “Google Search Console API” kapalı. Google Cloud Console > APIs & Services > Library'de bu API'yi bulup Enable de, birkaç dakika sonra yenile.`);
      }
      if (/sufficient permission|PERMISSION_DENIED|does not have permission|forbidden/i.test(m) || e.durum === 403) {
        throw new Error(`Servis hesabı “${mulk}” mülkünü göremiyor. Search Console > Ayarlar > Kullanıcılar ve izinler'de ${hesap.client_email} adresini ekle; mülk adresinin Search Console'dakiyle aynı yazıldığını kontrol et.`);
      }
      if (e.durum === 404) throw new Error(`Search Console'da “${mulk}” diye bir mülk bulunamadı.`);
      throw e;
    }
  };

  const gun = (n) => gunAnahtari(new Date(ctx.simdi.getTime() - n * GUN));
  const [gunluk, sorgu, sayfa] = await Promise.all([
    sor({ startDate: gun(34), endDate: gun(0), dimensions: ["date"], rowLimit: 50 }),
    sor({ startDate: gun(30), endDate: gun(0), dimensions: ["query"], rowLimit: 15 }),
    sor({ startDate: gun(30), endDate: gun(0), dimensions: ["page"], rowLimit: 15 }),
  ]);

  // Google son 2-3 günü henüz vermez; haftalık toplamlar verisi gelen son güne göre hesaplanır.
  const gunler = gunluk.map((s) => ({ g: s.keys[0], tiklama: s.clicks || 0, gosterim: s.impressions || 0 })).sort((a, b) => a.g.localeCompare(b.g));
  const topla = (dizi, alan) => dizi.reduce((t, n) => t + n[alan], 0);
  const son7 = gunler.slice(-7), onceki7 = gunler.slice(-14, -7);
  const liste = (satirlar, cevir = (x) => x) => satirlar.map((s) => ({
    ad: cevir(s.keys[0]), v: s.clicks || 0,
    alt: `${Math.round(s.impressions || 0).toLocaleString(yerel())} gösterim · ortalama ${(s.position || 0).toLocaleString(yerel(), { maximumFractionDigits: 1 })}. sıra`,
  }));
  const yol = (u) => { try { const a = new URL(u); return a.pathname + a.search; } catch { return u; } };

  return {
    kpi: {
      aramaTiklama7g: topla(son7, "tiklama"),
      aramaGosterim7g: topla(son7, "gosterim"),
      aramaTiklamaOnceki7g: onceki7.length === 7 ? topla(onceki7, "tiklama") : undefined,
      aramaGosterimOnceki7g: onceki7.length === 7 ? topla(onceki7, "gosterim") : undefined,
    },
    seri: {
      aramaTiklama: gunler.slice(-30).map((n) => ({ g: n.g, v: n.tiklama })),
      aramaGosterim: gunler.slice(-30).map((n) => ({ g: n.g, v: n.gosterim })),
    },
    arama: { sorgular: liste(sorgu), sayfalar: liste(sayfa, yol), sonGun: gunler.length ? gunler[gunler.length - 1].g : null },
    uyarilar: [],
  };
};
module.exports.mulkCoz = mulkCoz;
