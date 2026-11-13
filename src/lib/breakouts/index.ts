import { BREAKOUT_GROUPS_SNAPSHOT_CSV } from "./snapshot";
import { BREAKOUT_ADDITIONS } from "./additions";

export const BREAKOUT_SHEET_ID = "15ekyPgsZthjQqD0MEa5ExLkN8ILTlK-JEIiR0wxXN-k";

export interface BreakoutRound {
  /** Column label without the time, e.g. "First Round". */
  label: string;
  /** Time range as written in the sheet header, e.g. "12:00–13:15". Empty when absent. */
  time: string;
}

export interface BreakoutMember {
  name: string;
  organisation: string;
}

export interface BreakoutGroup {
  name: string;
  /** Session topic per round, same order as `rounds`. */
  sessions: string[];
  members: BreakoutMember[];
}

export interface BreakoutData {
  rounds: BreakoutRound[];
  groups: BreakoutGroup[];
  source: "live" | "snapshot";
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.map(r => r.map(cell => cell.trim())).filter(r => r.some(Boolean));
}

function parseRound(header: string): BreakoutRound {
  const match = header.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return match ? { label: match[1].trim(), time: match[2].trim() } : { label: header.trim(), time: "" };
}

/**
 * Turns the sheet (Group, Name, Organisation, <round columns>...) into groups.
 * Rounds are every column after Organisation; a group's session for a round is
 * the most common value among its members.
 */
export function parseBreakoutCsv(text: string): Omit<BreakoutData, "source"> {
  const [header, ...rows] = parseCsv(text);
  if (!header) return { rounds: [], groups: [] };
  const lower = header.map(h => h.toLowerCase());
  const groupIdx = lower.indexOf("group");
  const nameIdx = lower.indexOf("name");
  const orgIdx = lower.findIndex(h => h.startsWith("organi"));
  if (groupIdx < 0 || nameIdx < 0) throw new Error("Breakout sheet is missing Group or Name columns");
  const roundIdx = header.map((_, i) => i).filter(i => i > Math.max(groupIdx, nameIdx, orgIdx));
  const rounds = roundIdx.map(i => parseRound(header[i]));

  const byGroup = new Map<string, { members: BreakoutMember[]; tallies: Map<string, number>[] }>();
  for (const row of rows) {
    const group = row[groupIdx];
    const name = row[nameIdx];
    if (!group || !name) continue;
    let entry = byGroup.get(group);
    if (!entry) {
      entry = { members: [], tallies: roundIdx.map(() => new Map()) };
      byGroup.set(group, entry);
    }
    entry.members.push({ name, organisation: orgIdx >= 0 ? row[orgIdx] ?? "" : "" });
    roundIdx.forEach((col, r) => {
      const session = row[col];
      if (session) entry!.tallies[r].set(session, (entry!.tallies[r].get(session) ?? 0) + 1);
    });
  }

  const groups: BreakoutGroup[] = [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([name, { members, tallies }]) => ({
      name,
      members: members.sort((a, b) => a.name.localeCompare(b.name)),
      sessions: tallies.map(t => [...t.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""),
    }));

  return { rounds, groups };
}

/** Adds people placed in code (see additions.ts) unless the sheet already lists them somewhere. */
export function withAdditions(groups: BreakoutGroup[]): BreakoutGroup[] {
  const listed = new Set(groups.flatMap(g => g.members.map(m => normName(m.name))));
  const result = groups.map(g => ({ ...g, members: [...g.members] }));
  for (const { group, ...member } of BREAKOUT_ADDITIONS) {
    const target = result.find(g => g.name === group);
    if (!target || listed.has(normName(member.name))) continue;
    target.members.push(member);
    listed.add(normName(member.name));
  }
  result.forEach(g => g.members.sort((a, b) => a.name.localeCompare(b.name)));
  return result;
}

/** Fetches the live sheet (cached for 5 minutes); falls back to the bundled snapshot. */
export async function getBreakoutGroups(): Promise<BreakoutData> {
  const sheetId = process.env.BREAKOUT_SHEET_ID?.trim() || BREAKOUT_SHEET_ID;
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Sheet responded ${res.status}`);
    const text = await res.text();
    if (text.trimStart().startsWith("<")) throw new Error("Sheet is not publicly readable");
    const parsed = parseBreakoutCsv(text);
    if (parsed.groups.length === 0) throw new Error("Sheet has no groups");
    return { ...parsed, groups: withAdditions(parsed.groups), source: "live" };
  } catch (error) {
    console.warn("[breakouts] using snapshot:", error instanceof Error ? error.message : error);
    const snapshot = parseBreakoutCsv(BREAKOUT_GROUPS_SNAPSHOT_CSV);
    return { ...snapshot, groups: withAdditions(snapshot.groups), source: "snapshot" };
  }
}

const normName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, " ").trim();

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

const sameOrganisation = (a: string, b: string) => {
  const x = normName(a);
  const y = normName(b);
  return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
};

export interface MyBreakout {
  group: BreakoutGroup;
  member: BreakoutMember;
}

/**
 * Finds the group an attendee is in. Exact name match first; otherwise a near-identical spelling
 * (at most 2 letters different, e.g. "Hilda"/"Hildah") at the same organisation, and only when unambiguous.
 */
export function findMyBreakout(
  groups: BreakoutGroup[],
  person: { firstName: string; lastName: string; organisation?: string | null },
): MyBreakout | null {
  const full = normName(`${person.firstName} ${person.lastName}`);
  if (!full) return null;
  const all = groups.flatMap(group => group.members.map(member => ({ group, member })));

  const exact = all.filter(e => normName(e.member.name) === full);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    const atOrg = exact.filter(e => sameOrganisation(e.member.organisation, person.organisation ?? ""));
    return atOrg.length === 1 ? atOrg[0] : null;
  }

  const near = all.filter(
    e => sameOrganisation(e.member.organisation, person.organisation ?? "") && editDistance(normName(e.member.name), full) <= 2,
  );
  return near.length === 1 ? near[0] : null;
}
