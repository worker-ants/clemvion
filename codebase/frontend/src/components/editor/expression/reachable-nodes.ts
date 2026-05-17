/**
 * Graph-reachability utilities for the expression autocomplete.
 *
 * The editor's node/edge graph mirrors the runtime execution order: a node
 * can reference `$node["X"].output` only when X fully executes before it. We
 * compute that set by walking incoming edges in reverse, respecting
 * container boundaries so body-scope nodes can't leak to outer scope and
 * vice versa.
 *
 * Edges that cross a container boundary (e.g. `Loop.body → firstChild`,
 * `lastChild → Loop.emit`) are ignored during BFS — they encode control
 * flow, not data flow. Instead, we explicitly promote the container node
 * itself to the outer level and restart BFS from there, which is how the
 * runtime resolves `$node["outerAncestor"]` references for nodes inside a
 * container body.
 *
 * The container node itself is intentionally omitted from the ancestor set
 * for intra-body targets: during iteration its output is in-progress and
 * not yet a valid reference. Outer siblings connected to the container's
 * `done` port DO see the container as an ancestor through the outer edges.
 */
export interface ScopedNode {
  id: string;
  containerId: string | null;
  toolOwnerId: string | null;
  type: string;
}

export interface EdgeLite {
  source: string;
  target: string;
}

/**
 * Walk the `containerId` chain from the given node upward (innermost first).
 * Guards against missing references and self-cycles.
 *
 * `byIdOverride` lets callers share a pre-built `id → node` map to avoid the
 * O(n) allocation when the chain is computed alongside other reachability
 * work that already has the map on hand.
 */
export function getContainerChain(
  nodeId: string,
  nodes: ScopedNode[],
  byIdOverride?: Map<string, ScopedNode>,
): ScopedNode[] {
  const byId = byIdOverride ?? new Map(nodes.map((n) => [n.id, n]));
  const chain: ScopedNode[] = [];
  const visited = new Set<string>();
  const start = byId.get(nodeId);
  if (!start) return chain;

  let currentContainerId = start.containerId;
  while (currentContainerId !== null && !visited.has(currentContainerId)) {
    visited.add(currentContainerId);
    const container = byId.get(currentContainerId);
    if (!container) break;
    chain.push(container);
    currentContainerId = container.containerId;
  }
  return chain;
}

/**
 * Compute ancestor nodes that the given target node can reference at runtime.
 *
 * Algorithm: BFS over reverse edges, filtered to edges whose `source` shares
 * the BFS frame's container level. The frame stack is primed with the target
 * (at its own container level) plus one entry per ancestral container (each
 * at that container's outer level) so BFS naturally explores every
 * applicable scope without revisiting nodes.
 *
 * Nodes with `toolOwnerId != null` are excluded — they live inside an
 * agent's tool slot and are not part of the data graph.
 */
export function getAncestorsInScope(
  targetId: string,
  nodes: ScopedNode[],
  edges: EdgeLite[],
): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const target = byId.get(targetId);
  const result = new Set<string>();
  if (!target) return result;

  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const arr = incoming.get(edge.target);
    if (arr) arr.push(edge.source);
    else incoming.set(edge.target, [edge.source]);
  }

  const visited = new Set<string>();
  const stack: Array<{ id: string; level: string | null }> = [];

  visited.add(target.id);
  stack.push({ id: target.id, level: target.containerId });

  // Promote to each outer container level. Container nodes are marked visited
  // (so BFS doesn't add them to `result` as ancestors of intra-body siblings)
  // but still pushed onto the stack so their own outer-level ancestors get
  // collected. Reuse `byId` to avoid a duplicate Map allocation inside
  // `getContainerChain`.
  for (const container of getContainerChain(targetId, nodes, byId)) {
    if (visited.has(container.id)) continue;
    visited.add(container.id);
    stack.push({ id: container.id, level: container.containerId });
  }

  while (stack.length > 0) {
    const frame = stack.pop()!;
    const predecessors = incoming.get(frame.id);
    if (!predecessors) continue;
    for (const sourceId of predecessors) {
      const source = byId.get(sourceId);
      if (!source) continue;
      if (source.toolOwnerId !== null) continue;
      if (source.containerId !== frame.level) continue;
      if (visited.has(source.id)) continue;
      visited.add(source.id);
      result.add(source.id);
      stack.push({ id: source.id, level: frame.level });
    }
  }

  return result;
}
