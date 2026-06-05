## 발견사항

### [WARNING] `segmentStartMs` Map 이 서비스 싱글턴 인스턴스 공유 상태 — 멀티 워커 배포 시 누락 위험
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `private readonly segmentStartMs = new Map<string, number>()`
- 상세: `segmentStartMs` 는 in-process in-memory Map 이다. 코드 주석이 "세그먼트는 한 인스턴스 안에서 처리되므로 in-memory Map 으로 충분"이라고 명시하고 있어 이것이 의도된 설계임은 분명하다. 그러나 동일 Execution 을 다른 프로세스 인스턴스(수평 스케일 시나리오)가 처리하게 되면 `segmentStartMs` 에 진입 기록이 없는 상태에서 RUNNING 이탈이 발생하며 `segmentStart !== undefined` 가드가 누적을 건너뛴다. 이 경우 `activeRunningMs` 가 정확히 누적되지 않아 타임아웃이 조용히 미동작하는 부작용이 생긴다. 현재 PR 범위 내에서는 `execution-run` 큐와 `continuation` 큐가 같은 인스턴스에서 처리되는 것이 기본이므로 즉각적 위험은 낮지만, PR3 크래시 재개 시나리오에서 다른 워커가 세그먼트를 이어받으면 이 Map 에 진입 기록이 없어 정확도가 떨어진다.
- 제안: 현 PR 범위에서는 주석에 이미 "in-memory Map 으로 충분" 이유가 명시되어 있어 수용 가능. 단, PR3(크래시 재개) 착수 시 이 Map 의 수명과 cross-instance 이동 가능성을 명시적으로 재검토 문서화할 것.

### [WARNING] `resolveMaxActiveRunningMs()` 가 모듈 로드 시점에 `process.env` 를 1회 읽어 `private readonly` 에 고정 — 런타임 env 변경이 반영되지 않음
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line `private readonly maxActiveRunningMs = resolveMaxActiveRunningMs();`
- 상세: `execution-limits.ts` 의 `resolveMaxActiveRunningMs` 함수는 `env: NodeJS.ProcessEnv = process.env` 기본 인자를 받으며, 서비스 초기화 시점에 1회 호출되어 `maxActiveRunningMs` 필드에 고정된다. 이는 `system-status.constants.ts` 에서 `continuationConcurrency = Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1` 가 모듈 상수로 고정되는 패턴과 동일하다. 환경 변수 변경이 재시작 없이 반영되지 않는다는 점은 의도된 설계이나, 이 부작용이 문서화되지 않으면 런타임 핫-리로드 시나리오에서 혼동을 유발할 수 있다.
- 제안: `resolveMaxActiveRunningMs()` 의 JSDoc 에 "모듈 초기화 시 1회 평가, 변경 시 재시작 필요" 주석 추가. `.env.example` 의 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 주석에도 "재시작 필요" 명시.

