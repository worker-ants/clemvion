## 발견사항

- **[INFO]** `executions.service.spec.ts` — `FakeExec` 타입 및 `baseFake` 헬퍼에 `executionPath: string[]` 잔류
  - 위치: `FakeExec` 타입 정의 및 `baseFake` 함수 (diff 에서는 미수정 영역)
  - 상세: `Execution` 엔티티에서 `executionPath` 컬럼이 제거됐으나, 테스트 픽스처 타입에는 남아 있음. `toExecutionDto` 가 더 이상 이 필드를 읽지 않으므로 기능 실패는 없지만, 픽스처가 존재하지 않는 컬럼을 모델링하고 있어 오해를 유발할 수 있음.
  - 제안: `FakeExec.executionPath` 필드 및 `baseFake` 의 `executionPath: []` 제거. 해당 PR 범위 내에서 함께 정리하는 것이 자연스러움.

- **[INFO]** `ContinuationBusService.acquireLock()` — pub/sub 서비스에 분산 lock 기능 공존
  - 위치: `continuation-bus.service.ts:88-102`
  - 상세: Redis SET NX lock 은 "continuation bus"의 책임 범위를 벗어나는 관심사. 다만 publisher connection 재사용이라는 실용적 이유가 있고, PR-B Part B 커밋 메시지 및 spec §7.4 에 명시되어 있어 의도적 결정으로 판단됨. 추후 `RedisService` 분리 시 이동 대상.
  - 제안: 즉각 수정 불필요. 단, 추후 lock 사용처가 늘어날 경우 별도 서비스로 분리 검토.

- **[INFO]** 목록 조회 API의 `executionPath` 응답이 항상 빈 배열로 변경
  - 위치: `executions.service.ts:265` (`toExecutionDto`)
  - 상세: 이전에는 `execution.executionPath ?? []` 로 실제 경로 반환, 현재는 `[]` 고정. 기존 목록 API 소비자가 해당 필드에 의존하고 있다면 조용한 파괴적 변경. 단건 조회(`findById`)는 `execution_node_log` 로 정상 채워지므로 의도된 N+1 회피 트레이드오프로 보임.
  - 제안: API changelog 또는 프런트엔드 소비 지점에서 목록 응답의 `executionPath` 의존 여부 확인 필요.

---

## 요약

전체 변경은 PR-B의 명시된 두 목적(1. `execution_node_log` append-only 모델로의 이행, 2. Redis pub/sub continuation bus + 분산 lock 기반 recovery)에 충실하게 범위가 설정되어 있다. 마이그레이션(V035), 엔티티, 서비스, 테스트, 스펙 문서가 일관된 하나의 변경 단위로 묶여 있고, 무관한 리팩토링이나 기능 확장은 식별되지 않는다. 유일한 미완성 지점은 `executions.service.spec.ts` 픽스처에 남은 `executionPath` 잔여 필드이며, 기능 영향 없이 정리 가능한 수준이다.

## 위험도

**LOW**