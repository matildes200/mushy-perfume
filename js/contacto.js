// Contact form (contacto.html).
//
// Writes straight into public.contact_messages, which is insert-only for the
// public — see supabase/migration_11_contact_messages.sql. No login needed: a
// visitor with a question shouldn't have to make an account to ask it.

const contactForm = document.getElementById("contactForm");
const contactAlert = document.getElementById("contactAlert");

function showContactAlert(message, type = "error") {
  if (!contactAlert) return;
  contactAlert.innerHTML = message ? `<div class="admin-alert admin-alert-${type}">${message}</div>` : "";
}

contactForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("ctSubmitBtn");
  showContactAlert("");

  const name = document.getElementById("ctName").value.trim();
  const email = document.getElementById("ctEmail").value.trim();
  const subject = document.getElementById("ctSubject").value.trim();
  const message = document.getElementById("ctMessage").value.trim();

  if (!name || !email || !message) {
    showContactAlert(window.t?.("contacto.err.required"));
    return;
  }

  btn.disabled = true;
  try {
    const { error } = await supabaseClient.from("contact_messages").insert({
      name,
      email,
      subject: subject || null,
      message,
    });
    if (error) throw error;
    contactForm.reset();
    showContactAlert(window.t?.("contacto.success"), "success");
  } catch (err) {
    console.error("Falha ao enviar mensagem de contacto:", err);
    showContactAlert(window.t?.("contacto.err.submit"));
  } finally {
    btn.disabled = false;
  }
});

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
