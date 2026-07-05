# Requirement Review — invite-accept-confirm-ui (V-09 §1.5.3, 재검토 15_33_01)

## 발견사항

- **[WARNING]** 로그인 상태 rehydration 타이밍 문제로 "이미 로그인한 사용자 → accept 페이지 redirect" 가 실제 앱에서 발화하지 않을 수 있음 (V-09 의 핵심 목적 자체가 무력화될 가능성)
  - 위치: `codebase/frontend/src/components/auth/register-form.tsx:105-114` (`useEffect` — `useAuthStore.getState().isAuthenticated` 를 검사해 `/invitations/accept?token=` 로 `router.replace`), `codebase/frontend/src/lib/stores/auth-store.ts:25-28` (`isAuthenticated: false` 기본값, persist 없음), `codebase/frontend/src/app/(auth)/layout.tsx` (register 페이지가 속한 `(auth)` 레이아웃에는 `AuthProvider` 가 없음 — `codebase/frontend/src/components/auth/auth-provider.tsx` 가 세션을 쿠키로부터 복원하는 지점은 오직 `(main)` 레이아웃), `codebase/frontend/src/components/auth/__tests__/register-form.test.tsx:57-58,451-469` (테스트가 `useAuthStore.setState({isAuthenticated:true, ...})` 로 직접 주입해 rehydration 타이밍을 우회)
  - 상세: `useAuthStore` 의 `isAuthenticated` 는 in-memory 상태이며 초기값이 `false` 이고 persist 되지 않는다. 실제 로그인 여부는 `AuthProvider`(`(main)` 레이아웃 전용)가 마운트 시 `refreshAccessToken()` (HttpOnly 쿠키 기반) 을 호출해 세션을 복원한 뒤에야 `isAuthenticated: true` 로 갱신된다. 그런데 register 페이지는 `(auth)` 레이아웃(`codebase/frontend/src/app/(auth)/layout.tsx`) 아래에 있고, 이 레이아웃은 `AuthProvider` 를 포함하지 않는다 — 즉 사용자가 초대 메일 링크(`/auth/register?invitationToken=...`)를 새 탭/새 브라우저 컨텍스트에서 클릭해 진입하는, spec §1.5.3 이 상정하는 정확히 그 시나리오에서는 `isAuthenticated` 가 세션 복원 없이 기본값 `false` 그대로다. 새로 추가된 `useEffect`(register-form.tsx:105-114)는 mount 시 그 스냅샷만 확인하고 세션 복원을 기다리지 않으므로, 실제로 로그인되어 있는 사용자라도 redirect 가 발화하지 않고 그대로 미가입자 가입 폼이 렌더된다. `register-form.test.tsx` 의 신규 테스트(V-09 entry)는 `useAuthStore.setState` 로 `isAuthenticated: true` 를 직접 주입해 이 rehydration 타이밍 이슈를 우회하므로 실제 앱 구성(레이아웃 트리)에서 이 조건이 성립하는지 검증하지 않는다.
  - 제안: (a) register 페이지 진입 시에도 세션 복원을 보장하도록 하거나(예: `(auth)` 레이아웃에도 경량 세션 확인을 두거나, `RegisterFormInner` 의 redirect effect 가 `useAuthStore.getState().isLoading`/세션 복원 완료를 기다리도록 수정), 또는 (b) 서버사이드에서 쿠키 유무를 판별해 register 페이지 자체를 SSR/미들웨어 단에서 리다이렉트하는 방식으로 전환. 최소한 review 상에서는 실제 레이아웃 트리를 통과하는 통합/e2e 테스트(mock 이 아닌)로 이 경로가 실제 발화하는지 별도 검증 필요.

