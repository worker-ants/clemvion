import { NodeHandlerOutput } from '../../nodes/core/node-handler.interface.js';

/**
 * Normalize an opaque handler return into {@link NodeHandlerOutput}.
 *
 * Post-Phase-3 (node-specs-improvement plan §Stage 7) production handlers
 * MUST emit the canonical `{ config, output, meta?, port?, status?,
 * _resumeState? }` shape. The TypeScript `NodeHandler.execute` return type
 * enforces this at compile time; this function enforces it at runtime.
 *
 * Modes:
 *
 *  - `NODE_ENV === 'production'` — strict. Any non-canonical return
 *    throws synchronously with the handler's actual return shape in the
 *    error message. This guarantees a production handler bug fails
 *    loudly at the engine boundary rather than silently being wrapped.
 *
 *  - Otherwise (test / development) — lenient. Bare objects / primitives
 *    are wrapped via {@link wrapBareAsNodeHandlerOutput} so the 39
 *    fixtures in `execution-engine.service.spec.ts` (and similar test
 *    doubles) keep working without per-test boilerplate.
 *
 * If you need lenient coercion in production code (you almost certainly
 * don't), call {@link wrapBareAsNodeHandlerOutput} directly.
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

  if (process.env.NODE_ENV === 'production') {
    let preview: string;
    if (raw === null || raw === undefined) {
      preview = String(raw);
    } else {
      try {
        preview = JSON.stringify(raw).slice(0, 200);
      } catch {
        preview = '[unserializable]';
      }
    }
    throw new Error(
      'Node handler return violates the NodeHandlerOutput contract. ' +
        `Expected { config, output, ... }; got ${preview}. ` +
        "This indicates a handler bug — fix the handler's return value. " +
        'If the return shape is intentionally legacy (e.g. a one-off ' +
        'test double), call wrapBareAsNodeHandlerOutput() explicitly.',
    );
  }

  return wrapBareAsNodeHandlerOutput(raw);
}

/**
 * Legacy / test-fixture coercion into {@link NodeHandlerOutput}. Exported
 * so test code that deliberately returns bare objects (see
 * `execution-engine.service.spec.ts`) can stay concise while production
 * handlers are gated through {@link adaptHandlerReturn}'s strict path.
 *
 *  - null / undefined / primitive / array → `{ config: {}, output: raw }`
 *  - object → `{ config: {}, output: raw }` with `status` / `port` /
 *    `_resumeState` lifted from the raw object's top level if present, so
 *    the engine's blocking detection, port routing and resume logic keep
 *    behaving identically.
 */
export function wrapBareAsNodeHandlerOutput(raw: unknown): NodeHandlerOutput {
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
