const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const toggle = document.querySelector("[data-nav-toggle]");
const areaField = document.querySelector("[data-area-field]");
const serviceField = document.querySelector('select[name="service"]');
const backdrop = document.createElement("button");

backdrop.className = "nav-backdrop";
backdrop.type = "button";
backdrop.setAttribute("aria-label", "Close navigation");
document.body.append(backdrop);

const syncHeader = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 18);
};

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

const setNavOpen = (isOpen) => {
  toggle.setAttribute("aria-expanded", String(isOpen));
  toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  toggle.classList.toggle("is-active", isOpen);
  nav.classList.toggle("is-open", isOpen);
  header.classList.toggle("is-open", isOpen);
  backdrop.classList.toggle("is-open", isOpen);
  if (!isOpen) {
    nav.querySelectorAll(".is-submenu-open").forEach((item) => item.classList.remove("is-submenu-open"));
  }
};

toggle.addEventListener("click", () => {
  setNavOpen(toggle.getAttribute("aria-expanded") !== "true");
});

document.querySelectorAll(".has-menu").forEach((item) => {
  let closeTimer;

  item.addEventListener("pointerenter", () => {
    if (window.matchMedia("(max-width: 980px)").matches) return;
    window.clearTimeout(closeTimer);
    item.classList.add("is-submenu-open");
  });

  item.addEventListener("pointerleave", () => {
    if (window.matchMedia("(max-width: 980px)").matches) return;
    closeTimer = window.setTimeout(() => {
      item.classList.remove("is-submenu-open");
    }, 320);
  });
});

nav.addEventListener("click", (event) => {
  const trigger = event.target.closest(".nav-trigger");
  if (trigger && window.matchMedia("(max-width: 980px)").matches) {
    event.preventDefault();
    trigger.closest(".has-menu")?.classList.toggle("is-submenu-open");
    return;
  }

  if (!event.target.closest("a")) return;
  setNavOpen(false);
});

backdrop.addEventListener("click", () => {
  setNavOpen(false);
});

document.addEventListener("click", (event) => {
  if (!nav.classList.contains("is-open")) return;
  if (header.contains(event.target)) return;
  setNavOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setNavOpen(false);
  }
});

document.querySelectorAll(".area-list li, .area-group li").forEach((item) => {
  if (item.querySelector("a")) return;
  const areaName = item.textContent.trim();
  if (!areaName) return;

  const link = document.createElement("a");
  link.href = `/index.html?area=${encodeURIComponent(areaName)}#contact`;
  link.textContent = areaName;
  link.className = "area-picker-link";
  item.textContent = "";
  item.append(link);
});

const params = new URLSearchParams(window.location.search);
const selectedArea = params.get("area");
const selectedService = params.get("service");

if (selectedArea && areaField) {
  areaField.value = selectedArea;
  areaField.closest("label")?.classList.add("is-prefilled");
}

if (selectedService && serviceField) {
  serviceField.value = selectedService;
}

document.querySelectorAll('a[href^="/index.html?area="]').forEach((link) => {
  link.addEventListener("click", (event) => {
    if (window.location.pathname !== "/" && !window.location.pathname.endsWith("/index.html")) return;

    event.preventDefault();
    const linkParams = new URL(link.href).searchParams;
    const area = linkParams.get("area") || "";
    const service = linkParams.get("service") || "";
    if (areaField) {
      areaField.value = area;
      areaField.closest("label")?.classList.add("is-prefilled");
    }
    if (serviceField && service) {
      serviceField.value = service;
    }
    const nextUrl = service
      ? `/index.html?area=${encodeURIComponent(area)}&service=${encodeURIComponent(service)}#contact`
      : `/index.html?area=${encodeURIComponent(area)}#contact`;
    history.replaceState(null, "", nextUrl);
    document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const leadForm = document.querySelector("[data-lead-form]");

if (leadForm) {
  const status = leadForm.querySelector("[data-form-status]");
  const submitButton = leadForm.querySelector('button[type="submit"]');
  const phoneField = leadForm.querySelector("[data-phone-field]");
  const endpoint = leadForm.dataset.endpoint || "/api/lead";

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

    const phoneDigits = getPhoneDigits();
    if (phoneField) {
      phoneField.setCustomValidity(phoneDigits.length === 10 ? "" : "Enter a 10-digit US phone number.");
    }

    if (!leadForm.reportValidity()) {
      setFormStatus("Please complete all required fields with a valid email and phone number.", "error");
      return;
    }

    setFormStatus("Sending request...");
    submitButton.disabled = true;

    const payload = Object.fromEntries(new FormData(leadForm).entries());
    payload.phone = `+1${phoneDigits}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      window.location.href = "/thank-you.html";
    } catch {
      setFormStatus("Could not send the request. Please call or email us directly.", "error");
    } finally {
      submitButton.disabled = false;
    }
  });
}

document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
  link.addEventListener("click", () => {
    const payload = JSON.stringify({
      phone: link.getAttribute("href")?.replace("tel:", "") || "",
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
