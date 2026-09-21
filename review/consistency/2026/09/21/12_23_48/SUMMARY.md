# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 전체 전문 확보. Critical 발견 0건.

## 전체 위험도
**MEDIUM** — 차단 사유는 없으나, 이미 5차례(#1369~#1372) 반복 관찰된 "DELETE 멱등성 표 vs 동시요청 진 쪽 404" 정면충돌이 이번 PR(`WorkspacesService.removeMember()`)로 6번째 사례를 얻고, 그 사실이 아직 어느 트래커에도 반영되지 않았다는 지적이 3개 checker(cross_spec·rationale_continuity·plan_coherence)에서 교차 확인됐다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 검토에서 Critical 판정이 없어 인계 대상 자체가 없다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | `DELETE` "멱등성 O" 표와 "동시 삭제 진 쪽 404" 실제 동작의 정면 충돌 — `removeMember()` 로 6번째 사례 확정 | `spec/5-system/2-api-convention.md §3` (HTTP 메서드 표) vs `WorkspacesService.removeMember()` / `spec/2-navigation/9-user-profile.md §6.1` | 이미 열린 planner 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md` 4857~4862행, 워크플로/워크스페이스/트리거/스케줄/통합 5건에서 이미 지적됨) | 신규 조치 불요 — 해당 planner 항목 실행 시 각주에 "6개 경로(+ 대기 중 3건)"로 갱신. 구현 자체를 막지 않음 |
| 2 | cross_spec, rationale_continuity, plan_coherence | "동시 삭제 → 두 번째 404" 서술 부재 목록에 `9-user-profile.md §6.1`(멤버 제거)·`data-flow/12-workspace.md §1.6` 미등재 | `spec/2-navigation/9-user-profile.md:378` §6.1, `spec/data-flow/12-workspace.md §1.6` | `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 4849 목록(현재 workflow §2.6·workspace-delete §1.10·schedule §4·integration §9 네 자리만 등재) | 해당 planner 항목에 위 두 자리를 추가하도록 트래커 갱신(형제 PR 들이 매번 확장해 온 관례). 구현을 막을 사유는 아님 — 마무리 커밋에 함께 반영 권장 |
| 3 | rationale_continuity | `--impl-prep` 프롬프트 번들이 이번 구현이 건드리는 코드의 spec 소유 문서(`9-user-profile.md` 등 15개)를 컨텍스트 예산으로 통째로 생략 | 조립된 프롬프트 (harness 산출물) | `9-user-profile.md` frontmatter `code:` 가 `codebase/backend/src/modules/workspaces/**` 를 명시 포함 | 이번 판정에는 영향 없음(수동 Read 로 보완 확인, 실질 충돌 없음 확인됨). harness 차원에서 예산 산정 시 "diff/plan 이 실제로 건드리는 코드의 소유 spec 문서" 우선순위 상향을 고려 |
| 4 | rationale_continuity | owner 보호 invariant(spec 은 무조건 서술)의 TOCTOU 창을 이번 PR 이 닫지 않고 그대로 둠 | `plan/in-progress/member-dup-remove.md §C.2` vs `spec/data-flow/12-workspace.md §1.6`, `spec/5-system/1-auth.md §3.2 †` | `transferOwnership` 과의 레이스로 owner 제거 가드 우회 가능성 (기존 갭, 이번 PR 이 신규 도입 아님) | plan 의 D 체크리스트("C-2 owner 승격 TOCTOU 프로브")가 완료되기 전에는 `plan/complete/` 로 이동 금지. 결과(재현 여부·근거)를 명시적으로 남길 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | 리뷰 인용 규약(§2 bare 시각 금지) 위반 1건, grandfather 대상 | `spec/2-navigation/14-execution-history.md:479` | 이번 작업(`spec_impact: none`) 범위 밖. 다음에 그 절을 건드릴 기회에 전체 경로 형태로 교체 권장 |
| 2 | convention_compliance | `member.removed`/`member.invited`/`member.role_changed` 감사 액션이 `9-user-profile.md`·`1-workflow-list.md`에 인용되지 않음 (규약 위반 아님, 기존 비일관) | `spec/2-navigation/9-user-profile.md §4.1/§6.1` | 조치 불요 — 규약 위반 아니고 `spec_impact: none` 과 정합 |
| 3 | plan_coherence | `2-trigger-list.md §2.3.1` 이 가리키는 plan `eia-trigger-edit-ui` 가 저장소에 존재하지 않음 (dangling 참조, 이번 PR 과 무관) | `spec/2-navigation/2-trigger-list.md §2.3.1` | 이번 PR 차단 사유 아님. 별도 planner 턴에서 plan 생성 또는 참조 정정 |
| 4 | naming_collision | 계획이 언급하는 모든 식별자(`member.removed`, `MEMBER_NOT_FOUND`, `CANNOT_REMOVE_OWNER`, `NOT_A_MEMBER`, endpoint)는 전부 기존 정의 재사용 — 신규 식별자 없음 | `spec/2-navigation/9-user-profile.md`, `spec/5-system/1-auth.md`, `spec/data-flow/1-audit.md`, `spec/data-flow/12-workspace.md` + 기존 코드 상수 | 조치 불요 — `spec_impact: none` 판단을 뒷받침하는 근거로 기록 |
| 5 | naming_collision | `workspaces.service.ts` 가 `9-user-profile.md`·`3-schedule.md` 두 spec 문서의 `code:` glob 에 이미 이중 등재(기존 구조, 이번 편집과 무관한 함수) | `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/3-schedule.md` | 조치 불요 — 참고용 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | codebase 변경 없는 순수 계획 단계, 예고된 처방이 5차례 검증된 패턴의 6번째 적용. DELETE 멱등성 충돌은 이미 추적 중인 낮은 우선순위 항목 |
| rationale_continuity | MEDIUM | 같은 DELETE 멱등성 충돌 재확인 + 번들 예산 절단(수동 보완으로 실질 영향 없음 확인) + owner invariant TOCTOU 창(기존 갭, plan 이 의도적으로 유예) |
| convention_compliance | NONE | 확인 가능한 모든 정식 규약 축(에러코드·감사액션·Swagger DTO·secret 노출·chat-channel enum)에서 위반 없음. 유일한 실제 위반은 범위 밖·grandfather |
| plan_coherence | LOW | 구현 자체는 spec 과 충돌 없음. 트래커 목록에 `9-user-profile.md:378` 추가 누락, dangling plan 참조(무관) |
| naming_collision | NONE | 신규 식별자 도입 없음 — 전부 기존 정의 재사용 확인 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — Critical 없음) 이번 PR(`WorkspacesService.removeMember()` 원자적 `delete`+`affected===0` 처방)은 구현 착수를 진행해도 무방하다.
2. `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 4849~4862 의 두 planner 항목(서술 부재 목록 + 멱등성 충돌 각주)을 이번 PR 완료 시 함께 갱신 — `9-user-profile.md:378`·`data-flow/12-workspace.md §1.6` 추가.
3. `plan/in-progress/member-dup-remove.md §C.2`(owner 승격 TOCTOU 프로브)가 완료되기 전에는 plan 을 `plan/complete/` 로 이동하지 말 것.
4. (harness 개선, 별도 트랙) `--impl-prep` 번들 예산 산정 시 diff/plan 이 실제로 건드리는 코드의 `code:` 소유 spec 문서를 우선순위 상위로 고정하는 개선을 고려.
5. `2-trigger-list.md §2.3.1` 의 dangling plan 참조(`eia-trigger-edit-ui`)는 별도 planner 턴에서 정리(이번 PR 과 무관).
