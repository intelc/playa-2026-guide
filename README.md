# vinext-starter

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

Open the live guide at [playa.intelchen.com](https://playa.intelchen.com), or run it locally:

```bash
git clone https://github.com/intelc/playa-2026-guide.git
cd playa-2026-guide
npm install
npm run dev
```

Then visit [http://localhost:3000](http://localhost:3000). Event data is read from the public Burning Man 2026 Google Sheet, and saved “My Playa” events stay in the current browser’s local storage.

Events also include a compact `location` object when their camp name has an unambiguous match in Burning Man’s official 2026 placed-camp GeoJSON. It contains the matched camp name and UID plus a display-only latitude/longitude label point; it is not an entrance or street address. The map is cached server-side for 15 minutes and an unavailable or invalid map payload degrades to `source: "unlocated"` rather than hiding events.

### Optional official playa addresses

To add official 2026 camp placement text such as `4:45 & G`, set `BURNING_MAN_API_KEY` in the server environment (for local development, put it in `.env.local`; for Netlify, add it under **Site configuration → Environment variables** and redeploy). The key is used only by server event loaders in the `X-API-Key` request header and is never sent to the browser.

The camp-address API is cached for 15 minutes. If the key is unset, the request fails, or the response is invalid, events keep their official map coordinates and may use a strict per-event sheet address, a reviewed UID-keyed correction, or a visibly approximate `Near …` GIS fallback. Free-form locations are never guessed as playa addresses.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## 2026 Camp Address Fallbacks

Camp coordinates come from the official 2026 placement GeoJSON. Street addresses
are separate metadata, applied in this order: a strict per-event sheet address,
official keyed API, curated verification, then a visibly approximate `Near …`
GIS inference. The browser never fetches camp or street GIS data.

To correct or add a verified camp placement before the official API key is
available, add one UID-keyed entry to
[`data/camp-address-curated-2026.mjs`](data/camp-address-curated-2026.mjs).
Use the camp's 2026 official GeoJSON `UID`, retain the camp name for review,
give a direct HTTPS source and evidence note, set `confidence: "reviewed"`,
and record `verified_at` as `YYYY-MM-DD`. Curated values are allowed to use
named streets such as `Chomolungma`; never prefix them with `Near`.

The generated approximation in `data/camp-address-inferred-2026.mjs` must not
be edited manually. Its manifest pins the resolved Git commit URL for streets
and fingerprints the live camp input with its SHA-256, count, and required
schema. Validate the checked-in snapshot with:

```sh
node scripts/generate-camp-address-inference.mjs --check
```

If the live camp placement changes or you intentionally want to move to a newer
street-data commit, inspect the map/data change first, then explicitly accept
and regenerate it:

```sh
node scripts/generate-camp-address-inference.mjs --accept-source-update
```

It uses only official camp polygons and the pinned street snapshot, and emits
an address only when the centroid, representative point, and boundary methods
agree and the polygon boundary is within 10 m of the named intersection. Check
the generated file into the same change after reviewing the updated manifest.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
