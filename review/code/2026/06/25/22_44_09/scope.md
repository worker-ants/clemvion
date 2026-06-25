# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] 포맷팅 변경 4건 (page.tsx)
- 위치: `page.tsx` diff — credentials 삼항, stepCounter 객체 인수, makeshop/cafe24 toast.error 호출, selectedScopes 조건문
- 상세: 아래 4곳에서 긴 단일 줄을 Prettier 스타일로 분리했으나 의미는 완전 동일.
  1. `credentials: isOAuth ? { scopes: selectedScopes } : credentials,` — 삼항 인라인 정렬
  2. `if (selectedScopes.length === 0)\n  return t(...)` — 한 줄에서 두 줄로
  3. `t("integrations.stepCounter", {\n  current: step === "auth" ? 1 : 2,\n})` — 객체 인수 개행
  4. `toast.error(t("integrations.makeshopValidateClientIdRequired"))` 및 `toast.error(t("integrations.cafe24DuplicateMallToast"))` — 함수 호출 한 줄 정리
- 제안: behavior-preserving 분할 PR에 포맷팅 잡음이 섞이는 것이므로, 포맷팅 전용 커밋으로 분리하거나 그냥 유지. 범위 이탈 수준은 아님 — 동일 PR에서 자동 포매터가 적용됐을 가능성이 높음.

### [INFO] 변수명 변경 — `isOAuth` → `isOAuthVariant` (page.tsx validate 내부)
- 위치: `page.tsx` validate 함수 내부
- 상세: `validate()` 함수 안의 지역 변수 `isOAuth`를 `isOAuthVariant`로 이름 변경. 커밋 메시지에 "shadow 회피"로 명시. `page.tsx` 컴포넌트 최상위에 `const isOAuth = variant?.authType === "oauth2"` 가 새로 추가됐기 때문에 동명 로컬 변수를 구분하기 위한 불가피한 변경. 범위 이탈 아님.

### [INFO] export visibility 확장 — 컴포넌트 4개
- 위치: `auth-step.tsx`, `test-step.tsx`, `cafe24-private-pending-step.tsx`, `makeshop-pending-step.tsx`
- 상세: page.tsx 내부 private function이었던 `AuthStep`, `TestStep`, `Cafe24PrivatePendingStep`, `MakeshopPendingStep`이 별도 파일로 이동하면서 `export function`으로 노출됨. 파일 분리의 구조적 필연으로, 라우트-로컬 `_components/` 폴더 배치로 Next.js 관례상 노출 범위 제한됨. 범위 이탈 아님.

### [INFO] `goToStep` 함수 위치 이동 (page.tsx)
- 위치: `page.tsx` 상단 훅 선언 영역
- 상세: 기존 코드에서는 여러 훅 선언 이후에 위치하던 `goToStep`이 새 코드에서는 훅(`useOauthPopupReturn`) 앞으로 이동. `onAuthorized: () => goToStep("test")` 의존으로 인한 구조적 필연이며, 함수 로직 자체는 무변경. 범위 이탈 아님.

## 요약

이 변경은 `integrations/new/page.tsx` 1444줄을 6개 파일로 behavior-preserving 분할하는 명확히 정의된 리팩토링이며, 모든 추출된 코드(컴포넌트 4개, 훅 2개)는 기존 page.tsx 내부 코드와 1:1 대응한다. 기능 추가나 의도하지 않은 파일 영역 수정 없이 오직 분할 목적의 변경만 포함되어 있다. 포맷팅 변경 4건은 자동 포매터로 인한 잡음으로 보이며 의미 변화가 없고, 변수명 변경(`isOAuth`→`isOAuthVariant`)과 `goToStep` 위치 이동은 파일 분리에 필연적인 최소 조정이다. 무관한 파일·코드 영역 수정은 없음.

## 위험도

NONE
