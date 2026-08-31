"use client";

import { useEffect, useMemo, useState } from "react";

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

function EventCard({ event, lang, day, saved, onSave }: { event: EventItem; lang: Lang; day: number; saved: boolean; onSave: () => void }) {
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
          <button className={`save-button ${saved ? "is-saved" : ""}`} onClick={onSave} aria-label={saved ? copy[lang].remove : copy[lang].save}>
            {saved ? "★" : "☆"}
          </button>
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
    if (!planOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [planOpen]);

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
    await navigator.clipboard.writeText(list);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function clearSaved() {
    setSaved(new Set());
    window.localStorage.setItem("playa-saved", "[]");
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

        <div className="results-line"><span>{t.showing} <strong>{filtered.length.toLocaleString()}</strong> {t.matches}</span><i /></div>

        {loading ? (
          <div className="loading-grid" aria-label="Loading events">{Array.from({ length: 6 }).map((_, index) => <div key={index} />)}</div>
        ) : error ? (
          <div className="empty-state"><span>!</span><p>{lang === "en" ? "The event source is taking a dust break. Please refresh in a moment." : "活动来源暂时走进了尘暴，请稍后刷新。"}</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><span>✦</span><p>{t.empty}</p><button onClick={resetFilters}>{t.reset}</button></div>
        ) : (
          <>
            <div className="event-grid">
              {filtered.slice(0, limit).map((event) => <EventCard key={event.uid} event={event} lang={lang} day={day} saved={saved.has(event.uid)} onSave={() => toggleSaved(event.uid)} />)}
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
            <button className="copy-plan" onClick={copyPlan} disabled={!savedEvents.length}>{copied ? t.copied : t.copyList} ↗</button>
          </div>
        </aside>
      </div>
    </main>
  );
}
