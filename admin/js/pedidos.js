const ordersAlert = document.getElementById("ordersAlert");
const ordersTableBody = document.querySelector("#ordersTable tbody");

function showOrdersAlert(message, type = "error") {
  ordersAlert.innerHTML = message ? `<div class="admin-alert admin-alert-${type}">${escapeHtml(message)}</div>` : "";
}

function renderOrderRow(o) {
  const itemsSummary = (o.items || []).map((i) => `${i.name} x${i.qty}`).join(", ");
  const customer = [o.customer_name, o.customer_phone].filter(Boolean).join(" · ");
  return `
    <tr data-id="${o.id}">
      <td>${formatDate(o.created_at)}</td>
      <td class="wrap">
        ${escapeHtml(itemsSummary)}
        ${customer ? `<br><span style="color:var(--text-muted);font-size:11.5px;">${escapeHtml(customer)}</span>` : ""}
      </td>
      <td>${money(o.total)}</td>
      <td>
        <select class="status-select" data-status="${o.id}">
          ${Object.entries(STATUS_LABELS).map(([val, label]) => `<option value="${val}" ${o.status === val ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </td>
      <td>
        <button class="btn-icon danger" data-delete-order="${o.id}" aria-label="Remover pedido">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>
        </button>
      </td>
    </tr>`;
}

async function loadOrders() {
  const { data, error } = await supabaseClient.from("orders").select("*").order("created_at", { ascending: false });
  if (error) {
    showOrdersAlert("Não foi possível carregar os pedidos. Confirme se a migração do banco de dados foi executada.");
    ordersTableBody.innerHTML = `<tr><td colspan="5" class="admin-empty">Erro ao carregar.</td></tr>`;
    return;
  }
  ordersTableBody.innerHTML = data.length
    ? data.map(renderOrderRow).join("")
    : `<tr><td colspan="5" class="admin-empty">Nenhum pedido ainda.</td></tr>`;
}

ordersTableBody.addEventListener("change", async (e) => {
  const select = e.target.closest("[data-status]");
  if (!select) return;
  const { error } = await supabaseClient.from("orders").update({ status: select.value }).eq("id", Number(select.dataset.status));
  if (error) showOrdersAlert("Não foi possível atualizar o status.");
  else showOrdersAlert("Status atualizado.", "success");
});

ordersTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-delete-order]");
  if (!btn) return;
  if (!confirm("Remover este pedido do histórico?")) return;
  const { error } = await supabaseClient.from("orders").delete().eq("id", Number(btn.dataset.deleteOrder));
  if (error) {
    showOrdersAlert("Não foi possível remover o pedido.");
    return;
  }
  loadOrders();
});

document.addEventListener("admin:ready", loadOrders);
