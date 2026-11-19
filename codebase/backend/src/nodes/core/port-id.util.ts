/**
 * Stable dynamic-port id helpers shared by:
 *   - node handlers (e.g. text-classifier, switch) that route by index → port id
 *   - workflow-assistant resolver that publishes runtime ports to the LLM
 *
 * Both layers must agree on the id every entry produces, otherwise edges and
 * router decisions diverge (silent breakage). The regex mirrors the schema
 * constraint (`switch.caseDefSchema.id`, `categoryDefSchema.id`) so that
 * defense-in-depth holds even when input bypasses Zod (DB seed, migration,
 * direct service call).
 *
 * Frontend has a sibling `codebase/frontend/src/lib/node-definitions/resolve-dynamic-ports.ts`
 * that intentionally inlines the same rule — keep all three call sites in sync.
 */

/**
 * 에러 포트 ID. 사용자 정의 동적 포트 ID(버튼 · 케이스 · 조건 · 카테고리)로 쓸 수
 * 없다. 엔진이 `_selectedPort === 'error'` 와 연결선 `sourcePort === 'error'` 를
 * 문자열로 비교해서 같은 노드에 버튼 `error` 와 에러 포트가 있으면 두 연결선을
 * 구분하지 못한다. 근거: [노드 출력 규약 — 포트 · 흐름 상태 · 에러 「Principle 6.
 * 동적 포트 ID 이름」](CLE-NODE-OUTPUT-FLOW#principle-6-동적-포트-id-이름) 의 4번.
 *
 * 프런트 `codebase/frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` 의
 * `ERROR_PORT_ID` 와 값이 같아야 한다. 두 패키지가 공유하는 모듈이 없어서
 * `port-id.util.spec.ts` 가 프런트 소스의 리터럴을 읽어 맞춘다.
 */
export const RESERVED_ERROR_PORT_ID = 'error';

/** Slug allowed for any user/LLM-supplied dynamic-port id (a-zA-Z0-9_-, ≤ 64). */
export const PORT_ID_SLUG_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * `id` 가 stable port id 로 즉시 사용해도 안전한지 — trim 후 길이 ≥ 1 이고
 * slug regex 를 통과해야 한다. resolveStablePortId 와 codebase/backend/scripts 가 모두
 * 동일 정의를 쓸 수 있도록 단일 출처 (drift 방지).
 */
export function isValidStablePortId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed.length === 0) return false;
  return PORT_ID_SLUG_REGEX.test(trimmed);
}

/**
 * Returns `id` (after `trim()`) if it is a valid slug; otherwise `fallback`.
 *
 * Why we re-validate here even though Zod already enforces the regex on
 * insert: the resolver and handlers are sometimes hit with raw config from
 * legacy workflows, scripts, or imports that did not pass through the schema.
 * A bad id silently becoming the routing key is much harder to debug than
 * just falling through to the index-based slot.
 */
export function resolveStablePortId(id: unknown, fallback: string): string {
  if (typeof id !== 'string') return fallback;
  const trimmed = id.trim();
  if (trimmed.length === 0) return fallback;
  if (!PORT_ID_SLUG_REGEX.test(trimmed)) return fallback;
  return trimmed;
}
