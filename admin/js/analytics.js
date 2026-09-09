let analyticsOrders = [];
let currentMetric = "revenue";
let currentRange = 7;

function metricValue(o) {
  return currentMetric === "revenue" ? Number(o.total || 0) : 1;
}

function drawAnalyticsChart() {
  const el = document.getElementById("analyticsChart");
  document.getElementById("chartTitle").textContent = currentMetric === "revenue" ? "Receita ao longo do tempo" : "Pedidos ao longo do tempo";
  const formatValue = currentMetric === "revenue" ? money : (v) => String(v);

  if (currentRange === 365) {
    const buckets = bucketOrdersByMonth(analyticsOrders, metricValue);
    renderBarChart(el, buckets.map((b) => ({ label: b.label, value: b.value })), formatValue);
  } else {
    const buckets = bucketOrdersByDay(analyticsOrders, currentRange, metricValue);
    renderBarChart(el, buckets.map((b) => ({ label: b.date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }), value: b.value })), formatValue);
  }
}

document.getElementById("metricRevenue").addEventListener("click", () => {
  currentMetric = "revenue";
  document.getElementById("metricRevenue").classList.add("active");
  document.getElementById("metricOrders").classList.remove("active");
  drawAnalyticsChart();
});
document.getElementById("metricOrders").addEventListener("click", () => {
  currentMetric = "orders";
  document.getElementById("metricOrders").classList.add("active");
  document.getElementById("metricRevenue").classList.remove("active");
  drawAnalyticsChart();
});
document.querySelectorAll("[data-range]").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentRange = Number(btn.dataset.range);
    document.querySelectorAll("[data-range]").forEach((b) => b.classList.toggle("active", b === btn));
    drawAnalyticsChart();
  });
});

document.addEventListener("admin:ready", async () => {
  const [{ data: orders }, { data: products }, { data: customers }] = await Promise.all([
    supabaseClient.from("orders").select("*"),
    supabaseClient.from("products").select("id, name, image"),
    supabaseClient.from("customers").select("id"),
  ]);

  analyticsOrders = orders || [];
  document.getElementById("metricRevenue").classList.add("active");
  document.querySelector('[data-range="7"]').classList.add("active");
  drawAnalyticsChart();

  const revenueOrders = analyticsOrders.filter((o) => !["cancelled", "refunded"].includes(o.status));
  const revenue = revenueOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const ordersByCustomer = {};
  analyticsOrders.forEach((o) => {
    if (!o.customer_id) return;
    (ordersByCustomer[o.customer_id] ||= []).push(o);
  });
  const returningCount = Object.values(ordersByCustomer).filter((list) => list.length >= 2).length;
  const newCount = Object.values(ordersByCustomer).filter((list) => list.length === 1).length;

  document.getElementById("analyticsStats").innerHTML = `
    <div class="stat-card"><span>Receita</span><strong>${money(revenue)}</strong></div>
    <div class="stat-card"><span>Pedidos</span><strong>${analyticsOrders.length}</strong></div>
    <div class="stat-card"><span>Ticket médio</span><strong>${money(revenueOrders.length ? revenue / revenueOrders.length : 0)}</strong></div>
    <div class="stat-card"><span>Clientes recorrentes</span><strong>${returningCount}</strong></div>
  `;
  document.getElementById("newCustomersCount").textContent = newCount;
  document.getElementById("returningCustomersCount").textContent = returningCount;

  // Best / worst sellers
  const qtyByProductId = {};
  analyticsOrders.forEach((o) => (o.items || []).forEach((it) => { qtyByProductId[it.id] = (qtyByProductId[it.id] || 0) + it.qty; }));
  const ranked = (products || [])
    .map((p) => ({ ...p, sold: qtyByProductId[p.id] || 0 }))
    .sort((a, b) => b.sold - a.sold);

  const best = ranked.slice(0, 5);
  const worst = ranked.slice(-5).reverse();

  document.querySelector("#bestSellersTable tbody").innerHTML = best.length
    ? best.map((p) => `<tr><td class="wrap">${escapeHtml(p.name)}</td><td>${p.sold}</td></tr>`).join("")
    : `<tr><td colspan="2" class="admin-empty">Sem vendas ainda.</td></tr>`;

  document.querySelector("#worstSellersTable tbody").innerHTML = worst.length
    ? worst.map((p) => `<tr><td class="wrap">${escapeHtml(p.name)}</td><td>${p.sold}</td></tr>`).join("")
    : `<tr><td colspan="2" class="admin-empty">Sem dados ainda.</td></tr>`;

  // Top customers by spend (needs names/emails — fetch full customer rows for those with orders)
  const customerIds = Object.keys(ordersByCustomer);
  let topCustomersRows = `<tr><td colspan="3" class="admin-empty">Nenhum cliente com pedidos ainda.</td></tr>`;
  if (customerIds.length) {
    const { data: customerRows } = await supabaseClient.from("customers").select("id, full_name").in("id", customerIds);
    const nameById = Object.fromEntries((customerRows || []).map((c) => [c.id, c.full_name]));
    const topCustomers = customerIds
      .map((id) => ({ id, name: nameById[id] || "—", count: ordersByCustomer[id].length, spent: ordersByCustomer[id].reduce((s, o) => s + Number(o.total || 0), 0) }))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5);
    if (topCustomers.length) {
      topCustomersRows = topCustomers.map((c) => `<tr><td class="wrap">${escapeHtml(c.name)}</td><td>${c.count}</td><td>${money(c.spent)}</td></tr>`).join("");
    }
  }
  document.querySelector("#topCustomersTable tbody").innerHTML = topCustomersRows;
});
