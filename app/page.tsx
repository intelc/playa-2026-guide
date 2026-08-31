"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, MapPin, Share2 } from "lucide-react";
import {
  createSharedEventUrl,
  createSharedPlanUrl,
  MAX_SHARED_PLAN_EVENTS,
  parseSharedEventUrl,
  parseSharedPlanUrl,
  type SharedEventPayload,
  type SharedPlanPayload,
} from "@/lib/shared-plan";
import { buildSharedEventMetadata, buildSharedPlanMetadata } from "@/lib/share-metadata";
import { getEventAddressProvenance, getEventLocationDisplay, getOfficialCampCoordinates, getOfficialCampMapUrl, type EventLocation } from "../lib/event-location";
import { getIBurnEventUrl } from "../lib/iburn";

type Lang = "en" | "zh";

type EventItem = {
  uid: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  camp: string;
  where: string;
  extra: string;
  link: string;
  times: string[];
  location?: EventLocation;
};

type ShareAssetBase = {
  blob: Blob;
  url: string;
  filename: string;
  caption: string;
  shareText: string;
  title: string;
  shareUrl: string;
  lang: Lang;
  name: string;
};

type ShareAsset = ShareAssetBase & (
  | { kind: "event"; event: EventItem; selectedDay: number }
  | { kind: "plan"; events: EventItem[]; totalEventCount: number }
);

type EventPreviewState = {
  event: EventItem;
  selectedDay: number;
  sharedBy: string | null;
};

const days = [
  ["SUN", "周日", "8.30"],
  ["MON", "周一", "8.31"],
  ["TUE", "周二", "9.01"],
  ["WED", "周三", "9.02"],
  ["THU", "周四", "9.03"],
  ["FRI", "周五", "9.04"],
  ["SAT", "周六", "9.05"],
  ["SUN", "周日", "9.06"],
  ["MON", "周一", "9.07"],
];
const eventDateKeys = ["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"];
const brcTimeZone = "America/Los_Angeles";
const minuteMs = 60_000;
const dayMinutes = 24 * 60;
const eventClockEpoch = Date.UTC(2026, 7, 30, 7);
const languageStorageKey = "playa-language";
const brcClockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: brcTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});
const eventDayOrdinals = eventDateKeys.map((date) => {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / (dayMinutes * minuteMs);
});

const categoryOrder = ["all", "party", "art", "community", "food-drink", "healing", "movement", "performance", "spiritual", "workshop", "adult", "other"];
const websiteUrl = "https://playa.intelchen.com";
const publicSearchApiUrl = `${websiteUrl}/api/search`;
const sourceListLinks: Record<Lang, string> = {
  en: "https://docs.google.com/spreadsheets/d/1cPbc5bkKwQ11aID9Xa4-fRyMLpFaX80bAcN3hMjo_DY/edit",
  zh: "https://docs.google.com/spreadsheets/d/1cPbc5bkKwQ11aID9Xa4-fRyMLpFaX80bAcN3hMjo_DY/edit?gid=1125425695#gid=1125425695",
};

const categoryMeta: Record<string, { en: string; zh: string; emoji: string }> = {
  all: { en: "All events", zh: "全部活动", emoji: "✨" },
  party: { en: "Party", zh: "派对", emoji: "🎉" },
  art: { en: "Art", zh: "艺术", emoji: "🎨" },
  community: { en: "Community", zh: "社区", emoji: "🤝" },
  "food-drink": { en: "Food & Drink", zh: "食饮", emoji: "🍽️" },
  healing: { en: "Healing", zh: "疗愈", emoji: "💚" },
  movement: { en: "Movement", zh: "运动", emoji: "🕺" },
  performance: { en: "Performance", zh: "演出", emoji: "🎭" },
  spiritual: { en: "Spiritual", zh: "灵性", emoji: "🔮" },
  workshop: { en: "Workshop", zh: "工作坊", emoji: "🛠️" },
  adult: { en: "Adult", zh: "成人", emoji: "🔞" },
  other: { en: "Other", zh: "其他", emoji: "🌀" },
};

const copy = {
  en: {
    navTitle: "PLAYA / 2026",
    navSub: "Black Rock City field guide",
    search: "Search events, tags, camps, or locations…",
    eyebrow: "COMMUNITY-CURATED · 3,744 MOMENTS IN THE DUST",
    heroA: "FIND YOUR",
    heroB: "NEXT WONDER.",
    intro:
      "Nine days. Thousands of invitations. One clean guide for following the strange, generous pulse of Black Rock City.",
    updated: "Live source · refreshed automatically",
    events: "events",
    days: "days",
    languages: "categories",
    saved: "saved",
    makeMyList: "Make my Playa list",
    copyToAgent: "Copy to my agent",
    agentCopied: "Agent context + saved events copied!",
    agentCopiedShort: "Copied!",
    myPlaya: "My Playa",
    planHint: "Your saved events, arranged across the week. Stored only in this browser.",
    planEmpty: "Star any event to start building your personal playa list.",
    savedEventsUnavailable: "Your saved events are no longer in the live guide. Clear them to reset My Playa.",
    sharedPlaya: "Shared Playa",
    sharedPlanHint: "A Playa shared with you. Preview it here, then save it to your own list.",
    sharedPlanEmpty: "These shared events are no longer in the live guide.",
    saveSharedPlan: "Save all to My Playa",
    sharedPlanSaved: "Saved to My Playa",
    copyList: "Copy list",
    copied: "Copied",
    clearAll: "Clear all",
    close: "Close",
    explore: "Explore the week",
    exploreSub: "Filter the dust. Keep the magic.",
    allDays: "UPCOMING",
    happened: "Happened",
    pastShort: "Past",
    brcTime: "BRC time",
    showing: "Showing",
    matches: "matches",
    empty: "No events found in this corner of the playa.",
    reset: "Reset filters",
    loadingMore: "Loading more events",
    open: "Event details",
    viewMap: "View location",
    chooseMap: "Choose a map app",
    appleMaps: "Apple Maps",
    googleMaps: "Google Maps",
    iburn: "Open in iBurn",
    location: "Location",
    savedOnly: "Saved only",
    save: "Save event",
    remove: "Remove saved event",
    share: "Share event",
    eventPreview: "Event details",
    someoneShared: "Someone shared this with you",
    saveToMyPlaya: "Save to My Playa",
    savedToMyPlaya: "Saved to My Playa",
    shareTitle: "Share this event",
    aboutEvent: "About this event",
    shareHint: "We'll send the image, caption, and link together when the selected app accepts them. If it keeps only part, copy the caption separately.",
    shareNow: "Share image + text",
    saveImage: "Save image",
    copyCaption: "Copy caption",
    captionCopied: "Copied",
    generating: "Generating share card",
    sharePlan: "Share list",
    sharePlanTitle: "Share My Playa",
    shareName: "Your name on this share",
    shareNamePlaceholder: "e.g. John Doe",
    updatingShare: "Updating preview…",
    generatingPlan: "Generating…",
    shareLimited: "This share includes the first {shown} of {total} saved events.",
    footerTitle: "Built for serendipity, not certainty.",
    footerCopy: "Times and locations can shift on playa. Follow the link for the latest source details — then stay open to the detour.",
    source: "Original event list",
  },
  zh: {
    navTitle: "PLAYA / 2026",
    navSub: "双语沙漠活动指南",
    search: "搜索活动、标签、营地或地点……",
    eyebrow: "社群整理 · 3,744 个沙漠时刻",
    heroA: "去遇见",
    heroB: "下一场奇迹。",
    intro: "九天，数千封邀请，一份清晰的双语指南。跟随黑石城奇异、慷慨的脉搏，在尘土里找到属于你的下一站。",
    updated: "实时来源 · 自动刷新",
    events: "活动",
    days: "天",
    languages: "分类",
    saved: "已收藏",
    makeMyList: "制作我的 Playa 清单",
    copyToAgent: "复制给我的 Agent",
    agentCopied: "已复制 Agent 上下文和收藏活动！",
    agentCopiedShort: "已复制！",
    myPlaya: "我的 Playa",
    planHint: "收藏的活动按日期排好，只保存在此浏览器中。",
    planEmpty: "收藏任意活动，开始制作你的个人 Playa 清单。",
    savedEventsUnavailable: "你收藏的活动已不在最新指南中。清空后可重新开始制作我的 Playa。",
    sharedPlaya: "收到的 Playa",
    sharedPlanHint: "这是别人分享给你的 Playa 清单。预览后可全部保存到自己的清单。",
    sharedPlanEmpty: "这些分享的活动已不在最新指南中。",
    saveSharedPlan: "全部保存到我的 Playa",
    sharedPlanSaved: "已保存到我的 Playa",
    copyList: "复制清单",
    copied: "已复制",
    clearAll: "清空",
    close: "关闭",
    explore: "探索这一周",
    exploreSub: "筛掉尘埃，留下惊喜。",
    allDays: "即将开始",
    happened: "已结束",
    pastShort: "已过",
    brcTime: "黑石城时间",
    showing: "当前显示",
    matches: "个结果",
    empty: "这片 playa 暂时没有匹配的活动。",
    reset: "重置筛选",
    loadingMore: "正在加载更多活动",
    open: "查看详情",
    viewMap: "查看位置",
    chooseMap: "选择地图应用",
    appleMaps: "Apple 地图",
    googleMaps: "Google 地图",
    iburn: "在 iBurn 中打开",
    location: "地点",
    savedOnly: "只看收藏",
    save: "收藏活动",
    remove: "取消收藏",
    share: "分享活动",
    eventPreview: "活动详情",
    someoneShared: "有人分享给你",
    saveToMyPlaya: "保存到我的 Playa",
    savedToMyPlaya: "已保存到我的 Playa",
    shareTitle: "分享这场活动",
    aboutEvent: "活动简介",
    shareHint: "会同时尝试发送图片、文案和链接；接收应用可能只保留其中一部分，如有需要可另行复制文案。",
    shareNow: "分享图片和文案",
    saveImage: "保存到相册",
    copyCaption: "复制文案",
    captionCopied: "已复制",
    generating: "正在生成分享卡片",
    sharePlan: "分享清单",
    sharePlanTitle: "分享我的 Playa",
    shareName: "分享图上的名字",
    shareNamePlaceholder: "例如：John Doe",
    updatingShare: "正在更新预览……",
    generatingPlan: "生成中……",
    shareLimited: "此分享包含已收藏活动中的前 {shown} 场，共 {total} 场。",
    footerTitle: "为偶遇而做，不为确定而生。",
    footerCopy: "Playa 上的时间和地点可能随时变化。出发前可通过原始链接确认——也别忘了给意外留一点空间。",
    source: "原始活动清单",
  },
};

