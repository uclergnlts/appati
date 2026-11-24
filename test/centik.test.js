const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");

// centik.js Electron'u yükler; saf karar işlevini sınamak için sahtesiyle değiştir.
const asil = Module._load;
Module._load = (ad, ...kalan) => (ad === "electron" ? { BrowserWindow: class {}, screen: {} } : asil(ad, ...kalan));
const { adim, kucukBoy, EN, BOY, KUCUK_EN } = require("../src/main/centik");
const { medya, spotifyCoz, youtubeCoz } = require("../src/main/medya");
Module._load = asil;

const ekran = { x: 0, y: 0, width: 1512, height: 982 };
const pencere = { x: 1512 / 2 - EN / 2, y: 0, width: EN, height: BOY };
const kapali = { acik: false, girme: 0, cikma: 0 };

test("çentik: iki ardışık tikte açılır, uzaklaşınca üç tikte kapanır", () => {
  const ust = { x: 756, y: 2 };
  let d = adim(kapali, ust, ekran, pencere);
  assert.equal(d.eylem, null);
  d = adim(d, ust, ekran, pencere);
  assert.equal(d.eylem, "ac");
  // Pencerenin içinde gezinirken açık kalır.
  d = adim(d, { x: 600, y: 120 }, ekran, pencere);
  assert.deepEqual([d.acik, d.eylem], [true, null]);
  const uzak = { x: 200, y: 500 };
  d = adim(d, uzak, ekran, pencere); d = adim(d, uzak, ekran, pencere);
  assert.equal(d.acik, true);
  d = adim(d, uzak, ekran, pencere);
  assert.deepEqual([d.acik, d.eylem], [false, "kapat"]);
});

test("çentik: kenardan geçen ya da menüye giden fare açmaz", () => {
  let d = adim(kapali, { x: 756, y: 2 }, ekran, pencere);
  d = adim(d, { x: 300, y: 2 }, ekran, pencere); // sola kaydı: sayaç sıfırlanır
  d = adim(d, { x: 756, y: 2 }, ekran, pencere);
  assert.equal(d.acik, false);
  assert.equal(adim({ acik: false, girme: 1, cikma: 0 }, { x: 756, y: 20 }, ekran, pencere).acik, false);
  // İkinci ekran solda (negatif koordinat): bölge o ekranın ortasına göre hesaplanır.
  const sol = { x: -1920, y: 0, width: 1920, height: 1080 };
  assert.equal(adim({ acik: false, girme: 1, cikma: 0 }, { x: -960, y: 1 }, sol, pencere).eylem, "ac");
});

test("çentik: küçük ada görünürken adanın tamamı tetikler; yüksekliği menü çubuğuna uyar", () => {
  const kulak = { x: 756 + 140, y: 20 }; // çentiğin sağındaki kulak, üst şeridin altında
  assert.equal(adim({ acik: false, girme: 1, cikma: 0 }, kulak, ekran, pencere).acik, false);
  assert.equal(adim({ acik: false, girme: 1, cikma: 0 }, kulak, ekran, pencere, { en: KUCUK_EN, boy: 38 }).eylem, "ac");
  assert.deepEqual([kucukBoy(38), kucukBoy(24.5), kucukBoy(0), kucukBoy(90)], [38, 25, 24, 40]);
});

test("medya: Spotify ve YouTube çıktıları çözülür", () => {
  assert.deepEqual(spotifyCoz("playing\u001fŞarkı\u001fSanatçı\u001fhttps://i.scdn.co/image/abc"),
    { kaynak: "spotify", oynuyor: true, baslik: "Şarkı", alt: "Sanatçı", kapak: "https://i.scdn.co/image/abc" });
  assert.equal(spotifyCoz("paused\u001fŞarkı\u001fS\u001fhttp://kotu.example/x.png").kapak, null);
  assert.equal(spotifyCoz("stopped"), null);
  const y = youtubeCoz("(3) Mol kavramı - YouTube\u001fhttps://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12", "Safari");
  assert.deepEqual([y.baslik, y.kapak, y.alt], ["Mol kavramı", "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg", "YouTube · Safari"]);
  assert.equal(y.oynuyor, null);
  assert.equal(youtubeCoz("V - YouTube\u001fhttps://www.youtube.com/watch?v=abcdefghijk\u001foynuyor", "Arc").oynuyor, true);
  assert.equal(youtubeCoz("V - YouTube\u001fhttps://www.youtube.com/watch?v=abcdefghijk\u001fdurdu", "Arc").oynuyor, false);
  assert.equal(youtubeCoz("", "Safari"), null);
});

test("medya: öncelik, yalnızca açık uygulamalar sorulur, komutlar", async () => {
  const cagrilar = [];
  const sahte = (acik, yanit) => async (komut, arg) => {
    cagrilar.push([komut, arg.join(" ")]);
    if (komut === "pgrep") return acik.includes(arg[1]) ? "" : null;
    return yanit(arg[1]);
  };
  // Spotify duraklatılmış, Chrome'da video açık → YouTube öne geçer; kapalı Safari hiç sorulmaz.
  let m = medya(sahte(["Spotify", "Google Chrome"], (b) => (b.includes('"Spotify"') ? "paused\u001fA\u001fB\u001f" : "Video - YouTube\u001fhttps://www.youtube.com/watch?v=abcdefghijk")), "darwin");
  assert.equal((await m.durum()).kaynak, "youtube");
  assert.ok(!cagrilar.some(([k, a]) => k === "osascript" && a.includes("Safari")));
  // Spotify çalıyorsa tarayıcıya bakılmaz.
  cagrilar.length = 0;
  m = medya(sahte(["Spotify", "Google Chrome"], () => "playing\u001fA\u001fB\u001f"), "darwin");
  assert.equal((await m.durum()).kaynak, "spotify");
  assert.equal(cagrilar.filter(([k]) => k === "osascript").length, 1);
  assert.deepEqual(await m.komut("spotify", "sonraki"), { tamam: true });
  assert.ok(cagrilar.at(-1)[1].includes("next track"));
  assert.deepEqual(await m.komut("spotify", "rm -rf"), { tamam: false });
  // YouTube: tarayıcı JavaScript'e izin vermiyorsa ipucu döner; bilinmeyen tarayıcı adı betiğe girmez.
  m = medya(sahte(["Google Chrome"], () => null), "darwin");
  assert.match((await m.komut("youtube", "oynat", "Google Chrome")).ipucu, /Apple Events/);
  cagrilar.length = 0;
  assert.deepEqual(await m.komut("youtube", "oynat", 'X" to quit --'), { tamam: false });
  assert.equal(cagrilar.length, 0);
  // macOS dışında sessizce boş döner.
  assert.equal(await medya(sahte([], () => "x"), "linux").durum(), null);
});
