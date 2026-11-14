import {
  fetchGoogleBusinessReviews,
  injectGoogleReviewsIntoHtml
} from "./google-business-reviews.js";
import { MINI_SPLIT_PRICE_RANGES } from "./mini-split-pricing.js";
import { applyLandingVariant, resolveLandingVariant } from "./landing-variants.js";
import {
  cleanSubmissionId,
  describeAttribution,
  findLeadBySubmissionId,
  insertLead,
  isChatGptAds,
  loadNotificationStats,
  recordNotificationResult,
  releaseHeldLead,
  requeueNotification,
  retryPendingNotifications,
  sanitizeAttribution,
  sendTelegramMessage
} from "./lead-delivery.js";
import {
  BURST_LIMIT,
  HOURLY_CAP,
  MAX_BODY_BYTES,
  assessLead,
  countRecentLeads,
  publicGuardConfig,
  verifyTurnstile
} from "./lead-guard.js";
import { YARD_CATEGORIES, YARD_EQUIPMENT, YARD_LEAD_SOURCE, YARD_REDIRECT_URL, YARD_TASKS } from "./yard-lead.js";

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
  // A real US number: neither the area code nor the exchange starts with 0 or 1.
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? `+1${digits}` : "";
};

const escapeHtml = (value) =>
  clean(value, 3500)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const miniSplitPriceRanges = MINI_SPLIT_PRICE_RANGES;

const estimateLabels = {
  replacement: "Replacement",
  new_install: "New installation",
  add_area: "Add another area",
  not_sure: "Not sure",
  mini_split: "Mini-Split / Ductless System",
  central_hvac: "Central HVAC System",
  baseboard_wall: "Baseboard / Wall Heaters",
  window_portable_ac: "Window / Portable AC",
  none: "No existing system",
  under_500: "Under 500 sq ft",
  "500_1000": "500–1,000 sq ft",
  "1000_1500": "1,000–1,500 sq ft",
  "1500_2000": "1,500–2,000 sq ft",
  "2000_2500": "2,000–2,500 sq ft",
  "2500_plus": "2,500+ sq ft",
  "1": "1",
  "2": "2",
  "3": "3",
  "4_plus": "4+",
  lower_upfront_cost: "Lower upfront cost",
  energy_efficiency: "Energy efficiency",
  quiet_operation: "Quiet operation",
  cold_weather: "Cold-weather performance",
  warranty_value: "Warranty & long-term value",
  good: "Good",
  better: "Better",
  best: "Best",
  furnace_ac: "Furnace + central A/C",
  furnace_only: "Furnace only",
  electric_baseboard: "Electric heat / baseboard",
  propane_oil: "Propane or oil heating",
  yes: "Yes",
  no: "No",
  under_1000: "Under 1,000 sq ft",
  all_electric: "All-electric heat pump",
  dual_fuel: "Heat pump + furnace (dual fuel)",
  comfort: "Comfort",
  essential: "Essential",
  premium: "Premium",
  asap: "As soon as possible",
  "1_3_months": "In 1–3 months",
  researching: "Just researching prices"
};

const labelEstimateValue = (value) => estimateLabels[value] || clean(value, 120) || "Not provided";

// Which form sent the lead (lead_source), shown apart from the ad channel and the service.
const FORM_LABELS = {
  mini_split_instant_estimate: "Mini-split instant estimate",
  hvac_quiz: "Heat pump instant estimate",
  [YARD_LEAD_SOURCE]: "Yard page form"
};

const sourceLine = (lead) => {
  const source = describeAttribution(lead.attribution);
  if (!source) return [];
  const lines = [`<b>Source:</b> ${escapeHtml(source)}`];
  if (isChatGptAds(lead.attribution)) {
    const { utm_campaign: campaign, utm_content: ad } = lead.attribution;
    if (campaign) lines.push(`<b>Campaign:</b> ${escapeHtml(campaign)}`);
    if (ad) lines.push(`<b>Ad:</b> ${escapeHtml(ad)}`);
    lines.push(`<b>Form:</b> ${escapeHtml(FORM_LABELS[lead.source] || "Estimate request form")}`);
  }
  return lines;
};

