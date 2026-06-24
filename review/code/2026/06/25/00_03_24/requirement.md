# 요구사항(Requirement) 코드 리뷰

리뷰 대상: `refactor(ai-agent): C-2 1차 — executeSingleTurn setup 단계 §6.1 메서드 분해`
파일: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`

---

## 발견사항

### **[WARNING]** `buildSingleTurnMessages` JSDoc 에 §6.1 단계 번호 오기재
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 라인 971~974 (JSDoc), 라인 1137~1138 (caller 주석)
- 상세: `buildSingleTurnMessages` 의 JSDoc 및 caller 주석에 "§6.1 단계 1.5·1.7" 로 표기되어 있으나, 해당 메서드가 실제로 수행하는 것은 **단계 1.7 (`ai_user` turn push)** 뿐이다. 단계 1.5 (컨텍스트 메모리 주입)는 `applySingleTurnMemoryInjection` 에서 수행한다. spec §6.1 단계 정의에 따르면 1.5 는 "LLM 호출 전 memoryStrategy 분기 thread/memory 주입"으로, messages 배열 빌드가 아니다.

  이 오기재는 spec 추적성의 목적(각 메서드 doc 에 §6.1 단계 번호 명기)을 달성하려는 이번 리팩토링의 명시적 목표에 정면으로 배치된다. 단계 1.5 가 두 메서드에 걸쳐 있는 것처럼 보여 유지보수 혼란을 초래한다.
- 제안: `buildSingleTurnMessages` JSDoc 및 caller 주석을 "§6.1 단계 1.7" 로 수정. caller 주석(라인 1137~1138)도 동일하게 수정:
  ```
  // §6.1 단계 1.7 — 초기 messages 조립 + ConversationThread `ai_user` push (spec §2.2, LLM 호출 전).
  ```

### **[INFO]** `ai_user` push 가 memory injection 보다 앞에 실행되는 순서 — spec vs 실제 구현 (behavior-preserving)
- 위치: `executeSingleTurn` 내 호출 순서 (라인 1138→1149)
- 상세: spec §6.1 순서는 1.3 → 1.5 → 1.7 이다. 그러나 코드에서는 `buildSingleTurnMessages`(1.7 `ai_user` push) 가 `applySingleTurnMemoryInjection`(1.3·1.5) 보다 **앞에** 호출된다. 이 순서 차이는 **이번 리팩토링이 도입한 것이 아니라** 원본 코드에서 동일하게 존재하던 패턴이며, 리팩토링은 이를 그대로 보존했다(behavior-preserving).

  기능적으로 문제가 없는 이유: `ai_user` push 는 ConversationThread 에 현재 노드 자신의 turn 을 추가하고, memory injection 의 `getThreadExcludingNode` 는 자기 노드 turn 을 제외하므로 push 선후에 관계없이 주입 결과가 동일하다.

  그러나 spec §6.1 텍스트 순서(1.3 → 1.5 → 1.7)와 코드 실행 순서(1.7 → 1.3/1.5)가 다르므로, 이 괴리는 spec 혹은 코드 주석 수준에서 명시적 근거가 기록될 필요가 있다.
- 제안: 코드 동작 수정 불요 (pre-existing behavior-preserving). `applySingleTurnMemoryInjection` JSDoc 또는 `executeSingleTurn` caller 주석에 "ai_user push 가 memory injection 보다 앞서 실행되는 이유: ai_user 는 자기 노드 turn 이므로 excludingNode 필터로 주입 결과에 영향 없음" 을 한 줄 명기 권장.

### **[INFO]** `buildSingleTurnMessages` 가 side effect (thread push) 를 시그니처에 드러내지 않음
- 위치: 라인 975~994 (`buildSingleTurnMessages` 정의)
- 상세: `buildSingleTurnMessages` 는 `ChatMessage[]` 를 반환하는 빌더처럼 보이나 내부에서 `pushAiThreadTurn`(ConversationThread 변이)을 수행하는 side effect 가 있다. 메서드명 "build" 는 통상 순수 빌더를 암시하므로 의도와 구현 간 괴리가 있다. 이는 impl-prep INFO-3 에서 지적한 `ai_user` push ordering 보존 설계 결정이지만, 부작용이 시그니처에 드러나지 않는다.
- 제안: JSDoc 에 "부작용: userPrompt 비어있지 않을 때 ConversationThread 에 `ai_user` turn 을 push 함" 을 명시적으로 기재. (메서드명 변경은 선택적)

### **[INFO]** `applySingleTurnMemoryInjection` JSDoc 단계 번호에 §11.4 ordering 번호 혼용
- 위치: `applySingleTurnMemoryInjection` JSDoc (라인 1001)
- 상세: JSDoc 에 "§6.1 단계 1.3 · [5]" 로 표기되어 있으나, 1.3 과 1.5 두 단계를 수행함에도 1.5 가 누락되고 §11.4 ordering 의 "[5]" 가 혼용되어 있다. Cross-spec checker INFO-4 에서 지적한 §6.1 단계 번호 체계 일관성 원칙과 동일 맥락이다.
- 제안: JSDoc 을 "§6.1 단계 1.3 · 1.5 — persistent memory recall + ConversationThread/Memory 주입" 으로 수정해 spec §6.1 단계 번호만 사용.

---

## Spec Fidelity 점검

### 관련 spec 문서
- `spec/4-nodes/3-ai/1-ai-agent.md §6.1` — single-turn 실행 단계 시퀀스
- `spec/4-nodes/3-ai/0-common.md §11.4` — systemPrompt ordering SoT

### 구현 vs spec §6.1 단계 대응표

| spec §6.1 | 코드 구현 | 일치 여부 |
|-----------|----------|-----------|
| 0.5: System Context Prefix + [1]→[2]→[3]→[4] ordering | `buildSingleTurnSystemPrompt`: prefix + systemPrompt + KB_TOOL_GUIDANCE + conditionSuffix + PRESENTATION_TOOLS_GUIDANCE | 일치 |
| 1.3: persistent memory recall (LLM 전 동기) | `applySingleTurnMemoryInjection` 내 `injectMemoryContext` (persistent 분기) | 일치 |
| 1.5: thread/memory injection (memoryStrategy 분기) | `applySingleTurnMemoryInjection` 내 `injectThreadContext` (manual) / `injectMemoryContext` (자동) | 일치 |
| 1.7: `ai_user` turn push (LLM 전 1회) | `buildSingleTurnMessages` 내 `pushAiThreadTurn(..., 'ai_user', ...)` | 기능 일치; 실행 순서는 1.3/1.5 보다 앞 (pre-existing, 기능적 영향 없음) |
| 2: LLM 호출 | `llmService.chat(...)` | 일치 |
| 2.5: `ai_assistant` turn push (응답 직후) | tool-loop 종결·condition-route 분기 직전 `pushAiThreadTurn(..., 'ai_assistant', ...)` | 일치 (보존됨) |
| 2.7: persistent memory 추출 (턴 경계 비동기) | `scheduleMemoryExtraction` (caller 범위 유지) | 일치 (보존됨) |
| accumulator scope: tool-loop span accumulator 는 caller 소유 | `presentationViolationCounters`, `ragAcc`, `mcpDiagnosticsAcc` 등 `executeSingleTurn` scope 유지 | 일치 (impl-prep INFO-2 준수) |

### 발견된 spec-코드 불일치
`buildSingleTurnMessages` JSDoc 의 "단계 1.5·1.7" 레이블이 spec §6.1 단계 1.5 정의(memory injection)와 불일치 — 해당 메서드는 1.7(ai_user push) 만 수행. 동작 오류가 아닌 **문서 오기재**이므로 WARNING 으로 분류.

---

## 요약

이번 C-2 1차 리팩토링은 `executeSingleTurn` god-method 의 setup 단계를 spec §6.1 단계와 정렬된 3개 private 메서드로 분해하는 behavior-preserving 변경이다. §11.4 systemPrompt ordering, accumulator scope 보존, tool-loop 흐름, `_resumeState` 운반, `ai_user`/`ai_assistant` push ordering 등 모든 기능적 invariant 가 원본과 동등하게 보존되었으며 e2e 214 PASS 가 이를 검증한다. 유일한 주요 문제는 `buildSingleTurnMessages` JSDoc 에 단계 1.5 가 오기재된 점으로, 이 리팩토링의 핵심 목표인 "spec 추적성을 위한 §6.1 단계 번호 명기" 를 부분적으로 훼손한다. 나머지 INFO 항목들은 기능 정확성과 무관한 문서 명확화 개선 제안이다.

---

## 위험도

LOW
