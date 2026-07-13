const tokenKey = "apex-admin-token";
const login = document.querySelector("[data-admin-login]");
const tokenInput = document.querySelector("[data-admin-token]");
const loginButton = document.querySelector("[data-admin-login-button]");
const resetButton = document.querySelector("[data-admin-reset]");
const panel = document.querySelector("[data-admin-panel]");
const filters = document.querySelector("[data-admin-filters]");
const status = document.querySelector("[data-admin-status]");
const tableBody = document.querySelector("[data-leads-body]");
const totalLeads = document.querySelector("[data-total-leads]");
const totalCalls = document.querySelector("[data-total-calls]");
const shownLeads = document.querySelector("[data-shown-leads]");
const exportButton = document.querySelector("[data-export-csv]");

let leads = [];

const setStatus = (message, type = "") => {
  status.textContent = message;
  status.classList.toggle("is-error", type === "error");
  status.classList.toggle("is-success", type === "success");
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

const leadRow = (lead) => `
  <tr>
    <td>${escapeHtml(formatDate(lead.created_at))}</td>
    <td><strong>${escapeHtml(lead.name)}</strong></td>
    <td><a href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a></td>
    <td><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td>
    <td>${escapeHtml(lead.area)}</td>
    <td>${escapeHtml(lead.service)}</td>
    <td>${escapeHtml(lead.message)}</td>
  </tr>
`;

const renderLeads = (data) => {
  leads = data.leads || [];
  totalLeads.textContent = String(data.total || 0);
  totalCalls.textContent = String(data.stats?.callClicks || 0);
  shownLeads.textContent = String(leads.length);

  tableBody.innerHTML = leads.length
    ? leads.map(leadRow).join("")
    : `<tr><td colspan="7" class="admin-empty">No leads found.</td></tr>`;
};

const loadLeads = async () => {
  const token = getToken();
  if (!token) {
    showLogin();
    return;
  }

  showPanel();
  setStatus("Loading leads...");

  const formData = new FormData(filters);
  const params = new URLSearchParams();
  params.set("limit", "100");
  for (const [key, value] of formData.entries()) {
    if (String(value).trim()) params.set(key, String(value).trim());
  }

  const response = await fetch(`/api/admin/leads?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
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
  setStatus("Leads loaded.", "success");
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

loginButton.addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  if (!token) return;
  localStorage.setItem(tokenKey, token);
  try {
    await loadLeads();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

tokenInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    loginButton.click();
  }
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
    setStatus(error.message, "error");
  }
});

exportButton.addEventListener("click", exportCsv);

if (getToken()) {
  loadLeads().catch((error) => setStatus(error.message, "error"));
} else {
  showLogin();
}
