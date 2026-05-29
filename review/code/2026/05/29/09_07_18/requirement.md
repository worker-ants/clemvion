# Requirement Review — workflow-resumable-phase3 (DLQ Monitor + Phase 2.3)

**리뷰 시각**: 2026-05-29  
**대상 파일**: 13개 (spec 1, 구현 5, 테스트 7)  
**관련 spec**: `spec/5-system/4-execution-engine.md` §7.4 / §7.5 / §7.5.1 / §9.3; `spec/5-system/6-websocket-protocol.md` §4.2

---

## 발견사항

### [INFO] ContinuationDlqMonitorService — spec 본문에 서비스 클래스 자체가 명시되지 않음 (spec 누락)
- 위치: `continuation-dlq-monitor.service.ts` 전체, `spec/5-system/4-execution-engine.md`
- 상세: 서비스 주석은 SoT 를 "spec §7.4 / §7.5 / §9.3" 으로 밝히지만, spec 본문 어디에도 `ContinuationDlqMonitorService` 나 DLQ depth polling 모니터의 환경변수 이름, 기본값, 알람 임계값, cooldown 동작이 명세된 절이 없다. §7.5 의 "운영 모니터링: retry 율이 1% 를 넘으면 BullMQ DLQ 알람" 한 줄이 배경 동기만 암시한다. 구체적인 요구사항 (CONTINUATION_DLQ_ALARM_THRESHOLD=50, CONTINUATION_DLQ_MONITOR_INTERVAL_MS=60000, CONTINUATION_DLQ_ALARM_COOLDOWN_MS=300000, CONTINUATION_DLQ_MONITOR_ENABLED) 은 spec 에 정의되지 않았다.
- 제안: spec §9.3 또는 §7.4 에 DLQ 모니터 요구사항을 추가하거나, Phase 3.1 plan 에 spec 갱신 작업을 포함할 것. project-planner 위임 사항.

### [WARNING] onFailed 의 maxAttempts fallback=1 이 spec §7.4 기본값 3 과 불일치
- 위치: `continuation-execution.processor.ts` — `const maxAttempts = job.opts?.attempts ?? 1;`
- 상세: spec §7.4 는 재시도 횟수를 `RESUME_BULLMQ_ATTEMPTS` (기본 3) 으로 명시한다. `job.opts?.attempts` 가 undefined 인 경우 fallback 을 `1` 로 설정하면, 실제 3회 소진된 dead-letter 잡을 `attemptsMade(3) >= maxAttempts(1)` 로 올바르게 DEAD-LETTER 로 분류하므로 오분류 방향은 아니나, 반대로 `attemptsMade(1) >= maxAttempts(1)` 인 상황(1회 실패)에서 아직 재시도가 남은 잡을 DEAD-LETTER 로 잘못 태깅할 수 있다. 로깅 전용이므로 큐 동작에는 무영향이나 DLQ 알람 판단 로그가 오도될 수 있다.
- 제안: `const maxAttempts = job.opts?.attempts ?? 3;` 또는 `RESUME_BULLMQ_ATTEMPTS` 상수를 참조.

### [WARNING] WS 에러 ack 의 errorCode 필드 구조가 spec §4.2 에러 형식과 불일치
- 위치: `websocket.gateway.ts` — `data: { success: false, error: message, errorCode }` 형태; `spec/5-system/6-websocket-protocol.md` §4.2
- 상세: spec §4.2 실패 ack 예시 (`execution.retry_last_turn.ack`) 는 `payload: { resumed: false, error: { code: "...", message: "..." } }` 객체 구조를 정의한다. 그러나 WS gateway 구현은 `data: { success: false, error: <string>, errorCode: <string|undefined> }` 형태로, `error` 가 메시지 문자열이고 코드는 별도 최상위 `errorCode` 필드다. `INVALID_EXECUTION_STATE` 코드가 `error.code` 가 아닌 `errorCode` 에 담긴다.
- 제안: 이 불일치가 기존 WS gateway 레거시 패턴인지(spec 갱신 필요) 아니면 새로운 사양인지 확인 필요. project-planner 위임. 클라이언트가 `errorCode` 필드를 올바르게 파싱하는지 E2E 검증 권장.

