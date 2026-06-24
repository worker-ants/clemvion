# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 범위: `06-concurrency C-1 + M-7` (동일 publish 실패 표면)
- C-1: `cancelWaitingExecution` async 전환 + `ContinuationPublishResult` 반환으로 4개 continuation 메서드 패턴 통일; REST `stop()` WAITING 분기에서 `queued=false` 시 503 `CONTINUATION_ENQUEUE_FAILED` 반환
- M-7: `ContinuationBusService.nextSeq` Redis INCR 실패 시 random fallback 제거 → throw 전파 → publish `null`(`queued:false`) 반환 (seq idempotency key 계약 §7.4/§9.2 복원)

---

## 발견사항

### [INFO] `queued: false` 를 REST stop() 에서 503 으로 표면하는 패턴이 spec 에 미정의
- target 위치: C-1 의 "REST stop() WAITING 분기에서 queued=false 시 503(CONTINUATION_ENQUEUE_FAILED) surface"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` §4.2 (queued 필드 정의) · `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` §7.4/§7.5.2
- 상세:
  - WS 프로토콜 spec (6-websocket-protocol.md §4.2)는 `queued: false` 를 "Redis 장애 등 publish 실패 — 재시도 권장"으로 정의하며, 해당 필드를 **WS ack 전용** 관측·디버깅 신호로 명시한다 ("클라이언트 routing 결정에 사용하지 않는다").
  - 실행엔진 spec §7.5.2는 publish 경로 에러를 `ExecutionError` typed 표면(WS ack `errorCode`)과 plain 에러 generic fallback(`EXECUTION_INTERNAL_ERROR`) 두 계층으로 분류한다.
  - `POST /executions/:id/stop` REST 엔드포인트는 3-execution.md §9 표에 존재하나, WAITING 분기에서 `queued=false` 발생 시 503을 반환하는 동작은 어떤 spec 에도 정의되어 있지 않다. 기존 503 사용처는 §11 graceful shutdown(`SERVER_SHUTTING_DOWN`)뿐이다.
  - `CONTINUATION_ENQUEUE_FAILED` 에러 코드는 spec 전체(error-codes.md 포함)에 등재되어 있지 않다.
- 제안: 구현은 진행 가능하되, sibling planner spec-sync 단계에서 다음을 spec 에 추가해야 한다: (a) 실행엔진 §7.4 또는 §7.5 에 "cancel/stop REST 진입점의 publish 실패 시 503 + `CONTINUATION_ENQUEUE_FAILED`" 동작 1줄, (b) error-codes.md §3 또는 실행엔진 §7.5.2 에 `CONTINUATION_ENQUEUE_FAILED` 코드 등재. scope 에서 "spec §7.4 1줄 + 에러코드 카탈로그 등재는 sibling planner spec-sync 로 defer" 로 이미 명시했으므로 impl-first 진행은 의도된 범위다 — 구현 차단 없음.

### [INFO] `cancelWaitingExecution` 동기→async 전환은 spec 기술과 정합하나 §7.5.2 핸들러 목록에 cancel 이 명시 누락
- target 위치: C-1 "cancelWaitingExecution 을 async + ContinuationPublishResult 반환으로 4개 continuation 메서드와 패턴 통일"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` §7.4 line 894 / §7.5.2
- 상세:
  - 실행엔진 spec §7.4 (line 894)는 `continueExecution` / `cancelWaitingExecution` / `continueButtonClick` / `continueAiConversation` / `endAiConversation` 를 "모두 동일 패턴"으로 명시한다.
  - C-1 의 async 전환 + `ContinuationPublishResult` 반환은 이 spec 선언을 실현하는 방향이므로 **spec 과 일치**한다.
  - 다만 §7.5.2 "4종 continuation 핸들러" 서술(`execution.submit_form` / `click_button` / `submit_message` / `end_conversation`)에 cancel 류가 명시적으로 포함되지 않는다. cancel 이 동일 ack 공통 빌더를 쓰게 되면 §7.5.2 목록과 실제 동작 사이에 문서 불일치가 생긴다.
- 제안: 구현 차단 없음. spec-sync 시 §7.5.2 핸들러 목록에 cancel(`execution.stop` WAITING 분기) 을 추가하거나, "4종" 표현을 "5종" 또는 "continuation 핸들러"로 일반화.

### [INFO] M-7 의 `nextSeq` throw 전파가 §7.4/§9.2 idempotency key 계약을 복원하나, INCR throw→null publish→queued:false 경로가 spec 에 미기술
- target 위치: M-7 "ContinuationBusService.nextSeq 의 Redis INCR 실패 random fallback 제거 → throw 전파 → publish null(queued:false) 반환"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` §7.4 (line 870 — jobId 정의) / §9.2 (line 1090 — `exec:cont:seq:<executionId>` 키 정의)
- 상세:
  - §7.4 jobId 정의: `${executionId}:${nodeExecutionId}:${monotonic-seq}` (seq 는 Redis INCR per executionId — idempotency key). §9.2 는 `exec:cont:seq:<executionId>` 키에 sliding-window TTL 을 명시하며, 단조성(monotonic)이 활성 구간 내내 보존됨을 요구한다.
  - 기존 random fallback 은 spec 이 요구하는 단조성을 위반해 seq 충돌 시 동일 jobId 중복을 허용 — BullMQ idempotency 계약이 훼손된다. M-7 의 throw 전파는 spec §7.4/§9.2 계약을 복원하는 수정이므로 **spec 과 일치하며 드리프트를 수정**한다.
  - 단, "INCR 실패 → throw → publish null → queued:false" 의 인과 연쇄는 spec 에 미기술되어 있다. 현재 WS 프로토콜 spec (6-websocket-protocol.md §4.2)은 `queued:false` 를 "Redis 장애 등 publish 실패"로 언급하므로 의미 상 수용 가능하나, nextSeq INCR 실패가 publish 단계 실패로 propagate 되는 경로가 명확히 기술되어 있지 않다.
- 제안: 구현 차단 없음. spec §7.4 Continuation Bus 또는 §9.2 `exec:cont:seq` 키 설명에 "INCR 실패 시 throw → publish null(queued:false)" 동작을 1줄 추가하는 것을 spec-sync 시 반영 권장.

---

## 요약

C-1 + M-7 구현은 기존 spec 과 직접 모순되는 항목이 없다. C-1 의 `cancelWaitingExecution` async 통일은 실행엔진 §7.4 "모두 동일 패턴" 선언을 실현하는 방향이고, M-7 의 INCR fallback 제거는 §7.4/§9.2 의 jobId 단조성·idempotency key 계약을 복원하는 spec-drift 수정이다. 발견된 3건은 모두 INFO 등급으로, spec 에 미기술된 동작(503 `CONTINUATION_ENQUEUE_FAILED`, cancel 핸들러의 §7.5.2 목록 누락, INCR throw 전파 경로)이며 scope 에서 이미 "spec §7.4 1줄 + 에러코드 카탈로그 등재는 sibling planner spec-sync 로 defer" 로 명시한 범위와 정확히 일치한다. 구현 착수를 차단하는 CRITICAL/WARNING 충돌은 없다.

---

## 위험도

LOW
