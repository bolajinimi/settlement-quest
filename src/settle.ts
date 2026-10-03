// CORRECTED reference implementation.
import {
  CREDITS_PER_TASK,
  type SettleFn,
  type Task,
  type UserPayout,
} from "./types.js";
import { parseInstant, settlementWindowFor } from "./window.js";

export const settle: SettleFn = (tasks, runAt, { ledger, gateway, notifier }) => {
  const window = settlementWindowFor(runAt);

  // 1. Qualify: completed, inside the HALF-OPEN window [start, end).
  const qualifying = tasks.filter((t) => {
    if (t.status !== "completed") return false;
    const at = parseInstant(t.completedAt).getTime();
    return at >= window.start.getTime() && at < window.end.getTime(); // FIX #1: strict `<`
  });

  // 2. De-duplicate within this batch AND against everything ever paid (ledger).
  const seen = new Set<string>();
  const payable: Task[] = [];
  for (const t of qualifying) {
    if (seen.has(t.taskId) || ledger.isPaid(t.taskId)) continue; // FIX #2: persistent idempotency
    seen.add(t.taskId);
    payable.push(t);
  }

  // 3. Group per user; one payout + one notification per user per run.
  const byUser = new Map<string, Task[]>();
  for (const t of payable) byUser.set(t.userId, [...(byUser.get(t.userId) ?? []), t]);

  const payouts: UserPayout[] = [];
  for (const [userId, userTasks] of byUser) {
    const credits = userTasks.length * CREDITS_PER_TASK;
    const taskIds = userTasks.map((t) => t.taskId).sort();
    const idempotencyKey = `${userId}:${taskIds.join(",")}`;

    try {
      gateway.pay(userId, credits, idempotencyKey);
    } catch {
      // Payout failed: record nothing, notify nothing. Tasks stay eligible for a later run.
      payouts.push({ userId, taskIds, credits, payoutStatus: "failed", notificationStatus: "skipped" });
      continue;
    }
    for (const t of userTasks) ledger.record(t.taskId, userId, CREDITS_PER_TASK, window.start);

    // Notification only after a successful payout; its failure never reverses the payout.
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
