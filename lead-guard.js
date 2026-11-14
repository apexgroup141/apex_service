// Spam protection for the website lead forms.
// Nothing here deletes a lead: a submission that looks like spam is saved in D1 as "held"
// (reviewable on the admin page) and is not sent to Telegram. Only a missing or failed
// Turnstile check is refused outright on the first try, with a retry for the visitor;
// a second failed try is held, so a real customer whose browser blocks Turnstile is not lost.

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_TIMEOUT_MS = 5000;

// A lead is held when its score reaches this value.
export const HOLD_SCORE = 3;
// Per IP: from this many leads in the burst window the next one is held,
// and from the hourly cap the request is refused without being saved.
export const BURST_WINDOW_MS = 15 * 60 * 1000;
export const BURST_LIMIT = 3;
export const HOURLY_WINDOW_MS = 60 * 60 * 1000;
export const HOURLY_CAP = 8;
// Bigger bodies are refused before they are parsed.
export const MAX_BODY_BYTES = 32 * 1024;

const text = (value, maxLength = 4000) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

export const turnstileEnabled = (env) => Boolean(text(env?.TURNSTILE_SECRET_KEY, 200));

// The site key reaches the browser only when the server will also check the token.
export const publicGuardConfig = (env) => ({
  turnstileSiteKey: turnstileEnabled(env) ? text(env?.TURNSTILE_SITE_KEY, 200) : ""
});

// Returns { ok: true } | { ok: false, codes } | { ok: true, skipped: true } | { ok: true, unavailable: true }.
// Cloudflare being unreachable never costs a lead: the check is then skipped and noted.
export const verifyTurnstile = async (env, token, ip = "") => {
  if (!turnstileEnabled(env)) return { ok: true, skipped: true };
  const response = text(token, 2048);
  if (!response) return { ok: false, codes: ["missing-input-response"] };

  const body = new FormData();
  body.append("secret", text(env.TURNSTILE_SECRET_KEY, 200));
  body.append("response", response);
  if (ip) body.append("remoteip", ip);
  const options = { method: "POST", body };
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    options.signal = AbortSignal.timeout(TURNSTILE_TIMEOUT_MS);
  }

  try {
    const result = await fetch(TURNSTILE_VERIFY_URL, options);
    if (!result.ok) return { ok: true, unavailable: true };
    const data = await result.json();
    if (data?.success === true) return { ok: true };
    const codes = Array.isArray(data?.["error-codes"]) ? data["error-codes"].map((code) => text(code, 60)) : [];
    // A wrong secret is our configuration problem, not the visitor's.
    if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) {
      console.error("Turnstile secret key is invalid; leads are accepted without the check", codes);
      return { ok: true, unavailable: true };
    }
    return { ok: false, codes };
  } catch (error) {
    console.error("Turnstile verification unavailable", error?.name || error);
    return { ok: true, unavailable: true };
  }
};

