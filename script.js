const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const toggle = document.querySelector("[data-nav-toggle]");
const submenu = document.querySelector(".has-menu");
const submenuToggle = document.querySelector("[data-submenu-toggle]");
const areaField = document.querySelector('[data-area-field], input[name="city"]');
const serviceField = document.querySelector('select[name="service"]');
const serviceRadios = document.querySelectorAll('input[type="radio"][name="service"]');
const backdrop = document.createElement("button");

backdrop.className = "nav-backdrop";
backdrop.type = "button";
backdrop.setAttribute("aria-label", "Close navigation");
document.body.append(backdrop);

const syncHeader = () => {
  const shouldBeScrolled = window.scrollY > 18;
  if (header.classList.contains("is-scrolled") === shouldBeScrolled) return;
  header.classList.toggle("is-scrolled", shouldBeScrolled);
};

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

const mobileCtaBar = document.querySelector("[data-mobile-cta-bar]");

if (mobileCtaBar) {
  const firstHero = document.querySelector(".hero, .page-hero, .mini-split-conversion-hero");
  let heroVisible = Boolean(firstHero);
  let fieldFocused = false;
  const syncMobileCtaBar = () => {
    mobileCtaBar.classList.toggle("is-visible", !heroVisible && !fieldFocused);
  };
  const isTextField = (target) => target instanceof Element && target.matches("input, textarea, select");

  if (firstHero && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      syncMobileCtaBar();
    }, { rootMargin: "-70px 0px 0px 0px" }).observe(firstHero);
  } else {
    heroVisible = false;
  }

  document.addEventListener("focusin", (event) => {
    if (!isTextField(event.target)) return;
    fieldFocused = true;
    syncMobileCtaBar();
  });
  document.addEventListener("focusout", (event) => {
    if (!isTextField(event.target)) return;
    fieldFocused = false;
    syncMobileCtaBar();
  });
  syncMobileCtaBar();
}

const setNavOpen = (isOpen) => {
  toggle.setAttribute("aria-expanded", String(isOpen));
  toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  toggle.classList.toggle("is-active", isOpen);
  nav.classList.toggle("is-open", isOpen);
  header.classList.toggle("is-open", isOpen);
  backdrop.classList.toggle("is-open", isOpen);
  document.body.classList.toggle("nav-lock", isOpen && window.matchMedia("(max-width: 1320px)").matches);
  if (!isOpen) {
    nav.querySelectorAll(".is-submenu-open").forEach((item) => item.classList.remove("is-submenu-open"));
    submenuToggle?.setAttribute("aria-expanded", "false");
  }
};

toggle.addEventListener("click", () => {
  setNavOpen(toggle.getAttribute("aria-expanded") !== "true");
});

document.querySelectorAll(".has-menu").forEach((item) => {
  let closeTimer;

  item.addEventListener("pointerenter", () => {
    if (window.matchMedia("(max-width: 1320px)").matches) return;
    window.clearTimeout(closeTimer);
    item.classList.add("is-submenu-open");
  });

  item.addEventListener("pointerleave", () => {
    if (window.matchMedia("(max-width: 1320px)").matches) return;
    closeTimer = window.setTimeout(() => {
      item.classList.remove("is-submenu-open");
    }, 320);
  });
});

const setSubmenuOpen = (isOpen) => {
  submenu?.classList.toggle("is-submenu-open", isOpen);
  submenuToggle?.setAttribute("aria-expanded", String(isOpen));
};

submenuToggle?.addEventListener("click", () => {
  setSubmenuOpen(submenuToggle.getAttribute("aria-expanded") !== "true");
});

submenuToggle?.addEventListener("focus", () => {
  if (!window.matchMedia("(max-width: 1320px)").matches) setSubmenuOpen(true);
});

nav.addEventListener("click", (event) => {
  if (!event.target.closest("a")) return;
  setNavOpen(false);
});

backdrop.addEventListener("click", () => {
  setNavOpen(false);
});

document.addEventListener("click", (event) => {
  if (!submenu?.contains(event.target)) setSubmenuOpen(false);
  if (nav.classList.contains("is-open") && !header.contains(event.target)) setNavOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const wasSubmenuOpen = submenu?.classList.contains("is-submenu-open");
    setSubmenuOpen(false);
    setNavOpen(false);
    if (wasSubmenuOpen) submenuToggle?.focus();
  }
});

