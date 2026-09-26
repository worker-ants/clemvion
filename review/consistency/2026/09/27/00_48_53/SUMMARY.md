# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 이 PR(`workflow-versions` DTO §5.4 정정 + `select` 상수화)은 스코프(`spec/3-workflow-editor/`)를 변경하지 않았고, 5개 checker 전원이 Critical 없음으로 판정. 유일한 상향 요인은 convention_compliance 가 잡은 두 건의 **기존(pre-existing) spec 이격**이며, 둘 다 이번 diff 가 만든 것이 아니고 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목으로 등재되어 있다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | — | — | — | — | — |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — Critical 자체가 없으므로 인계할 항목 없음.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | — | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance (cross_spec·plan_coherence 는 INFO 로 기재 — 가장 강한 등급인 WARNING 으로 통합) | `5-version-history.md` §7.2 가 응답 타입을 실제 DTO 클래스명(`WorkflowVersionDto`)이 아닌 엔티티명(`WorkflowVersion`)으로 표기 | `spec/3-workflow-editor/5-version-history.md` §7.2 (104~108행) | `spec/conventions/swagger.md` §5-1(엔티티 직접 노출 금지·DTO 명 사용); 형제 §7.1 은 `WorkflowVersionListItemDto[]` 로 정확 | **신규 조치 불요** — 이 PR 이전부터의 이격이며 이번 diff 와 무관. 이미 `--impl-prep`(`review/consistency/2026/09/26/23_55_27` W1)에서 발견되어 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-27 신규 항목, 1056~1062행)에 planner 후속 항목으로 정식 등재됨. planner 턴에서 `WorkflowVersion` → `WorkflowVersionDto` 로 정정 권고 |
| 2 | Convention Compliance | `5-version-history.md` 에 `## Rationale` 섹션 부재 (같은 디렉터리 `0-canvas.md`·`2-edge.md`·`3-execution.md` 등은 모두 보유) | `spec/3-workflow-editor/5-version-history.md` 문서 전체 | CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" | **신규 조치 불요** — 기존 이격, 이번 diff 무관. 위 항목과 동일 트래커(W2)에 이미 등재됨. planner 턴에서 §7.1 "`snapshot` 제외" 등 산재된 근거를 `## Rationale` 로 정리 권고 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | `VERSION_METADATA_SELECT` 상수화는 `spec/1-data-model.md` Rationale(2026-09-06)이 "채택안"으로 직접 지목한 쿼리범위 `select` 투영 패턴의 정상 확장 — 기각된 대안(`select: false`) 재도입 아님 (`git grep "select: false"` 0건) | `workflow-versions.service.ts` | 조치 불요. 반복 오판 이력이 있는 지점이므로 향후 검토자를 위해 해당 Rationale 링크를 서비스 파일 상단 주석에 추가하는 것도 고려 가능(선택) |
| 2 | Rationale Continuity | `creator`/`changeSummary` required 화는 §5.4 원칙에 대한 "번복"이 아니라 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에 이미 등재돼 있던 부채의 상환 — 방향 전환 근거(FK `NOT NULL`, `ON DELETE` 없음)가 plan 문서에 실측과 함께 기록됨 | `workflow-version-response.dto.ts`, `swagger-dto-contract.spec.ts`(-4행) | 조치 불요 |
| 3 | Rationale Continuity | 프런트엔드 미러(`creator?: {…} \| null`)를 의도적으로 좁히지 않은 비대칭 결정 — 근거는 서비스 JSDoc 에 기록되었으나 spec `## Rationale` 은 아님 | `workflow-versions.service.ts` JSDoc | 조치 불요 — 계약 자체는 spec §7.1 표와 일치, 미러 정책은 구현 세부사항. spec 화가 필요하면 planner 판단 |
| 4 | Convention Compliance | 구현 diff 자체는 `spec/conventions/swagger.md` §1-4·§5-1·§3, `spec/5-system/2-api-convention.md` §5.4 를 정확히 준수하는 방향으로 기존 위반(optional+nullable 금지 조합)을 정정한 모범 사례 | `workflow-version-response.dto.ts` | 조치 불요 — 준수 사례로 기록 |
| 5 | Convention Compliance | JSDoc/내부 서사(`//`) 순서가 저장소 선례(`alert-rule-response.dto.ts`)와 다르나(JSDoc→`//`→`@ApiProperty`), 규약 문장 자체는 순서를 못박지 않아 위반으로 단정 불가 | `workflow-version-response.dto.ts` (`creator`·`changeSummary`) | 조치 불요. 순서 고정 여부는 향후 규약 갱신 시 planner 판단 |
| 6 | Plan Coherence | 트래커 두 항목(1026·1036행) 및 `workflow-version-creator.md` 자체의 남은 두 체크박스가 아직 미체크 — plan 이 스스로 "마무리 커밋에서" 처리한다고 예고한 정상 잔여 단계 | `plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/in-progress/workflow-version-creator.md` | `--impl-done` 통과 후 마무리 커밋에서 (1) 트래커 1026·1036행 완료 각주, (2) `workflow-version-creator.md` 남은 체크박스 처리 + `plan/complete/` 이동을 함께 수행 |
| 7 | Plan Coherence | 다른 in-progress plan 과의 교차 의존·충돌 없음 (`workflow-version`/`WorkflowVersion` 언급 파일은 자기 자신과 트래커 1건뿐) | `plan/in-progress/**` 전수 | 없음 |
| 8 | Naming Collision | 신규 식별자 `VERSION_METADATA_SELECT`(module-private) · `workflow-version-response.dto.spec.ts` 모두 저장소 전수 grep 상 충돌 없음, 직전 `--impl-prep` naming_collision 예측과 정확히 일치 | `workflow-versions.service.ts`, 신규 테스트 파일 | 없음 |
| 9 | Cross-Spec | 데이터 모델(`created_by NOT NULL FK`)·API 계약(§7.1 표)·RBAC·오류 코드·계층 책임 전 축에서 충돌 없음, `creator` 노출 범위 불변 | `spec/1-data-model.md` §2.15, `spec/3-workflow-editor/5-version-history.md` §7.1 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | scope 델타 0, 데이터모델·API계약·상태전이·RBAC·계층책임 전 축 충돌 없음. §7.2 표기 오류는 기존 이격이자 이미 등재된 상태(참고용 재확인) |
| Rationale Continuity | NONE | `select` 투영·DTO required 화 모두 기존 Rationale 이 요구하는 방향과 일치, 번복·기각안 재도입 없음 |
| Convention Compliance | LOW | diff 자체는 §5.4/swagger 규약 준수 방향 정정(모범 사례). WARNING 2건은 모두 이 PR 이전부터의 spec 이격이며 이미 planner 트래커에 등재됨 |
| Plan Coherence | NONE | 구현이 트래커 두 항목(1026·1036행)을 정확히 겨냥, 지시와 방향 일치. 잔여 체크박스는 예고된 정상 단계 |
| Naming Collision | NONE | 신규 식별자 2건(`VERSION_METADATA_SELECT`, 신규 spec 테스트 파일) 전수 grep 결과 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 사유 없음 — 즉시 `--impl-done` 통과 가능)
2. 마무리 커밋에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 1026·1036행에 완료 각주를 달고, `plan/in-progress/workflow-version-creator.md` 의 남은 체크박스를 처리한 뒤 `plan/complete/` 로 이동한다.
3. planner 턴(별도 세션, 권한 범위 내 정정)에서 `spec/3-workflow-editor/5-version-history.md` §7.2 응답 타입 표기를 `WorkflowVersion` → `WorkflowVersionDto` 로 정정하고 `## Rationale` 섹션을 신설한다 — 이미 `spec-draft-nullable-notation-followups.md` 1056~1062행에 등재되어 있으므로 그 항목을 그대로 수행하면 된다.