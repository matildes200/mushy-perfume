let couponsCache = [];
const couponsAlert = document.getElementById("couponsAlert");
const couponsTableBody = document.querySelector("#couponsTable tbody");
const couponModalOverlay = document.getElementById("couponModalOverlay");
const couponModalTitle = document.getElementById("couponModalTitle");
const couponForm = document.getElementById("couponForm");
const couponFormAlert = document.getElementById("couponFormAlert");

const textFields = ["name", "code", "discount_type", "start_date", "end_date"];
const numberFields = ["discount_value", "min_order_value"];

function showAlert(el, message, type = "error") {
  el.innerHTML = message ? `<div class="admin-alert admin-alert-${type === "error" ? "error" : "success"}">${escapeHtml(message)}</div>` : "";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function couponStatus(c) {
  const today = todayStr();
  if (c.active === false) return { label: "Inativo", cls: "pill-inactive" };
  if (c.end_date && c.end_date < today) return { label: "Expirado", cls: "pill-inactive" };
  if (c.max_uses != null && c.times_used >= c.max_uses) return { label: "Esgotado", cls: "pill-inactive" };
  if (c.start_date && c.start_date > today) return { label: "Agendado", cls: "pill-low" };
  return { label: "Ativo", cls: "pill-active" };
}

function formatDiscount(c) {
  return c.discount_type === "percentage" ? `${c.discount_value}%` : money(c.discount_value);
}

function formatValidity(c) {
  if (!c.start_date && !c.end_date) return "Sempre válido";
  const start = c.start_date ? new Date(c.start_date).toLocaleDateString("pt-PT") : "—";
  const end = c.end_date ? new Date(c.end_date).toLocaleDateString("pt-PT") : "sem fim";
  return `${start} – ${end}`;
}

function openModal(coupon) {
  couponForm.reset();
  showAlert(couponFormAlert, "");
  document.getElementById("couponId").value = coupon?.id || "";
  couponModalTitle.textContent = coupon ? "Editar cupom" : "Novo cupom";

  document.getElementById("name").value = coupon?.name || "";
  document.getElementById("code").value = coupon?.code || "";
  document.getElementById("discount_type").value = coupon?.discount_type || "percentage";
  document.getElementById("discount_value").value = coupon?.discount_value ?? "";
  document.getElementById("start_date").value = coupon?.start_date || "";
  document.getElementById("end_date").value = coupon?.end_date || "";
  document.getElementById("min_order_value").value = coupon?.min_order_value ?? 0;
  document.getElementById("max_uses").value = coupon?.max_uses ?? "";
  document.getElementById("active").checked = coupon ? Boolean(coupon.active) : true;

  couponModalOverlay.classList.add("open");
}

function closeModal() {
  couponModalOverlay.classList.remove("open");
}

function renderRow(c) {
  const status = couponStatus(c);
  const usesLabel = c.max_uses != null ? `${c.times_used} / ${c.max_uses}` : `${c.times_used}`;
  return `
    <tr data-id="${c.id}">
      <td><strong>${escapeHtml(c.code)}</strong></td>
      <td class="wrap">${escapeHtml(c.name)}</td>
      <td>${formatDiscount(c)}</td>
      <td>${formatValidity(c)}</td>
      <td>${c.min_order_value ? money(c.min_order_value) : "—"}</td>
      <td>${usesLabel}</td>
      <td><span class="pill ${status.cls}">${status.label}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn-icon" data-edit="${c.id}" aria-label="Editar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          </button>
          <button class="btn-icon danger" data-delete="${c.id}" aria-label="Remover">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

async function loadCoupons() {
  const { data, error } = await supabaseClient.from("coupons").select("*").order("created_at", { ascending: false });
  if (error) {
    showAlert(couponsAlert, "Não foi possível carregar os cupons. Confirme se a migração do banco de dados foi executada.");
    couponsTableBody.innerHTML = `<tr><td colspan="8" class="admin-empty">Erro ao carregar.</td></tr>`;
    return;
  }
  couponsCache = data || [];

  const today = todayStr();
  const activeCount = couponsCache.filter((c) => couponStatus(c).label === "Ativo").length;
  const expiredCount = couponsCache.filter((c) => c.end_date && c.end_date < today).length;
  const totalUses = couponsCache.reduce((sum, c) => sum + (c.times_used || 0), 0);

  document.getElementById("couponStats").innerHTML = `
    <div class="stat-card"><span>Total de cupons</span><strong>${couponsCache.length}</strong></div>
    <div class="stat-card"><span>Ativos</span><strong>${activeCount}</strong></div>
    <div class="stat-card"><span>Expirados</span><strong>${expiredCount}</strong></div>
    <div class="stat-card"><span>Usos no total</span><strong>${totalUses}</strong></div>
  `;

  couponsTableBody.innerHTML = couponsCache.length
    ? couponsCache.map(renderRow).join("")
    : `<tr><td colspan="8" class="admin-empty">Nenhum cupom criado ainda.</td></tr>`;
}

document.getElementById("newCouponBtn").addEventListener("click", () => openModal(null));
document.getElementById("cancelCouponBtn").addEventListener("click", closeModal);
couponModalOverlay.addEventListener("click", (e) => { if (e.target === couponModalOverlay) closeModal(); });

couponsTableBody.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit]");
  if (editBtn) {
    const coupon = couponsCache.find((c) => c.id === Number(editBtn.dataset.edit));
    openModal(coupon);
    return;
  }

  const deleteBtn = e.target.closest("[data-delete]");
  if (deleteBtn) {
    const id = Number(deleteBtn.dataset.delete);
    const coupon = couponsCache.find((c) => c.id === id);
    if (!confirm(`Remover o cupom "${coupon?.code}"? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabaseClient.from("coupons").delete().eq("id", id);
    if (error) {
      showAlert(couponsAlert, "Não foi possível remover o cupom.");
      return;
    }
    showAlert(couponsAlert, "Cupom removido.", "success");
    loadCoupons();
  }
});

couponForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById("saveCouponBtn");
  saveBtn.disabled = true;
  showAlert(couponFormAlert, "");

  const id = document.getElementById("couponId").value;
  const payload = {
    name: document.getElementById("name").value.trim(),
    code: document.getElementById("code").value.trim().toUpperCase(),
    discount_type: document.getElementById("discount_type").value,
    discount_value: Number(document.getElementById("discount_value").value) || 0,
    start_date: document.getElementById("start_date").value || null,
    end_date: document.getElementById("end_date").value || null,
    min_order_value: Number(document.getElementById("min_order_value").value) || 0,
    max_uses: document.getElementById("max_uses").value ? Number(document.getElementById("max_uses").value) : null,
    active: document.getElementById("active").checked,
  };

  if (payload.discount_type === "percentage" && payload.discount_value > 100) {
    showAlert(couponFormAlert, "O desconto percentual não pode passar de 100%.");
    saveBtn.disabled = false;
    return;
  }

  const query = id
    ? supabaseClient.from("coupons").update(payload).eq("id", id)
    : supabaseClient.from("coupons").insert(payload);

  const { error } = await query;
  saveBtn.disabled = false;

  if (error) {
    showAlert(couponFormAlert, error.code === "23505" ? "Já existe um cupom com esse código." : "Não foi possível salvar. Verifique os campos e tente novamente.");
    return;
  }

  closeModal();
  showAlert(couponsAlert, id ? "Cupom atualizado." : "Cupom criado.", "success");
  loadCoupons();
});

document.addEventListener("admin:ready", loadCoupons);
