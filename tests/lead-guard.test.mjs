import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import vm from "node:vm";
import worker from "../worker.js";
import { HOURLY_CAP, TURNSTILE_VERIFY_URL, assessLead } from "../lead-guard.js";

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

const createD1 = () => {
  const db = new DatabaseSync(":memory:");
  db.exec(read("migrations/0002_leads_and_call_clicks.sql"));
  db.exec(read("migrations/0003_add_email_to_leads.sql"));
  db.exec(read("migrations/0005_lead_delivery_and_attribution.sql"));
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

// Stubs Telegram and Turnstile siteverify. verdict(token) -> true | false | "down".
const network = async (run, verdict = (token) => token === "good-token") => {
  const telegram = [];
  const verifications = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url) === TURNSTILE_VERIFY_URL) {
      const token = options.body.get("response");
      verifications.push({ token, secret: options.body.get("secret"), ip: options.body.get("remoteip") });
      const result = verdict(token);
      if (result === "down") throw new TypeError("fetch failed");
      return new Response(JSON.stringify(result ? { success: true } : { success: false, "error-codes": ["invalid-input-response"] }), { status: 200 });
    }
    telegram.push(JSON.parse(options.body).text);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try { await run({ telegram, verifications }); } finally { globalThis.fetch = originalFetch; }
};

