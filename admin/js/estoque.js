let inventoryCache = [];
const inventoryAlert = document.getElementById("inventoryAlert");
const inventoryTableBody = document.querySelector("#inventoryTable tbody");
const historyTableBody = document.querySelector("#stockHistoryTable tbody");
const stockModalOverlay = document.getElementById("stockModalOverlay");

function showInventoryAlert(message, type = "error") {
  inventoryAlert.innerHTML = message ? `<div class="admin-alert admin-alert-${type}">${escapeHtml(message)}</div>` : "";
}

function inventoryStatus(p) {
  if ((p.stock ?? 0) <= 0) return { label: "Esgotado", cls: "pill-inactive" };
  if ((p.stock ?? 0) <= (p.low_stock_threshold ?? 5)) return { label: "Baixo", cls: "pill-low" };
  return { label: "Bom", cls: "pill-active" };
}

function renderInventoryRow(p) {
  const status = inventoryStatus(p);
  return `
    <tr data-id="${p.id}">
      <td class="wrap">${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.sku || "—")}</td>
      <td>${p.stock ?? 0}</td>
      <td>${p.low_stock_threshold ?? 5}</td>
      <td><span class="pill ${status.cls}">${status.label}</span></td>
      <td><button class="btn-admin btn-admin-outline" data-adjust="${p.id}">Ajustar</button></td>
    </tr>`;
}

async function loadInventory() {
  const { data, error } = await supabaseClient.from("products").select("id, name, sku, stock, low_stock_threshold").order("name");
  if (error) {
    showInventoryAlert("Não foi possível carregar o inventário. Confirme se as migrações do banco de dados foram executadas.");
    inventoryTableBody.innerHTML = `<tr><td colspan="6" class="admin-empty">Erro ao carregar.</td></tr>`;
    return;
  }
  inventoryCache = data || [];

  const total = inventoryCache.length;
  const outOfStock = inventoryCache.filter((p) => (p.stock ?? 0) <= 0).length;
  const lowStock = inventoryCache.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.low_stock_threshold ?? 5)).length;
  const inStock = total - outOfStock;

  document.getElementById("inventoryStats").innerHTML = `
    <div class="stat-card"><span>Produtos</span><strong>${total}</strong></div>
    <div class="stat-card"><span>Em stock</span><strong>${inStock}</strong></div>
    <div class="stat-card${lowStock ? " warn" : ""}"><span>Stock baixo</span><strong>${lowStock}</strong></div>
    <div class="stat-card${outOfStock ? " warn" : ""}"><span>Esgotados</span><strong>${outOfStock}</strong></div>
  `;

  inventoryTableBody.innerHTML = inventoryCache.length
    ? inventoryCache.map(renderInventoryRow).join("")
    : `<tr><td colspan="6" class="admin-empty">Nenhum produto registado.</td></tr>`;
}

async function loadHistory() {
  const { data, error } = await supabaseClient
    .from("stock_history")
    .select("*, products(name)")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    historyTableBody.innerHTML = `<tr><td colspan="4" class="admin-empty">Erro ao carregar.</td></tr>`;
    return;
  }
  historyTableBody.innerHTML = (data || []).length
    ? data
        .map(
          (h) => `
        <tr>
          <td>${formatDate(h.created_at)}</td>
          <td class="wrap">${escapeHtml(h.products?.name || "—")}</td>
          <td style="color:${h.change >= 0 ? "#3d6b4c" : "#8a3b2b"};">${h.change >= 0 ? "+" : ""}${h.change}</td>
          <td class="wrap">${escapeHtml(h.reason || "—")}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="admin-empty">Nenhuma movimentação ainda.</td></tr>`;
}

function openStockModal(product) {
  document.getElementById("stockModalTitle").textContent = `Ajustar stock — ${product.name}`;
  document.getElementById("stockProductId").value = product.id;
  document.getElementById("stockCurrentValue").textContent = product.stock ?? 0;
  document.getElementById("stockChange").value = "";
  document.getElementById("stockReason").value = "";
  document.getElementById("stockModalAlert").innerHTML = "";
  stockModalOverlay.classList.add("open");
}

inventoryTableBody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-adjust]");
  if (!btn) return;
  const product = inventoryCache.find((p) => p.id === Number(btn.dataset.adjust));
  if (product) openStockModal(product);
});

document.getElementById("cancelStockBtn").addEventListener("click", () => stockModalOverlay.classList.remove("open"));
stockModalOverlay.addEventListener("click", (e) => { if (e.target === stockModalOverlay) stockModalOverlay.classList.remove("open"); });

document.getElementById("stockForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const productId = Number(document.getElementById("stockProductId").value);
  const change = Number(document.getElementById("stockChange").value);
  const reason = document.getElementById("stockReason").value.trim();
  const alertEl = document.getElementById("stockModalAlert");

  if (!change) {
    alertEl.innerHTML = `<div class="admin-alert admin-alert-error">Informe uma quantidade diferente de zero.</div>`;
    return;
  }

  const product = inventoryCache.find((p) => p.id === productId);
  const newStock = Math.max(0, (product.stock ?? 0) + change);

  const { error: updateError } = await supabaseClient.from("products").update({ stock: newStock }).eq("id", productId);
  if (updateError) {
    alertEl.innerHTML = `<div class="admin-alert admin-alert-error">Não foi possível actualizar o stock.</div>`;
    return;
  }

  await supabaseClient.from("stock_history").insert({ product_id: productId, change, reason: reason || null });

  stockModalOverlay.classList.remove("open");
  loadInventory();
  loadHistory();
});

document.addEventListener("admin:ready", () => {
  loadInventory();
  loadHistory();
});
