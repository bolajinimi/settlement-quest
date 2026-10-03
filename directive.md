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
- [ ] CI workflow observed passing on GitHub. **TODO(you)**
- [ ] Every link below opened from a logged-out or reviewer account. **TODO(you)**

---

# Appendix: Results and handoff

## Artifact links
| Artifact | Link |
|---|---|
| Repository (runnable test project) | **TODO(you)**: e.g. `https://github.com/bolajinimi/settlement-quest` |
| Test cases + results | `docs/test-cases.md` |
| Defect / root-cause report | `docs/defect-report.md` |
| Release-readiness checklist | `docs/release-checklist.md` |
| Raw test output | `results/faulty-run.txt`, `results/fixed-run.txt` |
| CI run | **TODO(you)**: link to the green Actions run |
| Loom | **TODO(you)** |

## Reproduce
Requires Node 20+.
```bash
git clone <repo> && cd settlement-quest
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
- **What I decided:** **TODO(you)**. For example: choosing the fictional case, choosing defect #1 over #2/#3, the per-user aggregation assumption, rejecting offset-less timestamps.
- **What I verified by hand:** **TODO(you)**. Recompute every expected value in `docs/test-cases.md`, especially TC-07/08/09 (offset arithmetic) and TC-00 (window dates).
- **Corrections / rejections:**
  - Observed during the build: the mutation check showed the headline test TC-05 passes when only one of the two flaws is present. The gate was therefore defined as the whole suite, and this is documented rather than leaning on a single test.
  - **TODO(you):** add at least one correction you made yourself, e.g. an expected value you changed, a case you added or removed, or wording you rejected. Don't invent one; if you made none, say what you checked and why you accepted it.

## Limitations and next steps
- In-memory ledger only: there is no storage-level uniqueness, no transaction between payout and ledger write, and no protection against concurrent runs (checklist items 10–12).
- Upstream feed overlap is assumed (A2), not observed.
- Late-arriving tasks, account changes and admin overrides are out of scope.
- **Next:** a DB unique constraint on `task_id`, an outbox-pattern ledger write, a run lock per window, and a post-run duplicate-payout reconciliation alert.

## Effort
**TODO(you):** report actual hours. Scaffolding was AI-generated in one session; count your own review, edits, docs and Loom time honestly.
