import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "../worker.js";
import { MAX_NOTIFY_ATTEMPTS, retryPendingNotifications, sanitizeAttribution } from "../lead-delivery.js";

const migration = (name) => fs.readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");

// Minimal D1 binding over an in-memory SQLite database. Like D1, it rejects undefined bind values.
const createD1 = ({ withDeliveryColumns = true } = {}) => {
  const db = new DatabaseSync(":memory:");
  db.exec(migration("0002_leads_and_call_clicks.sql"));
  db.exec(migration("0003_add_email_to_leads.sql"));
  if (withDeliveryColumns) db.exec(migration("0005_lead_delivery_and_attribution.sql"));

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

const telegram = (responder = () => 200) => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    const status = responder(calls.length);
    return new Response(JSON.stringify({ ok: status === 200 }), { status });
  };
  return { calls, restore: () => { globalThis.fetch = originalFetch; } };
};

const secrets = { TELEGRAM_BOT_TOKEN: "local-test-token", TELEGRAM_CHAT_ID: "local-test-chat" };

const postLead = (env, body) => worker.fetch(new Request("https://apexgroupwa.com/api/lead", {
  method: "POST",
  headers: { "content-type": "application/json", referer: "https://apexgroupwa.com/get-estimate" },
  body: JSON.stringify(body)
}), env);

const genericLead = {
  name: "Delivery Test",
  phone: "+12535550123",
  email: "delivery@example.com",
  area: "WA 98402",
  service: "Heat pump installation",
  message: "Local delivery test"
};

const instantLead = {
  lead_source: "hvac_quiz",
  system_type: "heat_pump",
  project_type: "replacement",
  existing_system: "furnace_only",
  ductwork: "yes",
  home_size: "1500_2000",
  system_preference: "all_electric",
  priorities: ["energy_efficiency"],
  selected_tier: "comfort",
  price_range: "$9,000–$16,000",
  name: "Quiz Test",
  area: "WA 98402",
  service: "Heat pump installation"
};

const leads = (db) => db.prepare("SELECT * FROM leads ORDER BY id").all();
const recentAttribution = (extra = {}) => ({ attributed_at: new Date().toISOString(), ...extra });

test("phone-only, email-only and combined estimate leads are each saved once and sent once", async () => {
  const { db, binding } = createD1();
  const tg = telegram();
  try {
    const cases = [
      { preferred_contact_methods: ["phone"], phone: "2535550100", email: "" },
      { preferred_contact_methods: ["email"], phone: "", email: "only@example.com" },
      { preferred_contact_methods: ["phone", "email"], phone: "2535550101", email: "both@example.com" }
    ];
    for (const contact of cases) {
      const response = await postLead({ DB: binding, ...secrets }, { ...instantLead, ...contact });
      assert.equal(response.status, 200);
    }
    const rows = leads(db);
    assert.equal(rows.length, 3);
    assert.equal(tg.calls.length, 3);
    assert.deepEqual(rows.map((row) => row.notify_status), ["sent", "sent", "sent"]);
    assert.deepEqual(rows.map((row) => [row.phone, row.email]), [
      ["+12535550100", ""],
      ["", "only@example.com"],
      ["+12535550101", "both@example.com"]
    ]);
  } finally {
    tg.restore();
  }
});

test("a Telegram outage keeps the lead, answers success and queues the notification", async () => {
  const { db, binding } = createD1();
  const tg = telegram(() => 502);
  try {
    const response = await postLead({ DB: binding, ...secrets }, genericLead);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    const [row] = leads(db);
    assert.equal(row.name, "Delivery Test");
    assert.equal(row.notify_status, "pending");
    assert.equal(row.notify_attempts, 2);
    assert.match(row.notify_last_error, /502/);
    assert.doesNotMatch(row.notify_last_error, /local-test-token/);
    assert.equal(tg.calls.length, 2);
  } finally {
    tg.restore();
  }
});

test("the cron retry delivers a queued notification once and marks it as late", async () => {
  const { db, binding } = createD1();
  let telegramUp = false;
  const tg = telegram(() => (telegramUp ? 200 : 503));
  try {
    await postLead({ DB: binding, ...secrets }, genericLead);
    const env = { DB: binding, ...secrets };

    const early = await retryPendingNotifications(env, { now: new Date() });
    assert.equal(early.sent + early.failed, 0, "not due yet");

    telegramUp = true;
    const later = new Date(Date.now() + 60 * 60 * 1000);
    assert.deepEqual(await retryPendingNotifications(env, { now: later }), { sent: 1, failed: 0, skipped: 0 });
    assert.deepEqual(await retryPendingNotifications(env, { now: later }), { sent: 0, failed: 0, skipped: 0 });

    const [row] = leads(db);
    assert.equal(row.notify_status, "sent");
    assert.equal(tg.calls.length, 3);
    assert.match(tg.calls[2].body.text, /^<i>Delayed delivery/);
    assert.match(tg.calls[2].body.text, /New Apex HVAC request/);
  } finally {
    tg.restore();
  }
});

