# 정식 규약 준수 검토 — import-settings-dto

## 검토 모드
구현 착수 전 검토 (--impl-prep)

## 참고사항 — payload mis-scope

`_prompts/convention_compliance.md` 에 번들된 target 문서(`spec/5-system/1-auth.md` 전문 + graph-rag·audit-actions convention·cafe24 catalog 등)는 실제 계획된 작업(`ImportWorkflowDto.settings` DTO 타이핑)과 무관하다 — orchestrator 프롬프트 조립 단계의 스코프 오류로 판단된다. 이 번들 텍스트를 근거로 삼지 않고, 호출자가 전달한 **실제 계획**(아래)과 codebase 의 실제 정식 규약(`spec/conventions/swagger.md`) + 관련 spec(`spec/2-navigation/1-workflow-list.md` §3.2) + 기존 코드 선례를 직접 대조해 검토했다.

**실제 계획**: `ImportWorkflowDto.settings` (현재 `Record<string, unknown>` loose object) 를 `@IsObject() @ValidateNested() @Type(() => WorkflowSettingsDto)` + swagger `type: () => WorkflowSettingsDto` thunk 로 타이핑. 신규 DTO 생성 없이 기존 `WorkflowSettingsDto` (`codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts`) 재사용.

## 대조 대상

- `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts` — 현재 `settings?: Record<string, unknown>` (loose), 동일 파일 내 `nodes`/`edges` 필드는 이미 `@IsArray() @ValidateNested({ each: true }) @Type(() => XxxDto)` 패턴 사용.
- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` — `settings?: WorkflowSettingsDto` 필드가 정확히 계획과 동일한 데코레이터 조합(`@IsOptional() @IsObject() @ValidateNested() @Type(() => WorkflowSettingsDto)` + `@ApiPropertyOptional({ type: () => WorkflowSettingsDto, ... })`)을 이미 채택 중 — 직접 선례.
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` — 재사용 대상 `WorkflowSettingsDto` 정의. JSDoc 에 "여기 필드를 추가해 확장" 명시.
- `spec/conventions/swagger.md` §1-4 (nested object → `@ApiProperty({ type: () => NestedDto })`), §4 (JSDoc + 필요시 ApiProperty 보강 워크플로우).
- `spec/2-navigation/1-workflow-list.md` §3.2 — export/import JSON 계약의 SoT 를 `import-workflow.dto.ts`/`ExportWorkflowDto` 로 명시. `settings` 는 top-level 키로 문서화되어 있으나 내부 스키마를 별도로 강제하지 않음(현행 loose 허용과 정합).

## 발견사항

- **[INFO]** Export 측 `ExportWorkflowDto.settings` 는 그대로 loose 유지 — 계획 범위 밖이지만 비대칭 표기 여지
  - target 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` L152-154 (`ExportWorkflowDto.settings: Record<string, unknown>`, `type: 'object', additionalProperties: true`)
  - 위반 규약: 직접 위반 아님. `spec/conventions/swagger.md` §1-4 는 union/dynamic 객체에 `type: 'object', additionalProperties: true` 를 명시적으로 허용하므로 현행 export DTO 자체는 규약 위반이 아니다.
  - 상세: 계획은 **input 측**(`ImportWorkflowDto`) 만 타이트닝하고 **output 측**(`ExportWorkflowDto`)은 그대로 둔다. Export → (사용자 편집) → Import 라운드트립 관점에서 두 DTO 의 `settings` 스키마 표현이 한쪽만 구조화되는 비대칭이 생기지만, `spec/2-navigation/1-workflow-list.md` §3.2 는 두 DTO 간 필드 스키마 대칭을 규약으로 강제하지 않는다 — 정보성 관찰일 뿐 위반은 아니다.
  - 제안: 이번 변경 스코프에는 포함하지 않는 것이 타당(계획대로). 후속 과제로 `ExportWorkflowDto.settings` 도 `WorkflowSettingsDto` 참조로 맞추는 것을 고려할 수 있으나 별도 결정 사안.

- **[INFO]** `ImportWorkflowDto.settings` 타이핑 후 nodes/edges 배열 필드와의 데코레이터 순서 일관성 확인 권고
  - target 위치: `import-workflow.dto.ts` L160-167 (`settings` 필드), L169-177(`nodes`)/L179-187(`edges`) 대조
  - 위반 규약: 없음 — 순수 스타일 제안.
  - 상세: 기존 `nodes`/`edges` 는 `@ApiProperty(...) / @IsArray() / @ValidateNested({ each: true }) / @Type(() => Dto)` 순서. `UpdateWorkflowDto.settings` 선례는 `@ApiPropertyOptional(...) / @IsOptional() / @IsObject() / @ValidateNested() / @Type(() => WorkflowSettingsDto)` 순서. 계획한 조합(`@IsObject @ValidateNested @Type` + `@IsOptional`)은 이 선례와 정확히 일치하므로 실제로는 문제 없음 — 파일 내 두 그룹(array-nested vs single-object-nested) 데코레이터 순서가 각각 다른 기존 컨벤션을 그대로 답습하면 된다는 점만 확인차 기록.
  - 제안: 별도 조치 불필요. `UpdateWorkflowDto` 의 순서를 그대로 복사하면 규약과 완전히 일치.

발견된 CRITICAL/WARNING 없음.

## 요약

계획된 변경(`ImportWorkflowDto.settings: Record<string, unknown>` → `WorkflowSettingsDto` 타입의 `@IsObject() @ValidateNested() @Type(() => WorkflowSettingsDto)` + `@ApiPropertyOptional({ type: () => WorkflowSettingsDto })`)은 동일 모듈의 `UpdateWorkflowDto.settings` 가 이미 채택한 패턴을 문자 그대로 재사용하는 것이며, `spec/conventions/swagger.md` §1-4 nested object 규약(`type: () => NestedDto`), DTO JSDoc/ApiProperty 보강 워크플로우(§4), 그리고 같은 파일의 `nodes`/`edges` `@ValidateNested` 선례와 전부 정합한다. 신규 DTO 를 만들지 않고 기존 `WorkflowSettingsDto` 를 재사용하는 것도 해당 DTO의 JSDoc("여기 필드를 추가해 확장")이 예정한 확장 방식과 일치한다. `spec/2-navigation/1-workflow-list.md` §3.2 의 import/export JSON 계약 SoT 지정과도 충돌하지 않는다. 번들된 target payload(auth spec 등)는 실제 계획과 무관한 스코프 오류이며, 이를 근거로 한 분석은 배제했다. CRITICAL/WARNING 위반 없음 — 정식 규약 준수 관점에서 문제 없이 진행 가능한 변경이다.

## 위험도
NONE

BLOCK: NO

STATUS: SUCCESS
