let ordersCache = [];
let selectedOrderId = null;
const ordersAlert = document.getElementById("ordersAlert");
const ordersTableBody = document.querySelector("#ordersTable tbody");
const orderModalOverlay = document.getElementById("orderModalOverlay");
const orderModalAlert = document.getElementById("orderModalAlert");

const PIPELINE = ["pending", "confirmed", "processing", "shipped", "delivered"];

const PAYMENT_STATUS_LABELS = {
  pending: "Pendente de Verificação",
  paid: "Pagamento Confirmado",
  failed: "Pagamento Recusado",
  refunded: "Reembolsado",
};
const PAYMENT_STATUS_PILL = { pending: "pill-pending", paid: "pill-active", failed: "pill-inactive", refunded: "pill-inactive" };

function showOrdersAlert(message, type = "error") {
  ordersAlert.innerHTML = message ? `<div class="admin-alert admin-alert-${type}">${escapeHtml(message)}</div>` : "";
}

function renderOrderRow(o) {
  const paymentStatus = o.payment_status || "pending";
  return `
    <tr data-id="${o.id}">
      <td>${orderCode(o.id)}</td>
      <td class="wrap">${escapeHtml(o.customer_name || "—")}</td>
      <td>${formatDate(o.created_at)}</td>
      <td>${(o.items || []).length}</td>
      <td>${money(o.total)}</td>
      <td><span class="pill ${PAYMENT_STATUS_PILL[paymentStatus] || "pill-pending"}">${PAYMENT_STATUS_LABELS[paymentStatus] || paymentStatus}</span></td>
      <td>${o.delivery_status || "pending"}</td>
      <td><span class="status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span></td>
      <td><button class="btn-admin btn-admin-outline" data-open="${o.id}">Ver</button></td>
    </tr>`;
}

// The table used to fetch every order with select("*") in one go, which got
// slower with every order placed. Now it pulls a page at a time, and only the
// columns the table actually shows — the modal fetches the full row on demand.
const ORDERS_PAGE_SIZE = 25;
const ORDERS_LIST_COLUMNS = "id,created_at,customer_name,total,status,payment_status,delivery_status,items";

let ordersOffset = 0;
let ordersAllLoaded = false;
let ordersLoading = false;

const ordersMore = document.getElementById("ordersMore");
const ordersMoreStatus = document.getElementById("ordersMoreStatus");
const ordersMoreBtn = document.getElementById("ordersMoreBtn");

function setOrdersMoreState() {
  if (!ordersMore) return;
  ordersMore.hidden = ordersAllLoaded;
  if (ordersMoreStatus) ordersMoreStatus.hidden = !ordersLoading;
  if (ordersMoreBtn) ordersMoreBtn.hidden = ordersLoading;
}

