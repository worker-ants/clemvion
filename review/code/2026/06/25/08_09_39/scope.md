# 변경 범위(Scope) 리뷰

## 발견사항

### 발견사항 없음 — 모든 변경이 의도된 범위 내

커밋 메시지(`fix(ai-agent): W7 SPEC-DRIFT — multi-turn condition 도구 meta.toolCalls 미합산 통일`)가 명시한 변경 목적은 다음 세 가지다:

1. 핵심 버그픽스: `recordMultiTurnNonProviderToolResults` 에서 condition deferral 에 `toolCallCount++` 를 제거해 spec §7.1 준수.
2. 동봉 cleanup (impl-prep INFO 항목): 상수 추출(`TOOL_BUDGET_EXCEEDED_ERROR`), `Date.now()` 이중 호출 단일 캡처, JSDoc 경로 갱신.
3. 테스트 추가: `processMultiTurnMessage` describe 블록에 multi-turn condition no-count 케이스 신규 추가.

각 변경 항목을 점검 관점에 따라 평가한다.

#### [INFO] 상수 추출 (`TOOL_BUDGET_EXCEEDED_ERROR`)
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 인라인 `'tool_call_budget_exceeded'` → 상수
- 상세: `executeProviderToolBatch` 내 인라인 문자열을 이미 선언된 상수 블록으로 이동. 커밋 메시지의 "동봉 cleanup (impl-prep INFO)" 에 명시된 항목이며 JSDoc도 추가됨. 신규 동작 변경은 없고 표현 통일에 해당.
- 판정: 의도된 범위 내. impl-prep 단계에서 BLOCK 해소 목적으로 식별된 항목.

#### [INFO] `Date.now()` 단일 캡처 (single-turn / multi-turn condition-route 각 1회)
- 위치: `handleSingleTurnConditionRoute` + multi-turn condition-route 내 `condRouteDurationMs` 변수 추가
- 상세: 동일 타임스탬프를 두 곳에서 `Date.now()` 재호출하던 것을 변수로 캡처. 커밋 메시지 "review INFO-3" 에 명시. 기능 변경 없음 — 이론적으로 미세한 시각 불일치를 제거하는 정합성 개선.
- 판정: 의도된 범위 내. 관련 코드 경로에 대한 최소한의 수정.

#### [INFO] JSDoc 경로/설명 갱신
- 위치: `recordSingleTurnNonProviderToolResults` JSDoc, `recordMultiTurnNonProviderToolResults` JSDoc, 인라인 주석 여러 행
- 상세: `§3.f-g` → `spec §7.1 / §6.1.f-g` 전체 경로 표기, multi-turn 과 single-turn 이 "의도적으로 다름" → "동일 정책" 으로 설명 갱신. 이는 핵심 버그픽스(`toolCallCount++` 제거)와 정합하는 문서 갱신이므로 코드 변경과 일체로 처리해야 한다.
- 판정: 의도된 범위 내. 버그픽스 후 올바른 동작을 기술하는 주석 갱신은 필수적.

#### [INFO] [SPEC-DRIFT] 주석 제거
- 위치: `recordMultiTurnNonProviderToolResults` 내부 `for (const tc of conditionToolCalls)` 블록
- 상세: 이전 `[SPEC-DRIFT]` 마커와 함께 "behavior-preserving 분해에서 보존했다. 합산/spec 정정 결정은 planner 위임 (백로그)" 를 기술하던 5줄 주석이 제거되고, 수정된 동작을 기술하는 주석으로 교체됨. 버그 제거 후 해당 주석은 더 이상 유효하지 않으므로 삭제가 맞다.
- 판정: 의도된 범위 내.

#### [INFO] 테스트 추가
- 위치: `ai-turn-executor.spec.ts` 내 `processMultiTurnMessage (resume loop)` describe 블록
- 상세: `does not count condition tools toward toolCalls in multi-turn, only normal tools` 케이스 1건 추가. 해당 케이스는 핵심 버그픽스 직접 검증 목적이며, diff 에 나타난 추가 내용이 spec에 명시된 신규 테스트 케이스(478)와 일치.
- 판정: 의도된 범위 내.

## 요약

이번 커밋은 multi-turn condition 도구의 `toolCallCount` 미합산 버그픽스를 핵심으로, 커밋 메시지에 명시된 세 가지 impl-prep cleanup(상수 추출·타임스탬프 단일 캡처·JSDoc 경로 갱신)과 검증 테스트 추가를 동봉한다. 모든 변경 항목이 커밋 메시지 및 구현 목적과 1:1 대응하며, 무관한 파일·기능·리팩토링은 포함되지 않았다. 포맷팅 전용 변경이나 불필요한 임포트 변경도 관찰되지 않았다.

## 위험도

NONE
