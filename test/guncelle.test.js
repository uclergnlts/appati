const test = require("node:test");
const assert = require("node:assert");
const { EventEmitter } = require("node:events");
const { guncelleyici, BESLEME } = require("../src/main/guncelle");
const { besleme } = require("../tools/surum-json");

function sahte() {
  const a = new EventEmitter();
  a.cagri = [];
  a.setFeedURL = (o) => a.cagri.push(["besleme", o]);
  a.checkForUpdates = () => a.cagri.push(["denetle"]);
  a.quitAndInstall = () => a.cagri.push(["kur"]);
  return a;
}

test("güncelleyici: denetle → indir → hazır → kur", () => {
  const a = sahte(), yayin = [];
  const g = guncelleyici({ autoUpdater: a, etkin: true, bildir: (d) => yayin.push(d.durum), gunluk() {} });
  assert.deepEqual(a.cagri[0], ["besleme", { url: BESLEME, serverType: "json" }]);
  assert.equal(g.durum().durum, "bekliyor");
  g.kur(); // hazır değilken kurmaz
  g.denetle();
  a.emit("checking-for-update");
  g.denetle(); // sürerken ikinci kez başlatmaz
  a.emit("update-available");
  a.emit("update-downloaded", {}, "notlar", "Appati 0.2.1");
  assert.deepEqual([g.durum().durum, g.durum().surum], ["hazir", "0.2.1"]);
  a.emit("error", new Error("sonraki denetim düştü")); // indirilmiş güncelleme geçerli kalır
  assert.equal(g.durum().durum, "hazir");
  g.denetle(); g.kur();
  assert.deepEqual(a.cagri.map((c) => c[0]), ["besleme", "denetle", "kur"]);
  assert.deepEqual(yayin, ["denetleniyor", "indiriliyor", "hazir"]);
});

test("güncelleyici: güncel, hata ve kapalı durumları", () => {
  const a = sahte();
  const g = guncelleyici({ autoUpdater: a, etkin: true, bildir() {}, gunluk() {} });
  a.emit("update-not-available");
  assert.equal(g.durum().durum, "guncel");
  a.emit("error", new Error("Could not get code signature for running application"));
  assert.deepEqual([g.durum().durum, /code signature/.test(g.durum().mesaj)], ["hata", true]);
  g.denetle(); // hatadan sonra yeniden denenebilir
  assert.equal(a.cagri.filter((c) => c[0] === "denetle").length, 1);
  const b = sahte();
  const kapali = guncelleyici({ autoUpdater: b, etkin: false, bildir() {}, gunluk() {} });
  kapali.denetle(); kapali.kur();
  assert.deepEqual([kapali.durum().durum, b.cagri.length], ["kapali", 0]);
});

test("besleme dosyası sürüme ve depoya göre üretilir", () => {
  const b = besleme("0.2.1", "uclergnlts/appati", new Date("2026-11-26T10:00:00Z"));
  assert.equal(b.currentRelease, "0.2.1");
  assert.equal(b.releases[0].updateTo.url, "https://github.com/uclergnlts/appati/releases/download/v0.2.1/Appati-0.2.1-universal.zip");
  assert.equal(b.releases[0].updateTo.pub_date, "2026-11-26T10:00:00.000Z");
  assert.throws(() => besleme("v0.2", "uclergnlts/appati"), /Geçersiz sürüm/);
  assert.throws(() => besleme("0.2.1", "bozuk depo"), /Geçersiz depo/);
});
