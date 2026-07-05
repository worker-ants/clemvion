# 보안(Security) Review — logout 시 has_session 쿠키 정리 (FOCUS)

FOCUS: logout now clears the has_session cookie via store logout(). 이 변경이 stale session
hint 를 남기지 않는 net 보안 개선인지, 회귀는 없는지 확인.

## 조사 방법 메모

이번 security review 프롬프트(`_prompts/security.md`)에 첨부된 13개 "변경된 파일" 섹션은 전부
`review/consistency/2026/07/05/{15_33_01,15_51_50}/**` 산출물 markdown 5건과
`spec/2-navigation/10-auth-flow.md`·`spec/5-system/1-auth.md` 2건뿐이며, FOCUS 가 실제로 가리키는
코드(`codebase/frontend/src/lib/stores/auth-store.ts`,
`codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx`,
`codebase/frontend/src/components/auth/register-form.tsx`, `codebase/frontend/src/proxy.ts`)의
diff 는 하나도 포함되어 있지 않았다. 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/invite-accept-confirm-ui-c51e95`)를
직접 읽고 `git diff origin/main -- codebase/frontend/src/lib/stores/auth-store.ts` 로 diff 유무를
확인해 근거를 확보했다.

## 발견사항

- **[INFO]** `has_session` 쿠키 clear 로직 자체는 이번 PR diff 범위 밖(기존 코드) — FOCUS 문구의 정밀화
  - 위치: `codebase/frontend/src/lib/stores/auth-store.ts:41-48` (`logout()`)
  - 상세: `git diff origin/main -- codebase/frontend/src/lib/stores/auth-store.ts` 결과가 비어
    있다 — 이 파일은 이번 PR(초대 수락 UI 재작성)에서 변경되지 않았다. `document.cookie = "has_session=;
    path=/; max-age=0"` 로 쿠키를 지우는 로직은 이미 존재하던 코드다. 이번 PR 이 새로 한 일은
    `accept-invitation-content.tsx` 의 `handleLogout()` 이 (기존에 이미 있던) `useAuthStore.getState().logout()`
    을 호출하도록 배선하고, 왜 `setUser(null)` 만으로는 불충분한지를 코드 주석(L107-110)으로 명시한 것이다.
    FOCUS 는 "이번 PR 이 clear 로직을 신규 추가했다"가 아니라 "이번 PR 이 기존 clear 로직을 가진 `logout()`
    을 새 handleLogout 경로에서 재사용하도록 정합시켰다"로 정정 이해해야 한다.
  - 제안: 없음 — 정보 확인.

- **[INFO]** stale session hint 방지는 net positive, 회귀 없음 — 계층 분리(non-httpOnly UX 힌트 vs 실제 토큰 인가) 유지
  - 위치: `auth-store.ts:41-48`(logout), `proxy.ts:34-40`(hasSession 게이트),
    `register-form.tsx:112-119`(has_session=1 감지 redirect), `accept-invitation-content.tsx:101-113`(handleLogout)
  - 상세: `has_session` 은 non-httpOnly, "인증 수단이 아닌 UX 힌트" 쿠키(스펙 §7.1)이며 실제 인가는 항상
    서버 토큰 검증(API 401)이 담당하는 계층 분리가 유지된다. logout 시 쿠키를 지우지 않았다면: (1) `proxy.ts`
    미들웨어가 stale `has_session=1` 을 보고 로그인 상태로 오판해 보호 라우트 진입을 허용할 수 있으나, 실제
    API 호출은 access token 부재로 401 을 받으므로 데이터 유출로 직결되지 않고 UX 리다이렉트 혼란 수준의
    리스크였다. (2) `register-form.tsx` 의 초대 링크 진입 분기가 stale 쿠키를 "이미 로그인됨"으로 오판해
    `/invitations/accept?token=` 로 잘못 리다이렉트할 수 있으나, accept 페이지의 라우트 가드(§1.5.3 각주:
    "힌트가 stale 이면 accept 페이지 라우트 가드가 로그인 화면으로 되돌린다")가 2차 방어선으로 작동해 인가
    우회로 이어지지 않는다. logout 에서 쿠키를 정리하는 것은 이 2차 방어에 기대지 않고 1차 원인을 제거하는
    defense-in-depth 이며, 힌트가 실제 인증 상태와 어긋나는 창을 최소화한다. 쿠키 clear 실패로 이전보다
    나빠지는 신규 벡터는 없다(`typeof document` SSR 가드, `max-age=0` 은 표준 삭제 관용구).
  - 제안: 없음.

