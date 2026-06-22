// LLM tool argument 강제 변환 헬퍼. `streamMessage` 루프(plan 빌더)와
// `AssistantToolRouter`(explore 핸들러)가 공유하므로 별도 모듈로 분리해
// 순환 의존 없이 양쪽에서 import 한다.

// args.X is `unknown`; `String(...)` on an object would yield "[object Object]".
// 이 helper는 string 타입만 통과시키고, 그 외(객체·배열·null·number 등)는
// fallback으로 대체한다.
export function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}
