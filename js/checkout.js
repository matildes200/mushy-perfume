// ---------- Checkout: login-gated bank-transfer flow ----------
// Loaded after js/main.js, so it shares that file's top-level globals
// (cart, PRODUCTS, currentCustomer, appliedCoupon, money, cartSubtotal,
// couponDiscountAmount, removeCoupon, saveCart, updateCartUI, closeCart, logOrder).

const checkoutOverlay = document.getElementById("checkoutOverlay");
const checkoutStepAuth = document.getElementById("checkoutStepAuth");
const checkoutStepPayment = document.getElementById("checkoutStepPayment");
const checkoutStepDone = document.getElementById("checkoutStepDone");

// Dial codes for the sign-up phone field, same list the account page uses.
// Angola is preselected, since that is where the shop ships.
(() => {
  const select = document.getElementById("ckRegCountry");
  if (!select || typeof COUNTRY_CODES === "undefined") return;
  select.innerHTML = COUNTRY_CODES.map(
    (c) => `<option value="${c.dial}" ${c.iso === "AO" ? "selected" : ""}>${c.name} (${c.dial})</option>`
  ).join("");
})();

function showCheckoutStep(step) {
  [checkoutStepAuth, checkoutStepPayment, checkoutStepDone].forEach((el) => el?.classList.remove("active"));
  step?.classList.add("active");
}

function closeCheckout() {
  checkoutOverlay?.classList.remove("open");
}

async function enterPaymentStep() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    showCheckoutStep(checkoutStepAuth);
    return;
  }
  if (!currentCustomer || currentCustomer.id !== session.user.id) {
    const { data } = await supabaseClient.from("customers").select("*").eq("id", session.user.id).maybeSingle();
    currentCustomer = data;
  }
  document.getElementById("ckName").value = currentCustomer?.full_name || "";
  document.getElementById("ckPhone").value = currentCustomer?.phone || "";
  // Prefilled from the saved profile so a returning customer doesn't retype
  // their address; still editable, since this order may go somewhere else.
  const addressField = document.getElementById("ckAddress");
  if (addressField && !addressField.value) addressField.value = currentCustomer?.address || "";

  const { data: settings } = await supabaseClient.from("payment_settings").select("*").eq("id", 1).maybeSingle();
  document.getElementById("pdBankName").textContent = settings?.bank_name || "A combinar";
  document.getElementById("pdAccountHolder").textContent = settings?.account_holder || "A combinar";
  document.getElementById("pdAccountNumber").textContent = settings?.account_number || "A combinar";
  document.getElementById("pdExpressPhone").textContent = settings?.express_phone || "A combinar";

  // The zones normally load on DOMContentLoaded; retry here so a slow or failed
  // first fetch doesn't leave the customer with an empty zone list.
  if (!deliveryZones.length) await loadDeliveryZones();

  // Draws subtotal, discount, delivery and total, and sets the amount to
  // transfer from the same figure the customer is shown.
  renderCheckoutTotals();

  resetPaymentMethodTabs();
  showCheckoutStep(checkoutStepPayment);
}

// ---------- Payment method selection ----------
function resetPaymentMethodTabs() {
  const tabs = document.querySelectorAll(".payment-method-tab");
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.method === "Transferência Bancária"));
  document.getElementById("ckPaymentMethod").value = "Transferência Bancária";
  document.getElementById("paymentRowsBank").hidden = false;
  document.getElementById("paymentRowsExpress").hidden = true;
}

document.querySelectorAll(".payment-method-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".payment-method-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("ckPaymentMethod").value = tab.dataset.method;
    document.getElementById("paymentRowsBank").hidden = tab.dataset.method !== "Transferência Bancária";
    document.getElementById("paymentRowsExpress").hidden = tab.dataset.method !== "Express";
  });
});

async function openCheckout() {
  if (!checkoutOverlay || Object.keys(cart).length === 0) return;
  closeCart();
  checkoutOverlay.classList.add("open");
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) await enterPaymentStep();
  else showCheckoutStep(checkoutStepAuth);
}

checkoutBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  openCheckout();
});