export const formatInstantEstimateMessage = (lead, request) => {
  const estimate = lead.estimate;
  const isHeatPump = estimate.systemType === "heat_pump";
  const ranges = miniSplitPriceRanges[estimate.zones] || null;
  const preferredContact = lead.preferredContactMethods.length === 2
    ? "Phone and Email"
    : lead.preferredContactMethods[0] === "phone"
      ? "Phone"
      : "Email";
  const submittedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short"
  });
  const contactLines = [
    `<b>Preferred contact:</b> ${preferredContact}`,
    lead.phone ? `<b>Phone:</b> ${escapeHtml(lead.phone)}` : "",
    lead.email ? `<b>Email:</b> ${escapeHtml(lead.email)}` : ""
  ].filter(Boolean);
  return [
    isHeatPump ? "<b>New HEAT PUMP LEAD</b>" : "<b>New Mini-Split Instant Estimate Lead</b>",
    "",
    `<b>Timeline:</b> ${escapeHtml(labelEstimateValue(estimate.timeline))}`,
    `<b>Project type:</b> ${escapeHtml(labelEstimateValue(estimate.projectType))}`,
    `<b>Existing system:</b> ${escapeHtml(labelEstimateValue(estimate.existingSystem))}`,
    isHeatPump ? `<b>Ductwork:</b> ${escapeHtml(labelEstimateValue(estimate.ductwork))}` : "",
    `<b>${isHeatPump ? "Home" : "Space"} size:</b> ${escapeHtml(labelEstimateValue(estimate.spaceSize))}`,
    isHeatPump ? `<b>System preference:</b> ${escapeHtml(labelEstimateValue(estimate.systemPreference))}` : `<b>Zones:</b> ${escapeHtml(labelEstimateValue(estimate.zones))}`,
    `<b>Priorities:</b> ${escapeHtml(estimate.priorities.map(labelEstimateValue).join(", "))}`,
    "",
    isHeatPump ? (estimate.priceRange ? `<b>Selected price range:</b> ${escapeHtml(estimate.priceRange)}` : "<b>Price range:</b> To be determined after assessment") : "<b>Options shown:</b>",
    isHeatPump ? "" : `<b>Good:</b> ${escapeHtml(ranges?.good || "Planning level — zones to be confirmed")}`,
    isHeatPump ? "" : `<b>Better:</b> ${escapeHtml(ranges?.better || "Planning level — zones to be confirmed")}`,
    isHeatPump ? "" : `<b>Best:</b> ${escapeHtml(ranges?.best || "Planning level — zones to be confirmed")}`,
    "",
    `<b>Selected option:</b> ${escapeHtml(labelEstimateValue(estimate.selectedTier))}`,
    "",
    `<b>First Name:</b> ${escapeHtml(lead.name)}`,
    ...contactLines,
    `<b>ZIP Code:</b> ${escapeHtml(lead.area.replace(/^WA\s+/i, ""))}`,
    "",
    `<b>Page:</b> ${escapeHtml(request.headers.get("referer") || "Direct visit")}`,
    ...sourceLine(lead),
    `<b>Submitted:</b> ${escapeHtml(submittedAt)}`
  ].filter((line) => line !== "").join("\n");
};

