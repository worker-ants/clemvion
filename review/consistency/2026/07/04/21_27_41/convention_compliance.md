# 정식 규약 준수 검토 — workflow-cap-dto (WorkflowSettingsDto)

## 검토 모드
구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)

> **NOTE — payload mis-scope**: 전달된 `_prompts/convention_compliance.md` 의 "Target 문서"
> 섹션은 `spec/5-system/1-auth.md`(인증/인가) 본문이 실려 있어 실제 검토 대상(workflow cap
> validated write DTO)과 무관하다. `## 구현 변경 사항` diff 도 확인되지 않아, 실제 diff·코드는
> 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/workflow-cap-dto-bca77e`)에서
> `git log origin/main..HEAD` + 해당 파일을 직접 Read 하여 조사했다. 아래 판정은 이 실제 코드
> 기준이다 (mis-scoped payload 내용은 판정에 사용하지 않음).

## 실제 diff 요약 (origin/main..HEAD)
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` (신규) — `WorkflowSettingsDto`
  class, `maxConcurrentExecutions?: number` (`@IsOptional @IsInt @Min(1)`).
- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` — `settings` 필드를 opaque
  `@IsObject() Record<string, unknown>` 에서 `@IsOptional @IsObject @ValidateNested @Type(() =>
  WorkflowSettingsDto)` + `@ApiPropertyOptional({ type: () => WorkflowSettingsDto, ... })` 로 전환.
- `workflows.service.ts` — `settings` spread-merge (전체 교체 방지).
- 테스트(`workflow-dto-validation.spec.ts`, `workflows.service.spec.ts`, e2e) + CHANGELOG + plan 문서 동반.

## 발견사항

없음 — CRITICAL/WARNING 대상 위반 미발견.

### INFO — 이전 impl-prep 검토(20_55_13)의 지적사항 전량 반영 확인
- target 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` L60-75,
  `workflow-settings.dto.ts` 전체.
- 위반 규약: 해당 없음 (준수 확인용 cross-check).
- 상세: 같은 워크트리의 선행 impl-prep 검토(`review/consistency/2026/07/04/20_55_13/convention_compliance.md`)가
  구현 착수 전 3가지 INFO 를 남겼다 — (1) `@ValidateNested` 에 `@IsObject()` 동반, (2) 별도 파일
  `workflow-settings.dto.ts`/클래스 `WorkflowSettingsDto` 로 분리, (3)
  `@ApiPropertyOptional({ type: () => WorkflowSettingsDto })` thunk 사용(`swagger.md` §1-4 "nested
  object: `@ApiProperty({ type: () => NestedDto })`"). 실제 코드를 확인한 결과 세 항목 모두 정확히
  반영됨:
  - `update-workflow.dto.ts`: `@IsOptional() @IsObject() @ValidateNested() @Type(() =>
    WorkflowSettingsDto)` — 4-데코레이터 조합, 트리거 모듈 선례(`update-trigger.dto.ts` 의
    `notification`/`interaction`/`chatChannel` 필드)와 동일 패턴.
  - 파일/클래스명 kebab-case `.dto.ts` + PascalCase `Dto` suffix 관례 그대로 준수.
  - `@ApiPropertyOptional({ type: () => WorkflowSettingsDto, description: ... })` — thunk 사용,
    generic `type: 'object', additionalProperties: true` 잔존 없음.
- 제안: 없음 (반영 확인 목적의 INFO).

### INFO — workspace 대칭 필드의 flat vs nested 구조 차이는 의도된 것으로 문서화됨
- target 위치: `workflow-settings.dto.ts` JSDoc, CHANGELOG.md 신규 항목.
- 위반 규약: 해당 없음.
- 상세: `UpdateWorkspaceSettingsDto.maxConcurrentExecutions` 는 최상위 flat 필드인 반면
  `UpdateWorkflowDto.settings.maxConcurrentExecutions` 는 nested DTO 경유다. 이는 위반이 아니라
  `Workflow.settings` 자체가 JSONB 컬럼(`spec/1-data-model.md §2.4`)이라는 스키마 차이에서 기인하며,
  CHANGELOG·DTO JSDoc 모두에 "workspace 의 `UpdateWorkspaceSettingsDto`(§8 admission gate) 와
  대칭" 이라 명시해 구조 차이의 근거를 남겼다. `spec/5-system/4-execution-engine.md §8` 표
  (`Workflow.settings.maxConcurrentExecutions`, `PATCH /api/workflows/:id`)와 필드 경로·엔드포인트
  명명이 정확히 일치.
- 제안: 없음.

## 검증 근거 (참조한 실제 코드/문서)
- `git -C <worktree> log --oneline origin/main..HEAD` — 2 커밋 (`feat` DTO 본체, `docs(review)`
  ai-review 결과 커밋).
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` (신규, 29 lines) — 전문 확인.
- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` — 전문 확인, `settings` 필드
  데코레이터 조합 확인.
- `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` L84-105 — 4-데코레이터 nested
  DTO 선례(`@IsOptional @IsObject @ValidateNested @Type` + `type: () => X` thunk) 대조.
- `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` —
  `maxConcurrentExecutions` flat 필드 검증 패턴(`@IsOptional @IsInt @Min(1)`) 대조, workspace
  대칭 주장 검증.
- `spec/conventions/swagger.md` §1-4 (nested object thunk 규약), §5 (응답 DTO — 본 변경은 request
  DTO 라 §5 응답 래퍼 규약과 무관, 해당 없음 확인).
- `spec/5-system/4-execution-engine.md` §8 동시 실행 제한 표 — `Workflow.settings.maxConcurrentExecutions`,
  `PATCH /api/workflows/:id`, Editor+ 권한 매핑 확인.
- CHANGELOG.md diff — 신규 항목 포맷(`## Unreleased — <제목>` + `### 변경 사항` + 번호 목록)이
  기존 항목들과 동일 스타일 확인.
- 선행 검토 `review/consistency/2026/07/04/20_55_13/convention_compliance.md` — impl-prep 단계
  INFO 3건과 실제 구현 대조.

## 요약
전달된 payload 는 `spec/5-system/1-auth.md` 본문이 실려 mis-scoped 상태였으나, 워크트리의 실제
diff(`WorkflowSettingsDto` 신설 + `UpdateWorkflowDto.settings` nested 검증 전환)를 직접 조사한
결과 정식 규약 위반은 발견되지 않았다. `swagger.md` §1-4 의 nested object thunk 규약
(`@ApiProperty({ type: () => NestedDto })`), 저장소 내 확립된 4-데코레이터 nested-DTO 관례
(`@IsOptional @IsObject @ValidateNested @Type`, 트리거 모듈 선례), 파일/클래스 명명 관례
(kebab-case `.dto.ts` / PascalCase `Dto`), CHANGELOG 항목 포맷을 모두 정확히 따른다. 선행
impl-prep 검토가 남긴 3건의 INFO(데코레이터 조합·파일 분리·thunk 표기)도 구현 단계에서 전량
반영되었다. workspace 대칭 필드가 flat 이 아닌 nested 구조를 취하는 차이는 `Workflow.settings`
JSONB 스키마 특성에서 기인하는 의도된 설계이며 문서화도 충분하다. CRITICAL/WARNING 요소 없음.

## 위험도
NONE

BLOCK: NO

STATUS: SUCCESS
