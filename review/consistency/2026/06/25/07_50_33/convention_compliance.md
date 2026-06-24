# 정식 규약 준수 검토 — W7 SPEC-DRIFT (condition tool budget exclusion)

검토 모드: `--impl-prep`
대상 변경: `recordMultiTurnNonProviderToolResults` 의 condition deferral `toolCallCount++` 제거 + INFO cleanup

---

## 발견사항

### 1. **[CRITICAL]** multi-turn 경로에서 condition deferral 이 `toolCallCount` 에 합산됨 — spec §7.1 직접 위반

- **target 위치**: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L2259–2261 (`processMultiTurnMessage` 내 conditionToolCalls 루프)
- **위반 규약**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 `meta.toolCalls` 필드 정의 — "KB·MCP·일반 도구 호출 횟수 합산 **(조건 도구 제외)**"
- **상세**: single-turn 경로(L1363–1364)는 `// Condition tool: send deferral message (does not count toward toolCallCount)` 주석과 함께 increment 없이 정확히 처리한다. 그러나 multi-turn resume 경로의 동일 루프(L2259–2261)는 `toolCallCount++` 를 수행한다. 결과적으로 multi-turn 에서 condition deferral 이 `maxToolCalls` budget 을 소모하고 `meta.toolCalls` 에 합산되어, 동일 워크플로를 single-turn / multi-turn 으로 실행할 때 `meta.toolCalls` 값이 달라지는 invariant 깨짐이 발생한다.
- **제안**: L2259 `for (const tc of classification.conditionToolCalls)` 루프 내부 L2260 `toolCallCount++` 를 제거. single-turn 경로(L1364)의 주석을 multi-turn 루프에도 동일하게 추가해 의도를 명시. spec 변경은 불요 (기존 spec §7.1 이 정확하게 기술하고 있음).

---

### 2. **[INFO]** `'tool_call_budget_exceeded'` 인라인 문자열 리터럴 — 상수 미추출

- **target 위치**: `ai-turn-executor.ts` L922, L1392, L2287 (인라인 `JSON.stringify({ error: 'tool_call_budget_exceeded' })` 반복 3회)
- **위반 규약**: 직접 위반하는 정식 규약 없음. `spec/conventions/error-codes.md` §1 의 `UPPER_SNAKE_CASE` 명명 규약은 `output.error.code` (노드 핸들러가 에러 포트로 발행하는 public 코드) 에 적용되며, `tool_call_budget_exceeded` 는 LLM 에게 전달되는 tool_result 내부 content (LLM-protocol 수준 메시지) 이므로 해당 규약 적용 범위 밖이다. 다만 동일 리터럴이 3개 site 에 산재해 오타·불일치 위험이 있고, spec §6.1.g 문서 정의와 연동이 단절된 상태다.
- **제안**: `TOOL_BUDGET_EXCEEDED_ERROR = 'tool_call_budget_exceeded'` 상수를 `ai-turn-executor.ts` (또는 별도 constants 파일) 에 추출해 3 site 에서 참조. 상수명은 UPPER_SNAKE_CASE 를 따르되 값 자체(`'tool_call_budget_exceeded'`)는 spec §6.1.g 정의 및 LLM wire-level 계약 유지를 위해 변경하지 않음. `error-codes.ts` 의 `ErrorCode` enum 에 추가하는 것은 "public output.error.code 가 아니다" 는 `error-codes.md` §1 경계를 흐리므로 권장하지 않음 — 별도 내부 상수 파일이 적합.

---

### 3. **[INFO]** `Date.now()` 이중 호출 — `durationMs` 와 `finishedAt` 시각 불일치 가능

- **target 위치**: `ai-turn-executor.ts` L1232–1234 (single-turn `llmCalls.push`), L2115–2117 (multi-turn 첫 LLM 호출), L1456–1458, L2354–2356 (loop 재호출)
- **위반 규약**: 직접 위반하는 정식 규약 없음. 관련 SoT: `spec/5-system/6-websocket-protocol.md §4.4` (tool 실행 시작/종료 절대 시각 ISO8601 — `startedAt`/`finishedAt`).
- **상세**: `durationMs: Date.now() - callStartedAt` 계산 후 별도로 `finishedAt: toIso(Date.now())` 를 호출하면 두 `Date.now()` 사이 수 마이크로초 차이로 `finishedAt - startedAt > durationMs` 가 될 수 있어 timeline 재현 시 불일치. 영향은 미미하지만 `toIso` 변환에 재사용할 단일 캡처 (`const finishedAtMs = Date.now()`) 로 정리 가능.
- **제안**: `const finishedAtMs = Date.now()` 로 단일 캡처 후 `durationMs: finishedAtMs - callStartedAt` / `finishedAt: toIso(finishedAtMs)` 로 교체. 4개 site 동일 적용.

---

### 4. **[INFO]** 코드 주석의 spec 섹션 참조 표기 불완전 — `§3.f-g` vs `§6.1.f-g`

- **target 위치**: `ai-turn-executor.ts` L1387 주석 `spec §3.f-g`
- **위반 규약**: 직접 위반하는 정식 규약 없음. 명명 규약보다는 유지보수성 문제.
- **상세**: `spec/4-nodes/3-ai/1-ai-agent.md` 의 관련 항목은 §6.1 step f, g (KB·MCP 병렬 실행 / maxToolCalls budget 합산). `§3.f-g` 는 단독으로는 어느 spec 파일 어느 섹션인지 모호하다.
- **제안**: `spec §6.1.f-g (spec/4-nodes/3-ai/1-ai-agent.md)` 또는 단순히 `spec 4-nodes/3-ai/1-ai-agent.md §6.1.f-g` 로 명확화.

---

## 요약

정식 규약 준수 관점에서 가장 중대한 문제는 `processMultiTurnMessage` 내 condition deferral `toolCallCount++` 다. `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 은 `meta.toolCalls` 를 "KB·MCP·일반 도구 합산, 조건 도구 제외" 로 명시하고 있으며, single-turn 구현은 이를 준수하지만 multi-turn resume 경로는 위반한다. 이는 채택 시 단일 spec 의 invariant 가 모드별로 달리 동작하는 CRITICAL 위반이다. 나머지 발견사항(상수 미추출·Date.now 이중호출·주석 참조 불완전)은 정식 규약의 직접 위반이 아닌 INFO 수준 개선 제안이다. spec 자체는 변경이 불요하며 구현을 기존 spec 에 맞추는 버그픽스로 완결된다.

## 위험도

CRITICAL
