# Rationale 연속성 검토

**검토 모드**: `--impl-prep`
**Target 범위**: `03-maintainability C-2` (1차 슬라이스) — `ai-turn-executor.ts` 의 `executeSingleTurn(~545줄)` god-method 를 spec §6.1 단계에 정렬한 private 메서드로 behavior-preserving 분해.

---

## 발견사항

### INFO-1: §11.4 ordering SoT 준수 — 추출 메서드 경계 정렬 필요
- **target 위치**: 계획된 private 메서드 분리 경계 (setup 단계 추출)
- **과거 결정 출처**: `spec/4-nodes/3-ai/0-common.md §11.4` "본 ordering 의 단일 SoT 는 본 §11.4" + `spec/4-nodes/3-ai/1-ai-agent.md §6.1` 단계 0.5 ~ 1.5
- **상세**: §11.4 는 systemPrompt 빌드 순서를 `[1] System Context Prefix → [2] 사용자 systemPrompt → [3] KB_TOOL_GUIDANCE → [4] Condition suffix → [5] Memory/Thread injection (안정 프리픽스) → [6] 휘발성 꼬리` 로 고정한다. "시스템 프롬프트 빌드" 와 "ConversationThread/Memory 주입" 을 별개 메서드로 나누면 finalSystemPrompt 가 [3][4] suffix 포함 후 [5] 주입이 이루어지는 의존관계가 메서드 시그니처로 명시되어야 한다. [5] 담당 메서드가 [3][4] 적용 전의 systemPrompt 를 받으면 §11.4 의 ordering invariant 가 깨진다.
- **제안**: 추출 메서드 doc 에 `// §6.1 단계 0.5 · [1]~[4]` / `// §6.1 단계 1.3·1.5·[5] (§11.4 ordering — [3][4] suffix 포함 후 호출)` 처럼 spec 단계 번호와 ordering 의존관계를 명기한다. 파라미터 이름을 `systemPromptWithGuidance` 등으로 구분해 [3][4] 포함 여부를 시그니처에서 드러내는 것도 고려.

---

### INFO-2: 공유 accumulator 미분리 원칙 — 추출 경계 결정 시 주의
- **target 위치**: 계획된 setup 단계 추출 경계
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §6.1` + `plan/in-progress/refactor/03-maintainability.md C-2` — "공유 accumulator(turnDebug/render/retry/mcp diagnostics) 흐름은 보존"
- **상세**: `ragAcc / turnRagAcc / RagAccumulatorGroup`, `mcpDiagnosticsAcc[]`, `presentationPayloads / presentationCalls / presentationSchemaViolations / presentationViolationCounters`, `llmCalls[]` 는 setup 단계 이후에도 tool-loop 전 구간에서 공유된다. 특히 `presentationViolationCounters` (도구별 1회 재시도 카운터, §4.1 schema-violation gate) 는 tool-loop 전체를 span 하므로 setup 메서드 안으로 흡수되면 §4.1 invariant 가 깨진다.
- **제안**: 추출 메서드 시그니처 설계 시 accumulator 생성 위치와 생명주기를 결정하고 doc 에 어느 accumulator 가 caller 소유인지 명기한다. `presentationViolationCounters` 는 caller scope 에서 생성해 tool-loop 로 넘기는 패턴을 유지한다.

---

### INFO-3: `ai_user` turn push ordering invariant 명시 — 추출 시 회귀 방지
- **target 위치**: 계획된 "메시지 빌드" 추출 단계
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §6.1 단계 1.7` — "LLM 호출 **전**, `userPrompt` resolved 직후 1회"
- **상세**: 현재 구현에서 `ai_user` turn push 는 messages 빌드 직후, memory/thread inject 와 tool-loop 이전에 배치된다 (코드 라인 1017-1023). "메시지 빌드" private 메서드 추출 시 `ai_user` push 포함 여부에 따라 ConversationThread §2.2 의 push 시점 invariant (ai_user 는 항상 LLM 호출 전, ai_assistant 는 응답 직후) 가 어겨질 수 있다.
- **제안**: 메서드 분리 후 `ai_user` push 위치가 §6.1 단계 1.7 을 만족하는지, `ai_assistant` push (단계 2.5) 가 tool-loop 이후 LLM 응답 직후에 유지되는지 diff 리뷰 체크리스트로 명시한다.

---

## 요약

이번 검토 범위(C-2 1차 슬라이스 — `executeSingleTurn` 의 setup 단계 behavior-preserving 분해)는 `spec/4-nodes/3-ai/1-ai-agent.md §12` Rationale 에서 기각된 대안을 재도입하거나, 합의된 시스템 invariant 를 직접 위반하는 설계 의도를 포함하지 않는다. `03-maintainability.md C-2` 도 tool-loop 과 accumulator 흐름을 보존 대상으로 명시하고 있어 과거 결정과의 정합성은 양호하다. 다만 `spec/4-nodes/3-ai/0-common.md §11.4` 의 systemPrompt building ordering SoT, `§6.1 단계 1.7` 의 `ai_user` turn push timing invariant, 공유 accumulator 생명주기 경계는 메서드 시그니처 설계 시 주요 주의점이며, 계획에서 요구하는 "각 메서드 doc 에 §6.1 단계 번호 명기" 로 자연스럽게 보강할 수 있는 수준이다.

---

## 위험도

LOW
