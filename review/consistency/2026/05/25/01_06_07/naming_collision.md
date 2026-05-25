# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-fix-graceful-shutdown-phase-scope.md`
검토 일시: 2026-05-25

---

### 발견사항

- **[CRITICAL]** `POST /api/executions/start` vs `POST /api/workflows/:id/execute` — endpoint 명 충돌
  - target 신규 식별자: `POST /api/workflows/:id/execute` (step 1 보정 제안문에서 shutdown gate 대상으로 명시)
  - 기존 사용처:
    - `spec/5-system/4-execution-engine.md §11 line 971` — 현행 §11 step 1 은 `POST /api/executions/start` 를 shutdown gate 대상으로 명시
    - `spec/3-workflow-editor/3-execution.md line 296` — `POST /api/workflows/:id/execute` 가 워크플로우 실행 endpoint 로 정의됨
    - `spec/4-nodes/7-trigger/0-common.md line 24` — 동일 경로 (`POST /workflows/:id/execute`) 를 Manual Trigger 진입 경로로 참조
  - 상세: target 은 §11 step 1 의 shutdown gate 대상 endpoint 를 `POST /api/executions/start` 에서 `POST /api/workflows/:id/execute` 로 교체한다. 그런데 이 두 경로가 동일 엔드포인트를 다른 이름으로 표현하는 것인지, 아니면 서로 다른 엔드포인트인지 spec 어디에도 명시되지 않는다. `spec/3-workflow-editor/3-execution.md §7 API 표` 에는 `POST /api/workflows/:id/execute` 만 존재하고 `POST /api/executions/start` 는 spec 전체에서 §11 한 곳에만 등장한다 — 즉 현행 §11 이 존재하지 않는 phantom endpoint 를 gate 대상으로 쓰고 있거나, 두 경로가 동치라는 사실이 spec 에서 누락된 것이다. target 이 제안한 교체가 "올바른 경로로 정정" 이라면 적절하지만, "다른 endpoint 로 gate 대상을 변경" 이라면 의미 변경이 된다. 현재로서는 구분 불가.
  - 제안: (a) spec/3-workflow-editor/3-execution.md 의 `POST /api/workflows/:id/execute` 가 §11 에서 지칭하던 `POST /api/executions/start` 와 동치임을 target 의 변경 설명 또는 §11 Rationale 에 한 줄로 명시한다. (b) 또는 `POST /api/executions/start` 가 실제로 다른 진입 경로(예: 내부 API 또는 레거시)라면 target 의 변경을 `POST /api/workflows/:id/execute` 와 `POST /api/executions/start` 양쪽을 모두 gate 대상으로 유지하는 것으로 수정한다.

- **[WARNING]** `SERVER_SHUTTING_DOWN` — 신규 error code 기존 spec 미등재
  - target 신규 식별자: `SERVER_SHUTTING_DOWN` (step 1 보정안의 503 response body 내 `error.code` 값으로 명시)
  - 기존 사용처: `spec/5-system/4-execution-engine.md §11 line 971` — 현행 §11 에서 이미 `code: 'SERVER_SHUTTING_DOWN'` 으로 동일하게 정의되어 있으므로 target 이 도입이 아닌 유지이다.
  - 상세: target 이 이 코드를 새로 도입하는 것이 아니라 현행 텍스트에서 이미 사용 중이다. 그러나 `SERVER_SHUTTING_DOWN` 은 `spec/1-data-model.md §2.13` 의 엔진 인프라 error.code 어휘 목록(`SERVER_INTERRUPTED`, `RESUME_FAILED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`)에 포함되지 않는다. target 의 §2.13 보완 제안은 `WORKER_HEARTBEAT_TIMEOUT` 만 추가하고 `SERVER_SHUTTING_DOWN` 은 추가하지 않아 어휘 목록이 불완전해진다. `SERVER_SHUTTING_DOWN` 은 NodeExecution `error.code` 가 아닌 HTTP 503 응답의 `error.code` 이므로 §2.13 의 NodeExecution/Execution.error.code 어휘와 다른 네임스페이스일 수 있다 — 이 구분이 spec 에 명시되지 않으면 독자 혼선을 유발한다.
  - 제안: target 의 §2.13 보완 주석 또는 §11 보정안에 "HTTP 503 응답의 `error.code` 와 NodeExecution.error.code 어휘는 별도 네임스페이스" 임을 한 줄로 명시한다. 또는 §2.13 어휘 목록에 `SERVER_SHUTTING_DOWN` 을 "(HTTP 503 응답 전용, NodeExecution.error.code 아님)" 구분 표기로 추가한다.

