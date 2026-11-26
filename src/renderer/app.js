"use strict";
// Appati arayüzü. Çatı yok: küçük bir DOM yardımcısı ve duruma göre baştan çizim.

const kopru = window.appati || {
  // Tarayıcı önizlemesi (tools/preview.js): ana süreç yokken sabit veriyle çalışır.
  baslangic: async () => window.__ONIZLEME__,
  yenile: async () => window.__ONIZLEME__,
  uygulamaKaydet: async () => window.__ONIZLEME__,
  uygulamaSil: async () => window.__ONIZLEME__,
  genelKaydet: async () => window.__ONIZLEME__,
  gizle() {}, cik() {}, disari() {}, durumDinle() {}, vurguDinle() {}, gitDinle() {}, ayarDinle() {}, guncellemeDinle() {}, guncellemeDenetle: async () => window.__ONIZLEME__, guncellemeKur() {},
};
if (!window.appati) document.body.classList.add("onizleme");

const RENKLER = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"];
const SVGNS = "http://www.w3.org/2000/svg";
const kok = document.getElementById("kok");
const ipucu = document.getElementById("ipucu");

let P = null; // ana süreçten gelen paket: { durum, ayar, katalog, sablonlar, surum }
let G = window.__GORUNUM__ || { ad: "genel" }; // { ad: "genel" | "uyg" | "ayar" | "form", id, sekme, taslak }

/* ---------- yardımcılar ---------- */

