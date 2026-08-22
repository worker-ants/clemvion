# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `POST /workflows/:id/execute` 본문은 이번 변경 이후에도 실질 검증을 받지 않는다 (선존 상태, 이번 PR 이 만든 갭 아님)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `execute()` 의 `@Body() body?: { input?; parameterValues? }` (인라인 타입 유지 지점)
  - 상세: `@ApiBody({ type: ExecuteWorkflowDto, required: false })` 는 Swagger 문서 생성에만 관여하고, 실제 `@Body()` 파라미터는 인라인 객체 타입(`metatype === Object`)이라 전역 `CustomValidationPipe.toValidate()` 가 검증을 통째로 skip 한다. 즉 여분 top-level 키가 여전히 조용히 통과한다. 이 PR 은 그 사실을 바꾸지 않았고(`workflows-execute-body.spec.ts` 캐너리로 실측 고정), 공개 문서화로 이 갭의 외부 발견 가능성만 높아졌다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 "여분 키를 400 으로 거부할 것인가"가 별도 결정 항목으로 명시 이연돼 있어 스코프 이탈은 아니다.
  - 제안: 조치 불요(트래커 항목이 이미 이 결정을 소유). 향후 그 항목을 집행할 때 이번 DTO 에 `class-validator` 데코레이터를 다는 작업이 뒤따라야 한다는 점만 재확인.

- **[INFO]** `ExecuteWorkflowDto.input` 설명 길이가 `spec/conventions/swagger.md §3` 기본 권장(10~40자)을 초과
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` — `input` 필드 `@ApiPropertyOptional({ description: ... })`
  - 상세: W1 반영(마커 거부 규칙 명시)으로 길이가 더 늘었으나, `swagger.md` 가 2026-08-22 에 넓힌 "요청값 정책 거부 캐비엇" 예외 클래스에 정확히 해당해 컨벤션 위반은 아니다.
  - 제안: 조치 불요.

- **[INFO]** `ExecuteWorkflowDto.input` 과 `ExecuteNodeDto.input` 이 같은 컨트롤러의 OpenAPI 표면에서 동일 필드명·다른 형태로 병존
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` — `input` 필드 JSDoc(이미 `{@link ExecuteNodeDto.input}` 상호 참조로 구분 명시)
  - 상세: 하나는 `parameters` 를 담는 레거시 봉투이고 다른 하나는 노드 입력 값 자체다. JSDoc 이 이미 차이를 명시하고, 신규 가드 테스트(`[가드] 실 컨트롤러의 @ApiBody 가 ExecuteWorkflowDto 를 참조한다`)가 형제 DTO 오참조(복붙 실수) 회귀를 실측으로 막는다.
  - 제안: 조치 불요.

## 검증한 내용 (문제 없음으로 확인)

- **하위 호환성**: 런타임 무변경. `WorkflowsController.execute` 의 `@Body()` 파라미터는 여전히 인라인 객체 타입(`body?: { input?; parameterValues? }`)이며, `ExecuteWorkflowDto` 는 `codebase/backend/src/modules/workflows/{workflows.controller.ts, workflows-execute-body.spec.ts, dto/execute-workflow.dto.ts}` 3곳에서만 참조되고 다른 소비처가 없음을 `grep` 으로 직접 확인했다. `workflows-execute-body.spec.ts` 가 `design:paramtypes` 메타데이터로 `@Body()` emit 타입이 여전히 `Object`(≠`ExecuteWorkflowDto`)임을, `CustomValidationPipe` 를 통해 여분 top-level 키(`legacyClientField`)를 실은 본문이 그대로 통과함을 직접 실행 검증한다. 대조군(`it.each`)이 같은 파이프가 `metatype: ExecuteWorkflowDto` 일 때는 정상/여분키/빈객체 모두 거부됨을 보여 "타입을 바꾸면 계약이 좁아진다"는 주장을 실측으로 뒷받침한다.
- **응답 형식/에러 응답**: 응답 DTO(`ExecuteAcceptedDto`) 무변경. `MASKED_VALUE_RESUBMITTED` 는 `TriggerParameterErrorDetail.code`(`error.details[].code`)로 실제 코드(`trigger-parameter.types.ts:32,69`)와 일치 확인했고, 형제 `re-run.dto.ts` 의 기존 문구를 그대로 재사용해 SoT 를 분산시키지 않는다.
- **요청 검증(스키마 정확성)**: 두 필드 모두 `type: 'object', additionalProperties: true` 로 선언돼 있어 실제 런타임 관용(전역 검증 skip, 임의 키 허용)과 정확히 일치한다 — 스키마가 실제보다 엄격해 보이도록 오도하지 않는다. `type: Object` 축약형(저장소 잔여 2곳 중 하나였던 패턴) 대신 다수 패턴을 따랐다.
- **URL/경로 설계, 페이지네이션**: 변경 없음(라우트·HTTP 메서드 불변, 목록 API 아님).
- **인증/인가**: `@Roles('editor')` 유지, 변경 없음.
- **버전 관리**: 별도 API 버전 스킴이 없는 저장소이며 breaking change 가 아니므로 해당 없음.
- **문서-런타임 정합성**: `@ApiBody` 가 참조하는 DTO 클래스, `required: false`, 렌더링된 스키마의 `additionalProperties: true`, description 내 마커 거부 문구 4가지 모두를 `SwaggerModule.createDocument()` 기반 테스트로 직접 단언하며, 형제 DTO(`ExecuteNodeDto`) 오참조 뮤턴트를 넣어 그 가드가 단독으로 RED 됨을 실측(1 failed/8 passed)으로 확인했다는 기록(RESOLUTION.md)도 코드와 일치한다.

## 요약

`ExecuteWorkflowDto` 신설과 `@ApiBody` 부착은 OpenAPI 문서 표면만 채우고 런타임 계약(파이프 진입 여부·검증 여부·허용 키 범위)은 전혀 바꾸지 않도록 설계·테스트된 순수 문서화 변경이다. `@Body()` 파라미터의 인라인 타입을 그대로 유지해 `CustomValidationPipe.toValidate()` 의 `Object` 제외 경로를 보존했고, 이를 지키는 캐너리(정상/여분키/대조군) + OpenAPI 노출 가드(스키마 등록·타입 참조·`required:false`·description 내용) 테스트로 향후 회귀를 실측 가능하게 고정했다. 이전 라운드에서 지적된 WARNING(마커 거부 규칙이 `input` 필드에 누락) 은 코드에서 이미 반영되어 있음을 직접 확인했다. "여분 키를 거부할지"는 의도적으로 이 PR 밖 결정으로 트래커에 명시 이연되어 있어 스코프 이탈이 아니다. 잔여 발견사항은 문서 가독성·정보 노출 수준의 INFO 3건뿐이며 전부 조치 불요다.

## 위험도

LOW
