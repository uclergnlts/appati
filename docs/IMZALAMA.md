# Developer ID ile imzalama

Appati imzalanıp Apple'a onaylatılınca (notarization):

- İlk açılıştaki "Yine de Aç" uyarısı çıkmaz.
- Yeni sürüm kurunca macOS Anahtar Zinciri şifre sormaz; kayıtlı anahtarlar kendiliğinden okunur.

Derleme iş akışı hazır: aşağıdaki beş sır depoya eklenince imzalı paketlemeye kendiliğinden geçer, eklenmezse eskisi gibi imzasız paketler.

## 1. Developer ID sertifikası oluştur (bir kez)

1. Mac'te **Anahtar Zinciri Erişimi** > menüden **Sertifika Yardımcısı > Sertifika Yetkilisinden Sertifika İste**. E-postanı yaz, "Diske kaydet"i seç. Bir `.certSigningRequest` dosyası kaydeder.
2. [developer.apple.com/account/resources/certificates/add](https://developer.apple.com/account/resources/certificates/add) > **Developer ID Application** seç > az önceki dosyayı yükle > sertifikayı (`.cer`) indir. Bu türü yalnızca hesap sahibi oluşturabilir.
3. İnen `.cer` dosyasına çift tıkla; Anahtar Zinciri'ne eklenir.
4. Anahtar Zinciri Erişimi'nde **Sertifikalarım** altında "Developer ID Application: …" satırına sağ tıkla > **Dışa Aktar** > biçim `.p12` > bir parola belirle.

## 2. Sırları GitHub'a ekle

`appati` deposu > **Settings > Secrets and variables > Actions > New repository secret**:

| Sır | Değer |
|---|---|
| `MAC_CERT_P12` | `.p12` dosyasının base64 hâli. Terminal'de: `base64 -i sertifika.p12 \| pbcopy` |
| `MAC_CERT_PASSWORD` | Dışa aktarırken belirlediğin parola |
| `ASC_ANAHTAR` | App Store Connect API anahtarının (`.p8`) içeriği: `pbcopy < AuthKey_XXXXXXXXXX.p8` |
| `ASC_ANAHTAR_ID` | O anahtarın Key ID'si |
| `ASC_YAYINCI_ID` | Issuer ID |

Son üçü `ucler.app` deposunda TestFlight için kullandıklarınla aynıdır; GitHub sırları depolar arasında paylaşılmadığı için buraya da eklenmeleri gerekir.

## 3. Derle

Sırlar eklendikten sonra **Actions > Mac uygulaması > Run workflow**. İş akışı imzalar, Apple'a onaylatır ve sonucu `codesign` ile `spctl` üzerinden doğrular; doğrulama geçmezse derleme kırmızı olur.

İmzalı ilk sürümü kurduğunda Anahtar Zinciri bir kez daha şifre sorar (eski kayıt imzasız sürüme aitti). Sonraki sürümlerde sormaz.
