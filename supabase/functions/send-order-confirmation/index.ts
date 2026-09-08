// Supabase Edge Function: send-order-confirmation
//
// Called from js/checkout.js right after an order is saved. Looks the order
// up (using the service role, since this runs server-side) and emails the
// customer a confirmation. SMS is stubbed out below — sending it for real
// needs a provider (Twilio, Vonage, Africa's Talking, etc.) and its own API
// key, which isn't configured yet; see the comment near EXPRESS_SMS_TODO.
//
// Deploy with:
//   supabase functions deploy send-order-confirmation
// Required secret (set once):
//   supabase secrets set RESEND_API_KEY=your_resend_api_key
// RESEND_FROM_EMAIL defaults to "Mushy Parfum <pedidos@resend.dev>" (Resend's
// shared test domain) unless you set it as a secret too, once you verify
// your own sending domain with Resend.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Mushy Parfum <pedidos@resend.dev>";

const money = (v: number) => `${v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;

Deno.serve(async (req) => {
  try {
    const { order_id, email, name, phone } = await req.json();
    if (!order_id) return new Response(JSON.stringify({ error: "order_id é obrigatório" }), { status: 400 });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: order, error } = await supabase.from("orders").select("*").eq("id", order_id).single();
    if (error || !order) return new Response(JSON.stringify({ error: "Pedido não encontrado" }), { status: 404 });

    const itemsList = (order.items || [])
      .map((it: { name: string; qty: number; price: number }) => `- ${it.name} x${it.qty} — ${money(it.price * it.qty)}`)
      .join("\n");

    const bodyText = `Olá ${name || ""},

O seu pedido #${order.id} na Mushy Parfum foi recebido com sucesso!

${itemsList}

Total: ${money(order.total)}

Assim que confirmarmos o seu comprovativo de pagamento, avançamos com a preparação e envio do seu pedido.

Obrigado por comprar na Mushy Parfum.`;

    let emailSent = false;
    if (RESEND_API_KEY && email) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: email,
          subject: `Pedido #${order.id} confirmado — Mushy Parfum`,
          text: bodyText,
        }),
      });
      emailSent = resendRes.ok;
      if (!resendRes.ok) console.error("Resend error:", await resendRes.text());
    }

    // EXPRESS_SMS_TODO: no SMS provider is configured yet. To text `phone`
    // instead of (or in addition to) emailing, add a provider here — e.g.
    // Twilio's REST API — gated by its own secret, the same way RESEND_API_KEY
    // gates the email above.
    const smsSent = false;

    return new Response(JSON.stringify({ emailSent, smsSent }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
