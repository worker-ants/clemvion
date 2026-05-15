## Maintainability Code Review

### 발견사항

---

**[WARNING]** `useSavedConfig && configId` 이중 검사 — 파생 상태 불일치 위험
- **위치**: `model-combobox.tsx:44–47` (side_effect review 지적)
- **상세**: `useSavedConfig = Boolean(configId) && !trimmedKey`로 정의된 파생 값이 있음에도 소비처에서 `configId`를 재검사한다. 이는 파생 상태의 정의와 소비처가 분리되어 있어, 향후 `useSavedConfig`의 정의가 변경될 경우 소비처를 함께 수정해야 한다는 사실을 독자가 알 방법이 없다. 단순 중복이 아닌 **숨은 결합(hidden coupling)** 이다.
- **제안**: `if (useSavedConfig)` 단일 조건으로 단순화. `useSavedConfig` 정의에 의미가 집중되도록 유지.

---

**[WARNING]** `useMutation` 상태 초기화 로직이 세 핸들러(`onMutate`, `onSuccess`, `onError`)에 분산
- **위치**: `model-combobox.tsx` — `loadMutation` 핸들러 전체 (side_effect review 참조)
- **상세**: `setErrorMessage`는 `onSuccess`에서만 초기화되고, `setModels`는 `onError`에서 초기화된다. `onMutate`에는 아무것도 없다. 연관된 상태 초기화 로직이 서로 다른 생명주기 훅에 흩어져 있어, 상태 전이 흐름 전체를 파악하려면 세 핸들러를 모두 읽어야 한다. 새 state가 추가될 때마다 실수가 발생하기 쉬운 구조다.
- **제안**: `onMutate`에서 모든 비관적(pessimistic) 초기화를 일괄 수행하도록 집중시킨다. "요청 시작 시 X를 초기화한다"는 의도를 한 곳에서 읽을 수 있어야 한다.

---

**[WARNING]** `as never` 타입 캐스팅 — 인터페이스 변경 감지 불능
- **위치**: `llm-config.controller.spec.ts` — `new LlmConfigController(mockLlmConfigService as never, ...)` (testing review 지적)
- **상세**: `as never`는 TypeScript의 타입 검사를 전면 우회한다. `LlmConfigService` 인터페이스에 메서드가 추가되거나 시그니처가 바뀌어도 컴파일 단계에서 경고가 나오지 않아, 서비스 변경이 테스트에 전파되지 않는다. 테스트가 "안전망"이어야 하는데 오히려 안전망에 구멍이 뚫린 형태다.
- **제안**: `as unknown as LlmConfigService` 또는 `Partial<LlmConfigService>` 기반 typed mock으로 교체. 최소한 인터페이스 변경 시 컴파일 에러가 발생하는 수준을 확보해야 한다.

---

**[WARNING]** `beforeEach(vi.clearAllMocks)` + `afterEach(vi.restoreAllMocks)` — 의도 불명 이중 설정
- **위치**: `llm-configs.test.ts:15–19` (testing/side_effect review 모두 지적)
- **상세**: `vi.restoreAllMocks()`는 `vi.spyOn`으로 만든 spy를 원래 구현으로 복원하는 용도다. 이 파일에 `vi.spyOn`이 없으므로 `afterEach` 블록은 아무 효과가 없다. 그러나 독자는 "왜 두 가지가 함께 있나? 어떤 spy가 복원되는 건가?"라는 의문을 갖게 된다. 코드가 의도를 숨기면 유지보수 시 불필요한 분석 비용이 발생한다.
- **제안**: `afterEach(() => vi.restoreAllMocks())` 제거. `vi.spyOn`을 도입할 때 그때 추가한다.

---

**[INFO]** 동기 `throw` mock — 테스트 구현이 프로덕션 코드 내부 구조에 의존
- **위치**: `model-combobox.test.tsx` — `shows a sanitized error message` (testing/side_effect review 모두 지적)
- **상세**: 동기 `throw`가 동작하는 이유는 `mutationFn`이 `async`이기 때문이다. 테스트가 "프로덕션 함수가 `async`이다"라는 구현 세부사항에 암묵적으로 의존하고 있다. `mutationFn`이 `async`를 제거하거나 내부에 `try/catch`를 추가하면 테스트가 이유를 알기 어렵게 깨진다.
- **제안**: `mockRejectedValue()`로 교체. 테스트 의도("API 요청 실패")와 mock 구현이 일치해야 한다.

---

**[INFO]** 컨트롤러 테스트 — CRUD 메서드 mock 선언과 실제 테스트 케이스 분리
- **위치**: `llm-config.controller.spec.ts` 전체 (testing review 지적)
- **상세**: `mockLlmConfigService`에 `findAll`, `create`, `update` 등이 선언되어 있지만 테스트 케이스는 `previewModels`만 존재한다. mock 선언만 있고 검증이 없는 메서드는 "이건 나중에 추가할 것"인지 "원래 다른 파일에 있는 것"인지 독자가 알 수 없다. 읽는 사람이 불필요한 추적을 하게 만든다.
- **제안**: 별도 파일에 테스트가 있다면 mock 선언에서 미사용 메서드를 제거하거나 주석으로 출처를 명시한다. 없다면 최소 위임 테스트를 추가한다.

---

**[INFO]** `llm-configs.test.ts` — `previewModels` fallback 케이스 누락으로 분기 커버리지 단절
- **위치**: `llm-configs.test.ts` — `previewModels describe` 블록 (testing review 지적)
- **상세**: `listModels`는 엔벨로프/비엔벨로프 2건을 모두 검증하지만 `previewModels`는 1건만 존재한다. 동일한 패턴의 두 함수가 다른 테스트 구조를 가지면 "의도적 차이인가, 누락인가?"를 독자가 판단해야 한다. 또한 fallback 분기(`data?.data ?? data`)가 테스트되지 않으면 해당 분기는 리팩토링 시 삭제되거나 변경되어도 회귀를 탐지할 수 없다.
- **제안**: `listModels`의 두 번째 케이스와 동일한 패턴으로 `previewModels` fallback 케이스를 추가해 구조적 대칭을 맞춘다.

---

### 요약

리뷰 대상 코드의 유지보수성 위험은 **상태 관리 로직의 분산**과 **테스트 코드의 타입 안전성 우회**에 집중된다. `useSavedConfig && configId` 이중 검사와 `loadMutation` 핸들러 전체에 흩어진 초기화 로직은 "하나의 상태 전이를 이해하기 위해 여러 곳을 읽어야 하는" 구조를 만들어 수정 비용을 높인다. 테스트 코드에서 `as never` 캐스팅과 동기 `throw` mock은 인터페이스 변경 감지와 구현 세부사항 격리라는 테스트의 두 핵심 목적을 약화시킨다. `afterEach(vi.restoreAllMocks)` 중복과 mock 선언 과잉은 코드 자체보다 독자의 의도 파악 비용을 올리는 문제로, 즉각적인 결함보다 장기 유지보수 마찰로 이어진다.

### 위험도
**LOW**