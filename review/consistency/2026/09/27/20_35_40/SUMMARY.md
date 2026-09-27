# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건(cross_spec) 발견. 5개 checker 전문 모두 확보(재시도 필요 항목 없음).

## 전체 위험도
**HIGH** — target 자체(`1-workflow-list.md` frontmatter `pending_plans` + Rationale 시제/경로 정정)는 정합적이나, target 이 고치는 것과 **완전히 동일한 결함**(허위 현재형 단언 + `pending_plans` 미추적)이 같은 원인 커밋(`a8bfd1492`)이 건드린 자매 문서 `spec/3-workflow-editor/0-canvas.md`에 남아 있음이 이번 세션 실측(18 RED e2e)으로 이미 뒷받침된다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | target 이 `1-workflow-list.md`에서 고치는 것과 동일한 패턴(허위 현재형 단언 + `status: partial`인데 `pending_plans` 미등재, build 가드로는 검출 불가)이 `0-canvas.md` §11.2.2에도 남아 있음. 같은 커밋(`a8bfd1492`)이 두 문서를 동시에 오염시켰고, `plan/in-progress/cross-workspace-refs.md`(71~95행)의 실측 e2e(18 RED, `containerId`·`toolOwnerId`·엣지 끝점 케이스 포함)가 이미 이 단언을 반증했다 | target 자체는 이 파일을 건드리지 않음(스코프 밖 사각지대) | `spec/3-workflow-editor/0-canvas.md` §11.2.2(633행) + frontmatter `pending_plans:` | 같은 planner 턴(또는 즉시 후속)에 `0-canvas.md` frontmatter `pending_plans:`에 `plan/in-progress/cross-workspace-refs.md` 추가. target이 `1-workflow-list.md`에 적용하는 것과 동일한 패턴(§1.1 인용 유지 + `pending_plans` 추적)을 그대로 적용 |

## planner 인계 (권한 밖 Critical)

> `(없음)` — target 자체가 이미 `owner: project-planner` 인 spec draft이며, 위 Critical(canvas.md 누락)의 처방(`pending_plans` 항목 추가)도 project-planner 권한 범위 내에서 직접 실행 가능하다. developer 턴에서 발견된 spec drift 같은 "권한 밖" 사례가 아니므로 인계 대상이 아니라, 이번 planner 턴 내에서 함께 처리할 항목이다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| — | — | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | Rationale의 plan 경로 인용이 bare backtick — 저장소 지배적 관례(실제 markdown 링크)와 거리. backtick 인용은 `spec-link-integrity.test.ts`가 검사하지 않아, 이번에 고치는 Critical(존재하지 않는 `plan/complete/cross-workspace-refs.md` 몇 주간 미검출)을 만든 바로 그 형식 결함이 재사용됨 | `## 변경안` 항목 2 — `` `plan/in-progress/cross-workspace-refs.md` `` (bare backtick) | 저장소 다수 spec Rationale의 `[label](../../plan/in-progress/....md)` 링크 관행 | 정정 문구를 실제 markdown 링크(`[plan/in-progress/cross-workspace-refs.md](../../plan/in-progress/cross-workspace-refs.md)`)로 바꿀 것 |
| 2 | plan_coherence | 트래커(`spec-draft-nullable-notation-followups.md`)가 target을 **아직 존재하지 않는** `plan/complete/spec-draft-cross-workspace-refs-2.md` 경로로 선인용 — 이번 라운드에서 잡힌 Critical과 동일한 "죽은 경로 선인용" 패턴이 target 대신 트래커 쪽에서 재발 (같은 커밋 `aef3dbac4`에서 신설) | `plan/in-progress/spec-draft-nullable-notation-followups.md:1493-1494` | target: `plan/in-progress/spec-draft-cross-workspace-refs-2.md` (아직 `status: in-progress`) | target 적용 후 `plan/complete/`로 이동하는 시점에 트래커 인용 경로 재확인. 세션이 끊기면 트래커 문구를 "(예정, 아직 `plan/in-progress/`)" 로 낮출 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity / plan_coherence (중복) | "(Planned) 라벨 생략" 결정의 선례 인용("같은 문서가 이미 그 방식으로 `marketplace-and-plugin-sdk`를 추적한다")이 실제와 불완전 대응 — marketplace 항목은 `pending_plans` 등재와 **별개로** 본문 인라인 "(Planned)" 라벨도 함께 쓰고 있어, "pending_plans 단독으로 충분"이라는 선례로는 부적합. 결정 자체의 실질 근거(same-PR 착지로 라벨이 태어나자마자 거짓이 됨)는 별도로 성립해 반박은 아님 | `plan/in-progress/spec-draft-cross-workspace-refs-2.md` `## Rationale` 첫 항목 | 선례 문장을 "marketplace 항목은 라벨+pending_plans 병용, 이 항목은 배포 시점이 확정적이라 다름"으로 정정하거나, 선례 인용 문장 자체를 삭제하고 same-PR 근거만 남길 것 |
| 2 | cross_spec | 트리거·스케줄·알림 규칙 API 문서(`2-trigger-list.md`/`3-schedule.md`/`9-user-profile.md`)의 §1.1 한 줄 미러 누락은 직전 라운드부터 이미 추적 중이며 target Rationale W3가 후속 트래커 등재를 명시함 — 재차단 불필요, canvas.md 건과는 성격이 다름(단순 미러 누락 vs 반증된 단언+미추적)이라는 점만 참고 | 트리거·스케줄·user-profile 3개 문서 | 이관된 트래커(`spec-draft-nullable-notation-followups.md`)에서 계속 추적 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | target 자체는 정합적이나, 동일 결함이 `0-canvas.md` §11.2.2에 미해결로 남아 있음(Critical) |
| rationale_continuity | LOW | "(Planned) 라벨 생략" 선례 인용이 결론을 완전히 뒷받침하지 못함(INFO) |
| convention_compliance | LOW | plan 경로 bare backtick 인용, markdown 링크 관례 미준수(WARNING) |
| plan_coherence | LOW | 트래커가 target을 아직 없는 `plan/complete/` 경로로 선인용(WARNING) + 선례 인용 이슈(INFO, rationale_continuity와 중복) |
| naming_collision | NONE | 새 식별자 신설 없음, 충돌 없음 |

## 권장 조치사항
1. **(BLOCK 해소)** `spec/3-workflow-editor/0-canvas.md` frontmatter `pending_plans:`에 `plan/in-progress/cross-workspace-refs.md` 추가 — target이 `1-workflow-list.md`에 적용하는 것과 동일한 패턴. 이 세션(project-planner turn) 내에서 함께 처리 가능하며 별도 인계 불요.
2. `## 변경안` 항목 2의 plan 경로 인용을 bare backtick에서 실제 markdown 링크로 전환 — `spec-link-integrity.test.ts` build 가드가 향후 plan 이동 drift를 잡도록.
3. `spec-draft-nullable-notation-followups.md:1493-1494`의 target 경로 인용을 target 실제 상태(`plan/in-progress/`)에 맞게 정정하거나, target 적용·이동 시점에 재확인 예정임을 명시.
4. Rationale 첫 항목의 marketplace 선례 인용 문구를 실제 관례(라벨+`pending_plans` 병용)에 맞게 정정하거나 삭제.