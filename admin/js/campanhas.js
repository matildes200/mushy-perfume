// Campanhas — the thing that actually applies a discount. The banner is only a
// notice; this is what changes prices.
//
// A campaign is never "on" or "off" by hand: it runs between two dates and the
// storefront works that out for itself. Nothing here has to be remembered.

let campaignsCache = [];
let productsCache = [];
let pickedIds = new Set();

const campaignsAlert = document.getElementById("campaignsAlert");
const campaignsBody = document.querySelector("#campaignsTable tbody");
const archivedBody = document.querySelector("#archivedTable tbody");
const archivedPanel = document.getElementById("archivedPanel");
const campaignModal = document.getElementById("campaignModalOverlay");
const campaignFormAlert = document.getElementById("campaignFormAlert");

const showAlert = (el, msg, type = "error") => {
  el.innerHTML = msg ? `<div class="admin-alert admin-alert-${type}">${escapeHtml(msg)}</div>` : "";
};

const CATEGORY_LABELS = { feminino: "Feminino", masculino: "Masculino", unissex: "Unissexo" };

// Dates are compared as plain days, never as instants: a campaign that ends on
// the 30th is live all of the 30th, wherever the reader happens to be.
const today = () => new Date().toISOString().slice(0, 10);

function campaignState(c) {
  if (c.archived) return { label: "Arquivada", cls: "pill" };
  const now = today();
  if (c.start_date > now) return { label: "Agendada", cls: "pill pill-pending" };
  if (c.end_date < now) return { label: "Terminada", cls: "pill pill-inactive" };
  return { label: "A decorrer", cls: "pill pill-active" };
}

const discountLabel = (c) =>
  c.discount_type === "percentage"
    ? `${Number(c.discount_value)}%`
    : `${money(c.discount_value)}`;

// What a campaign charges for a product, before the shop's own discount is
// considered. Mirrors the storefront exactly.
function campaignPrice(basePrice, type, value) {
  const price = Number(basePrice) || 0;
  return type === "percentage"
    ? Math.round(price * (1 - Number(value || 0) / 100))
    : Math.max(0, price - Number(value || 0));
}

function targetSummary(c) {
  const parts = [];
  if (c.target_all) parts.push("Todos");
  (c.target_categories || []).forEach((cat) => parts.push(CATEGORY_LABELS[cat] || cat));
  const picked = Number(c.picked_count || 0);
  if (picked) parts.push(`${picked} à mão`);
  return parts.length ? parts.join(" · ") : "—";
}

// ------------------------------------------------------------------ list ---

function campaignRow(c) {
  const state = campaignState(c);
  return `<tr>
    <td class="wrap"><strong>${escapeHtml(c.name)}</strong>
      <span class="variant-pct">${escapeHtml(targetSummary(c))}</span></td>
    <td>${discountLabel(c)}</td>
    <td class="wrap">${formatDateShort(c.start_date)} – ${formatDateShort(c.end_date)}</td>
    <td>${c.affected == null ? "—" : c.affected}</td>
    <td>${c.order_count || 0}</td>
    <td>${c.revenue ? money(c.revenue) : "—"}</td>
    <td><span class="${state.cls}">${state.label}</span></td>
    <td>
      <div class="row-actions">
        <button class="btn-admin btn-admin-outline" data-edit="${c.id}">Editar</button>
        <button class="btn-admin btn-admin-danger" data-archive="${c.id}">Arquivar</button>
      </div>
    </td>
  </tr>`;
}