window.addEventListener("resize", () => {
  if (!window.matchMedia("(max-width: 1320px)").matches) document.body.classList.remove("nav-lock");
});

document.querySelectorAll(".area-list li, .area-group li").forEach((item) => {
  if (item.querySelector("a")) return;
  const areaName = item.textContent.trim();
  if (!areaName) return;

  const link = document.createElement("a");
  link.href = `/get-estimate?area=${encodeURIComponent(areaName)}`;
  link.textContent = areaName;
  link.className = "area-picker-link";
  item.textContent = "";
  item.append(link);
});

const params = new URLSearchParams(window.location.search);
const selectedArea = params.get("area");
const selectedService = params.get("service");
const estimateServiceAliases = {
  "Furnace repair or replacement": "Furnace service",
  "AC repair or installation": "AC service",
  Maintenance: "Repair and maintenance"
};
const normalizedSelectedService = estimateServiceAliases[selectedService] || selectedService;
const googleAdsLeadDestination = "AW-18358155203/eht5CKv_lvgcEMPv7LFE";
// Same rule as the tag snippet in scripts/build.mjs: previews and local servers send no conversions.
const isLiveSite = /(^|\.)apexgroupwa\.com$/i.test(window.location.hostname);
const googleAdsLeadPendingKey = "apex_google_ads_lead_pending";
const googleAdsUserDataKey = "apex_google_ads_user_data";
const openAiLeadSentKey = "apex_openai_lead_sent";

// Ad-click attribution for lead records. The latest tagged visit wins and lasts 30 days;
// arriving from another site without tags (organic search, a referral) ends it, so a new
// lead is never credited to an old ad click.
const attributionKey = "apex_lead_attribution";
const attributionMaxAgeMs = 30 * 24 * 60 * 60 * 1000;
const attributionParams = { gclid: "gclid", gbraid: "gbraid", wbraid: "wbraid", utm_source: "utm_source", utm_medium: "utm_medium", utm_campaign: "utm_campaign", utm_content: "utm_content", oppref: "oppref", oa_oppref: "oa_oppref", lpv: "lp_variant" };

const pageAttribution = (() => {
  const params = new URLSearchParams(window.location.search);
  const found = {};
  Object.entries(attributionParams).forEach(([param, field]) => {
    const value = params.get(param);
    // An unexpanded placeholder such as {oppref} (or %7Boppref%7D) is not a click.
    if (value && !/[{}]|%7[BD]/i.test(value)) found[field] = value.slice(0, 512);
  });
  return Object.keys(found).length ? { ...found, attributed_at: new Date().toISOString() } : null;
})();

try {
  if (pageAttribution) {
    window.localStorage.setItem(attributionKey, JSON.stringify(pageAttribution));
  } else if (document.referrer) {
    const referrerHost = new URL(document.referrer).hostname.replace(/^www\./, "");
    if (referrerHost !== window.location.hostname.replace(/^www\./, "")) {
      window.localStorage.removeItem(attributionKey);
    }
  }
} catch {
  // Attribution is optional; forms keep working without storage.
}

const currentAttribution = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(attributionKey) || "null");
    if (stored && Date.now() - Date.parse(stored.attributed_at) <= attributionMaxAgeMs) return stored;
  } catch {
    // Fall back to the tags on this page.
  }
  return pageAttribution;
};

// GA4 gets only the city or the ZIP, never the street address the lead itself keeps.
// Free-text values with digits (a house number) are left out.
const analyticsLeadArea = (payload) => {
  const city = String(payload.city || "").trim();
  if (city && !/\d/.test(city)) return city.slice(0, 60);
  const zip = String(payload.zip || "").trim().match(/^\d{5}/)?.[0];
  if (zip) return `WA ${zip}`;
  const area = String(payload.area || "").trim();
  return area && !/\d/.test(area) ? area.slice(0, 60) : "";
};

const newSubmissionId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
};

