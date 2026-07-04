# 부작용(Side Effect) Review — PR2b 동시성 cap admission gate

## 발견사항

- **[WARNING]** `admitExecutionOrDefer` admitted 분기가 `recordRunningSegmentStart` 를 누락 → §8 active-running 누적 타임아웃 언더카운트
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `admitExecutionOrDefer()` (admitted 분기, raw UPDATE 직후) 및 `runExecution()` 의 `alreadyRunning` 분기
  - 상세: 기존 RUNNING 전이 choke point 인 `updateExecutionStatus()` 는 `newStatus === RUNNING && prevStatus !== newStatus` 일 때 항상 `this.recordRunningSegmentStart(execution.id)` 를 호출해 `segmentStartMs` Map 에 세그먼트 시작 시각을 기록한다(`assertActiveTimeWithinLimit` 이 이 값으로 진행 중 세그먼트 경과분을 계산해 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 를 enforce). 그런데 신규 `admitExecutionOrDefer` 의 admitted 분기는 raw SQL `UPDATE ... SET status='running', started_at=NOW()` 로 DB 전이를 직접 수행하고 `execution.status = RUNNING` 을 in-memory mutation 만 한 뒤 `runExecution(execution, input, true)` 를 호출한다. `runExecution` 은 `alreadyRunning=true` 이면 `updateExecutionStatus` 호출 자체를 skip 하므로, 이 경로로 admit 된 모든 Execution 은 `segmentStartMs.set(executionId, ...)` 이 전혀 호출되지 않는다. 결과적으로 `assertActiveTimeWithinLimit` 에서 `segStart = this.segmentStartMs.get(execution.id)` 가 `undefined` → `inProgress = 0` 이 되어, 진행 중인(첫) active 세그먼트의 경과 시간이 누적 계산에서 항상 빠진다. 큐 경로(work-stealing 표준 진입점)를 통과하는 **모든** Execution 이 영향을 받으므로 §8 "단일 Execution 최대 활성-실행 누적 시간" 가드가 사실상 약화된다(멀티 세그먼트 케이스에서는 이후 세그먼트의 `updateExecutionStatus` 이탈 시점에 `segStart` 가 없어 `activeRunningMs` 누적 자체도 스킵될 수 있음 — 7434-7438 라인의 `if (segStart !== undefined)` 가드 참조).
  - 참고: 코드 자체 주석(7286~7290)이 유사 선례(`claimResumeEntry`)에 대해 "그 경로는 `segmentStartMs` 세그먼트 tracking 도 자체 보정한다 — 본 헬퍼의 RUNNING 진입 로직 변경 시 `claimResumeEntry` 도 함께 점검할 것"이라고 명시하고 있어, 이번 신규 admission 경로도 동일하게 자체 보정이 필요함을 프로젝트 스스로 인지하고 있던 지점이다. `admitExecutionOrDefer`/`runExecution(alreadyRunning=true)` 어느 쪽에도 그 보정이 없다.
  - 제안: `admitExecutionOrDefer` 의 admitted 분기(라인 ~2650) 또는 `runExecution` 의 `alreadyRunning` 분기에 `this.recordRunningSegmentStart(executionId)` 호출을 추가한다. 유닛 테스트(`admitExecutionOrDefer` 관련 describe 블록)에 `segmentStartMs` 반영 여부(또는 `assertActiveTimeWithinLimit` 동작)를 검증하는 케이스를 추가하는 것을 권장.

- **[INFO]** `runExecution` 세 번째 파라미터(`alreadyRunning`) 추가 — 기존 호출자 호환성은 유지됨
  - 위치: `execution-engine.service.ts` `private async runExecution(savedExecution, input, alreadyRunning = false)`
  - 상세: `executeSync`(3783/3787 라인) 와 `executeAsync`(3872 라인)은 기존과 동일하게 2-argument 로 호출하며 기본값 `false` 로 정상 동작(회귀 없음). 오직 `runExecutionFromQueue` 만 신규 3번째 인자 `true` 를 명시 전달한다. `runExecution` 은 `private` 메서드이므로 외부(다른 모듈)의 호출자 영향은 없다.
  - 제안: 없음(정보성 확인).

