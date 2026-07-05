# Requirement Review — invite-accept-confirm-ui (V-09 §1.5.3)

## 발견사항

- **[INFO]** `[SPEC-DRIFT]` 아님 — spec §1.5.3 "경로·진입" 단락은 이미 이번 배치에서 최신화되어 코드와 line-level 로 일치함
  - 위치: `spec/5-system/1-auth.md` §1.5.3 하단 신규 인용문(diff L264-266), `codebase/frontend/src/components/auth/register-form.tsx` L104-113(`useEffect` redirect), `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` 전체
  - 상세: consistency-check(`review/consistency/2026/07/05/14_54_13/cross_spec.md`)가 --impl-prep 단계에서 지적한 CRITICAL("메일 링크가 §1.5.3 accept 페이지에 절대 도달하지 않음")은 이번 구현에서 register-form 의 로그인 감지 → `/invitations/accept?token=` redirect 로 해소됐고, 그 결정이 spec §1.5.3 에 "경로·진입" 각주로 이미 반영되어 있다(`router.replace` 대상 URL·쿼리 파라미터명 `token` 모두 spec 문구와 정확히 일치). 즉 spec 갱신과 코드 구현이 같은 커밋 배치에 함께 들어와 있어 괴리가 없다 — 별도 조치 불필요, 확인 결과로만 기록.

- **[INFO]** `invitationsApi` 상단 doc 주석이 register 흐름(§2.6)만 언급 — accept 페이지에서의 재사용처가 반영 안 됨(pre-existing, 이번 diff 범위 밖)
  - 위치: `codebase/frontend/src/lib/api/invitations.ts` L13-19
  - 상세: `accept-invitation-content.tsx` 가 이번에 `invitationsApi.getByToken` 을 신규로 호출하는 두 번째 소비처가 됐지만, 파일 상단 주석은 "회원가입 페이지가 prefill 하기 위해 사용" 만 서술한다. 기능상 문제는 없음(같은 `GET /api/invitations/:token`, 같은 `InvitationMeta` shape). consistency-check 도 동일하게 INFO 로 이미 포착.
  - 제안: 주석에 "§1.5.3 accept 페이지에서도 재사용" 한 줄 추가 (경미, blocking 아님).

- **[INFO]** register-form 의 redirect effect 는 mount 시 1회만 `isAuthenticated` 를 검사(deps `[invitationToken, router]`) — race 가능성 점검 결과 안전
  - 위치: `codebase/frontend/src/components/auth/register-form.tsx` L104-113
  - 상세: `RegisterFormInner` 는 최상위 레이아웃의 `AuthProvider`(`codebase/frontend/src/components/auth/auth-provider.tsx` L64: `isLoading && !isAuthenticated` 동안 전역 스피너 렌더)에 의해 세션 복원이 끝난 뒤에만 마운트되므로, effect 발화 시점의 `useAuthStore.getState().isAuthenticated` 는 이미 hydration 이 끝난 확정값이다. 로그인 상태가 mount 이후 앱 내에서 바뀌는 시나리오(다른 탭 로그인 등)는 이 페이지에서 사실상 발생하지 않는다. 엣지 케이스 우려는 기각.

- **[INFO]** `accept-invitation-content.tsx` 의 `useEffect` 도 `useAuthStore.getState().user` 를 mount 시 1회만 스냅샷(로그인 상태 변경에 반응 안 함)
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` L26-30 (`const userEmail = useAuthStore.getState().user?.email`)
  - 상세: 이 페이지는 `(main)` 라우트 그룹(인증된 앱 셸) 아래에 있어 마운트 시점엔 이미 `AuthProvider` 가드를 통과한 로그인 사용자만 도달한다(비로그인 접근은 앱 셸 라우팅에서 이미 처리). 마운트 후 로그아웃하지 않는 한 이메일이 바뀔 일이 없어 스냅샷 방식이 적절 — 회색지대이나 문제 없음.

- **[INFO]** `handleLogout` 의 로그아웃 API 실패를 swallow 하고도 클라이언트 세션을 정리 — 의도된 동작이며 주석과 구현이 일치
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` L48-54
  - 상세: "로그아웃 요청이 실패해도 클라이언트 세션은 정리하고 로그인으로 보낸다" 주석대로 `catch {}` 후 `setAccessToken(null)` → `setUser(null)` → `router.push("/login")` 순서로 정확히 구현됨. 서버측 refresh token 이 revoke 되지 않을 가능성이 있으나(네트워크 오류 시), UX 우선 설계로 보이며 §1.5.3 spec 은 이 세부사항을 규정하지 않음(회색지대, 문제 삼지 않음).

- **[INFO]** 테스트 커버리지 — §1.5.3 핵심 분기(일치/불일치/로그아웃/410/missing) 전부 포함, edge case 로 서버 500·네트워크 에러(non-AxiosError)는 미포함
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/__tests__/accept-invitation-content.test.tsx`
  - 상세: 6개 테스트가 정상/불일치/로그아웃/410/missing 경로를 검증한다. `getByToken` 이 500 을 던지는 경우도 동일한 `catch` 블록(L31-37)에서 처리되어 `error.response?.data?.message ?? acceptFailedDefault` 로 폴백하므로 로직상 커버되나, 이 구체 케이스에 대한 전용 테스트는 없다(경미, 기존 error 케이스 테스트가 message 필드 유무만 다르고 분기 구조는 동일해 위험 낮음).

## 요약

이번 diff 는 `accept-invitation-content.tsx` 를 마운트 즉시 자동수락(auto-accept) 방식에서 spec §1.5.3 이 요구하는 "메타 조회 → 이메일 일치 시 [수락] 버튼 / 불일치 시 안내+로그아웃" 흐름으로 정확히 재작성했고, register-form 에 로그인 사용자 감지 → `/invitations/accept?token=` redirect 를 추가해 --impl-prep 단계에서 발견된 "메일 링크가 §1.5.3 페이지에 도달하지 못한다"는 CRITICAL 진입-경로 갭을 해소했다. 함수 시그니처·API 필드명(`token`)·에러 코드(`invitation_email_mismatch` 등)·상태 전이(`loading→ready|mismatch|accepting→success|error`)가 spec §1.5.1~§1.5.4 본문과 line-level 로 일치하며, spec 자체도 같은 배치에서 "경로·진입" 각주로 갱신되어 spec-코드 간 괴리가 남아있지 않다. TODO/FIXME 주석 없음, 반환값 누락 없음, i18n 키(en/ko) 전부 정의·사용 일치. 발견된 사항은 모두 INFO 수준(사전 존재 doc 주석 stale, 미세 edge-case 테스트 공백)으로 즉시 조치가 필요한 결함은 없다.

## 위험도

NONE
