const EVENT_UID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

/** Creates an iBurn universal link that opens an existing event detail. */
export function getIBurnEventUrl(uid: unknown, title: unknown): string | null {
  const eventUid = typeof uid === "string" ? uid.trim() : "";
  if (!EVENT_UID_PATTERN.test(eventUid)) return null;

  const eventTitle = typeof title === "string" ? title.replace(/\s+/g, " ").trim().slice(0, 160) : "";
  const params = new URLSearchParams({ uid: eventUid });
  if (eventTitle) params.set("title", eventTitle);
  return `https://iburnapp.com/event/?${params.toString()}`;
}
