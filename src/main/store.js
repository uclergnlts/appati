// Ayarlar, gizli anahtarlar ve önbellek. Hepsi yalnızca bu Mac'te, uygulamanın veri klasöründe durur.
// Gizli anahtarlar macOS Anahtar Zinciri'ne bağlı safeStorage ile şifrelenir.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { KAYNAKLAR, gizliAlanlar } = require("./katalog");

const VARSAYILAN = { uygulamalar: [], genel: { yenilemeDk: 15, sabit: false, acilistaBaslat: false, tema: "sistem", saydamlik: 60, bildirim: true, cubukSayi: "aktifBugun", centik: true, medya: true, centikEn: 300, centikBoy: 32, centikSaydamlik: 0, otoGuncelle: true, dil: "sistem" } };
const DIL_SECENEK = ["sistem", "tr", "en", "es", "ar"];
const CUBUK = ["aktifBugun", "ziyaretciBugun", "yeniKayitBugun", "mrr", "yok"];
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
  let ayar = { ...structuredClone(VARSAYILAN), ...oku(yol("ayar.json"), {}) }; // kopya: varsayılan liste depolar arasında paylaşılmasın
  ayar.genel = { ...VARSAYILAN.genel, ...(ayar.genel || {}) };
  let onbellek = oku(yol("onbellek.json"), {});
  let onbellekKirli = false;

  // Gizli anahtarlar bir kez çözülür ve bellekte tutulur; her çözme macOS Anahtar Zinciri'ne gider ve
  // izin penceresi açıkken uygulamayı bekletir. Çözülemezse (izin reddedildi) "kilitli" sayılır:
  // o durumda dosyanın üzerine asla yazılmaz, yoksa kayıtlı bütün anahtarlar silinirdi.
  let gizliBellek;
  let kilitli = false;
  const gizliDosyaVar = () => fs.existsSync(yol("gizli.bin"));

  function gizlileriOku() {
    if (gizliBellek) return gizliBellek;
    if (!gizliDosyaVar()) { gizliBellek = {}; return gizliBellek; }
    if (kilitli) return null;
    try {
      gizliBellek = JSON.parse(safeStorage.decryptString(fs.readFileSync(yol("gizli.bin"))));
      dizinYaz(gizliBellek);
      return gizliBellek;
    } catch {
      kilitli = true;
      return null;
    }
  }
  function yazilabilir() {
    const g = gizlileriOku();
    if (!g) throw new Error("Anahtar Zinciri izni verilmediği için kayıtlı anahtarlar okunamadı. Paneli yenileyip izin ver, sonra tekrar dene.");
    return g;
  }
  function gizlileriYaz(g) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Anahtar Zinciri kullanılamıyor; gizli anahtar kaydedilmedi.");
    yaz(yol("gizli.bin"), safeStorage.encryptString(JSON.stringify(g)));
    gizliBellek = g;
    dizinYaz(g);
  }
  // Hangi gizli alanların dolu olduğunun (değerlerin değil) dizini ayar.json'da durur;
  // böylece arayüz açılırken Anahtar Zinciri'ne gitmek gerekmez.
  function dizinYaz(g) {
    const dizin = {};
    for (const [id, kaynaklar] of Object.entries(g)) {
      dizin[id] = Object.fromEntries(Object.entries(kaynaklar).map(([tur, alanlar]) => [tur, Object.fromEntries(Object.keys(alanlar).filter((a) => alanlar[a]).map((a) => [a, true]))]));
    }
    if (JSON.stringify(ayar.gizliVar || {}) === JSON.stringify(dizin)) return;
    ayar.gizliVar = dizin;
    yaz(yol("ayar.json"), JSON.stringify(ayar, null, 2));
  }

  return {
    ayar: () => ayar,
    // Çözülmüş anahtarlar; kilitliyse boş döner (kaynaklar "anahtar eksik" diye atlanır).
    gizliler: () => gizlileriOku() || {},
    kilitli: () => kilitli,
    // İlk çözme henüz yapılmadı mı? (yapılınca macOS izin sorabilir)
    cozmeBekliyor: () => !gizliBellek && !kilitli && gizliDosyaVar(),
    // Kullanıcı elle yenileyince izin yeniden denenir.
    kilidiSifirla() { kilitli = false; },

    // Arayüze giden hâl: gizli alanların değeri değil, yalnızca girilip girilmediği. Anahtar Zinciri'ne gitmez.
    guvenliAyar() {
      const dizin = ayar.gizliVar || {};
      return {
        genel: ayar.genel,
        uygulamalar: ayar.uygulamalar.map((u) => ({
          ...u,
          gizliVar: Object.fromEntries(KAYNAKLAR.map((k) => [k.tur, Object.fromEntries(gizliAlanlar(k.tur).map((a) => [a, Boolean(dizin[u.id]?.[k.tur]?.[a])]))])),
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
      // Gizli alan gönderilmediyse Anahtar Zinciri'ne hiç gidilmez.
      const gizliGeldi = KAYNAKLAR.some((k) => gizliAlanlar(k.tur).some((a) => { const d = gelen.gizli?.[k.tur]?.[a]; return d === null || (typeof d === "string" && d.trim()); }));
      const g = gizliGeldi ? structuredClone(yazilabilir()) : {};
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

    // Kayıtlı uygulamaları bir işlevden geçirip değişenleri diske yazar (ör. şablondan eksik alanları tamamlama).
    uygulamalariDonustur(donustur) {
      const yeni = ayar.uygulamalar.map((u) => donustur(u));
      if (JSON.stringify(yeni) === JSON.stringify(ayar.uygulamalar)) return false;
      ayar.uygulamalar = yeni;
      yaz(yol("ayar.json"), JSON.stringify(ayar, null, 2));
      return true;
    },

    uygulamaSil(id) {
      if (gizliDosyaVar()) {
        const g = structuredClone(yazilabilir());
        if (g[id]) { delete g[id]; gizlileriYaz(g); }
      }
      ayar.uygulamalar = ayar.uygulamalar.filter((u) => u.id !== id);
      yaz(yol("ayar.json"), JSON.stringify(ayar, null, 2));
      for (const a of Object.keys(onbellek)) if (a.includes(id)) delete onbellek[a];
      onbellekKirli = true;
    },

    // Yalnızca gönderilen alanlar değişir; gönderilmeyenler olduğu gibi kalır.
    genelKaydet(yeni) {
      const g = ayar.genel;
      const mantik = (ad) => (yeni[ad] === undefined ? g[ad] : Boolean(yeni[ad]));
      const sayi = (ad, alt, ust) => (Number.isFinite(Number(yeni[ad])) && yeni[ad] !== null && yeni[ad] !== "" ? Math.min(ust, Math.max(alt, Math.round(Number(yeni[ad])))) : g[ad]);
      ayar.genel = {
        yenilemeDk: sayi("yenilemeDk", 5, 240), saydamlik: sayi("saydamlik", 0, 100),
        centikEn: sayi("centikEn", 200, 480), centikBoy: sayi("centikBoy", 22, 48), centikSaydamlik: sayi("centikSaydamlik", 0, 80),
        sabit: mantik("sabit"), acilistaBaslat: mantik("acilistaBaslat"), bildirim: mantik("bildirim"), centik: mantik("centik"), medya: mantik("medya"), otoGuncelle: mantik("otoGuncelle"),
        tema: TEMALAR.includes(yeni.tema) ? yeni.tema : g.tema,
        dil: DIL_SECENEK.includes(yeni.dil) ? yeni.dil : g.dil,
        cubukSayi: CUBUK.includes(yeni.cubukSayi) ? yeni.cubukSayi : g.cubukSayi,
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
