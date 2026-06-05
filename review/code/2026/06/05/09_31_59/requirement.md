# 요구사항(Requirement) 리뷰 결과

**대상 커밋**: `b8f2f18` — PR-A1 conversationThread durable park 영속 + rehydration 무손실 복원
**리뷰어**: requirement
**일시**: 2026-06-05

---

## 발견사항

### [INFO] `cloneThread` 의 shallow-clone 이 `stageConversationThreadSnapshot` 에서도 사용되나 ConversationTurn 의 불변성에 의존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/shared/conversation-thread/thread-renderer.ts:14-16`, `execution-engine.service.ts:8424`
- 상세: `cloneThread`는 `{ ...thread, turns: [...thread.turns] }` 로 turn 객체 자체는 참조 공유하는 shallow clone이다. `stageConversationThreadSnapshot`(park 스냅샷)과 WS emit 모두 동일한 `cloneThread`를 사용한다. ConversationTurn 객체는 push 후 수정 불가(불변)라는 규약이 지켜지는 한 정상이며, spec §3.2와 `thread-renderer.ts` 주석에 이 전제가 명시돼 있다. 현재 코드에서 turn mutation 경로는 확인되지 않는다. 다만 미래 코드가 turn 내부 필드를 수정하면 스냅샷이 오염될 수 있다.
- 제안: 현재 코드는 의도대로 동작하며 수정 불필요. ConversationTurn 불변 계약이 spec(§3.2)에 이미 명시돼 있으므로, 신규 turn mutation 경로 추가 시 `cloneThread`를 deep-clone 으로 교체하거나 mutation 금지를 강제하는 가드를 추가한다.

---

### [INFO] `rehydrateContext` early-return(`if (existing) return existing`) — in-memory context 가 이미 있으면 durable 스냅샷을 무시
- 위치: `execution-engine.service.ts:1182-1183`
- 상세: `rehydrateContext` 진입 시 동일 executionId 의 in-memory context 가 살아있으면 스냅샷 복원 없이 그대로 반환한다. fast-path(같은 인스턴스 재개)에서는 in-memory context 가 더 최신이므로 올바른 동작이다. spec §7.5 다이어그램의 "case 1: 로컬 pendingMap 키 있음 → 즉시 resolve(fast path)"와 일치한다. 그러나 retry re-entry(`buildRetryReentryState` 경로, line 4010)도 `rehydrateContext`를 호출하므로, 동일 인스턴스에서 retry가 발생한 경우 in-memory context 가 있는 상태로 진입한다. 이 경우 `conversationThread`는 in-memory context 에서 가져오며, DB 스냅샷은 무시된다 — 의도된 동작(in-memory 가 더 최신)이나, retry re-entry 에서의 분기가 테스트로 커버되지 않는다.
- 제안: 정상 동작이므로 즉시 수정은 불필요. 단, retry re-entry + in-memory context 공존 시나리오에 대한 주석(또는 향후 테스트)을 추가하면 의도 명확화에 도움이 된다.

---

### [INFO] `rehydrateConversationThread` 에서 개별 turn 의 필수 필드 유효성 검증 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts:1002`
- 상세: `turns` 배열이 존재하면 `[...(r.turns as ConversationTurn[])]` 로 그대로 복사한다. 개별 turn 객체 내부의 필수 필드(`seq`, `nodeId`, `source`, `text` 등)가 손상된 경우 런타임에서는 graceful 하게 진행되나(text 길이 계산 시 `typeof t?.text === 'string'` 가드 존재), 잘못된 turn 이 thread 에 포함될 수 있다. 테스트에서 `turns: 'not-an-array'` 케이스(배열 아닌 전체 손상)는 커버되지만 개별 turn 의 필드 손상은 테스트되지 않는다.
- 제안: rehydration 경로는 "hot path 가 아님"(코드 주석)이므로 turn 단위 유효성 검증을 추가해도 성능 영향이 없다. 다만 spec §8.4에서 "직접 스냅샷이 무손실·단순"을 채택한 근거는 round-trip 신뢰이며, DB jsonb 에서 역직렬화된 값이 과거 정상 스냅샷임이 전제돼 있어 현재 수준의 graceful 처리는 spec 의도 범위 내다.

---

