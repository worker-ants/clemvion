# 문서화(Documentation) Review — workflow-cap-validated-dto

## 스코프 확인

payload 는 `git diff origin/main...HEAD` 와 정확히 일치(15 files changed, 585 insertions(+), 8 deletions(-)) — mis-scope 없음, fallback 불필요.

## 발견사항

- **[INFO]** CHANGELOG.md 미갱신 — API 검증 강도 변경(하위호환 영향 가능)
  - 위치: `CHANGELOG.md` (변경 없음), 대비 `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` / `workflow-settings.dto.ts`
  - 상세: `PATCH /api/workflows/:id` 의 `settings` 가 종전 opaque `Record<string, unknown>`(임의 키 허용, passthrough)에서 nested validated DTO(`WorkflowSettingsDto`, `maxConcurrentExecutions` 단일 키)로 전환되며, 전역 `CustomValidationPipe`(`whitelist+forbidNonWhitelisted`)에 의해 **미지 키가 이제 400 으로 거부**된다. 이는 이론상 이전에 통과하던 요청을 깨는 계약 축소(narrowing)다. 리포의 `CHANGELOG.md` 는 정확히 이런 유형의 변경(예: 기존 "model-config 부속 엔드포인트 hardening — listModels type 검증", "webhook/manual 400 검증 실패 필드별 사유 surface")을 "Unreleased" 섹션에 성실히 기록해온 선례가 있다. plan 문서(`plan/in-progress/workflow-cap-validated-dto.md`)와 consistency-check(`review/consistency/.../SUMMARY.md`)가 이 narrowing 이 실질적으로 안전함(현재 소비되는 키가 `maxConcurrentExecutions` 뿐, frontend 미전송)을 근거로 들며 결정을 승인했으나, 이 안전성 근거와 결정 자체는 plan 파일에만 남아 있고 사용자/운영자에게 노출되는 CHANGELOG 에는 반영되지 않았다.
  - 제안: `CHANGELOG.md` 에 "Unreleased" 섹션 추가 — "`PATCH /api/workflows/:id` `settings` 필드가 검증 DTO(`WorkflowSettingsDto`)로 전환되어 `maxConcurrentExecutions` 외 미지 키는 400 거부. 이전에는 임의 키가 무검증 저장되었음(실질 소비처 없어 영향 낮음)" 같은 문구.

- **[INFO]** `resolveConcurrencyCap` 주변 기존 주석은 이번 변경으로 stale 해지지 않음(확인됨) — 문제 아님, 참고용
  - 위치: `codebase/backend/src/modules/execution-engine/execution-limits.ts:49-50` (본 diff 밖, 사전 존재 코드)
  - 상세: 해당 주석("Workflow.settings 는 unvalidated `Record` 라 런타임 타입 방어가 필요")이 이번 PR로 `UpdateWorkflowDto.settings` 가 validated DTO 가 되면서 부정확해진 것처럼 보일 수 있으나, `resolveConcurrencyCap` 은 write 경계(DTO)가 아니라 **DB 로부터 읽은 raw JSONB**(과거 검증 이전에 저장된 값 포함 가능)를 다루므로 여전히 유효한 방어다. `workflow-settings.dto.ts` 의 신규 JSDoc 도 "런타임의 `resolveConcurrencyCap` 이 부적합 값을 defaultCap 으로 무시하는 backstop"이라고 정확히 교차 참조한다. 코드 검증 결과 `DEFAULT_WORKFLOW_MAX_CONCURRENT_EXECUTIONS = 3` 이 JSDoc 의 "기본값 3" 과 일치. 수정 불필요.

## 검증한 사항 (문제 없음)

- `WorkflowSettingsDto` 클래스/필드 JSDoc: 신규 공개 클래스·필드에 목적·검증 규칙·spec 참조(§8)·backstop 관계·Parallel 노드 `config.maxConcurrency` 와의 스코프 구분까지 상세히 기술 — 우수.
- `UpdateWorkflowDto.settings` 갱신된 JSDoc/`@ApiPropertyOptional`: 종전 "임의 속성 허용" 설명에서 "검증 대상 키만 허용" 으로 정확히 갱신됨. 실제 동작(400 거부)과 일치.
- Swagger `type: WorkflowSettingsDto` 로 nested DTO 참조 전환 — `@nestjs/swagger` 가 `@ApiExtraModels` 없이도 클래스 참조 시 자동으로 컴포넌트 스키마를 생성하는 표준 패턴과 일치, opaque `additionalProperties:true` 보다 Swagger UI 상 훨씬 정확한 계약 노출.
- spec 정합성: `spec/5-system/4-execution-engine.md §8` 표가 이미 `Workflow.settings.maxConcurrentExecutions`(Editor+, `PATCH /api/workflows/:id`, 기본값 3)를 명시하고 있어, 이번 DTO 변경은 **기존 spec 문서화 내용을 코드가 뒤늦게 따라잡은 것**(spec 변경 불필요) — consistency-check(`cross_spec`, `rationale_continuity`) 판정과 직접 코드/spec 대조 모두 이를 뒷받침.
- 서비스 계층(`workflows.service.ts#update`) 의 spread-merge 인라인 주석: "settings 는 전체 교체 대신 병합 — DB 잔여 키를 보존한다(workspace updateWorkspaceSettings 의 spread-merge 대칭)" — 변경된 로직과 정확히 일치, 이유(왜 spread-merge 인지)까지 설명해 복잡 로직에 대한 인라인 주석 기준을 충족.
- 테스트 파일(`workflow-dto-validation.spec.ts`, `workflows.service.spec.ts`, `workflow-crud.e2e-spec.ts`)의 describe/it 제목에 `§8`, "workspace 대칭" 등 spec 참조가 일관되게 포함 — 테스트 자체가 문서 역할을 겸함.
- README 업데이트 필요성: 없음 — `codebase/backend/README.md` 는 API 필드 레벨 세부사항을 다루지 않는 수준이며, 이번 변경은 Swagger(자동 생성 API 문서)로 충분히 커버됨.
- 예제 코드: `@ApiPropertyOptional({ example: 3, ... })` 로 Swagger 예제가 갱신되어 있어 별도 사용 예제 문서 불필요.
- 신규 환경변수 없음 — 설정 문서화 항목 해당 없음.

## 요약

이번 변경(`WorkflowSettingsDto` 신설 + `UpdateWorkflowDto.settings` swagger/JSDoc 갱신)은 문서화 품질이 전반적으로 높다. 신규 DTO 의 JSDoc 은 검증 규칙·spec 근거(§8)·인접 개념과의 스코프 구분까지 상세히 담았고, Swagger 타입도 opaque object 에서 구체 스키마로 정확히 갱신되었으며, spec §8 은 이미 이 계약(`Workflow.settings.maxConcurrentExecutions`, Editor+, 기본 3)을 문서화하고 있어 별도 spec 수정이 필요 없다(consistency-check 5/5 BLOCK:NO 와 직접 검증 결과 일치). 유일한 갭은 이 변경이 `settings` 필드에 대해 이전에 조용히 수용되던 미지 키를 이제 400 으로 거부하는 API 계약 narrowing 이라는 점을 CHANGELOG.md 에 남기지 않은 것 — 리포의 기존 관례(유사 validation-hardening 변경들을 CHANGELOG 에 기록)에 비춰 볼 때 기록하는 편이 일관적이다. 다만 이는 실질 영향이 낮다고 이미 근거를 확보한 low-severity 갭이라 INFO 등급이 적절하다.

## 위험도

LOW

STATUS: SUCCESS
