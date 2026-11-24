// Google servis hesabıyla erişim jetonu alır (Google Play ve Google Analytics okuyucuları ortak kullanır).
const { jwtImzala } = require("../util");

function hesapCoz(json) {
  let hesap;
  try { hesap = JSON.parse(json); } catch { throw new Error("Servis hesabı JSON'u okunamadı. Dosyanın içeriğinin tamamını ({ ile başlayıp } ile biten) yapıştır."); }
  if (!hesap.client_email || !hesap.private_key) throw new Error("Servis hesabı JSON'unda client_email / private_key yok");
  return hesap;
}

async function googleJeton(hesap, kapsam, { istek, simdi }) {
  const iat = Math.floor(simdi.getTime() / 1000);
  const onay = jwtImzala("RS256", {}, { iss: hesap.client_email, scope: kapsam, aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 600 }, hesap.private_key);
  const jeton = await istek("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: onay }).toString(),
  });
  return jeton.access_token;
}

module.exports = { hesapCoz, googleJeton };
