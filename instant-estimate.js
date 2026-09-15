export const PRICE_RANGES = {
  "1": { good: "$3,000–$4,000", better: "$4,000–$5,500", best: "$5,500–$7,000" },
  "2": { good: "$4,500–$6,500", better: "$6,500–$8,500", best: "$8,500–$11,000" },
  "3": { good: "$5,500–$8,000", better: "$8,000–$10,500", best: "$10,500–$13,000" },
  "4_plus": { good: "From $7,000", better: "From $9,000", best: "From $11,000" }
};

export const getPriceRanges = (zones) => PRICE_RANGES[zones] || null;
export const GOOGLE_ADS_LEAD_DESTINATION = "AW-18358155203/eht5CKv_lvgcEMPv7LFE";

const root = typeof document === "undefined" ? null : document.querySelector("[data-instant-estimate]");

export const HEAT_PUMP_PRICES = {
  essential: "$7,500–$13,000",
  comfort: "$9,000–$16,000",
  premium: "$11,000–$20,000"
};

const initHeatPumpQuiz = (quizRoot) => {
  const quiz = quizRoot.querySelector("[data-quiz]");
  const steps = [...quizRoot.querySelectorAll("[data-step]")];
  const backButton = quizRoot.querySelector("[data-back]");
  const continueButton = quizRoot.querySelector("[data-continue]");
  const progress = quizRoot.querySelector("[data-progress]");
  const progressFill = progress.querySelector("span");
  const results = quizRoot.querySelector("[data-results]");
  const leadForm = quizRoot.querySelector("[data-instant-lead]");
  const phoneField = quizRoot.querySelector("[data-instant-phone]");
  const emailField = quizRoot.querySelector("[data-instant-email]");
  const phoneError = quizRoot.querySelector("[data-phone-error]");
  const emailError = quizRoot.querySelector("[data-email-error]");
  const contactError = quizRoot.querySelector("[data-contact-method-error]");
  const status = quizRoot.querySelector("[data-instant-status]");
  const state = { currentStep: 1, answers: {} };
  const labels = ["Project plan", "Existing system", "Ductwork", "Home size", "System setup", "Priorities", "System level"];
  let advanceTimer = null;
  let submissionInProgress = false;
  let leadEventSent = false;

  const track = (name, payload = {}) => {
    if (typeof window.gtag === "function") window.gtag("event", name, payload);
    else { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: name, ...payload }); }
  };
  const showStep = (number, focus = true) => {
    state.currentStep = number;
    steps.forEach((step) => { const active = Number(step.dataset.step) === number; step.hidden = !active; step.classList.toggle("is-active", active); });
    quiz.hidden = false; results.hidden = true; quizRoot.querySelector("[data-progress-wrap]").hidden = false;
    backButton.hidden = number === 1; continueButton.hidden = number !== 6;
    quizRoot.querySelector("[data-step-count]").textContent = `Step ${number} of ${steps.length}`;
    quizRoot.querySelector("[data-progress-label]").textContent = labels[number - 1];
    progress.setAttribute("aria-valuenow", String(number)); progressFill.style.width = `${number / steps.length * 100}%`;
    track("instant_estimate_step", { system_type: "heat_pump", step_number: number, step_name: steps[number - 1].dataset.name });
    if (focus) steps[number - 1].querySelector("legend")?.focus();
  };
  const selectedPriorities = () => [...quiz.querySelectorAll('input[name="priorities"]:checked')].map((item) => item.value);
  const showResults = () => {
    const priorities = selectedPriorities();
    if (!priorities.length) { quizRoot.querySelector("[data-priority-note]").textContent = "Choose one or two priorities, or select I’m not sure."; showStep(6); return; }
    state.answers.priorities = priorities;
    const tier = state.answers.selected_tier || "not_sure";
    const range = HEAT_PUMP_PRICES[tier];
    quizRoot.querySelector("[data-heat-pump-result-copy]").textContent = range ? `${tier[0].toUpperCase() + tier.slice(1)} planning range: ${range}` : "We’ll help select the right system level after assessing your home.";
    quiz.hidden = true; quizRoot.querySelector("[data-progress-wrap]").hidden = true; results.hidden = false;
    track("instant_estimate_complete", { system_type: "heat_pump", home_size: state.answers.home_size, selected_tier: tier });
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  quiz.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.name === "priorities") {
      const boxes = [...quiz.querySelectorAll('input[name="priorities"]')];
      const unsure = boxes.find((box) => box.value === "not_sure");
      if (input.value === "not_sure" && input.checked) boxes.forEach((box) => { if (box !== input) box.checked = false; });
      else if (input.checked) { unsure.checked = false; const selected = boxes.filter((box) => box.checked && box.value !== "not_sure"); if (selected.length > 2) input.checked = false; }
      const count = selectedPriorities().filter((value) => value !== "not_sure").length;
      quizRoot.querySelector("[data-priority-note]").textContent = count ? `${count} of 2 selected` : "";
      return;
    }
    state.answers[input.name] = input.value;
    const sourceStep = Number(input.closest("[data-step]")?.dataset.step || state.currentStep);
    window.clearTimeout(advanceTimer);
    advanceTimer = window.setTimeout(() => sourceStep === steps.length ? showResults() : showStep(sourceStep + 1), 160);
  });
  backButton.addEventListener("click", () => { window.clearTimeout(advanceTimer); showStep(Math.max(1, state.currentStep - 1)); });
  continueButton.addEventListener("click", () => {
    const priorities = selectedPriorities();
    if (!priorities.length) {
      quizRoot.querySelector("[data-priority-note]").textContent = "Choose one or two priorities, or select I’m not sure.";
      return;
    }
    state.answers.priorities = priorities;
    showStep(7);
  });
  quizRoot.querySelector("[data-edit-answers]").addEventListener("click", () => showStep(7));

  const phoneDigits = () => { let digits = phoneField.value.replace(/\D/g, ""); if (digits.length > 10 && digits.startsWith("1")) digits = digits.slice(1); return digits.slice(0, 10); };
  const emailValid = () => !emailField.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value.trim());
  phoneField.addEventListener("input", () => { const d = phoneDigits(); phoneField.value = d.length <= 3 ? d : d.length <= 6 ? `(${d.slice(0,3)}) ${d.slice(3)}` : `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`; phoneError.textContent = d.length && d.length !== 10 ? "Enter a valid 10-digit US phone number." : ""; });
  emailField.addEventListener("input", () => { emailError.textContent = emailValid() ? "" : "Enter a valid email address."; });

  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submissionInProgress || leadEventSent) return;
    const fields = Object.fromEntries(new FormData(leadForm).entries());
    const digits = phoneDigits(); const email = String(fields.email || "").trim();
    if ((!digits && !email) || (digits && digits.length !== 10) || !emailValid() || !leadForm.reportValidity()) { contactError.textContent = "Enter a valid phone number, email address, or both."; return; }
    contactError.textContent = "";
    const tier = state.answers.selected_tier || "not_sure";
    const payload = { lead_source: "hvac_quiz", system_type: "heat_pump", project_type: state.answers.project_type, existing_system: state.answers.existing_system, ductwork: state.answers.ductwork, home_size: state.answers.home_size, space_size: state.answers.home_size, system_preference: state.answers.system_preference, priorities: state.answers.priorities, selected_tier: tier, price_range: HEAT_PUMP_PRICES[tier] || "", page: "instant-estimate-heat-pump", first_name: String(fields.first_name || "").trim(), name: String(fields.first_name || "").trim(), preferred_contact_methods: [digits ? "phone" : "", email ? "email" : ""].filter(Boolean), phone: digits ? `+1${digits}` : "", email, zip: String(fields.zip || "").trim(), area: `WA ${String(fields.zip || "").trim()}`, service: "Heat pump installation" };
    const button = leadForm.querySelector('button[type="submit"]'); submissionInProgress = true; button.disabled = true; status.textContent = "Sending request...";
    try { const response = await fetch(leadForm.dataset.endpoint || "/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json().catch(() => null); if (!response.ok || data?.ok !== true) throw new Error("Request failed"); leadEventSent = true; track("instant_estimate_lead", { system_type: "heat_pump", selected_tier: tier }); track("conversion", { send_to: GOOGLE_ADS_LEAD_DESTINATION }); track("generate_lead", { lead_service: payload.service, lead_area: payload.area, page_location: window.location.href, system_type: "heat_pump" }); window.location.href = "/thank-you"; }
    catch { submissionInProgress = false; button.disabled = false; status.textContent = "Could not send the request. Please call or email us directly."; status.className = "form-status is-error"; }
  });
  track("instant_estimate_start", { system_type: "heat_pump" });
  showStep(1, false);
};

