# Requirement Review — AiMemoryManager 추출 (M-1 2단계)

**대상 커밋**: `3369fceffc07ea57ec55ff6bef782ddeedcbfcd0`
**리뷰어**: requirement (spec fidelity + functional completeness)
**검토 파일**:
1. `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (변경)
2. `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` (신규)
3. `review/consistency/2026/06/21/21_00_17/SUMMARY.md` (impl-prep 산출물)

---

## 발견사항

### [INFO] `ai-memory-manager.ts` 가 `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 미등재
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록
- 상세: 신규 파일 `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` 가 spec 의 `code:` 배열에 없다. `ai-condition-evaluator.ts` 도 M-1 1단계 후 같은 상태라 consistency SUMMARY 에서 INFO #1/INFO #3 로 기록됐으며, M-1 2단계 완료 후 동일하게 planner 동기화 대상이다. 코드 동작에는 무영향.
- 제안: [SPEC-DRIFT] 코드 유지 + spec 반영. `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` 추가 (planner 위임, consistency SUMMARY INFO #3 와 동일 처리 경로).

---

### [INFO] `resolveMemoryStrategy` 는 `private` → `public` 으로 가시성 변경됨 (spec 침묵 영역)
- 위치: `ai-memory-manager.ts` line 75 (`resolveMemoryStrategy`)
- 상세: 핸들러에서는 `private resolveMemoryStrategy(...)` 였으나 `AiMemoryManager` 에서는 `resolveMemoryStrategy(...)` (명시 modifier 없음, TypeScript 기본 `public`) 로 선언됐다. spec 은 내부 가시성을 명시하지 않으므로 이 변화는 spec 침묵 영역이다. 동작에는 영향 없음.
- 제안: 외부 노출이 불필요하면 `resolveMemoryStrategy` 에 `public` 을 명시하거나 현행 유지. spec 변경 불필요.

---

### [INFO] `summary_buffer` 전략에서 `[5b]` 실행 전에 `[5a]` 코드 경로가 동작하지 않음을 코드가 올바르게 분기하고 있음 (확인 항목)
- 위치: `ai-memory-manager.ts` lines 158–208 (`[5a] persistent 회수`)
- 상세: `if (args.strategy === 'persistent' && this.agentMemoryService)` 로 가드. spec §6.2 d.5 에서 "`summary_buffer` 는 1.5(롤링 요약)만 적용, 1.3(회수)/2.7(추출) 미적용"이라고 명시한다. 이 분기가 spec 정의와 정확히 일치하는지 확인 — 일치함. 이슈 없음.

---

### [INFO] `compactedMessages` 필드는 `AiMemoryManager.injectMemoryContext` 반환 타입에 포함되지 않고 핸들러에서 조립됨 (설계 의도 확인)
- 위치: `ai-memory-manager.ts` 반환 타입 (`memory` 객체, line 128–137) vs `ai-agent.handler.ts` lines 2057–2060
- 상세: spec §7.1 의 `meta.memory` 필드 정의는 `{ strategy, summarized, recalledCount, tokenBudgetUsed, compactedMessages? }` 5개 필드를 포함한다. `AiMemoryManager.injectMemoryContext` 의 반환 `memory` 객체는 `{ strategy, summarized, recalledCount, tokenBudgetUsed }` 4개만 반환하고, `compactedMessages` 는 핸들러(`ai-agent.handler.ts` lines 2057–2060)에서 물리 압축 발생 후 spread 로 추가한다. 이 분리는 의도적인 설계다 — `compactedMessages` 는 핸들러가 `compactMessagesToTail` 를 직접 호출한 결과이므로 `AiMemoryManager` 반환값에 속하지 않는 것이 책임 분리 원칙에 맞는다. 동작에는 영향 없음.

---

### [INFO] `keepUserExchanges = 0` 일 때 물리 압축 skip 이 핸들러에서만 일어남
- 위치: `ai-agent.handler.ts` lines 2062–2069
- 상세: `mem.memory.summarized && mem.keepUserExchanges > 0` 조건에서, 요약이 발생했으나 `keepUserExchanges=0` 이면 물리 압축을 skip 한다. spec §6.2 d.6 은 "요약이 오래된 exchange 를 커버하면 물리 제거"를 명시하지만, 경계값 `keepUserExchanges=0` 처리를 명시하지 않는다. 구현이 안전한 방향(누적 messages 무변경)으로 degrade 하며, 진단 로그를 남기는 것은 spec 침묵 영역에서의 합리적 선택이다.

---

## 요약

이번 변경은 `resolveMemoryStrategy`, `injectMemoryContext`, `scheduleMemoryExtraction` 세 메서드를 핸들러에서 `AiMemoryManager` 무상태 collaborator 로 이동하는 순수 behavior-preserving 리팩토링이다. spec 요구사항 분석 결과:

1. **기능 완전성**: 세 메서드 모두 동작 verbatim 이동 확인. `manual` 경로는 핸들러가 분기 전 처리해 `AiMemoryManager` 를 우회하는 불변식(§12.9 하위호환)이 정확히 유지된다.
2. **spec fidelity**: spec §6.1 단계 1.3/1.5/2.7, §6.2 d.5/d.6, §11.4 ordering([5a]→[5b]→[6]), §12.10~12.14 Rationale 불변식 전부 코드에 line-level 로 대응된다. 기본값(tokenBudget=8000, topK=5, threshold=0.7)은 spec §1 및 shared schema 와 일치한다.
3. **엣지 케이스**: `conversationThreadService`/`agentMemoryService` 미주입 graceful degrade, `queryText` 빈값 systemPrompt fallback, recall 실패 방어적 catch-삼킴 — 전부 보존.
4. **TODO/FIXME**: 코드 내 `TODO/FIXME/HACK/XXX` 없음.
5. **반환값**: 모든 경로(system-only / system_text / messages)에서 `{ messages, finalSystemPrompt, memory, keepUserExchanges }` 4개 필드 반환. 이슈 없음.
6. **spec 미등재(SPEC-DRIFT)**: 신규 파일 `ai-memory-manager.ts` 가 `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 없음. 코드 버그가 아닌 spec 갱신 누락 — planner 위임.

Critical 또는 Warning 수준의 기능 결함 및 spec 위반은 발견되지 않았다.

## 위험도

NONE

---

STATUS: PASS
