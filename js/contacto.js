// Contact forms.
//
// Drives every form marked [data-contact-form] — the panel above the footer on
// the home page and the one on contacto.html — so both write the same way.
// Fields are found by name attribute, and surname is optional: contacto.html
// asks for a single name field, the home panel splits it in two.
//
// Writes straight into public.contact_messages, which is insert-only for the
// public (see supabase/migration_11_contact_messages.sql). No login needed: a
// visitor with a question shouldn't have to make an account to ask it. The
// insert deliberately doesn't chain .select() — reading a row back needs a
// select policy the public doesn't have, and asking for one would fail.

function initContactForm(form) {
  const alertEl = form.querySelector("[data-contact-alert]");
  const submitBtn = form.querySelector('button[type="submit"]');
  const field = (name) => form.querySelector(`[name="${name}"]`);

  const showAlert = (message, type = "error") => {
    if (!alertEl) return;
    alertEl.innerHTML = message ? `<div class="admin-alert admin-alert-${type}">${message}</div>` : "";
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAlert("");

    const value = (name) => field(name)?.value.trim() || "";
    const name = [value("name"), value("surname")].filter(Boolean).join(" ");
    const email = value("email");
    const subject = value("subject");
    const message = value("message");

    if (!name || !email || !message) {
      showAlert(window.t?.("contacto.err.required"));
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    try {
      const { error } = await supabaseClient.from("contact_messages").insert({
        name,
        email,
        subject: subject || null,
        message,
      });
      if (error) throw error;
      form.reset();
      showAlert(window.t?.("contacto.success"), "success");
    } catch (err) {
      console.error("Falha ao enviar mensagem de contacto:", err);
      showAlert(window.t?.("contacto.err.submit"));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

document.querySelectorAll("[data-contact-form]").forEach(initContactForm);

// Only one FAQ answer open at a time — otherwise every open answer pushes the
// rest of the list down and you lose your place scrolling back up.
document.querySelectorAll(".faq-item").forEach((item) => {
  item.addEventListener("toggle", () => {
    if (!item.open) return;
    document.querySelectorAll(".faq-item[open]").forEach((other) => {
      if (other !== item) other.open = false;
    });
  });
});
