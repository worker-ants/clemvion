# Cross-Spec 일관성 검토 — V-09 초대 수락 확인 UI

## 검토 범위

- `spec/5-system/1-auth.md` §1.5.3 신규 단락 ("경로·진입") + frontmatter `code:` 3건 추가
- `spec/2-navigation/10-auth-flow.md` §2.6 신규 단락 ("이미 로그인한 사용자의 진입 분기")
- 구현: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` 재작성(자동수락→[수락]버튼+불일치 안내), `codebase/frontend/src/components/auth/register-form.tsx` (`has_session` 힌트 쿠키 기반 리다이렉트), i18n ko/en `invitations.ts` 추가 키
- diff-base `origin/main`, HEAD = worktree `invite-accept-confirm-ui-c51e95`

## 발견사항

없음. 아래는 확인한 교차 지점과 그 결과다 (모두 정합).

- **`has_session` 힌트 쿠키 재사용** — `10-auth-flow.md §7.1`(라우트 가드)·§7.3(로그아웃)이 정의한 기존 메커니즘(`auth-store.ts` `setAuthenticated`/`logout`, `proxy.ts`)을 신규 §2.6 단락과 `register-form.tsx` 가 그대로 재사용한다. 쿠키 이름·path·max-age·SameSite 값에 대한 재정의나 모순 없음.
- **`/invitations/accept` 라우트 보호 상태** — 신규 페이지는 `(main)` 그룹(보호 라우트)에 위치하며 §7.1 의 public 경로 목록(`/login`·`/register`·`/forgot-password`·`/reset-password`·`/verify-email`·`/callback`)에 포함되지 않는다. 즉 미인증 사용자는 proxy 계층에서 `/login` 으로 먼저 리다이렉트되므로, accept 페이지 컴포넌트 내부의 "이메일 불일치/미로그인" 분기가 실제로는 "로그인은 돼 있으나 다른 계정" 케이스에 주로 도달한다 — 이는 §2.6 신규 문구("힌트가 stale 이면 accept 페이지의 라우트 가드가 정상적으로 로그인 화면으로 되돌린다")가 이미 명시한 대로이며 코드와 일치한다.
- **에러 코드 레지스트리** — `codebase/frontend/src/lib/api/invitations.ts` 의 `INVITATION_ERROR`(`invitation_email_mismatch`/`invitation_expired`/`invitation_already_used`/`invitation_not_found`)가 `1-auth.md §1.5.4` 표 및 historical-artifact 예외(lower_snake_case, `error-codes.md §3`)와 정확히 일치. 신규 코드 추가 없음.
- **`spec/2-navigation/9-user-profile.md §4.1.1`** — "가입 성공 트랜잭션 내에서 자동 accept" 문구는 §1.5.2(미가입자 가입 경로)에 한정된 서술로, 이번에 재작성된 §1.5.3(기가입자 accept 페이지) 흐름과는 별개 시나리오라 충돌 없음. §4.1 "수신자는 수락 페이지에서 합류" 문구도 새 [수락] 버튼 UX 와 모순되지 않는 일반 서술.
- **`spec/data-flow/12-workspace.md`** — `POST /api/workspaces/invitations/accept {token}` 시퀀스는 백엔드 계약이며 프론트 UI 재작성과 무관, 그대로 유효.
- **plan 추적** — `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-09 항목은 이번 구현으로 해소되어 이미 `[x]` 로 체크·기록되어 있고, 권장 옵션("코드 구현: §1.5.3 대로 재작성")과 실제 diff 가 일치한다.
- **frontmatter `code:` 매핑** — `1-auth.md` 에 추가된 3개 경로(`codebase/frontend/src/app/(main)/invitations/accept/**`, `.../components/auth/register-form.tsx`, `.../lib/api/invitations.ts`)는 모두 실재하는 파일/디렉터리이며 §1.5.3 내용과 대응한다.
- **RBAC/데이터 모델/상태 전이** — 이번 변경은 프론트엔드 UI 흐름 재구성 + 문서 보강뿐이며, `WorkspaceInvitation` 엔티티·상태 전이(`acceptedAt`)·RBAC 매트릭스·API 계약(엔드포인트·request/response shape)에는 어떤 변경도 없다. 서버측 이메일 일치 강제(§1.5.1/§1.5.4)도 그대로다.

## 요약

target 변경(초대 수락 확인 UI 재작성 + 기가입자 register 진입 리다이렉트)은 `spec/5-system/1-auth.md §1.5.3`·`spec/2-navigation/10-auth-flow.md §2.6` 두 문서에 정합된 서술을 추가했고, 기존 `has_session` 힌트 쿠키·라우트 가드 2계층·에러 코드 레지스트리·`9-user-profile.md`/`data-flow/12-workspace.md` 등 인접 spec 영역과 충돌하는 지점을 찾지 못했다. plan 문서(V-09)에도 해소 처리가 기록돼 있어 추적선도 일치한다.

## 위험도

NONE
