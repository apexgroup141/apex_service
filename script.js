const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const toggle = document.querySelector("[data-nav-toggle]");
const areaField = document.querySelector("[data-area-field]");
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

const selectedArea = new URLSearchParams(window.location.search).get("area");

if (selectedArea && areaField) {
  areaField.value = selectedArea;
  areaField.closest("label")?.classList.add("is-prefilled");
}

document.querySelectorAll('a[href^="/index.html?area="]').forEach((link) => {
  link.addEventListener("click", (event) => {
    if (window.location.pathname !== "/" && !window.location.pathname.endsWith("/index.html")) return;

    event.preventDefault();
    const area = new URL(link.href).searchParams.get("area") || "";
    if (areaField) {
      areaField.value = area;
      areaField.closest("label")?.classList.add("is-prefilled");
    }
    history.replaceState(null, "", `/index.html?area=${encodeURIComponent(area)}#contact`);
    document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const leadForm = document.querySelector("[data-lead-form]");

if (leadForm) {
  const status = leadForm.querySelector("[data-form-status]");
  const submitButton = leadForm.querySelector('button[type="submit"]');
  const endpoint = leadForm.dataset.endpoint || "/api/lead";

  const setFormStatus = (message, type = "") => {
    status.textContent = message;
    status.classList.toggle("is-success", type === "success");
    status.classList.toggle("is-error", type === "error");
  };

  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormStatus("Sending request...");
    submitButton.disabled = true;

    const payload = Object.fromEntries(new FormData(leadForm).entries());

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
