# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `ExecuteWorkflowDto.input` 필드 설명 길이가 컨벤션 가이드를 초과
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:48` (`input` 필드 `description`)
  - 상세: `'레거시 봉투. \`parameterValues\` 미지정 시 \`input.parameters\` 사용'` 은 86자로 `spec/conventions/swagger.md §3` 의 기본 권장 길이(10~40자)를 넘는다. `swagger.md` 자신이 이미 40자 초과 사례가 저장소 전반에 34% 있음을 인정하고 있어 강한 위반은 아니고, 내용도 fallback 규칙을 정확히 서술한다.
  - 제안: 필수 아님. 원한다면 요약 1줄로 줄이고 상세 fallback 순서는 별도 spec 링크로 위임.

- **[INFO]** `ExecuteWorkflowDto.input` 과 `ExecuteNodeDto.input` 이 같은 컨트롤러의 OpenAPI 표면에서 동일 필드명·다른 의미(형태)로 병존
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:41-52` (JSDoc 이 이미 이 차이를 명시) vs `ExecuteNodeDto.input` (같은 디렉토리)
  - 상세: 하나는 `parameters` 를 담는 레거시 봉투이고 다른 하나는 노드 입력 값 자체다. 각 `description` 이 형태 차이를 이미 문서화하고 있어 실사용 혼선 위험은 낮다.
  - 제안: 선택 사항 — `ExecuteWorkflowDto.input` 의 `description` 앞에 "(ExecuteNodeDto.input 과 무관·형태 다름)" 같은 상호 참조를 추가할 수 있으나 필수는 아니다.

## 검증한 내용 (문제 없음으로 확인)

- **하위 호환성**: 이 PR 은 런타임을 전혀 바꾸지 않는다. `WorkflowsController.execute` 의 `@Body()` 파라미터는 여전히 인라인 객체 타입(`body?: { input?; parameterValues? }`)이고, `@ApiBody({ type: ExecuteWorkflowDto, required: false })` 는 Swagger 문서 생성에만 관여하는 데코레이터라 NestJS 파이프 진입에 영향을 주지 않는다. 신설된 `workflows-execute-body.spec.ts` 가 `Reflect.getMetadata('design:paramtypes', …)` 로 `@Body()` 자리의 emit 타입이 여전히 `Object`(≠ `ExecuteWorkflowDto`)임을 직접 단언하고, `CustomValidationPipe`(`codebase/backend/src/common/pipes/validation.pipe.ts:76-80`, `toValidate()` 가 `Object` 를 제외 목록에 둠 — 코드 직접 확인함)를 통해 여분 top-level 키(`legacyClientField`)를 실은 본문이 여전히 그대로 통과함을 검증한다. 로컬에서 `workflows-execute-body.spec.ts`(5건) · `workflows.controller.spec.ts`(28건) 전부 GREEN, `tsc --noEmit` 클린으로 재확인했다.
  - 대조군 테스트가 `ExecuteWorkflowDto` 를 실제 `@Body()` 타입으로 바꾸는 뮤턴트를 흉내 내(`metatype: ExecuteWorkflowDto` 직접 지정) 그 경우 빈 객체조차 `VALIDATION_ERROR` 로 거부됨을 보여, "문서화 → 계약 축소" 전환점이 실측 근거로 뒷받침돼 있다.
  - "요청 검증이 사실상 비활성 상태"라는 사실 자체는 이 PR 이 만든 게 아니라 기존 상태를 명시적으로 문서화·캐너리로 고정한 것이며, "여분 키를 400 으로 거부할 것인가"는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 별도 결정 항목으로 명시적으로 이연되어 있다(제품 판단 필요 항목으로 적절히 분리).
- **에러 응답**: 신규 `@ApiResponse(503)` 문서는 없고, `parameterValues` description 의 `MASKED_VALUE_RESUBMITTED` 표기는 실제 코드(`trigger-parameter.types.ts:32,69`)와 일치하며 형제 `re-run.dto.ts` 의 동일 문구를 그대로 재사용해 SoT 를 분산시키지 않는다(egress-masking.md §3 링크 방식 준수).
- **요청 검증(스키마 정확성)**: `type: 'object', additionalProperties: true` 로 선언된 두 필드는 `Record<string, unknown>` 실제 런타임 관용(전역 검증 skip)과 정확히 일치한다 — 스키마가 실제보다 더 엄격해 보이도록 오도하지 않는다. 저장소 컨벤션 위반(`type: Object` 축약형) 우려가 이전 라운드 consistency check 에서 WARNING 으로 나왔었으나, 현재 커밋된 파일은 이미 다수 패턴(`{ type: 'object', additionalProperties: true }`)으로 수정되어 있음을 직접 확인했다 — 잔여 이슈 아님(선존 `re-run.dto.ts` 만 별도 트래커 항목으로 남음, 이번 diff 범위 밖).
- **URL/경로 설계, 페이지네이션**: 변경 없음(엔드포인트·라우트 불변).
- **인증/인가**: `@Roles('editor')`, `@ApiBearerAuth`, `@CurrentUser`/`@WorkspaceId` 가드 전부 유지, 변경 없음.
- **버전 관리**: 별도 API 버전 개념이 없는 저장소(swagger 문서만 관리)이며 breaking change 가 아니므로 버전 이슈 없음.

## 요약

`ExecuteWorkflowDto` 신설 + `@ApiBody` 부착은 OpenAPI 문서 표면만 채우고 런타임 계약(파이프 진입 여부·검증 여부·허용 키 범위)은 한 글자도 바꾸지 않도록 설계·검증된 순수 문서화 변경이다. `@Body()` 파라미터 타입을 그대로 인라인으로 남겨 `CustomValidationPipe.toValidate()` 의 `Object` 제외 경로를 유지했고, 이를 지키는 캐너리 테스트(정상 케이스 + 대조군 케이스)로 향후 회귀를 실측 검증 가능하게 고정했다. "여분 키를 거부할지" 같은 실제 계약 강화 여부는 의도적으로 이 PR 밖으로 분리해 별도 트래커에 등재했다. 직접 실행한 테스트(33건 GREEN)와 `tsc` 클린 확인으로 하위 호환성 주장을 재검증했으며, 남은 발견사항은 문서 가독성 수준의 INFO 2건뿐이다.

## 위험도

LOW