if (root?.dataset.systemType === "heat_pump") {
  initHeatPumpQuiz(root);
} else if (root) {
  const quiz = root.querySelector("[data-quiz]");
  const steps = [...root.querySelectorAll("[data-step]")];
  const backButton = root.querySelector("[data-back]");
  const continueButton = root.querySelector("[data-continue]");
  const progress = root.querySelector("[data-progress]");
  const progressFill = progress.querySelector("span");
  const stepCount = root.querySelector("[data-step-count]");
  const progressLabel = root.querySelector("[data-progress-label]");
  const priorityNote = root.querySelector("[data-priority-note]");
  const results = root.querySelector("[data-results]");
  const contact = root.querySelector("[data-contact]");
  const leadForm = root.querySelector("[data-instant-lead]");
  const phoneField = root.querySelector("[data-instant-phone]");
  const emailField = root.querySelector("[data-instant-email]");
  const phoneGroup = root.querySelector("[data-phone-group]");
  const emailGroup = root.querySelector("[data-email-group]");
  const contactMethodInputs = [...root.querySelectorAll('input[name="preferred_contact_methods"]')];
  const contactMethodError = root.querySelector("[data-contact-method-error]");
  const phoneError = root.querySelector("[data-phone-error]");
  const emailError = root.querySelector("[data-email-error]");
  const formStatus = root.querySelector("[data-instant-status]");
  const state = { currentStep: 1, answers: {}, selectedTier: "not_sure", resultsShown: false };
  const stepLabels = ["Project type", "Existing system", "Space size", "Zones", "Priorities"];
  let submissionInProgress = false;
  let advanceTimer = null;

  const track = (eventName, payload = {}) => {
    if (typeof window.gtag === "function") window.gtag("event", eventName, payload);
    else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: eventName, ...payload });
    }
  };

  const showStep = (number, { focus = true } = {}) => {
    state.currentStep = number;
    steps.forEach((step) => {
      const active = Number(step.dataset.step) === number;
      step.hidden = !active;
      step.classList.toggle("is-active", active);
    });
    quiz.hidden = false;
    results.hidden = true;
    root.querySelector("[data-progress-wrap]").hidden = false;
    backButton.hidden = number === 1;
    continueButton.hidden = number !== 5;
    stepCount.textContent = `Step ${number} of 5`;
    progressLabel.textContent = stepLabels[number - 1];
    progress.setAttribute("aria-valuenow", String(number));
    progressFill.style.width = `${number * 20}%`;
    track("instant_estimate_step", { step_number: number, step_name: steps[number - 1].dataset.name });
    if (focus) steps[number - 1].querySelector("legend")?.focus?.();
  };

  const selectedPriorities = () => [...quiz.querySelectorAll('input[name="priorities"]:checked')].map((input) => input.value);

  const showResults = () => {
    const priorities = selectedPriorities();
    if (!priorities.length) {
      priorityNote.textContent = "Choose one or two priorities, or select I’m not sure.";
      return;
    }
    state.answers.priorities = priorities;
    state.resultsShown = true;
    quiz.hidden = true;
    root.querySelector("[data-progress-wrap]").hidden = true;
    results.hidden = false;
    const ranges = getPriceRanges(state.answers.zones);
    root.querySelector("[data-unsure-note]").hidden = Boolean(ranges);
    ["good", "better", "best"].forEach((tier) => {
      root.querySelector(`[data-price="${tier}"]`).textContent = ranges?.[tier] || "Price confirmed after assessment";
    });
    track("instant_estimate_complete", { system_type: "mini_split", zones: state.answers.zones, space_size: state.answers.space_size });
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  quiz.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.name === "priorities") {
      const boxes = [...quiz.querySelectorAll('input[name="priorities"]')];
      const unsure = boxes.find((box) => box.value === "not_sure");
      if (input.value === "not_sure" && input.checked) boxes.forEach((box) => { if (box !== input) box.checked = false; });
      else if (input.checked) {
        unsure.checked = false;
        const chosen = boxes.filter((box) => box.checked && box.value !== "not_sure");
        if (chosen.length > 2) input.checked = false;
      }
      const count = selectedPriorities().filter((value) => value !== "not_sure").length;
      priorityNote.textContent = count ? `${count} of 2 selected` : "";
      return;
    }
    state.answers[input.name] = input.value;
    const sourceStep = Number(input.closest("[data-step]")?.dataset.step || state.currentStep);
    window.clearTimeout(advanceTimer);
    advanceTimer = window.setTimeout(() => {
      if (state.currentStep === sourceStep) showStep(Math.min(sourceStep + 1, 5));
    }, 160);
  });

  backButton.addEventListener("click", () => {
    window.clearTimeout(advanceTimer);
    showStep(Math.max(1, state.currentStep - 1));
  });
  continueButton.addEventListener("click", showResults);
  root.querySelector("[data-edit-answers]").addEventListener("click", () => showStep(5));

  root.querySelectorAll("[data-tier]").forEach((button) => button.addEventListener("click", () => {
    state.selectedTier = button.dataset.tier;
    root.querySelectorAll("[data-tier-card]").forEach((card) => card.classList.toggle("is-selected", card.dataset.tierCard === state.selectedTier));
    track("instant_estimate_tier_select", { tier: state.selectedTier });
    contact.scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  const phoneDigits = () => {
    let digits = phoneField.value.replace(/\D/g, "");
    if (digits.length > 10 && digits.startsWith("1")) digits = digits.slice(1);
    return digits.slice(0, 10);
  };

  const selectedContactMethods = () => contactMethodInputs.filter((input) => input.checked).map((input) => input.value);
  const emailIsValid = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value.trim());
  const setFieldError = (field, errorElement, message) => {
    errorElement.textContent = message;
    field.setAttribute("aria-invalid", message ? "true" : "false");
  };
  const updateContactFields = () => {
    const methods = selectedContactMethods();
    const wantsPhone = methods.includes("phone");
    const wantsEmail = methods.includes("email");
    phoneGroup.hidden = !wantsPhone;
    emailGroup.hidden = !wantsEmail;
    phoneField.required = wantsPhone;
    emailField.required = wantsEmail;
    if (!wantsPhone) {
      phoneField.setCustomValidity("");
      setFieldError(phoneField, phoneError, "");
    }
    if (!wantsEmail) {
      emailField.setCustomValidity("");
      setFieldError(emailField, emailError, "");
    }
    contactMethodError.textContent = methods.length ? "" : contactMethodError.textContent;
  };

  contactMethodInputs.forEach((input) => input.addEventListener("change", updateContactFields));
  phoneField.addEventListener("input", () => {
    const digits = phoneDigits();
    phoneField.value = digits.length <= 3 ? digits : digits.length <= 6 ? `(${digits.slice(0, 3)}) ${digits.slice(3)}` : `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    const message = selectedContactMethods().includes("phone") && digits.length !== 10 ? "Enter a valid 10-digit US phone number." : "";
    phoneField.setCustomValidity(message);
    setFieldError(phoneField, phoneError, message);
  });
  emailField.addEventListener("input", () => {
    const message = !emailField.value.trim() || emailIsValid() ? "" : "Enter a valid email address.";
    emailField.setCustomValidity(message);
    setFieldError(emailField, emailError, message);
  });
  phoneField.addEventListener("invalid", () => {
    const message = phoneDigits().length ? "Enter a valid 10-digit US phone number." : "Enter your phone number.";
    setFieldError(phoneField, phoneError, message);
    formStatus.textContent = "Please complete the selected contact field.";
    formStatus.className = "form-status is-error";
  });
  emailField.addEventListener("invalid", () => {
    const message = emailField.value.trim() ? "Enter a valid email address." : "Enter your email address.";
    setFieldError(emailField, emailError, message);
    formStatus.textContent = "Please complete the selected contact field.";
    formStatus.className = "form-status is-error";
  });

  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submissionInProgress) return;
    const methods = selectedContactMethods();
    if (!methods.length) {
      contactMethodError.textContent = "Please select at least one contact method.";
      contactMethodInputs[0].focus();
      formStatus.textContent = "Please select how you would like us to contact you.";
      formStatus.className = "form-status is-error";
      return;
    }
    contactMethodError.textContent = "";
    const digits = phoneDigits();
    const wantsPhone = methods.includes("phone");
    const wantsEmail = methods.includes("email");
    const phoneMessage = wantsPhone && digits.length !== 10 ? (digits.length ? "Enter a valid 10-digit US phone number." : "Enter your phone number.") : "";
    const emailMessage = wantsEmail && !emailField.value.trim() ? "Enter your email address." : wantsEmail && !emailIsValid() ? "Enter a valid email address." : "";
    phoneField.setCustomValidity(phoneMessage);
    emailField.setCustomValidity(emailMessage);
    setFieldError(phoneField, phoneError, phoneMessage);
    setFieldError(emailField, emailError, emailMessage);
    if (!leadForm.reportValidity()) {
      formStatus.textContent = "Please complete the required fields with valid contact information and ZIP code.";
      formStatus.className = "form-status is-error";
      return;
    }
    const fields = Object.fromEntries(new FormData(leadForm).entries());
    const ranges = getPriceRanges(state.answers.zones);
    const payload = {
      lead_source: "mini_split_instant_estimate",
      system_type: "mini_split",
      project_type: state.answers.project_type,
      existing_system: state.answers.existing_system,
      space_size: state.answers.space_size,
      zones: state.answers.zones,
      priorities: state.answers.priorities,
      selected_tier: state.selectedTier,
      price_good: ranges?.good || "Zone count to be determined",
      price_better: ranges?.better || "Zone count to be determined",
      price_best: ranges?.best || "Zone count to be determined",
      page: "instant-estimate-mini-split",
      first_name: String(fields.first_name || "").trim(),
      name: String(fields.first_name || "").trim(),
      preferred_contact_methods: methods,
      phone: wantsPhone ? `+1${digits}` : "",
      email: wantsEmail ? String(fields.email || "").trim() : "",
      zip: String(fields.zip || "").trim(),
      area: `WA ${String(fields.zip || "").trim()}`,
      service: "Mini-split installation"
    };
    submissionInProgress = true;
    leadForm.querySelector('button[type="submit"]').disabled = true;
    formStatus.textContent = "Sending request...";
    try {
      const response = await fetch(leadForm.dataset.endpoint || "/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) throw new Error("Request failed");
      track("instant_estimate_lead", { system_type: "mini_split", zones: state.answers.zones, selected_tier: state.selectedTier });
      track("conversion", { send_to: GOOGLE_ADS_LEAD_DESTINATION });
      track("generate_lead", { lead_service: payload.service, lead_area: payload.area, page_location: window.location.href });
      window.location.href = "/thank-you";
    } catch {
      submissionInProgress = false;
      leadForm.querySelector('button[type="submit"]').disabled = false;
      formStatus.textContent = "Could not send the request. Please call or email us directly.";
      formStatus.className = "form-status is-error";
    }
  });

  track("instant_estimate_start", { system_type: "mini_split" });
  updateContactFields();
  showStep(1, { focus: false });
}
