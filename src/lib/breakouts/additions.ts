import type { BreakoutMember } from "./index";

/**
 * People placed in a breakout group here because they are missing from the Google Sheet.
 * If the sheet later lists them, the sheet wins and the entry here is skipped.
 */
export const BREAKOUT_ADDITIONS: (BreakoutMember & { group: string })[] = [
  { group: "Group C", name: "Mercy Muirimi", organisation: "FOST" },
];