const secrets = { TELEGRAM_BOT_TOKEN: "local-test-token", TELEGRAM_CHAT_ID: "local-test-chat", ADMIN_TOKEN: "admin-test" };
const turnstileEnv = (binding) => ({ DB: binding, ...secrets, TURNSTILE_SITE_KEY: "1x00000000000000000000BB", TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA" });

let ipCounter = 0;
const post = (environment, body, { ip = `203.0.113.${(ipCounter += 1) % 250}`, headers = {} } = {}) => worker.fetch(new Request("https://apexgroupwa.com/api/lead", {
  method: "POST",
  headers: { "content-type": "application/json", referer: "https://apexgroupwa.com/get-estimate", "CF-Connecting-IP": ip, ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body)
}), environment);

const realLead = (extra = {}) => ({
  name: "Maria Lopez",
  phone: "+12535550123",
  email: "maria@example.com",
  area: "Spanaway, WA 98387",
  service: "Heat pump repair",
  message: "Our heat pump is blowing cold air since yesterday. Photo of the outdoor unit: https://photos.app.goo.gl/abc123",
  company: "",
  form_elapsed_ms: 48000,
  verification_attempt: 1,
  turnstile_token: "good-token",
  ...extra
});

const seoSpam = (extra = {}) => realLead({
  name: "Alex",
  service: "Other HVAC service",
  message: "Hello, I noticed your website is not on the first page of Google. Our SEO agency builds backlinks and lead generation for HVAC companies. Reply STOP to unsubscribe. https://rank-fast.example.com https://seo-pros.example.net",
  ...extra
});

const leads = (db) => db.prepare("SELECT * FROM leads ORDER BY id").all();
const admin = (environment, path, init = {}) => worker.fetch(new Request(`https://apexgroupwa.com${path}`, {
  ...init,
  headers: { Authorization: "Bearer admin-test", "content-type": "application/json", ...(init.headers || {}) }
}), environment);

test("real HVAC requests pass the content check, even with a link, odd wording or any email domain", () => {
  assert.equal(assessLead({ name: "Maria", text: "Furnace makes a loud bang when it starts. Video: https://youtu.be/xyz" }).held, false);
  assert.equal(assessLead({ name: "Ivan", text: "Need mini split for garage, 2 zones. Call after 5pm pls" }).held, false);
  assert.equal(assessLead({ name: "Li", text: "我们需要安装热泵 heat pump install quote" }).held, false);
  assert.equal(assessLead({ name: "Tom", text: "Is your website up to date? I found you on Google. AC not cooling." }).held, false);
  assert.equal(assessLead({ name: "Ann", text: "See https://a.example.com and https://b.example.com for my ductwork photos" }).held, false);
  assert.equal(assessLead({ name: "Bob", text: "" , elapsedMs: 1200 }).held, false);
});

test("obvious SEO and sales spam, markup and a filled honeypot are held", () => {
  const seo = assessLead({ name: "Alex", text: seoSpam().message });
  assert.equal(seo.held, true);
  assert.ok(seo.reasons.some((reason) => /sales\/SEO/.test(reason)));
  assert.equal(assessLead({ name: "x", text: "Great site <a href=\"https://spam.example\">cheap</a> [url=https://x.example]x[/url]" }).held, true);
  assert.equal(assessLead({ name: "Visit www.cheap-pills.example", text: "hi" }).held, true);
  assert.equal(assessLead({ name: "Jo", text: "furnace repair", honeypot: "Acme LLC" }).held, true);
  assert.equal(assessLead({ name: "Jo", text: "We help HVAC companies get more leads with digital marketing and SEO" }).held, true);
});

test("a real inquiry with a valid Turnstile token reaches D1 and Telegram and is a confirmed lead", async () => {
  const { db, binding } = createD1();
  await network(async ({ telegram, verifications }) => {
    const response = await post(turnstileEnv(binding), realLead({ submission_id: "real-lead-0000000001" }), { ip: "198.51.100.7" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, ref: "real-lead-0000000001" });
    assert.equal(telegram.length, 1);
    assert.match(telegram[0], /Heat pump repair/);
    assert.deepEqual(verifications, [{ token: "good-token", secret: "1x0000000000000000000000000000000AA", ip: "198.51.100.7" }]);
  });
  assert.equal(leads(db)[0].notify_status, "sent");
});

test("a failed or missing Turnstile check asks for a retry first, saves nothing and sends nothing", async () => {
  const { db, binding } = createD1();
  await network(async ({ telegram }) => {
    for (const token of ["", "bad-token"]) {
      const response = await post(turnstileEnv(binding), realLead({ turnstile_token: token }));
      assert.equal(response.status, 403);
      const body = await response.json();
      assert.equal(body.ok, false);
      assert.equal(body.retry, "verification");
      assert.match(body.error, /press the button again/);
    }
    assert.equal(telegram.length, 0);
  });
  assert.equal(leads(db).length, 0);
});

test("a second failed Turnstile try is saved as held, not sent, and not confirmed", async () => {
  const { db, binding } = createD1();
  await network(async ({ telegram }) => {
    const response = await post(turnstileEnv(binding), realLead({ turnstile_token: "bad-token", verification_attempt: 2 }));
    assert.equal(response.status, 202);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.held, true);
    assert.match(body.message, /received your request/);
    assert.equal(telegram.length, 0);
  });
  const [row] = leads(db);
  assert.equal(row.notify_status, "held");
  assert.match(row.notify_last_error, /Turnstile check failed/);
  assert.match(row.notify_payload, /New Apex HVAC request/);
});

test("when Cloudflare cannot be reached, or no Turnstile secret is set, leads still go through", async () => {
  const down = createD1();
  await network(async ({ telegram }) => {
    const response = await post(turnstileEnv(down.binding), realLead());
    assert.equal((await response.json()).ok, true);
    assert.equal(telegram.length, 1);
  }, () => "down");

  const plain = createD1();
  await network(async ({ telegram, verifications }) => {
    const response = await post({ DB: plain.binding, ...secrets }, realLead({ turnstile_token: "" }));
    assert.equal((await response.json()).ok, true);
    assert.equal(telegram.length, 1);
    assert.equal(verifications.length, 0);
  });
});

test("SEO spam is held in D1, kept out of Telegram, listed apart on admin and can be released", async () => {
  const { db, binding } = createD1();
  const environment = turnstileEnv(binding);
  await network(async ({ telegram }) => {
    const spam = await post(environment, seoSpam({ submission_id: "spam-lead-000000001", notes: seoSpam().message }));
    assert.equal(spam.status, 202);
    assert.equal((await spam.json()).held, true);
    const real = await post(environment, realLead());
    assert.equal((await real.json()).ok, true);
    assert.equal(telegram.length, 1);

    // The same held submission sent again stays held: it never turns into a confirmed lead.
    const again = await post(environment, seoSpam({ submission_id: "spam-lead-000000001" }));
    assert.equal((await again.json()).held, true);
    assert.equal(leads(db).length, 2);

    const normal = await (await admin(environment, "/api/admin/leads")).json();
    assert.deepEqual(normal.leads.map((lead) => lead.name), ["Maria Lopez"]);
    assert.equal(normal.stats.notifications.held, 1);
    const spamView = await (await admin(environment, "/api/admin/leads?view=spam")).json();
    assert.deepEqual(spamView.leads.map((lead) => lead.name), ["Alex"]);
    assert.match(spamView.leads[0].notify_last_error, /sales\/SEO wording/);
    // The main form sends its notes as message too; the text is scored once.
    assert.match(spamView.leads[0].notify_last_error, /: 2 links;/);
    const all = await (await admin(environment, "/api/admin/leads?view=all")).json();
    assert.equal(all.leads.length, 2);

    const heldId = spamView.leads[0].id;
    const release = await admin(environment, "/api/admin/leads/release", { method: "POST", body: JSON.stringify({ id: heldId }) });
    assert.deepEqual(await release.json(), { ok: true, sent: true });
    assert.equal(telegram.length, 2);
    assert.match(telegram[1], /^<i>Sent from the admin page: the spam check had held this request\.<\/i>/);
    const twice = await admin(environment, "/api/admin/leads/release", { method: "POST", body: JSON.stringify({ id: heldId }) });
    assert.equal(twice.status, 409);
    const unauthorized = await worker.fetch(new Request("https://apexgroupwa.com/api/admin/leads/release", { method: "POST", body: "{}" }), environment);
    assert.equal(unauthorized.status, 401);
  });
  assert.deepEqual(leads(db).map((row) => row.notify_status), ["sent", "sent"]);
});

test("per IP: a burst of requests is held, and the hourly cap is refused without saving", async () => {
  const { db, binding } = createD1();
  const environment = turnstileEnv(binding);
  const ip = "192.0.2.44";
  await network(async ({ telegram }) => {
    const statuses = [];
    for (let index = 0; index < HOURLY_CAP + 1; index += 1) {
      const response = await post(environment, realLead({ name: `Person ${index}` }), { ip });
      statuses.push(response.status);
    }
    assert.deepEqual(statuses.slice(0, 3), [200, 200, 200]);
    assert.ok(statuses.slice(3, HOURLY_CAP).every((status) => status === 202));
    assert.equal(statuses[HOURLY_CAP], 429);
    assert.equal(telegram.length, 3);
    // Another visitor is not affected.
    const other = await post(environment, realLead({ name: "Neighbor" }), { ip: "192.0.2.45" });
    assert.equal(other.status, 200);
  });
  assert.equal(leads(db).length, HOURLY_CAP + 1);
});

test("server-side validation refuses bad fields with a reason and oversized bodies", async () => {
  const { db, binding } = createD1();
  await network(async ({ telegram }) => {
    const badPhone = await post(turnstileEnv(binding), realLead({ phone: "+11234567890" }));
    assert.equal(badPhone.status, 400);
    assert.match((await badPhone.json()).error, /valid 10-digit US phone/);
    const badEmail = await post(turnstileEnv(binding), realLead({ email: "not-an-email" }));
    assert.match((await badEmail.json()).error, /valid email/);
    const notObject = await post(turnstileEnv(binding), "[1,2]");
    assert.equal(notObject.status, 400);
    const huge = await post(turnstileEnv(binding), realLead({ message: "x".repeat(40 * 1024) }));
    assert.equal(huge.status, 413);
    assert.equal(telegram.length, 0);
  });
  assert.equal(leads(db).length, 0);
});

test("the public config gives the site key only when the server also checks tokens", async () => {
  const config = async (environment) => (await worker.fetch(new Request("https://apexgroupwa.com/api/lead-guard/config"), environment)).json();
  assert.deepEqual(await config({ TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" }), { turnstileSiteKey: "site" });
  assert.deepEqual(await config({ TURNSTILE_SITE_KEY: "site" }), { turnstileSiteKey: "" });
  assert.deepEqual(await config({}), { turnstileSiteKey: "" });
  assert.doesNotMatch(JSON.stringify(await config({ TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" })), /secret/);
});

test("no secret is in the frontend or the repo config; only the public site key is", () => {
  // Secret keys are about 35 characters; the public site key is 24.
  for (const file of ["script.js", "instant-estimate.js", "yard.js"]) {
    assert.doesNotMatch(read(file), /TURNSTILE_SECRET_KEY|0x4[A-Za-z0-9_-]{20,}/, file);
  }
  const config = read("wrangler.jsonc");
  assert.doesNotMatch(config, /"TURNSTILE_SECRET_KEY"\s*:|0x4[A-Za-z0-9_-]{28,}/);
  assert.match(config, /"TURNSTILE_SITE_KEY": "0x4AAAAAAGAjJDxDJ25uRmtT"/);
});

// Runs apexLeadGuard from script.js against stub browser objects.
const loadGuard = () => {
  const source = read("script.js");
  const start = source.indexOf("window.apexLeadGuard = (() => {");
  const end = source.indexOf("})();", start) + "})();".length;
  const window = { setTimeout };
  const document = { addEventListener() {}, head: { append() {} } };
  vm.runInNewContext(source.slice(start, end), { window, document, fetch: async () => new Response("{}"), Element: class {}, Date, Promise });
  return window.apexLeadGuard;
};

test("the browser guard turns server answers into held, retry or error, never into a lead", () => {
  const guard = loadGuard();
  const form = {};
  const held = guard.outcome(form, { status: 202 }, { ok: false, held: true, message: "Thanks, we received your request." }, "fallback");
  assert.equal(held.kind, "held");
  const retry = guard.outcome(form, { status: 403 }, { ok: false, retry: "verification", error: "Please press the button again." }, "fallback");
  assert.equal(retry.kind, "retry");
  assert.match(retry.message, /did not finish\. Your details are still in the form: please press the button again\..*\(253\) 282-1126/);
  assert.equal(guard.outcome(form, { status: 400 }, { error: "Enter your name." }, "fallback").message, "Enter your name.");
  assert.equal(guard.outcome(form, { status: 500 }, null, "fallback").message, "fallback");
});

test("every form sends the guard data, and a held answer stops before any conversion", () => {
  const script = read("script.js");
  const quiz = read("instant-estimate.js");
  const yard = read("yard.js");
  assert.match(script, /await window\.apexLeadGuard\.protect\(payload, leadForm\);\s+const response = await fetch/);
  assert.equal((quiz.match(/await window\.apexLeadGuard\?\.protect\(payload, leadForm\);/g) || []).length, 2);
  assert.match(yard, /await window\.apexLeadGuard\?\.protect\(payload, form\);/);

  // The held branch returns before generate_lead, the marker and the thank-you redirect.
  const heldBranch = script.indexOf('if (outcome.kind === "held")');
  const heldReturn = script.indexOf("return;", heldBranch);
  assert.ok(heldBranch > 0 && heldReturn < script.indexOf('"generate_lead"', heldBranch));
  assert.doesNotMatch(script.slice(heldBranch, heldReturn), /generate_lead|sessionStorage|thank-you|conversion/);
  for (const match of quiz.matchAll(/if \(error\?\.held\)/g)) {
    const branch = quiz.slice(match.index, quiz.indexOf("return;", match.index));
    assert.doesNotMatch(branch, /generate_lead|sessionStorage|thank-you|conversion/);
  }
  const yardHeld = yard.indexOf('if (outcome.kind === "held")');
  assert.doesNotMatch(yard.slice(yardHeld, yard.indexOf("return;", yardHeld)), /generate_lead|track\(/);
  assert.ok(yardHeld < yard.indexOf('track("generate_lead"'));

  // The instant estimates carry a static honeypot like the other forms.
  for (const page of ["instant-estimate/heat-pump.html", "instant-estimate/mini-split.html"]) {
    assert.match(read(page), /<label class="form-honeypot" aria-hidden="true">Company<input name="company" tabindex="-1"/);
  }
});

test("a Turnstile script that failed to load is loaded again on the next press", async () => {
  const source = read("script.js");
  const start = source.indexOf("window.apexLeadGuard = (() => {");
  const end = source.indexOf("})();", start) + "})();".length;
  const appended = [];
  const window = { setTimeout };
  const document = {
    addEventListener() {},
    head: { append(node) { appended.push(node); } },
    createElement() { return { remove() {}, dataset: {} }; },
    querySelector() { return null; }
  };
  const fetch = async () => new Response(JSON.stringify({ turnstileSiteKey: "1x00000000000000000000BB" }));
  vm.runInNewContext(source.slice(start, end), { window, document, fetch, Element: class {}, Date, Promise });
  const guard = window.apexLeadGuard;
  const form = { querySelector: (selector) => (selector.includes("company") ? { value: "" } : null), append() {} };

  const first = guard.protect({}, form);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(appended.length, 1, "the first script");
  appended[0].onerror();
  assert.equal((await first).turnstile_token, "");

  const second = guard.protect({}, form);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(appended.length, 2, "the script is requested again");
  window.turnstile = { render: (_box, options) => { setTimeout(() => options.callback("fresh-token"), 1); return "w1"; } };
  window.apexTurnstileLoaded();
  assert.equal((await second).turnstile_token, "fresh-token");
});

test("analytics and the OpenAI pixel report only from apexgroupwa.com, never from previews", () => {
  const build = read("scripts/build.mjs");
  const rule = build.match(/const liveSiteTest = String\.raw`([^`]+)`/)[1];
  const isLive = (hostname) => vm.runInNewContext(rule, { location: { hostname } });
  assert.equal(isLive("apexgroupwa.com"), true);
  assert.equal(isLive("www.apexgroupwa.com"), true);
  for (const host of ["7fd2012c-apexservice.tight-pond-73b1.workers.dev", "localhost", "127.0.0.1", "apexgroupwa.com.example.net"]) {
    assert.equal(isLive(host), false, host);
  }
  // Every config call and the pixel loader sit behind the rule; nothing else sends hits.
  assert.match(build, /if \(\$\{liveSiteTest\}\) \{\r?\n(    gtag\('config'[^\r\n]+\r?\n){3}  \}/);
  assert.equal((build.match(/gtag\('config'/g) || []).length, 3);
  assert.match(build, /if\(\$\{liveSiteTest\}\)!function\(w,d,s,u\)\{/);
  assert.match(build, /if\(window\.oaiq\)oaiq\("init"/);
});
