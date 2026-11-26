const test = require("node:test");
const assert = require("node:assert");
const { haftaAnahtari, gunlukKaydet, haftaOnce, haftalikSatirlar, bildirimMetni } = require("../src/main/haftalik");
const { gunAnahtari, GUN } = require("../src/main/util");
const { sablonlaTamamla } = require("../src/main/katalog");

const simdi = new Date(2026, 10, 26, 10, 0, 0); // Perşembe
const gun = (n) => gunAnahtari(new Date(simdi.getTime() - n * GUN));

test("hafta anahtarı ISO haftasına göre; pazartesi yeni hafta başlar", () => {
  assert.equal(haftaAnahtari(new Date(2026, 10, 22)), "2026-W47"); // Pazar
  assert.equal(haftaAnahtari(new Date(2026, 10, 23)), "2026-W48"); // Pazartesi
  assert.equal(haftaAnahtari(simdi), "2026-W48");
  assert.equal(haftaAnahtari(new Date(2027, 0, 1)), "2026-W53"); // yıl sınırı
});

test("günlük kayıt: bugünü yazar, eskileri atar, 7 gün öncesini bulur", () => {
  let g = { [gun(20)]: { abone: 1 }, [gun(8)]: { abone: 70, mrr: 300 } };
  g = gunlukKaydet(g, simdi, { abone: 86, mrr: 412.4, kayitli: 4200, ziyaretci7g: 9 });
  assert.deepEqual(Object.keys(g).sort(), [gun(8), gun(0)].sort());
  assert.deepEqual(g[gun(0)], { abone: 86, mrr: 412.4, kayitli: 4200 });
  assert.equal(haftaOnce(g, simdi, "abone"), 70); // 7. gün yok, 8. gün kullanılır
  assert.equal(haftaOnce(g, simdi, "kayitli"), undefined);
  assert.equal(haftaOnce({ [gun(3)]: { abone: 5 } }, simdi, "abone"), undefined); // bir hafta dolmadan uydurma yok
  // Hiç sayı yoksa boş gün yazılmaz.
  assert.deepEqual(gunlukKaydet({}, simdi, {}), {});
});

test("haftalık satırlar: yüzde, fark, eksik veride değişim yok", () => {
  const u = {
    paraBirimi: "$",
    kpi: { ziyaretci7g: 1937, ziyaretciOnceki7g: 1800, yeniKayit7g: 97, yeniKayitOnceki7g: 100, aramaTiklama7g: 12, abone: 86, mrr: 412, kayitli: 4200 },
    sayfalar: [{ ad: "/fizik/vektorler/", v: 310 }],
    olayListeleri: [{ etiket: "En çok anlaşılmayan kartlar", ogeler: [{ ad: "fizik.vektorler.4", v: 21 }] }],
  };
  const s = haftalikSatirlar(u, { [gun(7)]: { abone: 84, mrr: 430, kayitli: 4200 } }, simdi);
  const bul = (e) => s.find((x) => x.etiket === e);
  assert.deepEqual([bul("Site ziyaretçisi").deger, bul("Site ziyaretçisi").degisim, bul("Site ziyaretçisi").yon], ["1.937", "%8", "yukari"]);
  assert.deepEqual([bul("Yeni kayıt").degisim, bul("Yeni kayıt").yon], ["%3", "asagi"]);
  assert.equal(bul("Aramadan tıklama").degisim, null); // önceki hafta bilinmiyor
  assert.equal(bul("iOS indirme"), undefined); // kaynak bağlı değil
  assert.deepEqual([bul("Abone").degisim, bul("Abone").yon], ["+2", "yukari"]);
  assert.deepEqual([bul("Aylık yinelenen gelir").deger, bul("Aylık yinelenen gelir").degisim, bul("Aylık yinelenen gelir").yon], ["$412", "−18", "asagi"]);
  assert.equal(bul("Kayıtlı kullanıcı").degisim, "değişmedi");
  assert.equal(bul("En çok açılan sayfa").deger, "/fizik/vektorler/");
  assert.equal(bul("En çok anlaşılmayan kartlar").deger, "fizik.vektorler.4");
  assert.equal(bildirimMetni({ haftalik: s }), "site ziyaretçisi 1.937 (▲ %8), yeni kayıt 97 (▼ %3), aramadan tıklama 12, abone 86 (+2)");
  // Geçmiş yokken fark satırları yalnızca değeri gösterir.
  assert.equal(haftalikSatirlar(u, {}, simdi).find((x) => x.etiket === "Abone").degisim, null);
  assert.deepEqual(haftalikSatirlar({ kpi: {} }, {}, simdi), []);
});

test("şablon tamamlama: adı şablonla aynı kayıtta boş alanlar dolar, dolu alanlar korunur", () => {
  const u = sablonlaTamamla({ id: "1", ad: "ucler.", kaynaklar: { supabase: { url: "https://baska.supabase.co" }, umami: {} } });
  assert.equal(u.kaynaklar.supabase.url, "https://baska.supabase.co");
  assert.equal(u.kaynaklar.supabase.aktifTablo, "ilerleme");
  assert.match(u.kaynaklar.umami.huniAdimlari, /kayit_tamam/);
  assert.equal(u.kaynaklar.searchconsole.siteUrl, "ucler.app");
  const baska = { id: "2", ad: "Başka", kaynaklar: { umami: {} } };
  assert.equal(sablonlaTamamla(baska), baska);
});
