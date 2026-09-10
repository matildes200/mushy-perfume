// Order detail — the page where the payment decision is actually made.
//
// There is no payment gateway: someone has to read the comprovativo, decide
// whether the money arrived, and only then release the shipment. Everything
// needed for that decision is on this one page, so nothing here navigates away
// mid-decision.

const orderId = new URLSearchParams(window.location.search).get("id");

let order = null;
let receiptSignedUrl = null;

const alertEl = document.getElementById("orderAlert");
const showAlert = (msg, type = "error") => {
  alertEl.innerHTML = msg ? `<div class="admin-alert admin-alert-${type}">${escapeHtml(msg)}</div>` : "";
};

// Statuses a person can pick by hand. Payment confirmation and rejection go
// through the two decision buttons instead, so they always record a reason and
// a history entry rather than being a silent dropdown change.
const MANUAL_STATUSES = ["pagamento_confirmado", "em_preparacao", "enviado", "entregue", "cancelado"];

// ---------------------------------------------------------------- render ---

function renderHeader() {
  document.getElementById("orderTitle").textContent = `Pedido ${orderCode(order.id)}`;
  document.getElementById("orderSubtitle").textContent =
    `${formatDate(order.created_at)} · ${order.payment_method || "método não indicado"}`;
  document.getElementById("currentStatus").innerHTML = statusPill(order.status);
}

function renderClient() {
  const rows = [
    ["Nome", order.customer_name],
    ["E-mail", order.customer_email],
    ["Telefone", order.customer_phone],
    ["Morada", [order.customer_address || order.shipping_address, order.customer_city || order.shipping_city].filter(Boolean).join(", ")],
  ];
  document.getElementById("orderClient").innerHTML = rows
    .map(([k, v]) => `<div><span>${k}</span><strong>${escapeHtml(v || "—")}</strong></div>`)
    .join("");
}

function renderItems() {
  const items = order.items || [];
  document.getElementById("orderItems").innerHTML = items.length
    ? items
        .map((it) => {
          const img = it.image
            ? `<img src="../${escapeHtml(String(it.image).replace(/^\.\.\//, ""))}" alt="">`
            : `<span class="order-item-noimg"></span>`;
          return `<div class="order-item">
            <span class="order-item-thumb">${img}</span>
            <span class="order-item-name">${escapeHtml(it.name)}</span>
            <span class="order-item-qty">${it.qty} ×</span>
            <span class="order-item-price">${money(it.price)}</span>
            <span class="order-item-line">${money(it.price * it.qty)}</span>
          </div>`;
        })
        .join("")
    : `<p class="admin-empty">Sem itens registados.</p>`;

  // The stored total is already net of the discount, so the subtotal is
  // reconstructed from the lines rather than trusted from a column.
  const subtotal = items.reduce((sum, it) => sum + Number(it.price) * Number(it.qty), 0);
  const discount = Number(order.discount || 0);
  const rows = [
    ["Subtotal", money(subtotal)],
    order.coupon_code ? ["Cupão aplicado", escapeHtml(order.coupon_code)] : null,
    discount ? ["Desconto", `− ${money(discount)}`] : null,
    Number(order.delivery_fee) ? ["Custo de envio", money(order.delivery_fee)] : null,
  ].filter(Boolean);

  document.getElementById("orderTotals").innerHTML =
    rows.map(([k, v]) => `<div class="total-row"><span>${k}</span><span>${v}</span></div>`).join("") +
    `<div class="total-row total-final"><span>Total</span><span>${money(order.total)}</span></div>`;
}

