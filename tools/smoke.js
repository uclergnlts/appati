// Gerçek Electron süreciyle uçtan uca duman testi (Linux'ta: xvfb-run -a node tools/smoke.js).
// Örnek veriyle açılır, şablondan uygulama ekler, sahte anahtarın reddedildiğini ve diske düz yazılmadığını doğrular.
const { _electron: electron } = require("playwright");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert");

(async () => {
  const veri = fs.mkdtempSync(path.join(os.tmpdir(), "appati-duman-"));
  const cikti = path.join(__dirname, "..", "preview");
  fs.mkdirSync(cikti, { recursive: true });
  const uyg = await electron.launch({
    args: [path.join(__dirname, ".."), "--no-sandbox", "--password-store=basic", `--user-data-dir=${veri}`],
    executablePath: require("electron"),
    env: { ...process.env, APPATI_TEST: "1" },
  });
  const hatalar = [];
  // İki pencere var (panel ve çentik); sıraları değişebildiği için paneli adresinden bul.
  await uyg.firstWindow();
  let p = null;
  for (let i = 0; i < 50 && !p; i++) {
    p = uyg.windows().find((w) => w.url().endsWith("index.html")) || null;
    if (!p) await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(p, "panel penceresi bulundu");
  assert.ok(uyg.windows().some((w) => w.url().endsWith("centik.html")), "çentik penceresi kuruldu");
  p.on("pageerror", (e) => hatalar.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") hatalar.push(m.text()); });

  await p.waitForSelector("text=Şu an örnek sayılar görünüyor");
  assert.equal(await p.locator("button.kart").count(), 3, "üç örnek uygulama kartı");
  assert.equal(await p.evaluate(() => typeof window.require), "undefined", "arayüzde Node erişimi yok");

  await p.click('[aria-label="Ayarlar"]');
  await p.click("text=ucler. şablonuyla ekle");
  await p.locator("details", { hasText: "Supabase" }).locator('input[type="password"]').fill("sahte-anahtar-123");
  await p.click("text=Kaydet");
  await p.waitForSelector("text=ucler.");
  await p.waitForSelector(".serit.kotu", { timeout: 30000 });
  const not = await p.locator(".serit.kotu").first().innerText();
  assert.match(not, /Supabase okunamadı/);
  await p.screenshot({ path: path.join(cikti, "duman-hata.png") });

  const ayar = fs.readFileSync(path.join(veri, "ayar.json"), "utf8");
  const gizli = fs.readFileSync(path.join(veri, "gizli.bin"));
  assert.ok(!ayar.includes("sahte-anahtar-123") && !gizli.includes("sahte-anahtar-123"), "anahtar diske düz yazılmadı");
  assert.ok(JSON.parse(ayar).uygulamalar[0].kaynaklar.supabase.url.includes("supabase.co"));

  // Düzenleme ekranı anahtarı geri göstermez.
  await p.click('[aria-label="Ayarlar"]');
  await p.click("button.kart");
  assert.equal(await p.locator("details", { hasText: "Supabase" }).locator('input[type="password"]').inputValue(), "");
  assert.ok(!(await p.content()).includes("sahte-anahtar-123"));
  await p.click("text=Uygulamayı sil");
  await p.click("text=Emin misin?");
  await p.waitForSelector("text=Henüz uygulama eklemedin");
  assert.equal(JSON.parse(fs.readFileSync(path.join(veri, "ayar.json"), "utf8")).uygulamalar.length, 0);

  await uyg.close();
  assert.deepEqual(hatalar, [], "arayüz hatası yok");
  console.log("Duman testi geçti. Supabase notu:", not.replace(/\s+/g, " "));
})().catch((e) => { console.error(e); process.exit(1); });