function normalizeCategory(category: string) {
  const aliases: Record<string, string> = {
    party: "party", prty: "party", "派对": "party", art: "art", arts: "art", "艺术": "art",
    community: "community", "社区": "community", "food & drink": "food-drink", "food-drink": "food-drink", food: "food-drink", tea: "food-drink", "食饮": "food-drink", "食物": "food-drink", "美食": "food-drink", "茶": "food-drink", "茶饮": "food-drink",
    healing: "healing", "疗愈": "healing", movement: "movement", "运动": "movement",
    performance: "performance", "演出": "performance", spiritual: "spiritual", "灵性": "spiritual",
    workshop: "workshop", work: "workshop", "工作": "workshop", "工作坊": "workshop",
    adult: "adult", adlt: "adult", "成人": "adult", other: "other", othr: "other", "其他": "other",
  };
  return aliases[category.trim().toLocaleLowerCase()] || "other";
}

const categoryColors: Record<string, string> = {
  party: "#6856c4", art: "#e85a39", community: "#4f8292", "food-drink": "#df9e36",
  healing: "#57966d", movement: "#c56f35", performance: "#b15176", spiritual: "#755aa6",
  workshop: "#7b9d68", adult: "#a04a6f", other: "#87909a",
};

function getBrcClock(timestamp: number) {
  const parts: Record<string, string> = {};
  for (const part of brcClockFormatter.formatToParts(new Date(timestamp))) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const ordinal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / (dayMinutes * minuteMs);
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  return { ordinal, minute, label: `${parts.hour}:${parts.minute} ${parts.timeZoneName}` };
}

function occurrenceHasEnded(time: string, dayIndex: number, timestamp: number) {
  if (!time || time === "-") return true;
  const current = getBrcClock(timestamp);
  const startOrdinal = eventDayOrdinals[dayIndex];
  if (time === "All") return current.ordinal * dayMinutes + current.minute >= (startOrdinal + 1) * dayMinutes;
  const match = time.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return false;
  const start = Number(match[1]) * 60 + Number(match[2]);
  let end = Number(match[3]) * 60 + Number(match[4]);
  if (end <= start) end += dayMinutes;
  return current.ordinal * dayMinutes + current.minute >= startOrdinal * dayMinutes + end;
}

function eventHasUpcomingOccurrence(event: EventItem, timestamp: number) {
  return event.times.some((time, index) => time && time !== "-" && !occurrenceHasEnded(time, index, timestamp));
}

function eventDayStatus(dayIndex: number, timestamp: number) {
  const current = getBrcClock(timestamp);
  if (current.ordinal > eventDayOrdinals[dayIndex]) return "past";
  if (current.ordinal === eventDayOrdinals[dayIndex]) return "today";
  return "future";
}

function eventDayIndex(event: EventItem, selectedDay: number, timestamp = Date.now()) {
  if (selectedDay >= 0 && event.times[selectedDay] && event.times[selectedDay] !== "-") return selectedDay;
  const activeDays = event.times.map((time, index) => (time && time !== "-" ? index : -1)).filter((index) => index >= 0);
  const nextDay = activeDays.find((index) => !occurrenceHasEnded(event.times[index], index, timestamp));
  return nextDay ?? activeDays.at(-1) ?? 0;
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number, lang: Lang) {
  const tokens = lang === "zh" ? Array.from(text) : text.split(/\s+/).map((word, index) => `${index ? " " : ""}${word}`);
  const lines: string[] = [];
  let line = "";
  for (const token of tokens) {
    const candidate = line + token;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line.trim());
      line = token.trimStart();
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}

function getOfficialCampPointLabel(location: unknown, lang: Lang) {
  const point = getOfficialCampCoordinates(location);
  if (!point) return null;
  return {
    label: lang === "en" ? "OFFICIAL CAMP POINT" : "官方营地坐标",
    coordinates: `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`,
  };
}

function getEventLocationDetails(event: EventItem) {
  return getEventLocationDisplay(event.location, event.camp, event.where);
}