// The comprovativo is shown inline. Receipts live in a private bucket, so the
// page needs a signed URL — a plain path would 404.
async function renderReceipt() {
  const view = document.getElementById("receiptView");
  if (!order.receipt_url) {
    view.innerHTML = `<p class="admin-empty">Nenhum comprovativo enviado ainda.</p>`;
    return;
  }
  const { data, error } = await supabaseClient.storage.from("receipts").createSignedUrl(order.receipt_url, 3600);
  if (error || !data?.signedUrl) {
    view.innerHTML = `<p class="admin-empty">Não foi possível carregar o comprovativo.</p>`;
    return;
  }
  receiptSignedUrl = data.signedUrl;
  const isPdf = /\.pdf($|\?)/i.test(order.receipt_url);
  view.innerHTML = isPdf
    ? `<embed src="${receiptSignedUrl}" type="application/pdf" class="receipt-pdf">
       <div class="receipt-actions"><a class="btn-admin btn-admin-outline" href="${receiptSignedUrl}" target="_blank" rel="noopener">Abrir em separador novo</a></div>`
    : `<button type="button" class="receipt-img-btn" id="receiptZoomBtn" title="Clique para ampliar">
         <img src="${receiptSignedUrl}" alt="Comprovativo enviado pelo cliente">
       </button>
       <div class="receipt-actions"><span class="panel-hint">Clique na imagem para ampliar.</span></div>`;
}

function renderHistory(rows) {
  const el = document.getElementById("orderHistory");
  if (!rows || !rows.length) {
    el.innerHTML = `<li class="admin-empty">Ainda sem alterações registadas.</li>`;
    return;
  }
  el.innerHTML = rows
    .map(
      (h) => `<li class="history-row">
        <span class="history-when">${formatDate(h.created_at)}</span>
        <span class="history-what">
          ${h.from_status ? `${escapeHtml(statusLabel(h.from_status))} → ` : ""}<strong>${escapeHtml(statusLabel(h.to_status))}</strong>
          ${h.note ? `<em>${escapeHtml(h.note)}</em>` : ""}
        </span>
        <span class="history-who">${escapeHtml(h.changed_by_email || "—")}</span>
      </li>`
    )
    .join("");
}

function renderStatusControls() {
  const select = document.getElementById("statusSelect");
  select.innerHTML = ORDER_STATUSES.filter((s) => MANUAL_STATUSES.includes(s.value) || s.value === order.status)
    .map((s) => `<option value="${s.value}" ${s.value === order.status ? "selected" : ""}>${s.label}</option>`)
    .join("");
  toggleReasonField();

  // The decision bar only appears when there is actually a decision to make.
  const pending = order.status === "comprovativo_recebido";
  document.getElementById("decisionBar").hidden = !pending;
}

function toggleReasonField() {
  const wrap = document.getElementById("statusReasonWrap");
  wrap.hidden = document.getElementById("statusSelect").value !== "cancelado";
}

// ------------------------------------------------------------- data load ---

