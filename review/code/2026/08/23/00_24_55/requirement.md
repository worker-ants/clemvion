# 요구사항(Requirement) Review — `execute-body-dto` (2차 라운드, `00_07_27` 이후)

## 검증 방법
정적 리딩 외에 실제로 실행해 사실관계를 재검증했다:
- `npx jest src/modules/workflows/workflows-execute-body.spec.ts` — **9/9 GREEN**(캐너리 2 + 패스스루 1 + 대조군 3 + 신규 OpenAPI 노출 가드 3).
- `npx tsc --noEmit -p .`(backend) — 변경 3파일(`execute-workflow.dto.ts`, `workflows-execute-body.spec.ts`, `workflows.controller.ts`) 관련 에러 0건.
- `codebase/backend/src/modules/workflows/workflows.controller.ts` 의 `execute()` 본문(게이트 276-353)을 직접 열어 `rawValues = body?.parameterValues ?? (body?.input?.parameters) ?? {}` → `resolveTriggerParametersRejectingMasked()` **단일 호출** 구조를 확인 — DTO docstring·`input` 필드 description 의 "두 필드 모두 같은 관문" 주장과 line-level 일치.
- `spec/5-system/14-external-interaction-api.md` §R17(라인 1580)을 직접 대조 — "`POST /workflows/:id/execute` 의 파라미터"(필드 구분 없음)가 `400 MASKED_VALUE_RESUBMITTED` 거부 대상이라는 원문과 DTO 의 두 필드 description 이 정확히 일치.
- `spec/conventions/swagger.md §3`(라인 254-270, 406-429)의 "요청 값이 정책으로 거부될 수 있는 필드" 예외 클래스를 대조 — `parameterValues`/`input` 모두 이 예외에 해당하고, "요약 1~2문장 + SoT 링크" 요구도 대체로 충족(세부는 발견사항 INFO 참고).
- `codebase/backend/src/modules/executions/dto/re-run.dto.ts` 를 직접 열어 마커 거부 문구가 그대로 재사용됐는지 확인 — 일치(리터럴 재기술 없음, `egress-masking.md` 라인 34 의 "마커 리터럴을 다시 적지 않는다" 규율 준수).
- `plan/in-progress/execute-body-openapi.md` 부재·`plan/complete/execute-body-openapi.md` 존재를 `ls` 로 확인 — plan 이동이 실제로 완료됨(WARNING #2 `00_07_27` 반영 확인).

## 1차 라운드(`00_07_27`) 발견사항 재검증 — 전부 반영 확인

- **W1(`input` description 마커 거부 규칙 누락)** — `execute-workflow.dto.ts:53-54` 의 `input` description 에 `'그 값도 동일한 마커 거부 대상.'` 이 추가됐고, 클래스/필드 JSDoc(게이트 46-49)에 "왜 두 필드가 같은 규칙을 지는지"(합류 후 단일 호출)까지 명시됨. **반영 확인.**
- **W2(plan 체크리스트 stale)** — `plan/complete/execute-body-openapi.md` 로 이동, `## 작업` 체크리스트 6항목 전부 `[x]`. **반영 확인.**
- **W3(OpenAPI 노출 자체를 검증하는 테스트 부재)** — `workflows-execute-body.spec.ts` 에 `describe('POST /workflows/:id/execute OpenAPI 노출', ...)` 블록 신설. (a) 실 컨트롤러 `swagger/apiParameters` 의 body 파라미터가 `ExecuteWorkflowDto` 를 가리키는지, (b) `required: false`, (c) `SwaggerModule.createDocument()` 렌더링 스키마의 두 필드가 `additionalProperties: true`, (d) 두 필드 description 에 마커 규칙 언급 — 4단언 신설. `@ApiBody({ type: ExecuteNodeDto })` 로 바꾸는 뮤턴트를 직접 넣어 이 가드만 RED 로 떨어지는지 실측했다고 RESOLUTION.md 가 주장하며, 현재 GREEN 상태의 9개 테스트 구성과 일치. **반영 확인.**

## 발견사항

- **[INFO]** `input` 필드 description 에 `parameterValues` 와 달리 명시적 `SoT: EIA §R17` 포인터가 없다
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:52-54` (`input` 필드 `description`) vs `:32-35`(`parameterValues` 필드, `'SoT: EIA §R17.'` 포함)
  - 상세: `swagger.md §3` 예외 규약은 "요약 1~2문장 + SoT 링크"를 요구한다. `parameterValues` 는 이를 정확히 따르지만 `input` 은 `'그 값도 동일한 마커 거부 대상.'` 까지만 적고 SoT 링크가 없다. Swagger 문서만 보는 외부 소비자가 두 필드를 독립적으로 열람할 경우(예: `input` 스키마만 스크롤) "동일한 마커 거부 대상"이라는 서술은 있지만 그 근거(EIA §R17)를 찾을 링크가 그 필드 자체에는 없다 — 같은 클래스의 `parameterValues` description 을 함께 봐야 알 수 있다. 기능 결함은 아니고(런타임 무관), 클래스 docstring 은 이미 `00_07_27 requirement W1` 을 인용해 근거를 설명하지만 이는 Swagger 렌더링에는 노출되지 않는 소스 코드 주석이다.
  - 제안: 필수 아님(1차 라운드에서 이미 검토·반영된 사안이라 재차 WARNING 으로 올리지 않음). 원한다면 `input` description 끝에 `(SoT: EIA §R17)` 짧게 추가.

- **[INFO]** `{@link WorkflowsController.execute}`, `{@link ExecuteNodeDto.input}` JSDoc 참조 대상이 파일에 import 되지 않음 — `00_07_27 documentation` 라운드에서 이미 지적·처분(런타임/Swagger 출력 무영향, 순수 스타일 nit)된 사안으로 이번 라운드에서 재확인만 함, 변경 없음
  - 위치: `execute-workflow.dto.ts:8`, `:42`

## 긍정 확인 사항

- 핵심 설계 판단(파라미터 타입을 DTO 로 승격하지 않고 `@ApiBody` 전용으로만 문서화)의 두 갈래 실측 근거(데코레이터 없이 승격 시 전체 거부 / 데코레이터 추가 시 여분 키 거부)는 `CustomValidationPipe.toValidate()` 소스와 직접 대조해 정확함을 재확인.
- `execute()` 컨트롤러의 `rawValues` 합류 로직(게이트 306-311) + `resolveTriggerParametersRejectingMasked` 단일 호출(게이트 323)이 DTO 의 "두 필드 모두 거부 대상" 주장과 line-level 로 정확히 일치.
- `spec/5-system/14-external-interaction-api.md` §R17 원문과 DTO description 이 일치, `swagger.md §3` 예외 적용도 정당.
- 신설 OpenAPI 노출 가드(9개 테스트 중 4개)가 형제 DTO 오참조 같은 복붙 실수를 실제로 잡을 수 있는 구조로 설계됐고, `npx jest` 로 9/9 GREEN 재확인.
- `plan/complete/execute-body-openapi.md` 체크리스트가 실제 diff 산출물과 전부 일치, `spec-sync-external-interaction-api-gaps.md` 의 해당 트래커 항목도 `[x]` 로 정확히 flip 되고 "여분 키 거부 여부"(별개 결정) 신규 항목이 등재됨 — 스코프 경계가 명확.
- `tsc --noEmit` 클린, 변경 파일 관련 컴파일 에러 0건.

## 요약
`00_07_27` 라운드에서 지적된 3건의 WARNING(마커 거부 규칙 필드 비대칭 서술 누락·plan 체크리스트 stale·OpenAPI 노출 자체를 검증하는 테스트 부재)이 이번 diff 에서 코드·문서·테스트 3곳 모두 실측 가능한 형태로 반영됐음을 직접 실행(jest 9/9 GREEN, tsc 클린)과 소스 대조로 확인했다. `POST /workflows/:id/execute` 의 실제 파라미터 합류·마스킹 거부 로직(컨트롤러 게이트 306-323)과 신설 `ExecuteWorkflowDto` 의 두 필드 OpenAPI description 이 `spec/5-system/14-external-interaction-api.md §R17` 원문과 line-level 로 정확히 일치하며, `spec/conventions/swagger.md §3` 의 정책 캐비엇 예외도 정당하게 적용됐다. 런타임 계약 무변경 주장은 `@Body()` 파라미터 타입 불변 + `CustomValidationPipe` skip 경로 실측으로 뒷받침된다. 남은 항목은 `input` 필드에 `parameterValues` 와 같은 명시적 SoT 링크가 빠진 것 정도의 INFO 수준 비대칭뿐이며 기능·계약에는 영향이 없다. CRITICAL·WARNING 없음.

## 위험도
NONE
