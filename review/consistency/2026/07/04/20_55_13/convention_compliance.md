# 정식 규약 준수 검토 — workflow-cap-dto (WorkflowSettingsDto 신설)

## 검토 모드
구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)

> **NOTE**: impl-prep payload 는 mis-scoped(1-auth/graph-rag 번들)로 확인됨. 실제 저장소·plan
> 문서(`plan/in-progress/workflow-cap-validated-dto.md`) 및 기존 코드(`UpdateWorkspaceSettingsDto`,
> `UpdateTriggerDto`)를 직접 조사해 검토함.

## 계획된 작업 요약
- 신규 `WorkflowSettingsDto` (class-validator `@IsOptional/@IsInt/@Min(1) maxConcurrentExecutions?`) —
  `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` 의
  `maxConcurrentExecutions` 필드를 미러링.
- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` 의 `settings` 필드를
  현재 `@IsObject() Record<string, unknown>` (opaque passthrough) 에서
  `@IsOptional() @ValidateNested() @Type(() => WorkflowSettingsDto)` 로 전환.
- spec 근거: `spec/1-data-model.md` (`Workflow.settings.maxConcurrentExecutions`),
  `spec/5-system/4-execution-engine.md §8` (admission gate cap 표) — 두 문서 모두 이미
  `maxConcurrentExecutions` 를 workflow-level 설정 키로 명시하고 있어 spec 정합성 확인됨.

## 발견사항

### INFO — `@IsObject()` 동반 누락 가능성 (기존 nested 패턴과의 일치성)
- target 위치: plan 문서(`plan/in-progress/workflow-cap-validated-dto.md`) §설계 결정 1
  "`UpdateWorkflowDto.settings` 를 `@IsOptional @ValidateNested @Type(() => WorkflowSettingsDto)` 로 전환"
- 위반 규약: 직접적 규약 위반은 아님. 저장소 내 기존 nested-DTO 선례
  (`codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` 의 `notification`/
  `interaction`/`chatChannel` 필드) 는 전부 `@IsOptional() @IsObject() @ValidateNested() @Type(() => X)`
  4-데코레이터 조합을 사용.
- 상세: plan 문서에 나열된 데코레이터 목록에 `@IsObject()` 가 빠져 있음. class-validator 상
  `@ValidateNested()` 단독으로도 동작하지만, 이 저장소의 확립된 관례는 `@IsObject()` 를 항상
  동반해왔음 (원시 타입 입력 시 조기에 명확한 타입 오류를 내기 위함으로 추정).
- 제안: 구현 시 `@IsObject()` 를 포함해 `UpdateTriggerDto` 와 완전히 동일한 4-데코레이터 조합을
  적용 권장. plan 문서는 요약이라 데코레이터 나열이 비완전할 수 있으므로 사전 검토 단계의
  차단 사유는 아니며, 구현/코드리뷰 단계에서 확인.

### INFO — 신규 DTO 파일 위치/명명 사전 미확정
- target 위치: plan 문서 전체 (파일 경로 명시 없음)
- 위반 규약: `spec/conventions/swagger.md` §5-1 관련 DTO 위치 규칙의 유추, CLAUDE.md 폴더 구조 규약
- 상세: `WorkflowSettingsDto` 가 어느 파일에 위치할지 plan 에 명시되어 있지 않음.
  트리거 모듈 선례는 `<도메인>-config.dto.ts` 네이밍(`notification-config.dto.ts` 등, 별도
  파일 분리)을 쓰는 반면, workspace 쪽은 `update-workspace-settings.dto.ts` 하나에 inline
  필드로 통합되어 있어 두 선례가 다소 상충.
- 제안: 구현 시 별도 파일(`codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts`)로
  분리하되 파일명(kebab-case + `.dto.ts` suffix)·클래스명(PascalCase + `Dto` suffix) 모두
  기존 관례를 그대로 따르면 문제 없음. 명명 세부사항이라 사전 검토 단계 차단 사유 아님.

### INFO — `@ApiPropertyOptional({ type: () => WorkflowSettingsDto })` 명시 필요
- target 위치: 현재 `update-workflow.dto.ts` L66-74 의 `settings` 필드 —
  `@ApiPropertyOptional({ type: 'object', additionalProperties: true, example: {...} })`
- 위반 규약: `spec/conventions/swagger.md` §1-4 "nested object: `@ApiProperty({ type: () => NestedDto })`"
- 상세: nested DTO 전환 후에도 기존 `type: 'object', additionalProperties: true` 표기를 유지하면
  Swagger 스키마가 여전히 "임의 object" 로 보여 실제 강타입 검증(400 on unknown key)과 문서가
  불일치하게 됨. 트리거 모듈 선례(`@ApiPropertyOptional({ type: () => NotificationConfigDto })`)를
  따라야 정합.
- 제안: 구현 시 `@ApiPropertyOptional({ type: () => WorkflowSettingsDto })` 로 갱신 필요.
  plan 문서에 이 변경이 명시적으로 적혀있지 않으므로 구현 시 누락되지 않도록 상기.

## 검증 근거 (참조한 실제 코드/문서)
- `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` —
  `maxConcurrentExecutions?: number` 필드의 `@IsOptional() @IsInt() @Min(1)` 패턴 (미러링 대상).
- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` L65-74 — 전환 대상 `settings` 필드.
- `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` L84-105 — 기존
  nested-DTO(`@ValidateNested`/`@Type`) 채택 선례, 4-데코레이터 조합 확인.
- `spec/conventions/swagger.md` §1-4, §5 — nested object 문서화 규약, 응답/요청 DTO 패턴.
- `spec/1-data-model.md` L94, L120 / `spec/5-system/4-execution-engine.md` L1075-1076 —
  `Workflow.settings.maxConcurrentExecutions` spec 정의, workspace 대칭 확인.
- `plan/in-progress/workflow-cap-validated-dto.md` — 계획 원본, strict whitelist 안전성 근거
  (backend 소비 키 단일, frontend 미전송) 포함.

## 요약
계획된 작업(`WorkflowSettingsDto` 신설 + `UpdateWorkflowDto.settings` 의 `@ValidateNested`/`@Type`
전환)은 `spec/conventions/swagger.md` 의 DTO·nested object 문서화 규약, 그리고 저장소 내 기존
nested-DTO 선례(`UpdateTriggerDto` 의 `notification`/`interaction`/`chatChannel` 필드)와
`UpdateWorkspaceSettingsDto` 의 `maxConcurrentExecutions` 검증 패턴(`@IsOptional @IsInt @Min(1)`)을
그대로 대칭 이식하는 것으로, 명명·구조·검증 방식 모두에서 기존 정식 규약 및 확립된 코드 관례와
정합한다. spec(`spec/1-data-model.md`, `spec/5-system/4-execution-engine.md §8`)에도
`Workflow.settings.maxConcurrentExecutions` 가 이미 정의되어 있어 spec 상의 근거도 확인된다.
발견된 사항은 모두 구현 단계에서 유의할 세부 일치 항목(INFO)뿐이며, 정식 규약을 위반하는
CRITICAL/WARNING 요소는 없다.

## 위험도
NONE

BLOCK: NO

STATUS: SUCCESS
