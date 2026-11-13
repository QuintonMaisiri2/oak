# OAK Zimbabwe Partner Gathering — Frontend PRD & System Design
**Owner:** You (Frontend) · **Build tool:** Antigravity · **Stack:** Next.js (App Router) + TypeScript + Tailwind + Supabase
**Event:** Cresta Lodge, Msasa, Harare · 9–11 Nov 2026 · ~110 attendees
**Source docs:** Project Brief (Sprint) + Project Brief (Convening) — reconciled here in favor of the coded stack and the one-week sprint timeline.

---

## 1. Overview & Goals

The frontend is the only interface for four groups of people:

| User | Auth | What they do |
|---|---|---|
| Attendee | None (identified only by QR) | Register, receive a QR pass, view programme + partner directory |
| Coordination team (admin) | Supabase Auth (email/password) | Scan check-ins, view live headcount, manage attendee list, export CSV |
| Content admin (programme/directory editor) | Supabase Auth | Edit sessions, documentation posts, partner directory entries |
| Oak Zimbabwe (funder) | None — views the same public pages as attendees | Visibility into a working, funder-visible deliverable |

**Frontend-level goals**, derived from the brief's Definition of Done:
1. Registration → working personal QR code, immediately, on the attendee's own phone.
2. A scan at the door records attendance and updates a **live** headcount — no double-count per day, no manual fallback the coordination team has to trust more than the app.
3. Programme + directory load reliably on a mid-range Android phone, **with no login**.
4. Every admin-only field (dietary, accessibility, travel, contact) is provably invisible to any unauthenticated request — not just hidden in the UI.
5. Code is lint-clean, typed, tested on the critical paths, and a junior dev can clone + run it from the README.

**Non-goals** (per brief): attendee accounts, native app, payments, complex workflow/approval logic.

---

## 2. Target-environment constraints (why some choices below aren't defaults)

Zimbabwe's mobile data has historically been among the more expensive in Africa relative to income, and a real share of connections still run on 3G rather than 4G, even though smartphone and mobile penetration have been rising. Concretely, this means:

- The event is a **single controlled venue** (Cresta Lodge) — this is not a rural/offline-first deployment, so I'm not proposing a full offline-first sync engine.
- But **venue Wi-Fi congestion is a real, specific failure mode**: ~110 people checking in over a short window, plus phones on data. A check-in scan that silently fails on a network blip is the single worst possible bug for this app on the day.
- Attendees paying for their own data to view the programme page means **payload size matters** — this isn't just a performance nicety, it's a cost to the person using it.

Design implications carried through this doc: bandwidth-conscious page weight (section 10), and a **local-queue-and-retry pattern specifically for the check-in scanner** (section 9), not for the whole app.

---

## 3. Information architecture / route map

```
/ (public)                       → landing / event info, links to register
/register (public)               → registration form
/pass/[attendeeId] (public*)     → attendee's digital nametag + QR (link only, not discoverable/listed)
/programme (public)              → day-tabbed schedule + daily documentation posts
/directory (public)              → partner directory

/admin/login (public)            → Supabase auth
/admin (protected)               → dashboard: live headcount
/admin/scan (protected)          → camera QR scanner, check-in
/admin/attendees (protected)     → searchable table + CSV export (sensitive fields live here)
/admin/programme (protected)     → CRUD for sessions + documentation posts
/admin/directory (protected)     → CRUD for partner directory entries
/admin/nametags (protected)      → printable nametag sheet generator
```

`*` `/pass/[attendeeId]` is "public" in the sense of no login, but it must **only ever render the attendee's own name/org/QR** — never dietary/accessibility/contact fields, and the route must not be enumerable in any way that leaks another attendee's data (see §8).

---

## 4. Tech stack — confirmed, with rationale

Stack is fixed by the brief; noting *why* it fits rather than re-litigating it:

- **Next.js App Router** — Server Components let admin-only data fetching happen server-side, so sensitive fields never touch the client bundle for pages that don't need them. This is the actual security mechanism behind requirement #4 above, not just a performance choice.
- **Supabase** — Postgres + Row Level Security gives you a second, database-level enforcement layer for "admin-only fields never leave the server," independent of frontend bugs. Supabase Auth + Storage keep this to one vendor for a one-week build.
- **qrcode.react / html5-qrcode** — no native hardware dependency, matches "any smartphone camera."
- **Vercel** — zero-config CDN + preview deployments per PR, good fit for a small team shipping daily.

