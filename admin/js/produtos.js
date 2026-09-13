let productsCache = [];

const productsAlert = document.getElementById("productsAlert");
const productsTableBody = document.querySelector("#productsTable tbody");
const modalOverlay = document.getElementById("productModalOverlay");
const modalTitle = document.getElementById("productModalTitle");
const productForm = document.getElementById("productForm");
const productFormAlert = document.getElementById("productFormAlert");

const textFields = [
  "name", "brand", "sku", "short_description", "description",
  "category", "fragrance_family", "concentration",
  // The top/heart/base pyramid fields were removed from the form: the single
  // "notes" summary is what the storefront card actually falls back to.
  "notes", "image",
];
// stock is deliberately absent: it is the sum of the product's sizes, kept by
// a database trigger. Writing it here would be overwritten on the next stock
// change, and would disagree with the sizes in the meantime.
const numberFields = ["price", "discount_percent", "volume_ml", "low_stock_threshold"];
// 1-5 scales that may legitimately be unset. Blank saves as NULL rather than 0,
// which the database would reject and which would also mean "level zero".
const nullableScaleFields = ["fixacao", "projecao"];
const checkboxFields = ["active", "featured", "bestseller", "new_arrival"];

function resolveAdminImageSrc(path) {
  if (!path) return "";
  return /^https?:\/\//i.test(path) ? path : `../${path}`;
}

function showAlert(el, message, type = "error") {
  el.innerHTML = message ? `<div class="admin-alert admin-alert-${type === "error" ? "error" : "success"}">${escapeHtml(message)}</div>` : "";
}

const NUMBER_DEFAULTS = { discount_percent: 0, stock: 0, low_stock_threshold: 5 };

// ---------------------------------------------------- sizes and prices ---
// Every product carries one row per size. The price column is an override:
// empty means "follow the percentage", which is what lets a change to the base
// price reprice the whole product at once.

let SIZES = [];
const variantTableBody = document.querySelector("#variantTable tbody");

const derivedPrice = (base, pct) => Math.round(Number(base || 0) * (Number(pct || 100) / 100));

async function loadSizes() {
  const { data, error } = await supabaseClient
    .from("product_sizes")
    .select("id, label, volume_ml, price_pct, sort_order")
    .eq("active", true)
    .order("sort_order");
  if (error) {
    showAlert(productsAlert, "Não foi possível carregar os tamanhos.");
    return;
  }
  SIZES = data || [];
}

// `variants` is keyed by size id. A product being created has none yet, so
// every row starts empty and is inserted on save.
function renderVariantRows(variants) {
  if (!variantTableBody) return;
  if (!SIZES.length) {
    variantTableBody.innerHTML =
      `<tr><td colspan="4" class="admin-empty">Nenhum tamanho definido. Crie-os em Definições &rarr; Tamanhos.</td></tr>`;
    return;
  }
  const base = Number(document.getElementById("price").value) || 0;
  variantTableBody.innerHTML = SIZES.map((s) => {
    const v = variants[s.id] || {};
    const derived = derivedPrice(base, s.price_pct);
    return `<tr data-size-id="${s.id}">
      <td class="wrap"><strong>${escapeHtml(s.label)}</strong>
        <span class="variant-pct">${Number(s.price_pct)}% do base</span></td>
      <td class="variant-derived" data-pct="${s.price_pct}">${money(derived)}</td>
      <td><input type="number" class="variant-price" min="0" step="1"
        value="${v.price ?? ""}" placeholder="${derived}"></td>
      <td><input type="number" class="variant-stock" min="0" step="1"
        value="${Number(v.stock || 0)}"></td>
    </tr>`;
  }).join("");
  syncVariantTotals();
}

