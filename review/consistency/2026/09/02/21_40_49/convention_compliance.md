# 정식 규약 준수 검토 — `spec/5-system/` (`--impl-prep`)

검토 대상: 현재 worktree 의 **미커밋 diff**(`git status --short` 기준) —
`spec/5-system/1-auth.md` · `spec/5-system/3-error-handling.md` ·
`spec/conventions/error-codes.md` · `spec/2-navigation/9-user-profile.md`
(연결 plan: `plan/in-progress/auth-change-password-oauth-only-code-split.md`,
`spec_impact` 가 이 4개 파일과 정확히 일치). 이미 HEAD 에 커밋된 선행 변경
(`2ff000a6a` 의 §6 `202`/`410` 등재 등)은 코드가 이미 구현된 상태를 뒤늦게
spec 에 반영한 것으로 실측 확인했고 규약 위반 없음 — 아래는 **미커밋 diff**에 한정한다.

## 발견사항

- **[CRITICAL] spec 이 아직 구현되지 않은 코드 분리를 "이미 완료된 사실"로 서술**
  - target 위치: `spec/5-system/1-auth.md` §2.3 note("두 조건을 갈라 반환한다 … → `PASSWORD_REQUIRED`(401) · 불일치 → `PASSWORD_INVALID`(401)") · §5 note("`changePassword` 가 두 조건에 같은 코드를 던지던 것을 … 갈랐다") / `spec/5-system/3-error-handling.md` §1.2 카탈로그 표(`INVALID_PASSWORD` 행 **삭제**) · §1.2.1 표(`PASSWORD_REQUIRED`/`PASSWORD_INVALID` 설명에 "**비밀번호 변경**(`UsersService.changePassword`) 공용" 추가) · 근접명명 note("지금은 `changePassword` 가 형제와 같은 두 코드를 발행하므로 … `INVALID_PASSWORD` 는 wire 에서 은퇴해 …") / `spec/conventions/error-codes.md` §5 신규 행("`INVALID_PASSWORD` | 조건별 2종 …")
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 lifecycle 표(`status: implemented` = "모든 약속 구현 완료", `status: partial` = "`pending_plans:` 의무") 및 §5 Overview 가 스스로 선언하는 목적("spec 가 약속한 surface 가 *지금* 구현됐는가 … 갭을 build-time 가드로 차단"). 아울러 `error-codes.md` §5 자신의 정의문("§2 의 안정성 정책은 rename 을 breaking change 로 규정 … **구 코드는 더 이상 발행되지 않으며(코드베이스에서 완전 제거)**")
  - 상세: `codebase/backend/src/modules/users/users.service.ts:274-295` 를 직접 열어 확인 — `changePassword` 는 **지금도** `passwordHash` 부재(OAuth-only)·불일치 **두 조건 모두**에 동일하게 `code: 'INVALID_PASSWORD'` 를 던진다(JSDoc `@throws … INVALID_PASSWORD` 도 구 서술 그대로). 즉 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로의 분리는 코드에 **전혀 반영되지 않았다**. 그런데 위 4개 spec 파일(diff)은 이를 현재형("발행한다", "갈랐다", "은퇴했다")으로 서술하고, `3-error-handling.md` §1.2 활성 카탈로그에서는 `INVALID_PASSWORD` 행 자체를 **삭제**했다. `error-codes.md`·`3-error-handling.md` 는 `status: implemented`(둘 다 `pending_plans:` 필드 없음)라 이 갭을 등재할 그릇이 없고, `1-auth.md`(`status: partial`, `pending_plans: spec-sync-auth-gaps.md`)도 이 특정 갭의 책임 plan(`auth-change-password-oauth-only-code-split.md`)을 등재하지 않았다. `auth-change-password-oauth-only-code-split.md` 본문도 스스로 "**developer 턴이 필요하다.** backend 분기·단위/e2e 테스트·FE 문구가 함께 움직인다" 라고 적어, 코드 변경이 **아직 오지 않은 별도 턴**임을 인정한다 — 즉 이 diff 는 정확히 spec-impl-evidence 컨벤션이 막으려는 "spec 약속 vs 구현 부재" 갭을 무방비 상태로 만든다.
  - 제안: 두 갈래 중 하나 — (a) 이 spec 갱신과 **같은 커밋 안에서** `users.service.changePassword` 를 실제로 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 분리하는 developer 턴을 이어서 수행한 뒤 커밋(§1193 선례 `f65ca193c` 와 동일 패턴 — spec+code 한 커밋), 또는 (b) 지금 커밋한다면 4개 문서 모두에서 서술을 "결정 확정·구현 예정" 으로 낮추고(과거형/완료형 삭제), `3-error-handling.md`·`error-codes.md` 를 이 특정 항목에 한해 `status: partial` + `pending_plans: [auth-change-password-oauth-only-code-split.md]` 로 전환하거나 최소한 `1-auth.md`/`9-user-profile.md` 의 `pending_plans:` 에 그 plan 을 추가해 갭을 명시적으로 등재한다.

