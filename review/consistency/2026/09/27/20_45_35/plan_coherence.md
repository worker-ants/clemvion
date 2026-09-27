# Plan 정합성 검토 — spec draft 2 (cross-workspace-refs)

## 발견사항

- **[WARNING]** `1-data-model.md` 상태 되돌림을 보장한다는 근거(§3 가드)가 이 파일에는 적용되지 않는다 — 자동 추적 없는 후속 항목
  - target 위치: `plan/in-progress/spec-draft-cross-workspace-refs-2.md` `## 변경안` 항목 3
    (`spec/1-data-model.md` `status: implemented → partial`, `pending_plans:` 추가 + 근거로
    "`spec/conventions/spec-impl-evidence.md` §3 이 «마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서
    승격» 을 가드로 강제한다" 인용)
  - 관련 plan: `plan/in-progress/cross-workspace-refs.md` (구현 plan, 체크리스트 `[ ] 구현 · 단위 · CHANGELOG · 트래커` 등 미완료 —
    이 plan 이 `complete/` 로 옮겨지는 시점에 `1-data-model.md` 를 `implemented` 로 되돌리는 작업이 **어떤 체크리스트 항목에도 없다**)
  - 상세: `spec/conventions/spec-impl-evidence.md` §1 은 "적용 대상" inclusive list(`spec/2-navigation/**` ·
    `spec/3-workflow-editor/**` · `spec/4-nodes/**` · `spec/5-system/**` · `spec/7-channel-web-chat/**` ·
    `spec/conventions/**`)를 명시하고, 그 안에서도 `EXCLUDE_BASENAMES`(`0-overview.md` · **`1-data-model.md`** · `6-brand.md`,
    "단순 overview 성격")를 별도로 제외한다고 §1 이 직접 적는다. `spec/1-data-model.md` 는 두 겹으로 빠진다 — (a) 애초에
    `spec/1-data-model.md` 경로가 INCLUDE_PREFIXES 어느 것과도 시작이 일치하지 않고, (b) 설령 일치했더라도 basename 이
    EXCLUDE_BASENAMES 에 등재돼 있다. 실제 구현(`codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`
    `isApplicable()`, 57~61행 · 75~83행)도 이를 그대로 시행한다 — `collectApplicableSpecs()` 가 `isApplicable` 로 파일 목록을
    거르므로 `1-data-model.md` 는 반환 목록에 아예 나타나지 않는다. §3/§4 의 4개 frontmatter-evidence 가드
    (`spec-frontmatter.test.ts` · `spec-code-paths.test.ts` · `spec-status-lifecycle.test.ts` ·
    `spec-pending-plan-existence.test.ts`) 는 전부 이 `collectApplicableSpecs()` 위에서 도는 것을 소스로 확인했다
    (각 테스트 파일의 import·호출부). 즉 target 이 근거로 든 "`partial` → `pending_plans` 전부 `complete/` 로 이동하면
    `implemented` 로 승격을 가드가 강제한다"(`spec-status-lifecycle.test.ts` (c))는 `1-data-model.md` 에는 **적용되지 않는다** —
    이 파일의 `status`/`pending_plans` 필드는 어느 build 가드도 읽지 않는 순수 서술이다. 같은 항목이 함께 건드리는
    `1-workflow-list.md`(`spec/2-navigation/**`)·`0-canvas.md`(`spec/3-workflow-editor/**`)는 반대로 INCLUDE_PREFIXES 안에
    있어 가드가 정상 작동한다 — 세 파일 중 `1-data-model.md` 하나만 이 안전망이 빠진다는 비대칭을 target 이 인지하지 못한다.
    결과적으로 구현 plan(`plan/in-progress/cross-workspace-refs.md`)이 `complete/` 로 옮겨져도 `1-data-model.md` 의
    `status: partial` 을 `implemented` 로 되돌리는 동작은 **아무도 자동으로 수행하지 않으며**, 그 수동 작업이 어느 plan
    체크리스트에도 등재돼 있지 않다 — 후속 항목 누락.
  - 제안: target 의 항목 3 Rationale 에서 "가드가 강제한다" 서술을 지우거나 "이 파일은 EXCLUDE_BASENAMES 라 가드 미적용 —
    수동으로 되돌려야 한다" 로 정정하고, `plan/in-progress/cross-workspace-refs.md` 체크리스트(또는 완료 커밋 설명)에
    "`spec/1-data-model.md` frontmatter `status` 를 `implemented` 로 되돌리고 `pending_plans` 를 제거" 항목을 명시적으로
    추가할 것. 대안으로 애초에 이 파일에 `status: partial`/`pending_plans` 를 붙이지 않고(§1.1 의 구현 전 서술 문제는
    본문에 "(Planned)" 라벨 등 다른 수단으로 표시) EXCLUDE_BASENAMES 파일에 무의미한 lifecycle 필드를 얹지 않는 방법도
    검토할 것.

## 요약

target 은 직전 두 라운드(`20_21_21` Critical, `20_35_40` Critical)가 지적한 "구현 전 착지한 현재형 서술 + `pending_plans` 미추적"
결함을 `1-workflow-list.md`·`0-canvas.md`·`1-data-model.md` 세 파일에 일관되게 적용하려 하며, 앞의 두 파일에 대해서는 frontmatter
변경이 실제 build 가드(`spec-pending-plan-existence.test.ts`·`spec-status-lifecycle.test.ts`)의 보호를 받아 plan 완료 시
자동으로 검증·승격되므로 정합적이다. 그러나 세 번째 파일 `spec/1-data-model.md` 는 `spec-impl-evidence.md` §1 이 명시하고
소스(`spec-frontmatter-parse.ts`)가 시행하는 `EXCLUDE_BASENAMES` 대상이라, target 이 근거로 인용한 "가드가 승격을 강제한다"는
문장이 이 파일에는 사실이 아니다 — 세 파일에 동일하게 적용하려던 안전망이 하나에서 조용히 빠지는 후속 항목 누락이 하나 있다.
그 외 나머지 항목(펜딩 플랜 경로 표기 방식 · Rationale 시제 정정 · 트래커 처분)은 이전 라운드가 지적한 결함과 일관되게
해소되어 있고, 다른 진행 중 plan 과의 충돌이나 미해소 선행조건은 발견되지 않았다.

## 위험도
MEDIUM
