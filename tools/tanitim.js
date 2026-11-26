// Tanıtım görselleri (1600×900, sosyal medya için): gerçek ekran görüntülerinden kart üretir.
// Önce o dilde önizleme al:  PREVIEW_DIL=en npm run preview   Sonra:  node tools/tanitim.js en [yazı-tipi-klasörü]
// Çıktı: docs/tanitim/<dil>-1-kapak.jpg … Ekran görüntülerindeki sayılar örnek veridir.
const { chromium } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");

const dil = process.argv[2] || "en";
const yaziKlasoru = process.argv[3] || "";
const kok = path.join(__dirname, "..");
const goruntu = (ad) => `file://${path.join(kok, "preview", dil === "tr" ? "" : dil, ad)}`;
const veri = (dosya) => `data:image/png;base64,${fs.readFileSync(dosya).toString("base64")}`;

const M = {
  en: {
    ust: "macOS menu bar app", baslik: "Your apps’ numbers,<br>at the <i>edge</i> of your Mac.", alt: "Users, traffic, subscribers, revenue, reviews and YouTube stats for every app you make.",
    etiketler: ["Free", "Open source", "No account, no server"], adres: "uclergnlts.com/appati",
    b2: "Everything in <i>one</i> panel", a2: "Summary, Google search and YouTube channels, side by side with your users and revenue.",
    b3: "Today’s numbers,<br>in the <i>notch</i>", a3: "Move the pointer to the notch. Your numbers drop down, next to the song you’re playing.",
    b4: "Works with what<br>you <i>already</i> use", a4: "Connect only the services you have. A read-only key is enough, and it never leaves your Mac.",
    gruplar: [["Users", ["Supabase", "Firebase", "Custom endpoint"]], ["Site traffic", ["Umami", "Plausible", "Google Analytics"]], ["Revenue", ["RevenueCat", "Stripe"]], ["Stores", ["App Store Connect", "Google Play"]], ["Search and video", ["Search Console", "YouTube"]]],
    ornek: "Screens show sample data",
  },
  tr: {
    ust: "macOS menü çubuğu uygulaması", baslik: "Uygulamalarının rakamları,<br>Mac’inin <i>kenarında.</i>", alt: "Yaptığın her uygulamanın kullanıcı, trafik, abone, gelir, yorum ve YouTube rakamları.",
    etiketler: ["Ücretsiz", "Açık kaynak", "Hesap yok, sunucu yok"], adres: "uclergnlts.com/appati",
    b2: "Hepsi <i>tek</i> panelde", a2: "Özet, Google araması ve YouTube kanalları; kullanıcı ve gelir rakamlarınla yan yana.",
    b3: "Bugünün rakamları<br><i>çentikte</i>", a3: "Fareyi çentiğe götür. Rakamların, çalan şarkının yanında açılsın.",
    b4: "Zaten kullandığın<br>servislerle <i>çalışır</i>", a4: "Yalnızca elindeki servisleri bağla. Salt okunur bir anahtar yeter; Mac’inden dışarı çıkmaz.",
    gruplar: [["Kullanıcılar", ["Supabase", "Firebase", "Özel uç nokta"]], ["Site trafiği", ["Umami", "Plausible", "Google Analytics"]], ["Gelir", ["RevenueCat", "Stripe"]], ["Mağazalar", ["App Store Connect", "Google Play"]], ["Arama ve video", ["Search Console", "YouTube"]]],
    ornek: "Ekranlar örnek veri gösterir",
  },
}[dil];

const yazi = yaziKlasoru ? `
@font-face{font-family:G;font-weight:100 900;src:url(file://${path.join(yaziKlasoru, "geist-latin-ext-wght-normal.woff2")}) format("woff2");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:G;font-weight:100 900;src:url(file://${path.join(yaziKlasoru, "geist-latin-wght-normal.woff2")}) format("woff2")}` : "";

