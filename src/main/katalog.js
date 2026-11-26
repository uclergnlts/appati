// Kaynak türleri ve ayar alanları. Ayarlar ekranı bu listeden çizilir.
// gizli: true olan alanlar Anahtar Zinciri ile şifrelenir ve arayüze hiç geri gönderilmez.
const KAYNAKLAR = [
  {
    tur: "supabase", grup: "Kullanıcılar", ad: "Supabase", ne: "Kayıtlı kullanıcı, yeni kayıt, aktif kullanıcı, tablo sayaçları",
    alanlar: [
      { ad: "url", etiket: "Proje adresi", ornek: "https://xxxx.supabase.co" },
      { ad: "key", etiket: "Gizli anahtar (service_role ya da sb_secret_…)", gizli: true, ipucu: "Supabase > Project Settings > API keys" },
      { ad: "aktifTablo", etiket: "Aktiflik tablosu (isteğe bağlı)", ornek: "profiles", ipucu: "Uygulama her kullanıldığında güncellenen tablo. Boşsa son giriş zamanı kullanılır." },
      { ad: "aktifSutun", etiket: "Aktiflik zaman sütunu", ornek: "updated_at" },
      { ad: "huni", etiket: "Dönüşüm hunisi (isteğe bağlı, her satır bir adım: Etiket | tablo | filtre)", cokSatir: true, ornek: "Filled profile | profiles | name=not.is.null", ipucu: "İlk adım her zaman kayıtlı kullanıcı sayısıdır; adımları geniş olandan dar olana doğru sırala." },
      { ad: "sayaclar", etiket: "Sayaçlar (isteğe bağlı, her satır: Etiket | tablo | filtre)", cokSatir: true, ornek: "Pro users | profiles | plan=eq.pro", ipucu: "Filtre PostgREST biçimindedir. {simdi} ve {bugun} yer tutucuları kullanılabilir." },
    ],
  },
  {
    tur: "firebase", grup: "Kullanıcılar", ad: "Firebase", ne: "Authentication kullanıcıları: kayıtlı, yeni kayıt, aktif; Firestore sayaçları",
    alanlar: [
      { ad: "serviceAccount", etiket: "Servis hesabı JSON'u", gizli: true, cokSatir: true, ipucu: "Firebase konsolu > Project settings > Service accounts > Generate new private key. İnen dosyanın içeriğinin tamamını yapıştır." },
      { ad: "projectId", etiket: "Project ID (isteğe bağlı)", istege: true, ornek: "my-app-12345", ipucu: "Boş bırakırsan servis hesabındaki proje kullanılır." },
      { ad: "sayaclar", etiket: "Firestore sayaçları (isteğe bağlı, her satır: Etiket | koleksiyon)", cokSatir: true, istege: true, ornek: "Orders | orders", ipucu: "Koleksiyondaki belge sayısını gösterir." },
    ],
  },
  {
    tur: "ozel", grup: "Kullanıcılar", ad: "Özel uç nokta", ne: "Kendi sunucundan JSON: kullanıcı, abone, gelir ve istediğin sayaçlar",
    alanlar: [
      { ad: "url", etiket: "Adres", ornek: "https://example.com/api/appati", ipucu: "Bu adres bir JSON nesnesi döndürmeli. Tanınan alanlar: registeredUsers, activeToday, activeUsers7d, newSignupsToday, newSignups7d, newSignupsPrev7d, subscribers, trials, mrr, revenue28d, currency, counters [{label, value}], signups [{date, value}], funnel [{label, value}]. Hepsi isteğe bağlıdır." },
      { ad: "token", etiket: "Erişim anahtarı (isteğe bağlı)", gizli: true, istege: true, ipucu: "Girersen istekle birlikte Authorization: Bearer başlığında gönderilir." },
    ],
  },
  {
    tur: "umami", grup: "Site trafiği", ad: "Umami", ne: "Site ziyaretçisi, nereden geldikleri, sayfalar, ülkeler (ücretsiz paylaşım bağlantısıyla)",
    alanlar: [
      { ad: "paylasim", etiket: "Paylaşım bağlantısı (Share URL)", gizli: true, ornek: "https://cloud.umami.is/share/AbC123xyz/ucler.app", ipucu: "Umami > Websites > siten > Edit > Share URL'yi aç, çıkan bağlantıyı yapıştır. Ücretli API anahtarı gerekmez. Bağlantıyı bilen herkes istatistikleri görebilir; kimseyle paylaşma." },
      { ad: "huniAdimlari", etiket: "Site hunisi (isteğe bağlı, her satır bir adım: Etiket | olay)", cokSatir: true, istege: true, ornek: "Signed up | signup_completed", ipucu: "İlk adım her zaman son 30 günde siteye gelen ziyaretçidir; sonraki adımlar o olayın kaç kez gönderildiğini sayar." },
      { ad: "olayDokumleri", etiket: "Olay dökümleri (isteğe bağlı, her satır: Etiket | olay | özellik)", cokSatir: true, istege: true, ornek: "Most clicked buttons | button_click | name", ipucu: "Siteden Umami'ye gönderilen bir olayın bir özelliğine göre son 30 günün dökümünü gösterir." },
    ],
  },
  {
    tur: "plausible", grup: "Site trafiği", ad: "Plausible", ne: "Site ziyaretçisi, nereden geldikleri, sayfalar, ülkeler",
    alanlar: [
      { ad: "siteId", etiket: "Site alan adı", ornek: "example.com", ipucu: "Plausible'da göründüğü gibi." },
      { ad: "apiKey", etiket: "Stats API anahtarı", gizli: true, ipucu: "Plausible > Account settings > API keys > New API key (Stats API)." },
      { ad: "host", etiket: "Plausible adresi (isteğe bağlı)", istege: true, ornek: "https://plausible.io", ipucu: "Kendi sunucunda çalıştırıyorsan onun adresini yaz." },
    ],
  },
  {
    tur: "searchconsole", grup: "Arama ve video", ad: "Google Search Console", ne: "Google aramasında tıklama, gösterim, sorgular, sayfalar",
    alanlar: [
      { ad: "siteUrl", etiket: "Mülk (alan adı ya da tam adres)", ornek: "example.com", ipucu: "Search Console'da alan adı mülkün varsa yalnızca alan adını yaz (ucler.app). URL ön ekli mülk için tam adresi yaz (https://ucler.app/)." },
      { ad: "serviceAccount", etiket: "Servis hesabı JSON'u", gizli: true, cokSatir: true, yedek: "googleplay", ipucu: "Boş bırakırsan Google Play'e girdiğin servis hesabı kullanılır. Hesabın e-postası Search Console > Ayarlar > Kullanıcılar ve izinler'e eklenmeli; Cloud projesinde Google Search Console API açık olmalı." },
    ],
  },
  {
    tur: "youtube", grup: "Arama ve video", ad: "YouTube", ne: "Kanalların abone ve görüntüleme sayıları, son videoların izlenmesi",
    alanlar: [
      { ad: "kanallar", etiket: "Kanallar (her satıra bir tane: @ad, kanal adresi ya da UC… kimliği)", cokSatir: true, ornek: "@mychannel" },
      { ad: "apiKey", etiket: "YouTube Data API anahtarı", gizli: true, ipucu: "Google Cloud Console > APIs & Services > Credentials > Create credentials > API key. Projede YouTube Data API v3 açık olmalı. Anahtarı yalnızca bu API'yle sınırla." },
    ],
  },
  {
    tur: "ganalytics", grup: "Site trafiği", ad: "Google Analytics", ne: "Site ziyaretçisi, nereden geldikleri, sayfalar, ülkeler",
    alanlar: [
      { ad: "propertyId", etiket: "Property ID (sayısal mülk kimliği)", ornek: "412345678", ipucu: "Analytics > Yönetici > Mülk ayrıntıları. G- ile başlayan ölçüm kimliği değil." },
      { ad: "serviceAccount", etiket: "Servis hesabı JSON'u", gizli: true, cokSatir: true, yedek: "googleplay", ipucu: "Boş bırakırsan Google Play'e girdiğin servis hesabı kullanılır. Hesabın e-postası Analytics'te mülke Görüntüleyici olarak eklenmeli; Cloud projesinde Google Analytics Data API açık olmalı." },
    ],
  },
  {
    tur: "revenuecat", grup: "Gelir", ad: "RevenueCat", ne: "Abone, deneme, MRR, 28 günlük gelir",
    alanlar: [
      { ad: "projectId", etiket: "Project ID", ornek: "proj1ab2c3d4" },
      { ad: "apiKey", etiket: "Gizli API anahtarı (v2)", gizli: true, ipucu: "RevenueCat > Project settings > API keys > + New secret key (v2, Charts metrics: read)" },
    ],
  },
  {
    tur: "stripe", grup: "Gelir", ad: "Stripe", ne: "Abone, deneme, MRR, 28 günlük tahsilat, yeni müşteri",
    alanlar: [
      { ad: "apiKey", etiket: "Kısıtlı API anahtarı", gizli: true, ipucu: "Stripe > Developers > API keys > Create restricted key. Subscriptions, Balance transactions ve Customers için Read ver; başka izin gerekmez." },
    ],
  },
  {
    tur: "appstore", grup: "Mağazalar", ad: "App Store Connect", ne: "iOS yorumları ve günlük indirme",
    alanlar: [
      { ad: "appId", etiket: "Apple ID (uygulamanın sayısal kimliği)", ornek: "6712345678" },
      { ad: "issuerId", etiket: "Issuer ID", ornek: "57246542-96fe-1a63-…" },
      { ad: "keyId", etiket: "Key ID", ornek: "2X9R4HXF34" },
      { ad: "p8", etiket: ".p8 anahtarının içeriği", gizli: true, cokSatir: true, ipucu: "App Store Connect > Users and Access > Integrations > App Store Connect API" },
      { ad: "vendorNumber", etiket: "Vendor Number (indirme sayısı için, isteğe bağlı)", ornek: "85912345", ipucu: "Payments and Financial Reports sayfasının sol üstünde yazar. Anahtarın Sales yetkisi olmalı." },
    ],
  },
  {
    tur: "googleplay", grup: "Mağazalar", ad: "Google Play", ne: "Android yorumları (son bir hafta)",
    alanlar: [
      { ad: "packageName", etiket: "Paket adı", ornek: "com.example.app" },
      { ad: "serviceAccount", etiket: "Servis hesabı JSON'u", gizli: true, cokSatir: true, ipucu: "Google Cloud > Service accounts > Keys > JSON. Hesabı Play Console'da kullanıcı olarak ekle." },
    ],
  },
];

// Eski sürümlerde arayüzde sunulan hazır şablon. Artık gösterilmez; yalnızca o şablonla eklenmiş kayıtların
// eksik alanlarını açılışta bir kez tamamlamak için durur ve sonraki bir sürümde kaldırılacaktır.
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
      umami: {
        huniAdimlari: "Kayıt davetini gören | kayit_davet\nKayıt olan | kayit_tamam\nPlus sayfasını açan | plus_gor\nPlus alan | plus_al",
        olayDokumleri: "En çok anlaşılmayan kartlar | anlamadim | kart",
      },
      searchconsole: { siteUrl: "ucler.app" },
      ganalytics: {},
      revenuecat: {},
      appstore: {},
      googleplay: { packageName: "app.ucler" },
    },
  },
];

// Şablondan eklenmiş bir uygulamada (adı şablonla aynı) boş bırakılan açık alanlar şablondaki değeri alır.
// Böylece şablona sonradan eklenen huni, döküm gibi alanlar eski kayıtlarda da kendiliğinden çalışır.
function sablonlaTamamla(uyg) {
  const sablon = SABLONLAR.find((s) => s.ad === uyg.ad);
  if (!sablon) return uyg;
  const kaynaklar = { ...(uyg.kaynaklar || {}) };
  for (const [tur, alanlar] of Object.entries(sablon.kaynaklar)) {
    const eksik = Object.fromEntries(Object.entries(alanlar).filter(([a]) => !(kaynaklar[tur] || {})[a]));
    if (Object.keys(eksik).length) kaynaklar[tur] = { ...eksik, ...(kaynaklar[tur] || {}) };
  }
  return { ...uyg, kaynaklar };
}

const gizliAlanlar = (tur) => KAYNAKLAR.find((k) => k.tur === tur).alanlar.filter((a) => a.gizli).map((a) => a.ad);

module.exports = { KAYNAKLAR, SABLONLAR, gizliAlanlar, sablonlaTamamla };
