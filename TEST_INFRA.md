# OAK Check-in Programme Page: Test Infrastructure & Specification

**Target Route**: `/programme` (Public Conference Programme & Documentation)  
**Authoritative Request**: `ORIGINAL_REQUEST.md` (R1: Layout & Nav, R2: Schedule View, R3: Docs View, AC 38, 39, 42, 43, 44)  
**Project Plan**: `.agents/orchestrator/PROJECT.md`  
**System Constraints**: `AGENTS.md` (Next.js 16.3.4, React 19, Tailwind v4 `@theme inline`, zero PII leaks)  
**Version**: 1.0.0  
**Status**: Baseline Test Suite Established  

---

## 1. Test Philosophy & Principles

### 1.1 Requirement-Driven & Authoritative Expected Outputs
Every test in this suite is derived strictly from observable requirements defined in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and companion survey analyses. No expected output is arbitrary or reverse-engineered from incomplete implementations:
- **R1 (Programme Layout & Navigation)**: Top view switcher between "Schedule" and "Docs"; Sidebar active item highlighting.
- **R2 (Schedule View)**: Horizontal Day Selector (Day 1, 2, 3), Featured Opening Plenary banner card, timeline session cards with colored category badges, locations, speakers, and break dividers.
- **R3 (Docs View)**: Session Notes with author avatars and timestamps, responsive Photo Gallery grid, numbered Key Takeaways, and Downloadable Resources (PDF/DOCX) with download icons.
- **AC 44 (Navigation Contract)**: When on `/programme`, public navigation displays and highlights the "Programme" tab with active styling (`bg-primary text-white`).
- **Data Privacy Guarantee**: Public route `/programme` must never import or expose sensitive attendee personal data (`email`, `phone`, `dietary`, `accessibility`, `travelNeeds`).

### 1.2 Opaque-Box (Black-Box) Testing
Tests evaluate observable contracts, external interfaces, and user-facing artifacts rather than internal component implementation trivia:
- Rendered UI structure, accessible DOM roles, aria attributes, label text, and hierarchy.
- CSS design token compliance: Primary navy (`#1C2A48` / `bg-primary`), surface white (`bg-surface`), border borders (`border-border`), and category badge color mappings.
- State transitions triggered by user interaction (switching between Schedule and Docs, selecting Day 1/2/3).
- Data model integrity: Strict schema conformance against TypeScript interfaces in `src/lib/types/programme.ts`.

### 1.3 Anti-Facade Discipline
- No placeholder or trivial `expect(true).toBe(true)` tests.
- Every test must fail when the corresponding feature or requirement is missing or defectively implemented.
- The test suite establishes a strict baseline against the initial codebase, identifying missing files and architectural defects before implementation begins.

---

## 2. Feature Inventory & Test Coverage Matrix

The suite covers 10 primary features across 4 testing tiers, guaranteeing comprehensive depth:

