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

// Order status maps onto a "status.<value>" translation key so the order
// history follows the selected language too.
const orderStatusLabel = (status) => window.t?.(`status.${status}`) || status;

async function renderAccountOrders(customerId) {
  const el = document.getElementById("accountOrders");
  const { data: orders } = await supabaseClient
    .from("orders")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (!orders || orders.length === 0) {
    el.innerHTML = `<p class="cart-empty" data-i18n="account.orders.empty">Você ainda não fez nenhum pedido.</p>`;
    window.applyTranslations?.(window.getLang?.());
    return;
  }
  el.innerHTML = orders
    .map((o) => {
      const date = o.created_at ? new Date(o.created_at).toLocaleDateString("pt-PT") : "—";
      const items = o.items || [];
      // Orders placed before the image was snapshotted onto the line fall back
      // to the live product, so old orders still show a bottle where they can.
      const lines = items
        .map((it) => {
          const image = it.image || PRODUCTS.find((p) => p.id === it.id)?.image || "";
          const thumb = image
            ? `<img src="${image}" alt="${it.name}" loading="lazy">`
            : `<span class="account-order-thumb-empty" aria-hidden="true"></span>`;
          return `<li class="account-order-item">
            <span class="account-order-thumb">${thumb}</span>
            <span class="account-order-item-name">${it.name}<small>${it.qty} × ${money(it.price)}</small></span>
          </li>`;
        })
        .join("");
      return `<div class="account-order">
        <div class="account-order-row">
          <span>${date}</span>
          <span><strong>${money(o.total)}</strong><br><span class="order-status">${orderStatusLabel(o.status)}</span></span>
        </div>
        <ul class="account-order-items">${lines}</ul>
        ${o.customer_address ? `<p class="account-order-address">${o.customer_address}${o.customer_city ? `, ${o.customer_city}` : ""}</p>` : ""}
      </div>`;
    })
    .join("");
}

function renderAccountFavorites() {
  const el = document.getElementById("accountFavorites");
  const items = (wishlist || []).map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);
  el.innerHTML = items.length
    ? items
        .map(
          (p) => `<div class="account-order-row">
        <span>${p.name}</span>
        <span><strong>${money(effectivePrice(p))}</strong></span>
      </div>`
        )
        .join("")
    : `<p class="cart-empty" data-i18n="wishlist.empty">Você ainda não adicionou favoritos.</p>`;
  window.applyTranslations?.(window.getLang?.());
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
    el.innerHTML = `<p class="cart-empty" data-i18n="account.referral.empty">Nenhum amigo se registou pelo seu link ainda.</p>`;
    window.applyTranslations?.(window.getLang?.());
    return;
  }
  el.innerHTML = coupons
    .map((c) => {
      const used = c.times_used >= (c.max_uses || 1);
      return `<div class="referral-coupon-row"><span>${c.code}</span><span>${used ? window.t?.("referral.used") : window.t?.("referral.available")}</span></div>`;
    })
    .join("");
}

document.getElementById("copyReferralBtn")?.addEventListener("click", () => {
  const input = document.getElementById("referralLink");
  input.select();
  navigator.clipboard?.writeText(input.value);
  document.getElementById("referralCopyNote").textContent = window.t?.("referral.copied");
  setTimeout(() => { document.getElementById("referralCopyNote").textContent = ""; }, 2500);
});

// Name, phone and address are all editable here, but only after "Alterar
// dados" is pressed. Email deliberately isn't editable at all: it's the
// Supabase auth identity, so changing it needs a re-verification round trip
// rather than a plain table update.
const PROFILE_FIELDS = ["profileName", "profilePhone", "profileAddress"];
let profileSnapshot = null;

function setProfileEditing(editing) {
  document.getElementById("profileView")?.classList.toggle("editing", editing);
  PROFILE_FIELDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.readOnly = !editing;
  });
}

document.getElementById("editProfileBtn")?.addEventListener("click", () => {
  // Snapshot so Cancel can put back exactly what was there before.
  profileSnapshot = Object.fromEntries(
    PROFILE_FIELDS.map((id) => [id, document.getElementById(id)?.value ?? ""])
  );
  document.getElementById("addressNote").textContent = "";
  setProfileEditing(true);
  document.getElementById("profileName")?.focus();
});

