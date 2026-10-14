export type ManualClockFields = {
  manualClockRunning?: boolean | null;
  manualClockRemainingSeconds?: number | null;
  manualClockEndsAt?: number | null;
};

export function remainingClockSeconds(clock: ManualClockFields, now = Date.now()) {
  const saved = Math.max(0, clock.manualClockRemainingSeconds ?? 600);
  if (!clock.manualClockRunning || !clock.manualClockEndsAt) return saved;
  return Math.max(0, Math.ceil((clock.manualClockEndsAt - now) / 1000));
}

export function formatClockSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function adjustManualClock(clock: ManualClockFields, change: { seconds?: number; delta?: number }, now = Date.now()) {
  const wasRunning = Boolean(clock.manualClockRunning && clock.manualClockEndsAt && clock.manualClockEndsAt > now);
  const exactRemaining = wasRunning ? (clock.manualClockEndsAt! - now) / 1000 : remainingClockSeconds(clock, now);
  const seconds = Math.max(0, Math.min(5999, change.seconds ?? (exactRemaining + (change.delta || 0))));
  const manualClockRunning = wasRunning && seconds > 0;
  return { manualClockEnabled: true, manualClockRunning, manualClockRemainingSeconds: Math.ceil(seconds), manualClockEndsAt: manualClockRunning ? now + seconds * 1000 : null };
}
