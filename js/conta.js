const countryCodeSelect = document.getElementById("countryCode");
const authView = document.getElementById("authView");
const profileView = document.getElementById("profileView");
const authAlert = document.getElementById("authAlert");

const tabs = document.querySelectorAll(".account-tab");
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
  const { data: existing } = await supabaseClient.from("customers").select("id").eq("id", session.user.id).maybeSingle();
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

async function showProfile(session) {
  const profile = await ensureCustomerProfile(session);
  document.getElementById("profileName").textContent = profile?.full_name || session.user.user_metadata?.full_name || "—";
  document.getElementById("profileEmail").textContent = session.user.email;
  document.getElementById("profilePhone").textContent = profile?.phone || session.user.user_metadata?.phone || "—";
  authView.style.display = "none";
  profileView.style.display = "block";
}

function showAuthForms() {
  authView.style.display = "block";
  profileView.style.display = "none";
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
    options: { data: { full_name, phone } },
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
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("loginBtn");
  btn.disabled = true;
  showAuthAlert("");

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  btn.disabled = false;

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
