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

const normalizeEmail = (value) => clean(value, 254).toLowerCase();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const normalizeUsPhone = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  return digits.length === 10 ? `+1${digits}` : "";
};

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
    `<b>Email:</b> ${escapeHtml(lead.email)}`,
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

const getRequestMeta = (request) => {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "";

  return {
    page: clean(request.headers.get("referer") || "", 500),
    userAgent: clean(request.headers.get("user-agent") || "", 500),
    ip: clean(ip, 80),
    createdAt: new Date().toISOString()
  };
};

const logLead = async (env, lead, request) => {
  if (!env.DB) return;

  const meta = getRequestMeta(request);

  try {
    await env.DB.prepare(
      `INSERT INTO leads (name, email, phone, area, service, message, page, user_agent, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        lead.name,
        lead.email,
        lead.phone,
        lead.area,
        lead.service,
        lead.message,
        lead.page || meta.page,
        meta.userAgent,
        meta.ip,
        meta.createdAt
      )
      .run();
  } catch (error) {
    console.error("Could not log lead", error);
  }
};

const logCallClick = async (env, event, request) => {
  if (!env.DB) return;

  const meta = getRequestMeta(request);

  try {
    await env.DB.prepare(
      `INSERT INTO call_clicks (phone, label, page, user_agent, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        clean(event.phone, 80),
        clean(event.label, 160),
        clean(event.page, 500) || meta.page,
        meta.userAgent,
        meta.ip,
        meta.createdAt
      )
      .run();
  } catch (error) {
    console.error("Could not log call click", error);
  }
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
  const email = normalizeEmail(lead.email);
  const phone = normalizeUsPhone(lead.phone);
  const area = clean(lead.area, 160);
  const service = clean(lead.service, 160);
  const message = clean(lead.message, 1600);

  if (!name || !email || !isValidEmail(email) || !phone || !area || !service || !message) {
    return json({ error: "Missing required fields" }, 400);
  }

  const payload = {
    name,
    email,
    phone,
    service,
    area,
    message,
    page: clean(request.headers.get("referer") || "", 500)
  };

  await logLead(env, payload, request);
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

  await logCallClick(env, event, request);

  return json({ ok: true });
};

const isAuthorizedAdmin = (request, env) => {
  const token = clean(env.ADMIN_TOKEN, 500);
  const authorization = request.headers.get("Authorization") || "";
  return Boolean(token) && authorization === `Bearer ${token}`;
};

const first = async (statement, values = []) => {
  if (!values.length) return statement.first();
  return statement.bind(...values).first();
};

const handleAdminLeads = async (request, env) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!isAuthorizedAdmin(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!env.DB) {
    return json({ error: "Database is not configured" }, 503);
  }

  const params = new URL(request.url).searchParams;
  const q = clean(params.get("q"), 120);
  const service = clean(params.get("service"), 160);
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 100);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);
  const where = [];
  const values = [];

  if (q) {
    const like = `%${q}%`;
    where.push("(name LIKE ? OR email LIKE ? OR phone LIKE ? OR area LIKE ? OR service LIKE ? OR message LIKE ?)");
    values.push(like, like, like, like, like, like);
  }

  if (service) {
    where.push("service = ?");
    values.push(service);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await first(env.DB.prepare(`SELECT COUNT(*) AS total FROM leads ${whereSql}`), values);
  const rows = await env.DB.prepare(
    `SELECT id, name, email, phone, area, service, message, page, user_agent, ip, created_at
     FROM leads
     ${whereSql}
     ORDER BY datetime(created_at) DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...values, limit, offset)
    .all();

  let callClicks = 0;
  try {
    const callRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM call_clicks").first();
    callClicks = Number(callRow?.total || 0);
  } catch (error) {
    console.error("Could not load call click count", error);
  }

  return json({
    leads: rows.results || [],
    total: Number(totalRow?.total || 0),
    limit,
    offset,
    stats: {
      callClicks
    }
  });
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

    if (url.pathname === "/api/admin/leads") {
      try {
        return await handleAdminLeads(request, env);
      } catch (error) {
        console.error(error);
        return json({ error: "Could not load leads" }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
