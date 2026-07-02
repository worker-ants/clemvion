/**
 * 엔진 전반에서 반복되는 `(x as Record<string, unknown>) ?? {}` 패턴의
 * behavior-preserving 대체 유틸 (refactor-03 M-7).
 *
 * `as Record<string, unknown>` 단언은 컴파일러만 통과시킬 뿐 런타임 검증이 없어,
 * 실제 형태가 객체가 아니면 downstream 이 조용히 오동작한다. 아래 가드는 런타임에
 * 형태를 확인해 malformed 값을 명시적으로 빈 객체로 수렴시킨다.
 *
 * 배열/원시값 취급 주의: 기존 `?? {}` 패턴은 null/undefined 만 `{}` 로 접었고
 * 배열·원시값은 `as` 로 통과시켰다. `toRecord` 는 배열·원시값도 `{}` 로 수렴시키므로,
 * **downstream 이 property 접근만 하는 사이트**(원시값 property = undefined, 배열도 동일)에서
 * 동작이 동일하다. `Object.keys`/spread/배열 순회처럼 배열·원시값을 구분해 쓰는 사이트에는
 * 적용 전 사이트별 확인이 필요하다.
 */

/**
 * non-null object 타입 가드 (배열 제외).
 *
 * **주의 — 순수 plain-object 가드가 아니다**: `typeof === 'object'` 기반이라
 * class 인스턴스(`new Date()`, `new Map()`, `/re/` 등)도 `true` 로 통과한다.
 * `Object.create(null)`(프로토타입 없는 객체)도 `true`. 이 유틸의 용도는
 * "property 접근 가능한 non-array 객체인가" 판별(= `as Record` 단언의 런타임
 * 대체)이지 "JSON-plain object 인가" 검증이 아니다. plain-object 만 허용해야
 * 하는 사이트라면 별도 검사(`value.constructor === Object` 등)를 쓸 것.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `isRecord` 통과 시 그대로, 아니면 빈 객체 — `(x as Record) ?? {}` 의 안전 대체. */
export function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
