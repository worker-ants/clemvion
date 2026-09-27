# Plan 정합성 검토 — `plan/in-progress/spec-draft-cross-workspace-refs-2.md`

## 발견사항

- **[INFO]** 구현 plan `cross-workspace-refs.md` 의 자체 이력 서술이 draft 2 가 다루는 2회차 `--impl-prep` 사이클을 아직 반영하지 않는다
  - target 위치: (target 자체는 이 파일을 건드리지 않음 — 변경안 3항목 모두 spec 파일)
  - 관련 plan: `plan/in-progress/cross-workspace-refs.md` 체크리스트 2번째 줄("`--impl-prep` — 19_43_46 BLOCK: YES → planner 턴(`a8bfd1492`) → 재실행 (아래)")과 `## --impl-prep · planner 턴 처분` 섹션. 이 섹션은 1회차(`19_43_46` BLOCK:YES → `a8bfd1492`)만 기록하고, target draft 2 자신이 header 에서 인용하는 2회차(`--impl-prep` 재실행 `20_21_21` BLOCK:YES(Critical 1) → 이 draft 2)는 기록돼 있지 않다.
  - 상세: `cross-workspace-refs.md` 는 "재실행 (아래)" 라고 적어 두어 이후 라운드도 그 섹션에 이어 적힐 것을 암시하는데, 실제로는 2회차(및 이를 해소하는 이 draft 2, 나아가 draft 2 위에서 또 두 번 더 열린 `--spec` BLOCK:YES 라운드 `20_35_40`·`20_45_35`)가 구현 plan 문서 쪽에는 전혀 교차 인용되지 않는다. target 은 spec 파일만 바꾸는 project-planner 턴이라 이 구현 plan(owner: developer) 갱신은 범위 밖일 수 있으나, 기록이 갈라진 채로 남으면 이후 `--impl-prep` 재재실행이나 `--impl-done` 시점에 "지금까지 몇 라운드가 있었는지"를 이 문서 하나로 재구성할 수 없다.
  - 제안: 차단 사유는 아니다 — developer 가 다음 체크포인트(구현 착수 커밋 또는 다음 `--impl-prep` 재실행)에서 `## --impl-prep · planner 턴 처분` 섹션에 "2회차 `20_21_21` BLOCK:YES(Critical 1, `1-workflow-list.md` pending_plans 미추적) → draft 2(`plan/in-progress/spec-draft-cross-workspace-refs-2.md`, `--spec` 3라운드 끝에 적용) → 재실행 예정" 한 줄을 덧붙이면 기록이 다시 맞아떨어진다.

## 교차 검증 메모 (참고용 — 위 발견사항의 근거)

target 이 해소하려는 세 가지 선행 게이트를 실측으로 대조했다:

1. **`--impl-prep 20_21_21` BLOCK:YES(Critical 1)** — `1-workflow-list.md` frontmatter `pending_plans` 에 책임 plan 이 없다는 지적. 현재 파일(`spec/2-navigation/1-workflow-list.md:11-13`) 을 직접 읽어 확인 — `pending_plans:` 에 `marketplace-and-plugin-sdk.md` · `workflow-duplicate-nodes-edges.md` 만 있고 `cross-workspace-refs.md` 항목이 없다. target 의 변경안 1번이 이를 정확히 추가한다.
2. **`--spec 20_35_40` BLOCK:YES(Critical 1)** — 같은 결함이 `0-canvas.md` 에도 있다는 지적. 현재 파일(`spec/3-workflow-editor/0-canvas.md:13-15`) 확인 — `pending_plans:` 에 `ai-agent-tool-connection-rewrite.md` · `spec-sync-canvas-gaps.md` 만 있다. target 의 변경안 2번이 이를 추가한다. 같은 라운드의 WARNING 2(트래커가 아직 없는 `plan/complete/spec-draft-cross-workspace-refs-2.md` 를 선인용)는 target Rationale 마지막 항목에서 "이 draft 는 적용 커밋에서 그 경로로 옮겨진다" 로 답하며, 실제로 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md:1494`)의 인용이 지금 그 경로를 가리키고 있어 정합적이다.
3. **`--spec 20_45_35` BLOCK:YES(Critical 1)** — `1-data-model.md` 는 `EXCLUDE_BASENAMES`(`codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:57-61`) 대상이라 frontmatter-evidence 가드 4종 전부가 순회하지 않는데, draft 1차본이 "§3 이 가드로 강제한다"는 반증 가능한 근거로 그 frontmatter 를 건드리려 했다는 지적. target 은 이번엔 `1-data-model.md` frontmatter 를 아예 건드리지 않기로 결정했고, 코드(`EXCLUDE_BASENAMES` 실제 내용)와 대조해 이 결정이 사실과 일치함을 확인했다. `data-flow/11-workflow.md`·`data-flow/12-workspace.md` 도 frontmatter(YAML `---` 블록) 자체가 없어 target 이 말하는 "라이프사이클 비추적 범주" 분류와 일치한다.

target 의 변경안 3번(1-workflow-list.md Rationale §3 정정 문장)이 고치려는 `plan/complete/cross-workspace-refs.md`(완료형·부재 경로) 인용은 저장소 전체 `spec/` grep 에서 **이 한 줄에만** 존재한다 — `0-canvas.md`·`data-flow/12-workspace.md` 등 같은 규칙을 인용하는 다른 자리에는 plan 경로 인용 자체가 없어, 이번 정정 범위가 빠뜨린 자매 결함은 없다.

구현 plan(`plan/in-progress/cross-workspace-refs.md`) 체크리스트는 "구현·단위·CHANGELOG·트래커"·"뮤턴트"·"TEST WORKFLOW"·"`/ai-review`"·"`--impl-done`" 이 전부 미체크 상태이며 e2e 는 18건 RED(실측)로 남아 있다 — target 이 추가하는 `pending_plans` 항목이 가리키는 "미구현 surface" 진단과 정확히 일치한다. `plan/in-progress/ai-agent-tool-connection-rewrite.md`(같은 `0-canvas.md` 를 이미 pending_plans 로 가리킴, §12 Tool Area 담당)와 `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커, §1.1 미러 후속 항목 보유) 를 포함해 `1-data-model.md`/`0-canvas.md`/`1-workflow-list.md` 를 언급하는 다른 in-progress plan 을 전수 grep 했으나, target 의 결정과 상충하거나 target 이 반영하지 못한 미해결 결정·선행조건은 발견되지 않았다.

## 요약

target draft 는 같은 원인 커밋(`a8bfd1492`)이 두 spec 문서에 남긴 "구현 전 현재형 서술 + `pending_plans` 미추적" 결함을 정확히 겨냥하고, 그 결함을 세 차례(`--impl-prep 20_21_21`, `--spec 20_35_40`, `--spec 20_45_35`) 걸쳐 지적된 게이트 전부에 실측 대조로 부합하게 해소한다 — `1-workflow-list.md`·`0-canvas.md` frontmatter 추가, `1-data-model.md` frontmatter 미변경 결정(EXCLUDE_BASENAMES 실측과 일치), 트래커 인용 정합성 모두 저장소 현재 상태와 어긋나지 않는다. 유일한 잔여 갭은 구현 plan 자신의 이력 서술이 이번 2회차 `--impl-prep`/`--spec` 사이클을 아직 교차 기록하지 않는다는 점으로, 차단 사유는 아니고 developer 가 다음 체크포인트에서 정리하면 되는 추적 메모 수준이다.

## 위험도
LOW
