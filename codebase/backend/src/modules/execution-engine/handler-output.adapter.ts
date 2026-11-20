import { NodeHandlerOutput } from '../../nodes/core/node-handler.interface.js';
import { isRecord } from './utils/to-record.js';

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
      // `config` 는 핸들러가 echo 한 **원문** config 다 (CONVENTIONS Principle 7).
      //
      // **여기서 마스킹하지 않는다** (2026-08-24 변경). 종전엔 `maskSensitiveFields` 를
      // 걸어 *"DB 저장 / WS emit / 표현식 echo 모두 안전"* 하게 만들었는데, 그 **표현식
      // echo 까지 마스킹된 것**이 문제였다 — `migrate-node-output-refs.ts` 가 사용자
      // 표현식을 `$node["<Label>"].config.<field>` 로 이주시키고 있어서, `apiKey` 류
      // 이름의 config 필드를 다운스트림에서 참조하면 리터럴 `****abcd` 가 흘러간다.
      // 가시성 저하가 아니라 **기능 오염**이다.
      //
      // **걷어내도 안전한 이유**: 두 egress 가 **각자 이미** 마스킹한다 —
      // WS 는 `maskWireEnvelope`(모든 emit 이 지난다), REST 는
      // `redactStoredDataForResponse`. 둘 다 **공유** `deepRedactSecrets*` 를 쓰고,
      // 그 키 축(`CREDENTIAL_KEY_PATTERN`)이 `DEFAULT_SENSITIVE_KEYS` 를 **포함**한다
      // (`mask-sensitive-fields.util.spec.ts` 의 포함관계 캐너리가 정본 구현으로 단언 —
      // `DEFAULT_SENSITIVE_KEYS` 를 **직접 순회**하므로 목록이 넓어져도 자동 검사된다).
      //
      // 초판은 그 캐너리가 키를 **손으로 다시 나열**하고도 *"목록에서 파생"* 이라
      // 적었다 — `10_53_52` 리뷰가 실증해 잡았다(egress 가 못 잡는 가상 키를 넣어도
      // 전 스위트 GREEN). 상수를 export 해 진짜 파생으로 고쳤다.
      //
      // 즉 **새로 걸 출구가 없다** — 이 저장소가 반복해 겪은 *"출구 중 하나를 빠뜨린다"*
      // 위험이 원리적으로 없는 형태다. DB 는 이제 원문을 보존하며, 그것이 EIA §R17 의
      // **egress-only 원칙**과 정렬된다(config 만 storage-time 마스킹으로 예외였다).
      config: r.config ?? {},
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
  if (isRecord(obj._resumeState)) {
    adapted._resumeState = obj._resumeState;
  }
  return adapted;
}

/** flat 값에서 떼는 엔진 제어 필드. 이유는 {@link toDownstreamValue} 참조. */
const ENGINE_CONTROL_FIELDS = [
  '_selectedPort',
  'port',
  'status',
  '_resumeState',
  '_resumeCheckpoint',
] as const;

/**
 * 구조화 출력이 없는 노드의 flat 캐시 값에서 다음 노드에 넘길 값을 꺼낸다. 객체면 엔진
 * 제어 필드(`_selectedPort` · `port` · `status` · `_resumeState` · `_resumeCheckpoint`)를
 * 뗀 값이고 그 밖에는 받은 값 그대로다. 제어 필드는 이 노드의 라우팅 · 대기 판정에만 쓰고
 * 다음 노드 `$input` 에 새면 그 노드의 라우팅과 대기 판정이 틀어진다.
 *
 * 배열 · 원시값을 실은 엔진 봉투 `{ data, ... }` 는 풀지 않는다. 봉투는 사용자가 돌려준
 * `{ data: [...] }` 객체와 모양이 같아 flat 값만 보고는 가를 수 없다. 정상 경로는
 * {@link resolveNodeResultValue} 가 구조화 캐시를 읽으므로 이 함수에 닿지 않는다
 * (NERV Task CLE-T-ZJR3AF).
 */
export function toDownstreamValue(flat: unknown): unknown {
  if (!flat || typeof flat !== 'object' || Array.isArray(flat)) {
    return flat;
  }
  const o = flat as Record<string, unknown>;
  if (!ENGINE_CONTROL_FIELDS.some((key) => key in o)) {
    return flat;
  }
  const rest: Record<string, unknown> = { ...o };
  for (const key of ENGINE_CONTROL_FIELDS) delete rest[key];
  return rest;
}

/**
 * 노드의 결과 값, 곧 핸들러가 돌려준 `output` 을 꺼낸다. 다음 노드 `$input`, 컨테이너
 * `emit` 수집, Parallel 분기 결과, 실행 결과(`Execution.outputData`), 동기 서브워크플로
 * 결과(`$node["Workflow"].output.result`)가 이 값을 쓴다. `$node[X].output` 과 같은
 * 값이다(NERV Task CLE-T-JDYHCF 결정 1, CLE-T-ZJR3AF).
 *
 * 구조화 출력 캐시가 정본이다. flat 캐시 값에는 엔진 봉투와 `_selectedPort` 가 섞여 있다.
 * 구조화 출력이 없는 노드(구조화 캐시가 없던 옛 컨텍스트 · 옛 큐 작업)만 flat 값을
 * {@link toDownstreamValue} 로 풀어 쓴다.
 */
