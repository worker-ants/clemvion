# 정식 규약 준수 검토 결과

**대상**: `03-maintainability C-2 1차 슬라이스` — `executeSingleTurn` setup 단계를 private 메서드 3개로 behavior-preserving 분해  
**검토 범위**: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (diff) + `ai-turn-executor.spec.ts` (diff)  
**diff base**: `origin/main`

---

## 발견사항

### [INFO] private 메서드 명명이 관례와 일치함 — 이상 없음

- target 위치: `ai-turn-executor.ts` — `buildSingleTurnSystemPrompt`, `buildSingleTurnMessages`, `applySingleTurnMemoryInjection`
- 위반 규약: 해당 없음
- 상세: 세 메서드 모두 `camelCase` private 메서드로, 기존 클래스 내 메서드 명명 패턴(`buildAiNodeRefFromContext`, `injectThreadContext`, `pushAiThreadTurn` 등)과 일관됨. `build*` / `apply*` 동사 분리도 스펙 주석(`§6.1 단계 번호`)과 정합함.

---

### [INFO] `applySingleTurnMemoryInjection` 파라미터가 단일 args 객체로 묶인 것 — 적절한 패턴

- target 위치: `ai-turn-executor.ts` L1011 — `private async applySingleTurnMemoryInjection(args: { ... })`
- 위반 규약: 해당 없음 (관련: `spec/conventions/node-output.md` Principle 0 — NodeHandlerOutput 5필드 불변; 본 메서드는 handler output 이 아닌 내부 helper)
- 상세: 9개 파라미터를 args 객체로 묶는 패턴은 기존 클래스 내 다른 복수-파라미터 helper 와 동형이며, 변경된 `executeSingleTurn` 의 public 시그니처(`_input, config, context`)는 원본과 동일함.

---

### [INFO] 테스트가 `§11.4 ordering` 를 문자열 indexOf 로 직접 단언 — spec 참조 적절

- target 위치: `ai-turn-executor.spec.ts` L42–78
- 위반 규약: 해당 없음
- 상세: 테스트가 `sys!.indexOf(...)` 비교로 §11.4 prompt 순서(systemPrompt → KB → condition → presentation)를 직접 고정함. `spec/conventions/` 규약이 아니라 `spec/4-nodes/3-ai/0-common.md §11.4` 를 검증 대상으로 삼으며 — conventions 에서 테스트 방식을 제한하는 규칙은 없음.

---

### [INFO] `Principle 7` 주석 참조가 그대로 유지됨 — 불일치 없음

- target 위치: `ai-turn-executor.ts` diff 내 주석 `// CONVENTIONS Principle 7 — config echoes raw user input`
- 위반 규약: `spec/conventions/node-output.md` Principle 7
- 상세: 해당 주석은 원본에서 옮겨진 것으로 동일 블록(`rawConfig = context.rawConfig ?? config`)에 위치하며 의미가 유지됨. Principle 7 본문의 `context.rawConfig` echo 패턴 및 spread 금지 규칙을 위반하는 신규 코드는 없음.

---

### [INFO] ConversationThread `ai_user` push 위치 설명이 spec §2.2 와 정합

- target 위치: `ai-turn-executor.ts` L989 주석 `spec §2.2 — single-turn ai_user, 단계 1.7, LLM 호출 전`
- 위반 규약: 해당 없음 (관련: `spec/conventions/conversation-thread.md` §1·§2)
- 상세: `buildSingleTurnMessages` 로 추출된 후에도 `ai_user` push 가 `messages` 배열 구성 직후·LLM 호출 전 위치에서 발생함. 추출 전 원본 코드와 동일 지점 — ordering invariant 보존 확인됨.

---

## 요약

이번 변경은 `executeSingleTurn` 내 setup 단계를 `buildSingleTurnSystemPrompt`, `buildSingleTurnMessages`, `applySingleTurnMemoryInjection` 세 private 메서드로 추출하는 behavior-preserving 리팩터링이다. spec 문서 변경이 없고, 공개 API 시그니처(`executeSingleTurn(_input, config, context)`)가 원본과 동일하게 유지된다. 검토 대상인 `spec/conventions/` 정식 규약(node-output Principle 0·1.1·7, conversation-thread §2.2, execution-context 원칙 1–4, swagger, spec-impl-evidence)에 대한 위반이 없으며, 발견사항은 모두 INFO 수준의 확인 메모다. 규약 갱신이 필요한 사항도 없다.

## 위험도

NONE
