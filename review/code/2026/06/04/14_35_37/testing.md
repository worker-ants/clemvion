### 발견사항

- **[INFO]** `execution-limits.spec.ts` — 커버리지 양호, 핵심 분기 전부 커버됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/src/modules/execution-engine/execution-limits.spec.ts`
  - 상세: `resolveMaxActiveRunningMs` 의 기본값·양의 정수·0(무제한)·fallback(음수/소수/공학표기/비숫자/공백) 4개 케이스 모두 단일 describe 블록에 커버. `DEFAULT_MAX_ACTIVE_RUNNING_MS` 상수값(30분)도 직접 검증. 독립 실행 가능, 환경 변수 주입이 파라미터로 분리되어 `process.env` 오염 없음.
  - 제안: 없음.

- **[WARNING]** `execution-engine.service.spec.ts` — private 멤버 직접 접근 패턴이 테스트 격리 안정성을 약화시킴
  - 위치: `execution-engine.service.spec.ts` 라인 1363–1376 (`priv()` 헬퍼 정의부)
  - 상세: `service as unknown as { maxActiveRunningMs; segmentStartMs; assertActiveTimeWithinLimit; updateExecutionStatus }` 캐스팅으로 private 구현 내부를 직접 조작한다. 현재 동작은 검증되지만, 리팩토링(멤버명 변경·추출)이 일어날 때 컴파일 에러 없이 런타임 `undefined` 에서 조용히 깨질 수 있다. 기존 spec 패턴 재사용(`service as unknown as {...}`)이라고 주석에 명시돼 있으나, private 접근 범위가 넓어질수록 위험도 증가.
  - 제안: `assertActiveTimeWithinLimit` 는 `protected` 또는 `@VisibleForTesting` 트릭 없이 `ExecutionEngineService` 에 얇은 `internal_` 접두어 public 메서드로 노출하거나, 별도 class(e.g. `ActiveRunningTracker`)로 추출해 직접 단위 테스트하는 구조를 장기적으로 검토. 단기에는 현행 유지 가능.

- **[WARNING]** `updateExecutionStatus` 테스트에서 `Date.now()` 에 의존하는 타이밍 민감 어서션이 flaky 위험을 내포
  - 위치: `execution-engine.service.spec.ts` 라인 1422–1455 (`RUNNING 진입 시 segmentStart 기록` / `waiting_for_input` 파크 테스트)
  - 상세: 두 테스트는 `priv().segmentStartMs.set(executionId, Date.now() - 300)` 처럼 실시간 `Date.now()`를 쓰고 `expect(exec.activeRunningMs).toBeGreaterThanOrEqual(300)` 으로 하한 검증한다. CI 환경에서 스케줄러 지연이 발생하면 오탐은 아니지만, 실시간 의존 설계 자체가 결정론적 단위 테스트 원칙과 어긋난다. 특히 `RUNNING → COMPLETED` 전환 테스트(`라인 1430–1438`)는 두 번의 `Date.now()` 호출 사이에 충분한 시간(300ms)을 가정하나 모킹 없음.
  - 제안: `jest.useFakeTimers()` + `jest.setSystemTime()` 으로 시간 고정, 또는 `Date.now`를 주입 가능한 함수(`nowFn: () => number = Date.now`)로 추출해 테스트에서 결정론적으로 제어. 이렇게 하면 `inProgress = segStart !== undefined ? nowFn() - segStart : 0` 경로도 정확히 검증 가능.

- **[WARNING]** `assertActiveTimeWithinLimit` 의 "진행 중 세그먼트 합산" 테스트(라인 1398–1409)가 `Date.now()` 직접 호출로 경쟁조건 가능성 존재
  - 위치: `execution-engine.service.spec.ts` 라인 1398–1409
  - 상세: `priv().segmentStartMs.set('e3', Date.now() - 500)` 후 즉시 `assertActiveTimeWithinLimit({ activeRunningMs: 600 })` 호출. `inProgress`는 최소 500ms이므로 합산이 1100 ≥ 1000 → throw가 보장되는 구조지만, 극단적으로 느린 환경(테스트 러너가 500ms 이상 sleep되면)에서는 통과가 보장된다. 반대로 `inProgress < 400`이 되는 경우는 없으나, `600 + (< 400) < 1000`이 되면 false negative. 현실적으론 발생하기 어렵지만 fake timer 사용으로 완전히 제거 가능.
  - 제안: `jest.useFakeTimers()` 적용 시 해소됨(위와 동일 수정).

- **[INFO]** `classifyExecutionFailure` 의 `EXECUTION_TIME_LIMIT_EXCEEDED` 추가에 대응하는 기존 테스트 갱신 여부 확인 필요
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` (변경 파일 3)
  - 상세: `TIMEOUT_CODES` Set에 `EXECUTION_TIME_LIMIT_EXCEEDED`가 추가됐다. 이 파일에 대응하는 spec 파일(`execution-failure-classifier.spec.ts` 또는 유사)이 존재하는지 payload에서 확인할 수 없었다. 만약 해당 파일의 유닛 테스트에 `EXECUTION_TIME_LIMIT_EXCEEDED` 케이스가 추가되지 않았다면 커버리지 갭이 존재한다.
  - 제안: `execution-failure-classifier.spec.ts`에 `code: 'EXECUTION_TIME_LIMIT_EXCEEDED'` 입력 시 `key: 'executionFailedTimeout'`이 반환됨을 검증하는 케이스 추가.

