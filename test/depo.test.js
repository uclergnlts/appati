// Ayar deposu: gizli alanlar şifreli dosyaya gider, arayüze yalnızca "var / yok" bilgisi döner.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { depo } = require("../src/main/store");

// Gerçek Anahtar Zinciri yerine tanınabilir bir sahte şifreleyici.
const kasa = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from(`ŞİFRELİ:${Buffer.from(s).toString("hex")}`),
  decryptString: (b) => Buffer.from(b.toString().replace("ŞİFRELİ:", ""), "hex").toString(),
};

test("kaydet, gizle, güncelle, sil", () => {
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), "appati-"));
  const d = depo(klasor, kasa);
  const id = d.uygulamaKaydet({ ad: " ucler. ", renk: "#3987e5",
    kaynaklar: { supabase: { url: "https://x.supabase.co", key: "ACIK-ALANA-SIZAN" }, bilinmeyen: { a: 1 } },
    gizli: { supabase: { key: "cok-gizli" } } });

  const ayarDosyasi = fs.readFileSync(path.join(klasor, "ayar.json"), "utf8");
  assert.ok(!ayarDosyasi.includes("cok-gizli") && !ayarDosyasi.includes("ACIK-ALANA-SIZAN"));
  assert.ok(!fs.readFileSync(path.join(klasor, "gizli.bin"), "utf8").includes("cok-gizli"));
  assert.equal(fs.statSync(path.join(klasor, "gizli.bin")).mode & 0o777, 0o600);

  const guvenli = d.guvenliAyar();
  assert.ok(!JSON.stringify(guvenli).includes("cok-gizli"));
  assert.equal(guvenli.uygulamalar[0].ad, "ucler.");
  assert.equal(guvenli.uygulamalar[0].gizliVar.supabase.key, true);
  assert.equal(guvenli.uygulamalar[0].gizliVar.umami.apiKey, false);
  assert.equal(d.gizliler()[id].supabase.key, "cok-gizli");

  // Boş gizli alan eskisini korur; yeniden açılan depo aynı veriyi görür.
  d.uygulamaKaydet({ id, ad: "ucler.", kaynaklar: { supabase: { url: "https://y.supabase.co" } }, gizli: { supabase: { key: "" } } });
  const d2 = depo(klasor, kasa);
  assert.equal(d2.gizliler()[id].supabase.key, "cok-gizli");
  assert.equal(d2.ayar().uygulamalar.length, 1);
  assert.equal(d2.ayar().uygulamalar[0].kaynaklar.supabase.url, "https://y.supabase.co");

  d2.uygulamaSil(id);
  assert.equal(d2.ayar().uygulamalar.length, 0);
  assert.equal(d2.gizliler()[id], undefined);
});

test("şifreleme yoksa gizli anahtar yazılmaz", () => {
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), "appati-"));
  const d = depo(klasor, { ...kasa, isEncryptionAvailable: () => false });
  assert.throws(() => d.uygulamaKaydet({ ad: "x", gizli: { umami: { apiKey: "k" } } }), /Anahtar Zinciri/);
  assert.ok(!fs.existsSync(path.join(klasor, "gizli.bin")));
});

test("genel ayarlar sınırlanır", () => {
  const d = depo(fs.mkdtempSync(path.join(os.tmpdir(), "appati-")), kasa);
  d.genelKaydet({ yenilemeDk: 1, sabit: 1 });
  assert.deepEqual(d.ayar().genel, { yenilemeDk: 5, sabit: true, acilistaBaslat: false });
});
