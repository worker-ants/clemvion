# 보안(Security) Review

리뷰 대상: 초대 수락 확인 UI(§1.5.3) — `accept-invitation-content.tsx`(+test), `register-form.tsx`(+test) 로그인 감지 리다이렉트, i18n 키 추가. 관련 spec `spec/5-system/1-auth.md` §1.5 갱신.

## 발견사항

- **[INFO]** 클라이언트측 이메일 일치 검사는 UX 게이팅일 뿐 — 서버 재검증 의존이 설계상 명확함
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx:393-394` (`setStatus(userEmail && userEmail === m.email ? "ready" : "mismatch")`), `handleAccept` → `workspacesApi.acceptInvitation(token)`
  - 상세: `[수락]` 버튼 노출 여부는 프론트엔드 state(`useAuthStore.getState().user?.email`)로만 판단한다. 공격자가 devtools/React state 조작으로 mismatch 상태를 우회해 `handleAccept`를 강제 호출해도, 실제 워크스페이스 합류 여부는 `POST /api/workspaces/invitations/accept`가 결정한다. spec §1.5.3에 "서버 검증: 토큰 유효 + 본인 이메일 = 토큰 이메일"이 명시되어 있고, 이는 클라이언트 UI 우회를 안전하게 무력화하는 정상적인 defense-in-depth 구조다. 코드 자체에는 결함이 없으나, 서버측 `acceptInvitation` 핸들러가 실제로 이 재검증을 수행하는지는 이번 diff 범위 밖(백엔드 미변경)이라 별도 확인 대상으로 남긴다.
  - 제안: 조치 불필요(정보 제공 목적). 백엔드 회귀 시 이 재검증 로직이 유지되는지 별도 스탠딩 체크 권장.

- **[INFO]** 초대 메타 조회(GET /invitations/:token)는 인증 불요 — 토큰 보유자에게 이메일 평문 노출
  - 위치: `codebase/frontend/src/lib/api/invitations.ts:20-28`, `accept-invitation-content.tsx:391` (`invitationsApi.getByToken(token)`)
  - 상세: 토큰만 있으면 `workspaceName`/`invitedByName`/`email`/`role`이 인증 없이 조회된다. 이는 이번 PR이 도입한 것이 아니라 기존 §1.5.2 가입 prefill 흐름에 이미 존재하던 설계(공개 API)이며, 토큰 자체가 `crypto.randomBytes(48)` 기반 추측 불가 값(spec §1.5.1)이라 위험은 낮다. 이번 변경(§1.5.3 mismatch 배너)이 추가로 `meta.email`을 화면에 노출하지만, 이미 URL 쿼리 파라미터로 토큰을 쥔 사용자(즉 메일함 접근자 또는 링크 전달받은 자)에게만 해당하므로 추가 노출 표면은 미미하다.
  - 제안: 조치 불필요. 기존 설계의 연장.

- **[INFO]** 토큰 값 URL 인코딩 처리 적절
  - 위치: `codebase/frontend/src/lib/api/invitations.ts:24` (`encodeURIComponent(token)`), `register-form.tsx:1036` (`encodeURIComponent(invitationToken)`)
  - 상세: path/query에 삽입되는 토큰 값 모두 `encodeURIComponent`로 이스케이프되어 경로 조작(path traversal)이나 쿼리 파라미터 인젝션 우려가 없다. `useSearchParams().get("token")`으로 읽은 원시 값도 URL API를 거쳐 안전하게 파싱되며, React가 JSX 텍스트 바인딩을 자동 이스케이프하므로 XSS 벡터도 없다(`meta.email`, `meta.workspaceName` 등은 모두 텍스트 노드로만 렌더링, `dangerouslySetInnerHTML` 미사용).
  - 제안: 조치 불필요.

- **[INFO]** 로그아웃 처리 — 서버 실패와 무관하게 클라이언트 세션 강제 정리, 순서도 적절
  - 위치: `accept-invitation-content.tsx:433-442` (`handleLogout`)
  - 상세: `authApi.logout()` 실패를 catch로 무시하고도 `setAccessToken(null)` → `useAuthStore.getState().setUser(null)` → `router.push("/login")` 순으로 항상 클라이언트측 인증 상태를 지운다. 서버 revoke가 실패해도 최소한 로컬 세션(메모리 access token, store)은 확실히 비워지고 로그인 화면으로 강제 이동하므로, "로그아웃 눌렀는데 여전히 다른 사람 워크스페이스 컨텍스트에 남아있는" 류의 세션 혼동을 방지한다. 다만 서버 refresh 쿠키 revoke가 실패한 경우 이론상 refresh 토큰 자체는 서버에 살아있을 수 있으나 — 이는 `authApi.logout` 백엔드 구현의 책임 범위이며 이번 diff 범위 밖이다.
  - 제안: 조치 불필요.

- **[INFO]** register-form의 로그인 상태 감지 리다이렉트 — 오픈 리다이렉트 없음
  - 위치: `codebase/frontend/src/components/auth/register-form.tsx:1030-1039`
  - 상세: `router.replace(\`/invitations/accept?token=${encodeURIComponent(invitationToken)}\`)`로 리다이렉트 대상이 앱 내부 고정 경로(`/invitations/accept`)이고 쿼리 값만 사용자 제어이므로 오픈 리다이렉트(임의 외부 URL로의 리다이렉트) 벡터가 없다. `invitationToken`은 컴포넌트 prop으로 서버 컴포넌트/라우트 파라미터에서 전달되는 문자열이며 스킴/호스트를 포함하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** i18n 메시지 삽입값(`{{email}}`, `{{workspace}}`) — 템플릿 치환 안전
  - 위치: `codebase/frontend/src/lib/i18n/dict/en/invitations.ts`, `ko/invitations.ts`의 `mismatchHint`/`message` 키, 사용처 `accept-invitation-content.tsx:452-455,480-482`
  - 상세: `translate(locale, key, { email: meta.email })` 형태로 서버가 내려준 `meta.email`(초대 시점에 관리자가 입력한 이메일 문자열)을 그대로 템플릿에 주입하지만, React 렌더 경로를 통해 텍스트로만 출력되므로 HTML/스크립트 인젝션 경로는 없다. `email` 값 자체는 서버측 이메일 형식 검증을 거친 값으로 추정(백엔드 invite 발송 시 검증)되어 위험도가 낮다.
  - 제안: 조치 불필요.

- **[INFO]** 에러 메시지에 서버 원문(`error.response?.data?.message`)을 그대로 노출
  - 위치: `accept-invitation-content.tsx:400-403`, `register-form.tsx` (`extractApiMessage`)
  - 상세: 백엔드가 내려주는 메시지를 별도 필터링 없이 화면에 그대로 표시한다. 이 패턴은 기존 코드에도 있던 것으로(이번 diff가 새로 도입한 것이 아님), 스택트레이스나 내부 경로 등 민감정보 노출은 GlobalExceptionFilter가 컨트롤하는 서버측 책임이다. 클라이언트 코드 자체에는 결함 없음.
  - 제안: 조치 불필요. (참고: 서버측에서 이 경로로 내부 정보가 새지 않는지는 백엔드 리뷰 범위)

- **[INFO]** 테스트 코드의 목(mock) 데이터 — 하드코딩된 시크릿 아님
  - 위치: `accept-invitation-content.test.tsx`, `register-form.test.tsx` (`"tok-1"`, `VALID_TOKEN = "a".repeat(64)`, `"x@y.com"` 등)
  - 상세: 모두 테스트 전용 mock 토큰/이메일이며 실제 자격증명이나 프로덕션 시크릿이 아니다.
  - 제안: 조치 불필요.

## 요약

이번 변경은 §1.5.3 "이미 가입한 사용자가 다른 워크스페이스에 초대된 흐름"의 프론트엔드 UI(수락 버튼/불일치 안내/로그아웃)와 그 진입 경로(register 폼의 로그인 감지 리다이렉트)를 구현한다. 토큰은 모든 API 호출 지점에서 `encodeURIComponent`로 적절히 이스케이프되고, React의 자동 이스케이프 덕에 XSS 벡터가 없으며, 리다이렉트 대상이 앱 내부 고정 경로라 오픈 리다이렉트 위험도 없다. 클라이언트측 이메일 일치 판정은 순수 UX 게이팅이고 실제 인가는 서버(`POST /api/workspaces/invitations/accept`)가 재검증하는 구조로 spec에 명시되어 있어, 이 계층 분리가 코드에도 정확히 반영되어 있다. 하드코딩된 시크릿, 인젝션, 안전하지 않은 암호화, 인증 우회 가능성 등 CRITICAL/WARNING 급 이슈는 발견되지 않았다. 다만 (a) 서버측 `acceptInvitation`이 실제로 이메일 재검증을 수행하는지, (b) `authApi.logout` 서버 구현이 refresh 쿠키를 확실히 revoke하는지는 이번 diff 범위(프론트엔드) 밖이므로 별도 확인이 필요하다.

## 위험도

NONE
