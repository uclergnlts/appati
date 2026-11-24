// Kaynak okuyucuları sahte yanıtlarla sınar: ağ yok, anahtar yok.
const test = require("node:test");
const assert = require("node:assert");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const { istekci, gunAnahtari, GUN } = require("../src/main/util");
const supabase = require("../src/main/sources/supabase");
const umami = require("../src/main/sources/umami");
const revenuecat = require("../src/main/sources/revenuecat");
const appstore = require("../src/main/sources/appstore");
const googleplay = require("../src/main/sources/googleplay");
const { uygulamayiTopla, ozetle, sayaclariOku } = require("../src/main/collect");
const { demoUygulamalar } = require("../src/main/demo");

const simdi = new Date(2026, 10, 24, 15, 0, 0);
const gunOnce = (n) => new Date(simdi.getTime() - n * GUN);

function bellek() {
  const m = {};
  return { al: (a) => m[a], yaz: (a, d) => { m[a] = d; }, kaydet() {}, m };
}

// yollar: [[düzenli ifade, (url, secenek) => Response], ...]
function sahte(yollar) {
  const cagrilar = [];
  const fetchFn = async (url, secenek = {}) => {
    cagrilar.push({ url: String(url), secenek });
    for (const [desen, yanit] of yollar) if (desen.test(String(url))) return yanit(String(url), secenek);
    return new Response("yok", { status: 404 });
  };
  return { ctx: { istek: istekci(fetchFn), simdi, onbellek: bellek() }, cagrilar };
}
const json = (v, ek) => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json", ...(ek || {}) } });

test("supabase: kayıt, aktiflik ve sayaçlar", async () => {
  const users = [
    { created_at: simdi.toISOString(), last_sign_in_at: simdi.toISOString() },
    { created_at: gunOnce(2).toISOString(), last_sign_in_at: gunOnce(2).toISOString() },
    { created_at: gunOnce(9).toISOString(), last_sign_in_at: gunOnce(9).toISOString() },
    { created_at: gunOnce(90).toISOString(), last_sign_in_at: null },
  ];
  const { ctx, cagrilar } = sahte([
    [/auth\/v1\/admin\/users/, () => json({ users })],
    [/rest\/v1\/ilerleme/, () => json([], { "content-range": "0-0/7" })],
    [/rest\/v1\/abonelik/, () => json([], { "content-range": "*/3" })],
    [/rest\/v1\/bozuk/, () => new Response("{}", { status: 404 })],
  ]);
  const r = await supabase({
    url: "https://x.supabase.co/", aktifTablo: "ilerleme", aktifSutun: "guncelleme",
    sayaclar: sayaclariOku("Plus | abonelik | bitis=gt.{simdi}\nBozuk | bozuk |"),
  }, { key: "gizli" }, ctx);
  assert.equal(r.kpi.kayitli, 4);
  assert.equal(r.kpi.yeniKayitBugun, 1);
  assert.equal(r.kpi.yeniKayit7g, 2);
  assert.equal(r.kpi.yeniKayitOnceki7g, 1);
  assert.equal(r.kpi.aktifBugun, 7);
  assert.equal(r.seri.kayit.length, 30);
  assert.deepEqual(r.sayaclar, [{ etiket: "Plus", deger: 3 }]);
  assert.equal(r.uyarilar.length, 1);
  assert.equal(cagrilar[0].secenek.headers.apikey, "gizli");
  assert.ok(!cagrilar.find((c) => c.url.includes("abonelik")).url.includes("{simdi}"));
});

test("supabase: aktiflik tablosu yoksa son girişe bakar", async () => {
  const { ctx } = sahte([[/admin\/users/, () => json({ users: [
    { created_at: gunOnce(40).toISOString(), last_sign_in_at: simdi.toISOString() },
    { created_at: gunOnce(40).toISOString(), last_sign_in_at: gunOnce(3).toISOString() },
  ] })]]);
  const r = await supabase({ url: "https://x.supabase.co" }, { key: "k" }, ctx);
  assert.equal(r.kpi.aktifBugun, 1);
  assert.equal(r.kpi.aktif7g, 2);
});