// The calculated column and the placeholders follow the base price as it is
// typed, so the effect of a change is visible before saving.
function syncVariantTotals() {
  const base = Number(document.getElementById("price").value) || 0;
  variantTableBody?.querySelectorAll("tr[data-size-id]").forEach((row) => {
    const cell = row.querySelector(".variant-derived");
    if (!cell) return;
    const derived = derivedPrice(base, cell.dataset.pct);
    cell.textContent = money(derived);
    const priceInput = row.querySelector(".variant-price");
    if (priceInput) priceInput.placeholder = String(derived);
  });
  const totalStock = Array.from(variantTableBody?.querySelectorAll(".variant-stock") || [])
    .reduce((sum, el) => sum + (Number(el.value) || 0), 0);
  const stockEl = document.getElementById("stock");
  if (stockEl) stockEl.value = String(totalStock);
}

document.getElementById("price")?.addEventListener("input", syncVariantTotals);
variantTableBody?.addEventListener("input", (e) => {
  if (e.target.classList.contains("variant-stock")) syncVariantTotals();
});

// Reads the table back. A blank price is null, meaning "follow the percentage";
// zero is a real price and is kept as zero.
function collectVariants() {
  return Array.from(variantTableBody?.querySelectorAll("tr[data-size-id]") || []).map((row) => {
    const raw = row.querySelector(".variant-price")?.value.trim() ?? "";
    return {
      size_id: Number(row.dataset.sizeId),
      price: raw === "" ? null : Number(raw),
      stock: Number(row.querySelector(".variant-stock")?.value) || 0,
    };
  });
}

async function saveVariants(productId) {
  const rows = collectVariants().map((v) => ({ ...v, product_id: productId, active: true }));
  if (!rows.length) return null;
  // onConflict on the pair, so editing a product updates its rows rather than
  // failing on the unique constraint.
  const { error } = await supabaseClient
    .from("product_variants")
    .upsert(rows, { onConflict: "product_id,size_id" });
  return error;
}

function openModal(product, variants = []) {
  productForm.reset();
  showAlert(productFormAlert, "");
  document.getElementById("productId").value = product?.id || "";
  document.getElementById("sale_price").value = "";
  modalTitle.textContent = product ? "Editar produto" : "Novo produto";

  textFields.forEach((f) => {
    const el = document.getElementById(f);
    if (el) el.value = product?.[f] ?? "";
  });
  numberFields.forEach((f) => {
    const el = document.getElementById(f);
    if (el) el.value = product?.[f] ?? NUMBER_DEFAULTS[f] ?? "";
  });
  nullableScaleFields.forEach((f) => {
    const el = document.getElementById(f);
    if (el) el.value = product?.[f] ?? "";
  });
  checkboxFields.forEach((f) => {
    const el = document.getElementById(f);
    if (el) el.checked = product ? Boolean(product[f]) : f === "active";
  });
  // Keyed by size so a row can find its own values without scanning the list.
  renderVariantRows(Object.fromEntries((variants || []).map((v) => [v.size_id, v])));

  document.getElementById("images").value = (product?.images || []).join("\n");

  document.getElementById("imageFile").value = "";
  document.getElementById("imageUploadStatus").textContent = "";
  const previewWrap = document.getElementById("imagePreviewWrap");
  if (product?.image) {
    document.getElementById("imagePreview").src = resolveAdminImageSrc(product.image);
    previewWrap.style.display = "block";
  } else {
    previewWrap.style.display = "none";
  }

  modalOverlay.classList.add("open");
}

function closeModal() {
  modalOverlay.classList.remove("open");
}

// Live preview: typing a promotional price fills in the equivalent discount %.
document.getElementById("sale_price").addEventListener("input", (e) => {
  const price = Number(document.getElementById("price").value) || 0;
  const sale = Number(e.target.value) || 0;
  if (price > 0 && sale > 0 && sale < price) {
    document.getElementById("discount_percent").value = Math.round((1 - sale / price) * 100);
  }
});

