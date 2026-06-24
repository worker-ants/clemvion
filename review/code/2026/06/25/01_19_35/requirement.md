# 요구사항(Requirement) Review

**대상 파일**: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`
**커밋**: `ff8c5d68` — refactor(ai-agent): 03 C-2 2차 — ai-turn-executor god-method §6.1/§6.2 정렬 분해

---

## 발견사항

### [WARNING] [SPEC-DRIFT] multi-turn condition tool deferral 이 toolCallCount 합산 대상 — spec §7 `meta.toolCalls` 정의 (pre-existing)

- **위치**: `recordMultiTurnNonProviderToolResults` (새 helper 메서드) — condition loop 내 `toolCallCount++`
- **상세**: spec §7.1 출력 표 `meta.toolCalls` 항목은 "KB·MCP·일반 도구 호출 횟수 합산 **(조건 도구 제외)**"로 명시한다. multi-turn 의 `recordMultiTurnNonProviderToolResults` 는 condition deferral 시 `toolCallCount++` 를 수행해 spec 정의와 어긋난다. 반면 single-turn 의 `recordSingleTurnNonProviderToolResults` 는 condition tool 에 대해 카운트를 증가시키지 않아 spec 과 일치한다. 두 메서드의 JSDoc 은 이 차이를 "§3.f-g — multi-turn 과 의도적으로 다름" 으로 기술하나, spec §3.f-g (§6.1 단계 3.f/3.g) 는 condition tool 카운팅에 대해 침묵하며 spec §7 `meta.toolCalls`의 "조건 도구 제외" 명세가 권위다.

  - **이 commit 이 도입했는가?**: 아니다. 전 커밋(e2980a1b)에서 동일 multi-turn loop 의 동일 위치(line 2260)에 `toolCallCount++` 가 이미 존재한다. 본 리팩터는 해당 동작을 그대로 helper 로 추출했을 뿐이다 (behavior-preserving). 단 helper 추출로 JSDoc 에 명시("condition: deferral content + toolCallCount++")되어 표면화됐다.
  - **SPEC-DRIFT 판단**: 코드의 multi-turn condition 합산은 pre-existing 동작으로, 의도적으로 유지된 것인지 아니면 spec 위반 버그인지 불명확하다. spec §7 "조건 도구 제외"가 권위라면 multi-turn 도 미합산이 옳다(버그픽스 대상). 만약 multi-turn 의 condition deferral 이 합산 대상인 것이 설계 의도라면 spec §7 `meta.toolCalls` 설명을 "single-turn: 조건 도구 제외 / multi-turn: 조건 deferral 포함" 으로 갱신해야 한다.
  - **판단 방향**: 모호하므로 `[SPEC-DRIFT]` 단독이 아닌 WARNING 으로 분류. 사람이 판단.
  - **영향 spec 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §7.1 출력표 — meta.toolCalls 행`

---

### [INFO] `result.toolCalls ?? []` 방어 처리 — 안전성 개선

- **위치**: `handleSingleTurnConditionRoute` + `handleMultiTurnConditionRoute`
- **상세**: 기존 인라인 코드는 `extractConditionReason(result.toolCalls, ...)` 로 undefined 가 넘어갈 여지가 있었다. 새 helper 는 `result.toolCalls ?? []` 로 방어 처리한다. `extractConditionReason` 시그니처는 `ToolCall[]`(non-optional)이므로 이 변경은 안전성 개선이다. spec 침묵 영역.

---

### [INFO] `applyMultiTurnTurnMemory` in-place mutation + memoryMeta 반환값 soundness

- **위치**: `applyMultiTurnTurnMemory` 메서드
- **상세**: `messages.length = 0; messages.push(...mem.messages)` 로 배열 in-place 변이 후 `memoryMeta` 반환. caller 는 반환값을 `memoryMeta` 에 할당하고 이후 LLM 호출에 `messages` 를 참조한다. 기존 인라인 동작과 동일하며 spec §6.2 d.5/d.6 이 요구하는 "system 메시지 갱신 + 누적 압축" 불변식을 충족한다.

---

### [INFO] `handleMultiTurnConditionRoute` 토큰 로컬 합산 후 early return — soundness 확인

- **위치**: `handleMultiTurnConditionRoute` 내 `finalInputTokens` 등 계산
- **상세**: caller 가 전달하는 `totalInputTokens` 등 누적값에 현재 turn 의 usage 를 더해 local final 값을 계산하고 `buildConditionOutput` 에 넘긴다. caller 는 `return this.handleMultiTurnConditionRoute(...)` (early return) 이므로 caller-scope 누적 변수를 이후 참조하지 않는다. 누적 불변식 보존됨. spec §6.2 f 정합.

---

### [INFO] `handleMultiTurnUserMessageEntry` — form bypass / form submitted / fallback 세 경로 완전성

- **위치**: `handleMultiTurnUserMessageEntry` 메서드
- **상세**: spec §6.2 step 2.c / 2.c.bypass / c.fallback 의 세 분기가 모두 커버된다. `ai_user` thread push 는 LLM 호출보다 앞서 발생(spec §6.2.c + conversation-thread §1.4 순서 불변식). `messages` 와 `state.pendingFormToolCall` in-place 변이는 JSDoc 에 명시됨.

---

## 요약

이번 커밋은 `processMultiTurnMessage`와 `executeSingleTurn`의 god-method 를 6개 private helper 로 behavior-preserving 분해한다. 기능 완전성·엣지케이스·에러 경로·반환값 측면에서 모든 로직이 올바르게 추출됐다. 주요 발견사항은 하나의 WARNING: multi-turn condition deferral 이 `toolCallCount` 에 합산되는 동작이 spec §7 `meta.toolCalls` "조건 도구 제외" 명세와 어긋난다. 이 동작은 본 커밋 이전부터 존재했으며 refactor 가 도입한 것이 아니나, helper 추출로 표면화됐다. single-turn 과 multi-turn 의 의도적 차이인지 pre-existing 버그인지는 사람이 판단해야 하며, 판단 결과에 따라 multi-turn 버그픽스 또는 spec §7 설명 갱신이 필요하다. 리팩터 자체의 기능 충족도는 높다.

## 위험도

LOW