// The /yard page (yard-sign QR code) asks for a category and a task instead of a free-form service.
// Returns { lead } or { error } for a /yard submission.
export const normalizeYardLead = (raw) => {
  const category = clean(raw.category, 40);
  const task = clean(raw.task, 40);
  const config = YARD_CATEGORIES[category];
  if (!config || !config.tasks.includes(task)) return { error: "Choose what we can help you with." };

  const description = category === "other" ? clean(raw.description, 1000) : "";
  if (category === "other" && !description) return { error: "Tell us what we can help you with." };
  const equipmentKey = category === "repair_maintenance" ? clean(raw.equipment, 40) : "";
  const equipment = YARD_EQUIPMENT[equipmentKey] || "";

  const name = clean(raw.name, 120);
  const method = clean(raw.preferred_contact_method, 20).toLowerCase();
  const phone = method === "phone" ? normalizeUsPhone(raw.phone) : "";
  const email = method === "email" ? normalizeEmail(raw.email) : "";
  const zip = clean(raw.zip, 10);
  const details = clean(raw.details, 1600);

  if (!name) return { error: "Enter your name." };
  if (method !== "phone" && method !== "email") return { error: "Choose phone or email." };
  if (method === "phone" && !phone) return { error: "Enter a valid 10-digit US phone number." };
  if (method === "email" && !isValidEmail(email)) return { error: "Enter a valid email address." };
  if (!/^\d{5}(-\d{4})?$/.test(zip)) return { error: "Enter a valid ZIP code." };

  const categoryLabel = config.label;
  const taskLabel = YARD_TASKS[task];
  const service = category === "other" ? "Other request" : `${categoryLabel}: ${taskLabel}`;
  const contactLabel = method === "phone" ? "Phone" : "Email";
  const message = [
    "Yard sign page request",
    `Equipment/category: ${categoryLabel}`,
    `Task: ${taskLabel}`,
    equipment ? `Equipment type: ${equipment}` : "",
    description ? `Description: ${description}` : "",
    details ? `Additional details: ${details}` : "",
    `Preferred contact: ${contactLabel}`
  ].filter(Boolean).join(" | ");

  return {
    lead: {
      name, phone, email, zip, details, description, equipment, method,
      category, task, categoryLabel, taskLabel, contactLabel,
      area: `WA ${zip}`,
      service,
      message
    }
  };
};

export const formatYardLeadMessage = (lead, request) => {
  const yard = lead.yard;
  const submittedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short"
  });
  const isInstall = yard.task === "install_replace";
  return [
    isInstall ? "<b>New FREE ESTIMATE request (yard page)</b>" : yard.category === "other" ? "<b>New request (yard page)</b>" : "<b>New SERVICE request (yard page)</b>",
    "",
    `<b>Equipment/category:</b> ${escapeHtml(yard.categoryLabel)}`,
    `<b>Task:</b> ${escapeHtml(yard.taskLabel)}`,
    yard.equipment ? `<b>Equipment type:</b> ${escapeHtml(yard.equipment)}` : null,
    yard.description ? `<b>Description:</b> ${escapeHtml(yard.description)}` : null,
    yard.details ? `<b>Additional details:</b> ${escapeHtml(yard.details)}` : null,
    "",
    `<b>Name:</b> ${escapeHtml(yard.name)}`,
    `<b>Preferred contact:</b> ${yard.contactLabel}`,
    yard.phone ? `<b>Phone:</b> ${escapeHtml(yard.phone)}` : null,
    yard.email ? `<b>Email:</b> ${escapeHtml(yard.email)}` : null,
    `<b>ZIP Code:</b> ${escapeHtml(yard.zip)}`,
    "",
    `<b>Page:</b> ${escapeHtml(request.headers.get("referer") || "Direct visit")}`,
    `<b>Source:</b> ${escapeHtml(describeAttribution(lead.attribution) || "No campaign tags (direct visit)")}`,
    `<b>Submitted:</b> ${escapeHtml(submittedAt)}`
  ].filter((line) => line !== null).join("\n");
};

const formatLeadMessage = (lead, request) => {
  if (lead.source === YARD_LEAD_SOURCE && lead.yard) {
    return formatYardLeadMessage(lead, request);
  }
  if ((lead.source === "mini_split_instant_estimate" || lead.source === "hvac_quiz") && lead.estimate) {
    return formatInstantEstimateMessage(lead, request);
  }
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
    `<b>Email:</b> ${escapeHtml(lead.email || "Not provided")}`,
    `<b>Phone:</b> ${escapeHtml(lead.phone)}`,
    `<b>Area:</b> ${escapeHtml(lead.area || "Not provided")}`,
    `<b>Service:</b> ${escapeHtml(lead.service || "Not selected")}`,
    `<b>Message:</b> ${escapeHtml(lead.message || "No message")}`,
    "",
    `<b>Page:</b> ${escapeHtml(page)}`,
    ...sourceLine(lead),
    `<b>Submitted:</b> ${escapeHtml(submittedAt)}`
  ].join("\n");
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

const saveLead = async (env, lead, request, notificationText) => {
  if (!env.DB) return null;

  const meta = getRequestMeta(request);

  try {
    return await insertLead(env, {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      area: lead.area,
      service: lead.service,
      message: lead.message,
      page: lead.page || meta.page,
      userAgent: meta.userAgent,
      ip: meta.ip,
      createdAt: meta.createdAt,
      submissionId: lead.submissionId,
      attribution: lead.attribution,
      heldReasons: lead.heldReasons || ""
    }, notificationText);
  } catch (error) {
    console.error("Could not log lead", error);
    return null;
  }
};

