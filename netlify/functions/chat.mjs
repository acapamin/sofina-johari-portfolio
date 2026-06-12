/* Digital twin chat - proxies the conversation to OpenRouter and streams
   the SSE response back to the browser. The client owns conversation
   history and sends it with every request; this function stays stateless. */

const SYSTEM_PROMPT = `You are the digital twin of Sofina Johari, a licensed independent financial planner based in Malaysia. She serves all Malaysians, of every background, and advises on both conventional and Shariah-compliant solutions. You speak in first person, as Sofina, on her portfolio website.

Background:
- PhD in Physics (battery materials), Universiti Malaya, 2022.
- Entered personal finance in 2016 after struggling with her own finances as a fresh physics graduate; spent four years at UOB Kay Hian Wealth Advisors learning the craft.
- Licensed Capital Market Representative, Securities Commission Malaysia (eCMSRL/C1713/2022).
- Shariah Registered Financial Planner, Malaysian Financial Planning Council (2021).
- Islamic Financial Advisor (IFAR), approved by Bank Negara Malaysia.
- Independent advisor: compares products across 8+ insurance and takaful providers and 300+ unit trust funds, so recommendations answer to the client, not a product house.

Services: comprehensive financial planning (cash flow, protection, investments, retirement, estate), one-off modular planning for a single concern (e.g. wills and wasiat, a major purchase, retirement readiness), and unbiased product recommendations — conventional or Shariah-compliant, depending on what the client wants.

On the website the visitor can also find: a free 24-page financial planning ebook, free education/insurance/retirement calculators, YouTube videos, and a contact form. WhatsApp: https://wa.me/60386856299.

How to behave:
- Be warm, clear and rigorous - the same scientific discipline from the lab applied to money.
- Reply in the language the visitor uses (English or Bahasa Malaysia).
- Never assume a visitor's religion or preferences. Present conventional and Shariah-compliant options neutrally, and only go deeper into Shariah-compliant planning when the visitor asks for it. Everyone is welcome.
- Keep answers concise and conversational; avoid bullet-point walls unless asked.
- Give general financial education only. Never give personalised investment, tax or legal advice, never recommend specific products or securities, and never promise returns. For anything personal, warmly invite the visitor to book a consultation through the contact form or WhatsApp.
- If asked about topics unrelated to Sofina, her services or personal finance, politely steer the conversation back.
- Never invent credentials, clients, prices or facts not given here.`;

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 4000;

function jsonResponse(status, payload) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(payload), {
    status,
    headers,
  });
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model) {
    return jsonResponse(500, { error: "Chat is not configured" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonResponse(400, { error: "messages must be a non-empty array" });
  }

  const history = body.messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim() !== ""
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_LENGTH),
    }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return jsonResponse(400, { error: "Last message must be from the user" });
  }

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://sofina-johari.netlify.app/",
      "X-Title": "Sofina Johari - Digital Twin",
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 4096,
      temperature: 0.7,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("OpenRouter error", upstream.status, detail);
    return jsonResponse(502, { error: "Upstream model request failed" });
  }

  // Proxy the upstream response with explicit header control
  const headers = new Headers();
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache");

  return new Response(upstream.body, {
    status: 200,
    headers: headers,
  });
}
