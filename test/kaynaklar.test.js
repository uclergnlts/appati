// Kaynak okuyucuları sahte yanıtlarla sınar: ağ yok, anahtar yok.
const test = require("node:test");
const assert = require("node:assert");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const { istekci, gunAnahtari, GUN } = require("../src/main/util");
const supabase = require("../src/main/sources/supabase");
const ganalytics = require("../src/main/sources/ganalytics");
const umami = require("../src/main/sources/umami");
const searchconsole = require("../src/main/sources/searchconsole");
const youtube = require("../src/main/sources/youtube");
const revenuecat = require("../src/main/sources/revenuecat");
const appstore = require("../src/main/sources/appstore");
const googleplay = require("../src/main/sources/googleplay");
const { uygulamayiTopla, ozetle, sayaclariOku, kaynakSina } = require("../src/main/collect");
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
    huni: sayaclariOku("Eşitlenen | ilerleme |\nPlus | abonelik | bitis=gt.{simdi}"),
  }, { key: "gizli" }, ctx);
  assert.equal(r.kpi.kayitli, 4);
  assert.equal(r.kpi.yeniKayitBugun, 1);
  assert.equal(r.kpi.yeniKayit7g, 2);
  assert.equal(r.kpi.yeniKayitOnceki7g, 1);
  assert.equal(r.kpi.aktifBugun, 7);
  assert.equal(r.seri.kayit.length, 30);
  assert.deepEqual(r.sayaclar, [{ etiket: "Plus", deger: 3 }]);
  assert.equal(r.uyarilar.length, 1);
  assert.deepEqual(r.huni, [{ etiket: "Kayıt olan", deger: 4 }, { etiket: "Eşitlenen", deger: 7 }, { etiket: "Plus", deger: 3 }]);
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

test("istek: bağlantı hatasında bir kez yeniden dener, sonra anlaşılır hata verir", async () => {
  let n = 0;
  const birKezDusen = istekci(async () => { if (n++ === 0) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }); return json({ ok: 1 }); }, 1000, 1);
  assert.deepEqual(await birKezDusen("https://x"), { ok: 1 });
  assert.equal(n, 2);
  const hepDusen = istekci(async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } }); }, 1000, 1);
  await assert.rejects(hepDusen("https://x"), /Bağlanılamadı \(ENOTFOUND\)/);
});