// Calls a Supabase Edge Function (send-order-confirmation) that emails and/or
// texts the customer their order confirmation. The order is already saved by
// the time this runs, so a missing/undeployed function never blocks checkout
// — see supabase/functions/send-order-confirmation for the function itself
// and what it needs to actually send anything.
async function notifyOrderConfirmation(order, email, name, phone) {
  if (!order) return;
  try {
    await supabaseClient.functions.invoke("send-order-confirmation", {
      body: { order_id: order.id, email, name, phone },
    });
  } catch (err) {
    console.warn("Confirmação de pedido não enviada (função ainda não configurada):", err);
  }
}

document.getElementById("checkoutClose")?.addEventListener("click", closeCheckout);
checkoutOverlay?.addEventListener("click", (e) => { if (e.target === checkoutOverlay) closeCheckout(); });

// ---------- Auth step ----------
function showCheckoutAuthAlert(message, type = "error") {
  const el = document.getElementById("checkoutAuthAlert");
  if (el) el.innerHTML = message ? `<div class="admin-alert admin-alert-${type}">${message}</div>` : "";
}

document.querySelectorAll("[data-checkout-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("[data-checkout-tab]").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("checkoutLoginForm")?.classList.toggle("active", tab.dataset.checkoutTab === "login");
    document.getElementById("checkoutRegisterForm")?.classList.toggle("active", tab.dataset.checkoutTab === "register");
    showCheckoutAuthAlert("");
  });
});

