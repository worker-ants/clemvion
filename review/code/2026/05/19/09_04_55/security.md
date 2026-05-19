# 보안(Security) 코드 리뷰

## 발견사항

- **[WARNING]** 타입 가드 제거로 인한 로그인 분기 안전성 저하
  - 위치: `codebase/frontend/src/components/auth/login-form.tsx` L44–58, `codebase/frontend/src/lib/api/auth.ts` (삭제된 `isTwoFactorChallenge`, `isAccessTokenResponse`)
  - 상세: 기존 코드는 `isTwoFactorChallenge(payload)` 타입 가드를 통해 2FA challenge vs 정상 로그인 두 분기를 exhaustive하게 처리했다. 변경 후 코드는 `"requires2fa" in payload && payload.requires2fa` 분기는 있지만, `else` 경로에서 `payload && "accessToken" in payload ? payload.accessToken : undefined` 를 사용하며 `accessToken` 이 없는 경우 `completeLogin` 을 **조용히 건너뛴다**. 이 경우 사용자가 로그인 성공처럼 보이지만 실제로는 인증 토큰 없이 앱에 머무를 수 있다(silent auth failure). 서버가 예상치 못한 구조의 응답을 반환하거나 타입 드리프트가 발생할 경우, 인증 상태를 완성하지 않은 채 사용자 세션이 진행될 위험이 있다. 명시적 exhaustive 분기나 else 절에 에러 throw가 없으면 이 조건을 탐지하기 어렵다.
  - 제안: `accessToken` 이 없는 경우(`undefined`) 를 명시적으로 에러로 처리해야 한다. 최소한 `else { setError(t("auth.login.genericFailed")); return; }` 을 추가하거나, 삭제된 타입 가드를 별도 유틸로 유지해 `isAccessTokenResponse` 로 분기하도록 복원한다. 타입 가드를 제거하더라도 `else` 절에서 예상치 못한 응답 구조에 대한 에러 처리가 반드시 있어야 한다.

- **[INFO]** 삭제된 `isAccessTokenResponse` 가드로 인한 discriminated union exhaustiveness 손실
  - 위치: `codebase/frontend/src/lib/api/auth.ts` — 삭제된 `isAccessTokenResponse`, `isTwoFactorChallenge` 함수
  - 상세: 기존 두 타입 가드는 `LoginResponseData` union의 두 멤버를 명시적으로 narrow해주어, 향후 서버가 새 variant를 추가할 때 TypeScript 컴파일러가 미처리 분기를 검출할 수 있는 구조였다. 삭제 후 인라인 `"accessToken" in payload` 패턴은 exhaustiveness 검사 없이 동작하므로, 서버 응답 스키마 변경 시 클라이언트 분기 누락이 런타임 오류로만 드러난다. 이는 직접적 보안 취약점은 아니나, 인증 흐름의 견고성과 감사 가능성을 낮춘다.
  - 제안: 타입 가드를 완전히 제거하기보다 `lib/api/auth.ts` 내 로컬 유틸로 유지하거나, 삭제 후 `login-form.tsx` 에서 `never` assertion을 사용한 exhaustive 분기를 추가한다.

- **[INFO]** `challengeToken` 노출 범위 — 로컬 상태 관리 적절성
  - 위치: `codebase/frontend/src/components/auth/login-form.tsx` L46 (`setChallengeToken(payload.challengeToken)`)
  - 상세: 변경 전후 모두 `challengeToken` 을 컴포넌트 state 에 저장하는 방식은 동일하다. 이 토큰이 React DevTools나 로그에 노출될 수 있는지 확인이 필요하다. 현재 변경된 코드 자체는 기존 동작을 유지하므로 신규 취약점은 아니지만, 2FA challenge token의 수명과 단일 사용(one-time use) 강제를 서버 측에서 보장하는지 점검이 권장된다.
  - 제안: challengeToken이 서버 측에서 단일 사용 후 무효화되고 만료 시간이 제한적인지 확인한다. 문서(spec/5-system/1-auth.md)에 해당 보장이 명시되어 있다면 현행 유지 가능.

- **[INFO]** `maxButtons` cap 하향 (10 → 5) — 서버사이드 검증과의 정합
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/shared/button-list-editor.tsx` L29
  - 상세: 프론트엔드 UI cap을 5로 낮추는 변경이다. 직접적인 보안 취약점은 아니지만, 클라이언트 사이드 cap은 우회 가능하므로 백엔드 `validateButtons`(`MAX_BUTTONS_PER_NODE = 5`)가 최종 방어선 역할을 한다. 변경 내용에 따르면 백엔드 validator도 동시에 5로 정렬되어 있어 이중 방어가 유지된다.
  - 제안: 현행 변경 방향 적절. 단, 소비자(consumer) 컴포넌트 중 `maxButtons={10}` 을 명시적으로 prop으로 전달하는 곳이 있다면 백엔드 cap을 우회하지는 않지만 의도된 UI 제한을 무력화하므로 해당 소비자를 함께 갱신해야 한다.

- **[INFO]** 에러 메시지 처리 — 민감 정보 노출 없음 확인
  - 위치: `codebase/frontend/src/components/auth/login-form.tsx` L59–61
  - 상세: 에러 핸들러가 `error.response?.data?.message ?? t("auth.login.genericFailed")` 를 사용해, 서버가 반환하는 `message` 필드를 그대로 클라이언트에 표시한다. 서버가 내부 구현 세부 정보(스택 트레이스, DB 오류 등)를 `message` 필드에 포함하지 않도록 서버 측 에러 포매팅이 제어되어야 한다. 변경 자체는 기존 동작과 동일하므로 신규 위험 추가는 없다.
  - 제안: 서버 응답의 `message` 필드가 사용자 친화적 메시지만 포함하도록 백엔드 레이어에서 필터링이 적용되어 있는지 확인한다.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 전체 변경 파일
  - 상세: 검토된 모든 변경 코드에서 API 키, 비밀번호, 토큰 등 하드코딩된 시크릿은 발견되지 않았다.

- **[INFO]** 의존성 변경 없음
  - 위치: 전체 변경 파일
  - 상세: 본 PR에서 새로운 외부 패키지가 추가되거나 기존 패키지 버전이 변경되지 않았다. `@simplewebauthn/browser` 등 기존 의존성의 기존 사용 방식을 유지한다.

## 요약

이번 변경의 보안 핵심은 인증 흐름(`login-form.tsx`)의 타입 가드 제거에 있다. 기존의 `isTwoFactorChallenge`/`isAccessTokenResponse` discriminated union 가드가 제거되고 인라인 `in` 연산자 기반 분기로 대체되면서, `accessToken` 이 응답에 없는 비정상 케이스에서 `completeLogin`이 조용히 건너뛰어지는 **silent auth failure** 경로가 생겼다. 이 경로에서는 사용자가 인증 완료 없이 앱에 머물거나 에러 없이 로그인 실패가 발생할 수 있다. 서버가 예상된 응답 구조를 항상 보장한다면 실질적 위험은 낮지만, 인증 흐름에서 예상치 못한 응답을 명시적으로 거부하는 방어 코드가 없다는 점은 WARNING 수준의 취약점으로 기록한다. 나머지 변경사항(버튼 cap, plan 문서, consistency review 파일)은 보안 관련 위험이 없다. 하드코딩된 시크릿, 입력 검증 우회, 인젝션 취약점, 암호화 문제는 발견되지 않았다.

## 위험도

LOW
