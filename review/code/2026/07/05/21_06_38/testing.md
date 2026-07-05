# 테스트 리뷰 — use-result-detail-waiting 훅 추출 (V-05 후속)

대상: `codebase/frontend/src/components/editor/run-results/use-result-detail-waiting.ts` (신규) +
`codebase/frontend/src/components/editor/run-results/__tests__/use-result-detail-waiting.test.ts` (신규, 5 cases) +
`codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` (REGISTRY_SITES 갱신) +
회귀: `execution-detail-waiting.test.tsx`, `result-detail.test.tsx`.

실행 확인: 4개 파일 48 tests all pass (로컬 재현, `npx vitest run` 결과).

## 발견사항

- **[INFO]** `deriveFlags`의 4개 enum 값 각각을 개별 `it`로 커버하나, 상호 배타성(mutual exclusivity)을 한 곳에서 명시적으로 단언하는 테스트는 없음
  - 위치: `use-result-detail-waiting.test.ts:112-147`
  - 상세: 각 케이스가 `waitingInteractionType`을 하나씩 설정하고 해당 플래그만 확인한다 (예: `buttons` 케이스는 `isWaitingButtons`/`isWaitingForm`만 확인, `isWaitingConversation`은 미확인). `form` 케이스만 3개 필드를 모두 `toEqual`로 단언해 완전하다. `ai_conversation`/`ai_form_render`/`buttons` 케이스는 부분 단언이라, 예를 들어 `isWaitingButtons=true`일 때 `isWaitingConversation`이 실수로 `true`가 되는 회귀(로직 오류로 OR 조건이 잘못 확장되는 경우)를 못 잡을 여지가 이론상 존재한다.
  - 제안: 나머지 3개 케이스도 `toEqual`로 3필드 전체를 단언하도록 통일하면 회귀 방지력이 더 촘촘해진다. (다만 CRITICAL은 아님 — 현재 구현이 단순 boolean 식이라 실질 위험은 낮음.)

- **[INFO]** `waitingInteractionType`이 `null`(초기 상태)일 때 `deriveFlags(true)`의 동작이 테스트되지 않음
  - 위치: `use-result-detail-waiting.test.ts:101-110` (첫 케이스는 `deriveFlags`가 함수임만 확인, 호출/반환값은 검증 안 함)
  - 상세: store 초기값은 `waitingInteractionType: null`이다(execution-store.ts:508). `isSelectedWaiting=true`인데 아직 interactionType이 도착하지 않은 순간(레이스 윈도우)에 세 플래그가 모두 false로 안전하게 떨어지는지 확인하는 케이스가 없다. enum 4값 + null(비대기) 조합까지가 실질적인 "5-state exhaustiveness"인데, null 케이스가 비어 있다.
  - 제안: `it("waitingInteractionType=null(미대기) → 전부 false")` 케이스 1개 추가 권장. 우선순위 낮음(로직상 `=== "form"` 등은 null과 자동으로 false가 되므로 실패 가능성은 낮으나, 명시적 회귀 가드로서 가치 있음).

- **[INFO]** 훅이 반환하는 selector 값들(`waitingButtonConfig`, `waitingConversationConfig`, `conversationMessages`, `isWaitingAiResponse`, `pendingFormToolCallId`) 중 `waitingFormConfig`(null 확인 1개)만 실제 값 검증되고 나머지는 미검증
  - 위치: `use-result-detail-waiting.test.ts:101-110`
  - 상세: 훅의 반환 shape 테스트("반환한다" 케이스)는 4개 resume 콜백이 함수 타입인지와 `waitingFormConfig`가 초기 null인지만 확인한다. `pendingFormToolCallId`(selector 파생값, `selectPendingFormToolCallId`를 통해 별도 로직으로 계산됨)의 초기값·비-null 케이스, `conversationMessages`/`isWaitingAiResponse` 등은 이 훅 테스트에서 전혀 다뤄지지 않는다.
  - 상세 보완: 이 부분은 `execution-store`의 selector 자체 로직(예: `selectPendingFormToolCallId`)에 대한 기존 store 테스트가 별도로 존재한다면 중복 커버는 불필요할 수 있음 — 다만 "훅이 store 값을 올바르게 pass-through 하는지"(단순 재노출이지만 selector 이름 오탈자·잘못된 필드 매핑 같은 실수)는 이 훅 테스트 레벨에서만 잡히는 회귀 유형이다. 현재는 `waitingFormConfig` 1개 필드로만 이 계약을 대표 검증한다.
  - 제안: 최소 `pendingFormToolCallId`(대표적으로 파생 로직이 섞인 값) 1개 케이스만이라도 `useExecutionStore.setState`로 `ai_form_render` + `pendingFormToolCall` 세팅 후 값이 훅을 통해 정확히 전달되는지 확인하면 pass-through 배선 실수를 잡을 수 있다. CRITICAL은 아님 — 단순 재노출이라 실수 여지가 작고, 이미 `page.tsx`/`drawer.tsx` 통합 레벨 회귀 테스트(`execution-detail-waiting.test.tsx`, `result-detail.test.tsx`)가 실제 렌더링 경로로 이 값들의 최종 소비를 간접 커버한다.

