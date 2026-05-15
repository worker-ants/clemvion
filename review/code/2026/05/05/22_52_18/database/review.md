### 발견사항

- **[INFO]** `?? undefined` 패턴은 redundant — TypeORM 동작에 영향 없음
  - 위치: `execution-engine.service.ts` diff +387~388
  - 상세: `options?.executedBy ?? undefined`에서 `options?.executedBy`가 이미 `undefined`를 반환하므로 `?? undefined`는 무연산(no-op). TypeORM `create()`는 `undefined` 필드를 INSERT에서 누락시키고 DB 기본값(`NULL`)을 사용한다. 동작 결과는 동일하지만 의도가 모호해 보임.
  - 제안: `executedBy: options?.executedBy`, `triggerId: options?.triggerId`로 단순화

- **[WARNING]** `trigger_id` 컬럼 인덱스 부재 확인 필요
  - 위치: `Execution` 엔티티 `trigger_id` 컬럼
  - 상세: 이번 변경의 목적인 "최근 실행" 화면 출처 분류(`deriveExecutionTrigger`)가 `trigger_id IS NOT NULL` 조건으로 필터/정렬한다면, 해당 컬럼에 인덱스가 없을 경우 Execution 행이 누적될수록 전체 테이블 스캔이 발생한다. diff에 인덱스 마이그레이션이 포함되어 있지 않아 기존 스키마 상태를 확인해야 한다.
  - 제안: `deriveExecutionTrigger`가 `trigger_id`를 쿼리 조건으로 사용하는지 확인하고, 인덱스가 없으면 `CREATE INDEX CONCURRENTLY`로 추가(무중단)

- **[INFO]** `executedBy` ↔ `triggerId` 상호 배타성이 DB 레벨에서 강제되지 않음
  - 위치: `Execution` 테이블 스키마
  - 상세: 설계상 수동 실행은 `executed_by`만, 스케줄/웹훅은 `trigger_id`만 채워야 하지만, CHECK 제약(`CHECK (executed_by IS NULL OR trigger_id IS NULL)`)이 없어 애플리케이션 버그 시 두 컬럼 모두 값이 들어갈 수 있다. `deriveExecutionTrigger`의 우선순위 로직이 이를 보완하지만, 잘못된 데이터가 조용히 저장될 수 있음.
  - 제안: 강제하려면 DB CHECK 제약 추가 검토. 현재 우선순위 분류 로직이 방어적으로 작동한다면 INFO 수준으로 수용 가능

- **[INFO]** hooks.service.ts — Execution 생성과 `lastTriggeredAt` 업데이트가 단일 트랜잭션 외부
  - 위치: `hooks.service.ts` L96~103 (기존 코드, 이번 변경과 무관)
  - 상세: `execute()` 성공 후 `triggerRepository.save(trigger)`가 실패하면 `trigger_id`가 채워진 Execution은 존재하나 `lastTriggeredAt`은 갱신되지 않은 불일치 상태가 된다. 이번 변경이 도입한 문제는 아니나, `triggerId` 보존 로직이 추가된 시점에 함께 검토할 만함.
  - 제안: 두 DB 쓰기를 `queryRunner` 트랜잭션으로 묶거나, `lastTriggeredAt` 실패가 핵심 흐름에 영향 없다고 판단하면 현 구조 유지

---

### 요약

이번 변경의 핵심은 `Execution.trigger_id` / `executed_by` 컬럼 populate로, 스키마는 이미 nullable로 존재하므로 마이그레이션 위험은 없다. DB 관점에서 실질적 위험은 낮지만, `trigger_id` 컬럼에 인덱스가 없다면 실행 내역 조회 화면의 출처 분류 쿼리에서 성능 저하가 발생할 수 있으므로 인덱스 존재 여부를 확인하는 것이 권장된다. `executedBy`/`triggerId` 상호 배타성은 애플리케이션 레벨에서만 강제되며, Execution–Trigger 간 다중 쓰기의 비트랜잭션 패턴은 기존부터 존재하던 구조적 한계다.

### 위험도

LOW