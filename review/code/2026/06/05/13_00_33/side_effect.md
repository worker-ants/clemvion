# 부작용(Side Effect) 리뷰 결과

리뷰 대상: PR-A3 — user-defined variables durable park 영속 + rehydration 복원
커밋: `18fc07f7b2ec5afea3d0635f396e0b088b3c47e7`

---

## 발견사항

### [INFO] `stageDurableResumeSnapshot` — `execution` 객체의 두 필드를 동시에 변경하는 부작용

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `stageDurableResumeSnapshot()` 메서드 (라인 ~8372 이후 추가)
- **상세**: 이 메서드는 `execution.conversationThread`와 `execution.userVariables` 두 필드를 in-place 변경(mutation)한다. 기존 `stageConversationThreadSnapshot`은 `conversationThread` 하나만 변경하던 것을, 이제 두 필드를 변경하는 책임을 갖게 되었다. 의도된 확장이며 호출 직후 `updateExecutionStatus` 트랜잭션이 이 상태를 DB에 원자적으로 commit하는 패턴이 유지되고 있다. 그러나 호출자 3곳(라인 ~3502, ~5112, ~6089)이 모두 동일 패턴을 따르므로, 향후 4번째 park 지점이 추가될 때 `stageDurableResumeSnapshot` 호출을 누락하면 변수 스냅샷만 누락되는 부분적 park 상태가 될 수 있다.
- **제안**: 현재 3개 호출 지점은 모두 정확히 처리됨. 향후 park 지점 추가 시 `stageDurableResumeSnapshot` 호출을 반드시 포함해야 함을 메서드 JSDoc에 "호출 후 즉시 `updateExecutionStatus`와 쌍으로 사용"임을 명시 — 현재 주석에 이미 일부 서술되어 있어 INFO 수준.

---

### [INFO] `rehydrateContext` — `initialVariables` spread 순서가 충돌 해소 동작에 부작용

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `rehydrateContext()` 내 `initialVariables` 구성 (라인 ~1254)
- **상세**: `...this.rehydrateUserVariables(execution.userVariables)` 를 먼저 spread하고 그 뒤에 `__workspaceId` 등 시스템 `__*` 변수를 spread하므로, 만약 `userVariables` 스냅샷에 `__*` 키가 포함되어 있더라도 시스템 변수가 항상 승리하는 override 순서가 보장된다. `rehydrateUserVariables` 내부에서 이미 방어적으로 `__*` 키를 제외하므로 이중 방어가 성립한다. 의도된 설계이며 부작용이 아니나, 향후 시스템 변수 목록(`__workspaceId`, `__workspaceName` 등)이 늘어날 때 새로 추가한 시스템 변수가 spread 목록 아래에 위치해야 한다는 암묵적 제약이 있다. 잘못된 위치에 넣으면 사용자 스냅샷 값이 시스템 변수를 덮어쓰게 된다.
- **제안**: `initialVariables` 객체 리터럴 안에 "user vars는 반드시 먼저, 시스템 `__*`는 반드시 나중" 순서를 유지해야 한다는 주석을 추가하거나, 별도 헬퍼 함수로 분리해 순서를 명시적으로 강제하는 것을 고려. 현재는 코드 내 주석으로 의도가 기술되어 있어 INFO 수준.

---

### [INFO] `stageConversationThreadSnapshot` 제거 — 내부 private 메서드 rename으로 호출자 영향 없음

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- **상세**: `stageConversationThreadSnapshot`이 `stageDurableResumeSnapshot`으로 rename되었다. 이 메서드는 `private`이므로 서비스 외부 호출자는 없다. 스펙 파일과 테스트 파일 모두 새 이름을 올바르게 반영하고 있다. 공개 API 변경 없음.
- **제안**: 해당 없음.

---

