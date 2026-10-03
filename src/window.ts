import type { SettlementWindow } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Business rule: the run on Tuesday 09:00 UTC settles
 * [previous Monday 00:00 UTC, this Monday 00:00 UTC) — upper bound excluded.
 *
 * Generalised: `end` is the most recent Monday 00:00 UTC at or before `runAt`,
 * `start` is 7 days earlier. All arithmetic is in UTC; no local time is used.
 */
export function settlementWindowFor(runAt: Date): SettlementWindow {
  const midnight = Date.UTC(runAt.getUTCFullYear(), runAt.getUTCMonth(), runAt.getUTCDate());
  const dow = new Date(midnight).getUTCDay(); // 0 = Sun, 1 = Mon
  const daysSinceMonday = (dow + 6) % 7;
  const end = new Date(midnight - daysSinceMonday * DAY_MS);
  const start = new Date(end.getTime() - 7 * DAY_MS);
  return { start, end };
}

/** Parse an offset-bearing ISO timestamp to an absolute instant. Rejects offset-less input. */
export function parseInstant(iso: string): Date {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(iso)) {
    throw new Error(`Timestamp must carry an explicit offset: ${iso}`);
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid timestamp: ${iso}`);
  return d;
}
