export const STATUS_ICON: Record<string, string> = {
  completed: "\u2705",
  failed: "\u274C",
  running: "\u23F3",
  pending: "\u23F3",
  cancelled: "\u26D4",
  waiting_for_input: "\u270B",
};

export const STATUS_BADGE_VARIANT: Record<
  string,
  "success" | "destructive" | "warning" | "outline"
> = {
  completed: "success",
  failed: "destructive",
  running: "warning",
  pending: "outline",
  cancelled: "outline",
  waiting_for_input: "warning",
};

export const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  failed: "Failed",
  running: "Running",
  pending: "Pending",
  cancelled: "Cancelled",
  waiting_for_input: "Waiting",
};

export function formatDuration(ms: number | null): string {
  if (ms == null) return "\u2014";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}
