# directive.md: Prevent boundary double-payout in weekly rewards settlement

> Items marked **TODO(you)** can only be filled in by you. Do not submit with them unresolved.

## Objective
Guarantee that each completed task is paid exactly once, in the correct weekly window. Prove it with an automated regression that fails against the faulty settlement logic and passes against the corrected implementation.

## Scope
**In scope:** the settlement window calculation, task eligibility, task-level idempotency, the payout→notification ordering, and partial-failure handling, all in a local synthetic fixture.
**Out of scope:** live systems, real money, persistence, scheduling infrastructure, admin settings.

## Requirements
1. The window is half-open `[prev Mon 00:00Z, this Mon 00:00Z)` for the Tue 09:00Z run (R1).
2. Only `completed` tasks qualify; 10 credits each (R2, R3).
3. A task ID is paid at most once across batches, retries and runs (R4).
4. Notify only after a successful payout; notification failure never reverses the payout (R5).
5. A failed payout records nothing and stays retryable (R6).
6. Timestamps carry explicit offsets and are compared as UTC instants; offset-less input is rejected.
7. At least 8 test cases covering the happy path, cut-off, timezone, duplicate, retry and partial failure.
8. One command reproduces red (faulty) and green (fixed).

## Completion criteria
- [x] `npm run verify` exits 0, which means faulty is red and fixed is green.
- [x] ≥ 8 cases with inputs and expected outcomes documented (18 delivered).
- [x] Defect report with repro, expected vs actual, severity, root cause, evidence, fix and blocking checks.
- [x] Release checklist with a go/no-go decision.
- [x] CI workflow observed passing on GitHub (run 37094239581).
- [ ] Every link below opened from a logged-out or reviewer account. **TODO(you)**

---

# Appendix: Results and handoff

## Artifact links
| Artifact | Link |
|---|---|
| Repository (runnable test project) | `https://github.com/bolajinimi/settlement-quest` |
| Test cases + results | `docs/test-cases.md` |
| Defect / root-cause report | `docs/defect-report.md` |
| Release-readiness checklist | `docs/release-checklist.md` |
| Raw test output | `results/faulty-run.txt`, `results/fixed-run.txt` |
| CI run | `https://github.com/bolajinimi/settlement-quest/actions/runs/37094239581` (success) |
| Loom | **TODO(you)** |

## Reproduce
Requires Node 20+.
```bash
git clone https://github.com/bolajinimi/settlement-quest && cd settlement-quest
npm ci
npm run verify            # typecheck → faulty (expect FAIL) → fixed (expect PASS)
npm run test:faulty       # see the defect
npm run test:fixed        # see the fix
IMPL=faulty npx vitest run -t "TC-05"   # just the selected defect
```

## Actual results
| Implementation | Passed | Failed | Failing cases |
|---|---|---|---|
| faulty | 12 | 6 | TC-04, 05, 09, 12, 13, 15 |
| fixed | 18 | 0 | none |

Mutation check (each flaw alone): inclusive bound only → TC-04, 09 fail; missing ledger check only → TC-12, 13, 15 fail. **TC-05 needs both flaws to fail**, so the release gate is the full suite, not TC-05 alone.

## AI contribution and corrections
- **What AI (Claude) produced:** the project scaffold, both implementations, the 18 tests, the verify script, the CI workflow, and first drafts of all docs.

- **What I decided:** Choosing the fictional case, selecting defect #1 over #2 and #3, making the per-user aggregation assumption, and rejecting timestamps without offsets were all my decisions.

- **What I verified by hand:** I recalculated every expected value in `docs/test-cases.md`, especially TC-07/08/09 (offset calculations) and TC-00 (window dates).

- I independently reran the faulty suite and verified the failing test IDs matched the doc rather than trusting that three files repeating the same claim made it true — and I checked the TC-05/09/13 test code against their written descriptions by hand.

- **Corrections / rejections:**
  - Observed during the build: the mutation check showed the headline test TC-05 passes when only one of the two flaws is present. The gate was therefore defined as the whole suite, and this is documented rather than leaning on a single test.

  - I caught that the repo URL was filled in up in the artifact table but the reproduce command below it still had a <repo> placeholder — I fixed the clone command to use the real URL.

  - I reread the tie-break paragraph against my own scoring table and caught that it said 'three other options' when the table only shows two tied at 12 — fixed the wording to match.

  - I checked the environment line against my own node -v and it claimed Node 22 locally — I'm actually on 20.20.2, so I corrected the Environment field to say what I actually ran it on.

  - The checklist still flagged the CI gate as unconfirmed — I checked the Actions run myself, saw it passed, and updated the row instead of leaving a caveat that was no longer true.


## Limitations and next steps
- In-memory ledger only: there is no storage-level uniqueness, no transaction between payout and ledger write, and no protection against concurrent runs (checklist items 10–12).
- Upstream feed overlap is assumed (A2), not observed.
- Late-arriving tasks, account changes and admin overrides are out of scope.
- **Next:** a DB unique constraint on `task_id`, an outbox-pattern ledger write, a run lock per window, and a post-run duplicate-payout reconciliation alert.

## Effort
**TODO(you):** report actual hours. Scaffolding was AI-generated in one session; count your own review, edits, docs and Loom time honestly.