// The dates are stored as plain dates, so they are formatted without going
// through a timezone that could shift them a day.
function formatDateShort(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

async function loadCampaigns() {
  campaignsBody.innerHTML = skeletonRows(8, 3);

  const [campRes, prodRes, linkRes, statsRes] = await Promise.all([
    supabaseClient.from("campaigns").select("*").order("start_date", { ascending: false }),
    supabaseClient
      .from("products")
      .select("id, name, category, price, discount_percent, amostra_enabled, amostra_price")
      .eq("archived", false)
      .order("name"),
    supabaseClient.from("campaign_products").select("campaign_id, product_id"),
    // Orders and revenue per campaign, counted from the campaign recorded on
    // each order line rather than on the order, so a basket spanning two
    // campaigns is credited to both correctly and to neither wholly.
    supabaseClient.rpc("campaign_stats"),
  ]);

  if (campRes.error) {
    showAlert(campaignsAlert, "Não foi possível carregar as campanhas.");
    campaignsBody.innerHTML = `<tr><td colspan="8" class="admin-empty">Erro ao carregar.</td></tr>`;
    return;
  }

  productsCache = prodRes.data || [];
  const picks = new Map();
  (linkRes.data || []).forEach((l) => {
    if (!picks.has(l.campaign_id)) picks.set(l.campaign_id, []);
    picks.get(l.campaign_id).push(l.product_id);
  });

  const stats = new Map((statsRes.data || []).map((s) => [Number(s.campaign_id), s]));

  campaignsCache = (campRes.data || []).map((c) => {
    const picked = picks.get(c.id) || [];
    const s = stats.get(Number(c.id));
    return {
      ...c,
      picked,
      picked_count: picked.length,
      affected: resolveLocally(c.target_all, c.target_categories || [], picked).length,
      order_count: s?.order_count ?? 0,
      revenue: s?.revenue ?? 0,
    };
  });

  const live = campaignsCache.filter((c) => !c.archived);
  const archived = campaignsCache.filter((c) => c.archived);

  campaignsBody.innerHTML = live.length
    ? live.map(campaignRow).join("")
    : `<tr><td colspan="8" class="admin-empty">Nenhuma campanha. Crie uma para aplicar um desconto a vários produtos de uma vez.</td></tr>`;

  archivedPanel.hidden = archived.length === 0;
  archivedBody.innerHTML = archived
    .map(
      (c) => `<tr>
        <td class="wrap">${escapeHtml(c.name)}</td>
        <td>${discountLabel(c)}</td>
        <td class="wrap">${formatDateShort(c.start_date)} – ${formatDateShort(c.end_date)}</td>
        <td>${c.order_count || 0}</td>
        <td>${c.revenue ? money(c.revenue) : "—"}</td>
        <td><div class="row-actions">
          <button class="btn-admin btn-admin-outline" data-restore="${c.id}">Repor</button>
        </div></td>
      </tr>`
    )
    .join("");
}

// The same union the database does, computed here so the preview can react as
// the form is typed rather than after every keystroke round trip.
function resolveLocally(all, categories, picked) {
  const cats = new Set(categories || []);
  const pick = new Set((picked || []).map(Number));
  return productsCache.filter((p) => all || cats.has(p.category) || pick.has(p.id));
}

// ------------------------------------------------------------------ form ---

function openCampaignModal(c) {
  document.getElementById("campaignModalTitle").textContent = c ? "Editar campanha" : "Nova campanha";
  document.getElementById("campaignId").value = c?.id || "";
  document.getElementById("campaign_name").value = c?.name || "";
  document.getElementById("campaign_discount_type").value = c?.discount_type || "percentage";
  document.getElementById("campaign_discount_value").value = c?.discount_value ?? "";
  document.getElementById("campaign_start").value = c?.start_date || today();
  document.getElementById("campaign_end").value = c?.end_date || "";
  document.getElementById("target_all").checked = Boolean(c?.target_all);
  document.getElementById("applies_to_amostras").checked = Boolean(c?.applies_to_amostras);
  document.getElementById("allow_coupons").checked = Boolean(c?.allow_coupons);

  const cats = new Set(c?.target_categories || []);
  document.querySelectorAll(".target-cat").forEach((el) => { el.checked = cats.has(el.value); });

  pickedIds = new Set((c?.picked || []).map(Number));
  document.getElementById("productSearch").value = "";
  renderPicker();
  showAlert(campaignFormAlert, "");
  syncTargetState();
  renderPreview();
  campaignModal.classList.add("open");
}
const closeCampaignModal = () => campaignModal.classList.remove("open");

// "Todos os produtos" makes the other two selectors meaningless, so they are
// disabled rather than left to imply something they cannot change.
function syncTargetState() {
  const all = document.getElementById("target_all").checked;
  document.getElementById("categoryWrap").classList.toggle("is-disabled", all);
  document.getElementById("pickWrap").classList.toggle("is-disabled", all);
  document.querySelectorAll(".target-cat").forEach((el) => { el.disabled = all; });
  document.getElementById("productSearch").disabled = all;
  document.querySelectorAll("#productPicker input").forEach((el) => { el.disabled = all; });
}

function renderPicker() {
  const q = normalise(document.getElementById("productSearch").value);
  const list = document.getElementById("productPicker");
  const items = productsCache.filter((p) => !q || normalise(p.name).includes(q));
  list.innerHTML = items.length
    ? items
        .map(
          (p) => `<label class="picker-item">
        <input type="checkbox" value="${p.id}" ${pickedIds.has(p.id) ? "checked" : ""}>
        <span>${escapeHtml(p.name)}</span>
        <span class="picker-meta">${CATEGORY_LABELS[p.category] || p.category} · ${money(p.price)}</span>
      </label>`
        )
        .join("")
    : `<p class="admin-empty">Nenhum perfume corresponde a "${escapeHtml(document.getElementById("productSearch").value)}".</p>`;
  syncTargetState();
}

// Escapes rather than literal combining marks: searching for "lumiere" has to
// find "Lumière", and a range typed as raw diacritics is too easy to mangle in
// an editor to trust.
const normalise = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function currentTargeting() {
  return {
    all: document.getElementById("target_all").checked,
    categories: Array.from(document.querySelectorAll(".target-cat:checked")).map((el) => el.value),
    picked: Array.from(pickedIds),
  };
}

// ---------------------------------------------------------------- preview ---
// The point of this is to catch a mistake before it is live. Two things it has
// to surface: how many products are affected, and any product whose price would
// go UP because it already carries a bigger manual discount than the campaign.

function renderPreview() {
  const box = document.getElementById("previewBox");
  const { all, categories, picked } = currentTargeting();
  const type = document.getElementById("campaign_discount_type").value;
  const value = Number(document.getElementById("campaign_discount_value").value);

  const affected = resolveLocally(all, categories, picked);
  if (!affected.length) {
    box.innerHTML = `<p class="admin-empty">Nenhum produto seleccionado.</p>`;
    return;
  }
  if (!value) {
    box.innerHTML = `<p class="admin-empty">${affected.length} produto${affected.length === 1 ? "" : "s"} seleccionado${affected.length === 1 ? "" : "s"}. Indique o desconto para ver os preços.</p>`;
    return;
  }

  const rows = affected.map((p) => {
    // What the customer pays today, manual discount included.
    const before = Math.round(Number(p.price) * (1 - (Number(p.discount_percent) || 0) / 100));
    // The campaign replaces the manual discount rather than stacking on it.
    const after = campaignPrice(p.price, type, value);
    return { p, before, after, worse: after > before };
  });

  const worse = rows.filter((r) => r.worse);
  const shown = [...worse, ...rows.filter((r) => !r.worse)].slice(0, 8);

  box.innerHTML =
    `<div class="preview-head">
       <strong>${affected.length}</strong> produto${affected.length === 1 ? "" : "s"} afectado${affected.length === 1 ? "" : "s"}
     </div>` +
    (worse.length
      ? `<div class="admin-alert admin-alert-error">
           ${worse.length} produto${worse.length === 1 ? "" : "s"} ficaria${worse.length === 1 ? "" : "m"} <strong>mais caro${worse.length === 1 ? "" : "s"}</strong>:
           já tem${worse.length === 1 ? "" : "êm"} um desconto manual maior do que esta campanha.
           Retire-o${worse.length === 1 ? "" : "s"} da campanha, ou aumente o desconto.
         </div>`
      : "") +
    `<table class="admin-table preview-table"><thead>
       <tr><th>Perfume</th><th>Agora</th><th>Na campanha</th></tr></thead><tbody>` +
    shown
      .map(
        (r) => `<tr class="${r.worse ? "preview-worse" : ""}">
        <td class="wrap">${escapeHtml(r.p.name)}</td>
        <td>${money(r.before)}</td>
        <td>${money(r.after)} ${r.worse ? "&uarr;" : ""}</td>
      </tr>`
      )
      .join("") +
    `</tbody></table>` +
    (affected.length > shown.length
      ? `<p class="form-hint">…e mais ${affected.length - shown.length}.</p>`
      : "");
}

// Anything that changes the targeting or the discount redraws the preview.
["target_all", "campaign_discount_type", "campaign_discount_value", "campaign_start", "campaign_end"]
  .forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => { syncTargetState(); renderPreview(); });
    document.getElementById(id)?.addEventListener("change", () => { syncTargetState(); renderPreview(); });
  });
