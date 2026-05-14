## 발견사항

---

### **[WARNING]** 테스트 파일 — ConversationThread 동작 검증 없음

- **위치**: 파일 1–8 (`buttons.spec.ts`, `*.handler.spec.ts` 8개 파일)
- **상세**: 8개 테스트 파일 전체가 `conversationThread: createEmptyConversationThread()`를 mock `ExecutionContext`에 추가하는 것에 그친다. turn push 실행 여부, `contextScope` 필터링, cap 초과 시 droppedTurns 계산 등 ConversationThread 핵심 계약에 대한 신규 단위 테스트가 전혀 없다. Spec §2.2의 "자동 누적 컨트랙트"가 구현에 반영됐는지 검증 불가.
- **제안**: 최소한 `ai-agent.handler.spec.ts` 또는 별도 `conversation-thread.spec.ts`에 (a) `ai_user` turn push 시점(LLM 호출 전), (b) `ai_assistant` turn push 시점(LLM 호출 후), (c) `excludeFromConversationThread: true` 시 push 건너뜀 케이스를 커버하는 테스트 추가 필요.

---

### **[WARNING]** `execution-engine.md §5.5` ExpressionContext 구성 표에 `$thread` 미반영

- **위치**: `spec/5-system/4-execution-engine.md` (파일 43)
- **상세**: 변경 diff는 §6.1 컨텍스트 필드 표에만 `$thread` 행을 추가한다. consistency-check 세션 2회(`2026-05-14_17-02-11/cross_spec/review.md`, 파일 21)에서 명시적으로 지적한 **"§5.5 ExpressionContext 구성 표 — `$thread` 누락"** WARNING은 해소되지 않았다. §5.5는 표현식 컨텍스트 변수의 단일 진실(source of truth) 테이블로, 여기서 빠지면 두 표가 불일치 상태가 된다.
- **제안**: `execution-engine.md §5.5` ExpressionContext 구성 표에 `| $thread | context.conversationThread | ConversationThread readonly view — 상세: [Spec Conversation Thread](../conventions/conversation-thread.md) |` 행 추가.

---

### **[WARNING]** presentation 노드 spec에 `excludeFromConversationThread` 필드 미반영

- **위치**: `spec/4-nodes/6-presentation/` 하위 노드 spec 파일들 (이번 변경 범위 밖)
- **상세**: `spec/conventions/conversation-thread.md §2.4`는 "각 노드에 공통 boolean config: `excludeFromConversationThread`"를 정의하고, `spec/4-nodes/3-ai/0-common.md §10`도 이 필드를 AI 공통 규약에 포함한다. 그러나 presentation 노드 spec(`form`, `carousel`, `table`, `chart`, `template`)에는 이 필드가 추가됐는지 이번 diff에서 확인되지 않는다. consistency-check `2026-05-14_17-19-21/cross_spec/review.md`(파일 28)도 이를 INFO로 지적했다.
- **제안**: 구현 착수 전 `spec/4-nodes/6-presentation/` 하위 각 노드 spec의 config 필드 목록에 `excludeFromConversationThread: Boolean (default false)` 추가 확인 후 누락 시 보완.

---

### **[WARNING]** `manual-trigger.handler.spec.ts` — 동일 worktree에 두 개의 독립 mock 객체

- **위치**: 파일 8 (`manual-trigger.handler.spec.ts`)
- **상세**: 파일 8에서 `makeContext()` 함수와 직접 선언된 객체 두 곳에 `conversationThread`가 별도로 추가됐다. 현재는 문제없으나, 두 mock이 구조적으로 분리되어 있어 향후 `ExecutionContext` 인터페이스 변경 시 한쪽이 누락될 위험이 있다. `makeContext` 함수만 사용하도록 리팩토링하는 것이 일관성을 보장한다.
- **제안**: 직접 선언된 mock 객체를 `makeContext()`로 교체하거나, 두 mock의 일치 여부를 보장하는 공통 픽스처로 추출.

---

### **[INFO]** `ai_user` push 순서 — spec 수정 여부 미확인

- **위치**: `spec/4-nodes/3-ai/1-ai-agent.md §6.1` (파일 42, diff 크기 초과로 내용 미제공)
- **상세**: consistency-check `2026-05-14_19-16-43/SUMMARY.md`(파일 33) W5는 "step 2.5(LLM 호출 이후)에 `ai_user` push가 배치되면서 설명은 'LLM 호출 전'으로 기술해 모순"을 WARNING으로 식별했다. `1-ai-agent.md` diff가 제공되지 않아 이 모순이 해소됐는지 확인 불가.
- **제안**: `ai_agent.md §6.1`의 step 2.5 내용을 확인해 `ai_user` push가 LLM 호출(step 2) **이전**, `ai_assistant` push가 LLM 응답 수신 **이후**로 분리 기술됐는지 검증.

---

### **[INFO]** Background copy 개선 — 요구사항 반영 확인

- **위치**: `spec/5-system/4-execution-engine.md §3.3` (파일 43)
- **상세**: rationale-continuity 검토에서 "shallow copy는 `turns` 배열 참조만 복사해 격리가 깨진다"고 경고한 WARNING이 `{ ...thread, turns: [...thread.turns] }` 명시로 **올바르게 해소**됐다. ND-BG-05 격리 불변량과 일관성 확보.

---

### **[INFO]** `form_submit` → `form_submitted` 정정 — 코드 레벨 확인 필요

- **위치**: `spec/1-data-model.md` (파일 40)
- **상세**: spec 문서 표기는 수정됐으나, `backend/` 코드의 `NodeExecution.interaction_data.interactionType` 저장 로직과 기존 DB row 마이그레이션 필요 여부가 이번 변경에 포함되지 않았다. plan_coherence 리뷰(파일 24 INFO-2)도 이를 지적했다.
- **제안**: 구현 착수 전 `backend/src/` 에서 `"form_submit"` 리터럴 grep 확인. 코드가 이미 `"form_submitted"` 생성 중이면 spec-only 정정으로 충분, 아니면 코드 + 마이그레이션 스크립트 필요.

---

## 요약

이번 변경의 핵심은 `ConversationThread`를 `ExecutionContext`의 1급 필드로 공식화하고, 관련 spec(execution-engine, expression-language, websocket-protocol, conventions)을 일관되게 업데이트한 것이다. 요구사항 관점에서 가장 주목할 점은 **테스트 파일 8개가 인터페이스 변경에 맞춰 mock을 갱신하는 데 그칠 뿐 ConversationThread 자동 누적 계약(turn push 시점·순서·cap·opt-out)을 검증하는 테스트를 포함하지 않는다**는 것이다. Spec 문서 간 정합성(§5.5 ExpressionContext 표 누락, presentation 노드 spec 미반영)도 부분적으로 해소되지 않아 구현 착수 전 보완이 필요하다. Background 격리(shallow → deep enough copy)와 `form_submit` → `form_submitted` 정정은 올바르게 반영됐다.

## 위험도

**MEDIUM** — Critical 블로커는 없으나, ConversationThread push 계약에 대한 테스트 부재와 spec 표(§5.5, presentation 노드)의 부분적 불일치가 구현 단계에서 silent bug로 전환될 수 있다.