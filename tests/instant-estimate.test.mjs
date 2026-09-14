import assert from "node:assert/strict";
import test from "node:test";
import { getPriceRanges, HEAT_PUMP_PRICES } from "../instant-estimate.js";
import { formatInstantEstimateMessage } from "../worker.js";
import worker from "../worker.js";

test("returns the published Good Better Best ranges for every zone branch", () => {
  assert.deepEqual(getPriceRanges("1"), { good: "$3,000–$4,000", better: "$4,000–$5,500", best: "$5,500–$7,000" });
  assert.deepEqual(getPriceRanges("2"), { good: "$4,500–$6,500", better: "$6,500–$8,500", best: "$8,500–$11,000" });
  assert.deepEqual(getPriceRanges("3"), { good: "$5,500–$8,000", better: "$8,000–$10,500", best: "$10,500–$13,000" });
  assert.deepEqual(getPriceRanges("4_plus"), { good: "From $7,000", better: "From $9,000", best: "From $11,000" });
  assert.equal(getPriceRanges("not_sure"), null);
});

test("returns the approved heat-pump tier ranges and no fabricated unsure range", () => {
  assert.equal(HEAT_PUMP_PRICES.essential, "$7,500–$13,000");
  assert.equal(HEAT_PUMP_PRICES.comfort, "$9,000–$16,000");
  assert.equal(HEAT_PUMP_PRICES.premium, "$11,000–$20,000");
  assert.equal(HEAT_PUMP_PRICES.not_sure, undefined);
});

test("formats a readable Telegram message for an instant estimate lead", () => {
  const message = formatInstantEstimateMessage({
    name: "John",
    email: "john@example.com",
    phone: "+12535550123",
    area: "WA 98402",
    preferredContactMethods: ["phone", "email"],
    estimate: {
      projectType: "new_install",
      existingSystem: "baseboard_wall",
      spaceSize: "1000_1500",
      zones: "2",
      priorities: ["energy_efficiency", "quiet_operation"],
      selectedTier: "better"
    }
  }, new Request("https://apexgroupwa.com/api/lead", { headers: { referer: "https://apexgroupwa.com/instant-estimate/mini-split" } }));

  assert.match(message, /New Mini-Split Instant Estimate Lead/);
  assert.match(message, /Project type:<\/b> New installation/);
  assert.match(message, /New installation/);
  assert.match(message, /Good:<\/b> \$4,500–\$6,500/);
  assert.match(message, /Selected option:<\/b> Better/);
  assert.match(message, /First Name:<\/b> John/);
  assert.match(message, /ZIP Code:<\/b> 98402/);
});

test("formats an honest Telegram message when zones and tier are not known", () => {
  const message = formatInstantEstimateMessage({
    name: "Local Unsure Test",
    email: "",
    phone: "+12535550123",
    area: "WA 98030",
    preferredContactMethods: ["phone"],
    estimate: {
      projectType: "not_sure",
      existingSystem: "not_sure",
      spaceSize: "not_sure",
      zones: "not_sure",
      priorities: ["not_sure"],
      selectedTier: "not_sure"
    }
  }, new Request("https://apexgroupwa.com/api/lead"));

  assert.match(message, /Zones:<\/b> Not sure/);
  assert.match(message, /Good:<\/b> Planning level — zones to be confirmed/);
  assert.match(message, /Better:<\/b> Planning level — zones to be confirmed/);
  assert.match(message, /Best:<\/b> Planning level — zones to be confirmed/);
  assert.match(message, /Selected option:<\/b> Not sure/);
  assert.doesNotMatch(message, /undefined|null|Company/i);
});

test("accepts an instant-estimate lead through the existing API and sends the enriched Telegram message", async () => {
  let storedValues = null;
  let telegramPayload = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    telegramPayload = JSON.parse(options.body);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const env = {
    DB: {
      prepare() {
        return {
          bind(...values) {
            storedValues = values;
            return { run: async () => ({ success: true }) };
          }
        };
      }
    },
    TELEGRAM_BOT_TOKEN: "local-test-token",
    TELEGRAM_CHAT_ID: "local-test-chat"
  };

  try {
    const request = new Request("https://apexgroupwa.com/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json", referer: "https://apexgroupwa.com/instant-estimate/mini-split" },
      body: JSON.stringify({
        lead_source: "mini_split_instant_estimate",
        preferred_contact_methods: ["phone", "email"],
        name: "Local Test",
        phone: "+12535550123",
        email: "local@example.com",
        area: "WA 98402",
        service: "Mini-split installation",
        project_type: "new_install",
        existing_system: "baseboard_wall",
        space_size: "1000_1500",
        zones: "2",
        priorities: ["energy_efficiency", "quiet_operation"],
        selected_tier: "better"
      })
    });
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.ok(storedValues?.some((value) => String(value).includes("Mini-Split Instant Estimate")));
    assert.match(telegramPayload.text, /New Mini-Split Instant Estimate Lead/);
    assert.match(telegramPayload.text, /Selected option:<\/b> Better/);
    assert.match(telegramPayload.text, /Preferred contact:<\/b> Phone and Email/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("accepts a heat-pump branch lead through the shared API without fabricating unsure pricing", async () => {
  const messages = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    messages.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    const request = new Request("https://apexgroupwa.com/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lead_source: "hvac_quiz",
        system_type: "heat_pump",
        preferred_contact_methods: ["email"],
        name: "TEST CODEX",
        phone: "",
        email: "test@example.com",
        area: "WA 98387",
        service: "Heat pump installation",
        project_type: "replacement",
        existing_system: "furnace_ac",
        ductwork: "yes",
        home_size: "1500_2000",
        space_size: "1500_2000",
        system_preference: "dual_fuel",
        priorities: ["energy_efficiency", "quiet_operation"],
        selected_tier: "not_sure",
        price_range: ""
      })
    });
    const response = await worker.fetch(request, { TELEGRAM_BOT_TOKEN: "local-test-token", TELEGRAM_CHAT_ID: "local-test-chat" });
    assert.equal(response.status, 200);
    assert.match(messages[0].text, /New HEAT PUMP LEAD/);
    assert.match(messages[0].text, /Ductwork:<\/b> Yes/);
    assert.match(messages[0].text, /Price range:<\/b> To be determined after assessment/);
    assert.doesNotMatch(messages[0].text, /\$7,500|\$9,000|\$11,000/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const validInstantLead = {
  lead_source: "mini_split_instant_estimate",
  name: "TEST CODEX",
  area: "WA 98387",
  service: "Mini-split installation",
  project_type: "new_install",
  existing_system: "baseboard_wall",
  space_size: "1000_1500",
  zones: "2",
  priorities: ["energy_efficiency"],
  selected_tier: "better"
};

const postInstantLead = async (body) => {
  const messages = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    messages.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    const response = await worker.fetch(new Request("https://apexgroupwa.com/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validInstantLead, ...body })
    }), { TELEGRAM_BOT_TOKEN: "local-test-token", TELEGRAM_CHAT_ID: "local-test-chat" });
    return { response, messages };
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test("accepts phone-only, email-only, and combined instant-estimate contacts", async () => {
  const phoneOnly = await postInstantLead({ preferred_contact_methods: ["phone"], phone: "2535550100", email: "" });
  assert.equal(phoneOnly.response.status, 200);
  assert.match(phoneOnly.messages[0].text, /Preferred contact:<\/b> Phone/);
  assert.match(phoneOnly.messages[0].text, /Phone:<\/b> \+12535550100/);
  assert.doesNotMatch(phoneOnly.messages[0].text, /Email:<\/b>/);

  const emailOnly = await postInstantLead({ preferred_contact_methods: ["email"], phone: "", email: "test@example.com" });
  assert.equal(emailOnly.response.status, 200);
  assert.match(emailOnly.messages[0].text, /Preferred contact:<\/b> Email/);
  assert.match(emailOnly.messages[0].text, /Email:<\/b> test@example.com/);
  assert.doesNotMatch(emailOnly.messages[0].text, /Phone:<\/b>/);

  const both = await postInstantLead({ preferred_contact_methods: ["phone", "email"], phone: "2535550100", email: "test@example.com" });
  assert.equal(both.response.status, 200);
  assert.match(both.messages[0].text, /Preferred contact:<\/b> Phone and Email/);
  assert.match(both.messages[0].text, /Phone:<\/b> \+12535550100/);
  assert.match(both.messages[0].text, /Email:<\/b> test@example.com/);
});

test("rejects missing and invalid preferred instant-estimate contacts without calling Telegram", async () => {
  const invalidCases = [
    { preferred_contact_methods: [], phone: "", email: "" },
    { preferred_contact_methods: ["phone"], phone: "", email: "" },
    { preferred_contact_methods: ["phone"], phone: "123", email: "" },
    { preferred_contact_methods: ["email"], phone: "", email: "" },
    { preferred_contact_methods: ["email"], phone: "", email: "bad-email" },
    { preferred_contact_methods: ["phone", "email"], phone: "2535550100", email: "" }
  ];
  for (const body of invalidCases) {
    const result = await postInstantLead(body);
    assert.equal(result.response.status, 400);
    assert.equal(result.messages.length, 0);
  }
});

test("keeps the existing generic lead Telegram format unchanged", async () => {
  let telegramPayload = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    telegramPayload = JSON.parse(options.body);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    const response = await worker.fetch(new Request("https://apexgroupwa.com/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json", referer: "https://apexgroupwa.com/get-estimate" },
      body: JSON.stringify({
        name: "Existing Form Test",
        phone: "+12535550123",
        email: "existing@example.com",
        area: "Tacoma",
        service: "Furnace service",
        message: "Existing form regression check"
      })
    }), {
      TELEGRAM_BOT_TOKEN: "local-test-token",
      TELEGRAM_CHAT_ID: "local-test-chat"
    });
    assert.equal(response.status, 200);
    assert.match(telegramPayload.text, /New Apex HVAC request/);
    assert.match(telegramPayload.text, /Existing form regression check/);
    assert.doesNotMatch(telegramPayload.text, /Mini-Split Instant Estimate/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