// Two quick attempts inside the request; anything still failing is retried by the cron trigger.
const deliverLeadNotification = async (env, text) => {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await sendTelegramMessage(env, text);
      return { ok: true, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  return { ok: false, attempts: 2, error: lastError };
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

  if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) {
    return json({ error: "Request is too large" }, 413);
  }

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return json({ error: "Request is too large" }, 413);
  }

  let lead;
  try {
    lead = JSON.parse(body);
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (!lead || typeof lead !== "object" || Array.isArray(lead)) {
    return json({ error: "Invalid request" }, 400);
  }

  const source = clean(lead.lead_source, 80);
  if (source === YARD_LEAD_SOURCE) return handleYardLead(lead, request, env);
  const isInstantEstimate = source === "mini_split_instant_estimate" || source === "hvac_quiz";
  // The name is optional in the instant estimates, so the lead still gets a readable label.
  const name = clean(lead.name, 120) || (isInstantEstimate ? "Not given" : "");
  const email = normalizeEmail(lead.email);
  const phone = normalizeUsPhone(lead.phone);
  const area = clean(lead.area, 160);
  const service = clean(lead.service, 160);
  const message = clean(lead.message, 1600);
  const preferredContactMethods = isInstantEstimate
    ? [...new Set((Array.isArray(lead.preferred_contact_methods) ? lead.preferred_contact_methods : [lead.preferred_contact_methods])
      .map((value) => clean(value, 20).toLowerCase())
      .filter((value) => value === "phone" || value === "email"))]
    : [];
  const estimate = isInstantEstimate
    ? {
        systemType: clean(lead.system_type, 40) || "mini_split",
        projectType: clean(lead.project_type, 80),
        timeline: clean(lead.timeline, 40),
        existingSystem: clean(lead.existing_system, 80),
        spaceSize: clean(lead.space_size || lead.home_size, 80),
        zones: clean(lead.zones, 80),
        ductwork: clean(lead.ductwork, 80),
        systemPreference: clean(lead.system_preference, 80),
        priorities: (Array.isArray(lead.priorities) ? lead.priorities : [lead.priorities])
          .map((value) => clean(value, 80))
          .filter(Boolean)
          .slice(0, 2),
        selectedTier: clean(lead.selected_tier, 80) || "not_sure",
        priceRange: clean(lead.price_range, 80)
      }
    : null;

  const storedMessage = estimate
    ? [
        estimate.systemType === "heat_pump" ? "Heat Pump Instant Estimate" : "Mini-Split Instant Estimate",
        `Timeline: ${labelEstimateValue(estimate.timeline)}`,
        `Project: ${labelEstimateValue(estimate.projectType)}`,
        `Existing system: ${labelEstimateValue(estimate.existingSystem)}`,
        `Space size: ${labelEstimateValue(estimate.spaceSize)}`,
        `Zones: ${labelEstimateValue(estimate.zones)}`,
        `Priorities: ${estimate.priorities.map(labelEstimateValue).join(", ")}`,
        `Selected option: ${labelEstimateValue(estimate.selectedTier)}`,
        `Preferred contact: ${preferredContactMethods.map((value) => value === "phone" ? "Phone" : "Email").join(" and ")}`
      ].join(" | ")
    : message;
  const submittedPhone = isInstantEstimate && !preferredContactMethods.includes("phone") ? "" : phone;
  const submittedEmail = isInstantEstimate && !preferredContactMethods.includes("email") ? "" : email;

  if (isInstantEstimate) {
    const wantsPhone = preferredContactMethods.includes("phone");
    const wantsEmail = preferredContactMethods.includes("email");
    if (!preferredContactMethods.length) {
      return json({ error: "Please select at least one contact method." }, 400);
    }
    if ((wantsPhone && !submittedPhone) || (wantsEmail && (!submittedEmail || !isValidEmail(submittedEmail))) || !name || !area || !service) {
      return json({ error: "Missing or invalid preferred contact information." }, 400);
    }
  } else {
    if (!name) return json({ error: "Enter your name." }, 400);
    if (!phone) return json({ error: "Enter a valid 10-digit US phone number." }, 400);
    if (email && !isValidEmail(email)) return json({ error: "Enter a valid email address." }, 400);
    if (!area) return json({ error: "Enter your city or ZIP code." }, 400);
    if (!service) return json({ error: "Choose the service you need." }, 400);
  }

  return storeAndNotifyLead({
    name,
    email: submittedEmail,
    phone: submittedPhone,
    service,
    area,
    message: storedMessage,
    source,
    estimate,
    preferredContactMethods,
    page: clean(request.headers.get("referer") || "", 500),
    submissionId: cleanSubmissionId(lead.submission_id),
    attribution: sanitizeAttribution(lead.attribution)
  }, request, env, lead);
};

const handleYardLead = async (raw, request, env) => {
  const { lead, error } = normalizeYardLead(raw);
  if (error) return json({ error }, 400);
  return storeAndNotifyLead({
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    service: lead.service,
    area: lead.area,
    message: lead.message,
    source: YARD_LEAD_SOURCE,
    yard: lead,
    page: clean(request.headers.get("referer") || "", 500),
    submissionId: cleanSubmissionId(raw.submission_id),
    attribution: sanitizeAttribution(raw.attribution)
  }, request, env, raw);
};

// A held lead is saved but answered with ok: false, so the page never counts it as a
// conversion. The visitor still reads that the request was received.
const HELD_MESSAGE = "Thanks, we received your request. We will review it and contact you. If it is urgent, call (253) 282-1126.";
const heldResponse = (payload) => json({ ok: false, held: true, message: HELD_MESSAGE, ...(payload.submissionId ? { ref: payload.submissionId } : {}) }, 202);

// Free text the visitor typed (the main form sends its notes as message too, so each text
// counts once); the structured answers of the estimates are not scored.
const visitorText = (raw) => [...new Set(["message", "notes", "details", "description"]
  .map((key) => clean(raw?.[key], 2000))
  .filter(Boolean))]
  .join(" | ");

// Spam checks for a validated lead. Returns a Response to send at once, or the reasons to hold it ("" = a normal lead).
const checkLead = async (payload, request, env, raw) => {
  const ip = getRequestMeta(request).ip;
  const recent = await countRecentLeads(env, ip);
  if (recent.hourly >= HOURLY_CAP) {
    return { response: json({ error: "Too many requests from this connection. Please call (253) 282-1126.", retry: "later" }, 429) };
  }

  const honeypot = clean(raw?.company, 200) || clean(raw?.website, 200);
  const attempt = Number(raw?.verification_attempt) || 1;
  let turnstileFailed = false;
  if (!honeypot) {
    const turnstile = await verifyTurnstile(env, raw?.turnstile_token, ip);
    if (!turnstile.ok) {
      // First failure: the visitor gets a fresh check and tries again. Later failures are held.
      if (attempt < 2) {
        return { response: json({ ok: false, retry: "verification", error: "We could not complete the quick security check. Please press the button again." }, 403) };
      }
      turnstileFailed = true;
    }
  }

  const elapsed = Number(raw?.form_elapsed_ms);
  const assessment = assessLead({
    name: payload.name,
    text: visitorText(raw),
    honeypot,
    elapsedMs: Number.isFinite(elapsed) ? elapsed : null,
    rateBurst: recent.burst >= BURST_LIMIT,
    turnstileFailed
  });
  return { heldReasons: assessment.held ? `${assessment.reasons.join("; ")} (score ${assessment.score})` : "" };
};

