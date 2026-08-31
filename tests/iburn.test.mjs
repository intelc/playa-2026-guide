import assert from "node:assert/strict";
import test from "node:test";
import { getIBurnEventUrl } from "../lib/iburn.ts";

test("creates an iBurn event link with the source UID and a clean title", () => {
  assert.equal(
    getIBurnEventUrl("  event_123  ", "  Sunrise   Yoga & Tea  "),
    "https://iburnapp.com/event/?uid=event_123&title=Sunrise+Yoga+%26+Tea",
  );
});

test("rejects missing or malformed event UIDs", () => {
  assert.equal(getIBurnEventUrl(undefined, "Sunrise Yoga"), null);
  assert.equal(getIBurnEventUrl("not/a/uid", "Sunrise Yoga"), null);
});