- **[INFO]** exhaustiveness 가드(`REGISTRY_SITES`)는 grep 기반이라 "새 enum 값 추가 시 `deriveFlags`가 실제로 그 값을 처리하는지"까지는 보장하지 않고 "문자열이 파일에 등장하는지"만 확인
  - 위치: `interaction-type-exhaustiveness.test.ts:64-87`
  - 상세: 가드 방식 자체는 이번 변경 이전과 동일한 한계(파일 목록만 갱신)이며 회귀는 아니다. `ENUM_VALUES`에 신규 값(예: `"custom_widget"`)이 추가되면, `use-result-detail-waiting.ts` 어딘가에 그 문자열이 등장하기만 하면 가드는 통과한다 — 예컨대 주석에만 추가해도 통과할 수 있다(현재도 동일한 근본 한계). `deriveFlags`가 실제로 그 값에 대해 `isWaitingXxx: true`가 되는 분기를 추가했는지는 별도로 `deriveFlags` 유닛 테스트가 해야 한다.
  - 상세 확인: 이번 훅 테스트(`use-result-detail-waiting.test.ts`)는 현재 4개 enum 값에 대해 1:1 케이스를 갖고 있어, **신규 5번째 값이 추가되고 `deriveFlags`에 분기가 반영되지 않으면** 새 케이스가 아직 작성되지 않은 한 이 유닛 테스트 자체는 실패하지 않는다(기존 4개 케이스는 여전히 통과). 즉 "신규 enum 값에 대한 `deriveFlags` 처리 누락"을 잡는 것은 결국 (a) TS `assertNever`(현재 `deriveFlags`는 exhaustive switch가 아니라 `===` 체인이라 TS 컴파일러 가드가 없음) 또는 (b) `REGISTRY_SITES` grep(값이 파일에 존재하는지만 확인) 둘 다 근본적으로 이 특정 실수(분기 로직 누락, 문자열은 어딘가 등장)를 놓칠 수 있다.
  - 제안: `deriveFlags`가 `if/else` + fallback `false`(암묵적 default) 구조라 TS exhaustive-switch 가드의 이점을 못 받는다. 우선순위는 낮지만, 새 enum 값 추가 시 회귀를 완전히 막으려면 `deriveFlags` 안에 `switch`+`assertNever` 스타일로 재작성하는 것을 고려할 수 있다(다만 3-way OR 브랜치라 switch로 표현하기 부자연스러워 현재 방식이 실용적 트레이드오프로 보임 — CRITICAL로 격상하지 않음).

## 회귀·마이그레이션 정합성 확인 (문제 없음, 참고용)

- `run-results-drawer.tsx`/`executions/[executionId]/page.tsx`에 `waitingInteractionType === "form"|"buttons"` 리터럴이 더 이상 존재하지 않음을 grep으로 확인 — `REGISTRY_SITES`에서 두 파일을 제거하고 `use-result-detail-waiting.ts`를 추가한 것이 실제 코드 배선과 일치한다. drawer에 남은 `waitingInteractionType === "ai_conversation"/"ai_form_render"` 2곳(`isLiveConversation` 계산용, run-results-drawer.tsx:282,314-315)은 스펙 주석(rule 3)이 명시한 대로 "2값 subset 소비처"이며 exhaustive 분기가 아니므로 grep 대상에서 빠진 것이 타당하다.
- `execution-detail-waiting.test.tsx`(9 cases, 실제 `page.tsx`를 렌더링하는 통합 테스트)가 `deriveFlags`를 거쳐 나온 `isWaitingForm`/`isWaitingButtons`/`isWaitingConversation`이 실제 UI(폼 제출, 버튼 클릭, 대화 종료)에 올바르게 반영됨을 간접 검증한다 — 이 훅으로의 리팩터가 실사용 경로에서 깨지지 않았음을 뒷받침하는 강한 회귀 신호.
- `result-detail.test.tsx`는 `ResultDetail` 컴포넌트에 boolean prop을 직접 주입하는 컴포넌트 테스트라 이번 훅 변경과 무관하게 유효 — dead/misdirected 테스트 아님.
- 5개 신규 케이스 모두 `beforeEach`에서 `useExecutionStore.getState().reset()`으로 격리되어 있어 테스트 간 상태 누수 없음. `renderHook` + `setState` 패턴도 표준적이고 가독성 양호.
- `isSelectedWaiting` 게이팅(`deriveFlags(false)` → 전부 false)은 `form` 케이스에서만 명시적으로 테스트됨(라인 121-125). buttons/ai_conversation/ai_form_render 케이스에서는 게이팅 자체를 재검증하지 않으나, 로직이 동일한 `isSelectedWaiting &&` 접두 패턴을 공유하므로 중복 방지 차원의 합리적 생략으로 보인다(CRITICAL 아님).

## 요약

새 훅 `use-result-detail-waiting`의 유닛 테스트는 4개 enum 값 전부와 `ai_form_render`→`isWaitingConversation` 흡수라는 스펙 뉘앙스, 그리고 `isSelectedWaiting=false` 게이팅을 최소 1회 명시적으로 검증하고 있어 리팩터의 핵심 계약을 잘 지킨다. exhaustiveness 가드(`REGISTRY_SITES`)의 파일 교체는 실제 코드 배선(drawer/page에서 리터럴 제거, 훅에 집중)과 정확히 일치하며, 살아남은 drawer의 `isLiveConversation`(2값 subset)을 grep 대상에서 제외한 근거도 타당하다. 다만 buttons/ai_conversation/ai_form_render 케이스가 3필드 전체가 아닌 일부만 단언하는 점, `waitingInteractionType=null` 초기 상태 케이스 부재, 그리고 훅이 재노출하는 나머지 selector 값(`pendingFormToolCallId` 등)의 pass-through 검증이 `waitingFormConfig` 1개로만 대표되는 점은 모두 INFO 수준의 사소한 커버리지 갭이며, 통합 레벨 회귀 테스트(`execution-detail-waiting.test.tsx`)가 실사용 경로를 통해 이를 상당 부분 상쇄한다. CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

LOW