// Enhanced conversions: Google matches a lead to its ad click by the SHA-256 of the
// normalized email and phone. Only these hashes reach the confirmation page.
const sha256Hex = async (value) => {
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

// Waits for the hashes at most 300 ms after a confirmed lead, so enhanced conversions can
// never hold up the redirect; without them the conversion still counts by click id.
const rememberUserData = async (pendingUserData) => {
  try {
    const timeout = new Promise((resolve) => window.setTimeout(() => resolve(null), 300));
    const userData = await Promise.race([pendingUserData, timeout]);
    if (userData) window.sessionStorage.setItem(googleAdsUserDataKey, JSON.stringify(userData));
  } catch {
    // Storage blocked or hashing failed: skip enhanced data only.
  }
};

const normalizeEmail = (email) => {
  const value = String(email || "").trim().toLowerCase();
  const parts = value.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return "";
  const [local, domain] = parts;
  return domain === "gmail.com" || domain === "googlemail.com" ? `${local.replace(/\./g, "")}@${domain}` : value;
};

const normalizePhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
};

const hashUserData = async (payload) => {
  try {
    if (!window.crypto?.subtle || typeof TextEncoder !== "function") return null;
    const email = normalizeEmail(payload.email);
    const phone = normalizePhone(payload.phone);
    const userData = {};
    if (email) userData.sha256_email_address = await sha256Hex(email);
    if (phone) userData.sha256_phone_number = await sha256Hex(phone);
    return Object.keys(userData).length ? userData : null;
  } catch {
    return null;
  }
};

// Shared by every lead form: one submission id per filled form (so a resubmit is not a
// second lead) and the current attribution.
window.apexLeadContext = {
  decorate(payload, form) {
    if (form && !form.dataset.submissionId) form.dataset.submissionId = newSubmissionId();
    payload.submission_id = form?.dataset.submissionId || newSubmissionId();
    const attribution = currentAttribution();
    if (attribution) payload.attribution = attribution;
    return payload;
  },
  // Hashing starts with the request and is stored only after a confirmed lead.
  hashUserData,
  rememberUserData,
  // The stored campaign tags (no personal data), for pages that report where a visit came from.
  attribution: () => currentAttribution()
};

const trackEvent = (eventName, eventData = {}, callback = null, callbackTimeout = 1300) => {
  let callbackCalled = false;
  const runCallback = () => {
    if (callbackCalled || typeof callback !== "function") return;
    callbackCalled = true;
    callback();
  };

  const eventPayload = { ...eventData };
  if (typeof callback === "function") {
    eventPayload.event_callback = runCallback;
    eventPayload.event_timeout = Math.max(0, callbackTimeout - 100);
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, eventPayload);
  } else {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      ...eventPayload
    });
  }

  if (typeof callback === "function") {
    window.setTimeout(runCallback, callbackTimeout);
  }
};

