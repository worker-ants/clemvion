# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-done)

## 검토 개요

이번 target 의 실제 diff(`origin/main` 대비)는 `spec/5-system/1-auth.md` 에 §1.5.3 "경로·진입" 문단 5줄 추가(frontmatter `code:` 목록에 frontend 3개 경로 추가 포함)와, 이에 대응하는 프런트엔드 구현(`accept-invitation-content.tsx` 상태머신 확장, `register-form.tsx` 로그인 사용자 redirect, i18n ko/en 3개 키 추가)이다. 이는 `.claude/worktrees/invite-accept-confirm-ui-c51e95` 워킹트리를 절대경로로 직접 확인했다(`git diff origin/main -- spec/5-system/1-auth.md`, `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx`, `codebase/frontend/src/components/auth/register-form.tsx`, `codebase/frontend/src/lib/i18n/dict/{en,ko}/invitations.ts`). 앞선 `--impl-prep` 단계 리뷰(`review/consistency/2026/07/05/14_54_13/naming_collision.md`)가 이미 이 영역의 기존 식별자(엔티티·엔드포인트·에러코드·ENV)와의 정합을 확인해 두었으므로, 본 리뷰는 그 결과를 재확인하는 동시에 이번 구현이 **새로** 도입한 프런트엔드 식별자(로컬 타입·i18n 키·라우트 경로 문서화)에 초점을 맞췄다.

## 발견사항

### 1. 요구사항 ID 충돌 — 해당 없음

