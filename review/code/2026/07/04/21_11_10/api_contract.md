# API 계약(API Contract) 리뷰

## 리뷰 대상

- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` — `settings` 를 opaque `Record<string, unknown>` → strict nested `WorkflowSettingsDto` 로 축소
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` (신규) — `maxConcurrentExecutions?: number` (`@IsInt @Min(1)`) 단일 필드
- `codebase/backend/src/modules/workflows/workflows.service.ts` — `update()` 에서 `settings` 만 분리해 spread-merge (`{ ...(workflow.settings ?? {}), ...settings }`), 나머지 필드는 기존 `Object.assign`
- 테스트: `workflow-dto-validation.spec.ts`, `workflows.service.spec.ts`, `workflow-crud.e2e-spec.ts` (B2 케이스)
- `plan/in-progress/workflow-cap-validated-dto.md`

## 핵심 질문 — CONTRACT NARROWING 이 우려할 breaking change 인가

**결론: 아니다.** 근거를 코드베이스에서 직접 재검증했다(payload 의 evidence 를 신뢰하지 않고 독립 확인):

1. **backend 소비자 단일성** — `grep -rn "maxConcurrentExecutions" codebase/backend/src` 결과 실제 *읽기* 소비자는 `execution-limits.ts` (`resolveConcurrencyCap`) 단 하나. 그 외 매치는 DTO/스펙 정의·테스트뿐. `timeoutMs`/`retryCount` 같은 과거 예시 키를 읽는 코드는 backend 어디에도 없음 — 즉 이번 화이트리스트화로 "몰래 쓰이던 키"가 400 으로 막히는 시나리오는 실증적으로 없다.
2. **frontend 유일 호출부 확인** — `grep -rn "workflowsApi.update"` → `codebase/frontend/src/app/(main)/workflows/page.tsx:229` 단 한 곳, payload `{ isActive: !isActive }` 만 전송. `settings` 를 payload 에 넣는 frontend 코드는 전체 `codebase/frontend/src` grep 으로 0건 확인(에디터 settings-panel 등은 노드 `config` 이지 workflow-level `settings` 아님). 즉 기존 클라이언트(자체 SPA) 는 이번 축소로 영향받는 요청을 보내지 않는다.
3. **spec 정합** — `spec/1-data-model.md §2.4` 가 이미 `Workflow.settings` 스코프를 `maxConcurrentExecutions` 로 한정. 신규 DTO 는 문서화된 계약을 코드로 강제할 뿐 새 제약을 발명하지 않음.
4. **대칭 선례** — `UpdateWorkspaceSettingsDto` 가 이미 같은 전역 `CustomValidationPipe`(`whitelist:true, forbidNonWhitelisted:true`) 아래 strict nested DTO 로 운용 중 (`interactionAllowedOrigins` 필수 + `maxConcurrentExecutions` 옵션). 이번 변경은 workflow 레벨을 그 기존 정책과 맞추는 것.
5. **외부 API 소비자 없음** — 이 엔드포인트는 내부 SPA 전용(`@Roles('editor')`, 세션 인증)이며, `spec/conventions/*-api-catalog/` 는 outbound 3rd-party 연동(cafe24/makeshop) 카탈로그로 이 엔드포인트와 무관. `spec/conventions/error-codes.md` 의 "breaking change" 기준은 에러 코드 rename 에 한정되며 이번 변경엔 해당 없음. 공개 versioned API 계약이 아니므로 semver/버전 관리 이슈 자체가 발생하지 않는다.
6. **행동상 완전 무해가 아님 — 이론적 갭 인지 필요**: 만약 어떤 외부 자동화(임의 HTTP 클라이언트가 이 API 를 직접 호출)가 `settings.timeoutMs` 같은 미지 키를 이미 보내고 있었다면, 과거엔 조용히 저장(후 무시)됐지만 이제는 400 이 된다. 이는 "backend 코드가 소비하지 않는다"는 근거로는 완전히 배제할 수 없는 이론적 external-caller 리스크다. 다만 이 프로젝트의 API 는 사내 SPA 전용으로 문서화돼 있고 실제 evidence(코드 grep) 상 그런 호출자가 없으므로 실무 리스크는 낮다.

## 응답 형식 (Response DTO)

- 이번 diff 에 컨트롤러(`workflows.controller.ts`)나 응답 DTO(`WorkflowDto`, `ApiOkWrappedResponse`) 변경 없음 — payload 에 포함된 diff 상 컨트롤러 파일 자체가 대상에 없음. 응답 스키마는 그대로.
- e2e B2 케이스가 `GET` 응답의 `data.settings.maxConcurrentExecutions` 를 직접 검증 — 응답 바디에 저장된 값이 그대로 노출됨을 확인, 응답 계약 변화 없음.

## 하위 호환 — 기존 저장 데이터 (stored settings)

- `workflows.service.ts` 의 `update()` 는 `Object.assign(workflow, rest)` 로 나머지 필드는 그대로 두고, `settings` 만 별도 분기해 `workflow.settings = { ...(workflow.settings ?? {}), ...settings }` 로 **병합**(spread-merge)한다. 이는 DTO 검증을 통과한 요청 바디의 변경 대상 키만 병합하고 기존 DB 에 이미 저장된 임의의 잔여 키(과거에 저장됐을 수 있는 `timeoutMs` 등)는 보존한다. 즉 **읽기 경로(`GET`, `duplicate`, `exportWorkflow`)는 기존 저장값 그대로 반환** — DTO 축소가 기존 저장 데이터를 파괴하거나 잘라내지 않는다. `workflows.service.spec.ts` 의 3개 신규 테스트(병합/미변경/초기화)가 이를 커버.
- 단, "축소된 계약을 통해서는" 더 이상 새로 `timeoutMs` 등을 쓸 수 없다는 점은 명확한 write-side 제약이다. read-side·기존 데이터에는 영향 없음.