document.getElementById("cancelProfileBtn")?.addEventListener("click", () => {
  if (profileSnapshot) {
    PROFILE_FIELDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = profileSnapshot[id];
    });
  }
  document.getElementById("addressNote").textContent = "";
  setProfileEditing(false);
});

document.getElementById("saveProfileBtn")?.addEventListener("click", async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const btn = document.getElementById("saveProfileBtn");
  const note = document.getElementById("addressNote");
  const full_name = document.getElementById("profileName").value.trim();
  const phone = document.getElementById("profilePhone").value.trim();
  const address = document.getElementById("profileAddress").value.trim();

  if (!full_name) {
    note.textContent = window.t?.("account.name.required") || "Indique o seu nome.";
    return;
  }

  btn.disabled = true;
  const { data, error } = await supabaseClient
    .from("customers")
    .update({ full_name, phone, address })
    .eq("id", session.user.id)
    .select()
    .maybeSingle();
  btn.disabled = false;

  note.textContent = error
    ? window.t?.("account.save.error") || "Não foi possível guardar as alterações."
    : window.t?.("account.saved") || "Alterações guardadas.";

  // Stay in edit mode on failure so the shopper doesn't lose what they typed.
  if (!error) {
    setProfileEditing(false);
    // Keeps the checkout prefill (js/main.js) in step with what was just
    // saved, so stale details don't show up on their next order.
    if (data) currentCustomer = data;
  }

  setTimeout(() => { note.textContent = ""; }, 3000);
});

async function showProfile(session) {
  const profile = await ensureCustomerProfile(session);
  document.getElementById("profileName").value = profile?.full_name || session.user.user_metadata?.full_name || "";
  document.getElementById("profileEmail").textContent = session.user.email;
  document.getElementById("profilePhone").value = profile?.phone || session.user.user_metadata?.phone || "";
  document.getElementById("profileAddress").value = profile?.address || "";
  setProfileEditing(false);
  authView.style.display = "none";
  profileView.style.display = "block";
  document.getElementById("accountExtra").style.display = "flex";

  const { data: isAdmin } = await supabaseClient.rpc("is_admin");
  const adminLink = document.getElementById("adminPanelLink");
  if (adminLink) adminLink.style.display = isAdmin ? "flex" : "none";

  await tryRedeemPendingReferral();
  loadedProfile = profile;
  loadedCustomerId = session.user.id;
  renderAccountOrders(loadedCustomerId);
  renderAccountFavorites();
  renderAccountRecommendations();
  renderReferral(profile);
  isProfileShown = true;
}

// PRODUCTS (js/products.js) loads asynchronously and can still be empty at
// the moment showProfile() first runs, leaving favorites/recommendations
// blank — re-render them once the catalog actually arrives.
let isProfileShown = false;
let loadedProfile = null;
let loadedCustomerId = null;
document.addEventListener("products:ready", () => {
  if (!isProfileShown) return;
  renderAccountFavorites();
  renderAccountRecommendations();
});

// Order statuses and the used/available referral labels are baked in at render
// time, so switching language has to rebuild those two lists.
document.addEventListener("lang:changed", () => {
  if (!isProfileShown) return;
  if (loadedCustomerId) renderAccountOrders(loadedCustomerId);
  if (loadedProfile) renderReferral(loadedProfile);
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
    showAuthAlert(error.message.includes("already registered") || error.status === 422 ? window.t?.("auth.exists") : window.t?.("auth.signup.error"));
    return;
  }

  if (data.session) {
    await showProfile(data.session);
    return;
  }

  showAuthAlert(window.t?.("auth.created.account"), "success");
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
      showAuthAlert(resendError ? window.t?.("auth.resend.error") : window.t?.("auth.resend.success"), resendError ? "error" : "success");
    });
    return;
  }

  if (error || !data.session) {
    showAuthAlert(window.t?.("auth.badcredentials"));
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