target 은 `id: auth` frontmatter 를 유지하며 신규 요구사항 ID 를 도입하지 않는다. `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 `V-09` 는 기존에 이미 "잔여" 목록에 있던 plan 추적 라벨을 완료로 전환한 것뿐이며 신규 ID 부여가 아니다(다른 `V-*` 항목과 네임스페이스 충돌 없음, `git diff` 확인).

### 2. 엔티티/타입명 충돌 — WARNING (파일 내 지역 판별유니온 재사용 패턴, 기능적 충돌 아님)

- **target 신규 식별자**: `accept-invitation-content.tsx` 의 `type Status = "loading" | "ready" | "mismatch" | "accepting" | "success" | "error" | "missing"`
- **기존 사용처**: 같은 PR 로 나란히 수정된 `codebase/frontend/src/components/auth/register-form.tsx:66-67` 는 `{ kind: "loading" } | { kind: "ready"; meta: InvitationMeta } | ...` 형태의 **별도** 판별 유니온을 정의하며 리터럴 값 `"loading"`/`"ready"` 를 동일하게 사용한다.
- **상세**: 두 타입은 이름(`Status` vs 익명 유니온으로 `invitationState` 변수에 귀속)도 다르고 모듈 스코프도 분리되어 있어 TypeScript 상 실제 충돌은 없다. 다만 "초대 토큰 조회 → 로그인 상태에 따라 ready/mismatch 분기"라는 **동일한 도메인 개념**을 두 파일이 유사하지만 형태가 다른 상태머신(string literal union vs `{kind}` 태그드 유니온)으로 각각 구현해, 향후 유지보수자가 두 상태 이름(`loading`/`ready`)이 같은 값을 가리키는 것으로 착각하거나 리팩터링 시 하나만 갱신할 위험이 있다.
- **제안**: 기능적 충돌이 아니므로 즉시 조치 불요. 다만 두 상태머신이 사실상 "초대 토큰 메타 조회 상태"라는 같은 목적을 공유하는 만큼, 후속 리팩터에서 공용 훅(예: `useInvitationTokenMeta`)으로 추출해 `Status`/`kind` 네이밍을 통일하는 것을 권장. CRITICAL/BLOCK 사유는 아님(WARNING).

### 3. API endpoint 충돌 — 해당 없음 (신규 endpoint 미도입, 기존 관찰 유효)

- 이번 diff 는 신규 backend endpoint 를 추가하지 않는다. `spec/5-system/1-auth.md:267` 에 추가된 문장은 프런트엔드 **페이지 경로**(`/invitations/accept?token=`, `/auth/register?invitationToken=`)를 설명하는 것으로, `GET /api/invitations/:token`·`POST /api/workspaces/invitations/accept` 같은 API endpoint 와는 네임스페이스가 다르다(페이지 route vs REST endpoint). `invitations.ts` 의 `invitationsApi.getByToken` 호출 대상(`GET /invitations/:token`)도 기존 정의 그대로이며 이번 PR 에서 변경되지 않았다(`git diff origin/main -- codebase/frontend/src/lib/api/invitations.ts` 결과 없음, 즉 파일 unchanged).
- 앞선 `--impl-prep` 리뷰가 지적한 `GET /api/invitations/:token` 의 `1-auth.md`/`9-user-profile.md` 이중 정의(WARNING)는 이번 diff 범위 밖이며 이번 구현으로 악화되지 않았다.

### 4. 이벤트/메시지명 충돌 — 해당 없음

이번 변경은 webhook·queue·SSE 이벤트를 발생시키지 않는다. `accept-invitation-content.tsx` 의 `toast.success(...)` 는 기존 `invitations.accept.joined` 키를 그대로 사용하며 신규 이벤트명 도입 없음.

### 5. 환경변수·설정키 충돌 — 해당 없음

신규 ENV/config key 도입 없음.

### 6. i18n 키 충돌 — 해당 없음 (신규 키, 명명 일관)

- **target 신규 식별자**: `invitations.accept.mismatchTitle` · `invitations.accept.mismatchHint` · `invitations.accept.logoutAndSwitch` (en/ko 양쪽 dict 에 동일 키로 추가)
- **기존 사용처**: 동일 `invitations.accept.*` 네임스페이스에 `missingHint`·`goDashboard`·`redirectingDashboard`·`statusAccepting`·`statusSuccess`·`statusError` 등 기존 키가 있으나 이름이 겹치지 않는다. 명명 규칙(`<state><Purpose>` 카멜케이스)도 기존 패턴과 일치.
- 단, 코드가 참조하는 `translate(locale, "invitations.accept.message", { workspace: meta.workspaceName })` 키(`accept-invitation-content.tsx:121-124`)는 en/ko 두 dict 파일 어디에도 `message` 키가 정의되어 있지 않다(`grep -n '"message"' dict/{en,ko}/invitations.ts` 결과 없음). 이것은 **명명 충돌이 아니라 누락된 키(런타임에 fallback 문자열 또는 빈 문자열로 렌더될 가능성)** 이므로 본 checker 의 "충돌" 범주에는 해당하지 않아 CRITICAL/WARNING 등급을 매기지 않는다 — 다만 인접 리뷰(예: `documentation`/`testing` 관점 또는 code-review)에서 별도로 다뤄질 사안으로 참고 표시한다(정보 공유 목적, INFO).

### 7. 파일 경로 충돌 — 해당 없음

`spec/5-system/1-auth.md` frontmatter `code:` 목록에 추가된 3개 경로(`codebase/frontend/src/app/(main)/invitations/accept/**`, `codebase/frontend/src/components/auth/register-form.tsx`, `codebase/frontend/src/lib/api/invitations.ts`)는 모두 기존에 실존하는 파일/디렉터리이며 다른 spec 문서의 `code:` 매핑과 중복되지 않는다(각 파일이 정확히 하나의 spec 영역에만 매핑되는지는 `1-auth.md` 자체 frontmatter 로 한정 확인 — 타 spec 문서와의 교차 중복은 별도 cross_spec 리뷰 범위).

## 요약

이번 target 의 실제 코드/spec 변경분(`spec/5-system/1-auth.md` §1.5.3 5줄 추가 + `accept-invitation-content.tsx`/`register-form.tsx`/i18n dict)은 신규 backend endpoint·엔티티·ENV·요구사항 ID 를 전혀 도입하지 않으며, 새로 추가된 프런트엔드 로컬 식별자(`Status` 타입 리터럴, `mismatchTitle`/`mismatchHint`/`logoutAndSwitch` i18n 키)도 기존 네임스페이스·명명 규칙과 충돌하지 않는다. 유일한 관찰 사항은 (a) `accept-invitation-content.tsx` 의 `Status` 유니온과 `register-form.tsx` 의 `{kind}` 판별 유니온이 `"loading"`/`"ready"` 리터럴 값을 같은 도메인 개념(초대 토큰 메타 조회 상태)에 대해 서로 다른 형태로 나란히 재구현해 향후 혼동 여지가 있다는 점(WARNING, 기능적 충돌 아님), (b) 코드가 참조하는 i18n 키 `invitations.accept.message` 가 실제 dict 파일에 없다는 점(명명 충돌이 아닌 누락 이슈, INFO 참고). CRITICAL 등급 신규 식별자 충돌은 발견되지 않았다.

## 위험도

LOW