test("umami: paylaşım bağlantısı, bölge seçimi, seri ve kaynaklar", async () => {
  const bugun = gunAnahtari(simdi);
  let ozetSira = 0;
  const { ctx, cagrilar } = sahte([
    [/\/share\/AbC123xyz/, () => json({ websiteId: "site-1", token: "PAY" })],
    // AB bölgesi bu siteyi tanımıyor; veri ABD bölgesinde.
    [/analytics\/eu\/api\/websites/, () => new Response('{"error":{"message":"Unauthorized"}}', { status: 401 })],
    [/\/stats/, () => json(ozetSira++ === 0 ? { visitors: 12, pageviews: 40, comparison: { visitors: 3 } } : { visitors: { value: 80 }, pageviews: { value: 300 } })],
    [/\/pageviews/, () => json({ pageviews: [{ x: `${bugun}T00:00:00Z`, y: 40 }], sessions: [{ x: `${bugun}T00:00:00Z`, y: 14 }] })],
    [/\/active/, () => json({ visitors: 3 })],
    [/type=referrer/, () => json([{ x: "google.com", y: 20 }, { x: "", y: 9 }])],
    [/type=path/, () => new Response("bad", { status: 400 })],
    [/type=url/, () => json([{ x: "/", y: 50 }])],
    [/type=country/, () => json([{ x: "TR", y: 60 }])],
    [/type=event/, () => json([{ x: "anlamadim", y: 9 }, { x: "plus_gor", y: 4 }])],
    [/event-data\/values.*eventName=anlamadim.*propertyName=kart/, () => json([{ value: "fizik.vektorler.4", total: 2 }, { value: "kimya.mol.6", total: 7 }])],
  ]);
  const r = await umami({ huniAdimlari: [{ etiket: "Takılan", olay: "anlamadim" }, { etiket: "Hiç", olay: "olmayan" }], olayDokumleri: [{ etiket: "Anlaşılmayan", olay: "anlamadim", ozellik: "kart" }, { etiket: "Yok", olay: "yok", ozellik: "x" }] }, { paylasim: "https://cloud.umami.is/share/AbC123xyz/ucler.app" }, ctx);
  assert.deepEqual(r.olaylar, [{ ad: "anlamadim", v: 9 }, { ad: "plus_gor", v: 4 }]);
  assert.deepEqual(r.olayListeleri, [{ etiket: "Anlaşılmayan", ogeler: [{ ad: "kimya.mol.6", v: 7 }, { ad: "fizik.vektorler.4", v: 2 }] }]);
  assert.deepEqual(r.siteHunisi, [{ etiket: "Siteye gelen", deger: 80 }, { etiket: "Takılan", deger: 9 }, { etiket: "Hiç", deger: 0 }]);
  assert.equal(r.uyarilar.length, 1); // "Yok" dökümü okunamadı, diğerleri etkilenmedi
  r.uyarilar.length = 0;
  assert.deepEqual([r.kpi.ziyaretciBugun, r.kpi.ziyaretci7g, r.kpi.sitedeSimdi], [12, 80, 3]);
  assert.equal(r.seri.ziyaret[29].v, 14);
  assert.equal(r.kaynaklar[1].ad, "Doğrudan (adres yazan, yer imi)");
  assert.deepEqual(r.sayfalar, [{ ad: "/", v: 50 }]);
  assert.deepEqual(r.uyarilar, []);
  const veri = cagrilar.find((c) => c.url.includes("/us/api/websites/site-1/stats"));
  assert.equal(veri.secenek.headers["x-umami-share-token"], "PAY");
  assert.equal(veri.secenek.headers["x-umami-share-context"], "1");
  // Bulunan bölge hatırlanır: ikinci turda önce o denenir.
  assert.equal(ctx.onbellek.m["umami.bolge.AbC123xyz"], "https://cloud.umami.is/analytics/us/api");
  cagrilar.length = 0; ozetSira = 0;
  await umami({}, { paylasim: "AbC123xyz" }, ctx);
  assert.ok(cagrilar[0].url.includes("/us/api/share/"));
  assert.ok(!cagrilar.some((c) => c.url.includes("/eu/api/")));
  // Kendi sunucusundaki Umami tek adres kullanır; tanınmayan girdi anlaşılır hata verir.
  assert.deepEqual(umami.baglantiCoz("https://istatistik.example.com/share/Qwerty12/site").tabanlar, ["https://istatistik.example.com/api"]);
  await assert.rejects(umami({}, { paylasim: "merhaba dünya" }, ctx), /tanınmadı/);
  await assert.rejects(umami({}, { paylasim: "Yok12345" }, sahte([]).ctx), /bulunamadı/);
});