function h(etiket, ozellik, ...cocuklar) {
  const e = document.createElement(etiket);
  for (const [a, d] of Object.entries(ozellik || {})) {
    if (d === undefined || d === null || d === false) continue;
    if (a === "class") e.className = d;
    else if (a.startsWith("on")) e.addEventListener(a.slice(2), d);
    else if (a === "value") e.value = d;
    else if (a === "style") e.style.cssText = d; // CSP satır içi stil özniteliğini engeller; CSSOM serbest
    else if (a === "checked" || a === "open" || a === "hidden") e[a] = Boolean(d);
    else e.setAttribute(a, d === true ? "" : d);
  }
  for (const c of cocuklar.flat(Infinity)) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

function s(etiket, ozellik, ...cocuklar) {
  const e = document.createElementNS(SVGNS, etiket);
  for (const [a, d] of Object.entries(ozellik || {})) {
    if (a.startsWith("on")) e.addEventListener(a.slice(2), d); else if (d !== undefined && d !== null) e.setAttribute(a, d);
  }
  for (const c of cocuklar.flat()) if (c) e.append(c);
  return e;
}

const IKON = {
  yenile: "M13.6 8a5.6 5.6 0 1 1-1.7-4M13.6 2.4V5h-2.6",
  igne: "M9.5 2.5l4 4-2 .6-2.2 2.2.3 2.7-1.1 1.1-2.4-2.9-3.6 3.3 3.3-3.6L2.9 7.5 4 6.4l2.7.3L8.9 4.5z",
  ayar: "M8 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1",
  geri: "M9.8 3.2L5 8l4.8 4.8",
  arti: "M8 3v10M3 8h10",
  iyi: "M3.2 8.4l3 3 6.6-7",
  uyari: "M8 2.2l6.3 11.3H1.7zM8 6.6v3.2M8 11.6v.4",
  kotu: "M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4zM5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4",
  bilgi: "M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4zM8 7.4v3.6M8 5v.4",
};
function ikon(ad, sinif) {
  return s("svg", { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round", "stroke-linejoin": "round", class: sinif || "", "aria-hidden": "true" },
    s("path", { d: IKON[ad] }));
}

const sayi = (n) => (n === undefined || n === null ? "–" : Math.round(n).toLocaleString("tr-TR"));
const para = (n, birim) => (n === undefined || n === null ? "–" : `${birim || "$"}${Math.round(n).toLocaleString("tr-TR")}`);
const gunYaz = (g, uzun) => new Date(`${g}T00:00`).toLocaleDateString("tr-TR", uzun ? { day: "numeric", month: "short", weekday: "short" } : { day: "numeric", month: "short" });
const saat = (iso) => new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

function degisim(yeni, eski) {
  if (yeni === undefined || eski === undefined || !eski) return null;
  return Math.round(((yeni - eski) / eski) * 100);
}

function ipucuGoster(olay, baslik, deger) {
  ipucu.replaceChildren(h("b", null, deger), " ", h("span", null, baslik));
  ipucu.hidden = false;
  const k = ipucu.getBoundingClientRect();
  ipucu.style.left = `${Math.max(6, Math.min(window.innerWidth - k.width - 6, olay.clientX - k.width / 2))}px`;
  ipucu.style.top = `${Math.max(6, olay.clientY - k.height - 12)}px`;
}
const ipucuGizle = () => { ipucu.hidden = true; };

/* ---------- grafikler ---------- */

// Eksen yazısız küçük çizgi; üzerinde gezince o günün değeri görünür.
function kivilcim(seri, ne) {
  if (!seri || seri.length < 2) return null;
  const W = 100, H = 26, enb = Math.max(1, ...seri.map((n) => n.v));
  const x = (i) => (i / (seri.length - 1)) * W;
  const y = (v) => H - 2 - (v / enb) * (H - 4);
  const yol = seri.map((n, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(n.v).toFixed(2)}`).join("");
  const imlec = s("line", { class: "imlec", y1: 0, y2: H, "vector-effect": "non-scaling-stroke", visibility: "hidden" });
  const svg = s("svg", { class: "kivilcim", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", role: "img", "aria-label": `${ne}, son ${seri.length} gün` },
    s("path", { class: "cizgi-alan", d: `${yol}L${W} ${H}L0 ${H}Z` }),
    s("path", { class: "cizgi-yol", d: yol, "vector-effect": "non-scaling-stroke" }),
    imlec);
  svg.addEventListener("mousemove", (o) => {
    const k = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(seri.length - 1, Math.round(((o.clientX - k.left) / k.width) * (seri.length - 1))));
    imlec.setAttribute("x1", x(i)); imlec.setAttribute("x2", x(i)); imlec.setAttribute("visibility", "visible");
    ipucuGoster(o, `${ne} · ${gunYaz(seri[i].g, true)}`, sayi(seri[i].v));
  });
  svg.addEventListener("mouseleave", () => { imlec.setAttribute("visibility", "hidden"); ipucuGizle(); });
  return svg;
}

// Günlük çubuk grafik: tek seri, tek eksen. Başlık seriyi adlandırır; ayrıca gösterge gerekmez.
function cubuklar(seri, ne) {
  const W = 386, H = 118, ust = 8, alt = 98;
  const enb = Math.max(1, ...seri.map((n) => n.v));
  const adim = W / seri.length, gen = Math.max(3, adim - 2);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${ne}, günlük, son ${seri.length} gün` });
  svg.append(s("line", { class: "taban", x1: 0, x2: W, y1: alt + 0.5, y2: alt + 0.5 }));
  svg.append(s("line", { class: "taban", x1: 0, x2: W, y1: ust + 0.5, y2: ust + 0.5, "stroke-dasharray": "2 4" }));
  const en = s("text", { class: "eksen", x: W, y: ust - 2, "text-anchor": "end" }); en.textContent = sayi(enb); svg.append(en);
  seri.forEach((n, i) => {
    const yuk = n.v ? Math.max(2, (n.v / enb) * (alt - ust)) : 0;
    const x = i * adim + (adim - gen) / 2;
    const r = Math.min(3, gen / 2, yuk);
    // Üst uçları yuvarlak, tabana oturan çubuk.
    const cubuk = s("path", { class: "cubuk", d: yuk ? `M${x} ${alt}V${alt - yuk + r}Q${x} ${alt - yuk} ${x + r} ${alt - yuk}H${x + gen - r}Q${x + gen} ${alt - yuk} ${x + gen} ${alt - yuk + r}V${alt}Z` : "" });
    const alan = s("rect", { x: i * adim, y: 0, width: adim, height: alt, fill: "transparent",
      onmousemove: (o) => { cubuk.classList.add("sec"); ipucuGoster(o, gunYaz(n.g, true), sayi(n.v)); },
      onmouseleave: () => { cubuk.classList.remove("sec"); ipucuGizle(); } });
    svg.append(cubuk, alan);
  });
  for (const [i, cipa] of [[0, "start"], [Math.floor(seri.length / 2), "middle"], [seri.length - 1, "end"]]) {
    const t = s("text", { class: "eksen", x: i === 0 ? 0 : i === seri.length - 1 ? W : i * adim + adim / 2, y: H - 4, "text-anchor": cipa });
    t.textContent = gunYaz(seri[i].g); svg.append(t);
  }
  return h("div", { class: "grafik" }, svg);
}

function grafikKarti(baslik, seri, ne, altNot) {
  const yedi = seri.slice(-7).reduce((t, n) => t + n.v, 0);
  return h("div", { class: "kart" },
    h("div", { class: "grafik-ust" }, h("span", null, baslik), h("span", null, "son 7 gün ", h("b", null, sayi(yedi)))),
    cubuklar(seri, ne),
    altNot ? h("div", { class: "kucuk-yazi" }, altNot) : null);
}

function siraListesi(ogeler, bosYazi) {
  if (!ogeler || !ogeler.length) return h("div", { class: "kart bos" }, bosYazi);
  const enb = Math.max(1, ...ogeler.map((o) => o.v));
  return h("div", { class: "kart" }, ogeler.map((o) => h("div", { class: "sira" },
    h("span", { class: "ad", title: o.ad }, o.ad), h("span", { class: "sayi" }, sayi(o.v)),
    o.alt ? h("span", { class: "alt-satir" }, o.alt) : null,
    h("span", { class: "iz" }, h("i", { style: `width:${(o.v / enb) * 100}%` })))));
}

// Huni: her adımın çubuğu ilk adıma göre; yanında bir önceki adımdan kalanların yüzdesi.
function huniKarti(adimlar) {
  const ilk = Math.max(1, adimlar[0].deger);
  return h("div", { class: "kart" }, adimlar.map((a, i) => {
    const onceki = i ? adimlar[i - 1].deger : null;
    const oran = onceki ? ` · önceki adımdan %${((a.deger / onceki) * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}` : "";
    return h("div", { class: "sira" },
      h("span", { class: "ad", title: a.etiket }, a.etiket),
      h("span", { class: "sayi" }, h("b", null, sayi(a.deger)), i && onceki ? h("span", { class: "oran" }, oran) : null),
      h("span", { class: "iz kalin" }, h("i", { style: `width:${Math.min(100, (a.deger / ilk) * 100)}%` })));
  }));
}

function guncellemeYazisi(g) {
  switch (g.durum) {
    case "denetleniyor": return "Yeni sürüm var mı diye bakılıyor…";
    case "guncel": return "En güncel sürümü kullanıyorsun.";
    case "indiriliyor": return "Yeni sürüm indiriliyor…";
    case "hazir": return `Appati ${g.surum || "yeni sürüm"} indirildi; yeniden başlatınca kurulur.`;
    case "hata": return `Güncelleme denetlenemedi: ${g.mesaj || "bilinmeyen hata"}`;
    case "kapali": return "Otomatik güncelleme yalnızca kurulu, imzalı Mac uygulamasında çalışır.";
    default: return "Açılıştan kısa süre sonra ve altı saatte bir denetlenir.";
  }
}

/* ---------- parçalar ---------- */

function kutu(etiket, deger, ek) {
  const { not, yeni, eski, seri, ne } = ek || {};
  const d = degisim(yeni, eski);
  return h("div", { class: "kutu" },
    h("div", { class: "et" }, etiket),
    h("div", { class: "deger" }, deger),
    d !== null
      ? h("div", { class: "not", title: `Önceki 7 güne göre (o zaman ${sayi(eski)})` }, h("span", { class: `ok ${d >= 0 ? "yukari" : "asagi"}` }, d >= 0 ? "▲" : "▼"), ` %${Math.abs(d)} · önceki 7g`)
      : not ? h("div", { class: "not" }, not) : null,
    seri ? kivilcim(seri, ne || etiket) : null);
}

function rozet(u, kucuk) {
  return h("span", { class: `rozet${kucuk ? " kucuk" : ""}`, style: `background:${u.renk}`, "aria-hidden": "true" }, (u.ad || "?").trim().charAt(0).toLocaleUpperCase("tr-TR"));
}

function notSeridi(n, tiklanir) {
  return h("div", { class: `serit ${n.tur}` }, ikon(n.tur, "im"),
    h("div", null,
      n.uygulama ? h("div", { class: "kim" }, n.uygulama) : null,
      tiklanir && n.uygulamaId ? h("button", { class: "baglanti", onclick: () => git({ ad: "uyg", id: n.uygulamaId, sekme: "ozet" }) }, n.metin) : n.metin));
}

function ustCubuk(sol, baslik, alt, sag) {
  return h("header", { class: "ust" }, sol, h("div", { class: "baslik" }, h("h1", null, baslik), alt ? h("div", { class: "alt" }, alt) : null), sag);
}

function dugme(ad, etiket, tikla, sinif) {
  return h("button", { class: `dugme ${sinif || ""}`, title: etiket, "aria-label": etiket, onclick: tikla }, ikon(ad));
}

function kpiKutulari(k, seri, birim) {
  const kutular = [];
  if (k.aktifBugun !== undefined) kutular.push(kutu("Aktif bugün", sayi(k.aktifBugun), { not: k.aktif7g !== undefined ? `7 günde ${sayi(k.aktif7g)}` : null, seri: seri.aktif && seri.aktif.filter((n) => n.v).length > 1 ? seri.aktif : null, ne: "Aktif kullanıcı" }));
  if (k.ziyaretciBugun !== undefined) kutular.push(kutu("Ziyaretçi bugün", sayi(k.ziyaretciBugun), { not: k.sitedeSimdi !== undefined ? `şu an sitede ${sayi(k.sitedeSimdi)}` : null, seri: seri.ziyaret, ne: "Ziyaret" }));
  if (k.yeniKayit7g !== undefined) kutular.push(kutu("Yeni kayıt · 7 gün", sayi(k.yeniKayit7g), { yeni: k.yeniKayit7g, eski: k.yeniKayitOnceki7g, not: `bugün ${sayi(k.yeniKayitBugun)}`, seri: seri.kayit, ne: "Yeni kayıt" }));
  if (k.kurulumIos7g !== undefined) kutular.push(kutu("iOS indirme · 7 gün", sayi(k.kurulumIos7g), { yeni: k.kurulumIos7g, eski: k.kurulumIosOnceki7g, seri: seri.kurulumIos, ne: "iOS indirme" }));
  if (k.mrr !== undefined) kutular.push(kutu("Aylık yinelenen gelir", para(k.mrr, birim), { not: "MRR" }));
  if (k.abone !== undefined) kutular.push(kutu("Abone", sayi(k.abone), { not: k.deneme ? `${sayi(k.deneme)} denemede` : "aktif abonelik" }));
  if (k.gelir28g !== undefined) kutular.push(kutu("Gelir · 28 gün", para(k.gelir28g, birim)));
  if (k.kayitli !== undefined) kutular.push(kutu("Kayıtlı kullanıcı", sayi(k.kayitli), { not: "toplam" }));
  if (!kutular.length) return null;
  return h("div", { class: `izgara${kutular.length % 3 === 1 || kutular.length === 2 ? " iki" : ""}` }, kutular);
}

/* ---------- görünümler ---------- */

function genelGorunum() {
  const d = P.durum;
  const alt = d.zaman ? `${d.uygulamalar.length} uygulama · ${saat(d.zaman)} itibarıyla` : "Veri okunuyor…";
  const govde = h("div", { class: "govde" });

  if (d.demo) {
    govde.append(h("div", { class: "serit bilgi" }, ikon("bilgi", "im"), h("div", null,
      "Şu an örnek sayılar görünüyor. Kendi rakamların için ",
      h("button", { class: "baglanti", onclick: () => git({ ad: "ayar" }) }, "ilk uygulamanı ekle"), ".")));
  }
  if (d.hata) govde.append(notSeridi({ tur: "uyari", metin: d.hata }));
  const gun = P.guncelleme || {};
  if (gun.durum === "hazir") {
    govde.append(h("div", { class: "serit iyi" }, ikon("iyi", "im"), h("div", null,
      `Appati ${gun.surum || "yeni sürüm"} indirildi. `,
      h("button", { class: "baglanti", onclick: () => kopru.guncellemeKur() }, "Yeniden başlat ve güncelle"))));
  }

  if (d.ozet) {
    if (d.ozet.notlar.length) {
      govde.append(h("section", { class: "bolum" }, h("h2", null, "Bugün neye bakmalı"), d.ozet.notlar.slice(0, 4).map((n) => notSeridi(n, true))));
    }
    const kutular = kpiKutulari(d.ozet.kpi, d.ozet.seri, d.ozet.paraBirimi);
    if (kutular) govde.append(h("section", { class: "bolum" }, h("h2", null, "Bütün uygulamalar"), kutular));
    if (d.ozet.trafik.length) {
      govde.append(h("section", { class: "bolum" }, h("h2", null, "Nereden geliyorlar", h("span", null, "ziyaret · son 7 gün")), siraListesi(d.ozet.trafik.slice(0, 5))));
    }
  }

  govde.append(h("section", { class: "bolum" }, h("h2", null, "Uygulamalar"),
    d.uygulamalar.length ? d.uygulamalar.map(uygulamaKarti) : h("div", { class: "kart bos" }, d.yukleniyor ? "Okunuyor…" : "Henüz uygulama yok.")));

  return [
    ustCubuk(null, "Appati", alt, [
      dugme("yenile", "Şimdi yenile", yenile, d.yukleniyor ? "donuyor" : ""),
      dugme("igne", P.ayar.genel.sabit ? "Sabitlemeyi kaldır" : "Paneli ekranda sabitle", sabitDegistir, P.ayar.genel.sabit ? "acik" : ""),
      dugme("ayar", "Ayarlar", () => git({ ad: "ayar" })),
    ]),
    govde,
  ];
}

function uygulamaKarti(u) {
  const k = u.kpi;
  const bozuk = u.kaynaklar.filter((x) => !x.tamam).length;
  const altYazi = !u.kaynaklar.length ? "Kaynak bağlı değil" : bozuk ? `${bozuk} kaynak okunamadı` : u.kaynaklar.map((x) => x.ad).join(" · ");
  const buyuk = k.aktifBugun !== undefined ? [sayi(k.aktifBugun), "aktif bugün"] : k.ziyaretciBugun !== undefined ? [sayi(k.ziyaretciBugun), "ziyaretçi bugün"] : null;
  const uclu = [];
  if (k.ziyaretciBugun !== undefined && k.aktifBugun !== undefined) uclu.push([sayi(k.ziyaretciBugun), "ziyaretçi bugün"]);
  if (k.yeniKayit7g !== undefined) uclu.push([sayi(k.yeniKayit7g), "yeni kayıt · 7g"]);
  if (k.abone !== undefined) uclu.push([sayi(k.abone), "abone"]);
  else if (k.kayitli !== undefined) uclu.push([sayi(k.kayitli), "kayıtlı"]);
  if (uclu.length < 3 && k.mrr !== undefined) uclu.push([para(k.mrr, u.paraBirimi), "MRR"]);
  const cizgi = u.seri.ziyaret || u.seri.kayit;
  return h("button", { class: "kart", onclick: () => git({ ad: "uyg", id: u.id, sekme: "ozet" }) },
    h("div", { class: "uyg-ust" }, rozet(u),
      h("div", { class: "ad" }, h("b", null, u.ad), h("span", null, altYazi)),
      buyuk ? h("div", { class: "buyuk" }, h("b", null, buyuk[0]), h("span", null, buyuk[1])) : null),
    uclu.length ? h("div", { class: "uclu" }, uclu.slice(0, 3).map(([d, e]) => h("div", null, h("b", null, d), h("span", null, e)))) : null,
    cizgi ? kivilcim(cizgi, u.seri.ziyaret ? "Ziyaret" : "Yeni kayıt") : null);
}

const SEKMELER = [["ozet", "Özet"], ["kullanici", "Kullanıcılar"], ["arama", "Arama"], ["gelir", "Gelir"], ["yorum", "Yorumlar"], ["kaynak", "Kaynaklar"]];

function uygulamaGorunumu() {
  const u = P.durum.uygulamalar.find((x) => x.id === G.id);
  if (!u) { G = { ad: "genel" }; return genelGorunum(); }
  const govde = h("div", { class: "govde" });
  const bagla = (kaynak) => h("div", { class: "kart bos" }, h("b", null, "Veri yok"), `Bunu görmek için ${kaynak} kaynağını bağla.`);
  const k = u.kpi;

  if (G.sekme === "ozet") {
    govde.append(h("section", { class: "bolum" }, h("h2", null, "Neye bakmalı"),
      u.notlar.length ? u.notlar.map((n) => notSeridi(n)) : notSeridi({ tur: "bilgi", metin: "Henüz kaynak bağlı değil. Kaynaklar sekmesinden ekleyebilirsin." })));
    const kutular = kpiKutulari(k, u.seri, u.paraBirimi);
    govde.append(h("section", { class: "bolum" }, h("h2", null, "Rakamlar"), kutular || bagla("en az bir")));
    if (u.seri.aktif && u.aktifGecmisGun > 1) {
      govde.append(h("section", { class: "bolum" }, h("h2", null, "Aktif kullanıcı", h("span", null, "günlük")),
        grafikKarti("Günlük aktif", u.seri.aktif, "Aktif kullanıcı", u.aktifGecmisGun < 30 ? `Geçmiş, Appati çalıştıkça birikir (şimdilik ${u.aktifGecmisGun} gün).` : null)));
    }
    if (u.huni && u.huni.length > 1) {
      govde.append(h("section", { class: "bolum" }, h("h2", null, "Dönüşüm hunisi", h("span", null, "bütün zamanlar")), huniKarti(u.huni)));
    }
    for (const l of u.olayListeleri || []) {
      govde.append(h("section", { class: "bolum" }, h("h2", null, l.etiket, h("span", null, "son 30 gün")), siraListesi(l.ogeler, "Son 30 günde bu olay hiç gelmedi.")));
    }
    if (u.sayaclar.length) {
      govde.append(h("section", { class: "bolum" }, h("h2", null, "Sayaçlar"),
        h("div", { class: "kart" }, u.sayaclar.map((x) => h("div", { class: "liste-satir" }, h("span", null, x.etiket), h("b", null, sayi(x.deger)))))));
    }
  }

  if (G.sekme === "kullanici") {
    govde.append(h("section", { class: "bolum" }, h("h2", null, "Yeni kayıt", h("span", null, "son 30 gün")),
      u.seri.kayit ? grafikKarti("Günlük yeni kayıt", u.seri.kayit, "Yeni kayıt") : bagla("Supabase")));
    govde.append(h("section", { class: "bolum" }, h("h2", null, "Site ziyareti", h("span", null, "son 30 gün")),
      u.seri.ziyaret ? grafikKarti("Günlük ziyaret", u.seri.ziyaret, "Ziyaret") : bagla("Google Analytics")));
    if (u.seri.kurulumIos) {
      govde.append(h("section", { class: "bolum" }, h("h2", null, "iOS indirme", h("span", null, "son 30 gün")),
        grafikKarti("Günlük ilk indirme", u.seri.kurulumIos, "iOS indirme", u.kurulumSonGun ? `Apple raporları gecikmeli gelir; son rapor ${gunYaz(u.kurulumSonGun)}.` : "Apple henüz rapor vermedi.")));
    }
    govde.append(h("section", { class: "bolum" }, h("h2", null, "Nereden geliyorlar", h("span", null, "ziyaret · son 7 gün")), siraListesi(u.trafik, "Trafik kaynağı verisi yok.")));
    govde.append(h("section", { class: "bolum" }, h("h2", null, "En çok açılan sayfalar", h("span", null, "son 7 gün")), siraListesi(u.sayfalar, "Sayfa verisi yok.")));
    govde.append(h("section", { class: "bolum" }, h("h2", null, "Ülkeler", h("span", null, "son 7 gün")), siraListesi(u.ulkeler, "Ülke verisi yok.")));
  }

  if (G.sekme === "kullanici" && u.olaylar && u.olaylar.length) {
    govde.append(h("section", { class: "bolum" }, h("h2", null, "Sitede yapılanlar", h("span", null, "olay · son 30 gün")), siraListesi(u.olaylar)));
  }

  if (G.sekme === "arama") {
    const a = u.arama;
    if (!a) {
      govde.append(h("section", { class: "bolum" }, h("h2", null, "Google araması"), bagla("Google Search Console")));
    } else {
      govde.append(h("section", { class: "bolum" }, h("h2", null, "Google araması", h("span", null, a.sonGun ? `son veri ${gunYaz(a.sonGun)}` : "veri yok")),
        h("div", { class: "izgara iki" },
          kutu("Tıklama · 7 gün", sayi(k.aramaTiklama7g), { yeni: k.aramaTiklama7g, eski: k.aramaTiklamaOnceki7g, seri: u.seri.aramaTiklama, ne: "Tıklama" }),
          kutu("Gösterim · 7 gün", sayi(k.aramaGosterim7g), { yeni: k.aramaGosterim7g, eski: k.aramaGosterimOnceki7g, seri: u.seri.aramaGosterim, ne: "Gösterim" })),
        h("div", { class: "kucuk-yazi" }, "Google bu veriyi 2-3 gün gecikmeyle verir; haftalık toplamlar verisi gelen son güne göre hesaplanır.")));
      if (u.seri.aramaTiklama && u.seri.aramaTiklama.length > 1) {
        govde.append(h("section", { class: "bolum" }, h("h2", null, "Aramadan gelen tıklama", h("span", null, "günlük")), grafikKarti("Günlük tıklama", u.seri.aramaTiklama, "Tıklama")));
      }
      govde.append(h("section", { class: "bolum" }, h("h2", null, "En çok tıklanan aramalar", h("span", null, "tıklama · son 30 gün")), siraListesi(a.sorgular, "Henüz arama verisi yok.")));
      govde.append(h("section", { class: "bolum" }, h("h2", null, "Aramadan en çok açılan sayfalar", h("span", null, "tıklama · son 30 gün")), siraListesi(a.sayfalar, "Henüz sayfa verisi yok.")));
    }
  }

  if (G.sekme === "gelir") {
    const kutular = [];
    if (k.mrr !== undefined) kutular.push(kutu("Aylık yinelenen gelir", para(k.mrr, u.paraBirimi), { not: "MRR" }));
    if (k.gelir28g !== undefined) kutular.push(kutu("Gelir · 28 gün", para(k.gelir28g, u.paraBirimi)));
    if (k.abone !== undefined) kutular.push(kutu("Aktif abone", sayi(k.abone)));
    if (k.deneme !== undefined) kutular.push(kutu("Denemede", sayi(k.deneme)));
    if (k.yeniMusteri28g !== undefined) kutular.push(kutu("Yeni müşteri · 28 gün", sayi(k.yeniMusteri28g)));
    if (k.aktifMusteri28g !== undefined) kutular.push(kutu("Aktif müşteri · 28 gün", sayi(k.aktifMusteri28g)));
    govde.append(h("section", { class: "bolum" }, h("h2", null, "Abonelik ve gelir"), kutular.length ? h("div", { class: "izgara iki" }, kutular) : bagla("RevenueCat")));
  }

  if (G.sekme === "yorum") {
    govde.append(h("section", { class: "bolum" }, h("h2", null, "Mağaza yorumları", h("span", null, `${u.yorumlar.length} yorum`)),
      u.yorumlar.length ? u.yorumlar.map((y) => h("div", { class: "kart yorum" },
        h("div", { class: "ust-satir" },
          h("span", { class: "yildiz", role: "img", "aria-label": `${y.puan || 0} yıldız` }, "★".repeat(y.puan || 0), h("i", null, "★".repeat(5 - (y.puan || 0)))),
          h("span", null, [y.magaza, y.ulke, y.tarih ? gunYaz(y.tarih.slice(0, 10)) : null].filter(Boolean).join(" · "))),
        y.baslik ? h("b", null, y.baslik) : null,
        h("p", null, y.metin || "(yazısız puan)")))
        : h("div", { class: "kart bos" }, h("b", null, "Yorum yok"), "App Store Connect ya da Google Play bağlıysa yeni yorumlar burada görünür.")));
  }

  if (G.sekme === "kaynak") {
    govde.append(h("section", { class: "bolum" }, h("h2", null, "Bağlı kaynaklar"),
      u.kaynaklar.length ? u.kaynaklar.map((x) => h("div", { class: "kart" },
        h("div", null, h("span", { class: `durum-nokta${x.tamam ? "" : " kotu"}` }), h("b", null, x.ad), x.tamam ? " · çalışıyor" : " · okunamadı"),
        x.hata ? h("div", { class: "kucuk-yazi" }, x.hata) : null,
        x.uyarilar.map((w) => h("div", { class: "kucuk-yazi" }, w))))
        : h("div", { class: "kart bos" }, "Bu uygulamaya henüz kaynak bağlanmadı."),
      u.demo ? null : h("div", { class: "eylem" }, h("button", { class: "btn", onclick: () => formAc(u.id) }, "Kaynakları düzenle"))));
  }

  return [
    ustCubuk([dugme("geri", "Geri", () => git({ ad: "genel" })), rozet(u)], u.ad, u.demo ? "Örnek veri" : (P.durum.zaman ? `${saat(P.durum.zaman)} itibarıyla` : ""),
      dugme("yenile", "Şimdi yenile", yenile, P.durum.yukleniyor ? "donuyor" : "")),
    h("nav", { class: "sekmeler", role: "tablist" }, SEKMELER.map(([ad, etiket]) =>
      h("button", { role: "tab", "aria-selected": String(G.sekme === ad), onclick: () => git({ ...G, sekme: ad }) }, etiket))),
    govde,
  ];
}

function ayarGorunumu() {
  const a = P.ayar;
  const dk = h("input", { type: "number", min: 5, max: 240, value: a.genel.yenilemeDk });
  const sabit = h("input", { type: "checkbox", checked: a.genel.sabit });
  const acilis = h("input", { type: "checkbox", checked: a.genel.acilistaBaslat });
  const bildirim = h("input", { type: "checkbox", checked: a.genel.bildirim });
  const cubuk = h("select", { "aria-label": "Menü çubuğunda gösterilen sayı" }, [["aktifBugun", "Aktif kullanıcı (bugün)"], ["ziyaretciBugun", "Site ziyaretçisi (bugün)"], ["yeniKayitBugun", "Yeni kayıt (bugün)"], ["mrr", "Aylık yinelenen gelir (MRR)"], ["yok", "Sayı gösterme"]]
    .map(([d, e]) => h("option", { value: d, selected: a.genel.cubukSayi === d ? "" : null }, e)));
  const otoGun = h("input", { type: "checkbox", checked: a.genel.otoGuncelle });
  const centik = h("input", { type: "checkbox", checked: a.genel.centik });
  const medyaKutu = h("input", { type: "checkbox", checked: a.genel.medya });
  const kaydirici = (ad, alt, ust, adim, birim) => {
    const yazi = h("b", null, `${a.genel[ad]}${birim}`);
    const giris = h("input", { type: "range", min: alt, max: ust, step: adim, value: a.genel[ad], oninput: (o) => { yazi.textContent = `${o.target.value}${birim}`; } });
    return { giris, yazi };
  };
  const cEn = kaydirici("centikEn", 200, 480, 10, " pt"), cBoy = kaydirici("centikBoy", 22, 48, 1, " pt"), cSay = kaydirici("centikSaydamlik", 0, 80, 5, "%");
  const saydam = h("input", { type: "range", min: 0, max: 100, step: 5, value: a.genel.saydamlik, "aria-label": "Saydamlık",
    oninput: (o) => gorunumUygula({ ...a.genel, saydamlik: Number(o.target.value) }) });
  const kaydet = async (ek) => {
    P = await kopru.genelKaydet({ ...a.genel, yenilemeDk: Number(dk.value), sabit: sabit.checked, acilistaBaslat: acilis.checked, saydamlik: Number(saydam.value), bildirim: bildirim.checked, cubukSayi: cubuk.value, centik: centik.checked, medya: medyaKutu.checked, otoGuncelle: otoGun.checked, centikEn: Number(cEn.giris.value), centikBoy: Number(cBoy.giris.value), centikSaydamlik: Number(cSay.giris.value), ...(ek || {}) });
    ciz();
  };
  for (const e of [dk, sabit, acilis, saydam, bildirim, cubuk, centik, medyaKutu, otoGun, cEn.giris, cBoy.giris, cSay.giris]) e.addEventListener("change", () => kaydet());
  const temalar = h("div", { class: "secici", role: "group", "aria-label": "Tema" }, [["sistem", "Sistem"], ["acik", "Açık"], ["koyu", "Koyu"]].map(([ad, etiket]) =>
    h("button", { type: "button", "aria-pressed": String(a.genel.tema === ad), onclick: () => kaydet({ tema: ad }) }, etiket)));

  return [
    ustCubuk(dugme("geri", "Geri", () => git({ ad: "genel" })), "Ayarlar", `Appati ${P.surum || ""}`, null),
    h("div", { class: "govde" },
      h("section", { class: "bolum" }, h("h2", null, "Uygulamalar"),
        a.uygulamalar.map((u) => h("button", { class: "kart", onclick: () => formAc(u.id) },
          h("div", { class: "uyg-ust" }, rozet(u), h("div", { class: "ad" }, h("b", null, u.ad),
            h("span", null, P.katalog.filter((k) => Object.values(u.gizliVar[k.tur]).some(Boolean)).map((k) => k.ad).join(" · ") || "Kaynak bağlı değil"))))),
        !a.uygulamalar.length ? h("div", { class: "kart bos" }, h("b", null, "Henüz uygulama eklemedin"), "Eklediğin her uygulama panelde kendi kartıyla görünür.") : null,
        h("div", { class: "eylem" },
          h("button", { class: "btn ana", onclick: () => formAc(null) }, "Uygulama ekle"),
          P.sablonlar.filter((s) => !a.uygulamalar.some((u) => u.ad === s.ad)).map((s) => h("button", { class: "btn", onclick: () => formAc(null, s) }, `${s.ad} şablonuyla ekle`)))),
      h("section", { class: "bolum" }, h("h2", null, "Görünüm"),
        h("div", { class: "kart" },
          h("label", { class: "alan", style: "margin-top:0" }, h("span", null, "Tema")), temalar,
          h("div", { class: "kucuk-yazi" }, "Sistem: macOS açık ya da koyu görünüme geçtiğinde panel de geçer. Düğmeler macOS vurgu rengini kullanır."),
          h("label", { class: "alan" }, h("span", null, "Arka plan saydamlığı"), saydam),
          h("div", { class: "kucuk-yazi" }, "macOS'ta “Saydamlığı azalt” açıksa panel opak görünür."))),
      h("section", { class: "bolum" }, h("h2", null, "Çentik"),
        h("div", { class: "kart" },
          h("label", { class: "onay", style: "margin-top:0" }, centik, "Fare ekranın üst ortasına gelince özeti aç"),
          h("label", { class: "onay" }, medyaKutu, "Çalan şarkıyı ve videoyu göster (Spotify, YouTube)"),
          h("label", { class: "alan" }, h("span", { class: "ikili" }, "Çalarken görünen şeridin genişliği", cEn.yazi), cEn.giris),
          h("label", { class: "alan" }, h("span", { class: "ikili" }, "Yüksekliği", cBoy.yazi), cBoy.giris),
          h("label", { class: "alan" }, h("span", { class: "ikili" }, "Saydamlığı", cSay.yazi), cSay.giris),
          h("div", { class: "kucuk-yazi" }, "Yüksekliği çentiğinle aynı olana kadar ayarla; değiştirdiğinde şerit birkaç saniye görünür. Saydamlık %0 iken şerit çentik gibi tam siyahtır."),
          h("div", { class: "kucuk-yazi" }, "Özete tıklayınca tam panel açılır. macOS ilk seferde Spotify ve tarayıcı için izin sorar. YouTube'da oynat/duraklat için tarayıcıda “Apple Events'ten JavaScript'e İzin Ver” açık olmalıdır."))),
      h("section", { class: "bolum" }, h("h2", null, "Genel"),
        h("div", { class: "kart" },
          h("label", { class: "alan", style: "margin-top:0" }, h("span", null, "Yenileme sıklığı (dakika)"), dk),
          h("label", { class: "onay" }, sabit, "Paneli ekranda sabit tut (başka yere tıklayınca kapanmasın)"),
          h("label", { class: "onay" }, acilis, "Mac açılınca Appati'yi başlat"),
          h("label", { class: "onay" }, bildirim, "Bildirim gönder (düşük puanlı yorum, yeni abone, okunamayan kaynak)"),
          h("label", { class: "alan" }, h("span", null, "Menü çubuğunda simgenin yanındaki sayı"), cubuk),
          h("div", { class: "kucuk-yazi" }, "Kısayol: ⌥⌘A paneli açar ve kapatır."))),
      h("section", { class: "bolum" }, h("h2", null, "Güncelleme"),
        h("div", { class: "kart" },
          h("div", null, `Kurulu sürüm: ${P.surum || "?"}`),
          h("div", { class: "kucuk-yazi" }, guncellemeYazisi(P.guncelleme || {})),
          h("label", { class: "onay" }, otoGun, "Yeni sürümleri kendiliğinden indir"),
          (P.guncelleme || {}).durum === "kapali" ? null : h("div", { class: "eylem" },
            (P.guncelleme || {}).durum === "hazir"
              ? h("button", { class: "btn ana", onclick: () => kopru.guncellemeKur() }, "Yeniden başlat ve güncelle")
              : h("button", { class: "btn", onclick: async () => { P = await kopru.guncellemeDenetle(); ciz(); } }, "Şimdi denetle")))),
      P.gunluk ? h("section", { class: "bolum" }, h("h2", null, "Sorun giderme"),
        h("div", { class: "kart kucuk-yazi", style: "margin-top:0" }, "Bir şey çalışmazsa hata kaydı şu dosyadadır: ", P.gunluk)) : null,
      h("section", { class: "bolum" }, h("h2", null, "Gizlilik"),
        h("div", { class: "kart kucuk-yazi", style: "margin-top:0" }, "Anahtarların macOS Anahtar Zinciri ile şifrelenip yalnızca bu Mac'te saklanır. Appati'nin sunucusu yoktur; veriler doğrudan senin hesaplarından okunur.")),
      h("div", { class: "eylem" }, h("button", { class: "btn tehlike", onclick: () => kopru.cik() }, "Appati'den çık"))),
  ];
}

function formAc(id, sablon) {
  const var_ = id ? P.ayar.uygulamalar.find((u) => u.id === id) : null;
  const kaynak = var_ || sablon || {};
  G = { ad: "form", taslak: {
    id: var_ ? var_.id : null, ad: kaynak.ad || "", renk: kaynak.renk || RENKLER[P.ayar.uygulamalar.length % RENKLER.length],
    kaynaklar: JSON.parse(JSON.stringify(kaynak.kaynaklar || {})), gizli: {}, gizliVar: (var_ && var_.gizliVar) || {},
  } };
  ciz();
}

function formGorunumu() {
  const t = G.taslak;
  const hata = h("div", { class: "hata-yazi", role: "alert", hidden: true });
  const ad = h("input", { type: "text", value: t.ad, placeholder: "ucler.", oninput: (o) => { t.ad = o.target.value; } });
  const renkler = h("div", { class: "renkler", role: "group", "aria-label": "Renk" }, RENKLER.map((r) =>
    h("button", { type: "button", style: `background:${r}`, "aria-label": `Renk ${r}`, "aria-pressed": String(t.renk === r), onclick: () => { t.renk = r; ciz(); } })));

  const kaynakKartlari = P.katalog.map((k) => {
    t.kaynaklar[k.tur] = t.kaynaklar[k.tur] || {};
    t.gizli[k.tur] = t.gizli[k.tur] || {};
    const acik = t.kaynaklar[k.tur];
    const bagli = k.alanlar.filter((a) => a.gizli).every((a) => t.gizliVar[k.tur]?.[a.ad]);
    const dolu = bagli || Object.values(acik).some(Boolean);
    return h("details", { class: "kart", open: dolu && !bagli },
      h("summary", null, h("b", null, k.ad), h("span", null, k.ne), bagli ? h("em", null, "bağlı") : null),
      k.alanlar.map((a) => {
        const kayitli = a.gizli && t.gizliVar[k.tur]?.[a.ad];
        const ozellik = {
          placeholder: kayitli ? "Kayıtlı. Değiştirmek için yenisini yapıştır." : a.ornek || "",
          value: a.gizli ? t.gizli[k.tur][a.ad] || "" : acik[a.ad] || "",
          spellcheck: "false", autocomplete: "off",
          oninput: (o) => { (a.gizli ? t.gizli[k.tur] : acik)[a.ad] = o.target.value; },
        };
        const giris = a.cokSatir ? h("textarea", { rows: 3, ...ozellik }) : h("input", { type: a.gizli ? "password" : "text", ...ozellik });
        return h("label", { class: "alan" }, h("span", null, a.etiket), giris, a.ipucu ? h("small", null, a.ipucu) : null);
      }));
  });

  const kaydet = async () => {
    if (!t.ad.trim()) { hata.textContent = "Uygulamaya bir ad ver."; hata.hidden = false; ad.focus(); return; }
    try {
      P = await kopru.uygulamaKaydet({ id: t.id, ad: t.ad, renk: t.renk, kaynaklar: t.kaynaklar, gizli: t.gizli });
      G = { ad: "genel" }; ciz();
    } catch (e) { hata.textContent = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""); hata.hidden = false; }
  };
  let silOnay = false;
  const silDugme = h("button", { class: "btn tehlike", onclick: async () => {
    if (!silOnay) { silOnay = true; silDugme.textContent = "Emin misin? Anahtarları da silinir"; return; }
    P = await kopru.uygulamaSil(t.id); G = { ad: "ayar" }; ciz();
  } }, "Uygulamayı sil");

  return [
    ustCubuk(dugme("geri", "Vazgeç", () => git({ ad: "ayar" })), t.id ? "Uygulamayı düzenle" : "Uygulama ekle", "Yalnızca elinde olan kaynakları doldur", null),
    h("div", { class: "govde" },
      h("section", { class: "bolum" }, h("h2", null, "Uygulama"),
        h("div", { class: "kart" }, h("label", { class: "alan", style: "margin-top:0" }, h("span", null, "Ad"), ad), h("label", { class: "alan" }, h("span", null, "Renk")), renkler)),
      h("section", { class: "bolum" }, h("h2", null, "Veri kaynakları"), kaynakKartlari),
      hata,
      h("div", { class: "eylem" }, h("button", { class: "btn ana", onclick: kaydet }, "Kaydet"), h("button", { class: "btn", onclick: () => git({ ad: "ayar" }) }, "Vazgeç"), t.id ? silDugme : null)),
  ];
}