document.querySelectorAll(".target-cat").forEach((el) =>
  el.addEventListener("change", renderPreview)
);
document.getElementById("productSearch")?.addEventListener("input", renderPicker);
document.getElementById("productPicker")?.addEventListener("change", (e) => {
  if (e.target.tagName !== "INPUT") return;
  const id = Number(e.target.value);
  if (e.target.checked) pickedIds.add(id);
  else pickedIds.delete(id);
  renderPreview();
});

// ----------------------------------------------------------------- save ---

document.getElementById("newCampaignBtn")?.addEventListener("click", () => openCampaignModal(null));
document.getElementById("cancelCampaignBtn")?.addEventListener("click", closeCampaignModal);
campaignModal?.addEventListener("click", (e) => { if (e.target === campaignModal) closeCampaignModal(); });

document.getElementById("campaignForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById("saveCampaignBtn");
  const id = document.getElementById("campaignId").value;
  const { all, categories, picked } = currentTargeting();

  const payload = {
    name: document.getElementById("campaign_name").value.trim(),
    discount_type: document.getElementById("campaign_discount_type").value,
    discount_value: Number(document.getElementById("campaign_discount_value").value),
    start_date: document.getElementById("campaign_start").value,
    end_date: document.getElementById("campaign_end").value,
    target_all: all,
    target_categories: all ? [] : categories,
    applies_to_amostras: document.getElementById("applies_to_amostras").checked,
    allow_coupons: document.getElementById("allow_coupons").checked,
  };

  if (!payload.name) return showAlert(campaignFormAlert, "Dê um nome à campanha.");
  if (!payload.discount_value) return showAlert(campaignFormAlert, "Indique o desconto.");
  if (payload.discount_type === "percentage" && payload.discount_value > 100) {
    return showAlert(campaignFormAlert, "Um desconto em percentagem não pode passar dos 100%.");
  }
  if (!payload.start_date || !payload.end_date) {
    return showAlert(campaignFormAlert, "Indique as datas de início e de fim.");
  }
  if (payload.end_date < payload.start_date) {
    return showAlert(campaignFormAlert, "A data de fim não pode ser anterior à de início.");
  }
  if (!all && !categories.length && !picked.length) {
    return showAlert(campaignFormAlert, "Escolha pelo menos um produto, uma categoria, ou todos os produtos.");
  }

  saveBtn.disabled = true;

  // A product may only be in one campaign at a time. The check runs on the
  // database, against the real product set, rather than on what the form thinks
  // it selected.
  const { data: clashes } = await supabaseClient.rpc("campaign_conflicts", {
    p_campaign_id: id ? Number(id) : null,
    p_start: payload.start_date,
    p_end: payload.end_date,
    p_all: all,
    p_categories: all ? [] : categories,
    p_product_ids: all ? [] : picked,
  });

  if (clashes?.length) {
    const names = [...new Set(clashes.map((c) => c.campaign_name))].join(", ");
    const items = [...new Set(clashes.map((c) => c.product_name))];
    const shown = items.slice(0, 4).join(", ") + (items.length > 4 ? ` e mais ${items.length - 4}` : "");
    const ok = confirm(
      `${items.length} produto${items.length === 1 ? "" : "s"} já está${items.length === 1 ? "" : "ão"} noutra campanha ` +
        `a decorrer nas mesmas datas (${names}):\n\n${shown}\n\n` +
        `Um produto só deve estar numa campanha de cada vez. Guardar mesmo assim?`
    );
    if (!ok) { saveBtn.disabled = false; return; }
  }

  const { data: saved, error } = id
    ? await supabaseClient.from("campaigns").update(payload).eq("id", Number(id)).select().single()
    : await supabaseClient.from("campaigns").insert(payload).select().single();

  if (error) {
    saveBtn.disabled = false;
    return showAlert(campaignFormAlert, "Não foi possível guardar a campanha.");
  }

  // Hand-picked products are replaced wholesale: simpler to reason about than
  // working out which were added and which removed.
  const campaignId = saved.id;
  await supabaseClient.from("campaign_products").delete().eq("campaign_id", campaignId);
  if (!all && picked.length) {
    const { error: linkError } = await supabaseClient
      .from("campaign_products")
      .insert(picked.map((pid) => ({ campaign_id: campaignId, product_id: pid })));
    if (linkError) {
      saveBtn.disabled = false;
      return showAlert(campaignFormAlert, "A campanha foi guardada, mas os produtos escolhidos à mão não. Edite-a e tente de novo.");
    }
  }

  await logActivity(id ? "campaign_update" : "campaign_add", "campaign", campaignId, payload);
  saveBtn.disabled = false;
  closeCampaignModal();
  showAlert(campaignsAlert, id ? "Campanha actualizada." : "Campanha criada.", "success");
  loadCampaigns();
});