---

## 5. Folder structure

```
src/
  app/
    (public)/
      page.tsx                  # landing
      register/page.tsx
      pass/[attendeeId]/page.tsx
      programme/page.tsx
      directory/page.tsx
    admin/
      layout.tsx                # auth guard wrapper (redirects if no session)
      login/page.tsx
      page.tsx                  # dashboard / headcount
      scan/page.tsx
      attendees/page.tsx
      programme/page.tsx
      directory/page.tsx
      nametags/page.tsx
    api/
      check-in/route.ts         # POST — validates + writes a check-in
      attendees/export/route.ts # GET (admin only) — CSV stream
  components/
    ui/                         # design-system primitives (Button, Input, Card, Tabs…)
    registration/
    scanner/
    dashboard/
    programme/
    directory/
  lib/
    supabase/
      client.ts                 # browser client
      server.ts                 # server client (Server Components/Actions)
      middleware.ts             # session refresh helper
    validation/                 # zod schemas, shared client+server
    qr/                         # QR payload encode/decode helpers
    types/                      # generated Supabase types + domain types
  middleware.ts                 # route protection
tests/
  unit/
  e2e/
```

Feature-based, not strict atomic design — for a one-week build, colocating a feature's components beats a deep atoms/molecules hierarchy nobody has time to maintain correctly.

---

## 6. Protected routes & auth design

- `middleware.ts` runs Supabase's SSR session-refresh on every request matching `/admin/:path*`, redirecting to `/admin/login` if there's no valid session. This is the **first** gate.
- `app/admin/layout.tsx` re-checks the session server-side (Server Component) before rendering any admin UI — belt-and-braces, because middleware matchers are easy to misconfigure and shouldn't be the only lock on the door.
- No client-side-only route guards. A `useEffect` redirect is not a security boundary — it still ships the page's JS and (if data was fetched client-side) the data itself before the redirect fires. All admin data fetching happens in Server Components/Route Handlers that check `auth.getUser()` themselves.
- Route Handlers under `/api/*` that touch sensitive data independently verify the session — never trust that "this was only ever called from an authed page."

---

## 7. Data model (frontend-facing types)

Mirrors what Supabase should hold; treat this as the contract your backend teammate and you agree on Day 1.

```ts
// lib/types/domain.ts

type Attendee = {
  id: string;               // UUID, also the QR payload's subject
  name: string;
  organization: string;
  subPartner: string | null;
  role: string;
  email: string;            // admin-only
  phone: string;            // admin-only
  dietary: string | null;   // admin-only
  accessibility: string | null; // admin-only
  travelNeeds: string | null;   // admin-only
  consentGivenAt: string;   // ISO timestamp
  createdAt: string;
};

// Public-safe projection — this is the type any public page/route is allowed to return
type AttendeePublic = Pick<Attendee, "id" | "name" | "organization" | "subPartner" | "role">;

type CheckIn = {
  id: string;
  attendeeId: string;
  eventDay: "2026-11-09" | "2026-11-10" | "2026-11-11";
  scannedAt: string;
  scannedByAdminId: string;
};

type Session = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  title: string;
  location: string;
};

type DocumentationPost = {
  id: string;
  day: string;
  notes: string;
  photoUrls: string[];
};

type PartnerOrg = {
  id: string;
  name: string;
  logoUrl: string;
  websiteUrl: string;
  isSubPartner: boolean;
  parentOrgId: string | null;
};
```

**The `AttendeePublic` projection is the load-bearing idea here**: define it once, and make it a lint-enforced rule (or at minimum a code-review checklist item) that any public route/component imports `AttendeePublic`, never `Attendee`. It turns "don't leak sensitive fields" from a discipline problem into a type-system problem.

---

## 8. Security architecture

Layered, so a mistake in one layer doesn't mean a data leak:

