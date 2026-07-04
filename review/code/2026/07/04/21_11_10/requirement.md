# 요구사항(Requirement) Review — workflow-level cap validated write DTO

## 점검 대상

- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` (신규)
- `codebase/backend/src/modules/workflows/workflows.service.ts`
- `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.service.spec.ts`
- `codebase/backend/test/workflow-crud.e2e-spec.ts`
- `plan/in-progress/workflow-cap-validated-dto.md`

## 참조 spec

- `spec/5-system/4-execution-engine.md` §8 (동시 실행 제한 표, L1075-1090) — `Workflow.settings.maxConcurrentExecutions` (Editor+ — `PATCH /api/workflows/:id`), 기본 3, admission gate.
- `spec/1-data-model.md` §2.4 Workflow (L120) — 동일 필드·기본값·권한·엔드포인트 명세.

payload 로 전달된 requirement.md 는 실제 코드 diff(파일 1-7)에 더해 `review/consistency/...` 산출물(파일 8-13, `--impl-prep` 단계 결과)까지 함께 번들되어 있었음. `git diff origin/main...HEAD --stat` 로 대조한 결과 실제 코드 변경분(파일 1-7)은 payload 내용과 정확히 일치해 미스코프 우려는 없었음(consistency 산출물은 부가 컨텍스트로 참고만 함).

## 발견사항

- **[INFO]** `PATCH { settings: null }` 이 검증을 통과하고 서비스에서 조용히 no-op 이 된다 (엣지 케이스 미검증)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` L995-1002 (`if (settings !== undefined) { workflow.settings = { ...(workflow.settings ?? {}), ...settings }; }`)
  - 상세: 실측 확인(jest 임시 probe) 결과 `plainToInstance(UpdateWorkflowDto, { settings: null })` 는 `@IsOptional()` 이 `null`/`undefined` 모두 스킵 대상으로 취급해 검증 오류 0건, `dto.settings === null` 로 통과한다. 이어 서비스 코드는 `settings !== undefined` 만 체크하므로 `null` 도 그 분기에 들어가고, `{ ...(workflow.settings ?? {}), ...null }` 은 JS 스펙상 `null` spread 가 no-op 이라 기존 `settings` 값이 그대로(얕은 복사) 유지된다. 즉 클라이언트가 `settings: null` 을 보내면 200 을 받지만 실제로는 아무것도 바뀌지 않는다 — "설정 초기화" 의도로 보낸 것이라면 조용히 무시되는 셈이라 놀랄 수 있는 동작이다. 다만 데이터 손상·타 필드 오염은 없고, spec §8/§2.4 본문도 `null` 을 통한 초기화 동작을 정의하지 않아 spec 위반은 아니다(회색지대).
  - 제안: 의도된 동작이면(= "null 은 no-op") 문서화(DTO 주석 또는 plan)에 명시 권장. 실제로 cap 을 기본값(3)으로 되돌리는 UX 가 필요하다면 `settings: null` 을 명시적으로 "clear" 로 처리(`workflow.settings = null` 또는 `{}`)하도록 서비스 분기 보강 검토.

