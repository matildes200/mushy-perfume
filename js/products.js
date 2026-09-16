let PRODUCTS = [];

async function loadProducts() {
  try {
    // The campaign rows come from a view that already knows which campaigns are
    // running today, so the page never has to compare dates itself.
    const [productsRes, campaignsRes] = await Promise.all([
      supabaseClient.from("products").select("*").order("id"),
      supabaseClient.from("active_campaign_products").select("*"),
    ]);
    if (productsRes.error) throw productsRes.error;
    PRODUCTS = productsRes.data || [];

    const byProduct = new Map((campaignsRes.data || []).map((c) => [c.product_id, c]));
    PRODUCTS.forEach((p) => { p.campaign = byProduct.get(p.id) || null; });
  } catch (err) {
    console.error("Falha ao carregar produtos do Supabase:", err);
  }

  // The amostra volume is a setting rather than a constant in the page. A
  // failure here is not worth blocking the catalogue for: main.js already
  // defaults to 5 ml, which is what the shop sells.
  try {
    const { data } = await supabaseClient
      .from("site_delivery_settings")
      .select("amostra_volume_ml")
      .maybeSingle();
    if (data?.amostra_volume_ml) window.AMOSTRA_ML = Number(data.amostra_volume_ml);
  } catch (err) {
    console.warn("amostra volume:", err);
  }

  // Waits for the parser, for the same reason admin-auth.js does: this file is
  // loaded before js/main.js, and main.js is what listens for this event. If
  // the queries above ever resolve without a real network round trip, the
  // dispatch lands at the microtask checkpoint after this script — before
  // main.js has been parsed — and the grid stays empty with no error to show
  // for it. Today the network makes that impossible; this makes it impossible
  // on purpose.
  const announce = () => document.dispatchEvent(new CustomEvent("products:ready"));
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", announce, { once: true });
  } else {
    announce();
  }
}

loadProducts();