// Spam protection shared by every lead form: Cloudflare Turnstile in its invisible mode
// (it shows a checkbox only when Cloudflare needs one), the hidden honeypot field and the
// time the form took. The script loads on the first touch of a form, never on page load.
// outcome() turns a refused submission into what the visitor sees; only { ok: true } from the
// server is a lead, so a held or refused submission never fires a conversion.
window.apexLeadGuard = (() => {
  const formSelector = "[data-lead-form], [data-instant-lead], [data-yard-form]";
  const forms = new WeakMap();
  const RETRY_MESSAGE = "The quick security check did not finish. Your details are still in the form: please press the button again. If it keeps failing, call (253) 282-1126.";
  let configPromise = null;
  let scriptPromise = null;

  const loadConfig = () => {
    configPromise ||= fetch("/api/lead-guard/config")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("config"))))
      .catch(() => {
        configPromise = null;
        return { failed: true };
      });
    return configPromise;
  };

  const loadTurnstile = () => {
    scriptPromise ||= new Promise((resolve, reject) => {
      if (window.turnstile) { resolve(window.turnstile); return; }
      window.apexTurnstileLoaded = () => resolve(window.turnstile);
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=apexTurnstileLoaded";
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        // A network hiccup: forget this attempt so the next press loads the script again.
        script.remove();
        scriptPromise = null;
        reject(new Error("Turnstile did not load"));
      };
      document.head.append(script);
    });
    return scriptPromise;
  };

  const stateFor = (form) => {
    let state = forms.get(form);
    if (!state) {
      state = { startedAt: Date.now(), attempt: 1, token: "", widgetId: null, needsInteraction: false, waiters: [], rendering: null };
      forms.set(form, state);
    }
    return state;
  };

  const settle = (state, token) => {
    state.token = token;
    state.waiters.splice(0).forEach((resolve) => resolve(token));
  };

  const ensureHoneypot = (form) => {
    if (form.querySelector('input[name="company"]')) return;
    const label = document.createElement("label");
    label.className = "form-honeypot";
    label.setAttribute("aria-hidden", "true");
    label.textContent = "Company";
    const input = document.createElement("input");
    input.name = "company";
    input.tabIndex = -1;
    input.autocomplete = "off";
    label.append(input);
    form.append(label);
  };

  const render = (form) => {
    const state = stateFor(form);
    state.rendering ||= loadConfig().then(async (config) => {
      if (config?.failed) throw new Error("Lead guard config unavailable");
      if (!config?.turnstileSiteKey) return false;
      const turnstile = await loadTurnstile();
      let box = form.querySelector("[data-lead-guard-widget]");
      if (!box) {
        box = document.createElement("div");
        box.className = "lead-guard-widget";
        box.dataset.leadGuardWidget = "";
        const anchor = form.querySelector(".form-status") || form.querySelector('button[type="submit"]');
        if (anchor) anchor.before(box);
        else form.append(box);
      }
      state.widgetId = turnstile.render(box, {
        sitekey: config.turnstileSiteKey,
        appearance: "interaction-only",
        size: "flexible",
        "refresh-expired": "auto",
        callback: (token) => { state.needsInteraction = false; settle(state, token); },
        "expired-callback": () => { state.token = ""; },
        "error-callback": () => { settle(state, ""); return true; },
        "before-interactive-callback": () => { state.needsInteraction = true; },
        "after-interactive-callback": () => { state.needsInteraction = false; }
      });
      return true;
    }).catch(() => {
      state.rendering = null;
      return false;
    });
    return state.rendering;
  };

  const prepare = (form) => {
    if (!form) return;
    stateFor(form);
    ensureHoneypot(form);
    render(form);
  };

  // The token, waiting at most waitMs in all for Turnstile to finish in the background.
  // Without a token the server answers with a retry, so a slow check never loses the lead.
  const token = async (form, waitMs = 6000) => {
    const state = stateFor(form);
    const deadline = new Promise((resolve) => window.setTimeout(() => resolve(null), waitMs));
    const enabled = await Promise.race([render(form), deadline]);
    if (enabled === false) return "";
    if (state.token) return state.token;
    if (state.needsInteraction) return "";
    const waited = await Promise.race([new Promise((resolve) => state.waiters.push(resolve)), deadline]);
    return waited || state.token || "";
  };

  // Adds the token, the honeypot value, the elapsed time and the attempt number. Throws
  // (with userMessage) while Cloudflare is waiting for the visitor to tick its checkbox.
  const protect = async (payload, form) => {
    if (!form) return payload;
    prepare(form);
    const state = stateFor(form);
    payload.turnstile_token = await token(form);
    if (!payload.turnstile_token && state.needsInteraction) {
      const error = new Error("Security check pending");
      error.userMessage = "Please complete the quick security check above, then press the button again.";
      throw error;
    }
    payload.company = form.querySelector('input[name="company"]')?.value || payload.company || "";
    payload.form_elapsed_ms = Date.now() - state.startedAt;
    payload.verification_attempt = state.attempt;
    return payload;
  };

  // A Turnstile token works once: after any answer that was not a lead, get a fresh one.
  const reset = (form) => {
    const state = forms.get(form);
    if (!state) return;
    state.token = "";
    if (state.widgetId !== null && window.turnstile) {
      try { window.turnstile.reset(state.widgetId); } catch {}
    }
  };

  // { kind: "held" | "retry" | "error", message } for a response that was not { ok: true }.
  const outcome = (form, response, result, fallback) => {
    reset(form);
    if (result?.held) return { kind: "held", message: String(result.message || "Thanks, we received your request. If it is urgent, call (253) 282-1126.") };
    if (result?.retry === "verification") {
      const state = forms.get(form);
      if (state) state.attempt += 1;
      return { kind: "retry", message: state?.needsInteraction ? "Please complete the quick security check above, then press the button again." : RETRY_MESSAGE };
    }
    if (response?.status === 400 && result?.error) return { kind: "error", message: String(result.error) };
    if (response?.status === 429 && result?.error) return { kind: "error", message: String(result.error) };
    return { kind: "error", message: fallback };
  };

  ["focusin", "pointerdown"].forEach((type) => {
    document.addEventListener(type, (event) => {
      const form = event.target instanceof Element ? event.target.closest(formSelector) : null;
      if (form) prepare(form);
    }, { passive: true });
  });

  return { prepare, protect, outcome, reset };
})();