### [INFO] `Execution.activeRunningMs` 필드가 엔티티에 추가됨 — 기존 쿼리/직렬화에 대한 영향
- 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts` — `@Column({ name: 'active_running_ms', type: 'int', default: 0 })` 추가
- 상세: TypeORM 엔티티에 새 컬럼이 추가되면 `SELECT *` 또는 `find()` 등 모든 row 조회 쿼리가 자동으로 이 컬럼을 포함하게 된다. `NOT NULL DEFAULT 0` 마이그레이션과 엔티티 `default: 0` 설정이 일치하므로 DB 계약은 정합하다. API 응답 DTO 에서 이 필드가 노출되는 경우를 확인해야 하지만, 현재 diff 에서는 DTO 변경이 없으며 `activeRunningMs` 는 내부 엔진 계측 전용 필드로 외부 노출이 의도되지 않은 것으로 보인다. 기존 Execution 행에는 `DEFAULT 0` 이 적용되므로 하위 호환성 문제는 없다.
- 제안: `ExecutionsService.findById` 등 Execution 응답 DTO 를 생성하는 경로에서 `activeRunningMs` 가 외부 API 응답에 포함되는지 확인 및 필요 시 DTO exclusion 처리.

### [INFO] `EXECUTION_TIME_LIMIT_EXCEEDED` 가 `TIMEOUT_CODES` Set 에 추가됨 — 기존 분류 동작 변경
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` — `TIMEOUT_CODES` Set 에 `'EXECUTION_TIME_LIMIT_EXCEEDED'` 추가
- 상세: 이 변경으로 `EXECUTION_TIME_LIMIT_EXCEEDED` 코드를 가진 실패 이벤트는 이전에는 `executionFailedInternal` (unknown fallback 경로 포함)로 분류되었을 것이나 이후에는 `executionFailedTimeout` 으로 분류된다. 이는 사용자 대면 에러 메시지 언어 힌트(`languageHints.executionFailedTimeout`)를 반환하게 된다. 코드 주석이 "의미는 다르나 사용자 대면 분류는 둘 다 timeout" 임을 명시하므로 의도된 변경이다. 이미 `EXECUTION_TIME_LIMIT_EXCEEDED` 가 production 에 발생하는 상황은 PR2a 이전에는 없었으므로 실질적 행동 변경 범위는 신규 에러 코드에만 한정된다.
- 제안: 이슈 없음. 의도된 변경.

### [INFO] `MONITORED_QUEUES` 에 `execution-run` 큐 추가 — 모니터링 상태 화면 항목 증가
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` — `MONITORED_QUEUES` 배열 맨 앞에 `execution-run` 항목 추가
- 상세: `SYSTEM_STATUS_QUEUE_NAMES` 가 `MONITORED_QUEUES.map(q => q.name)` 으로 파생되므로 이 변경으로 BullModule 등록·DI inject 순서가 하나 늘어난다. e2e 테스트 `EXPECTED_QUEUE_NAMES` 도 함께 업데이트되어 계약이 동기화되었다. `resolveExecutionRunWorkerConcurrency()` 를 모듈 상수로 평가하는 시점에 `process.env` 를 읽는 부작용이 있으나, 이는 서버 시작 시 1회 평가로 의도된 패턴(`continuationConcurrency` 와 동일)이다.
- 제안: 이슈 없음.

### [INFO] `ExecutionTimeLimitError.code` 가 `readonly` 리터럴로 `ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED` 에 고정
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `readonly code = ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED`
- 상세: `ErrorPortFallbackError` 패턴과 동일한 sentinel 방식으로 `code` 를 보존한다. `execution-engine.service.ts` 의 실패 빌더가 `error instanceof ExecutionTimeLimitError` 를 체크해 code 를 전파하므로, 임의 Error 의 `.code` 가 누수되는 부작용이 없다. 두 곳 (`runExecution` 의 실패 핸들러, resume path) 모두 패치되어 대칭이다.
- 제안: 이슈 없음.

---

## 요약

PR2a 변경의 핵심 부작용 리스크는 두 가지다. (1) `segmentStartMs` in-memory Map 은 싱글 인스턴스 가정 하에 올바르게 동작하나, PR3 크래시 재개 시나리오에서 cross-instance 처리가 발생하면 타임아웃 누적 정확도가 조용히 저하될 수 있다 — 현 PR 범위에서는 주석이 이유를 명시하고 있으나 PR3 착수 시 재검토 의무 문서화가 권장된다. (2) `maxActiveRunningMs` 가 모듈 초기화 시 1회 고정되어 런타임 변경 시 재시작이 필요한 부작용이 있으나, 이는 기존 concurrency env 패턴과 일관된 의도된 설계다. `Execution.activeRunningMs` 엔티티 필드 추가는 마이그레이션과 `NOT NULL DEFAULT 0` 계약이 일치하여 하위 호환 안전하다. `EXECUTION_TIME_LIMIT_EXCEEDED` 의 classifier 추가, 에러 sentinel 패턴 적용, MONITORED_QUEUES 등록은 각각 의도된 범위 변경이며 기존 경로에 의도치 않은 부작용을 일으키지 않는다.

---

## 위험도

LOW

STATUS: OK