// Saves the lead once and sends its Telegram notification (retried by the cron when it fails).
const storeAndNotifyLead = async (payload, request, env, raw = {}) => {
  const success = payload.submissionId ? { ok: true, ref: payload.submissionId } : { ok: true };

  // A resubmitted form (double click, network retry) must not create a second lead or notification.
  try {
    const existing = await findLeadBySubmissionId(env, payload.submissionId);
    if (existing) return existing.notify_status === "held" ? heldResponse(payload) : json(success);
  } catch (error) {
    console.error("Could not check for a duplicate lead", error);
  }

  const check = await checkLead(payload, request, env, raw);
  if (check.response) return check.response;

  const notificationText = formatLeadMessage(payload, request);
  if (check.heldReasons) {
    payload.heldReasons = check.heldReasons;
    const stored = await saveLead(env, payload, request, notificationText);
    if (!stored) console.error("A held lead could not be saved", check.heldReasons);
    return heldResponse(payload);
  }

  const stored = await saveLead(env, payload, request, notificationText);
  if (stored?.duplicate) return json(success);

  const delivery = await deliverLeadNotification(env, notificationText);
  if (stored?.tracked) {
    await recordNotificationResult(env, stored.id, delivery);
  }

  if (!delivery.ok) {
    if (!stored) {
      console.error("Lead was neither saved nor delivered", delivery.error);
      return json({ error: "Could not send request" }, 500);
    }
    console.error(
      stored.tracked ? "Lead saved; Telegram notification queued for retry" : "Lead saved; Telegram notification failed and cannot be retried until migration 0005 is applied",
      String(delivery.error?.message || delivery.error)
    );
  }

  return json(success);
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

// Must match the retry entry in wrangler.jsonc "triggers.crons".
const LEAD_NOTIFICATION_RETRY_CRON = "*/10 * * * *";

const GOOGLE_REVIEWS_CACHE_KEY = "apex-google-reviews";
const GOOGLE_REVIEWS_CACHE_TTL_MS = 3 * 60 * 60 * 1000;

const loadGoogleReviewsCache = async (env) => {
  if (!env.DB) return null;

  try {
    const row = await env.DB.prepare(
      `SELECT payload, fetched_at, expires_at, last_attempt_at, last_error
       FROM google_reviews_cache
       WHERE cache_key = ?`
    ).bind(GOOGLE_REVIEWS_CACHE_KEY).first();
    if (!row?.payload) return null;

    return {
      ...JSON.parse(row.payload),
      cache: {
        fetchedAt: row.fetched_at,
        expiresAt: row.expires_at,
        lastAttemptAt: row.last_attempt_at,
        lastError: row.last_error || ""
      }
    };
  } catch (error) {
    console.error("Could not load Google reviews cache", error);
    return null;
  }
};

const saveGoogleReviewsCache = async (env, payload) => {
  if (!env.DB) throw new Error("D1 is not configured");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + GOOGLE_REVIEWS_CACHE_TTL_MS);

  await env.DB.prepare(
    `INSERT INTO google_reviews_cache
       (cache_key, payload, fetched_at, expires_at, last_attempt_at, last_error)
     VALUES (?, ?, ?, ?, ?, NULL)
     ON CONFLICT(cache_key) DO UPDATE SET
       payload = excluded.payload,
       fetched_at = excluded.fetched_at,
       expires_at = excluded.expires_at,
       last_attempt_at = excluded.last_attempt_at,
       last_error = NULL`
  ).bind(
    GOOGLE_REVIEWS_CACHE_KEY,
    JSON.stringify(payload),
    now.toISOString(),
    expiresAt.toISOString(),
    now.toISOString()
  ).run();
};

const recordGoogleReviewsSyncFailure = async (env, error) => {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      `UPDATE google_reviews_cache
       SET last_attempt_at = ?, last_error = ?
       WHERE cache_key = ?`
    ).bind(new Date().toISOString(), clean(error?.message || error, 500), GOOGLE_REVIEWS_CACHE_KEY).run();
  } catch (cacheError) {
    console.error("Could not record Google reviews sync failure", cacheError);
  }
};

const syncGoogleBusinessReviews = async (env) => {
  try {
    const payload = await fetchGoogleBusinessReviews(env);
    await saveGoogleReviewsCache(env, payload);
    return payload;
  } catch (error) {
    await recordGoogleReviewsSyncFailure(env, error);
    throw error;
  }
};

