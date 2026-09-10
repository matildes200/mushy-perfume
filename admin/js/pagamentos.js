const paymentAlert = document.getElementById("paymentAlert");
const paymentForm = document.getElementById("paymentForm");

function showPaymentAlert(message, type = "error") {
  paymentAlert.innerHTML = message ? `<div class="admin-alert admin-alert-${type}">${escapeHtml(message)}</div>` : "";
}

async function loadPaymentSettings() {
  const { data, error } = await supabaseClient.from("payment_settings").select("*").eq("id", 1).maybeSingle();
  if (error) {
    showPaymentAlert("Não foi possível carregar os dados de pagamento. Confirme se as migrações do banco de dados foram executadas.");
    return;
  }
  document.getElementById("bank_name").value = data?.bank_name || "";
  document.getElementById("account_holder").value = data?.account_holder || "";
  document.getElementById("account_number").value = data?.account_number || "";
  document.getElementById("express_phone").value = data?.express_phone || "";
}

paymentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("savePaymentBtn");
  btn.disabled = true;
  showPaymentAlert("");

  const payload = {
    id: 1,
    bank_name: document.getElementById("bank_name").value.trim(),
    account_holder: document.getElementById("account_holder").value.trim(),
    account_number: document.getElementById("account_number").value.trim(),
    express_phone: document.getElementById("express_phone").value.trim(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseClient.from("payment_settings").upsert(payload);
  btn.disabled = false;

  if (error) {
    showPaymentAlert("Não foi possível guardar. Tente novamente.");
    return;
  }
  showPaymentAlert("Dados de pagamento actualizados.", "success");
});

document.addEventListener("admin:ready", loadPaymentSettings);
