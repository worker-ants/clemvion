# 보안(Security) Review

리뷰 대상: 초대 수락 확인 UI(§1.5.3) — `accept-invitation-content.tsx`(+test), `register-form.tsx`(+test) 로그인 감지 리다이렉트, i18n 키 추가(en/ko), `spec/5-system/1-auth.md` §1.5.3 진입 경로 문서화. 나머지 파일(`plan/**`, `review/code/2026/07/05/15_20_19/**`, `review/consistency/2026/07/05/14_54_13/**`)은 이전 세션 산출물/플랜 트래킹 문서로 실행 코드가 아니다.

본 세션(`15_33_01`)의 실질 코드 diff(파일 1~6)는 직전 세션(`review/code/2026/07/05/15_20_19`)에서 이미 보안 리뷰(위험도 NONE)를 마친 동일 changeset이다. 재확인 결과 그 판단을 변경할 신규 취약점은 발견되지 않았다.

## 발견사항

- **[INFO]** 클라이언트측 이메일 일치 검사는 UX 게이팅일 뿐 — 서버 재검증에 의존하는 구조가 코드에 정확히 반영됨
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` (`setStatus(userEmail && userEmail === m.email ? "ready" : "mismatch")`), `handleAccept` → `workspacesApi.acceptInvitation(token)`
  - 상세: `[수락]` 버튼 노출 여부는 프론트엔드 state(`useAuthStore.getState().user?.email`)로만 판단한다. devtools/React state 조작으로 mismatch 상태를 우회해 `handleAccept`를 강제 호출해도, 실제 워크스페이스 합류 여부는 `POST /api/workspaces/invitations/accept` 서버 핸들러가 결정한다. spec §1.5.3 은 "서버 검증: 토큰 유효 + 본인 이메일 = 토큰 이메일"을 명시하고 있어 클라이언트 UI 우회를 안전하게 무력화하는 defense-in-depth 구조다. 다만 서버측 `acceptInvitation` 핸들러가 실제로 이 재검증을 수행하는지는 이번 diff 범위(프론트엔드) 밖이라 백엔드 코드 확인이 필요한 영역으로 남는다.
  - 제안: 조치 불요(정보 제공). 백엔드 회귀 발생 시 이 서버측 이메일 재검증 로직이 유지되는지 별도 스탠딩 체크 권장.

- **[INFO]** 초대 메타 조회(`GET /invitations/:token`)는 인증 불요 — 토큰 보유자에게 이메일 평문 노출(기존 설계 연장)
  - 위치: `codebase/frontend/src/lib/api/invitations.ts`, `accept-invitation-content.tsx` (`invitationsApi.getByToken(token)`)
  - 상세: 토큰만 있으면 `workspaceName`/`invitedByName`/`email`/`role`이 인증 없이 조회된다. 이번 PR이 새로 도입한 설계가 아니라 기존 §1.5.2 가입 prefill 흐름에 이미 존재하던 공개 API이며, 토큰 자체가 추측 불가 값(spec §1.5.1, `crypto.randomBytes` 기반)이라 위험은 낮다. 이번 변경(mismatch 안내 배너)이 추가로 `meta.email`을 화면에 노출하지만, 이미 URL 쿼리로 토큰을 쥔 사용자(메일함 접근자/링크 전달자)에게만 해당하므로 추가 노출 표면은 미미하다.
  - 제안: 조치 불요.

- **[INFO]** 토큰 값 URL 인코딩 및 렌더링 이스케이프 — 인젝션/XSS 벡터 없음
  - 위치: `codebase/frontend/src/lib/api/invitations.ts` (`encodeURIComponent(token)`), `register-form.tsx` (`encodeURIComponent(invitationToken)`)
  - 상세: path/query 에 삽입되는 토큰 값이 모두 `encodeURIComponent`로 이스케이프되어 경로 조작이나 쿼리 인젝션 우려가 없다. `meta.email`/`meta.workspaceName` 등 서버 응답 문자열은 모두 JSX 텍스트 노드로만 렌더링되고(`dangerouslySetInnerHTML` 미사용) React 의 자동 이스케이프가 적용되어 XSS 벡터가 없다.
  - 제안: 조치 불요.

- **[INFO]** register-form 의 로그인 상태 감지 리다이렉트 — 오픈 리다이렉트 없음
  - 위치: `codebase/frontend/src/components/auth/register-form.tsx` (`router.replace(\`/invitations/accept?token=${encodeURIComponent(invitationToken)}\`)`)
  - 상세: 리다이렉트 대상이 앱 내부 고정 경로(`/invitations/accept`)이고 쿼리 값만 사용자 제어이므로 임의 외부 URL 로의 오픈 리다이렉트 벡터가 없다. `invitationToken`은 컴포넌트 prop 으로 전달되는 문자열이며 스킴/호스트를 포함하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 로그아웃 처리 — 서버 실패와 무관하게 클라이언트 세션 강제 정리
  - 위치: `accept-invitation-content.tsx` (`handleLogout`: `catch {}` → `setAccessToken(null)` → `useAuthStore.getState().setUser(null)` → `router.push("/login")`)
  - 상세: `authApi.logout()` 실패를 삼키더라도 로컬 access token/store 는 항상 정리되고 로그인 화면으로 강제 이동하므로 "로그아웃했지만 다른 사용자 워크스페이스 컨텍스트에 남아있는" 세션 혼동을 방지한다. 서버측 refresh 쿠키 revoke 실패 시 이론상 refresh 토큰이 서버에 남아있을 수 있으나, 이는 `authApi.logout` 백엔드 구현 책임이며 이번 diff 범위 밖이다.
  - 제안: 조치 불요.

