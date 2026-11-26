// YouTube: kanalların herkese açık rakamları (abone, toplam görüntüleme, video sayısı) ve son videoların
// izlenme, beğeni, yorum sayıları. YouTube Data API v3 anahtarı gerekir (Google Cloud > Credentials > API key);
// kanal sahibi olarak giriş gerekmez. İzlenme süresi ve trafik kaynakları gibi ayrıntılar bu API'de yoktur.
// Abone ve görüntülemenin haftalık değişimi için her gün görülen değer saklanır.
const { yerel } = require("../dil");
const { gunAnahtari, GUN } = require("../util");

const API = "https://www.googleapis.com/youtube/v3";

// "@ucler", "UCxxxxxxxx", "https://www.youtube.com/@ucler", "https://youtube.com/channel/UCxxxx" → sorgu parametresi
function kanalCoz(girdi) {
  const m = String(girdi || "").trim();
  if (!m) return null;
  const kimlik = /(?:^|\/channel\/)(UC[\w-]{20,24})(?:[/?#]|$)/.exec(m);
  if (kimlik) return { id: kimlik[1] };
  const tutamac = /(?:^|youtube\.com\/)@([\w.-]{2,60})/.exec(m) || /^([\w.-]{2,60})$/.exec(m);
  if (tutamac) return { forHandle: `@${tutamac[1]}` };
  return null;
}

function hataCevir(e, ne) {
  const m = String(e.message || "");
  if (/has not been used in project|is disabled|accessNotConfigured/i.test(m)) {
    return new Error("Google Cloud projesinde “YouTube Data API v3” kapalı. Google Cloud Console > APIs & Services > Library'de bu API'yi bulup Enable de, birkaç dakika sonra yenile.");
  }
  if (/API key not valid|API_KEY_INVALID|keyInvalid/i.test(m)) return new Error("YouTube API anahtarı geçersiz. Google Cloud Console > APIs & Services > Credentials'tan anahtarı yeniden kopyala.");
  if (/quota/i.test(m)) return new Error("YouTube API'nin günlük kotası doldu; yarın kendiliğinden düzelir.");
  if (/referer|IP address|blocked/i.test(m)) return new Error("API anahtarının kısıtlaması bu isteği engelliyor. Anahtarda “Application restrictions” Yok (None), “API restrictions” YouTube Data API v3 olmalı.");
  return new Error(`${ne}: ${m}`);
}

const sayiYaz = (n) => Math.round(Number(n) || 0).toLocaleString(yerel());

module.exports = async function youtube(ayar, gizli, { istek, simdi, onbellek }) {
  if (!gizli.apiKey) throw new Error("API anahtarı eksik");
  const istenen = String(ayar.kanallar || "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  if (!istenen.length) throw new Error("Kanal eksik");
  const sor = (yol, par) => istek(`${API}/${yol}?${new URLSearchParams({ ...par, key: gizli.apiKey })}`, { headers: { Accept: "application/json" } });

  const kanallar = [];
  const uyarilar = [];
  for (const girdi of istenen.slice(0, 8)) {
    const sorgu = kanalCoz(girdi);
    if (!sorgu) { uyarilar.push(`“${girdi}” kanal olarak tanınmadı (@ad ya da UC… kimliği yaz).`); continue; }
    let k;
    try {
      k = ((await sor("channels", { part: "snippet,statistics,contentDetails", ...sorgu })).items || [])[0];
    } catch (e) {
      throw hataCevir(e, "Kanal okunamadı"); // anahtar ya da API sorunu: bütün kanalları etkiler
    }
    if (!k) { uyarilar.push(`“${girdi}” adında bir kanal bulunamadı.`); continue; }

    const ist = k.statistics || {};
    const kanal = {
      id: k.id, ad: (k.snippet && k.snippet.title) || girdi,
      abone: ist.hiddenSubscriberCount ? undefined : Number(ist.subscriberCount) || 0,
      goruntuleme: Number(ist.viewCount) || 0,
      video: Number(ist.videoCount) || 0,
      videolar: [],
    };

    // Son yüklenen videolar ve rakamları.
    const yuklemeler = k.contentDetails && k.contentDetails.relatedPlaylists && k.contentDetails.relatedPlaylists.uploads;
    if (yuklemeler) {
      try {
        const liste = (await sor("playlistItems", { part: "contentDetails", playlistId: yuklemeler, maxResults: 12 })).items || [];
        const kimlikler = liste.map((o) => o.contentDetails && o.contentDetails.videoId).filter(Boolean);
        if (kimlikler.length) {
          const v = (await sor("videos", { part: "snippet,statistics", id: kimlikler.join(",") })).items || [];
          kanal.videolar = v
            .sort((a, b) => String(b.snippet.publishedAt).localeCompare(String(a.snippet.publishedAt)))
            .map((o) => ({
              ad: o.snippet.title, v: Number(o.statistics.viewCount) || 0,
              alt: [`${sayiYaz(o.statistics.likeCount)} beğeni`, `${sayiYaz(o.statistics.commentCount)} yorum`,
                new Date(o.snippet.publishedAt).toLocaleDateString(yerel(), { day: "numeric", month: "short" })].join(" · "),
            }));
        }
      } catch (e) {
        uyarilar.push(`${kanal.ad}: videolar okunamadı (${hataCevir(e, "hata").message})`);
      }
    }

    // Haftalık değişim: bugünün değeri saklanır, 7 gün (yoksa 6-10 gün) önceki kayıtla karşılaştırılır.
    const anahtar = `youtube.gecmis.${kanal.id}`;
    const gecmis = { ...(onbellek.al(anahtar) || {}) };
    gecmis[gunAnahtari(simdi)] = { abone: kanal.abone, goruntuleme: kanal.goruntuleme };
    const sinir = gunAnahtari(new Date(simdi.getTime() - 15 * GUN));
    for (const g of Object.keys(gecmis)) if (g < sinir) delete gecmis[g];
    onbellek.yaz(anahtar, gecmis);
    for (const n of [7, 8, 6, 9, 10]) {
      const eski = gecmis[gunAnahtari(new Date(simdi.getTime() - n * GUN))];
      if (!eski) continue;
      kanal.goruntuleme7g = kanal.goruntuleme - eski.goruntuleme;
      if (kanal.abone !== undefined && eski.abone !== undefined) kanal.abone7g = kanal.abone - eski.abone;
      break;
    }
    kanallar.push(kanal);
  }
  if (!kanallar.length) throw new Error(uyarilar[0] || "Hiçbir kanal okunamadı");

  const topla = (alan) => kanallar.reduce((t, k) => t + (k[alan] || 0), 0);
  return {
    kpi: {
      ytAbone: topla("abone"), ytGoruntuleme: topla("goruntuleme"),
      ytGoruntuleme7g: kanallar.some((k) => k.goruntuleme7g !== undefined) ? topla("goruntuleme7g") : undefined,
    },
    youtube: { kanallar },
    uyarilar,
  };
};
module.exports.kanalCoz = kanalCoz;