- **[WARNING]** 익명(비로그인) 방문자가 `/invitations/accept?token=` 에 직접 진입하는 경로가 실제로는 `AuthProvider` 에 의해 `/login` 으로 튕기며 그 과정에서 `token` 쿼리 파라미터가 유실된다 — "이메일 불일치" 로 처리된다는 테스트 가정이 실제 라우팅과 다르다
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` (accept 페이지는 `(main)` 라우트 그룹 — `codebase/frontend/src/app/(main)/layout.tsx` 가 `AuthProvider` 로 감쌈), `codebase/frontend/src/components/auth/auth-provider.tsx:44-53` (세션 복원 실패 시 `router.replace(\`/login?redirect=${encodeURIComponent(pathname)}\`)` — `usePathname()` 은 쿼리 스트링을 포함하지 않으므로 `token` 값이 유실됨), `codebase/frontend/src/components/auth/login-form.tsx:85` (`redirect` 쿼리 파라미터를 전혀 읽지 않고 로그인 성공 시 항상 `/dashboard` 로 push), `codebase/frontend/src/app/(main)/invitations/accept/__tests__/accept-invitation-content.test.tsx:188-199` ("treats a logged-out (anonymous) visitor as mismatch" 테스트)
  - 상세: 신규 테스트는 `AcceptInvitationContent` 컴포넌트를 단독 렌더하여 `mockUser = null` 일 때 "mismatch" 상태(로그아웃 버튼 노출)가 뜨는 것을 검증한다. 그러나 실제 앱에서 이 컴포넌트는 `(main)` 레이아웃 하위에만 존재하고, 그 레이아웃의 `AuthProvider` 는 세션 복원 실패(=비로그인) 시 컴포넌트가 렌더되기도 전에 `/login?redirect=/invitations/accept` 로 리다이렉트한다 — 이때 `redirect` 값은 `usePathname()` 기반이라 쿼리 스트링(`?token=...`)을 포함하지 않는다. 게다가 `login-form.tsx` 는 그 `redirect` 파라미터 자체를 읽지 않고 로그인 성공 후 무조건 `/dashboard` 로 이동한다. 결과적으로 익명 방문자가 accept 링크로 직접 진입하면: (1) `AcceptInvitationContent` 는 렌더되지 않고 로그인 페이지로 튕기며, (2) 로그인에 성공해도 초대 토큰 정보가 사라진 채 대시보드로 이동해 초대를 수락할 방법이 없다. 이는 spec §1.5.3 이 "미로그인 사용자는 §1.5.2 가입 경로를 따른다" 고 규정한 취지와도 어긋난다 — §1.5.2 가입 경로는 애초에 `/auth/register?invitationToken=` 링크를 전제하는데, 만약 실사용자가 (구형 북마크·직접 URL 조작 등으로) `/invitations/accept?token=` 에 비로그인 상태로 진입하면 어느 경로로도 안내받지 못하고 초대 컨텍스트를 잃는다. 테스트가 검증하는 "mismatch" 분기는 컴포넌트 단위로는 정확하지만, 실제 통합된 라우팅 트리에서는 도달 불가능한 코드 경로일 가능성이 높다(이전 회차 requirement.md 도 "이 페이지는 로그인 사용자만 도달" 이라고 전제했으나, 그 근거를 실제 `AuthProvider`/`login-form` redirect 체인까지 추적하지 않았음 — 확인 결과 그 전제가 깨진다).
  - 제안: 우선순위 낮은 edge case 이나(초대 메일은 항상 `/auth/register` 를 가리키므로 정상 플로우에서는 발생 안 함), 방어적으로 처리하려면 (a) `AuthProvider` 의 미인증 redirect 가 쿼리 스트링까지 보존하도록 수정하거나(`usePathname()` 대신 `useSearchParams()` 결합, 또는 `window.location.search` 사용), (b) `login-form.tsx` 가 `redirect` 쿼리를 실제로 사용하도록 수정. 최소한 이 gap 을 알고 있다는 근거를 코드 주석이나 plan 후속 항목으로 남길 것을 권장.

