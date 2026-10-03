# DEFECT-001: Task completed at exactly Monday 00:00 UTC is paid in two consecutive settlement runs

| Field | Value |
|---|---|
| Component | Weekly rewards settlement (`src/settle.faulty.ts`), synthetic fixture |
| Severity | **Critical / S1**: release blocker |
| Status | Fixed in `src/settle.ts`; regression suite in place |
| Environment | Local Node 20.20.2, Vitest, in-memory fakes. **No live system was tested.** |

## Summary
A task whose `completedAt` instant equals the window's upper bound (Monday 00:00:00 UTC) is included in the run that should exclude it **and** in the following run. The user receives 20 credits for one task and two "you've been paid" notifications.

## Reproduction
```bash
npm ci
IMPL=faulty npx vitest run -t "TC-05"
```
Manual equivalent:
1. Feed `{taskId: "t-boundary", userId: "user-a", status: "completed", completedAt: "2026-10-12T00:00:00Z"}`.
2. Run settlement at `2026-10-13T09:00Z` (window 2026-10-05 → 2026-10-12).
3. Run settlement at `2026-10-20T09:00Z` with the same (overlapping) feed.
4. Inspect gateway payouts for `user-a`.

The same timestamp written as `2026-10-12T01:00:00+01:00` (Lagos local time) triggers it too (TC-09).

## Expected vs actual
| | Expected | Actual (faulty) |
|---|---|---|
| Run W41 | 0 credits (task is outside `[start, end)`) | 10 credits |
| Run W42 | 10 credits | 10 credits |
| **Total** | **10**, 1 notification | **20**, 2 notifications |

## Severity rationale
- **Impact:** real value is paid out twice, and recovering it from users is costly and damages trust. Both runs report success, so nothing alerts anyone.
- **Likelihood (estimate, not incident data):** the exact-midnight case is rare for human activity. But batch systems, imports and clock truncation often stamp `00:00:00` exactly, and the defect recurs weekly. The same missing idempotency also double-pays on any manual re-run (TC-12, TC-15), which is far more common than the boundary case.
- **Detectability:** low. Totals look plausible.

## Root cause
Two independent flaws combine:
1. **Flaw A: closed interval.** `at <= window.end` instead of `at < window.end`, so the boundary instant belongs to two windows.
2. **Flaw B: idempotency scoped to the batch, not the task.** De-duplication used an in-run `Set` only; the ledger of past payouts was never consulted, so nothing stopped the next run (or a retry) from paying again.

Flaw A alone pays a task in the wrong week. Flaw B alone double-pays on any retry or overlapping feed. Together, they double-pay silently every week a task lands on the boundary.

## Fix (implemented in `src/settle.ts`)
1. Half-open window: `at >= start && at < end`.
2. Skip any task where `ledger.isPaid(taskId)`. Record the ledger entry per task only after a successful payout.
3. Pass an idempotency key (`userId:sortedTaskIds`) to the gateway.
4. Reject timestamps without an explicit offset.

**Recommended for production (not implemented here):** a unique constraint on `task_id` in the payout ledger, and writing the ledger row in the same transaction as the payout intent (outbox pattern), so a crash between "paid" and "recorded" cannot cause a re-pay.

## Evidence
- `results/faulty-run.txt`: 6 failed / 12 passed. TC-05 shows `expected 20 to be 10`.
- `results/fixed-run.txt`: 18 / 18 passed.
- Mutation check (see `docs/test-cases.md`): each flaw on its own is caught by a different subset of cases.

## Release checks that block this failure
1. `npm run verify` in CI: the whole suite must pass on the shipped implementation **and** must fail on the faulty reference. The second condition stops someone weakening the tests until they pass.
2. Boundary cases (TC-04, TC-09), retry/idempotency cases (TC-12, TC-13, TC-15) and the combined case (TC-05) are mandatory; none may be skipped.
3. The PR checklist requires every new window or date comparison to state whether it is inclusive or exclusive.
4. Production-only control (proposed): a post-run reconciliation that alerts if any `task_id` appears in more than one payout.
