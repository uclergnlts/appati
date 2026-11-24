// Uygulama simgesini ve menü çubuğu simgesini SVG'den PNG'ye çevirir (Playwright gerekir): npm run icons
const { chromium } = require("playwright");
const path = require("node:path");

const cubuklar = (renk) => `
  <rect x="26" y="56" width="12" height="20" rx="6" fill="${renk}"/>
  <rect x="44" y="40" width="12" height="36" rx="6" fill="${renk}"/>
  <rect x="62" y="24" width="12" height="52" rx="6" fill="${renk}"/>`;

const SIMGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4c94ea"/><stop offset="1" stop-color="#1c3f8f"/></linearGradient></defs>
  <rect x="8" y="8" width="84" height="84" rx="20" fill="url(#g)"/>${cubuklar("#fff")}</svg>`;
const TEPSI = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 18 60 64">${cubuklar("#000")}</svg>`;

(async () => {
  const tarayici = await chromium.launch();
  const ciz = async (svg, boyut, dosya) => {
    const sayfa = await tarayici.newPage({ viewport: { width: boyut, height: boyut } });
    await sayfa.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${boyut}px;height:${boyut}px}</style>${svg}`);
    await sayfa.screenshot({ path: path.join(__dirname, "..", "assets", dosya), omitBackground: true });
    await sayfa.close();
  };
  await ciz(SIMGE, 1024, "icon.png");
  await ciz(TEPSI, 18, "trayTemplate.png");
  await ciz(TEPSI, 36, "trayTemplate@2x.png");
  await tarayici.close();
})();