function formatAddressProvenance(event: EventItem, lang: Lang) {
  const provenance = getEventAddressProvenance(event.location, event.where);
  if (!provenance) return null;
  const checkedAt = provenance.checkedAt ? provenance.checkedAt.slice(5).replace("-", ".") : null;
  const label = provenance.kind === "reviewed"
    ? (lang === "en" ? "Reviewed" : "已核对")
    : (lang === "en" ? "Map-derived" : "地图推算");
  return checkedAt ? `${label} · ${checkedAt}` : label;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Clipboard access can be unavailable outside a secure context.
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function createAgentContext({ lang, query, category, day, savedEvents, now }: { lang: Lang; query: string; category: string; day: number; savedEvents: EventItem[]; now: number }) {
  const endpoint = new URL(publicSearchApiUrl);
  endpoint.searchParams.set("lang", lang);
  if (query.trim()) endpoint.searchParams.set("q", query.trim());
  if (category !== "all") endpoint.searchParams.set("category", category);
  if (day >= 0) endpoint.searchParams.set("day", String(day));
  const categoryLabel = categoryMeta[category] ? `${categoryMeta[category].en} / ${categoryMeta[category].zh}` : category;
  const dayLabel = day >= 0 ? `${days[day][0]} / ${days[day][1]} (${days[day][2]})` : "All days / 全部日期";
  const orderedSavedEvents = [...savedEvents].sort((left, right) => {
    const leftDay = eventDayIndex(left, -1, now);
    const rightDay = eventDayIndex(right, -1, now);
    const startMinute = (event: EventItem, dayIndex: number) => {
      const match = event.times[dayIndex]?.match(/^(\d{2}):(\d{2})/);
      return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
    };
    return leftDay * dayMinutes + startMinute(left, leftDay) - (rightDay * dayMinutes + startMinute(right, rightDay));
  });
  const savedSection = orderedSavedEvents.length
    ? orderedSavedEvents.map((event, index) => {
      const categoryKey = normalizeCategory(event.category);
      const meta = categoryMeta[categoryKey] || categoryMeta.other;
      const schedule = event.times.flatMap((time, dayIndex) => time && time !== "-"
        ? [`${days[dayIndex][lang === "en" ? 0 : 1]} ${days[dayIndex][2]} · ${time}`]
        : []).join("; ");
      const location = event.where !== "-" ? event.where : event.camp;
      return `${index + 1}. ${event.title}
   - When / 时间 (BRC): ${schedule}
   - Where / 地点: ${location}
   - Camp / 营地: ${event.camp}
   - Category / 分类: ${meta.en} / ${meta.zh}
   - Source / 来源: ${event.link}`;
    }).join("\n\n")
    : "None saved yet / 暂无收藏活动";

  return `You are helping someone explore Playa 2026, a bilingual Burning Man / Black Rock City event guide.

Canonical website / 官方网站: ${websiteUrl}
Callable public search API / 当前可调用的公开搜索 API: ${publicSearchApiUrl}

Use the API to find live events. It accepts:
- q: optional text search across title, description, camp, and location
- lang: en (default) or zh
- day: 0–8, or a Playa date such as 2026-08-30 (date is also accepted as an alias)
- category: all, party, art, community, food-drink, healing, movement, performance, spiritual, workshop, adult, or other
- limit: 1–100 (default 25), and optional offset: 0–10000

Current visitor context / 当前访客筛选:
- Language / 语言: ${lang === "en" ? "English / 英文" : "Chinese / 中文"}
- Search / 搜索: ${query.trim() || "None / 无"}
- Day / 日期: ${dayLabel}
- Category / 分类: ${categoryLabel}
- Ready-to-use search URL: ${endpoint.toString()}

Saved Playa events / 已收藏的 Playa 活动 (${orderedSavedEvents.length}):
${savedSection}

Treat the saved events as the visitor's explicit interests. Preserve them when planning a schedule or making recommendations unless the visitor asks to remove or replace them.

When suggesting an event, preserve its title, time, and location. Cite the event's event.link as the live source for that event, and link back to ${websiteUrl} for discovery. Times and locations can shift on playa, so encourage people to open the event link before heading out. Reply in the visitor's selected language unless they ask otherwise.`;
}

function downloadShareAsset(asset: ShareAsset) {
  const link = document.createElement("a");
  link.href = asset.url;
  link.download = asset.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function createEventShareCard(event: EventItem, lang: Lang, selectedDay: number, sharedBy = "") {
  const width = 1080;
  const height = 1350;
  const padding = 76;
  const headerHeight = 300;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");

  const category = normalizeCategory(event.category);
  const meta = categoryMeta[category] || categoryMeta.other;
  const accent = categoryColors[category] || categoryColors.other;
  const shownDay = eventDayIndex(event, selectedDay);
  const locationDetails = getEventLocationDetails(event);
  const addressProvenance = formatAddressProvenance(event, lang);
  const officialCampPoint = getOfficialCampPointLabel(event.location, lang);
  const font = lang === "zh" ? '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif' : 'system-ui, -apple-system, "Segoe UI", sans-serif';

  // Editorial base and a tighter decorative masthead.
  context.fillStyle = "#f4efe5";
  context.fillRect(0, 0, width, height);
  context.fillStyle = accent;
  context.fillRect(0, 0, width, headerHeight);

  context.save();
  context.globalAlpha = 0.16;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 2;
  for (let x = 0; x <= width; x += 48) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, headerHeight); context.stroke();
  }
  for (let y = 0; y <= headerHeight; y += 48) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }
  context.restore();

  const sun = context.createLinearGradient(650, -30, 1040, 310);
  sun.addColorStop(0, "#ffd28a");
  sun.addColorStop(1, "#ef5b36");
  context.fillStyle = sun;
  context.beginPath(); context.arc(855, 145, 194, 0, Math.PI * 2); context.fill();
  context.save();
  context.translate(230, 214); context.rotate(-0.28);
  context.strokeStyle = "rgba(255,255,255,.82)"; context.lineWidth = 4;
  context.beginPath(); context.ellipse(0, 0, 128, 46, 0, 0, Math.PI * 2); context.stroke();
  context.restore();

  context.fillStyle = "#ffffff";
  context.font = `800 27px ${font}`;
  context.fillText("PLAYA / 2026", padding, 66);
  context.fillStyle = "rgba(255,255,255,.72)";
  context.font = `600 18px ${font}`;
  context.fillText(lang === "en" ? "A FIELD NOTE FROM THE DUST" : "来自尘土的一张邀请", padding, 98);

  const categoryLabel = lang === "en" ? meta.en.toUpperCase() : meta.zh;
  context.font = `750 22px ${font}`;
  const categoryWidth = context.measureText(categoryLabel).width + 44;
  context.fillStyle = "rgba(23,23,19,.72)";
  context.beginPath(); context.roundRect(width - padding - categoryWidth, 48, categoryWidth, 50, 25); context.fill();
  context.fillStyle = "#ffffff";
  context.textBaseline = "middle";
  context.fillText(categoryLabel, width - padding - categoryWidth + 22, 74);
  context.textBaseline = "alphabetic";

  context.fillStyle = "#ffffff";
  context.font = `700 142px ${font}`;
  context.fillText(meta.emoji, padding, 250);

  // Personalization is a deliberate badge, not an orphaned line of text.
  const shareKicker = sharedBy.trim()
    ? (lang === "en" ? `${sharedBy.trim()} shared this with you` : `${sharedBy.trim()} 分享给你`)
    : (lang === "en" ? "A MOMENT IN THE DUST" : "尘土里的一场相遇");
  context.font = `750 23px ${font}`;
  const kickerText = truncateCanvasText(context, shareKicker, width - padding * 2 - 48);
  const kickerWidth = Math.min(width - padding * 2, context.measureText(kickerText).width + 48);
  context.fillStyle = `${accent}18`;
  context.beginPath(); context.roundRect(padding, 336, kickerWidth, 54, 27); context.fill();
  context.fillStyle = accent;
  context.textBaseline = "middle";
  context.fillText(kickerText, padding + 24, 363);
  context.textBaseline = "alphabetic";

  let titleSize = 74;
  let titleLines: string[] = [];
  do {
    context.font = `800 ${titleSize}px ${font}`;
    titleLines = wrapCanvasText(context, event.title, width - padding * 2, lang);
    if (titleLines.length <= 3) break;
    titleSize -= 4;
  } while (titleSize >= 46);
  const titleWasTruncated = titleLines.length > 3;
  titleLines = titleLines.slice(0, 3);
  if (titleWasTruncated) {
    let finalLine = titleLines[2].replace(/[.…]+$/, "");
    while (finalLine && context.measureText(`${finalLine}…`).width > width - padding * 2) finalLine = finalLine.slice(0, -1);
    titleLines[2] = `${finalLine}…`;
  }
  context.fillStyle = "#171713";
  const titleTop = 455;
  const titleLineHeight = titleSize * 1.04;
  titleLines.forEach((line, index) => context.fillText(line, padding, titleTop + index * titleLineHeight));

  // Make the details readable at messaging-thumbnail size.
  const detailsY = Math.max(570, titleTop + titleLines.length * titleLineHeight + 28);
  const detailsHeight = 174;
  const detailsGap = 18;
  const whenWidth = 356;
  const whereX = padding + whenWidth + detailsGap;
  const whereWidth = width - padding - whereX;
  context.fillStyle = "rgba(255,255,255,.68)";
  context.beginPath(); context.roundRect(padding, detailsY, whenWidth, detailsHeight, 22); context.fill();
  context.beginPath(); context.roundRect(whereX, detailsY, whereWidth, detailsHeight, 22); context.fill();
  context.strokeStyle = "rgba(23,23,19,.12)";
  context.lineWidth = 2;
  context.beginPath(); context.roundRect(padding, detailsY, whenWidth, detailsHeight, 22); context.stroke();
  context.beginPath(); context.roundRect(whereX, detailsY, whereWidth, detailsHeight, 22); context.stroke();

  context.fillStyle = accent;
  context.font = `750 18px ${font}`;
  context.fillText(lang === "en" ? "WHEN" : "时间", padding + 24, detailsY + 34);
  const whereLabel = officialCampPoint
      ? `${lang === "en" ? "WHERE" : "地点"} · ${officialCampPoint.label} · ${officialCampPoint.coordinates}`
      : (lang === "en" ? "WHERE" : "地点");
  context.fillText(truncateCanvasText(context, whereLabel, whereWidth - 48), whereX + 24, detailsY + 34);
  context.fillStyle = "#171713";
  context.font = `800 34px ${font}`;
  context.fillText(`${days[shownDay][lang === "en" ? 0 : 1]} · ${days[shownDay][2]}`, padding + 24, detailsY + 80);
  context.font = `800 42px ${font}`;
  context.fillText(truncateCanvasText(context, event.times[shownDay], whenWidth - 48), padding + 24, detailsY + 135);
  context.font = `750 36px ${font}`;
  const locationLines = wrapCanvasText(context, locationDetails.primary, whereWidth - 48, lang).slice(0, locationDetails.secondary ? 1 : 2);
  locationLines.forEach((line, index) => context.fillText(line, whereX + 24, detailsY + 82 + index * 44));
  if (locationDetails.secondary) {
    context.fillStyle = "#71695e";
    context.font = `600 21px ${font}`;
    context.fillText(truncateCanvasText(context, locationDetails.secondary, whereWidth - 48), whereX + 24, detailsY + 140);
  }
  if (addressProvenance) {
    context.fillStyle = "#847c70";
    context.font = `600 14px ${font}`;
    context.fillText(truncateCanvasText(context, addressProvenance, whereWidth - 48), whereX + 24, detailsY + 163);
  }

  const descriptionLabelY = detailsY + detailsHeight + 50;
  context.fillStyle = accent;
  context.font = `750 18px ${font}`;
  context.fillText(lang === "en" ? "ABOUT THIS MOMENT" : "活动简介", padding, descriptionLabelY);
  context.fillStyle = "#655e52";
  context.font = `450 29px ${font}`;
  const descriptionTop = descriptionLabelY + 46;
  const ctaY = 1062;
  const availableDescriptionLines = Math.max(1, Math.min(5, Math.floor((ctaY - descriptionTop - 20) / 42)));
  let descriptionLines = wrapCanvasText(context, event.description || "—", width - padding * 2, lang);
  const descriptionWasTruncated = descriptionLines.length > availableDescriptionLines;
  descriptionLines = descriptionLines.slice(0, availableDescriptionLines);
  if (descriptionWasTruncated && descriptionLines.length) {
    let finalLine = descriptionLines.at(-1)!.replace(/[.…]+$/, "");
    while (finalLine && context.measureText(`${finalLine}…`).width > width - padding * 2) finalLine = finalLine.slice(0, -1);
    descriptionLines[descriptionLines.length - 1] = `${finalLine}…`;
  }
  descriptionLines.forEach((line, index) => context.fillText(line, padding, descriptionTop + index * 42));

  // A clear action closes the body and makes the shared link feel intentional.
  context.fillStyle = `${accent}16`;
  context.beginPath(); context.roundRect(padding, ctaY, width - padding * 2, 96, 22); context.fill();
  context.fillStyle = accent;
  context.font = `800 25px ${font}`;
  context.textBaseline = "middle";
  context.fillText(lang === "en" ? "VIEW EVENT  →" : "查看活动  →", padding + 28, ctaY + 48);
  context.textAlign = "right";
  context.font = `700 21px ${font}`;
  context.fillText("playa.intelchen.com", width - padding - 28, ctaY + 48);
  context.textAlign = "left";
  context.textBaseline = "alphabetic";

  const footerY = height - 150;
  context.strokeStyle = "rgba(23,23,19,.16)";
  context.beginPath(); context.moveTo(padding, footerY); context.lineTo(width - padding, footerY); context.stroke();
  context.fillStyle = "#171713";
  context.font = `800 27px ${font}`;
  context.fillText("PLAYA / 2026", padding, footerY + 55);
  context.fillStyle = "#6d665b";
  context.font = `500 21px ${font}`;
  context.fillText(lang === "en" ? "Find it. Save it. Follow the detour." : "找到它，收藏它，也给意外留一点空间。", padding, footerY + 92);
  context.fillStyle = accent;
  context.font = `700 22px ${font}`;
  context.textAlign = "right";
  context.fillText(`${meta.emoji} ${lang === "en" ? meta.en.toUpperCase() : meta.zh}`, width - padding, footerY + 71);
  context.textAlign = "left";

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create share image")), "image/png");
  });
}

function truncateCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (context.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened && context.measureText(`${shortened}…`).width > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}…`;
}

function getPlanShareTitle(name: string, lang: Lang) {
  const trimmedName = name.trim();
  if (!trimmedName) return lang === "en" ? "My Playa" : "我的 Playa";
  return lang === "en" ? `${trimmedName}'s Playa` : `${trimmedName} 的 Playa`;
}

function getEventPreviewHeading(sharedBy: string | null, lang: Lang) {
  if (sharedBy === null) return copy[lang].eventPreview;
  const name = sharedBy.trim();
  if (!name) return copy[lang].someoneShared;
  return lang === "en" ? `${name} shared this with you` : `${name} 分享给你`;
}

function formatShareLimit(template: string, shown: number, total: number) {
  return template.replace("{shown}", String(shown)).replace("{total}", String(total));
}

async function createPlanShareCard(events: EventItem[], lang: Lang, name: string, totalEventCount = events.length) {
  const width = 1080;
  // Four text rows leave room for title, camp, and its playa address.
  const rowHeight = 150;
  const maxEvents = MAX_SHARED_PLAN_EVENTS;
  const sorted = [...events].sort((left, right) => {
    const leftDay = eventDayIndex(left, -1);
    const rightDay = eventDayIndex(right, -1);
    return leftDay - rightDay || left.times[leftDay].localeCompare(right.times[rightDay]) || left.title.localeCompare(right.title);
  });
  const visibleEvents = sorted.slice(0, maxEvents);
  const remaining = Math.max(0, totalEventCount - visibleEvents.length);
  const listHeight = visibleEvents.length * rowHeight + (remaining ? 72 : 0);
  // 40 rows stay well below the canvas limits of mobile browsers (6,232px at
  // 1080px wide), while the cap also matches the URL payload limit.
  const height = Math.max(1350, 370 + listHeight + 190);
  const padding = 70;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  const font = lang === "zh" ? '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif' : 'system-ui, -apple-system, "Segoe UI", sans-serif';

  context.fillStyle = "#f4efe5";
  context.fillRect(0, 0, width, height);
  context.save();
  context.globalAlpha = 0.075;
  context.strokeStyle = "#171713";
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += 42) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
  }
  for (let y = 0; y <= height; y += 42) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }
  context.restore();

  const header = context.createLinearGradient(0, 0, width, 320);
  header.addColorStop(0, "#171713");
  header.addColorStop(0.65, "#332a22");
  header.addColorStop(1, "#ef5b36");
  context.fillStyle = header;
  context.fillRect(0, 0, width, 315);

  context.fillStyle = "rgba(255,255,255,.12)";
  context.beginPath(); context.arc(905, 122, 190, 0, Math.PI * 2); context.fill();
  context.strokeStyle = "rgba(255,255,255,.55)";
  context.lineWidth = 3;
  context.beginPath(); context.ellipse(862, 142, 220, 68, -0.28, 0, Math.PI * 2); context.stroke();

  context.fillStyle = "#ef5b36";
  context.font = `700 24px ${font}`;
  context.fillText("PLAYA / 2026", padding, 66);
  context.fillStyle = "#ffffff";
  const planTitle = getPlanShareTitle(name, lang).toLocaleUpperCase(lang === "en" ? "en-US" : "zh-CN");
  let planTitleSize = 72;
  do {
    context.font = `800 ${planTitleSize}px ${font}`;
    if (context.measureText(planTitle).width <= width - padding * 2) break;
    planTitleSize -= 3;
  } while (planTitleSize > 42);
  context.fillText(truncateCanvasText(context, planTitle, width - padding * 2), padding, 160);
  context.font = `500 28px ${font}`;
  context.fillStyle = "rgba(255,255,255,.76)";
  context.fillText(lang === "en" ? "A personal week in the dust" : "我在尘土里的一周", padding, 210);

  const countLabel = lang === "en" ? `${sorted.length} SAVED EVENTS` : `已收藏 ${sorted.length} 场活动`;
  context.font = `700 24px ${font}`;
  const countWidth = context.measureText(countLabel).width + 44;
  context.fillStyle = "rgba(255,255,255,.16)";
  context.beginPath(); context.roundRect(padding, 242, countWidth, 48, 24); context.fill();
  context.fillStyle = "#ffffff";
  context.textBaseline = "middle";
  context.fillText(countLabel, padding + 22, 266);
  context.textBaseline = "alphabetic";

  let y = 355;
  visibleEvents.forEach((event, index) => {
    const shownDay = eventDayIndex(event, -1);
    const category = normalizeCategory(event.category);
    const meta = categoryMeta[category] || categoryMeta.other;
    const locationDetails = getEventLocationDetails(event);
    const addressProvenance = formatAddressProvenance(event, lang);
    const officialCampPoint = getOfficialCampPointLabel(event.location, lang);
    const cardY = y + index * rowHeight;

    context.fillStyle = index % 2 ? "rgba(255,255,255,.72)" : "rgba(255,255,255,.9)";
    context.beginPath(); context.roundRect(padding, cardY, width - padding * 2, 132, 18); context.fill();
    context.fillStyle = categoryColors[category] || categoryColors.other;
    context.beginPath(); context.roundRect(padding, cardY, 10, 132, 5); context.fill();

    context.fillStyle = "#171713";
    context.font = `800 27px ${font}`;
    context.fillText(String(index + 1).padStart(2, "0"), padding + 30, cardY + 42);
    context.fillStyle = "#847c70";
    context.font = `700 18px ${font}`;
    context.fillText(`${days[shownDay][lang === "en" ? 0 : 1]} · ${days[shownDay][2]}`, padding + 30, cardY + 72);

    context.fillStyle = categoryColors[category] || categoryColors.other;
    context.font = `700 18px ${font}`;
    const timeLabel = `${meta.emoji} ${event.times[shownDay]}`;
    const locationTextX = padding + 142;
    let timeLabelWidth = 650;
    if (officialCampPoint) {
      // Keep GPS in the metadata row, not beside the title. This prevents a
      // long title from colliding with the right-aligned coordinate string.
      context.font = `700 16px ${font}`;
      const coordinateWidth = context.measureText(officialCampPoint.coordinates).width;
      const coordinateX = width - padding - 26 - coordinateWidth;
      timeLabelWidth = Math.max(160, coordinateX - locationTextX - 24);
      context.fillStyle = "#71695e";
      context.fillText(officialCampPoint.coordinates, coordinateX, cardY + 31);
      context.fillStyle = categoryColors[category] || categoryColors.other;
      context.font = `700 18px ${font}`;
    }
    context.fillText(truncateCanvasText(context, timeLabel, timeLabelWidth), locationTextX, cardY + 31);
    context.fillStyle = "#171713";
    context.font = `800 25px ${font}`;
    context.fillText(truncateCanvasText(context, event.title, 650), locationTextX, cardY + 60);
    context.fillStyle = "#71695e";
    context.font = `650 19px ${font}`;
    context.fillText(truncateCanvasText(context, locationDetails.primary, 650), locationTextX, cardY + 87);
    if (locationDetails.secondary) {
      context.fillStyle = "#847c70";
      context.font = `550 17px ${font}`;
      context.fillText(truncateCanvasText(context, locationDetails.secondary, 650), locationTextX, cardY + 111);
    }
    if (addressProvenance) {
      context.fillStyle = "#91897d";
      context.font = `600 13px ${font}`;
      context.fillText(truncateCanvasText(context, addressProvenance, 650), locationTextX, cardY + 130);
    }
  });

  y += visibleEvents.length * rowHeight;
  if (remaining) {
    context.fillStyle = "#6f675c";
    context.font = `600 23px ${font}`;
    context.fillText(lang === "en" ? `+ ${remaining} more saved events at playa.intelchen.com` : `另有 ${remaining} 场收藏活动，请前往 playa.intelchen.com 查看`, padding, y + 36);
  }

  const footerY = height - 145;
  context.strokeStyle = "rgba(23,23,19,.2)";
  context.lineWidth = 2;
  context.beginPath(); context.moveTo(padding, footerY); context.lineTo(width - padding, footerY); context.stroke();
  context.fillStyle = "#171713";
  context.font = `800 29px ${font}`;
  context.fillText("PLAYA / 2026", padding, footerY + 50);
  context.fillStyle = "#6d665b";
  context.font = `500 22px ${font}`;
  context.fillText(lang === "en" ? "Times shift. Follow the link, then follow the detour." : "时间可能变化。先确认链接，也给意外留一点空间。", padding, footerY + 88);
  context.fillStyle = "#ef5b36";
  context.font = `700 25px ${font}`;
  context.textAlign = "right";
  context.fillText("playa.intelchen.com", width - padding, footerY + 69);
  context.textAlign = "left";

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create list image")), "image/png");
  });
}

