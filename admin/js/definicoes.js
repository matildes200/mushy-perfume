// Definições — the values the public site reads, plus who can get in here.
//
// Everything a customer sees at checkout comes from payment_settings, which is
// a single row. When a field here is blank the site renders a dash, which is
// why the IBAN has to be editable without a developer.

const SETTINGS_ROW_ID = 1;

const settingsAlert = document.getElementById("settingsAlert");
const adminsAlert = document.getElementById("adminsAlert");
const adminsTableBody = document.querySelector("#adminsTable tbody");
const adminModal = document.getElementById("adminModalOverlay");

let adminsCache = [];
let currentUserEmail = null;

const showAlert = (el, msg, type = "error") => {
  el.innerHTML = msg ? `<div class="admin-alert admin-alert-${type}">${escapeHtml(msg)}</div>` : "";
};

// ------------------------------------------------------------- settings ---

const SETTINGS_FIELDS = [
  "bank_name", "account_holder", "account_number", "express_phone",
  "store_phone", "store_email", "store_instagram", "banner_text",
];

async function loadSettings() {
  const { data, error } = await supabaseClient.from("payment_settings").select("*").limit(1).maybeSingle();
  if (error) {
    showAlert(settingsAlert, "Não foi possível carregar as definições.");
    return;
  }
  SETTINGS_FIELDS.forEach((f) => {
    const el = document.getElementById(f);
    if (el) el.value = data?.[f] || "";
  });
  document.getElementById("banner_active").checked = Boolean(data?.banner_active);
}

// upsert on a fixed id so the row is created the first time rather than the
// save silently updating nothing.
async function saveSettings(patch, okMessage) {
  const { error } = await supabaseClient
    .from("payment_settings")
    .upsert({ id: SETTINGS_ROW_ID, ...patch, updated_at: new Date().toISOString() });
  if (error) {
    showAlert(settingsAlert, "Não foi possível guardar. Tente novamente.");
    return false;
  }
  await logActivity("settings_update", "payment_settings", SETTINGS_ROW_ID, patch);
  showAlert(settingsAlert, okMessage, "success");
  return true;
}

const val = (id) => document.getElementById(id).value.trim();

document.getElementById("paymentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await saveSettings(
    {
      bank_name: val("bank_name"),
      account_holder: val("account_holder"),
      account_number: val("account_number"),
      express_phone: val("express_phone"),
    },
    "Dados de pagamento guardados."
  );
});

document.getElementById("contactForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await saveSettings(
    {
      store_phone: val("store_phone"),
      store_email: val("store_email"),
      store_instagram: val("store_instagram"),
    },
    "Contactos guardados."
  );
});

document.getElementById("bannerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await saveSettings(
    {
      banner_text: val("banner_text"),
      banner_active: document.getElementById("banner_active").checked,
    },
    "Banner guardado."
  );
});

// --------------------------------------------------------------- admins ---

function adminRow(a) {
  // You cannot remove yourself, and the last administrator cannot be removed —
  // either would lock everybody out of the panel.
  const isSelf = currentUserEmail && a.email?.toLowerCase() === currentUserEmail.toLowerCase();
  const isLast = adminsCache.length <= 1;
  const disabled = isSelf || isLast;
  const why = isSelf
    ? "Não pode remover a sua própria conta"
    : isLast
    ? "Tem de existir pelo menos um administrador"
    : "Remover";
  return `<tr>
    <td class="wrap">${escapeHtml(a.full_name || "—")}${isSelf ? ' <span class="pill pill-active">A sua conta</span>' : ""}</td>
    <td class="wrap">${escapeHtml(a.email)}</td>
    <td class="wrap">${escapeHtml(a.role || "—")}</td>
    <td>${a.created_at ? formatDate(a.created_at) : "—"}</td>
    <td>
      <div class="row-actions">
        <button class="btn-admin btn-admin-outline" data-edit="${a.id}">Editar</button>
        <button class="btn-admin btn-admin-danger" data-delete="${a.id}" title="${escapeHtml(why)}"
          ${disabled ? 'disabled style="opacity:.35;cursor:not-allowed;"' : ""}>Remover</button>
      </div>
    </td>
  </tr>`;
}

