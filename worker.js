const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });

const clean = (value, maxLength = 1000) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const escapeHtml = (value) =>
  clean(value, 3500)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const formatLeadMessage = (lead, request) => {
  const page = request.headers.get("referer") || "Direct visit";
  const submittedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short"
  });

  return [
    "<b>New Apex HVAC request</b>",
    "",
    `<b>Name:</b> ${escapeHtml(lead.name)}`,
    `<b>Phone:</b> ${escapeHtml(lead.phone)}`,
    `<b>Area:</b> ${escapeHtml(lead.area || "Not provided")}`,
    `<b>Service:</b> ${escapeHtml(lead.service || "Not selected")}`,
    `<b>Message:</b> ${escapeHtml(lead.message || "No message")}`,
    "",
    `<b>Page:</b> ${escapeHtml(page)}`,
    `<b>Submitted:</b> ${escapeHtml(submittedAt)}`
  ].join("\n");
};

const sendTelegramMessage = async (env, text) => {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    throw new Error("Telegram environment variables are missing");
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram request failed with ${response.status}`);
  }
};

const logEvent = async (env, type, payload, request) => {
  if (!env.DB) return;

  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "";

  await env.DB.prepare(
    `INSERT INTO events (type, payload, page, user_agent, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      type,
      JSON.stringify(payload),
      clean(payload.page || request.headers.get("referer") || "", 500),
      clean(request.headers.get("user-agent") || "", 500),
      clean(ip, 80),
      new Date().toISOString()
    )
    .run();
};

const handleLead = async (request, env) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let lead;
  try {
    lead = await request.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  if (clean(lead.company)) {
    return json({ ok: true });
  }

  const name = clean(lead.name, 120);
  const phone = clean(lead.phone, 80);
  const service = clean(lead.service, 160);

  if (!name || !phone || !service) {
    return json({ error: "Missing required fields" }, 400);
  }

  const payload = {
    name,
    phone,
    service,
    area: clean(lead.area, 160),
    message: clean(lead.message, 1600),
    page: clean(request.headers.get("referer") || "", 500)
  };

  await logEvent(env, "lead", payload, request);
  await sendTelegramMessage(env, formatLeadMessage(payload, request));

  return json({ ok: true });
};

const handleCallClick = async (request, env) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let event = {};
  try {
    event = await request.json();
  } catch {
    return json({ ok: true });
  }

  await logEvent(env, "phone_click", {
    phone: clean(event.phone, 80),
    label: clean(event.label, 160),
    page: clean(event.page, 500)
  }, request);

  return json({ ok: true });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.protocol === "http:") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/lead") {
      try {
        return await handleLead(request, env);
      } catch (error) {
        console.error(error);
        return json({ error: "Could not send request" }, 500);
      }
    }

    if (url.pathname === "/api/call-click") {
      try {
        return await handleCallClick(request, env);
      } catch (error) {
        console.error(error);
        return json({ ok: true });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
