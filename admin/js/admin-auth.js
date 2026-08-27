// Runs on every admin page except login.html. Blocks rendering until we know
// the visitor is signed in AND is on the admins allow-list (checked via the
// is_admin() RPC, which is enforced again independently by RLS on every
// table — this client-side check only exists to redirect non-admins away
// quickly, it is not the security boundary).
(async function guardAdmin() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.replace("login.html");
    return;
  }

  const { data: isAdmin, error } = await supabaseClient.rpc("is_admin");

  if (error || !isAdmin) {
    await supabaseClient.auth.signOut();
    window.location.replace("login.html?error=unauthorized");
    return;
  }

  document.documentElement.classList.add("admin-authed");
  const emailEl = document.querySelector("[data-admin-email]");
  if (emailEl) emailEl.textContent = session.user.email;

  document.querySelector("[data-admin-logout]")?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.replace("login.html");
  });

  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".admin-nav a[href]").forEach((link) => {
    if (link.getAttribute("href") === current) link.classList.add("active");
  });

  document.dispatchEvent(new CustomEvent("admin:ready", { detail: { session } }));
})();