- **[INFO]** e2e 테스트(`system-status.e2e-spec.ts`)의 `EXPECTED_QUEUE_NAMES` 하드코딩 유지 비용
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/test/system-status.e2e-spec.ts` 라인 1458–1506
  - 상세: 큐 이름이 `system-status.constants.ts`의 `MONITORED_QUEUES`와 이중 관리됨. 이번 변경으로 `'execution-run'`이 양쪽에 동기적으로 추가됐고 e2e 주석에 동기화 의무가 명시되어 있으나, 향후 큐 추가 시 human error 가능성이 남는다. 현재 e2e 가 소스를 직접 import 할 수 없는 이유(전이 로드로 jest 모듈 해석 실패)가 주석에 설명돼 있어 구조적 제약임을 인지.
  - 제안: 이 제약은 구조적이므로 단기 조치는 불필요. 단, 큐 추가 PR 체크리스트에 e2e `EXPECTED_QUEUE_NAMES` 갱신을 명시적으로 등재하는 것을 권장.

- **[INFO]** `ExecutionTimeLimitError` 에 대한 독립 단위 테스트 부재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/src/modules/execution-engine/workflow-errors.ts`
  - 상세: `ExecutionTimeLimitError` 클래스 자체(생성자 메시지 포맷, `.code` 프로퍼티 = `ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED`)를 직접 검증하는 테스트가 없다. 현재 `execution-engine.service.spec.ts`의 `assertActiveTimeWithinLimit` 테스트가 `toThrow(ExecutionTimeLimitError)` instanceof 검사를 하므로 에러 타입은 간접 검증되나, 에러 메시지 포맷이나 `.code` 값은 검증하지 않는다.
  - 제안: `workflow-errors.spec.ts`가 존재하면 거기에, 없다면 `execution-limits.spec.ts`나 별도 파일에 생성자 파라미터 → `message`/`.code` 검증 테스트 추가(INFO 수준이므로 즉각 필수는 아님).

- **[INFO]** `system-status.constants.ts`의 `executionRunConcurrency` 상수화 경로에 대한 유닛 테스트 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap/codebase/backend/src/modules/system-status/system-status.constants.ts` 라인 1135–1136
  - 상세: `resolveExecutionRunWorkerConcurrency()` 함수 자체는 `execution-run.queue.ts`에 정의되어 있으며 그쪽에서 테스트될 가능성이 있다. `system-status.constants.ts`는 이를 임포트해 모듈 레벨에서 호출하므로 별도 테스트는 불필요하다. 단, `continuationConcurrency`와 달리 `resolveExecutionRunWorkerConcurrency()` 래핑 함수를 사용하므로 두 패턴이 혼재한다.
  - 제안: 동일 파일에서 `continuationConcurrency`는 `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1` 인라인, `executionRunConcurrency`는 함수 위임으로 패턴이 불일치. 일관성 차원에서 continuation도 동일 함수 패턴으로 통일 고려(기능 영향 없음).

### 요약

전반적으로 테스트 구조는 양호하다. `execution-limits.spec.ts`는 신규 모듈로서 필요한 케이스를 모두 포함하고 있으며, `execution-engine.service.spec.ts`의 PR2a 블록은 `assertActiveTimeWithinLimit`와 `updateExecutionStatus`의 핵심 시나리오(한도 초과/미만, 세그먼트 합산, 0=무제한, 파크 시간 제외)를 충실히 커버한다. 주된 위험은 `Date.now()` 직접 의존으로 인한 타이밍 민감 테스트 두 건으로, fake timer 미사용 시 결정론적 보장이 없다. `execution-failure-classifier.ts`에 새 에러코드를 추가했으나 해당 분류기의 유닛 테스트에 신규 케이스가 추가됐는지 payload 범위에서 확인할 수 없었으므로 별도 점검이 필요하다. 나머지 발견사항은 테스트 가독성·구조 개선 관련 INFO 수준이다.

### 위험도
MEDIUM