async function loadAdmins() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  currentUserEmail = user?.email || null;

  const { data, error } = await supabaseClient.from("admins").select("*").order("created_at");
  if (error) {
    showAlert(adminsAlert, "Não foi possível carregar os administradores.");
    adminsTableBody.innerHTML = `<tr><td colspan="5" class="admin-empty">Erro ao carregar.</td></tr>`;
    return;
  }
  adminsCache = data || [];
  adminsTableBody.innerHTML = adminsCache.length
    ? adminsCache.map(adminRow).join("")
    : `<tr><td colspan="5" class="admin-empty">Nenhum administrador registado.</td></tr>`;
}

function openAdminModal(admin) {
  document.getElementById("adminModalTitle").textContent = admin ? "Editar administrador" : "Adicionar administrador";
  document.getElementById("adminId").value = admin?.id || "";
  document.getElementById("admin_email").value = admin?.email || "";
  document.getElementById("admin_full_name").value = admin?.full_name || "";
  document.getElementById("admin_role").value = admin?.role || "";
  document.getElementById("admin_phone").value = admin?.phone || "";
  document.getElementById("adminFormAlert").innerHTML = "";
  adminModal.classList.add("open");
}
const closeAdminModal = () => adminModal.classList.remove("open");

document.getElementById("newAdminBtn").addEventListener("click", () => openAdminModal(null));
document.getElementById("cancelAdminBtn").addEventListener("click", closeAdminModal);
adminModal.addEventListener("click", (e) => { if (e.target === adminModal) closeAdminModal(); });

adminsTableBody.addEventListener("click", async (e) => {
  const edit = e.target.closest("[data-edit]");
  if (edit) {
    const admin = adminsCache.find((a) => String(a.id) === edit.dataset.edit);
    if (admin) openAdminModal(admin);
    return;
  }
  const del = e.target.closest("[data-delete]");
  if (!del || del.disabled) return;
  const admin = adminsCache.find((a) => String(a.id) === del.dataset.delete);
  if (!admin) return;
  if (!confirm(`Remover o acesso de ${admin.email}? Deixa de conseguir entrar no painel.`)) return;

  const { error } = await supabaseClient.from("admins").delete().eq("id", admin.id);
  if (error) return showAlert(adminsAlert, "Não foi possível remover este administrador.");
  await logActivity("admin_remove", "admin", admin.id, { email: admin.email });
  showAlert(adminsAlert, "Administrador removido.", "success");
  loadAdmins();
});

document.getElementById("adminForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("adminId").value;
  const payload = {
    email: val("admin_email").toLowerCase(),
    full_name: val("admin_full_name"),
    role: val("admin_role"),
    phone: val("admin_phone"),
  };
  if (!payload.email) {
    document.getElementById("adminFormAlert").innerHTML =
      `<div class="admin-alert admin-alert-error">Indique o e-mail.</div>`;
    return;
  }

  const { error } = id
    ? await supabaseClient.from("admins").update(payload).eq("id", Number(id))
    : await supabaseClient.from("admins").insert(payload);

  if (error) {
    const duplicate = error.code === "23505";
    document.getElementById("adminFormAlert").innerHTML =
      `<div class="admin-alert admin-alert-error">${
        duplicate ? "Este e-mail já tem acesso ao painel." : "Não foi possível guardar."
      }</div>`;
    return;
  }
  await logActivity(id ? "admin_update" : "admin_add", "admin", id || payload.email, { email: payload.email });
  closeAdminModal();
  showAlert(adminsAlert, id ? "Administrador actualizado." : "Administrador adicionado.", "success");
  loadAdmins();
});

document.addEventListener("admin:ready", () => {
  loadSettings();
  loadAdmins();
});