### [INFO] `rehydrateContext` 반환 타입 변경 — `variables` 필드 추가

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 라인 ~8994 (`RehydrateCtxSubject` 인터페이스 변경)
- **상세**: `rehydrateContext`의 반환 타입에 `variables: Record<string, unknown>` 필드가 추가되었다. 테스트용 타입 캐스팅 인터페이스(`RehydrateCtxSubject`)가 업데이트되었다. 이 메서드는 서비스 내부에서만 사용되는 private/internal 메서드이므로 외부 API 계약에 영향이 없다. 반환 타입에 새 필드가 추가되는 것은 기존 소비처가 해당 필드를 무시하더라도 런타임 오류를 일으키지 않는다.
- **제안**: 해당 없음.

---

### [INFO] 마이그레이션 V085 — DB 스키마 변경으로 인한 배포 순서 의존

- **위치**: `codebase/backend/migrations/V085__execution_user_variables.sql`
- **상세**: `execution` 테이블에 `user_variables JSONB NULL` 컬럼을 추가하는 DDL이다. `nullable + default null` 설계로 기존 row에 영향이 없다. 배포 전 실행된 row는 `NULL`이며 rehydration이 이를 빈 객체(`{}`)로 처리하므로 회귀가 없다. 단, 마이그레이션 실행 전 새 코드가 배포되면 `execution.userVariables`를 참조하는 TypeORM 매핑이 컬럼 부재 에러를 발생시킬 수 있다. 표준 blue-green 또는 migrate-first 배포 절차를 따르면 문제없다.
- **제안**: 배포 시 마이그레이션을 코드 배포보다 앞서 실행하는 표준 절차를 준수. 현재 migration-guard가 테스트에서 OK로 확인되었으므로 INFO 수준.

---

### [INFO] `execution.entity.ts` — `userVariables` 컬럼이 API 응답 DTO 미포함 확인

- **위치**: `codebase/backend/src/modules/executions/entities/execution.entity.ts` — 추가된 `userVariables` 컬럼
- **상세**: 엔티티 주석에 "API 응답 DTO 미포함 — 내부 rehydration 전용"이 명시되어 있다. TypeORM 엔티티에 컬럼이 추가되어도 DTO 변환 레이어에서 명시적으로 포함하지 않으면 외부 API 응답에 노출되지 않는다. `conversationThread` 컬럼(A1 V084)도 동일 패턴을 따르며, 해당 컬럼이 의도치 않게 API 응답에 노출된 사례가 없다면 `userVariables`도 안전하다. 다만 `execution` 엔티티를 그대로 serialize하는 코드 경로가 있다면 의도치 않게 노출될 수 있다.
- **제안**: `userVariables`가 어떤 DTO에도 포함되지 않는지 `ExecutionResponseDto`/`ExecutionDto` 등을 별도 확인. 주석만으로는 자동 보장이 아님. A1의 `conversationThread`가 이미 안전하게 처리되고 있다면 동일 패턴으로 안전하다고 볼 수 있어 INFO 수준.

---

## 요약

이번 변경(PR-A3)은 `execution` 테이블에 `user_variables JSONB NULL` 컬럼을 추가하고, park 직전에 `stageDurableResumeSnapshot`이 `execution.userVariables`를 in-place 설정한 뒤 `updateExecutionStatus` 트랜잭션과 원자적으로 DB에 commit하며, rehydration 시 `rehydrateUserVariables`가 스냅샷을 정규화해 `initialVariables`에 합산하는 완결된 설계를 따른다. 모든 변경은 서비스 내부 private 메서드 범위에 머물고, 공개 API 시그니처 변경이 없으며, 마이그레이션은 nullable 컬럼이라 기존 row 회귀가 없다. 발견된 항목은 모두 INFO 수준으로, 의도된 설계가 올바르게 구현되어 있으며 의도하지 않은 전역 상태 변경·파일시스템 부작용·외부 네트워크 호출·환경 변수 변경이 없다.

---

## 위험도

NONE
