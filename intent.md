# intent.md: Why this problem?

> Draft scaffolded with AI (Claude). **Edit this into your own words before submitting**, especially the "why I care" line.

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

## Why #1 ranked first
Three options tie on score, so I broke the tie by **coverage of root cause**. #1's root cause is task-level idempotency missing, plus an ambiguous interval. Fixing it properly also fixes #2 (retry) and forces the boundary half of #3 to be specified exactly. #2 alone can be "fixed" with a run-level lock, which would leave cross-run duplicates open. #3 alone is a parsing fix that doesn't stop double payment.

It is also the hardest to notice: both runs succeed, totals look plausible, and it repeats every week.

## Affected users
- **Task completers:** a short-term overpayment, then a clawback. That damages trust more than the original bug.
- **Finance and ops:** reconciliation mismatches with no error logged.
- **Support:** tickets after a clawback.

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