- **[WARNING]** `WORKER_HEARTBEAT_TIMEOUT` — §7.4 cross-reference 부정확 가능성
  - target 신규 식별자: `WORKER_HEARTBEAT_TIMEOUT` (spec/1-data-model.md §2.13 error.code 어휘에 신규 추가. `(부팅 시 recovery — 30분 이상 heartbeat 없는 RUNNING Execution, §7.4)` 로 주석 달림)
  - 기존 사용처: `spec/5-system/4-execution-engine.md §7.4` — 해당 절은 "분산 실행 (Multi-instance)" 이며 `recoverStuckExecutions` 는 §7.4 하위 "Recovery (`recoverStuckExecutions`)" 블록에 있다. 단 §7.4 의 stale 임계값 변수명은 `STUCK_RECOVERY_STALE_MS` 이고 "30분" 임계는 §7.4 line 783 에 "임계값 (`STUCK_RECOVERY_STALE_MS`) 은 RUNNING 의 worker heartbeat 미응답 검출에만 사용한다 (§7.1 Worker Heartbeat 와 일관)" 으로 §7.1 을 참조한다.
  - 상세: target 은 `WORKER_HEARTBEAT_TIMEOUT` 의 발생 맥락을 "§7.4" 로 참조하지만 실제 heartbeat 정의는 §7.1 에 있고 (`Worker Heartbeat — 5초 간격, 3회 미응답=15초`) stuck recovery 의 stale 판정은 §7.2 / §7.4 혼재한다. "30분 이상 heartbeat 없는 RUNNING Execution" 이라는 표현도 spec 에는 `STUCK_RECOVERY_STALE_MS` 로 추상화되어 있고 30분이 기본값이라는 사실이 §7.1~§7.4 어디에도 명시적으로 나타나지 않는다 (구버전 spec 에는 "30분" 표현이 있었으나 현 worktree spec §7.4 에는 `STUCK_RECOVERY_STALE_MS` 변수명으로만 등장). 따라서 §2.13 의 주석 "(부팅 시 recovery — 30분 이상 heartbeat 없는 RUNNING Execution, §7.4)" 은 §7.1 + §7.4 에 걸쳐 있는 개념을 §7.4 단독 참조로 단순화해 독자가 §7.1 을 놓칠 수 있다.
  - 제안: §2.13 주석을 `(부팅 시 recovery — RUNNING Execution heartbeat stale 판정, §7.1 / §7.4)` 또는 `(부팅 시 recoverStuckExecutions — STUCK_RECOVERY_STALE_MS 초과 RUNNING Execution, §7.4)` 로 수정해 §7.1 을 함께 참조하거나 변수명 기준으로 표현한다.

- **[INFO]** `WORKER_HEARTBEAT_TIMEOUT` — 기존 error.code 어휘 목록 미등재 (신규 추가 정상)
  - target 신규 식별자: `WORKER_HEARTBEAT_TIMEOUT`
  - 기존 사용처: 동일 식별자는 spec 전체에 존재하지 않는다. 코드베이스 (`codebase/`) 에도 grep 결과 없음. 유일한 사용처가 target 자신과 `review/code/2026/05/25/00_40_56/RESOLUTION.md W-21` 항목 (기존 코드 리뷰에서 구조화 권고).
  - 상세: 충돌 없음. `SERVER_INTERRUPTED` / `RESUME_FAILED` 등 기존 어휘와 명명 패턴 (ALL_CAPS_SNAKE) 일관. `HEARTBEAT_TIMEOUT` suffix 는 timeout 류의 기존 어휘(`EXECUTION_TIMEOUT`)와 동일 패턴. 의미 중복 식별자 없음.
  - 제안: 이슈 없음. 추가 진행 가능.

- **[INFO]** `SIGTERM_GRACE_MS` — 환경변수 기존 정의와 일치
  - target 신규 식별자: `SIGTERM_GRACE_MS` (step 1 보정안의 `Retry-After` 계산식에 사용)
  - 기존 사용처: `spec/5-system/4-execution-engine.md §11 line 982` — 이미 동일 이름과 기본값 `30000` 으로 정의되어 있다.
  - 상세: 충돌 없음. target 은 기존에 정의된 환경변수를 그대로 참조한다.
  - 제안: 이슈 없음.

- **[INFO]** `WS execution.start` — 기존 WebSocket 이벤트 식별자와 일치
  - target 신규 식별자: target step 1 보정안의 Phase 1 범위 주석에서 "WS `execution.start` 명령은 현재 미구현 상태" 라고 언급
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md line 196` 및 `spec/3-workflow-editor/3-execution.md line 281` — `execution.start` 가 WebSocket Client→Server 이벤트로 이미 정의되어 있다.
  - 상세: target 은 이 이벤트를 새로 도입하지 않고 "미구현이므로 Phase 1 에서 제외" 로 언급한다. 기존 WS spec 의 `execution.start` 정의와 충돌 없음.
  - 제안: 이슈 없음.

---

### 요약

target 이 도입하는 신규 식별자 중 실질적 충돌이 우려되는 것은 step 1 의 shutdown gate endpoint 명 교체이다. 현행 §11 에서 `POST /api/executions/start` 를 참조하나 spec 의 나머지 영역에서는 해당 경로가 전혀 등장하지 않고 `POST /api/workflows/:id/execute` 만 실제 실행 endpoint 로 정의되어 있어, target 의 교체가 phantom endpoint 를 올바른 경로로 정정하는 것인지 gate 범위를 변경하는 것인지 판단 불가하다 (CRITICAL). `SERVER_SHUTTING_DOWN` 은 NodeExecution.error.code 가 아닌 HTTP 503 응답 코드이므로 §2.13 어휘 목록과의 네임스페이스 구분이 spec 에 명시되어야 독자 혼선을 막을 수 있다 (WARNING). `WORKER_HEARTBEAT_TIMEOUT` 은 기존 어휘와 충돌 없으나 §7.4 단독 참조가 §7.1 을 은폐할 수 있다 (WARNING). 나머지 `SIGTERM_GRACE_MS`, WS `execution.start` 는 기존 정의와 일치하며 충돌 없다.

### 위험도

MEDIUM
