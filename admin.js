const tokenKey = "apex-admin-token";
const login = document.querySelector("[data-admin-login]");
const tokenInput = document.querySelector("[data-admin-token]");
const loginButton = document.querySelector("[data-admin-login-button]");
const loginStatus = document.querySelector("[data-admin-login-status]");
const togglePassword = document.querySelector("[data-admin-toggle-password]");
const resetButton = document.querySelector("[data-admin-reset]");
const panel = document.querySelector("[data-admin-panel]");
const filters = document.querySelector("[data-admin-filters]");
const status = document.querySelector("[data-admin-status]");
const tableBody = document.querySelector("[data-leads-body]");
const totalLeads = document.querySelector("[data-total-leads]");
const totalCalls = document.querySelector("[data-total-calls]");
const shownLeads = document.querySelector("[data-shown-leads]");
const addClientButton = document.querySelector("[data-add-client]");
const editor = document.querySelector("[data-admin-editor]");
const cancelEditorButton = document.querySelector("[data-cancel-editor]");
const exportButton = document.querySelector("[data-export-csv]");

let leads = [];

const setStatus = (element, message, type = "") => {
  element.textContent = message;
  element.classList.toggle("is-error", type === "error");
  element.classList.toggle("is-success", type === "success");
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const formatDate = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles"
  }).format(new Date(value));
};

const getToken = () => localStorage.getItem(tokenKey) || "";

const adminHeaders = () => ({
  Authorization: `Bearer ${getToken()}`
});

const adminJsonHeaders = () => ({
  ...adminHeaders(),
  "Content-Type": "application/json"
});

const showPanel = () => {
  login.hidden = true;
  panel.hidden = false;
  resetButton.hidden = false;
};

const showLogin = () => {
  login.hidden = false;
  panel.hidden = true;
  resetButton.hidden = true;
};

const showEditor = (lead = null) => {
  editor.hidden = false;
  editor.elements.id.value = lead?.id || "";
  editor.elements.source.value = lead?.source || "lead";
  editor.elements.name.value = lead?.name || "";
  editor.elements.email.value = lead?.email || "";
  editor.elements.phone.value = lead?.phone || "";
  editor.elements.area.value = lead?.area || "";
  editor.elements.service.value = lead?.service || "";
  editor.elements.message.value = lead?.message || "";
  editor.querySelector("input[name='name']").focus();
};

const hideEditor = () => {
  editor.hidden = true;
  editor.reset();
};

const leadRow = (lead) => `
  <tr data-id="${escapeHtml(lead.id)}" data-source="${escapeHtml(lead.source || "lead")}">
    <td>${escapeHtml(formatDate(lead.created_at))}</td>
    <td><strong>${escapeHtml(lead.name)}</strong></td>
    <td><a href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a></td>
    <td><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td>
    <td>${escapeHtml(lead.area)}</td>
    <td>${escapeHtml(lead.service)}</td>
    <td>${escapeHtml(lead.message)}</td>
    <td>
      <div class="admin-row-actions">
        <button type="button" data-edit-client>Edit</button>
        <button type="button" data-delete-client>Delete</button>
      </div>
    </td>
  </tr>
`;

const renderLeads = (data) => {
  leads = data.leads || [];
  totalLeads.textContent = String(data.total || 0);
  totalCalls.textContent = String(data.stats?.callClicks || 0);
  shownLeads.textContent = String(leads.length);

  tableBody.innerHTML = leads.length
    ? leads.map(leadRow).join("")
    : `<tr><td colspan="8" class="admin-empty">No leads found.</td></tr>`;
};