- **[WARNING] `9-user-profile.md` 가 미구현 FE 안내 분기를 SoT 로 선언하면서 책임 plan 을 `pending_plans:` 에 등재하지 않음**
  - target 위치: `spec/2-navigation/9-user-profile.md` §2.2 "비밀번호 변경" 행 — "**OAuth-only 계정**(비밀번호 미설정)은 … `PASSWORD_REQUIRED`(401)로 막히며, 화면은 비밀번호를 **추가**하는 경로 … 를 안내한다 — 이 행이 그 안내의 단일 SoT 다."
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 — `pending_plans` 필드 정의("미구현 surface 를 **책임지는 plan 경로**")
  - 상세: `codebase/frontend/src/app/(main)/w/[slug]/profile/change-password/page.tsx` grep 결과 `PASSWORD_REQUIRED` 분기·"비밀번호 추가 경로 안내" UI 가 존재하지 않는다 — 즉 이 행이 "SoT" 라고 선언한 안내 분기는 미구현이다. 파일이 `status: partial` 라 미구현 자체는 허용되지만, frontmatter `pending_plans:` 는 기존 `spec-sync-user-profile-gaps.md` 하나만 있고 이 신규 서술의 책임 plan(`auth-change-password-oauth-only-code-split.md`)은 등재돼 있지 않다 — `1-auth.md` 가 자기 own gap 을 `spec-sync-auth-gaps.md` 로 등재하는 것과 대칭이 깨진다.
  - 제안: `9-user-profile.md` frontmatter `pending_plans:` 에 `plan/in-progress/auth-change-password-oauth-only-code-split.md` 추가.

- **[INFO] `error-codes.md §5` "PR" 컬럼 포맷이 선례(짧은 PR/이슈 식별자)에서 이탈 + 향후 dangling link 위험**
  - target 위치: `spec/conventions/error-codes.md` §5 표, 신규 `INVALID_PASSWORD` 행의 4번째 컬럼(`[auth-change-password-oauth-only-code-split.md](../../plan/in-progress/auth-change-password-oauth-only-code-split.md)`)
  - 위반 규약: 엄밀한 "명시적 금지" 위반은 아니나, 같은 표의 선례 3행(`PR4b`·`#1193`·`#566`, 헤더 `| 구 코드 | 대체 코드 | HTTP | PR | 비고 |`)은 모두 완료된 PR/이슈의 **짧은 식별자**를 쓴다. `.claude/docs/plan-lifecycle.md` §3 "인입 참조" 규칙("`spec/` 등 살아있는 문서의 plan 링크는 이동과 동시에 갱신")
  - 상세: 이 행은 아직 시작되지 않은 developer 작업을 가리키는 **`plan/in-progress/` 상대링크**를 "PR" 자리에 넣었다. `auth-change-password-oauth-only-code-split.md` 가 나중에 `plan/complete/` 로 이동하면 이 링크는 깨진다 — plan-lifecycle 규칙상 이동 주체가 갱신할 의무가 있으나, 실제로 실행되지 않으면 조용히 dangling 된다(`findBrokenPlanLinks` 는 `plan/complete/**` 를 의도적으로 제외하므로 가드가 못 잡을 가능성).
  - 제안: 지금 당장 고칠 필요는 없으나, 실제 PR 이 머지되는 시점에 이 셀을 PR 번호로 교체하거나(선례와 정합), plan 이동 시 링크를 `plan/complete/…` 로 갱신하는 것을 그 이동 커밋의 체크리스트에 명시.

- **[INFO] `9-user-profile.md` 표 셀 문장 경계 누락**
  - target 위치: `spec/2-navigation/9-user-profile.md` §1.1 표 "비밀번호" 행 — "…자세한 폼은 §2.2 참조 OAuth-only 계정의 안내 분기는 §2.2 보안 설정 표(비밀번호 변경 행)가 SoT."
  - 위반 규약: 명시적 규약은 없으나 문서 구조 관점의 가독성 일관성.
  - 상세: "§2.2 참조" 와 "OAuth-only" 사이에 마침표/줄바꿈이 없어 한 문장처럼 붙어 읽힌다.
  - 제안: "…자세한 폼은 §2.2 참조. OAuth-only 계정의 안내 분기는…" 로 마침표 삽입.

## 요약

target(`spec/5-system/` 및 연결된 `1-auth.md`/`3-error-handling.md`/`error-codes.md`/`9-user-profile.md`)의 **명명·표 포맷·문서 3섹션 구조**는 대체로 정식 규약을 잘 따른다 — 근접 명명(§3 historical-artifact ↔ §5 rename 이력) 이관, `UPPER_SNAKE_CASE`, 신규 코드 대신 기존 형제 코드 재사용 등은 오히려 모범적이다. 다만 가장 중요한 결함은 **미커밋 diff 가 아직 구현되지 않은 `changePassword` 에러 코드 분리를 이미 완료된 사실로 서술**한다는 점이다 — `users.service.ts` 를 직접 확인하면 지금도 `INVALID_PASSWORD` 하나만 던지는데, `status: implemented`(pending_plans 없음)인 두 문서를 포함해 4개 spec 파일이 "발행한다/갈랐다/은퇴했다" 로 단정한다. 이는 `spec-impl-evidence.md` 컨벤션이 정확히 막으려는 "spec 약속 vs 구현 부재" 갭이며, `--impl-prep` 게이트가 이 시점에 잡아야 할 항목이다. developer 후속 턴이 실제로 코드를 분리하면(같은 커밋 또는 이어지는 턴) 자동 해소되지만, 그 전에 커밋/머지된다면 문서가 거짓 보장을 남긴다.

## 위험도
HIGH