const renderReviewsPage = async (request, env, options = {}) => {
  const assetResponse = await env.ASSETS.fetch(request);
  if (!assetResponse.ok) return assetResponse;

  const cache = await loadGoogleReviewsCache(env);
  const variant = resolveLandingVariant(new URL(request.url));
  const html = applyLandingVariant(injectGoogleReviewsIntoHtml(await assetResponse.text(), cache, options), variant);
  const headers = new Headers(assetResponse.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  // A personalized page is never stored in shared caches; the canonical URL stays the plain page.
  headers.set("Cache-Control", variant ? "private, max-age=300" : "public, max-age=300, stale-while-revalidate=3600");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  headers.delete("ETag");
  return new Response(html, { status: assetResponse.status, headers });
};

const handleGoogleReviewsSync = async (request, env) => {
  if (!isAuthorizedAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const payload = await syncGoogleBusinessReviews(env);
  return json({
    ok: true,
    averageRating: payload.averageRating,
    totalReviewCount: payload.totalReviewCount,
    loadedReviews: payload.reviews.length
  });
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

// view "" hides leads held by the spam check, "spam" shows only them, "all" shows both.
const loadStructuredLeads = async (env, { q, service, from, to, limit, offset, view = "" }) => {
  if (!(await tableExists(env, "leads"))) {
    return { leads: [], total: 0 };
  }

  const hasEmail = await tableHasColumn(env, "leads", "email");
  const hasDelivery = await tableHasColumn(env, "leads", "notify_status");
  const where = [];
  const values = [];

  if (hasDelivery && view === "spam") where.push("notify_status = 'held'");
  else if (hasDelivery && view !== "all") where.push("(notify_status IS NULL OR notify_status <> 'held')");
  else if (!hasDelivery && view === "spam") where.push("0");

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
  const deliverySelect = hasDelivery
    ? ", notify_status, notify_attempts, notify_last_error, gclid, gbraid, wbraid, utm_source, utm_medium, utm_campaign, lp_variant"
    : "";
  const totalRow = await first(env.DB.prepare(`SELECT COUNT(*) AS total FROM leads ${whereSql}`), values);
  const rows = await env.DB.prepare(
    `SELECT id, 'lead' AS source, name, ${emailSelect}, phone, area, service, message, page, user_agent, ip, created_at${deliverySelect}
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
  const view = ["spam", "all"].includes(params.get("view")) ? params.get("view") : "";
  const structured = await loadStructuredLeads(env, { q, service, from, to, limit, offset, view });
  const legacy = view === "spam" ? { leads: [], total: 0 } : await loadLegacyEventLeads(env, { q, service, from, to, limit });
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

  let notifications = null;
  try {
    notifications = await loadNotificationStats(env);
  } catch (error) {
    console.error("Could not load notification stats", error);
  }

  return json({
    leads,
    total: structured.total + legacy.total,
    limit,
    offset,
    stats: {
      callClicks,
      notifications
    }
  });
};

const handleAdminReleaseLead = async (request, env) => {
  if (!isAuthorizedAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.DB) return json({ error: "Database is not configured" }, 503);

  const body = await readJsonBody(request);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: "Invalid lead id" }, 400);
  const result = await releaseHeldLead(env, id);
  if (!result.released) return json({ error: "This lead is not held as spam." }, 409);
  return json({ ok: true, sent: result.sent });
};

const handleAdminNotificationRetry = async (request, env) => {
  if (!isAuthorizedAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.DB) return json({ error: "Database is not configured" }, 503);

  const body = await readJsonBody(request);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: "Invalid lead id" }, 400);
  if (!(await requeueNotification(env, id))) {
    return json({ error: "This lead has no undelivered notification." }, 409);
  }

  const result = await retryPendingNotifications(env);
  return json({ ok: true, ...result });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const legacyAreaSlugs = new Set([
      "auburn", "bellevue", "black-diamond", "bonney-lake", "bothell", "burien", "covington", "des-moines",
      "dupont", "edgewood", "enumclaw", "federal-way", "fife", "gig-harbor", "issaquah", "kent", "kirkland",
      "lacey", "lakewood", "maple-valley", "mercer-island", "milton", "newcastle", "normandy-park", "olympia",
      "parkland", "puyallup", "redmond", "renton", "rochester", "sammamish", "seatac", "seattle", "south-seattle",
      "spanaway", "sumner", "tacoma", "tukwila", "tumwater", "university-place", "west-seattle", "yelm"
    ]);
    const legacyServiceSlugs = {
      "heat pump installation": "heat-pump-installation",
      "mini-split installation": "mini-split-installation",
      "furnace repair or replacement": "furnace-repair-replacement",
      "ac repair or installation": "ac-repair-installation",
      ductwork: "ductwork",
      maintenance: "repair-maintenance",
      "repair and maintenance": "repair-maintenance"
    };
    const legacyArea = url.pathname === "/" ? url.searchParams.get("area")?.trim() : null;

    if (legacyArea) {
      const areaSlug = legacyArea.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const legacyService = url.searchParams.get("service")?.trim();
      const serviceSlug = legacyServiceSlugs[legacyService?.toLowerCase()];
      url.protocol = "https:";
      url.hostname = "apexgroupwa.com";
      url.port = "";
      if (legacyAreaSlugs.has(areaSlug) && serviceSlug) {
        url.pathname = `/areas/${areaSlug}-${serviceSlug}`;
        url.search = "";
      } else if (!legacyService) {
        url.pathname = "/service-areas";
        url.search = "";
      } else {
        url.pathname = "/get-estimate";
      }
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname.endsWith(".html")) {
      url.pathname = url.pathname.slice(0, -5) || "/";
      url.protocol = "https:";
      url.hostname = "apexgroupwa.com";
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }

    // Printed yard-sign QR codes point here; only this destination may change later, never /go itself.
    if (url.pathname === "/go" || url.pathname === "/go/") {
      return new Response(null, { status: 302, headers: { Location: YARD_REDIRECT_URL, "Cache-Control": "no-store" } });
    }

    if (url.protocol === "http:" || url.hostname === "www.apexgroupwa.com") {
      url.protocol = "https:";
      url.hostname = "apexgroupwa.com";
      url.port = "";
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

    // Public: the Turnstile site key (not a secret) for the lead forms.
    if (url.pathname === "/api/lead-guard/config") {
      return new Response(JSON.stringify(publicGuardConfig(env)), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" }
      });
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

    if (url.pathname === "/api/admin/leads/release") {
      try {
        return await handleAdminReleaseLead(request, env);
      } catch (error) {
        console.error(error);
        return json({ error: "Could not send the lead to Telegram" }, 500);
      }
    }

    if (url.pathname === "/api/admin/notifications/retry") {
      try {
        return await handleAdminNotificationRetry(request, env);
      } catch (error) {
        console.error(error);
        return json({ error: "Could not retry the notification" }, 500);
      }
    }

    if (url.pathname === "/api/admin/google-reviews/sync") {
      try {
        return await handleGoogleReviewsSync(request, env);
      } catch (error) {
        console.error("Could not sync Google reviews", error);
        return json({ error: "Could not sync Google reviews; the last successful cache was preserved." }, 502);
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

    if (url.pathname === "/reviews") {
      return renderReviewsPage(request, env);
    }

    if (url.pathname === "/") {
      return renderReviewsPage(request, env, { limit: 3, summaryCta: true });
    }

    if (url.pathname === "/services/mini-splits") {
      return renderReviewsPage(request, env, { limit: 3 });
    }

    if (url.pathname === "/services/heat-pumps") {
      return renderReviewsPage(request, env, {
        limit: 3,
        priorityKeywords: ["heat pump", "central heating", "entire system installation", "ducted system", "system replacement", "new heating", "new cooling"]
      });
    }

    if (url.pathname === "/services/repair-maintenance") {
      return renderReviewsPage(request, env, {
        limit: 3,
        priorityKeywords: ["repair", "service", "maintenance", "cleaning", "diagnos", "fixed"]
      });
    }

    if (url.pathname === "/about" || url.pathname === "/yard") {
      return renderReviewsPage(request, env, { limit: 3 });
    }

    if (url.pathname === "/services/furnaces" || url.pathname === "/services/air-conditioning" || url.pathname === "/services/ductwork") {
      return renderReviewsPage(request, env);
    }

    // The instant estimates only use the rating badge.
    if (url.pathname === "/instant-estimate/mini-split" || url.pathname === "/instant-estimate/heat-pump") {
      return renderReviewsPage(request, env);
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    if (controller.cron === LEAD_NOTIFICATION_RETRY_CRON) {
      ctx.waitUntil(
        retryPendingNotifications(env).catch((error) => {
          console.error("Scheduled lead notification retry failed", error);
        })
      );
      return;
    }

    ctx.waitUntil(
      syncGoogleBusinessReviews(env).catch((error) => {
        console.error("Scheduled Google reviews sync failed; serving the last successful cache", error);
      })
    );
  }
};
