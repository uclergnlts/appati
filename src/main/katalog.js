// Kaynak türleri ve ayar alanları. Ayarlar ekranı bu listeden çizilir.
// gizli: true olan alanlar Anahtar Zinciri ile şifrelenir ve arayüze hiç geri gönderilmez.
const KAYNAKLAR = [
  {
    tur: "supabase", ad: "Supabase", ne: "Kayıtlı kullanıcı, yeni kayıt, aktif kullanıcı, tablo sayaçları",
    alanlar: [
      { ad: "url", etiket: "Proje adresi", ornek: "https://xxxx.supabase.co" },
      { ad: "key", etiket: "Gizli anahtar (service_role ya da sb_secret_…)", gizli: true, ipucu: "Supabase > Project Settings > API keys" },
      { ad: "aktifTablo", etiket: "Aktiflik tablosu (isteğe bağlı)", ornek: "ilerleme", ipucu: "Uygulama her kullanıldığında güncellenen tablo. Boşsa son giriş zamanı kullanılır." },
      { ad: "aktifSutun", etiket: "Aktiflik zaman sütunu", ornek: "guncelleme" },
      { ad: "huni", etiket: "Dönüşüm hunisi (isteğe bağlı, her satır bir adım: Etiket | tablo | filtre)", cokSatir: true, ornek: "Profilini dolduran | profil | ad=not.is.null", ipucu: "İlk adım her zaman kayıtlı kullanıcı sayısıdır; adımları geniş olandan dar olana doğru sırala." },
      { ad: "sayaclar", etiket: "Sayaçlar (isteğe bağlı, her satır: Etiket | tablo | filtre)", cokSatir: true, ornek: "Plus abonesi | abonelik | bitis=gt.{simdi}", ipucu: "Filtre PostgREST biçimindedir. {simdi} ve {bugun} yer tutucuları kullanılabilir." },
    ],
  },
  {
    tur: "umami", ad: "Umami", ne: "Site ziyaretçisi, nereden geldikleri, sayfalar, ülkeler (ücretsiz paylaşım bağlantısıyla)",
    alanlar: [
      { ad: "paylasim", etiket: "Paylaşım bağlantısı (Share URL)", gizli: true, ornek: "https://cloud.umami.is/share/AbC123xyz/ucler.app", ipucu: "Umami > Websites > siten > Edit > Share URL'yi aç, çıkan bağlantıyı yapıştır. Ücretli API anahtarı gerekmez. Bağlantıyı bilen herkes istatistikleri görebilir; kimseyle paylaşma." },
      { ad: "olayDokumleri", etiket: "Olay dökümleri (isteğe bağlı, her satır: Etiket | olay | özellik)", cokSatir: true, istege: true, ornek: "En çok anlaşılmayan kartlar | anlamadim | kart", ipucu: "Siteden Umami'ye gönderilen bir olayın bir özelliğine göre son 30 günün dökümünü gösterir." },
    ],
  },
  {
    tur: "searchconsole", ad: "Google Search Console", ne: "Google aramasında tıklama, gösterim, sorgular, sayfalar",
    alanlar: [
      { ad: "siteUrl", etiket: "Mülk (alan adı ya da tam adres)", ornek: "ucler.app", ipucu: "Search Console'da alan adı mülkün varsa yalnızca alan adını yaz (ucler.app). URL ön ekli mülk için tam adresi yaz (https://ucler.app/)." },
      { ad: "serviceAccount", etiket: "Servis hesabı JSON'u", gizli: true, cokSatir: true, yedek: "googleplay", ipucu: "Boş bırakırsan Google Play'e girdiğin servis hesabı kullanılır. Hesabın e-postası Search Console > Ayarlar > Kullanıcılar ve izinler'e eklenmeli; Cloud projesinde Google Search Console API açık olmalı." },
    ],
  },
  {
    tur: "ganalytics", ad: "Google Analytics", ne: "Site ziyaretçisi, nereden geldikleri, sayfalar, ülkeler",
    alanlar: [
      { ad: "propertyId", etiket: "Property ID (sayısal mülk kimliği)", ornek: "412345678", ipucu: "Analytics > Yönetici > Mülk ayrıntıları. G- ile başlayan ölçüm kimliği değil." },
      { ad: "serviceAccount", etiket: "Servis hesabı JSON'u", gizli: true, cokSatir: true, yedek: "googleplay", ipucu: "Boş bırakırsan Google Play'e girdiğin servis hesabı kullanılır. Hesabın e-postası Analytics'te mülke Görüntüleyici olarak eklenmeli; Cloud projesinde Google Analytics Data API açık olmalı." },
    ],
  },
  {
    tur: "revenuecat", ad: "RevenueCat", ne: "Abone, deneme, MRR, 28 günlük gelir",
    alanlar: [
      { ad: "projectId", etiket: "Project ID", ornek: "proj1ab2c3d4" },
      { ad: "apiKey", etiket: "Gizli API anahtarı (v2)", gizli: true, ipucu: "RevenueCat > Project settings > API keys > + New secret key (v2, Charts metrics: read)" },
    ],
  },
  {
    tur: "appstore", ad: "App Store Connect", ne: "iOS yorumları ve günlük indirme",
    alanlar: [
      { ad: "appId", etiket: "Apple ID (uygulamanın sayısal kimliği)", ornek: "6712345678" },
      { ad: "issuerId", etiket: "Issuer ID", ornek: "57246542-96fe-1a63-…" },
      { ad: "keyId", etiket: "Key ID", ornek: "2X9R4HXF34" },
      { ad: "p8", etiket: ".p8 anahtarının içeriği", gizli: true, cokSatir: true, ipucu: "App Store Connect > Users and Access > Integrations > App Store Connect API" },
      { ad: "vendorNumber", etiket: "Vendor Number (indirme sayısı için, isteğe bağlı)", ornek: "85912345", ipucu: "Payments and Financial Reports sayfasının sol üstünde yazar. Anahtarın Sales yetkisi olmalı." },
    ],
  },
  {
    tur: "googleplay", ad: "Google Play", ne: "Android yorumları (son bir hafta)",
    alanlar: [
      { ad: "packageName", etiket: "Paket adı", ornek: "app.ucler" },
      { ad: "serviceAccount", etiket: "Servis hesabı JSON'u", gizli: true, cokSatir: true, ipucu: "Google Cloud > Service accounts > Keys > JSON. Hesabı Play Console'da kullanıcı olarak ekle." },
    ],
  },
];

