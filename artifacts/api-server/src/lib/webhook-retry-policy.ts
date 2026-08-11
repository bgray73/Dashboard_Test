export const MAX_WEBHOOK_ATTEMPTS = 3;

const RETRY_DELAYS_MS = [60_000, 5 * 60_000] as const;

export function nextWebhookAttempt(attemptCount: number, attemptedAt: Date) {
  if (attemptCount >= MAX_WEBHOOK_ATTEMPTS) return null;
  const delay = RETRY_DELAYS_MS[Math.max(0, attemptCount - 1)] ?? RETRY_DELAYS_MS.at(-1)!;
  return new Date(attemptedAt.getTime() + delay);
}

export function isWebhookRetryDue(status: string, attemptCount: number, nextAttemptAt: Date | null, now = new Date()) {
  return status === "retrying" && attemptCount < MAX_WEBHOOK_ATTEMPTS && nextAttemptAt !== null && nextAttemptAt <= now;
}
