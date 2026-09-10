// Início — what needs action right now, then four figures. Nothing else.
//
// Deliberately not a charts page. The person opening this is about to work
// through comprovativos, so the first thing on screen is a list of things to
// click, each landing on the filtered view that does that job.

const actionListEl = document.getElementById("actionList");
const statGridEl = document.getElementById("statGrid");

function actionRow({ href, label, hint, count, tone }) {
  const badge = count > 0
    ? `<span class="action-count ${tone || ""}">${count}</span>`
    : `<span class="action-count zero">0</span>`;
  return `<a class="action-row${count > 0 ? " has-work" : ""}" href="${href}">
    ${badge}
    <span class="action-text"><strong>${label}</strong><span>${hint}</span></span>
    <span class="action-go" aria-hidden="true">&rarr;</span>
  </a>`;
}

async function loadActionList() {
  // head:true with an exact count asks the server for the number only — no
  // rows come back, so this stays fast however many orders exist.
  const countOf = (table, build) =>
    build(supabaseClient.from(table).select("id", { count: "exact", head: true }));

  const [awaitingReceipt, paidNotShipped, unreadMessages, lowStock] = await Promise.all([
    countOf("orders", (q) => q.eq("archived", false).eq("status", "comprovativo_recebido")),
    countOf("orders", (q) => q.eq("archived", false).in("status", ["pagamento_confirmado", "em_preparacao"])),
    countOf("contact_messages", (q) => q.eq("archived", false).eq("handled", false)),
    supabaseClient.from("products").select("id, stock, low_stock_threshold").eq("archived", false),
  ]);

  const lowStockCount = (lowStock.data || []).filter(
    (p) => (p.stock ?? 0) <= (p.low_stock_threshold ?? 5)
  ).length;

  actionListEl.innerHTML = [
    actionRow({
      href: "pedidos.html?status=comprovativo_recebido",
      label: "Comprovativos por validar",
      hint: "Pedidos à espera de confirmação de pagamento",
      count: awaitingReceipt.count || 0,
      tone: "urgent",
    }),
    actionRow({
      href: "pedidos.html?status=pagamento_confirmado",
      label: "Pagos, por enviar",
      hint: "Pagamento confirmado, ainda não despachado",
      count: paidNotShipped.count || 0,
    }),
    actionRow({
      href: "mensagens.html",
      label: "Mensagens por responder",
      hint: "Perguntas enviadas pelo site",
      count: unreadMessages.count || 0,
    }),
    actionRow({
      href: "produtos.html",
      label: "Produtos com stock baixo ou esgotado",
      hint: "Repor antes que saiam do catálogo",
      count: lowStockCount,
    }),
  ].join("");
}

async function loadMonthFigures() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: orders } = await supabaseClient
    .from("orders")
    .select("total, items, status")
    .eq("archived", false)
    .gte("created_at", monthStart);

  // Cancelled orders are excluded from every figure — they are not revenue.
  const counted = (orders || []).filter((o) => o.status !== "cancelado");
  const sales = counted.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const orderCount = counted.length;
  const average = orderCount ? sales / orderCount : 0;

  const qtyByName = {};
  counted.forEach((o) =>
    (o.items || []).forEach((it) => {
      qtyByName[it.name] = (qtyByName[it.name] || 0) + Number(it.qty || 0);
    })
  );
  const best = Object.entries(qtyByName).sort((a, b) => b[1] - a[1])[0];

  const cards = [
    { label: "Vendas do mês", value: money(sales) },
    { label: "Pedidos", value: String(orderCount) },
    { label: "Valor médio por pedido", value: money(average) },
    // Marked as text: a perfume name set at the 30px figure size is what
    // pushed this grid past its panel and got the row clipped.
    { label: "Produto mais vendido", value: best ? `${escapeHtml(best[0])} (${best[1]})` : "—", text: true },
  ];
  statGridEl.innerHTML = cards
    .map((c) => `<div class="stat-card${c.text ? " stat-text" : ""}"><span>${c.label}</span><strong>${c.value}</strong></div>`)
    .join("");
}

document.addEventListener("admin:ready", () => {
  loadActionList();
  loadMonthFigures();
});
