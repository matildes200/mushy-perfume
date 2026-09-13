// Setting a new palavra-passe from a recovery link.
//
// Supabase puts the visitor into a temporary PASSWORD_RECOVERY session when
// they arrive from the e-mail. Until that session exists there is nothing to
// update, and once the link has been used or has expired it never will — which
// is what separates "set a new password" from "link no longer valid" here.

const lead = document.getElementById("resetLead");
const form = document.getElementById("resetForm");
const doneBox = document.getElementById("resetDone");
const invalidBox = document.getElementById("resetInvalid");
const alertBox = document.getElementById("resetAlert");

const showAlert = (msg, type = "error") => {
  alertBox.innerHTML = msg ? `<div class="admin-alert admin-alert-${type}">${msg}</div>` : "";
};

function showForm() {
  lead.textContent = "Escolha uma nova palavra-passe para a sua conta.";
  form.hidden = false;
  invalidBox.hidden = true;
}

function showInvalid() {
  lead.hidden = true;
  form.hidden = true;
  invalidBox.hidden = false;
}

// At least 8 characters with a letter and a digit. Deliberately modest: rules
// people cannot satisfy push them towards writing the password down.
function passwordProblem(pw) {
  if (pw.length < 8) return "A palavra-passe tem de ter pelo menos 8 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(pw) || !/[0-9]/.test(pw)) {
    return "A palavra-passe tem de incluir pelo menos uma letra e um número.";
  }
  return null;
}

let recoveryReady = false;

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY" || (session && !recoveryReady)) {
    recoveryReady = true;
    showForm();
  }
});

// The event above fires only if the link carried a valid token. If nothing has
// arrived shortly after load, the link was used, expired or tampered with.
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (data?.session) {
    recoveryReady = true;
    showForm();
    return;
  }
  setTimeout(() => { if (!recoveryReady) showInvalid(); }, 1500);
})();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("resetBtn");
  showAlert("");

  const pw = document.getElementById("newPassword").value;
  const confirm = document.getElementById("newPasswordConfirm").value;

  const problem = passwordProblem(pw);
  if (problem) return showAlert(problem);
  if (pw !== confirm) return showAlert(window.t?.("auth.password.mismatch") || "As palavras-passe não coincidem.");

  btn.disabled = true;
  const { error } = await supabaseClient.auth.updateUser({ password: pw });
  btn.disabled = false;

  if (error) {
    showAlert("Não foi possível alterar a palavra-passe. A ligação pode ter expirado.");
    return;
  }

  // Signed out on purpose: the next sign-in has to use the new password, which
  // also confirms to the visitor that it really changed.
  await supabaseClient.auth.signOut();
  form.hidden = true;
  lead.hidden = true;
  alertBox.innerHTML = "";
  doneBox.hidden = false;
});
