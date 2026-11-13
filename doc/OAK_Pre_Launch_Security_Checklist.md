# OAK Attendance Platform — Pre-Launch Security Checklist

Generated from a security review of the frontend-only mock build. These items are **expected and acceptable while the app runs on the mock data layer**, but every item here must be resolved before any real attendee PII touches this system or it goes live.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## 1. Authentication & Authorization

- [ ] Replace `localStorage`-based role/auth state (`AuthProvider`, `oak_role`) with real server-side session enforcement (Supabase Auth or equivalent).
- [ ] Gate all `/admin/*` routes server-side (middleware), not just client-side redirect logic.
- [ ] Enforce Role-Based Access Control (RBAC) at both the API layer and the database layer (Row Level Security) — matching the Role Based Access Matrix from the platform spec (Partner / OAK Staff / Presenter / Observer / Coordination Team).
- [ ] Add MFA or IP allowlisting for high-privilege actions (e.g. attendee data export), if warranted by data sensitivity.

## 2. API Route Protection

- [ ] `POST /api/check-in` — require verified session/JWT before processing; reject unauthenticated requests.
- [ ] `GET /api/attendees/export` — require authenticated + authorized (Coordination Team/OAK Staff only) access; currently returns data with no auth check.
- [ ] Add CSRF protection for any browser-originating state-changing requests.
- [ ] Validate request origin on all mutating endpoints.
- [ ] Add rate limiting on check-in, export, and any registration-lookup endpoints to prevent enumeration/brute-force.
- [ ] Add audit logging for check-ins and exports (who, when, what).

## 3. Data Storage

- [ ] Migrate attendee PII out of `localStorage` (mockApi.ts) into a real server-side database.
- [ ] Ensure client-side storage, if any remains, holds only ephemeral tokens — never full attendee records.
- [ ] If any client-side caching of attendee data is required post-migration, encrypt at rest and scope lifetime tightly.

## 4. QR Code / Check-In Security

- [x] ~~Registration ID uses only first UUID segment~~ — fixed: now uses full UUID. *(confirm date fixed: ____)*
- [ ] Replace raw `registrationId`/`qrCodeId` as the QR payload with a short-lived, server-signed token (HMAC or JWT with expiry).
- [ ] Verify QR tokens server-side at check-in time; do not trust client-supplied values directly.
- [ ] Rotate or expire QR tokens after use (prevent replay) or after the event window closes.

## 5. Logging & PII Hygiene

- [x] ~~Mock "confirmation email" logs full PII to console~~ — fixed: redacted from logs. *(confirm date fixed: ____)*
- [ ] Audit all remaining `console.log`/server logs for PII before production deploy.
- [ ] Ensure exported data (CSV/export endpoint) only includes fields actually needed by the requester's role — avoid over-sharing PII (e.g. dietary/accessibility/accommodation details shouldn't be in every export).

## 6. Dependency & Infrastructure Hygiene

- [ ] Run `npm audit --production --audit-level=moderate` and resolve/triage findings.
- [ ] Check `next`, `react`, and `qrcode.react` (or equivalent QR library) specifically for known CVEs/advisories.
- [ ] Add a CI check (grep or lint rule) confirming no `SUPABASE_SERVICE_ROLE_KEY` or other server-only secrets are ever imported into client-bundled files.
- [ ] Set up automated dependency scanning (Dependabot/Snyk/OSV) going forward.

## 7. Sign-off

- [ ] Security review re-run against the real backend implementation (not the mock) before go-live.
- [ ] Confirm all `[ ]` items above are resolved or explicitly accepted as risk by a named owner.

---
*Source: Security audit findings, dated against the frontend-only mock build described in this project's chat history. Update this file as items are resolved.*
