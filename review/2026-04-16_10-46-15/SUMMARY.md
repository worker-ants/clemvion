# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - `isLiveNode` 조건 과도한 범위 확장 및 `isCompletedConversation` fallback 오분류 위험이 복수 리뷰어에서 공통 지적됨. Critical 이슈는 없으나 비대화형 노드의 대화 UI 오렌더링 가능성이 존재함.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 로직 / 범위 | `isLiveNode`에서 `nodeType === "ai_agent"` 가드 제거로 `waiting_for_input` 상태의 **모든 노드**(`form`, `carousel` 등)가 라이브 대화 노드로 처리됨. 비대화형 노드에 빈 대화 UI가 렌더링될 수 있음 | `result-timeline.tsx` — `isLiveNode` 계산부 | `isMultiTurnConversation(result)` 조건을 AND로 추가: `ctx.isLiveConversation && result.status === "waiting_for_input" && isMultiTurnConversation(result)` |
| 2 | 로직 / 범위 | `isCompletedConversation`의 마지막 fallback 조건 `rawOut?.messages != null`이 과도하게 넓어, `messages` 키를 포함하는 임의의 비대화 노드(HTTP 응답 등)가 ConversationInspector로 렌더링될 수 있음 | `result-detail.tsx` — `isCompletedConversation` 계산부 | fallback 조건 제거 또는 `interactionType === "ai_conversation"` 조건과 결합. `Array.isArray(messages)` 추가 검증 권장 |
| 3 | 아키텍처 / 유지보수 | `isMultiTurnConversation`(timeline)과 `isCompletedConversation`(detail) 두 곳에 대화형 출력 탐지 로직이 미묘하게 다른 형태로 중복 구현됨. 향후 포맷 변경 시 두 곳을 동시에 수정해야 함 | `result-timeline.tsx:62–83`, `result-detail.tsx:322–350` | `output-shape.ts` 또는 `conversation-utils.ts`에 `isConversationOutput(outputData): boolean` 순수 함수로 단일화 |
| 4 | 아키텍처 / 유지보수 | `rawOut`, `innerOutput`, `innerMeta` 언래핑 로직이 컴포넌트 본문에 인라인으로 재구현됨. 이미 `unwrapNodeOutput()`이 존재하므로 SRP 위반 | `result-detail.tsx:320–342` | `unwrapNodeOutput()` 반환값을 활용하거나 `isConversationOutput` 판단을 `output-shape.ts`로 이전 |
| 5 | 테스트 | `"shows expandable conversation for multi-turn information extractor"` 테스트가 `container.querySelectorAll("svg").length > 0`으로 검증해 `StatusIcon` 등 다른 SVG도 포함되어 실질적으로 chevron 렌더를 검증하지 못함 | `result-timeline.test.tsx:108–116` | chevron 요소에 `data-testid` 또는 `aria-label` 부여, 또는 클릭 후 메시지 노출(`fireEvent.click` + `screen.getByText(...)`) 검증으로 대체 |
| 6 | 테스트 | `"renders conversation inspector for completed multi-turn information extractor"` 테스트가 탭 부재만 확인하고 ConversationInspector 실제 렌더 여부를 검증하지 않아 회귀 감지력이 낮음 | `result-detail.test.tsx:255–286` | `screen.getByText("My name is Alice")` 등 실제 메시지 내용에 대한 포지티브 단언 추가 |
| 7 | 테스트 | `isMultiTurnConversation` 함수의 `conversationConfig` 탐지 경로가 어떤 테스트에서도 커버되지 않음 | `result-timeline.tsx:68–83` | `conversationConfig` 경로별 반환값 검증 케이스 추가 |
| 8 | 테스트 | `isLiveNode` 조건 완화에 대한 회귀 테스트 부재 — `waiting_for_input` + `nodeType: "form"` 조합에서 대화 UI가 렌더되지 않아야 함을 검증하는 테스트 없음 | `result-timeline.test.tsx` 전체 | `isLiveConversation=true` + `waiting_for_input` + `nodeType="form"` 케이스에서 chevron 미표시 검증 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `isCompletedConversation` 세 번째 조건(`rawOut?.messages != null`)의 오판정 경로가 미검증 — `messages` 키를 가진 비대화 출력이 의도적으로 처리되는지 명시 테스트 없음 | `result-detail.test.tsx` | `outputData: { messages: [...], statusCode: 200 }` 형태의 비대화 노드 케이스에 대한 명시적 테스트 추가 |
| 2 | 테스트 | wrapped 구조에서 `output.interactionType` 경로(`{ config, output: { interactionType: "ai_conversation" } }`)에 대한 테스트 없음 — 현재는 `meta.interactionType` 경로만 검증 | `result-detail.tsx:337–340` | `output` 레벨에 `interactionType`이 있는 wrapped 케이스 테스트 추가 |
| 3 | 문서화 | `isMultiTurnConversation` 함수에 legacy flat / new wrapper 두 형태를 처리하는 분기 로직이 있으나 JSDoc 없음 | `result-timeline.tsx` 함수 선언부 | `/** 노드 결과가 multi-turn 대화 출력인지 판별. legacy flat output과 새 { config, output } 래퍼 형식을 모두 지원. */` JSDoc 추가 |
| 4 | 문서화 | `isLiveNode` 및 `isCompletedConversation` 조건 변경 후 관련 인라인 주석 미업데이트 또는 부재 | `result-timeline.tsx` `isLiveNode` 정의부, `result-detail.tsx:340–347` | 각 조건이 어떤 데이터 형태를 처리하는지 간략한 주석 추가 |
| 5 | 테스트 | `screen.queryByRole("button", { name: "Input" })`과 `screen.queryByText("Input")` 혼용 — 일관성 없음 | `result-detail.test.tsx` | 다른 테스트와 동일하게 `screen.queryByText("Input")`으로 통일 |
| 6 | 보안 / 타입 | 테스트 fixture에 `"model": "gpt-4"` 실제 모델명 하드코딩 — 코드베이스에서 사용 모델 노출 | `result-detail.test.tsx:282, 303` | `"model": "test-model"` 등 중립적 값으로 교체 |
| 7 | 타입 안전성 | `as Record<string, unknown>` 캐스팅이 다수 사용되나 런타임 검증 없음. `?.` 옵셔널 체이닝으로 크래시는 방지하나 신뢰 경계 불명확 | `result-detail.tsx:322–343`, `result-timeline.tsx:67–75` | Zod 등 런타임 검증 또는 `unwrapNodeOutput` 유틸 일관 활용 |
| 8 | 아키텍처 | `isWrapped` 판별 시 `result-detail.tsx`는 `config`+`output` 키만 체크하나, `result-timeline.tsx`와 로직이 미묘하게 다름 | `result-detail.tsx` `isWrapped` 계산부 | 두 파일의 wrapped 판별 로직을 `output-shape.ts` 공통 유틸로 통일 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | `isLiveNode` 범위 확장, `rawOut.messages` fallback 과포함, 테스트 회귀 감지력 부족 |
| architecture | MEDIUM | 대화형 판별 로직 이원화, `unwrapNodeOutput` 미활용, `isLiveNode` 범위 확장 |
| side_effect | MEDIUM | `isMultiTurnConversation` 타입 가드 제거, `isLiveNode` 가드 제거, fallback 조건 과포함 |
| scope | MEDIUM | `isLiveNode` 노드 타입 가드 제거, `rawOut.messages` fallback 과포함 |
| maintainability | MEDIUM | 대화형 탐지 로직 이원화, `rawOut.messages` 조건 모호성, 언래핑 로직 SRP 위반 |
| testing | MEDIUM | SVG 단언 취약, `isLiveNode` 회귀 미검증, `rawOut.messages` 오판정 경로 미검증 |
| security | LOW | `rawOut.messages` 주입 가능성, `isLiveNode` 정보 노출 리스크, 타입 캐스팅 |
| documentation | LOW | 인라인 주석 불일치, JSDoc 부재 |
| performance | LOW | 언래핑 로직 중복 연산, `isMultiTurnConversation` 중복 호출, 불필요한 `parseHistoryMessages` 호출 |
| concurrency | LOW | `isLiveNode` 조건 확장으로 WebSocket 업데이트 시 일시적 오렌더링 가능성 |
| dependency | NONE | 신규 외부 의존성 없음, 내부 모듈 일관성 유지 |
| database | NONE | 해당 없음 (프론트엔드 전용 변경) |
| api_contract | NONE | 해당 없음 (API 계약 변경 없음) |

