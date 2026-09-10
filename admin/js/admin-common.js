const money = (v) => `${Number(v || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;

// The order cycle, in order. There is no payment gateway: a person reads the
// comprovativo, decides whether the money arrived, and only then releases the
// shipment — so these seven states are that cycle, and the whole dashboard
// turns on the gap between "comprovativo_recebido" and "pagamento_confirmado".
const ORDER_STATUSES = [
  { value: "aguarda_pagamento",     label: "Aguarda pagamento",     cls: "st-waiting" },
  { value: "comprovativo_recebido", label: "Comprovativo recebido", cls: "st-review" },
  { value: "pagamento_confirmado",  label: "Pagamento confirmado",  cls: "st-paid" },
  { value: "em_preparacao",         label: "Em preparação",         cls: "st-packing" },
  { value: "enviado",               label: "Enviado",               cls: "st-shipped" },
  { value: "entregue",              label: "Entregue",              cls: "st-done" },
  { value: "cancelado",             label: "Cancelado",             cls: "st-cancelled" },
];
const STATUS_LABELS = Object.fromEntries(ORDER_STATUSES.map((s) => [s.value, s.label]));
const STATUS_CLASS = Object.fromEntries(ORDER_STATUSES.map((s) => [s.value, s.cls]));

const statusLabel = (v) => STATUS_LABELS[v] || v || "—";
function statusPill(v) {
  return `<span class="pill ${STATUS_CLASS[v] || ""}">${escapeHtml(statusLabel(v))}</span>`;
}

// Records who did what. Failures are swallowed on purpose: an audit write must
// never be the reason an admin can't confirm a payment.
async function logActivity(action, entity, entityId, detail = null) {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    await supabaseClient.from("activity_log").insert({
      actor_id: user?.id || null,
      actor_email: user?.email || null,
      action,
      entity,
      entity_id: entityId != null ? String(entityId) : null,
      detail,
    });
  } catch (err) {
    console.warn("activity_log:", err);
  }
}

// Counts of outstanding work, shown against the sidebar links. Loaded on every
// admin page so you can see there are comprovativos waiting without first
// navigating to Início. head:true fetches the count only, never the rows.
async function loadNavBadges() {
  const setBadge = (sel, n) =>
    document.querySelectorAll(sel).forEach((b) => { b.textContent = n; b.hidden = !n; });
  try {
    const [messages, receipts] = await Promise.all([
      supabaseClient.from("contact_messages").select("id", { count: "exact", head: true })
        .eq("archived", false).eq("handled", false),
      supabaseClient.from("orders").select("id", { count: "exact", head: true })
        .eq("archived", false).eq("status", "comprovativo_recebido"),
    ]);
    setBadge("[data-messages-badge]", messages.count || 0);
    setBadge("[data-orders-badge]", receipts.count || 0);
  } catch (err) {
    console.warn("nav badges:", err);
  }
}
document.addEventListener("admin:ready", loadNavBadges);

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

// Orders use a uuid primary key, so this is a short, stable display code
// (not a sequential order number) — the first 8 hex chars, uppercased.
const orderCode = (id) => `#MP${String(id).replace(/-/g, "").slice(0, 8).toUpperCase()}`;

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Mobile sidebar: hamburger toggles the nav + account section open/closed.
document.getElementById("adminMobileToggle")?.addEventListener("click", () => {
  document.querySelector(".admin-sidebar")?.classList.toggle("open");
});
// Closing the drawer after picking a destination avoids it staying open
// (and blocking the page) once the next page loads with the same class state.
document.querySelector(".admin-nav")?.addEventListener("click", (e) => {
  if (e.target.closest("a")) document.querySelector(".admin-sidebar")?.classList.remove("open");
});

function renderBarChart(el, points, formatValue = money) {
  const max = Math.max(1, ...points.map((p) => p.value));
  el.innerHTML = points
    .map(
      (p) => `
      <div class="bar-col">
        <div class="bar" style="height:${Math.max(2, Math.round((p.value / max) * 100))}%" title="${formatValue(p.value)}"></div>
        <span class="bar-label">${p.label}</span>
      </div>`
    )
    .join("");
}

// metricFn(order) => number to accumulate per bucket (defaults to revenue, excluding cancelled/refunded).
function bucketOrdersByDay(orders, days, metricFn = (o) => Number(o.total || 0)) {
  const buckets = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets.push({ date: d, value: 0 });
  }
  orders.forEach((o) => {
    if (o.status === "cancelado") return;
    const d = new Date(o.created_at);
    d.setHours(0, 0, 0, 0);
    const bucket = buckets.find((b) => b.date.getTime() === d.getTime());
    if (bucket) bucket.value += metricFn(o);
  });
  return buckets;
}

function bucketOrdersByMonth(orders, metricFn = (o) => Number(o.total || 0)) {
  const now = new Date();
  const buckets = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("pt-PT", { month: "short" }), value: 0 });
  }
  orders.forEach((o) => {
    if (o.status === "cancelado") return;
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) bucket.value += metricFn(o);
  });
  return buckets;
}
