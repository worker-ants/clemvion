/**
 * 실행 결과 값의 OpenAPI 스키마 조각. 마지막 노드의 핸들러 `output` 그대로라 객체 · 배열 ·
 * 원시값일 수 있다(NERV Task CLE-T-JDYHCF 결정 1). `Execution.outputData` 와 외부 상호작용
 * 상태의 `result` 가 같은 값이라 한 곳에 둔다.
 */
export const EXECUTION_RESULT_VALUE_ONE_OF = [
  { type: 'object', additionalProperties: true },
  { type: 'array', items: {} },
  { type: 'string' },
  { type: 'number' },
  { type: 'boolean' },
] as const;

/**
 * 실행 결과 값의 응답 타입. {@link EXECUTION_RESULT_VALUE_ONE_OF} 와 같은 모양이고 `null`(결과가 아직 없는 때)은
 * 쓰는 쪽이 `| null` 로 붙인다. swagger-dto-contract 가드가 타입 글자에서 `null` 을 읽는다.
 */
export type ExecutionResultValue =
  Record<string, unknown> | unknown[] | string | number | boolean;
