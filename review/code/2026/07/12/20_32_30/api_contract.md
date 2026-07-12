# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** enum 값·순서 wire 동치성 확인 (breaking change 없음)
  - 위치: `execution-status.literal.ts`(신규) ↔ `execution-status-response.dto.ts::ExecutionStatusDto.status`, `interact-ack-response.dto.ts::InteractAckDto.currentStatus`
  - 상세: `EIA_EXECUTION_STATUS_VALUES = ['pending','running','waiting_for_input','completed','failed','cancelled'] as const` 를 두 DTO 가 공유하도록 리팩터링했다. 기존에 각 DTO 가 개별 선언하던 6값 리터럴 유니온·swagger `enum` 배열과 값·순서가 완전히 동일하며, `@ApiProperty({ enum: EIA_EXECUTION_STATUS_VALUES })` 직접 참조로 OpenAPI 스키마 표현도 이전(`enum: [...]` 인라인)과 동일하다. `GET /api/external/executions/:id/status`(`ExecutionStatusDto`) 및 `POST /api/external/executions/:id/interact` `/cancel`(`InteractAckDto`) 두 엔드포인트 모두 응답 wire 포맷이 무변경이므로 기존 클라이언트(SDK·위젯)에 영향 없는 순수 내부 리팩터다.
  - 제안: 없음 (현행 유지).

- **[INFO]** 테스트가 SoT-DTO 간 참조 무결성을 신규로 고정 (계약 회귀 안전망 강화)
  - 위치: `execution-status-response.dto.spec.ts`(assertion 추가), `execution-status.literal.spec.ts`(신규), `interact-ack-response.dto.spec.ts`(신규)
  - 상세: 이전 리뷰(19_49_01)의 WARNING 2건(신규 SoT 값 미검증, `InteractAckDto` 스키마 회귀 테스트 부재)에 대한 후속 조치. `execution-status.literal.spec.ts` 가 SoT 배열의 순서(`pin`)와 엔티티 `ExecutionStatus` 와의 순서-무관 집합 동등성을 검증하고, 두 DTO spec 은 각자의 swagger `enum` 이 `EIA_EXECUTION_STATUS_VALUES` 를 그대로 반영하는지(`SwaggerModule.createDocument()` 실제 생성 문서 기준)를 확인한다. `InteractAckDto.currentStatus` 가 optional 로 유지되는지도 함께 단언 — wire 계약(옵셔널 필드 유지) 관점에서 적절하다.
  - 제안: 없음.

- **[INFO]** 엔티티 enum 과의 의도적 비-파생 설계 (레이어 분리 + wire enum 순서 보존)
  - 위치: `execution-status.literal.ts` 상단 JSDoc
  - 상세: TypeORM `Execution.status` 엔티티 enum(`ExecutionStatus`, 순서: `pending,running,completed,failed,cancelled,waiting_for_input`)에서 파생하지 않고, DTO 레이어 전용 로컬 리터럴을 wire SoT 로 별도 유지한다. 근거는 (a) DTO 가 엔티티에 결합되지 않도록 하는 swagger §5-1 원칙, (b) 엔티티 enum 순서가 wire-doc enum 순서(`…waiting_for_input,completed,failed,cancelled`)와 달라 파생 시 OpenAPI `enum` 배열 순서 자체가 바뀌는 것을 회피하기 위함. 두 지점 모두 이번 코드로 실측 대조 가능하며(엔티티 소스·DTO 소스 순서 상이), 하위 호환성을 보존하는 바람직한 설계 판단이다.
  - 제안: 없음.

- 나머지 diff 파일(`plan/in-progress/eia-context-schema-followups.md`, `review/code/2026/07/12/{19_49_01,20_08_27}/**`)은 이번 SoT 리팩터의 계획 갱신·이전 리뷰 산출물 기록으로, API 코드 변경이 아니다.

## 요약

이번 변경은 `ExecutionStatusDto.status` 와 `InteractAckDto.currentStatus` 가 각자 선언하던 동일한 6값 상태 리터럴 유니온 + swagger `enum` 배열을 신규 파일 `execution-status.literal.ts` 의 단일 SoT(`EIA_EXECUTION_STATUS_VALUES` as const + `ExecutionStatusLiteral`)로 통합하고, 이전 리뷰(19_49_01)에서 지적된 테스트 커버리지 갭(SoT 값 미검증·`InteractAckDto` 스키마 회귀 테스트 부재)을 신규 spec 3건으로 메운 순수(behavior-preserving) 리팩터다. 값·순서가 기존과 완전히 동일해 두 엔드포인트(`GET .../status`, `POST .../interact` `/cancel`)의 OpenAPI 응답 스키마·TS 타입 모두 wire-visible 하게 무변경이며, 하위 호환성·버전 관리·응답 형식·에러 응답·요청 검증·URL 설계·페이지네이션·인증/인가 등 API 계약 어느 관점에서도 실질적 리스크가 없다. 신규 spec 은 SoT 순서·엔티티 집합 동등성·두 DTO enum 참조 정합을 회귀 가드로 고정해 향후 drift 를 조기에 잡는 구조로, API 계약 유지보수 관점에서 개선이다.

## 위험도

NONE