test("search console: haftalık toplamlar son veri gününe göre, sorgular, sayfalar, hata çevirileri", async () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const hesap = JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", project_id: "proje", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) });
  // 3 gün gecikmeli 16 günlük veri: her gün 10 tıklama, son 7 günde 20.
  const gunluk = Array.from({ length: 16 }, (_, i) => ({ keys: [gunAnahtari(gunOnce(18 - i))], clicks: i >= 9 ? 20 : 10, impressions: 100, position: 5 }));
  const { ctx, cagrilar } = sahte([
    [/oauth2/, () => json({ access_token: "tok" })],
    [/searchAnalytics/, (_u, s) => {
      const b = JSON.parse(s.body);
      if (b.dimensions[0] === "date") return json({ rows: gunluk });
      if (b.dimensions[0] === "query") return json({ rows: [{ keys: ["vektör nedir"], clicks: 64, impressions: 1210, position: 4.23 }] });
      return json({ rows: [{ keys: ["https://ucler.app/fizik/vektorler/?a=1"], clicks: 71, impressions: 1400, position: 5 }] });
    }],
  ]);
  const r = await searchconsole({ siteUrl: "ucler.app" }, { serviceAccount: hesap }, ctx);
  assert.ok(cagrilar.some((c) => c.url.includes(encodeURIComponent("sc-domain:ucler.app"))));
  assert.deepEqual([r.kpi.aramaTiklama7g, r.kpi.aramaTiklamaOnceki7g, r.kpi.aramaGosterim7g], [140, 70, 700]);
  assert.equal(r.arama.sonGun, gunAnahtari(gunOnce(3)));
  assert.equal(r.arama.sorgular[0].ad, "vektör nedir");
  assert.match(r.arama.sorgular[0].alt, /1\.210 gösterim · ortalama 4,2\. sıra/);
  assert.equal(r.arama.sayfalar[0].ad, "/fizik/vektorler/?a=1");
  assert.equal(searchconsole.mulkCoz("https://ucler.app"), "https://ucler.app/");
  assert.equal(searchconsole.mulkCoz("sc-domain:x.com"), "sc-domain:x.com");
  // Bir haftadan az veri varken önceki hafta karşılaştırması uydurulmaz.
  const az = sahte([[/oauth2/, () => json({ access_token: "t" })], [/searchAnalytics/, () => json({ rows: gunluk.slice(0, 5) })]]).ctx;
  assert.equal((await searchconsole({ siteUrl: "ucler.app" }, { serviceAccount: hesap }, az)).kpi.aramaTiklamaOnceki7g, undefined);
  const ret = (mesaj, durum = 403) => sahte([[/oauth2/, () => json({ access_token: "t" })], [/searchAnalytics/, () => new Response(JSON.stringify({ error: { message: mesaj } }), { status: durum })]]).ctx;
  await assert.rejects(searchconsole({ siteUrl: "ucler.app" }, { serviceAccount: hesap }, ret("Google Search Console API has not been used in project 9 before or it is disabled.")), /Search Console API” kapalı/);
  await assert.rejects(searchconsole({ siteUrl: "ucler.app" }, { serviceAccount: hesap }, ret("User does not have sufficient permission for site 'sc-domain:ucler.app'.")), /Kullanıcılar ve izinler.*a@b\.iam/);
});

