const money = (v) => `${Math.round(Number(v) || 0).toLocaleString("pt-PT", { maximumFractionDigits: 0 })} Kz`;

// The order cycle, in order. There is no payment gateway: a person reads the
// comprovativo, decides whether the money arrived, and only then releases the
// shipment — so these seven states are that cycle, and the whole dashboard
// turns on the gap between "comprovativo_recebido" and "pagamento_confirmado".
const ORDER_STATUSES = [
  { value: "aguarda_pagamento",     label: "Aguarda pagamento",     cls: "st-waiting" },
  { value: "comprovativo_recebido", label: "Comprovativo recebido", cls: "st-review" },
  { value: "pagamento_confirmado",  label: "Pagamento confirmado",  cls: "st-paid" },
  { value: "em_preparacao",         label: "Em preparação",         cls: "st-packing" },
  { value: "enviado",               label: "Enviado",               cls: "st-shipped" },
  { value: "entregue",              label: "Entregue",              cls: "st-done" },
  { value: "cancelado",             label: "Cancelado",             cls: "st-cancelled" },
];
const STATUS_LABELS = Object.fromEntries(ORDER_STATUSES.map((s) => [s.value, s.label]));
const STATUS_CLASS = Object.fromEntries(ORDER_STATUSES.map((s) => [s.value, s.cls]));

const statusLabel = (v) => STATUS_LABELS[v] || v || "—";
function statusPill(v) {
  return `<span class="pill ${STATUS_CLASS[v] || ""}">${escapeHtml(statusLabel(v))}</span>`;
}

// Records who did what. Failures are swallowed on purpose: an audit write must
// never be the reason an admin can't confirm a payment.
async function logActivity(action, entity, entityId, detail = null) {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    await supabaseClient.from("activity_log").insert({
      actor_id: user?.id || null,
      actor_email: user?.email || null,
      action,
      entity,
      entity_id: entityId != null ? String(entityId) : null,
      detail,
    });
  } catch (err) {
    console.warn("activity_log:", err);
  }
}

// Counts of outstanding work, shown against the sidebar links. Loaded on every
// admin page so you can see there are comprovativos waiting without first
// navigating to Início. head:true fetches the count only, never the rows.
async function loadNavBadges() {
  const setBadge = (sel, n) =>
    document.querySelectorAll(sel).forEach((b) => { b.textContent = n; b.hidden = !n; });
  try {
    const [messages, receipts] = await Promise.all([
      supabaseClient.from("contact_messages").select("id", { count: "exact", head: true })
        .eq("archived", false).eq("handled", false),
      supabaseClient.from("orders").select("id", { count: "exact", head: true })
        .eq("archived", false).eq("status", "comprovativo_recebido"),
    ]);
    setBadge("[data-messages-badge]", messages.count || 0);
    setBadge("[data-orders-badge]", receipts.count || 0);
  } catch (err) {
    console.warn("nav badges:", err);
  }
}
document.addEventListener("admin:ready", loadNavBadges);

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

// Orders use a uuid primary key, so this is a short, stable display code
// (not a sequential order number) — the first 8 hex chars, uppercased.
const orderCode = (id) => `#MP${String(id).replace(/-/g, "").slice(0, 8).toUpperCase()}`;

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Mobile sidebar: hamburger toggles the nav + account section open/closed.
document.getElementById("adminMobileToggle")?.addEventListener("click", () => {
  document.querySelector(".admin-sidebar")?.classList.toggle("open");
});
// Closing the drawer after picking a destination avoids it staying open
// (and blocking the page) once the next page loads with the same class state.
document.querySelector(".admin-nav")?.addEventListener("click", (e) => {
  if (e.target.closest("a")) document.querySelector(".admin-sidebar")?.classList.remove("open");
});

function renderBarChart(el, points, formatValue = money) {
  const max = Math.max(1, ...points.map((p) => p.value));
  el.innerHTML = points
    .map(
      (p) => `
      <div class="bar-col">
        <div class="bar" style="height:${Math.max(2, Math.round((p.value / max) * 100))}%" title="${formatValue(p.value)}"></div>
        <span class="bar-label">${p.label}</span>
      </div>`
    )
    .join("");
}

// metricFn(order) => number to accumulate per bucket (defaults to revenue, excluding cancelled/refunded).
function bucketOrdersByDay(orders, days, metricFn = (o) => Number(o.total || 0)) {
  const buckets = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets.push({ date: d, value: 0 });
  }
  orders.forEach((o) => {
    if (o.status === "cancelado") return;
    const d = new Date(o.created_at);
    d.setHours(0, 0, 0, 0);
    const bucket = buckets.find((b) => b.date.getTime() === d.getTime());
    if (bucket) bucket.value += metricFn(o);
  });
  return buckets;
}

