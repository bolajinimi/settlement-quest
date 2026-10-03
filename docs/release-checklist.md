# Release-readiness checklist: settlement fix

| # | Check | Evidence | Status |
|---|---|---|---|
| 1 | Typecheck passes | `npm run verify` step 1 | ✅ |
| 2 | Full suite green on fixed implementation | `results/fixed-run.txt`: 18/18 | ✅ |
| 3 | Suite red on faulty reference (proves the tests detect the defect) | `results/faulty-run.txt`: 6 failed | ✅ |
| 4 | Each flaw caught independently | mutation table in `docs/test-cases.md` | ✅ |
| 5 | Boundary: lower included, upper excluded, last ms included | TC-03, 04, 06 | ✅ |
| 6 | Timezone: offsets converted to UTC; offset-less rejected | TC-07–10 | ✅ |
| 7 | Idempotency: in-batch duplicate, retry, cross-run | TC-11–13 | ✅ |
| 8 | Partial failure: notification failure keeps payout; payout failure blocks notification and stays retryable | TC-14–16 | ✅ |
| 9 | CI gate configured | `.github/workflows/regression.yml` | ⚠️ Written but not yet run on GitHub; confirm after push |
| 10 | Crash between payout and ledger write | not covered | ❌ Known gap |
| 11 | Ledger uniqueness enforced at storage level | in-memory only | ❌ Production follow-up |
| 12 | Concurrent runs for the same window | not covered | ❌ Known gap |

## Decision
**GO for the fixed reference implementation within this fixture's scope.** All in-scope rules are verified, and the regression demonstrably fails before the fix and passes after it.

**NO-GO for a production payout system on this evidence alone.** Items 10–12 need a DB uniqueness constraint, a transactional ledger write, and a run lock first.
