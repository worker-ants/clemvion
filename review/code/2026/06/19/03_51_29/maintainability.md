# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: button-interaction.service.ts

- **[INFO]** 순수함수 추출로 가독성 크게 향상
  - 위치: `resolveButtonInteraction`, `buildResumedStructuredOutput` (module-level 함수)
  - 상세: 기존 `processButtonResumeTurn` 안에 인라인으로 있던 130줄 가량의 분기 로직이 명명된 순수함수 두 개로 분리됐다. I/O 의존성이 없어 함수 시그니처만으로 계약을 파악할 수 있다.
  - 제안: 현 구조 유지.

- **[INFO]** JSDoc 품질 양호
  - 위치: `resolveButtonInteraction` 파라미터 목록, `ButtonInteractionResolution` 인터페이스, `StructuredInteraction` 인터페이스
  - 상세: 파라미터 설명·4개 분기 요약·에러 throw 명시가 충실하다. `@link` 교차 참조도 일관적.
  - 제안: 현 수준 유지.

- **[WARNING]** `resolveButtonInteraction` 함수 내 `let` 변수 4개 + 분기 내 순차 재할당 패턴
  - 위치: `resolveButtonInteraction` 함수 본문 (`let selectedPort`, `let interactionData`, `let updatedOutput`, `let structuredInteraction`)
  - 상세: 함수가 순수하다고 문서화되어 있지만 내부 구현은 `let`으로 선언한 변수를 `if/else` 분기에서 재할당한다. `if (isButtonClickPayload)` 블록 안에서 또 한 번 `if (clickedButton.type === 'port') / else` 로 중첩 분기가 발생한다. 각 분기는 3개 변수(`interactionData`, `structuredInteraction`, `updatedOutput`)를 독립적으로 구성하는 반복 구조다. 순환 복잡도(CC)가 약 5이며 분기가 늘어날 때 수정 표면이 비례적으로 증가한다.
  - 제안: 각 분기를 작은 helper(`buildPortClickResult`, `buildLinkClickResult`, `buildFallbackResult`)로 분리하거나, 분기별로 즉시 `return`하는 early-return 패턴을 사용하면 `let` 재할당을 제거하고 `const`만으로 표현할 수 있다.

- **[INFO]** `buildResumedStructuredOutput` 내 `previousOutput` 스트리핑 로직 — 의도 문서화 충분
  - 위치: `buildResumedStructuredOutput` 함수, `prevOutput` 변수 계산 구간
  - 상세: "체인 방지" 의도가 인라인 주석으로 명확히 설명되어 있고, `Object.fromEntries(Object.entries(...).filter(...))` 패턴은 표준적이다. 단, 동일 로직이 테스트(`(c) previousOutput 키 제거` 케이스)에서도 재검증되므로 회귀 보호는 충분하다.
  - 제안: 현 수준 유지.

- **[WARNING]** `payload as ButtonClickPayload` 런타임 캐스팅 잔류
  - 위치: `processButtonResumeTurn` 메서드 내 `resolveButtonInteraction` 호출부
  - 상세: `payload: unknown`을 `payload as ButtonClickPayload`로 캐스팅한 채 순수함수로 넘긴다. `ButtonClickPayload` 가 판별유니온이므로 최악의 경우 오염된 payload가 타입 오류 없이 통과한다. `isButtonClickPayload` 가드를 메서드 레벨에서 먼저 수행하거나, `processButtonResumeTurn`의 시그니처를 `payload: ButtonClickPayload`로 변경하면 캐스팅을 제거할 수 있다.
  - 제안: `processButtonResumeTurn` 시그니처를 `payload: ButtonClickPayload`로 좁히거나, 진입부에서 `isButtonClickPayload` 판별 후 캐스팅 없이 위임.

- **[INFO]** 매직 문자열 `'__item_'`, `'continue'`, `'resumed'` 하드코딩
  - 위치: `resolveButtonInteraction` 함수 내 `buttonId.includes('__item_')`, `selectedPort = 'continue'`, `status: 'resumed'`
  - 상세: 동일 리터럴이 함수 본문과 테스트 케이스 양쪽에 분산되어 있다. 현재는 일관되게 사용 중이지만 변경 시 산포 위험이 있다.
  - 제안: 상수(`ITEM_BUTTON_SEPARATOR`, `CONTINUE_PORT`, `RESUMED_STATUS`)로 추출하면 변경 시 단일 지점 수정이 가능하다. 단, 이 변경은 독립 PR 범위이며 현 변경의 blocking 사항은 아니다.

