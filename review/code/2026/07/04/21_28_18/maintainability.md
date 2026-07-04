# 유지보수성(Maintainability) Review

## 리뷰 대상
- `CHANGELOG.md`
- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`
- `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts`
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` (신규)
- `codebase/backend/src/modules/workflows/workflows.service.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.service.ts`
- `codebase/backend/test/workflow-crud.e2e-spec.ts`
- `plan/in-progress/workflow-cap-validated-dto.md`
- (참고: `review/code/2026/07/04/21_11_10/*`, `review/consistency/2026/07/04/20_55_13/*` 는 이전 리뷰/컨시스턴시 세션의 산출물(JSON/MD)로, 코드 유지보수성 분석 대상인 애플리케이션 코드가 아니므로 제외)

## 사전 검증
`git diff origin/main...HEAD --stat` 로 payload 파일 목록·내용을 실제 저장소 diff 와 대조 — mis-scope 없음. 이번 세션(21_28_18)은 직전 세션(21_11_10) 이후 INFO 조치(swagger `type:` thunk 전환, CHANGELOG 항목 추가, `@Min(1)` 경계값 테스트 추가)가 반영된 상태의 fresh re-review.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** `maxConcurrentExecutions` 필드가 `WorkflowSettingsDto` 와 `UpdateWorkspaceSettingsDto` 간에 데코레이터·JSDoc·Swagger 문구까지 거의 동일하게 복제됨
  - 위치: `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts:1-29` vs `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` 동일 필드
  - 상세: `@IsOptional() @IsInt() @Min(1) maxConcurrentExecutions?: number` 선언과 설명 문구("워크스페이스당"/"워크플로우당"만 차이)가 두 파일에 독립 반복된다. 현재는 필드가 1개뿐이라 중복 규모는 경미. 다만 이는 CLAUDE.md 메모리에 기록된 "cafe24/makeshop 미러 중복은 의도(철회)" 및 workspace/workflow 가 독립 스코프 리소스라는 설계와 일치하는 **의도된 mirrored-but-independent 패턴**이므로, 지금 시점에 공유 베이스/mixin 추출을 제안하는 것은 부적절함.
  - 제안: 리팩터링 불필요. plan 문서(`plan/in-progress/workflow-cap-validated-dto.md`)의 "후속(별도)" 섹션처럼, admission gate 설정 키가 2개 이상으로 늘어나는 시점에 공유 데코레이터 조합 재검토 여지만 참고로 남김.

- **[INFO]** `WorkflowsService.update()` 의 구조분해 + 조건부 병합 로직은 간결하고 의도 주석이 명확함
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (`const { settings, ...rest } = dto; Object.assign(workflow, rest); if (settings !== undefined) { workflow.settings = { ...(workflow.settings ?? {}), ...settings }; }`)
  - 상세: 순환 복잡도·중첩 깊이 모두 낮고(단일 if, 중첩 1단계), "왜 전체 교체 대신 병합인지"를 주석이 명시적으로 설명해 향후 유지보수 시 오해 소지가 낮다. workspace 의 대칭 로직과 패턴이 일관됨. 개선 필요 없음.

- **[INFO]** `@IsObject()` + `@ValidateNested()` + `@Type()` 3중 데코레이터 조합의 의도가 인라인 주석으로 설명되지 않음
  - 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` (`settings` 필드 데코레이터 블록)
  - 상세: 이 조합은 `UpdateTriggerDto` 의 nested 필드들과 동일한 기존 저장소 관례를 그대로 따르므로 코드 자체는 기존 패턴과 일관됨(문제 없음). 다만 `@IsObject()`(원시 타입 조기 차단)가 `@ValidateNested()`와 함께 왜 필요한지에 대한 설명이 없어, 향후 "중복 아닌가"라는 오인으로 제거될 낮은 위험이 있음. JSDoc 자체는 "무엇을"(미지 키 거부) 설명하지만 "이 3개 데코레이터가 왜 함께"는 설명하지 않음.
  - 제안: 필수는 아니나 향후 유사 패턴을 추가하는 개발자를 위해 저장소 어딘가(예: `conventions/` 또는 DTO 작성 가이드)에 이 3중 조합의 이유를 한 번 문서화해두면 반복 재발 시 유용.

- **[INFO]** 테스트가 파라미터화(`it.each`)와 스펙 태그(`§8`) 인라인 표기를 일관되게 유지
  - 위치: `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts` (`it.each([0, -1, 1.5])`), `codebase/backend/test/workflow-crud.e2e-spec.ts` (`B2. PATCH settings...(§8, workspace 대칭)`)
  - 상세: 경계값(0/음수/소수) 케이스를 개별 `it` 복제 없이 테이블화했고, describe/it 명명이 기존 e2e 파일들의 "B. ...", "§N" 표기 컨벤션과 일치한다. 긍정적 발견으로 개선 제안 없음.

- **[INFO]** `WorkflowSettingsDto` 클래스 JSDoc 이 "왜 이 파일이 존재하는지"를 명확히 설명
  - 위치: `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` (클래스 상단 주석)
  - 상세: 전역 pipe 의 whitelist/forbidNonWhitelisted 동작, spec §8/§2.4 스코프, 신규 키 확장 방법까지 서술해 가독성이 높음. 개선 불요.

함수 길이, 중첩 깊이, 순환 복잡도, 네이밍(PascalCase+Dto suffix, kebab-case 파일명) 모두 기존 컨벤션과 일관되며 문제 없음. `Min(1)` 은 도메인상 자명한 하한(1개 미만 동시실행은 무의미)이고 workspace DTO 와 동일한 이미 확립된 패턴이라 매직 넘버로 보기 어려움. `CHANGELOG.md` 항목은 서술형이 다소 길지만(narrowing 근거 상세 기술) 기존 항목들의 스타일과 일관되고, 이 정도 근거 서술은 이 저장소의 CHANGELOG 관례(breaking-adjacent narrowing 시 영향 분석 포함)에 부합한다.

## 요약
이번 변경은 기존 `UpdateWorkspaceSettingsDto`/`UpdateTriggerDto` 의 nested-DTO 검증 패턴을 그대로 미러링한 소규모 대칭화 작업으로, 함수 길이·중첩·복잡도·네이밍 모두 기존 코드베이스 스타일과 잘 정합한다. 서비스 계층의 spread-merge 로직은 의도가 주석으로 명확히 설명되어 있고, 테스트는 파라미터화·스펙 태깅 등 좋은 관행을 따른다. `maxConcurrentExecutions` 필드가 workspace/workflow 두 DTO에 거의 동일하게 복제된 점은 경미한 중복이나, 두 리소스가 독립 스코프를 갖는 의도된 비대칭 미러 패턴(저장소 내 선례와 일치)이므로 지금 통합을 제안할 근거는 없다. 전반적으로 유지보수성 리스크는 낮으며, 직전 세션(21_11_10) 대비 반영된 INFO 조치(swagger thunk, CHANGELOG, 경계값 테스트)도 확인됐다.

## 위험도
NONE
