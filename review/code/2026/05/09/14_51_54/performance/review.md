### 발견사항

- **[INFO]** `publish` 메서드 — `task.finally()` 로 여분의 Promise 객체 생성
  - 위치: `continuation-bus.service.ts`, `publish` 메서드 내 `void task.finally(() => this.inflight.delete(task))`
  - 상세: `task.finally(cb)` 는 새 Promise 를 반환하며 `void` 로 버려지지만, `cb` 등록을 위해 내부적으로 PromiseReaction 객체를 할당한다. 고빈도 호출 환경이라면 GC 압박이 누적될 수 있다. 단, continuation bus 는 사용자 입력 이벤트 단위로만 호출되므로 실제 영향은 없다.
  - 제안: 이 패턴 자체는 인-플라이트 추적 목적으로 적절하며 변경 불필요. 고빈도 use-case 로 확장되면 `finally` 대신 `.then(cleanup, cleanup)` 을 고려할 수 있다.

- **[INFO]** 가드 경로에서 Template Literal 즉시 평가
  - 위치: `continuation-bus.service.ts` — `publish` (line ~131), `acquireLock` (line ~175), `releaseLock` (line ~207) 의 `this.logger.error(...)` 호출
  - 상세: JavaScript 의 template literal 은 항상 즉시 평가된다. NestJS Logger 가 해당 레벨을 억제해도 문자열은 이미 할당된다. 이 가드 경로는 부팅 race 조건 때만 진입하며, 수정 후에는 `onApplicationBootstrap` 이동으로 실제로 이 경로에 진입할 일 자체가 없어진다.
  - 제안: 변경 불필요. 단, 향후 핫패스에 유사 패턴을 추가할 때는 `logger.isLevelEnabled('error')` 로 선행 체크를 고려.

- **[INFO]** `recoverStuckExecutions` — `started_at` 컬럼 인덱스 의존
  - 위치: `execution-engine.service.ts`, `recoverStuckExecutions` — `.andWhere('started_at < :threshold', ...)`
  - 상세: 단일 atomic UPDATE 로 올바르게 구현됐으나, `(status, started_at)` 복합 인덱스가 없으면 `executions` 테이블 풀스캔이 발생한다. 이번 변경 범위에는 해당되지 않지만, row 수가 증가할수록 부팅 시 지연 요인이 된다.
  - 제안: DB 마이그레이션에서 `CREATE INDEX idx_exec_status_started_at ON executions(status, started_at)` 추가를 검토.

- **[INFO]** `onModuleInit` 동기화 (반환타입 `void` 변경)
  - 위치: `execution-engine.service.ts` — `onModuleInit(): void`
  - 상세: 기존 `async onModuleInit()` 에서 `onModuleInit(): void` 로 바뀌어 불필요한 Promise wrapping 이 제거됐다. 미미하지만 올바른 방향.
  - 제안: 변경 그대로 유지.

---

### 요약

이번 변경은 NestJS 부팅 라이프사이클 race 조건을 수정하는 **정확성(Correctness) 픽스**이며, 성능에 대한 실질적인 영향은 없다. 추가된 `!this.publisher` 가드 세 곳은 단순 프로퍼티 접근(O(1))이고, `onApplicationBootstrap` 으로의 이동은 recovery 실행 시점을 수 밀리초 지연시킬 뿐 처리량에는 무관하다. 잠재적 성능 개선 여지는 `(status, started_at)` 복합 인덱스 부재 하나뿐이며, 이는 이번 diff 범위 밖의 DB 레이어 문제다.

### 위험도

**NONE**