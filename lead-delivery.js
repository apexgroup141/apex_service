// Lead persistence, Telegram delivery with retries, and ad-click attribution.
// A lead is saved once; its Telegram notification is retried from the saved
// copy until delivered, so a Telegram outage never loses or duplicates a lead.

export const ATTRIBUTION_MAX_AGE_DAYS = 30;
export const MAX_NOTIFY_ATTEMPTS = 10;
const RETRY_BATCH_SIZE = 10;
const CLAIM_MS = 5 * 60 * 1000;
const FIRST_RETRY_DELAY_MS = 2 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 6 * 60 * 60 * 1000;
const TELEGRAM_TIMEOUT_MS = 8000;

const text = (value, maxLength) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const CLICK_ID_PATTERN = /^[A-Za-z0-9_-]{8,256}$/;
const LP_VARIANT_PATTERN = /^[a-z]{2,5}-[a-z]{3,12}$/;
const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

export const EMPTY_ATTRIBUTION = Object.freeze({
  gclid: null,
  gbraid: null,
  wbraid: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  lp_variant: null,
  attributed_at: null
});

export const cleanSubmissionId = (value) => {
  const id = text(value, 64);
  return SUBMISSION_ID_PATTERN.test(id) ? id : "";
};

export const sanitizeAttribution = (raw, now = Date.now()) => {
  if (!raw || typeof raw !== "object") return { ...EMPTY_ATTRIBUTION };

  const attributedAt = Date.parse(raw.attributed_at);
  const maxAgeMs = ATTRIBUTION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(attributedAt) || attributedAt > now + 5 * 60 * 1000 || now - attributedAt > maxAgeMs) {
    return { ...EMPTY_ATTRIBUTION };
  }

  const clickId = (value) => {
    const id = text(value, 256);
    return CLICK_ID_PATTERN.test(id) ? id : null;
  };
  const utm = (value) => text(value, 150) || null;
  const variant = text(raw.lp_variant, 20).toLowerCase();

  const attribution = {
    gclid: clickId(raw.gclid),
    gbraid: clickId(raw.gbraid),
    wbraid: clickId(raw.wbraid),
    utm_source: utm(raw.utm_source),
    utm_medium: utm(raw.utm_medium),
    utm_campaign: utm(raw.utm_campaign),
    lp_variant: LP_VARIANT_PATTERN.test(variant) ? variant : null,
    attributed_at: null
  };
  const hasAny = Object.values(attribution).some(Boolean);
  attribution.attributed_at = hasAny ? new Date(attributedAt).toISOString() : null;
  return attribution;
};

export const describeAttribution = (attribution) => {
  if (!attribution) return "";
  if (attribution.gclid || attribution.gbraid || attribution.wbraid) {
    return attribution.lp_variant ? `Google Ads click (${attribution.lp_variant})` : "Google Ads click";
  }
  if (attribution.utm_source) {
    return [attribution.utm_source, attribution.utm_medium, attribution.utm_campaign].filter(Boolean).join(" / ");
  }
  return "";
};

const retryDelayMs = (attempts) => Math.min(FIRST_RETRY_DELAY_MS * 2 ** Math.max(attempts - 1, 0), MAX_RETRY_DELAY_MS);

const isMissingColumnError = (error) => /no such column|has no column named/i.test(String(error?.message || error));
const isUniqueError = (error) => /UNIQUE constraint failed/i.test(String(error?.message || error));

export const findLeadBySubmissionId = async (env, submissionId) => {
  if (!env.DB || !submissionId) return null;
  try {
    return await env.DB.prepare("SELECT id FROM leads WHERE submission_id = ?").bind(submissionId).first();
  } catch (error) {
    if (isMissingColumnError(error)) return null;
    throw error;
  }
};

// Returns { id, tracked } where tracked means the notification queue columns exist,
// or { duplicate: true } when the same submission was already stored.
export const insertLead = async (env, row, notificationText) => {
  const now = row.createdAt;
  const attribution = row.attribution || EMPTY_ATTRIBUTION;
  const values = [
    row.name, row.email, row.phone, row.area, row.service, row.message,
    row.page, row.userAgent, row.ip, now
  ];

  try {
    const result = await env.DB.prepare(
      `INSERT INTO leads (name, email, phone, area, service, message, page, user_agent, ip, created_at,
         submission_id, notify_status, notify_attempts, notify_next_at, notify_payload,
         gclid, gbraid, wbraid, utm_source, utm_medium, utm_campaign, lp_variant, attributed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        ...values,
        row.submissionId || null,
        new Date(Date.parse(now) + FIRST_RETRY_DELAY_MS).toISOString(),
        notificationText,
        attribution.gclid, attribution.gbraid, attribution.wbraid,
        attribution.utm_source, attribution.utm_medium, attribution.utm_campaign,
        attribution.lp_variant, attribution.attributed_at
      )
      .run();
    const id = result?.meta?.last_row_id ?? (await findLeadBySubmissionId(env, row.submissionId))?.id ?? null;
    return { id, tracked: true };
  } catch (error) {
    if (row.submissionId && isUniqueError(error)) return { duplicate: true };
    if (!isMissingColumnError(error)) throw error;
  }

  // Migration 0005 not applied yet: keep saving leads exactly as before.
  const result = await env.DB.prepare(
    `INSERT INTO leads (name, email, phone, area, service, message, page, user_agent, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(...values)
    .run();
  return { id: result?.meta?.last_row_id ?? null, tracked: false };
};

export const sendTelegramMessage = async (env, message) => {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    throw new Error("Telegram environment variables are missing");
  }

  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  };
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    options.signal = AbortSignal.timeout(TELEGRAM_TIMEOUT_MS);
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, options);
  if (!response.ok) {
    throw new Error(`Telegram request failed with ${response.status}`);
  }
};