- **[INFO]** `EXECUTION_STARTED` emit 이중 경로 — 정상 흐름에서는 배타적이나 결합도 증가
  - 위치: `admitExecutionOrDefer` admitted 분기의 `emitExecution(..., EXECUTION_STARTED, ...)` vs `runExecution` 의 기존 `updateExecutionStatus` 직후 `emitExecution(..., EXECUTION_STARTED, ...)`
  - 상세: `alreadyRunning` 플래그로 두 emit 경로가 상호 배타(무 중복)로 설계되어 있고, `runExecutionFromQueue` 만 `true` 를 넘기므로 현재 콜그래프상 이중 emit 은 발생하지 않는다. 다만 향후 새 호출 경로가 `admitExecutionOrDefer` 를 거치지 않고 `runExecution(exec, input, true)` 를 직접 호출하면 STARTED 이벤트가 누락되는 방식으로 결합돼 있어(암묵적 계약), 실수로 오용될 여지가 있다.
  - 제안: 특별한 조치 불필요(private 메서드 스코프 내 계약이라 위험은 낮음). 필요 시 `alreadyRunning` 파라미터명을 `admittedByQueueGate` 처럼 더 좁게 명명하거나 JSDoc 에 "admitExecutionOrDefer 경유가 아니면 절대 true 로 호출 금지" 경고를 추가하면 재발 방지에 도움.

- **[INFO]** `queuedAt` nullable + `DEFAULT NOW()` — 기존 row 무해성 확인됨
  - 위치: `V104__execution_queued_at.sql`, `execution.entity.ts`
  - 상세: 마이그레이션 주석대로 기존 row 는 마이그레이션 시각으로 채워지고, 이미 종결/실행 중 상태라 `admitExecutionOrDefer`(PENDING 조건부 UPDATE 진입) 대상이 아니므로 실질적 부작용 없음. `admitExecutionOrDefer` 의 `(a)` 분기는 `if (execution.queuedAt)` 가드가 있어 `null` 인 경우(이론상 발생 안 함) 5분 타임아웃 체크를 건너뛰고 cap 체크로 직행 — fail-open 이지만 현재 스키마상 도달 불가능한 방어적 분기라 실질 위험 없음.
  - 제안: 없음.

- **[INFO]** `WorkspacesService.updateSettings` — `maxConcurrentExecutions` 병합 로직은 기존 필드(`interactionAllowedOrigins`, `timezone`) 병합 패턴과 동일하게 "제공 시에만 병합, 미제공 시 보존" 방식으로 다른 설정 필드에 영향 없음. DTO 검증(`@IsInt @Min(1)`)이 서비스 계층 검증을 대체하므로 방어 중복 없이 안전.

## 요약

이번 변경은 새 admission gate(`admitExecutionOrDefer`)와 큐 대기 타임아웃(`markQueueWaitTimeout`)을 `runExecutionFromQueue` PENDING 분기에 삽입하고, `runExecution` 에 하위호환 기본값을 가진 optional 파라미터(`alreadyRunning = false`)를 추가하는 방식으로 구현되어 기존 호출자(`executeSync`/`executeAsync`)에는 시그니처·동작 회귀가 없다. 전역 변수 신설이나 예기치 않은 파일시스템·네트워크 부작용도 없으며, 이벤트 emit 경로(`EXECUTION_STARTED`/`EXECUTION_CANCELLED`)도 현재 콜그래프 내에서는 상호 배타적으로 잘 설계되어 있다. 다만 가장 중요한 발견은, 새 admission 경로가 `updateExecutionStatus` choke point 를 우회하면서 그 부수효과 중 하나인 `recordRunningSegmentStart`(§8 active-running 누적 타임아웃 tracking의 세그먼트 시작 기록)를 재현하지 않았다는 점이다. 이는 코드 자체 주석이 명시한 "RUNNING 진입 로직을 choke point 밖에서 재현할 때는 `segmentStartMs` 도 함께 보정해야 한다"는 선례(`claimResumeEntry`)를 따르지 않은 것으로, 큐를 경유하는 모든 Execution(사실상 표준 실행 경로 전체)에서 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 가드가 조용히 약화되는 결과를 낳는다. 기능 자체(cap admission, 큐 대기 취소)는 의도대로 동작하지만 이 side effect 누락은 별도 spec 가드(§8 시간 제한)의 실효성을 깎아먹으므로 수정을 권장한다.

## 위험도

MEDIUM
