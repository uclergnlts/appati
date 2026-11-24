// Ayarlar, gizli anahtarlar ve önbellek. Hepsi yalnızca bu Mac'te, uygulamanın veri klasöründe durur.
// Gizli anahtarlar macOS Anahtar Zinciri'ne bağlı safeStorage ile şifrelenir.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { KAYNAKLAR, gizliAlanlar } = require("./katalog");

const VARSAYILAN = { uygulamalar: [], genel: { yenilemeDk: 15, sabit: false, acilistaBaslat: false, tema: "sistem", saydamlik: 60 } };
const TEMALAR = ["sistem", "acik", "koyu"];

function oku(dosya, yedek) {
  try { return JSON.parse(fs.readFileSync(dosya, "utf8")); } catch { return yedek; }
}

function yaz(dosya, veri) {
  fs.mkdirSync(path.dirname(dosya), { recursive: true });
  const gecici = `${dosya}.tmp`;
  fs.writeFileSync(gecici, veri, { mode: 0o600 });
  fs.renameSync(gecici, dosya);
}

function depo(klasor, safeStorage) {
  const yol = (ad) => path.join(klasor, ad);
  let ayar = { ...VARSAYILAN, ...oku(yol("ayar.json"), {}) };
  ayar.genel = { ...VARSAYILAN.genel, ...(ayar.genel || {}) };
  let onbellek = oku(yol("onbellek.json"), {});
  let onbellekKirli = false;

  function gizlileriOku() {
    try {
      const ham = fs.readFileSync(yol("gizli.bin"));
      return JSON.parse(safeStorage.decryptString(ham));
    } catch { return {}; }
  }
  function gizlileriYaz(g) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Anahtar Zinciri kullanılamıyor; gizli anahtar kaydedilmedi.");
    yaz(yol("gizli.bin"), safeStorage.encryptString(JSON.stringify(g)));
  }

  return {
    ayar: () => ayar,
    gizliler: gizlileriOku,

    // Arayüze giden hâl: gizli alanların değeri değil, yalnızca girilip girilmediği.
    guvenliAyar() {
      const g = gizlileriOku();
      return {
        genel: ayar.genel,
        uygulamalar: ayar.uygulamalar.map((u) => ({
          ...u,
          gizliVar: Object.fromEntries(KAYNAKLAR.map((k) => [k.tur, Object.fromEntries(gizliAlanlar(k.tur).map((a) => [a, Boolean(g[u.id]?.[k.tur]?.[a])]))])),
        })),
      };
    },

    // gelen.gizli[tur][alan]: dolu ise yenisiyle değiştirilir, boş ise eskisi kalır, null ise silinir.
    uygulamaKaydet(gelen) {
      const id = gelen.id || crypto.randomUUID();
      const kaynaklar = {};
      for (const k of KAYNAKLAR) {
        const acik = {};
        for (const a of k.alanlar) {
          if (a.gizli) continue;
          const d = String(gelen.kaynaklar?.[k.tur]?.[a.ad] ?? "").trim();
          if (d) acik[a.ad] = d;
        }
        kaynaklar[k.tur] = acik;
      }
      const g = gizlileriOku();
      let degisti = false;
      g[id] = g[id] || {};
      for (const k of KAYNAKLAR) {
        for (const a of gizliAlanlar(k.tur)) {
          const d = gelen.gizli?.[k.tur]?.[a];
          if (d === null) { if (g[id][k.tur]) { delete g[id][k.tur][a]; degisti = true; } continue; }
          if (typeof d === "string" && d.trim()) { g[id][k.tur] = { ...(g[id][k.tur] || {}), [a]: d.trim() }; degisti = true; }
        }
      }
      if (degisti) gizlileriYaz(g);
      const kayit = { id, ad: String(gelen.ad || "").trim() || "Adsız uygulama", renk: gelen.renk || "#3987e5", kaynaklar };
      const sira = ayar.uygulamalar.findIndex((u) => u.id === id);
      if (sira >= 0) ayar.uygulamalar[sira] = kayit; else ayar.uygulamalar.push(kayit);
      yaz(yol("ayar.json"), JSON.stringify(ayar, null, 2));
      return id;
    },

    uygulamaSil(id) {
      ayar.uygulamalar = ayar.uygulamalar.filter((u) => u.id !== id);
      yaz(yol("ayar.json"), JSON.stringify(ayar, null, 2));
      const g = gizlileriOku();
      if (g[id]) { delete g[id]; gizlileriYaz(g); }
      for (const a of Object.keys(onbellek)) if (a.includes(id)) delete onbellek[a];
      onbellekKirli = true;
    },

    genelKaydet(yeni) {
      const dk = Math.min(240, Math.max(5, Number(yeni.yenilemeDk) || 15));
      const saydamlik = Number.isFinite(Number(yeni.saydamlik)) ? Math.min(100, Math.max(0, Math.round(Number(yeni.saydamlik)))) : ayar.genel.saydamlik;
      ayar.genel = {
        yenilemeDk: dk, sabit: Boolean(yeni.sabit), acilistaBaslat: Boolean(yeni.acilistaBaslat),
        tema: TEMALAR.includes(yeni.tema) ? yeni.tema : ayar.genel.tema, saydamlik,
      };
      yaz(yol("ayar.json"), JSON.stringify(ayar, null, 2));
    },

    onbellek: {
      al: (a) => onbellek[a],
      yaz: (a, d) => { onbellek[a] = d; onbellekKirli = true; },
      kaydet() {
        if (!onbellekKirli) return;
        yaz(yol("onbellek.json"), JSON.stringify(onbellek));
        onbellekKirli = false;
      },
    },
  };
}

module.exports = { depo };
