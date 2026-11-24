// Google Play: yorumlar (Android Publisher API). Servis hesabı JSON'u gerekir;
// hesap Play Console'da "Kullanıcılar ve izinler" altında yorumları görme iznine sahip olmalı.
// Not: API yalnızca son bir haftanın yorumlarını verir. Kurulum sayıları bu API'de yoktur.
const { jwtImzala } = require("../util");

module.exports = async function googleplay(ayar, gizli, { istek, simdi }) {
  if (!ayar.packageName) throw new Error("Paket adı eksik");
  if (!gizli.serviceAccount) throw new Error("Servis hesabı JSON'u eksik");
  let hesap;
  try { hesap = JSON.parse(gizli.serviceAccount); } catch { throw new Error("Servis hesabı JSON'u okunamadı"); }
  if (!hesap.client_email || !hesap.private_key) throw new Error("Servis hesabı JSON'unda client_email / private_key yok");

  const iat = Math.floor(simdi.getTime() / 1000);
  const onay = jwtImzala("RS256", {}, {
    iss: hesap.client_email, scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 600,
  }, hesap.private_key);
  const jeton = await istek("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: onay }),
  });

  let r;
  try {
    r = await istek(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(ayar.packageName)}/reviews?maxResults=30`,
      { headers: { Authorization: `Bearer ${jeton.access_token}` } });
  } catch (e) {
    // Google'ın en sık iki reddi: API projede kapalı, ya da hesap Play Console'a eklenmemiş. İkisini de ne yapılacağıyla yaz.
    const m = String(e.message || "");
    if (/has not been used in project|is disabled/i.test(m)) {
      throw new Error(`Google Cloud projesinde (${hesap.project_id || "?"}) “Google Play Android Developer API” kapalı. Google Cloud Console > APIs & Services > Library'de bu API'yi bulup Enable de, birkaç dakika sonra yenile.`);
    }
    if (/does not have permission|insufficient permissions|PERMISSION_DENIED/i.test(m)) {
      throw new Error(`Servis hesabının bu uygulamada yetkisi yok. Play Console > Kullanıcılar ve izinler'de ${hesap.client_email} adresini ekleyip yorumları görüntüleme izni ver; etkinleşmesi biraz sürebilir.`);
    }
    if (e.durum === 404) throw new Error(`Play Console'da “${ayar.packageName}” paket adlı bir uygulama bulunamadı (ya da hesap o uygulamayı göremiyor).`);
    throw e;
  }
  const yorumlar = (r.reviews || []).map((y) => {
    const k = (y.comments || []).map((c) => c.userComment).find(Boolean) || {};
    return {
      magaza: "Google Play",
      puan: k.starRating,
      baslik: "",
      metin: String(k.text || "").trim(),
      yazan: y.authorName || "",
      ulke: k.reviewerLanguage || "",
      tarih: k.lastModified ? new Date(Number(k.lastModified.seconds) * 1000).toISOString() : null,
    };
  });
  return { kpi: {}, yorumlar };
};
