# API 계약(API Contract) Review

## 대상 변경

`POST /api/workflows/import` (`ImportWorkflowDto.settings`) 를 opaque
`@IsObject() Record<string, unknown>` 에서 strict `WorkflowSettingsDto`
(`@ValidateNested + @Type + whitelist/forbidNonWhitelisted`)로 전환. `PATCH
/api/workflows/:id`(`UpdateWorkflowDto.settings`, #805, 이미 merged)와 동일 정책으로
import·patch 간 검증 강도 비대칭을 해소.

## 발견사항

- **[INFO]** 계약 narrowing이지만 실질적 breaking 영향은 낮음
  - 위치: `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts:504-513`,
    `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts`
  - 상세: `settings` 미지 키·비양수/비정수 `maxConcurrentExecutions` 를 보내는 import 요청은
    이제 `400`(전역 `whitelist+forbidNonWhitelisted` pipe)을 받는다. 이는 형식적으로
    **contract narrowing**(이전에 허용되던 입력 shape 의 부분집합만 이제 허용)이라
    엄밀히는 breaking change 후보다. 다만:
    1. 소비 키는 `maxConcurrentExecutions` 하나뿐(코드베이스 전체에서 `Workflow.settings`
       를 읽는 지점이 이 한 필드로 스코프됨, `spec/1-data-model.md §2.4` 로 명문화)이라
       "미지 키"가 실제 기능을 가진 사례가 없다.
    2. export 가 post-#805(PATCH strict화) 이후 생성되는 `settings` 를 그대로 emit 하므로,
       정상적인 export→import round-trip 경로에서는 애초에 미지 키가 실릴 수 없다(round-trip
       safe, e2e G 로 커버: `codebase/backend/test/workflow-crud.e2e-spec.ts` L1407-1444).
    3. 이미 병합된 `UpdateWorkflowDto.settings`(#805) narrowing 과 정책·스코프가 완전히
       동일해 "새로운 종류의 리스크"가 아니라 기존에 승인된 결정의 대칭 적용이다.
    4. 외부에서 손으로 만든 import payload(수동 편집 JSON, 타 도구 생성물)에 우연히
       `settings.someRandomKey` 가 들어 있었다면 이전엔 조용히 무시되던 것이 이제 400 이
       된다 — 이 경로만이 실질적 이론적 영향 범위이며, hard-fail 정책은 changelog 에
       "admission-gate 정합을 위해 hard-fail" 로 의도적 선택이라 명시됨.
  - 제안: 현재 처리(CHANGELOG breaking 섹션이 아닌 "변경 사항"으로 기재)로 충분해 보이나,
    엄밀성을 원하면 `## Unreleased` breaking-changes 서브섹션에도 한 줄 cross-reference를
    추가해 다른 breaking 항목들과 동일한 곳에서 검색 가능하게 하는 것을 고려. (선택 사항,
    현재도 "변경 사항" 섹션에 영향 범위가 상세히 서술되어 있어 필수는 아님)

- **[INFO]** 응답 스키마/버전 관리에는 영향 없음 확인
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` (`importWorkflow`,
    `@ApiCreatedWrappedResponse(WorkflowDto, ...)`)
  - 상세: 응답 DTO(`WorkflowDto`)는 변경되지 않았고, 기존 `@ApiBadRequestResponse` 문서화가
    이미 있어 신규 400 사유가 기존 문서화된 status contract 범위 안에 들어간다. API 버전
    prefix(`/api/...`)는 별도 버전관리 체계가 없는 기존 컨벤션과 일관.

- **[INFO]** Swagger 스키마 정합
  - 위치: `import-workflow.dto.ts` L316-323
  - 상세: `@ApiPropertyOptional({ type: 'object', additionalProperties: true })` →
    `{ type: () => WorkflowSettingsDto, description: ... }` 로 교체되어, 생성되는 OpenAPI
    스키마가 실제 검증 로직(nested strict object, `maxConcurrentExecutions: integer, min 1`)과
    일치하게 됐다. 이전 스키마(`additionalProperties: true`)는 실제로는 이제 틀린 문서였을
    것이므로 이번 변경이 문서-동작 간극도 함께 닫는다.

- **[INFO]** 테스트 커버리지 확인
  - 위치: `workflow-dto-validation.spec.ts` L562-627(신규 `ImportWorkflowDto.settings` 스위트,
    `UpdateWorkflowDto` 대칭 스위트와 동일 케이스 — 양의 정수/경계값 1/빈 객체/누락/0·음수·소수/
    비숫자/미지 키), `workflows.service.spec.ts` L802-996(영속 + 기본값 `{}`), e2e
    `workflow-crud.e2e-spec.ts` G 케이스(patch→export→import round-trip 200 + 미지키 400).
    단위·서비스·e2e 3계층이 정합적으로 커버되어 회귀 리스크가 낮다.

## 요약

`POST /api/workflows/import` 의 `settings` 필드를 opaque object 에서 strict
`WorkflowSettingsDto` 로 좁히는 변경은, 형식적으로는 API 계약 narrowing(이전에 허용되던
미지 키·잘못된 타입의 `maxConcurrentExecutions` 가 이제 `400`)이지만 실질 위험은 낮다.
근거: (1) 소비 키가 `maxConcurrentExecutions` 하나로 스펙에 명문 스코프되어 있어 "버려지는
미지 키"에 실제 의미가 없었고, (2) export 가 이미 strict-write(#805, PATCH) 이후의 `settings`
를 그대로 emit 하므로 정상 export→import round-trip 은 애초에 영향받지 않으며 e2e 로 검증됨,
(3) 이미 병합되어 승인된 `UpdateWorkflowDto` 의 동일 narrowing(#805)과 완전히 대칭적인 후속
적용이라 신규 정책 리스크가 아니라 기존 결정의 일관 적용이다. 응답 DTO·HTTP 상태 코드 문서화·
Swagger 스키마는 모두 실제 동작과 일치하도록 갱신되었고, 단위/서비스/e2e 테스트가 경계값·
미지 키 거부·round-trip 영속을 모두 커버한다. CHANGELOG 도 영향 범위(누가 400 을 새로 받는지)를
구체적으로 명시해 하위 호환성 논의를 회피하지 않고 정면으로 다뤘다.

## 위험도

LOW

STATUS: SUCCESS