- **[INFO]** 서버측 logout 실패를 swallow 하고 클라이언트만 정리하는 패턴은 기존 합의된 트레이드오프(신규 아님)
  - 위치: `accept-invitation-content.tsx:101-106` (`try { await authApi.logout() } catch { /* swallow */ }`)
  - 상세: 서버 `POST /api/auth/logout` 실패 시에도 클라이언트는 access token 제거 + `has_session` 쿠키
    삭제 + `/login` 이동을 계속한다. 서버측 refresh token family 가 그대로 남을 수 있어 §2.3("logout →
    호출 디바이스 family 전체 revoke")이 서버측에서 미이행될 가능성은 있으나, 이는 register-form.tsx 의
    기존 관례를 그대로 재사용한 것으로 이번 PR 이 신규 도입한 리스크가 아니다. 직전 라운드
    `review/consistency/2026/07/05/15_33_01/rationale_continuity.md` 및 code review `requirement.md`
    가 이미 "spec 이 규정하지 않는 fallback, 조치 불요"로 판정했다.
  - 제안: 없음(기존 합의 재확인).

- **[INFO]** 리뷰 payload 구성 갭 — 실제 코드 diff 파일 누락 (프로세스 이슈, 코드 자체의 보안 결함 아님)
  - 위치: `review/code/2026/07/05/16_05_46/_prompts/security.md`
  - 상세: 첨부된 13개 파일 섹션이 전부 `review/consistency/**` 산출물 markdown 5건 + spec md 2건뿐이며,
    FOCUS 가 지목한 실제 코드(`auth-store.ts`, `accept-invitation-content.tsx`, `register-form.tsx`)의
    diff 가 하나도 포함되지 않았다. 워킹트리 직접 확인으로 우회했으나, 향후 회차에서 코드 리뷰어가
    review artifact md 만 보고 실제 코드 diff 를 놓칠 위험이 있다(이전 세션 memory 의 "리뷰 changeset 이
    직전 검토 코드 제외" 패턴과 유사).
  - 제안: orchestrator 의 changeset 구성 로직 후속 점검 권장.

## 요약

FOCUS 로 지목된 "logout 이 `has_session` 힌트 쿠키를 store `logout()` 을 통해 지운다"는 사실은 확인되며,
순net 보안/견고성 개선이다 — stale 세션 힌트가 middleware 나 초대-링크 재진입 분기를 오도할 창을 닫는
defense-in-depth 조치다. 다만 이 clear 로직(`auth-store.ts`) 자체는 `git diff origin/main` 상 이번 PR 의
변경분이 아니라 기존 코드이며, 이번 PR 은 그 기존 `logout()` 을 새 `handleLogout` 경로(초대 수락 페이지의
이메일 불일치 시 로그아웃)에서 호출하도록 배선한 것이다. `has_session` 은 non-httpOnly UX 힌트일 뿐 실제
인가는 항상 서버 토큰(API 401)이 담당하는 계층 분리가 유지되어, 이 쿠키 하나가 stale 하더라도 인증
우회로 직결되지 않는 이중 방어(accept 페이지 라우트 가드)가 존재한다. 서버측 logout 실패를 swallow 하는
기존 패턴도 이번 PR 이 새로 도입한 것이 아니며 별도 승인된 트레이드오프다. 새로운 인젝션·시크릿 노출·
인증 우회 벡터는 발견되지 않았다. 다만 이번 security review 프롬프트 payload 자체가 실제 코드 diff 파일을
포함하지 않아 워킹트리 직접 확인으로 우회했다는 점을 밝혀두며, 이는 코드 자체의 결함이 아닌 orchestrator
payload 구성 이슈로 후속 확인을 권장한다.

## 위험도

NONE
