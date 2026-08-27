let PRODUCTS = [];

async function loadProducts() {
  try {
    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .order("id");
    if (error) throw error;
    PRODUCTS = data || [];
  } catch (err) {
    console.error("Falha ao carregar produtos do Supabase:", err);
  }
  document.dispatchEvent(new CustomEvent("products:ready"));
}

loadProducts();
