"use strict";
// Çentik adası: bugünün rakamları ve çalan şarkı / video. Ana süreç fare çentiğe gelince { acik: true, ... } gönderir.

const kopru = window.appati || { centikDinle() {}, paneliAc() {}, medyaKomut: async () => ({ tamam: true }), medyaAc() {} };
if (!window.appati) document.body.classList.add("onizleme");

const SVGNS = "http://www.w3.org/2000/svg";
const ada = document.getElementById("ada");
const kucuk = document.getElementById("kucuk");
let ipucu = null; // { metin, bitis }

function h(etiket, ozellik, ...cocuklar) {
  const e = document.createElement(etiket);
  for (const [a, d] of Object.entries(ozellik || {})) {
    if (d === undefined || d === null || d === false) continue;
    if (a === "class") e.className = d; else if (a.startsWith("on")) e.addEventListener(a.slice(2), d); else e.setAttribute(a, d);
  }
  for (const c of cocuklar.flat()) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

const YOL = {
  oynat: "M4 2.5v11l9-5.5z",
  durdur: "M3.5 2.5h3.2v11H3.5zM9.3 2.5h3.2v11H9.3z",
  ikisi: "M1.5 3v10l6-5zM9 3h2v10H9zM12.5 3h2v10h-2z",
  sonraki: "M2.5 3v10l7-5zM10.5 3h2.5v10h-2.5z",
  onceki: "M13.5 3v10l-7-5zM3 3h2.5v10H3z",
  nota: "M6 12.5a2 2 0 1 1-1.2-1.8V3.2l7-1.4v8.7a2 2 0 1 1-1.2-1.8V4.3L6 5.2z",
};
function ikon(ad) {
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("aria-hidden", "true");
  const yol = document.createElementNS(SVGNS, "path"); yol.setAttribute("d", YOL[ad]); yol.setAttribute("fill", "currentColor");
  svg.append(yol); return svg;
}

function tus(ad, etiket, komut) {
  return h("button", { class: "tus", title: etiket, "aria-label": etiket, onclick: async () => {
    const r = await kopru.medyaKomut(komut);
    if (r && r.ipucu) { ipucu = { metin: r.ipucu, bitis: Date.now() + 8000 }; if (sonVeri) ciz(sonVeri); }
  } }, ikon(ad));
}

function medyaParcasi(v) {
  const m = v.medya;
  if (!m) {
    return h("div", { class: "medya acik-degil" },
      h("span", null, "Şu an çalan bir şey yok"),
      h("button", { class: "ac", onclick: () => kopru.medyaAc("spotify") }, "Spotify"),
      h("button", { class: "ac", onclick: () => kopru.medyaAc("youtube") }, "YouTube"));
  }
  const kapak = m.kapak ? h("img", { class: "kapak", src: m.kapak, alt: "" }) : h("div", { class: "kapak" }, ikon("nota"));
  const uyari = ipucu && ipucu.bitis > Date.now() ? ipucu.metin : null;
  const tuslar = m.kaynak === "spotify"
    ? [tus("onceki", "Önceki", "onceki"), tus(m.oynuyor ? "durdur" : "oynat", m.oynuyor ? "Duraklat" : "Oynat", "oynat"), tus("sonraki", "Sonraki", "sonraki")]
    : [m.oynuyor === null ? tus("ikisi", "Oynat / duraklat", "oynat") : tus(m.oynuyor ? "durdur" : "oynat", m.oynuyor ? "Duraklat" : "Oynat", "oynat")];
  return h("div", { class: "medya" }, kapak,
    h("div", { class: "parca" }, h("b", { title: m.baslik }, m.baslik), h("span", { class: uyari ? "ipucu" : null }, uyari || m.alt)),
    h("div", { class: "tuslar" }, tuslar));
}

let sonVeri = null;
function ciz(v) {
  sonVeri = v;
  const rakamlar = h("button", { class: "rakamlar", title: "Tam paneli aç", onclick: () => kopru.paneliAc() },
    v.rakamlar && v.rakamlar.length
      ? v.rakamlar.map((r) => h("div", { class: "rakam" }, h("b", null, r.deger), h("span", null, r.etiket)))
      : h("div", { class: "rakam bos" }, "Veri okunuyor…"));
  // replaceChildren boş değerleri "null" yazısına çevirir; önce ayıkla.
  ada.replaceChildren(...[v.demo ? h("div", { class: "ornek" }, "örnek veri") : null, rakamlar, v.medyaAcik ? h("div", { class: "ayrac" }) : null, v.medyaAcik ? medyaParcasi(v) : null].filter(Boolean));
}

// Küçük ada: çalarken çentiğin solunda kapak, sağında hareketli ses çubukları. Kapak aynıysa yeniden çizilmez
// (çubukların canlandırması her güncellemede baştan başlamasın).
let kucukImza = null;
function kucukCiz(v) {
  document.documentElement.style.setProperty("--kb", `${v.kb || 32}px`);
  const imza = v.kucuk ? `${v.kucuk.kaynak}|${v.kucuk.kapak}` : null;
  if (imza === kucukImza) return;
  kucukImza = imza;
  kucuk.hidden = !v.kucuk;
  if (!v.kucuk) { kucuk.replaceChildren(); return; }
  const kapak = v.kucuk.kapak ? h("img", { class: "mini-kapak", src: v.kucuk.kapak, alt: "" }) : h("div", { class: "mini-kapak" }, ikon("nota"));
  kucuk.replaceChildren(kapak, h("div", { class: "dalga", role: "img", "aria-label": "Çalıyor" }, [0, 1, 2, 3, 4].map(() => h("i"))));
}

kopru.centikDinle((v) => {
  kucukCiz(v);
  if (v.acik) { ciz(v); requestAnimationFrame(() => ada.classList.add("acik")); } else ada.classList.remove("acik");
});

// Tarayıcı önizlemesi (tools/preview.js)
if (window.__CENTIK__) { kucukCiz(window.__CENTIK__); if (window.__CENTIK__.acik) { ciz(window.__CENTIK__); ada.classList.add("acik"); } }
