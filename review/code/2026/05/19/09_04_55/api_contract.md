# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `isTwoFactorChallenge` / `isAccessTokenResponse` 타입 가드 함수 제거로 인한 소비자 인터페이스 breaking change
  - 위치: `codebase/frontend/src/lib/api/auth.ts` — 삭제된 `export function isTwoFactorChallenge(...)` / `export function isAccessTokenResponse(...)`
  - 상세: 두 헬퍼는 named export 로 공개된 API 계약 일부다. 제거 diff 에서 두 함수가 삭제되고, `login-form.tsx` 에서도 `import { authApi, isTwoFactorChallenge }` → `import { authApi }` 로 교체되어 내부 소비는 정리됐다. 그러나 다른 화면·라이브러리 코드가 동일 헬퍼를 import 하고 있다면 컴파일 오류가 발생한다. 변경 diff 에는 다른 소비처 수정 여부가 포함되지 않아 확인이 불가능하다.
  - 제안: `auth.ts` 에서 헬퍼를 제거하기 전에 `grep -r "isTwoFactorChallenge\|isAccessTokenResponse" codebase/` 로 모든 import 지점을 확인하고, 사용처가 없음을 검증한 후 제거한다. 아직 사용처가 남아 있다면 deprecated annotation 을 추가한 뒤 다음 minor 버전에서 제거하는 2-step 전략을 권장한다.

- **[WARNING]** `AccessTokenResponse` / `TwoFactorChallengeResponse` named interface 제거로 인한 하위 호환성 위반
  - 위치: `codebase/frontend/src/lib/api/auth.ts` — 삭제된 `export interface AccessTokenResponse` / `export interface TwoFactorChallengeResponse`
  - 상세: 두 인터페이스는 named export 였다. 인라인 익명 union 으로 교체함으로써 해당 타입을 직접 import 해 사용하는 코드(`type MyPayload = AccessTokenResponse` 등)가 있다면 컴파일 타임 breaking change 가 발생한다. 특히 Swagger 코멘트에 언급된 백엔드 DTO (`AccessTokenDto`, `LoginChallengeDto`) 와의 대응 명칭 일관성도 희석된다.
  - 제안: 인라인 union 유지가 최종 결정이라면 `export type AccessTokenResponse = { accessToken: string }` 형태의 re-export alias 를 2-step deprecation 기간 동안 유지한다.

- **[WARNING]** `login-form.tsx` 의 `accessToken` 추출 로직이 응답 스키마 계약을 암묵적 검사에 의존
  - 위치: `codebase/frontend/src/components/auth/login-form.tsx` 라인 157-61 (변경 후 기준)
  - 상세: 기존 코드는 `isTwoFactorChallenge(payload)` 타입 가드로 discriminated union 분기를 명확히 처리했다. 변경 후 코드는 `payload && "accessToken" in payload ? payload.accessToken : undefined` 로 교체되었는데, `accessToken` 이 없는 경우(예: 서버가 예상치 못한 형태의 응답을 내려보낼 때) `completeLogin` 이 호출되지 않고 **사용자에게 아무 에러 메시지도 표시되지 않은 채 조용히 실패**한다. API 계약상 응답이 두 union 케이스 중 하나임이 보장되어야 하는데, 계약 이탈 시의 에러 처리가 없다.
  - 제안: `accessToken` 이 없고 `requires2fa` 도 없는 예외 응답에 대해 `catch` 블록과 동일한 에러 표시 경로를 추가한다. 또는 런타임 타입 가드 함수를 auth.ts 내에 재도입해 계약 위반을 명시적으로 처리한다.

- **[INFO]** `LoginResponseData` union 의 Swagger `oneOf` 표기 제거
  - 위치: `codebase/frontend/src/lib/api/auth.ts` — 삭제된 주석 `Swagger 측은 oneOf: [AccessTokenDto, LoginChallengeDto] 로 분리 표기 (백엔드 §9 follow-up)`
  - 상세: 해당 주석의 삭제는 Swagger 문서화 follow-up 계획을 코드에서 제거한 것이다. plan 파일(`2fa-webauthn-followups.md` §9)에서도 같은 항목이 완료 → 미완료로 되돌아갔다. 즉, 백엔드 Swagger 에 `oneOf` 가 적용되지 않은 채 운영 중임을 의미하며, `/auth/login` 응답 스키마가 API 문서에 정확히 표기되지 않는 상태가 지속된다.
  - 제안: `plan/in-progress/2fa-webauthn-followups.md §9` 의 "Swagger oneOf 로 응답 스키마 표기" 항목을 빠른 시일 내에 처리한다. 문서화 gap 이 장기화되면 외부 클라이언트 통합 시 계약 오해가 발생할 수 있다.

- **[INFO]** `button-list-editor.tsx` `maxButtons` default 변경은 API 계약과 무관
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/shared/button-list-editor.tsx`
  - 상세: 프론트엔드 UI 컴포넌트 prop default 변경으로, 외부 API 계약에는 직접적인 영향이 없다. 백엔드 validator 와의 정합성(cap 5 통일) 측면은 backend API 계약 reviewer 의 관할이다.

## 요약

이번 변경의 핵심은 `/auth/login` 응답 타입의 discriminated union 처리를 named interface + type guard 함수에서 인라인 union 으로 교체한 것이다. API 계약 관점에서 가장 중요한 문제는 두 named interface(`AccessTokenResponse`, `TwoFactorChallengeResponse`)와 두 타입 가드 함수(`isTwoFactorChallenge`, `isAccessTokenResponse`)가 public export 였음에도 deprecation 기간 없이 즉시 제거되었다는 점이다. 내부 소비처(`login-form.tsx`)는 함께 정리되었으나 다른 소비처의 존재 여부가 diff 에서 확인되지 않아 잠재적 breaking change 위험이 남아 있다. 추가로, 계약 위반 응답(두 union 케이스 모두 해당하지 않는 경우)에서 silent failure 가 발생하는 에러 처리 공백이 존재한다. Swagger `oneOf` 표기 follow-up 도 코드 주석에서 삭제되며 추적 가능성이 plan 문서로만 이전되었다.

## 위험도
MEDIUM