- **[INFO]** i18n 템플릿 치환값(`{{email}}`, `{{workspace}}`) — 안전한 텍스트 렌더링
  - 위치: `codebase/frontend/src/lib/i18n/dict/en/invitations.ts`, `dict/ko/invitations.ts` 의 `mismatchHint`/`message` 키
  - 상세: `translate(locale, key, { email: meta.email })` 형태로 서버 응답값을 템플릿에 주입하지만 React 텍스트 렌더링 경로만 사용하므로 HTML/스크립트 인젝션 경로가 없다.
  - 제안: 조치 불요.

- **[INFO]** 에러 메시지에 서버 원문(`error.response?.data?.message`)을 그대로 노출 — 기존 패턴, 백엔드 책임
  - 위치: `accept-invitation-content.tsx` (useEffect catch, `handleAccept` catch), `register-form.tsx` (`extractApiMessage`)
  - 상세: 백엔드가 내려주는 메시지를 필터링 없이 화면에 표시하는 패턴은 이번 diff 가 새로 도입한 것이 아니다. 스택트레이스·내부 경로 등 민감정보가 이 필드에 섞이지 않도록 하는 것은 서버측 `GlobalExceptionFilter` 책임이며, 클라이언트 코드 자체에는 결함이 없다.
  - 제안: 조치 불요(백엔드 회귀 시 별도 확인 권장).

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 테스트 파일(`accept-invitation-content.test.tsx`, `register-form.test.tsx`)의 `"tok-1"`, `VALID_TOKEN = "a".repeat(64)`, `"x@y.com"`, `spec/5-system/1-auth.md` 신규 문단
  - 상세: 모두 테스트 전용 mock 값이거나 문서 예시로 실제 자격증명·API 키·프로덕션 시크릿이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 인증/인가 상태 전이 로직 — race 없음, 진입 경로 가드 정합
  - 위치: `register-form.tsx` 신규 `useEffect`(mount 시 `isAuthenticated` 1회 검사), `accept-invitation-content.tsx` 신규 `useEffect`(mount 시 `user?.email` 1회 스냅샷)
  - 상세: `RegisterFormInner`는 `AuthProvider`가 세션 복원(hydration)을 마친 뒤에만 마운트되므로 mount 시점의 `isAuthenticated` 스냅샷은 확정값이다. `accept-invitation-content.tsx`는 `(main)` 인증 라우트 그룹 하위라 마운트 시점엔 이미 인증 가드를 통과한 사용자만 도달한다. 두 effect 모두 unmount 후 setState 를 막는 `cancelled` cleanup 가드가 적용되어 있어(이번 세션의 WARNING 조치 항목, `RESOLUTION.md` 확인) 메모리/state 경쟁 이슈도 없다.
  - 제안: 조치 불요.

## 요약

이번 changeset은 §1.5.3 "이미 가입한 사용자가 다른 워크스페이스에 초대된 흐름"의 프론트엔드 UI(수락 버튼/불일치 안내/로그아웃)와 그 진입 경로(register 폼의 로그인 감지 → `/invitations/accept` 리다이렉트)를 구현하며, 관련 spec 문서(`1-auth.md`)의 진입 경로 각주와 code 매핑을 동반 갱신한다. 실질 코드 diff는 직전 세션(`review/code/2026/07/05/15_20_19/security.md`)에서 이미 위험도 NONE으로 리뷰를 마쳤고, 본 세션 재검토에서도 그 판단을 뒤집을 신규 취약점은 없다. 토큰은 모든 경로에서 `encodeURIComponent`로 이스케이프되고, React 자동 이스케이프로 XSS 벡터가 없으며, 리다이렉트 대상이 내부 고정 경로라 오픈 리다이렉트 위험도 없다. 클라이언트측 이메일 일치 판정은 순수 UX 게이팅이고 실제 인가는 서버(`POST /api/workspaces/invitations/accept`)가 재검증하는 구조가 spec에 명시되어 있어 계층 분리가 코드에도 정확히 반영되어 있다. 하드코딩된 시크릿, SQL/커맨드/경로 인젝션, 안전하지 않은 암호화, 인증 우회 가능성 등 CRITICAL/WARNING 급 이슈는 발견되지 않았다. 다만 (a) 서버측 `acceptInvitation`의 이메일 재검증 실제 구현, (b) `authApi.logout` 서버측 refresh 쿠키 revoke 여부는 이번 diff 범위(프론트엔드) 밖이므로 백엔드 코드 리뷰 시 별도 확인이 필요하다.

## 위험도

NONE