test("youtube: kanal çözme, rakamlar, videolar, haftalık değişim, hata çevirileri", async () => {
  assert.deepEqual(youtube.kanalCoz("@ucler"), { forHandle: "@ucler" });
  assert.deepEqual(youtube.kanalCoz("https://www.youtube.com/@ucler.app/videos"), { forHandle: "@ucler.app" });
  assert.deepEqual(youtube.kanalCoz("https://youtube.com/channel/UCabcdefghijklmnopqrstuv"), { id: "UCabcdefghijklmnopqrstuv" });
  assert.deepEqual(youtube.kanalCoz("UCabcdefghijklmnopqrstuv"), { id: "UCabcdefghijklmnopqrstuv" });
  assert.deepEqual(youtube.kanalCoz("ucler"), { forHandle: "@ucler" });
  assert.equal(youtube.kanalCoz("bu bir kanal değil!"), null);

  const kanal = (id, ad, abone, gor) => ({ id, snippet: { title: ad }, statistics: { subscriberCount: String(abone), viewCount: String(gor), videoCount: "3" }, contentDetails: { relatedPlaylists: { uploads: `UU${id}` } } });
  const { ctx, cagrilar } = sahte([
    [/channels.*forHandle=%40ucler/, () => json({ items: [kanal("UC1", "ucler", 1240, 86400)] })],
    [/channels.*forHandle=%40yok/, () => json({ items: [] })],
    [/channels.*id=UCgizliabcdefghijklmnopq/, () => json({ items: [{ id: "UCgizliabcdefghijklmnopq", snippet: { title: "Gizli" }, statistics: { hiddenSubscriberCount: true, viewCount: "10", videoCount: "0" } }] })],
    [/playlistItems/, () => json({ items: [{ contentDetails: { videoId: "v1" } }, { contentDetails: { videoId: "v2" } }] })],
    [/videos/, () => json({ items: [
      { snippet: { title: "Eski", publishedAt: "2026-11-01T10:00:00Z" }, statistics: { viewCount: "500", likeCount: "20", commentCount: "3" } },
      { snippet: { title: "Yeni", publishedAt: "2026-11-20T10:00:00Z" }, statistics: { viewCount: "12400", likeCount: "310" } },
    ] })],
  ]);
  // Bir hafta önceki kayıt varsa değişim hesaplanır.
  ctx.onbellek.yaz("youtube.gecmis.UC1", { [gunAnahtari(gunOnce(7))]: { abone: 1200, goruntuleme: 81000 }, [gunAnahtari(gunOnce(40))]: { abone: 1, goruntuleme: 1 } });
  const r = await youtube({ kanallar: "@ucler\n@yok\nUCgizliabcdefghijklmnopq\n???" }, { apiKey: "AIzaX" }, ctx);
  assert.ok(cagrilar.every((c) => c.url.includes("key=AIzaX")));
  const [k1, k2] = r.youtube.kanallar;
  assert.deepEqual([k1.ad, k1.abone, k1.abone7g, k1.goruntuleme7g, k1.video], ["ucler", 1240, 40, 5400, 3]);
  assert.deepEqual(k1.videolar.map((v) => [v.ad, v.v]), [["Yeni", 12400], ["Eski", 500]]);
  assert.match(k1.videolar[0].alt, /310 beğeni · 0 yorum · 20 Kas/);
  assert.deepEqual([k2.abone, k2.goruntuleme7g], [undefined, undefined]);
  assert.deepEqual([r.kpi.ytAbone, r.kpi.ytGoruntuleme, r.kpi.ytGoruntuleme7g], [1240, 86410, 5400]);
  assert.equal(r.uyarilar.length, 2); // bulunamayan kanal ve tanınmayan satır
  assert.deepEqual(Object.keys(ctx.onbellek.m["youtube.gecmis.UC1"]).sort(), [gunAnahtari(gunOnce(7)), gunAnahtari(simdi)].sort());

  const ret = (mesaj) => sahte([[/channels/, () => new Response(JSON.stringify({ error: { message: mesaj } }), { status: 403 })]]).ctx;
  await assert.rejects(youtube({ kanallar: "@a1" }, { apiKey: "k" }, ret("YouTube Data API v3 has not been used in project 9 before or it is disabled.")), /Data API v3” kapalı/);
  await assert.rejects(youtube({ kanallar: "@a1" }, { apiKey: "k" }, ret("API key not valid. Please pass a valid API key.")), /anahtarı geçersiz/);
  await assert.rejects(youtube({ kanallar: "@a1" }, { apiKey: "k" }, ret("The request cannot be completed because you have exceeded your quota.")), /kotası doldu/);
  await assert.rejects(youtube({ kanallar: "@yok" }, { apiKey: "k" }, ctx), /bulunamadı/);
});