test("a notification that keeps failing stops at the attempt limit and can be resent from admin", async () => {
  const { db, binding } = createD1();
  const tg = telegram(() => 500);
  const env = { DB: binding, ...secrets, ADMIN_TOKEN: "local-admin" };
  try {
    await postLead(env, genericLead);
    let now = Date.now();
    for (let i = 0; i < MAX_NOTIFY_ATTEMPTS; i += 1) {
      now += 7 * 60 * 60 * 1000;
      await retryPendingNotifications(env, { now: new Date(now) });
    }
    assert.equal(leads(db)[0].notify_status, "failed");
    assert.equal(leads(db)[0].notify_attempts, MAX_NOTIFY_ATTEMPTS);

    const admin = await worker.fetch(new Request("https://apexgroupwa.com/api/admin/leads", {
      headers: { Authorization: "Bearer local-admin" }
    }), env);
    const adminData = await admin.json();
    assert.deepEqual(adminData.stats.notifications, { pending: 0, failed: 1 });
    assert.equal(adminData.leads[0].notify_status, "failed");

    tg.restore();
    const tgUp = telegram();
    try {
      const retry = await worker.fetch(new Request("https://apexgroupwa.com/api/admin/notifications/retry", {
        method: "POST",
        headers: { Authorization: "Bearer local-admin", "content-type": "application/json" },
        body: JSON.stringify({ id: leads(db)[0].id })
      }), env);
      assert.equal(retry.status, 200);
      assert.equal(leads(db)[0].notify_status, "sent");
      assert.equal(tgUp.calls.length, 1);
    } finally {
      tgUp.restore();
    }
  } finally {
    tg.restore();
  }
});

test("a resubmitted form with the same submission id creates no second lead or notification", async () => {
  const { db, binding } = createD1();
  const tg = telegram();
  try {
    const body = { ...genericLead, submission_id: "6f1c2a8e-4b7d-4c1e-9a55-0d2b8e7f3a10" };
    const first = await postLead({ DB: binding, ...secrets }, body);
    const second = await postLead({ DB: binding, ...secrets }, body);
    assert.deepEqual(await first.json(), { ok: true, ref: body.submission_id });
    assert.deepEqual(await second.json(), { ok: true, ref: body.submission_id });
    assert.equal(leads(db).length, 1);
    assert.equal(tg.calls.length, 1);
  } finally {
    tg.restore();
  }
});

test("the visitor sees an error only when the lead is neither saved nor delivered", async () => {
  const tg = telegram(() => 500);
  try {
    const response = await postLead({ ...secrets }, genericLead);
    assert.equal(response.status, 500);
  } finally {
    tg.restore();
  }

  const tgUp = telegram();
  try {
    const failingDb = { prepare: () => { throw new Error("D1 unavailable"); } };
    const response = await postLead({ DB: failingDb, ...secrets }, genericLead);
    assert.equal(response.status, 200);
    assert.equal(tgUp.calls.length, 1);
  } finally {
    tgUp.restore();
  }
});

test("before migration 0005 leads are still saved and sent exactly as before", async () => {
  const { db, binding } = createD1({ withDeliveryColumns: false });
  const tg = telegram();
  try {
    const response = await postLead({ DB: binding, ...secrets }, {
      ...genericLead,
      submission_id: "6f1c2a8e-4b7d-4c1e-9a55-0d2b8e7f3a11",
      attribution: recentAttribution({ gclid: "Cj0KCQjw-test_click_id" })
    });
    assert.equal(response.status, 200);
    assert.equal(leads(db).length, 1);
    assert.equal(tg.calls.length, 1);
    assert.equal(await retryPendingNotifications({ DB: binding, ...secrets }).then((r) => r.sent), 0);
  } finally {
    tg.restore();
  }
});

test("ad-click attribution is stored, shown in Telegram and expires after 30 days", async () => {
  const { db, binding } = createD1();
  const tg = telegram();
  try {
    await postLead({ DB: binding, ...secrets }, {
      ...genericLead,
      attribution: recentAttribution({
        gclid: "Cj0KCQjw-test_click_id",
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "Search - HVAC Install & Replace",
        lp_variant: "hp-cost"
      })
    });
    const [row] = leads(db);
    assert.equal(row.gclid, "Cj0KCQjw-test_click_id");
    assert.equal(row.utm_campaign, "Search - HVAC Install & Replace");
    assert.equal(row.lp_variant, "hp-cost");
    assert.ok(row.attributed_at);
    assert.match(tg.calls[0].body.text, /<b>Source:<\/b> Google Ads click \(hp-cost\)/);
  } finally {
    tg.restore();
  }

  const stale = sanitizeAttribution({ gclid: "Cj0KCQjw-test_click_id", attributed_at: new Date(Date.now() - 31 * 864e5).toISOString() });
  assert.equal(stale.gclid, null);
  const hostile = sanitizeAttribution({ gclid: "<script>", lp_variant: "../../etc", attributed_at: new Date().toISOString() });
  assert.equal(hostile.gclid, null);
  assert.equal(hostile.lp_variant, null);
  assert.equal(sanitizeAttribution({ gclid: "Cj0KCQjw-test_click_id" }).gclid, null, "no timestamp, no attribution");
});

test("leads without attribution keep the original Telegram layout", async () => {
  const tg = telegram();
  try {
    await postLead({ ...secrets }, genericLead);
    assert.doesNotMatch(tg.calls[0].body.text, /Source:/);
    assert.match(tg.calls[0].body.text, /<b>Message:<\/b> Local delivery test\n\n<b>Page:<\/b>/);
  } finally {
    tg.restore();
  }
});
