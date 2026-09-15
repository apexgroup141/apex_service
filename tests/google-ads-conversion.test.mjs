import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const classicSource = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");
const quizSource = fs.readFileSync(new URL("../instant-estimate.js", import.meta.url), "utf8");
const destination = "AW-18358155203/eht5CKv_lvgcEMPv7LFE";

test("uses the approved Google Ads lead destination in both lead handlers", () => {
  assert.match(classicSource, new RegExp(destination.replace("/", "\\/")));
  assert.match(quizSource, new RegExp(destination.replace("/", "\\/")));
});

test("the shared lead form tracks one conversion only after a confirmed API success", () => {
  assert.equal((classicSource.match(/trackEvent\(\s*"conversion"/g) || []).length, 1);
  const successCheck = classicSource.indexOf('if (!response.ok || result?.ok !== true)');
  const successLatch = classicSource.indexOf("leadEventSent = true;", successCheck);
  const generateLead = classicSource.indexOf('"generate_lead"', successLatch);
  const conversion = classicSource.indexOf('trackEvent(\n        "conversion"', generateLead);
  assert.ok(successCheck >= 0 && successLatch > successCheck && generateLead > successLatch && conversion > generateLead);
  const generateLeadCall = classicSource.slice(generateLead, conversion);
  const conversionCall = classicSource.slice(conversion, classicSource.indexOf("    } catch", conversion));
  assert.doesNotMatch(generateLeadCall, /thank-you/);
  assert.match(conversionCall, /window\.location\.href = "\/thank-you"/);
  assert.match(conversionCall, /2000/);
  assert.match(classicSource, /if \(submissionInProgress \|\| leadEventSent\) return;/);
});

test("both instant-estimate branches track one conversion after their confirmed API success", () => {
  assert.equal((quizSource.match(/track\("conversion"/g) || []).length, 2);
  assert.equal((quizSource.match(/if \(!response\.ok \|\| (?:data|result)\?\.ok !== true\) throw new Error\("Request failed"\);/g) || []).length, 2);
  assert.match(quizSource, /if \(submissionInProgress \|\| leadEventSent\) return;/);
  assert.match(quizSource, /if \(submissionInProgress\) return;/);

  for (const conversion of quizSource.matchAll(/track\("conversion", \{ send_to: GOOGLE_ADS_LEAD_DESTINATION \}, \(\) => \{ window\.location\.href = "\/thank-you"; \}\)/g)) {
    const precedingSuccessCheck = quizSource.lastIndexOf("ok !== true", conversion.index);
    const precedingGenerateLead = quizSource.lastIndexOf('track("generate_lead"', conversion.index);
    assert.ok(precedingSuccessCheck >= 0 && precedingSuccessCheck < conversion.index);
    assert.ok(precedingGenerateLead > precedingSuccessCheck && precedingGenerateLead < conversion.index);
  }
  assert.equal((quizSource.match(/window\.location\.href = "\/thank-you"/g) || []).length, 2);
});

test("conversion callbacks use a guarded two-second fallback", () => {
  assert.match(classicSource, /trackEvent = \(eventName, eventData = \{\}, callback = null, callbackTimeout = 1300\)/);
  assert.equal((quizSource.match(/callbackTimeout = 2000/g) || []).length, 2);
  assert.equal((quizSource.match(/let callbackCalled = false;/g) || []).length, 2);
  assert.equal((quizSource.match(/window\.setTimeout\(runCallback, callbackTimeout\)/g) || []).length, 2);
});

test("failed and validation paths do not contain a conversion call", () => {
  const conversion = classicSource.search(/trackEvent\(\s*"conversion"/);
  const classicCatch = classicSource.slice(classicSource.indexOf("    } catch {", conversion), classicSource.indexOf("  });", conversion));
  assert.doesNotMatch(classicCatch, /conversion/);
  assert.doesNotMatch(quizSource, /if \([^\n]*reportValidity\(\)[\s\S]{0,300}conversion/);
});
