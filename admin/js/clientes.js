let customersCache = [];
let ordersByCustomer = {};
const customersAlert = document.getElementById("customersAlert");
const customersTableBody = document.querySelector("#customersTable tbody");
const customerModalOverlay = document.getElementById("customerModalOverlay");

function showCustomersAlert(message, type = "error") {
  customersAlert.innerHTML = message ? `<div class="admin-alert admin-alert-${type}">${escapeHtml(message)}</div>` : "";
}

function customerType(orders) {
  const count = orders.length;
  const spent = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  if (count >= 5 || spent >= 150000) return { label: "VIP", cls: "pill-active" };
  if (count >= 2) return { label: "Recorrente", cls: "pill-low" };
  return { label: "Novo", cls: "" };
}

function renderCustomerRow(c) {
  const orders = ordersByCustomer[c.id] || [];
  const spent = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const last = orders[0];
  const type = customerType(orders);
  return `
    <tr data-id="${c.id}">
      <td class="wrap">${escapeHtml(c.full_name)}</td>
      <td>${escapeHtml(c.email)}</td>
      <td>${escapeHtml(c.phone || "—")}</td>
      <td>${orders.length}</td>
      <td>${money(spent)}</td>
      <td>${last ? formatDate(last.created_at) : "—"}</td>
      <td><span class="pill ${type.cls}">${type.label}</span></td>
      <td><button class="btn-admin btn-admin-outline" data-open="${c.id}">Ver</button></td>
    </tr>`;
}

async function loadCustomers() {
  const [{ data: customers, error: cErr }, { data: orders, error: oErr }] = await Promise.all([
    supabaseClient.from("customers").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("orders").select("*").not("customer_id", "is", null).order("created_at", { ascending: false }),
  ]);

  if (cErr || oErr) {
    showCustomersAlert("Não foi possível carregar os clientes. Confirme se as migrações do banco de dados foram executadas.");
    customersTableBody.innerHTML = `<tr><td colspan="8" class="admin-empty">Erro ao carregar.</td></tr>`;
    return;
  }

  customersCache = customers || [];
  ordersByCustomer = {};
  (orders || []).forEach((o) => {
    if (!ordersByCustomer[o.customer_id]) ordersByCustomer[o.customer_id] = [];
    ordersByCustomer[o.customer_id].push(o);
  });

  customersTableBody.innerHTML = customersCache.length
    ? customersCache.map(renderCustomerRow).join("")
    : `<tr><td colspan="8" class="admin-empty">Nenhum cliente ainda.</td></tr>`;
}

function openCustomerModal(customer) {
  const orders = ordersByCustomer[customer.id] || [];
  const spent = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  document.getElementById("customerModalTitle").textContent = customer.full_name;
  document.getElementById("cdName").textContent = customer.full_name;
  document.getElementById("cdEmail").textContent = customer.email;
  document.getElementById("cdPhone").textContent = customer.phone || "—";
  document.getElementById("cdOrderCount").textContent = orders.length;
  document.getElementById("cdTotalSpent").textContent = money(spent);
  document.getElementById("cdAvgOrder").textContent = money(orders.length ? spent / orders.length : 0);

  const withAddress = orders.find((o) => o.shipping_address);
  document.getElementById("cdAddress").textContent = withAddress
    ? [withAddress.shipping_address, withAddress.shipping_city].filter(Boolean).join(", ")
    : "Nenhuma morada registrada ainda.";

  document.querySelector("#customerOrdersTable tbody").innerHTML = orders.length
    ? orders
        .map((o) => `<tr><td>${orderCode(o.id)}</td><td>${formatDate(o.created_at)}</td><td>${money(o.total)}</td><td><span class="status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span></td></tr>`)
        .join("")
    : `<tr><td colspan="4" class="admin-empty">Nenhum pedido ainda.</td></tr>`;

  customerModalOverlay.classList.add("open");
}

customersTableBody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-open]");
  if (!btn) return;
  const customer = customersCache.find((c) => c.id === btn.dataset.open);
  if (customer) openCustomerModal(customer);
});

document.getElementById("closeCustomerModalBtn").addEventListener("click", () => customerModalOverlay.classList.remove("open"));
customerModalOverlay.addEventListener("click", (e) => { if (e.target === customerModalOverlay) customerModalOverlay.classList.remove("open"); });

document.addEventListener("admin:ready", loadCustomers);
