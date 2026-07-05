# RESOLUTION — invite-accept-confirm-ui fresh review (15_33_01)

## 조치 항목

| # | Reviewer/위험도 | 발견 | 조치 | 커밋 |
|---|---|---|---|---|
| 1 | requirement / WARNING(MEDIUM) | register 리다이렉트가 `useAuthStore.isAuthenticated` 를 읽는데 `(auth)` 그룹엔 AuthProvider 하이드레이션이 없어 메일-링크(cold-tab) 진입 시 항상 false → 리다이렉트 미발화(dead code) | `register-form.tsx` 리다이렉트 판정을 `has_session` 힌트 쿠키(`proxy.ts` 와 동일 신호, 로그인 시 auth-store 가 심음)로 전환. `useAuthStore` import 제거. 테스트도 쿠키 설정으로 갱신 + beforeEach 쿠키 정리 | (아래 fix 커밋) |
| 2 | requirement / WARNING | ② 익명 사용자가 `/invitations/accept` 직접 진입 시 login 리다이렉트 쿼리 드롭 → 토큰 유실 | **부분 완화**: #1 수정으로 리다이렉트는 `has_session` 존재 시에만 발화 → AuthProvider 복원 성공 가능성 높음. 잔여(stale 쿠키 시 쿼리 미보존)는 login 리다이렉트의 선존 한계(본 PR 미도입)라 별도 트랙. 아래 §보류 참조 |
| 3 | documentation / WARNING | CHANGELOG `## Unreleased` 엔트리 누락 | `CHANGELOG.md` 최상단에 §1.5.3 UI + 진입 경로 2항목 엔트리 추가(프로젝트 PR별 컨벤션) | (fix 커밋) |
| 4 | testing / WARNING(LOW) | `handleLogout` 서버-실패(catch-swallow) 경로 미테스트 | `accept-invitation-content.test.tsx` 에 `mockLogout.mockRejectedValue` → 세션 정리·`/login` 이동 assert 테스트 추가(accept 9 tests) | (fix 커밋) |
| 5 | cross_spec + rationale / WARNING | `spec/2-navigation/10-auth-flow.md §2.6`(register code-owner)이 기가입자 리다이렉트 분기 미반영 → §1.5.3 과 drift | §2.6 상단에 "이미 로그인한 사용자의 진입 분기" 노트 추가(§1.5.3·§7 has_session 링크). 표 1~7 은 미가입자 경로임 명시 | (fix 커밋) |
| 6 | naming / WARNING | 상태 유니온 명명 유사 | **조치 불요** — 기능 충돌 아님(파일 로컬 타입), 두 컴포넌트 각자의 `Status`/`InvitationState` 로 이름·의미 구분됨 |
| 7 | maintainability / INFO | 에러추출 헬퍼 중복·Status 유니온 분기 | **조치 불요**(INFO) — 현 규모에서 추상화 과잉. 확장 시 재평가 |

## TEST 결과

- lint: 통과 (재수행)
- unit: 통과 (재수행 — accept 9 / register 10 포함)
- build: 통과 (재수행)
- e2e: 통과 (재수행, 235 passed) — register-form 진입 로직·auth 흐름 변경 포함

## 보류·후속 항목

- **익명 직접 진입 시 login 리다이렉트 쿼리 보존** (requirement #2 잔여): `AuthProvider`/`proxy.ts` 가 미인증 사용자를 `/login?redirect=<pathname>` 로 보낼 때 `usePathname()` 가 쿼리스트링을 드롭하고 `login-form.tsx` 가 `redirect` 를 소비하지 않아, `/invitations/accept?token=` 직접 진입 시 로그인 후 토큰이 유실된다. 이는 본 PR 이 도입한 결함이 아니라 login 리다이렉트의 선존 한계이며, 초대 메일은 `/auth/register` 로 링크하므로 실사용 경로에서는 거의 도달하지 않는다. 별도 plan 후보(로그인 리다이렉트 쿼리 보존 일반화)로 이관.
