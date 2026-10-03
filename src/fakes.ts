// In-memory test doubles. Nothing here touches a real payment or messaging system.
import type { Ledger, Notifier, PayoutGateway } from "./types.js";

export class DuplicatePayoutError extends Error {}

export class InMemoryLedger implements Ledger {
  private entries = new Map<string, { userId: string; credits: number; windowStart: Date }>();

  isPaid(taskId: string): boolean {
    return this.entries.has(taskId);
  }

  record(taskId: string, userId: string, credits: number, windowStart: Date): void {
    this.entries.set(taskId, { userId, credits, windowStart });
  }

  totalFor(userId: string): number {
    let sum = 0;
    for (const e of this.entries.values()) if (e.userId === userId) sum += e.credits;
    return sum;
  }

  size(): number {
    return this.entries.size;
  }
}

/** Records every credit actually sent. This is the "money that left" — the source of truth in tests. */
export class FakePayoutGateway implements PayoutGateway {
  readonly sent: { userId: string; credits: number; idempotencyKey: string }[] = [];
  failForUsers = new Set<string>();

  pay(userId: string, credits: number, idempotencyKey: string): void {
    if (this.failForUsers.has(userId)) throw new Error(`gateway rejected payout for ${userId}`);
    this.sent.push({ userId, credits, idempotencyKey });
  }

  totalSentTo(userId: string): number {
    return this.sent.filter((s) => s.userId === userId).reduce((a, s) => a + s.credits, 0);
  }
}

export class FakeNotifier implements Notifier {
  readonly delivered: { userId: string; credits: number }[] = [];
  readonly attempts: { userId: string; credits: number }[] = [];
  failForUsers = new Set<string>();

  notify(userId: string, credits: number): void {
    this.attempts.push({ userId, credits });
    if (this.failForUsers.has(userId)) throw new Error(`notification provider down for ${userId}`);
    this.delivered.push({ userId, credits });
  }
}
