// Çeviri katmanı. Uygulamanın kaynak dili Türkçedir; metinler ekrana yazılırken sözlükten çevrilir.
// Sözlük anahtarı Türkçe metnin kendisidir. İçinde değişen parça olan metinlerde anahtar bir kalıptır:
//   "{0} uygulama · {1} itibarıyla"  →  "{0} apps · as of {1}"
// Kalıpla yakalanan parçalar da (ör. iç içe hata mesajları) ayrıca çevrilmeye çalışılır.
// Hem ana süreçte (require) hem arayüzde (<script>) kullanılır.
(function (kok, fabrika) {
  if (typeof module === "object" && module.exports) module.exports = fabrika(); else kok.Ceviri = fabrika();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DILLER = {
    tr: { ad: "Türkçe", yerel: "tr-TR", yon: "ltr" },
    en: { ad: "English", yerel: "en-US", yon: "ltr" },
    es: { ad: "Español", yerel: "es-ES", yon: "ltr" },
    ar: { ad: "العربية", yerel: "ar-u-nu-latn", yon: "rtl" }, // rakamlar Latin: grafik eksenleriyle uyumlu kalsın
  };
  const kacis = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Sistem dilinden ("en-GB", "ar-SA", "tr") desteklenen dile; yoksa İngilizce.
  function dilSec(istenen, sistem) {
    if (DILLER[istenen]) return istenen;
    const kisa = String(sistem || "").toLowerCase().split(/[-_]/)[0];
    return DILLER[kisa] ? kisa : "en";
  }

  function cevirici(sozluk) {
    const tam = new Map(), kaliplar = [];
    for (const [anahtar, hedef] of Object.entries(sozluk || {})) {
      if (typeof hedef !== "string" || !hedef) continue;
      if (/\{\d+\}/.test(anahtar)) {
        const sira = [];
        const ifade = new RegExp(`^${kacis(anahtar).replace(/\\\{(\d+)\\\}/g, (_m, n) => { sira.push(Number(n)); return "([\\s\\S]+?)"; })}$`);
        kaliplar.push({ ifade, sira, hedef, agirlik: anahtar.replace(/\{\d+\}/g, "").length });
      } else tam.set(anahtar, hedef);
    }
    kaliplar.sort((a, b) => b.agirlik - a.agirlik); // sabit metni uzun olan (daha özel) kalıp önce denenir
    const bellek = new Map();
    const eksik = new Set();

    function cevir(metin, ic) {
      if (typeof metin !== "string" || !metin) return metin;
      if (bellek.has(metin)) return bellek.get(metin);
      const bas = /^\s*/.exec(metin)[0], son = /\s*$/.exec(metin)[0];
      const govde = metin.slice(bas.length, metin.length - son.length);
      let sonuc = null;
      if (tam.has(govde)) sonuc = tam.get(govde);
      else {
        for (const k of kaliplar) {
          const e = k.ifade.exec(govde);
          if (!e) continue;
          const parca = {};
          k.sira.forEach((n, i) => { parca[n] = cevir(e[i + 1], true); });
          sonuc = k.hedef.replace(/\{(\d+)\}/g, (_m, n) => (parca[n] !== undefined ? parca[n] : ""));
          break;
        }
      }
      if (sonuc === null) { if (!ic && /\p{L}{2}/u.test(govde)) eksik.add(govde); bellek.set(metin, metin); return metin; }
      const cikti = bas + sonuc + son;
      if (bellek.size > 5000) bellek.clear();
      bellek.set(metin, cikti);
      return cikti;
    }
    cevir.eksik = eksik; // sözlükte karşılığı bulunmayan metinler (geliştirme ve sınama için)
    return cevir;
  }

  return { DILLER, dilSec, cevirici };
});