document.getElementById("checkoutLoginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  showCheckoutAuthAlert("");

  const email = document.getElementById("ckLoginEmail").value.trim();
  const password = document.getElementById("ckLoginPassword").value;
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  btn.disabled = false;

  // See js/conta.js for why "email not confirmed" needs its own message
  // instead of falling into the generic wrong-password case.
  if (error?.message?.toLowerCase().includes("email not confirmed")) {
    showCheckoutAuthAlert(
      `${window.t?.("auth.unconfirmed.text")} <a href="#" id="ckResendConfirmLink" style="text-decoration:underline;">${window.t?.("auth.unconfirmed.link")}</a>.`,
      "error"
    );
    document.getElementById("ckResendConfirmLink")?.addEventListener("click", async (evt) => {
      evt.preventDefault();
      const { error: resendError } = await supabaseClient.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/conta.html` },
      });
      showCheckoutAuthAlert(resendError ? window.t?.("auth.resend.error") : window.t?.("auth.resend.success"), resendError ? "error" : "success");
    });
    return;
  }

  if (error || !data.session) {
    showCheckoutAuthAlert(window.t?.("auth.badcredentials"));
    return;
  }
  await enterPaymentStep();
});

document.getElementById("checkoutRegisterForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  showCheckoutAuthAlert("");

  const full_name = document.getElementById("ckRegName").value.trim();
  const email = document.getElementById("ckRegEmail").value.trim();
  const password = document.getElementById("ckRegPassword").value;
  const confirm = document.getElementById("ckRegPasswordConfirm").value;
  const rawPhone = document.getElementById("ckRegPhone").value.trim();
  const dial = document.getElementById("ckRegCountry").value;

  if (password !== confirm) {
    btn.disabled = false;
    showCheckoutAuthAlert(window.t?.("auth.password.mismatch"));
    return;
  }
  if (!document.getElementById("ckRegAcceptTerms")?.checked) {
    btn.disabled = false;
    showCheckoutAuthAlert(window.t?.("legal.accept.required"));
    return;
  }
  // Collected here as well as on the account page: someone who signs up at
  // this point is about to place an order, and the order needs a number to
  // reach them on.
  if (!rawPhone) {
    btn.disabled = false;
    showCheckoutAuthAlert(window.t?.("auth.phone.required"));
    return;
  }
  const phone = `${dial} ${rawPhone}`;

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name, phone }, emailRedirectTo: `${window.location.origin}/conta.html` },
  });
  btn.disabled = false;

  if (error) {
    showCheckoutAuthAlert(
      error.message.includes("already registered") || error.status === 422
        ? window.t?.("auth.exists")
        : window.t?.("auth.signup.error")
    );
    return;
  }

  if (data.session) {
    const ref = localStorage.getItem("mushy-pending-ref");
    if (ref) {
      try { await supabaseClient.rpc("redeem_referral", { p_ref_code: ref }); } finally { localStorage.removeItem("mushy-pending-ref"); }
    }
    await enterPaymentStep();
  } else {
    showCheckoutAuthAlert(window.t?.("auth.created.checkout"), "success");
  }
});

// ---------- Payment step ----------
// The submit button starts disabled (see the HTML) and only becomes
// clickable once a receipt is actually attached — the mandatory-upload
// rule is enforced by the control itself, not just a submit-time check.
document.getElementById("ckReceipt")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  const label = document.getElementById("ckReceiptLabel");
  if (label) label.textContent = file ? file.name : window.t?.("checkout.receipt.label");
  const submitBtn = document.getElementById("ckSubmitBtn");
  if (submitBtn) submitBtn.disabled = !file;
});

function showCheckoutPaymentAlert(message, type = "error") {
  const el = document.getElementById("checkoutPaymentAlert");
  if (el) el.innerHTML = message ? `<div class="admin-alert admin-alert-${type}">${message}</div>` : "";
}

document.getElementById("checkoutPaymentForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("ckSubmitBtn");
  showCheckoutPaymentAlert("");

  const name = document.getElementById("ckName").value.trim();
  const phone = document.getElementById("ckPhone").value.trim();
  const street = document.getElementById("ckAddress").value.trim();
  const city = document.getElementById("ckCity").value.trim();
  const district = document.getElementById("ckDistrict").value.trim();
  const paymentMethod = document.getElementById("ckPaymentMethod").value;
  const file = document.getElementById("ckReceipt").files?.[0];
  if (!name || !phone) {
    showCheckoutPaymentAlert(window.t?.("checkout.err.namephone"));
    return;
  }
  if (!street || !city) {
    showCheckoutPaymentAlert(window.t?.("checkout.err.address"));
    return;
  }
  // A zone is required: it decides the delivery fee, and the fee is part of
  // the total the customer is about to transfer. Conditional on there being
  // zones to choose from — if the table is empty or failed to load, blocking
  // the order would be worse than taking it without a delivery line.
  if (deliveryZones.length && !selectedZone) {
    showCheckoutPaymentAlert(window.t?.("checkout.err.zone"));
    return;
  }
  // Acceptance is checked here as well as by the markup's required attribute,
  // which is trivially bypassed.
  if (!document.getElementById("ckAcceptTerms")?.checked) {
    showCheckoutPaymentAlert(window.t?.("legal.accept.required"));
    return;
  }
  if (!file) {
    showCheckoutPaymentAlert(window.t?.("checkout.err.receipt"));
    return;
  }

  btn.disabled = true;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      showCheckoutStep(checkoutStepAuth);
      return;
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const path = `${session.user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabaseClient.storage.from("receipts").upload(path, file);
    if (uploadError) throw uploadError;

    // District is optional, so it's only appended when there's something there.
    const address = district ? `${street}, ${district}` : street;
    const subtotalNow = cartSubtotal();
    const afterDiscount = Math.max(0, subtotalNow - couponDiscountAmount(subtotalNow));
    const deliveryFee = deliveryFeeFor(selectedZone, afterDiscount);
    const order = await logOrder(name, phone, path, paymentMethod, address, city, {
      // Optional: with no zones configured the guard above lets the order
      // through, and the order simply carries no delivery line.
      zone: selectedZone?.name || null,
      fee: deliveryFee,
      onRequest: Boolean(selectedZone?.on_request),
    });
    await notifyOrderConfirmation(order, session.user.email, name, phone);
    showCheckoutStep(checkoutStepDone);
  } catch (err) {
    console.error("Falha ao finalizar pedido:", err);
    showCheckoutPaymentAlert(window.t?.("checkout.err.submit"));
    btn.disabled = false;
  }
});

document.getElementById("checkoutDoneBtn")?.addEventListener("click", () => {
  cart = {};
  saveCart();
  updateCartUI();
  closeCheckout();
  document.getElementById("checkoutPaymentForm")?.reset();
  resetPaymentMethodTabs();
  const label = document.getElementById("ckReceiptLabel");
  if (label) label.textContent = window.t?.("checkout.receipt.label");
  document.getElementById("ckSubmitBtn").disabled = true;
});

// ---------- B3: zonas de entrega ----------
// The shop used to tell people the delivery cost would be "agreed before
// dispatch", which meant reaching the end of checkout without knowing the
// total. Zones and prices live in the database so they can be changed from
// Definições without a developer.

let deliveryZones = [];
let deliverySettings = { free_delivery_threshold: null, free_delivery_active: false };
let selectedZone = null;

// Zone names are typed by an administrator and end up inside innerHTML.
const escapeZone = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

// Translated string with a literal fallback: t() echoes the key back when it is
// missing, so an unresolved key would otherwise print as "cart.delivery.free".
function tx(key, fallback, vars) {
  const out = window.t?.(key, vars);
  return !out || out === key ? fallback : out;
}

async function loadDeliveryZones() {
  const [zonesRes, settingsRes] = await Promise.all([
    supabaseClient.from("delivery_zones").select("*").eq("active", true).order("sort_order"),
    supabaseClient.from("site_delivery_settings").select("*").maybeSingle(),
  ]);
  deliveryZones = zonesRes.data || [];
  if (settingsRes.data) deliverySettings = settingsRes.data;

  renderZoneOptions();
  updateCartDeliveryHint();
  renderZoneTable();
}

// Rebuilt rather than relabelled, so a language switch redraws the prices and
// the "sob consulta" label without losing what the customer already chose.
function renderZoneOptions() {
  const select = document.getElementById("ckZone");
  if (!select) return;
  const previous = select.value;
  const placeholder = select.querySelector('option[value=""]');
  select.innerHTML = "";
  if (placeholder) select.appendChild(placeholder);
  deliveryZones.forEach((z) => {
    const opt = document.createElement("option");
    opt.value = String(z.id);
    opt.textContent = z.on_request
      ? `${z.name} — ${tx("checkout.zone.onrequest", "Sob consulta")}`
      : `${z.name} — ${money(Number(z.price))}`;
    select.appendChild(opt);
  });
  if (previous) select.value = previous;
}

// Políticas shows the same zones and prices as the checkout, read from the same
// table — a price changed in Definições is correct on both without an edit here.
function renderZoneTable() {
  const wrap = document.getElementById("zoneTableWrap");
  if (!wrap) return;
  if (!deliveryZones.length) { wrap.innerHTML = ""; return; }

  const heading = tx("politicas.envio.zones", "Zonas de entrega em Luanda");
  const colZone = tx("politicas.envio.zone", "Zona");
  const colCost = tx("politicas.envio.cost", "Custo");
  const onRequestLabel = tx("checkout.zone.onrequest", "Sob consulta");

  const rows = deliveryZones
    .map(
      (z) =>
        `<tr><td>${escapeZone(z.name)}</td><td>${
          z.on_request ? onRequestLabel : money(Number(z.price))
        }</td></tr>`
    )
    .join("");

  const threshold = freeDeliveryThreshold();
  const freeLine =
    threshold !== null
      ? `<p class="policy-note">${tx(
          "politicas.envio.free",
          `Entrega grátis em pedidos a partir de ${money(threshold)}.`,
          { amount: money(threshold) }
        )}</p>`
      : "";

  wrap.innerHTML =
    `<h4 class="zone-table-title">${heading}</h4>` +
    `<table class="zone-table"><thead><tr><th>${colZone}</th><th>${colCost}</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>` +
    freeLine;
}

// Free delivery is optional and configurable; a threshold of zero disables it.
function freeDeliveryThreshold() {
  if (!deliverySettings.free_delivery_active) return null;
  const t = Number(deliverySettings.free_delivery_threshold || 0);
  return t > 0 ? t : null;
}

function qualifiesForFreeDelivery(subtotalAfterDiscount) {
  const t = freeDeliveryThreshold();
  return t !== null && subtotalAfterDiscount >= t;
}

// What the customer actually pays for delivery, given the zone and the cart.
function deliveryFeeFor(zone, subtotalAfterDiscount) {
  if (!zone || zone.on_request) return 0;
  if (qualifiesForFreeDelivery(subtotalAfterDiscount)) return 0;
  return Number(zone.price || 0);
}

// The cart shows the cheapest real zone before checkout, so the cost is never
// a surprise that appears only at the last step.
function updateCartDeliveryHint() {
  const el = document.getElementById("cartDeliveryHint");
  if (!el) return;
  const priced = deliveryZones.filter((z) => !z.on_request);
  if (!priced.length) { el.hidden = true; return; }

  const cheapest = Math.min(...priced.map((z) => Number(z.price || 0)));
  const subtotal = cartSubtotal();
  const afterDiscount = Math.max(0, subtotal - couponDiscountAmount(subtotal));
  const threshold = freeDeliveryThreshold();

  if (threshold !== null && afterDiscount >= threshold) {
    el.textContent = tx("cart.delivery.free", "Entrega grátis neste pedido.");
  } else if (threshold !== null && subtotal > 0) {
    el.textContent = tx(
      "cart.delivery.remaining",
      `Faltam ${money(threshold - afterDiscount)} para ter entrega grátis.`,
      { amount: money(threshold - afterDiscount) }
    );
  } else {
    el.textContent = tx(
      "cart.delivery.from",
      `Entrega a partir de ${money(cheapest)} · calculada no checkout`,
      { amount: money(cheapest) }
    );
  }
  el.hidden = false;
}

// Subtotal, discount, delivery, total — each on its own line.
function renderCheckoutTotals() {
  const box = document.getElementById("ckTotals");
  if (!box) return;
  const subtotal = cartSubtotal();
  const discount = couponDiscountAmount(subtotal);
  const afterDiscount = Math.max(0, subtotal - discount);
  const fee = deliveryFeeFor(selectedZone, afterDiscount);
  const free = selectedZone && !selectedZone.on_request && qualifiesForFreeDelivery(afterDiscount);

  const deliveryLabel = `${tx("checkout.delivery", "Entrega")} (${escapeZone(selectedZone?.name)})`;
  const rows = [[tx("cart.subtotal", "Subtotal"), money(subtotal)]];
  if (discount > 0) rows.push([tx("cart.discount", "Desconto"), `− ${money(discount)}`]);
  if (selectedZone) {
    if (selectedZone.on_request) {
      rows.push([deliveryLabel, tx("checkout.zone.onrequest", "Sob consulta")]);
    } else {
      rows.push([deliveryLabel, free ? tx("checkout.delivery.free", "Grátis") : money(fee)]);
    }
  }

  box.innerHTML =
    rows.map(([k, v]) => `<div class="ck-total-row"><span>${k}</span><span>${v}</span></div>`).join("") +
    `<div class="ck-total-row ck-total-final"><span>${tx("cart.total", "Total")}</span><span>${money(
      afterDiscount + fee
    )}</span></div>`;

  // The amount to transfer must match the total the customer just read.
  const amountEl = document.getElementById("pdAmount");
  if (amountEl) amountEl.textContent = money(afterDiscount + fee);
}

document.getElementById("ckZone")?.addEventListener("change", (e) => {
  selectedZone = deliveryZones.find((z) => String(z.id) === e.target.value) || null;
  const note = document.getElementById("ckZoneNote");
  if (note) {
    if (selectedZone?.on_request) {
      note.textContent = tx(
        "checkout.zone.note",
        "Entregamos fora de Luanda. O custo é confirmado consigo por contacto directo antes do envio, e o pedido segue normalmente."
      );
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  }
  renderCheckoutTotals();
});

window.updateCartDeliveryHint = updateCartDeliveryHint;
document.addEventListener("DOMContentLoaded", loadDeliveryZones);

// These three are built in JS, so data-i18n can't reach them on a language
// switch — they have to redraw themselves.
document.addEventListener("lang:changed", () => {
  renderZoneOptions();
  updateCartDeliveryHint();
  renderCheckoutTotals();
  renderZoneTable();
});
