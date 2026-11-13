# Original User Request

## Initial Request — 2026-09-08T07:53:43Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

Build the `/programme` page matching the two mockups, implementing a toggle to switch between the "Schedule" timeline view and the "Docs" resources view.

Working directory: c:\Users\vinmu\Desktop\oak-checkin
Integrity mode: benchmark

## Requirements

### R1. Programme Layout & Navigation
Build the `/programme` page matching the layout in `Programme Web version.png` and `Programme 2 Web version.png`. Implement the top toggle (Schedule / Docs) to switch between the two views.

### R2. Schedule View
Implement the "Schedule" view:
- A horizontal day selector (Day 1, Day 2, Day 3) that highlights the active day.
- A featured "Opening Plenary" banner card at the top.
- A timeline list of sessions below, interspersed with simple divider rows for breaks (e.g., "08:00 Registration & Welcome Coffee", "10:30 Coffee Break").
- Each session card must include the time block, title, speaker, location, and a colored category badge (e.g., Breakout, Workshop).

### R3. Docs View
Implement the "Docs" view:
- A "Session Notes" section listing dummy notes with author avatars.
- A masonry or grid "Photo Gallery" section.
- A "Key Takeaways" numbered list section.
- A "Resources" section listing downloadable files (PDFs, DOCX) with download icons.

## Acceptance Criteria

### Verification & Linting
- [ ] The Next.js project successfully compiles (`npx tsc --noEmit` returns 0 errors).
- [ ] The Next.js project passes linting (`npm run lint` returns 0 errors).

### Functionality & UI
- [ ] The user can click the toggle to switch seamlessly between "Schedule" and "Docs" views.
- [ ] The UI faithfully replicates the design, spacing, colors, and layout of both mockups.
- [ ] The sidebar navigation correctly highlights "Programme" as the active tab.