async function buildEventShareAsset(event: EventItem, lang: Lang, selectedDay: number, name: string): Promise<ShareAsset> {
  const shownDay = eventDayIndex(event, selectedDay);
  const locationDetails = getEventLocationDetails(event);
  const when = `${days[shownDay][lang === "en" ? 0 : 1]} ${days[shownDay][2]} · ${event.times[shownDay]}`;
  const trimmedName = name.trim();
  const shareUrl = createSharedEventUrl({
    origin: websiteUrl,
    id: event.uid,
    day: shownDay,
    name: trimmedName,
    lang,
  });
  const sharedBy = trimmedName ? (lang === "en" ? `${trimmedName} shared this with you\n\n` : `${trimmedName} 分享给你\n\n`) : "";
  const description = event.description.trim();
  const caption = lang === "en"
    ? `${sharedBy}✦ ${event.title}\n${when}\n${locationDetails.primary}${locationDetails.secondary ? ` · ${locationDetails.secondary}` : ""}${description ? `\n\n${description}` : ""}\n\nOpen this event: ${shareUrl}\nSource: ${event.link}`
    : `${sharedBy}✦ ${event.title}\n${when}\n${locationDetails.primary}${locationDetails.secondary ? ` · ${locationDetails.secondary}` : ""}${description ? `\n\n${description}` : ""}\n\n打开这场活动：${shareUrl}\n来源：${event.link}`;
  const blob = await createEventShareCard(event, lang, selectedDay, trimmedName);
  const safeTitle = event.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 70) || "event";
  return {
    kind: "event",
    event,
    selectedDay,
    lang,
    name: trimmedName,
    blob,
    url: URL.createObjectURL(blob),
    filename: `playa-2026-${safeTitle}.png`,
    caption,
    shareText: caption,
    title: event.title,
    shareUrl,
  };
}

