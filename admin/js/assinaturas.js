let subsCache = [];
const subsAlert = document.getElementById("subsAlert");
const subsTableBody = document.querySelector("#subsTable tbody");

function showSubsAlert(message, type = "error") {
  subsAlert.innerHTML = message ? `<div class="admin-alert admin-alert-${type}">${escapeHtml(message)}</div>` : "";
}

function renderSubRow(s) {
  return `
    <tr data-id="${s.id}">
      <td>${escapeHtml(s.email)}</td>
      <td>${formatDate(s.created_at)}</td>
      <td><span class="pill ${s.active ? "pill-active" : "pill-inactive"}">${s.active ? "Activo" : "Inactivo"}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn-icon" data-toggle="${s.id}" aria-label="Alternar status">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 6 9 17l-5-5"/></svg>
          </button>
          <button class="btn-icon danger" data-delete-sub="${s.id}" aria-label="Remover">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

async function loadSubs() {
  const { data, error } = await supabaseClient.from("subscriptions").select("*").order("created_at", { ascending: false });
  if (error) {
    showSubsAlert("Não foi possível carregar as assinaturas. Confirme se a migração do banco de dados foi executada.");
    subsTableBody.innerHTML = `<tr><td colspan="4" class="admin-empty">Erro ao carregar.</td></tr>`;
    return;
  }
  subsCache = data || [];
  subsTableBody.innerHTML = subsCache.length
    ? subsCache.map(renderSubRow).join("")
    : `<tr><td colspan="4" class="admin-empty">Nenhuma assinatura ainda.</td></tr>`;
}

subsTableBody.addEventListener("click", async (e) => {
  const toggleBtn = e.target.closest("[data-toggle]");
  if (toggleBtn) {
    const sub = subsCache.find((s) => s.id === Number(toggleBtn.dataset.toggle));
    const { error } = await supabaseClient.from("subscriptions").update({ active: !sub.active }).eq("id", sub.id);
    if (error) showSubsAlert("Não foi possível actualizar.");
    else loadSubs();
    return;
  }

  const delBtn = e.target.closest("[data-delete-sub]");
  if (delBtn) {
    if (!confirm("Remover esta assinatura?")) return;
    const { error } = await supabaseClient.from("subscriptions").delete().eq("id", Number(delBtn.dataset.deleteSub));
    if (error) showSubsAlert("Não foi possível remover.");
    else loadSubs();
  }
});

document.getElementById("exportBtn").addEventListener("click", () => {
  if (!subsCache.length) return;
  const rows = [["email", "inscrito_em", "activo"], ...subsCache.map((s) => [s.email, s.created_at, s.active])];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "assinaturas-mushy-parfum.csv";
  a.click();
  URL.revokeObjectURL(url);
});

document.addEventListener("admin:ready", loadSubs);
