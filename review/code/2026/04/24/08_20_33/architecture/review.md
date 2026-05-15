## Architecture Code Review

### 발견사항

---

**[WARNING]** `model-combobox.tsx`의 단일 책임 원칙(SRP) 위반 — 네트워크 요청, 상태 관리, 렌더링이 단일 컴포넌트에 혼재
- **위치**: `model-combobox.tsx` — `loadMutation` + `useSavedConfig` + `setModels` + `setErrorMessage` 전반
- **상세**: Side Effect 리뷰의 세 WARNING이 모두 동일한 근원에서 파생된다. 모델 로드 로직(API 호출 + stale 결과 필터링 + 에러 sanitize)과 UI 상태(`models`, `errorMessage`)가 하나의 컴포넌트 안에 인라인으로 정의되어 있다. 그 결과 `onError`, `onSuccess`, `onMutate`의 책임 경계가 불명확해지고 각각의 수정이 다른 핸들러의 side effect를 유발한다. 이 패턴은 향후 provider 추가 시 조건 분기가 컴포넌트 내부에 누적되는 구조적 취약점이다.
- **제안**: 모델 로드 로직을 `useModelLoader(provider, apiKey, configId)` 커스텀 훅으로 추출. 훅은 `{ models, isPending, errorMessage, load }` 인터페이스만 노출하고, `model-combobox.tsx`는 렌더링에만 집중한다.

---

**[WARNING]** props 불일치 가드가 컴포넌트 레이어에 위치 — 책임 레이어 역전
- **위치**: `model-combobox.tsx` — `onSuccess` 내 `provider` 비교 로직 (Side Effect 리뷰 두 번째 WARNING)
- **상세**: `mutationFn` 클로저의 `provider`와 현재 props의 `provider`를 비교하는 로직은 "완료된 요청 결과가 현재 컨텍스트와 유효한가"를 판단하는 비즈니스 규칙이다. 이 판단이 프레젠테이션 컴포넌트 내부에 위치하면, 동일 로직을 다른 컴포넌트에서 재사용할 때 복제 또는 누락된다. concurrency 처리는 훅 또는 서비스 레이어가 담당해야 한다.
- **제안**: 커스텀 훅 내부에서 `AbortController` 또는 `variables` 비교를 통해 stale 결과를 자동 폐기. 컴포넌트는 현재 컨텍스트와의 일치 여부를 직접 검사하지 않는다.

---

**[WARNING]** 테스트가 구현 세부사항에 직접 결합 — 추상화 경계 부재
- **위치**: `model-combobox.test.tsx` — `mutationFn` 내부의 동기 throw 패턴; Testing 리뷰 첫 번째 WARNING
- **상세**: 테스트가 `mutationFn`이 `async`라는 내부 구현 사실에 암묵적으로 의존하고 있다. 컴포넌트와 테스트 사이에 공개 인터페이스(`useModelLoader` 훅의 계약)가 없으므로, 내부 구현이 바뀔 때마다 테스트가 깨진다. Testing 리뷰가 지적한 `mockRejectedValue` 권장사항은 이 결합을 끊는 방향이기도 하다.
- **제안**: 훅을 분리하면 `model-combobox.test.tsx`는 렌더링 동작만, 훅 단위 테스트는 로직만 검증하는 계층 분리가 자연스럽게 달성된다.

---

**[INFO]** `useSavedConfig && configId` 이중 검사 — 추상화 수준 불일치
- **위치**: `model-combobox.tsx:44–47`
- **상세**: Side Effect 리뷰가 논리 중복으로 분류했지만, 아키텍처 관점에서 이 패턴은 도메인 규칙(`useSavedConfig`의 의미)이 파생 계산과 사용 지점 두 곳에 분산되어 있음을 나타낸다. 파생 상태의 의미를 소비 측에서 재확인하는 것은 추상화 수준이 낮아진 신호다.
- **제안**: `useSavedConfig` 계산 정의를 훅 내부로 이동하면 소비 측은 단순히 `if (useSavedConfig)`만 사용하게 된다. 논리의 근거가 단일 지점에만 존재한다.

---

**[INFO]** `llm-config.controller.spec.ts`의 `as never` 캐스팅 — 의존성 역전 원칙 검증 불가
- **위치**: `new LlmConfigController(mockLlmConfigService as never, ...)`
- **상세**: Testing 리뷰가 타입 안전성 문제로 분류했지만, 아키텍처적으로 이 패턴은 컨트롤러가 서비스 인터페이스가 아닌 구체 클래스에 의존하고 있거나, 인터페이스/추상 타입이 정의되어 있지 않음을 시사한다. `as never`는 의존성 역전 원칙 준수 여부를 컴파일 타임에 검증할 수단을 제거한다.
- **제안**: `ILlmConfigService` 인터페이스를 추출하고 컨트롤러가 이를 주입받도록 변경하면, 테스트는 `Partial<ILlmConfigService>`로 안전하게 목을 구성할 수 있다.

---

**[INFO]** 테스트 파일의 mock 정리 전략 불일치 — 테스트 아키텍처 일관성 부재
- **위치**: `llm-configs.test.ts:15–19` (양쪽 리뷰 공통 지적)
- **상세**: `vi.clearAllMocks()` + `vi.restoreAllMocks()` 혼용은 단독으로는 무해하지만, 테스트 파일 간 mock 수명주기 전략이 통일되지 않았음을 나타낸다. 일관된 전략(프로젝트 전체 `vitest.config`에서 `clearMocks: true` 설정)이 없으면 개별 파일마다 방어적 코드가 중복된다.
- **제안**: `vitest.config`에 `clearMocks: true`를 설정해 개별 파일의 `beforeEach(vi.clearAllMocks)` 보일러플레이트를 제거. `restoreAllMocks`는 `spyOn`을 사용하는 파일에만 국소적으로 배치한다.

---

### 요약

두 리뷰의 발견사항을 아키텍처 관점에서 종합하면, 위험의 근원은 하나다: `model-combobox.tsx`가 네트워크 요청 오케스트레이션, concurrency 제어, 에러 sanitize, UI 상태 관리를 단일 컴포넌트 안에 혼재시킨 SRP 위반이다. 이 구조적 결함이 Side Effect 리뷰의 세 WARNING(stale 모델 목록, props 불일치, 에러 메시지 잔존)과 Testing 리뷰의 구현 결합 경고를 동시에 유발하고 있다. 로직을 `useModelLoader` 커스텀 훅으로 분리하면 각 경고가 자연스럽게 해소되며, 컨트롤러 계층의 `as never` 패턴은 인터페이스 부재라는 별도의 DIP 위반 신호로, 인터페이스 추출 시 테스트 타입 안전성도 회복된다.

### 위험도
**LOW** — 현재 기능 동작에는 문제가 없으나, provider 추가·concurrency 요구사항 변경 시 컴포넌트 내부 복잡도가 선형 이상으로 증가하는 구조적 취약점이 존재한다.