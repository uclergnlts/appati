// Arayüz ile ana süreç arasındaki dar köprü. Gizli anahtarlar bu köprüden yalnızca içeri girer, geri çıkmaz.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appati", {
  baslangic: () => ipcRenderer.invoke("baslangic"),
  yenile: () => ipcRenderer.invoke("yenile"),
  uygulamaKaydet: (u) => ipcRenderer.invoke("uygulama:kaydet", u),
  uygulamaSil: (id) => ipcRenderer.invoke("uygulama:sil", id),
  genelKaydet: (g) => ipcRenderer.invoke("genel:kaydet", g),
  gizle: () => ipcRenderer.invoke("gizle"),
  cik: () => ipcRenderer.invoke("cik"),
  disari: (adres) => ipcRenderer.invoke("disari", adres),
  ayarDinle: (fn) => ipcRenderer.on("ayar", (_o, a) => fn(a)),
  durumDinle: (fn) => ipcRenderer.on("durum", (_o, d) => fn(d)),
  centikDinle: (fn) => ipcRenderer.on("centik", (_o, v) => fn(v)),
  paneliAc: () => ipcRenderer.invoke("panel:ac"),
  medyaKomut: (komut) => ipcRenderer.invoke("medya:komut", komut),
  medyaAc: (hangi) => ipcRenderer.invoke("medya:ac", hangi),
  guncellemeDinle: (fn) => ipcRenderer.on("guncelleme", (_o, d) => fn(d)),
  guncellemeDenetle: () => ipcRenderer.invoke("guncelle:denetle"),
  guncellemeKur: () => ipcRenderer.invoke("guncelle:kur"),
  gitDinle: (fn) => ipcRenderer.on("git", (_o, g) => fn(g)),
  vurguDinle: (fn) => ipcRenderer.on("vurgu", (_o, r) => fn(r)),
});
