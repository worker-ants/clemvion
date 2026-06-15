# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] openCreate 가 폼 초기화를 하지 않는 점 — 설계 의도이나 주의 필요
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` — `openCreate()` 함수
- 상세: `openCreate`는 `setMode("create")`만 호출하고 필드를 초기화하지 않는다. 코드 주석과 plan 문서 모두 "close 가 초기화 담당"이라고 명시하고 있으며 기존 page.tsx 동작과 bit-identical하다. 그러나 `regenerateMutation.onSuccess`에서 `form.setGeneratedKey(secret)`을 호출하면서 `setRegenerateTarget(null)`만 처리하고 form을 닫지 않기 때문에, 재발급 흐름이 create 다이얼로그가 열린 채로 완료될 경우 다음 openCreate 시 이전 generatedKey가 잔류할 이론적 경로가 존재한다. 실제로 regenerateMutation은 create 다이얼로그와 독립된 별도 확인 모달에서 동작하므로 두 다이얼로그가 동시에 열리는 경로가 없어 실제 오염은 발생하지 않는다.
- 제안: 위험도 낮음. 단, `openCreate`에 reset 로직을 추가하는 방어적 변경을 검토할 수 있다.

### [INFO] TYPE_LABEL_KEYS 구성 방식 변경 — module-scope 에서 동적 파생으로
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` — 상단 상수 선언
- 상세: 이전에는 `TYPE_LABEL_KEYS`가 정적 객체 리터럴이었으나 이제 `Object.fromEntries(AUTH_TYPES.map(...))` 로 동적 생성된다. 두 방식 모두 모듈 초기화 시점에 한 번 평가되는 module-scope 상수이므로 런타임 부작용은 없다. `AUTH_TYPES` 배열이 변경되면 `TYPE_LABEL_KEYS`도 자동으로 동기화되어 중복 정의 위험이 제거된 올바른 변경이다.
- 제안: 변경 없음. 의도적이고 안전한 단일 SoT 통합.

### [INFO] pickPlaintextSecret 가 page.tsx 내 private 함수에서 auth-config-types.ts 공개 export 로 승격
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts`
- 상세: 함수 본체는 동일하다(`config.key ?? config.token ?? config.secret ?? config.password` 체인). page.tsx 에서 private 함수였던 것이 export 됨에 따라 이제 다른 모듈에서 import 가능하다. 보안 민감 함수(평문 비밀값 추출)가 의도치 않게 넓은 범위로 노출될 수 있다. 그러나 파일 자체는 프론트엔드 번들 내부에 한정되고, 이 함수는 UI 표시 전용으로만 사용하도록 JSDoc에 명시되어 있다. 실제 비밀값은 서버 응답에서 오며, 함수 자체가 상태를 변경하지 않는다.
- 제안: 변경 없음. 현재 사용처(page.tsx + 단위 테스트)는 명확하며 공개 API 변경이 외부 위협을 만들지 않는다.

### [INFO] useAuthConfigForm 내 validateAndProceed 가 toast.error 부작용을 직접 호출
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` — `validateAndProceed` 함수
- 상세: 기존 page.tsx 의 동일한 함수도 toast.error를 직접 호출했으므로 새로운 부작용이 아니다. 단순히 동일 로직이 훅으로 이전된 것이다. 테스트(use-auth-config-form.test.tsx)에서 sonner를 mock하여 이 부작용을 정확히 검증하고 있다.
- 제안: 변경 없음.

### [INFO] 테스트 파일의 useLocaleStore.setState — 전역 Zustand 스토어 직접 변경, afterEach 복원 누락
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/use-auth-config-form.test.tsx` — `beforeEach`
- 상세: `useLocaleStore.setState({ locale: "en" })` 는 테스트 간 전역 Zustand 스토어를 직접 변경한다. `authentication-form.test.tsx`는 `afterEach`에서 `useLocaleStore.setState({ locale: "en" })`로 복원하는 반면, `use-auth-config-form.test.tsx`는 `beforeEach`만 있고 `afterEach` 복원이 없다. vitest 의 각 파일별 독립 환경에서는 실질 타 파일 오염 위험이 낮으나, `authentication-form.test.tsx` 와 동일한 방어적 패턴을 적용하지 않은 불일치가 존재한다.
- 제안: `afterEach(() => { useLocaleStore.setState({ locale: "en" }); })` 를 추가하여 기존 테스트 파일 패턴과 일관성을 맞추는 것을 권장한다.

### [INFO] window.setTimeout 로 revealedSecret 자동 숨김 — 컴포넌트 언마운트 시 정리 없음 (기존 유지)
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` — `revealMutation.onSuccess`
- 상세: 이 변경 집합에서 수정되지 않았다. `window.setTimeout(() => setRevealedSecret(null), 30_000)` 패턴은 기존 그대로 유지되며 컴포넌트 언마운트 시 정리(clearTimeout)가 없는 상태도 그대로다. 이는 이번 PR 범위가 아니며 plan에서도 명시적으로 분리된 후속 작업임을 기록하고 있다.
- 제안: 별도 이슈로 추적 권장(이번 PR 범위 외).

## 요약

이번 변경은 page.tsx의 God Component에서 form 관련 상태(useState 11개)와 로직을 `useAuthConfigForm` 훅으로 추출하고, 다이얼로그 UI를 `AuthConfigCreateForm`·`AuthConfigEditDialog`·`AuthConfigFormFields` 세 컴포넌트로 분리하는 순수 구조 리팩토링이다. 새로운 전역 변수 도입 없음, 파일시스템 부작용 없음, 네트워크 호출 경로 불변, 환경 변수 접근 없음, 공개 REST API 변경 없음을 확인했다. `pickPlaintextSecret`의 export 승격과 `TYPE_LABEL_KEYS` 동적 파생은 모두 내부 모듈 경계 변경이나 기능과 행동은 불변이다. `openCreate`가 폼을 초기화하지 않는 설계는 기존 동작과 동일하며 코드 주석으로 명시되어 있다. 이벤트/콜백 변경 없음, 시그니처 변경은 page.tsx 내부 함수만 영향받고 외부 호출자는 없다. 발견된 사항 모두 INFO 등급이며 의도치 않은 새로운 부작용은 없다.

## 위험도

NONE
