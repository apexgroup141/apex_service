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

const tableExists = async (env, table) => {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").bind(table).first();
  return Boolean(row?.name);
};

const tableHasColumn = async (env, table, column) => {
  if (!(await tableExists(env, table))) return false;
  const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  return (result.results || []).some((row) => row.name === column);
};

const loadStructuredLeads = async (env, { q, service, from, to, limit, offset }) => {
  if (!(await tableExists(env, "leads"))) {
    return { leads: [], total: 0 };
  }

  const hasEmail = await tableHasColumn(env, "leads", "email");
  const where = [];
  const values = [];

  if (q) {
    const like = `%${q}%`;
    const columns = hasEmail
      ? ["name", "email", "phone", "area", "service", "message"]
      : ["name", "phone", "area", "service", "message"];
    where.push(`(${columns.map((column) => `${column} LIKE ?`).join(" OR ")})`);
    values.push(...columns.map(() => like));
  }

  if (service) {
    where.push("service = ?");
    values.push(service);
  }

  if (from) {
    where.push("datetime(created_at) >= datetime(?)");
    values.push(from);
  }

  if (to) {
    where.push("datetime(created_at) <= datetime(?)");
    values.push(to);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const emailSelect = hasEmail ? "email" : "'' AS email";
  const totalRow = await first(env.DB.prepare(`SELECT COUNT(*) AS total FROM leads ${whereSql}`), values);
  const rows = await env.DB.prepare(
    `SELECT id, 'lead' AS source, name, ${emailSelect}, phone, area, service, message, page, user_agent, ip, created_at
     FROM leads
     ${whereSql}
     ORDER BY datetime(created_at) DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...values, limit, offset)
    .all();

  return {
    leads: rows.results || [],
    total: Number(totalRow?.total || 0)
  };
};

const loadLegacyEventLeads = async (env, { q, service, from, to, limit }) => {
  if (!(await tableExists(env, "events"))) {
    return { leads: [], total: 0 };
  }

  const where = ["type = 'lead'"];
  const values = [];

  if (q) {
    const like = `%${q}%`;
    where.push("(payload LIKE ? OR page LIKE ?)");
    values.push(like, like);
  }

  if (service) {
    where.push("json_extract(payload, '$.service') = ?");
    values.push(service);
  }

  if (from) {
    where.push("datetime(created_at) >= datetime(?)");
    values.push(from);
  }

  if (to) {
    where.push("datetime(created_at) <= datetime(?)");
    values.push(to);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const totalRow = await first(env.DB.prepare(`SELECT COUNT(*) AS total FROM events ${whereSql}`), values);
  const rows = await env.DB.prepare(
    `SELECT
       id,
       'event' AS source,
       json_extract(payload, '$.name') AS name,
       COALESCE(json_extract(payload, '$.email'), '') AS email,
       json_extract(payload, '$.phone') AS phone,
       json_extract(payload, '$.area') AS area,
       json_extract(payload, '$.service') AS service,
       json_extract(payload, '$.message') AS message,
       page,
       user_agent,
       ip,
       created_at
     FROM events
     ${whereSql}
     ORDER BY datetime(created_at) DESC
     LIMIT ?`
  )
    .bind(...values, limit)
    .all();

  return {
    leads: rows.results || [],
    total: Number(totalRow?.total || 0)
  };
};

const ensureLeadWritesReady = async (env) => {
  if (!(await tableExists(env, "leads"))) {
    return "The leads table is missing. Apply the D1 migrations first.";
  }
  if (!(await tableHasColumn(env, "leads", "email"))) {
    return "The email column is missing. Apply migration 0003_add_email_to_leads.sql first.";
  }
  return "";
};

const readJsonBody = async (request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const normalizeAdminLead = (body) => {
  const lead = {
    name: clean(body?.name, 120),
    email: normalizeEmail(body?.email),
    phone: normalizeUsPhone(body?.phone),
    area: clean(body?.area, 160),
    service: clean(body?.service, 160),
    message: clean(body?.message, 1600)
  };

  if (!lead.name || !lead.email || !isValidEmail(lead.email) || !lead.phone || !lead.area || !lead.service || !lead.message) {
    return { error: "Fill in name, valid email, valid US phone, area, service, and message." };
  }

  return { lead };
};

const createAdminLead = async (request, env) => {
  const schemaError = await ensureLeadWritesReady(env);
  if (schemaError) return json({ error: schemaError }, 409);

  const body = await readJsonBody(request);
  const { lead, error } = normalizeAdminLead(body);
  if (error) return json({ error }, 400);

  const meta = getRequestMeta(request);
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
      "Admin entry",
      meta.userAgent,
      meta.ip,
      meta.createdAt
    )
    .run();

  return json({ ok: true }, 201);
};

const updateStructuredLead = async (request, env, id) => {
  const schemaError = await ensureLeadWritesReady(env);
  if (schemaError) return json({ error: schemaError }, 409);

  const body = await readJsonBody(request);
  const { lead, error } = normalizeAdminLead(body);
  if (error) return json({ error }, 400);

  await env.DB.prepare(
    `UPDATE leads
     SET name = ?, email = ?, phone = ?, area = ?, service = ?, message = ?
     WHERE id = ?`
  )
    .bind(lead.name, lead.email, lead.phone, lead.area, lead.service, lead.message, id)
    .run();

  return json({ ok: true });
};

const updateLegacyEventLead = async (request, env, id) => {
  if (!(await tableExists(env, "events"))) return json({ error: "Legacy events table is missing." }, 404);

  const body = await readJsonBody(request);
  const { lead, error } = normalizeAdminLead(body);
  if (error) return json({ error }, 400);

  await env.DB.prepare("UPDATE events SET payload = ? WHERE id = ? AND type = 'lead'")
    .bind(JSON.stringify(lead), id)
    .run();

  return json({ ok: true });
};

const handleAdminLeadItem = async (request, env, source, id) => {
  if (!isAuthorizedAdmin(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!env.DB) {
    return json({ error: "Database is not configured" }, 503);
  }

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 1) {
    return json({ error: "Invalid client id" }, 400);
  }

  if (request.method === "PATCH") {
    if (source === "lead") return updateStructuredLead(request, env, numericId);
    if (source === "event") return updateLegacyEventLead(request, env, numericId);
    return json({ error: "Invalid client source" }, 400);
  }

  if (request.method === "DELETE") {
    if (source === "lead") {
      await env.DB.prepare("DELETE FROM leads WHERE id = ?").bind(numericId).run();
      return json({ ok: true });
    }
    if (source === "event") {
      await env.DB.prepare("DELETE FROM events WHERE id = ? AND type = 'lead'").bind(numericId).run();
      return json({ ok: true });
    }
    return json({ error: "Invalid client source" }, 400);
  }

  return json({ error: "Method not allowed" }, 405);
};

const handleAdminLeads = async (request, env) => {
  if (!isAuthorizedAdmin(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!env.DB) {
    return json({ error: "Database is not configured" }, 503);
  }

  if (request.method === "POST") {
    return createAdminLead(request, env);
  }

  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const params = new URL(request.url).searchParams;
  const q = clean(params.get("q"), 120);
  const service = clean(params.get("service"), 160);
  const fromDate = clean(params.get("from"), 20);
  const toDate = clean(params.get("to"), 20);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? `${fromDate}T00:00:00.000Z` : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(toDate) ? `${toDate}T23:59:59.999Z` : "";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 100);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);
  const structured = await loadStructuredLeads(env, { q, service, from, to, limit, offset });
  const legacy = await loadLegacyEventLeads(env, { q, service, from, to, limit });
  const leads = [...structured.leads, ...legacy.leads]
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .slice(0, limit);

  let callClicks = 0;
  try {
    if (await tableExists(env, "call_clicks")) {
      const callRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM call_clicks").first();
      callClicks += Number(callRow?.total || 0);
    }
    if (await tableExists(env, "events")) {
      const legacyCallRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM events WHERE type = 'phone_click'").first();
      callClicks += Number(legacyCallRow?.total || 0);
    }
  } catch (error) {
    console.error("Could not load call click count", error);
  }

  return json({
    leads,
    total: structured.total + legacy.total,
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

    const adminLeadMatch = url.pathname.match(/^\/api\/admin\/leads\/([^/]+)\/(\d+)$/);
    if (adminLeadMatch) {
      try {
        return await handleAdminLeadItem(request, env, adminLeadMatch[1], adminLeadMatch[2]);
      } catch (error) {
        console.error(error);
        return json({ error: "Could not update client" }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
