// FAULTY implementation — intentionally reproduces the defect under study.
// Kept in the repo so the regression suite can be shown failing against it.
//
// Defect: a task completed at exactly Monday 00:00:00 UTC is paid in TWO consecutive runs.
//   Flaw A: upper bound compared with `<=` (closed interval) instead of `<`.
//   Flaw B: de-duplication only within the current batch; the ledger of past payouts
//           is never consulted, so nothing stops the next run paying the same task.
// Either flaw alone is a bug; together they produce a silent double payout.
import { CREDITS_PER_TASK, type SettleFn, type Task, type UserPayout } from "./types.js";
import { parseInstant, settlementWindowFor } from "./window.js";

export const settleFaulty: SettleFn = (tasks, runAt, { ledger, gateway, notifier }) => {
  const window = settlementWindowFor(runAt);

  const qualifying = tasks.filter((t) => {
    if (t.status !== "completed") return false;
    const at = parseInstant(t.completedAt).getTime();
    return at >= window.start.getTime() && at <= window.end.getTime(); // FLAW A
  });

  const seen = new Set<string>();
  const payable: Task[] = [];
  for (const t of qualifying) {
    if (seen.has(t.taskId)) continue; // FLAW B: no ledger.isPaid() check
    seen.add(t.taskId);
    payable.push(t);
  }

  const byUser = new Map<string, Task[]>();
  for (const t of payable) byUser.set(t.userId, [...(byUser.get(t.userId) ?? []), t]);

  const payouts: UserPayout[] = [];
  for (const [userId, userTasks] of byUser) {
    const credits = userTasks.length * CREDITS_PER_TASK;
    const taskIds = userTasks.map((t) => t.taskId).sort();
    try {
      gateway.pay(userId, credits, `${userId}:${taskIds.join(",")}`);
    } catch {
      payouts.push({ userId, taskIds, credits, payoutStatus: "failed", notificationStatus: "skipped" });
      continue;
    }
    for (const t of userTasks) ledger.record(t.taskId, userId, CREDITS_PER_TASK, window.start);
    let notificationStatus: UserPayout["notificationStatus"] = "sent";
    try {
      notifier.notify(userId, credits);
    } catch {
      notificationStatus = "failed";
    }
    payouts.push({ userId, taskIds, credits, payoutStatus: "paid", notificationStatus });
  }

  const totalCredits = payouts.filter((p) => p.payoutStatus === "paid").reduce((a, p) => a + p.credits, 0);
  return { window, payouts, totalCredits };
};
