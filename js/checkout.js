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

  const subtotal = cartSubtotal();
  const discount = couponDiscountAmount(subtotal);
  document.getElementById("pdAmount").textContent = money(Math.max(0, subtotal - discount));

  showCheckoutStep(checkoutStepPayment);
}

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

  if (error || !data.session) {
    showCheckoutAuthAlert("E-mail ou senha incorretos.");
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
        ? "Esse e-mail já tem uma conta. Tente entrar."
        : "Não foi possível criar a conta. Tente novamente."
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
    showCheckoutAuthAlert("Conta criada! Confira seu e-mail para confirmar o cadastro e depois clique em finalizar de novo.", "success");
  }
});

// ---------- Payment step ----------
document.getElementById("ckReceipt")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  const label = document.getElementById("ckReceiptLabel");
  if (label) label.textContent = file ? file.name : "Enviar comprovativo (imagem ou PDF)";
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
  const file = document.getElementById("ckReceipt").files?.[0];
  if (!name || !phone) {
    showCheckoutPaymentAlert("Preencha seu nome e contacto.");
    return;
  }
  if (!file) {
    showCheckoutPaymentAlert("Envie o comprovativo da transferência.");
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

    await logOrder(name, phone, path);
    showCheckoutStep(checkoutStepDone);
  } catch (err) {
    console.error("Falha ao finalizar pedido:", err);
    showCheckoutPaymentAlert("Não foi possível enviar seu pedido. Tente novamente.");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("checkoutDoneBtn")?.addEventListener("click", () => {
  cart = {};
  saveCart();
  updateCartUI();
  closeCheckout();
  document.getElementById("checkoutPaymentForm")?.reset();
  const label = document.getElementById("ckReceiptLabel");
  if (label) label.textContent = "Enviar comprovativo (imagem ou PDF)";
});
