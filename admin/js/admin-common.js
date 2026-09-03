const money = (v) => `${Number(v || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;

const STATUS_LABELS = {
  pending: "Pendente",
  confirmed: "Confirmado",
  shipped: "Enviado",
  cancelled: "Cancelado",
};

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

// Orders use a uuid primary key, so this is a short, stable display code
// (not a sequential order number) — the first 8 hex chars, uppercased.
const orderCode = (id) => `#MP${String(id).replace(/-/g, "").slice(0, 8).toUpperCase()}`;

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

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
    if (["cancelled", "refunded"].includes(o.status)) return;
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
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("pt-BR", { month: "short" }), value: 0 });
  }
  orders.forEach((o) => {
    if (["cancelled", "refunded"].includes(o.status)) return;
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) bucket.value += metricFn(o);
  });
  return buckets;
}
