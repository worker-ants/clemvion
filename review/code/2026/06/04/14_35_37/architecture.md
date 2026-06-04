### 발견사항

- **[INFO] `segmentStartMs` in-memory Map의 인스턴스 범위와 다중 인스턴스 환경**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `private readonly segmentStartMs = new Map<string, number>()`
  - 상세: `segmentStartMs`는 서비스 인스턴스 내 메모리에만 보관된다. 주석에 "세그먼트는 한 인스턴스 안에서 처리되므로 in-memory Map 으로 충분(누적값은 row 에 영속)"이라고 명시되어 있고, BullMQ 워커가 job을 가져간 인스턴스에서 끝까지 처리한다는 전제가 있다. 그러나 PR3(stalled-job 재배달)이 구현되면 다른 인스턴스가 동일 executionId를 재처리할 수 있어, 재처리 시 신규 인스턴스의 `segmentStartMs`에는 해당 key가 없어 세그먼트 시작 시각이 누락된다. 이 경우 세그먼트 시작 직후 `assertActiveTimeWithinLimit`는 `inProgress=0`을 사용해 누적 DB 값(`activeRunningMs`)만으로 판정하게 되어 단일 세그먼트 초과 감지가 실질적으로 비활성화된다.
  - 제안: PR3 범위에서 rehydration 시 세그먼트 시작 시각을 DB 또는 Redis에서 복원하거나, 적어도 인계 시점에 부분 누적을 DB row에 flush하는 설계를 명시해 PR3 설계 단계에서 이 gap을 닫을 것. 현재 PR2a 범위에서는 "한 인스턴스 처리" 불변식을 유지하므로 즉각 결함은 아니나, 해당 전제가 아키텍처 문서에 명시적으로 기재돼야 후속 PR에서 암묵적 위반이 발생하지 않는다.

- **[INFO] `assertActiveTimeWithinLimit`의 책임 위치 — SRP 경계**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertActiveTimeWithinLimit` private 메서드
  - 상세: 이 메서드는 누적 시간 검사(정책 결정)와 `segmentStartMs` Map 조회(상태 접근)를 동시에 수행한다. `ExecutionEngineService`가 이미 워크플로우 dispatch·상태 전이·routing 등 다수의 책임을 지닌 대형 서비스(8000+ 라인 규모)에서 추가 책임을 내부에 두는 것은 기존 패턴을 따르므로 당장은 위반이 아니다. 그러나 `execution-limits.ts`라는 별도 모듈로 설정 파싱은 분리했으면서 판정 로직은 서비스 내에 남아 있어 분리 기준이 일관적이지 않다.
  - 제안: 향후 limit 판정 로직을 `execution-limits.ts` 또는 별도 `ExecutionLimitsGuard` 클래스로 분리하면 테스트 격리와 재사용성이 개선된다. 현재 규모에서는 INFO 수준.

- **[INFO] `updateExecutionStatus`에 side-effect 중첩**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `updateExecutionStatus` private 메서드 상단 세그먼트 추적 블록
  - 상세: `updateExecutionStatus`는 기존에 "상태 전이 검증 + DB 저장"의 단일 choke point였는데, PR2a에서 `segmentStartMs` 기록/누적이라는 in-memory 부수효과가 추가됐다. 이 메서드는 "상태 전이 시 항상 호출"이라는 계약으로 동작하므로 choke-point 패턴 자체는 올바른 선택이다. 그러나 in-memory 조작과 async DB 저장이 같은 메서드에 혼재하면, 미래에 transactional rollback이 필요한 상황(DB 저장 실패 시 segmentStart가 이미 기록된 상태)에서 불일치가 발생할 수 있다.
  - 제안: DB 저장 실패 시 `segmentStartMs` 롤백 또는 보상 로직이 필요한지 검토. 현재는 exception이 위로 전파되어 실행이 실패 처리되므로 실용상 문제는 제한적이나, 설계 문서에 "segmentStartMs 갱신은 DB 저장과 원자적이지 않다"는 주석이 없어 유지 보수 시 혼동 가능성이 있다.

- **[INFO] `execution-limits.ts`의 추상화 수준 — 단일 기능 모듈로서의 응집도**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-limits.ts`
  - 상세: `execution-limits.ts`는 env 파싱 한 가지만 담당하여 응집도가 높고 의존성이 없는 순수 함수 모듈이다. `resolveExecutionRunWorkerConcurrency`와 동일 정규식 선검증 규약을 따른다고 명시하여 관용적 일관성을 갖췄다. 다만, 현재 파일에는 상수 1개 + 함수 1개만 있으며 향후 PR2b(동시성 cap)·per-workflow 설정 등이 추가될 때 이 파일로 수렴할지 아니면 별도 파일로 분화할지 기준이 없다.
  - 제안: `execution-limits.ts`의 역할 범위를 주석으로 명시("execution-level resource limits — env 파싱·기본값만. 판정 로직은 service 내에 두거나 별도 guard로 분리")하여 모듈 경계를 선언적으로 관리할 것.

