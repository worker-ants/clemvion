# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 전원 전문 확보, CRITICAL 0건.

## 전체 위험도
**LOW** — target(`spec/2-navigation/`) spec 델타는 0, 실제 코드 diff(`User` 엔티티 비밀 컬럼 노출 방어 PR)는 target 이 이미 선언한 계약(`TRIGGER_ENDPOINT_PATH_CONFLICT` 등)을 그대로 구현했고 새 위반 없음. 다만 `2-trigger-list.md` 자체에 남아 있는 기존 문서-내부 자기모순(4건, 이번 PR 이전부터 존재)이 여전히 미정정 상태이며 — 전량 plan 에 등재는 돼 있으나 target 문서 자체는 아직 안 고쳐졌다는 점에서 LOW.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음 — 이전 라운드(`15_31_00`)가 지적한 WARNING 5건은 모두 다음 커밋(`fc6208adb`)에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재 완료됐고, naming_collision checker 는 이를 근거로 `WorkflowVersionDetail` 손-미러 항목을 INFO 로 자체 재분류했다 — 통합 단계에서의 하향이 아니라 checker 자신의 재평가.)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `TRIGGER_ENDPOINT_PATH_CONFLICT` 구현이 spec 이 이미 선언한 계약(409 `RESOURCE_CONFLICT`, `details.field='endpoint_path'`)을 정확히 실현 — spec-코드 갭이 줄어든 사례 | `triggers.service.ts` `rethrowEndpointPathConflict` ↔ `spec/2-navigation/2-trigger-list.md §3` | 조치 불요 |
| 2 | cross_spec | `WorkspaceMemberDto.joinedAt` 신규 필드는 `spec/1-data-model.md` nullable 선언과 형식상 일치, `9-user-profile.md` 는 멤버 응답 필드 표가 없어 대조 대상 자체가 없음 | `workspace-response.dto.ts` `WorkspaceMemberDto.joinedAt` | 조치 불요. 후속으로 `9-user-profile.md` 에 멤버 응답 필드 표 추가는 planner 재량 |
| 3 | cross_spec | `WorkflowVersionDetail` 이 FE 손-미러 동명 타입과 필드 집합이 다름 — 어떤 spec 문서에도 SoT 로 등재되지 않아 cross-spec 충돌 대상 자체가 없음 | `workflow-versions.service.ts` `WorkflowVersionDetail`/`ProjectedCreator` vs `codebase/frontend/src/lib/api/workflows.ts` | cross-spec 관점 조치 불요 (naming_collision #1 참고) |
| 4 | rationale_continuity | `details.code` 배치가 저장소 내 두 선례(top-level code 교체 vs `details[].code`) 중 §4.2 형태를 다른 문맥(DB UNIQUE 충돌)에 재사용 — 무근거 번복은 아니고 plan 에 정식화 필요 항목으로 명시 등재됨 | `triggers.service.ts` `rethrowEndpointPathConflict` 주석 ↔ `spec/conventions/error-codes.md §4.2`/§5 | 다음 planner 턴에서 `2-api-convention.md §5.3` 에 택일 기준 명문화 + `3-error-handling.md §1` 에 코드 등재 (이미 plan 등재, 존재 확인만) |
| 5 | rationale_continuity | `User` 비밀 컬럼에 `select:false` 미도입 — `secret-store.md §1.1` 이 이미 확립한 "조용한 undefined 실패" 기각 근거를 새 컨텍스트(인증 컬럼)에 정확히 재적용 | `repo-guards/__tests__/user-entity-exposure-guard.ts`, `shared/testing/user-secret-absence.ts` | 조치 불요 (정합) |
| 6 | rationale_continuity | `user-entity-exposure-guard.ts` 가 라우트별 opt-in 마커 대신 구조 기반 스캔 채택 — `1-auth.md` Rationale (b) 가 선호하는 방향과 같은 결 | `repo-guards/__tests__/user-entity-exposure-guard.ts` | 조치 불요 |
| 7 | convention_compliance | 직전 라운드 WARNING 5건(frontmatter status 모순·R-2 미정정·Auth Config dead-end 링크) — target 문서 자체는 여전히 미수정이나 전량 plan 등재 확인 | `spec/2-navigation/2-trigger-list.md` frontmatter/§2.3.1/§3/R-2 | 조치 불요(이미 추적). 다음 planner 턴에서 plan 파일 체크박스 일괄 처리 |
| 8 | convention_compliance | `details` 컨테이너 형태(object vs array) 미정식화 — 구현 자체는 target 문서가 선언한 대로 정확히 구현됨(#4 와 동일 사안, convention 관점 중복 확인) | `2-trigger-list.md §3` ↔ `2-api-convention.md §5.3` vs `error-codes.md §4.2` | 조치 불요(이미 추적, plan 등재 확인) |
| 9 | plan_coherence | target 자기모순 4건(botToken 행, R-2 vs §3 각주, frontmatter status vs sort/order 자백, Auth Config dead-end 링크) — 전량 plan 등재 확인, target 문서 자체는 미수정 상태로 남아 다음 구현자가 오도될 위험은 존재 | `spec/2-navigation/2-trigger-list.md` §2.3.1/R-2/frontmatter | 이번 PR 범위 밖. 다음 planner 턴에서 우선순위 확인 |
| 10 | plan_coherence | `2-trigger-list.md §2.3.1` External Interaction 행이 가리키는 plan `eia-trigger-edit-ui` 가 트래커에 없음 (오래된 dangling 참조, 이번 PR 과 무관) | `spec/2-navigation/2-trigger-list.md §2.3.1` | 다음 spec 정비 턴에서 참조 갱신 또는 제거 |
| 11 | plan_coherence | `workflow-versions.service.ts`/`workspace-response.dto.ts` 변경은 `spec/2-navigation/` 문서 어디에서도 참조되지 않음 (확인용 기록, 문제 없음) | 해당 없음 | 조치 불요 |
| 12 | naming_collision | `WorkflowVersionDetail` 백엔드/프런트엔드 손-미러 동명 타입 — JSDoc 상호 참조 + plan 트래커 등재(`fc6208adb`) 완료 확인되어 WARNING 에서 INFO 로 자체 하향 | `workflow-versions.service.ts` `WorkflowVersionDetail` vs `frontend/src/lib/api/workflows.ts:109` | 추가 조치 불요 — 다음에 두 타입 중 하나를 만질 때 JSDoc/plan 트래커 처리 여부만 확인 |
| 13 | naming_collision | `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 신규 식별자가 아니라 spec 문구의 뒤늦은 구현 (확인용 기록) | `spec/2-navigation/2-trigger-list.md §2.3.1/§3` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | target spec 델타 0, 유일 접점(트리거 409 처리·`joinedAt`·`creator` 투영) 전부 정합 또는 spec-코드 갭 축소 |
| rationale_continuity | NONE | 트리거 409 구현은 spec 계약 실현, `User` 방어 작업은 기존 기각 원칙(select:false·라우트별 마커) 일관 재적용, 유일 애매점은 plan 등재 완료 |
| convention_compliance | LOW | 신규 diff 는 규약 위반 없음. target 문서 자체의 기존 4건 자기모순은 미수정이나 전량 plan 등재 확인 |
| plan_coherence | LOW | target 자기모순 4건 전량 plan 등재 확인(재등재 불요), 오래된 `eia-trigger-edit-ui` dangling 참조 1건은 이 PR 과 무관 |
| naming_collision | NONE | 신규 식별자 전수 검토 결과 충돌 없음. 유일 긴장(`WorkflowVersionDetail` 손-미러)은 plan 등재 완료로 WARNING→INFO 자체 하향 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — CRITICAL 없음)
2. 다음 `project-planner` 턴에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재된 `2-trigger-list.md` 자기모순 4건(frontmatter status, R-2, Auth Config dead-end 링크, botToken 행) + `details` 컨테이너 형태 정식화 항목을 우선순위에 따라 실제 spec 정정으로 집행.
3. `eia-trigger-edit-ui` dangling plan 참조는 다음 spec 정비 턴에서 실제 plan 이름으로 갱신하거나 제거.
4. `WorkflowVersionDetail` 백엔드/프런트엔드 손-미러는 plan 트래커 항목(개명 또는 `codebase/packages/` 공유 타입 승격)이 실행될 때까지 두 타입 중 하나를 만지는 다음 PR 에서 JSDoc 상호 참조 생존만 재확인.
