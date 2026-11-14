import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker, { normalizeYardLead } from "../worker.js";
import { YARD_REDIRECT_URL } from "../yard-lead.js";
import { shouldRenderMobileCtaBar } from "../scripts/site-navigation.mjs";

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const migration = (name) => read(`migrations/${name}`);

const createD1 = () => {
  const db = new DatabaseSync(":memory:");
  db.exec(migration("0002_leads_and_call_clicks.sql"));
  db.exec(migration("0003_add_email_to_leads.sql"));
  db.exec(migration("0005_lead_delivery_and_attribution.sql"));
  const statement = (sql, values = []) => {
    if (values.some((value) => value === undefined)) throw new Error("D1_TYPE_ERROR: undefined bind value");
    return {
      bind: (...next) => statement(sql, next),
      run: async () => {
        const result = db.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
      },
      first: async () => db.prepare(sql).get(...values) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...values) })
    };
  };
  return { db, binding: { prepare: (sql) => statement(sql) } };
};

const withTelegram = async (run) => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push(JSON.parse(options.body).text);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try { await run(calls); } finally { globalThis.fetch = originalFetch; }
};

const env = (binding) => ({ DB: binding, TELEGRAM_BOT_TOKEN: "local-test-token", TELEGRAM_CHAT_ID: "local-test-chat" });
const post = (environment, body) => worker.fetch(new Request("https://apexgroupwa.com/api/lead", {
  method: "POST",
  headers: { "content-type": "application/json", referer: "https://apexgroupwa.com/yard?utm_source=yard_sign&utm_medium=offline&utm_campaign=local_hvac" },
  body: JSON.stringify(body)
}), environment);

const base = { lead_source: "yard_sign_picker", name: "Yard Test", zip: "98387", preferred_contact_method: "phone", phone: "+12535550123", email: "" };
const yardAttribution = () => ({ utm_source: "yard_sign", utm_medium: "offline", utm_campaign: "local_hvac", attributed_at: new Date().toISOString() });

test("/go is a no-store 302 to /yard with the yard-sign UTMs, from any scheme or host", async () => {
  for (const url of ["https://apexgroupwa.com/go", "http://www.apexgroupwa.com/go", "https://apexgroupwa.com/go/?x=1"]) {
    const response = await worker.fetch(new Request(url), {});
    assert.equal(response.status, 302, url);
    assert.equal(response.headers.get("Location"), YARD_REDIRECT_URL);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  assert.equal(YARD_REDIRECT_URL, "https://apexgroupwa.com/yard?utm_source=yard_sign&utm_medium=offline&utm_campaign=local_hvac");
});

test("the worker renders /yard and /go (rating badge, reviews) and the build ships the page", () => {
  const config = read("wrangler.jsonc");
  assert.match(config, /"\/yard"/);
  assert.match(config, /"\/go"/);
  assert.match(read("scripts/build.mjs"), /"yard\.html",\s+"yard\.js"/);
  const html = read("yard.html");
  assert.match(html, /<!-- GOOGLE_RATING_BADGE -->/);
  assert.match(html, /<!-- GOOGLE_REVIEWS_LIST -->/);
  assert.match(html, /name="robots" content="noindex,follow"/);
  assert.doesNotMatch(read("sitemap.xml"), /\/yard</);
  assert.equal(shouldRenderMobileCtaBar("/yard"), false);
});

test("each picker branch is stored with its category, task and labels", () => {
  const cases = [
    [{ category: "mini_split", task: "install_replace" }, "Mini-Split: Install or Replace"],
    [{ category: "heat_pump", task: "repair" }, "Heat Pump: Repair"],
    [{ category: "furnace", task: "maintenance" }, "Furnace: Maintenance"],
    [{ category: "repair_maintenance", task: "repair", equipment: "air_conditioner" }, "Repair & Maintenance: Repair"],
    [{ category: "other", task: "other", description: "Bathroom fan is loud" }, "Other request"]
  ];
  for (const [choice, service] of cases) {
    const { lead, error } = normalizeYardLead({ ...base, ...choice });
    assert.equal(error, undefined, JSON.stringify(choice));
    assert.equal(lead.service, service);
  }
  assert.match(normalizeYardLead({ ...base, category: "repair_maintenance", task: "maintenance", equipment: "furnace" }).lead.message, /Equipment type: Furnace/);
  assert.match(normalizeYardLead({ ...base, category: "other", task: "other", description: "Bathroom fan is loud" }).lead.message, /Description: Bathroom fan is loud/);
});

test("invalid choices and contacts are rejected", () => {
  const rejects = [
    { category: "mini_split", task: "other" },
    { category: "repair_maintenance", task: "install_replace" },
    { category: "other", task: "other", description: "  " },
    { category: "boiler", task: "repair" },
    { category: "furnace", task: "repair", name: "" },
    { category: "furnace", task: "repair", phone: "555" },
    { category: "furnace", task: "repair", preferred_contact_method: "email", email: "nope" },
    { category: "furnace", task: "repair", preferred_contact_method: "fax" },
    { category: "furnace", task: "repair", zip: "9838" }
  ];
  for (const values of rejects) assert.ok(normalizeYardLead({ ...base, ...values }).error, JSON.stringify(values));
});

test("only the chosen contact is kept: phone-only and email-only leads", () => {
  const phoneOnly = normalizeYardLead({ ...base, category: "furnace", task: "repair", email: "ignored@example.com" }).lead;
  assert.equal(phoneOnly.phone, "+12535550123");
  assert.equal(phoneOnly.email, "");
  const emailOnly = normalizeYardLead({ ...base, category: "furnace", task: "repair", preferred_contact_method: "email", phone: "", email: "Yard@Example.com" }).lead;
  assert.equal(emailOnly.phone, "");
  assert.equal(emailOnly.email, "yard@example.com");
});

test("a yard lead reaches D1 and Telegram once, with choices, contact and yard_sign attribution", async () => {
  const { db, binding } = createD1();
  await withTelegram(async (messages) => {
    const body = { ...base, category: "other", task: "other", description: "Need a bathroom fan vented", details: "Weekday mornings", submission_id: "yard-test-0000000001", attribution: yardAttribution() };
    const first = await post(env(binding), body);
    assert.deepEqual(await first.json(), { ok: true, ref: "yard-test-0000000001" });
    const again = await post(env(binding), body);
    assert.equal(again.status, 200);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /Equipment\/category:<\/b> Other/);
    assert.match(messages[0], /Description:<\/b> Need a bathroom fan vented/);
    assert.match(messages[0], /Additional details:<\/b> Weekday mornings/);
    assert.match(messages[0], /Preferred contact:<\/b> Phone/);
    assert.match(messages[0], /ZIP Code:<\/b> 98387/);
    assert.match(messages[0], /Source:<\/b> yard_sign \/ offline \/ local_hvac/);
    assert.doesNotMatch(messages[0], /FREE ESTIMATE/);
  });
  const rows = db.prepare("SELECT * FROM leads").all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].service, "Other request");
  assert.equal(rows[0].area, "WA 98387");
  assert.equal(rows[0].utm_source, "yard_sign");
  assert.equal(rows[0].utm_medium, "offline");
  assert.equal(rows[0].utm_campaign, "local_hvac");
  assert.match(rows[0].message, /Yard sign page request \| Equipment\/category: Other \| Task: Other request/);
});

