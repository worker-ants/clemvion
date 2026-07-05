# Requirement Review — invite-accept-confirm-ui (fresh-review, 15_51_50)

FOCUS: 이전 라운드 MEDIUM 발견(register-form redirect 가 `(auth)` 라우트 그룹에서
하이드레이트되지 않는 `useAuthStore.isAuthenticated` 를 읽었던 문제)이 `has_session`
힌트 쿠키(`proxy.ts` 와 동일 신호, auth-store 가 로그인/로그아웃 시 set/clear)로 전환되어
해소됐는지 — 실제 cold-tab 이메일 링크 시나리오와 spec §1.5.3/§2.6 의도 충족 여부.

## 발견사항

- **[INFO]** MEDIUM 재발견 대상 수정 확인 — cold-tab 이메일 링크 시나리오에서 redirect 정상 작동
  - 위치: `codebase/frontend/src/components/auth/register-form.tsx` L104-124 (신규 `useEffect`), `codebase/frontend/src/components/auth/__tests__/register-form.test.tsx` L218-235
  - 상세: 이전 라운드에서 지적된 문제(`(auth)` 라우트 그룹엔 `AuthProvider` 가 없어 `useAuthStore.isAuthenticated`/`user` 가 절대 하이드레이트되지 않아 이미 로그인한 사용자를 감지 못함)가 실제로 해소됐다. 새 코드는 `document.cookie.split("; ").includes("has_session=1")` 로 판정하며, 이는 `proxy.ts` L35 `request.cookies.get("has_session")`(서버 측)와 동일한 신호를 클라이언트에서 읽는 것이다. `has_session` 쿠키는 `auth-store.ts` L36 `setAuthenticated()`(로그인 성공 시 set) / L45 `logout()`(로그아웃 시 clear) 에서 관리되므로, 로그인 상태와 무관하게 항상 `false` 를 반환하던 이전 로직과 달리 실제 신호를 담는다. 테스트(`register-form.test.tsx` L218-235)는 `useAuthStore` 를 mock 하지 않고 **실제 `document.cookie` 를 `has_session=1` 로 설정**한 입력을 넣고 `mockReplace("/invitations/accept?token=tok-9")` 호출을 검증한다 — 이는 mock 우회가 아니라 실제 cold-tab(새 탭, 세션 스토어 미하이드레이트, 쿠키만 존재) 시나리오를 정확히 재현한다. `beforeEach` 에서 쿠키를 매번 지워(L57-58) 테스트 간 누수도 방지했다. 실행 결과 19/19 통과(재확인).
  - 제안: 없음 — 수정이 의도대로 동작.

- **[INFO]** spec §1.5.3 / §2.6 본문과 line-level 일치
  - 위치: `spec/5-system/1-auth.md` L267 (`> **경로·진입**...`), `spec/2-navigation/10-auth-flow.md` L131 (`> **이미 로그인한 사용자의 진입 분기**...`) vs `register-form.tsx` L104-124 주석/구현
  - 상세: 두 spec 문서 모두 이번 PR 로 함께 갱신되어 "register 페이지가 `has_session` 힌트 쿠키로 기존 로그인을 감지 → `/invitations/accept?token=…` 로 즉시 리다이렉트 → 힌트가 stale 이면 accept 페이지의 라우트 가드(AuthProvider)가 `/login` 으로 되돌린다" 는 서술이 코드 주석(L109-114) 및 실제 동작(`accept-invitation-content.tsx` 가 `(main)` 그룹 하위라 `AuthProvider` 가 세션 복구 실패 시 `logout()`+redirect, `auth-provider.tsx` L44-53)과 정확히 일치한다. accept 페이지 자체는 `useAuthStore.getState().user?.email` 로 이메일 일치를 판정하는데(`accept-invitation-content.tsx` L63-64), 이 페이지는 `(main)` 그룹(`app/(main)/layout.tsx` 가 `AuthProvider` 로 감쌈)이라 하이드레이션이 보장되어 이전 MEDIUM 과 동일한 문제가 없다 — register-form(`(auth)` 그룹, hydration 없음)과 accept page(`(main)` 그룹, hydration 있음)의 비대칭이 의도적으로 반영돼 있다.
  - 제안: 없음 — 참고용 확인.

