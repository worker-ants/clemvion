# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 테스트에서 전역 Zustand store 상태 누출 — afterEach reset 으로 적절히 대응됨
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx` — 추가된 `afterEach` 블록
- 상세: `useLocaleStore.setState({ locale: "en" })` 를 `afterEach` 에서 호출하는 것은, Zustand store 가 테스트 파일 간 전역 상태로 공유될 수 있음을 의미한다. 이 reset 자체는 올바른 방어 패턴이나, 동일 프로세스 내 다른 테스트 파일이 `useLocaleStore` 를 직접 참조하면서 `beforeEach` 에서 locale 을 먼저 변경하는 경우 실행 순서에 따라 여전히 누출될 여지가 있다. 다만 이번 변경이 문제를 일으킨 것이 아니라 오히려 기존에 존재하던 누출 위험을 방어하는 방향으로 수정된 것이므로 새로운 부작용은 아니다.
- 제안: 현 방식은 적절하다. 추가로 `beforeEach` 에서도 동일 reset 을 수행하면 테스트 순서 독립성이 더 강해진다.

### [INFO] `toastError` mock 변수 — 모듈 수준 전역으로 선언됨
- 위치: `authentication-form.test.tsx` L189 — `const toastError = vi.fn();`
- 상세: `toastError` 가 `describe` 블록 밖 모듈 최상위에 선언되어 있다. `vi.fn()` 인스턴스는 호출 이력을 누적하므로, 같은 `describe` 내 여러 테스트가 순서대로 실행될 때 이전 테스트의 호출 횟수가 남아 있을 수 있다. 현재 테스트 케이스 수가 적어 실제 오탐은 없지만, 테스트가 늘어날 경우 `toastError.mock.calls` 의 누적이 예상 외 어서션 실패를 유발할 수 있다.
- 제안: `afterEach` 내에 `toastError.mockClear()` 를 추가하거나, `beforeEach` 에서 `vi.clearAllMocks()` 를 호출한다.

### [INFO] `auth-config-form.ts` 신규 모듈 — 전역/공유 상태 없음, 순수 함수만 노출
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts`
- 상세: 새로 도입된 모듈은 `AUTH_CONFIG_DEFAULTS` (읽기 전용 `as const` 객체), 순수 변환 함수(`parseIpWhitelist`, `isValidIpOrCidr`, `isValidHeaderName`, `buildAuthConfigPayload`, `validateAuthConfigForm`) 만 export 한다. 어느 함수도 외부 상태를 읽거나 쓰지 않으며 클로저로 캡처된 뮤터블 변수도 없다. 전역 변수 도입, 파일시스템·네트워크 호출, 이벤트 발생 등 어떠한 부작용도 없다.
- 제안: 해당 없음.

### [INFO] `page.tsx` 상태 초기값 변경 — `AUTH_CONFIG_DEFAULTS` 로 단일화, 런타임 동작 동일
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` — `useState` 초기값 및 `resetForm` 함수
- 상세: `useState("X-Hub-Signature-256")` 등 하드코딩 문자열 리터럴이 `AUTH_CONFIG_DEFAULTS.hmacHeader` 등 상수 참조로 교체되었다. 값 자체는 동일하므로 컴포넌트의 런타임 동작·렌더링 결과에 변화가 없다. 기존 호출자(사용자 UI) 관점에서 관찰 가능한 부작용 없음.
- 제안: 해당 없음.

### [INFO] `page.tsx` `handleCreate` — 새로운 `return` 경로 추가로 `createMutation.mutate()` 호출 시점 변경 가능
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` — `handleCreate` 함수 내 `validateAuthConfigForm` 호출 후 조기 return
- 상세: 검증 실패 시 `toast.error` 를 발생시키고 `return` 으로 함수를 종료한다. 이는 의도된 변경(제출 차단)이나, 이벤트 관점에서 보면 기존에 없던 `toast.error` 이벤트가 특정 조건에서 추가로 발생하게 된다. 단, 이 토스트는 사용자에게 유효성 오류를 알리는 명시적 의도이며 의도치 않은 부작용이 아니다. 부모 컴포넌트나 외부 상태를 변경하지 않고 `createMutation` 도 호출되지 않으므로 네트워크 호출 부작용도 없다.
- 제안: 해당 없음.

### [INFO] i18n 딕셔너리 추가 — 런타임 전역 상태 영향 없음
- 위치: `codebase/frontend/src/lib/i18n/dict/en/authentication.ts`, `codebase/frontend/src/lib/i18n/dict/ko/authentication.ts`
- 상세: 정적 객체에 키를 추가하는 것으로, 런타임 전역 상태·환경 변수·네트워크·파일시스템에 영향을 주지 않는다. 기존 키는 변경 없이 유지된다.
- 제안: 해당 없음.

---

## 요약

이번 변경은 프런트엔드 폼 로직을 순수 함수 모듈(`auth-config-form.ts`)로 분리하고 `page.tsx` 에 폼 검증·상수 단일화를 추가한 것이다. 부작용 관점에서 가장 중요한 점은 신규 모듈이 완전한 순수 함수만으로 구성되어 전역 상태·파일시스템·네트워크·이벤트에 어떠한 의도치 않은 영향도 주지 않는다는 점이다. 테스트 파일에서는 Zustand store 전역 상태 누출을 `afterEach` reset 으로 방어하는 개선이 포함되었으나, `toastError` mock 인스턴스가 테스트 간 호출 이력을 누적할 수 있는 경미한 잠재 문제가 남아 있다. 시그니처 변경·공개 API 변경·환경 변수 접근·예상치 못한 네트워크 호출은 존재하지 않는다.

## 위험도

LOW
