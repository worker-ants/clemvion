# 신규 식별자 충돌 검토 결과

검토 범위: `06-concurrency C-1+M-7: continuation publish 실패 fail-fast 통일`
diff-base: origin/main

---

## 발견사항

- **[INFO]** `EXECUTION_ENQUEUE_FAILED` — spec 에러코드 카탈로그 미등록 (예고된 defer)
  - target 신규 식별자: `ErrorCode.EXECUTION_ENQUEUE_FAILED = 'EXECUTION_ENQUEUE_FAILED'` (`codebase/backend/src/nodes/core/error-codes.ts:87`)
  - 기존 사용처: spec `conventions/error-codes.md` 및 `spec/5-system/4-execution-engine.md §7.5.2` 에는 `EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG` 만 나열되어 있고 `EXECUTION_ENQUEUE_FAILED` 는 없다. `spec/conventions/error-codes.md §1` 이 `EXECUTION_*` 네임스페이스를 중앙 `ErrorCode` enum 의 continuation-ack boundary 코드 확장으로 정의하므로, 신규 코드는 해당 카탈로그 항목이 필요하다.
  - 상세: target의 인라인 주석(`// 에러코드 카탈로그는 sibling planner spec-sync defer`)이 명시적으로 지연 처리를 선언하고 있다. 충돌(같은 의미로 이미 존재하는 식별자)은 없다 — origin/main 의 `error-codes.ts` 에는 `EXECUTION_ENQUEUE_FAILED` 가 없고, spec에도 이 이름은 존재하지 않는다. 네임스페이스 `EXECUTION_*` 내에 동명·이의 항목도 없다.
  - 제안: 본 PR 범위 이후에 `spec/conventions/error-codes.md` 또는 `spec/5-system/4-execution-engine.md §7.5.2` 에 `EXECUTION_ENQUEUE_FAILED` 항목을 추가해야 한다 (계획된 defer 이므로 본 검토에서 차단 불요).

- **[INFO]** `ContinuationPublishResult` — origin/main 에 이미 정의된 타입, 신규 도입 아님
  - target 신규 식별자: `cancelWaitingExecution` 의 반환 타입이 `void` -> `Promise<ContinuationPublishResult>` 로 변경됨.
  - 기존 사용처: `ContinuationPublishResult` 인터페이스는 origin/main의 `execution-engine.service.ts:329` 에 이미 선언되어 있으며 4종 continuation 메서드(`continueExecution`, `continueButtonClick`, `continueAiConversation`, `endAiConversation`, `publishRetryLastTurn`)에서 공통 사용 중이다.
  - 상세: 타입명 충돌 없음. target은 기존 타입을 `cancelWaitingExecution` 에도 동일하게 적용한 것으로 일관성 향상. 기존 의미와 완전히 동일하다.
  - 제안: 해당 없음 (기존 타입 재사용).

- **[INFO]** `nextSeq` — private 메서드명과 `ConversationThread.nextSeq` 필드 동명, 기존 주석에 이미 명시
  - target 신규 식별자: `ContinuationBusService.nextSeq` (private 메서드) — origin/main 에도 존재했던 이름이며 target 에서 제거된 것은 없다.
  - 기존 사용처: `spec/conventions/conversation-thread.md:86` 의 `ConversationThread.nextSeq` 필드 (AI turn 단조 증가 seq 카운터). `spec/5-system/4-execution-engine.md:1090` 의 Redis INCR seq (`exec:cont:seq:<executionId>` 키의 별칭 `nextSeq`).
  - 상세: 동명이지만 레이어가 다른 private 메서드(Redis INCR seq 생성기)와 public DTO 필드(conversation thread turn seq)다. target 의 추가된 주석(`ConversationThread.nextSeq 와 동명이나 무관 — 이쪽은 Redis seq 생성기`)이 이미 이 동명 상황을 명시적으로 설명하고 있다. 실제 충돌(동일 네임스페이스 내 의미 충돌)은 없다 — private 메서드와 별개 DTO 필드는 직접 충돌 영역이 아니다.
  - 제안: 기존 주석이 충분히 설명하고 있으므로 변경 불요.

---

## 요약

이번 변경(C-1 + M-7)이 도입하는 신규 식별자 중 실제 충돌(동일 식별자가 다른 의미로 이미 사용 중인 경우)은 발견되지 않았다. `EXECUTION_ENQUEUE_FAILED` 는 `EXECUTION_*` 네임스페이스 내 신규 추가이며 기존 코드명·spec 카탈로그 어디에도 동명 항목이 없다. `ContinuationPublishResult` 는 origin/main 에서 이미 정의·사용 중인 타입을 일관성 차원에서 `cancelWaitingExecution` 에도 적용한 것으로 신규 도입이 아니다. `nextSeq` 동명 이슈는 코드 주석에 이미 명시되어 있으며 레이어가 다른 private 메서드와 DTO 필드 간 혼동이라 실제 충돌 위험이 낮다. 에러코드 카탈로그 미등록(`spec/conventions/error-codes.md`) 은 target 자체가 sibling planner spec-sync defer 로 명시 처리한 사항이다.

---

## 위험도

NONE