// Never includes the bot token: errors carry only the HTTP status or the error name.
const describeError = (error) => text(error?.name === "TimeoutError" ? "Telegram request timed out" : error?.message || error, 300);

export const recordNotificationResult = async (env, id, { ok, error, attempts }) => {
  if (!env.DB || id == null) return;
  const now = new Date();
  try {
    if (ok) {
      await env.DB.prepare(
        `UPDATE leads SET notify_status = 'sent', notify_attempts = ?, notify_sent_at = ?, notify_next_at = NULL, notify_last_error = NULL
         WHERE id = ?`
      ).bind(attempts, now.toISOString(), id).run();
      return;
    }
    const failed = attempts >= MAX_NOTIFY_ATTEMPTS;
    await env.DB.prepare(
      `UPDATE leads SET notify_status = ?, notify_attempts = ?, notify_next_at = ?, notify_last_error = ?
       WHERE id = ?`
    ).bind(
      failed ? "failed" : "pending",
      attempts,
      failed ? null : new Date(now.getTime() + retryDelayMs(attempts)).toISOString(),
      describeError(error),
      id
    ).run();
  } catch (dbError) {
    console.error("Could not record lead notification status", dbError);
  }
};

const delayedNotice = (attempts) =>
  `<i>Delayed delivery: Telegram was unavailable, this lead was saved and is being resent (attempt ${attempts}).</i>\n\n`;

// Called from the cron trigger. Claims each due row before sending so that
// overlapping runs cannot send the same notification twice.
export const retryPendingNotifications = async (env, { now = new Date() } = {}) => {
  if (!env.DB) return { sent: 0, failed: 0, skipped: 0 };
  const nowIso = now.toISOString();
  let rows;
  try {
    const query = env.DB.prepare(
      `SELECT id, notify_payload, notify_attempts FROM leads
       WHERE notify_status IN ('pending', 'sending') AND notify_next_at <= ? AND notify_payload IS NOT NULL
       ORDER BY id LIMIT ?`
    ).bind(nowIso, RETRY_BATCH_SIZE);
    rows = (await query.all()).results || [];
  } catch (error) {
    if (isMissingColumnError(error)) return { sent: 0, failed: 0, skipped: 0 };
    throw error;
  }

  const summary = { sent: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    // A 'sending' row whose claim expired belongs to a run that died mid-send.
    const claim = await env.DB.prepare(
      `UPDATE leads SET notify_status = 'sending', notify_next_at = ?
       WHERE id = ? AND notify_status IN ('pending', 'sending') AND notify_next_at <= ?`
    ).bind(new Date(now.getTime() + CLAIM_MS).toISOString(), row.id, nowIso).run();
    if (Number(claim?.meta?.changes || 0) !== 1) {
      summary.skipped += 1;
      continue;
    }

    const attempts = Number(row.notify_attempts || 0) + 1;
    try {
      await sendTelegramMessage(env, delayedNotice(attempts) + row.notify_payload);
      await recordNotificationResult(env, row.id, { ok: true, attempts });
      summary.sent += 1;
    } catch (error) {
      console.error(`Lead ${row.id} notification retry failed`, describeError(error));
      await recordNotificationResult(env, row.id, { ok: false, error, attempts });
      summary.failed += 1;
    }
  }
  return summary;
};

// Manual retry from the admin page, including notifications that gave up.
export const requeueNotification = async (env, id) => {
  const result = await env.DB.prepare(
    `UPDATE leads SET notify_status = 'pending', notify_attempts = 0, notify_next_at = ?
     WHERE id = ? AND notify_status IN ('pending', 'failed') AND notify_payload IS NOT NULL`
  ).bind(new Date().toISOString(), id).run();
  return Number(result?.meta?.changes || 0) === 1;
};

export const loadNotificationStats = async (env) => {
  if (!env.DB) return null;
  try {
    const result = await env.DB.prepare(
      `SELECT notify_status AS status, COUNT(*) AS total FROM leads
       WHERE notify_status IN ('pending', 'sending', 'failed') GROUP BY notify_status`
    ).all();
    const stats = { pending: 0, failed: 0 };
    for (const row of result.results || []) {
      if (row.status === "failed") stats.failed += Number(row.total || 0);
      else stats.pending += Number(row.total || 0);
    }
    return stats;
  } catch (error) {
    if (isMissingColumnError(error)) return null;
    throw error;
  }
};