test("only install or replace is called a free estimate; a direct visit has no yard_sign source", async () => {
  const { binding } = createD1();
  await withTelegram(async (messages) => {
    await post(env(binding), { ...base, category: "heat_pump", task: "install_replace", preferred_contact_method: "email", phone: "", email: "yard@example.com" });
    await post(env(binding), { ...base, category: "mini_split", task: "repair" });
    assert.match(messages[0], /FREE ESTIMATE/);
    assert.match(messages[0], /Email:<\/b> yard@example\.com/);
    assert.doesNotMatch(messages[0], /Phone:<\/b>/);
    assert.match(messages[1], /SERVICE request/);
    assert.match(messages[1], /Source:<\/b> No campaign tags/);
  });
});

test("a bad yard lead is refused with a reason, and a filled honeypot is held, not sent", async () => {
  const { db, binding } = createD1();
  await withTelegram(async (messages) => {
    const missing = await post(env(binding), { ...base, category: "other", task: "other", description: "" });
    assert.equal(missing.status, 400);
    assert.match((await missing.json()).error, /help you with/);
    const spam = await post(env(binding), { ...base, category: "furnace", task: "repair", company: "Spam LLC" });
    assert.equal(spam.status, 202);
    assert.equal((await spam.json()).held, true);
    assert.equal(messages.length, 0);
  });
  assert.deepEqual(db.prepare("SELECT notify_status FROM leads").all().map((row) => row.notify_status), ["held"]);
});

test("the page offers a free estimate only for install or replace, and calls the site phone", () => {
  const script = read("yard.js");
  assert.match(script, /install_replace: "Request a Free Estimate", repair: "Request Service", maintenance: "Request Service", other: "Send a Request"/);
  assert.match(read("yard.html"), /href="tel:\+12532821126" data-yard-call>Call Us</);
  assert.doesNotMatch(read("yard.html"), /free (diagnostic|visit|service call)/i);
  // Analytics never carry the visitor's name, phone, email or ZIP.
  for (const call of script.match(/track\("[a-z_]+", \{[^}]*\}/g)) assert.doesNotMatch(call, /name|phone|email|zip|details|description/i);
});

test("worker.js exports only functions besides the default handler (Workers reject other exports)", async () => {
  const module = await import("../worker.js");
  for (const [name, value] of Object.entries(module)) {
    if (name !== "default") assert.equal(typeof value, "function", name);
  }
});
