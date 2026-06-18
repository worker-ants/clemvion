# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: button-interaction.service.ts

- **[INFO]** `resolveButtonInteraction` 함수 내 `interactionData` 구조 중복
  - 위치: `resolveButtonInteraction` 함수, link 분기(else)와 fallback(else) 블록
  - 상세: `interactionData = { interactionType: 'button_continue', clickedAt: now }` 가 link 버튼 분기와 non-button_click fallback 분기 두 곳에서 동일한 객체 리터럴로 반복된다. `updatedOutput` 의 공통 골격(`type: 'button_continue'`, `clickedAt`, `nodeOutput`, `_selectedPort`)도 두 분기에서 중복된다.
  - 제안: 공통 `button_continue` 베이스 값을 분기 진입 전에 기본값으로 설정하고 각 분기에서 차등 필드(url, selectedItem 등)만 병합하거나, `buildButtonContinueResult()` 같은 내부 헬퍼로 추출하면 중복을 제거할 수 있다.

- **[INFO]** `resolveButtonInteraction` 의 `let` 변수 4개 선언 후 분기 내 할당 패턴
  - 위치: `resolveButtonInteraction` 함수 상단(L1470-1478)
  - 상세: `let selectedPort`, `let interactionData`, `let updatedOutput`, `let structuredInteraction` 4개를 선언 후 if/else 에서 할당한다. TypeScript 가 definite assignment 를 추적하므로 컴파일 안전성은 유지되지만, 각 분기가 독립된 반환 객체를 구성하므로 분기별로 값을 담는 중간 타입을 만들거나 분기마다 즉시 return 하는 early-return 패턴이 가독성을 높인다.
  - 제안: 분기별 helper 함수로 분리하거나 각 분기 끝에서 `return { selectedPort, ... }` 하는 early-return 구조로 전환하면 선언-할당 거리가 줄어든다.

- **[INFO]** `buildResumedStructuredOutput` 내 `prevOutput` 필터링 로직 복잡도
  - 위치: `buildResumedStructuredOutput` 함수(L1609-1618)
  - 상세: `rawPrevOutput` → type guard(object & !Array) → `Object.fromEntries(Object.entries(...).filter(...))` 의 3단 연쇄가 한 변수 할당 표현식 안에 있다. `previousOutput` 필드 제거라는 의도가 맥락 없이 읽는 사람에게는 즉각 파악되지 않는다.
  - 제안: `stripPreviousOutputChain(rawOutput)` 같은 명명된 1-purpose 함수로 추출하면 `buildResumedStructuredOutput` 본문 읽기가 쉬워지고 해당 로직에 대한 단위 테스트도 추가 가능하다.

- **[WARNING]** `payload.buttonId!` non-null assertion 사용
  - 위치: `resolveButtonInteraction` 함수 L1481
  - 상세: `isButtonClickPayload(payload)` 가드를 통과한 뒤 `payload.buttonId!` 로 non-null assertion 을 사용한다. `ButtonClickPayload` 의 `button_click` 변형은 `buttonId?: string` (optional) 이므로 `undefined` 가 가능하다. 타입 상 가드 통과 후에도 `buttonId` 가 `undefined` 일 수 있고, 그 경우 하단 `buttons.find((b) => b.id === buttonId)` 가 `undefined` 와 비교해 항상 미매칭 → `INVALID_BUTTON_ID` throw 로 이어진다. 동작은 보존되나 `!` 를 붙이는 것은 "undefined 불가" 라는 잘못된 인상을 준다.
  - 제안: `buttonId` 를 optional 로 남기되 `if (!buttonId)` early-return/throw 를 명시적으로 추가하거나, 타입을 `buttonId: string` (required) 으로 강화해 `isButtonClickPayload` 반환 타입에 반영한다.

- **[INFO]** `now` 파라미터명 — 의미 전달 약함
  - 위치: `resolveButtonInteraction` 시그니처 마지막 파라미터
  - 상세: `now: string` 은 ISO8601 클릭 시각임을 JSDoc 에 설명하고 있지만, 파라미터명 자체는 너무 짧다. 동일 파일 내 호출부에서 `const now = new Date().toISOString()` 로 변수명이 일치하므로 큰 혼란은 없지만, 함수 시그니처만 읽을 때 의미가 약하다.
  - 제안: `clickedAt: string` 또는 `nowIso: string` 으로 바꾸면 파라미터명만으로도 의미를 파악할 수 있다.

