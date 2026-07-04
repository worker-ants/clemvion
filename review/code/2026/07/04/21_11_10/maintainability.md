# 유지보수성(Maintainability) Review

## 리뷰 대상
- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`
- `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts`
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` (신규)
- `codebase/backend/src/modules/workflows/workflows.service.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.service.ts`
- `codebase/backend/test/workflow-crud.e2e-spec.ts`
- `plan/in-progress/workflow-cap-validated-dto.md`
- (참고: `review/consistency/2026/07/04/20_55_13/*` 는 프로세스 산출물이라 코드 유지보수성 분석 대상에서 제외)

## 발견사항

- **[INFO]** `@IsObject()` + `@ValidateNested()` + `@Type()` 3중 데코레이터 조합의 의도가 주석으로 설명되지 않음
  - 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts:149-152`
  - 상세: `@IsObject()`(원시 타입 조기 차단), `@ValidateNested()`(중첩 검증 트리거), `@Type(() => WorkflowSettingsDto)`(plainToInstance 변환)의 조합은 `UpdateTriggerDto`의 `notification`/`interaction`/`chatChannel` 필드와 동일한 저장소 관례를 그대로 따르고 있어 실제 코드 자체는 기존 패턴과 100% 일관됨(문제 없음). 다만 이 3-데코레이터 조합이 왜 함께 필요한지(단독 `@ValidateNested()`만으로는 원시 타입 입력 시 에러 메시지가 불명확해질 수 있다는 이유)에 대한 설명이 없어, 향후 이 파일을 보는 개발자가 "중복 아닌가"라고 오인해 `@IsObject()`를 제거할 위험이 낮게 있음.
  - 제안: 필수는 아니나, `workflow-settings.dto.ts` 헤더 주석처럼 짧은 인라인 주석(`// @IsObject: 원시 타입 조기 차단, class-validator 관례`) 하나만 추가해도 향후 실수를 예방할 수 있음.

- **[INFO]** `WorkflowSettingsDto`와 `UpdateWorkspaceSettingsDto`의 `maxConcurrentExecutions` 필드가 데코레이터·JSDoc·Swagger 설명 문구까지 거의 동일하게 복제됨
  - 위치: `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts:15-29` vs `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts:45-59`
  - 상세: 두 파일의 필드 선언(`@IsOptional() @IsInt() @Min(1) maxConcurrentExecutions?: number`)과 Swagger `description` 문구가 "워크스페이스당"/"워크플로우당"만 다르고 거의 동일하다. 현재는 필드가 1개뿐이라 중복이 경미하지만, 향후 admission gate 설정 키가 늘어나면(§8 stage 2 timeout 등 plan 문서에 이미 예고됨) 공유 mixin/base DTO 없이 필드마다 복제될 가능성이 있다.
  - 상세 근거: 이 중복은 CLAUDE.md 메모리에 기록된 "cafe24/makeshop 미러 중복은 의도(철회)" 사례처럼 의도된 비대칭 미러(workspace/workflow가 별개 스코프의 독립 리소스)에 해당하므로 지금 통합을 제안하는 것은 부적절함 — INFO로만 기록.
  - 제안: 리팩터링 요구 아님. 필드가 2개 이상으로 늘어나는 시점에 공유 `ConcurrencyCapField` 데코레이터 조합 등을 재검토할 수 있다는 정도의 참고.

- **[INFO]** `workflows.service.ts`의 `update()` 메서드에서 구조분해 + 조건부 병합 로직이 추가되어 함수가 약간 길어졌으나 여전히 명확함
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:1198-1213`
  - 상세: `const { settings, ...rest } = dto; Object.assign(workflow, rest); if (settings !== undefined) { workflow.settings = {...} }` 패턴은 가독성이 좋고 주석(`// settings 는 전체 교체 대신 병합...`)이 "왜"를 잘 설명한다. 순환 복잡도·중첩 깊이 모두 낮음. 특별한 개선 필요 없음 — 참고용 INFO.

- **[INFO]** 테스트 파일들의 서술형 describe/it 이름에 스펙 참조(`§8`, `workspace 대칭`)를 인라인으로 포함하는 방식이 일관되게 유지됨
  - 위치: `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts:177`, `codebase/backend/src/modules/workflows/workflows.service.spec.ts:910`, `codebase/backend/test/workflow-crud.e2e-spec.ts:1893`
  - 상세: 세 파일 모두 "§8 cap DTO" / "§8 admission gate" 등 동일한 스펙 태그를 붙여 테스트와 요구사항의 추적성을 확보했다. 기존 코드베이스 스타일(다른 e2e 파일들의 "B. PATCH...", "parallel-p2 §6" 등)과도 일관됨. 긍정적 발견이라 개선 제안 없음.

- **[INFO]** `it.each([0, -1, 1.5])`로 경계값 테스트를 테이블화해 반복 코드를 피함
  - 위치: `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts:202-212`
  - 상세: 0/음수/소수 세 케이스를 개별 `it` 블록으로 복제하지 않고 파라미터화한 것은 좋은 관행. 중복 코드 관점에서 긍정적.

발견된 CRITICAL/WARNING 없음. 함수 길이, 중첩 깊이, 매직 넘버(신규 `maxConcurrentExecutions`의 `Min(1)`은 도메인 상수로 자명하며 이미 workspace DTO와 동일하게 사용됨), 네이밍(모두 PascalCase+Dto suffix, kebab-case 파일명 일관) 모두 문제 없음. 신규 `WorkflowSettingsDto`는 클래스 JSDoc이 "왜 이 파일이 존재하는지"(전역 pipe whitelist 동작, spec §8 스코프, 확장 방법)를 명확히 설명해 가독성이 높다.

## 요약
이번 변경은 기존 `UpdateTriggerDto`/`UpdateWorkspaceSettingsDto`의 nested-DTO 검증 패턴을 그대로 미러링한 소규모 대칭화 작업으로, 함수 길이·중첩·복잡도·네이밍 모든 항목에서 기존 코드베이스 스타일과 잘 정합한다. 서비스 계층의 spread-merge 로직은 주석으로 의도가 명확히 설명되어 있고, 테스트는 파라미터화·스펙 태깅 등 좋은 관행을 따른다. `maxConcurrentExecutions` 필드가 workspace/workflow 두 DTO에 거의 동일하게 복제된 점은 경미한 중복이나 두 리소스가 독립 스코프를 갖는 의도된 비대칭 미러이므로 지금 통합할 필요는 없다. 전반적으로 유지보수성 리스크는 낮다.

## 위험도
NONE
