# Appati

Bütün uygulamalarının rakamları, Mac'inin kenarında tek panelde. Menü çubuğunda durur; simgeye tıklayınca (ya da ⌥⌘A) ekranın sağ kenarında açılır.

![Panel](docs/panel.png)

*Görseldeki sayılar örnek veridir. Solda koyu, ortada açık tema; sağda ayarlar.*

## Ne gösterir

| Kaynak | Ne gelir | Gereken |
|---|---|---|
| Supabase | Kayıtlı kullanıcı, günlük yeni kayıt, aktif kullanıcı, kendi tablo sayaçların | Proje adresi + gizli anahtar |
| Umami | Site ziyaretçisi, nereden geldikleri, en çok açılan sayfalar, ülkeler | Website ID + API anahtarı |
| RevenueCat | Abone, deneme, MRR, 28 günlük gelir | Project ID + gizli v2 anahtarı |
| App Store Connect | iOS yorumları, günlük ilk indirme | Apple ID, Issuer ID, Key ID, .p8 (+ indirme için Vendor Number) |
| Google Play | Android yorumları (son bir hafta) | Paket adı + servis hesabı JSON'u |

Her uygulama için yalnızca elinde olan kaynakları doldurursun; bir kaynak bozulursa diğerleri çalışmaya devam eder ve panel neyin okunamadığını yazar. "Bugün neye bakmalı" bölümü haftalık düşüşleri, düşük puanlı yorumları ve okunamayan kaynakları öne çıkarır.

Hiç uygulama eklenmemişken panel **örnek veri** gösterir ve bunu açıkça yazar.

## Kurulum

### Hazır uygulama
GitHub'da **Actions > Mac uygulaması** çalışmasının altındaki `Appati-mac` dosyasını indir, içindeki `.dmg`'yi aç, Appati'yi Uygulamalar klasörüne sürükle.

Uygulama Apple Developer ID ile imzalı değildir. İlk açılışta macOS engellerse: **Sistem Ayarları > Gizlilik ve Güvenlik > Yine de Aç**, ya da Terminal'de:

```bash
xattr -dr com.apple.quarantine /Applications/Appati.app
```

### Kaynaktan
```bash
npm install
npm start          # paneli çalıştır
npm run demo       # örnek veriyle çalıştır
npm run dist       # dist/ altına .dmg ve .zip üret (Mac'te)
```

## Görünüm

- Panel macOS'un bulanık cam malzemesini kullanır; arka plan hafif saydamdır. Saydamlığı **Ayarlar > Görünüm** altındaki kaydırıcıyla ayarlarsın.
- Tema **Sistem / Açık / Koyu** seçilebilir. Sistem'de macOS görünümü değişince panel de değişir.
- Düğmeler ve odak çerçeveleri macOS vurgu rengini kullanır.
- Sistemde "Saydamlığı azalt" açıksa panel opak, "Kontrastı artır" açıksa çizgiler belirgin olur.

## Uygulama ekleme

Panelde dişli simgesi > **Uygulama ekle**. `ucler.` için hazır şablon vardır: proje adresi, Umami kimliği, paket adı ve sayaçlar dolu gelir; yalnızca anahtarları yapıştırırsın.

Anahtarları nereden alırsın:

- **Supabase:** Project Settings > API keys > gizli anahtar (`service_role` ya da `sb_secret_…`). Appati yalnızca okur.
- **Umami:** cloud.umami.is > Settings > API keys.
- **RevenueCat:** Project settings > API keys > New secret key (v2, *Charts metrics: read*). Project ID aynı sayfadadır.
- **App Store Connect:** Users and Access > Integrations > App Store Connect API. İndirme sayıları için anahtarın *Sales* yetkisi ve Vendor Number gerekir.
- **Google Play:** Google Cloud'da servis hesabı oluştur, JSON anahtarını indir, hesabı Play Console > Kullanıcılar ve izinler altında ekle.

### Supabase sayaçları
Her satır bir sayaç: `Etiket | tablo | filtre`. Filtre PostgREST biçimindedir; `{simdi}` ve `{bugun}` yer tutucuları kullanılabilir.

```
Plus abonesi | abonelik | ortam=eq.PRODUCTION&or=(bitis.is.null,bitis.gt.{simdi})
Günün sorusunu çözen (bugün) | gunun_sorusu | gun=eq.{bugun}
```

## Gizlilik

- Anahtarlar macOS Anahtar Zinciri'ne bağlı şifrelemeyle (`safeStorage`) yalnızca bu Mac'te saklanır; arayüze bir daha geri gönderilmez.
- Appati'nin sunucusu yoktur. Veriler doğrudan senin hesaplarından okunur.
- Uygulama imzası değiştiğinde (yeni sürüm kurunca) macOS Anahtar Zinciri erişimi için bir kez izin isteyebilir.

## Bilinen sınırlar

- Günlük aktif kullanıcı geçmişi hiçbir kaynakta hazır durmaz; Appati her gün gördüğü değeri saklar, grafik zamanla dolar.
- App Store indirme raporları bir-iki gün gecikmeli gelir.
- Google Play kurulum sayıları API'de yoktur; yalnızca yorumlar okunur.
- Kaynak okuyucular sahte yanıtlarla sınanmıştır (`npm test`); Umami, RevenueCat, App Store ve Google Play gerçek anahtarla henüz denenmedi.

## Geliştirme

```bash
npm test                         # kaynak okuyucular ve ayar deposu
npm run preview                  # arayüzün ekran görüntüleri (preview/), Playwright gerekir
xvfb-run -a node tools/smoke.js  # Linux'ta gerçek Electron ile uçtan uca duman testi
```

| Yol | Ne |
|---|---|
| `src/main/sources/` | Her veri kaynağı için bir okuyucu |
| `src/main/collect.js` | Kaynakları birleştirir, "neye bakmalı" notlarını üretir |
| `src/main/katalog.js` | Kaynak alanları ve hazır şablonlar (yeni uygulama şablonu buraya eklenir) |
| `src/main/store.js` | Ayarlar, şifreli anahtarlar, önbellek |
| `src/main/main.js` | Menü çubuğu simgesi, pencere, yenileme |
| `src/renderer/` | Panel arayüzü |
