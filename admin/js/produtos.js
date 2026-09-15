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
const numberFields = ["price", "discount_percent", "volume_ml", "stock", "low_stock_threshold"];
// The amostra price may legitimately be unset. Blank saves as NULL rather than
// 0, which would mean "free" rather than "not priced yet".
const nullableNumberFields = ["amostra_price"];
const checkboxFields = ["active", "featured", "bestseller", "new_arrival", "amostra_enabled"];

function resolveAdminImageSrc(path) {
  if (!path) return "";
  return /^https?:\/\//i.test(path) ? path : `../${path}`;
}

function showAlert(el, message, type = "error") {
  el.innerHTML = message ? `<div class="admin-alert admin-alert-${type === "error" ? "error" : "success"}">${escapeHtml(message)}</div>` : "";
}

const NUMBER_DEFAULTS = { discount_percent: 0, stock: 0, low_stock_threshold: 5 };

// ------------------------------------------------------------- amostra ---
// The amostra price and stock are plain columns on the product now, so the only
// thing worth scripting is keeping the form honest: a disabled amostra has no
// price or stock to set.

function syncAmostraFields() {
  const on = document.getElementById("amostra_enabled")?.checked;
  ["amostra_price", "amostra_stock"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = !on;
    if (!on) el.value = id === "amostra_stock" ? "0" : "";
  });
}
document.getElementById("amostra_enabled")?.addEventListener("change", syncAmostraFields);

// The volume shown in the form's explanation comes from settings, so the form
// never states a size the storefront does not sell.
async function loadAmostraVolume() {
  const { data } = await supabaseClient
    .from("payment_settings")
    .select("amostra_volume_ml")
    .eq("id", 1)
    .maybeSingle();
  const ml = data?.amostra_volume_ml;
  if (!ml) return;
  document.querySelectorAll("[data-amostra-ml]").forEach((el) => { el.textContent = ml; });
}

function openModal(product) {
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
  checkboxFields.forEach((f) => {
    const el = document.getElementById(f);
    if (el) el.checked = product ? Boolean(product[f]) : f === "active";
  });
  nullableNumberFields.forEach((f) => {
    const el = document.getElementById(f);
    if (el) el.value = product?.[f] ?? "";
  });
  syncAmostraFields();

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
    .select("id, name, brand, category, price, discount_percent, stock, low_stock_threshold, image, active, archived, featured, bestseller, new_arrival")
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
    editBtn.disabled = false;
    if (error || !product) {
      showAlert(productsAlert, "Não foi possível abrir este produto.");
      return;
    }
    openModal(product);
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
  nullableNumberFields.forEach((f) => {
    const raw = document.getElementById(f)?.value.trim();
    payload[f] = raw === "" || raw === undefined ? null : Number(raw);
  });
  payload.amostra_stock = Number(document.getElementById("amostra_stock")?.value) || 0;
  payload.images = document.getElementById("images").value.split("\n").map((s) => s.trim()).filter(Boolean);

  // The database refuses an enabled amostra with no price; catching it here
  // turns a raw constraint error into something the form can explain.
  if (payload.amostra_enabled && payload.amostra_price === null) {
    showAlert(productFormAlert, "Indique o preço da amostra, ou desactive a amostra deste perfume.");
    saveBtn.disabled = false;
    return;
  }

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
  const stockDelta = payload.stock - previousStock;
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
  loadAmostraVolume();
  loadProducts();
});
