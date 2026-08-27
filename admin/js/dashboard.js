document.addEventListener("admin:ready", async () => {
  const statGrid = document.getElementById("statGrid");
  const recentBody = document.querySelector("#recentOrdersTable tbody");

  const [{ count: productCount }, { data: allProducts }, { count: pendingCount }, { count: subCount }, { data: recentOrders }] =
    await Promise.all([
      supabaseClient.from("products").select("*", { count: "exact", head: true }),
      supabaseClient.from("products").select("id, stock"),
      supabaseClient.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabaseClient.from("subscriptions").select("*", { count: "exact", head: true }).eq("active", true),
      supabaseClient.from("orders").select("*").order("created_at", { ascending: false }).limit(6),
    ]);

  const lowStock = (allProducts || []).filter((p) => (p.stock ?? 0) <= 5).length;

  statGrid.innerHTML = `
    <div class="stat-card">
      <span>Produtos</span>
      <strong>${productCount ?? 0}</strong>
    </div>
    <div class="stat-card${lowStock > 0 ? " warn" : ""}">
      <span>Estoque baixo (≤5)</span>
      <strong>${lowStock}</strong>
    </div>
    <div class="stat-card${(pendingCount ?? 0) > 0 ? " warn" : ""}">
      <span>Pedidos pendentes</span>
      <strong>${pendingCount ?? 0}</strong>
    </div>
    <div class="stat-card">
      <span>Assinantes ativos</span>
      <strong>${subCount ?? 0}</strong>
    </div>
  `;

  if (!recentOrders || recentOrders.length === 0) {
    recentBody.innerHTML = `<tr><td colspan="4" class="admin-empty">Nenhum pedido ainda.</td></tr>`;
    return;
  }

  recentBody.innerHTML = recentOrders
    .map((o) => {
      const itemsSummary = (o.items || []).map((i) => `${i.name} x${i.qty}`).join(", ");
      return `
        <tr>
          <td>${formatDate(o.created_at)}</td>
          <td class="wrap">${escapeHtml(itemsSummary)}</td>
          <td>${money(o.total)}</td>
          <td><span class="status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span></td>
        </tr>`;
    })
    .join("");
});
