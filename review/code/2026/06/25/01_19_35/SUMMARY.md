# Code Review 통합 보고서

**대상**: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`
**커밋**: `ff8c5d68` — refactor(ai-agent): 03 C-2 2차 — ai-turn-executor god-method §6.1/§6.2 정렬 분해
**리뷰 일시**: 2026-06-25 01:19:35

---

## 전체 위험도

**MEDIUM** — testing 리뷰어가 MEDIUM 판정. 추출된 private helper 의 핵심 의미론적 차이(single/multi-turn condition toolCallCount 비대칭, 토큰 누적 계산 이관, form bypass 경로)를 executor 단위에서 직접 고정하는 테스트가 없어 회귀 탐지력이 부족하다. 리팩터링 자체의 behavior-preserving 품질과 보안은 양호하다.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | TESTING | `recordSingleTurnNonProviderToolResults` — single-turn 조건 도구에서 `toolCallCount` 미증가 의미론을 직접 검증하는 단위 테스트 없음. multi-turn 은 증가, single-turn 은 미증가라는 "의도적 비대칭"이 JSDoc 에만 기술됨 | `ai-turn-executor.spec.ts` (부재) | `executeSingleTurn` 시나리오에서 조건 도구 미카운트 / 일반 도구 카운트 assertion 추가 |
| 2 | TESTING | `handleSingleTurnConditionRoute` / `handleMultiTurnConditionRoute` — executor 레벨에서 토큰 누적 계산이 올바른지 검증하는 테스트 없음. `finalInputTokens = totalInputTokens + result.usage?.inputTokens` 계산이 helper 내부로 이관됨 | `ai-turn-executor.spec.ts` (부재) | `processMultiTurnMessage` describe 에 condition route 토큰 누적 assertion 케이스 추가 |
| 3 | TESTING | `handleMultiTurnUserMessageEntry` — form bypass 분기(messages + state in-place 변이)를 executor 레벨에서 격리 검증하는 테스트 없음 | `ai-turn-executor.spec.ts` (부재) | `processMultiTurnMessage — form_bypass` describe 블록 추가: cancelled tool_result 삽입 + pendingFormToolCall 클리어 assertion |
| 4 | TESTING | `applyMultiTurnTurnMemory` — `keepUserExchanges=0` 분기 executor 레벨 단독 고정 없음. messages 배열 in-place 변이(`length=0; push(...)`) 패턴이 helper 로 이동해 caller 레퍼런스 보존 여부 미검증 | `ai-turn-executor.spec.ts` (부재) | memory spec 의 기존 압축 테스트 회귀 확인 후, executor spec 에 `compactedMessages` 설정 케이스 추가 |
| 5 | ARCHITECTURE | `handleSingleTurnConditionRoute` args 객체가 20개 파라미터를 포함해 ISP 경계 초과. `handleMultiTurnConditionRoute` 도 21개로 동일 | `ai-turn-executor.ts` — `handleSingleTurnConditionRoute` / `handleMultiTurnConditionRoute` 시그니처 | accumulator 군(`ragAcc`, `turnRagAcc`, `mcpDiagnosticsAcc`, `presentationPayloads`, `presentationCalls`, `presentationSchemaViolations`, `llmCalls`, `toolCallTraces`)을 `TurnOutputAccumulators` 인터페이스로 묶기. 기존 `RagAccumulatorGroup` 선례 활용 |
| 6 | ARCHITECTURE | `handleMultiTurnConditionRoute` vs `handleSingleTurnConditionRoute` 의 `toolCallCount` 처리 비대칭이 타입이 아닌 주석으로만 강제됨. 미래 수정자가 의도 모르고 동기화할 위험 | `recordSingleTurnNonProviderToolResults` JSDoc vs `recordMultiTurnNonProviderToolResults` 내부 | 단기: 두 메서드 상단에 `// INVARIANT:` 주석 추가. 장기: `ConditionCountPolicy: 'count' \| 'no-count'` 파라미터로 컴파일 시 강제 |
| 7 | SPEC-DRIFT | [SPEC-DRIFT] multi-turn condition deferral 시 `toolCallCount++` 수행 — spec §7.1 `meta.toolCalls` "조건 도구 제외" 명세와 불일치. single-turn 은 미합산(spec 일치), multi-turn 은 합산(spec 불일치). pre-existing 동작이나 helper 추출로 표면화됨 | `recordMultiTurnNonProviderToolResults` — condition loop 내 `toolCallCount++` / `spec/4-nodes/3-ai/1-ai-agent.md §7.1` | 사람 판단 필요: (a) multi-turn 도 미합산으로 버그픽스, 또는 (b) spec §7 `meta.toolCalls` 설명을 "single-turn: 조건 제외 / multi-turn: deferral 포함"으로 갱신 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | ARCHITECTURE | `MultiTurnMemoryMeta` 타입이 파일 내 두 위치에 선언된 것으로 보임. tsc PASS 기재이므로 diff 컨텍스트 아티팩트 가능성 높으나 실 파일 확인 권장 | `ai-turn-executor.ts` ~L65-75 (신규) vs ~L1741-1755 (기존) | `grep "type MultiTurnMemoryMeta"` 로 중복 확인 후 단일 위치로 정리 |
| 2 | MAINTAINABILITY | `recordSingleTurnNonProviderToolResults` / `recordMultiTurnNonProviderToolResults` 내 `condDeferralContent`, `budgetContent` JSON 문자열 리터럴이 두 메서드에서 동일하게 반복됨 | diff +114~+116, +536~+538 | `CONDITION_DEFERRAL_RESULT_MSG`, `TOOL_BUDGET_EXCEEDED_ERROR` 등 파일 레벨 상수로 추출 |
| 3 | MAINTAINABILITY | `handleSingleTurnConditionRoute` 와 `handleMultiTurnConditionRoute` 내 `Date.now() - singleTurnStartedAt` 이 동일 return 문 내 두 곳에서 독립 계산됨. 근소한 값 차이 발생 가능 | diff +281~+288 (single), multi-turn 동일 | `const totalDurationMs = Date.now() - singleTurnStartedAt;` 한 번 캡처 후 재사용 |
| 4 | MAINTAINABILITY | `applyMultiTurnTurnMemory` 의 `executionId: string | undefined` 파라미터 — caller 와 helper 양쪽에 fallback 로직 분산 가능성 | diff +788, +818 | caller 에서 `executionId ?? ''` 처리 후 `string` 으로 전달하거나 helper 파라미터를 `string` 으로 변경 |
| 5 | MAINTAINABILITY | single-turn JSDoc 에는 "multi-turn 과 의도적으로 다름" 명시, multi-turn JSDoc 에는 역방향 참조 없어 양방향 상호 참조 미완성 | `recordMultiTurnNonProviderToolResults` JSDoc | multi-turn JSDoc 에 "single-turn 은 condition 미합산(§3.f-g) 과 의도적으로 다름" 추가 |
| 6 | ARCHITECTURE | `applyMultiTurnTurnMemory` 가 `messages` 배열 in-place 변이와 `MultiTurnMemoryMeta` 반환의 이중 계약 구조. SRP 측면에서 후속 개선 대상 | `applyMultiTurnTurnMemory` | 불변 함수형 스타일 `(messages) => { newMessages, meta }` 로 변경(현 행동보존 범위 초과이므로 후속 PR) |
| 7 | SECURITY | `tc.arguments` 가 normalContent 에 그대로 직렬화됨 — pre-existing 패턴, 이번 변경으로 신규 도입 아님. 향후 실제 실행 결과로 교체 시 sanitization 누락 선례 가능성 | `recordSingleTurnNonProviderToolResults` / `recordMultiTurnNonProviderToolResults` | 해당 필드 제거 또는 별도 sanitizer 명시 권고 (중장기) |
| 8 | DOCUMENTATION | `handleSingleTurnConditionRoute` args 의 핵심 필드(`rawConfig`, `singleTurnStartedAt`)에 출처/의미 인라인 주석 부재 | `private handleSingleTurnConditionRoute` JSDoc | 핵심 필드에 출처 또는 nullable 이유 간단히 보충 |
| 9 | REQUIREMENT | `result.toolCalls ?? []` 방어 처리 추가 — 기존 undefined 전달 여지 제거, 안전성 개선 | `handleSingleTurnConditionRoute` + `handleMultiTurnConditionRoute` | 유지 (긍정적 변경) |
| 10 | TESTING | `executeSingleTurn` 의 condition-only 경로(Case 1) executor spec 단독 케이스 없음. 핸들러 통합 테스트로만 커버됨 | `ai-turn-executor.spec.ts` | executor 레벨에서 LLM 이 조건 도구만 호출 시 정상 포트 반환 검증 케이스 추가 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 보안 취약점 없음. 기존 sanitize 패턴 보존 확인 |
| architecture | LOW | 과대 파라미터 객체(20-21개), single/multi-turn condition 비대칭 타입 미강제, MultiTurnMemoryMeta 중복 |
| requirement | LOW | multi-turn condition toolCallCount 합산이 spec §7 "조건 도구 제외"와 불일치 (pre-existing, SPEC-DRIFT) |
| scope | LOW | 변경 범위 선언 작업 내. MultiTurnMemoryMeta 중복 확인 권장 |
| side_effect | LOW | 신규 부작용 없음. messages/state in-place 변이는 원본과 동일, JSDoc 명시 |
| maintainability | LOW | 파라미터 폭발(20개+), 문자열 상수화 미완료, Date.now() 이중 호출, 타입 중복 |
| testing | MEDIUM | 핵심 의미론적 차이(toolCallCount 비대칭, 토큰 누적 이관, form bypass) executor 레벨 고정 테스트 미비. WARNING 4건 |
| documentation | LOW | 전체 INFO 등급. MultiTurnMemoryMeta 중복 정리, 양방향 상호 참조 보완 권장 |