test("google analytics: raporlar, tarih aralıkları, kaynak adları, hata çevirileri", async () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const hesap = JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", project_id: "proje", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) });
  const satir = (boyutlar, metrikler) => ({ dimensionValues: boyutlar.map((value) => ({ value })), metricValues: metrikler.map((v) => ({ value: String(v) })) });
  const bugun = gunAnahtari(simdi).replaceAll("-", "");
  const govdeler = [];
  const { ctx } = sahte([
    [/oauth2/, () => json({ access_token: "tok" })],
    [/runRealtimeReport/, () => json({ rows: [satir([], [4])] })],
    [/batchRunReports/, (_u, s) => {
      const g = JSON.parse(s.body); govdeler.push(g);
      if (g.requests.length === 1) return json({ reports: [{ rows: [satir(["Turkey"], [60]), satir(["(not set)"], [2])] }] });
      return json({ reports: [
        { rows: [satir([], [12, 40])] },
        { rows: [satir(["date_range_0"], [80, 300])] }, // önceki hafta boş: satırı hiç gelmez
        { rows: [satir([bugun], [14, 40])] },
        { rows: [satir(["google"], [20]), satir(["(direct)"], [9]), satir(["sifir"], [0])] },
        { rows: [satir(["/"], [50])] },
      ] });
    }],
  ]);
  const r = await ganalytics({ propertyId: "properties/123" }, { serviceAccount: hesap }, ctx);
  assert.deepEqual([r.kpi.ziyaretciBugun, r.kpi.goruntulemeBugun, r.kpi.ziyaretci7g, r.kpi.ziyaretciOnceki7g, r.kpi.sitedeSimdi], [12, 40, 80, 0, 4]);
  assert.equal(r.seri.ziyaret[29].v, 14);
  assert.deepEqual(r.kaynaklar, [{ ad: "google", v: 20 }, { ad: "Doğrudan (adres yazan, yer imi)", v: 9 }]);
  assert.deepEqual(r.sayfalar, [{ ad: "/", v: 50 }]);
  assert.deepEqual(r.ulkeler, [{ ad: "Turkey", v: 60 }, { ad: "Bilinmiyor", v: 2 }]);
  assert.equal(govdeler.find((g) => g.requests.length === 5).requests[1].dateRanges.length, 2);

  await assert.rejects(ganalytics({ propertyId: "G-ABC123" }, { serviceAccount: hesap }, ctx), /yalnızca rakamlardan/);
  const ret = (mesaj, durum = 403) => sahte([[/oauth2/, () => json({ access_token: "t" })], [/analyticsdata/, () => new Response(JSON.stringify({ error: { message: mesaj } }), { status: durum })]]).ctx;
  await assert.rejects(ganalytics({ propertyId: "1" }, { serviceAccount: hesap }, ret("Google Analytics Data API has not been used in project 9 before or it is disabled.")), /Data API” kapalı/);
  await assert.rejects(ganalytics({ propertyId: "1" }, { serviceAccount: hesap }, ret("User does not have sufficient permissions for this property.")), /Görüntüleyici olarak ekle/);
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
  // Google'ın bilinen retleri ne yapılacağını söyleyen mesaja çevrilir.
  const ret = (govde, durum = 403) => sahte([[/oauth2/, () => json({ access_token: "t" })], [/reviews/, () => new Response(JSON.stringify({ error: { message: govde } }), { status: durum })]]).ctx;
  await assert.rejects(googleplay({ packageName: "p" }, { serviceAccount: hesap }, ret("Google Play Android Developer API has not been used in project 1 before or it is disabled.")), /API” kapalı/);
  await assert.rejects(googleplay({ packageName: "p" }, { serviceAccount: hesap }, ret("The caller does not have permission", 401)), /Kullanıcılar ve izinler.*a@b\.iam/);
  await assert.rejects(googleplay({ packageName: "p" }, { serviceAccount: hesap }, ret("Package not found", 404)), /bulunamadı/);
});

test("birleştirme: bozuk kaynak diğerlerini düşürmez, boş kaynak atlanır", async () => {
  const { ctx } = sahte([
    [/admin\/users/, () => json({ users: [{ created_at: simdi.toISOString(), last_sign_in_at: simdi.toISOString() }] })],
    [/revenuecat/, () => new Response("no", { status: 403 })],
  ]);
  const u = await uygulamayiTopla(
    { id: "a1", ad: "Deneme", kaynaklar: { supabase: { url: "https://x.supabase.co" }, revenuecat: { projectId: "p" }, appstore: { appId: "1" } } },
    { supabase: { key: "k" }, revenuecat: { apiKey: "sk" } }, ctx);
  assert.deepEqual(u.kaynaklar.map((k) => [k.tur, k.tamam]), [["supabase", true], ["revenuecat", false]]);
  assert.equal(u.kpi.kayitli, 1);
  assert.ok(u.notlar.some((n) => n.tur === "kotu" && n.metin.includes("RevenueCat")));
  assert.equal(u.seri.aktif[29].v, 1);
  const o = ozetle([u]);
  assert.equal(o.kpi.kayitli, 1);
  assert.equal(o.notlar[0].uygulama, "Deneme");
  assert.ok(u.haftalik.some((s) => s.etiket === "Kayıtlı kullanıcı")); // haftalık özet birleştirmede üretilir
  assert.deepEqual(Object.keys(ctx.onbellek.m["gunluk.a1"]), [gunAnahtari(simdi)]);
});

test("google analytics, Google Play'e girilen servis hesabını paylaşır", async () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const hesap = JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) });
  const { ctx, cagrilar } = sahte([[/oauth2/, () => json({ access_token: "t" })], [/analyticsdata/, () => json({ reports: [] })], [/androidpublisher/, () => json({ reviews: [] })]]);
  const u = await uygulamayiTopla({ id: "g1", ad: "x", kaynaklar: { ganalytics: { propertyId: "123" }, googleplay: { packageName: "app.x" } } }, { googleplay: { serviceAccount: hesap } }, ctx);
  assert.deepEqual(u.kaynaklar.map((k) => [k.tur, k.tamam]), [["ganalytics", true], ["googleplay", true]]);
  assert.ok(cagrilar.some((c) => c.url.includes("analyticsdata")));
  // Yalnızca gizli alanı olan kaynak (Umami) açık alan olmadan da çalışır.
  const um = await uygulamayiTopla({ id: "g3", ad: "z", kaynaklar: {} }, { umami: { paylasim: "Yok12345" } }, sahte([]).ctx);
  assert.deepEqual(um.kaynaklar.map((k) => [k.tur, k.tamam]), [["umami", false]]);
  // Google Play de yoksa Analytics sessizce atlanır.
  const v = await uygulamayiTopla({ id: "g2", ad: "y", kaynaklar: { ganalytics: { propertyId: "123" } } }, {}, ctx);
  assert.deepEqual(v.kaynaklar, []);
});

test("bağlantı sınama: taslak değerle dener, kayıtlı anahtarı kullanır, önbelleğe yazmaz", async () => {
  const { ctx, cagrilar } = sahte([[/metrics\/overview/, (_u, s) => (s.headers.Authorization === "Bearer sk_dogru" ? json({ metrics: [] }) : new Response("no", { status: 401 }))]]);
  // Taslakta gizli alan boş: kayıtlı anahtar kullanılır.
  assert.deepEqual(await kaynakSina("revenuecat", { kaynaklar: { revenuecat: { projectId: "p" } }, gizli: { revenuecat: { apiKey: "" } } }, { revenuecat: { apiKey: "sk_dogru" } }, ctx), { tamam: true, mesaj: "Bağlantı çalışıyor.", uyarilar: [] });
  // Taslaktaki yeni anahtar kayıtlı olanın önüne geçer.
  const r = await kaynakSina("revenuecat", { kaynaklar: { revenuecat: { projectId: "p" } }, gizli: { revenuecat: { apiKey: "sk_yanlis" } } }, { revenuecat: { apiKey: "sk_dogru" } }, ctx);
  assert.deepEqual([r.tamam, /Anahtar reddedildi/.test(r.mesaj)], [false, true]);
  assert.equal(cagrilar.at(-1).secenek.headers.Authorization, "Bearer sk_yanlis");
  // Eksik alan ve bilinmeyen kaynak istek atmadan döner.
  const once = cagrilar.length;
  assert.equal((await kaynakSina("revenuecat", { kaynaklar: {}, gizli: {} }, {}, ctx)).mesaj, "Önce bu kaynağın alanlarını doldur.");
  assert.equal((await kaynakSina("yok", {}, {}, ctx)).tamam, false);
  assert.equal(cagrilar.length, once);
  // Gerçek önbelleğe dokunmaz (Umami bölge kaydı gibi).
  const u = sahte([[/\/share\//, () => json({ websiteId: "s", token: "t" })], [/./, () => json({ visitors: 1, pageviews: 1, pageviews_: [] })]]);
  await kaynakSina("umami", { kaynaklar: {}, gizli: { umami: { paylasim: "AbC123xyz" } } }, {}, u.ctx);
  assert.deepEqual(u.ctx.onbellek.m, {});
});

test("örnek veri eksiksiz ve gün içinde sabit", () => {
  const a = demoUygulamalar(simdi), b = demoUygulamalar(new Date(simdi.getTime() + 60000));
  assert.equal(a.length, 3);
  assert.deepEqual(a.map((u) => u.kpi), b.map((u) => u.kpi));
  assert.ok(a.every((u) => u.demo && u.seri.ziyaret.length === 30 && u.notlar.length));
});