1. **Database (RLS)** — Postgres Row Level Security policies on the `attendees` table: `SELECT` of sensitive columns restricted to `authenticated` role with an admin claim; anonymous/public role can only read via a **view** (`attendees_public`) that excludes email/phone/dietary/accessibility/travel. Enforce this in the database, exactly as the brief says — a frontend bug should never be able to expose it.
2. **API layer** — Route Handlers and Server Actions that touch attendee data explicitly select the public view for public routes; never spread a full `Attendee` object into a JSON response that a public page consumes.
3. **QR payload** — don't encode raw attendee UUIDs as a guessable/sequential value in the QR if avoidable; use the UUID (already non-sequential) as the payload, and consider a short HMAC-signed token instead of the bare ID so a photographed QR code can't be replayed to construct other IDs by guessing. At minimum, confirm UUIDs are v4 (random), not v1/sequential.
4. **Check-in endpoint** — `/api/check-in` requires an authenticated admin session (the scanner is admin-only, per the brief: "coordination team scans"). Validate the scanned payload server-side, upsert on `(attendeeId, eventDay)` unique constraint so a duplicate scan is a no-op, not a duplicate row — this is what "no double-counting" actually means at the DB level, not just a UI check.
5. **CSV export** — admin-only Route Handler, streamed, never cached at the CDN edge (`Cache-Control: private, no-store`).
6. **File uploads** (logos, documentation photos) — validate MIME type and size client- and server-side before hitting Supabase Storage; strip EXIF where practical.
7. **Secrets** — `SUPABASE_SERVICE_ROLE_KEY` never ships to the client; only used in Route Handlers/Server Actions, never imported into a `"use client"` file. Enforce via env var naming convention (`NEXT_PUBLIC_*` prefix = client-safe, everything else server-only) and a quick grep in CI for `service_role` outside `lib/supabase/server.ts`.

**Verification step for Definition of Done #4**: literally `curl` the public routes and public API responses during QA and read the raw JSON/HTML — don't just check what renders in the UI, since a Server Component can still leak a field it fetched but didn't display if it's serialized into page props.

---

## 9. Check-in scanner: resilience design

This is the one flow where a network hiccup is user-visible and costly (a missed scan at a crowded door), so it gets special handling:

- Scan → optimistic local UI feedback (green check / attendee name) immediately.
- POST to `/api/check-in` in the background. On success, done.
- On failure (network error, timeout): **queue the scan in local state** (in-memory + `sessionStorage` as a backup, not `localStorage` per artifact rules if this ever runs as one — but this is a real Next.js app, so a small IndexedDB or `localStorage` queue is fine here) and retry with backoff. Show a small "X pending sync" indicator on the scanner screen so the admin isn't blind to it.
- Flush the queue on reconnect (`navigator.onLine` listener + periodic retry).
- The `(attendeeId, eventDay)` unique constraint (§8) makes retries safe — a queued scan that actually succeeded server-side before the ack was lost just no-ops on retry instead of double-counting.

This is deliberately scoped to the scanner only — registration and the public pages don't need this complexity; a failed registration submit can just show a normal error and let the person retry.

---

## 10. Performance & bandwidth budget

Given the target device (mid-range Android) and event connectivity risk:

- Programme and directory pages: Server-Component-rendered, minimal client JS. Avoid client-side data-fetching waterfalls.
- Images (partner logos, documentation photos): use `next/image` with explicit sizes, served from Supabase Storage through Next's image optimizer; cap upload dimensions on the admin upload form rather than relying on optimization alone.
- No auto-loading of full-resolution photo galleries — lazy-load below the fold, thumbnail-first.
- `html5-qrcode` and `qrcode.react` are the two heaviest client bundles in the app — dynamically `import()` them only on `/pass/[id]` and `/admin/scan`, not in the shared bundle.
- Target: programme/directory pages under ~150KB JS on first load; measure with `next build` output, not guesswork.

---

## 11. Component architecture & design tokens

Since I can't currently open the Figma file (private/login-gated) I'm not hard-coding colors/spacing here. Structure to receive them:

```js
// tailwind.config.ts — extend, don't override, so tokens are a single source of truth
theme: {
  extend: {
    colors: { /* fill from Figma variables/styles once exported */ },
    fontFamily: { /* fill from Figma type styles */ },
    spacing: { /* only if Figma uses a non-default scale */ },
  }
}
```

**Action needed from you/design team**: export Figma variables (Dev Mode → Export → or just the raw hex/type values) so this can be filled in exactly rather than eyeballed from screenshots. Until then, build components against semantic Tailwind classes (`bg-primary`, `text-body`) so swapping in real tokens later is a config change, not a find-and-replace across components.

Component primitives to build first (used everywhere): `Button`, `Input`/`Select`/`Textarea`, `Card`, `Tabs` (for programme days), `Badge` (check-in status), `Table` (attendee list), `Modal`.

