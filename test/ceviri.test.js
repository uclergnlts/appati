const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { cevirici, dilSec, DILLER } = require("../src/ortak/ceviri");

test("çevirici: tam eşleşme, kalıp, iç içe çeviri, boşluk koruma, eksik kaydı", () => {
  const c = cevirici({
    "Aktif bugün": "Active today",
    "{0} uygulama · {1} itibarıyla": "{0} apps · as of {1}",
    "{0} okunamadı: {1}": "{0} couldn't be read: {1}",
    "Anahtar reddedildi: {0}": "Key rejected: {0}",
    "%{0} · önceki 7g": "{0}% · prev 7d",
    "· çalışıyor": "· working",
    "{1} içinde {0}": "{0} in {1}", // sıra değişebilir
  });
  assert.equal(c("Aktif bugün"), "Active today");
  assert.equal(c("3 uygulama · 14:32 itibarıyla"), "3 apps · as of 14:32");
  assert.equal(c('Supabase okunamadı: Anahtar reddedildi: {"x":1}'), 'Supabase couldn\'t be read: Key rejected: {"x":1}');
  assert.equal(c(" %12 · önceki 7g"), " 12% · prev 7d");
  assert.equal(c(" · çalışıyor"), " · working");
  assert.equal(c("kutu içinde elma"), "elma in kutu");
  assert.equal(c("Bilinmeyen metin"), "Bilinmeyen metin");
  assert.equal(c("ucler."), "ucler.");
  assert.equal(c(""), ""); assert.equal(c(undefined), undefined);
  assert.deepEqual([...c.eksik].sort(), ["Bilinmeyen metin", "ucler."]);
  // Sayı ve simge gibi harfsiz metinler eksik sayılmaz.
  c("1.937"); c("▲");
  assert.equal(c.eksik.size, 2);
});

test("çevirici: daha özel kalıp genel olandan önce denenir", () => {
  const c = cevirici({ "{0}: {1}": "GENEL {0} / {1}", "{0}: {1} okunamıyor": "{1} is unreadable in {0}" });
  assert.equal(c("ucler.: Supabase okunamıyor"), "Supabase is unreadable in ucler.");
  assert.equal(c("a: b"), "GENEL a / b");
});

test("dil seçimi: ayar, sistem dili, bilinmeyen dilde İngilizce", () => {
  assert.equal(dilSec("es", "tr-TR"), "es");
  assert.equal(dilSec(null, "tr-TR"), "tr");
  assert.equal(dilSec(null, "ar-SA"), "ar");
  assert.equal(dilSec(null, "en_GB"), "en");
  assert.equal(dilSec(null, "de-DE"), "en");
  assert.equal(dilSec("sistem", "es-MX"), "es");
  assert.deepEqual([DILLER.ar.yon, DILLER.en.yon], ["rtl", "ltr"]);
});

// Sözlükler: her dilde aynı anahtarlar, her çeviride anahtardaki yer tutucuların aynısı.
const klasor = path.join(__dirname, "..", "src", "ortak", "diller");
const yerTutucu = (s) => [...new Set(s.match(/\{(?:\d+|simdi|bugun)\}/g) || [])].sort().join(",");
const sozlukler = Object.fromEntries(["en", "es", "ar"].map((d) => [d, JSON.parse(fs.readFileSync(path.join(klasor, `${d}.json`), "utf8"))]));

test("sözlükler aynı anahtarları taşır ve boş çeviri içermez", () => {
  const anahtarlar = Object.keys(sozlukler.en).sort();
  assert.ok(anahtarlar.length > 300);
  for (const d of ["es", "ar"]) assert.deepEqual(Object.keys(sozlukler[d]).sort(), anahtarlar, `${d} anahtarları İngilizceyle aynı olmalı`);
  for (const [d, s] of Object.entries(sozlukler)) for (const [k, v] of Object.entries(s)) assert.ok(typeof v === "string" && v.trim(), `${d}: "${k}" boş`);
});

test("sözlüklerde yer tutucular korunur", () => {
  for (const [d, s] of Object.entries(sozlukler)) for (const [k, v] of Object.entries(s)) assert.equal(yerTutucu(v), yerTutucu(k), `${d}: "${k}" → "${v}"`);
});

test("Arapça sözlük Arap harfi, İngilizce ve İspanyolca Türkçeye özgü harf içermez", () => {
  const arap = Object.values(sozlukler.ar).filter((v) => /[؀-ۿ]/.test(v)).length;
  assert.ok(arap / Object.keys(sozlukler.ar).length > 0.9);
  for (const d of ["en", "es"]) {
    const kalan = Object.entries(sozlukler[d]).filter(([, v]) => /[ğışİĞŞ]/.test(v)).map(([k]) => k);
    assert.deepEqual(kalan, [], `${d}: çevrilmemiş görünen metinler`);
  }
});
