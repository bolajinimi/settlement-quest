// Selects the implementation under test: IMPL=faulty | fixed (default: fixed).
import type { SettleFn } from "./types.js";
import { settle } from "./settle.js";
import { settleFaulty } from "./settle.faulty.js";

export const IMPL = (process.env.IMPL ?? "fixed").toLowerCase();
if (IMPL !== "fixed" && IMPL !== "faulty") {
  throw new Error(`IMPL must be "fixed" or "faulty", got "${IMPL}"`);
}
export const settleUnderTest: SettleFn = IMPL === "faulty" ? settleFaulty : settle;
