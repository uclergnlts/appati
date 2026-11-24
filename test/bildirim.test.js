const test = require("node:test");
const assert = require("node:assert");
const { farkBul } = require("../src/main/bildirim");

const uyg = (ek) => ({ id: "a", ad: "ucler.", kpi: { abone: 5 }, kaynaklar: [{ tur: "supabase", ad: "Supabase", tamam: true }], yorumlar: [], ...ek });
const yorum = (puan, metin) => ({ magaza: "App Store", puan, baslik: "", metin, tarih: "2026-11-20T10:00:00Z" });

test("ilk okumada bildirim yok, sonra yalnızca değişenler", () => {
  const ilk = farkBul(undefined, [uyg({ yorumlar: [yorum(1, "eski kötü")] })]);
  assert.deepEqual(ilk.bildirimler, []);

  const ayni = farkBul(ilk.iz, [uyg({ yorumlar: [yorum(1, "eski kötü")] })]);
  assert.deepEqual(ayni.bildirimler, []);

  const yeni = farkBul(ilk.iz, [uyg({
    kpi: { abone: 7 },
    kaynaklar: [{ tur: "supabase", ad: "Supabase", tamam: false, hata: "Anahtar reddedildi" }],
    yorumlar: [yorum(1, "eski kötü"), yorum(2, "yeni kötü"), yorum(5, "yeni iyi")],
  })]);
  assert.deepEqual(yeni.bildirimler.map((b) => b.baslik), ["ucler.: 2 yıldızlı yorum (App Store)", "ucler.: yeni abone", "ucler.: Supabase okunamıyor"]);
  assert.equal(yeni.bildirimler[1].metin, "Aktif abone 5 → 7");

  // Bozuk kaynak her turda yeniden bildirilmez; abone azalınca bildirim çıkmaz.
  const sonra = farkBul(yeni.iz, [uyg({ kpi: { abone: 6 }, kaynaklar: [{ tur: "supabase", ad: "Supabase", tamam: false, hata: "x" }], yorumlar: [] })]);
  assert.deepEqual(sonra.bildirimler, []);
  // Kaynak düzelip eski yorumlar geri gelince yeniden bildirilmez.
  const duzeldi = farkBul(sonra.iz, [uyg({ kpi: { abone: 6 }, yorumlar: [yorum(2, "yeni kötü")] })]);
  assert.deepEqual(duzeldi.bildirimler, []);
});

test("yeni eklenen uygulama ilk turda sessizdir", () => {
  const r = farkBul({ a: { abone: 1, bozuk: [], yorumlar: [] } }, [uyg(), uyg({ id: "b", yorumlar: [yorum(1, "kötü")] })]);
  assert.deepEqual(r.bildirimler.map((b) => b.uygulamaId), ["a"]);
});
