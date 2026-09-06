# Cross-Spec 일관성 검토 — spec/2-navigation/ (impl-done)

## 검토 범위 및 방법

- target scope: `spec/2-navigation/` — diff-base `origin/main` 대비 **spec 델타 0개 파일** (정상. 이 PR 은 코드 전용 변경).
- 실제 구현 diff: `codebase/backend/src/{common/db,modules/triggers,modules/workflow-versions,modules/workspaces,repo-guards,shared/testing}`, `codebase/frontend/src/lib/api/workflows.ts`, e2e 3건, `spec/conventions/{review-citations,spec-impl-evidence}.md`. 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`)를 절대경로로 직접 `git diff origin/main...HEAD` 하여 확인.
- 브랜치의 실질 내용은 (a) `User` 엔티티 전 컬럼 노출 방어(감사 로그·워크스페이스 멤버 목록·워크플로우 버전 `creator`) 잔여 조치 + 회귀 가드 신설, (b) `spec/2-navigation/2-trigger-list.md §3` 가 이미 문서화해 둔 `(workspace_id, endpoint_path)` UNIQUE 충돌 계약(`409 RESOURCE_CONFLICT` / `TRIGGER_ENDPOINT_PATH_CONFLICT`)을 실제로 구현, (c) 하네스 파서 결함(`review_guard._parse_frontmatter_code` 의 인라인 YAML 주석 처리) 수정 및 관련 convention 문서 정정.
- 이 셋 모두 **기존 spec 이 이미 선언한 계약을 코드가 뒤늦게 따라잡는 방향**이라, cross-spec 관점에서 "target 이 새로 선언한 것이 다른 영역과 충돌하는가"를 물을 대상 자체가 거의 없다. 아래는 그럼에도 점검한 6개 관점의 결과다.

## 점검 결과 (관점별)

1. **데이터 모델 충돌** — 없음. `WorkspaceMemberDto.joinedAt` 신설은 `spec/1-data-model.md §2.3 WorkspaceMember.joined_at`(Timestamp?, nullable)과 형식 일치. `user-secret-absence.ts` 의 `USER_SECRET_KEYS` 7개(`passwordHash`/`twoFactorSecret`/`totpRecoveryCodes`/`webauthnRecoveryCodes`/`emailVerifyToken`/`passwordResetToken`/`emailChangeToken`)는 `spec/1-data-model.md §2.1 User` 가 선언한 비밀·토큰 컬럼 7개와 1:1 대응 — 전수 열거 누락 없음.
2. **API 계약 충돌** — 없음. `TriggersService.rethrowEndpointPathConflict` 가 발행하는 `409 RESOURCE_CONFLICT` + `details.field='endpoint_path'` + `details.code='TRIGGER_ENDPOINT_PATH_CONFLICT'` 는 `spec/2-navigation/2-trigger-list.md` §2.3.1·§3 이 이미 서술한 문구·인덱스명(`idx_trigger_workspace_endpoint`, `spec/1-data-model.md §3`·`spec/data-flow/10-triggers.md`·`V002__indexes.sql` 과도 일치)과 정확히 부합한다. `WorkflowVersionsService` 의 `creator` 3필드 투영(`ProjectedCreator = Pick<User,'id'|'name'|'email'>`)도 `spec/3-workflow-editor/5-version-history.md §7.1/§7.2`("creator relation 포함")와 모순되지 않는다 — 그 spec 은 필드 집합을 못박지 않으므로 투영을 좁히는 것이 계약 위반이 아니다.
3. **요구사항 ID 충돌** — 해당 사항 없음. 이 diff 는 새 요구사항 ID를 발급하지 않는다.
4. **상태 전이 충돌** — 해당 사항 없음. 상태 머신 정의를 건드리는 변경 없음.
5. **권한·RBAC 모델 충돌** — 없음. `workspace-rbac.e2e-spec.ts` J·`audit-logs.e2e-spec.ts`·`workflow-crud.e2e-spec.ts` H 는 모두 기존 역할 매트릭스(`spec/5-system/1-auth.md §3`)를 그대로 쓰는 **검증 강화**이지 권한 구조 변경이 아니다.
6. **계층 책임 충돌** — 없음. `common/db/pg-error.ts` 를 두 서비스(`triggers.service.ts`)가 공유하는 방향은 기존 SoT 원칙(공용 유틸은 `common/`)과 일치.

## 발견사항

### INFO 등급 (이미 추적 중 — 신규 차단 사유 아님)

- **[INFO] 도메인 세부 에러 코드 표현 방식의 저장소 내 비일관 (3번째 패턴)**
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict` (`details.code` 사용)
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.3 — 동일 계열 문제에 대해 이미 두 패턴이 공존한다: ① top-level 특화 코드로 **교체**(`DUPLICATE_NODE_LABEL`, `WORKFLOW_VERSION_CONFLICT`), ② `details.<domain>Code` 형태(Email `details.integrationCode`). 이번 구현은 `details.code`(도메인 접두 없는 제네릭 키)로 **세 번째 변형**을 추가한다.
  - 상세: 셋 다 기능적으로는 작동하고 상호 모순은 아니나(각기 다른 자원), 향후 신규 도메인이 이 표를 참고해 새 sub-code 를 추가할 때 어느 패턴을 따를지 결정이 안 서 있다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-06 등재, "도메인 세부 에러 코드의 표현 방식을 정식화한다")에 planner 항목으로 등재돼 있음을 확인 — 별도 조치 불요, 그대로 유지.

- **[INFO] `WorkflowVersionDetail` 프론트/백엔드 동명 미러 drift**
  - target 위치: `codebase/frontend/src/lib/api/workflows.ts` (`creator?: {...} | null`) vs `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`ProjectedCreator` 3필드 고정, non-null)
  - 충돌 대상: 두 선언 모두 코드베이스 내부이며 spec 문서 자체에는 이 필드 shape 이 명시되어 있지 않음(`spec/3-workflow-editor/5-version-history.md` 참조 확인).
  - 상세: 지금은 backend 가 더 좁아(non-null 3필드) 프론트의 옵셔널·nullable 선언과 런타임 충돌이 없다. 그러나 이름이 같아 grep 기반 "유일 정의" 판단을 오도할 위험이 있다고 코드 주석 자체가 명시.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md`(line 580, "WorkflowVersionDetail 동명 미러를 코드 주석에서 트래커로 격상")에 이미 등재됨 — 별도 조치 불요.

## 요약

target(`spec/2-navigation/`) 자체의 spec 델타는 0이며, 이번 PR 은 `spec/2-navigation/2-trigger-list.md` 가 이미 선언해 둔 endpoint_path 충돌 계약과 `spec/1-data-model.md`/`spec/3-workflow-editor/5-version-history.md` 가 이미 정의한 `User`/`WorkflowVersion.creator` 데이터 경계를 코드가 뒤늦게 실제로 맞추는 방향의 변경이다. 데이터 모델·API 계약·RBAC·상태 전이·계층 책임 6개 관점 모두에서 다른 spec 영역과의 직접 모순(CRITICAL/WARNING)은 발견되지 않았다. 유일하게 남는 것은 이미 자체적으로 인지·등재된 두 개의 INFO 성격 명명 비일관(에러 상세 코드 키 이름, 프론트/백엔드 동명 타입 미러)이며 둘 다 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 후속 조치로 이미 트래킹되고 있어 이번 PR 을 막을 사유가 아니다.

## 위험도

NONE
