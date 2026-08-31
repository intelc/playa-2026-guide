"use client";

import { useEffect, useMemo, useState } from "react";
import { Share2 } from "lucide-react";

type Lang = "en" | "zh";

type EventItem = {
  uid: string;
  title: string;
  description: string;
  type: string;
  camp: string;
  where: string;
  extra: string;
  link: string;
  times: string[];
};

type ShareAsset = {
  kind: "event" | "plan";
  url: string;
  filename: string;
  caption: string;
  title: string;
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

const categoryOrder = ["all", "prty", "arts", "work", "food", "tea", "adlt", "kid", "othr"];

const categoryMeta: Record<string, { en: string; zh: string; mark: string }> = {
  all: { en: "All events", zh: "全部活动", mark: "✦" },
  prty: { en: "Party", zh: "派对", mark: "◉" },
  arts: { en: "Art", zh: "艺术", mark: "◆" },
  work: { en: "Workshop", zh: "工作坊", mark: "△" },
  food: { en: "Food", zh: "美食", mark: "●" },
  tea: { en: "Drinks", zh: "茶饮", mark: "◒" },
  adlt: { en: "Adult", zh: "成人", mark: "◇" },
  kid: { en: "Kids", zh: "亲子", mark: "○" },
  othr: { en: "Other", zh: "其他", mark: "✳" },
};

const copy = {
  en: {
    navTitle: "PLAYA / 2026",
    navSub: "Black Rock City field guide",
    search: "Search events, camps, or locations…",
    eyebrow: "COMMUNITY-CURATED · 3,744 MOMENTS IN THE DUST",
    heroA: "FIND YOUR",
    heroB: "NEXT WONDER.",
    intro:
      "Nine days. Thousands of invitations. One clean guide for following the strange, generous pulse of Black Rock City.",
    updated: "Source updated Aug 27, 2026",
    events: "events",
    days: "days",
    languages: "categories",
    saved: "saved",
    myPlaya: "My Playa",
    planHint: "Your saved events, arranged across the week. Stored only in this browser.",
    planEmpty: "Star any event to start building your personal playa list.",
    copyList: "Copy list",
    copied: "Copied",
    clearAll: "Clear all",
    close: "Close",
    explore: "Explore the week",
    exploreSub: "Filter the dust. Keep the magic.",
    allDays: "ALL DAYS",
    showing: "Showing",
    matches: "matches",
    empty: "No events found in this corner of the playa.",
    reset: "Reset filters",
    loadMore: "Show more",
    open: "Event details",
    location: "Location",
    savedOnly: "Saved only",
    save: "Save event",
    remove: "Remove saved event",
    share: "Share event",
    shareTitle: "Share this event",
    shareHint: "Use your phone’s share sheet to save the card to Photos or send it to friends.",
    shareNow: "Share card",
    saveImage: "Save image",
    copyCaption: "Copy caption",
    captionCopied: "Copied",
    generating: "Generating share card",
    sharePlan: "Share image",
    sharePlanTitle: "Share My Playa",
    generatingPlan: "Generating…",
    footerTitle: "Built for serendipity, not certainty.",
    footerCopy: "Times and locations can shift on playa. Follow the link for the latest source details — then stay open to the detour.",
    source: "Original event list",
  },
  zh: {
    navTitle: "PLAYA / 2026",
    navSub: "双语沙漠活动指南",
    search: "搜索活动、营地或地点……",
    eyebrow: "社群整理 · 3,744 个沙漠时刻",
    heroA: "去遇见",
    heroB: "下一场奇迹。",
    intro: "九天，数千封邀请，一份清晰的双语指南。跟随黑石城奇异、慷慨的脉搏，在尘土里找到属于你的下一站。",
    updated: "来源更新于 2026 年 8 月 27 日",
    events: "活动",
    days: "天",
    languages: "分类",
    saved: "已收藏",
    myPlaya: "我的 Playa",
    planHint: "收藏的活动按日期排好，只保存在此浏览器中。",
    planEmpty: "收藏任意活动，开始制作你的个人 Playa 清单。",
    copyList: "复制清单",
    copied: "已复制",
    clearAll: "清空",
    close: "关闭",
    explore: "探索这一周",
    exploreSub: "筛掉尘埃，留下惊喜。",
    allDays: "全部日期",
    showing: "当前显示",
    matches: "个结果",
    empty: "这片 playa 暂时没有匹配的活动。",
    reset: "重置筛选",
    loadMore: "显示更多",
    open: "查看详情",
    location: "地点",
    savedOnly: "只看收藏",
    save: "收藏活动",
    remove: "取消收藏",
    share: "分享活动",
    shareTitle: "分享这场活动",
    shareHint: "通过手机分享菜单保存到相册，或直接发送给朋友。",
    shareNow: "分享卡片",
    saveImage: "保存到相册",
    copyCaption: "复制文案",
    captionCopied: "已复制",
    generating: "正在生成分享卡片",
    sharePlan: "分享图片",
    sharePlanTitle: "分享我的 Playa",
    generatingPlan: "生成中……",
    footerTitle: "为偶遇而做，不为确定而生。",
    footerCopy: "Playa 上的时间和地点可能随时变化。出发前可通过原始链接确认——也别忘了给意外留一点空间。",
    source: "原始活动清单",
  },
};

function normalizeCategory(type: string) {
  const key = type.toLowerCase();
  if (key === "art" || key === "arts" || type === "艺术") return "arts";
  if (type === "派对") return "prty";
  if (type === "工作") return "work";
  if (type === "食物") return "food";
  if (type === "茶") return "tea";
  if (type === "成人") return "adlt";
  if (type === "孩子") return "kid";
  if (type === "其他") return "othr";
  return key;
}

const categoryColors: Record<string, string> = {
  prty: "#6856c4",
  arts: "#e85a39",
  work: "#7b9d68",
  food: "#df9e36",
  tea: "#69a4a6",
  adlt: "#a04a6f",
  kid: "#c87cad",
  othr: "#87909a",
};

function eventDayIndex(event: EventItem, selectedDay: number) {
  if (selectedDay >= 0 && event.times[selectedDay] && event.times[selectedDay] !== "-") return selectedDay;
  const first = event.times.findIndex((time) => time && time !== "-");
  return first >= 0 ? first : 0;
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

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {}
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

async function createEventShareCard(event: EventItem, lang: Lang, selectedDay: number) {
  const width = 1080;
  const height = 1350;
  const padding = 76;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");

  const category = normalizeCategory(event.type);
  const meta = categoryMeta[category] || categoryMeta.othr;
  const accent = categoryColors[category] || categoryColors.othr;
  const shownDay = eventDayIndex(event, selectedDay);
  const location = event.where !== "-" ? event.where : event.camp;
  const font = lang === "zh" ? '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif' : 'system-ui, -apple-system, "Segoe UI", sans-serif';

  context.fillStyle = "#f4efe5";
  context.fillRect(0, 0, width, height);
  context.fillStyle = accent;
  context.fillRect(0, 0, width, 430);

  context.save();
  context.globalAlpha = 0.18;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 2;
  for (let x = 0; x <= width; x += 54) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 430); context.stroke();
  }
  for (let y = 0; y <= 430; y += 54) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }
  context.restore();

  const sun = context.createLinearGradient(650, 60, 1040, 390);
  sun.addColorStop(0, "#ffd28a");
  sun.addColorStop(1, "#ef5b36");
  context.fillStyle = sun;
  context.beginPath(); context.arc(850, 215, 235, 0, Math.PI * 2); context.fill();
  context.save();
  context.translate(210, 238); context.rotate(-0.28);
  context.strokeStyle = "rgba(255,255,255,.82)"; context.lineWidth = 4;
  context.beginPath(); context.ellipse(0, 0, 150, 56, 0, 0, Math.PI * 2); context.stroke();
  context.restore();

  context.fillStyle = "rgba(23,23,19,.72)";
  context.beginPath(); context.roundRect(padding, 48, 246, 52, 26); context.fill();
  context.fillStyle = "#ffffff";
  context.font = `700 25px ${font}`;
  context.textBaseline = "middle";
  context.fillText("PLAYA / 2026", padding + 22, 75);

  const categoryLabel = lang === "en" ? meta.en.toUpperCase() : meta.zh;
  context.font = `700 24px ${font}`;
  const categoryWidth = context.measureText(categoryLabel).width + 44;
  context.fillStyle = "rgba(23,23,19,.72)";
  context.beginPath(); context.roundRect(width - padding - categoryWidth, 48, categoryWidth, 52, 26); context.fill();
  context.fillStyle = "#ffffff";
  context.fillText(categoryLabel, width - padding - categoryWidth + 22, 75);
  context.textBaseline = "alphabetic";

  context.fillStyle = "#ffffff";
  context.font = `700 190px ${font}`;
  context.fillText(meta.mark, padding, 330);

  context.fillStyle = accent;
  context.font = `700 25px ${font}`;
  context.fillText(lang === "en" ? "A MOMENT IN THE DUST" : "尘土里的一场相遇", padding, 500);

  let titleSize = 72;
  let titleLines: string[] = [];
  do {
    context.font = `800 ${titleSize}px ${font}`;
    titleLines = wrapCanvasText(context, event.title, width - padding * 2, lang);
    if (titleLines.length <= 3) break;
    titleSize -= 5;
  } while (titleSize >= 48);
  const titleWasTruncated = titleLines.length > 3;
  titleLines = titleLines.slice(0, 3);
  if (titleWasTruncated) {
    let finalLine = titleLines[2].replace(/[.…]+$/, "");
    while (finalLine && context.measureText(`${finalLine}…`).width > width - padding * 2) finalLine = finalLine.slice(0, -1);
    titleLines[2] = `${finalLine}…`;
  }
  context.fillStyle = "#171713";
  const titleLineHeight = titleSize * 1.08;
  titleLines.forEach((line, index) => context.fillText(line, padding, 580 + index * titleLineHeight));

  let contentY = 580 + titleLines.length * titleLineHeight + 18;
  context.fillStyle = "#655e52";
  context.font = `400 29px ${font}`;
  const descriptionLines = wrapCanvasText(context, event.description || "—", width - padding * 2, lang).slice(0, 3);
  descriptionLines.forEach((line, index) => context.fillText(line, padding, contentY + index * 42));
  contentY += descriptionLines.length * 42 + 40;

  context.strokeStyle = "rgba(23,23,19,.16)";
  context.lineWidth = 2;
  context.beginPath(); context.moveTo(padding, contentY); context.lineTo(width - padding, contentY); context.stroke();
  contentY += 50;

  context.fillStyle = "#847c70";
  context.font = `700 20px ${font}`;
  context.fillText(lang === "en" ? "WHEN" : "时间", padding, contentY);
  context.fillText(lang === "en" ? "WHERE" : "地点", 520, contentY);
  context.fillStyle = "#171713";
  context.font = `700 31px ${font}`;
  context.fillText(`${days[shownDay][lang === "en" ? 0 : 1]} · ${days[shownDay][2]} · ${event.times[shownDay]}`, padding, contentY + 44);
  const locationLines = wrapCanvasText(context, location, width - 520 - padding, lang).slice(0, 2);
  locationLines.forEach((line, index) => context.fillText(line, 520, contentY + 44 + index * 38));

  const footerY = height - 170;
  context.strokeStyle = "rgba(23,23,19,.16)";
  context.beginPath(); context.moveTo(padding, footerY); context.lineTo(width - padding, footerY); context.stroke();
  context.fillStyle = "#171713";
  context.font = `800 30px ${font}`;
  context.fillText("PLAYA / 2026", padding, footerY + 58);
  context.fillStyle = "#6d665b";
  context.font = `500 24px ${font}`;
  context.fillText(lang === "en" ? "Find it. Save it. Follow the detour." : "找到它，收藏它，也给意外留一点空间。", padding, footerY + 98);
  context.fillStyle = "#ef5b36";
  context.font = `700 25px ${font}`;
  context.textAlign = "right";
  context.fillText("playa.intelchen.com", width - padding, footerY + 78);
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

