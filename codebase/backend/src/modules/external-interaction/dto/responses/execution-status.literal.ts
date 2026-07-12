/**
 * EIA 응답에서 노출하는 execution 상태 리터럴 집합 (SoT).
 *
 * `ExecutionStatusDto.status` 와 `InteractAckDto.currentStatus` 가 공유한다 —
 * 종전에는 두 DTO 가 동일한 6값 유니온 + swagger `enum` 배열을 각자 선언해, 상태값
 * 변경 시 수동으로 여러 곳을 동기화해야 했다.
 *
 * 주의: TypeORM `Execution.status` 엔티티 enum 에서 파생하지 않는다 —
 * (a) DTO 레이어가 엔티티에 결합되지 않도록 하는 swagger §5-1 원칙, (b) 엔티티 enum
 * 순서가 본 wire-doc enum 배열 순서와 달라 OpenAPI `enum` 배열 순서를 바꾸기 때문이다.
 * 로컬 리터럴을 wire SoT 로 둔다.
 */
export const EXECUTION_STATUS_VALUES = [
  'pending',
  'running',
  'waiting_for_input',
  'completed',
  'failed',
  'cancelled',
] as const;

export type ExecutionStatusLiteral = (typeof EXECUTION_STATUS_VALUES)[number];
