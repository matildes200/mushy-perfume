const countryCodeSelect = document.getElementById("countryCode");
const authView = document.getElementById("authView");
const profileView = document.getElementById("profileView");
const authAlert = document.getElementById("authAlert");

// Scoped to #authView: the checkout modal (js/checkout.js) has its own
// .account-tab buttons with a different data attribute, and a page-wide
// selector here would also match — and crash — on those.
const tabs = document.querySelectorAll("#authView .account-tab");
const panels = { register: document.getElementById("registerPanel"), login: document.getElementById("loginPanel") };

// ---------- Country code select ----------
countryCodeSelect.innerHTML = COUNTRY_CODES
  .map((c) => `<option value="${c.dial}" ${c.iso === "AO" ? "selected" : ""}>${c.name} (${c.dial})</option>`)
  .join("");

// ---------- Tabs ----------
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    Object.values(panels).forEach((p) => p.classList.remove("active"));
    panels[tab.dataset.tab].classList.add("active");
    authAlert.innerHTML = "";
  });
});

function showAuthAlert(message, type = "error") {
  authAlert.innerHTML = message ? `<div class="admin-alert admin-alert-${type}">${message}</div>` : "";
}

// ---------- Session / profile ----------
async function ensureCustomerProfile(session) {
  const { data: existing } = await supabaseClient.from("customers").select("*").eq("id", session.user.id).maybeSingle();
  if (existing) return existing;

  const meta = session.user.user_metadata || {};
  const { data } = await supabaseClient
    .from("customers")
    .insert({
      id: session.user.id,
      full_name: meta.full_name || session.user.email,
      email: session.user.email,
      phone: meta.phone || "",
    })
    .select()
    .maybeSingle();
  return data;
}

// Redeems a referral code left behind by ?ref=CODE (see js/main.js), if any
// is pending. Safe to call on every sign-in: the RPC no-ops once claimed.
async function tryRedeemPendingReferral() {
  const ref = localStorage.getItem("mushy-pending-ref");
  if (!ref) return;
  try {
    await supabaseClient.rpc("redeem_referral", { p_ref_code: ref });
  } finally {
    localStorage.removeItem("mushy-pending-ref");
  }
}

const ORDER_STATUS_LABELS = {
  pending: "Pendente", confirmed: "Confirmado", processing: "Preparando",
  shipped: "Enviado", delivered: "Entregue", cancelled: "Cancelado", refunded: "Reembolsado",
};

async function renderAccountOrders(customerId) {
  const el = document.getElementById("accountOrders");
  const { data: orders } = await supabaseClient
    .from("orders")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  document.getElementById("statOrderCount").textContent = orders?.length || 0;
  const totalSpent = (orders || []).reduce((sum, o) => sum + Number(o.total || 0), 0);
  document.getElementById("statTotalSpent").textContent = money(totalSpent);

  if (!orders || orders.length === 0) {
    el.innerHTML = `<p class="cart-empty">Você ainda não fez nenhum pedido.</p>`;
    return;
  }
  el.innerHTML = orders
    .map((o) => {
      const date = o.created_at ? new Date(o.created_at).toLocaleDateString("pt-PT") : "—";
      return `<div class="account-order-row">
        <span>${date} · ${(o.items || []).length} item(ns)</span>
        <span><strong>${money(o.total)}</strong><br><span class="order-status">${ORDER_STATUS_LABELS[o.status] || o.status}</span></span>
      </div>`;
    })
    .join("");
}

function renderAccountFavorites() {
  const el = document.getElementById("accountFavorites");
  const items = (wishlist || []).map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);
  document.getElementById("statFavCount").textContent = items.length;
  el.innerHTML = items.length
    ? items
        .map(
          (p) => `<div class="account-order-row">
        <span>${p.name}</span>
        <span><strong>${money(effectivePrice(p))}</strong></span>
      </div>`
        )
        .join("")
    : `<p class="cart-empty">Você ainda não adicionou favoritos.</p>`;
}

function renderAccountRecommendations() {
  const el = document.getElementById("accountRecs");
  const picks = PRODUCTS.filter((p) => p.active !== false && !wishlist.includes(p.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);
  el.innerHTML = picks
    .map(
      (p) => `<a class="account-rec-card" href="colecao.html">
        ${p.image ? `<img src="${p.image}" alt="${p.name}">` : ""}
        <strong>${p.name}</strong>
        <span>${money(effectivePrice(p))}</span>
      </a>`
    )
    .join("");
}

async function renderReferral(profile) {
  const link = `${window.location.origin}/conta.html?ref=${profile?.referral_code || ""}`;
  document.getElementById("referralLink").value = link;

  const { data: coupons } = await supabaseClient
    .from("coupons")
    .select("code, times_used, max_uses")
    .eq("owner_customer_id", profile?.id)
    .order("created_at", { ascending: false });

  const el = document.getElementById("referralCoupons");
  if (!coupons || coupons.length === 0) {
    el.innerHTML = `<p class="cart-empty">Nenhum amigo se cadastrou pelo seu link ainda.</p>`;
    return;
  }
  el.innerHTML = coupons
    .map((c) => {
      const used = c.times_used >= (c.max_uses || 1);
      return `<div class="referral-coupon-row"><span>${c.code}</span><span>${used ? "Usado" : "Disponível"}</span></div>`;
    })
    .join("");
}

document.getElementById("copyReferralBtn")?.addEventListener("click", () => {
  const input = document.getElementById("referralLink");
  input.select();
  navigator.clipboard?.writeText(input.value);
  document.getElementById("referralCopyNote").textContent = "Link copiado!";
  setTimeout(() => { document.getElementById("referralCopyNote").textContent = ""; }, 2500);
});

document.getElementById("saveAddressBtn")?.addEventListener("click", async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;
  const address = document.getElementById("profileAddress").value.trim();
  const note = document.getElementById("addressNote");
  const { error } = await supabaseClient.from("customers").update({ address }).eq("id", session.user.id);
  note.textContent = error ? "Não foi possível salvar o endereço." : "Endereço salvo.";
  setTimeout(() => { note.textContent = ""; }, 2500);
});

