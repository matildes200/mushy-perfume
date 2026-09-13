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

  // Free delivery lives on the same single settings row as the banner and the
  // IBAN, so it is loaded here rather than with the zones.
  const threshold = document.getElementById("free_delivery_threshold");
  if (threshold) threshold.value = data?.free_delivery_threshold ?? "";
  const freeActive = document.getElementById("free_delivery_active");
  if (freeActive) freeActive.checked = Boolean(data?.free_delivery_active);
}

// upsert on a fixed id so the row is created the first time rather than the
// save silently updating nothing.
// `target` is the alert box to write into: the settings row is shared by several
// panels, so the confirmation has to appear next to the form that was saved.
async function saveSettings(patch, okMessage, target = settingsAlert) {
  const { error } = await supabaseClient
    .from("payment_settings")
    .upsert({ id: SETTINGS_ROW_ID, ...patch, updated_at: new Date().toISOString() });
  if (error) {
    showAlert(target, "Não foi possível guardar. Tente novamente.");
    return false;
  }
  await logActivity("settings_update", "payment_settings", SETTINGS_ROW_ID, patch);
  showAlert(target, okMessage, "success");
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

// ------------------------------------------------------- delivery zones ---
// The whole point of this section is that a delivery price can change without
// anyone touching code. Nothing here is hard-coded on the storefront: the
// checkout reads the same table.

const zonesAlert = document.getElementById("zonesAlert");
const zonesTableBody = document.querySelector("#zonesTable tbody");
const zoneModal = document.getElementById("zoneModalOverlay");
let zonesCache = [];

function zoneRow(z) {
  return `<tr>
    <td class="wrap">${escapeHtml(z.name)}</td>
    <td>${z.on_request ? "Sob consulta" : money(z.price)}</td>
    <td>${z.sort_order ?? "—"}</td>
    <td>${
      z.active
        ? '<span class="pill pill-active">Visível</span>'
        : '<span class="pill pill-inactive">Oculta</span>'
    }</td>
    <td>
      <div class="row-actions">
        <button class="btn-admin btn-admin-outline" data-zone-edit="${z.id}">Editar</button>
        <button class="btn-admin btn-admin-danger" data-zone-delete="${z.id}">Remover</button>
      </div>
    </td>
  </tr>`;
}

async function loadZones() {
  if (!zonesTableBody) return;
  zonesTableBody.innerHTML = skeletonRows(5, 4);
  const { data, error } = await supabaseClient
    .from("delivery_zones")
    .select("*")
    .order("sort_order")
    .order("id");
  if (error) {
    showAlert(zonesAlert, "Não foi possível carregar as zonas de entrega.");
    zonesTableBody.innerHTML = `<tr><td colspan="5" class="admin-empty">Erro ao carregar.</td></tr>`;
    return;
  }
  zonesCache = data || [];
  zonesTableBody.innerHTML = zonesCache.length
    ? zonesCache.map(zoneRow).join("")
    : `<tr><td colspan="5" class="admin-empty">Nenhuma zona definida. Sem zonas, o checkout não consegue calcular a entrega.</td></tr>`;
}

function openZoneModal(zone) {
  document.getElementById("zoneModalTitle").textContent = zone ? "Editar zona" : "Adicionar zona";
  document.getElementById("zoneId").value = zone?.id || "";
  document.getElementById("zone_name").value = zone?.name || "";
  document.getElementById("zone_price").value = zone?.price ?? "";
  // A new zone goes to the end of the list unless the order is changed.
  document.getElementById("zone_sort_order").value =
    zone?.sort_order ?? (zonesCache.length ? Math.max(...zonesCache.map((z) => Number(z.sort_order || 0))) + 1 : 1);
  document.getElementById("zone_on_request").checked = Boolean(zone?.on_request);
  document.getElementById("zone_active").checked = zone ? Boolean(zone.active) : true;
  document.getElementById("zoneFormAlert").innerHTML = "";
  zoneModal.classList.add("open");
}
const closeZoneModal = () => zoneModal.classList.remove("open");

document.getElementById("newZoneBtn")?.addEventListener("click", () => openZoneModal(null));
document.getElementById("cancelZoneBtn")?.addEventListener("click", closeZoneModal);
zoneModal?.addEventListener("click", (e) => { if (e.target === zoneModal) closeZoneModal(); });

// A price is meaningless when the zone is quoted by hand, so the field is
// disabled rather than left to hold a number nobody will honour.
function syncZonePriceField() {
  const onRequest = document.getElementById("zone_on_request").checked;
  const price = document.getElementById("zone_price");
  price.disabled = onRequest;
  if (onRequest) price.value = "";
}
document.getElementById("zone_on_request")?.addEventListener("change", syncZonePriceField);

zonesTableBody?.addEventListener("click", async (e) => {
  const edit = e.target.closest("[data-zone-edit]");
  if (edit) {
    const zone = zonesCache.find((z) => String(z.id) === edit.dataset.zoneEdit);
    if (zone) { openZoneModal(zone); syncZonePriceField(); }
    return;
  }
  const del = e.target.closest("[data-zone-delete]");
  if (!del) return;
  const zone = zonesCache.find((z) => String(z.id) === del.dataset.zoneDelete);
  if (!zone) return;
  if (!confirm(`Remover a zona "${zone.name}"? Deixa de estar disponível no checkout. Para a esconder temporariamente, edite-a e desmarque "Visível no checkout".`)) return;

  const { error } = await supabaseClient.from("delivery_zones").delete().eq("id", zone.id);
  if (error) return showAlert(zonesAlert, "Não foi possível remover esta zona.");
  await logActivity("delivery_zone_remove", "delivery_zone", zone.id, { name: zone.name });
  showAlert(zonesAlert, "Zona removida.", "success");
  loadZones();
});

document.getElementById("zoneForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("zoneId").value;
  const onRequest = document.getElementById("zone_on_request").checked;
  const rawPrice = document.getElementById("zone_price").value.trim();
  const formAlert = document.getElementById("zoneFormAlert");

  const payload = {
    name: val("zone_name"),
    on_request: onRequest,
    price: onRequest ? 0 : Number(rawPrice || 0),
    sort_order: Number(document.getElementById("zone_sort_order").value || 0),
    active: document.getElementById("zone_active").checked,
  };

  if (!payload.name) {
    formAlert.innerHTML = `<div class="admin-alert admin-alert-error">Indique o nome da zona.</div>`;
    return;
  }
  // A priced zone with no price would silently charge nothing.
  if (!onRequest && rawPrice === "") {
    formAlert.innerHTML = `<div class="admin-alert admin-alert-error">Indique o preço, ou marque "Preço sob consulta".</div>`;
    return;
  }

  const { error } = id
    ? await supabaseClient.from("delivery_zones").update(payload).eq("id", Number(id))
    : await supabaseClient.from("delivery_zones").insert(payload);

  if (error) {
    formAlert.innerHTML = `<div class="admin-alert admin-alert-error">Não foi possível guardar.</div>`;
    return;
  }
  await logActivity(id ? "delivery_zone_update" : "delivery_zone_add", "delivery_zone", id || payload.name, payload);
  closeZoneModal();
  showAlert(zonesAlert, id ? "Zona actualizada." : "Zona adicionada.", "success");
  loadZones();
});

document.getElementById("freeDeliveryForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = document.getElementById("free_delivery_threshold").value.trim();
  const active = document.getElementById("free_delivery_active").checked;
  if (active && (raw === "" || Number(raw) <= 0)) {
    showAlert(zonesAlert, "Indique o valor a partir do qual a entrega é grátis.");
    return;
  }
  await saveSettings(
    {
      free_delivery_threshold: raw === "" ? null : Number(raw),
      free_delivery_active: active,
    },
    active ? "Entrega grátis activada." : "Entrega grátis desactivada.",
    zonesAlert
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
  loadZones();
  loadAdmins();
});
