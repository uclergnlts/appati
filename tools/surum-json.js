// Otomatik güncellemenin okuduğu besleme dosyasını üretir (Squirrel.Mac "json" biçimi).
// Kullanım: node tools/surum-json.js <sürüm> <sahip/depo>  →  stdout'a releases.json
function besleme(surum, depo, tarih = new Date()) {
  if (!/^\d+\.\d+\.\d+$/.test(String(surum))) throw new Error(`Geçersiz sürüm: ${surum}`);
  if (!/^[\w.-]+\/[\w.-]+$/.test(String(depo))) throw new Error(`Geçersiz depo: ${depo}`);
  return {
    currentRelease: surum,
    releases: [{
      version: surum,
      updateTo: {
        version: surum, name: `Appati ${surum}`, pub_date: tarih.toISOString(), notes: `Appati ${surum}`,
        url: `https://github.com/${depo}/releases/download/v${surum}/Appati-${surum}-universal.zip`,
      },
    }],
  };
}

if (require.main === module) process.stdout.write(`${JSON.stringify(besleme(process.argv[2], process.argv[3]), null, 2)}\n`);
module.exports = { besleme };
