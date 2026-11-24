// Kaynakların ortak yardımcıları: gün anahtarları, ağ isteği, JWT.
const crypto = require("node:crypto");

const GUN = 86400000;

function gunAnahtari(d) {
  const y = d.getFullYear(), a = String(d.getMonth() + 1).padStart(2, "0"), g = String(d.getDate()).padStart(2, "0");
  return `${y}-${a}-${g}`;
}

function gunBasi(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Bugün dahil son n günün anahtarları, eskiden yeniye.
function sonGunler(simdi, n) {
  const b = gunBasi(simdi);
  const liste = [];
  for (let i = n - 1; i >= 0; i--) liste.push(gunAnahtari(new Date(b.getFullYear(), b.getMonth(), b.getDate() - i)));
  return liste;
}

// {gün: değer} sözlüğünü, eksik günleri 0 sayarak sıralı seriye çevirir.
function seri(gunler, sozluk) {
  return gunler.map((g) => ({ g, v: sozluk[g] || 0 }));
}

function topla(seriDizi, bas, son) {
  return seriDizi.slice(bas, son).reduce((t, n) => t + (n.v || 0), 0);
}

class KaynakHatasi extends Error {
  constructor(mesaj, durum) {
    super(mesaj);
    this.durum = durum;
  }
}

// fetch sarmalayıcı: zaman aşımı, anlaşılır hata. tur: "json" | "metin" | "tampon" | "yanit"
function istekci(fetchFn, zamanAsimi = 20000, tekrarBekleme = 800) {
  return async function istek(url, secenek = {}, tur = "json") {
    let yanit;
    // Bağlantı kurulamazsa bir kez daha denenir (anlık kopukluk, uyku sonrası).
    for (let deneme = 0; ; deneme++) {
      try {
        yanit = await fetchFn(url, { ...secenek, signal: AbortSignal.timeout(zamanAsimi) });
        break;
      } catch (e) {
        if (deneme === 0) { await new Promise((r) => setTimeout(r, tekrarBekleme)); continue; }
        throw new KaynakHatasi(e.name === "TimeoutError" ? "Zaman aşımı" : `Bağlanılamadı (${e.cause?.code || e.message})`);
      }
    }
    if (tur === "yanit") return yanit;
    if (!yanit.ok) {
      let govde = "";
      try { govde = (await yanit.text()).slice(0, 200); } catch {}
      const ne = yanit.status === 401 || yanit.status === 403 ? "Anahtar reddedildi" : `HTTP ${yanit.status}`;
      throw new KaynakHatasi(`${ne}${govde ? `: ${govde.replace(/\s+/g, " ")}` : ""}`, yanit.status);
    }
    if (tur === "tampon") return Buffer.from(await yanit.arrayBuffer());
    if (tur === "metin") return yanit.text();
    return yanit.json();
  };
}

const b64u = (v) => Buffer.from(v).toString("base64url");

// alg: "ES256" (App Store Connect) ya da "RS256" (Google servis hesabı)
function jwtImzala(alg, baslik, yuk, ozelAnahtar) {
  const veri = `${b64u(JSON.stringify({ alg, typ: "JWT", ...baslik }))}.${b64u(JSON.stringify(yuk))}`;
  const imza = alg === "ES256"
    ? crypto.sign("sha256", Buffer.from(veri), { key: ozelAnahtar, dsaEncoding: "ieee-p1363" })
    : crypto.sign("RSA-SHA256", Buffer.from(veri), ozelAnahtar);
  return `${veri}.${imza.toString("base64url")}`;
}

module.exports = { GUN, gunAnahtari, gunBasi, sonGunler, seri, topla, istekci, jwtImzala, KaynakHatasi };
