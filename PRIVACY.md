# Privacy

Appati has no server and no account. It does not collect analytics, crash reports or usage data.

**What stays on your Mac**

- The keys you enter are encrypted with the macOS Keychain (`safeStorage`) and stored only in the app's data folder (`~/Library/Application Support/Appati`). They are never shown again in the interface.
- The numbers Appati reads are kept in memory and in a small local cache in the same folder.

**What leaves your Mac**

- Requests go directly from your Mac to the services you connect (Supabase, Firebase, Stripe, RevenueCat, Umami, Plausible, Google, Apple, YouTube, or your own endpoint), using your own keys. Nothing is routed through the author.
- The updater downloads `releases.json` and new versions from this project's GitHub Releases.
- Album artwork for the playing song is loaded from Spotify's and YouTube's image servers.

**Permissions macOS may ask for**

- *Keychain*: to read the keys you saved.
- *Automation (Spotify, your browser)*: only if you keep "show the playing song and video" on; used to read the current track and to play/pause.
- *Notifications*: for low-rated reviews, new subscribers, broken sources and the weekly summary.

Removing the app and deleting `~/Library/Application Support/Appati` removes everything it stored.

---

# Gizlilik

Appati'nin sunucusu ve hesabı yoktur; analitik, hata raporu ya da kullanım verisi toplamaz. Girdiğin anahtarlar macOS Anahtar Zinciri ile şifrelenip yalnızca bu Mac'te saklanır. İstekler, kendi anahtarlarınla doğrudan bağladığın servislere gider; hiçbir şey geliştiricinin üzerinden geçmez. Güncelleyici yalnızca bu projenin GitHub yayınlarından yeni sürümü indirir.