| # | Feature | Scope / Requirement | Tier 1 (Unit/Feature) | Tier 2 (Boundaries) | Tier 3 (Cross-Feature) | Tier 4 (Journeys) | Total Tests |
|---|---------|---------------------|----------------------|--------------------|------------------------|-------------------|-------------|
| **F01** | **Top View Toggle** | Switch between Schedule and Docs views (`ORIGINAL_REQUEST.md` R1) | 5 tests | 2 tests | 2 tests | 2 tests | 11 |
| **F02** | **Day Selector** | Day 1, Day 2, Day 3 pill tabs with active state (`ORIGINAL_REQUEST.md` R2) | 5 tests | 2 tests | 2 tests | 1 test | 10 |
| **F03** | **Featured Plenary Card** | Hero navy banner card with title, speaker, room, glow (`ORIGINAL_REQUEST.md` R2) | 5 tests | 2 tests | 1 test | 1 test | 9 |
| **F04** | **Timeline Session Cards** | Time, title, speaker, location, category badges (`ORIGINAL_REQUEST.md` R2) | 6 tests | 2 tests | 1 test | 1 test | 10 |
| **F05** | **Break Divider Rows** | Interspersed breaks (Registration, Coffee, Lunch) (`ORIGINAL_REQUEST.md` R2) | 5 tests | 1 test | 1 test | 1 test | 8 |
| **F06** | **Session Notes & Avatars** | Notes cards, author names, roles, avatar circles (`ORIGINAL_REQUEST.md` R3) | 5 tests | 2 tests | 1 test | 1 test | 9 |
| **F07** | **Photo Gallery Grid** | Responsive photo grid with aspect ratio & captions (`ORIGINAL_REQUEST.md` R3) | 5 tests | 2 tests | 1 test | 1 test | 9 |
| **F08** | **Key Takeaways** | Numbered strategic findings with headings (`ORIGINAL_REQUEST.md` R3) | 5 tests | 1 test | 1 test | 1 test | 8 |
| **F09** | **Resources List** | Downloadable files (PDF, DOCX) with format badges (`ORIGINAL_REQUEST.md` R3) | 5 tests | 2 tests | 1 test | 1 test | 9 |
| **F10** | **Sidebar Active Highlighting**| Public nav displays & highlights Programme (`ORIGINAL_REQUEST.md` AC 44) | 5 tests | 1 test | 2 tests | 1 test | 9 |
| **SEC** | **Privacy & Bundle Contract**| Zero attendee PII leakage on public route (`AGENT-INSTRUCTIONS.md`) | — | 2 tests | 1 test | 1 test | 4 |
| **TOTAL**| | | **51 tests** | **19 tests** | **14 tests** | **12 tests** | **96 tests** |

*(Exceeds the required minimum of ≥ 50 tests; provides 96 granular, independent test cases.)*

---

## 3. Test Tier Definitions

### Tier 1: Feature Coverage (Primary Behavior / Happy Path)
- Validates the direct functional specification of each of the 10 features under normal operating inputs.
- Verifies that all required fields, labels, icons, badges, and layout containers exist and render expected content.
- Minimum 5 test cases per feature (51 total in Tier 1).

### Tier 2: Boundary & Corner Cases
- Tests extreme inputs, missing fields, empty data collections, and error handling:
  - Empty sessions on a day.
  - Extremely long titles and speaker descriptions.
  - Missing speaker information or unassigned locations.
  - Invalid / nonexistent day identifiers.
  - Notes without avatar URLs (verifying initials fallback).
  - Rapid view switching and invalid URL query parameters.
  - Resources with extreme file sizes or missing download links.

### Tier 3: Cross-Feature Combinations
- Tests interaction contracts and state preservation across multiple components:
  - Selecting Day 2 or Day 3, switching to Docs, then switching back to Schedule (verifying Day state persistence).
  - Sidebar navigation state when navigating between `/register`, `/programme`, and `/directory`.
  - Day filtering synchronizing with timeline items and Plenary banner visibility.
  - Responsive layout constraints: mobile stacked layout vs desktop sidebar grid.

### Tier 4: Real-World Attendee Scenarios & User Journeys
- Simulates realistic multi-step attendee workflows:
  - **Journey 1**: Morning Attendee arriving at Cresta Lodge, checking Day 1 schedule, finding Opening Plenary in Main Hall A, noting 10:30 coffee break.
  - **Journey 2**: Afternoon Researcher looking for Workshop sessions on MEL, checking speaker details, and switching to Docs view to read published session notes.
  - **Journey 3**: Partner Representative reviewing convening Key Takeaways (numbered 1–4) and downloading the official Programme Guide PDF (3.4 MB).
  - **Journey 4**: Security & Privacy Audit verifying no sensitive attendee database columns are sent to the client on `/programme`.

---

## 4. Test Architecture & Directory Layout

The test suite is located in `tests/programme/` and designed to run with zero external binary dependencies via standard Node.js:

