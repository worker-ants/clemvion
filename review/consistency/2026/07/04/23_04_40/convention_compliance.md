# 정식 규약 준수 검토 — import-settings-dto

## 검토 모드
구현 완료 후 검토 (--impl-done, scope=spec/2-navigation/, diff-base=origin/main)

## 참고사항 — payload mis-scope

`_prompts/convention_compliance.md` 에 번들된 target 문서(`spec/2-navigation/**` 전체 다수 화면 spec + `spec/conventions/audit-actions.md`·`cafe24-api-catalog/**`)는 실제 diff(`ImportWorkflowDto.settings` DTO 타이핑)와 대부분 무관하며, 프롬프트 본문이 참조하는 `## 구현 변경 사항` diff 섹션 자체가 프롬프트 파일에 존재하지 않는다(orchestrator 조립 단계 스코프 오류 — 22_46_30 세션과 동일 패턴 재발). 이 번들을 근거로 삼지 않고, 실제 코드 SoT 인 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/import-settings-dto-1df4ae`)에서 `git diff origin/main` 으로 직접 확보한 실 diff + 관련 정식 규약(`spec/conventions/swagger.md`)을 대조해 검토했다.

## 실제 diff 요약

- `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts`: `ImportWorkflowDto.settings` 를 opaque `@IsObject() Record<string, unknown>` (+ `@ApiPropertyOptional({ type:'object', additionalProperties:true })`) 에서 strict `WorkflowSettingsDto` (`@IsOptional() @IsObject() @ValidateNested() @Type(() => WorkflowSettingsDto)` + `@ApiPropertyOptional({ type: () => WorkflowSettingsDto })`) 로 전환.
- `codebase/backend/src/modules/workflows/workflows.service.ts`: `importWorkflow` 의 `settings: dto.settings ?? {}` → `settings: { ...dto.settings } as Record<string, unknown>` (검증된 인스턴스를 jsonb 저장 형태로 평탄화).
- 신규 unit(`workflow-dto-validation.spec.ts` +68 / `workflows.service.spec.ts` +43) + e2e(`workflow-crud.e2e-spec.ts` +45).
- `CHANGELOG.md`: `## Unreleased — workflow import settings validated DTO (patch 대칭)` 신규 섹션.
- `spec/2-navigation/1-workflow-list.md`: §3.2 import 검증 순서에 6번 항목 추가 + Rationale §2 에 "settings 는 permissive 예외 미포함" 명시.
- `plan/in-progress/import-workflow-settings-dto.md`: 신규 plan.

## 대조 대상

- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` — `UpdateWorkflowDto.settings` 가 정확히 동일한 데코레이터 조합(`@ApiPropertyOptional({ type: () => WorkflowSettingsDto, ... })` + `@IsOptional() @IsObject() @ValidateNested() @Type(() => WorkflowSettingsDto)`)을 이미 채택 — 직접 선례이며 diff 는 이를 문자 그대로 미러링.
- `import-workflow.dto.ts` 동일 파일 내 `nodes`/`edges` 필드 — `@ApiProperty({ type: () => XxxDto }) @IsArray() @ValidateNested({ each: true }) @Type(() => XxxDto)` 패턴 기존 사용 중. `settings`(단일 object, `each` 없음)는 그 대응 패턴(단일 nested)을 그대로 따름.
- `workflow-settings.dto.ts` — 재사용 대상 `WorkflowSettingsDto` 정의. JSDoc 에 "신규 설정 키는 여기 필드를 추가해 확장한다" 명시 — 신규 DTO 생성 없이 재사용한 것과 정합.
- `spec/conventions/swagger.md` §1-4 (nested object → `@ApiProperty({ type: () => NestedDto })`), §1 (JSDoc 우선 + 필요시 `@ApiProperty` 보강 워크플로우).
- `spec/2-navigation/1-workflow-list.md` §3.2 — export/import JSON 계약 SoT 를 `import-workflow.dto.ts`/`ExportWorkflowDto` 로 명시. 신규 6번 항목이 이번 diff 를 정확히 doc-sync.
- CHANGELOG 기존 엔트리 스타일(`## Unreleased — <제목>` + `### 변경 사항` 번호 목록) — 신규 엔트리가 그 형식을 그대로 따름. 직전 엔트리(#805, workflow cap validated write DTO)가 "`ImportWorkflowDto.settings` 는 opaque 유지(별도 후속)" 라고 명시적으로 예고한 후속 작업과 정확히 일치.
- `review/consistency/2026/07/04/22_46_30/convention_compliance.md` (--impl-prep, 동일 계획 사전 검토) — BLOCK: NO, 계획된 데코레이터 조합·재사용 방침이 규약과 완전히 정합한다고 이미 판정. 실 diff 가 그 계획과 100% 일치.

