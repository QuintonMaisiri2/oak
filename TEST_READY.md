# TEST READY: Conference Programme Test Suite Baseline

**Workspace**: `c:\Users\vinmu\Desktop\oak-checkin`  
**Target Route**: `/programme`  
**Test Suite Directory**: `tests/programme/`  
**Date**: 2026-09-08  
**Author**: Test Writer Agent (`test_writer_1`)  
**Status**: COMPLETE — Test Infrastructure & Baseline Established  

---

## 1. Test Suite Summary

An automated, opaque-box, requirement-driven test suite has been designed, implemented, and baselined for the Conference Programme & Documentation feature (`/programme`), strictly derived from `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `AGENTS.md`.

- **Total Test Suites**: 13 Suites
- **Total Test Cases**: 96 Tests across Tiers 1–4 (exceeding minimum requirement of ≥ 50)
- **Framework**: Standalone Zero-Dependency Node.js Test Architecture (Native ES Modules `.mjs`)
- **Execution Script**: `node tests/programme/runner.mjs`

---

## 2. Test Execution Commands

### Run Full Test Suite
```bash
node tests/programme/runner.mjs
```

### Run Specific Test Tier
```bash
# Tier 1: Feature Coverage (F01–F10)
node tests/programme/runner.mjs --tier=1

# Tier 2: Boundary & Corner Cases
node tests/programme/runner.mjs --tier=2

# Tier 3: Cross-Feature Combinations
node tests/programme/runner.mjs --tier=3

# Tier 4: Attendee Real-World Journeys & Security Audit
node tests/programme/runner.mjs --tier=4
```

### Run by Name / Keyword Filter
```bash
# Filter tests matching "sidebar"
node tests/programme/runner.mjs --grep="sidebar"

# Filter tests matching "plenary"
node tests/programme/runner.mjs --grep="plenary"

# Filter tests matching "toggle"
node tests/programme/runner.mjs --grep="toggle"
```

---

## 3. Test Coverage Matrix & Baseline Results

| Tier | Focus | Suite File | Tests | Baseline Passed | Baseline Failed | Notes |
|---|---|---|---|---|---|---|
| **Tier 1** | F01: Top View Toggle | `tier1-features/view-toggle.test.mjs` | 5 | 0 | 5 | Waiting for `ProgrammeToggle.tsx` (M1) |
| **Tier 1** | F02: Day Selector Tabs | `tier1-features/day-selector.test.mjs` | 5 | 0 | 5 | Waiting for `DaySelector.tsx` (M2) |
| **Tier 1** | F03: Opening Plenary Card | `tier1-features/featured-plenary.test.mjs` | 5 | 0 | 5 | Waiting for `FeaturedSessionBanner.tsx` (M2) |
| **Tier 1** | F04: Timeline Session Cards | `tier1-features/timeline-sessions.test.mjs` | 6 | 0 | 6 | Waiting for `SessionCard.tsx` (M2) |
| **Tier 1** | F05: Break Divider Rows | `tier1-features/break-dividers.test.mjs` | 5 | 0 | 5 | Waiting for `BreakDivider.tsx` (M2) |
| **Tier 1** | F06: Session Notes & Avatars | `tier1-features/session-notes.test.mjs` | 5 | 0 | 5 | Waiting for `SessionNotes.tsx` (M3) |
| **Tier 1** | F07: Photo Gallery Grid | `tier1-features/photo-gallery.test.mjs` | 5 | 0 | 5 | Waiting for `PhotoGallery.tsx` (M3) |
| **Tier 1** | F08: Key Takeaways Section | `tier1-features/key-takeaways.test.mjs` | 5 | 0 | 5 | Waiting for `KeyTakeaways.tsx` (M3) |
| **Tier 1** | F09: Downloadable Resources | `tier1-features/resources-list.test.mjs` | 5 | 0 | 5 | Waiting for `ResourcesList.tsx` (M3) |
| **Tier 1** | F10: Sidebar Navigation | `tier1-features/sidebar-nav.test.mjs` | 5 | 3 | 2 | `Sidebar.tsx` missing public `Programme` link (M1) |
| **Tier 2** | Boundary & Corner Cases | `tier2-boundary/boundary-corner-cases.test.mjs` | 19 | 1 | 18 | Privacy test passes; component boundary tests await implementation |
| **Tier 3** | Cross-Feature Combinations| `tier3-combinations/cross-feature.test.mjs` | 14 | 2 | 12 | Navigation logic passes; page integration awaits M3 |
| **Tier 4** | Attendee Journeys & Privacy | `tier4-scenarios/attendee-journeys.test.mjs` | 12 | 12 | 0 | Data models, journeys, and privacy audits pass 100% |
| **TOTAL** | | | **96** | **18 (18.8%)** | **78 (81.2%)** | **Genuine TDD Baseline** |

---

## 4. Implementation Bugs / Missing Features to Escalate

The baseline run revealed the following expected implementation gaps for dispatch to implementation milestones:

1. **Defect in `src/components/Sidebar.tsx` (Milestone M1)**:
   - When on public route `/programme`, `pathname.startsWith('/admin')` returns `false`.
   - `navItems` only contains `Register`.
   - **Escalation**: Update public `navItems` to include `{ name: "Programme", href: "/programme", icon: Calendar }` and `{ name: "Partners", href: "/directory", icon: Globe }`.
2. **Missing Contracts & Datasets (Milestone M1)**:
   - `src/lib/types/programme.ts` does not exist yet.
   - `src/components/programme/data.ts` does not exist yet.
   - `src/components/programme/ProgrammeToggle.tsx` does not exist yet.
3. **Missing Schedule Components (Milestone M2)**:
   - `DaySelector.tsx`, `FeaturedSessionBanner.tsx`, `SessionCard.tsx`, `BreakDivider.tsx`, `ScheduleView.tsx` do not exist yet.
4. **Missing Docs Components & Integration (Milestone M3)**:
   - `SessionNotes.tsx`, `PhotoGallery.tsx`, `KeyTakeaways.tsx`, `ResourcesList.tsx`, `DocsView.tsx` do not exist yet.
   - `src/app/(public)/programme/page.tsx` is currently a 1-line placeholder `<div>Programme</div>`.

---

## 5. Verification Command for Downstream Agents
After completing M1, M2, or M3, the respective worker agent should run:
```bash
node tests/programme/runner.mjs
```
All 96 tests will pass upon completion of Milestone M3 and M4 hardening.
