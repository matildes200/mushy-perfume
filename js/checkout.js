// ---------- Checkout: login-gated bank-transfer flow ----------
// Loaded after js/main.js, so it shares that file's top-level globals
// (cart, PRODUCTS, currentCustomer, appliedCoupon, money, cartSubtotal,
// couponDiscountAmount, removeCoupon, saveCart, updateCartUI, closeCart, logOrder).

const checkoutOverlay = document.getElementById("checkoutOverlay");
const checkoutStepAuth = document.getElementById("checkoutStepAuth");
const checkoutStepPayment = document.getElementById("checkoutStepPayment");
const checkoutStepDone = document.getElementById("checkoutStepDone");

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

  const { data: settings } = await supabaseClient.from("payment_settings").select("*").eq("id", 1).maybeSingle();
  document.getElementById("pdBankName").textContent = settings?.bank_name || "A combinar";
  document.getElementById("pdAccountHolder").textContent = settings?.account_holder || "A combinar";
  document.getElementById("pdAccountNumber").textContent = settings?.account_number || "A combinar";
  document.getElementById("pdExpressPhone").textContent = settings?.express_phone || "A combinar";

  const subtotal = cartSubtotal();
  const discount = couponDiscountAmount(subtotal);
  document.getElementById("pdAmount").textContent = money(Math.max(0, subtotal - discount));

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
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name }, emailRedirectTo: `${window.location.origin}/conta.html` },
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
  const paymentMethod = document.getElementById("ckPaymentMethod").value;
  const file = document.getElementById("ckReceipt").files?.[0];
  if (!name || !phone) {
    showCheckoutPaymentAlert(window.t?.("checkout.err.namephone"));
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

    const order = await logOrder(name, phone, path, paymentMethod);
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
