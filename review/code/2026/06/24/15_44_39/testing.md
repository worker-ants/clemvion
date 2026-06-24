# Testing 리뷰 결과

## 발견사항

### [INFO] `dispatchParkEntry` 메서드 자체에 대한 unit 테스트 없음
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `dispatchParkEntry` private method (line ~198–211)
- 상세: `buildParkEntryRegistry` factory 는 `park-entry-dispatch.spec.ts` 에서 7개 unit 으로 완전히 커버된다. 그러나 `dispatchParkEntry` 메서드 자체 — `getMetadata` + `getInteractionType` 로 `ParkEntrySelector` 를 조립한 후 registry 에 위임하는 로직 — 는 service spec 에서 직접 검증되지 않는다. 현재는 e2e 및 integration 테스트(`execution-engine.service.spec.ts` 내 `runNodeDispatchLoop` W4 시나리오, e2e 214개)가 간접 커버하므로 기능적 갭은 없다. 단, `blockingInteraction` 조합(metadata.kind !== 'blocking' 시 undefined 처리)이나 `getInteractionType` 반환값이 registry 에 올바르게 전달되는지를 격리 검증하는 경로는 없다.
- 제안: 허용 가능한 갭 — `dispatchParkEntry` 는 orchestration glue 코드이며 factory + e2e 가 행동을 커버한다. 다만 `getInteractionType` 이 `undefined` 를 반환하는 엣지 케이스(노드 메타 캐시 미스)에서 registry 가 `undefined` 를 fallthrough 하는 경로는 별도 unit 으로 고정 가능. 필수는 아님.

### [INFO] `deps` mock 이 `describe` 스코프 변수로 공유됨 — beforeEach 정리는 충분함
- 위치: `codebase/backend/src/modules/execution-engine/park-entry-dispatch.spec.ts` line 24–29
- 상세: `deps` 객체가 `describe` 블록 최상단에 선언되어 모든 `it` 이 공유한다. `jest.clearAllMocks()` 가 `beforeEach` 에 있어 호출 기록은 정리되나, `mockResolvedValue(undefined)` 초기화는 선언 시 단 1회만 설정된다. `handle delegates...` 테스트에서 `mockResolvedValueOnce(PARK_RELEASED)` 를 `deps.handleButtons` 에 직접 호출하는데, 이 호출이 `clearAllMocks` 이후 설정되므로 격리는 정상이다. 현재 구현에서는 문제없으나, 향후 `mockResolvedValue` 상태를 변경하는 테스트가 추가되면 순서 의존성이 생길 수 있다. `deps` 를 `beforeEach` 내에서 재생성하거나 `const deps = () => ({ ... })` 패턴으로 방어하면 더 명시적이다.
- 제안: 현재는 `clearAllMocks()` 가 충분하므로 INFO 수준. 향후 테스트 추가 시 주의.

### [INFO] `handle delegates` 테스트에서 form / ai_conversation 핸들러 위임 검증 없음
- 위치: `codebase/backend/src/modules/execution-engine/park-entry-dispatch.spec.ts` line 71–78
- 상세: `handle` 위임 테스트는 `buttons` 항목만 검증한다 (`handleButtons` 호출 + `PARK_RELEASED` 반환). `handleForm` 및 `handleAiConversation` 의 위임은 구현상 `handle: deps.handleX` 직접 할당이라 기능적으로 동일하지만, 테스트 의도("`handle` 이 주입된 `waitForX` 에 위임") 가 form 과 ai 에서도 명시적으로 고정되면 회귀 net 이 완전해진다. 현재 factory 코드가 단순 property 할당(`handle: deps.handleForm`)이라 런타임 동작은 buttons 검증으로 충분히 보증되나, 테스트 커버리지 가독성 면에서 갭이 보인다.
- 제안: `handleForm` 과 `handleAiConversation` 에 대한 동일 패턴의 handle-delegation it 블록 2개 추가. 필수는 아니나 완전성 향상.

### [INFO] `ai_form_render` 이외의 `WaitingInteractionType` 변종에 대한 명시적 falsy 검증 없음
- 위치: `codebase/backend/src/modules/execution-engine/park-entry-dispatch.spec.ts` line 54–60 및 80–86
- 상세: `ai_conversation` 항목이 `ai_form_render` 도 매칭함을 검증하지만, `WaitingInteractionType` 에 정의된 4개 값(form / buttons / ai_conversation / ai_form_render) 중 `form` 이 `interactionType: 'form'` 으로는 매칭되지 않는다는 점이 테스트 라인 44에서 검증된다. 그러나 `interactionType: 'ai_form_render'` 가 form/buttons registry 항목에서도 매칭되지 않는다는 negative 검증은 없다. `WaitingInteractionType` 에 5번째 값이 추가될 때 누락 탐지를 위한 exhaust 검증 패턴이 없다.
- 제안: `WaitingInteractionType` 값 추가 시 "unknown/blank interaction" 테스트 외에 exhaustive switch 유사 목록 테스트를 추가하거나 주석으로 의도를 명시. 현재 e2e 가 커버하므로 INFO.

## 요약

이번 변경의 테스트 전략은 명확하고 적절하다. 핵심 판단인 "순수 factory(`buildParkEntryRegistry`)는 unit으로, 서비스 통합(세 call site 의 PARK_RELEASED escape 분기 차이)은 기존 service spec + e2e로" 하는 계층 분리는 올바르다. 신규 `park-entry-dispatch.spec.ts` 7개 테스트는 registry 순서 계약, selector 술어(form=정적 metadata, buttons/ai=runtime interactionType), handle 위임, undefined fallthrough 를 격리하여 고정한다. `dispatchParkEntry` 메서드 자체(getMetadata+getInteractionType 조합 → registry 조회)에 대한 직접 unit 은 없으나, e2e 214개 및 `execution-engine.service.spec.ts` 내 W4 form/buttons/ai 시나리오가 행동을 간접 보증하므로 기능적 갭은 없다. Mock 적절성과 테스트 격리(`clearAllMocks` + factory 가 상태 없는 pure function) 모두 양호하다. 회귀 테스트 유효성은 e2e 214 PASS 로 확인됐다. 테스트 가독성은 한국어 주석과 명확한 it 문자열로 우수하다. 발견사항 전부 INFO 수준이며 기능적 위험은 없다.

## 위험도

NONE
