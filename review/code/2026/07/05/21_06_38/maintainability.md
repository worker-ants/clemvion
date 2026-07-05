# Maintainability Review — use-result-detail-waiting extraction

대상: `codebase/frontend/src/components/editor/run-results/use-result-detail-waiting.ts` (신규) +
소비처 `run-results-drawer.tsx`, `executions/[executionId]/page.tsx` 갱신 + 부수 registry/spec 동기화.

## 발견사항

### Critical

없음.

### Warning

없음.

### Info

- **[INFO]** `deriveFlags` 가 클로저(비-hook)로 노출되어 있어 호출부에서 "이것도 hook 이라 top-level 에서 불러야 하나?"라는 오해가 생길 수 있다.
  - 위치: `use-result-detail-waiting.ts:50-57`, 소비처 `run-results-drawer.tsx:310-311`, `page.tsx:559-560`
  - 상세: 이름이 `useXxx` 접두어 없이 `deriveFlags` 라 명확히 구분되고, 상단 JSDoc(hook 파일 docstring)에서 "이 함수 호출은 hook 이 아니라 early return 이후에 써도 안전하다"고 명시적으로 설명해 두었다. React Rules-of-Hooks lint(`eslint-plugin-react-hooks`)는 함수 이름이 `use`로 시작하지 않으면 훅으로 취급하지 않으므로 실제 오분류 위험은 낮다. 다만 반환 객체 안에 저장 selector 값들과 "순수 함수" 하나가 나란히 섞여 있어 최초 리더에게는 다소 이질적인 shape 이다.
  - 제안: 현재 문서화 수준으로 충분하다고 판단되나, 원한다면 `deriveFlags`를 별도 named export(`deriveWaitingFlags(waitingInteractionType, isSelectedWaiting)`)로 훅 바깥에 순수 함수로 분리하고 훅은 `waitingInteractionType` 만 반환하는 형태도 고려할 수 있다. 다만 이 경우 두 소비처가 각각 `deriveFlags(waitingInteractionType, isSelectedWaiting)` 호출부에서 `waitingInteractionType`을 다시 전달해야 하므로 현재 클로저 방식(캡처됨)이 호출부 인자 수를 줄여 오히려 더 간결하다 — 실제로는 현행 유지가 낫다는 결론.

- **[INFO]** `waitingInteractionType`을 훅이 반환하지만 `page.tsx`는 구조분해하지 않고 `run-results-drawer.tsx`는 구조분해해 쓴다(상태 라벨·`isLiveConversation`용). 이 비대칭 자체는 각 소비처의 실제 필요에 따른 정상적 차이다.
  - 위치: `run-results-drawer.tsx:124,282,314-315` vs `page.tsx:523-535` (미구조분해)
  - 상세: 문제는 아니지만, 다음에 코드를 보는 사람이 "왜 페이지는 안 쓰지?"라는 의문을 가질 수 있다. 현재 훅 docstring에는 이 비대칭에 대한 언급이 없다.
  - 제안: 선택사항. 훅 docstring에 "waitingInteractionType 은 상태 라벨/isLiveConversation 처럼 deriveFlags 밖에서 필요한 소비처만 구조분해해서 쓴다" 한 줄 추가하면 향후 리더의 궁금증을 줄일 수 있다. 필수는 아님.

- **[INFO]** 두 소비처 모두에 남아있는 "왜 이 hook 을 early return 전/후에 호출해야 하는가"에 대한 로컬 주석이 hook 파일의 docstring 과 사실상 동일 내용을 반복한다.
  - 위치: `run-results-drawer.tsx:119-122`, `page.tsx:519-522`, 그리고 `use-result-detail-waiting.ts:12-17`
  - 상세: 완전한 중복은 아니고(로컬 주석은 "여기서 그 규칙을 지킨다"는 확인 차원), 세 곳에 비슷한 설명이 있으면 향후 규칙이 바뀔 때(예: Rules of Hooks 이해가 바뀌거나 리팩터링 시) 세 곳을 함께 갱신해야 하는 부담이 생긴다.
  - 제안: 사소한 수준이라 현행 유지 가능. 원한다면 소비처 주석을 "see use-result-detail-waiting.ts docstring" 한 줄로 축약해 SoT를 하나로 모을 수 있다.

## 요약

이 추출은 실질적인 중복 제거다 — 11개 waiting selector, 4개 resume 콜백, pendingFormToolCallId 파생이 두 파일에서 완전히 동일하게 반복되던 것을 단일 훅으로 옮겼고, 타입별 플래그 파생(`isWaitingForm/Buttons/Conversation`, 특히 `ai_form_render`가 `isWaitingConversation`으로 흡수되는 미묘한 규칙)도 한 곳에서만 정의되도록 만들어 "규칙이 두 곳에서 따로 표류"할 위험을 제거했다. `deriveFlags`를 훅이 아닌 순수 클로저로 분리한 설계는 "소비처마다 다른 `isSelectedWaiting` 정의(드로어의 iteration-aware dual match vs 실행 상세의 단순 비교)를 각자 유지하면서도 파생 로직 자체는 공유"라는 정확한 문제를 풀며, React Rules of Hooks 위반 없이 각 소비처의 early return 이후에도 안전하게 호출할 수 있다. 훅 docstring 은 정확하고 구체적이며(Rules of Hooks 주의사항, 소비처별 isSelectedWaiting 소스 차이, hook 범위 밖 사항까지 명시), registry 문서(`interaction-type-registry.md`)와 exhaustiveness 가드 테스트(`interaction-type-exhaustiveness.test.ts`)도 새 단일 site를 정확히 반영하도록 함께 갱신되어 있어 SoT 일관성이 잘 유지되고 있다. 남은 지적사항은 전부 INFO 수준의 사소한 문서/구조 취향 차이이며 즉시 수정이 필요한 문제는 없다.

## 위험도
NONE