if (window.location.pathname === "/thank-you" || window.location.pathname === "/thank-you.html") {
  // OpenAI Ads: one lead_created per lead the server accepted, read from the same marker as the
  // Google conversion below. The submission id is the event_id, so OpenAI drops repeats, and the
  // per-tab note stops a reload from sending it again. No contact details are sent.
  try {
    const pendingLead = window.sessionStorage.getItem(googleAdsLeadPendingKey);
    if (pendingLead && typeof window.oaiq === "function" && window.sessionStorage.getItem(openAiLeadSentKey) !== pendingLead) {
      const measureArgs = ["measure", "lead_created", { type: "customer_action" }];
      if (pendingLead !== "1") measureArgs.push({ event_id: pendingLead });
      window.oaiq(...measureArgs);
      window.sessionStorage.setItem(openAiLeadSentKey, pendingLead);
    }
  } catch {
    // Measurement is optional; the confirmation page works without it.
  }

  try {
    // The marker holds the submission id, sent as transaction_id so Google Ads
    // counts one conversion per lead even if the tag fires twice.
    const pendingLead = window.sessionStorage.getItem(googleAdsLeadPendingKey);
    if (pendingLead && isLiveSite && typeof window.gtag === "function") {
      try {
        const userData = JSON.parse(window.sessionStorage.getItem(googleAdsUserDataKey) || "null");
        if (userData) window.gtag("set", "user_data", userData);
      } catch {
        // A bad entry only drops enhanced data; the conversion below still fires.
      }
      const conversion = { send_to: googleAdsLeadDestination };
      if (pendingLead !== "1") conversion.transaction_id = pendingLead;
      window.gtag("event", "conversion", conversion);
      window.sessionStorage.removeItem(googleAdsLeadPendingKey);
    }
    window.sessionStorage.removeItem(googleAdsUserDataKey);
  } catch {
    // Keep the confirmation page usable if session storage is unavailable.
  }

  // Instant estimates reveal the planning range here, after the contact details were sent.
  const estimateResult = document.querySelector("[data-estimate-result]");
  try {
    const result = JSON.parse(window.sessionStorage.getItem("apex_instant_estimate_result") || "null");
    if (estimateResult && result?.lines?.length) {
      estimateResult.querySelector("[data-estimate-title]").textContent = String(result.title || "Your planning range");
      estimateResult.querySelector("[data-estimate-lines]").replaceChildren(...result.lines.slice(0, 4).map((line) => {
        const item = document.createElement("li");
        item.textContent = String(line);
        return item;
      }));
      estimateResult.hidden = false;
    }
  } catch {
    // Without a stored range the page shows the plain confirmation.
  }
}

document.querySelectorAll('a[href]').forEach((link) => {
  let destination;
  try {
    destination = new URL(link.href, window.location.href);
  } catch {
    return;
  }

  if (destination.origin !== window.location.origin || destination.pathname !== "/get-estimate") return;

  link.addEventListener("click", (event) => {
    const eventData = {
      button_text: link.textContent.trim(),
      cta_location:
        link.dataset.ctaLocation ||
        (link.closest("header") ? "header" : link.closest("footer") ? "footer" : "page"),
      destination_url: destination.href,
      page_location: window.location.href
    };
    const opensSeparately =
      event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === "_blank";

    if (opensSeparately) {
      trackEvent("estimate_button_click", eventData);
      return;
    }

    event.preventDefault();
    trackEvent("estimate_button_click", eventData, () => {
      window.location.href = destination.href;
    });
  });
});

if (selectedArea && areaField) {
  areaField.value = selectedArea;
  areaField.closest("label")?.classList.add("is-prefilled");
}

if (normalizedSelectedService && serviceField) {
  serviceField.value = normalizedSelectedService;
}

