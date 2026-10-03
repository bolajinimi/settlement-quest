#!/usr/bin/env bash
# Red/green proof: the suite MUST fail against the faulty implementation
# and MUST pass against the fixed one. Exits non-zero if either expectation breaks.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p results

echo "=== 1/3 typecheck ==="
npx tsc --noEmit || { echo "TYPECHECK FAILED"; exit 1; }

echo "=== 2/3 IMPL=faulty (expected: FAIL) ==="
IMPL=faulty npx vitest run --reporter=verbose 2>&1 | tee results/faulty-run.txt
faulty_status=${PIPESTATUS[0]}

echo "=== 3/3 IMPL=fixed (expected: PASS) ==="
IMPL=fixed npx vitest run --reporter=verbose 2>&1 | tee results/fixed-run.txt
fixed_status=${PIPESTATUS[0]}

echo
if [ "$faulty_status" -eq 0 ]; then
  echo "VERIFY FAILED: suite passed against the faulty implementation — regression check is not catching the defect."
  exit 1
fi
if [ "$fixed_status" -ne 0 ]; then
  echo "VERIFY FAILED: suite fails against the fixed implementation."
  exit 1
fi
echo "VERIFY OK: faulty → red (exit $faulty_status), fixed → green (exit $fixed_status)."
