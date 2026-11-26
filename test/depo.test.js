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
  assert.equal(guvenli.uygulamalar[0].gizliVar.revenuecat.apiKey, false);
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

test("Anahtar Zinciri izni reddedilince kayıtlı anahtarlar silinmez; arayüz açılışı çözme yapmaz", () => {
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), "appati-"));
  const id = depo(klasor, kasa).uygulamaKaydet({ ad: "ucler.", kaynaklar: { revenuecat: { projectId: "w" } }, gizli: { revenuecat: { apiKey: "ilk-anahtar" } } });
  const ilkDosya = fs.readFileSync(path.join(klasor, "gizli.bin"));

  // Yeni sürüm açıldı, kullanıcı izni reddetti: çözme hata verir.
  let cozme = 0, reddet = true;
  const d = depo(klasor, { ...kasa, decryptString: (b) => { cozme++; if (reddet) throw new Error("reddedildi"); return kasa.decryptString(b); } });
  assert.equal(d.guvenliAyar().uygulamalar[0].gizliVar.revenuecat.apiKey, true); // dizinden; çözme yok
  assert.equal(cozme, 0);
  assert.equal(d.cozmeBekliyor(), true);
  assert.deepEqual(d.gizliler(), {});
  assert.deepEqual([d.kilitli(), cozme], [true, 1]);
  d.gizliler(); // kilitliyken yeniden sorulmaz
  assert.equal(cozme, 1);
  // Kilitliyken yeni anahtar yazmak ya da silmek reddedilir; dosya aynen kalır.
  assert.throws(() => d.uygulamaKaydet({ id, ad: "ucler.", gizli: { supabase: { key: "yeni" } } }), /Anahtar Zinciri izni/);
  assert.throws(() => d.uygulamaSil(id), /Anahtar Zinciri izni/);
  assert.equal(d.ayar().uygulamalar.length, 1);
  assert.deepEqual(fs.readFileSync(path.join(klasor, "gizli.bin")), ilkDosya);
  // Gizli alan içermeyen kayıt (ad değişikliği) kilitliyken de yapılabilir.
  d.uygulamaKaydet({ id, ad: "ucler 2", kaynaklar: { revenuecat: { projectId: "w" } }, gizli: { revenuecat: { apiKey: "" } } });
  assert.equal(d.ayar().uygulamalar[0].ad, "ucler 2");
  // Kullanıcı yenileyip izin verdi: anahtarlar yerinde, sonraki okumalar bellekte.
  reddet = false; d.kilidiSifirla();
  assert.equal(d.gizliler()[id].revenuecat.apiKey, "ilk-anahtar");
  d.gizliler(); d.gizliler();
  assert.equal(cozme, 2);
  d.uygulamaKaydet({ id, ad: "ucler 2", gizli: { supabase: { key: "yeni" } } });
  assert.deepEqual(Object.keys(depo(klasor, kasa).gizliler()[id]).sort(), ["revenuecat", "supabase"]);
});

test("eski sürümden kalan ayar: dizin ilk çözmede kurulur", () => {
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), "appati-"));
  const id = depo(klasor, kasa).uygulamaKaydet({ ad: "x", gizli: { revenuecat: { apiKey: "k" } } });
  const dosya = path.join(klasor, "ayar.json");
  const eski = JSON.parse(fs.readFileSync(dosya, "utf8")); delete eski.gizliVar; fs.writeFileSync(dosya, JSON.stringify(eski));
  const d = depo(klasor, kasa);
  assert.equal(d.guvenliAyar().uygulamalar[0].gizliVar.revenuecat.apiKey, false);
  d.gizliler();
  assert.equal(d.guvenliAyar().uygulamalar[0].gizliVar.revenuecat.apiKey, true);
  assert.equal(JSON.parse(fs.readFileSync(dosya, "utf8")).gizliVar[id].revenuecat.apiKey, true);
});

test("şifreleme yoksa gizli anahtar yazılmaz", () => {
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), "appati-"));
  const d = depo(klasor, { ...kasa, isEncryptionAvailable: () => false });
  assert.throws(() => d.uygulamaKaydet({ ad: "x", gizli: { revenuecat: { apiKey: "k" } } }), /Anahtar Zinciri/);
  assert.ok(!fs.existsSync(path.join(klasor, "gizli.bin")));
});

test("kayıtlar dönüştürülüp kalıcı yazılır; değişiklik yoksa dosyaya dokunulmaz", () => {
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), "appati-"));
  const d = depo(klasor, kasa);
  d.uygulamaKaydet({ ad: "ucler.", kaynaklar: { supabase: { url: "https://x.supabase.co" } } });
  const { sablonlaTamamla } = require("../src/main/katalog");
  assert.equal(d.uygulamalariDonustur(sablonlaTamamla), true);
  const diskte = JSON.parse(fs.readFileSync(path.join(klasor, "ayar.json"), "utf8")).uygulamalar[0].kaynaklar;
  assert.equal(diskte.supabase.url, "https://x.supabase.co");
  assert.match(diskte.umami.huniAdimlari, /kayit_tamam/);
  assert.equal(d.uygulamalariDonustur(sablonlaTamamla), false);
});

test("genel ayarlar sınırlanır", () => {
  const d = depo(fs.mkdtempSync(path.join(os.tmpdir(), "appati-")), kasa);
  d.genelKaydet({ yenilemeDk: 1, sabit: 1 });
  assert.deepEqual(d.ayar().genel, { yenilemeDk: 5, saydamlik: 60, centikEn: 300, centikBoy: 32, centikSaydamlik: 0, sabit: true, acilistaBaslat: false, bildirim: true, centik: true, medya: true, otoGuncelle: true, tema: "sistem", dil: "sistem", cubukSayi: "aktifBugun" });
  // Tek alan gönderilince diğerleri yerinde kalır.
  d.genelKaydet({ medya: false });
  assert.deepEqual([d.ayar().genel.yenilemeDk, d.ayar().genel.sabit, d.ayar().genel.medya], [5, true, false]);
  d.genelKaydet({ centikEn: 9999, centikBoy: 1, centikSaydamlik: 100 });
  assert.deepEqual([d.ayar().genel.centikEn, d.ayar().genel.centikBoy, d.ayar().genel.centikSaydamlik], [480, 22, 80]);
  d.genelKaydet({ yenilemeDk: 30, tema: "koyu", saydamlik: 250 });
  assert.equal(d.ayar().genel.yenilemeDk, 30);
  assert.deepEqual([d.ayar().genel.tema, d.ayar().genel.saydamlik], ["koyu", 100]);
  d.genelKaydet({ bildirim: false, cubukSayi: "mrr" });
  assert.deepEqual([d.ayar().genel.bildirim, d.ayar().genel.cubukSayi], [false, "mrr"]);
  d.genelKaydet({ tema: "pembe", saydamlik: "x" });
  assert.deepEqual([d.ayar().genel.tema, d.ayar().genel.saydamlik], ["koyu", 100]);
});
