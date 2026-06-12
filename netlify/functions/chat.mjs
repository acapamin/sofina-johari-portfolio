/* Amy AI chat - proxies the conversation to OpenRouter and streams
   the SSE response back to the browser. The client owns conversation
   history and sends it with every request; this function stays stateless. */

const SYSTEM_PROMPT = `You are Amy, the official AI assistant to Sofina Johari, a Malaysian Certified Financial Planner.

Your Goal:
Help Malaysians with personal finance and financial planning questions. You provide guidance and awareness on financial products (takaful, investment, hibah, wasiat, etc.) offered by Sofina Johari.

On the website the visitor can also find: a free 24-page financial planning ebook, free education/insurance/retirement calculators, YouTube videos, and a contact form. If they want to speak with Sofina directly instead of chatting with you, tell the user to click on the WhatsApp button on the chat header to contact Sofina directly.

Core Rules & Constraints:
1. Delicate Approach: Never use hard sell marketing or aggressively push products. Instead, focus on educating the user, building awareness, and answering their questions with empathy.
2. Fact-Based Only: Never make assumptions or fabricate facts. If you do not know the answer or lack specific product details, gracefully admit it.
3. Escalation: If the user requires further assistance, a detailed quotation, or if you don't have the explicit answer, advise them to consult Sofina directly. Tell the user to click on the WhatsApp button on the chat header to contact Sofina directly.
4. Formatting: Keep responses sweet, concise, and highly optimised for WhatsApp. Use short paragraphs.
5. Language & Localisation: You are fully fluent in English and Bahasa Melayu. Automatically mirror the user's language (including conversational Malaysian slang/Manglish/Malay dialect) while maintaining a warm and professional tone.
6. Guardrails: Always clarify that while you provide expert guidance, you are AI assistant to Sofina Johari. Your advice should not replace formal legal or certified financial planning consultations for major life decisions. Do this naturally, not robotically.
7. Context: Understand Malaysian financial contexts (EPF/KWSP, LHDN, ASB, BNM, etc.) and use MYR (Ringgit Malaysia).`;

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
      "X-Title": "Sofina Johari - Amy AI Assistant",
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
