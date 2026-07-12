# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** enum 값·순서 완전 동치 — breaking change 없음
  - 위치: `execution-status.literal.ts`(신규) ↔ `execution-status-response.dto.ts::ExecutionStatusDto.status`, `interact-ack-response.dto.ts::InteractAckDto.currentStatus`
  - 상세: 두 DTO 가 각자 선언하던 6값 리터럴 유니온(`'pending'|'running'|'waiting_for_input'|'completed'|'failed'|'cancelled'`) + swagger `enum` 배열을 신규 `EIA_EXECUTION_STATUS_VALUES`(as const) 단일 SoT 로 통합했다. diff 대조 결과 값·순서가 치환 전과 100% 동일(`enum: EIA_EXECUTION_STATUS_VALUES` 는 기존 하드코딩 배열과 동일 리터럴). `ExecutionStatusLiteral` 파생 타입도 기존 유니온과 구조적으로 동일 집합이라 컴파일 타임 계약도 무변경. OpenAPI 스키마(`components.schemas.ExecutionStatusDto.properties.status.enum` / `InteractAckDto.properties.currentStatus.enum`)와 wire 응답 모두 기존 클라이언트(SDK·위젯)에 영향 없는 순수 내부 리팩터다.
  - 제안: 없음(현행 유지).

- **[INFO]** drift 가드 테스트 신설 — API 계약 견고성 개선
  - 위치: `execution-status-response.dto.spec.ts`(신규 `describe('status enum — 공유 SoT …')`), `interact-ack-response.dto.spec.ts`(신규 파일)
  - 상세: (a) `status.enum`/`currentStatus.enum` 이 `[...EIA_EXECUTION_STATUS_VALUES]` 와 deep-equal 함을 값·순서까지 단언, (b) `EIA_EXECUTION_STATUS_VALUES` 정렬 집합이 엔티티 `ExecutionStatus` 정렬 집합과 동일함을 단언. 향후 상태값 추가/제거 시 wire enum 배열이 엔티티와 조용히 어긋나는 것을 CI 에서 즉시 검출하도록 하는 회귀 가드로, API 계약 관점에서 바람직한 보강이다. `InteractAckDto` 는 이전에 OpenAPI 스키마 회귀 테스트 자체가 없던 갭이었는데(pre-existing) 이번에 신설되어 커버리지 공백도 해소됨.
  - 제안: 없음.

- **[INFO]** 엔티티 enum 과 wire enum 의 의도적 순서 비-파생 설계 — 확인됨
  - 위치: `execution-status.literal.ts` 상단 JSDoc, `executions/entities/execution.entity.ts:14-21`
  - 상세: 엔티티 `ExecutionStatus` 의 실제 선언 순서(`pending,running,completed,failed,cancelled,waiting_for_input`)는 wire enum 순서(`pending,running,waiting_for_input,completed,failed,cancelled`)와 실제로 다름을 직접 대조 확인했다. 로컬 리터럴을 wire SoT 로 별도 유지해 엔티티 enum 순서 변경이 OpenAPI 문서의 `enum` 배열 순서(및 이를 신뢰하는 클라이언트 코드젠 결과물)에 영향을 주지 않도록 레이어를 분리한 설계는 하위 호환성 관점에서 올바른 판단이다.
  - 제안: 없음.

- **[INFO]** 에러 응답·요청 검증·URL·페이지네이션·인증/인가는 diff 범위 밖
  - 상세: 본 변경은 `GET /api/external/executions/:id` 응답의 `status` 필드와 `POST .../interact`·`/cancel` ack body 의 `currentStatus` 필드 선언 위치만 리팩터한 것으로, 엔드포인트 시그니처·HTTP 상태 코드·요청 DTO validation·라우트 경로·인증 가드·페이지네이션 로직은 전혀 손대지 않았다.
  - 제안: 없음.

## 요약

이번 변경은 `ExecutionStatusDto.status` 와 `InteractAckDto.currentStatus` 가 개별 선언하던 동일한 6값 상태 리터럴 유니온과 swagger `enum` 배열을 신규 파일 `execution-status.literal.ts` 의 단일 SoT(`EIA_EXECUTION_STATUS_VALUES` as const + `ExecutionStatusLiteral`)로 통합한 behavior-preserving 리팩터다. 직접 diff·엔티티 대조로 값·순서가 치환 전후 완전히 동일함을 확인했으며, 추가된 두 drift-가드 테스트(SoT 값 assertion + 엔티티↔wire 집합 동등성)는 향후 상태값 변경 시 wire 계약이 조용히 어긋나는 것을 막는 유익한 보강이다. 하위 호환성·버전 관리·응답 형식·에러 응답·요청 검증·URL 설계·페이지네이션·인증/인가 어느 관점에서도 실질적 리스크는 없다. 나머지 파일(plan 문서, 이전 리뷰 산출물 RESOLUTION/SUMMARY/`_retry_state.json`/기타 reviewer .md)은 이 리팩터의 완료·리뷰 이력 기록일 뿐 API 계약과 무관하다.

## 위험도

NONE