## 발견사항

- **[INFO]** Export 측 `ExportWorkflowDto.settings` 는 여전히 loose 유지 — 비대칭 잔존 (범위 밖, 22_46_30 세션에서 이미 지적·수용된 사항)
  - target 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` (`ExportWorkflowDto.settings: Record<string, unknown>`, `type: 'object', additionalProperties: true`) — 이번 diff 대상 아님
  - 위반 규약: 직접 위반 아님. `spec/conventions/swagger.md` §1-4 는 union/dynamic 객체에 `type: 'object', additionalProperties: true` 를 명시적으로 허용.
  - 상세: 이번 변경은 **input 측**(`ImportWorkflowDto`)만 strict 화하고 **output 측**(`ExportWorkflowDto`)은 그대로 둔다. `spec/2-navigation/1-workflow-list.md §3.2` 는 두 DTO 간 필드 스키마 대칭을 강제하지 않으므로 위반은 아니다.
  - 제안: 조치 불필요(계획대로 스코프 제한). 후속 과제로 `ExportWorkflowDto.settings` 도 `WorkflowSettingsDto` 참조로 맞추는 대칭화를 고려할 수 있으나 별도 결정 사안.

- **[INFO]** CHANGELOG 항목이 파일 최상단(가장 최근)에 삽입됨 — 기존 역순 정렬과 일치
  - target 위치: `CHANGELOG.md` L1-6
  - 위반 규약: 없음. 순수 확인 사항.
  - 상세: 최신 커밋(`ba677f874`)의 엔트리가 파일 최상단에 위치해 기존 "최신 순" 관례와 일치한다.
  - 제안: 조치 불필요.

발견된 CRITICAL/WARNING 없음.

## 요약

실 diff(`ImportWorkflowDto.settings: Record<string, unknown>` → `WorkflowSettingsDto` nested, `@ValidateNested() @Type(() => WorkflowSettingsDto)` + `@ApiPropertyOptional({ type: () => WorkflowSettingsDto })`)는 동일 모듈의 `UpdateWorkflowDto.settings` 가 이미 채택한 패턴, 그리고 같은 파일 `nodes`/`edges` 의 nested 관례를 문자 그대로 따른다. `spec/conventions/swagger.md` §1-4 의 nested object 표기 규약과 정합하며, 신규 DTO 를 만들지 않고 `WorkflowSettingsDto` 를 재사용한 것도 그 파일 JSDoc 이 예정한 확장 방식과 일치한다. CHANGELOG 항목은 기존 형식(`## Unreleased — <제목>` + `### 변경 사항`)을 그대로 따르고, `spec/2-navigation/1-workflow-list.md §3.2`·Rationale doc-sync 는 이번 diff 의 동작(strict 400, permissive 예외 미포함)을 정확히 반영한다. plan frontmatter(`spec_impact` 리스트 포함)도 스키마를 준수한다. 이 작업은 --impl-prep 단계(22_46_30 세션)에서 이미 동일 설계로 BLOCK: NO 사전 승인됐고, 실 구현이 그 설계와 그대로 일치한다. 명명·출력 포맷·문서 구조·API 문서 규약 어느 관점에서도 CRITICAL/WARNING 위반이 발견되지 않았다.

## 위험도
NONE

BLOCK: NO

STATUS: SUCCESS