- **[INFO] `ErrorCode` enum의 계층적 위치 — 노드 코어에 엔진 레벨 코드 혼재**
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts`
  - 상세: `EXECUTION_TIME_LIMIT_EXCEEDED`가 `nodes/core/error-codes.ts`에 추가됐다. 이 파일은 원래 "node handler의 `output.error.code`" SoT로 설계됐다(파일 상단 JSDoc 참조). 엔진 레벨 누적 타임아웃 코드는 어떤 노드 핸들러도 직접 발행하지 않고 dispatch loop가 발행하므로, 아키텍처적으로는 "노드 코어 에러"가 아닌 "실행 엔진 인프라 에러"다. consistency-check W4도 이 문제(다수 엔진 에러코드가 중앙 enum 미등재)를 이미 지적했다. PR2a는 그 해결책으로 기존 `nodes/core/error-codes.ts`에 추가했으나, 이는 파일의 원래 설계 의도를 확장한다.
  - 제안: `EXECUTION_TIME_LIMIT_EXCEEDED`를 포함한 엔진 인프라 에러코드들을 `nodes/core/error-codes.ts` 내 `// Execution Engine / Infrastructure` 섹션으로 그루핑하거나, 별도 `execution-engine-error-codes.ts`를 신설하고 `ErrorCode`에서 re-export하는 방식으로 계층을 명확히 할 것. 이는 consistency-check W4와 동일 권고이며 PR2b 범위에 등재된 항목이다.

- **[INFO] `system-status.constants.ts`에서 `resolveExecutionRunWorkerConcurrency` 직접 import**
  - 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts`
  - 상세: `system-status` 모듈이 `execution-engine/queues/execution-run.queue`를 직접 import한다. 이는 `MONITORED_QUEUES` 레지스트리가 각 큐 모듈을 직접 참조하는 기존 패턴(다른 큐들도 동일)과 일치하므로 새로운 결합이 아니다. 단, concurrency 해석 함수(`resolveExecutionRunWorkerConcurrency`)가 큐 상수 파일(`execution-run.queue.ts`)에 함께 위치하는 것이 책임 분리 기준으로 일관적인지 확인 필요. 이상적으로는 concurrency 해석도 `execution-limits.ts`로 통합해야 하나, 기존 `CONTINUATION_WORKER_CONCURRENCY`도 inline `Number(process.env...)` 방식을 쓰는 등 프로젝트 내 일관성이 혼재한다.
  - 제안: 장기적으로 모든 worker concurrency 해석을 `execution-limits.ts` 또는 단일 config 모듈로 통합하여 env 파싱 로직의 단일 SoT를 확보. 현재는 기존 패턴 답습이므로 INFO 수준.

- **[INFO] 테스트에서 private 멤버 직접 접근**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `priv()` 헬퍼를 통한 `maxActiveRunningMs`, `segmentStartMs`, `assertActiveTimeWithinLimit`, `updateExecutionStatus` 접근
  - 상세: `service as unknown as {...}` 패턴으로 private 멤버를 테스트에서 직접 조작하는 것은 해당 프로젝트의 기존 관용 패턴임이 주석에 명시돼 있다. 이 패턴은 구현 세부사항에 결합되어 리팩토링 시 테스트가 먼저 깨지는 문제를 유발하지만, 순수 블랙박스 테스트로는 "현재 세그먼트 경과분 합산" 같은 내부 불변식을 검증하기 어렵다는 실용적 이유가 있다. 프로젝트 기존 패턴을 따르므로 일관성은 유지된다.
  - 제안: 향후 `ExecutionLimitsGuard` 같은 독립 클래스로 분리하면 private 멤버 접근 없이 동일 불변식을 공개 API로 테스트할 수 있다. 현재는 INFO 수준.

### 요약

PR2a 변경은 전체적으로 기존 아키텍처 패턴을 잘 따르고 있다. `execution-limits.ts`로 env 파싱을 분리하고, `ExecutionTimeLimitError`를 sentinel 타입으로 추가하며, 상태 전이 단일 choke-point(`updateExecutionStatus`)를 재사용한 설계는 개방-폐쇄·의존성 역전 원칙에 부합한다. 순환 의존성도 관찰되지 않는다. 가장 주목할 아키텍처 위험은 `segmentStartMs` in-memory Map이 단일 인스턴스 전제에 의존한다는 점으로, PR3(stalled-job 재배달) 구현 시 이 전제가 깨지면 누적 시간 판정이 불완전해진다. 이는 PR3 설계 범위에서 반드시 명시적으로 해소해야 한다. `nodes/core/error-codes.ts`에 엔진 인프라 에러코드가 혼재되는 계층 오염은 기존 consistency-check W4에서 인지된 기술 부채이며, PR2a가 이를 가중시키고 있어 조속한 정리를 권장한다. 나머지 발견사항은 모두 INFO 수준으로, 즉각적인 구조 위험은 없다.

### 위험도

LOW

STATUS: OK
