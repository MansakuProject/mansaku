const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ContactPayload = {
  name?: string;
  email?: string;
  category?: string;
  message?: string;
  source?: string;
};

function trimText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await req.json()) as ContactPayload;
    const name = trimText(payload.name, 80);
    const email = trimText(payload.email, 160);
    const category = trimText(payload.category, 30);
    const message = trimText(payload.message, 2000);
    const source = trimText(payload.source, 20) || "lp";

    if (!message) {
      return new Response(JSON.stringify({ error: "message_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["bug", "request", "question", "other"].includes(category)) {
      return new Response(JSON.stringify({ error: "invalid_category" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["lp", "app"].includes(source)) {
      return new Response(JSON.stringify({ error: "invalid_source" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const toEmail = Deno.env.get("CONTACT_TO_EMAIL") ?? "mansakuproject@gmail.com";
    const fromEmail = Deno.env.get("CONTACT_FROM_EMAIL") ?? "Mansaku <onboarding@resend.dev>";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "supabase_env_missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/contact_messages`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        name,
        email,
        category,
        message,
        source,
        user_agent: req.headers.get("user-agent") ?? null,
      }),
    });

    if (!insertResponse.ok) {
      const text = await insertResponse.text();
      return new Response(JSON.stringify({ error: "db_insert_failed", detail: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailSent = false;

    if (resendApiKey) {
      const categoryLabel: Record<string, string> = {
        bug: "不具合報告",
        request: "要望",
        question: "質問",
        other: "その他",
      };

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: `【Mansaku問い合わせ】${categoryLabel[category] ?? category}`,
          text: [
            `種別: ${categoryLabel[category] ?? category}`,
            `名前: ${name || "未入力"}`,
            `メール: ${email || "未入力"}`,
            `送信元: ${source}`,
            "",
            message,
          ].join("\n"),
          reply_to: email || undefined,
        }),
      });

      if (!emailResponse.ok) {
        const text = await emailResponse.text();
        return new Response(JSON.stringify({ error: "email_send_failed", detail: text }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      emailSent = true;
    }

    return new Response(JSON.stringify({ ok: true, email_sent: emailSent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "unexpected_error", detail: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
