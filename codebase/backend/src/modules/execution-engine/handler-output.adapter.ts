import { NodeHandlerOutput } from '../../nodes/core/node-handler.interface.js';
import { maskSensitiveFields } from '../../common/utils/mask-sensitive-fields.util';

/**
 * Normalize a handler return into {@link NodeHandlerOutput}.
 *
 * Production handlers MUST emit the canonical `{ config, output, meta?,
 * port?, status?, _resumeState? }` shape. The TypeScript
 * `NodeHandler.execute` return type enforces this at compile time; this
 * function enforces it at runtime — **always strict**, regardless of
 * `NODE_ENV`. Any non-canonical return throws synchronously with the
 * handler's actual return shape in the error message so a handler bug
 * fails loudly at the engine boundary rather than silently being wrapped.
 *
 * If you need lenient coercion (e.g. wrapping an already-flattened engine
 * value at a non-handler boundary), call {@link wrapBareAsNodeHandlerOutput}
 * directly.
 *
 * **Use only at the handler-return boundary** — i.e. immediately after a
 * `NodeHandler.execute()` call returns. Do NOT run this on values that have
 * already been flattened by {@link toEngineFlatShape} / port-routed for the
 * engine cache (those are intentionally bare and would throw under strict
 * mode). For those callers (e.g. `ExecutionContextService.setNodeOutput`),
 * use {@link wrapBareAsNodeHandlerOutput} instead.
 */
export function adaptHandlerReturn(raw: unknown): NodeHandlerOutput {
  if (isNewShape(raw)) {
    const r = raw;
    return {
      // INFO #5 (Security) — `config` 는 핸들러가 echo 한 raw config 다 (CONVENTIONS
      // Principle 7). JSDoc 상 credential 은 핸들러가 strip 하도록 명시돼 있으나
      // 런타임 강제가 없어 실수 leak 위험이 있었다. `maskSensitiveFields` 로
      // boundary 에서 자동 마스킹 — DB 저장 / WS emit / 표현식 echo 모두 안전.
      // (값 자체가 민감하지 않은 키는 영향 없음 — 키 이름 화이트리스트 매칭.)
      config: (maskSensitiveFields(r.config ?? {}) ?? {}) as Record<
        string,
        unknown
      >,
      output: r.output,
      ...(r.meta !== undefined ? { meta: r.meta } : {}),
      ...(r.port !== undefined ? { port: r.port } : {}),
      ...(r.status !== undefined ? { status: r.status } : {}),
      ...(r._resumeState !== undefined ? { _resumeState: r._resumeState } : {}),
      // `_retryState` (spec §1.3 / node-output §4.2.1) — retryable error
      // 종결 시에만 set. `_resumeState` 와 달리 DB 영속되는 보존 필드라
      // boundary 에서 forward 해야 한다.
      ...(r._retryState !== undefined ? { _retryState: r._retryState } : {}),
    };
  }

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
 * `stripControlFields`, downstream `$input.<field>` access) keep working
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
  //
  // `port` and `status` are authoritative from the handler: when a handler
  // explicitly declares them at the top level, they MUST win over any
  // same-named field that was forwarded inside `output` (e.g. a switch that
  // does `output: input` after a form resume inherits `port: "out"` /
  // `status: "resumed"` from the upstream — those are control-field leaks,
  // not the handler's routing decision).
  if (adapted.status !== undefined) {
    base.status = adapted.status;
  }
  if (adapted.port !== undefined) {
    base.port = adapted.port;
    // For object outputs, `applyPortSelection` expects `{ port, data }`
    // — synthesise `data` if the handler didn't provide it explicitly.
    if (base.data === undefined) {
      base.data = output;
    }
  }
  // `_resumeState` is NOT treated as authoritative: handlers sometimes stash
  // internal debugging state inside `output._resumeState` on purpose.
  if (adapted._resumeState !== undefined && base._resumeState === undefined) {
    base._resumeState = adapted._resumeState;
  }
  // `_retryState` (spec §1.3 / node-output §4.2.1) — surface the top-level
  // retry continuation state so `applyPortSelection` / DB persistence keep it.
  if (adapted._retryState !== undefined && base._retryState === undefined) {
    base._retryState = adapted._retryState;
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
