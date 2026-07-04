# Rationale 연속성 검토 — workflow-cap-dto (nested validated DTO for `Workflow.settings.maxConcurrentExecutions`)

> **Payload 참고**: 제공된 `_prompts/rationale_continuity.md` 는 mis-scoped 였다 (`spec/5-system/` 폴더에서 `1-auth.md`·`10-graph-rag.md` 만 포함, 핵심 대상인 `4-execution-engine.md`·`1-data-model.md` 본문은 누락). 이에 따라 지시된 fallback 절차대로 spec 원본(`spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`)과 코드(`codebase/backend/src/modules/workflows/`, `codebase/backend/src/modules/workspaces/`, `codebase/backend/src/common/pipes/validation.pipe.ts`)를 직접 읽어 분석했다.

## 검토 대상 계획

`plan/in-progress/workflow-cap-validated-dto.md` — `UpdateWorkflowDto.settings: Record<string, unknown>` (opaque passthrough) 를 `@ValidateNested @Type(() => WorkflowSettingsDto)` 로 전환. 전역 `CustomValidationPipe`(`whitelist:true, forbidNonWhitelisted:true`)가 nested 레벨까지 강제되어 미지 `settings` 키가 400 이 된다.

## 발견사항

### INFO — Swagger 예시(`{ timeoutMs, retryCount }`)는 `## Rationale` 이 아니라 코드 주석/문서 문자열

- target 위치: `plan/in-progress/workflow-cap-validated-dto.md` §설계 결정 2, 구현 대상 `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts:65-74`
- 과거 결정 출처: 해당 없음 — `UpdateWorkflowDto.settings` 의 `@ApiPropertyOptional({ description: '워크플로우 설정 객체 (실행/UI 관련 임의 속성)', additionalProperties: true, example: { timeoutMs: 30000, retryCount: 3 } })` 는 **Swagger 문서화 목적의 DTO 주석일 뿐**, `spec/1-data-model.md`·`spec/5-system/4-execution-engine.md` 어디에도 대응하는 `## Rationale` 항목이 없다. `spec/1-data-model.md` §2.4 Workflow 는 이미 `settings` 의 "알려진 키" 를 `maxConcurrentExecutions: number?` **단 하나**로 명시하고 있어(line 120), 오히려 코드(opaque `Record<string,unknown>`)가 spec 보다 느슨한 상태였다.
- 상세: "workflow settings 는 임의 속성을 허용해야 한다" 는 명제는 어떤 spec Rationale 에서도 **합의되거나 기각 대안으로 논의된 적이 없다**. `timeoutMs`/`retryCount` 는 실제로 백엔드 어디서도 소비되지 않는 예시 값(plan 자체가 grep 으로 미소비 확인)이며, spec 이 정의한 유일한 키는 `maxConcurrentExecutions` 다. 따라서 이번 narrowing 은 "기각된 대안의 재도입"이나 "합의 원칙 위반"이 아니라, **spec 이 이미 명시한 좁은 계약에 코드(DTO)를 뒤늦게 맞추는 정합화**에 해당한다.
- 제안: `UpdateWorkflowDto` 의 `@ApiPropertyOptional` description/example 을 nested DTO 전환에 맞춰 갱신하고(예시에서 `timeoutMs/retryCount` 제거 또는 "실제 소비되는 키만" 으로 문구 수정), 필요하면 `spec/1-data-model.md` §2.4 Rationale 절에 "settings 는 코드-검증 대칭화(workspace 와 동일)로 나머지 키를 열어두지 않는다" 한 줄을 남겨 향후 재질문을 예방.

### INFO — Workspace 대칭(PR2b) 이 오히려 continuity 를 강화하는 선례

