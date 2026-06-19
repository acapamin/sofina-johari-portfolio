/* "Send to Sofina" — emails the Financial Foundation roadmap to Sofina via Resend.
   Replaces the old Netlify Forms notification. The client POSTs JSON; this
   function validates it, formats an email, and hands it to Resend.

   Env (set in Netlify → Site configuration → Environment variables):
     RESEND_API_KEY  (required)  — your Resend API key

   The recipient (TO) and sender (FROM) are hardcoded below and are
   intentionally not configurable via env. FROM is a verified
   eazylaundry.biz address. */

const TO = "sofinajohari.uwealth@gmail.com";
const FROM = "Financial Foundation <roadmap@eazylaundry.biz>";
const MAX = { short: 200, remark: 2000, report: 20000 };

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clip(v, n) {
  return (typeof v === "string" ? v : "").trim().slice(0, n);
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("send-roadmap: RESEND_API_KEY is not set");
    return jsonResponse(500, { ok: false, error: "Email is not configured" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  // Honeypot — silently accept bot submissions without sending.
  if (clip(body["bot-field"], 50)) {
    return jsonResponse(200, { ok: true });
  }

  const name = clip(body.name, MAX.short);
  const email = clip(body.email, MAX.short);
  const whatsapp = clip(body.whatsapp, MAX.short);
  const subscribe = clip(body.subscribe, MAX.short) || "No";
  const readiness = clip(body.readiness, 16);
  const remark = clip(body.remark, MAX.remark);
  const report = clip(body.report, MAX.report);

  if (!name || !email || !whatsapp) {
    return jsonResponse(400, { ok: false, error: "Name, email and WhatsApp are required" });
  }
  if (!EMAIL_RE.test(email)) {
    return jsonResponse(400, { ok: false, error: "Please provide a valid email address" });
  }

  const subject = `Financial Foundation roadmap — ${name}${readiness ? ` (${readiness} ready)` : ""}`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0b1f1a;line-height:1.5">
      <h2 style="margin:0 0 4px">New Financial Foundation roadmap</h2>
      <p style="margin:0 0 16px;color:#5b6b65">A visitor sent their Four Pillars roadmap from the website.</p>
      <table style="border-collapse:collapse;margin-bottom:16px">
        <tr><td style="padding:2px 12px 2px 0;color:#5b6b65">Name</td><td><b>${escapeHtml(name)}</b></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#5b6b65">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#5b6b65">WhatsApp</td><td><a href="https://wa.me/${escapeHtml(whatsapp.replace(/[^0-9]/g, ""))}">${escapeHtml(whatsapp)}</a></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#5b6b65">Broadcast</td><td>${escapeHtml(subscribe)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#5b6b65">Readiness</td><td><b>${escapeHtml(readiness)}</b></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#5b6b65;vertical-align:top">Note</td><td>${escapeHtml(remark || "(none)")}</td></tr>
      </table>
      <pre style="white-space:pre-wrap;font-family:'Courier New',monospace;font-size:13px;background:#f6f1e7;border:1px solid #d2caB9;padding:14px;border-radius:6px">${escapeHtml(report)}</pre>
    </div>`;

  const text =
    `New Financial Foundation roadmap\n\n` +
    `Name: ${name}\nEmail: ${email}\nWhatsApp: ${whatsapp}\n` +
    `Broadcast: ${subscribe}\nReadiness: ${readiness}\nNote: ${remark || "(none)"}\n\n` +
    `${"=".repeat(48)}\n${report}`;

  let resendRes, resendJson;
  try {
    resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject,
        html,
        text,
      }),
    });
    resendJson = await resendRes.json().catch(() => ({}));
  } catch (err) {
    console.error("send-roadmap: network error calling Resend", err);
    return jsonResponse(502, { ok: false, error: "Could not reach the email service" });
  }

  if (!resendRes.ok) {
    console.error("send-roadmap: Resend error", resendRes.status, resendJson);
    return jsonResponse(502, {
      ok: false,
      error: (resendJson && resendJson.message) || "Email service rejected the request",
    });
  }

  return jsonResponse(200, { ok: true, id: resendJson && resendJson.id });
}
