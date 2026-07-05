# Rationale 연속성 검토 결과

## 검토 범위

- target: `spec/5-system/1-auth.md` (§1.5.3 · §1.5.A · §7 관련), `spec/2-navigation/10-auth-flow.md`
- 실제 코드 변경(diff, `origin/main...HEAD`):
  - `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx`
  - `codebase/frontend/src/components/auth/register-form.tsx`
  - `codebase/frontend/src/lib/i18n/dict/{ko,en}/invitations.ts`
  - `spec/5-system/1-auth.md`, `spec/2-navigation/10-auth-flow.md` (frontmatter code 매핑 + §1.5.3/§2.6 문구 보강)
  - `plan/in-progress/spec-code-cross-audit-2026-06-10.md` (V-09 항목 종결)

주어진 프롬프트 파일 안에는 diff("구현 변경 사항") 섹션이 포함되어 있지 않아, 워크트리에서 `git diff origin/main...HEAD` 를 직접 조회해 실제 변경분을 확인했다.

## 발견사항

- **[INFO]** 이번 변경은 과거 결정의 번복이 아니라 기존 spec-code 불일치(구현 버그)의 정합화
  - target 위치: `spec/5-system/1-auth.md` §1.5.3, `accept-invitation-content.tsx`
  - 과거 결정 출처: `spec/5-system/1-auth.md` §1.5.3 흐름 정의 — "로그인되어 있고 본인 이메일과 토큰 이메일이 일치 → 수락 페이지에 [수락] 버튼 노출" / "이메일이 다르면... 안내 + 로그아웃 버튼만 노출"
  - 상세: `origin/main` 의 구현은 `/invitations/accept` 마운트 즉시 `workspacesApi.acceptInvitation()` 을 무조건 호출하는 자동 수락이었다 — 이는 spec §1.5.3 이 이미 요구하던 "[수락] 버튼 확인" 문구와 애초부터 어긋난 코드였다(`plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-09 major gap). 본 PR 은 spec 문구를 코드가 뒤늦게 따라가도록 재작성한 것이며, spec 텍스트 자체는 그대로 유지된 채(§1.5.3 표·문단 불변) frontmatter code 매핑과 "경로·진입" 보충 문단만 추가됐다. 즉 "결정을 뒤집으며 새 Rationale 을 안 씀"에 해당하지 않는다 — 뒤집힌 결정이 없다.
  - 제안: 없음 (plan 파일에 V-09 종결 근거가 이미 상세히 기록되어 있어 추적 가능).

- **[INFO]** 클라이언트 이메일 일치 검사는 UX 게이팅, 서버 재검증 원칙(§1.5.A) 유지 확인
  - target 위치: `accept-invitation-content.tsx` `handleAccept`/이메일 비교 로직
  - 과거 결정 출처: `spec/5-system/1-auth.md` Rationale "1.5.A — 가입 시 이메일 일치 강제"
  - 상세: 신규 코드는 `useAuthStore.getState().user?.email === meta.email` 로 클라이언트에서 `ready`/`mismatch` 를 분기하지만, 실제 워크스페이스 합류는 `POST /api/workspaces/invitations/accept` 호출 시 서버(`workspace-invitations.service.ts` `accept()`)가 `user.email.toLowerCase() !== invitation.email` 검증을 독립적으로 재수행해 불일치 시 `invitation_email_mismatch` 400 을 던진다. CHANGELOG 에도 "클라이언트 이메일 일치 검사는 UX 게이팅일 뿐이며 실제 인가는 서버가 재검증한다" 고 명시되어 있어, §1.5.A 의 "누출 토큰 단독으로 워크스페이스 진입 불가" invariant 를 우회하지 않는다.
  - 제안: 없음.

- **[INFO]** `has_session` 힌트 쿠키 사용은 §7 "인증 수단이 아닌 UX 힌트" 원칙과 정합
  - target 위치: `register-form.tsx` 신규 `useEffect` (has_session 쿠키 검사 후 `/invitations/accept` 리다이렉트)
  - 과거 결정 출처: `spec/2-navigation/10-auth-flow.md` §7 — "`has_session` 은 인증 수단이 아닌 UX 용 힌트 쿠키다... 실제 인가 판정은 항상 토큰(계층 2 + API 401)이 담당한다"
  - 상세: register-form 이 `has_session=1` 쿠키만으로 리다이렉트 여부를 판정하지만, 리다이렉트 목적지인 `/invitations/accept` 는 `(main)` 라우트 그룹(AuthProvider 하이드레이션 대상)에 있어 실제 세션 유효성은 그 쪽 라우트 가드 + API 401 이 재확인한다. spec 문구("힌트가 stale 이면 accept 페이지의 라우트 가드가 정상적으로 로그인 화면으로 되돌린다")와 구현이 일치하며, "인증 판정 자체를 힌트 쿠키에 위임"하는 방식이 아니다 — §7 invariant 위반 없음.
  - 제안: 없음.

- **[INFO]** 로그아웃 처리가 `has_session` 쿠키를 명시적으로 정리하는지 재확인 권고
  - target 위치: `accept-invitation-content.tsx` `handleLogout()` 주석("useAuthStore.getState().logout() 이 access token·has_session 힌트 쿠키·인증 플래그를 한꺼번에 정리")
  - 과거 결정 출처: `spec/2-navigation/10-auth-flow.md` §7.1 "클라이언트: Access Token 메모리에서 제거, Cookie 삭제 (`has_session` 힌트 쿠키 포함 — §7.1)"
  - 상세: 코드 주석이 정확히 spec 문구를 재진술하고 있고, `auth-store.ts` 의 `logout()` 실제 구현까지는 이번 diff 범위 밖이라 이 리뷰에서 별도로 재확인하지 않았다. 다른 spec 문서 인용과 일치하므로 위반 소지는 낮으나, 후속 코드 리뷰(`code-review-agents`)에서 `logout()` 이 실제로 `has_session` 쿠키를 지우는지 코드 레벨로 검증할 가치가 있다.
  - 제안: 코드 리뷰 단계에서 `auth-store.ts::logout()` 이 `has_session` 쿠키 삭제를 수행하는지 확인 (본 Rationale 검토의 범위는 아님, 참고용 INFO).

## 요약

이번 변경(V-09, 초대 수락 확인 UI)은 기각된 대안의 재도입이나 합의 원칙의 위반, 근거 없는 결정 번복에 해당하지 않는다. 오히려 `spec/5-system/1-auth.md` §1.5.3 이 이미 명시하고 있던 "로그인 이메일 일치 시 [수락] 버튼, 불일치 시 안내+로그아웃" 흐름을, 그동안 spec 과 어긋나 있던 자동-수락 구현을 뒤늦게 spec 에 맞춘 정합화 작업이다. 서버 측 이메일 일치 재검증(§1.5.A invariant), `has_session` 쿠키의 "UX 힌트일 뿐 인증 판정 아님" 원칙(§7 invariant) 모두 코드에서 그대로 유지되고 있음을 diff 및 관련 서비스 코드로 직접 확인했다. spec 문서 자체의 편집도 본문 표·흐름을 바꾸지 않고 frontmatter code 매핑과 보충 설명 문단만 추가하는 수준이라, Rationale 연속성 관점에서 우려할 지점이 없다.

## 위험도

NONE
