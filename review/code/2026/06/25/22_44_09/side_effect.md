# 부작용(Side Effect) 리뷰

## 발견사항

### 발견사항 1
- **[WARNING]** `useOauthPopupReturn` — message handler 가 `onAuthorized` 클로저를 마운트 시점에 캡처해 stale 참조 가능
  - 위치: `codebase/frontend/src/lib/integrations/use-oauth-popup-return.ts` L391-416 (`useEffect([], [])`)
  - 상세: `useEffect` deps 가 `[]`(마운트 전용)이므로 handler 내부에서 호출하는 `onAuthorized`, `t` 가 마운트 시점의 참조에 고정된다. `onAuthorized`는 `page.tsx`에서 `() => goToStep("test")`로 전달되며, `goToStep`은 `router`, `serviceType`을 클로저로 사용한다. 컴포넌트 리렌더 중 `router`/`serviceType`이 바뀌어도 마운트 시점 값이 그대로 사용된다. 기존 `page.tsx` 코드도 동일한 `[]` deps를 사용했으므로 **신규 회귀는 아니며** 동작은 동일하게 보존된다. 코드 주석(`// eslint-disable-next-line react-hooks/exhaustive-deps`)이 이 의도적 선택을 문서화하고 있다.
  - 제안: 현재 동작은 기존과 100% 동일하므로 직접적인 수정은 불필요하나, 추후 훅 공유 사용 시 `onAuthorized`를 `useRef`에 저장하고 handler 내에서 `ref.current()`를 호출하는 패턴으로 전환할 것.

### 발견사항 2
- **[INFO]** `AuthStep` — `export` 가시성 변경 (`function AuthStep` -> `export function AuthStep`)
  - 위치: `codebase/frontend/src/app/(main)/integrations/new/_components/auth-step.tsx` L107
  - 상세: 기존 `page.tsx`에서 파일-로컬 `function AuthStep`이었던 것이 별도 파일의 `export function AuthStep`으로 변경됐다. `Cafe24ExtraFields`, `MakeshopExtraFields`는 여전히 파일-로컬(non-export)이므로 외부 접근이 차단되어 있다. `AuthStep`의 `export`는 같은 라우트 세그먼트(`new/`) 내에서만 소비되므로 공개 API 오염은 없다.
  - 제안: 향후 `components/integrations/steps/` 통합 시 props 계약 변경에 주의.

### 발견사항 3
- **[INFO]** `Cafe24ExtraFields.useEffect` — `set` 함수가 deps 에서 누락됨 (기존과 동일)
  - 위치: `codebase/frontend/src/app/(main)/integrations/new/_components/auth-step.tsx` L370-375
  - 상세: `useEffect` deps 배열이 `[publicAppAvailable, rawAppType]`이지만 `set`(`setCredentials`의 wrapper)이 포함되어 있지 않다. `// eslint-disable-next-line react-hooks/exhaustive-deps`로 의도적으로 억제. `set`은 매 렌더마다 새로 생성되는 함수이므로 deps에 포함 시 무한 루프가 발생할 수 있어 의도적 생략이다. 기존 `page.tsx`의 동일 effect와 완전 동일하므로 신규 부작용 없음.
  - 제안: 변경 없음.

### 발견사항 4
- **[INFO]** `useUnsavedChangesWarning` — `window.beforeunload` 리스너 deps 변경
  - 위치: `codebase/frontend/src/lib/hooks/use-unsaved-changes-warning.ts` L248-258
  - 상세: 기존 `page.tsx`의 effect에서는 `[variant, credentials, name, oauthWaiting]`이 deps였으나, 추출된 훅에서는 미리 계산된 `hasUserInput: boolean`만 받는다. `hasUserInput` 계산이 page.tsx 레벨에서 동일하게 수행되므로 `active` 값 변화 시점은 동일하다. 의도하지 않은 전역 상태 변경 없음.
  - 제안: 변경 없음.

### 발견사항 5
- **[INFO]** `TestStep.useQuery` — `queryKey`에 `credentials`가 포함되지 않음 (기존과 동일)
  - 위치: `codebase/frontend/src/app/(main)/integrations/new/_components/test-step.tsx` L331-346
  - 상세: `queryKey: ["integrations", "preview-test", serviceType, authType]`에 `credentials`가 없어, 동일 serviceType/authType 에서 credentials가 변경되어도 캐시 히트가 발생한다. 이는 추출 전 `page.tsx`의 동일한 `TestStep` function 에서도 동일한 패턴이었으므로 신규 회귀 아님.
  - 제안: 변경 없음.

### 발견사항 6
- **[INFO]** `goToStep` 함수 위치 이동 — TDZ 위험 없음 확인
  - 위치: `codebase/frontend/src/app/(main)/integrations/new/page.tsx` L647-653 (신규 위치)
  - 상세: 기존 `page.tsx`에서 `goToStep`은 `oauthBeginMutation` 아래쪽에 정의됐으나, 새 코드에서는 `useOauthPopupReturn` 호출 바로 앞으로 이동됐다. `goToStep`은 `router`와 `serviceType`만 사용하며 두 값 모두 `goToStep` 정의 이전에 선언되어 있다. const 화살표 함수이므로 정의 이전 사용 위치가 없는지 확인 -- 호출은 `onAuthorized` 콜백 내부와 `onContinue` 내부에서만 발생하며, 두 곳 모두 함수 정의 이후 실행 시점이다. TDZ 문제 없음.
  - 제안: 변경 없음.

### 발견사항 7
- **[INFO]** `validate` 함수 내 변수명 `isOAuth` -> `isOAuthVariant` shadowing 회피
  - 위치: `codebase/frontend/src/app/(main)/integrations/new/page.tsx` L843-847
  - 상세: `page.tsx` 상단에 `const isOAuth = variant?.authType === "oauth2"` (이탈 가드용)가 선언되어 있고, `validate()` 내부에서도 같은 이름을 사용하면 outer scope를 shadow하게 된다. 이를 `isOAuthVariant`로 명명해 shadow 회피. 동작은 완전히 동일하다.
  - 제안: 변경 없음.

---

## 요약

이 변경은 `page.tsx` 1444줄짜리 단일 파일을 7개 파일로 behavior-preserving 분할한 refactor다. 부작용 관점에서 검토하면 전역 변수 도입 없음, 파일시스템 부작용 없음, 환경 변수 읽기/쓰기 없음, 네트워크 호출 패턴 변경 없음이다. `window.addEventListener`(`message`, `beforeunload`) 리스너의 attach/detach 타이밍은 기존과 동일하게 보존됐다. `AuthStep`/`TestStep`/`Cafe24PrivatePendingStep`/`MakeshopPendingStep`의 export 전환은 동일 라우트 세그먼트 소비에 한정되어 공개 API 오염이 없다. `useOauthPopupReturn` 훅의 message handler deps `[]` 패턴은 기존 page.tsx의 의도적 선택을 그대로 보존한 것으로, `onAuthorized` stale 캡처 가능성이 이론적으로 존재하나 실제 사용 컨텍스트에서 회귀 위험이 없다. 발견된 모든 항목은 기존 코드와 동일하거나 단순 가시성 정비 수준이며, 의도치 않은 부작용은 발견되지 않았다.

## 위험도

NONE
