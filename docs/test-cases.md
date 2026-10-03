# Test cases and results

All data is **synthetic**. Expected values were derived from the business rules below, not from running the code.
Automated in `test/settle.spec.ts`; IDs match test names.

## Business rules (as implemented and tested)

| # | Rule |
|---|------|
| R1 | The run at Tue 09:00 UTC settles the half-open window **[prev Mon 00:00:00Z, this Mon 00:00:00Z)**. |
| R2 | A task qualifies if `status = completed` and its `completedAt` instant falls in the window. |
| R3 | Each qualifying task earns **10 credits**. |
| R4 | A task ID is paid **at most once, ever**, across batches, retries and runs. |
| R5 | Notify only after a successful payout. A notification failure never reverses the payout. |
| R6 | If a payout fails, nothing is recorded and no notification is sent; the tasks remain eligible for a re-run. |

## Assumptions (labelled; not given by the brief)

- **A1** `completedAt` is the event time that counts, not ingestion time. Timestamps must carry an explicit offset; offset-less input is rejected, not guessed (TC-10).
- **A2** The upstream task feed may overlap between runs (cumulative export). This is what turns the boundary bug into a double payout.
- **A3** Credits are aggregated per user per run: one payout and one notification per user.
- **A4** Account changes (deactivation, user merge) do not affect eligibility in this model. No admin settings exist (fixed 10 credits, fixed schedule). Late-arriving tasks for an already-settled window are out of scope.
- **A5** The ledger write happens after a successful gateway call. A crash between the two is a known gap (see the defect report).

Fixture runs: **W40** = Tue 2026-10-06 09:00Z, **W41** = Tue 2026-10-13 09:00Z (window 2026-10-05 → 2026-10-12), **W42** = Tue 2026-10-20 09:00Z.

## Cases

| ID | Category | Input | Expected | Faulty | Fixed |
|----|----------|-------|----------|:---:|:---:|
| TC-00 | Window rule | run W41 | window = [2026-10-05T00:00Z, 2026-10-12T00:00Z) | ✅ | ✅ |
| TC-01 | Happy path | 3 completed tasks mid-window, one user | 30 credits, 1 notification | ✅ | ✅ |
| TC-02 | Happy path | user-a ×2, user-b ×1 | 20 / 10, 2 notifications | ✅ | ✅ |
| TC-03 | Cut-off | `2026-10-05T00:00:00Z` | included (10) | ✅ | ✅ |
| TC-04 | Cut-off | `2026-10-12T00:00:00Z` in W41 | excluded (0) | ❌ | ✅ |
| **TC-05** | **Cut-off + duplicate (selected defect)** | same boundary task in W41 and W42 feeds | **10 total, 1 notification** | ❌ (20) | ✅ |
| TC-06 | Cut-off | `2026-10-11T23:59:59.999Z` | included (10) | ✅ | ✅ |
| TC-07 | Timezone | `2026-10-12T00:30:00+01:00` (= Sun 23:30Z) | included (10) | ✅ | ✅ |
| TC-08 | Timezone | `2026-10-11T23:30:00-02:00` (= Mon 01:30Z) | excluded (0) | ✅ | ✅ |
| TC-09 | Timezone + cut-off | `2026-10-12T01:00:00+01:00` (= exactly Mon 00:00Z) | excluded (0) | ❌ | ✅ |
| TC-10 | Timezone | `2026-10-08T10:00:00` (no offset) | throws; nothing paid | ✅ | ✅ |
| TC-11 | Duplicate input | same task ID twice in one feed | 10 | ✅ | ✅ |
| TC-12 | Retry | W41 run executed twice | 2nd run pays 0; 1 notification total | ❌ | ✅ |
| TC-13 | Duplicate across runs | task paid in W40 reappears in W41 feed with corrected timestamp | still 10 total | ❌ | ✅ |
| TC-14 | Partial failure | notifier throws | payout 10 stands, ledger has task, `notificationStatus=failed` | ✅ | ✅ |
| TC-15 | Partial failure + retry | gateway fails, then recovers; window re-run twice | 1st: nothing paid or notified; final total 10, 1 notification | ❌ | ✅ |
| TC-16 | Partial failure | user-a gateway fails, user-b fine | user-b paid and notified | ✅ | ✅ |
| TC-17 | Eligibility | pending + cancelled + completed | 10 | ✅ | ✅ |

**Totals (actual run, see `results/`):** faulty 12 passed / 6 failed · fixed 18 passed / 0 failed.

## Which cases catch which flaw (mutation check, actually run)

| Variant | Failing cases |
|---|---|
| Both flaws (shipped faulty) | TC-04, 05, 09, 12, 13, 15 |
| Only flaw A (inclusive `<=` bound) | TC-04, TC-09 |
| Only flaw B (no ledger check) | TC-12, TC-13, TC-15 |

TC-05 only fails when both flaws are present. it doesn't allow partial regression. Which is why  the release gate is the whole suite and not just one test.







It documents the user-visible incident, but on its own it would **not** block a partial regression.Which is why  the release gate is the whole suite and not just one test.