document.getElementById("imageFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const statusEl = document.getElementById("imageUploadStatus");
  const previewWrap = document.getElementById("imagePreviewWrap");
  const previewImg = document.getElementById("imagePreview");

  statusEl.textContent = "A enviar imagem…";
  const ext = file.name.split(".").pop().toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("product-images")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    statusEl.textContent = "Não foi possível enviar a imagem. Tente novamente.";
    return;
  }

  const { data } = supabaseClient.storage.from("product-images").getPublicUrl(path);
  document.getElementById("image").value = data.publicUrl;
  previewImg.src = data.publicUrl;
  previewWrap.style.display = "block";
  statusEl.textContent = "Imagem enviada.";
});

function productStatus(p) {
  if (p.active === false) return { label: "Oculto", cls: "pill-inactive" };
  if ((p.stock ?? 0) <= 0) return { label: "Esgotado", cls: "pill-inactive" };
  if ((p.stock ?? 0) <= (p.low_stock_threshold ?? 5)) return { label: "Stock baixo", cls: "pill-low" };
  return { label: "Activo", cls: "pill-active" };
}

function renderRow(p) {
  const status = productStatus(p);
  const priceCell = p.discount_percent
    ? `<span style="text-decoration:line-through;color:var(--text-muted);font-size:11px;">${money(p.price)}</span><br>${money(p.price * (1 - p.discount_percent / 100))}`
    : money(p.price);
  return `
    <tr data-id="${p.id}">
      <td>${p.image ? `<img class="admin-table-thumb" src="${escapeHtml(resolveAdminImageSrc(p.image))}" alt="" loading="lazy" decoding="async" width="44" height="54">` : ""}</td>
      <td class="wrap">${escapeHtml(p.name)}${p.brand ? `<br><span style="color:var(--text-muted);font-size:11.5px;">${escapeHtml(p.brand)}</span>` : ""}</td>
      <td>${escapeHtml(p.category)}</td>
      <td>${priceCell}</td>
      <td>${p.discount_percent ? `${p.discount_percent}%` : "—"}</td>
      <td><span class="pill ${(p.stock ?? 0) <= (p.low_stock_threshold ?? 5) ? "pill-low" : ""}">${p.stock ?? 0}</span></td>
      <td><span class="pill ${status.cls}">${status.label}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn-icon" data-edit="${p.id}" aria-label="Editar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          </button>
          <button class="btn-icon danger" data-delete="${p.id}" aria-label="Remover">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

async function loadProducts() {
  productsTableBody.innerHTML = skeletonRows(8);
  const { data, error } = await supabaseClient
    .from("products")
    // The list renders a thumbnail, name, category, price, discount and stock.
    // Everything else (descriptions, notes, images array) is fetched only when
    // a product is actually opened for editing.
    .select("id, name, brand, category, price, discount_percent, stock, low_stock_threshold, image, active, archived, featured, bestseller, new_arrival, fixacao, projecao")
    .order("id");
  if (error) {
    showAlert(productsAlert, "Não foi possível carregar os produtos. Confirme se as migrações do banco de dados foram executadas.");
    productsTableBody.innerHTML = `<tr><td colspan="8" class="admin-empty">Erro ao carregar.</td></tr>`;
    return;
  }
  productsCache = data || [];
  productsTableBody.innerHTML = productsCache.length
    ? productsCache.map(renderRow).join("")
    : `<tr><td colspan="8" class="admin-empty">Nenhum produto registado.</td></tr>`;
}

document.getElementById("newProductBtn").addEventListener("click", () => openModal(null));
document.getElementById("cancelProductBtn").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });

productsTableBody.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit]");
  if (editBtn) {
    // The list query no longer carries descriptions, notes or the images
    // array, so the full row is fetched here — one small request when a
    // product is actually opened, instead of all of it on every page load.
    editBtn.disabled = true;
    const { data: product, error } = await supabaseClient
      .from("products")
      .select("*")
      .eq("id", Number(editBtn.dataset.edit))
      .single();
    // Fetched alongside the product rather than after it, so opening the form
    // stays one round trip's worth of waiting.
    const { data: variants } = await supabaseClient
      .from("product_variants")
      .select("size_id, price, stock")
      .eq("product_id", Number(editBtn.dataset.edit));
    editBtn.disabled = false;
    if (error || !product) {
      showAlert(productsAlert, "Não foi possível abrir este produto.");
      return;
    }
    openModal(product, variants || []);
    return;
  }

  const deleteBtn = e.target.closest("[data-delete]");
  if (deleteBtn) {
    const id = Number(deleteBtn.dataset.delete);
    const product = productsCache.find((p) => p.id === id);
    if (!confirm(`Remover "${product?.name}" do catálogo? Essa acção não pode ser desfeita.`)) return;
    const { error } = await supabaseClient.from("products").delete().eq("id", id);
    if (error) {
      showAlert(productsAlert, "Não foi possível remover o produto.");
      return;
    }
    showAlert(productsAlert, "Produto removido.", "success");
    loadProducts();
  }
});

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById("saveProductBtn");
  saveBtn.disabled = true;
  showAlert(productFormAlert, "");

  const id = document.getElementById("productId").value;
  const payload = {};
  textFields.forEach((f) => { payload[f] = document.getElementById(f).value.trim(); });
  numberFields.forEach((f) => { payload[f] = Number(document.getElementById(f).value) || 0; });
  checkboxFields.forEach((f) => { payload[f] = document.getElementById(f).checked; });
  nullableScaleFields.forEach((f) => {
    const raw = document.getElementById(f)?.value;
    payload[f] = raw ? Number(raw) : null;
  });
  payload.images = document.getElementById("images").value.split("\n").map((s) => s.trim()).filter(Boolean);

  // A promotional price entered directly always wins over a manually typed discount %.
  const price = Number(document.getElementById("price").value) || 0;
  const salePrice = Number(document.getElementById("sale_price").value) || 0;
  if (price > 0 && salePrice > 0 && salePrice < price) {
    payload.discount_percent = Math.round((1 - salePrice / price) * 100);
  }

  const previousStock = id ? productsCache.find((p) => p.id === Number(id))?.stock ?? 0 : 0;

  const query = id
    ? supabaseClient.from("products").update(payload).eq("id", id)
    : supabaseClient.from("products").insert(payload).select().single();

  const { data: savedProduct, error } = await query;
  saveBtn.disabled = false;

  if (error) {
    showAlert(productFormAlert, "Não foi possível guardar. Verifique os campos e tente novamente.");
    return;
  }

  const productId = id ? Number(id) : savedProduct?.id;

  // Saved after the product, since a new product has no id until it exists.
  // A failure here is reported rather than swallowed: the product would
  // otherwise be saved with prices and stock that were silently discarded.
  if (productId) {
    const variantError = await saveVariants(productId);
    if (variantError) {
      showAlert(productFormAlert, "O produto foi guardado, mas os tamanhos não. Tente guardar de novo.");
      return;
    }
  }

  // products.stock is maintained by a trigger from the sizes, so the movement
  // is measured against what the rows now add up to.
  const newStock = collectVariants().reduce((sum, v) => sum + v.stock, 0);
  const stockDelta = newStock - previousStock;
  if (productId && stockDelta !== 0) {
    await supabaseClient.from("stock_history").insert({
      product_id: productId,
      change: stockDelta,
      reason: id ? "Ajuste manual (edição de produto)" : "Stock inicial",
    });
  }

  closeModal();
  showAlert(productsAlert, id ? "Produto actualizado." : "Produto adicionado.", "success");
  loadProducts();
});

document.addEventListener("admin:ready", () => {
}
 .qq{  // In parallel: the sizes are only needed once a product form is opened.
}
 .qq{  loadSizes();
  loadProducts();
});