- **[INFO]** Swagger nested-type 참조가 저장소 관례(thunk 형태)와 다름
  - 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` L71-75 (`@ApiPropertyOptional({ type: WorkflowSettingsDto, ... })`)
  - 상세: `spec/conventions/swagger.md` §1-4 는 "nested object: `@ApiProperty({ type: () => NestedDto })`" 로 thunk(화살표 함수) 형태를 규약화하며, 저장소 기존 선례(`UpdateTriggerDto` 의 `notification`/`interaction`/`chatChannel`)도 전부 `type: () => X` 형태를 사용한다. 이번 변경은 `type: WorkflowSettingsDto` (직접 클래스 참조, thunk 없음)로 작성되어 있다. 순환참조가 없는 단순 케이스라 `@nestjs/swagger` 런타임 동작에는 차이가 없지만(기능상 문제 없음), 정식 규약·기존 코드 패턴과는 line-level 로 다르다. 이미 impl-prep 단계 `convention_compliance.md` 에서도 유사 항목(타입 참조 형태)이 INFO 로 선제 식별된 바 있다.
  - 제안: `type: () => WorkflowSettingsDto` 로 통일해 규약·기존 패턴과 일치시킬 것을 권장(기능적 강제는 아님, 낮은 우선순위).

- **[INFO]** `ImportWorkflowDto.settings` 는 여전히 opaque `Record<string, unknown>` — 검증 강도 비대칭 (범위 밖으로 의도적 defer, spec 언급 없음)
  - 위치: `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts` L167
  - 상세: 같은 `Workflow.settings` jsonb 컬럼에 대해 PATCH 경로는 이번에 strict validated DTO 로 전환됐으나 import 경로는 여전히 무검증 passthrough. plan 문서(`plan/in-progress/workflow-cap-validated-dto.md` 말미)에서 낮은 우선순위 후속으로 명시적으로 defer 됐고, 실제로 코드 확인 결과 회귀는 없다(원래부터 opaque, 이번 PR 이 만든 문제 아님).
  - 제안: 별도 계획대로 후속 검토. 본 PR 의 병합을 막을 사유 아님.

## Spec fidelity 검증 (line-level)

- `Workflow.settings.maxConcurrentExecutions` (Editor+, `PATCH /api/workflows/:id`) — 컨트롤러 `@Patch(':id') @Roles('editor')` (`workflows.controller.ts` L164-165, 본 diff 로 변경되지 않음, 사전에 이미 부합) 와 spec §8 표(L1076)·§2.4(L120) 문구가 정확히 일치.
- 기본값 3 — `DEFAULT_WORKFLOW_MAX_CONCURRENT_EXECUTIONS = 3` (`execution-limits.ts` L44) 이 실제 admission gate(`execution-engine.service.ts` L2640-2643) 에서 사용되고, `WorkflowSettingsDto`·`UpdateWorkflowDto` 주석의 "미설정 시 기본 3" 서술과 일치. spec §2.4 "미설정 시 기본 3" 과도 일치.
- `@IsOptional @IsInt @Min(1)` — spec 본문이 직접 이 데코레이터 조합을 명시하진 않으나, workspace 대칭(`UpdateWorkspaceSettingsDto.maxConcurrentExecutions`)과 동일 패턴이며 admission gate 의 "양의 정수만 유효" 런타임 방어(`resolveConcurrencyCap`)와 완전히 정합. write 경계에서 선제 차단하는 의도(주석에 명시)도 실제 구현과 일치.
- 미지 키 거부(400, forbidNonWhitelisted) — 전역 `CustomValidationPipe` whitelist+forbidNonWhitelisted 정책에 의해 실현되며, e2e(B2) 가 이를 실제 HTTP 레벨로 검증. 유닛 테스트(`workflow-dto-validation.spec.ts`)도 동일 케이스 커버.
- spread-merge — `workflows.service.ts` `update()` 가 `Object.assign(workflow, rest)` (settings 제외) + `settings` 만 별도 병합. workspace `updateWorkspaceSettings` 의 `{ ...(workspace.settings ?? {}), ...nextSettings }` 패턴과 대칭. 서비스 유닛 테스트 3건(병합/미변경/초기화)이 모두 통과(jest 재실행 확인, 68/68 pass).
- e2e(B2) — 0 → 400, 미지 키 → 400, 양의 정수 5 → 200 + 후속 GET 영속. 실제 HTTP 계약이 spec §8 admission-gate 문서화된 write validation 의도와 일치.

## 실행 검증

- `npx jest src/modules/workflows/dto/workflow-dto-validation.spec.ts src/modules/workflows/workflows.service.spec.ts` → 68/68 pass.
- `npx tsc --noEmit` 프로젝트 전체 실행 결과 다수의 사전 존재 오류(workflow-assistant, mock repository 타입 등)가 있으나 이번 diff 대상 파일(`workflow-settings.dto.ts`/`update-workflow.dto.ts`/`workflows.service.ts`) 관련 오류는 0건 — 회귀 없음.
- `plainToInstance(UpdateWorkflowDto, { settings: null })` 임시 probe 로 위 INFO#1 (null no-op) 실측 확인 후 probe 파일 삭제(작업 트리 clean 확인).

## TODO/FIXME

없음. 미완성 표시(TODO/FIXME/HACK/XXX) 주석 발견되지 않음.

## 요약

`Workflow.settings.maxConcurrentExecutions` write 경로를 opaque `Record` 에서 `WorkflowSettingsDto`(`@IsOptional @IsInt @Min(1)`) nested-validated DTO 로 전환하고 서비스 계층에서 spread-merge 로 전환한 변경은 spec §8·§2.4 이 이미 문서화한 필드명·기본값(3)·권한(Editor+)·엔드포인트(`PATCH /api/workflows/:id`)·admission-gate 런타임 방어와 line-level 로 정확히 일치하며, workspace 측 선례(`UpdateWorkspaceSettingsDto`)와 대칭적으로 구현됐다. 유닛(68/68)·e2e(B2 4-assert 흐름)·tsc 모두 diff 대상 파일에서 회귀 없이 통과했다. CRITICAL/WARNING 은 없으며, 발견된 3건은 모두 INFO 수준(설명 필드 `settings: null` no-op 동작 미문서화, swagger nested-type thunk 관례 미준수, import 경로 opaque 비대칭 — 후자는 이미 의도적으로 별도 defer)으로 병합을 막을 사유가 아니다.

## 위험도

LOW