---

### 파일 2: button-interaction.service.spec.ts

- **[WARNING]** `resolveButtonInteraction` describe 블록이 파일 내 두 군데 정의됨 (완전 중복)
  - 위치: L692-857 (전체 파일 컨텍스트) vs L55-212 (diff 의 새 블록)
  - 상세: diff 에서 추가된 `describe('resolveButtonInteraction', ...)` 블록(L47-212)과 전체 파일 컨텍스트에 이미 존재하는 동일 이름·동일 내용의 describe 블록(L700-857)이 동일 파일에 공존한다. `NOW` 상수, `clean()` 헬퍼, 모든 `it(...)` 케이스가 100% 동일하게 반복된다. Jest 실행 시 동일 테스트가 두 번 실행되므로 보고 테스트 수가 두 배로 부풀려지고, 한쪽만 수정 시 두 버전이 불일치하게 된다.
  - 제안: diff 에서 추가된 블록이 전체 파일 컨텍스트에 이미 반영된 것이라면 중복 블록을 제거해야 한다. 의도적으로 두 번 실행하려는 것이 아니라면 반드시 한 개만 유지해야 한다.

- **[INFO]** `seedButtonContext` 헬퍼 내 타입 단언 사용
  - 위치: spec 파일 L332-340 (`(ctx as { structuredOutputCache: ... }).structuredOutputCache = ...`)
  - 상세: `ExecutionContext` 에 `structuredOutputCache` 가 선택적이거나 공개되지 않아 타입 단언으로 우회하고 있다. 이 패턴이 유지되려면 `ExecutionContext` 타입 변경 시 spec 파일이 무음으로 깨질 수 있다.
  - 제안: `contextService` 가 `structuredOutputCache` 를 설정하는 공개 메서드를 제공한다면 그것을 사용하고, 없다면 테스트 전용 헬퍼에 명시적 `TODO` 주석을 달아 인지도를 높인다.

- **[INFO]** 여러 `it` 블록에서 `setNodeSpy = jest.spyOn(contextService, 'setNodeOutput')` 반복 설정
  - 위치: processButtonResumeTurn describe 블록 내 여러 it 케이스
  - 상세: `setNodeSpy` 선언과 `flatCall` 추출 패턴이 port/link/fallback/item 케이스에서 반복된다. `beforeEach` 에서 한 번 설정하고 각 `it` 에서 재사용하거나, `findFlatOutput(spy)` 같은 공유 헬퍼를 만들면 중복이 준다.
  - 제안: `processButtonResumeTurn` describe 블록 수준의 `beforeEach` 에 `setNodeSpy` 를 선언하고, `_selectedPort` 추출을 위한 소형 헬퍼를 상단에 배치한다.

- **[INFO]** 테스트 서술에 한국어·영어 혼용
  - 위치: 전체 spec 파일
  - 상세: `it('button_click(port) — _selectedPort=buttonId ...')`, `it('알 수 없는 buttonId → INVALID_BUTTON_ID throw')` 처럼 동일 파일 내에서 영어 기술 형식과 한국어 기술 형식이 섞여 있다. 일관성 관점에서 어느 한 언어로 통일하거나, 언어 선택 컨벤션을 명시하는 것이 바람직하다.
  - 제안: 프로젝트 컨벤션(다른 spec 파일 스타일)에 맞춰 통일한다.

---

## 요약

이번 변경의 핵심인 `resolveButtonInteraction` / `buildResumedStructuredOutput` 추출은 god-class 에서 순수함수를 분리해 테스트 가능성과 책임 분리를 크게 높인 긍정적 리팩터링이다. JSDoc 이 충실하고 분기 의도가 주석으로 명시되어 있어 전반적인 가독성은 양호하다. 다만 spec 파일에서 `resolveButtonInteraction` describe 블록이 두 번 정의되는 명백한 중복이 존재하며 이는 테스트 카운트 부풀림과 불일치 위험을 야기한다. 서비스 구현 측에서는 `link`/`fallback` 분기의 `interactionData`·`updatedOutput` 공통 구조 중복, `buttonId!` non-null assertion 의 의미 불일치, `buildResumedStructuredOutput` 내 필터 로직의 추출 여지가 INFO/WARNING 수준으로 남아 있다.

## 위험도

LOW