async function createPlanShareCard(events: EventItem[], lang: Lang) {
  const width = 1080;
  const rowHeight = 116;
  const maxEvents = 130;
  const sorted = [...events].sort((left, right) => {
    const leftDay = eventDayIndex(left, -1);
    const rightDay = eventDayIndex(right, -1);
    return leftDay - rightDay || left.times[leftDay].localeCompare(right.times[rightDay]) || left.title.localeCompare(right.title);
  });
  const visibleEvents = sorted.slice(0, maxEvents);
  const remaining = Math.max(0, sorted.length - visibleEvents.length);
  const listHeight = visibleEvents.length * rowHeight + (remaining ? 72 : 0);
  const height = Math.min(16000, Math.max(1350, 370 + listHeight + 190));
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
  context.font = `800 72px ${font}`;
  context.fillText(lang === "en" ? "MY PLAYA" : "我的 PLAYA", padding, 160);
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
    const category = normalizeCategory(event.type);
    const meta = categoryMeta[category] || categoryMeta.othr;
    const location = event.where !== "-" ? event.where : event.camp;
    const cardY = y + index * rowHeight;

    context.fillStyle = index % 2 ? "rgba(255,255,255,.72)" : "rgba(255,255,255,.9)";
    context.beginPath(); context.roundRect(padding, cardY, width - padding * 2, 100, 18); context.fill();
    context.fillStyle = categoryColors[category] || categoryColors.othr;
    context.beginPath(); context.roundRect(padding, cardY, 10, 100, 5); context.fill();

    context.fillStyle = "#171713";
    context.font = `800 27px ${font}`;
    context.fillText(String(index + 1).padStart(2, "0"), padding + 30, cardY + 42);
    context.fillStyle = "#847c70";
    context.font = `700 18px ${font}`;
    context.fillText(`${days[shownDay][lang === "en" ? 0 : 1]} · ${days[shownDay][2]}`, padding + 30, cardY + 72);

    context.fillStyle = categoryColors[category] || categoryColors.othr;
    context.font = `700 18px ${font}`;
    context.fillText(`${meta.mark} ${event.times[shownDay]}`, padding + 142, cardY + 31);
    context.fillStyle = "#171713";
    context.font = `800 28px ${font}`;
    context.fillText(truncateCanvasText(context, event.title, 650), padding + 142, cardY + 65);
    context.fillStyle = "#71695e";
    context.font = `500 20px ${font}`;
    context.fillText(truncateCanvasText(context, location, 650), padding + 142, cardY + 89);
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

function EventCard({ event, lang, day, saved, sharing, onSave, onShare }: { event: EventItem; lang: Lang; day: number; saved: boolean; sharing: boolean; onSave: () => void; onShare: () => void }) {
  const category = normalizeCategory(event.type);
  const meta = categoryMeta[category] || categoryMeta.othr;
  const activeDays = event.times.map((time, index) => (time && time !== "-" ? index : -1)).filter((index) => index >= 0);
  const shownDay = day >= 0 ? day : activeDays[0] ?? 0;
  const location = event.where !== "-" ? event.where : event.camp;

  return (
    <article className={`event-card category-${category}`}>
      <div className="card-visual" aria-hidden="true">
        <span className="visual-mark">{meta.mark}</span>
        <span className="visual-orbit" />
        <span className="visual-category">{lang === "en" ? meta.en : meta.zh}</span>
      </div>
      <div className="card-body">
        <div className="card-topline">
          <span className="category-pill">{lang === "en" ? meta.en : meta.zh}</span>
          <div className="card-actions">
            <button className="share-button" onClick={onShare} aria-label={sharing ? copy[lang].generating : copy[lang].share} disabled={sharing}>{sharing ? "…" : <Share2 aria-hidden="true" />}</button>
            <button className={`save-button ${saved ? "is-saved" : ""}`} onClick={onSave} aria-label={saved ? copy[lang].remove : copy[lang].save}>
              {saved ? "★" : "☆"}
            </button>
          </div>
        </div>
        <h3>{event.title}</h3>
        <p className="event-description">{event.description}</p>
        <div className="event-meta">
          <div>
            <span>{days[shownDay][lang === "en" ? 0 : 1]} · {days[shownDay][2]}</span>
            <strong>{event.times[shownDay]}</strong>
          </div>
          <div>
            <span>{copy[lang].location}</span>
            <strong>{location}</strong>
          </div>
        </div>
        <div className="card-footer">
          <span>{event.camp}</span>
          <a href={event.link} target="_blank" rel="noreferrer">{copy[lang].open} ↗</a>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [day, setDay] = useState(-1);
  const [limit, setLimit] = useState(36);
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [planOpen, setPlanOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharingUid, setSharingUid] = useState<string | null>(null);
  const [sharingPlan, setSharingPlan] = useState(false);
  const [shareAsset, setShareAsset] = useState<ShareAsset | null>(null);
  const [captionCopied, setCaptionCopied] = useState(false);
  const t = copy[lang];

  useEffect(() => {
    const stored = window.localStorage.getItem("playa-saved");
    if (stored) setSaved(new Set(JSON.parse(stored)));
  }, []);

  useEffect(() => {
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
  }, [lang]);

  useEffect(() => setLimit(36), [query, category, day, savedOnly, lang]);

  useEffect(() => {
    if (!planOpen && !shareAsset) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [planOpen, shareAsset]);

  useEffect(() => {
    if (!shareAsset) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeShare();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [shareAsset]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: events.length };
    for (const event of events) {
      const key = normalizeCategory(event.type);
      result[key] = (result[key] || 0) + 1;
    }
    return result;
  }, [events]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return events.filter((event) => {
      const eventCategory = normalizeCategory(event.type);
      const matchesQuery = !needle || [event.title, event.description, event.camp, event.where].join(" ").toLocaleLowerCase().includes(needle);
      const matchesCategory = category === "all" || eventCategory === category;
      const matchesDay = day < 0 || (event.times[day] && event.times[day] !== "-");
      const matchesSaved = !savedOnly || saved.has(event.uid);
      return matchesQuery && matchesCategory && matchesDay && matchesSaved;
    });
  }, [events, query, category, day, savedOnly, saved]);

  const savedEvents = useMemo(() => events.filter((event) => saved.has(event.uid)), [events, saved]);

  function toggleSaved(uid: string) {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
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

  async function copyPlan() {
    const list = savedEvents.map((event, index) => {
      const eventDay = event.times.findIndex((time) => time && time !== "-");
      const when = eventDay >= 0 ? `${days[eventDay][lang === "en" ? 0 : 1]} ${days[eventDay][2]} · ${event.times[eventDay]}` : "";
      return `${index + 1}. ${event.title}\n${when} · ${event.where !== "-" ? event.where : event.camp}\n${event.link}`;
    }).join("\n\n");
    await copyToClipboard(list);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
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
  }

  async function shareEvent(event: EventItem) {
    if (sharingUid) return;
    setSharingUid(event.uid);
    try {
      const shownDay = eventDayIndex(event, day);
      const location = event.where !== "-" ? event.where : event.camp;
      const when = `${days[shownDay][lang === "en" ? 0 : 1]} ${days[shownDay][2]} · ${event.times[shownDay]}`;
      const caption = lang === "en"
        ? `✦ ${event.title}\n${when}\n${location}\n\nFind it on Playa 2026: https://playa.intelchen.com\n${event.link}`
        : `✦ ${event.title}\n${when}\n${location}\n\n在 Playa 2026 查看：https://playa.intelchen.com\n${event.link}`;
      const blob = await createEventShareCard(event, lang, day);
      const safeTitle = event.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 70) || "event";
      const filename = `playa-2026-${safeTitle}.png`;
      setShareAsset({ kind: "event", url: URL.createObjectURL(blob), filename, caption, title: event.title });
    } finally {
      setSharingUid(null);
    }
  }

  async function sharePlanImage() {
    if (sharingPlan || !savedEvents.length) return;
    setSharingPlan(true);
    try {
      const sorted = [...savedEvents].sort((left, right) => {
        const leftDay = eventDayIndex(left, -1);
        const rightDay = eventDayIndex(right, -1);
        return leftDay - rightDay || left.times[leftDay].localeCompare(right.times[rightDay]) || left.title.localeCompare(right.title);
      });
      const lines = sorted.slice(0, 24).map((event, index) => {
        const shownDay = eventDayIndex(event, -1);
        const location = event.where !== "-" ? event.where : event.camp;
        return `${index + 1}. ${event.title} — ${days[shownDay][lang === "en" ? 0 : 1]} ${days[shownDay][2]} · ${event.times[shownDay]} · ${location}`;
      });
      if (sorted.length > lines.length) lines.push(lang === "en" ? `+ ${sorted.length - lines.length} more events` : `另有 ${sorted.length - lines.length} 场活动`);
      const caption = lang === "en"
        ? `✦ My Playa · ${sorted.length} saved events\n\n${lines.join("\n")}\n\nBuild yours: https://playa.intelchen.com`
        : `✦ 我的 Playa · 已收藏 ${sorted.length} 场活动\n\n${lines.join("\n")}\n\n制作你的清单：https://playa.intelchen.com`;
      const blob = await createPlanShareCard(sorted, lang);
      setShareAsset({
        kind: "plan",
        url: URL.createObjectURL(blob),
        filename: "playa-2026-my-playa.png",
        caption,
        title: lang === "en" ? "My Playa" : "我的 Playa",
      });
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
      const blob = await fetch(shareAsset.url).then((response) => response.blob());
      const file = new File([blob], shareAsset.filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: shareAsset.title, text: shareAsset.caption, files: [file] });
      } else {
        await copyShareCaption();
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) await copyShareCaption();
    }
  }

  return (
    <main>
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
          <button className="saved-nav" onClick={() => setPlanOpen(true)}>★ {saved.size}</button>
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
          <div className="source-stamp"><span />{t.updated}</div>
          <dl className="stats">
            <div><dt>{loading ? "—" : events.length.toLocaleString()}</dt><dd>{t.events}</dd></div>
            <div><dt>09</dt><dd>{t.days}</dd></div>
            <div><dt>08</dt><dd>{t.languages}</dd></div>
            <div><dt>{String(saved.size).padStart(2, "0")}</dt><dd>{t.saved}</dd></div>
          </dl>
        </div>
        <div className="hero-note" aria-hidden="true"><span>BLACK ROCK CITY</span><strong>40°47′ N<br />119°12′ W</strong></div>
        <div className="horizon" aria-hidden="true"><span /><i /><b /></div>
      </header>

      <section className="directory" id="events">
        <div className="section-heading">
          <div><p>{t.exploreSub}</p><h2>{t.explore}</h2></div>
          <div className="saved-actions">
            <button className="open-plan" onClick={() => setPlanOpen(true)}>★ {t.myPlaya} <span>{saved.size}</span></button>
            <button className={`saved-filter ${savedOnly ? "active" : ""}`} onClick={() => setSavedOnly(!savedOnly)} aria-pressed={savedOnly}>{t.savedOnly}</button>
          </div>
        </div>

        <div className="filter-stack">
          <div className="day-strip" role="group" aria-label="Filter by day">
            <button className={day === -1 ? "active" : ""} onClick={() => setDay(-1)}><strong>{t.allDays}</strong><small>8.30 — 9.07</small></button>
            {days.map((item, index) => (
              <button key={item[2]} className={day === index ? "active" : ""} onClick={() => setDay(index)}>
                <strong>{item[lang === "en" ? 0 : 1]}</strong><small>{item[2]}</small>
              </button>
            ))}
          </div>

          <div className="filter-row">
            {categoryOrder.map((key) => {
              const meta = categoryMeta[key];
              return (
                <button key={key} className={category === key ? "active" : ""} onClick={() => setCategory(key)}>
                  <span>{meta.mark}</span>{lang === "en" ? meta.en : meta.zh}<em>{counts[key] || 0}</em>
                </button>
              );
            })}
          </div>

          <div className="mobile-search">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} />
          </div>
        </div>

        <div className="results-line"><span>{t.showing} <strong>{filtered.length.toLocaleString()}</strong> {t.matches}</span><i /></div>

        {loading ? (
          <div className="loading-grid" aria-label="Loading events">{Array.from({ length: 6 }).map((_, index) => <div key={index} />)}</div>
        ) : error ? (
          <div className="empty-state"><span>!</span><p>{lang === "en" ? "The event source is taking a dust break. Please refresh in a moment." : "活动来源暂时走进了尘暴，请稍后刷新。"}</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><span>✦</span><p>{t.empty}</p><button onClick={resetFilters}>{t.reset}</button></div>
        ) : (
          <>
            <div className="event-grid desktop-event-grid">
              {filtered.slice(0, limit).map((event) => <EventCard key={event.uid} event={event} lang={lang} day={day} saved={saved.has(event.uid)} sharing={sharingUid === event.uid} onSave={() => toggleSaved(event.uid)} onShare={() => shareEvent(event)} />)}
            </div>
            <div className="mobile-event-grid">
              {[0, 1].map((column) => (
                <div className="mobile-event-column" key={column}>
                  {filtered.slice(0, limit).filter((_, index) => index % 2 === column).map((event) => <EventCard key={event.uid} event={event} lang={lang} day={day} saved={saved.has(event.uid)} sharing={sharingUid === event.uid} onSave={() => toggleSaved(event.uid)} onShare={() => shareEvent(event)} />)}
                </div>
              ))}
            </div>
            {limit < filtered.length && <button className="load-more" onClick={() => setLimit(limit + 36)}>{t.loadMore}<span>{Math.min(36, filtered.length - limit)}</span></button>}
          </>
        )}
      </section>

      <footer>
        <div className="footer-star">✦</div>
        <div><h2>{t.footerTitle}</h2><p>{t.footerCopy}</p></div>
        <a href="https://docs.google.com/spreadsheets/d/1KEXPq567lHtESUXdtt1CLzXJNSFc1318cT1yNv8nzg8/edit?gid=0#gid=0" target="_blank" rel="noreferrer">{t.source} ↗</a>
      </footer>

      {saved.size > 0 && !planOpen && (
        <button className="plan-dock" onClick={() => setPlanOpen(true)}>
          <span>★</span><strong>{t.myPlaya}</strong><em>{saved.size}</em>
        </button>
      )}

      <div className={`plan-shell ${planOpen ? "open" : ""}`} aria-hidden={!planOpen}>
        <button className="plan-backdrop" aria-label={t.close} onClick={() => setPlanOpen(false)} />
        <aside className="plan-drawer" role="dialog" aria-modal="true" aria-label={t.myPlaya}>
          <div className="plan-header">
            <div><p>{t.planHint}</p><h2>{t.myPlaya} <span>{saved.size}</span></h2></div>
            <button onClick={() => setPlanOpen(false)} aria-label={t.close}>×</button>
          </div>
          <div className="plan-calendar">
            {savedEvents.length === 0 ? (
              <div className="plan-empty"><span>☆</span><p>{t.planEmpty}</p></div>
            ) : days.map((calendarDay, dayIndex) => {
              const dayEvents = savedEvents.filter((event) => event.times[dayIndex] && event.times[dayIndex] !== "-");
              return (
                <section className="calendar-day" key={calendarDay[2]}>
                  <header><strong>{calendarDay[lang === "en" ? 0 : 1]}</strong><span>{calendarDay[2]}</span><em>{dayEvents.length}</em></header>
                  <div className="calendar-events">
                    {dayEvents.length === 0 ? <p className="calendar-blank">—</p> : dayEvents.map((event) => (
                      <article key={`${event.uid}-${dayIndex}`} className={`calendar-event category-${normalizeCategory(event.type)}`}>
                        <div className="calendar-event-top"><span>{categoryMeta[normalizeCategory(event.type)]?.mark || "✳"} {event.times[dayIndex]}</span><button onClick={() => toggleSaved(event.uid)} aria-label={t.remove}>×</button></div>
                        <h3>{event.title}</h3>
                        <p>{event.where !== "-" ? event.where : event.camp}</p>
                        <a href={event.link} target="_blank" rel="noreferrer">↗</a>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="plan-footer">
            <button onClick={clearSaved} disabled={!savedEvents.length}>{t.clearAll}</button>
            <div className="plan-footer-actions">
              <button className="share-plan" onClick={sharePlanImage} disabled={!savedEvents.length || sharingPlan}>{sharingPlan ? t.generatingPlan : <><Share2 aria-hidden="true" />{t.sharePlan}</>}</button>
              <button className="copy-plan" onClick={copyPlan} disabled={!savedEvents.length}>{copied ? t.copied : t.copyList}</button>
            </div>
          </div>
        </aside>
      </div>

      {shareAsset && (
        <div className="share-modal" onMouseDown={(event) => { if (event.target === event.currentTarget) closeShare(); }}>
          <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
            <button className="share-close" onClick={closeShare} aria-label={t.close}>×</button>
            <p className="share-kicker">PLAYA / 2026</p>
            <h2 id="share-title">{shareAsset.kind === "plan" ? t.sharePlanTitle : t.shareTitle}</h2>
            <p className="share-hint">{t.shareHint}</p>
            <img className="share-preview" src={shareAsset.url} alt={`${shareAsset.title} share card`} />
            <textarea className="share-caption" value={shareAsset.caption} readOnly aria-label={t.copyCaption} />
            <div className="share-primary-actions">
              <button className="share-native" onClick={shareFallbackAsset}><Share2 aria-hidden="true" />{t.shareNow}</button>
              <a className="share-download" href={shareAsset.url} download={shareAsset.filename}>↓ {t.saveImage}</a>
            </div>
            <button className="share-copy" onClick={copyShareCaption}>{captionCopied ? `${t.captionCopied} ✓` : t.copyCaption}</button>
          </section>
        </div>
      )}
    </main>
  );
}