async function loadHistory() {
  const { data } = await supabaseClient
    .from("order_status_history")
    .select("from_status, to_status, note, changed_by_email, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  renderHistory(data);
}

async function loadOrder() {
  if (!orderId) {
    showAlert("Pedido não indicado.");
    return;
  }
  const { data, error } = await supabaseClient.from("orders").select("*").eq("id", orderId).single();
  if (error || !data) {
    showAlert("Não foi possível carregar este pedido.");
    return;
  }
  order = data;
  renderHeader();
  renderClient();
  renderItems();
  renderStatusControls();
  document.getElementById("adminNotes").value = order.admin_notes || "";
  document.getElementById("odCourier").value = order.courier || "";
  document.getElementById("odTracking").value = order.tracking_number || "";
  await renderReceipt();
  await loadHistory();
}

// --------------------------------------------------------------- actions ---

// Single path for every status change, so the history and the audit log can
// never be bypassed by a caller that forgot to write them.
async function changeStatus(next, note) {
  const previous = order.status;
  if (next === previous && !note) return true;

  const patch = { status: next };
  if (next === "cancelado") patch.cancel_reason = note || null;

  const { data, error } = await supabaseClient.from("orders").update(patch).eq("id", order.id).select().single();
  if (error) {
    showAlert("Não foi possível guardar o novo estado.");
    return false;
  }
  order = data;

  const { data: { user } } = await supabaseClient.auth.getUser();
  await supabaseClient.from("order_status_history").insert({
    order_id: order.id,
    from_status: previous,
    to_status: next,
    note: note || null,
    changed_by: user?.id || null,
    changed_by_email: user?.email || null,
  });
  await logActivity("order_status_change", "order", order.id, { from: previous, to: next, note: note || null });

  renderHeader();
  renderStatusControls();
  await loadHistory();
  return true;
}

document.getElementById("statusSelect").addEventListener("change", toggleReasonField);

document.getElementById("saveStatusBtn").addEventListener("click", async (e) => {
  const next = document.getElementById("statusSelect").value;
  const reason = document.getElementById("statusReason").value.trim();
  if (next === "cancelado" && !reason) {
    showAlert("Indique o motivo do cancelamento.");
    return;
  }
  e.target.disabled = true;
  const ok = await changeStatus(next, next === "cancelado" ? reason : null);
  e.target.disabled = false;
  if (ok) showAlert("Estado actualizado.", "success");
});

document.getElementById("confirmPaymentBtn").addEventListener("click", async (e) => {
  e.target.disabled = true;
  const ok = await changeStatus("pagamento_confirmado", "Comprovativo validado.");
  e.target.disabled = false;
  if (ok) showAlert("Pagamento confirmado. O pedido pode seguir para preparação.", "success");
});

// --- rejection: mandatory reason, recorded and sent to the client ---
const rejectModal = document.getElementById("rejectModal");
document.getElementById("rejectReceiptBtn").addEventListener("click", () => {
  document.getElementById("rejectReason").value = "";
  document.getElementById("rejectAlert").innerHTML = "";
  rejectModal.classList.add("open");
});
document.getElementById("cancelRejectBtn").addEventListener("click", () => rejectModal.classList.remove("open"));
rejectModal.addEventListener("click", (e) => { if (e.target === rejectModal) rejectModal.classList.remove("open"); });

document.getElementById("confirmRejectBtn").addEventListener("click", async (e) => {
  const reason = document.getElementById("rejectReason").value.trim();
  if (!reason) {
    document.getElementById("rejectAlert").innerHTML =
      `<div class="admin-alert admin-alert-error">Indique o motivo da rejeição.</div>`;
    return;
  }
  e.target.disabled = true;

  // Back to "aguarda pagamento": the client has to send a valid comprovativo.
  const { error } = await supabaseClient
    .from("orders")
    .update({ receipt_rejected_reason: reason })
    .eq("id", order.id);
  if (error) {
    document.getElementById("rejectAlert").innerHTML =
      `<div class="admin-alert admin-alert-error">Não foi possível guardar a rejeição.</div>`;
    e.target.disabled = false;
    return;
  }
  const ok = await changeStatus("aguarda_pagamento", `Comprovativo rejeitado: ${reason}`);
  e.target.disabled = false;
  rejectModal.classList.remove("open");
  if (ok) {
    // The client is told by e-mail. No provider is wired up yet, so this opens
    // the admin's own mail client with the message ready rather than silently
    // doing nothing and leaving the customer waiting.
    notifyClientOfRejection(reason);
    showAlert("Comprovativo rejeitado. O pedido voltou a aguardar pagamento.", "success");
  }
});

function notifyClientOfRejection(reason) {
  if (!order.customer_email) return;
  const subject = `Pedido ${orderCode(order.id)} — comprovativo por confirmar`;
  const body =
    `Olá ${order.customer_name || ""},\n\n` +
    `Não conseguimos confirmar o comprovativo do seu pedido ${orderCode(order.id)}.\n\n` +
    `Motivo: ${reason}\n\n` +
    `Assim que nos enviar um comprovativo válido, seguimos com a preparação do seu pedido.\n\n` +
    `Obrigado,\nMushy Parfum`;
  window.open(
    `mailto:${encodeURIComponent(order.customer_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    "_blank"
  );
}

// --- internal notes and delivery ---
document.getElementById("saveNotesBtn").addEventListener("click", async (e) => {
  e.target.disabled = true;
  const notes = document.getElementById("adminNotes").value;
  const { error } = await supabaseClient.from("orders").update({ admin_notes: notes }).eq("id", order.id);
  e.target.disabled = false;
  if (error) return showAlert("Não foi possível guardar as notas.");
  order.admin_notes = notes;
  await logActivity("order_notes", "order", order.id);
  showAlert("Notas guardadas.", "success");
});

document.getElementById("saveDeliveryBtn").addEventListener("click", async (e) => {
  e.target.disabled = true;
  const patch = {
    courier: document.getElementById("odCourier").value.trim(),
    tracking_number: document.getElementById("odTracking").value.trim(),
  };
  const { error } = await supabaseClient.from("orders").update(patch).eq("id", order.id);
  e.target.disabled = false;
  if (error) return showAlert("Não foi possível guardar os dados de entrega.");
  Object.assign(order, patch);
  await logActivity("order_delivery", "order", order.id, patch);
  showAlert("Dados de entrega guardados.", "success");
});

// --- comprovativo zoom ---
const receiptZoom = document.getElementById("receiptZoom");
document.getElementById("receiptView").addEventListener("click", (e) => {
  if (!e.target.closest("#receiptZoomBtn") || !receiptSignedUrl) return;
  document.getElementById("receiptZoomBody").innerHTML =
    `<img src="${receiptSignedUrl}" alt="Comprovativo ampliado" class="receipt-zoom-img">`;
  receiptZoom.classList.add("open");
});
document.getElementById("closeReceiptZoom").addEventListener("click", () => receiptZoom.classList.remove("open"));
receiptZoom.addEventListener("click", (e) => { if (e.target === receiptZoom) receiptZoom.classList.remove("open"); });

// --- delivery note ---
// Built as a standalone document rather than print-styling this page: the
// admin chrome, the comprovativo and the action buttons have no business on a
// note that goes in the parcel.
document.getElementById("printNoteBtn").addEventListener("click", () => {
  if (!order) return;
  const items = (order.items || [])
    .map((it) => `<tr><td>${escapeHtml(it.name)}</td><td>${it.qty}</td><td>${money(it.price)}</td><td>${money(it.price * it.qty)}</td></tr>`)
    .join("");
  const address = [order.customer_address || order.shipping_address, order.customer_city || order.shipping_city]
    .filter(Boolean)
    .join(", ");
  const win = window.open("", "_blank");
  if (!win) return showAlert("Permita as janelas pop-up para imprimir a guia.");
  win.document.write(`<!DOCTYPE html><html lang="pt-PT"><head><meta charset="UTF-8">
    <title>Guia de entrega ${orderCode(order.id)}</title>
    <style>
      body { font-family: system-ui, sans-serif; color: #2b2118; margin: 32px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      .muted { color: #7a6a58; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
      th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e0d6c4; }
      th { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #7a6a58; }
      .total { margin-top: 16px; text-align: right; font-size: 16px; font-weight: 600; }
      .block { margin-top: 22px; }
      .block strong { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #7a6a58; margin-bottom: 4px; }
    </style></head><body>
    <h1>Mushy Parfum &mdash; Guia de entrega</h1>
    <p class="muted">${orderCode(order.id)} &middot; ${formatDate(order.created_at)}</p>
    <div class="block"><strong>Cliente</strong>${escapeHtml(order.customer_name || "—")}<br>
      ${escapeHtml(order.customer_phone || "")}<br>${escapeHtml(address || "")}</div>
    <table><thead><tr><th>Produto</th><th>Qtd</th><th>Preço</th><th>Subtotal</th></tr></thead>
      <tbody>${items}</tbody></table>
    <p class="total">Total: ${money(order.total)}</p>
    <div class="block"><strong>Pagamento</strong>${escapeHtml(order.payment_method || "—")} &middot; ${escapeHtml(statusLabel(order.status))}</div>
    </body></html>`);
  win.document.close();
  win.focus();
  win.print();
});

document.addEventListener("admin:ready", loadOrder);