// Hazır şablon: ucler. Buradaki kimlikler zaten sitenin açık kodunda yer alır; gizli hiçbir şey içermez.
const SABLONLAR = [
  {
    ad: "ucler.",
    renk: "#3987e5",
    kaynaklar: {
      supabase: {
        url: "https://ergxksjvcykgmckpsrlw.supabase.co",
        aktifTablo: "ilerleme",
        aktifSutun: "guncelleme",
        huni: "Hesabı eşitlenen | ilerleme |\nPuan kazanan | ilerleme | puan=gt.0\nBir aşama bitiren | ilerleme | veri->asama=neq.%7B%7D\nPlus abonesi | abonelik | ortam=eq.PRODUCTION&or=(bitis.is.null,bitis.gt.{simdi})",
        sayaclar: "Plus abonesi | abonelik | ortam=eq.PRODUCTION&or=(bitis.is.null,bitis.gt.{simdi})\nGünün sorusunu çözen (bugün) | gunun_sorusu | gun=eq.{bugun}\nLigde olan | ilerleme | ligde=is.true",
      },
      umami: { olayDokumleri: "En çok anlaşılmayan kartlar | anlamadim | kart" },
      searchconsole: { siteUrl: "ucler.app" },
      ganalytics: {},
      revenuecat: {},
      appstore: {},
      googleplay: { packageName: "app.ucler" },
    },
  },
];

const gizliAlanlar = (tur) => KAYNAKLAR.find((k) => k.tur === tur).alanlar.filter((a) => a.gizli).map((a) => a.ad);

module.exports = { KAYNAKLAR, SABLONLAR, gizliAlanlar };
