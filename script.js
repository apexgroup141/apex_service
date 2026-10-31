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
const googleAdsLeadPendingKey = "apex_google_ads_lead_pending";
const googleAdsUserDataKey = "apex_google_ads_user_data";

// Ad-click attribution for lead records. The latest tagged visit wins and lasts 30 days;
// arriving from another site without tags (organic search, a referral) ends it, so a new
// lead is never credited to an old ad click.
const attributionKey = "apex_lead_attribution";
const attributionMaxAgeMs = 30 * 24 * 60 * 60 * 1000;
const attributionParams = { gclid: "gclid", gbraid: "gbraid", wbraid: "wbraid", utm_source: "utm_source", utm_medium: "utm_medium", utm_campaign: "utm_campaign", lpv: "lp_variant" };

const pageAttribution = (() => {
  const params = new URLSearchParams(window.location.search);
  const found = {};
  Object.entries(attributionParams).forEach(([param, field]) => {
    const value = params.get(param);
    if (value) found[field] = value.slice(0, 256);
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
  rememberUserData
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

if (window.location.pathname === "/thank-you" || window.location.pathname === "/thank-you.html") {
  try {
    // The marker holds the submission id, sent as transaction_id so Google Ads
    // counts one conversion per lead even if the tag fires twice.
    const pendingLead = window.sessionStorage.getItem(googleAdsLeadPendingKey);
    if (pendingLead && typeof window.gtag === "function") {
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
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || result?.ok !== true) {
        throw new Error("Request failed");
      }

      leadEventSent = true;
      trackEvent(
        "generate_lead",
        {
          lead_service: payload.service || "",
          lead_area: payload.area || "",
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
    } catch {
      submissionInProgress = false;
      submitButton.disabled = false;
      setFormStatus("Could not send the request. Please call or email us directly.", "error");
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
