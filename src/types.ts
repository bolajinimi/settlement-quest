// Synthetic domain model for the assessment's fictional rewards service.
// Not a description of any live product.

export type TaskStatus = "completed" | "pending" | "cancelled";

export interface Task {
  taskId: string;
  userId: string;
  status: TaskStatus;
  /** ISO-8601 timestamp WITH an offset, e.g. "2026-10-12T00:30:00+01:00". */
  completedAt: string;
}

/** Half-open interval [start, end) in UTC. */
export interface SettlementWindow {
  start: Date;
  end: Date;
}

export interface UserPayout {
  userId: string;
  taskIds: string[];
  credits: number;
  payoutStatus: "paid" | "failed";
  notificationStatus: "sent" | "failed" | "skipped";
}

export interface SettlementResult {
  window: SettlementWindow;
  payouts: UserPayout[];
  totalCredits: number;
}

export interface PayoutGateway {
  /** Throws on failure. */
  pay(userId: string, credits: number, idempotencyKey: string): void;
}

export interface Notifier {
  /** Throws on failure. */
  notify(userId: string, credits: number): void;
}

export interface Ledger {
  isPaid(taskId: string): boolean;
  record(taskId: string, userId: string, credits: number, windowStart: Date): void;
  totalFor(userId: string): number;
  size(): number;
}

export interface SettleDeps {
  ledger: Ledger;
  gateway: PayoutGateway;
  notifier: Notifier;
}

export type SettleFn = (tasks: Task[], runAt: Date, deps: SettleDeps) => SettlementResult;

export const CREDITS_PER_TASK = 10;
