STATUS=success plan_coherence completed
===REPORT_MARKDOWN_BELOW===
# Plan 정합성 검토 — `spec/5-system/` (--impl-prep)

## 발견사항

- **[WARNING]** 완료된 plan `spec-draft-auth-invariants-sync.md` 가 `plan/in-progress/` 에
  남아 있다 (target 이 이미 반영한 내용을 이 plan 이 "아직 진행 중"으로 잘못 보고)
  - target 위치: `spec/5-system/1-auth.md ## Rationale` (부트 캐너리 subsection),
    `3-error-handling.md §1.3`, `data-flow/12-workspace.md ## Rationale`,
    `15-chat-channel.md §5.4`, `conventions/secret-store.md §2.1` — 전부 이번 impl-prep 번들에
    실제로 실려 있음(1-auth.md 26회, canary Rationale 이 라인 798부터 그대로 확인됨)
  - 관련 plan: `plan/in-progress/spec-draft-auth-invariants-sync.md`
    (frontmatter `status: in-progress`, `worktree: pnpm-migration-followups-7fc7c2`)
  - 상세: 이 plan 이 등재한 5개 spec 변경 항목은 `git log` 상 커밋 `602f677cd`
    ("docs(spec): auth 불변식 5곳 spec 동기화 … (#1112)")로 **이미 main 에 머지**됐고, 그
    커밋의 diff 가 정확히 이 plan 이 기술한 5개 spec 파일(1-auth.md +46 · 15-chat-channel.md +1 ·
    3-error-handling.md +9/-2 · secret-store.md +24/-3 · 12-workspace.md +47)을 바꿨다. 그런데
    같은 커밋이 `spec-draft-auth-invariants-sync.md` 를 **신설**만 하고 체크리스트 마지막
    2항목("링크 무결성 회귀", "commit + PR")을 `[x]` 로 갱신하지 않았고, `plan/complete/` 로
    이동하지도 않았다 — `plan-lifecycle.md §3` 이 요구하는 "이동은 마지막 작업 PR 안에서" 를
    어겼다(그 PR 이 마지막 작업 PR 이었는데 이동을 빠뜨렸다). 이 상태로는 이후 세션이
    `plan/in-progress/**` 를 훑을 때 이 항목이 "아직 미해결"로 잘못 읽혀, target(이미 반영된
    spec)과의 겉보기 불일치를 만든다.
  - 제안: 이번 developer 세션은 `plan/**` 쓰기 권한이 있으므로(codebase/**, plan/**,
    review/**/RESOLUTION.md), 아래 uuid.ts/canary 후속 항목을 마무리하는 커밋에 곁들여
    (a) 체크리스트 남은 2항목 `[x]` 처리(실측: link-integrity/plan-completion 테스트 전수
    재확인) (b) `git mv plan/in-progress/spec-draft-auth-invariants-sync.md
    plan/complete/` 를 함께 수행할 것을 권장. "이동만 담은 별 PR" 은 금지 규칙이므로 이번
    docstring fix 커밋에 묶는 것이 정본 경로다.

