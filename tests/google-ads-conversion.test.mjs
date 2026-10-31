import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const classicSource = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");
const quizSource = fs.readFileSync(new URL("../instant-estimate.js", import.meta.url), "utf8");
const destination = "AW-18358155203/eht5CKv_lvgcEMPv7LFE";
const marker = "apex_google_ads_lead_pending";

test("the confirmation page owns the only Google Ads lead conversion", () => {
  assert.equal((classicSource.match(new RegExp(destination.replace("/", "\\/"), "g")) || []).length, 1);
  assert.doesNotMatch(quizSource, /AW-18358155203|send_to|track\("conversion"/);
  assert.equal((classicSource.match(/gtag\("event", "conversion"/g) || []).length, 1);

  const thankYouCheck = classicSource.indexOf('window.location.pathname === "/thank-you"');
  const markerCheck = classicSource.indexOf("sessionStorage.getItem(googleAdsLeadPendingKey)", thankYouCheck);
  const conversion = classicSource.indexOf('window.gtag("event", "conversion", conversion)', markerCheck);
  const markerClear = classicSource.indexOf("sessionStorage.removeItem(googleAdsLeadPendingKey)", conversion);
  assert.ok(thankYouCheck >= 0 && markerCheck > thankYouCheck && conversion > markerCheck && markerClear > conversion);
});

test("the shared lead form sets the marker and redirects only after confirmed success and GA4", () => {
  const successCheck = classicSource.indexOf('if (!response.ok || result?.ok !== true)');
  const successLatch = classicSource.indexOf("leadEventSent = true;", successCheck);
  const generateLead = classicSource.indexOf('"generate_lead"', successLatch);
  const markerSet = classicSource.indexOf('sessionStorage.setItem(googleAdsLeadPendingKey, payload.submission_id || "1")', generateLead);
  const redirect = classicSource.indexOf('window.location.href = "/thank-you"', markerSet);
  const catchBlock = classicSource.indexOf("    } catch {", redirect);
  assert.ok(successCheck >= 0 && successLatch > successCheck && generateLead > successLatch && markerSet > generateLead && redirect > markerSet && catchBlock > redirect);
  assert.doesNotMatch(classicSource.slice(successLatch, catchBlock), /trackEvent\(\s*"conversion"/);
  assert.doesNotMatch(classicSource.slice(catchBlock, classicSource.indexOf("  });", catchBlock)), /sessionStorage\.setItem|conversion/);
  assert.match(classicSource, /if \(submissionInProgress \|\| leadEventSent\) return;/);
});

test("both instant estimates set the marker and redirect after confirmed success and GA4", () => {
  assert.equal((quizSource.match(/if \(!response\.ok \|\| (?:data|result)\?\.ok !== true\) throw new Error\("Request failed"\);/g) || []).length, 2);
  assert.equal((quizSource.match(/sessionStorage\.setItem\(GOOGLE_ADS_LEAD_PENDING_KEY, payload\.submission_id \|\| "1"\)/g) || []).length, 2);
  assert.equal((quizSource.match(/window\.location\.href = "\/thank-you"/g) || []).length, 2);
  assert.equal((quizSource.match(/track\("generate_lead"/g) || []).length, 2);

  for (const markerSet of quizSource.matchAll(/sessionStorage\.setItem\(GOOGLE_ADS_LEAD_PENDING_KEY, payload\.submission_id \|\| "1"\)/g)) {
    const successCheck = quizSource.lastIndexOf("ok !== true", markerSet.index);
    const generateLead = quizSource.lastIndexOf('track("generate_lead"', markerSet.index);
    const redirect = quizSource.indexOf('window.location.href = "/thank-you"', markerSet.index);
    assert.ok(successCheck >= 0 && generateLead > successCheck && generateLead < markerSet.index && redirect > markerSet.index);
  }

  assert.match(quizSource, /if \(submissionInProgress \|\| leadEventSent\) return;/);
  assert.match(quizSource, /if \(submissionInProgress\) return;/);
});

test("failed and validation paths cannot set a marker or fire an Ads conversion", () => {
  assert.doesNotMatch(classicSource, /catch[\s\S]{0,300}sessionStorage\.setItem/);
  assert.doesNotMatch(quizSource, /catch[\s\S]{0,300}sessionStorage\.setItem/);
  assert.doesNotMatch(quizSource, /reportValidity\(\)[\s\S]{0,300}sessionStorage\.setItem/);
  assert.doesNotMatch(quizSource, /track\("conversion"/);
});

test("direct visits and refreshes do not convert without a pending session marker", () => {
  assert.match(classicSource, new RegExp(`const googleAdsLeadPendingKey = "${marker}"`));
  assert.match(quizSource, new RegExp(`const GOOGLE_ADS_LEAD_PENDING_KEY = "${marker}"`));
  assert.match(classicSource, /const pendingLead = window\.sessionStorage\.getItem\(googleAdsLeadPendingKey\);\s+if \(pendingLead && typeof window\.gtag === "function"\)/);
  assert.match(classicSource, /sessionStorage\.removeItem\(googleAdsLeadPendingKey\)/);
});

// Runs the enhanced-conversion helpers from script.js against a stub window.
const loadLeadContext = (sessionStorage) => {
  const start = classicSource.indexOf("const sha256Hex");
  const end = classicSource.indexOf("const trackEvent");
  const keyDeclaration = classicSource.match(/const googleAdsUserDataKey = "[^"]+";/)[0];
  const window = { crypto: webcrypto, sessionStorage, setTimeout };
  vm.runInNewContext(`${keyDeclaration}\n${classicSource.slice(start, end)}`, { window, TextEncoder });
  const context = window.apexLeadContext;
  // Values from the sandbox have its own prototypes; compare them as plain JSON.
  const plain = async (pending) => JSON.parse(JSON.stringify(await pending));
  return { ...context, hashUserData: (payload) => plain(context.hashUserData(payload)), rememberUserData: context.rememberUserData, rawHashUserData: context.hashUserData };
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const memoryStorage = () => {
  const items = new Map();
  return { items, setItem: (key, value) => items.set(key, String(value)), getItem: (key) => items.get(key) ?? null };
};

test("enhanced conversions hash the normalized email and phone the way Google expects", async () => {
  const context = loadLeadContext(memoryStorage());
  assert.deepEqual(await context.hashUserData({ email: "  Jane.Doe@Example.COM ", phone: "+12535550123" }), {
    sha256_email_address: sha256("jane.doe@example.com"),
    sha256_phone_number: sha256("+12535550123")
  });
  assert.deepEqual(await context.hashUserData({ email: "j.doe.x@GMail.com", phone: "(253) 555-0123" }), {
    sha256_email_address: sha256("jdoex@gmail.com"),
    sha256_phone_number: sha256("+12535550123")
  });
  assert.deepEqual(await context.hashUserData({ email: "", phone: "+12535550123" }), { sha256_phone_number: sha256("+12535550123") });
  assert.equal(await context.hashUserData({ email: "not-an-email", phone: "" }), null);
  assert.equal(await context.hashUserData({}), null);
});

test("only hashes are stored, and a slow or failed hash never blocks the redirect", async () => {
  const storage = memoryStorage();
  const context = loadLeadContext(storage);
  await context.rememberUserData(context.rawHashUserData({ email: "jane@example.com", phone: "+12535550123" }));
  const stored = storage.items.get("apex_google_ads_user_data");
  assert.doesNotMatch(stored, /jane|example|2535550123/);
  assert.deepEqual(JSON.parse(stored), { sha256_email_address: sha256("jane@example.com"), sha256_phone_number: sha256("+12535550123") });

  const slowStorage = memoryStorage();
  const started = Date.now();
  await loadLeadContext(slowStorage).rememberUserData(new Promise(() => {}));
  assert.ok(Date.now() - started < 1000);
  assert.equal(slowStorage.items.size, 0);

  await loadLeadContext(slowStorage).rememberUserData(Promise.reject(new Error("hash failed")));
  await loadLeadContext({ setItem() { throw new Error("storage blocked"); } }).rememberUserData(Promise.resolve({ sha256_phone_number: "x" }));
  await loadLeadContext(slowStorage).rememberUserData(undefined);
  assert.equal(slowStorage.items.size, 0);
});

test("the confirmation page sends user data before the conversion and then clears it", () => {
  const thankYouCheck = classicSource.indexOf('window.location.pathname === "/thank-you"');
  const userData = classicSource.indexOf('window.gtag("set", "user_data", userData)', thankYouCheck);
  const conversion = classicSource.indexOf('window.gtag("event", "conversion", conversion)', thankYouCheck);
  const cleared = classicSource.indexOf("sessionStorage.removeItem(googleAdsUserDataKey)", conversion);
  assert.ok(userData > thankYouCheck && conversion > userData && cleared > conversion);
  // A bad stored value has its own try, so it cannot skip the conversion.
  assert.match(classicSource.slice(thankYouCheck, conversion), /try \{\s+const userData = JSON\.parse[\s\S]*?\} catch \{/);
});

test("every lead form stores user data only after a confirmed lead and before the redirect", () => {
  for (const [source, markerCall] of [
    [classicSource, 'sessionStorage.setItem(googleAdsLeadPendingKey, payload.submission_id || "1")'],
    [quizSource, 'sessionStorage.setItem(GOOGLE_ADS_LEAD_PENDING_KEY, payload.submission_id || "1")']
  ]) {
    const remembers = [...source.matchAll(/await window\.apexLeadContext\??\.rememberUserData\(pendingUserData\);/g)];
    assert.equal(remembers.length, source === quizSource ? 2 : 1);
    for (const remember of remembers) {
      const markerSet = source.lastIndexOf(markerCall, remember.index);
      const hashStart = source.lastIndexOf("hashUserData(payload)", remember.index);
      const request = source.lastIndexOf("await fetch(", remember.index);
      const redirect = source.indexOf('window.location.href = "/thank-you"', remember.index);
      assert.ok(hashStart >= 0 && request > hashStart && markerSet > request && remember.index > markerSet && redirect > remember.index);
      assert.ok(redirect - remember.index < 120);
    }
  }
});

test("the conversion carries the submission id as transaction_id so Google Ads deduplicates it", () => {
  assert.match(classicSource, /if \(pendingLead !== "1"\) conversion\.transaction_id = pendingLead;/);
  assert.match(classicSource, /window\.apexLeadContext\.decorate\(payload, leadForm\);/);
  assert.equal((quizSource.match(/window\.apexLeadContext\?\.decorate\(payload, leadForm\);/g) || []).length, 2);
});
