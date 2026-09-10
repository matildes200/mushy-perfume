// Orders list: filter by status, filter by date range, search by order code or
// client name, and real pagination.
//
// Pagination is a server-side range() with an exact count, not scroll-to-load:
// the person working through comprovativos needs to know how many are left and
// be able to come back to page 3, neither of which infinite scroll gives you.

const PAGE_SIZE = 25;

const tableBody = document.querySelector("#ordersTable tbody");
const alertEl = document.getElementById("ordersAlert");
const infoEl = document.getElementById("paginationInfo");
const pageEl = document.getElementById("paginationPage");
const prevBtn = document.getElementById("prevPageBtn");
const nextBtn = document.getElementById("nextPageBtn");

let page = 0;
let totalCount = 0;

const showAlert = (msg, type = "error") => {
  alertEl.innerHTML = msg ? `<div class="admin-alert admin-alert-${type}">${escapeHtml(msg)}</div>` : "";
};

// Status filter options come from the shared vocabulary, so the list can never
// offer a state the detail page doesn't know about.
document.getElementById("filterStatus").insertAdjacentHTML(
  "beforeend",
  ORDER_STATUSES.map((s) => `<option value="${s.value}">${s.label}</option>`).join("")
);

function currentFilters() {
  return {
    status: document.getElementById("filterStatus").value,
    from: document.getElementById("filterFrom").value,
    to: document.getElementById("filterTo").value,
    search: document.getElementById("filterSearch").value.trim(),
  };
}

function orderRow(o) {
  return `<tr>
    <td><a class="order-link" href="pedido.html?id=${encodeURIComponent(o.id)}">${orderCode(o.id)}</a></td>
    <td class="wrap">${escapeHtml(o.customer_name || "—")}</td>
    <td>${formatDate(o.created_at)}</td>
    <td>${money(o.total)}</td>
    <td class="wrap">${escapeHtml(o.payment_method || "—")}</td>
    <td>${statusPill(o.status)}</td>
    <td><a class="btn-admin btn-admin-outline" href="pedido.html?id=${encodeURIComponent(o.id)}">Abrir</a></td>
  </tr>`;
}

async function loadOrders() {
  const f = currentFilters();
  tableBody.innerHTML = `<tr><td colspan="7" class="admin-empty">A carregar…</td></tr>`;

  let query = supabaseClient
    .from("orders")
    .select("id, created_at, customer_name, total, payment_method, status", { count: "exact" })
    .eq("archived", false)
    .order("created_at", { ascending: false });

  if (f.status) query = query.eq("status", f.status);
  if (f.from) query = query.gte("created_at", `${f.from}T00:00:00`);
  // Inclusive of the end date: a range ending "today" has to contain today.
  if (f.to) query = query.lte("created_at", `${f.to}T23:59:59`);

  if (f.search) {
    // The visible code is #MP + the first 8 hex chars of the uuid, so a search
    // for a code has to be turned back into an id prefix before it can match.
    const bare = f.search.replace(/^#?MP/i, "").trim();
    const looksLikeCode = /^[0-9a-f]{4,8}$/i.test(bare);
    query = looksLikeCode
      ? query.ilike("id", `${bare.toLowerCase()}%`)
      : query.ilike("customer_name", `%${f.search}%`);
  }

  const from = page * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);

  if (error) {
    showAlert("Não foi possível carregar os pedidos.");
    tableBody.innerHTML = `<tr><td colspan="7" class="admin-empty">Erro ao carregar.</td></tr>`;
    return;
  }
  showAlert("");
  totalCount = count || 0;

  tableBody.innerHTML = (data || []).length
    ? data.map(orderRow).join("")
    : `<tr><td colspan="7" class="admin-empty">Nenhum pedido corresponde a estes filtros.</td></tr>`;

  renderPagination(data ? data.length : 0);
}

function renderPagination(shown) {
  const first = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const last = page * PAGE_SIZE + shown;
  const pages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  infoEl.textContent = totalCount
    ? `${first}–${last} de ${totalCount} pedido${totalCount === 1 ? "" : "s"}`
    : "Sem pedidos";
  pageEl.textContent = `Página ${page + 1} de ${pages}`;
  prevBtn.disabled = page === 0;
  nextBtn.disabled = page + 1 >= pages;
}

prevBtn.addEventListener("click", () => { if (page > 0) { page--; loadOrders(); } });
nextBtn.addEventListener("click", () => { page++; loadOrders(); });

document.getElementById("applyFiltersBtn").addEventListener("click", () => { page = 0; loadOrders(); });
document.getElementById("filterSearch").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { page = 0; loadOrders(); }
});
document.getElementById("filterStatus").addEventListener("change", () => { page = 0; loadOrders(); });
document.getElementById("clearFiltersBtn").addEventListener("click", () => {
  document.getElementById("filterStatus").value = "";
  document.getElementById("filterFrom").value = "";
  document.getElementById("filterTo").value = "";
  document.getElementById("filterSearch").value = "";
  page = 0;
  loadOrders();
});

// Deep link from Início: /pedidos.html?status=comprovativo_recebido lands with
// that filter already applied, so the action list is one click from the work.
const presetStatus = new URLSearchParams(window.location.search).get("status");
if (presetStatus) document.getElementById("filterStatus").value = presetStatus;

document.addEventListener("admin:ready", loadOrders);