// Phrases from marketing, SEO and other sales pitches. A customer asking about a furnace
// does not write these; each one only adds to the score, none blocks on its own.
const STRONG_PROMO = [
  /\bseo\b/i,
  /search engine optimi[sz]ation/i,
  /\bback ?links?\b/i,
  /guest ?post/i,
  /first page (?:of|on) google/i,
  /(?:rank|ranking)s? (?:higher|#?1|first|on top)/i,
  /top of google/i,
  /domain authority/i,
  /website traffic/i,
  /(?:increase|boost|grow) (?:your )?(?:online )?(?:sales|traffic|revenue|visibility)/i,
  /lead generation/i,
  /digital marketing/i,
  /marketing (?:agency|services|team)/i,
  /social media marketing/i,
  /web ?(?:site )?(?:design|development) (?:services|company|agency)/i,
  /redesign (?:of )?your (?:web ?site|site)/i,
  /\bppc\b/i,
  /appointment setting/i,
  /virtual assistants?/i,
  /outsourc/i,
  /white[- ]label/i,
  /\b(?:crypto|bitcoin|btc|forex|casino|betting)\b/i,
  /business (?:loan|funding|financing)/i,
  /(?:pre-?approved|merchant cash advance)/i,
  /\bunsubscribe\b/i,
  /reply (?:stop|"stop"|no)\b/i,
  /opt[- ]out/i,
  /dear (?:sir|madam|business owner|website owner)/i,
  /\bour (?:agency|team of experts)\b/i
];
const WEAK_PROMO = [
  /your (?:web ?site|business|company|brand)\b/i,
  /(?:more|new|qualified) (?:leads|customers|clients)\b/i,
  /hvac (?:companies|contractors|businesses)/i,
  /google (?:my business|business profile|maps) (?:optimi|ranking|listing)/i
];
// Words that a real HVAC request usually contains.
const HVAC_TERMS = /\b(?:hvac|heat ?pumps?|furnaces?|mini[- ]?splits?|ductless|a\/?c\b|air ?condition\w*|ducts?|ductwork|thermostat|boiler|heating|cooling|install\w*|repair\w*|maintenance|tune[- ]?up|estimate|quote|filter|vents?|compressor|refrigerant|freon|leak\w*|not (?:heating|cooling|working)|blowing|noise)\b/i;

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|co|info|biz|xyz|ru|top|site|online|shop|store|link|click)\b(?:\/\S*)?/gi;
const MARKUP_PATTERN = /<\s*a\s+[^>]*href|\[\s*url\s*=|\[\s*link\s*=|\[\/url\]/i;

// Scores one submission. Returns { score, reasons, held } where reasons is plain English
// for the admin page. None of the checks looks at the email domain.
export const assessLead = ({ name = "", text: freeText = "", honeypot = "", elapsedMs = null, rateBurst = false, turnstileFailed = false } = {}) => {
  const reasons = [];
  let score = 0;
  const add = (points, reason) => { score += points; reasons.push(reason); };

  if (text(honeypot)) add(5, "hidden anti-spam field was filled");
  if (turnstileFailed) add(5, "Turnstile check failed twice");
  if (rateBurst) add(3, "several requests from the same IP in 15 minutes");

  const cleanName = text(name, 200);
  if (cleanName && (new RegExp(URL_PATTERN.source, "i").test(cleanName) || /@/.test(cleanName))) add(3, "link or email in the name field");

  const body = text(freeText, 6000);
  if (MARKUP_PATTERN.test(body)) add(3, "HTML or BBCode link markup");
  const links = body.match(URL_PATTERN) || [];
  if (links.length >= 3) add(3, `${links.length} links`);
  else if (links.length === 2) add(2, "2 links");
  else if (links.length === 1) add(1, "1 link");

  const strong = STRONG_PROMO.filter((pattern) => pattern.test(body)).length;
  if (strong) add(Math.min(strong * 2, 6), `sales/SEO wording (${strong})`);
  const weak = WEAK_PROMO.filter((pattern) => pattern.test(body)).length;
  if (weak) add(Math.min(weak, 2), `marketing wording (${weak})`);

  if (Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < 2500) add(1, "sent within 2.5 seconds of opening the form");

  // An HVAC question with a photo link or a quick submit stays a lead; a sales pitch that
  // names HVAC still scores on its wording.
  if (score > 0 && score < 5 && HVAC_TERMS.test(`${cleanName} ${body}`) && !strong) {
    score -= 1;
    reasons.push("mentions HVAC work (-1)");
  }

  return { score, reasons, held: score >= HOLD_SCORE };
};

// Counts this IP's saved leads (held ones included) inside each window.
export const countRecentLeads = async (env, ip, now = Date.now()) => {
  if (!env.DB || !ip) return { burst: 0, hourly: 0 };
  try {
    const row = await env.DB.prepare(
      `SELECT
         SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS burst,
         COUNT(*) AS hourly
       FROM leads WHERE ip = ? AND created_at >= ?`
    ).bind(
      new Date(now - BURST_WINDOW_MS).toISOString(),
      ip,
      new Date(now - HOURLY_WINDOW_MS).toISOString()
    ).first();
    return { burst: Number(row?.burst || 0), hourly: Number(row?.hourly || 0) };
  } catch (error) {
    console.error("Could not count recent leads", error);
    return { burst: 0, hourly: 0 };
  }
};
