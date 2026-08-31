import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { onboardingScript } from "../lib/onboarding.ts";

function runOnboarding(search, entered = null) {
  const document = { documentElement: { dataset: {} } };
  vm.runInNewContext(onboardingScript, {
    URLSearchParams,
    location: { search },
    localStorage: { getItem: () => entered },
    document,
  });
  return document.documentElement.dataset.playaReturning;
}

test("shared plan URLs bypass onboarding even for first-time visitors", () => {
  assert.equal(runOnboarding("?p=1&e=event-one.event-two&by=Intel&lang=en"), "true");
});

test("single-event URLs bypass onboarding even for first-time visitors", () => {
  assert.equal(runOnboarding("?event=1&e=event-one&d=2&by=Intel&lang=en"), "true");
});

test("normal first-time visits still show onboarding", () => {
  assert.equal(runOnboarding(""), "false");
  assert.equal(runOnboarding("?p=1"), "false");
});

test("returning visitors still bypass onboarding", () => {
  assert.equal(runOnboarding("", "1"), "true");
});
