# 문서화(Documentation) 리뷰

리뷰 대상 커밋: `fabdd47cd9b41c89ed7b7478a7f83fc5824e24ae`
변경 요약: C-1+M-7 — continuation publish 실패 fail-fast 통일 (06-concurrency)

---

## 발견사항

### [INFO] `cancelWaitingExecution` 의 JSDoc 이 변경된 반환 타입을 정확히 반영함
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `cancelWaitingExecution` 메서드 JSDoc
- 상세: `void` 에서 `Promise<ContinuationPublishResult>` 로 반환 타입이 바뀌면서 JSDoc 에 C-1 배경(fire-and-forget 에러 유실 제거 이유, WS §4.2 재시도 계약 준용)이 명확히 추가됐다. 변경된 서명과 주석이 일치한다.
- 제안: 없음(적절히 갱신됨).

### [INFO] `nextSeq` private 메서드 JSDoc 에 M-7 제거 근거가 상세히 기재됨
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` — `nextSeq` 메서드 JSDoc
- 상세: random fallback 제거 이유(§7.4 idempotency key 계약 위반, §9.2 단조성 계약 위반, BullMQ-Redis 동일 의존성으로 fallback 실익 없음)가 JSDoc 블록에 구체적으로 서술되어 있다. `ConversationThread.nextSeq` 와 동명임을 알리는 명시적 주석도 추가됐다(consistency 리뷰 I-10 권장 반영). private 메서드임에도 복잡한 결정 배경이 코드 내에 보존돼 있어 추후 유지 보수에 유리하다.
- 제안: 없음(양호).

### [INFO] `ErrorCode` enum 신규 항목 `EXECUTION_ENQUEUE_FAILED` 의 인라인 주석 품질 양호
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` — `EXECUTION_ENQUEUE_FAILED` 항목
- 상세: 코드 자체가 무엇인지, 어디서 surface 되는지(503 stop() WAITING cancel path), 어떤 맥락에서 추가됐는지(C-1, 06-concurrency)를 인라인 주석으로 설명한다. 기존 `EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG` 항목의 주석 스타일과 동일 포맷을 유지해 일관성이 좋다.
- 제안: 없음.

### [WARNING] spec 문서에 `cancelWaitingExecution` 실패 surface 및 `EXECUTION_ENQUEUE_FAILED` 미등재 — 커밋 메시지에서 명시적으로 defer 선언함
- 위치: `spec/5-system/4-execution-engine.md §7.4·§7.5.2` 및 `spec/5-system/3-error-handling.md §1` (변경 없음)
- 상세: 커밋 메시지에 "spec §7.4/§7.5.2 cancel publish 실패 surface 문구 + 에러코드 카탈로그(§3-error-handling §1) 등재는 sibling planner spec-sync 로 defer (impl-first) — merge-gate: 동행 머지 권장" 이 명시돼 있다. consistency 리뷰(W-2)에서도 이미 지적하여 "plan/PR 에 merge-gate 명시" 가 반영됐다고 기록되었다. 그러나 실제 spec 문서가 갱신되지 않은 상태로 merge 될 경우, `3-error-handling.md §1` 카탈로그와 `4-execution-engine.md §7.5.2` "cancel 포함 여부" 가 구현과 영구 드리프트될 위험이 있다.
- 제안: PR description 또는 plan 에 sibling spec-sync PR 이 동행 merge 됨을 명확히 기록하고, merge gate 조건(spec-sync PR 오픈 또는 동일 PR 포함)이 실제 체크리스트로 추적되는지 확인한다. 이미 W-2 로 awareness 가 있으므로 추가 코드 변경 없이 운용 절차로 관리 가능하다.

### [INFO] REST `stop()` WAITING 분기 503 근거 주석이 인라인에 포함됨
- 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `stop()` 내 WAITING 분기 C-1 수정 블록
- 상세: 변경된 코드 블록 안의 인라인 주석에 "api-convention §6 — Redis 의존성 장애 = upstream 불가용이므로 502 가 아닌 503" 근거가 포함됐다. consistency 리뷰 I-4 권장 사항이 반영된 것이다. 503 을 선택한 이유를 주석으로 보존한 것은 향후 혼동 방지에 유효하다.
- 제안: 없음.

### [INFO] 테스트 파일의 주석이 변경된 동작을 정확히 반영
- 위치:
  - `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.spec.ts` (it 설명 라인 64→65)
  - `codebase/backend/src/modules/executions/executions.service.spec.ts` (신규 describe 블록)
  - `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` (mock 변경 라인 75~77)
- 상세: 이전 "fallback random seq 로 진행 — null 반환 아님" 테스트 설명이 "null 반환 — fail-fast (M-7: random fallback 제거)" 로 정확히 갱신됐다. 테스트 내부 주석도 M-7 이유(§7.4/§9.2 계약)를 인용한다. 오래된 주석이 코드와 불일치하는 상황은 없다.
- 제안: 없음(오래된 주석 없음).

### [INFO] `CONTINUATION_SEQ_TTL_SECONDS` 환경변수 문서화 — 기존 JSDoc 에 적절히 서술됨
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` — `DEFAULT_SEQ_KEY_TTL_SECONDS` export 상수 JSDoc 및 constructor 주석
- 상세: `CONTINUATION_SEQ_TTL_SECONDS` ENV 오버라이드 가능성이 상수 JSDoc 및 constructor 주석 양쪽에 기술돼 있다("ENV `CONTINUATION_SEQ_TTL_SECONDS` (양수 정수) 로 오버라이드"). 이번 변경에서 이 부분은 수정되지 않았으나 이전부터 올바르게 문서화돼 있어 신규 문서화 갭은 없다.
- 제안: 없음.

---

## 요약

이번 C-1+M-7 리팩터는 문서화 측면에서 전반적으로 높은 수준을 유지한다. `nextSeq` 의 private 메서드임에도 random fallback 제거 결정 배경(idempotency 계약, 단조성, BullMQ-Redis 동일 의존성)이 JSDoc 에 충실히 기록됐고, `cancelWaitingExecution` 서명 변경도 JSDoc 에서 C-1 배경과 함께 반영됐다. `ErrorCode` 신규 항목 주석 스타일도 기존 항목과 일관된다. 503 선택 근거 인라인 주석 추가(consistency 리뷰 I-4 반영)와 테스트 설명 갱신도 적절하다. 유일한 주목할 점은 `spec/5-system/3-error-handling.md §1` 카탈로그와 `spec/5-system/4-execution-engine.md §7.5.2` 가 구현보다 defer 됐다는 것이지만, 이는 커밋 메시지·PR 에 merge-gate 로 명시 예정이며 consistency 리뷰(W-2)에서도 인지·처분된 사항이므로 문서화 관점의 즉각 블록 사유는 없다.

---

## 위험도

LOW