- target 위치: `plan/in-progress/workflow-cap-validated-dto.md` §11, §21-26
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` → "동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b, 2026-07-04)" (line 1528-1537), 코드 `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`
- 상세: PR2b 는 `Workspace.settings.maxConcurrentExecutions` 를 이미 `UpdateWorkspaceSettingsDto`(`@IsOptional @IsInt @Min(1)`, 전용 `PATCH /api/workspaces/:id/settings` 엔드포인트)로 strict validate 하고 있다. 전역 `CustomValidationPipe`(`whitelist:true, forbidNonWhitelisted:true`, `codebase/backend/src/common/pipes/validation.pipe.ts:29-32`)는 이미 앱 전체 기본 정책이다. `Workflow.settings` 만 `@IsObject() Record<string,unknown>` 타입이라 nested 레벨에서 whitelist 가 재귀하지 못해 예외적으로 opaque 상태였을 뿐 — 이는 "Workflow 는 의도적으로 열어둔다"는 설계 원칙이 아니라 **미완결(symmetry gap)** 상태였다. 이번 변경은 그 gap 을 닫아 기존 원칙(전역 strict validation)과 정합시키는 방향이며, Rationale 이 지지하는 결정을 뒤집는 것이 아니다.
- 제안: 없음 (연속성 유지 확인). 완료 후 `spec/5-system/4-execution-engine.md` §8 표 각주 또는 `plan/in-progress/exec-intake-followups.md` 항목 체크 처리로 이 대칭화가 마무리됐음을 남기면 추적성이 좋아진다.

### INFO — spread-merge 정책도 workspace 선례와 일치

- target 위치: `plan/in-progress/workflow-cap-validated-dto.md` §26 ("spread-merge: DB 잔여 키 보존, workspace 대칭")
- 과거 결정 출처: 명시적 Rationale 없음(신규 결정이나 workspace 구현 패턴과 정합)
- 상세: 현재 `workflows.service.update` 는 `Object.assign(workflow, dto)` 로 `settings` 를 **전체 교체(full replace)** 한다. 계획은 `settings` 필드만 `{ ...(workflow.settings ?? {}), ...dto.settings }` spread-merge 로 전환해 DB 잔여 키를 보존한다고 명시한다. 이는 동작 변경(번복)이지만, "미검증 키가 nested DTO 전환으로 400 이 되면 그 키들은 이제 애초에 전송될 수 없다"는 전제하에 **기존 저장된 알 수 없는 키를 실수로 날리지 않기 위한 안전장치**이며 오히려 데이터 보존 방향의 강화다. 다만 어느 spec 문서에도 "full replace vs spread-merge" 를 다루는 Rationale 이 없어, 이 변경 자체가 명시적으로 근거를 남기지 않은 소소한 동작 변경(무근거 번복 소지, WARNING 근접이나 영향이 작아 INFO 로 판단)이다.
- 제안: `spec/1-data-model.md` §2.4 Workflow 행 또는 execution-engine §8 인근에 "settings PATCH 는 spread-merge(부분 갱신), full replace 아님 — workspace 대칭" 한 줄을 추가해 두면, 향후 이 문서를 보는 사람이 "왜 replace 가 아니라 merge인가"를 재질문하지 않는다. 필수는 아니나 권장.

## 요약

이번 계획은 `Workflow.settings.maxConcurrentExecutions` 를 nested validated DTO 로 전환해 미지 키를 400 으로 거부하는 변경이다. 조사 결과 "workflow settings 는 임의 속성을 허용한다"는 명제는 어떤 spec `## Rationale` 에서도 명시적으로 합의되거나 기각 대안으로 논의된 적이 없으며, 오히려 `spec/1-data-model.md` §2.4 는 이미 `maxConcurrentExecutions` 만을 유일한 알려진 키로 규정하고 있어 코드가 spec 보다 뒤처져 있던 상태였다(narrowing 은 spec-code 정합화, "번복"이 아님). 또한 `spec/5-system/4-execution-engine.md §Rationale` 의 PR2b 항목("동시성 cap admission gate")은 `Workspace.settings` 에 이미 동일한 strict validated DTO + 전역 whitelist/forbidNonWhitelisted 파이프를 적용했으므로, 이번 workflow 측 대칭화는 **기존 원칙의 연장**이지 그것을 거스르는 설계가 아니다. 유일하게 문서화가 부족한 지점은 (1) DTO Swagger 주석의 "임의 속성" 문구가 실제 spec 계약보다 느슨하게 남아있는 점, (2) full-replace→spread-merge 전환에 대한 명시적 근거 부재인데, 둘 다 CRITICAL/WARNING 급 충돌이 아니라 문서 정합 보완 수준(INFO)이다.

## 위험도

LOW

BLOCK: NO

STATUS: SUCCESS