export function resolveNodeResultValue(
  caches: {
    structuredOutputCache?: Record<string, NodeHandlerOutput>;
    nodeOutputCache: Record<string, unknown>;
  },
  nodeId: string,
): unknown {
  const structured = caches.structuredOutputCache?.[nodeId];
  if (structured) return structured.output;
  return toDownstreamValue(caches.nodeOutputCache[nodeId]);
}

/**
 * 실행 결과(`Execution.outputData`)에 실을 값. {@link resolveNodeResultValue} 이고 출력이
 * 없으면(`undefined` · `null`) `{}` 다(NERV Task CLE-T-JDYHCF 결정 1). 엔진과 재시도 턴이
 * 같은 규칙을 쓰도록 한 곳에 둔다.
 */
export function resolveExecutionOutputValue(
  caches: {
    structuredOutputCache?: Record<string, NodeHandlerOutput>;
    nodeOutputCache: Record<string, unknown>;
  },
  nodeId: string,
): unknown {
  return resolveNodeResultValue(caches, nodeId) ?? {};
}

/**
 * Collapses a {@link NodeHandlerOutput} back into the pre-migration flat
 * shape so that engine internals (`applyPortSelection`, port routing,
 * blocking detection) keep working without per-call-site refactors.
 * Downstream `$input` reads the structured cache instead
 * ({@link resolveNodeResultValue}). Phase 3 will remove this function along
 * with the legacy cache.
 *
 * 배열 · 원시값 output 은 `port` · `status` · `_resumeState` 중 하나라도 있으면
 * `{ data, ...control }` 봉투로 감싼다. `meta` 는 봉투에 실리지 않으므로 `meta` 만으로는
 * 감싸지 않는다(NERV Task CLE-T-T30D5S). 봉투는 라우팅과 대기 판정에만 쓰고 다음 노드
 * 값은 구조화 캐시에서 읽는다({@link resolveNodeResultValue}, NERV Task CLE-T-ZJR3AF).
 *
 * `null` · `undefined` output 은 포트 하나(문자열)만 있고 `status` · `_resumeState` 가
 * 없을 때 같은 봉투 `{ data, port }` 로 싣는다. 그 밖에는 설정 에코와 제어 필드를
 * 펼친 옛 모양을 유지한다(입력 대기 선언 · Parallel 배열 포트, NERV Task CLE-T-X3AH4F).
 */
export function toEngineFlatShape(adapted: NodeHandlerOutput): unknown {
  const output = adapted.output;

  // Null / undefined output: if there are control fields (status / port) or
  // echoed config, produce a flat envelope so that engine internals (blocking
  // detection, port routing, frontend waiting events) still have something
  // to read. Handlers in `waiting_for_input` state typically carry
  // `output: null` with the meaningful declaration in `config`.
  if (output === null || output === undefined) {
    // 포트 하나만 고르고 대기 선언이 없는 노드(Code 의 `return null` · 반환 없음 등)는
    // 배열 · 원시값처럼 `data` 봉투에 싣는다. 설정 에코를 펼치면 `data` 가 없어
    // `applyPortSelection` 이 `_selectedPort` 를 두지 않고, 모든 출력 포트가 열리며
    // 다음 노드가 설정 에코를 입력으로 받는다(NERV Task CLE-T-X3AH4F).
    // 입력 대기 노드(`status`)는 설정 선언을 펼친 모양을 읽는 경로가 있어 아래 분기에 남기고,
    // 배열 포트(Parallel 분기 선언)도 포트 하나를 고르는 출력이 아니라 그대로 둔다.
    if (
      typeof adapted.port === 'string' &&
      adapted.status === undefined &&
      adapted._resumeState === undefined
    ) {
      return { data: output, port: adapted.port };
    }
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
    if (adapted.port || adapted.status || adapted._resumeState) {
      // Engine expects top-level `status` / port metadata on an object. Keep
      // the raw output under `data` and surface control fields to emulate
      // the legacy `{ port, data, status }` envelope. 다운스트림은 이 봉투가
      // 아니라 구조화 캐시의 `output` 을 읽는다({@link resolveNodeResultValue}).
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

/**
 * canonical `{ config, output, ... }` NodeHandlerOutput shape 인지 판별하는 타입
 * 가드. `adaptHandlerReturn`(strict) 적용 가능 여부(=이미 canonical)를 판단하는
 * 단일 SoT — 동일 도메인 지식이 호출처에 중복 인라인되지 않도록 export 한다
 * (예: 단일 노드 실행의 predecessor 출력 복원 `seedSingleNodePredecessorOutputs`).
 */
export function isCanonicalHandlerOutput(
  raw: unknown,
): raw is NodeHandlerOutput {
  return isNewShape(raw);
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
