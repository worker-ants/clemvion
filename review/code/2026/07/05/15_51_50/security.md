# 보안(Security) Review — invite-accept-confirm-ui (register-form has_session redirect)

## 발견사항

- **[INFO]** `has_session` 힌트 쿠키 기반 redirect — 위조 가능하나 실질 피해 없음
  - 위치: `codebase/frontend/src/components/auth/register-form.tsx` L104-124 (`document.cookie.split("; ").includes("has_session=1")` → `router.replace(\`/invitations/accept?token=${encodeURIComponent(invitationToken)}\`)`)
  - 상세: `has_session` 은 `auth-store.ts` L36 이 로그인 시 심는 **non-httpOnly, 평문(`has_session=1`), 서명/서버검증 없는 힌트 쿠키**다. 공격자(또는 임의 JS/확장 프로그램)가 브라우저 콘솔에서 `document.cookie = "has_session=1"` 로 얼마든지 위조할 수 있다. 하지만 이 쿠키의 유일한 효과는 `router.replace("/invitations/accept?token=...")` 로 **클라이언트 사이드 라우팅**을 트리거하는 것뿐이다.
    - accept 페이지(`accept-invitation-content.tsx`)로 이동해도 실제 워크스페이스 합류는 `handleAccept` → `workspacesApi.acceptInvitation(token)` 서버 호출이 성공해야만 일어나며, 서버는 호출자의 실제 access token(쿠키 위조와 무관한 인증 헤더/세션)으로 인가를 재검증한다.
    - `has_session` 쿠키만 있고 실제 세션(access/refresh token)이 없으면, accept 페이지를 감싸는 `(main)` 라우트 그룹의 `AuthProvider`(하이드레이션 시 인증 실패 감지)가 `/login` 으로 되돌린다 — 코드 주석(L113-114)에도 이 폴백이 명시되어 있다.
    - 즉 위조로 얻을 수 있는 최대 효과는 "가입 폼 대신 잠깐 accept 페이지가 보였다가 /login 으로 튕기는" UX 노이즈이며, 데이터 노출·권한 상승·CSRF 유발 등 실질적 보안 영향은 없다.
  - 제안: 조치 불요. 다만 이 흐름이 순수 UX 라우팅 힌트이고 실제 authz 는 서버가 담당한다는 사실을 코드 주석(이미 일부 기술됨)이나 spec(`1-auth.md §1.5.3`)에 한 줄로 명시해 향후 리뷰어가 "쿠키 위조로 뭔가 가능한가" 를 반복 재검증하지 않도록 하면 좋다(선택 사항).

- **[INFO]** Open-redirect 벡터 없음 — redirect 대상이 고정 내부 경로
  - 위치: `register-form.tsx` L120-122
  - 상세: `router.replace` 의 대상 문자열은 `` `/invitations/accept?token=${encodeURIComponent(invitationToken)}` `` 로, 경로(`/invitations/accept`)는 소스코드에 하드코딩된 리터럴이며 사용자 제어 입력이 host/scheme/path 부분에 전혀 개입하지 않는다. `invitationToken` 값은 `encodeURIComponent` 로 인코딩된 뒤 `token` 쿼리 파라미터 **값**으로만 삽입되므로, 토큰에 `../`, `//evil.com`, `javascript:` 등을 넣어도 경로/호스트를 바꿀 수 없다(쿼리스트링 값 컨텍스트라 URL 파싱에 영향 없음). Next.js `useRouter().replace` 는 클라이언트 사이드 라우터라 외부 URL로도 나가지 않는다. Open-redirect 아님.
  - 제안: 조치 불요.

- **[INFO]** 동일 신호를 이미 신뢰 중인 `proxy.ts` 와의 일관성 — 새로운 신뢰 경계 도입 아님
  - 위치: `codebase/frontend/src/proxy.ts` L35-40 vs `register-form.tsx` L118
  - 상세: `proxy.ts` 는 이미 동일한 `has_session` 쿠키의 **존재 여부만으로** 보호된 전체 라우트(예: `/dashboard`, `/workspaces/**` 등 `publicPaths` 밖 전부)에 대한 접근을 허용하고, 없으면 `/login` 으로 강제 리다이렉트한다 — 즉 이 쿠키를 신뢰해 "보호된 페이지 렌더를 허용"하는 더 넓은 권한을 이미 부여받은 신호다. 이번 변경은 그보다 훨씬 좁은 범위(가입 폼 vs 수락-확인 폼 중 어느 UI를 보여줄지)에 같은 신호를 재사용할 뿐이라 새로운 공격 표면을 추가하지 않는다. 오히려 `proxy.ts` 신뢰 모델에 이미 의존하는 프로젝트 전체 관점에서 일관된 선택이다.
  - 제안: 조치 불요. (참고: `has_session` 을 신뢰하는 모든 지점—`proxy.ts`, `register-form.tsx`—모두 "실제 인가는 서버가 재검증한다"는 전제 위에 있으므로, 향후 이 쿠키를 신뢰하는 새 코드가 추가될 때도 같은 전제(서버측 재검증 필수)를 지키는지 리뷰 체크리스트에 남겨둘 만하다.)

- **[INFO]** 이메일 불일치 안내 메시지의 정보 노출 범위 — 정상
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` L145-151, i18n `mismatchHint` (`{{email}}` 치환)
  - 상세: 불일치 시 초대 대상 이메일(`meta.email`)을 화면에 노출하는데, 이 값은 이미 `GET /api/invitations/:token` (인증 불요, 토큰만 있으면 조회 가능한 공개 엔드포인트, `lib/api/invitations.ts` 주석에 "공개(인증 불요) 초대 토큰 API" 로 명시됨)으로 토큰 소유자에게 공개되는 값이라 추가 정보 노출이 아니다. 토큰 자체가 비밀이므로(추측 불가 base64url), 토큰을 아는 사람에게 그 초대가 어느 이메일로 발송됐는지 보여주는 것은 기존 설계상 허용된 범위다.
  - 제안: 조치 불요.

## 요약

이번 변경(`register-form.tsx` 의 `has_session` 쿠키 감지 → `/invitations/accept?token=` redirect)은 순수 클라이언트 UX 라우팅 힌트이며, 실제 인가는 accept 페이지의 `handleAccept`가 호출하는 서버 API(`workspacesApi.acceptInvitation`)와 `(main)` 라우트 그룹의 `AuthProvider` 하이드레이션이 담당한다. 쿠키는 non-httpOnly 이라 위조 가능하지만, 위조로 얻는 최대 효과는 "잠깐 다른 페이지가 보였다가 서버 인증 실패로 /login 으로 튕기는" UX 수준에 그치며 권한 상승·데이터 노출·세션 탈취 등의 실질 피해 경로가 없다. redirect 대상 경로는 하드코딩된 리터럴이고 토큰 값은 쿼리 파라미터 값 컨텍스트에만 `encodeURIComponent` 로 삽입되어 open-redirect 벡터도 없다. 또한 이 쿠키는 `proxy.ts` 가 이미 더 넓은 범위(전체 보호 라우트 접근 허용)에 대해 신뢰 중인 동일 신호이므로 새로운 신뢰 경계를 추가하는 것도 아니다. 이 changeset 에서 보안 관점의 실질 결함은 발견되지 않았다.

## 위험도

NONE
