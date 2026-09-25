# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 전문 확보, Critical 0건.

## 전체 위험도
**LOW** — Critical 없음. WARNING 1건(기능적 충돌 아님, 문서 동기화·정리 성격)과 다수 INFO만 존재.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | 신규 공용 `ADMIN_ROLES`(`common/constants/workspace-roles.ts`)가 `workspaces.service.ts`·`workspace-invitations.service.ts`의 로컬 선언은 흡수했지만 `integrations.service.ts`의 동명 로컬 `ADMIN_ROLES`(같은 값 `{'owner','admin'}`)는 그대로 남김 | `codebase/backend/src/common/constants/workspace-roles.ts` (신규 export) | `codebase/backend/src/modules/integrations/integrations.service.ts:112` (모듈 스코프 로컬, origin/main 부터 존재, 이번 diff 미변경) | 컴파일/런타임 충돌은 없음(모듈 스코프 격리, 값 일치). 이번 PR 범위 확대는 불필요 — 후속 트래커 항목으로 "`integrations.service.ts`도 공용 상수 재사용" 또는 "동명이인" 주석 추가를 남길 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "가드 거부 코드는 전역 적용"이라는 target 의 신규 선언이 workspaces 밖 다른 도메인 spec(`node-cancellation.md`·`1-audit.md`·`7-llm-client.md`·`14-execution-history.md`·`0-overview.md`)의 `@Roles()` 403 서술에는 아직 코드 레벨로 반영 안 됨 | `spec/data-flow/12-workspace.md` §"가드 거부의 오류 코드" | 기능적 모순 아님(상태코드 403 불변). 해당 문서들이 향후 `code`를 직접 다룰 때 `data-flow/12-workspace.md` 참조 링크 추가 고려. 즉시 조치 불요 |
| 2 | rationale_continuity | §"경로 파라미터 워크스페이스도 가드가 본다"가 스스로 인정한 잔여 비대칭(header/token 모델에서 `req.user.workspaceId` 직접 참조 라우트 4곳은 정적 가드 없음)의 구체 목록이 spec에 하드코딩돼 있지 않음 | `spec/data-flow/12-workspace.md` 동 절 | "부트 캐너리"의 기존 "구체 수치는 spec에 박지 않는다" 원칙과 동일선상 — 조치 불요, 관찰만 |
| 3 | convention_compliance | 프롬프트 번들이 컨텍스트 예산으로 `2-api-convention.md`·`3-error-handling.md`·`13-replay-rerun.md`·`error-codes.md`·`swagger.md`·`data-flow/12-workspace.md` 원문과 diff 본문을 절단함(이번 라운드는 직접 Read/git diff로 우회 확인) | 프롬프트 번들 전체 | 다음 라운드가 "번들에 없으니 문제없다"로 오판하지 않도록, 동일 스코프 재검토 시 절단 목록 우선 대조 |
| 4 | convention_compliance | `FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_ADMIN_ROUTE`/`FORBIDDEN_OWNER_ROUTE` 계열 문구가 `workspaces.controller.ts`(상수)·`auth.controller.ts`·`executions.controller.ts`(각각 인라인 문자열)로 3곳에 흩어짐 — 현재는 정합 | `codebase/backend/src/modules/workspaces/workspaces.controller.ts` 상단 | 코드명이 재차 바뀔 경우 공용 상수 모듈로 승격 고려. 지금은 조치 불요 |
| 5 | plan_coherence | `plan/in-progress/spec-draft-nullable-notation-followups.md`(L4980, 4985, 4998) 등 3곳이 아직 `in-progress`인 `workspace-path-guard-impl.md`를 이미 `plan/complete/` 경로로 forward-reference | plan 상호참조 (target 코드 위치 없음) | 이 plan 자신의 남은 체크리스트(TEST WORKFLOW 재수행 → `--impl-done` → 트래커 닫기 → `complete/` 이동)를 순서대로 마치면 자동 해소. `--impl-done` 통과 후 `complete/` 이동 누락 주의(과거 전례 있음) |
| 6 | plan_coherence | `param-uuid-pipe` 가드가 `@WorkspaceParam`을 모집단에 포함하도록 한 plan 서술은 diff 파일 목록과 형태상 일치 확인했으나, 세부 동작 실측은 코드/뮤테이션 검증 checker 소관 | `workspace-path-guard-impl.md` §구현 중 결정 | plan 정합성 관점에서는 조치 불요 |
| 7 | naming_collision | `WorkspaceRoleName`(신규, 서열 파생)과 `WorkspaceRole`(기존, DTO enum 표시 순서 파생)이 같은 값 집합을 나타내면서 이름이 `Name` 접미사 하나로만 구분됨 | `common/constants/workspace-roles.ts` vs `dto/add-member.dto.ts` | `satisfies`로 컴파일 타임 동기화는 이미 확보됨. 상호 참조 docstring 한 줄 추가는 선택 사항 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 9개 spec 파일 상호 정합, 코드-spec 일치(15+4곳 경로 파라미터, RBAC 매트릭스, 에러코드 레지스트리, URL slug 계층 분리) 확인. 유일한 갭은 "전역 적용" 선언의 타 도메인 문서 미반영(INFO) |
| rationale_continuity | NONE | `@WorkspaceParam`이 과거 기각된 "opt-in 마커" 패턴과 다름을 spec 스스로 3축 근거로 논증, 코드와 일치 확인. 이 긴장은 이미 이전 라운드(15_15_21)에서 지적·반영 완료. 새 CRITICAL/WARNING 없음 |
| convention_compliance | NONE | 명명·출력 포맷·문서 구조·Swagger·금지 항목 규약 5개 축 전부 코드·spec·정적 가드 3중 일치. CRITICAL/WARNING 없음 |
| plan_coherence | NONE | 소유 plan(`workspace-path-guard-impl.md`)이 3회 planner 턴·5라운드 ai-review·다수 게이트를 거쳤고, 관련 5개 plan과 대조해 미해결 결정 충돌·선행 조건 누락·후속 항목 누락 없음 확인 |
| naming_collision | LOW | 대부분 신규 식별자는 완전 신규이거나 의도된 통합. `ADMIN_ROLES` 동명 잔존 1건(WARNING, 기능 충돌 아님)과 `WorkspaceRole`/`WorkspaceRoleName` 근접 명명(INFO) |

## 권장 조치사항

1. (선택) `integrations.service.ts`의 로컬 `ADMIN_ROLES`를 후속 트래커에 "공용 `workspace-roles.ts` 재사용 또는 동명이인 주석 추가" 항목으로 등재 — 이번 PR 범위 확대는 불필요.
2. (선택) `data-flow/12-workspace.md`의 "가드 거부 코드 전역 적용" 선언을 참조하는 링크를 향후 `node-cancellation.md`·`1-audit.md`·`7-llm-client.md` 등이 `code`를 직접 다룰 때 추가.
3. `workspace-path-guard-impl.md`는 남은 체크리스트(TEST WORKFLOW 재수행 → `--impl-done` → 트래커 닫기 → `complete/` 이동) 순서를 그대로 따를 것 — forward-reference 3건은 이 이동으로 자동 해소됨.
4. BLOCK 없음 — 즉시 조치 필수 항목 없음.
