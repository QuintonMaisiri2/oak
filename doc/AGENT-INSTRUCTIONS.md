# AGENT INSTRUCTIONS — OAK Zimbabwe Partner Gathering Frontend

**Read this entire file before writing any code.** This is the source of truth for how you build this project. Where this file and a verbal prompt conflict, this file wins unless the user explicitly overrides it in writing.

If anything below is ambiguous or you're about to guess at a security- or data-model-related decision, **stop and ask** rather than proceeding on an assumption. Do not silently pick the "probably fine" option for anything in the "Hard Rules" section — those are hard rules, not defaults.

---

## 0. What this project is

A web platform for the OAK Zimbabwe Foundation Partner Gathering (Cresta Lodge, Harare, 9–11 Nov 2026, ~110 attendees): attendee registration with QR codes, camera-based check-in with a live headcount, a public programme page, and a partner directory. This is a real, funder-visible deliverable, not a throwaway prototype — treat reliability and security as first-class requirements, not something to add later.

Full architecture and rationale live in `OAK-Frontend-PRD-System-Design.md` in this repo. This file is the enforceable ruleset derived from it. Read both.

---

## 1. Condensed PRD

**Users:**
- **Attendee** — no login, identified only by a QR code. Registers once, gets a QR pass, can view the programme and directory.
- **Admin (coordination team)** — logs in via Supabase Auth. Scans QR codes at check-in, views live headcount, manages attendees/programme/directory.

**Core flows, in priority order:**
1. Registration → attendee gets a working personal QR code immediately.
2. Admin scans a QR at the door → check-in recorded → live headcount updates → no double-count for the same attendee on the same day.
3. Public programme page (day tabs, sessions, daily notes/photos) — loads with no login.
4. Public partner directory (logos + links) — loads with no login.
5. Admin: attendee table with search + CSV export; programme/directory content editors; printable nametag sheet.

**Explicitly out of scope — do not build these even if it seems helpful:**
- Attendee accounts or any login for attendees.
- A native mobile app.
- Payment processing.
- Any approval/workflow logic beyond "submit form → get QR."

---

## 2. Hard rules (never violate these)

These are the rules that, if broken, produce either a security incident or a broken event-day experience. Treat every one of these as a blocking issue, not a style preference.

### Data exposure
- **R1.** Any type, query, or API response reachable from a public (non-admin) route MUST use the `AttendeePublic` projection (`id`, `name`, `organization`, `subPartner`, `role`) — never the full `Attendee` type, which includes `email`, `phone`, `dietary`, `accessibility`, `travelNeeds`.
- **R2.** Never fetch full attendee records in a Server Component that renders a public page, even if you only destructure the safe fields before rendering — the fetched object can still leak into serialized props. Query only the safe columns/view at the database level.
- **R3.** Enforce R1/R2 in Postgres via Row Level Security and a public-safe view (e.g. `attendees_public`), not only in application code. If you're only enforcing this in the frontend, you have not actually finished the task.
- **R4.** Before marking any public page "done," fetch its raw HTML/JSON response (not just the rendered UI) and confirm sensitive fields are absent from the response body.

### Auth & routes
- **R5.** All `/admin/*` routes are protected via `middleware.ts` AND re-verified server-side in the route/layout itself (`auth.getUser()`). Never rely on a client-side `useEffect` redirect as the only guard.
- **R6.** Any Route Handler or Server Action that touches attendee data, exports data, or writes a check-in must independently verify the caller's session — never assume "this is only called from a page that's already behind auth."
- **R7.** `SUPABASE_SERVICE_ROLE_KEY` must never appear in any file, string, or import reachable from client code (`"use client"` components, anything bundled to the browser). It is used only inside server-only files under `lib/supabase/server.ts` or Route Handlers.

### Check-in correctness
- **R8.** Check-ins are keyed by a unique `(attendeeId, eventDay)` constraint at the database level. A duplicate scan for the same attendee on the same day must be a no-op, not a duplicate row or an incremented count.
- **R9.** The check-in scanner must handle a failed network request by queuing the scan locally and retrying — it must never silently drop a scan with no user-visible indication.

### Code quality
- **R10.** TypeScript `strict: true`. No `any` without an explicit inline comment justifying why (and prefer `unknown` + narrowing instead).
- **R11.** All form input is validated with a `zod` schema on both client (react-hook-form resolver) and server (Server Action/Route Handler re-validates the same schema) — client-side validation alone is not acceptable for anything that writes to the database.
- **R12.** No secrets, API keys, or credentials committed to the repo, ever — including in comments, test fixtures, or `.env` files (only `.env.example` with placeholder values is committed).
- **R13.** Every new page/component must pass `eslint` and `tsc --noEmit` with zero errors before you consider the task complete. Do not disable a lint rule to make an error go away — fix the underlying issue, or ask the user before adding a targeted, justified `eslint-disable` comment.

