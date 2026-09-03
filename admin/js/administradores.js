let adminsCache = [];
let currentAdminEmail = null;
const adminsAlert = document.getElementById("adminsAlert");
const adminsTableBody = document.querySelector("#adminsTable tbody");
const adminModalOverlay = document.getElementById("adminModalOverlay");
const adminModalTitle = document.getElementById("adminModalTitle");
const adminForm = document.getElementById("adminForm");
const adminFormAlert = document.getElementById("adminFormAlert");

function showAlert(el, message, type = "error") {
  el.innerHTML = message ? `<div class="admin-alert admin-alert-${type === "error" ? "error" : "success"}">${escapeHtml(message)}</div>` : "";
}

function openModal(admin) {
  adminForm.reset();
  showAlert(adminFormAlert, "");
  document.getElementById("adminId").value = admin?.id || "";
  document.getElementById("full_name").value = admin?.full_name || "";
  document.getElementById("email").value = admin?.email || "";
  document.getElementById("role").value = admin?.role || "";
  document.getElementById("phone").value = admin?.phone || "";
  // Once created, the email is how is_admin() recognizes this person — changing
  // it here would silently detach them from their existing login.
  document.getElementById("email").disabled = Boolean(admin);
  adminModalTitle.textContent = admin ? "Editar administrador" : "Novo administrador";
  adminModalOverlay.classList.add("open");
}

function closeModal() {
  adminModalOverlay.classList.remove("open");
}

function renderRow(a) {
  const isSelf = a.email.toLowerCase() === (currentAdminEmail || "").toLowerCase();
  const isLast = adminsCache.length <= 1;
  const deleteDisabled = isSelf || isLast;
  const deleteTitle = isSelf ? "Você não pode remover sua própria conta" : isLast ? "Precisa haver pelo menos um administrador" : "Remover";
  return `
    <tr data-id="${a.id}">
      <td class="wrap">${escapeHtml(a.full_name || "—")}${isSelf ? ' <span class="pill pill-active">Você</span>' : ""}</td>
      <td>${escapeHtml(a.email)}</td>
      <td>${escapeHtml(a.role || "—")}</td>
      <td>${escapeHtml(a.phone || "—")}</td>
      <td>${formatDate(a.created_at)}</td>
      <td>
        <div class="row-actions">
          <button class="btn-icon" data-edit="${a.id}" aria-label="Editar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          </button>
          <button class="btn-icon danger" data-delete="${a.id}" aria-label="${deleteTitle}" title="${deleteTitle}" ${deleteDisabled ? "disabled style=\"opacity:.3;cursor:not-allowed;\"" : ""}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

async function loadAdmins() {
  const { data, error } = await supabaseClient.from("admins").select("*").order("created_at");
  if (error) {
    showAlert(adminsAlert, "Não foi possível carregar os administradores. Confirme se as migrações do banco de dados foram executadas.");
    adminsTableBody.innerHTML = `<tr><td colspan="6" class="admin-empty">Erro ao carregar.</td></tr>`;
    return;
  }
  adminsCache = data || [];
  adminsTableBody.innerHTML = adminsCache.length
    ? adminsCache.map(renderRow).join("")
    : `<tr><td colspan="6" class="admin-empty">Nenhum administrador cadastrado.</td></tr>`;
}

document.getElementById("newAdminBtn").addEventListener("click", () => openModal(null));
document.getElementById("cancelAdminBtn").addEventListener("click", closeModal);
adminModalOverlay.addEventListener("click", (e) => { if (e.target === adminModalOverlay) closeModal(); });

adminsTableBody.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit]");
  if (editBtn) {
    const admin = adminsCache.find((a) => a.id === Number(editBtn.dataset.edit));
    openModal(admin);
    return;
  }

  const deleteBtn = e.target.closest("[data-delete]");
  if (deleteBtn && !deleteBtn.disabled) {
    const id = Number(deleteBtn.dataset.delete);
    const admin = adminsCache.find((a) => a.id === id);
    if (!confirm(`Remover o acesso de "${admin?.full_name || admin?.email}"? Essa pessoa perderá acesso ao painel imediatamente.`)) return;
    const { error } = await supabaseClient.from("admins").delete().eq("id", id);
    if (error) {
      showAlert(adminsAlert, "Não foi possível remover este administrador.");
      return;
    }
    showAlert(adminsAlert, "Acesso removido.", "success");
    loadAdmins();
  }
});

adminForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById("saveAdminBtn");
  saveBtn.disabled = true;
  showAlert(adminFormAlert, "");

  const id = document.getElementById("adminId").value;
  const payload = {
    full_name: document.getElementById("full_name").value.trim(),
    role: document.getElementById("role").value.trim() || "Administrador",
    phone: document.getElementById("phone").value.trim() || null,
  };
  if (!id) payload.email = document.getElementById("email").value.trim().toLowerCase();

  const query = id
    ? supabaseClient.from("admins").update(payload).eq("id", id)
    : supabaseClient.from("admins").insert(payload);

  const { error } = await query;
  saveBtn.disabled = false;

  if (error) {
    showAlert(adminFormAlert, error.code === "23505" ? "Já existe um administrador com esse e-mail." : "Não foi possível salvar. Verifique os campos e tente novamente.");
    return;
  }

  closeModal();
  showAlert(adminsAlert, id ? "Administrador atualizado." : "Administrador adicionado. Peça para essa pessoa criar (ou entrar em) sua conta em Minha Conta com esse e-mail.", "success");
  loadAdmins();
});

document.addEventListener("admin:ready", (e) => {
  currentAdminEmail = e.detail?.session?.user?.email || null;
  loadAdmins();
});
