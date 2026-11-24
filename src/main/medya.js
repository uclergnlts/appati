// Şu an çalan: Spotify uygulaması ve tarayıcıda açık YouTube videosu. AppleScript ile sorulur (yalnızca macOS).
// Anahtar gerekmez; macOS ilk seferde "Appati, Spotify'ı denetlemek istiyor" diye izin sorar.
const { execFile } = require("node:child_process");

const AYRAC = "\u001f";
// Chromium tabanlı tarayıcılar aynı AppleScript sözlüğünü kullanır.
const KROM = ["Google Chrome", "Brave Browser", "Microsoft Edge", "Arc"];
const TARAYICILAR = [...KROM, "Safari"];

function calistir(komut, argumanlar) {
  return new Promise((coz) => {
    execFile(komut, argumanlar, { timeout: 4000 }, (hata, cikti) => coz(hata ? null : String(cikti).trim()));
  });
}

const SPOTIFY_SOR = `tell application "Spotify"
  set d to player state as string
  if d is "stopped" then return "stopped"
  set a to character id 31
  return d & a & (name of current track) & a & (artist of current track) & a & (artwork url of current track)
end tell`;

// Videonun oynayıp oynamadığı ancak tarayıcı "Apple Events'ten JavaScript'e izin ver" açıksa öğrenilir;
// kapalıysa durum boş döner ve video "bilinmiyor" sayılır.
const DURUM_JS = "(function(){var v=document.querySelector('video');return v?(v.paused?'durdu':'oynuyor'):'yok'})()";
const kromSor = (ad) => `tell application "${ad}"
  repeat with w in windows
    repeat with t in tabs of w
      if URL of t contains "youtube.com/watch" then
        set d to ""
        try
          set d to (execute t javascript "${DURUM_JS}") as string
        end try
        return (title of t) & (character id 31) & (URL of t) & (character id 31) & d
      end if
    end repeat
  end repeat
  return ""
end tell`;

const SAFARI_SOR = `tell application "Safari"
  repeat with w in windows
    repeat with t in tabs of w
      if URL of t contains "youtube.com/watch" then
        set d to ""
        try
          set d to (do JavaScript "${DURUM_JS}" in t) as string
        end try
        return (name of t) & (character id 31) & (URL of t) & (character id 31) & d
      end if
    end repeat
  end repeat
  return ""
end tell`;

// Videoyu oynatır / duraklatır. Tarayıcıda "Apple Events'ten JavaScript'e izin ver" açık olmalıdır.
const VIDEO_JS = "(function(){var v=document.querySelector('video');if(!v)return 'yok';if(v.paused){v.play();return 'oynuyor'}v.pause();return 'durdu'})()";
const kromOynat = (ad) => `tell application "${ad}"
  repeat with w in windows
    repeat with t in tabs of w
      if URL of t contains "youtube.com/watch" then return (execute t javascript "${VIDEO_JS}")
    end repeat
  end repeat
end tell`;
const SAFARI_OYNAT = `tell application "Safari"
  repeat with w in windows
    repeat with t in tabs of w
      if URL of t contains "youtube.com/watch" then return (do JavaScript "${VIDEO_JS}" in t)
    end repeat
  end repeat
end tell`;

function spotifyCoz(cikti) {
  if (!cikti || cikti === "stopped") return null;
  const [d, ad, sanatci, kapak] = cikti.split(AYRAC);
  if (!ad) return null;
  return { kaynak: "spotify", oynuyor: d === "playing", baslik: ad, alt: sanatci || "", kapak: /^https:\/\/i\.scdn\.co\//.test(kapak || "") ? kapak : null };
}

function youtubeCoz(cikti, tarayici) {
  if (!cikti) return null;
  const [baslik, adres, hal] = cikti.split(AYRAC);
  const kimlik = (/[?&]v=([\w-]{6,20})/.exec(adres || "") || [])[1];
  if (!baslik || !kimlik) return null;
  return {
    kaynak: "youtube", tarayici, oynuyor: hal === "oynuyor" ? true : hal === "durdu" ? false : null, alt: `YouTube · ${tarayici}`,
    baslik: baslik.replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*YouTube$/, ""),
    kapak: `https://i.ytimg.com/vi/${kimlik}/mqdefault.jpg`,
  };
}

// calis: (komut, argümanlar) => Promise<çıktı | null>; sınamalarda sahtesi verilir.
function medya(calis = calistir, platform = process.platform) {
  const acik = async (ad) => (await calis("pgrep", ["-xq", ad])) !== null;
  const betik = (b) => calis("osascript", ["-e", b]);

  return {
    // Öncelik: çalan Spotify > açık YouTube videosu > duraklatılmış Spotify.
    async durum() {
      if (platform !== "darwin") return null;
      let spotify = null;
      if (await acik("Spotify")) spotify = spotifyCoz(await betik(SPOTIFY_SOR));
      if (spotify && spotify.oynuyor) return spotify;
      for (const t of TARAYICILAR) {
        if (!(await acik(t))) continue;
        const y = youtubeCoz(await betik(t === "Safari" ? SAFARI_SOR : kromSor(t)), t);
        if (y) return y;
      }
      return spotify;
    },

    // komut: "oynat" | "sonraki" | "onceki". Dönen: { tamam, ipucu? }
    async komut(kaynak, komut, tarayici) {
      if (platform !== "darwin") return { tamam: false };
      if (kaynak === "spotify") {
        const eylem = { oynat: "playpause", sonraki: "next track", onceki: "previous track" }[komut];
        if (!eylem || !(await acik("Spotify"))) return { tamam: false };
        return { tamam: (await betik(`tell application "Spotify" to ${eylem}`)) !== null };
      }
      if (kaynak === "youtube" && komut === "oynat" && TARAYICILAR.includes(tarayici) && (await acik(tarayici))) {
        const r = await betik(tarayici === "Safari" ? SAFARI_OYNAT : kromOynat(tarayici));
        if (r === "oynuyor" || r === "durdu") return { tamam: true, oynuyor: r === "oynuyor" };
        return { tamam: false, ipucu: tarayici === "Safari"
          ? "Safari > Geliştir > “Apple Events'ten JavaScript'e İzin Ver” açık olmalı."
          : `${tarayici} > Görünüm > Geliştirici > “Apple Events'ten JavaScript'e İzin Ver” açık olmalı.` };
      }
      return { tamam: false };
    },
  };
}

module.exports = { medya, spotifyCoz, youtubeCoz, TARAYICILAR };
