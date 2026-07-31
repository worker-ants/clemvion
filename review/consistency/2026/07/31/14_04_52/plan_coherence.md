# Plan 정합성 검토 — spec-workflow-version-snapshot-drift

## 검토 대상

- target: `plan/in-progress/spec-workflow-version-snapshot-drift.md` (spec draft, `--spec` 모드)
- 변경 스코프: `spec/1-data-model.md` §2.15 `WorkflowVersion.snapshot` 행 서술 정정 (코드 변경 없음)
- 대조 대상: `plan/in-progress/**` 전체 (프롬프트에 포함된 문서 + 컨텍스트 예산 초과로 생략된
  49개 파일은 target worktree 안에서 직접 `Read`/`grep` 하여 전량 확인)

## 점검 관점별 결론

**1. 미해결 결정과의 충돌** — 없음. `plan/in-progress/` 전체를 `workflow_version|restoreVersion|버전
스냅샷|WorkflowVersion` 으로 grep 한 결과 이 주제를 다루는 문서는 target 자신과
`workflow-duplicate-nodes-edges.md` 둘뿐이며, 후자는 target 과 상충하는 "결정 필요" 항목을 갖고
있지 않다(오히려 아래 §2 처럼 동일 결론을 이미 전제).

**2. 선행 plan 미해소** — 없음. target 의 TO-BE 가 SoT 로 지목하는
`spec/data-flow/11-workflow.md` 의 "버전 스냅샷 = JSONB" Rationale(`workflow.settings` 는
포함하지 않는다)은 이 worktree 안에 **이미 실재**한다(직접 Read 로 확인,
`spec/data-flow/11-workflow.md:233-236`). 이 문서를 손댄 `workflow-duplicate-nodes-edges.md` 는
자신의 spec 변경 체크리스트(§1.1~§1.4)를 전부 `[x]` 로 완료했고 그 커밋들이 이미 이 worktree
히스토리에 들어와 있다 — 즉 target 이 참조하는 선행 산출물은 미해소 상태가 아니라 확정된 상태다.
`WorkflowsService.buildSnapshot()` 코드 실측(`workflows.service.ts:622-653`, name/description/nodes/edges
4키·settings 없음)도 target 인용과 정확히 일치해 "코드가 이미 옳다" 는 전제 역시 성립한다.

**3. 후속 항목 누락** — **WARNING 1건** (아래 상세).

## 발견사항

- **[WARNING]** target 완료 후 원본 plan(`workflow-duplicate-nodes-edges.md`)의 대응 체크박스를
  갱신하는 단계가 target 체크리스트에 없다
  - target 위치: `plan/in-progress/spec-workflow-version-snapshot-drift.md` `## 체크리스트`
    (L66-70) / `### 발견 경위` (L40-45)
  - 관련 plan: `plan/in-progress/workflow-duplicate-nodes-edges.md` `## 3. 후속 항목 (본 PR
    범위 밖 — 별도 PR)` 의 세 번째 불릿 (L170-174):
    > `- [ ] **spec/1-data-model.md:572 §2.15 snapshot 서술 정정** (planner 턴 필요) — ...
    > 경량 spec-only PR 로 처리.`
    이 항목은 아직 `[ ]` 미체크 상태이며, `workflow-duplicate-nodes-edges.md` 는 이 항목을
    포함한 미해결 follow-up 이 남아있어 `status: in-progress` 로 남아 있다(plan-lifecycle §2 —
    미해결 follow-up 이 하나라도 있으면 `in-progress/` 유지).
  - 상세: target 자신이 "발견 경위" 절에서 이 항목의 승계 관계를 정확히 밝히고 있어(**의도된
    인계**이지 중복 작업이 아님 — naming_collision 체커도 같은 결론), 작업 자체의 정당성에는
    문제가 없다. 문제는 **닫는 절차**다. target 이 `spec/1-data-model.md` §2.15 를 정정하고
    push+PR 을 마쳐도, target 자신의 체크리스트에는 `workflow-duplicate-nodes-edges.md` 쪽
    체크박스를 갱신하는 항목이 없다. 그 결과 target 이 완료·`plan/complete/` 로 이동한 뒤에도
    `workflow-duplicate-nodes-edges.md` §3 는 이미 끝난 작업을 여전히 "미해결 follow-up"으로
    보유하게 된다 — plan 체크박스가 실제 상태를 반영해야 한다는 본 프로젝트의 반복 원칙(체크박스
    drift 는 과거에도 수 차례 실제 사고로 이어진 패턴)에 어긋나는 결과를 낳는다. 부수 효과로
    `workflow-duplicate-nodes-edges.md` 는 이 항목이 남아있는 한 `plan-stale-audit.sh` 의 stale
    후보 목록에 계속 잡히고, 향후 grooming 시점에 "아직 안 끝난 항목"으로 오판되어 중복 조사
    비용을 유발할 수 있다.
  - 제안: target `## 체크리스트`에 다음 스텝을 추가한다 — "`workflow-duplicate-nodes-edges.md`
    §3 의 `spec/1-data-model.md:572 §2.15` 항목을 `[x]` 로 갱신하고 본 PR/plan 으로의 이관을
    각주로 남긴다." 또는 최소한 target 을 `plan/complete/` 로 옮기는 커밋에 이 갱신을 동반한다.
    (이 조치는 target 의 TO-BE spec 변경안 자체에는 영향을 주지 않는다 — 순수 plan 위생 항목.)

## 부가 확인 (충돌 없음 — 근거만 기록)

- `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 가
  `spec/1-data-model.md:546` §2.14(`NodeExecution.status`)를 인용하지만, target 이 다루는
  §2.15(L572)와는 다른 표/다른 관심사라 편집 충돌 없음.
- `plan/in-progress/rag-quality-improvement.md`, `node-cancellation-residual-signal-propagation.md`
  도 `1-data-model.md` 를 인용하지만 각각 RAG/§2.4 chatChannel 트리거 관련 무관 섹션.
- "snapshot" 키워드로 걸리는 다른 in-progress 문서(`node-output-redesign/*`,
  `chat-channel-visual-ssr-png.md`, `spec-sync-external-interaction-api-gaps.md`)는 전부
  노드 output/시각 스냅샷 등 **다른 의미의 snapshot**이며 `workflow_version.snapshot` 과 무관.
- `spec/1-data-model.md`·`spec/data-flow/11-workflow.md` 모두 `pending_plans:` frontmatter 를
  쓰지 않는 상태(전자는 `status: implemented`, 후자는 frontmatter 자체 없음)라 target 변경으로
  추가 동기화할 frontmatter 필드는 없음.
- 다른 worktree/branch 의 동시 진행 여부는 검토 범위 밖(정책상 로컬 반영 안 되는 신호는 신뢰 불가).

## 요약

target 이 다루는 `workflow_version.snapshot` 구성 정정은 `plan/in-progress/` 전체에서 유일하게
연관된 선행 문서인 `workflow-duplicate-nodes-edges.md` §3 의 명시적 후속 항목을 그대로 이어받는
**의도된 인계**이며, 그 문서가 참조하는 선행 산출물(data-flow Rationale, buildSnapshot 코드)은
이미 이 worktree 안에서 확정된 상태라 미해소 전제나 결정 충돌은 발견되지 않았다. 유일한 갭은
target 완료 시 원본 plan 의 대응 체크박스를 되돌아가 갱신하는 절차가 target 체크리스트에
빠져있다는 점으로, 이는 차단 사유가 아니라 plan 위생 차원의 WARNING 이다.

## 위험도

LOW
