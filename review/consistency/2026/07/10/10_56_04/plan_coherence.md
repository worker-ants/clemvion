# Plan 정합성 검토 — execution-engine §1.3 동기화 + execution-context.md 원칙 5 신설

## 검토 범위 확인

`git diff` 실측 결과, 이번(미커밋) 변경은 두 파일뿐이다:
- `spec/5-system/4-execution-engine.md` §1.3 `interaction.data` 표의 `form_submitted` 행을 `spec/conventions/node-output.md` §4.5(무변경 SoT)로 동기화 (`via?: 'ai_render'` + 적용 노드 `ai_agent(render_form)` 추가).
- `spec/conventions/execution-context.md` §1 에 "원칙 5 — `variables.__*` 시스템 예약 네임스페이스" 신설, **"강제 갭 (잔여 리스크)" 고지 포함** — 스키마 레벨 거부 가드(Variable Declaration/Modification 노드가 `__` 이름을 거부하지 않는 문제)를 "후속 하드닝 대상"으로 명시.

두 변경 모두 신규 설계 결정이 아니라 기존 코드/타 spec 에 이미 존재하던 사실의 문서화·동기화다 (선행 `review/consistency/2026/07/10/09_20_36/SUMMARY.md` WARNING#2 · INFO#2 가 정확히 이 두 항목을 권고했고, 이번 diff 는 그 권고를 그대로 반영한 결과 — `git diff origin/main -- spec/conventions/node-output.md` 무변경 확인, `filterUserVariables`/`node-handler.interface.ts` JSDoc 의 `__workspaceId`/`__workspaceName`/`__workspaceTimezone`/`__dryRun` 4종 선재 확인).

## 발견사항

- **[WARNING]** `variables.__*` 스키마 레벨 강제("후속 하드닝")를 언급하지만 이를 추적하는 `plan/in-progress/**` 항목이 없음
  - target 위치: `spec/conventions/execution-context.md` §1 원칙 5, "강제 갭 (잔여 리스크)" 불릿 (line 70) — "스키마 레벨 거부 가드는 후속 하드닝 대상이다(선례: carousel `button.id` 의 `__item_` prefix schema-level reject)."
  - 관련 plan: 없음 — `plan/in-progress/` 전체를 `__`/`reserved`/`prefix guard`/`스키마 레벨`로 grep 했으나 이 갭을 추적하는 항목이 존재하지 않는다. `plan/in-progress/node-output-redesign/variable-declaration.md`·`variable-modification.md` (변수명 검증을 다루는 실제 노드 plan)도 `__` 관련 언급이 전혀 없다. `plan/in-progress/node-output-redesign/carousel.md`(`__item_` schema-level reject 선례)는 이미 구현 완료로 기록돼 있어 대조는 유효하나, 원칙 5 가 인용하는 새 하드닝 작업 자체를 대신 추적하지는 않는다.
  - 상세: 본 프로젝트는 "후속 하드닝" 성격의 잔여 리스크를 두 가지 방식 중 하나로 다뤄왔다 — (1) `plan/complete/notif-hardening-followups.md`·`plan/complete/spec-update-notifications-background-run-id.md`처럼 명시적 하드닝 backlog 항목을 plan 문서로 신설하거나, (2) `spec/5-system/14-external-interaction-api.md:1177`(`nodeOutput` allowlist 잔여)처럼 사용자가 **의식적으로 무기한 defer 를 결정**한 경우 `plan/complete/eia-secret-masking-residuals.md` 에 "결정: 현행 유지" 형태로 종결 기록해 둔다. 이번 원칙 5 의 "강제 갭" 불릿은 어느 쪽도 아니다 — "후속 하드닝 대상이다"라는 능동적 forward-looking 서술이면서도 소유 plan·기한·우선순위가 없다. 오케스트레이터 CONTEXT 는 "the `__` enforcement hardening (schema guard) was spawned as a separate task, not bundled"라고 명시했는데, 이는 별도 sub-agent 호출로 시도됐다는 뜻일 뿐 `plan/in-progress/` 에 영속화된 흔적이 아니다 — CLAUDE.md 정보 저장 표는 "진행 중 작업 → `plan/in-progress/<name>.md`"를 단일 SoT 로 규정하므로, 세션이 끝나고 나면 이 forward-looking 약속이 어디에도 남지 않을 위험이 있다.
  - 제안: 둘 중 하나를 택해 정합화 — (a) `plan/in-progress/`에 스키마 레벨 `__` 거부 가드를 추적하는 짧은 stub plan(예: `variables-reserved-namespace-guard.md`, Variable Declaration/Modification 노드의 `__` prefix reject 스키마 변경 범위)을 신설하고 원칙 5 불릿에서 그 plan 을 링크, 또는 (b) 무기한 defer 로 확정할 의도라면 문구를 "후속 하드닝 대상이다"(능동 forward-ref)에서 `nodeOutput` allowlist 사례처럼 "현재는 규약 고지로 갈음하며 강제는 별도 결정 시 착수" 식의 accepted-risk 톤으로 조정.

## 미충돌 확인 (참고)

- `execution-engine.md` §1.3 `form_submitted` 행 동기화는 `plan/in-progress/execution-engine-residual-gaps.md`(G1/G2/G3, 모두 §11/§9.2 관련 — §1.3 무관), `plan/in-progress/exec-intake-followups.md`, `plan/in-progress/spec-sync-*-gaps.md` 계열의 어떤 미해결 결정과도 겹치지 않는다. 관련 노드 plan(`plan/in-progress/node-output-redesign/form.md`·`information-extractor.md`)도 `via: 'ai_render'` sentinel 자체를 재론하지 않는다 — 참조하는 `1-ai-agent.md §6.1.d.ii`/`§6.2` 앵커도 유효.
- 원칙 5 의 `__workspaceId` 선례는 `plan/in-progress/node-output-redesign/workflow.md:172`(`context.variables.__workspaceId` 를 cross-workspace 격리 검증에 전달)와 **일관** — 오히려 그 plan 의 서술을 뒷받침하는 방향이라 충돌 아님.
- `execution-context.md` 원칙 2(`ParallelBranchContext`)를 구현 책임으로 추적하는 `plan/in-progress/parallel-p2-followups.md §7`은 이번 diff 가 건드리지 않는 절(원칙 2/§Rationale ParallelBranchContext 단락)을 참조하므로 앵커·내용 모두 영향 없음.
- `spec/5-system/4-execution-engine.md` frontmatter `status: partial` + `pending_plans:`(execution-engine-residual-gaps.md, exec-intake-followups.md)는 이번 §1.3 표 행 수정과 무관한 G2(errorPolicy continue)만 근거로 유지되므로 이번 diff 로 영향받지 않는다.
- 원칙 5 가 인용하는 park 필터(`filterUserVariables`, `Execution.user_variables` 제외 정책)는 이미 구현·`status: implemented` 상태라 선행 plan 미해소 리스크 없음.

## 요약

이번 diff 는 신규 결정이 아니라 선행 consistency-check(09:20 라운드) WARNING/INFO 권고를 그대로 반영한 자기완결적 문서 동기화이며, `plan/in-progress/**` 의 어떤 미해결 결정과도 정면 충돌하지 않는다. 유일한 정합성 갭은 원칙 5 가 새로 명문화한 "강제 갭" 불릿이 "스키마 레벨 거부 가드는 후속 하드닝 대상"이라는 forward-looking 약속을 하면서도 이를 추적할 `plan/in-progress/` 항목이 전혀 없다는 점이다 — CONTEXT 상 별도 task 로 스폰됐다는 언급은 있으나 plan 문서로 영속화되지 않았으므로, 세션 종료 후 이 잔여 리스크가 유실될 위험이 있다. Critical 급 충돌은 없다.

## 위험도

LOW
