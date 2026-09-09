// Messages page: questions sent through the storefront contact forms.
//
// Reads public.contact_messages, which is admin-read only (see
// supabase/migration_11_contact_messages.sql). Each message renders as a
// full-width card — the body is a paragraph and needs room to wrap, which is
// exactly what a table cell would not give it.

let messagesCache = [];
let activeFilter = "pending";

const messagesList = document.getElementById("messagesList");
const messagesAlert = document.getElementById("messagesAlert");
const messagesCount = document.getElementById("messagesCount");
const messagesHeading = document.getElementById("messagesHeading");

const FILTER_LABELS = {
  pending: "Por responder",
  handled: "Respondidas",
  all: "Todas as mensagens",
};

function showMessagesAlert(text, type = "error") {
  messagesAlert.innerHTML = text ? `<div class="admin-alert admin-alert-${type}">${escapeHtml(text)}</div>` : "";
}

function visibleMessages() {
  if (activeFilter === "all") return messagesCache;
  const wantHandled = activeFilter === "handled";
  return messagesCache.filter((m) => Boolean(m.handled) === wantHandled);
}

function messageCard(m) {
  const subject = m.subject ? `<p class="message-subject">${escapeHtml(m.subject)}</p>` : "";
  const replySubject = encodeURIComponent("Re: " + (m.subject || "a sua mensagem"));
  return `<article class="message-card${m.handled ? " is-handled" : ""}" data-message="${m.id}">
    <header class="message-card-head">
      <div>
        <strong class="message-from">${escapeHtml(m.name)}</strong>
        <a class="message-email" href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a>
      </div>
      <time class="message-date">${formatDate(m.created_at)}</time>
    </header>
    ${subject}
    <p class="message-body">${escapeHtml(m.message)}</p>
    <div class="message-actions">
      <a class="btn-admin" href="mailto:${escapeHtml(m.email)}?subject=${replySubject}">Responder por e-mail</a>
      <button type="button" class="btn-admin btn-admin-outline" data-toggle-handled="${m.id}">
        ${m.handled ? "Marcar por responder" : "Marcar como respondida"}
      </button>
    </div>
  </article>`;
}

function renderMessages() {
  const rows = visibleMessages();
  messagesHeading.textContent = FILTER_LABELS[activeFilter];
  messagesCount.textContent = rows.length ? `${rows.length} mensagem${rows.length === 1 ? "" : "s"}` : "";
  messagesList.innerHTML = rows.length
    ? rows.map(messageCard).join("")
    : `<p class="admin-empty">Nenhuma mensagem ${activeFilter === "handled" ? "respondida" : "por responder"}.</p>`;
  updateMessagesBadge();
}

// The sidebar badge shows how many are still waiting, so the count is visible
// from every admin page rather than only once you open this one.
function updateMessagesBadge() {
  const pending = messagesCache.filter((m) => !m.handled).length;
  document.querySelectorAll("[data-messages-badge]").forEach((badge) => {
    badge.textContent = pending;
    badge.hidden = pending === 0;
  });
}

document.getElementById("messageFilters")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-filter]");
  if (!btn) return;
  activeFilter = btn.dataset.filter;
  document.querySelectorAll("#messageFilters [data-filter]").forEach((b) => b.classList.toggle("active", b === btn));
  renderMessages();
});

messagesList?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-toggle-handled]");
  if (!btn) return;
  const id = btn.dataset.toggleHandled;
  const message = messagesCache.find((m) => String(m.id) === id);
  if (!message) return;

  btn.disabled = true;
  const { error } = await supabaseClient
    .from("contact_messages")
    .update({ handled: !message.handled })
    .eq("id", message.id);
  btn.disabled = false;

  if (error) {
    showMessagesAlert("Não foi possível actualizar esta mensagem.");
    return;
  }
  showMessagesAlert("");
  message.handled = !message.handled;
  renderMessages();
});

async function loadMessages() {
  const { data, error } = await supabaseClient
    .from("contact_messages")
    .select("id, created_at, name, email, subject, message, handled")
    .order("created_at", { ascending: false });

  if (error) {
    showMessagesAlert("Não foi possível carregar as mensagens. Confirme se a migração das mensagens de contacto foi executada.");
    messagesList.innerHTML = `<p class="admin-empty">Erro ao carregar.</p>`;
    return;
  }
  messagesCache = data || [];
  renderMessages();
}

document.addEventListener("admin:ready", loadMessages);
