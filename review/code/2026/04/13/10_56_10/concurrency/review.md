## 동시성 코드 리뷰

### 발견사항

- **[WARNING]** `hooks.service.ts` — `lastTriggeredAt` 비원자적 갱신
  - 위치: `hooks.service.ts` `handleWebhook()` 마지막 두 줄
  - 상세: 동일 엔드포인트로 동시 웹훅 요청이 들어올 경우, 두 요청이 각각 `trigger` 엔티티를 DB에서 읽어 온 뒤 각자 `lastTriggeredAt`을 세팅하고 저장한다. TypeORM `save()`는 PK 기반 upsert이므로 마지막 write가 이긴다. `lastTriggeredAt`만 건드리므로 데이터 손실은 없지만, 값의 정확한 순서가 보장되지 않는다.
  - 제안: `UPDATE trigger SET last_triggered_at = NOW() WHERE id = $1` 형태의 단일 SQL로 변경하거나, TypeORM의 `update()` 메서드를 사용해 읽지 않고 바로 갱신한다.

- **[WARNING]** `schedule-runner.service.ts` — BullMQ 동시 잡 처리 시 동일 스케줄 중복 실행
  - 위치: `process()` 메서드 내 `schedule.lastRunAt` / `schedule.nextRunAt` 갱신 구간
  - 상세: `WorkerHost` 기본 concurrency > 1이거나 Redis 재연결 시 동일 잡이 재처리될 경우, 두 worker가 동일 `scheduleId`로 `scheduleRepository.findOne` → `resolveScheduleParameters` → `execute` → `save` 시퀀스를 동시에 진행할 수 있다. `lastRunAt`/`nextRunAt` 갱신은 비원자적이며, 동일 워크플로우의 실행이 중복 생성될 수 있다.
  - 제안: BullMQ job scheduler에 `{ removeOnComplete: true }` 및 잡 ID를 `scheduleId`로 고정해 중복 큐잉을 방지하거나, DB 수준에서 낙관적 잠금(optimistic lock / `@Version()`)을 적용한다. 또는 BullMQ concurrency를 1로 제한하는 옵션을 명시한다.

- **[WARNING]** `loadTriggerParameterSchema` 코드 3중 복제 — TOCTOU 창 확대
  - 위치: `hooks.service.ts`, `schedule-runner.service.ts`, `workflows.controller.ts` 각각 독립 구현
  - 상세: 스키마 로딩(DB 읽기)과 실행 사이의 시간 간격(TOCTOU)이 세 곳에서 각자 발생한다. 이 사이에 trigger 노드 config가 변경되면 읽은 스키마와 실제 실행 시 config가 불일치한다. 코드 중복으로 인해 버그 수정이나 캐싱 추가 시 한 곳만 고쳐지는 위험도 있다.
  - 제안: `ExecutionEngineModule`에서 이미 `ExpressionResolverService`를 export했듯이, `TriggerSchemaLoader` 또는 `ManualTriggerSchemaService` 같은 단일 서비스를 두고 세 곳에서 주입해 사용한다.

- **[INFO]** `schedule-runner.service.ts` — `evaluate()` (외부 라이브러리) 글로벌 상태 여부 불명
  - 위치: `resolveLimitedExpression()` 내 `evaluate(value, ctx)` 호출
  - 상세: Node.js는 단일 스레드이므로 일반적으로 안전하나, `@workflow/expression-engine`의 `evaluate()`가 내부적으로 캐시나 파서 상태를 모듈 레벨 변수로 관리한다면 동일 이벤트 루프 내 비동기 경계를 넘지 않는 이상 문제없다. 단, Worker Thread 사용 시에는 확인 필요.
  - 제안: `evaluate()`가 순수 함수임을 라이브러리 문서에서 확인하거나, 단위 테스트에서 동시 호출 시 결과 독립성을 검증한다.

- **[INFO]** `workflows.controller.ts` — `@InjectRepository(Node)` 컨트롤러 직접 주입
  - 위치: `WorkflowsController` 생성자
  - 상세: 동시성 문제는 아니지만, 컨트롤러가 Repository를 직접 소유하면 `loadTriggerParameterSchema`의 DB 호출이 HTTP 요청 스레드에서 직접 발생한다. 고부하 시 DB 커넥션 풀 경쟁이 악화될 수 있다.
  - 제안: 서비스 계층으로 이동해 커넥션 풀 사용을 집중 관리한다.

---

### 요약

이번 변경은 주로 트리거 파라미터 스키마 해석·검증 로직 추가이며, 핵심 유틸(`resolveTriggerParameters`, `coerceToType`, `validateTriggerParameterSchema`)은 순수 함수로 스레드 안전하다. 비동기 호출은 전반적으로 `await`가 누락 없이 적용되어 있다. 다만 `lastTriggeredAt` 갱신의 비원자적 읽기-수정-저장 패턴과 BullMQ 워커 중복 처리 시 동일 스케줄이 이중 실행될 수 있는 구조적 위험이 존재한다. Node.js 단일 스레드 특성상 인메모리 레이스 컨디션은 없으나, DB 레벨의 동시 접근 안전성은 일부 보완이 필요하다.

### 위험도

**MEDIUM**