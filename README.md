# settlement-quest

A regression check for a **boundary double-payout** defect in a fictional weekly rewards settlement flow. Synthetic data only; this is not a live system.

```bash
npm ci
npm run verify        # faulty must FAIL, fixed must PASS
```

| Path | What |
|---|---|
| `src/settle.ts` | corrected reference implementation |
| `src/settle.faulty.ts` | faulty implementation (reproduces the defect) |
| `src/window.ts` | window rule + strict timestamp parsing |
| `src/fakes.ts` | in-memory ledger, payout gateway, notifier |
| `test/settle.spec.ts` | 18 cases, TC-00 … TC-17 |
| `scripts/verify.sh` | red/green proof, used by CI |
| `docs/` | test cases, defect report, release checklist |
| `results/` | captured output of the last verify run |

Start with `directive.md` (handoff) and `intent.md` (why this problem).