- **[INFO]** `[SPEC-DRIFT]` 아님 — spec §1.5.3 "경로·진입" 인용문은 이번 배치에서 갱신되어 핵심 흐름(로그인 사용자 감지 → redirect, URL/쿼리 파라미터명 `token`)과 코드가 line-level 로 일치함
  - 위치: `spec/5-system/1-auth.md:267`, `codebase/frontend/src/components/auth/register-form.tsx:109-112`
  - 상세: `router.replace(\`/invitations/accept?token=${encodeURIComponent(invitationToken)}\`)` 이 spec 문구("수락 페이지는 `/invitations/accept?token=<초대토큰>`")와 정확히 일치한다. 다만 spec 은 "이미 로그인한 사용자가 이 링크로 진입하면 register 페이지가 로그인 상태를 감지" 라고만 서술해 세션 rehydration 타이밍 문제(위 WARNING)까지는 다루지 않는다 — spec 자체의 결함이라기보다는 spec 이 전제하는 "로그인 상태 감지"가 실제로는 타이밍에 따라 실패할 수 있다는 구현 갭이다.

- **[INFO]** 나머지 기능 요소(에러 코드·상태 전이·i18n 키·410 처리·자동수락 제거→명시적 확인 버튼)는 spec §1.5.1~§1.5.4 및 §1.5.4 에러 테이블과 line-level 로 일치
  - 위치: `codebase/frontend/src/lib/api/invitations.ts:31-36`(`INVITATION_ERROR` 상수가 spec §1.5.4 4개 코드와 정확히 일치), `accept-invitation-content.tsx` 의 `loading→ready|mismatch|accepting→success|error|missing` 상태 전이, i18n `mismatchTitle`/`mismatchHint`/`logoutAndSwitch` 키(en/ko 양쪽 정의·사용처 일치)
  - 상세: 이전 회차(15_20_19) requirement 리뷰가 이미 확인한 사항이며 본 재검토에서도 재확인했다 — 이 부분은 이견 없음.

- **[INFO]** TODO/FIXME/HACK/XXX 주석 없음. 반환값 누락 없음(모든 분기가 status 를 설정하거나 명시적으로 조기 반환)
  - 위치: 리뷰 대상 전체 파일
  - 상세: `grep -n "TODO\|FIXME\|HACK\|XXX"` 결과 해당 diff 범위에는 없음. `handleAccept`/`handleLogout`/useEffect 모두 모든 코드 경로에서 상태 갱신 또는 명시적 no-op(`if (!token) return;`)으로 종료된다.

## 요약

이번 재검토(15_33_01)는 이전 회차(15_20_19)가 "이미 확인 완료(NONE)"로 종결한 §1.5.3 진입 경로 요구사항을 실제 레이아웃/라우팅 트리(`AuthProvider`, `(auth)` vs `(main)` 레이아웃, `login-form.tsx`)까지 추적해 재검증했다. 그 결과 두 가지 실질적 갭을 새로 발견했다: (1) register-form 의 "로그인 사용자 감지 → accept 페이지 redirect" 가 세션 rehydration 이 완료되지 않은 시점(새 탭/새 컨텍스트로 메일 링크 클릭 — spec 이 상정하는 바로 그 시나리오)에는 `isAuthenticated` 기본값 `false` 때문에 발화하지 않을 수 있다. (2) 익명 방문자가 accept 페이지에 직접 진입하는 경우 컴포넌트 테스트가 가정하는 "mismatch 안내" 화면이 아니라 `AuthProvider` 가 먼저 `/login` 으로 리다이렉트하며 그 과정에서 `token` 쿼리 파라미터가 유실되어(로그인 후에도) 초대 컨텍스트가 사라진다. 두 문제 모두 유닛 테스트가 `useAuthStore.setState`/mock 으로 직접 상태를 주입해 실제 레이아웃 합성 순서를 우회하기 때문에 테스트로는 드러나지 않는다. 그 외 에러 코드·상태 전이·i18n·spec §1.5.3 문구와의 line-level 일치는 양호하며 TODO/FIXME 등 미완성 흔적도 없다.

## 위험도

MEDIUM