async function buildPlanShareAsset(events: EventItem[], lang: Lang, name: string, totalEventCount = events.length): Promise<ShareAsset> {
  const sorted = [...events].sort((left, right) => {
    const leftDay = eventDayIndex(left, -1);
    const rightDay = eventDayIndex(right, -1);
    return leftDay - rightDay || left.times[leftDay].localeCompare(right.times[rightDay]) || left.title.localeCompare(right.title);
  });
  const sharedEvents = sorted.slice(0, MAX_SHARED_PLAN_EVENTS);
  const totalCount = Math.max(sorted.length, totalEventCount);
  const omittedEventCount = totalCount - sharedEvents.length;
  const lines = sharedEvents.slice(0, 24).map((event, index) => {
    const shownDay = eventDayIndex(event, -1);
    const locationDetails = getEventLocationDetails(event);
    return `${index + 1}. ${event.title} — ${days[shownDay][lang === "en" ? 0 : 1]} ${days[shownDay][2]} · ${event.times[shownDay]} · ${locationDetails.primary}${locationDetails.secondary ? ` · ${locationDetails.secondary}` : ""}`;
  });
  if (sharedEvents.length > lines.length) lines.push(lang === "en" ? `+ ${sharedEvents.length - lines.length} more shared events` : `另有 ${sharedEvents.length - lines.length} 场已分享活动`);
  const trimmedName = name.trim();
  const planTitle = getPlanShareTitle(trimmedName, lang);
  const shareUrl = createSharedPlanUrl({
    origin: websiteUrl,
    ids: sharedEvents.map((event) => event.uid),
    name: trimmedName,
    lang,
  });
  const shareLimit = omittedEventCount
    ? (lang === "en"
      ? `This share includes the first ${sharedEvents.length} of ${totalCount} saved events.`
      : `此分享包含已收藏活动中的前 ${sharedEvents.length} 场，共 ${totalCount} 场。`)
    : "";
  const shareText = lang === "en"
    ? `✦ ${planTitle} · ${sharedEvents.length} saved events${shareLimit ? `\n${shareLimit}` : ""}\n\n${lines.join("\n")}`
    : `✦ ${planTitle} · 已收藏 ${sharedEvents.length} 场活动${shareLimit ? `\n${shareLimit}` : ""}\n\n${lines.join("\n")}`;
  const caption = lang === "en"
    ? `${shareText}\n\nOpen this Playa: ${shareUrl}`
    : `${shareText}\n\n打开这份 Playa：${shareUrl}`;
  const blob = await createPlanShareCard(sharedEvents, lang, trimmedName, totalCount);
  const safeName = trimmedName.replace(/[\\/:*?"<>|]/g, "").slice(0, 40);
  return {
    kind: "plan",
    events: sharedEvents,
    totalEventCount: totalCount,
    lang,
    name: trimmedName,
    blob,
    url: URL.createObjectURL(blob),
    filename: safeName ? `playa-2026-${safeName}.png` : "playa-2026-my-playa.png",
    caption,
    shareText,
    title: planTitle,
    shareUrl,
  };
}

function MapAppPicker({ appleUrl, googleUrl, lang, className = "" }: { appleUrl: string | null; googleUrl: string | null; lang: Lang; className?: string }) {
  const [open, setOpen] = useState(false);
  const labels = copy[lang];

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (!appleUrl && !googleUrl) return null;

  return (
    <>
      <button type="button" className={`map-picker-trigger ${className}`.trim()} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <MapPin aria-hidden="true" />{labels.viewMap}
      </button>
      {open && createPortal(
        <div className="map-picker-shell" role="dialog" aria-modal="true" aria-labelledby="map-picker-title">
          <button className="map-picker-backdrop" type="button" onClick={() => setOpen(false)} aria-label={labels.close} />
          <section className="map-picker-drawer">
            <div className="map-picker-handle" aria-hidden="true" />
            <div className="map-picker-header">
              <div><p>PLAYA / 2026</p><h2 id="map-picker-title">{labels.chooseMap}</h2></div>
              <button type="button" onClick={() => setOpen(false)} aria-label={labels.close}>×</button>
            </div>
            <div className="map-picker-options">
              {appleUrl && <a href={appleUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}><span className="map-app-icon apple-map-icon"></span><strong>{labels.appleMaps}</strong><span>↗</span></a>}
              {googleUrl && <a href={googleUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}><span className="map-app-icon google-map-icon">G</span><strong>{labels.googleMaps}</strong><span>↗</span></a>}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

function EventCard({ event, lang, day, now, saved, sharing, onSave, onPreview, onShare }: { event: EventItem; lang: Lang; day: number; now: number; saved: boolean; sharing: boolean; onSave: () => void; onPreview: () => void; onShare: () => void }) {
  const category = normalizeCategory(event.category);
  const meta = categoryMeta[category] || categoryMeta.other;
  const shownDay = eventDayIndex(event, day, now);
  const happened = occurrenceHasEnded(event.times[shownDay], shownDay, now);
  const locationDetails = getEventLocationDetails(event);
  const addressProvenance = formatAddressProvenance(event, lang);
  const appleMapUrl = getOfficialCampMapUrl(event.location, "apple");
  const googleMapUrl = getOfficialCampMapUrl(event.location, "google");
  const iBurnUrl = getIBurnEventUrl(event.uid, event.title);

  return (
    <article className={`event-card category-${category} ${happened ? "is-past" : ""}`}>
      <div className="card-body">
        <h3><button className="event-card-title" onClick={onPreview}>{event.title}</button></h3>
        <div className="event-meta">
          <div>
            <span>{days[shownDay][lang === "en" ? 0 : 1]} · {days[shownDay][2]} {happened && <em className="happened-badge">{copy[lang].happened}</em>}</span>
            <strong>{event.times[shownDay]}</strong>
          </div>
          <div>
            <span>{copy[lang].location}</span>
            <strong>{locationDetails.primary}</strong>
            {locationDetails.secondary && <small>{locationDetails.secondary}</small>}
            {addressProvenance && <small className="location-provenance">{addressProvenance}</small>}
          </div>
        </div>
        <p className="event-description">{event.description}</p>
        {event.tags.length > 0 && <div className="event-tags" aria-label={lang === "en" ? "Tags" : "标签"}>{event.tags.slice(0, 4).map((tag) => <span key={tag}>{tag.replaceAll("_", " ")}</span>)}</div>}
        <div className="card-footer">
          <div className="card-footer-copy">
            <div className="event-links">
              <a href={event.link} target="_blank" rel="noreferrer">{copy[lang].open} ↗</a>
              <MapAppPicker appleUrl={appleMapUrl} googleUrl={googleMapUrl} lang={lang} className="location-link" />
              {iBurnUrl && <a className="location-link" href={iBurnUrl} target="_blank" rel="noopener noreferrer">{copy[lang].iburn} ↗</a>}
            </div>
            <span>
              <em>{lang === "en" ? meta.en : meta.zh}</em>
              {!locationDetails.campInLocation && event.camp !== "-" ? event.camp : null}
            </span>
          </div>
          <div className="card-actions">
            <button className="share-button" onClick={onShare} aria-label={sharing ? copy[lang].generating : copy[lang].share} disabled={sharing}>{sharing ? "…" : <Share2 aria-hidden="true" />}</button>
            <button className={`save-button ${saved ? "is-saved" : ""}`} onClick={onSave} aria-label={saved ? copy[lang].remove : copy[lang].save}>
              {saved ? "★" : "☆"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [languageReady, setLanguageReady] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [day, setDay] = useState(-1);
  const [clockNow, setClockNow] = useState(eventClockEpoch);
  const [limit, setLimit] = useState(36);
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [sharedPlan, setSharedPlan] = useState<SharedPlanPayload | null>(null);
  const [sharedEvent, setSharedEvent] = useState<SharedEventPayload | null>(null);
  const [eventPreview, setEventPreview] = useState<EventPreviewState | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [agentCopied, setAgentCopied] = useState(false);
  const [sharingUid, setSharingUid] = useState<string | null>(null);
  const [sharingPlan, setSharingPlan] = useState(false);
  const [shareName, setShareName] = useState("");
  const [personalizingShare, setPersonalizingShare] = useState(false);
  const [shareAsset, setShareAsset] = useState<ShareAsset | null>(null);
  const [captionCopied, setCaptionCopied] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const planDrawerRef = useRef<HTMLElement>(null);
  const eventReaderRef = useRef<HTMLElement>(null);
  const shareDialogRef = useRef<HTMLElement>(null);
  const dialogRestoreFocusRef = useRef<HTMLElement | null>(null);
  const t = copy[lang];
  const activeDialog = shareAsset ? "share" : eventPreview ? "event" : planOpen ? "plan" : null;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("playa-saved");
      if (stored) setSaved(new Set(JSON.parse(stored)));
    } catch {
      // Invalid or unavailable browser storage should not block the guide.
    }

    const incomingPlan = parseSharedPlanUrl(window.location.href);
    if (incomingPlan) {
      document.documentElement.dataset.playaReturning = "true";
      setSharedPlan(incomingPlan);
      setLang(incomingPlan.lang);
      setPlanOpen(true);
      setLanguageReady(true);
      return;
    }

    const incomingEvent = parseSharedEventUrl(window.location.href);
    if (incomingEvent) {
      document.documentElement.dataset.playaReturning = "true";
      setSharedEvent(incomingEvent);
      setLang(incomingEvent.lang);
      setLanguageReady(true);
      return;
    }

    try {
      const storedLanguage = window.localStorage.getItem(languageStorageKey);
      if (storedLanguage === "en" || storedLanguage === "zh") setLang(storedLanguage);
    } catch {
      // Invalid or unavailable browser storage should not block the guide.
    }
    setLanguageReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  useEffect(() => {
    if (!languageReady) return;
    try {
      window.localStorage.setItem(languageStorageKey, lang);
    } catch {
      // Invalid or unavailable browser storage should not block the guide.
    }
  }, [lang, languageReady]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setClockNow(Date.now()));
    const clock = window.setInterval(() => setClockNow(Date.now()), minuteMs);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    if (!languageReady) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/events?lang=${lang}`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load events");
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setEvents(data.events);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [lang, languageReady]);

  useEffect(() => {
    if (!sharedEvent || loading) return;
    const event = events.find((candidate) => candidate.uid === sharedEvent.id);
    if (!event) {
      setSharedEvent(null);
      return;
    }

    setEventPreview({ event, selectedDay: sharedEvent.day, sharedBy: sharedEvent.name });
    setSharedEvent(null);
  }, [events, loading, sharedEvent]);

  useEffect(() => setLimit(36), [query, category, day, savedOnly, lang]);

  useEffect(() => {
    if (!planOpen && !shareAsset && !eventPreview) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [eventPreview, planOpen, shareAsset]);

  useEffect(() => {
    const dialog = activeDialog === "share"
      ? shareDialogRef.current
      : activeDialog === "event"
        ? eventReaderRef.current
        : activeDialog === "plan"
          ? planDrawerRef.current
          : null;

    if (!dialog) {
      dialogRestoreFocusRef.current?.focus();
      dialogRestoreFocusRef.current = null;
      return;
    }

    const focused = document.activeElement;
    if (!dialogRestoreFocusRef.current && focused instanceof HTMLElement && focused !== document.body) {
      dialogRestoreFocusRef.current = focused;
    }

    const getFocusable = () => [...dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element.getClientRects().length > 0);
    const frame = window.requestAnimationFrame(() => {
      const initial = dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]");
      (initial || getFocusable()[0] || dialog).focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (activeDialog === "share") closeShare();
        else if (activeDialog === "event") setEventPreview(null);
        else closePlan();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeDialog]);

  useEffect(() => {
    if (!shareAsset || shareAsset.name === shareName.trim()) return;
    const sourceAsset = shareAsset;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const nextAsset = sourceAsset.kind === "event"
          ? await buildEventShareAsset(sourceAsset.event, sourceAsset.lang, sourceAsset.selectedDay, shareName)
          : await buildPlanShareAsset(sourceAsset.events, sourceAsset.lang, shareName, sourceAsset.totalEventCount);
        if (cancelled) {
          URL.revokeObjectURL(nextAsset.url);
          return;
        }
        setShareAsset((current) => {
          if (current !== sourceAsset) {
            URL.revokeObjectURL(nextAsset.url);
            return current;
          }
          URL.revokeObjectURL(current.url);
          return nextAsset;
        });
        setPersonalizingShare(false);
      } catch {
        if (!cancelled) setPersonalizingShare(false);
      }
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [shareAsset, shareName]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: 0 };
    for (const event of events) {
      const matchesTime = day < 0
        ? eventHasUpcomingOccurrence(event, clockNow)
        : Boolean(event.times[day] && event.times[day] !== "-");
      if (!matchesTime) continue;
      result.all += 1;
      const key = normalizeCategory(event.category);
      result[key] = (result[key] || 0) + 1;
    }
    return result;
  }, [events, day, clockNow]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return events.filter((event) => {
      const eventCategory = normalizeCategory(event.category);
      const matchesQuery = !needle || [event.title, event.description, event.camp, event.where, event.extra, ...event.tags.map((tag) => tag.replaceAll("_", " "))].join(" ").toLocaleLowerCase().includes(needle);
      const matchesCategory = category === "all" || eventCategory === category;
      const matchesDay = day < 0
        ? eventHasUpcomingOccurrence(event, clockNow)
        : Boolean(event.times[day] && event.times[day] !== "-");
      const matchesSaved = !savedOnly || saved.has(event.uid);
      return matchesQuery && matchesCategory && matchesDay && matchesSaved;
    });
  }, [events, query, category, day, savedOnly, saved, clockNow]);

  const savedEvents = useMemo(() => events.filter((event) => saved.has(event.uid)), [events, saved]);
  const sharedPlanEvents = useMemo(() => {
    if (!sharedPlan) return [];
    const eventsById = new Map(events.map((event) => [event.uid, event]));
    return sharedPlan.ids.map((id) => eventsById.get(id)).filter((event): event is EventItem => Boolean(event));
  }, [events, sharedPlan]);
  const activePlanEvents = sharedPlan ? sharedPlanEvents : savedEvents;
  const activePlanTitle = sharedPlan
    ? (sharedPlan.name ? getPlanShareTitle(sharedPlan.name, lang) : t.sharedPlaya)
    : t.myPlaya;
  const activePlanCount = sharedPlan && loading ? sharedPlan.ids.length : activePlanEvents.length;
  const sharedPlanIsSaved = Boolean(sharedPlan && sharedPlanEvents.length && sharedPlanEvents.every((event) => saved.has(event.uid)));
  const hasOnlyStaleSavedEvents = !sharedPlan && saved.size > 0 && savedEvents.length === 0;

  useEffect(() => {
    const defaultTitle = "Playa 2026 — Burning Man Event Guide";
    if (eventPreview && eventPreview.sharedBy !== null) {
      const previewDay = eventDayIndex(eventPreview.event, eventPreview.selectedDay, clockNow);
      const location = getEventLocationDetails(eventPreview.event);
      document.title = buildSharedEventMetadata({
        eventTitle: eventPreview.event.title,
        eventDescription: eventPreview.event.description,
        when: `${days[previewDay][lang === "en" ? 0 : 1]} ${days[previewDay][2]} · ${eventPreview.event.times[previewDay]}`,
        location: [location.primary, location.secondary].filter(Boolean).join(" · "),
        name: eventPreview.sharedBy,
        lang,
      }).title;
      return () => { document.title = defaultTitle; };
    }
    if (sharedPlan) {
      document.title = buildSharedPlanMetadata({
        eventTitles: activePlanEvents.map((event) => event.title),
        eventCount: activePlanCount,
        name: sharedPlan.name,
        lang,
      }).title;
      return () => { document.title = defaultTitle; };
    }
    document.title = defaultTitle;
  }, [activePlanCount, activePlanEvents, clockNow, eventPreview, lang, sharedPlan]);

  useEffect(() => {
    if (limit >= filtered.length) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    if (!("IntersectionObserver" in window)) {
      setLimit(filtered.length);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setLimit((current) => Math.min(current + 36, filtered.length));
    }, { rootMargin: "700px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [limit, filtered.length]);

  function toggleSaved(uid: string) {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      window.localStorage.setItem("playa-saved", JSON.stringify([...next]));
      return next;
    });
  }

  function openMyPlaya() {
    setSharedPlan(null);
    setPlanOpen(true);
  }

  function closePlan() {
    setPlanOpen(false);
    setSharedPlan(null);
  }

  function saveSharedPlan() {
    if (!sharedPlanEvents.length) return;
    setSaved((current) => {
      const next = new Set(current);
      for (const event of sharedPlanEvents) next.add(event.uid);
      window.localStorage.setItem("playa-saved", JSON.stringify([...next]));
      return next;
    });
  }

  function resetFilters() {
    setQuery("");
    setCategory("all");
    setDay(-1);
    setSavedOnly(false);
  }

  function enterPlaya() {
    try {
      window.localStorage.setItem("playa-entered", "1");
    } catch {
      // Onboarding still works when browser storage is unavailable.
    }
    document.documentElement.dataset.playaReturning = "true";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function copyPlan() {
    const list = activePlanEvents.map((event, index) => {
      const eventDay = event.times.findIndex((time) => time && time !== "-");
      const when = eventDay >= 0 ? `${days[eventDay][lang === "en" ? 0 : 1]} ${days[eventDay][2]} · ${event.times[eventDay]}` : "";
      return `${index + 1}. ${event.title}\n${when} · ${event.where !== "-" ? event.where : event.camp}\n${event.link}`;
    }).join("\n\n");
    await copyToClipboard(list);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function copyAgentContext() {
    await copyToClipboard(createAgentContext({ lang, query, category, day, savedEvents, now: clockNow }));
    setAgentCopied(true);
    window.setTimeout(() => setAgentCopied(false), 1800);
  }

  function clearSaved() {
    setSaved(new Set());
    window.localStorage.setItem("playa-saved", "[]");
  }

  function closeShare() {
    setShareAsset((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    setCaptionCopied(false);
    setPersonalizingShare(false);
  }

  function previewEvent(event: EventItem, selectedDay = day, sharedBy: string | null = null) {
    setEventPreview({ event, selectedDay, sharedBy });
  }

  async function shareEvent(event: EventItem, selectedDay = day) {
    if (sharingUid) return;
    setSharingUid(event.uid);
    setPersonalizingShare(false);
    try {
      setShareAsset(await buildEventShareAsset(event, lang, selectedDay, shareName));
    } finally {
      setSharingUid(null);
    }
  }

  async function sharePlanImage() {
    if (sharingPlan || !activePlanEvents.length) return;
    setSharingPlan(true);
    setPersonalizingShare(false);
    try {
      setShareAsset(await buildPlanShareAsset(activePlanEvents, lang, shareName));
    } finally {
      setSharingPlan(false);
    }
  }

  async function copyShareCaption() {
    if (!shareAsset) return;
    await copyToClipboard(shareAsset.caption);
    setCaptionCopied(true);
    window.setTimeout(() => setCaptionCopied(false), 1600);
  }

  async function shareFallbackAsset() {
    if (!shareAsset) return;
    try {
      const file = new File([shareAsset.blob], shareAsset.filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: shareAsset.title,
          text: shareAsset.shareText,
          url: shareAsset.shareUrl,
        });
      } else if (navigator.share) {
        await navigator.share({
          title: shareAsset.title,
          text: shareAsset.shareText,
          url: shareAsset.shareUrl,
        });
      } else {
        downloadShareAsset(shareAsset);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) downloadShareAsset(shareAsset);
    }
  }

  const previewDay = eventPreview ? eventDayIndex(eventPreview.event, eventPreview.selectedDay, clockNow) : 0;
  const previewLocation = eventPreview ? getEventLocationDetails(eventPreview.event) : null;
  const previewAppleMapUrl = eventPreview ? getOfficialCampMapUrl(eventPreview.event.location, "apple") : null;
  const previewGoogleMapUrl = eventPreview ? getOfficialCampMapUrl(eventPreview.event.location, "google") : null;
  const previewIBurnUrl = eventPreview ? getIBurnEventUrl(eventPreview.event.uid, eventPreview.event.title) : null;
  const previewCategory = eventPreview ? normalizeCategory(eventPreview.event.category) : "other";
  const previewMeta = categoryMeta[previewCategory] || categoryMeta.other;

  return (
    <main>
      <p className="sr-only" role="status" aria-live="polite">{agentCopied ? t.agentCopied : ""}</p>
      <nav className="site-nav">
        <a href="#top" className="wordmark" aria-label="Playa 2026 home">
          <span className="wordmark-symbol">P</span>
          <span><strong>{t.navTitle}</strong><small>{t.navSub}</small></span>
        </a>
        <div className="nav-actions">
          <label className="nav-search">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} />
          </label>
          <button className="saved-nav" onClick={openMyPlaya}>★ {saved.size}</button>
          <button className="language-toggle" onClick={() => setLang(lang === "en" ? "zh" : "en")} aria-label="Switch language">
            <span className={lang === "en" ? "active" : ""}>EN</span><span className={lang === "zh" ? "active" : ""}>中</span>
          </button>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="sun-disc" aria-hidden="true" />
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-content">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1><span>{t.heroA}</span><span>{t.heroB}</span></h1>
          <p className="hero-intro">{t.intro}</p>
          <div className="hero-entry-actions">
            <button className="hero-cta" onClick={enterPlaya}>{t.makeMyList}</button>
            <button className={`agent-copy-cta agent-copy-hero ${agentCopied ? "is-copied" : ""}`} onClick={copyAgentContext} aria-label={agentCopied ? t.agentCopied : t.copyToAgent}>
              {agentCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              <span>{agentCopied ? t.agentCopied : t.copyToAgent}</span>
            </button>
            <div className="source-stamp"><span />{t.updated}</div>
          </div>
          <dl className="stats">
            <div><dt>{loading ? "—" : events.length.toLocaleString()}</dt><dd>{t.events}</dd></div>
            <div><dt>09</dt><dd>{t.days}</dd></div>
            <div><dt>{String(categoryOrder.length - 1).padStart(2, "0")}</dt><dd>{t.languages}</dd></div>
            <div><dt>{String(saved.size).padStart(2, "0")}</dt><dd>{t.saved}</dd></div>
          </dl>
        </div>
        <div className="hero-note" aria-hidden="true"><span>BLACK ROCK CITY</span><strong>40°47′ N<br />119°12′ W</strong></div>
        <div className="horizon" aria-hidden="true"><span /><i /><b /></div>
      </header>

      <div className="app-experience">
      <section className="directory" id="events">
        <div className="section-heading">
          <div><p>{t.exploreSub}</p><h2>{t.explore}</h2></div>
          <div className="directory-actions">
            <div className="saved-actions">
              <button className="open-plan" onClick={openMyPlaya}>★ {t.myPlaya} <span>{saved.size}</span></button>
              <button className={`saved-filter ${savedOnly ? "active" : ""}`} onClick={() => setSavedOnly(!savedOnly)} aria-pressed={savedOnly}>{t.savedOnly}</button>
            </div>
            <button className={`agent-copy-cta agent-copy-directory ${agentCopied ? "is-copied" : ""}`} onClick={copyAgentContext} aria-label={agentCopied ? t.agentCopied : t.copyToAgent}>
              {agentCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              <span>{agentCopied ? t.agentCopied : t.copyToAgent}</span>
            </button>
          </div>
        </div>

        <div className="filter-stack">
          <div className="day-strip" role="group" aria-label="Filter by day">
            <button className={day === -1 ? "active" : ""} onClick={() => setDay(-1)}><strong>{t.allDays}</strong><small>8.30 — 9.07</small></button>
            {days.map((item, index) => {
              const status = eventDayStatus(index, clockNow);
              return (
                <button key={item[2]} className={`${day === index ? "active" : ""} ${status}`} onClick={() => setDay(index)}>
                  <strong>{item[lang === "en" ? 0 : 1]}</strong><small>{item[2]} {status === "past" && <em>{t.pastShort}</em>}</small>
                </button>
              );
            })}
          </div>

          <div className="filter-row">
            {categoryOrder.map((key) => {
              const meta = categoryMeta[key];
              return (
                <button key={key} className={category === key ? "active" : ""} onClick={() => setCategory(key)}>
                  <span>{meta.emoji}</span>{lang === "en" ? meta.en : meta.zh}<em>{counts[key] || 0}</em>
                </button>
              );
            })}
          </div>

          <div className="mobile-search">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} />
          </div>
        </div>

        <div className="results-line"><span>{t.showing} <strong>{filtered.length.toLocaleString()}</strong> {t.matches}</span><i /><em>{t.brcTime} · {getBrcClock(clockNow).label}</em></div>

        {loading ? (
          <div className="loading-grid" aria-label="Loading events">{Array.from({ length: 6 }).map((_, index) => <div key={index} />)}</div>
        ) : error ? (
          <div className="empty-state"><span>!</span><p>{lang === "en" ? "The event source is taking a dust break. Please refresh in a moment." : "活动来源暂时走进了尘暴，请稍后刷新。"}</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><span>✦</span><p>{t.empty}</p><button onClick={resetFilters}>{t.reset}</button></div>
        ) : (
          <>
            <div className="event-grid desktop-event-grid">
              {filtered.slice(0, limit).map((event) => <EventCard key={event.uid} event={event} lang={lang} day={day} now={clockNow} saved={saved.has(event.uid)} sharing={sharingUid === event.uid} onSave={() => toggleSaved(event.uid)} onPreview={() => previewEvent(event)} onShare={() => shareEvent(event)} />)}
            </div>
            <div className="mobile-event-grid">
              {[0, 1].map((column) => (
                <div className="mobile-event-column" key={column}>
                  {filtered.slice(0, limit).filter((_, index) => index % 2 === column).map((event) => <EventCard key={event.uid} event={event} lang={lang} day={day} now={clockNow} saved={saved.has(event.uid)} sharing={sharingUid === event.uid} onSave={() => toggleSaved(event.uid)} onPreview={() => previewEvent(event)} onShare={() => shareEvent(event)} />)}
                </div>
              ))}
            </div>
            {limit < filtered.length && <div ref={loadMoreRef} className="load-more-sentinel" role="status" aria-label={t.loadingMore}><span aria-hidden="true" /></div>}
          </>
        )}
      </section>

      <footer>
        <div className="footer-star">✦</div>
        <div><h2>{t.footerTitle}</h2><p>{t.footerCopy}</p></div>
        <a href={sourceListLinks[lang]} target="_blank" rel="noreferrer">{t.source} ↗</a>
      </footer>

      {saved.size > 0 && !planOpen && (
        <button className="plan-dock" onClick={openMyPlaya}>
          <span>★</span><strong>{t.myPlaya}</strong><em>{saved.size}</em>
        </button>
      )}

      <div className={`plan-shell ${planOpen ? "open" : ""}`} aria-hidden={!planOpen}>
        <button className="plan-backdrop" type="button" tabIndex={-1} aria-label={t.close} onClick={closePlan} />
        <aside ref={planDrawerRef} tabIndex={-1} className={`plan-drawer ${sharedPlan ? "is-shared" : ""}`} role="dialog" aria-modal="true" aria-label={activePlanTitle}>
          <div className="plan-header">
            <div><p>{sharedPlan ? t.sharedPlanHint : t.planHint}</p><h2>{activePlanTitle} <span>{activePlanCount}</span></h2></div>
            <button data-dialog-initial-focus onClick={closePlan} aria-label={t.close}>×</button>
          </div>
          <div className="plan-calendar">
            {activePlanEvents.length === 0 ? (
              <div className="plan-empty"><span>{sharedPlan ? "✦" : "☆"}</span><p>{sharedPlan ? (loading ? t.loadingMore : t.sharedPlanEmpty) : (hasOnlyStaleSavedEvents ? t.savedEventsUnavailable : t.planEmpty)}</p></div>
            ) : days.map((calendarDay, dayIndex) => {
              const dayEvents = activePlanEvents.filter((event) => event.times[dayIndex] && event.times[dayIndex] !== "-");
              return (
                <section className={`calendar-day ${eventDayStatus(dayIndex, clockNow)}`} key={calendarDay[2]}>
                  <header><strong>{calendarDay[lang === "en" ? 0 : 1]}</strong><span>{calendarDay[2]}</span><em>{dayEvents.length}</em></header>
                  <div className="calendar-events">
                    {dayEvents.length === 0 ? <p className="calendar-blank">—</p> : dayEvents.map((event) => (
                      <article
                        key={`${event.uid}-${dayIndex}`}
                        className={`calendar-event category-${normalizeCategory(event.category)} ${occurrenceHasEnded(event.times[dayIndex], dayIndex, clockNow) ? "is-past" : ""}`}
                      >
                        <div className="calendar-event-top"><span>{categoryMeta[normalizeCategory(event.category)]?.emoji || "🌀"} {event.times[dayIndex]}</span>{!sharedPlan && <button onClick={() => toggleSaved(event.uid)} aria-label={t.remove}>×</button>}</div>
                        <h3><button className="calendar-event-details" onClick={() => previewEvent(event, dayIndex, sharedPlan ? sharedPlan.name : null)}>{event.title}</button></h3>
                        <p>{event.where !== "-" ? event.where : event.camp}</p>
                        <a href={event.link} target="_blank" rel="noreferrer" aria-label={`${t.open}: ${event.title}`}>↗</a>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="plan-footer">
            {sharedPlan ? (
              <>
                <button className="copy-plan" onClick={copyPlan} disabled={!activePlanEvents.length}>{copied ? t.copied : t.copyList}</button>
                <div className="plan-footer-actions">
                  <button className="share-plan" onClick={sharePlanImage} disabled={!activePlanEvents.length || sharingPlan}>{sharingPlan ? t.generatingPlan : <><Share2 aria-hidden="true" />{t.sharePlan}</>}</button>
                  <button className={`save-shared-plan ${sharedPlanIsSaved ? "is-saved" : ""}`} onClick={saveSharedPlan} disabled={!activePlanEvents.length || sharedPlanIsSaved}>{sharedPlanIsSaved ? <><Check aria-hidden="true" />{t.sharedPlanSaved}</> : t.saveSharedPlan}</button>
                </div>
              </>
            ) : (
              <>
                <button onClick={clearSaved} disabled={!saved.size}>{t.clearAll}</button>
                <div className="plan-footer-actions">
                  <button className="share-plan" onClick={sharePlanImage} disabled={!savedEvents.length || sharingPlan}>{sharingPlan ? t.generatingPlan : <><Share2 aria-hidden="true" />{t.sharePlan}</>}</button>
                  <button className="copy-plan" onClick={copyPlan} disabled={!savedEvents.length}>{copied ? t.copied : t.copyList}</button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {eventPreview && previewLocation && (
        <div className="event-reader-modal">
          <button className="modal-backdrop" type="button" tabIndex={-1} onClick={() => setEventPreview(null)} aria-label={t.close} />
          <article ref={eventReaderRef} tabIndex={-1} className={`event-reader category-${previewCategory}`} role="dialog" aria-modal="true" aria-labelledby="event-reader-title">
            <button data-dialog-initial-focus className="event-reader-close" onClick={() => setEventPreview(null)} aria-label={t.close}>×</button>
            <p className="event-reader-kicker">PLAYA / 2026 · {lang === "en" ? previewMeta.en : previewMeta.zh}</p>
            <h2>{getEventPreviewHeading(eventPreview.sharedBy, lang)}</h2>
            <div className="event-reader-mark" aria-hidden="true">{previewMeta.emoji}</div>
            <h3 id="event-reader-title">{eventPreview.event.title}</h3>

            <dl className="event-reader-facts">
              <div>
                <dt>{lang === "en" ? "When" : "时间"}</dt>
                <dd>{days[previewDay][lang === "en" ? 0 : 1]} · {days[previewDay][2]}<strong>{eventPreview.event.times[previewDay]}</strong></dd>
              </div>
              <div>
                <dt>{t.location}</dt>
                <dd>{previewLocation.primary}{previewLocation.secondary && <small>{previewLocation.secondary}</small>}</dd>
              </div>
            </dl>

            <section className="event-reader-about">
              <h4>{t.aboutEvent}</h4>
              <p>{eventPreview.event.description || "—"}</p>
              {eventPreview.event.tags.length > 0 && <div className="event-tags event-reader-tags" aria-label={lang === "en" ? "Tags" : "标签"}>{eventPreview.event.tags.map((tag) => <span key={tag}>{tag.replaceAll("_", " ")}</span>)}</div>}
            </section>

            <div className="event-reader-links">
              <a href={eventPreview.event.link} target="_blank" rel="noreferrer">{t.open} ↗</a>
              <MapAppPicker appleUrl={previewAppleMapUrl} googleUrl={previewGoogleMapUrl} lang={lang} />
              {previewIBurnUrl && <a href={previewIBurnUrl} target="_blank" rel="noopener noreferrer">{t.iburn} ↗</a>}
            </div>

            <div className="event-reader-actions">
              <button className={`event-reader-save ${saved.has(eventPreview.event.uid) ? "is-saved" : ""}`} onClick={() => toggleSaved(eventPreview.event.uid)} disabled={saved.has(eventPreview.event.uid)}>
                {saved.has(eventPreview.event.uid) ? <><Check aria-hidden="true" />{t.savedToMyPlaya}</> : <>☆ {t.saveToMyPlaya}</>}
              </button>
              <button className="event-reader-share" onClick={() => shareEvent(eventPreview.event, previewDay)} disabled={sharingUid === eventPreview.event.uid}>
                <Share2 aria-hidden="true" />{sharingUid === eventPreview.event.uid ? t.generating : t.share}
              </button>
            </div>
          </article>
        </div>
      )}

      {shareAsset && (
        <div className="share-modal">
          <button className="modal-backdrop" type="button" tabIndex={-1} onClick={closeShare} aria-label={t.close} />
          <section ref={shareDialogRef} tabIndex={-1} className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
            <button data-dialog-initial-focus className="share-close" onClick={closeShare} aria-label={t.close}>×</button>
            <p className="share-kicker">PLAYA / 2026</p>
            <h2 id="share-title">{shareAsset.kind === "plan" ? shareAsset.title : t.shareTitle}</h2>
            <p className="share-hint">{t.shareHint}</p>
            {shareAsset.kind === "plan" && shareAsset.totalEventCount > shareAsset.events.length && (
              <p className="share-limit-note">{formatShareLimit(t.shareLimited, shareAsset.events.length, shareAsset.totalEventCount)}</p>
            )}
            <label className="share-name" htmlFor="share-name">
              <span>{t.shareName}{personalizingShare && <em>{t.updatingShare}</em>}</span>
              <input
                id="share-name"
                value={shareName}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setShareName(nextName);
                  setPersonalizingShare(nextName.trim() !== shareAsset.name);
                }}
                placeholder={t.shareNamePlaceholder}
                maxLength={32}
              />
            </label>
            {/* Blob URLs are generated in-browser and cannot use Next image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={`share-preview ${personalizingShare ? "is-updating" : ""}`} src={shareAsset.url} alt={`${shareAsset.title} share card`} />
            {shareAsset.kind === "event" && (
              <div className="share-event-description">
                <span>{t.aboutEvent}</span>
                <p>{shareAsset.event.description || "—"}</p>
              </div>
            )}
            <textarea className="share-caption" value={shareAsset.caption} readOnly aria-label={t.copyCaption} />
            <div className="share-primary-actions">
              <button className="share-native" onClick={shareFallbackAsset} disabled={personalizingShare}><Share2 aria-hidden="true" />{t.shareNow}</button>
              <a className="share-download" href={shareAsset.url} download={shareAsset.filename}>↓ {t.saveImage}</a>
            </div>
            <button className="share-copy" onClick={copyShareCaption}>{captionCopied ? `${t.captionCopied} ✓` : t.copyCaption}</button>
          </section>
        </div>
      )}
      </div>
    </main>
  );
}