- **[INFO]** 이번 작업(uuid-canary docstring 정정)이 커버해야 할 후속 항목이 두 plan 에
  분산돼 있다 — 하나만 고치면 나머지 plan 의 체크박스가 stale 하게 남는다
  - target 위치: `codebase/backend/src/common/utils/uuid.ts` (`isUuidShaped` docstring,
    L25-26) · `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`
    (L26 "73건" 주석) — 둘 다 target spec(`1-auth.md`)이 code: 글로브로 실측 링크한 evidence
    표면
  - 관련 plan:
    1. `plan/in-progress/spec-draft-auth-invariants-sync.md` §후속(이 PR 밖) — `uuid.ts`
       docstring 의 캐너리 지목 정정: 현재 주석이 "이 저장소의 e2e 하나(`system-status.e2e-spec.ts`)가
       nil UUID 를 타 워크스페이스 프로브로 쓴다" 고 회귀 캐너리를 지목하는데, 같은 plan 의
       실측(§⚠️ 착수 중 발견)에 따르면 `system-status.controller.ts` 는 `@Roles()`/`@WorkspaceId()`
       가 없어 `RolesGuard` 가 `resolveRequestWorkspaceContext` 호출 **이전에** `return true`
       하므로 그 e2e 는 이 술어(`isUuidShaped`)에 닿지 않는다. spec 쪽(`data-flow/12-workspace.md`
       신설 Rationale)은 이미 정정됐고, 코드 쪽만 미정정으로 명시 등재돼 있다.
    2. `plan/in-progress/auth-guard-reflection-hardening.md` §후속(developer 범위) —
       `workspace-reflection-canary.ts` 의 "73건" 수치 정정: 그 수는 `@Roles()` 미부착
       서브셋인데 캐너리가 세는 것은 `@WorkspaceId()` 소비 라우트 전체(상위집합)라 실측치를
       넣거나 서브셋임을 명시해야 한다.
  - 상세: 두 항목은 서로 다른 파일(uuid.ts vs workspace-reflection-canary.ts)이지만 같은
    "reflection 캐너리 문서 정확성" 결함 클래스이고, worktree 이름(`uuid-canary-docstring-fix`)이
    양쪽을 함께 가리킨다. `auth-guard-reflection-hardening.md` 의 "developer 범위" 항목만 보면
    uuid.ts 건이 안 보이고, `spec-draft-auth-invariants-sync.md` 만 보면 "73건" 건이 (포인터로만)
    보인다 — 한쪽 plan 만 참조하면 나머지 하나를 놓칠 위험.
  - 제안: 두 docstring 을 한 커밋에서 함께 정정하고, 완료 후 두 plan 의 해당 체크박스를 각각
    `[x]` 로 갱신할 것. `uuid.ts` 쪽은 잘못된 e2e 인용을 실제 캐너리인 두 단위 테스트
    (`uuid.spec.ts` 의 술어 경계 테스트 · `workspace-context.util.spec.ts` 의 nil UUID 통과
    테스트)로 교체하면 되고, `12-workspace.md ## Rationale` 신설 subsection 이 이미 같은 문구로
    정정돼 있어 참조할 정본이 있다(재작업 아님, spec 을 그대로 code 주석에 반영).

- **[INFO]** 미해결 결정과의 충돌 없음 (확인됨)
  - target 위치: `spec/5-system/1-auth.md ## Rationale`, `3-error-handling.md §1.3`
  - 상세: 이번 docstring 정정이 다루는 두 사실(UUID 검증 강도 비대칭 vs 캐너리 카운트 의미)은
    이미 target spec 에 결정으로 확정·기록돼 있다(`isUuidShaped` 느슨 검증은 의도,
    "라우트 목록이 아니라 0건 여부만 본다"는 설계). 코드 주석을 그 결정에 맞춰 정확히 고치는
    작업이지 새 결정을 내리는 것이 아니므로, plan 이 "결정 필요"로 남겨둔 어떤 항목과도
    충돌하지 않는다. `spec/5-system/1-auth.md` frontmatter 의 `pending_plans:
    spec-sync-auth-gaps.md`(LDAP/SAML 셀프호스팅)도 무관한 영역이라 이 작업과 겹치지 않는다.

## 요약

target(`spec/5-system/`)에 대한 이번 impl-prep 시점에서, uuid-canary docstring 정정 작업이
전제하거나 충돌할 만한 미해결 "결정" 항목은 없다 — 다루는 두 사실 모두 이미 `1-auth.md`·
`data-flow/12-workspace.md` Rationale 에 결정으로 확정·기록돼 있고, 이번 작업은 코드 주석을
그 결정에 맞추는 순수 정합화다. 다만 두 가지 plan 위생 문제가 있다: (1) 이 결정들을 spec 에
적은 plan(`spec-draft-auth-invariants-sync.md`)이 실제로는 이미 머지(#1112)됐는데도
`plan/in-progress/` 에 미완료 상태로 남아 있어 라이프사이클 이동이 빠졌고, (2) 이번 작업이
커버해야 할 후속 항목(uuid.ts 캐너리 인용 정정 + canary "73건" 수치 정정)이 두 개의 서로 다른
plan 파일에 흩어져 있어 한쪽만 보면 나머지를 놓치기 쉽다. 둘 다 CRITICAL 은 아니며, 이번
작업 완료 커밋에 plan 체크박스 갱신 + `spec-draft-auth-invariants-sync.md` 의 `complete/` 이동을
함께 실으면 해소된다.

## 위험도
LOW