### [INFO] resolveWaitingNodeExecutionId — DB infra 실패 시 error 로그 후 원본 에러 재전파
- 위치: `execution-engine.service.ts` — catch 블록에서 `throw err`
- 상세: 변경 전 코드는 DB 실패를 `__no_node_exec__` sentinel 로 삼켰다. 변경 후 원본 에러를 재전파하는데, spec §7.5.1 본문은 이 분기를 명시하지 않는다. 코드 주석에서 "DB lookup 자체의 infra 실패는 INVALID_EXECUTION_STATE 가 아닌 원본 에러로 재던져 caller 가 재시도하도록" 의도를 설명한다. 기능적으로 올바른 동작이며 테스트도 이를 검증한다.

### [INFO] executions.controller.ts — continueExecution 이 이전 fire-and-forget 에서 await 로 정상화
- 위치: `executions.controller.ts` 라인 1824
- 상세: 변경 전 `this.executionEngineService.continueExecution(id, body?.formData);` 는 반환값을 기다리지 않아 `InvalidExecutionStateError` 등 Promise rejection 이 unhandled 상태로 누락될 위험이 있었다. 변경 후 `await` 적용으로 catch 블록이 정상 동작. 기능 완전성 향상.

### [INFO] interaction.service.ts — EIA 진입점의 InvalidExecutionStateError 처리 코드가 spec §7.5.1 에 명시되지 않음
- 위치: `interaction.service.ts` — `dispatchContinuation` 내 `ConflictException(STATE_MISMATCH)` 매핑
- 상세: spec §7.5.1 은 WS gateway 와 REST controller 의 에러 처리만 언급하며, EIA (InteractionService) 진입점의 매핑 코드는 명시하지 않는다. 구현은 기존 `assertWaiting` 의 `STATE_MISMATCH(409)` 패턴과 일관성을 유지하며 race window 를 올바르게 처리한다. spec 갱신 여부는 project-planner 판단.

### [INFO] removeOnFail: false 설정이 spec §9.3 큐 목록에 명시되지 않음
- 위치: `continuation-execution.queue.ts` (`removeOnFail: false`); `spec/5-system/4-execution-engine.md` §9.3
- 상세: spec §9.3 큐 목록 테이블에서 `execution-continuation` 행은 attempts 만 기재하며 `removeOnFail: false` 설정이 누락되어 있다. 이 설정이 DLQ 모니터 서비스의 존재 근거이므로 spec 에 명시될 여지가 있다.

---

## Spec Fidelity 상세: §7.5.1 구현 대조

| spec §7.5.1 요구사항 | 구현 | 판정 |
|---|---|---|
| 매칭 row 0건 → BullMQ enqueue 없이 즉시 에러 | `InvalidExecutionStateError` throw + 각 진입점에서 catch 후 변환 | 일치 |
| 매칭 row 2건 이상 → `logger.warn` 후 거부 | `resolveWaitingNodeExecutionId` 에서 warn("invariant 위반") 후 throw | 일치 |
| WS 진입점: `INVALID_EXECUTION_STATE` 코드 | `errorCode = error.code` → ack `errorCode` 필드 (구조 불일치 — WARNING 참조) | 부분 일치 |
| REST 진입점: 422 `INVALID_STATE` | `UnprocessableEntityException` + `{ error: { code: 'INVALID_STATE' } }` | 일치 |

---

## 요약

이번 변경은 Phase 3.1 DLQ 모니터 서비스(`ContinuationDlqMonitorService`) 신설과 Phase 2.3 publisher 측 사전 검증(`INVALID_EXECUTION_STATE`) 두 피처를 구현한다. 기능 완전성 측면에서 양측 모두 의도한 동작(폴링 임계 알람, cooldown, 동기 에러 반환, 레이어별 변환)을 올바르게 구현하며 핵심 경로의 테스트 커버리지도 양호하다. 위험으로는 `onFailed.maxAttempts` fallback 이 spec 기본 3 과 달리 1 이어서 첫 시도 실패 잡이 DEAD-LETTER 로 오분류될 수 있고(WARNING), WS 에러 ack 의 `errorCode` 필드 구조가 spec §4.2 에러 형식과 구조적으로 불일치하며(WARNING), `ContinuationDlqMonitorService` 의 환경변수·기본값이 spec 본문에 명세되지 않아 spec 누락이 의심된다(INFO). 전반적으로 비즈니스 로직은 의도에 부합하고 에러 시나리오 처리가 충분하다.

## 위험도

LOW
