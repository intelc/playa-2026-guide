import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeBilingualEventRows,
  normalizeEventUrl,
  parseEventRows,
} from "../lib/bilingual-events.mjs";

function row(values) {
  return { c: values.map((value) => ({ v: value })) };
}

const times = ["18:00-19:00", "-", "-", "-", "-", "-", "-", "-", "-"];
const englishHeader = row(Array(17).fill("header"));
const chineseCredit = row(["credit"]);
const chineseHeader = row(Array(18).fill("标题"));

function englishEvent({ link = "-", uid = "event-1" } = {}) {
  return row([...times, "English title", "English description", "prty", "Camp Name", "4:30 & A", "extra", link, uid]);
}

function chineseEvent({ link = "-", uid = "event-1" } = {}) {
  return row([...times, "中文标题", "English title", "中文描述", "派对", "Camp Name", "4:30 & A", "补充", link, uid]);
}

test("normalizes official event URLs without losing meaningful art anchors", () => {
  assert.equal(
    normalizeEventUrl("http://burningman.org/event/brc/2026-art-installations/?utm_source=test&artType=B#ElectricDandelion"),
    "https://burningman.org/event/brc/2026-art-installations?artType=B#ElectricDandelion",
  );
  assert.equal(normalizeEventUrl("-"), null);
});

test("parses the extra Chinese title column and second header row", () => {
  const [event] = parseEventRows([chineseCredit, chineseHeader, chineseEvent()], "zh");
  assert.deepEqual({ title: event.title, description: event.description, type: event.type, uid: event.uid }, {
    title: "中文标题",
    description: "中文描述",
    type: "派对",
    uid: "event-1",
  });
});

test("matches translations by canonical URL before UID", () => {
  const url = "https://playaevents.burningman.org/2026/playa_event/55871/";
  const [event] = mergeBilingualEventRows({
    englishRows: [englishHeader, englishEvent({ link: url, uid: "english-uid" })],
    chineseRows: [chineseCredit, chineseHeader, chineseEvent({ link: url, uid: "chinese-uid" })],
    lang: "zh",
    sheetLinks: { en: "https://sheet/en", zh: "https://sheet/zh" },
  });
  assert.equal(event.title, "中文标题");
  assert.equal(event.uid, "english-uid");
  assert.equal(event.matchKey, "url:https://playaevents.burningman.org/2026/playa_event/55871");
});

test("falls back to UID when an event has no source URL", () => {
  const [event] = mergeBilingualEventRows({
    englishRows: [englishHeader, englishEvent({ uid: "shared-uid" })],
    chineseRows: [chineseCredit, chineseHeader, chineseEvent({ uid: "shared-uid" })],
    lang: "zh",
    sheetLinks: { en: "https://sheet/en", zh: "https://sheet/zh" },
  });
  assert.equal(event.title, "中文标题");
  assert.equal(event.matchKey, "uid:shared-uid");
  assert.equal(event.link, "https://sheet/zh");
});
