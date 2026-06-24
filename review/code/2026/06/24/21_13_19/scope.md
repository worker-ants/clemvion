# 변경 범위(Scope) 리뷰

리뷰 대상: `refactor(execution-engine): C-1+M-7 — continuation publish 실패 fail-fast 통일 (06-concurrency)`

---

## 발견사항

### [INFO] `nextSeq` JSDoc 코멘트 추가 — 범위 내 설명 추가로 허용
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts`, `nextSeq` 메서드 JSDoc
- 상세: M-7 변경(random fallback 제거)에 대한 이유 설명과 `ConversationThread.nextSeq` 와의 명확한 구분 주석이 추가됐다. 이는 M-7 구현 의도를 문서화하는 수반 주석으로, 변경 범위 내 정당한 추가다.
- 제안: 없음

### [INFO] consistency 리뷰 산출물 파일 동일 커밋 포함
- 위치: `review/consistency/2026/06/24/20_51_52/` 하위 SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md 등
- 상세: impl-prep consistency-check 실행 결과물이 동일 커밋에 포함됐다. 이는 프로젝트 규약(impl-prep 검토 산출물을 `review/consistency/**` 에 기록)에 따른 정상 패턴으로, 구현 커밋에 리뷰 산출물이 함께 포함되는 것은 이 프로젝트의 의도된 방식이다.
- 제안: 없음

### [INFO] `websocket.gateway.spec.ts` mock 업데이트 — 필요 최소 수정
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` line ~75
- 상세: `cancelWaitingExecution` mock을 `jest.fn()` (동기 void) 에서 `jest.fn().mockResolvedValue({ queued: true, jobId: 'mock-job-id' })` (async)로 전환했다. C-1 서명 변경에 따른 필수 수반 수정이며, 파일 내 다른 코드는 건드리지 않았다.
- 제안: 없음

---

## 요약

변경 범위는 커밋 메시지에 명시된 C-1(cancelWaitingExecution fire-and-forget 제거, async + ContinuationPublishResult 전환, stop() WAITING 503 surface, EXECUTION_ENQUEUE_FAILED 등재)과 M-7(nextSeq random fallback 제거) 두 항목에 정확히 한정된다. 8개 소스/테스트 파일과 consistency-check 산출물 파일들이 포함됐으나, 각 수정은 변경 의도에서 직접 파생된 필수 수반 수정이다 — continuation-bus.service.ts(M-7 핵심), execution-engine.service.ts(C-1 서명 변경), executions.service.ts(C-1 호출부 await+503), error-codes.ts(에러코드 등재), 테스트 3개 파일(서명 변경에 따른 mock/assertion 업데이트), consistency 산출물(impl-prep 규약). 범위 외 파일 수정, 불필요한 리팩토링, 포맷팅 변경, 무관한 임포트 정리 등은 발견되지 않았다.

---

## 위험도

NONE