---

## 발견 없는 에이전트

- **database** — 프론트엔드 전용 변경으로 DB 관련 코드 없음
- **api_contract** — API 엔드포인트/스키마 변경 없음
- **dependency** — 신규 외부 패키지 없음, 내부 모듈 의존성 일관성 유지

---

## 권장 조치사항

1. **[필수] `isLiveNode` 조건 복원** — `isMultiTurnConversation(result)` 조건을 AND로 추가하여 `waiting_for_input` 상태의 비대화형 노드(`form`, `carousel` 등)에 대화 UI가 렌더링되지 않도록 방어
   ```ts
   const isLiveNode = ctx.isLiveConversation && result.status === "waiting_for_input" && isMultiTurnConversation(result);
   ```

2. **[필수] `isCompletedConversation` fallback 조건 정리** — `rawOut?.messages != null` 조건을 제거하거나 `interactionType` 체크와 결합하여 비대화 노드의 오분류 방지

3. **[필수] 테스트 보완** — (a) SVG 카운트 기반 단언을 `data-testid`/클릭 후 메시지 노출 검증으로 교체, (b) ConversationInspector 실제 렌더 포지티브 단언 추가, (c) `waiting_for_input` + `form` 타입 회귀 테스트 추가

4. **[권장] 대화형 출력 탐지 로직 단일화** — `output-shape.ts` 또는 `conversation-utils.ts`에 `isConversationOutput(outputData): boolean` 유틸 함수를 추출하고 `result-detail.tsx`와 `result-timeline.tsx` 양쪽에서 공유하도록 리팩터링

5. **[권장] `unwrapNodeOutput` 일관 활용** — `result-detail.tsx` 내 `isWrapped`/`innerOutput`/`innerMeta` 인라인 계산을 기존 `unwrapNodeOutput()` 유틸 활용으로 대체하여 SRP 준수

6. **[선택] 문서화 보완** — `isMultiTurnConversation` JSDoc 추가, `isLiveNode` 및 `isCompletedConversation` 조건 변경에 대한 인라인 주석 업데이트