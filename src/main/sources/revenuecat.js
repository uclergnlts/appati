// RevenueCat: aktif abone, deneme, MRR ve son 28 günün geliri (API v2, "overview metrics").
// Gizli v2 anahtarı gerekir (Project settings > API keys > Secret API key, charts_metrics okuma izni).
module.exports = async function revenuecat(ayar, gizli, { istek }) {
  if (!ayar.projectId) throw new Error("Project ID eksik");
  if (!gizli.apiKey) throw new Error("Gizli API anahtarı eksik");
  const r = await istek(`https://api.revenuecat.com/v2/projects/${encodeURIComponent(ayar.projectId)}/metrics/overview`,
    { headers: { Authorization: `Bearer ${gizli.apiKey}`, Accept: "application/json" } });
  const m = Object.fromEntries((r.metrics || []).map((x) => [x.id, x]));
  const deger = (id) => (m[id] ? Number(m[id].value) || 0 : undefined);
  return {
    kpi: {
      abone: deger("active_subscriptions"),
      deneme: deger("active_trials"),
      mrr: deger("mrr"),
      gelir28g: deger("revenue"),
      yeniMusteri28g: deger("new_customers"),
      aktifMusteri28g: deger("active_users"),
    },
    paraBirimi: (m.mrr && m.mrr.unit) || (m.revenue && m.revenue.unit) || "$",
  };
};