---

## 발견 없는 에이전트

없음 (모든 에이전트 발견사항 있음).

---

## 권장 조치사항

1. **[SPEC-DRIFT 판단 필요]** `recordMultiTurnNonProviderToolResults` 내 condition deferral `toolCallCount++` 가 spec §7.1 "조건 도구 제외"와 불일치. 의도된 설계인지 pre-existing 버그인지 판단 후, (a) 코드 fix(multi-turn 도 미합산) 또는 (b) spec §7 설명 갱신 중 하나 선택. (`spec/4-nodes/3-ai/1-ai-agent.md §7.1`)

2. **[WARNING — Testing]** `ai-turn-executor.spec.ts` 에 executor 레벨 단위 테스트 3건 추가:
   - single-turn 조건 도구 `toolCallCount` 미증가 assertion
   - multi-turn condition route 토큰 누적 계산 assertion
   - form bypass 분기 messages/state in-place 변이 assertion

3. **[WARNING — Architecture/Maintainability]** accumulator 군 8개(`ragAcc`, `turnRagAcc`, `mcpDiagnosticsAcc`, `presentationPayloads`, `presentationCalls`, `presentationSchemaViolations`, `llmCalls`, `toolCallTraces`)를 `TurnOutputAccumulators` 인터페이스로 묶어 `handleSingleTurnConditionRoute` / `handleMultiTurnConditionRoute` 파라미터 수를 20개→12개 수준으로 축소.

4. **[INFO — Maintainability]** `Date.now() - singleTurnStartedAt` 이중 호출을 `const totalDurationMs`로 한 번 캡처. `CONDITION_DEFERRAL_RESULT_MSG` / `TOOL_BUDGET_EXCEEDED_ERROR` 상수 추출.

5. **[INFO — Architecture]** `MultiTurnMemoryMeta` 타입 중복 선언 여부 실 파일에서 확인 (`grep "type MultiTurnMemoryMeta"`) 후 중복 제거.

6. **[INFO — Documentation]** `recordMultiTurnNonProviderToolResults` JSDoc 에 "single-turn 은 condition 미합산(§3.f-g)과 의도적으로 다름" 역방향 참조 추가. single/multi-turn 양방향 주석 완성.

---

## 라우터 결정

라우터가 선별 실행 (`routing_status=done`).

- **실행** (8명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`
- **강제 포함(router_safety)** (6명): `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (6명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |