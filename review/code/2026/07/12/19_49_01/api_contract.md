# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** enum 값·순서 동치성 확인 (breaking change 없음)
  - 위치: `execution-status.literal.ts` (신규) ↔ `execution-status-response.dto.ts::ExecutionStatusDto.status`, `interact-ack-response.dto.ts::InteractAckDto.currentStatus`
  - 상세: `EXECUTION_STATUS_VALUES = ['pending','running','waiting_for_input','completed','failed','cancelled']`(as const)를 두 DTO 가 공유하도록 리팩터링했다. diff 를 대조하면 기존에 각 DTO 가 개별 선언하던 6값 리터럴 유니온·swagger `enum` 배열과 값·순서가 완전히 동일하다(`[...EXECUTION_STATUS_VALUES]` spread 로 동일 배열 생성). 따라서 OpenAPI 스키마(`enum` 목록·순서)와 TS 타입(`ExecutionStatusLiteral`)이 기존과 wire-visible 하게 100% 동치이며, 기존 클라이언트(SDK·위젯) 에 영향 없는 순수 내부 리팩터다.
  - 제안: 없음 (현행 유지). plan 문서(`eia-context-schema-followups.md`)에도 "DTO 스키마 회귀 15건 green" 검증 완료가 기록되어 있어 교차 확인됨.

- **[INFO]** 엔티티 enum 과의 의도적 비-파생 설계
  - 위치: `execution-status.literal.ts` 상단 주석
  - 상세: TypeORM `Execution.status` 엔티티 enum 에서 파생하지 않고 로컬 리터럴을 wire SoT 로 별도 유지한다는 설계 근거가 문서화되어 있다 — (a) DTO 레이어가 엔티티에 결합되지 않도록 하는 swagger §5-1 원칙, (b) 엔티티 enum 순서가 wire-doc enum 순서와 달라 파생 시 OpenAPI enum 순서가 바뀌는 것을 회피. API 계약 관점에서 바람직한 판단이며 하위 호환성을 보존한다.
  - 제안: 없음.

## 요약

이번 변경은 `ExecutionStatusDto.status` 와 `InteractAckDto.currentStatus` 가 각자 선언하던 동일한 6값 상태 리터럴 유니온 + swagger `enum` 배열을 신규 파일 `execution-status.literal.ts` 의 단일 SoT(`EXECUTION_STATUS_VALUES` as const + `ExecutionStatusLiteral`)로 통합하는 순수 리팩터다. 값·순서가 기존과 완전히 동일해 OpenAPI 응답 스키마·TS 타입 모두 wire-visible 하게 무변경이며, 하위 호환성·버전 관리·응답 형식·에러 응답·요청 검증·URL 설계·페이지네이션·인증/인가 등 API 계약 어느 관점에서도 실질적 리스크가 없다. 나머지 파일(plan 문서)은 이 리팩터의 완료 기록일 뿐 코드 변경이 아니다.

## 위험도

NONE
