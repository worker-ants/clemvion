# Rationale 연속성 검토 결과

검토 범위: 03-maintainability C-2 2차(최종) — `ai-turn-executor.ts` god-method 분해 (processMultiTurnMessage·executeSingleTurn → 6개 private 메서드 + TurnOutputAccumulators 번들)

## 발견사항

- **[WARNING]** multi-turn condition deferral 의 toolCallCount 합산 — [SPEC-DRIFT] 명시 보존이지만 신규 Rationale 부재
  - target 위치: `recordMultiTurnNonProviderToolResults` JSDoc 및 내부 주석 (INVARIANT 블록)
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §7.1` 표 `meta.toolCalls` 행 — "KB·MCP·일반 도구 호출 횟수 합산 **(조건 도구 제외)**"
  - 상세: spec §7.1 은 모드 구분 없이 `meta.toolCalls` 에서 조건 도구를 제외한다고 명시한다. 구현은 single-turn 에서는 spec 과 일치하나 (`recordSingleTurnNonProviderToolResults` 는 condition deferral 을 미합산), multi-turn 에서는 condition deferral 에도 `toolCallCount++` 를 수행한다 (`recordMultiTurnNonProviderToolResults`). 이 비대칭은 리팩터 이전부터 존재한 동작(pre-existing behavior)이며, target 코드는 이를 `[SPEC-DRIFT] … 본 리팩터 이전부터의 동작으로 behavior-preserving 분해에서 보존했다. 합산/spec 정정 결정은 planner 위임 (백로그)` 으로 명시 주석 처리했다. 번복 의도가 명확하나, 해당 주석은 코드 레벨에만 존재하고 spec `## Rationale` 에 대응하는 갱신 항목이 없다. 즉, "왜 multi-turn 에서만 합산하는가 / 이것이 의도된 spec 편차인가 아니면 버그인가" 에 대한 공식 결정 근거가 spec 에 기록되지 않아 Rationale 연속성 관점에서 추적 가능성이 부족하다.
  - 제안: spec `§7.1` 의 `meta.toolCalls` 설명 또는 `## Rationale` 에 "multi-turn condition deferral 이 pre-existing 으로 합산되는 이유 / [SPEC-DRIFT] 해소 방향 백로그" 항을 추가하거나, 플래너가 spec §7.1 을 모드별로 분리하는 개정을 plan 항목으로 정식 등록하는 것이 권장된다. 현재 코드 주석이 대리 역할을 하고 있으나 spec 단일 진실 원칙과 어긋난다.

- **[INFO]** `TurnOutputAccumulators` 인터페이스 도입 — spec ISP 경계 완화 판단 근거가 코드에만 존재
  - target 위치: `TurnOutputAccumulators` 인터페이스 정의 JSDoc
  - 과거 결정 출처: 해당 인터페이스 도입 자체는 spec 에 직접 대응하는 결정이 없음 (내부 리팩터 산물)
  - 상세: 인터페이스 신설은 spec 과 직접 충돌하지 않는다. 코드 리뷰 W5 에서 "ISP 경계 완화" 라는 설계 판단 근거가 JSDoc 에만 기재되어 있다. spec 에 기각된 대안을 재도입한 흔적 없음.
  - 제안: 이 내부 구현 판단은 코드 JSDoc 수준으로 충분하다 (spec Rationale 신설 불필요). 리뷰 RESOLUTION 문서에 "W5 — ISP 완화 승인, TurnOutputAccumulators 채택" 을 명시해 두는 것으로 충분.

- **[INFO]** `MultiTurnMemoryMeta` type 추출 — spec 필드 shape 과 완전 정합
  - target 위치: `MultiTurnMemoryMeta` 타입 정의
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §7.1/§7.4` `meta.memory` shape — `{ strategy, summarized, recalledCount, tokenBudgetUsed, compactedMessages? }`
  - 상세: 추출된 타입은 spec 의 `meta.memory` 필드 shape 와 완전히 일치. spec 에서 기각된 대안(예: `remainingBudget`, `compressionRatio` 추가)을 재도입한 흔적 없음.
  - 제안: 해당 없음.

- **[INFO]** `handleMultiTurnUserMessageEntry` 분리 — spec §6.2 step 2.c 순서 불변식 보존 확인
  - target 위치: `handleMultiTurnUserMessageEntry` JSDoc 및 `processMultiTurnMessage` 호출 위치
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c` — "ai_user thread push 는 LLM 호출보다 앞서 일어난다"
  - 상세: 메서드 추출 이후에도 caller 에서 LLM 호출 이전에 호출하며, JSDoc 에 순서 불변식을 명기하여 spec invariant 가 보존됨.
  - 제안: 해당 없음.

## 요약

이번 C-2 2차 리팩터는 spec §6.1/§6.2 플로우를 private 메서드 6개로 behavior-preserving 분해하는 작업이다. 기각된 대안의 재도입이나 합의된 invariant 위반은 발견되지 않는다. 단 하나의 실질적 관심사는 multi-turn condition deferral 의 `toolCallCount` 합산 문제(W7 [SPEC-DRIFT])로, pre-existing 동작을 의도적으로 보존한 것이며 코드에 명시 주석이 달려 있다. 그러나 spec §7.1 의 "조건 도구 제외" 명세와의 불일치가 spec `## Rationale` 에 공식 기록되지 않은 채 코드 주석에만 남아 있다는 점은 WARNING 수준이다. 플래너 위임(백로그)이 명시되어 있으므로 차단 요인은 아니나, 해당 SPEC-DRIFT 를 plan 항목으로 정식 등록하는 것이 권장된다.

## 위험도

LOW
