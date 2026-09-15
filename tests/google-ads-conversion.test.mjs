import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

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
  const conversion = classicSource.indexOf('gtag("event", "conversion", { send_to: googleAdsLeadDestination })', markerCheck);
  const markerClear = classicSource.indexOf("sessionStorage.removeItem(googleAdsLeadPendingKey)", conversion);
  assert.ok(thankYouCheck >= 0 && markerCheck > thankYouCheck && conversion > markerCheck && markerClear > conversion);
});

test("the shared lead form sets the marker and redirects only after confirmed success and GA4", () => {
  const successCheck = classicSource.indexOf('if (!response.ok || result?.ok !== true)');
  const successLatch = classicSource.indexOf("leadEventSent = true;", successCheck);
  const generateLead = classicSource.indexOf('"generate_lead"', successLatch);
  const markerSet = classicSource.indexOf('sessionStorage.setItem(googleAdsLeadPendingKey, "1")', generateLead);
  const redirect = classicSource.indexOf('window.location.href = "/thank-you"', markerSet);
  const catchBlock = classicSource.indexOf("    } catch {", redirect);
  assert.ok(successCheck >= 0 && successLatch > successCheck && generateLead > successLatch && markerSet > generateLead && redirect > markerSet && catchBlock > redirect);
  assert.doesNotMatch(classicSource.slice(successLatch, catchBlock), /trackEvent\(\s*"conversion"/);
  assert.doesNotMatch(classicSource.slice(catchBlock, classicSource.indexOf("  });", catchBlock)), /sessionStorage\.setItem|conversion/);
  assert.match(classicSource, /if \(submissionInProgress \|\| leadEventSent\) return;/);
});

test("both instant estimates set the marker and redirect after confirmed success and GA4", () => {
  assert.equal((quizSource.match(/if \(!response\.ok \|\| (?:data|result)\?\.ok !== true\) throw new Error\("Request failed"\);/g) || []).length, 2);
  assert.equal((quizSource.match(/sessionStorage\.setItem\(GOOGLE_ADS_LEAD_PENDING_KEY, "1"\)/g) || []).length, 2);
  assert.equal((quizSource.match(/window\.location\.href = "\/thank-you"/g) || []).length, 2);
  assert.equal((quizSource.match(/track\("generate_lead"/g) || []).length, 2);

  for (const markerSet of quizSource.matchAll(/sessionStorage\.setItem\(GOOGLE_ADS_LEAD_PENDING_KEY, "1"\)/g)) {
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
  assert.match(classicSource, /sessionStorage\.getItem\(googleAdsLeadPendingKey\) === "1"/);
  assert.match(classicSource, /sessionStorage\.removeItem\(googleAdsLeadPendingKey\)/);
});
