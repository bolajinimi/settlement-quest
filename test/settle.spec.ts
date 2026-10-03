import { describe, expect, it } from "vitest";
import { IMPL, settleUnderTest as settle } from "../src/impl.js";
import { settlementWindowFor } from "../src/window.js";
import { RUN_WEEK_40, RUN_WEEK_41, RUN_WEEK_42, freshDeps, task } from "./fixtures.js";

// Every expected value below was derived by hand from the business rules in docs/test-cases.md.
describe(`settlement [IMPL=${IMPL}]`, () => {
  describe("window rule", () => {
    it("TC-00 Tuesday 09:00 UTC run covers [prev Mon 00:00Z, this Mon 00:00Z)", () => {
      const w = settlementWindowFor(RUN_WEEK_41);
      expect(w.start.toISOString()).toBe("2026-10-05T00:00:00.000Z");
      expect(w.end.toISOString()).toBe("2026-10-12T00:00:00.000Z");
    });
  });

  describe("happy path", () => {
    it("TC-01 three completed tasks mid-window → 30 credits, one notification", () => {
      const deps = freshDeps();
      const r = settle(
        [
          task("t1", "2026-10-06T10:00:00Z"),
          task("t2", "2026-10-08T15:30:00Z"),
          task("t3", "2026-10-10T23:59:00Z"),
        ],
        RUN_WEEK_41,
        deps,
      );
      expect(r.totalCredits).toBe(30);
      expect(deps.gateway.totalSentTo("user-a")).toBe(30);
      expect(deps.notifier.delivered).toEqual([{ userId: "user-a", credits: 30 }]);
    });

    it("TC-02 two users settle independently", () => {
      const deps = freshDeps();
      settle(
        [
          task("t1", "2026-10-06T10:00:00Z", "user-a"),
          task("t2", "2026-10-07T10:00:00Z", "user-a"),
          task("t3", "2026-10-07T11:00:00Z", "user-b"),
        ],
        RUN_WEEK_41,
        deps,
      );
      expect(deps.gateway.totalSentTo("user-a")).toBe(20);
      expect(deps.gateway.totalSentTo("user-b")).toBe(10);
      expect(deps.notifier.delivered).toHaveLength(2);
    });
  });

  describe("cut-off boundaries", () => {
    it("TC-03 completed exactly at lower bound (Mon 00:00:00Z) → included", () => {
      const deps = freshDeps();
      const r = settle([task("t1", "2026-10-05T00:00:00Z")], RUN_WEEK_41, deps);
      expect(r.totalCredits).toBe(10);
    });

    it("TC-04 completed exactly at upper bound (next Mon 00:00:00Z) → excluded", () => {
      const deps = freshDeps();
      const r = settle([task("t1", "2026-10-12T00:00:00Z")], RUN_WEEK_41, deps);
      expect(r.totalCredits).toBe(0);
      expect(deps.gateway.sent).toHaveLength(0);
    });

    it("TC-05 [SELECTED DEFECT] boundary task is paid exactly once across two consecutive runs", () => {
      // The upstream feed is cumulative/overlapping, so the boundary task appears in both runs' input.
      const deps = freshDeps();
      const feed = [task("t-boundary", "2026-10-12T00:00:00Z")];
      settle(feed, RUN_WEEK_41, deps);
      settle(feed, RUN_WEEK_42, deps);
      expect(deps.gateway.totalSentTo("user-a")).toBe(10); // not 20
      expect(deps.notifier.delivered).toHaveLength(1);
    });

    it("TC-06 last millisecond before upper bound → included", () => {
      const deps = freshDeps();
      const r = settle([task("t1", "2026-10-11T23:59:59.999Z")], RUN_WEEK_41, deps);
      expect(r.totalCredits).toBe(10);
    });
  });

  describe("timezone conversion", () => {
    it("TC-07 Lagos time Mon 00:30 (+01:00) = Sun 23:30Z → included", () => {
      const deps = freshDeps();
      const r = settle([task("t1", "2026-10-12T00:30:00+01:00")], RUN_WEEK_41, deps);
      expect(r.totalCredits).toBe(10);
    });

    it("TC-08 Sun 23:30 at -02:00 = Mon 01:30Z → excluded", () => {
      const deps = freshDeps();
      const r = settle([task("t1", "2026-10-11T23:30:00-02:00")], RUN_WEEK_41, deps);
      expect(r.totalCredits).toBe(0);
    });

    it("TC-09 Mon 01:00 at +01:00 = exactly Mon 00:00Z → excluded (boundary via offset)", () => {
      const deps = freshDeps();
      const r = settle([task("t1", "2026-10-12T01:00:00+01:00")], RUN_WEEK_41, deps);
      expect(r.totalCredits).toBe(0);
    });

    it("TC-10 timestamp without an offset is rejected, not guessed", () => {
      const deps = freshDeps();
      expect(() => settle([task("t1", "2026-10-08T10:00:00")], RUN_WEEK_41, deps)).toThrow(/offset/);
      expect(deps.gateway.sent).toHaveLength(0);
    });
  });

  describe("duplicates and retries", () => {
    it("TC-11 same task ID twice in one feed → paid once", () => {
      const deps = freshDeps();
      const r = settle(
        [task("t1", "2026-10-08T10:00:00Z"), task("t1", "2026-10-08T10:00:00Z")],
        RUN_WEEK_41,
        deps,
      );
      expect(r.totalCredits).toBe(10);
    });

    it("TC-12 settlement job retried for the same window → no second payout or notification", () => {
      const deps = freshDeps();
      const feed = [task("t1", "2026-10-08T10:00:00Z"), task("t2", "2026-10-09T10:00:00Z")];
      settle(feed, RUN_WEEK_41, deps);
      const retry = settle(feed, RUN_WEEK_41, deps);
      expect(retry.totalCredits).toBe(0);
      expect(deps.gateway.totalSentTo("user-a")).toBe(20);
      expect(deps.notifier.delivered).toHaveLength(1);
    });

    it("TC-13 task already paid last week reappears with a corrected timestamp → not paid again", () => {
      const deps = freshDeps();
      settle([task("t1", "2026-10-04T12:00:00Z")], RUN_WEEK_40, deps);
      settle([task("t1", "2026-10-06T12:00:00Z")], RUN_WEEK_41, deps);
      expect(deps.gateway.totalSentTo("user-a")).toBe(10);
    });
  });

  describe("partial failure", () => {
    it("TC-14 notification fails → payout stands, recorded in ledger, status=failed", () => {
      const deps = freshDeps();
      deps.notifier.failForUsers.add("user-a");
      const r = settle([task("t1", "2026-10-08T10:00:00Z")], RUN_WEEK_41, deps);
      expect(deps.gateway.totalSentTo("user-a")).toBe(10);
      expect(deps.ledger.isPaid("t1")).toBe(true);
      expect(r.payouts[0]).toMatchObject({ payoutStatus: "paid", notificationStatus: "failed" });
    });

    it("TC-15 payout fails → no ledger entry, no notification; recovery run pays exactly once", () => {
      const deps = freshDeps();
      deps.gateway.failForUsers.add("user-a");
      const feed = [task("t1", "2026-10-08T10:00:00Z")];
      const first = settle(feed, RUN_WEEK_41, deps);
      expect(first.payouts[0]).toMatchObject({ payoutStatus: "failed", notificationStatus: "skipped" });
      expect(deps.ledger.isPaid("t1")).toBe(false);
      expect(deps.notifier.attempts).toHaveLength(0);

      deps.gateway.failForUsers.clear();
      settle(feed, RUN_WEEK_41, deps); // operator re-runs the same window
      settle(feed, RUN_WEEK_41, deps); // and accidentally once more
      expect(deps.gateway.totalSentTo("user-a")).toBe(10);
      expect(deps.notifier.delivered).toHaveLength(1);
    });

    it("TC-16 one user's payout failure does not block another user", () => {
      const deps = freshDeps();
      deps.gateway.failForUsers.add("user-a");
      settle(
        [task("t1", "2026-10-08T10:00:00Z", "user-a"), task("t2", "2026-10-08T10:00:00Z", "user-b")],
        RUN_WEEK_41,
        deps,
      );
      expect(deps.gateway.totalSentTo("user-b")).toBe(10);
      expect(deps.notifier.delivered).toEqual([{ userId: "user-b", credits: 10 }]);
    });
  });

  describe("eligibility", () => {
    it("TC-17 pending and cancelled tasks are not paid", () => {
      const deps = freshDeps();
      const r = settle(
        [
          task("t1", "2026-10-08T10:00:00Z", "user-a", "pending"),
          task("t2", "2026-10-08T10:00:00Z", "user-a", "cancelled"),
          task("t3", "2026-10-08T10:00:00Z", "user-a", "completed"),
        ],
        RUN_WEEK_41,
        deps,
      );
      expect(r.totalCredits).toBe(10);
    });
  });
});
