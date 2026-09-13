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

  // ---- Why this waits for the parser -------------------------------------
  // This file is loaded BEFORE each page's own script, and every page script
  // registers its loader with document.addEventListener("admin:ready", ...).
  //
  // The browser drains the microtask queue after each <script> finishes. When
  // the stored token is still valid, getSession() above resolves without a
  // network request — purely in microtasks — so this function would resume and
  // dispatch at that checkpoint, BEFORE the page script has been parsed. The
  // listener would then be registered against an event that already fired, and
  // the page would sit on "A carregar…" forever.
  //
  // That is not hypothetical: it is what happened when the is_admin() await was
  // moved off this path. That await was an HTTP request, so it always settled
  // in a macrotask and accidentally guaranteed the ordering. Nothing guarantees
  // it now except this gate, so do not remove it — and do not reintroduce an
  // await here and call the problem solved, because a warm cache can still make
  // any await resolve in microtasks.
  //
  // DOMContentLoaded fires only once parsing is finished, so every page script
  // at the end of <body> has run and registered by then. The is_admin() RPC
  // above still overlaps with page loading, so the speed-up is unaffected.
  const announce = () =>
    document.dispatchEvent(new CustomEvent("admin:ready", { detail: { session } }));

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", announce, { once: true });
  } else {
    announce();
  }
})();