```
tests/programme/
├── fixtures/
│   ├── mock-programme-data.mjs        # Standard 3-day convening schedule & docs data
│   ├── boundary-test-data.mjs         # Malformed, empty, and extreme boundary cases
│   └── test-utils.mjs                 # Assertion helpers, DOM/JSX parsers, color checkers
├── tier1-features/
│   ├── view-toggle.test.mjs           # 5 tests: F01 Top View Toggle
│   ├── day-selector.test.mjs          # 5 tests: F02 Day Selector Tabs
│   ├── featured-plenary.test.mjs      # 5 tests: F03 Opening Plenary Card
│   ├── timeline-sessions.test.mjs     # 6 tests: F04 Timeline Session Cards
│   ├── break-dividers.test.mjs        # 5 tests: F05 Break Divider Rows
│   ├── session-notes.test.mjs         # 5 tests: F06 Session Notes & Avatars
│   ├── photo-gallery.test.mjs         # 5 tests: F07 Photo Gallery Grid
│   ├── key-takeaways.test.mjs         # 5 tests: F08 Key Takeaways Section
│   ├── resources-list.test.mjs        # 5 tests: F09 Downloadable Resources
│   └── sidebar-nav.test.mjs           # 5 tests: F10 Sidebar Navigation & Highlighting
├── tier2-boundary/
│   └── boundary-corner-cases.test.mjs # 19 tests: Empty data, long text, invalid dates, etc.
├── tier3-combinations/
│   └── cross-feature.test.mjs         # 14 tests: Day persistence, URL params, nav flow
├── tier4-scenarios/
│   └── attendee-journeys.test.mjs     # 12 tests: Full attendee journeys & security audit
└── runner.mjs                         # Central test runner with summary reporting
```

---

## 5. Test Execution & Reporting

### 5.1 Test Execution Command
The test suite can be run at any time via Node:

```bash
node tests/programme/runner.mjs
```

Or for a specific tier:
```bash
node tests/programme/runner.mjs --tier=1
node tests/programme/runner.mjs --tier=2
node tests/programme/runner.mjs --tier=3
node tests/programme/runner.mjs --tier=4
```

Or with filtered pattern matching:
```bash
node tests/programme/runner.mjs --grep="sidebar"
```

### 5.2 Reporting Format
The runner outputs clean, structured ANSI-colored console logs with:
- Individual test suite name and status (`PASS` / `FAIL`).
- Per-test case result with assertion error diagnostics if failing.
- Summary block detailing:
  - Total Tests Run
  - Total Passed
  - Total Failed
  - Success Percentage
  - Execution Duration in milliseconds
- Proper exit codes (`0` if all passed, `1` if any test fails) for seamless CI integration.

---

## 6. Authoritative Baseline Findings (Pre-Implementation)

Running the test suite against the initial codebase produces clear, anticipated baseline failures corresponding to missing files and known defects:

1. **Sidebar Navigation Defect (`Sidebar.tsx`)**:
   - `Sidebar.tsx` omits `Programme` when on public routes (`pathname.startsWith('/admin') === false`).
   - Baseline status: **FAIL** (Expected until M1 Worker fixes `Sidebar.tsx`).
2. **Missing Types Contract (`src/lib/types/programme.ts`)**:
   - Programme types file does not exist yet.
   - Baseline status: **FAIL** (Expected until M1 Worker creates contracts).
3. **Missing Mock Dataset (`src/components/programme/data.ts`)**:
   - Baseline status: **FAIL** (Expected until M1 Worker creates mock dataset).
4. **Placeholder Programme Page (`src/app/(public)/programme/page.tsx`)**:
   - Currently returns `<div>Programme</div>`.
   - Baseline status: **FAIL** (Expected until M3 Worker integrates complete page).
5. **Missing Component Implementations (`src/components/programme/*`)**:
   - `ProgrammeToggle.tsx`, `DaySelector.tsx`, `FeaturedSessionBanner.tsx`, `SessionCard.tsx`, `BreakDivider.tsx`, `ScheduleView.tsx`, `SessionNotes.tsx`, `PhotoGallery.tsx`, `KeyTakeaways.tsx`, `ResourcesList.tsx`, `DocsView.tsx` do not exist yet.
   - Baseline status: **FAIL** (Expected until M1, M2, M3 workers implement components).

This establishes a 100% rigorous, non-facade baseline against which implementation progress can be objectively measured.