test("supabase: reddedilen anahtar anlaşılır hata verir", async () => {
  const { ctx } = sahte([[/admin\/users/, () => new Response('{"message":"Invalid API key"}', { status: 401 })]]);
  await assert.rejects(supabase({ url: "https://x.supabase.co" }, { key: "k" }, ctx), /Anahtar reddedildi/);
});

test("umami: eski ve yeni özet biçimi, kaynaklar, seri", async () => {
  const bugun = gunAnahtari(simdi);
  let ozetSira = 0;
  const { ctx } = sahte([
    [/\/stats/, () => json(ozetSira++ === 0 ? { visitors: { value: 12, prev: 9 }, pageviews: { value: 40 } } : { visitors: 80, pageviews: 300 })],
    [/\/pageviews/, () => json({ pageviews: [{ x: `${bugun} 00:00:00`, y: 40 }], sessions: [{ x: `${bugun} 00:00:00`, y: 14 }] })],
    [/\/active/, () => json({ visitors: 3 })],
    [/type=referrer/, () => json([{ x: "google.com", y: 20 }, { x: "", y: 9 }])],
    [/type=path/, () => new Response("bad", { status: 400 })],
    [/type=url/, () => json([{ x: "/", y: 50 }])],
    [/type=country/, () => json([{ x: "TR", y: 60 }])],
  ]);
  const r = await umami({ websiteId: "w" }, { apiKey: "a" }, ctx);
  assert.equal(r.kpi.ziyaretciBugun, 12);
  assert.equal(r.kpi.ziyaretci7g, 80);
  assert.equal(r.kpi.sitedeSimdi, 3);
  assert.equal(r.seri.ziyaret[29].v, 14);
  assert.equal(r.kaynaklar[1].ad, "Doğrudan (adres yazan, yer imi)");
  assert.deepEqual(r.sayfalar, [{ ad: "/", v: 50 }]);
  assert.deepEqual(r.uyarilar, []);
});

test("revenuecat: özet metrikleri", async () => {
  const { ctx, cagrilar } = sahte([[/metrics\/overview/, () => json({ metrics: [
    { id: "active_subscriptions", value: 86 }, { id: "active_trials", value: 12 }, { id: "mrr", value: 412.4, unit: "$" }, { id: "revenue", value: 520 },
  ] })]]);
  const r = await revenuecat({ projectId: "proj1" }, { apiKey: "sk_x" }, ctx);
  assert.deepEqual([r.kpi.abone, r.kpi.deneme, r.kpi.mrr, r.kpi.gelir28g], [86, 12, 412.4, 520]);
  assert.equal(cagrilar[0].secenek.headers.Authorization, "Bearer sk_x");
});