- **[WARNING]** `accept-invitation-content.tsx` 의 `handleLogout` 이 `has_session` 힌트 쿠키를 지우지 않아, 이번 PR 이 새로 그 쿠키를 신뢰하게 만든 redirect 판정과 실제 인증 상태가 로그아웃 직후 순간적으로 어긋난다
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` L102-111 (`handleLogout`), 대조: `codebase/frontend/src/lib/stores/auth-store.ts` L41-48 (`logout()` — `has_session` 쿠키 clear 포함)
  - 상세: `handleLogout` 은 `authApi.logout()`(서버) 호출 후 `setAccessToken(null)` + `useAuthStore.getState().setUser(null)` 만 호출한다. `setUser`(auth-store.ts L30) 는 `set({ user })` 만 하고 쿠키를 건드리지 않는다 — 쿠키 clear 는 store 의 `logout()` 액션(L41-48)에만 있다. 이 컴포넌트는 `logout()` 이 아니라 `setUser(null)` 을 호출하므로, mismatch 상태에서 [다른 계정으로 로그인] 버튼을 눌러 로그아웃해도 `has_session=1` 쿠키가 그대로 남는다. `git log -p` 로 확인한 결과 `handleLogout` 자체가 본 PR(`b477913c2`)에서 신규 도입된 함수로, 자동수락 시절엔 로그아웃 버튼이 아예 없었다 — 즉 이 gap 은 새 코드다. 실질 영향: 이 세션에서 다시 초대 메일 링크(`/auth/register?invitationToken=…`)를 새 탭에서 열면, 서버 refresh 토큰은 이미 무효화됐음에도 stale `has_session=1` 로 인해 register-form 이 `/invitations/accept?token=…` 로 즉시 redirect 하고, 그 페이지의 `AuthProvider` 가 refresh 시도 실패 → 그제서야 진짜 `logout()`(쿠키 clear 포함) + `/login` redirect. 서버 측 인가 경계(refresh 토큰)는 깨지지 않으므로 보안 이슈는 아니지만, 코드 주석이 명시한 "stale 힌트는 accept 페이지 라우트 가드가 되돌린다" fallback 이 **이 PR 자신의 새 로그아웃 버튼이 만든 self-inflicted staleness** 로 매번 발동하게 되어 불필요한 리다이렉트 홉(깜빡임)이 생긴다. `authApi.logout()` 자체가 실패해도 클라이언트 세션 정리는 항상 수행해야 한다는 기존 설계 의도(주석 L106 "로그아웃 요청이 실패해도 클라이언트 세션은 정리")와도, `has_session` 쿠키가 "클라이언트 세션 정리"의 일부라는 점에서 어긋난다.
  - 제안: `setUser(null)` 대신 `useAuthStore.getState().logout()` 을 호출(내부적으로 `setAccessToken(null)` 도 수행하므로 별도 `setAccessToken(null)` 호출 제거 가능) — 이렇게 하면 `has_session` 쿠키가 즉시 정확한 상태를 반영해 이 PR 이 새로 부여한 신뢰(register-form redirect 판정)와의 정합성이 완전해진다.

- **[INFO]** 클라이언트 이메일 일치 검사는 게이팅일 뿐 서버 재검증 — spec 명시와 일치
  - 위치: `accept-invitation-content.tsx` L84-85 `workspacesApi.acceptInvitation(token)`, spec `1-auth.md` L692 "토큰 단독으로는 권한 획득이 불가능... 수락 시 서버가 로그인 사용자의 이메일과 토큰 이메일 일치를 강제"
  - 상세: `handleAccept` 은 클라이언트가 `ready` 로 판정한 뒤에만 노출되는 버튼에서 호출되지만, 실제 인가는 서버 `POST /api/workspaces/invitations/accept` 가 담당하므로 클라이언트 판정(쿠키/스토어 상태 오판)이 있어도 보안 경계는 서버가 유지한다. CHANGELOG L39 서술과 일치.
  - 제안: 없음.

## 요약

이전 라운드 MEDIUM 으로 지적된 register-form 의 `(auth)` 그룹 미하이드레이트 `useAuthStore` 오독 문제는 `has_session` 힌트 쿠키로의 전환으로 실질적으로 해소됐다 — 실제 cold-tab 시나리오(스토어 미하이드레이트 + 쿠키만 존재)를 mock 우회 없이 재현하는 테스트가 통과하며, spec §1.5.3/§2.6 본문이 코드와 line-level 로 일치하도록 함께 갱신되었다(register-form 은 hydration 없는 `(auth)` 그룹이라 쿠키 판정, accept page 는 hydration 있는 `(main)` 그룹이라 스토어 판정 — 이 비대칭이 의도적이고 정확히 문서화됨). 다만 이번 PR 이 신규 도입한 `accept-invitation-content.tsx` 의 `handleLogout` 이 store 의 `logout()` 대신 `setUser(null)` 만 호출해 `has_session` 쿠키를 지우지 않는 gap 을 발견했다 — 보안 경계(서버 refresh 토큰 무효화)는 깨지지 않으나, 이 PR 자신이 새로 `has_session` 을 redirect 판정의 신뢰 신호로 격상시킨 만큼 쿠키-상태 정합성을 완전히 맞추는 편이 안전하고, 코드 한 줄(`logout()` 호출로 교체)로 해결 가능한 WARNING 이다.

## 위험도

LOW