const loadLeads = async ({ revealPanel = true } = {}) => {
  const token = getToken();
  if (!token) {
    showLogin();
    return;
  }

  if (revealPanel) {
    showPanel();
    setStatus(status, "Loading leads...");
  } else {
    setStatus(loginStatus, "Checking token...");
  }

  const formData = new FormData(filters);
  const params = new URLSearchParams();
  params.set("limit", "100");
  for (const [key, value] of formData.entries()) {
    if (String(value).trim()) params.set(key, String(value).trim());
  }

  const response = await fetch(`/api/admin/leads?${params.toString()}`, {
    headers: adminHeaders()
  });

  if (response.status === 401) {
    localStorage.removeItem(tokenKey);
    showLogin();
    throw new Error("Wrong admin token.");
  }

  if (!response.ok) {
    throw new Error("Could not load leads.");
  }

  renderLeads(await response.json());
  showPanel();
  setStatus(loginStatus, "");
  setStatus(status, "Leads loaded.", "success");
};

const csvValue = (value) => `"${String(value || "").replaceAll('"', '""')}"`;

const exportCsv = () => {
  const header = ["Date", "Name", "Phone", "Email", "Area", "Service", "Message", "Page"];
  const rows = leads.map((lead) => [
    lead.created_at,
    lead.name,
    lead.phone,
    lead.email,
    lead.area,
    lead.service,
    lead.message,
    lead.page
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `apex-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const saveClient = async (event) => {
  event.preventDefault();

  if (!editor.reportValidity()) return;

  const payload = Object.fromEntries(new FormData(editor).entries());
  const isEdit = Boolean(payload.id);
  const url = isEdit ? `/api/admin/leads/${encodeURIComponent(payload.source)}/${encodeURIComponent(payload.id)}` : "/api/admin/leads";
  const response = await fetch(url, {
    method: isEdit ? "PATCH" : "POST",
    headers: adminJsonHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Could not save client.");
  }

  hideEditor();
  await loadLeads();
  setStatus(status, isEdit ? "Client updated." : "Client added.", "success");
};

const deleteClient = async (lead) => {
  const name = lead.name || lead.phone || "this client";
  if (!window.confirm(`Delete ${name}?`)) return;

  const response = await fetch(`/api/admin/leads/${encodeURIComponent(lead.source || "lead")}/${encodeURIComponent(lead.id)}`, {
    method: "DELETE",
    headers: adminHeaders()
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Could not delete client.");
  }

  await loadLeads();
  setStatus(status, "Client deleted.", "success");
};

loginButton.addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  if (!token) return;
  localStorage.setItem(tokenKey, token);
  try {
    await loadLeads({ revealPanel: false });
  } catch (error) {
    setStatus(loginStatus, error.message, "error");
  }
});

tokenInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    loginButton.click();
  }
});

togglePassword.addEventListener("click", () => {
  const isHidden = tokenInput.type === "password";
  tokenInput.type = isHidden ? "text" : "password";
  togglePassword.textContent = isHidden ? "Hide" : "Show";
  togglePassword.setAttribute("aria-label", isHidden ? "Hide admin token" : "Show admin token");
  tokenInput.focus();
});

resetButton.addEventListener("click", () => {
  localStorage.removeItem(tokenKey);
  tokenInput.value = "";
  showLogin();
});

filters.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await loadLeads();
  } catch (error) {
    setStatus(status, error.message, "error");
  }
});

addClientButton.addEventListener("click", () => {
  showEditor();
});

cancelEditorButton.addEventListener("click", hideEditor);

editor.addEventListener("submit", async (event) => {
  try {
    await saveClient(event);
  } catch (error) {
    setStatus(status, error.message, "error");
  }
});

tableBody.addEventListener("click", async (event) => {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;

  const lead = leads.find((item) => String(item.id) === row.dataset.id && String(item.source || "lead") === row.dataset.source);
  if (!lead) return;

  if (event.target.closest("[data-edit-client]")) {
    showEditor(lead);
    return;
  }

  if (event.target.closest("[data-delete-client]")) {
    try {
      await deleteClient(lead);
    } catch (error) {
      setStatus(status, error.message, "error");
    }
  }
});

exportButton.addEventListener("click", exportCsv);

if (getToken()) {
  loadLeads().catch((error) => {
    showLogin();
    setStatus(loginStatus, error.message, "error");
  });
} else {
  showLogin();
}