function bucketOrdersByMonth(orders, metricFn = (o) => Number(o.total || 0)) {
  const now = new Date();
  const buckets = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("pt-PT", { month: "short" }), value: 0 });
  }
  orders.forEach((o) => {
    if (o.status === "cancelado") return;
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) bucket.value += metricFn(o);
  });
  return buckets;
}

// Skeleton rows for a table that is still loading. Called in place of the
// "A carregar…" text so a slow connection sees the shape of the page rather
// than an empty panel.
function skeletonRows(columns, rows = 6) {
  const widths = ["w-80", "w-60", "w-40"];
  const cells = Array.from({ length: columns }, (_, i) => `<td><span class="skel-bar ${widths[i % widths.length]}"></span></td>`).join("");
  return Array.from({ length: rows }, () => `<tr class="skel-row" aria-hidden="true">${cells}</tr>`).join("");
}

// ---------- Dates you can type ----------
// <input type="date"> only ever offers its own editor. On a phone that is the
// operating system's calendar and nothing else, so reaching a date a year back
// is a dozen taps; on a desktop it is three segments that only take digits in
// a fixed order. Every date in the dashboard is a plain text field now, typed
// as dd/mm/aaaa, with the calendar still one tap away beside it for when that
// is the quicker way.
//
// The database still gets ISO. dateFieldISO() converts on the way out and
// setDateField() converts on the way in, so nothing downstream changes.

const DATE_FIELD_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

// Building the date and reading it back is what rejects 31/02: a regex will
// happily accept a day the month does not have.
function parseDateField(text) {
  const m = DATE_FIELD_RE.exec(String(text || "").trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || y < 1900 || y > 2999) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatDateField(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

const dateFieldEl = (ref) => (typeof ref === "string" ? document.getElementById(ref) : ref);

// "" for empty or unreadable, so a half-typed date filters nothing rather than
// sending the database something it cannot parse.
function dateFieldISO(ref) {
  const el = dateFieldEl(ref);
  return el ? parseDateField(el.value) || "" : "";
}

function setDateField(ref, iso) {
  const el = dateFieldEl(ref);
  if (!el) return;
  el.value = formatDateField(iso);
  el.classList.remove("is-invalid");
  const native = el.closest(".date-field")?.querySelector(".date-field-native");
  if (native) native.value = /^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")) ? iso : "";
}

function initDateFields(root = document) {
  root.querySelectorAll("[data-date-field]").forEach((el) => {
    if (el.dataset.dateReady === "1") return;
    el.dataset.dateReady = "1";
    const native = el.closest(".date-field")?.querySelector(".date-field-native");

    el.addEventListener("input", () => {
      // Rewriting the value moves the caret to the end, so the slashes are
      // only inserted while the caret IS at the end. Editing in the middle or
      // backspacing over a slash is left alone.
      const atEnd = el.selectionStart === el.value.length;
      if (atEnd) {
        const digits = el.value.replace(/\D/g, "").slice(0, 8);
        let out = digits.slice(0, 2);
        if (digits.length >= 3) out += "/" + digits.slice(2, 4);
        if (digits.length >= 5) out += "/" + digits.slice(4, 8);
        if (out !== el.value) el.value = out;
      }
      const iso = parseDateField(el.value);
      // Only complain once it is long enough to be a whole date; marking it
      // red on the first keystroke would be nagging, not helping.
      el.classList.toggle("is-invalid", el.value.length >= 10 && !iso);
      if (native) native.value = iso || "";
      el.dispatchEvent(new CustomEvent("date:changed", { bubbles: true, detail: { iso } }));
    });

    el.addEventListener("blur", () => {
      if (!el.value.trim()) { el.classList.remove("is-invalid"); return; }
      el.classList.toggle("is-invalid", !parseDateField(el.value));
    });

    // The calendar writes back into the text field, so both routes end up in
    // the same place and the reader can see what the picker chose.
    native?.addEventListener("change", () => {
      if (!native.value) return;
      el.value = formatDateField(native.value);
      el.classList.remove("is-invalid");
      el.dispatchEvent(new CustomEvent("date:changed", { bubbles: true, detail: { iso: native.value } }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

document.addEventListener("admin:ready", () => initDateFields());
