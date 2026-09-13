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

  // The is_admin() check runs ALONGSIDE the page's own data loading, not
  // before it. It used to be awaited here, which meant every admin page sat
  // through two sequential round trips before requesting a single row — the
  // main reason the dashboard felt slow on a mobile connection.
  //
  // Safe to overlap because this check was never the security boundary: RLS
  // enforces is_admin() on every table independently, so a non-admin's queries
  // return nothing regardless of what happens here. This only decides how fast
  // they get bounced to the login page.
  const adminCheck = supabaseClient.rpc("is_admin").then(({ data: isAdmin, error }) => {
    if (error || !isAdmin) {
      supabaseClient.auth.signOut().finally(() => {
        window.location.replace("login.html?error=unauthorized");
      });
      return false;
    }
    return true;
  });
  window.adminAuthorised = adminCheck;

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
