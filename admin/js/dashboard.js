let allOrdersCache = [];
let currentRange = 7;

function drawChart() {
  const chartEl = document.getElementById("salesChart");
  if (currentRange === 365) {
    const buckets = bucketOrdersByMonth(allOrdersCache);
    renderBarChart(chartEl, buckets.map((b) => ({ label: b.label, value: b.value })));
  } else {
    const buckets = bucketOrdersByDay(allOrdersCache, currentRange);
    renderBarChart(
      chartEl,
      buckets.map((b) => ({ label: b.date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }), value: b.value }))
    );
  }
}

document.getElementById("chartRange").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-range]");
  if (!btn) return;
  currentRange = Number(btn.dataset.range);
  document.querySelectorAll("#chartRange [data-range]").forEach((b) => b.classList.toggle("active", b === btn));
  drawChart();
});

document.addEventListener("admin:ready", async () => {
  const statGrid = document.getElementById("statGrid");
  const recentBody = document.querySelector("#recentOrdersTable tbody");
  const lowStockBody = document.querySelector("#lowStockTable tbody");
  const recentCustomersBody = document.querySelector("#recentCustomersTable tbody");
  const bestSellerEl = document.getElementById("bestSeller");

  // Each query is fired at once but rendered the moment its own data lands,
  // rather than the whole dashboard waiting on the slowest of the five. The
  // orders query is the slow one, so recent customers and the low-stock table
  // now paint long before it returns.
  //
  // The orders query also asks for only the columns this page reads. It used
  // to be select("*") over every order ever placed, which meant dragging back
  // receipt paths, addresses and payment fields nothing here looks at.
  const productCountQuery = supabaseClient.from("products").select("*", { count: "exact", head: true });
  const productsQuery = supabaseClient.from("products").select("id, name, image, stock, low_stock_threshold");
  const customerCountQuery = supabaseClient.from("customers").select("*", { count: "exact", head: true });
  const ordersQuery = supabaseClient
    .from("orders")
    .select("id, created_at, customer_name, total, status, items")
    .order("created_at", { ascending: false });
  const recentCustomersQuery = supabaseClient
    .from("customers")
    .select("id, full_name, email, created_at")
    .order("created_at", { ascending: false })
    .limit(6);

  // Questions submitted through contacto.html. Independent of the rest, and
  // the table only exists once migration_11 has been run — a missing table
  // shouldn't take the whole dashboard down with it.
  const contactList = document.getElementById("contactMessages");
  if (contactList) {
    supabaseClient
      .from("contact_messages")
      .select("id, created_at, name, email, subject, message")
      .order("created_at", { ascending: false })
      .limit(25)
      .then(({ data: messages, error }) => {
        if (error) {
          contactList.innerHTML = `<p class="admin-empty">Execute a migração das mensagens de contacto.</p>`;
          return;
        }
        if (!(messages || []).length) {
          contactList.innerHTML = `<p class="admin-empty">Nenhuma mensagem ainda.</p>`;
          return;
        }
        contactList.innerHTML = messages
          .map(
            (m) => `<article class="message-card">
              <header class="message-card-head">
                <div>
                  <strong class="message-from">${escapeHtml(m.name)}</strong>
                  <a class="message-email" href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a>
                </div>
                <time class="message-date">${formatDate(m.created_at)}</time>
              </header>
              ${m.subject ? `<p class="message-subject">${escapeHtml(m.subject)}</p>` : ""}
              <p class="message-body">${escapeHtml(m.message)}</p>
              <a class="btn-admin btn-admin-outline message-reply"
                 href="mailto:${escapeHtml(m.email)}?subject=${encodeURIComponent("Re: " + (m.subject || "a sua mensagem"))}">Responder</a>
            </article>`
          )
          .join("");
      });
  }

  // Recent customers: independent of everything else, so it renders first.
  recentCustomersQuery.then(({ data: recentCustomers }) => {
    recentCustomersBody.innerHTML = (recentCustomers || []).length
      ? recentCustomers
          .map((c) => `<tr><td class="wrap">${escapeHtml(c.full_name)}</td><td>${escapeHtml(c.email)}</td><td>${formatDate(c.created_at)}</td></tr>`)
          .join("")
      : `<tr><td colspan="3" class="admin-empty">Nenhum cliente ainda.</td></tr>`;
  });

  const [{ count: productCount }, { data: allProducts }, { count: customerCount }] = await Promise.all([
    productCountQuery,
    productsQuery,
    customerCountQuery,
  ]);

  // Low stock only needs the products query, so it paints before orders land.
  const lowStockProducts = (allProducts || []).filter((p) => (p.stock ?? 0) <= (p.low_stock_threshold ?? 5));
  lowStockBody.innerHTML = lowStockProducts.length
    ? lowStockProducts
        .slice(0, 6)
        .map((p) => `<tr><td class="wrap">${escapeHtml(p.name)}</td><td><span class="pill pill-low">${p.stock ?? 0}</span></td></tr>`)
        .join("")
    : `<tr><td colspan="2" class="admin-empty">Stock saudável.</td></tr>`;

  const { data: allOrders } = await ordersQuery;

  allOrdersCache = allOrders || [];
  document.querySelector('#chartRange [data-range="7"]').classList.add("active");
  drawChart();

  const revenueOrders = allOrdersCache.filter((o) => !["cancelled", "refunded"].includes(o.status));
  const totalSales = revenueOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const pendingCount = allOrdersCache.filter((o) => o.status === "pending").length;

  const cards = [
    { label: "Vendas totais", value: money(totalSales) },
    { label: "Pedidos", value: allOrdersCache.length },
    { label: "Clientes", value: customerCount ?? 0 },
    { label: "Produtos", value: productCount ?? 0 },
    { label: "Pedidos pendentes", value: pendingCount, warn: pendingCount > 0 },
    { label: "Stock baixo", value: lowStockProducts.length, warn: lowStockProducts.length > 0 },
  ];
  statGrid.innerHTML = cards
    .map((c) => `<div class="stat-card${c.warn ? " warn" : ""}"><span>${c.label}</span><strong>${c.value}</strong></div>`)
    .join("");

  // Recent orders
  const recentOrders = allOrdersCache.slice(0, 6);
  recentBody.innerHTML = recentOrders.length
    ? recentOrders
        .map(
          (o) => `
        <tr>
          <td>${orderCode(o.id)}</td>
          <td class="wrap">${escapeHtml(o.customer_name || "—")}</td>
          <td>${formatDate(o.created_at)}</td>
          <td>${money(o.total)}</td>
          <td><span class="status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span></td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="admin-empty">Nenhum pedido ainda.</td></tr>`;

  // Best seller: tally quantities across all order items
  const qtyByProductId = {};
  allOrdersCache.forEach((o) => (o.items || []).forEach((it) => { qtyByProductId[it.id] = (qtyByProductId[it.id] || 0) + it.qty; }));
  const bestId = Object.entries(qtyByProductId).sort((a, b) => b[1] - a[1])[0]?.[0];
  const bestProduct = bestId ? (allProducts || []).find((p) => String(p.id) === String(bestId)) : null;
  bestSellerEl.innerHTML = bestProduct
    ? `<div class="best-seller-card">
        ${bestProduct.image ? `<img src="../${escapeHtml(bestProduct.image)}" alt="">` : ""}
        <div><strong>${escapeHtml(bestProduct.name)}</strong><span>${qtyByProductId[bestId]} vendidos</span></div>
      </div>`
    : `<p class="admin-empty" style="padding:0;">Ainda sem vendas.</p>`;

});
