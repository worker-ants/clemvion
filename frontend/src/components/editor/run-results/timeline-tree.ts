import type { NodeResult } from "@/lib/stores/execution-store";

export interface TimelineTreeNode {
  result: NodeResult;
  children: TimelineTreeNode[];
  /** 1-based index when the same nodeId runs multiple times (Loop/ForEach/Map iters). */
  iterIndex: number;
  totalIterations: number;
}

/** Identity key used for selection + React keys — per-iteration when available. */
export function keyOf(result: NodeResult): string {
  return result.nodeExecutionId ?? result.nodeId;
}

/**
 * Build the run-results timeline tree from the flat chronological `results`
 * list. Nodes with `parentNodeExecutionId` pointing at another row are nested
 * under that row (Sub-Workflow inline children). Orphaned references (parent
 * id not found among results) are surfaced as roots so nothing disappears
 * from the timeline.
 *
 * Assumes `results` is already chronologically sorted (the store sorts by
 * startedAt on every update), which is what drives iteration numbering.
 */
export function buildTimelineTree(results: NodeResult[]): TimelineTreeNode[] {
  // First pass: create tree nodes and attach them to their parents.
  const byKey = new Map<string, TimelineTreeNode>();
  const ordered: TimelineTreeNode[] = [];
  for (const r of results) {
    const tnode: TimelineTreeNode = {
      result: r,
      children: [],
      iterIndex: 1,
      totalIterations: 1,
    };
    byKey.set(keyOf(r), tnode);
    ordered.push(tnode);
  }
  const roots: TimelineTreeNode[] = [];
  for (const tnode of ordered) {
    const parentId = tnode.result.parentNodeExecutionId;
    const parent = parentId ? byKey.get(parentId) : undefined;
    if (parent) parent.children.push(tnode);
    else roots.push(tnode);
  }

  // Second pass: assign iteration indices / totals per sibling group.
  // Scoping the count to siblings prevents "iter 1/4" appearing when the
  // same nodeId also runs in an outer scope — each Sub-Workflow's internal
  // Loop/ForEach numbering stays independent.
  numberIterationsInGroup(roots);
  for (const tnode of ordered) numberIterationsInGroup(tnode.children);

  return roots;
}

function numberIterationsInGroup(group: TimelineTreeNode[]): void {
  const totals = new Map<string, number>();
  for (const c of group) {
    totals.set(c.result.nodeId, (totals.get(c.result.nodeId) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  for (const c of group) {
    const next = (seen.get(c.result.nodeId) ?? 0) + 1;
    seen.set(c.result.nodeId, next);
    c.iterIndex = next;
    c.totalIterations = totals.get(c.result.nodeId) ?? 1;
  }
}

/**
 * Backend enforces `MAX_RECURSION_DEPTH = 10` for Sub-Workflow nesting,
 * so legitimate trees never exceed that depth. We cap traversal a little
 * higher (hence the 12 default) so anomalous server payloads cannot blow
 * the JS call stack and turn a single bad execution into a client DoS.
 */
const MAX_TREE_DEPTH = 12;

export function countDescendants(
  tnode: TimelineTreeNode,
  depth = 0,
): number {
  if (depth >= MAX_TREE_DEPTH) return 0;
  let total = 0;
  for (const c of tnode.children) {
    total += 1 + countDescendants(c, depth + 1);
  }
  return total;
}

/**
 * Sum durations (ms) across all descendants. The Sub-Workflow node's own
 * `duration` already captures the wall-clock time spent inside, but when the
 * card is collapsed we also want to hint at how many child nodes contribute
 * — the descendant sum is shown alongside the count.
 */
export function sumDescendantDurations(
  tnode: TimelineTreeNode,
  depth = 0,
): number {
  if (depth >= MAX_TREE_DEPTH) return 0;
  let total = 0;
  for (const c of tnode.children) {
    total += c.result.duration ?? 0;
    total += sumDescendantDurations(c, depth + 1);
  }
  return total;
}
