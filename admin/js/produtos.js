let productsCache = [];

const productsAlert = document.getElementById("productsAlert");
const productsTableBody = document.querySelector("#productsTable tbody");
const modalOverlay = document.getElementById("productModalOverlay");
const modalTitle = document.getElementById("productModalTitle");
const productForm = document.getElementById("productForm");
const productFormAlert = document.getElementById("productFormAlert");

const textFields = [
  "name", "brand", "sku", "short_description", "description",
  "category", "fragrance_family", "concentration", "tone",
  "notes", "notes_top", "notes_heart", "notes_base", "image",
];
const numberFields = ["price", "discount_percent", "volume_ml", "stock", "low_stock_threshold"];
const checkboxFields = ["active", "featured", "bestseller", "new_arrival"];

function showAlert(el, message, type = "error") {
  el.innerHTML = message ? `<div class="admin-alert admin-alert-${type === "error" ? "error" : "success"}">${escapeHtml(message)}</div>` : "";
}

const NUMBER_DEFAULTS = { discount_percent: 0, stock: 0, low_stock_threshold: 5 };

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
  document.getElementById("images").value = (product?.images || []).join("\n");

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

function productStatus(p) {
  if (p.active === false) return { label: "Oculto", cls: "pill-inactive" };
  if ((p.stock ?? 0) <= 0) return { label: "Esgotado", cls: "pill-inactive" };
  if ((p.stock ?? 0) <= (p.low_stock_threshold ?? 5)) return { label: "Stock baixo", cls: "pill-low" };
  return { label: "Ativo", cls: "pill-active" };
}

function renderRow(p) {
  const status = productStatus(p);
  const priceCell = p.discount_percent
    ? `<span style="text-decoration:line-through;color:var(--text-muted);font-size:11px;">${money(p.price)}</span><br>${money(p.price * (1 - p.discount_percent / 100))}`
    : money(p.price);
  return `
    <tr data-id="${p.id}">
      <td>${p.image ? `<img class="admin-table-thumb" src="../${escapeHtml(p.image)}" alt="">` : ""}</td>
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
  const { data, error } = await supabaseClient.from("products").select("*").order("id");
  if (error) {
    showAlert(productsAlert, "Não foi possível carregar os produtos. Confirme se as migrações do banco de dados foram executadas.");
    productsTableBody.innerHTML = `<tr><td colspan="8" class="admin-empty">Erro ao carregar.</td></tr>`;
    return;
  }
  productsCache = data || [];
  productsTableBody.innerHTML = productsCache.length
    ? productsCache.map(renderRow).join("")
    : `<tr><td colspan="8" class="admin-empty">Nenhum produto cadastrado.</td></tr>`;
}

document.getElementById("newProductBtn").addEventListener("click", () => openModal(null));
document.getElementById("cancelProductBtn").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });

productsTableBody.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit]");
  if (editBtn) {
    const product = productsCache.find((p) => p.id === Number(editBtn.dataset.edit));
    openModal(product);
    return;
  }

  const deleteBtn = e.target.closest("[data-delete]");
  if (deleteBtn) {
    const id = Number(deleteBtn.dataset.delete);
    const product = productsCache.find((p) => p.id === id);
    if (!confirm(`Remover "${product?.name}" do catálogo? Essa ação não pode ser desfeita.`)) return;
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
    showAlert(productFormAlert, "Não foi possível salvar. Verifique os campos e tente novamente.");
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
  showAlert(productsAlert, id ? "Produto atualizado." : "Produto adicionado.", "success");
  loadProducts();
});

document.addEventListener("admin:ready", loadProducts);