test("appstore: imzalı istek, yorumlar ve satış raporu", async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const p8 = privateKey.export({ type: "pkcs8", format: "pem" });
  const tsv = ["Provider\tSKU\tProduct Type Identifier\tUnits\tApple Identifier",
    "APPLE\ta\t1F\t5\t111", "APPLE\ta\t1\t2\t111", "APPLE\ta\t7\t40\t111", "APPLE\ta\tIA1\t3\t111", "APPLE\tb\t1F\t9\t222"].join("\n");
  const dun = gunAnahtari(gunOnce(1));
  const { ctx, cagrilar } = sahte([
    [/customerReviews/, () => json({ data: [{ attributes: { rating: 5, title: "Süper", body: "Çok iyi", reviewerNickname: "x", territory: "TUR", createdDate: "2026-11-20T10:00:00Z" } }] })],
    [/salesReports/, (url) => (decodeURIComponent(url).includes(`filter[reportDate]=${dun}`) ? new Response(zlib.gzipSync(tsv), { status: 200 }) : new Response("", { status: 404 }))],
  ]);
  const r = await appstore({ appId: "111", issuerId: "iss", keyId: "KID", vendorNumber: "8" }, { p8 }, ctx);
  assert.equal(r.yorumlar[0].baslik, "Süper");
  assert.equal(r.kpi.kurulumIos7g, 7);
  assert.equal(r.kurulumSonGun, dun);
  assert.equal(ctx.onbellek.m[`appstore.111.${dun}`], 7);
  const [bas, yuk, imza] = cagrilar[0].secenek.headers.Authorization.replace("Bearer ", "").split(".");
  assert.equal(JSON.parse(Buffer.from(bas, "base64url")).kid, "KID");
  assert.equal(JSON.parse(Buffer.from(yuk, "base64url")).aud, "appstoreconnect-v1");
  assert.ok(crypto.verify("sha256", Buffer.from(`${bas}.${yuk}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(imza, "base64url")));
  // İkinci turda kesinleşen gün yeniden indirilmez.
  const once = cagrilar.filter((c) => decodeURIComponent(c.url).includes(dun)).length;
  await appstore({ appId: "111", issuerId: "iss", keyId: "KID", vendorNumber: "8" }, { p8 }, ctx);
  assert.equal(cagrilar.filter((c) => decodeURIComponent(c.url).includes(dun)).length, once);
});

test("googleplay: jeton alır, yorumları çevirir", async () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const hesap = JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) });
  const { ctx, cagrilar } = sahte([
    [/oauth2\.googleapis\.com\/token/, () => json({ access_token: "tok" })],
    [/reviews/, () => json({ reviews: [{ authorName: "Ali", comments: [{ userComment: { text: "\tGüzel ", starRating: 4, lastModified: { seconds: "1795000000" }, reviewerLanguage: "tr" } }] }] })],
  ]);
  const r = await googleplay({ packageName: "app.ucler" }, { serviceAccount: hesap }, ctx);
  assert.equal(r.yorumlar[0].metin, "Güzel");
  assert.equal(r.yorumlar[0].puan, 4);
  assert.equal(cagrilar[1].secenek.headers.Authorization, "Bearer tok");
  await assert.rejects(googleplay({ packageName: "p" }, { serviceAccount: "{bozuk" }, ctx), /okunamadı/);
});

test("birleştirme: bozuk kaynak diğerlerini düşürmez, boş kaynak atlanır", async () => {
  const { ctx } = sahte([
    [/admin\/users/, () => json({ users: [{ created_at: simdi.toISOString(), last_sign_in_at: simdi.toISOString() }] })],
    [/revenuecat/, () => new Response("no", { status: 403 })],
  ]);
  const u = await uygulamayiTopla(
    { id: "a1", ad: "ucler.", kaynaklar: { supabase: { url: "https://x.supabase.co" }, revenuecat: { projectId: "p" }, umami: { websiteId: "w" } } },
    { supabase: { key: "k" }, revenuecat: { apiKey: "sk" } }, ctx);
  assert.deepEqual(u.kaynaklar.map((k) => [k.tur, k.tamam]), [["supabase", true], ["revenuecat", false]]);
  assert.equal(u.kpi.kayitli, 1);
  assert.ok(u.notlar.some((n) => n.tur === "kotu" && n.metin.includes("RevenueCat")));
  assert.equal(u.seri.aktif[29].v, 1);
  const o = ozetle([u]);
  assert.equal(o.kpi.kayitli, 1);
  assert.equal(o.notlar[0].uygulama, "ucler.");
});

test("örnek veri eksiksiz ve gün içinde sabit", () => {
  const a = demoUygulamalar(simdi), b = demoUygulamalar(new Date(simdi.getTime() + 60000));
  assert.equal(a.length, 3);
  assert.deepEqual(a.map((u) => u.kpi), b.map((u) => u.kpi));
  assert.ok(a.every((u) => u.demo && u.seri.ziyaret.length === 30 && u.notlar.length));
});
