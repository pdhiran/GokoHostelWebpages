export const STATUS_STEPS = ["pending_approval", "placed", "preparing", "ready", "served"] as const;

export function isTerminalOrderStatus(status: string): boolean {
  return status === "served" || status === "cancelled";
}

export function shouldPollOrderStatus(status: string | undefined, hidden: boolean): boolean {
  if (hidden) return false;
  if (!status) return true;
  return !isTerminalOrderStatus(status);
}

export function stepperIndex(status: string): number {
  if (status === "cancelled") return -1;
  return (STATUS_STEPS as readonly string[]).indexOf(status);
}
