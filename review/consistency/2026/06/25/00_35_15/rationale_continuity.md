# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/refactor/03-maintainability.md` C-2 2차(완결) 구현 계획
검토 모드: 구현 착수 전 (--impl-prep)
검토 일시: 2026-06-25

## 발견사항

### [INFO] `console.warn` 문구 보존 의무 — m-1 Logger 교체 순서 주의

- **target 위치**: `03-maintainability.md` C-2 개선 방안 2번 — "form bypass/fallback(`console.warn` 문구는 spec 본문 명시)·`ai_user` push 가 LLM 호출 **전**, `ai_assistant` push 가 응답 **직후**인 ordering 보존"
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §6.2.c.fallback` (본문 규정) + `03-maintainability.md m-1 개선 방안 3` — "ai-agent spec §6.2.c.fallback 의 'console.warn' spec 원문은 planner 정정 위임"
- **상세**: spec §6.2.c.fallback 은 `console.warn('[processMultiTurnMessage] form submission without pendingFormToolCall — fallback to plain user message', ...)` 를 spec 본문에 명시하고 있다. C-2 target 의 "console.warn 문구는 spec 본문 명시" 메모가 이 사실을 올바르게 인식하고 있다. 그러나 m-1(Logger 교체) 가 C-2 리팩토링과 동일 파일을 건드릴 경우, Logger 교체 과정에서 `processMultiTurnMessage` 의 console.warn 이 `Logger.warn` 으로 바뀔 수 있는데, 이 console.warn 문구 자체는 spec §6.2.c.fallback 의 진단 surface 규격으로 기록된 상태다. m-1 의 "planner 정정 위임" 이 아직 처리되지 않은 채 C-2 리팩토링이 먼저 완료되면, 메서드 분리 후 해당 console.warn 이 어느 private 메서드로 이전되는지가 spec 과 코드 양쪽에서 불명확해진다.
- **제안**: C-2 메서드 분리 시 `c.fallback` 경로의 console.warn 을 옮길 private 메서드를 plan 상에 명시(`handleTurnCompletion` 또는 별도 fallback 분기 메서드)하고, m-1 의 spec 정정이 완료될 때까지 해당 console.warn 은 Logger 교체 없이 원문 유지한다. 또는 m-1 spec 정정이 선행(planner)되어 "console.warn → Logger.warn" 으로 규약이 변경된 후 C-2 에서 Logger.warn 으로 이전한다.

---

### [INFO] `classifyTurnResult` 메서드명 — spec 에 명칭 언급 없음, 추적성 명기 권장

- **target 위치**: `03-maintainability.md` C-2 개선 방안 1 — "`classifyTurnResult`(§6.2 3판정)"
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §6.2` — 멀티턴 종결 판정 3종(condition route / `user_ended` / `max_turns`)을 steps 로 정의하고 있으나, 이를 담는 메서드 이름을 명시하지 않는다(spec 대조 판정: C — 행위만 규정).
- **상세**: `classifyTurnResult` 는 plan 이 제안하는 이름이고 spec 은 해당 이름을 언급하지 않는다. 1차 슬라이스(PR #697)에서 spec §6.1 단계번호를 메서드 doc 에 명기하는 패턴을 정립했으므로, C-2 2차에서도 동일하게 메서드 doc 에 `@see spec §6.2 단계 3판정` 형태로 단계 번호를 주석에 명기하면 충분하다. 명칭 자체는 spec 위반이 아니며, 추적성만 확보하면 된다.
- **제안**: `classifyTurnResult`(또는 유사 명칭) 메서드 JSDoc 에 `§6.2` 단계번호(condition-route · user_ended · max_turns 판정)를 명기하면 spec-코드 추적성이 유지된다. spec 변경 불요.

---

### [INFO] `executeToolBatch` — 기존재 `executeProviderToolBatch` 재활용·accumulator 소유권 명시 필요

- **target 위치**: `03-maintainability.md` C-2 개선 방안 1 — "`executeToolBatch`(기존 메서드 확대)"
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §6.1 단계 3.f` — `Promise.all` 병렬 실행 불변식 규정
- **상세**: `executeSingleTurn` 스코프의 tool-loop 실행과 `processMultiTurnMessage` 내부의 tool 실행이 동일 메서드를 공유할 경우, single-turn / multi-turn 의 accumulator 운반 차이(단일 turn accumulator vs 멀티턴 cross-turn 공유 accumulator)가 메서드 시그니처에 명확히 드러나야 한다. §6.1 단계 3의 `Promise.all` 병렬 실행 불변식이 공유 메서드에서도 유지되어야 한다.
- **제안**: `executeToolBatch` 를 두 컨텍스트에서 공유할 경우, accumulator 파라미터가 명시적으로 주입되는 구조(caller scope 에서 accumulator 를 인자로 전달)를 취해 spec §6.1/§6.2 의 accumulator 소유권이 메서드 경계에서 명확히 유지되도록 한다. 메서드 doc 에 `§6.1 단계 3.f Promise.all 병렬 실행` 단계번호 명기.

---

### [INFO] `ai_user` push 시점 불변식 — 분리 후에도 LLM 호출 전 위치 강제 확인 필요

- **target 위치**: `03-maintainability.md` C-2 개선 방안 2 — "`ai_user` push 가 LLM 호출 **전**"
- **과거 결정 출처**: `spec/conventions/conversation-thread.md §1.4 비고` — "`ai_user` push 시점 불변 + 라이브 조기 노출 관계" 명시; `spec/4-nodes/3-ai/1-ai-agent.md §6.2.c` — ai_user push 가 LLM 호출 전 ordering 명시
- **상세**: target 이 이 불변식을 명시적으로 언급하고 있어 인식은 되고 있다. 그러나 `processMultiTurnMessage` 를 `buildTurnMessages` · `executeToolBatch` · `classifyTurnResult` · `handleTurnCompletion` 으로 분리할 때, `buildTurnMessages` 내부에서 `ai_user` thread push 가 일어날지, 아니면 caller 인 `processMultiTurnMessage` 가 `buildTurnMessages` 호출 후 별도로 push 할지에 따라 LLM 호출 전/후 ordering 이 달라질 수 있다.
- **제안**: 분리 후 `ai_user` push 는 반드시 LLM 호출을 담는 메서드(`executeToolBatch` 또는 내부 LLM 호출부) 보다 앞에 위치해야 한다. 이를 메서드 JSDoc 에 "호출 순서 불변: ai_user push → LLM call (§6.2.c, conversation-thread §1.4)" 으로 명기 권장.

---

### [INFO] `handleTurnCompletion` — checkpoint 영속 순서 불변식 명기 필요

- **target 위치**: `03-maintainability.md` C-2 개선 방안 1 — "`handleTurnCompletion`(turn push·checkpoint)"
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §7.4·§7.5` — `_resumeState`/`_resumeCheckpoint` 의 credential-strip 부분집합 영속, `CHECKPOINT_SCHEMA_VERSION` 버전 가드, park-rehydration slow-path 일원화
- **상세**: `handleTurnCompletion` 으로 분리되는 메서드가 `_resumeCheckpoint` 영속 호출을 포함할 경우, 해당 영속은 turn push ordering(`ai_assistant` push 직후) 과도 연동되어야 한다. `handleTurnCompletion` 의 내부 순서가 (a) `ai_assistant` push → (b) checkpoint 영속 → (c) park 진입 이어야 한다는 불변식이 spec §6.2 에서 암묵적으로 유지된다.
- **제안**: `handleTurnCompletion` 메서드 JSDoc 에 `§6.2 d checkpoint 영속` + `ai_assistant push 직후 (spec §1.4 turn push ordering)` 두 단계번호를 명기해 순서 불변식을 코드에서 자기 문서화.

## 요약

target 은 `ai-turn-executor.ts` 의 god-method 를 spec §6.1/§6.2 단계 정렬 private 메서드로 behavior-preserving 분해하는 순수 리팩토링 계획이며, 기존 Rationale 에서 기각된 대안을 재도입하거나 합의된 원칙을 정면 위반하는 항목은 발견되지 않았다. spec 은 이 리팩토링에 대해 "C — 행위만 규정, 클래스/메서드 구조 미규정" 으로 판정되어 구현 자유도가 허용된 영역이다. 모든 발견사항은 분리 후 spec 추적성(단계번호 명기)·ordering 불변식(ai_user push LLM 호출 전·ai_assistant push 응답 직후)·checkpoint 영속 순서·m-1 console.warn 교체 작업과의 간섭 회피에 관한 INFO 수준의 보완 제안이다. 특히 m-1(console.warn → Logger 교체)과 C-2 가 동일 메서드(`processMultiTurnMessage` 내 fallback 경로)를 건드릴 때 작업 순서를 조율해야 하는 간섭 위험이 있으며, 이를 plan 내 선후행 의존관계로 명시해 두는 것을 권장한다.

## 위험도

LOW
