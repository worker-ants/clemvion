import { NodeHandlerOutput } from './node-handler.interface.js';

/**
 * Narrow unknown handler return values into the canonical
 * {@link NodeHandlerOutput}. Accepts three legacy shapes during the
 * Phase 1 → Phase 3 migration:
 *
 * 1. Already-migrated: `{ config, output, meta?, port?, status? }` — used as-is.
 * 2. Legacy port selector: `{ port, data, ...rest }` — data becomes `output`,
 *    remaining keys folded into `meta` (except `status`).
 * 3. Legacy bare: any other return value — wrapped as
 *    `{ config: {}, output: raw, status?, port? }`. Root-level `status` or
 *    `port` on objects is lifted so the engine's flow-control logic keeps
 *    functioning.
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
    };
  }

  if (isLegacyPortSelector(raw)) {
    const obj = raw as Record<string, unknown>;
    const { port, data, status, ...rest } = obj;
    const adapted: NodeHandlerOutput = {
      config: {},
      output: data,
    };
    if (typeof port === 'string') adapted.port = port;
    if (typeof status === 'string') adapted.status = status;
    if (Object.keys(rest).length > 0) adapted.meta = rest;
    return adapted;
  }

  // Primitive / array / null / undefined
  if (raw === null || raw === undefined) {
    return { config: {}, output: raw };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { config: {}, output: raw };
  }

  // Legacy bare object — lift root-level `status` / `port` so the engine's
  // blocking check and port-selector logic continues to behave identically.
  const obj = raw as Record<string, unknown>;
  const adapted: NodeHandlerOutput = { config: {}, output: raw };
  if (typeof obj.status === 'string') adapted.status = obj.status;
  if (typeof obj.port === 'string') adapted.port = obj.port;
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
    if (hasConfig || hasControl) {
      return {
        ...(hasConfig ? adapted.config : {}),
        ...(adapted.port !== undefined ? { port: adapted.port } : {}),
        ...(adapted.status !== undefined ? { status: adapted.status } : {}),
      };
    }
    return output;
  }
  if (typeof output !== 'object' || Array.isArray(output)) {
    if (adapted.port || adapted.status || adapted.meta) {
      // Engine expects top-level `status` / port metadata on an object. Keep
      // the raw output under `data` and surface control fields to emulate
      // the legacy `{ port, data, status }` envelope.
      return {
        data: output,
        ...(adapted.port !== undefined ? { port: adapted.port } : {}),
        ...(adapted.status !== undefined ? { status: adapted.status } : {}),
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

function isLegacyPortSelector(raw: unknown): boolean {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    !Array.isArray(raw) &&
    'port' in (raw as Record<string, unknown>) &&
    'data' in (raw as Record<string, unknown>) &&
    !('config' in (raw as Record<string, unknown>)) &&
    !('output' in (raw as Record<string, unknown>))
  );
}