const stil = `${yazi}
*{box-sizing:border-box;margin:0}
body{width:1600px;height:900px;overflow:hidden;font-family:G,-apple-system,"Helvetica Neue",Arial,sans-serif;color:#f4f2ee;-webkit-font-smoothing:antialiased;
  background:radial-gradient(900px 620px at 88% 8%,rgba(57,135,229,.42),transparent 62%),radial-gradient(760px 560px at 6% 100%,rgba(144,133,233,.30),transparent 60%),radial-gradient(520px 420px at 60% 110%,rgba(217,89,38,.20),transparent 60%),#0b0c10}
.sayfa{position:absolute;inset:0;padding:76px 88px}
.marka{display:flex;align-items:center;gap:16px;font-size:30px;font-weight:650;letter-spacing:-.02em}
.marka img{width:56px;height:56px;border-radius:14px}
.marka span{font-size:19px;font-weight:450;color:#a9a8b3;letter-spacing:0;margin-left:6px}
h1{font-size:78px;line-height:1.03;letter-spacing:-.045em;font-weight:650;margin-top:54px;max-width:900px}
h1.orta{font-size:74px}
h1 i{font-style:normal;color:#8fc0ff}
p.alt{font-size:27px;line-height:1.45;color:#b9b8c4;margin-top:26px;max-width:640px}
.etiketler{display:flex;gap:12px;margin-top:38px;flex-wrap:wrap}
.etiketler span{font-size:21px;padding:11px 20px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16)}
.etiketler span.ana{background:#f4f2ee;color:#0b0c10;border-color:transparent;font-weight:650}
.adres{position:absolute;left:88px;bottom:64px;font-size:25px;font-weight:600;letter-spacing:-.01em}
.ornek{position:absolute;right:88px;top:96px;font-size:17px;color:#8d8c97}
.panel{position:absolute;border-radius:26px;overflow:hidden;box-shadow:0 50px 120px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.14)}
.panel img{display:block;width:100%}
.ekran{position:absolute;border-radius:30px 30px 0 0;overflow:hidden;box-shadow:0 0 0 12px #17181d,0 0 0 13px rgba(255,255,255,.14),0 60px 140px rgba(0,0,0,.6);
  background:linear-gradient(160deg,#e9a66b,#c95f7c 40%,#3d6fb3 75%,#1f3a5c)}
.ekran .cubuk{position:absolute;inset:0 0 auto 0;height:44px;background:rgba(20,20,26,.28);backdrop-filter:blur(20px)}
.ekran .centik{position:absolute;top:0;left:50%;width:250px;height:44px;margin-left:-125px;background:#000;border-radius:0 0 14px 14px}
.ekran img{position:absolute;top:0;left:50%;transform:translateX(-50%)}
.tablo{position:absolute;right:88px;top:110px;width:760px;display:grid;gap:14px}
.grup{display:grid;grid-template-columns:190px 1fr;align-items:center;gap:18px;padding:20px 24px;border-radius:22px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13)}
.grup b{font-size:21px;font-weight:600;color:#a9a8b3}
.grup div{display:flex;flex-wrap:wrap;gap:10px}
.grup span{font-size:22px;font-weight:550;padding:9px 16px;border-radius:12px;background:rgba(255,255,255,.1)}
`;
const marka = (ikon) => `<div class="marka"><img src="${ikon}" alt="">Appati<span>${M.ust}</span></div>`;

function kartlar(ikon) {
  const etiket = M.etiketler.map((e, i) => `<span class="${i ? "" : "ana"}">${e}</span>`).join("");
  return {
    "1-kapak": `<div class="sayfa">${marka(ikon)}<h1>${M.baslik}</h1><p class="alt">${M.alt}</p><div class="etiketler">${etiket}</div></div>
      <div class="panel" style="right:120px;top:150px;width:470px;height:900px"><img src="${goruntu("3-ozet.png")}"></div>
      <div class="adres">${M.adres}</div><div class="ornek">${M.ornek}</div>`,
    "2-panel": `<div class="sayfa">${marka(ikon)}<h1 class="orta">${M.b2}</h1><p class="alt" style="max-width:1100px">${M.a2}</p></div>
      ${["3-ozet.png", "3-arama.png", "3-youtube.png", "3-kullanici.png"].map((d, i) => `<div class="panel" style="left:${88 + i * 362}px;top:${392 + (i % 2) * 26}px;width:338px;height:620px"><img src="${goruntu(d)}"></div>`).join("")}
      <div class="ornek">${M.ornek}</div>`,
    "3-centik": `<div class="sayfa">${marka(ikon)}<h1 class="orta">${M.b3}</h1><p class="alt" style="max-width:560px">${M.a3}</p><div class="etiketler"><span>Spotify</span><span>YouTube</span></div></div>
      <div class="ekran" style="right:60px;top:210px;width:840px;height:760px"><div class="cubuk"></div><div class="centik"></div><img src="${goruntu("8-centik-calan.png")}" style="width:780px"></div>
      <div class="adres">${M.adres}</div><div class="ornek">${M.ornek}</div>`,
    "4-kaynaklar": `<div class="sayfa">${marka(ikon)}<h1 class="orta">${M.b4}</h1><p class="alt" style="max-width:520px">${M.a4}</p></div>
      <div class="tablo">${M.gruplar.map(([g, k]) => `<div class="grup"><b>${g}</b><div>${k.map((x) => `<span>${x}</span>`).join("")}</div></div>`).join("")}</div>
      <div class="adres">${M.adres}</div>`,
  };
}

(async () => {
  const cikti = path.join(kok, "docs", "tanitim");
  fs.mkdirSync(cikti, { recursive: true });
  const ikon = veri(path.join(kok, "assets", "icon.png"));
  const tarayici = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  for (const [ad, govde] of Object.entries(kartlar(ikon))) {
    const sayfa = await tarayici.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
    const dosya = path.join(cikti, `.${dil}-${ad}.html`);
    fs.writeFileSync(dosya, `<!doctype html><html lang="${dil}"><meta charset="utf-8"><style>${stil}</style><body>${govde}</body></html>`);
    await sayfa.goto(`file://${dosya}`, { waitUntil: "networkidle" });
    await sayfa.evaluate(() => document.fonts.ready);
    await sayfa.screenshot({ path: path.join(cikti, `${dil}-${ad}.jpg`), type: "jpeg", quality: 90 });
    fs.unlinkSync(dosya);
    await sayfa.close();
  }
  await tarayici.close();
  console.log("Görseller:", cikti);
})();
