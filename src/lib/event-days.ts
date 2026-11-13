/**
 * OAK Grantee Convening 2026 Event Days Utility
 * Event Location: Harare, Zimbabwe (Africa/Harare, UTC+2)
 * Convening Dates: 9–11 November 2026
 * Day 1: 2026-11-09
 * Day 2: 2026-11-10
 * Day 3: 2026-11-11
 */

export const CONVENING_DATES = {
  DAY_1: "2026-11-09",
  DAY_2: "2026-11-10",
  DAY_3: "2026-11-11",
} as const;

export const CONVENING_DAYS_LIST = [
  { id: "2026-11-09", label: "Day 1 (Mon, 9 Nov 2026)", shortName: "Day 1 (9 Nov)", dayNumber: 1 },
  { id: "2026-11-10", label: "Day 2 (Tue, 10 Nov 2026)", shortName: "Day 2 (10 Nov)", dayNumber: 2 },
  { id: "2026-11-11", label: "Day 3 (Wed, 11 Nov 2026)", shortName: "Day 3 (11 Nov)", dayNumber: 3 },
] as const;

/**
 * Returns the current calendar date string in YYYY-MM-DD format in Harare time (Africa/Harare, UTC+2).
 */
export function getHarareDateString(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Harare",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

/**
 * Automatically detects the active check-in day.
 * - If today's date matches Day 1, 2, or 3 of the convening, returns that date.
 * - If NEXT_PUBLIC_EVENT_DAY environment variable is explicitly set, respects it.
 * - Otherwise, automatically returns today's actual local date string.
 */
export function getAutoEventDay(): string {
  const harareToday = getHarareDateString();

  // If today matches Day 1, 2, or 3 of the convening
  if (
    harareToday === CONVENING_DATES.DAY_1 ||
    harareToday === CONVENING_DATES.DAY_2 ||
    harareToday === CONVENING_DATES.DAY_3
  ) {
    return harareToday;
  }

  // If explicit environment override is provided
  if (process.env.NEXT_PUBLIC_EVENT_DAY) {
    return process.env.NEXT_PUBLIC_EVENT_DAY;
  }

  // Default to today's auto-detected local calendar date
  return harareToday;
}

/**
 * Which convening day the programme should open on, in Harare time:
 * Day 1 before the convening, today's day during it, and the last day afterwards.
 * Returns a 0-based index, clamped to the number of days available.
 */
export function getCurrentProgrammeDayIndex(dayCount: number, date: Date = new Date()): number {
  if (dayCount <= 0) return 0;
  const today = getHarareDateString(date);
  const dates = CONVENING_DAYS_LIST.map(day => day.id as string);
  let index: number;
  if (today < dates[0]) index = 0;
  else if (today > dates[dates.length - 1]) index = dates.length - 1;
  else index = Math.max(0, dates.indexOf(today));
  return Math.min(index, dayCount - 1);
}

/**
 * Returns human-friendly label and metadata for any event date
 */
export function getEventDayInfo(dateStr: string): {
  id: string;
  label: string;
  shortName: string;
  dayNumber: number | null;
  isConveningDay: boolean;
  isToday: boolean;
} {
  const harareToday = getHarareDateString();
  const isToday = dateStr === harareToday;

  switch (dateStr) {
    case CONVENING_DATES.DAY_1:
      return {
        id: dateStr,
        label: isToday ? "Day 1 (9 Nov) · Today" : "Day 1 (Mon, 9 Nov 2026)",
        shortName: "Day 1 (9 Nov)",
        dayNumber: 1,
        isConveningDay: true,
        isToday,
      };
    case CONVENING_DATES.DAY_2:
      return {
        id: dateStr,
        label: isToday ? "Day 2 (10 Nov) · Today" : "Day 2 (Tue, 10 Nov 2026)",
        shortName: "Day 2 (10 Nov)",
        dayNumber: 2,
        isConveningDay: true,
        isToday,
      };
    case CONVENING_DATES.DAY_3:
      return {
        id: dateStr,
        label: isToday ? "Day 3 (11 Nov) · Today" : "Day 3 (Wed, 11 Nov 2026)",
        shortName: "Day 3 (11 Nov)",
        dayNumber: 3,
        isConveningDay: true,
        isToday,
      };
    default: {
      return {
        id: dateStr,
        label: isToday ? `Today (${dateStr})` : `Date (${dateStr})`,
        shortName: isToday ? `Today` : dateStr,
        dayNumber: null,
        isConveningDay: false,
        isToday,
      };
    }
  }
}
