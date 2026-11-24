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

  // --- Çentik: örnek veriyle (çalan şarkı dahil) aç, fareyi sahte konumlarla gezdir.
  const veri2 = fs.mkdtempSync(path.join(os.tmpdir(), "appati-duman-"));
  const uyg2 = await electron.launch({
    args: [path.join(__dirname, ".."), "--no-sandbox", `--user-data-dir=${veri2}`],
    executablePath: require("electron"), env: { ...process.env, APPATI_TEST: "1", APPATI_DEMO: "1" },
  });
  await uyg2.firstWindow();
  let c = null;
  for (let i = 0; i < 50 && !c; i++) { c = uyg2.windows().find((w) => w.url().endsWith("centik.html")) || null; if (!c) await new Promise((r) => setTimeout(r, 100)); }
  assert.ok(c, "çentik penceresi bulundu");
  const cHata = [];
  c.on("pageerror", (e) => cHata.push(e.message));
  const sinir = () => uyg2.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().endsWith("centik.html")); return { ...w.getBounds(), gorunur: w.isVisible() }; });
  const fare = (x, y) => uyg2.evaluate(({ screen }, p) => { screen.getCursorScreenPoint = () => p; }, { x, y });
  const orta = await uyg2.evaluate(({ screen }) => { const b = screen.getPrimaryDisplay().bounds; return Math.round(b.x + b.width / 2); });
  const bekle = async (kosul, ne) => { for (let i = 0; i < 60; i++) { if (await kosul()) return; await new Promise((r) => setTimeout(r, 100)); } throw new Error(`zaman aşımı: ${ne}`); };

  await fare(5, 400);
  // Örnek şarkı "çalıyor": kapalıyken küçük ada görünür.
  await bekle(async () => { const s = await sinir(); return s.gorunur && s.width === 310; }, "küçük ada");
  await c.waitForSelector("#kucuk .dalga", { timeout: 3000 }); // veri sayfa yüklenir yüklenmez gelmeli
  assert.equal(await c.locator("#kucuk .dalga i").count(), 5, "ses çubukları");
  assert.equal(await c.locator("#ada.acik").count(), 0);
  // Fare çentiğe gelince büyür ve rakamlar ile şarkı görünür.
  await fare(orta, 2);
  await bekle(async () => (await sinir()).width === 540, "ada açıldı");
  await c.waitForSelector("#ada.acik");
  assert.ok((await c.locator(".rakam").count()) >= 1, "rakamlar");
  assert.equal(await c.locator(".parca b").innerText(), "Örnek Şarkı");
  assert.ok(!/\b(null|undefined|NaN)\b/.test(await c.evaluate(() => document.body.innerText)), "ham değer yok");
  await c.screenshot({ path: path.join(cikti, "duman-centik.png") });
  // Fare uzaklaşınca kapanır ve küçük adaya döner.
  await fare(5, 400);
  await bekle(async () => (await sinir()).width === 310, "küçük adaya dönüş");
  assert.equal(await c.locator("#ada.acik").count(), 0);
  // Rakamlara tıklamak tam paneli açar.
  await fare(orta, 2);
  await c.waitForSelector("#ada.acik");
  await c.click(".rakamlar");
  await bekle(() => uyg2.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().endsWith("index.html")).isVisible()), "panel açıldı");
  // Ayarlardan çentik kapatılınca pencere gizlenir.
  const p2 = uyg2.windows().find((w) => w.url().endsWith("index.html"));
  await fare(5, 400);
  await p2.click('[aria-label="Ayarlar"]');
  await p2.getByLabel("Fare ekranın üst ortasına gelince özeti aç").uncheck();
  await bekle(async () => !(await sinir()).gorunur, "çentik gizlendi");
  await fare(orta, 2);
  await new Promise((r) => setTimeout(r, 700));
  assert.equal((await sinir()).gorunur, false, "kapalıyken fare açmaz");
  await uyg2.close();
  assert.deepEqual(cHata, [], "çentik arayüz hatası yok");
  console.log("Duman testi geçti. Supabase notu:", not.replace(/\s+/g, " "));
})().catch((e) => { console.error(e); process.exit(1); });
