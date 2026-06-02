import type { Dict } from "../types";

export const systemStatus: Dict["systemStatus"] = {
  title: "System Status",
  systemWideBanner:
    "This page shows the status of the entire system — not scoped to any workspace or user.",
  refresh: "Refresh",
  overall: {
    healthy: "All systems normal",
    degraded: "Partial delays",
    down: "Attention needed",
  },
  totalFailed: "Total failed jobs",
  groups: {
    execution: "Execution",
    "knowledge-base": "Knowledge Base",
    integration: "Notifications & Integrations",
    system: "Schedule & System",
  },
  counts: {
    waiting: "Waiting",
    active: "Active",
    delayed: "Delayed",
    failed: "Failed",
  },
  utilization: "Utilization",
  scheduledJob: "Scheduled job",
  paused: "Paused",
  health: {
    healthy: "Healthy",
    degraded: "Degraded",
    down: "Down",
  },
  loading: "Loading status…",
  loadFailed: "Failed to load system status.",
  retry: "Retry",
};
