// /yard: landing page for the yard-sign QR code (/go redirects here with yard_sign UTMs).
// Every step stays on this page; the contact form is never re-rendered, so changing a choice
// keeps whatever the visitor already typed.
(() => {
  const root = document.querySelector("[data-yard-picker]");
  if (!root) return;

  const CATEGORIES = {
    mini_split: { label: "Mini-Split", tasks: ["install_replace", "repair", "maintenance"] },
    heat_pump: { label: "Heat Pump", tasks: ["install_replace", "repair", "maintenance"] },
    furnace: { label: "Furnace", tasks: ["install_replace", "repair", "maintenance"] },
    repair_maintenance: { label: "Repair & Maintenance", tasks: ["repair", "maintenance"] },
    other: { label: "Other", tasks: ["other"] }
  };
  const TASKS = { install_replace: "Install or Replace", repair: "Repair", maintenance: "Maintenance", other: "Other request" };
  // The free estimate is for installs and replacements only.
  const ACTION_LABELS = { install_replace: "Request a Free Estimate", repair: "Request Service", maintenance: "Request Service", other: "Send a Request" };

  const $ = (selector) => root.querySelector(selector);
  const steps = {
    category: $('[data-yard-step="category"]'),
    task: $('[data-yard-step="task"]'),
    contact: $('[data-yard-step="contact"]')
  };
  const taskTitle = $("[data-yard-task-title]");
  const taskOptions = $("[data-yard-task-options]");
  const equipmentWrap = $("[data-yard-equipment-wrap]");
  const equipmentField = $("[data-yard-equipment]");
  const descriptionWrap = $("[data-yard-description-wrap]");
  const descriptionField = $("[data-yard-description]");
  const descriptionError = $("[data-yard-description-error]");
  const summary = $("[data-yard-summary]");
  const openFormButton = $("[data-yard-open-form]");
  const form = $("[data-yard-form]");
  const formTitle = $("[data-yard-form-title]");
  const submitButton = $("[data-yard-submit]");
  const status = $("[data-yard-status]");
  const success = $("[data-yard-success]");
  const fields = {
    name: $("[data-yard-name]"),
    phone: $("[data-yard-phone]"),
    email: $("[data-yard-email]"),
    zip: $("[data-yard-zip]"),
    details: $("[data-yard-details]")
  };
  const errors = {
    name: $("[data-yard-name-error]"),
    phone: $("[data-yard-phone-error]"),
    email: $("[data-yard-email-error]"),
    zip: $("[data-yard-zip-error]")
  };
  const phoneWrap = $("[data-yard-phone-wrap]");
  const emailWrap = $("[data-yard-email-wrap]");

  const state = { category: "", task: "", submitting: false, sent: false };

  const track = (name, params = {}) => {
    if (typeof window.gtag === "function") window.gtag("event", name, params);
    else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: name, ...params });
    }
  };

  // A visit counts as yard_sign only when its stored campaign tags say so (set by /go or a
  // tagged link); a direct visit to /yard stays "none".
  const trafficSource = () => {
    let attribution = null;
    try { attribution = window.apexLeadContext?.attribution?.() || null; } catch {}
    if (!attribution) return "none";
    if (String(attribution.utm_source || "").toLowerCase() === "yard_sign") return "yard_sign";
    if (attribution.gclid || attribution.gbraid || attribution.wbraid) return "google_ads";
    return attribution.utm_source ? "other_campaign" : "none";
  };

  const showSteps = (visible) => {
    Object.entries(steps).forEach(([name, element]) => { element.hidden = !visible.includes(name); });
  };

  const reveal = (element, focusTarget) => {
    window.requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      focusTarget?.focus({ preventScroll: true });
    });
  };

  const setPressed = (selector, attribute, value) => {
    root.querySelectorAll(selector).forEach((button) => button.setAttribute("aria-pressed", String(button.getAttribute(attribute) === value)));
  };

  const updateContactStep = () => {
    const label = ACTION_LABELS[state.task] || "Send a Request";
    openFormButton.textContent = label;
    submitButton.textContent = label;
    summary.textContent = state.category === "other"
      ? "Other request"
      : `${CATEGORIES[state.category].label} · ${TASKS[state.task]}`;
  };

  const chooseCategory = (category) => {
    const config = CATEGORIES[category];
    if (!config) return;
    if (category !== state.category) {
      state.category = category;
      state.task = category === "other" ? "other" : "";
      track("yard_category_select", { category, traffic_source: trafficSource() });
    }
    setPressed("[data-yard-category]", "data-yard-category", category);

    const isOther = category === "other";
    taskTitle.textContent = isOther
      ? "Tell us what you need"
      : category === "repair_maintenance"
        ? "Repair or maintenance?"
        : `What do you need for your ${config.label.toLowerCase()}?`;
    taskOptions.hidden = isOther;
    root.querySelectorAll("[data-yard-task]").forEach((button) => { button.hidden = !config.tasks.includes(button.dataset.yardTask); });
    setPressed("[data-yard-task]", "data-yard-task", state.task);
    equipmentWrap.hidden = category !== "repair_maintenance";
    descriptionWrap.hidden = !isOther;

    if (state.task) {
      updateContactStep();
      showSteps(["task", "contact"]);
    } else {
      showSteps(["task"]);
    }
    reveal(steps.task, isOther ? descriptionField : taskTitle);
  };

  const chooseTask = (task) => {
    if (!CATEGORIES[state.category]?.tasks.includes(task)) return;
    if (task !== state.task) {
      state.task = task;
      track("yard_task_select", { category: state.category, task, traffic_source: trafficSource() });
    }
    setPressed("[data-yard-task]", "data-yard-task", task);
    updateContactStep();
    showSteps(["task", "contact"]);
    reveal(steps.contact, form.hidden ? null : formTitle);
  };

  root.addEventListener("click", (event) => {
    if (state.sent) return;
    const categoryButton = event.target.closest("[data-yard-category]");
    if (categoryButton) { chooseCategory(categoryButton.dataset.yardCategory); return; }
    const taskButton = event.target.closest("[data-yard-task]");
    if (taskButton) { chooseTask(taskButton.dataset.yardTask); return; }
    if (event.target.closest("[data-yard-back]")) {
      showSteps(["category"]);
      reveal(steps.category, $("#yard-picker-title"));
    }
  });

  document.querySelector("[data-yard-start]")?.addEventListener("click", (event) => {
    event.preventDefault();
    const target = state.sent ? success : steps.category.hidden ? steps.task : steps.category;
    reveal(root, target === steps.category ? $("#yard-picker-title") : null);
  });

  openFormButton.addEventListener("click", () => {
    form.hidden = false;
    openFormButton.hidden = true;
    reveal(form, fields.name);
  });

  // Contact fields: same rules as the instant estimates.
  const method = () => form.querySelector('input[name="preferred_contact_method"]:checked')?.value || "phone";
  const phoneDigits = () => {
    let digits = fields.phone.value.replace(/\D/g, "");
    if (digits.length > 10 && digits.startsWith("1")) digits = digits.slice(1);
    return digits.slice(0, 10);
  };
  const emailIsValid = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.value.trim());
  const setError = (name, message) => {
    errors[name].textContent = message;
    fields[name].setAttribute("aria-invalid", message ? "true" : "false");
  };
  const setStatus = (message, type = "") => {
    status.textContent = message;
    status.className = `form-status${type ? ` is-${type}` : ""}`;
  };

  form.addEventListener("change", (event) => {
    if (event.target.name !== "preferred_contact_method") return;
    const usePhone = method() === "phone";
    phoneWrap.hidden = !usePhone;
    emailWrap.hidden = usePhone;
    setError(usePhone ? "email" : "phone", "");
  });
  fields.phone.addEventListener("input", () => {
    const d = phoneDigits();
    fields.phone.value = d.length <= 3 ? d : d.length <= 6 ? `(${d.slice(0, 3)}) ${d.slice(3)}` : `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    if (errors.phone.textContent) setError("phone", d.length === 10 ? "" : errors.phone.textContent);
  });
  fields.email.addEventListener("input", () => { if (errors.email.textContent && emailIsValid()) setError("email", ""); });
  fields.name.addEventListener("input", () => { if (fields.name.value.trim()) setError("name", ""); });
  fields.zip.addEventListener("input", () => { if (/^\d{5}(-\d{4})?$/.test(fields.zip.value.trim())) setError("zip", ""); });
  descriptionField.addEventListener("input", () => { if (descriptionField.value.trim()) descriptionError.textContent = ""; });

  const validate = () => {
    const problems = [];
    const check = (name, message) => { setError(name, message); if (message) problems.push(fields[name]); };
    check("name", fields.name.value.trim() ? "" : "Enter your name.");
    if (method() === "phone") {
      const digits = phoneDigits();
      check("phone", digits.length === 10 ? "" : digits.length ? "Enter a valid 10-digit US phone number." : "Enter your phone number.");
      setError("email", "");
    } else {
      const email = fields.email.value.trim();
      check("email", emailIsValid() ? "" : email ? "Enter a valid email address." : "Enter your email address.");
      setError("phone", "");
    }
    check("zip", /^\d{5}(-\d{4})?$/.test(fields.zip.value.trim()) ? "" : "Enter a 5-digit ZIP code.");
    if (state.category === "other" && !descriptionField.value.trim()) {
      descriptionError.textContent = "Tell us briefly what you need.";
      problems.unshift(descriptionField);
    } else {
      descriptionError.textContent = "";
    }
    return problems;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.submitting || state.sent) return;
    if (!state.category || !state.task) {
      setStatus("Choose what we can help you with first.", "error");
      showSteps(["category"]);
      reveal(steps.category, $("#yard-picker-title"));
      return;
    }
    const problems = validate();
    if (problems.length) {
      setStatus("Please check the highlighted fields.", "error");
      problems[0].focus();
      return;
    }

    const contactMethod = method();
    const zip = fields.zip.value.trim();
    const payload = {
      lead_source: "yard_sign_picker",
      category: state.category,
      task: state.task,
      equipment: state.category === "repair_maintenance" ? equipmentField.value : "",
      description: state.category === "other" ? descriptionField.value.trim() : "",
      name: fields.name.value.trim(),
      preferred_contact_method: contactMethod,
      phone: contactMethod === "phone" ? `+1${phoneDigits()}` : "",
      email: contactMethod === "email" ? fields.email.value.trim() : "",
      zip,
      area: `WA ${zip}`,
      details: fields.details.value.trim(),
      company: form.querySelector('input[name="company"]').value,
      page: "yard"
    };
    window.apexLeadContext?.decorate(payload, form);

    state.submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    setStatus("Sending your request...");
    try {
      await window.apexLeadGuard?.protect(payload, form);
      const response = await fetch(form.dataset.endpoint || "/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        const fallback = "Could not send your request. Please try again or call us at (253) 282-1126.";
        const outcome = window.apexLeadGuard?.outcome(form, response, result, fallback)
          || { kind: "error", message: response.status === 400 && result?.error ? result.error : fallback };
        if (outcome.kind === "held") {
          // Saved for review only, not a confirmed lead: the picker stays as it is.
          state.sent = true;
          submitButton.textContent = "Request received";
          setStatus(outcome.message, "success");
          return;
        }
        const error = new Error("Request failed");
        error.userMessage = outcome.message;
        throw error;
      }
      state.sent = true;
      const source = trafficSource();
      track("yard_lead_success", { category: state.category, task: state.task, contact_method: contactMethod, traffic_source: source });
      track("generate_lead", { lead_service: state.category === "other" ? "Other request" : `${CATEGORIES[state.category].label}: ${TASKS[state.task]}`, lead_source: "yard_page", traffic_source: source });
      success.querySelector("[data-yard-success-method]").textContent = contactMethod === "phone" ? "phone" : "email";
      form.hidden = true;
      steps.category.hidden = true;
      steps.task.hidden = true;
      $(".yard-actions").hidden = true;
      summary.hidden = true;
      success.hidden = false;
      reveal(success, success);
    } catch (error) {
      state.submitting = false;
      submitButton.disabled = false;
      submitButton.textContent = ACTION_LABELS[state.task] || "Send a Request";
      setStatus(error.userMessage || "Could not send your request. Please try again or call us at (253) 282-1126.", "error");
    }
  });

  // Every call tap on this page (picker, header, success message).
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.('a[href^="tel:"]');
    if (!link) return;
    track("yard_call_click", {
      cta_location: link.hasAttribute("data-yard-call") ? (link.closest("[data-yard-success]") ? "success" : "picker") : link.closest("header") ? "header" : link.closest("footer") ? "footer" : "page",
      category: state.category || "none",
      task: state.task || "none",
      traffic_source: trafficSource()
    });
  });

  track("yard_page_view", { traffic_source: trafficSource() });
})();
