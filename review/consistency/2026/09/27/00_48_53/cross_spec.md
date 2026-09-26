# Cross-Spec 일관성 검토 — `spec/3-workflow-editor/` (--impl-done)

## 검토 범위

- **scope 델타**: `spec/3-workflow-editor/` 는 이 브랜치에서 0개 파일 변경 — 정상(코드 전용 PR).
- **구현 diff**: 6개 파일 / 297줄. 핵심은 `codebase/backend/src/modules/workflow-versions/`
  의 `WorkflowVersionDto`·`WorkflowVersionListItemDto` 의 `creator`·`changeSummary` 필드
  선언을 §5.4 금지 조합(optional + nullable)에서 기본형(각각 required-nonnull / required-nullable)
  으로 정정하고, `findByWorkflow`·`findOne` 두 조회가 공유하는 `select` 6키를
  `VERSION_METADATA_SELECT` 상수로 추출한 변경. 절대경로 워킹트리에서 `git diff
  origin/main..HEAD` 로 실제 diff 를 직접 확인했다 (DTO/서비스/테스트/e2e 전 파일).
- 대조 대상: `spec/1-data-model.md`(§2.15 WorkflowVersion, §2.1/§2.1.1 User), `spec/data-flow/11-workflow.md`,
  `spec/5-system/2-api-convention.md`(§5.4), `spec/conventions/swagger.md`(§1-3/§1-4),
  `spec/3-workflow-editor/5-version-history.md`(§7.1/§7.2/§8), `spec/5-system/3-error-handling.md`.

## 발견사항

- **[INFO]** §7.2 응답 타입 표기가 엔티티명(`WorkflowVersion`)으로 남아 있음 (기존 이격, 이번 diff 무관)
  - target 위치: `spec/3-workflow-editor/5-version-history.md` §7.2 (104~108행) — "응답: `WorkflowVersion` 단건 + `snapshot` 포함."
  - 충돌 대상: 실제 구현 클래스 `WorkflowVersionDto`(`codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts`); 형제 §7.1 은 `WorkflowVersionListItemDto[]` 로 정확히 표기
  - 상세: 이 diff 가 건드린 것은 `creator`/`changeSummary` 의 optional/nullable 선언뿐이라 §7.2 자체 표기 오류를 새로 만들지도, 악화시키지도 않았다. 직전 `--impl-prep` cross-spec 라운드(`review/consistency/2026/09/26/23_55_27/cross_spec.md`)에서도 확인된 pre-existing drift이며, 같은 세션 convention_compliance checker 가 WARNING 으로 이미 잡아 plan 에 "planner 항목으로 등재" 처분이 기록돼 있다(`plan/in-progress/workflow-version-creator.md` `--impl-prep 처분` 절). 재-flag 아님 — 상태 변화 없음을 확인하는 참고용 기재.
  - 제안: 이번 PR 로는 조치 불필요. 해당 트래커/planner 턴에서 "`WorkflowVersionDto` 단건 + `snapshot` 포함" 으로 정정.

## 데이터 모델 / API 계약 / 상태 전이 / RBAC / 계층 책임 — 교차 대조 결과 (충돌 없음)

- **데이터 모델**: `creator` 를 항상 실리는 필드로 선언한 근거(`workflow_version.created_by UUID NOT NULL REFERENCES "user"(id)`, `ON DELETE` 없음=NO ACTION)는 `spec/1-data-model.md §2.15 WorkflowVersion`(`created_by | UUID | FK → User (NO ACTION)`, `?` 없음)과 정확히 일치한다. `CREATOR_PROJECTION`(`id`·`name`·`email`)이 노출하는 세 필드도 `§2.1 User`(둘 다 NOT NULL) 및 `§2.1.1 응답 노출 금지 민감 7컬럼`(email 은 비대상)과 충돌하지 않는다 — 이번 diff 의 e2e 도 `expectNoUserSecrets` 로 별도 대조한다.
- **API 계약**: `spec/3-workflow-editor/5-version-history.md §7.1` 표는 목록·상세 두 엔드포인트 모두 `changeSummary`·`creator` 를 "포함" 으로 이미 적고 있어, 이번 diff 의 required 승격과 정합한다(§5.4 관점에서도 이미 지난 라운드에서 확인됨). `spec/5-system/2-api-convention.md §5.4`(상시 존재 → `nullable: true`, present-when-available → `@ApiPropertyOptional`)의 판정 기준을 `changeSummary`(전자)·`creator`(항상 존재, nullable 도 아님)에 정확히 적용한 형태다. `spec/conventions/swagger.md §1-3/§1-4`(optional/nullable 데코레이터 선택 규약)와도 부합.
- **상태 전이**: 이 diff 는 버전 생성·복원 흐름(트랜잭션·`change_summary` 채움 규칙 등)을 건드리지 않는다 — `spec/data-flow/11-workflow.md §1.1`, `5-version-history.md §9`(복원 시 `Restored from vN`)와 무관, 충돌 없음.
- **RBAC**: 노출 범위(누가 이 응답을 볼 수 있는가)는 바뀌지 않는다 — `creator` 는 이전에도 런타임에는 항상 채워져 있었고(plan 실측), 이번 diff 는 타입 선언만 정정했다. `spec/5-system/1-auth.md` 권한 매트릭스(Workflow: Viewer 도 R)에 대한 새로운 이견 없음.
- **요구사항 ID**: 이 diff 는 새 요구사항 ID 를 도입하지 않는다(순수 코드 변경) — ID 충돌 대상 없음.
- **계층 책임**: `VERSION_METADATA_SELECT` 상수는 `workflow-versions.service.ts` 내부 리팩터로, 서버/클라이언트 또는 도메인 모듈 간 책임 분할을 바꾸지 않는다. 프런트엔드 미러(`workflows.ts` `WorkflowVersionSummary.creator?: {…} | null`)를 의도적으로 넓게 유지하는 결정(plan 실측 근거: `version-history-panel.tsx` 의 `createdBy` 폴백 방어 분기·테스트)도 프런트/백엔드 계층 경계를 침범하지 않는 선택 — 계약을 좁히는 쪽(BE)만 정정하고 넓은 쪽(FE)은 하위 호환이라 안전.
- **오류 코드**: `spec/5-system/3-error-handling.md` 의 `WORKFLOW_VERSION_CONFLICT`(`workflow-versions.service.ts` 발행)는 이 diff 가 건드리지 않는 다른 경로(동시 저장 경합)라 무관.

## 요약

이번 diff 는 `spec/3-workflow-editor/` 를 직접 변경하지 않는 순수 코드 정정(§5.4 DTO 선언 정정 + `select` 상수화)이며, 대조한 모든 축(데이터 모델·API 계약·상태 전이·RBAC·요구사항 ID·계층 책임)에서 기존 `spec/1-data-model.md`·`spec/data-flow/11-workflow.md`·`spec/5-system/2-api-convention.md`·`spec/conventions/swagger.md`·`spec/3-workflow-editor/5-version-history.md` 와 새로운 충돌을 만들지 않는다. 유일하게 언급할 사안(§7.2 응답 타입 엔티티명 표기)은 이 PR 이전부터 있던 이격이고 직전 impl-prep 라운드에서 이미 식별·트래커 등재된 상태로, 이번 diff 로 인해 새로 생기거나 악화되지 않았다. impl-done 을 막을 사유 없음.

## 위험도

NONE
