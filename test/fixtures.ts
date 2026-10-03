// SYNTHETIC DATA — fictional users/tasks for assessment only.
import type { Task, TaskStatus } from "../src/types.js";
import { FakeNotifier, FakePayoutGateway, InMemoryLedger } from "../src/fakes.js";

/** Run for week 41: Tue 2026-10-13 09:00 UTC settles [Mon 2026-10-05 00:00Z, Mon 2026-10-12 00:00Z). */
export const RUN_WEEK_41 = new Date("2026-10-13T09:00:00Z");
/** Next run: Tue 2026-10-20 09:00 UTC settles [Mon 2026-10-12 00:00Z, Mon 2026-10-19 00:00Z). */
export const RUN_WEEK_42 = new Date("2026-10-20T09:00:00Z");
/** Previous run: Tue 2026-10-06 09:00 UTC settles [Mon 2026-09-28 00:00Z, Mon 2026-10-05 00:00Z). */
export const RUN_WEEK_40 = new Date("2026-10-06T09:00:00Z");

export const task = (
  taskId: string,
  completedAt: string,
  userId = "user-a",
  status: TaskStatus = "completed",
): Task => ({ taskId, userId, status, completedAt });

export function freshDeps() {
  return { ledger: new InMemoryLedger(), gateway: new FakePayoutGateway(), notifier: new FakeNotifier() };
}
