let PRODUCTS = [];
// Sizes are global (35/50/100 ml); each product carries its own row per size,
// holding the stock and an optional price override. Both are needed before the
// first card renders, so they load alongside the products rather than after.
let SIZES = [];

async function loadProducts() {
  try {
    const [productsRes, sizesRes, variantsRes] = await Promise.all([
      supabaseClient.from("products").select("*").order("id"),
      supabaseClient
        .from("product_sizes")
        .select("id, label, volume_ml, price_pct, sort_order")
        .eq("active", true)
        .order("sort_order"),
      supabaseClient
        .from("product_variants")
        .select("product_id, size_id, price, stock")
        .eq("active", true),
    ]);
    if (productsRes.error) throw productsRes.error;

    PRODUCTS = productsRes.data || [];
    SIZES = sizesRes.data || [];

    // Indexed by product so a card doesn't scan the whole variant list.
    const bySize = new Map(SIZES.map((s) => [s.id, s]));
    const byProduct = new Map();
    (variantsRes.data || []).forEach((v) => {
      const size = bySize.get(v.size_id);
      if (!size) return;
      if (!byProduct.has(v.product_id)) byProduct.set(v.product_id, []);
      byProduct.get(v.product_id).push({ ...v, size });
    });

    PRODUCTS.forEach((p) => {
      p.variants = (byProduct.get(p.id) || []).sort(
        (a, b) => (a.size.sort_order || 0) - (b.size.sort_order || 0)
      );
    });
  } catch (err) {
    console.error("Falha ao carregar produtos do Supabase:", err);
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