async function showProfile(session) {
  const profile = await ensureCustomerProfile(session);
  document.getElementById("profileName").textContent = profile?.full_name || session.user.user_metadata?.full_name || "—";
  document.getElementById("profileEmail").textContent = session.user.email;
  document.getElementById("profilePhone").textContent = profile?.phone || session.user.user_metadata?.phone || "—";
  document.getElementById("profileAddress").value = profile?.address || "";
  authView.style.display = "none";
  profileView.style.display = "block";
  document.getElementById("accountExtra").style.display = "flex";

  const { data: isAdmin } = await supabaseClient.rpc("is_admin");
  const adminLink = document.getElementById("adminPanelLink");
  if (adminLink) adminLink.style.display = isAdmin ? "flex" : "none";

  await tryRedeemPendingReferral();
  renderAccountOrders(session.user.id);
  renderAccountFavorites();
  renderAccountRecommendations();
  renderReferral(profile);
  isProfileShown = true;
}

// PRODUCTS (js/products.js) loads asynchronously and can still be empty at
// the moment showProfile() first runs, leaving favorites/recommendations
// blank — re-render them once the catalog actually arrives.
let isProfileShown = false;
document.addEventListener("products:ready", () => {
  if (!isProfileShown) return;
  renderAccountFavorites();
  renderAccountRecommendations();
});

function showAuthForms() {
  authView.style.display = "block";
  profileView.style.display = "none";
  document.getElementById("accountExtra").style.display = "none";
  isProfileShown = false;
}

(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) showProfile(session);
})();

// ---------- Register ----------
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("registerBtn");
  btn.disabled = true;
  showAuthAlert("");

  const full_name = document.getElementById("fullName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const phone = `${countryCodeSelect.value} ${document.getElementById("phone").value.trim()}`;
  const password = document.getElementById("registerPassword").value;

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name, phone }, emailRedirectTo: `${window.location.origin}/conta.html` },
  });

  btn.disabled = false;

  if (error) {
    showAuthAlert(error.message.includes("already registered") || error.status === 422 ? "Esse e-mail já tem uma conta. Tente entrar." : "Não foi possível criar a conta. Tente novamente.");
    return;
  }

  if (data.session) {
    await showProfile(data.session);
    return;
  }

  showAuthAlert("Conta criada! Confira seu e-mail para confirmar o cadastro antes de entrar.", "success");
});

// ---------- Login ----------
// Some accounts created before the Supabase Site URL was fixed to point at
// the real deployment (it was pointing at http://localhost:3000) received a
// confirmation email whose link could never work, so they never confirmed
// and now sit permanently unconfirmed. Supabase correctly rejects those
// sign-ins with a distinct "Email not confirmed" error, but showing the
// generic "wrong password" message for it hides the real, fixable cause and
// sends the shopper into a pointless retry loop. Detecting it here and
// offering a resend (now using the corrected Site URL) self-heals those accounts.
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("loginBtn");
  btn.disabled = true;
  showAuthAlert("");

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  btn.disabled = false;

  if (error?.message?.toLowerCase().includes("email not confirmed")) {
    showAuthAlert(
      `Sua conta ainda não foi confirmada. Verifique seu e-mail ou <a href="#" id="resendConfirmLink" style="text-decoration:underline;">reenvie a confirmação</a>.`,
      "error"
    );
    document.getElementById("resendConfirmLink")?.addEventListener("click", async (evt) => {
      evt.preventDefault();
      const { error: resendError } = await supabaseClient.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/conta.html` },
      });
      showAuthAlert(resendError ? "Não foi possível reenviar o e-mail. Tente novamente." : "E-mail de confirmação reenviado! Verifique sua caixa de entrada.", resendError ? "error" : "success");
    });
    return;
  }

  if (error || !data.session) {
    showAuthAlert("E-mail ou senha incorretos.");
    return;
  }

  await showProfile(data.session);
});

// ---------- Logout ----------
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  document.getElementById("registerForm").reset();
  document.getElementById("loginForm").reset();
  showAuthAlert("");
  showAuthForms();
});
