let productsCache = [];

const productsAlert = document.getElementById("productsAlert");
const productsTableBody = document.querySelector("#productsTable tbody");
const modalOverlay = document.getElementById("productModalOverlay");
const modalTitle = document.getElementById("productModalTitle");
const productForm = document.getElementById("productForm");
const productFormAlert = document.getElementById("productFormAlert");

const fields = ["name", "category", "tone", "notes", "image", "price", "discount_percent", "stock", "description"];
const checkboxFields = ["active", "featured", "bestseller"];

function showAlert(el, message, type = "error") {
  el.innerHTML = message ? `<div class="admin-alert admin-alert-${type === "error" ? "error" : "success"}">${escapeHtml(message)}</div>` : "";
}

function openModal(product) {
  productForm.reset();
  showAlert(productFormAlert, "");
  document.getElementById("productId").value = product?.id || "";
  modalTitle.textContent = product ? "Editar produto" : "Novo produto";

  fields.forEach((f) => {
    const el = document.getElementById(f);
    if (el) el.value = product?.[f] ?? (f === "discount_percent" || f === "stock" ? 0 : "");
  });
  checkboxFields.forEach((f) => {
    const el = document.getElementById(f);
    if (el) el.checked = product ? Boolean(product[f]) : f === "active";
  });

  modalOverlay.classList.add("open");
}

function closeModal() {
  modalOverlay.classList.remove("open");
}

function renderRow(p) {
  const stockLow = (p.stock ?? 0) <= 5;
  const priceCell = p.discount_percent
    ? `<span style="text-decoration:line-through;color:var(--text-muted);font-size:11px;">${money(p.price)}</span><br>${money(p.price * (1 - p.discount_percent / 100))}`
    : money(p.price);
  return `
    <tr data-id="${p.id}">
      <td>${p.image ? `<img class="admin-table-thumb" src="../${escapeHtml(p.image)}" alt="">` : ""}</td>
      <td class="wrap">${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category)}</td>
      <td>${priceCell}</td>
      <td>${p.discount_percent ? `${p.discount_percent}%` : "—"}</td>
      <td><span class="pill ${stockLow ? "pill-low" : ""}">${p.stock ?? 0}</span></td>
      <td><span class="pill ${p.active === false ? "pill-inactive" : "pill-active"}">${p.active === false ? "Oculto" : "Ativo"}</span></td>
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
    showAlert(productsAlert, "Não foi possível carregar os produtos. Confirme se a migração do banco de dados foi executada.");
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
  fields.forEach((f) => {
    const el = document.getElementById(f);
    if (!el) return;
    if (f === "price" || f === "discount_percent" || f === "stock") {
      payload[f] = Number(el.value) || 0;
    } else {
      payload[f] = el.value.trim();
    }
  });
  checkboxFields.forEach((f) => {
    payload[f] = document.getElementById(f).checked;
  });

  const query = id
    ? supabaseClient.from("products").update(payload).eq("id", id)
    : supabaseClient.from("products").insert(payload);

  const { error } = await query;
  saveBtn.disabled = false;

  if (error) {
    showAlert(productFormAlert, "Não foi possível salvar. Verifique os campos e tente novamente.");
    return;
  }

  closeModal();
  showAlert(productsAlert, id ? "Produto atualizado." : "Produto adicionado.", "success");
  loadProducts();
});

document.addEventListener("admin:ready", loadProducts);