### [WARNING] `stageConversationThreadSnapshot` 에서 `savedExecution` 이 `null`/`undefined` 일 경우 방어 없음
- 위치: `execution-engine.service.ts:3419-3421`, `4957-4959`, `5934-5936`, `8420-8425`
- 상세: 3개 park 지점(form/button/ai) 모두 `this.stageConversationThreadSnapshot(savedExecution, context)` 를 호출하는데, `savedExecution`이 null/undefined 인 경우 TypeScript 타입 상으로는 `Execution` 이 required이지만, 호출 직전 코드(nodeExec 조회 실패 등)의 에러 핸들링을 살펴보면 `savedExecution`은 항상 DB에서 이미 fetch된 유효 객체다. 그러나 `updateExecutionStatus`가 이미 `savedExecution`을 필수 인자로 받고 있어, 해당 라인에 도달한다면 `savedExecution`은 유효하다. 타입 상으로도 `Execution` 이 nullable 가 아니므로 실질적 위험은 없다.
- 제안: 현재 코드에서 실질적 위험은 없으나, `stageConversationThreadSnapshot`의 파라미터 타입이 `Execution`(non-nullable)으로 선언돼 있어 타입 안전성은 확보된 상태다. 수정 불필요.

---

### [INFO] 테스트에서 `rehydrateContext` 에 실제 `Execution` 엔티티 대신 plain object를 전달 — TypeORM 컬럼 직렬화/역직렬화 경로 미커버
- 위치: `execution-engine.service.spec.ts:392-408`
- 상세: `rehydrateContext` 테스트는 `{ id, workflowId, status, ..., conversationThread: persisted }` 형태의 plain object를 `execution` 인자로 전달한다. 실제 운영 경로에서는 TypeORM이 `jsonb` 컬럼을 PostgreSQL에서 읽어 `plain object`로 역직렬화해 준다. 단위 테스트는 이 역직렬화를 통한 `ConversationThread` 타입 일치 여부를 검증하지 않는다. 그러나 `rehydrateConversationThread` 자체가 `unknown` 입력을 받아 타입 정규화하므로, TypeORM 역직렬화 후에도 동일하게 동작한다.
- 제안: e2e 또는 integration 테스트에서 실제 DB round-trip 후 rehydration 동작 검증을 추가하면 TypeORM jsonb 역직렬화 경로 전체를 커버할 수 있다. 현재 단위 테스트 범위 내에서는 충분하다.

---

### [INFO] [SPEC-DRIFT] `spec/5-system/4-execution-engine.md §7.5` case 1/case 2 다이어그램에 fast-path 가 여전히 정상 경로로 서술됨
- 위치: `spec/5-system/4-execution-engine.md §7.5` (line 869-870)
- 상세: 구현 커밋 메시지에 §7.5의 conversationThread 복원이 구현 완료됐다고 명시한다. 그러나 spec §7.5 다이어그램의 "case 1: 로컬 pendingMap 키 있음 → 즉시 resolve() (fast path — §7.4)"와 "case 2: 로컬 pendingMap 키 없음 → rehydrate (slow path)" 구분은 여전히 유효하다 — 코드가 이 구분을 정확히 구현하고 있다(`rehydrateContext` early-return이 fast-path). spec 은 이미 §7.5에 "Execution.conversation_thread 컬럼에서 conversationThread 스냅샷 무손실 복원"(line 883-884)을 기술하고 있으므로 drift 없음. 단, 이전 코드에 있던 "conversationThread — 본 phase 에서는 빈 thread 로 시작" stale 주석(코드에서 이미 제거됨)의 spec 측 대응인 §7.5 "채워지지 않는 항목" 절이 spec에 남아 있는지 확인이 필요하다.
- 제안: 코드가 옳고 spec §7.5 의 "conversationThread" 서술도 이미 갱신된 상태다(PR 커밋에 spec 갱신 포함). 별도 수정 불필요.

---

## 요약

PR-A1의 구현은 요구사항 명세(spec §6.2/§7.5, conversation-thread §4/§8.4)와 전반적으로 일치한다. 핵심 요구사항인 "(1) park 직전 conversationThread 스냅샷의 원자적 durable commit, (2) rehydration 시 무손실 복원, (3) NULL fallback 회귀 없음, (4) 손상 graceful 처리"가 모두 구현됐으며, 스냅샷의 깊은 복사(`cloneThread`)로 영속본 오염 방지도 달성했다. 3개 park 지점(form/button/ai) 모두 `stageConversationThreadSnapshot` 을 일관되게 호출하고 있고, `updateExecutionStatus` 트랜잭션과 원자적으로 묶인다. `rehydrateConversationThread` 는 eviction-aware nextSeq 보존, totalChars 재계산, non-array/null/비객체 graceful을 모두 처리한다. 테스트는 18개 케이스로 핵심 시나리오를 커버하며 전체 745 모듈 테스트가 통과했다고 확인됐다. 요구사항 관점에서 CRITICAL/WARNING 수준의 미충족 사항은 없다.

## 위험도

LOW

---

STATUS: OK
