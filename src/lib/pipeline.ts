export const RATE_FLOOR_EUR = 17.5;

export const statusProbability: Record<string, number> = {
  applied: 20,
  interview: 45,
  offer: 75,
  won: 100,
  rejected: 0,
};

export type PipelineItem = {
  rateEur: number | null;
  estimatedHours: number | null;
  platformFeePct: number;
  status: string;
  probability: number;
  followUpOn: string | Date | null;
};

export function effectiveRate(rateEur: number | null, platformFeePct: number) {
  if (rateEur == null) return null;
  return rateEur * (1 - platformFeePct / 100);
}

export function isUnderFloor(rateEur: number | null, platformFeePct: number) {
  const effective = effectiveRate(rateEur, platformFeePct);
  return effective != null && effective < RATE_FLOOR_EUR;
}

export function expectedValue(item: PipelineItem) {
  if (item.rateEur == null || item.estimatedHours == null) return 0;
  const net = effectiveRate(item.rateEur, item.platformFeePct) ?? 0;
  return net * item.estimatedHours * (item.probability / 100);
}

export function isFollowUpOverdue(followUpOn: string | Date | null, status: string) {
  if (!followUpOn || status === "won" || status === "rejected") return false;
  return new Date(followUpOn).getTime() < Date.now();
}

export function summarizePipeline(items: PipelineItem[]) {
  const active = items.filter((i) => i.status !== "rejected" && i.status !== "won");
  const won = items.filter((i) => i.status === "won");
  const decided = items.filter((i) => i.status === "won" || i.status === "rejected");
  const underFloor = items.filter((i) => isUnderFloor(i.rateEur, i.platformFeePct));
  const overdue = items.filter((i) => isFollowUpOverdue(i.followUpOn, i.status));
  const pipelineEv = active.reduce((sum, item) => sum + expectedValue(item), 0);
  const wonRevenue = won.reduce((sum, item) => {
    if (item.rateEur == null || item.estimatedHours == null) return sum;
    return sum + (effectiveRate(item.rateEur, item.platformFeePct) ?? 0) * item.estimatedHours;
  }, 0);
  const winRate = decided.length ? Math.round((won.length / decided.length) * 100) : null;

  return {
    activeCount: active.length,
    underFloorCount: underFloor.length,
    overdueCount: overdue.length,
    pipelineEv,
    wonRevenue,
    winRate,
  };
}

export function defaultFollowUpDate(days = 3) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d;
}