async function loadOrders(append = false) {
  if (ordersLoading || (append && ordersAllLoaded)) return;
  ordersLoading = true;
  setOrdersMoreState();

  const from = append ? ordersOffset : 0;
  const { data, error } = await supabaseClient
    .from("orders")
    .select(ORDERS_LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .range(from, from + ORDERS_PAGE_SIZE - 1);

  ordersLoading = false;

  if (error) {
    showOrdersAlert("Não foi possível carregar os pedidos. Confirme se as migrações do banco de dados foram executadas.");
    if (!append) ordersTableBody.innerHTML = `<tr><td colspan="9" class="admin-empty">Erro ao carregar.</td></tr>`;
    setOrdersMoreState();
    return;
  }

  const page = data || [];
  ordersCache = append ? ordersCache.concat(page) : page;
  ordersOffset = ordersCache.length;
  // A short page means there is nothing left behind it.
  ordersAllLoaded = page.length < ORDERS_PAGE_SIZE;

  ordersTableBody.innerHTML = ordersCache.length
    ? ordersCache.map(renderOrderRow).join("")
    : `<tr><td colspan="9" class="admin-empty">Nenhum pedido ainda.</td></tr>`;
  setOrdersMoreState();
}

// Scrolling to the bottom pulls the next page in. The button underneath does
// the same thing, so the page still works if the observer never fires (an
// unsupported browser, or a window tall enough that nothing scrolls).
ordersMoreBtn?.addEventListener("click", () => loadOrders(true));
if (ordersMore && "IntersectionObserver" in window) {
  new IntersectionObserver(
    (entries) => { if (entries.some((entry) => entry.isIntersecting)) loadOrders(true); },
    { rootMargin: "300px" }
  ).observe(ordersMore);
}

function renderPipeline(order) {
  const el = document.getElementById("orderPipeline");
  if (order.status === "cancelled" || order.status === "refunded") {
    el.innerHTML = `<div class="pipeline-step terminal" style="flex:1 1 100%;cursor:default;">${STATUS_LABELS[order.status]}</div>`;
    return;
  }
  const currentIdx = PIPELINE.indexOf(order.status);
  el.innerHTML = PIPELINE.map((step, i) => {
    const cls = i < currentIdx ? "done" : i === currentIdx ? "current" : "";
    return `<button type="button" class="pipeline-step ${cls}" data-status="${step}">${STATUS_LABELS[step] || step}</button>`;
  }).join("");
}

function openOrderModal(order) {
  selectedOrderId = order.id;
  document.getElementById("orderModalTitle").textContent = `Pedido ${orderCode(order.id)}`;
  showAlert2("");

  document.getElementById("odName").textContent = order.customer_name || "—";
  document.getElementById("odEmail").textContent = order.customer_email || "—";
  document.getElementById("odPhone").textContent = order.customer_phone || "—";

  document.querySelector("#orderItemsTable tbody").innerHTML = (order.items || [])
    .map((it) => `<tr><td class="wrap">${escapeHtml(it.name)}</td><td>${it.qty}</td><td>${money(it.price)}</td><td>${money(it.price * it.qty)}</td></tr>`)
    .join("") || `<tr><td colspan="4" class="admin-empty">Sem itens.</td></tr>`;

  document.getElementById("odDeliveryFee").textContent = money(order.delivery_fee || 0);
  document.getElementById("odDiscount").textContent = money(order.discount || 0);
  document.getElementById("odTotal").textContent = money(order.total);

  // shipping_address is what an admin has typed here; customer_address is what
  // the customer entered at checkout. These boxes were only ever reading the
  // first, so they showed empty on every order that hadn't been edited by hand.
  document.getElementById("odShippingAddress").value = order.shipping_address || order.customer_address || "";
  document.getElementById("odShippingCity").value = order.shipping_city || order.customer_city || "";
  document.getElementById("odCourier").value = order.courier || "";
  document.getElementById("odTracking").value = order.tracking_number || "";
  document.getElementById("odDeliveryStatus").value = order.delivery_status || "pending";
  document.getElementById("odPaymentMethod").value = order.payment_method || "";
  document.getElementById("odPaymentStatus").value = order.payment_status || "pending";

  const receiptEl = document.getElementById("odReceiptLink");
  if (order.receipt_url) {
    receiptEl.textContent = "A carregar…";
    supabaseClient.storage.from("receipts").createSignedUrl(order.receipt_url, 3600).then(({ data }) => {
      receiptEl.innerHTML = data?.signedUrl
        ? `<a href="${data.signedUrl}" target="_blank" rel="noopener" style="color:var(--ink);text-decoration:underline;">Ver comprovativo enviado</a>`
        : "Não foi possível carregar o comprovativo.";
    });
  } else {
    receiptEl.textContent = "Nenhum comprovativo enviado.";
  }

  renderPipeline(order);
  orderModalOverlay.classList.add("open");
}

function showAlert2(message, type = "error") {
  orderModalAlert.innerHTML = message ? `<div class="admin-alert admin-alert-${type}">${escapeHtml(message)}</div>` : "";
}

function closeOrderModal() {
  orderModalOverlay.classList.remove("open");
  selectedOrderId = null;
}

async function updateOrder(patch) {
  const { data, error } = await supabaseClient.from("orders").update(patch).eq("id", selectedOrderId).select().single();
  if (error) {
    showAlert2("Não foi possível salvar as alterações.");
    return null;
  }
  const idx = ordersCache.findIndex((o) => o.id === selectedOrderId);
  if (idx !== -1) ordersCache[idx] = data;
  ordersTableBody.innerHTML = ordersCache.map(renderOrderRow).join("");
  return data;
}

document.getElementById("orderPipeline").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-status]");
  if (!btn) return;
  const updated = await updateOrder({ status: btn.dataset.status });
  if (updated) renderPipeline(updated);
});

document.getElementById("cancelOrderBtn").addEventListener("click", async () => {
  if (!confirm("Cancelar este pedido?")) return;
  const updated = await updateOrder({ status: "cancelled" });
  if (updated) renderPipeline(updated);
});

document.getElementById("refundOrderBtn").addEventListener("click", async () => {
  if (!confirm("Marcar este pedido como reembolsado?")) return;
  const updated = await updateOrder({ status: "refunded", payment_status: "refunded" });
  if (updated) {
    renderPipeline(updated);
    document.getElementById("odPaymentStatus").value = "refunded";
  }
});

document.getElementById("saveOrderBtn").addEventListener("click", async () => {
  const patch = {
    shipping_address: document.getElementById("odShippingAddress").value.trim(),
    shipping_city: document.getElementById("odShippingCity").value.trim(),
    courier: document.getElementById("odCourier").value.trim(),
    tracking_number: document.getElementById("odTracking").value.trim(),
    delivery_status: document.getElementById("odDeliveryStatus").value,
    payment_method: document.getElementById("odPaymentMethod").value.trim(),
    payment_status: document.getElementById("odPaymentStatus").value,
  };
  const updated = await updateOrder(patch);
  if (updated) showAlert2("Alterações salvas.", "success");
});

document.getElementById("closeOrderModalBtn").addEventListener("click", closeOrderModal);
orderModalOverlay.addEventListener("click", (e) => { if (e.target === orderModalOverlay) closeOrderModal(); });

// The list query only pulls the columns the table shows, so opening an order
// fetches its full row — the modal needs the receipt, the addresses and the
// payment fields the list deliberately leaves behind.
ordersTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-open]");
  if (!btn) return;
  btn.disabled = true;
  const { data, error } = await supabaseClient.from("orders").select("*").eq("id", btn.dataset.open).single();
  btn.disabled = false;
  if (error || !data) {
    showOrdersAlert("Não foi possível abrir este pedido.");
    return;
  }
  showOrdersAlert("");
  openOrderModal(data);
});

document.addEventListener("admin:ready", loadOrders);