---

### 파일 2: button-interaction.service.spec.ts

- **[INFO]** 최상위 `describe` 블록 3개 구조가 명확하고 각 pure function의 책임 경계를 잘 반영
  - 위치: `describe('ButtonInteractionService')`, `describe('resolveButtonInteraction')`, `describe('buildResumedStructuredOutput')`
  - 상세: 파일 헤더 블록 주석이 각 describe 그룹의 I/O 계약을 명시해 새 기여자가 빠르게 맥락을 파악할 수 있다.
  - 제안: 현 구조 유지.

- **[WARNING]** `describe('isButtonClickPayload')` 가 `describe('resolveButtonInteraction')` 안에 중첩
  - 위치: spec 파일 `resolveButtonInteraction` 블록 내 `describe('isButtonClickPayload (type guard)')`
  - 상세: `isButtonClickPayload`는 module-level export이므로 자체 최상위 `describe` 블록을 갖는 것이 일관성 있다. 현재는 `resolveButtonInteraction` describe 안에 숨어 있어 검색 및 독립 테스트 추가 시 위치가 직관적이지 않다.
  - 제안: `isButtonClickPayload`를 별도 최상위 `describe` 블록으로 분리하거나, 현 위치를 유지하되 describe 제목을 `'isButtonClickPayload — type guard (resolveButtonInteraction 사용 전제)'`처럼 관계를 명시.

- **[WARNING]** `NOW` 상수가 `describe('resolveButtonInteraction')`와 `describe('buildResumedStructuredOutput')` 양쪽에 중복 선언
  - 위치: spec 파일 904번 줄 및 1109번 줄 (`const NOW = '2026-06-19T00:00:00.000Z'`)
  - 상세: 동일한 문자열 리터럴이 두 describe 블록의 각 스코프에 개별 선언되어 있다. 값을 변경할 경우 두 곳을 동기화해야 한다.
  - 제안: 파일 최상위 스코프 혹은 두 describe 블록 바깥에 단일 `const NOW = ...`으로 추출.

- **[INFO]** `seedButtonContext` 헬퍼의 `structuredOutputCache` 직접 주입 방식
  - 위치: spec 파일 `seedButtonContext` 함수, `(ctx as { structuredOutputCache: ... }).structuredOutputCache = ...` 구간
  - 상세: `ExecutionContextService.createContext`가 반환하는 타입이 `structuredOutputCache`를 공개 API로 노출하지 않아 타입 단언 캐스팅으로 주입한다. 테스트 목적으로 수용 가능하지만, `ExecutionContextService`가 이 필드를 테스트용 세터로 노출하거나 `createContext`가 초기값을 받는다면 캐스팅 없이 설정할 수 있다.
  - 제안: 단기 허용. 중기적으로 `ExecutionContextService`에 테스트용 seed API 추가 검토.

- **[INFO]** 인라인 타입 단언 `structCall?.[2] as { port?; status?; output?... }`이 여러 테스트에서 반복
  - 위치: spec 파일 `processButtonResumeTurn` 첫 번째 테스트 케이스 내 `setStructuredSpy.mock.calls` 처리 구간
  - 상세: `Record<string, unknown>` 형식의 스파이 반환값을 매번 인라인 타입으로 좁힌다. 두 곳 이상에서 같은 shape를 사용한다면 타입 별칭으로 추출하면 중복을 줄일 수 있다. 현재는 단 한 곳이므로 임박한 문제는 아니다.
  - 제안: 재사용 패턴이 늘어날 경우 `type StructuredOutputSpy = { port?: string; status?: string; output?: ... }`로 추출.

---

## 요약

이번 변경의 핵심 작업인 순수함수 추출(`resolveButtonInteraction`, `buildResumedStructuredOutput`)은 유지보수성을 뚜렷이 개선한다. 120줄 이상의 인라인 분기가 테스트 가능한 단위로 분리됐고, JSDoc과 헤더 주석이 의도를 충실히 서술한다. 주요 우려점은 `resolveButtonInteraction` 내부의 `let` + 분기 중첩 패턴(early-return으로 개선 가능), `processButtonResumeTurn`의 `payload as ButtonClickPayload` 캐스팅 잔류, spec 파일에서 `NOW` 상수의 이중 선언이다. 이 중 캐스팅 잔류는 런타임 타입 안전성과 직결되어 후속 리팩터에서 정리할 것을 권장하며, 나머지는 독립 PR 범위의 개선이다.

## 위험도

LOW