// ------------------------------------------------------- archive/restore ---

campaignsBody?.addEventListener("click", async (e) => {
  const edit = e.target.closest("[data-edit]");
  if (edit) {
    const c = campaignsCache.find((x) => String(x.id) === edit.dataset.edit);
    if (c) openCampaignModal(c);
    return;
  }
  const archive = e.target.closest("[data-archive]");
  if (!archive) return;
  const c = campaignsCache.find((x) => String(x.id) === archive.dataset.archive);
  if (!c) return;
  // Archived, never deleted: what ran and when stays on the record.
  if (!confirm(`Arquivar "${c.name}"? Deixa de aplicar desconto, mas continua visível no histórico.`)) return;
  const { error } = await supabaseClient.from("campaigns").update({ archived: true }).eq("id", c.id);
  if (error) return showAlert(campaignsAlert, "Não foi possível arquivar esta campanha.");
  await logActivity("campaign_archive", "campaign", c.id, { name: c.name });
  showAlert(campaignsAlert, "Campanha arquivada.", "success");
  loadCampaigns();
});

archivedBody?.addEventListener("click", async (e) => {
  const restore = e.target.closest("[data-restore]");
  if (!restore) return;
  const c = campaignsCache.find((x) => String(x.id) === restore.dataset.restore);
  if (!c) return;
  const { error } = await supabaseClient.from("campaigns").update({ archived: false }).eq("id", c.id);
  if (error) return showAlert(campaignsAlert, "Não foi possível repor esta campanha.");
  await logActivity("campaign_restore", "campaign", c.id, { name: c.name });
  showAlert(campaignsAlert, "Campanha reposta.", "success");
  loadCampaigns();
});

document.addEventListener("admin:ready", loadCampaigns);
