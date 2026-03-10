// YetkinLider — Yeni Üye Bildirimi
// Supabase Database Webhook'u bu fonksiyonu çağırır:
//   Tablo: profiles  |  Event: INSERT
//
// Gerekli secret: RESEND_API_KEY (Supabase Dashboard > Settings > Secrets)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ADMIN_EMAIL = "muhamedparlak@gmail.com";
const FROM_EMAIL  = "YetkinLider <bildirim@yetkinlider.com>";

serve(async (req: Request) => {
  // Sadece POST kabul et
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: { record?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const record = payload.record || {};
  const displayName = (record.display_name as string) || "—";
  const email       = (record.email as string)        || "—";
  const role        = (record.role as string)         || "user";
  const createdAt   = (record.created_at as string)   || new Date().toISOString();

  const formattedDate = new Date(createdAt).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("[notify-admin] RESEND_API_KEY secret eksik!");
    return new Response("Missing API key", { status: 500 });
  }

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f9fafb;border-radius:12px;overflow:hidden">
      <div style="background:#1e293b;padding:24px 28px">
        <h2 style="margin:0;color:#fff;font-size:18px">🎉 Yeni Üye Kaydı!</h2>
        <p style="margin:6px 0 0;color:rgba(255,255,255,.6);font-size:13px">YetkinLider'e yeni bir üye katıldı</p>
      </div>
      <div style="padding:24px 28px;background:#fff">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#64748b;width:100px">İsim</td><td style="padding:8px 0;font-weight:600">${displayName}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">E-posta</td><td style="padding:8px 0">${email}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Rol</td><td style="padding:8px 0"><span style="background:#f1f5f9;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:700">${role}</span></td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Kayıt</td><td style="padding:8px 0;color:#94a3b8;font-size:13px">${formattedDate}</td></tr>
        </table>
        <div style="margin-top:20px">
          <a href="https://yetkinlider.com/admin.html" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600">Admin Paneline Git →</a>
        </div>
      </div>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from   : FROM_EMAIL,
      to     : [ADMIN_EMAIL],
      subject: `🎉 Yeni Üye: ${displayName} (${email})`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[notify-admin] Resend hatası:", err);
    return new Response("Email send failed", { status: 500 });
  }

  console.log(`[notify-admin] Bildirim gönderildi: ${email}`);
  return new Response("ok", { status: 200 });
});
