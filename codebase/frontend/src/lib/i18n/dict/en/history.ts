import type { Dict } from "../types";

export const history: Dict["history"] = {
  actions: {
    rerun: "Re-run",
  },
  rerun: {
    modal: {
      title: "Re-run Execution",
      originalLabel: "Original Execution",
      sideEffectWarning: "This workflow includes {{count}} external-call node(s)",
    },
    useOriginalInput: "Use original input",
    dryRunToggle: "Dry-run mode (skip external calls)",
    dryRunDisabledTooltip:
      "This workflow contains nodes that don't support dry-run",
    confirmButton: "Re-run",
    cancelButton: "Cancel",
    chainBadge: "#{{n}}-th re-run",
    chainBadgeDryRun: "dry-run",
    chainOrigin: "original",
    viewChain: "View chain ({{count}})",
    permissionDenied: "You don't have permission to re-run (RR-PL-06)",
    chainDepthExceeded:
      "This chain has reached the re-run depth limit (32)",
    workflowDeleted:
      "The workflow of the original execution has been deleted",
    dryRunNotApplicable:
      "This workflow cannot be re-run in dry-run mode",
    assistantBlocked:
      "Re-run must be triggered manually on the execution detail page (RR-PL-07)",
  },
};
