# 신규 식별자 충돌 검토 (--impl-prep, scope=spec/5-system/)

검토 일시: 2026-05-25  
대상 변경 파일:
- `spec/5-system/4-execution-engine.md` (§7.4 rewrite, §7.5 신설, §9.3 신설, §11 신설)
- `spec/5-system/6-websocket-protocol.md` (`queued` 필드, `RESUME_*` 에러코드 추가)
- `spec/5-system/3-error-handling.md` (cross-link note 추가)
- `spec/1-data-model.md` (Execution.error.code 어휘 확장)
- `spec/0-overview.md` (구현 완료 영역 기술 갱신)
- `spec/data-flow/3-execution.md` (§1.3 시퀀스, §2.2 큐 목록, §2.3 Redis 절 갱신)

---

## 발견사항

### [INFO] `WORKER_HEARTBEAT_TIMEOUT` — spec에 처음 등재, 코드에는 이미 존재
- target 신규 식별자: `spec/1-data-model.md §2.13` Execution.error.code 어휘 목록에 `WORKER_HEARTBEAT_TIMEOUT` 신규 기재
- 기존 사용처: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1507` 에서 이미 사용 중이었으나 spec 어휘 목록에는 미등재 상태
- 상세: 충돌 없음. 코드 선행 → spec 후행 등재 패턴. `spec/5-system/4-execution-engine.md §7.4` 의 Worker Heartbeat 절에서 개념은 이미 있었고 이번 변경에서 data-model error.code 어휘로 공식화한 것.
- 제안: 현 상태 유지. 충돌 없음.

### [INFO] `SERVER_INTERRUPTED` — spec에 처음 등재, 코드에는 이미 존재
- target 신규 식별자: `spec/1-data-model.md §2.13` Execution.error.code 어휘 목록에 `SERVER_INTERRUPTED` 신규 기재, `spec/5-system/4-execution-engine.md §11` Graceful Shutdown 절에서 정의
- 기존 사용처: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` 전반 (`code: 'SERVER_INTERRUPTED'` 문자열), 테스트 파일 포함
- 상세: 충돌 없음. 코드-먼저 패턴. 이번 변경이 §11 신설로 spec 에 공식 등재한 것.
- 제안: 현 상태 유지.

### [INFO] `exec:cont:seq:<executionId>` 신규 Redis 키 — §9.1 패턴 예외 미문서화
- target 신규 식별자: `spec/data-flow/3-execution.md §2.3` 에 `exec:cont:seq:<executionId>` 키 추가
- 기존 사용처: `spec/5-system/4-execution-engine.md §9.1` 은 Redis 키 규약으로 `{service}:{workspaceId}:{resource}` 패턴을 정의하며, `exec:recover:lock` 의 전역 예외 이유를 별도 note 로 명시
- 상세: `exec:cont:seq:<executionId>` 는 `workspaceId` 를 포함하지 않는 전역 키이므로 §9.1 패턴 예외에 해당한다. `exec:recover:lock` 과 달리 본 키에 대한 예외 근거 note 가 `spec/5-system/4-execution-engine.md §9.2` 또는 §9.3 에 없다. `spec/data-flow/3-execution.md §2.3` 에만 행이 추가됐으며, `4-execution-engine.md §9.2` 의 Redis 키 목록에는 누락.
- 제안: `spec/5-system/4-execution-engine.md §9.2` Redis 키 목록에 `exec:cont:seq:<executionId>` 행 추가 및 §9.1 패턴 예외 note 보완 (후속 PR 무관하게 spec 단일 진실 원칙상 정합화 권장). 현재는 충돌 없이 INFO 수준.