---

## 3. Project structure to follow

Do not invent a different structure. If a new type of file doesn't fit here, ask where it should go rather than guessing.

```
src/
  app/
    (public)/{page.tsx, register/, pass/[attendeeId]/, programme/, directory/}
    admin/{layout.tsx, login/, page.tsx, scan/, attendees/, programme/, directory/, nametags/}
    api/{check-in/route.ts, attendees/export/route.ts}
  components/
    ui/            # design-system primitives only — no feature logic here
    registration/
    scanner/
    dashboard/
    programme/
    directory/
  lib/
    supabase/{client.ts, server.ts, middleware.ts}
    validation/    # zod schemas — shared between client and server
    qr/            # encode/decode helpers
    types/         # domain types, incl. AttendeePublic vs Attendee split
  middleware.ts
tests/
  unit/
  e2e/
```

---

## 4. Coding conventions

- **Components:** Server Components by default. Add `"use client"` only when you need interactivity, browser APIs, or hooks — and only at the leaf component that needs it, not the whole page.
- **Styling:** Tailwind utility classes via semantic tokens defined in `tailwind.config.ts` (`bg-primary`, `text-body`, etc.), not raw hex values inline. If design tokens from Figma aren't available yet, use placeholder semantic tokens and flag it rather than hardcoding arbitrary colors throughout components.
- **Naming:** `PascalCase` for components, `camelCase` for functions/variables, `kebab-case` for file names except component files (`RegistrationForm.tsx` matches its exported component name).
- **Imports:** absolute imports via the `@/` alias, not deep relative paths (`../../../lib/...`).
- **Comments:** explain *why*, not *what* — don't narrate obvious code. Do comment on any non-obvious security or business-logic decision (e.g. why a query filters on a specific column).
- **Error handling:** never swallow errors silently. User-facing errors get a readable message; unexpected errors are logged (`console.error` minimum for now) with enough context to debug.
- **Commits:** small, one logical change per commit, imperative mood ("Add check-in idempotency constraint", not "added stuff").

---

## 5. Performance rules

- Keep public pages (`/programme`, `/directory`) light — target under ~150KB JS on first load. Check `next build` output, don't estimate.
- Dynamically `import()` `html5-qrcode` and `qrcode.react` only on the pages that use them (`/pass/[id]`, `/admin/scan`) — never in a shared layout or global bundle.
- Use `next/image` for all images (logos, documentation photos) with explicit width/height; don't ship unbounded full-resolution uploads to the client.
- No client-side data-fetching waterfalls on public pages — fetch in Server Components.

---

## 6. Testing requirements before calling a feature "done"

For any feature you build, before reporting it complete:
1. `tsc --noEmit` passes.
2. `eslint` passes with zero warnings introduced by your change.
3. If the feature touches registration, check-in, or auth: a corresponding test exists (unit for logic, Playwright e2e for the full flow) — see the three required e2e flows in the architecture doc (§15).
4. If the feature touches attendee data: you have manually verified (raw response inspection, not just UI) that no sensitive field leaks on a public route.
5. You have not introduced a new `any`, a disabled lint rule, or a committed secret.

If you cannot satisfy one of these (e.g., testing infra isn't set up yet on Day 1), say so explicitly instead of reporting the feature as fully done.

---

## 7. When you're uncertain

Ask the user rather than assuming, specifically for:
- Anything affecting the database schema or RLS policies (this is shared with the backend/schema owner).
- The QR payload format (raw UUID vs. signed token) — not yet decided as of this doc; don't pick one unilaterally.
- The exact boundary for "per day" check-in resets (midnight local vs. an operational cutoff).
- Any design token or spacing value not yet available from Figma — use a clearly-named placeholder token and flag it, don't invent a final value.
- Whether Supabase Realtime is enabled on the project (affects the headcount dashboard implementation) — confirm before building against it; fall back to short-interval polling and say so if unconfirmed.

Do not ask about things this document already answers — re-read the relevant section first.

---

## 8. Definition of done (project-level, from the client brief)

Only consider the overall build complete when all of these hold:
- An attendee can register and immediately receive a working personal QR code on their phone.
- Scanning that QR at check-in records attendance and updates the live headcount, with no manual register and no double-counting per day.
- Programme page and partner directory load reliably on a mid-range Android phone with no login.
- Dietary, accessibility, travel, and contact details are readable only by logged-in admins — never exposed on any public page or API response, verified by inspecting the raw response, not just the screen.
- The build matches the approved design, and the README lets a junior developer run and deploy it from scratch.
