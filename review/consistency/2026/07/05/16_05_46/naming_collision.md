# 신규 식별자 충돌 검토

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- SoT 워킹트리: `/Volumes/project/private/clemvion/.claude/worktrees/invite-accept-confirm-ui-c51e95`
- 실제 diff 범위(git diff origin/main): `spec/5-system/1-auth.md`, `spec/2-navigation/10-auth-flow.md` (spec 문서), `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx`, `codebase/frontend/src/components/auth/register-form.tsx`, `codebase/frontend/src/lib/i18n/dict/{en,ko}/invitations.ts` + 관련 테스트

이번 변경은 "초대 수락 확인 UI"(V-09, `plan/in-progress/spec-code-cross-audit-2026-06-10.md`) 로, 자동수락 → 사용자 확인 버튼 방식 전환과 이미 로그인한 사용자의 register 진입 리다이렉트를 다룬다. 신규 식별자 도입 폭이 좁아 6개 점검 관점 전반에서 충돌 후보를 찾지 못했다.

## 점검 결과

### 1. 요구사항 ID 충돌
`V-09` 는 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 안에서만 쓰이는 audit-finding 라벨(V-04, V-05, V-09~V-14, V-18 시리즈)이며, spec 요구사항 ID 네임스페이스(예: `KB-GR-*`, `ND-AG-*`, `INT-SV-*`)와 형식·용도가 다르다. 다른 문서에서 `V-09` 를 별도 의미로 쓰는 곳 없음(`grep` 확인). 충돌 없음.

### 2. 엔티티/타입명 충돌
- `Status` 타입에 추가된 리터럴 `"loading" | "ready" | "mismatch"` (accept-invitation-content.tsx) 와 `InvitationState.kind: "ready"`(register-form.tsx) 는 각각 파일-로컬 union 타입이라 export 되지 않고 다른 모듈과 이름공간이 겹치지 않는다.
- 코드베이스 전역에 `"ready"` 리터럴을 쓰는 곳이 이미 다수 존재(`node-definitions-store.ts`의 `Status`, `web-chat/live-preview.tsx`의 `status`) 하지만 전부 모듈-스코프 판별 유니언이며 target 변경이 이를 새로 충돌시키지 않는다. CRITICAL 아님.
- `InvitationMeta` 인터페이스는 이번 변경으로 신규 도입된 것이 아니라 기존 `codebase/frontend/src/lib/api/invitations.ts` (및 백엔드 `workspace-invitations.service.ts` 의 동명 인터페이스)에 이미 있던 정의를 그대로 import/재사용한다. 충돌 없음.

### 3. API endpoint 충돌
- 프런트 라우트 `/invitations/accept?token=` (Next.js page) 와 기존 REST 엔드포인트 `POST /api/workspaces/invitations/accept` (spec/2-navigation/9-user-profile.md §6.1, spec/5-system/1-auth.md §5, spec/data-flow/12-workspace.md) 는 다른 성격(클라이언트 라우트 vs API 엔드포인트)이고 경로 prefix(`/invitations/...` vs `/api/workspaces/invitations/accept`)도 달라 실제 라우팅 충돌은 없다. 신규로 추가된 `GET /api/invitations/:token` 메타 조회 호출(`invitationsApi.getByToken`)도 기존 백엔드 `getMetaByToken`/컨트롤러 엔드포인트를 그대로 재사용한 것으로 확인됨(신규 endpoint 아님).
- target 문서(spec/5-system/1-auth.md, spec/2-navigation/10-auth-flow.md) 는 이번 diff 로 새 endpoint 를 선언하지 않았다(문서 설명 텍스트만 추가).

### 4. 이벤트/메시지명 충돌
새 webhook/queue/SSE 이벤트 없음. i18n 메시지 키 `invitations.accept.mismatchTitle` / `mismatchHint` / `logoutAndSwitch` (en/ko 양쪽 신설)는 `invitations.accept.*` 네임스페이스 내에서만 검색했을 때 기존 키(`missingHint`, `goDashboard`, `redirectingDashboard` 등)와 겹치지 않고, 코드베이스 전체에서 동일 키 이름 재사용도 없음(grep 확인). 충돌 없음.

### 5. 환경변수·설정키 충돌
신규 ENV var·config key 없음. `has_session` 쿠키는 이번 변경으로 신설된 것이 아니라 기존 `auth-store.ts`(로그인 시 set, 로그아웃 시 clear)·`proxy.ts`(서버 미들웨어 판정)에 이미 존재하던 힌트 쿠키를 그대로 재사용/설명 보강한 것. `handleLogout` 이 `useAuthStore.getState().logout()` 을 통해 동일 쿠키를 정리하도록 한 것도 기존 정의와 일치하며 새 키를 만들지 않았다. 충돌 없음.

### 6. 파일 경로 충돌
신규 spec 파일 없음(기존 `spec/5-system/1-auth.md`, `spec/2-navigation/10-auth-flow.md` 본문에 절 추가만). frontmatter `code:` 목록에 추가된 경로(`codebase/frontend/src/app/(main)/invitations/accept/**`, `codebase/frontend/src/components/auth/register-form.tsx`, `codebase/frontend/src/lib/api/invitations.ts`)는 모두 기존 실재 파일 경로이며 다른 spec 문서의 `code:` 매핑과 중복 소유권 충돌이 없음(1-auth.md 가 프런트 초대 흐름 코드를 신규로 own 하게 된 것은 §Overview 의 "인접 엔드포인트는 각 SoT 문서를 포인터로 참조" 원칙과 일치 — API 는 여전히 9-user-profile.md 가 SoT, 1-auth.md 는 §1.5.3 진입 흐름만 기술).

## 요약

target 변경은 신규 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·spec 파일 경로를 실질적으로 새로 만들지 않고, 기존 정의(`InvitationMeta`, `getByToken`, `has_session` 쿠키, `POST /api/workspaces/invitations/accept`)를 그대로 재사용하면서 UI 상태 흐름(`Status` 유니언에 `loading/ready/mismatch` 추가)과 i18n 메시지 키만 로컬 스코프로 확장했다. 확인한 6개 관점 모두에서 기존 사용처와의 의미 충돌 후보를 발견하지 못했다.

## 위험도

NONE
