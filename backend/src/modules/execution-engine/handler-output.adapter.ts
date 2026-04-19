import { NodeHandlerOutput } from '../../nodes/core/node-handler.interface.js';

/**
 * Normalize an opaque handler return into {@link NodeHandlerOutput}.
 *
 * Post Phase-3 (node-specs-improvement plan §Stage 7) all handlers emit the
 * canonical `{ config, output, meta?, port?, status? }` shape. The adapter
 * now only guarantees `config` defaults to `{}` and strips undefined control
 * fields — the legacy `{port,data}` port-selector envelope and bare-object
 * coercion branches have been removed.
 */
export function adaptHandlerReturn(raw: unknown): NodeHandlerOutput {
  if (isNewShape(raw)) {
    const r = raw;
    return {
      config: r.config ?? {},
      output: r.output,
      ...(r.meta !== undefined ? { meta: r.meta } : {}),
      ...(r.port !== undefined ? { port: r.port } : {}),
      ...(r.status !== undefined ? { status: r.status } : {}),
      ...(r._resumeState !== undefined ? { _resumeState: r._resumeState } : {}),
    };
  }

  // Test fixtures and a handful of one-off mock handlers still return bare
  // objects / primitives. Wrap them so the engine receives the expected
  // shape. Production handlers are type-checked against
  // {@link NodeHandlerOutput}; this branch is effectively reached only by
  // legacy test doubles.
  if (raw === null || raw === undefined) {
    return { config: {}, output: raw };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { config: {}, output: raw };
  }

  const obj = raw as Record<string, unknown>;
  const adapted: NodeHandlerOutput = { config: {}, output: raw };
  if (typeof obj.status === 'string') adapted.status = obj.status;
  if (typeof obj.port === 'string' || Array.isArray(obj.port))
    adapted.port = obj.port as string | string[];
  // Lift `_resumeState` so the engine can find it on the flat cache even
  // when a handler emits the legacy bare waiting shape.
  if (
    obj._resumeState !== null &&
    typeof obj._resumeState === 'object' &&
    !Array.isArray(obj._resumeState)
  ) {
    adapted._resumeState = obj._resumeState as Record<string, unknown>;
  }
  return adapted;
}

/**
 * Collapses a {@link NodeHandlerOutput} back into the pre-migration flat
 * shape so that existing engine internals (`applyPortSelection`,
 * `stripSelectedPort`, downstream `$input.<field>` access) keep working
 * without per-call-site refactors. Phase 3 will remove this function along
 * with the legacy cache.
 */
export function toEngineFlatShape(adapted: NodeHandlerOutput): unknown {
  const output = adapted.output;

  // Null / undefined output: if there are control fields (status / port) or
  // echoed config, produce a flat envelope so that engine internals (blocking
  // detection, port routing, frontend waiting events) still have something
  // to read. Handlers in `waiting_for_input` state typically carry
  // `output: null` with the meaningful declaration in `config`.
  if (output === null || output === undefined) {
    const hasConfig =
      adapted.config !== null &&
      adapted.config !== undefined &&
      Object.keys(adapted.config).length > 0;
    const hasControl =
      adapted.port !== undefined || adapted.status !== undefined;
    if (hasConfig || hasControl || adapted._resumeState !== undefined) {
      return {
        ...(hasConfig ? adapted.config : {}),
        ...(adapted.port !== undefined ? { port: adapted.port } : {}),
        ...(adapted.status !== undefined ? { status: adapted.status } : {}),
        ...(adapted._resumeState !== undefined
          ? { _resumeState: adapted._resumeState }
          : {}),
      };
    }
    return output;
  }
  if (typeof output !== 'object' || Array.isArray(output)) {
    if (
      adapted.port ||
      adapted.status ||
      adapted.meta ||
      adapted._resumeState
    ) {
      // Engine expects top-level `status` / port metadata on an object. Keep
      // the raw output under `data` and surface control fields to emulate
      // the legacy `{ port, data, status }` envelope.
      return {
        data: output,
        ...(adapted.port !== undefined ? { port: adapted.port } : {}),
        ...(adapted.status !== undefined ? { status: adapted.status } : {}),
        ...(adapted._resumeState !== undefined
          ? { _resumeState: adapted._resumeState }
          : {}),
      };
    }
    return output;
  }

  const base = { ...(output as Record<string, unknown>) };
  // Surface control fields so the existing blocking check / port selector see
  // identical shapes to the pre-migration handler returns.
  if (adapted.status !== undefined && base.status === undefined) {
    base.status = adapted.status;
  }
  if (adapted.port !== undefined && base.port === undefined) {
    base.port = adapted.port;
    // For object outputs, `applyPortSelection` expects `{ port, data }`
    // — synthesise `data` if the handler didn't provide it explicitly.
    if (base.data === undefined) {
      base.data = output;
    }
  }
  if (adapted._resumeState !== undefined && base._resumeState === undefined) {
    base._resumeState = adapted._resumeState;
  }
  return base;
}

function isNewShape(raw: unknown): raw is NodeHandlerOutput {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    !Array.isArray(raw) &&
    'config' in (raw as Record<string, unknown>) &&
    'output' in (raw as Record<string, unknown>)
  );
}