## 에러 응답

- 전역 `CustomValidationPipe`(`codebase/backend/src/common/pipes/validation.pipe.ts`)가 이미 `ValidateNested` 트리를 재귀적으로 평탄화(`flattenErrors`)해 `nodes[3].type` 같은 경로를 만드는 기존 메커니즘을 갖고 있음 — `settings.maxConcurrentExecutions` 형태의 nested path 도 동일 패턴으로 `{ code: 'VALIDATION_ERROR', message, details }` 형식에 자연스럽게 편입된다. 신규 에러 포맷 불일치 없음. HTTP 400 유지, 기존 `@ApiBadRequestResponse` swagger 문서와도 일치.

## 요청 검증

- `maxConcurrentExecutions`: `@IsOptional @IsInt @Min(1)` — 0/음수/소수/문자열 전부 거부. 단위 테스트(`workflow-dto-validation.spec.ts`)가 `it.each([0, -1, 1.5])` 로 커버, e2e 도 `0` 케이스 확인. 검증 자체는 충분.
- 미지 키(`bogusKey`) 거부는 전역 pipe 옵션(`whitelist + forbidNonWhitelisted`)에 의한 것이며 DTO 자체의 명시적 옵션이 아님 — 이 전역 설정이 바뀌면 이 DTO 의 동작도 암묵적으로 바뀐다는 결합이 있으나, 이는 기존 프로젝트 전반의 정책이고 이번 변경이 새로 도입한 결합은 아니다.

## URL/경로, 페이지네이션, 인증/인가

- URL/메서드(`PATCH /api/workflows/:id`) 변경 없음. 페이지네이션 대상 아님(단일 리소스 PATCH). `@Roles('editor')` 가드 diff 에 변경 없음 — 인가 수준 그대로.

## 잔여 갭 (별건, 이번 diff 범위 밖)

- `plan/in-progress/workflow-cap-validated-dto.md` 자체가 명시한 후속 항목: `ImportWorkflowDto.settings` 는 여전히 opaque `Record` — 같은 `Workflow.settings` JSONB 컬럼에 대해 **import(비검증) vs patch(strict 검증) 비대칭**이 남는다. 이번 PR 의 계약 축소 자체와는 무관하지만, 동일 컬럼에 서로 다른 강도의 쓰기 경로가 공존한다는 점은 API 계약 일관성 관점에서 낮은 우선순위 INFO 로 기록해 둘 가치가 있다(plan 문서가 이미 인지·defer 처리함).

## 발견사항

- **[INFO]** `ImportWorkflowDto.settings` 와 `UpdateWorkflowDto.settings` 검증 강도 비대칭 잔존
  - 위치: `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts` (이번 diff 범위 밖, 미변경)
  - 상세: 같은 `Workflow.settings` JSONB 대상인데 import 경로는 opaque, patch 경로는 strict nested DTO. plan 문서가 이미 별도 후속 항목으로 인지·defer.
  - 제안: 별도 plan/PR 에서 `ImportWorkflowDto.settings` 도 `WorkflowSettingsDto` 로 통일 검토(이번 PR 에 포함할 필요는 없음).

- **[INFO]** 이론적 external-caller 리스크 (실무 영향 낮음)
  - 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`
  - 상세: 사내 SPA 외의 임의 HTTP 클라이언트가 과거에 `settings.<미지키>` 를 이미 전송하고 있었다면 이번 화이트리스트화로 400 회귀가 발생할 수 있다. 코드 grep 근거상 그런 호출자는 현재 존재하지 않으나, 완전한 부재를 코드로 증명할 수는 없는 성격의 리스크다.
  - 제안: 별도 조치 불필요 — 사내 전용 API 라는 전제하에 현재 근거로 충분. 향후 외부 연동 API 로 노출될 경우 재검토.

이 외 CRITICAL/WARNING 급 발견 없음.

## 요약

`PATCH /api/workflows/:id` 의 `settings` 필드를 opaque 객체에서 strict nested `WorkflowSettingsDto`(`maxConcurrentExecutions` 단일 필드, 전역 whitelist+forbidNonWhitelisted 로 미지 키 400)로 좁힌 변경은, 실제 backend 소비자가 `maxConcurrentExecutions` 단 하나이고 frontend 유일 호출부가 `settings` 를 전혀 전송하지 않으며 spec §2.4 가 이미 이 스코프를 문서화하고 있다는 점(모두 코드베이스에서 직접 재확인)을 근거로 실질적 breaking change 로 보지 않는다. 서비스 계층의 spread-merge 는 기존 DB 에 저장된 잔여 키를 보존해 read-side 하위 호환도 유지하며, 응답 DTO·URL·인가·페이지네이션은 변경이 없고 에러 응답도 기존 전역 파이프의 nested-path 평탄화 패턴에 자연스럽게 편입된다. 유일한 잔여 사항은 이미 plan 문서가 인지하고 있는 `ImportWorkflowDto.settings` 와의 강도 비대칭(별건, INFO)과 이론적 external-caller 리스크(현재 근거상 낮음)뿐이다.

## 위험도

LOW

STATUS: SUCCESS
