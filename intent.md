# intent.md: Why this problem?

> Draft scaffolded with AI (Claude).

## Context
I used the brief's fictional rewards-settlement case rather than any employer system. All data is synthetic, and no live financial system was touched.

## Problems considered

Each criterion is scored 1–5, where 5 is worst for users, most likely, or cheapest to fix. Scores are **my estimates, not incident data**; there is no real history for this fictional service.

| # | Failure | User impact | Likelihood | Effort (5 = cheap) | Total |
|---|---|:---:|:---:|:---:|:---:|
| 1 | **Boundary task (exactly Mon 00:00Z) paid in two runs**: inclusive upper bound plus no task-level idempotency | 5 | 3 | 4 | **12** |
| 2 | Settlement job retried → second payout for the whole window | 5 | 3 | 4 | 12 |
| 3 | Local-time timestamps (e.g. Lagos +01:00) bucketed into the wrong week | 4 | 4 | 4 | 12 |
| 4 | Notification failure rolls back or blocks the payout | 4 | 2 | 3 | 9 |
| 5 | Payout fails but a "you've been paid" notification is still sent | 3 | 2 | 4 | 9 |

> My reasons fro ranking #1 first
## Why #1 ranked first
Out of the 5 candidate failures, I ranked #1 first because it had the same score as two other options. I broke the tie based on **how much of the root cause it covers**.

The root cause of #1 is missing task-level idempotency and an unclear time interval. Fixing it properly would also solve #2 (retry issues) and make the boundary conditions in #3 clear.

#2 could be fixed with a run-level lock, but that would still allow duplicates across different runs.

#3 is mainly a parsing issue, so fixing it would not prevent double payments.


It is also the hardest to notice: both runs succeed, totals look plausible, and it repeats every week. "Hardest to notice" refers to the double-payout defect as a whole, because both settlement runs complete with no error, no crash, no alert — the totals just look like normal successful payouts

## Affected users
- **Task completers:** They may get paid too much at first and then have the extra money taken back. This can reduce their trust in the system.
- **Finance and ops:** They may see payment records that do not match, without any error being reported.
- **Support:** They may receive support requests from users after their payments are taken back.

## Evidence
- The rule in the brief is explicit: upper bound excluded, task IDs counted once, retries must not pay twice.
- The defect is reproduced in a local fixture (`TC-05`: expected 10, actual 20).
- Likelihood is an estimate from general experience. `<=`/`<` mistakes and batch-scoped de-duplication are common patterns in scheduled jobs. **This is not measured frequency.**

## Intended value
- A runnable regression suite that fails on the faulty logic and passes on the fix, wired as a CI gate.
- Unambiguous written rules (R1–R6) and stated assumptions, so the next engineer doesn't have to re-derive them.

## Non-goals
- Real payment rails, databases, schedulers, auth, UI.
- Admin overrides, account merges and late-arriving tasks (stated as assumptions instead).
- Fixing failures #4 and #5 in depth. They are covered by tests (TC-14–16) but were not the selected defect.