if (normalizedSelectedService && serviceRadios.length) {
  const matchingService = [...serviceRadios].find((radio) => radio.value === normalizedSelectedService);
  if (matchingService) matchingService.checked = true;
}

const leadForm = document.querySelector("[data-lead-form]");

if (leadForm) {
  const status = leadForm.querySelector("[data-form-status]");
  const submitButton = leadForm.querySelector('button[type="submit"]');
  const phoneField = leadForm.querySelector("[data-phone-field]");
  const endpoint = leadForm.dataset.endpoint || "/api/lead";
  let submissionInProgress = false;
  let leadEventSent = false;

  const getPhoneDigits = () => {
    let digits = (phoneField?.value || "").replace(/\D/g, "");
    if (digits.length > 10 && digits.startsWith("1")) {
      digits = digits.slice(1);
    }
    return digits.slice(0, 10);
  };

  const formatPhone = (digits) => {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const setFormStatus = (message, type = "") => {
    status.textContent = message;
    status.classList.toggle("is-success", type === "success");
    status.classList.toggle("is-error", type === "error");
  };

  phoneField?.addEventListener("input", () => {
    const digits = getPhoneDigits();
    phoneField.value = formatPhone(digits);
    phoneField.setCustomValidity(digits.length === 10 ? "" : "Enter a 10-digit US phone number.");
  });

  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (submissionInProgress || leadEventSent) return;

    const phoneDigits = getPhoneDigits();
    if (phoneField) {
      phoneField.setCustomValidity(phoneDigits.length === 10 ? "" : "Enter a 10-digit US phone number.");
    }

    if (!leadForm.reportValidity()) {
      setFormStatus("Please complete all required fields with a valid email and phone number.", "error");
      return;
    }

    setFormStatus("Sending request...");
    submissionInProgress = true;
    submitButton.disabled = true;

    const payload = Object.fromEntries(new FormData(leadForm).entries());
    const firstName = String(payload.first_name || "").trim();
    const lastName = String(payload.last_name || "").trim();
    if (firstName || lastName) {
      payload.name = `${firstName} ${lastName}`.trim();
    }
    if (payload.zip) {
      payload.area = [payload.address, payload.city, `WA ${payload.zip}`].filter(Boolean).join(", ");
    }
    if (Object.hasOwn(payload, "notes")) {
      payload.message = payload.notes;
    }
    payload.phone = `+1${phoneDigits}`;
    window.apexLeadContext.decorate(payload, leadForm);
    const pendingUserData = window.apexLeadContext.hashUserData(payload);

    try {
      await window.apexLeadGuard.protect(payload, leadForm);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || result?.ok !== true) {
        const outcome = window.apexLeadGuard.outcome(leadForm, response, result, "Could not send the request. Please call or email us directly.");
        if (outcome.kind === "held") {
          // Saved for review only, not a confirmed lead: the visitor stays on this page.
          leadEventSent = true;
          setFormStatus(outcome.message, "success");
          return;
        }
        const error = new Error("Request failed");
        error.userMessage = outcome.message;
        throw error;
      }

      leadEventSent = true;
      trackEvent(
        "generate_lead",
        {
          lead_service: payload.service || "",
          lead_area: analyticsLeadArea(payload),
          page_location: window.location.href
        }
      );
      try {
        window.sessionStorage.setItem(googleAdsLeadPendingKey, payload.submission_id || "1");
      } catch {
        // Continue to the confirmation page if session storage is unavailable.
      }
      await window.apexLeadContext.rememberUserData(pendingUserData);
      window.location.href = "/thank-you";
    } catch (error) {
      submissionInProgress = false;
      submitButton.disabled = false;
      setFormStatus(error?.userMessage || "Could not send the request. Please call or email us directly.", "error");
    }
  });
}

document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const phone = link.getAttribute("href")?.replace("tel:", "") || "";
    const href = link.href;

    event.preventDefault();
    trackEvent(
      "phone_click",
      {
        phone_number: phone,
        phone_label: link.textContent.trim(),
        page_location: window.location.href
      },
      () => {
        window.location.href = href;
      }
    );

    const payload = JSON.stringify({
      phone,
      label: link.textContent.trim(),
      page: window.location.href
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/call-click", new Blob([payload], { type: "application/json" }));
      return;
    }

    fetch("/api/call-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(() => {});
  });
});