### [INFO] `RESUME_BULLMQ_ATTEMPTS` — ENV 화 유보 결정이 spec 본문에서 모호
- target 신규 식별자: `spec/5-system/4-execution-engine.md §11` 환경변수 목록에 `RESUME_BULLMQ_ATTEMPTS` 등재
- 기존 사용처: `codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.ts:36` 주석에 언급되어 있고 상수값 3으로 코드 내 하드코딩
- 상세: 충돌 없음. 단, §11 환경변수 표에 `RESUME_BULLMQ_ATTEMPTS` 를 환경변수로 등재하면서 "(현재 양쪽 모두 코드 상수, ENV 화는 후속)" 를 병기했다. 이로 인해 해당 식별자가 실제로 ENV 로 동작하는지 코드 상수인지 독자가 혼동할 수 있다. 실제로는 `codebase/` 코드에서 ENV 로 읽는 코드가 없고 상수 3이 하드코딩됨.
- 제안: 환경변수 목록 제목을 "환경변수 (및 상수)" 로 변경하거나, 해당 행에 "(코드 상수 — ENV 화 미구현)" 주석을 더 명시적으로 기재. 충돌은 아니므로 INFO.

### [WARNING] `INVALID_EXECUTION_STATE` — 기존 WS 에러코드 `INVALID_EXECUTION_STATE` 와 의미 확장 충돌 가능성
- target 신규 식별자: `spec/5-system/4-execution-engine.md §7.5.1` 에서 `INVALID_EXECUTION_STATE` 를 "publisher 측 사전 검증" 코드로 공식화, `execution.retry_last_turn` 의 `failed` 기대 실패도 동일 코드로 재사용
- 기존 사용처: `spec/5-system/6-websocket-protocol.md` 의 `execution.click_button` 에러 코드 표에 이미 `INVALID_EXECUTION_STATE | 실행이 waiting_for_input 상태가 아님` 으로 존재했음 (main 브랜치 기준)
- 상세: 의미 충돌이 아닌 의미 확장 케이스. 기존 정의가 "`waiting_for_input` 상태가 아님" 이었던 것을 이번 변경에서 "기대 상태가 아님 (submit_form/click_button/submit_message/end_conversation 의 `waiting_for_input` 기대, 또는 `retry_last_turn` 의 `failed` 기대)" 로 확장했다. 코드 값은 같고 의미도 연속적이나, 기존 구현(클라이언트 코드 등)이 "`INVALID_EXECUTION_STATE` = 반드시 waiting_for_input 문맥" 으로 가정하고 있다면 `retry_last_turn` 에 동일 코드를 사용할 때 혼동이 발생할 수 있다. 충돌은 아니지만 의미 확장이므로 주의 필요.
- 제안: 현재 spec 에서 §7.5.1 에 "retry_last_turn 의 `failed` 기대도 동일 코드 재사용" 이 명시되어 있고 이는 의도적 설계다. 단, 클라이언트 측에서 기존 `INVALID_EXECUTION_STATE` 처리 분기가 `retry_last_turn` 경로도 커버하도록 추후 구현 시 검토할 것. spec 수정 불필요.

---

## 요약

이번 변경(`workflow-resumable-execution Phase 2 cont`)이 `spec/5-system/` 에 도입하는 신규 식별자는 — BullMQ 큐 이름 `execution-continuation`, 에러 코드 4종(`RESUME_FAILED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`, `SERVER_INTERRUPTED`), WS ack 필드 `queued: boolean`, 환경변수 `SIGTERM_GRACE_MS`, 상수 `RESUME_BULLMQ_ATTEMPTS`, Redis 키 `exec:cont:seq:<executionId>` — 모두 기존 식별자와 의미 충돌 없이 신규 공간을 차지한다. `WORKER_HEARTBEAT_TIMEOUT`과 `SERVER_INTERRUPTED`는 코드에 먼저 존재했고 이번 spec 이 뒤늦게 공식 등재한 패턴이다. `INVALID_EXECUTION_STATE`는 기존 코드에 있던 WS 에러코드를 의미 확장한 것으로 의미 연속성이 유지된다. 충돌 위험이 높은 CRITICAL/HIGH 수준 항목은 발견되지 않았으며, Redis 키 `exec:cont:seq:*` 의 §9.2 누락 및 `RESUME_BULLMQ_ATTEMPTS` 의 ENV vs 상수 모호성이 INFO 수준 보완 사항으로 남는다.

## 위험도

LOW