---

## 12. Forms & validation

- `react-hook-form` + `zod`, with the **same zod schema reused server-side** in the Server Action/Route Handler that receives the submission — never trust client-side validation alone.
- Registration form: required consent checkbox (per Data Handling section of the brief) is a hard `zod` requirement, not just a UI-disabled submit button.

---

## 13. Live data: headcount dashboard

- Supabase Realtime subscription on the `check_ins` table, filtered to the current event day, to update the live headcount without polling.
- Fallback: if Realtime isn't wired up in time, poll every 5–10s — acceptable for ~110 people, just note it as a deliberate fallback, not a silent gap.

---

## 14. Linting, formatting, type safety

- `eslint-config-next` + `@typescript-eslint` strict rules; `tsconfig.json` with `strict: true`.
- Prettier for formatting; Husky pre-commit running `lint-staged` (lint + format on staged files only, keeps commits fast).
- A lightweight custom ESLint rule or a `no-restricted-imports` config entry that flags importing the full `Attendee` type (vs. `AttendeePublic`) inside anything under `app/(public)/**` — cheap to add, directly enforces §7/§8.

---

## 15. Testing

- **Unit** (Vitest + React Testing Library): validation schemas, QR encode/decode helpers, the public-projection utility.
- **E2E** (Playwright), the three flows that must not break on the day:
  1. Register → receive QR → QR renders and decodes to the right attendee ID.
  2. Admin login → scan a QR → headcount increments → re-scanning the same QR same day does not increment again.
  3. Public programme/directory pages return 200 and contain no sensitive attendee fields in the response body (an automated grep-the-response test, not just a visual check).

---

## 16. CI/CD

- GitHub Actions on PR: `tsc --noEmit`, `eslint`, unit tests — required checks before merge.
- Vercel preview deployment per PR for design/instructor review.
- Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) documented in `.env.example`, set in Vercel dashboard per environment (preview/production) — never committed.

---

## 17. Scalability & reliability notes (honest, for a 110-person event)

This app does not need to scale in the traditional sense — flag this so effort isn't misallocated:
- Read-heavy public pages (programme/directory) on Vercel's CDN handle far more than 110 concurrent users trivially.
- The one real concurrency moment is check-in at the door — dozens of scans in a short window, which is a small write volume Postgres handles without any special design.
- Single point of failure worth naming: Supabase itself. No fallback if Supabase has an outage during the event. Mitigation given the timeline: none planned beyond "keep the CSV export current" as a manual-fallback data source the coordination team could work from if the app is fully down — worth a one-line mention to Elisha as an accepted risk, not solved in this sprint.

---

## 18. Accessibility

- Forms: labeled inputs, visible focus states, error messages tied to fields via `aria-describedby`.
- Scanner screen: don't rely on color alone for scan success/failure (icon + text + color).
- Test contrast against whatever palette comes out of Figma once accessible.

---

## 19. Open items / questions to raise early

1. **Figma access** — the file (`OAK-FOUNDATION`) needs to be shared with edit/view access, or design tokens exported, before pixel-accurate implementation of §11 can start.
2. **QR payload format** — plain UUID vs. signed token (§8.3): decide before Day 2, since it affects both `qrcode.react` generation and the scanner's decode/verify logic.
3. **"Per day" boundary for check-in** — confirm whether "day" resets at midnight local time or at some operational cutoff (e.g., venue transitions overnight); affects the `(attendeeId, eventDay)` uniqueness logic.
4. **Realtime vs. polling for the dashboard** — confirm Supabase Realtime is enabled on the project early, since it's a config toggle that's easy to forget until Day 3.
5. **Sub-partner data model** — brief mentions "organization/sub-partner" as separate concept from "partner directory" sub-partners; confirm these are the same entity or two related-but-distinct lists.

---

## 20. Day 1 frontend task list (mapped to the sprint brief)

- [ ] Scaffold Next.js + TS + Tailwind repo, ESLint/Prettier/Husky configured
- [ ] `lib/supabase/{client,server}.ts` + `middleware.ts` skeleton
- [ ] `AttendeePublic` type + public/admin type split in place before any page is built against it
- [ ] Registration page shell built to whatever design reference is available (placeholder tokens if Figma access is still pending)
- [ ] Deploy scaffold to Vercel, confirm env vars wired
- [ ] Share this doc's open items (§19) with Elisha/Beyond at standup