/* ---------- akış ---------- */

function git(yeni) { G = yeni; ciz(true); }

async function yenile() {
  P.durum = { ...P.durum, yukleniyor: true }; ciz();
  P = await kopru.yenile(); ciz();
}

async function sabitDegistir() {
  P = await kopru.genelKaydet({ ...P.ayar.genel, sabit: !P.ayar.genel.sabit }); ciz();
}

// Saydamlık ve macOS vurgu rengi CSS değişkenlerine yazılır; açık / koyu geçişini tarayıcı kendisi yapar.
function gorunumUygula(genel) {
  const kok_ = document.documentElement.style;
  kok_.setProperty("--ton", String(Math.round((0.95 - (genel.saydamlik ?? 60) * 0.008) * 100) / 100));
  if (P && /^#[0-9a-f]{6}$/i.test(P.vurgu || "")) kok_.setProperty("--vurgu", P.vurgu); else kok_.removeProperty("--vurgu");
}

function ciz(basaDon) {
  ipucuGizle();
  gorunumUygula(P.ayar.genel);
  const eski = kok.querySelector(".govde");
  const kaydirma = eski && !basaDon ? eski.scrollTop : 0;
  const gorunum = G.ad === "uyg" ? uygulamaGorunumu() : G.ad === "ayar" ? ayarGorunumu() : G.ad === "form" ? formGorunumu() : genelGorunum();
  kok.replaceChildren(...gorunum.flat().filter(Boolean));
  const yeni = kok.querySelector(".govde");
  if (yeni) yeni.scrollTop = kaydirma;
}

document.addEventListener("keydown", (o) => {
  if (o.key !== "Escape") return;
  if (G.ad === "genel") kopru.gizle(); else git(G.ad === "form" ? { ad: "ayar" } : { ad: "genel" });
});

kopru.durumDinle((d) => {
  if (!P) return;
  P.durum = d;
  if (G.ad !== "form" && G.ad !== "ayar") ciz();
});

// Ayarlar ekranı açıkken üzerine yazma; kullanıcının yaptığı değişiklik kaybolmasın.
kopru.ayarDinle((a) => { if (P && G.ad !== "form" && G.ad !== "ayar") P.ayar = a; });
kopru.gitDinle((g) => { if (P) git(g); });
kopru.guncellemeDinle((g) => { if (!P) return; P.guncelleme = g; if (G.ad === "genel" || G.ad === "ayar") ciz(); });
kopru.vurguDinle((r) => { if (P) { P.vurgu = r; gorunumUygula(P.ayar.genel); } });

kopru.baslangic().then((p) => { P = p; ciz(); });
