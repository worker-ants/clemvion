# 신규 식별자 충돌 검토 결과

## 발견사항

- **[WARNING]** `openOAuthPopup` 함수명 중복 정의
  - target 신규 식별자: `function openOAuthPopup(url: string): Window | null` — `/codebase/frontend/src/lib/integrations/use-oauth-popup-return.ts` 내 module-private 함수로 정의됨
  - 기존 사용처:
    - `/codebase/frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts` (line 1): `export function openOAuthPopup(url: string)` — 동일 이름, 동일 시그니처의 **exported** 함수. `[id]/scope-tab.tsx` 와 `[id]/page.tsx` 두 곳에서 import 해 사용 중.
    - `/codebase/frontend/src/app/(main)/integrations/new/page.tsx` (line 1331, origin/main 기준): `function openOAuthPopup(url: string): Window | null` — 기존 page.tsx 내부 module-private 함수 (이번 리팩터로 삭제됨).
  - 상세: `[id]/open-oauth-popup.ts` 의 exported `openOAuthPopup` 과 새 `use-oauth-popup-return.ts` 의 module-private `openOAuthPopup` 은 동일한 이름·시그니처·동작을 가진다. 현재는 scope 가 달라 런타임 충돌은 없지만, 동일 기능이 두 파일에 독립적으로 정의된 상태가 된다. 향후 팝업 설정(width·height·window name `"integration-oauth"` 등)을 변경할 때 양쪽을 모두 수정해야 한다는 유지보수 이중성이 생긴다.
  - 제안: `use-oauth-popup-return.ts` 내부 private `openOAuthPopup` 을 삭제하고 `[id]/open-oauth-popup.ts` 를 공유 위치(예: `@/lib/integrations/open-oauth-popup.ts`)로 이동한 뒤 두 경로 모두에서 import 하거나, 반대로 `[id]/open-oauth-popup.ts` 를 유지하면서 `use-oauth-popup-return.ts` 에서 해당 파일을 import 해 사용하도록 수정한다. 단, 본 리팩터(m-3)의 scope 가 behavior-preserving 분할임을 감안하면 후속 정리 태스크로 분리해도 무방하다.

- **[INFO]** `OAuthCallbackPayload` 인터페이스 module-private 이동 — 단일화 기회
  - target 신규 식별자: `interface OAuthCallbackPayload` — `/codebase/frontend/src/lib/integrations/use-oauth-popup-return.ts` 에 module-private 으로 재정의됨
  - 기존 사용처: `origin/main` 의 `new/page.tsx` (line 42) 에만 정의·사용됐으며, `[id]/` 경로에는 존재하지 않는다. 이번 리팩터에서 page.tsx 에서 삭제됨.
  - 상세: `[id]/page.tsx` 및 `[id]/scope-tab.tsx` 는 같은 `oauth_callback` postMessage 구조를 처리하지만, 별도로 inline type assertion 형태를 쓰거나 자체 타입을 정의할 가능성이 있다. `OAuthCallbackPayload` 를 shared 위치로 export 하면 일관성이 높아진다.
  - 제안: 충돌 위험은 없으나, `[id]/` 경로에서도 동일한 payload 구조를 처리하면 공유 타입으로 추출하는 것이 장기적으로 유리하다. 현재 m-3 scope 내에서는 INFO 수준 — 필수 조치 아님.

- **[INFO]** `AuthStepProps` / `TestStepProps` 인터페이스 — 동명이 origin/main 에 잔존하나 scope 분리 완료
  - target 신규 식별자: `interface AuthStepProps` (`auth-step.tsx`), `interface TestStepProps` (`test-step.tsx`) — 각각 새 파일에 exported 로 정의됨
  - 기존 사용처: `origin/main` 의 `new/page.tsx` (line 569 `AuthStepProps`, line 1343 `TestStepProps`) — module-private 인터페이스로 정의. 이번 diff 에서 page.tsx 에서 삭제됨.
  - 상세: origin/main 의 page.tsx 내부 private 인터페이스와 이름이 같지만, 이번 리팩터에서 page.tsx 에서 제거되고 새 파일로 이동했다. 동일 프로젝트 내 다른 경로에 동명 인터페이스가 없다. 충돌 없음.
  - 제안: 조치 불필요.

---

## 요약

이번 리팩터(m-3)에서 도입된 신규 식별자(`useOauthPopupReturn`, `useUnsavedChangesWarning`, `AuthStep`, `TestStep`, `Cafe24PrivatePendingStep`, `MakeshopPendingStep`, `AuthStepProps`, `TestStepProps`, `OAuthCallbackPayload`)는 모두 기존 코드베이스에서 다른 의미로 중복 사용되고 있지 않다. 주목할 점은 새 `use-oauth-popup-return.ts` 내부에 정의된 module-private `openOAuthPopup` 함수가 `[id]/open-oauth-popup.ts` 의 exported 동명 함수와 구현을 공유하지 않고 독립적으로 복사 정의된 상태라는 점이다. 이는 런타임 충돌이 아니라 코드 중복(DRY 위반)이므로 CRITICAL 등급은 아니지만, 팝업 파라미터 변경 시 두 파일을 모두 수정해야 하는 유지보수 부담을 발생시킨다. 나머지 식별자는 충돌이나 혼동 위험 없이 도입됐다.

## 위험도

LOW
