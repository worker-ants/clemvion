# 보안(Security) 코드 리뷰

## 개요

이번 변경은 `POST /workflows/:id/execute` 요청 본문에 대한 **OpenAPI 문서화 전용 DTO**
(`ExecuteWorkflowDto`)를 신설하고, 컨트롤러에 `@ApiBody({ type: ExecuteWorkflowDto, required: false })`
만 추가하는 것이 전부다. `@Body()` 파라미터 자체는 기존 인라인 타입(`{ input?, parameterValues? }`)
을 그대로 유지하며, `execute()` 메서드의 런타임 로직은 diff 에 전혀 포함되지 않았다(문서·주석·import
추가뿐). 즉 **런타임 동작 변화가 없는 순수 문서화 커밋**이며, `codebase/backend/src/common/pipes/validation.pipe.ts`
를 직접 확인한 결과 DTO docstring 이 주장하는 "`metatype === Object` 면 `toValidate()` 가
검증을 건너뛴다" 는 사실과 일치했다(`types: Function[] = [String, Boolean, Number, Array, Object]`
+ `!types.includes(metatype)`). 따라서 이 DTO 를 `@Body()` 파라미터 타입으로 승격하지 않는 한
검증 스킵 상태는 이번 커밋 전후로 동일하다.

### 발견사항

- **[INFO]** `POST /workflows/:id/execute` 본문은 이번 변경 이후에도 여전히 스키마 검증을 받지 않는다(사전 존재 상태, 회귀 아님)
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:31-39`(`parameterValues`), `:41-52`(`input`); `codebase/backend/src/modules/workflows/workflows.controller.ts:256`(`@ApiBody`)
  - 상세: `ExecuteWorkflowDto` 는 `@ApiPropertyOptional({ type: 'object', additionalProperties: true })` 로 두 필드를 열린 map 으로 정확히 문서화했는데, 이는 실제로 `@Body()` 파라미터가 여전히 인라인 `Object` 타입이라 `CustomValidationPipe` 가 검증을 통째로 스킵하는 현실을 그대로 반영한 것이다(docstring 과 `workflows-execute-body.spec.ts` 캐너리로 실측·고정됨). 공개 API 문서에 "이 엔드포인트는 임의의 top-level 키를 허용한다"는 사실이 명시적으로 드러나므로, 외부 클라이언트/공격자 입장에서 이 엔드포인트가 스키마 강제가 느슨한 표면임을 더 쉽게 식별할 수 있게 된다. 다만 이 취약 표면 자체는 이번 PR 이전부터 존재했고 실제 동작을 바꾸지 않았으며, 플랜 문서(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에 "여분 키를 400 으로 거부할지"가 별도 결정 항목으로 이미 등재되어 있다.
  - 제안: 신규 이슈는 아니므로 이번 PR 차단 사유는 아니다. 다만 트래커 항목("여분 키 거부 여부")의 우선순위를 결정할 때 "공개 문서화로 인해 이 갭의 발견 가능성이 높아졌다"는 점을 감안 권장.

- **[INFO]** 마스킹 마커 리터럴을 문서에 노출하지 않은 점은 양호한 방어적 설계
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:32-35`
  - 상세: `parameterValues` 의 `description` 은 "마스킹 마커와 정확히 일치하는 값은 400 `MASKED_VALUE_RESUBMITTED` 로 거부"라고만 적고 실제 마커 문자열(예약어 리터럴)을 인용하지 않았다. 마커 문자열이 공개 Swagger 문서에 노출되면 공격자가 정확히 그 문자열을 피해 마스킹 우회를 시도하기 쉬워지므로, 리터럴을 적지 않은 선택은 타당한 정보 최소화(information minimization)다. 별도 조치 불필요.

- **[INFO]** DTO 에 class-validator 데코레이터가 전혀 없어 향후 오용 시 회귀 위험 — 캐너리 테스트로 완화됨
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:30-53` (클래스 전체), `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:32-38`(파라미터 타입 캐너리), `:40-55`(패스스루 캐너리), `:66-79`(대조군 — DTO 를 실제 파라미터 타입으로 썼을 때 전량 거부됨을 확인)
  - 상세: `ExecuteWorkflowDto` 는 이름상 "DTO" 지만 검증 데코레이터가 없어 실제로는 Swagger 스키마 홀더일 뿐이다. 향후 다른 개발자가 이 클래스를 `@Body()` 파라미터 타입으로 착각해 재사용하면, docstring 이 경고하는 두 갈래(① 데코레이터 없는 상태로 쓰면 `validate()` 가 메타데이터를 못 찾아 **빈 객체조차 전부 거부**, ② 데코레이터를 추가하면 `forbidNonWhitelisted: true` 로 **여분 키가 400**) 중 하나로 조용히 계약이 깨질 수 있다. `workflows-execute-body.spec.ts` 가 정확히 이 엔드포인트의 `@Body()` 파라미터 타입이 `Object` 로 유지되는지, 여분 키가 여전히 통과하는지를 캐너리로 고정하고 있어 *이 엔드포인트에 한해서는* 회귀가 RED 로 드러난다. 다만 이 보호는 이 특정 라우트/파일에 스코프되어 있고, `ExecuteWorkflowDto` 를 **다른** 엔드포인트의 `@Body()` 타입으로 재사용하는 실수까지는 막지 못한다(가능성은 낮음 — 클래스명이 `execute-workflow.dto.ts` 파일에 로컬화되어 있고 docstring 경고가 명확함).
  - 제안: 현재 수준의 문서화(docstring + 캐너리)로 충분. 필요하면 클래스명에 `ForDocsOnly`/`SchemaOnly` 접미사를 붙여 오용 가능성을 더 낮출 수 있으나 필수는 아님.

- **[INFO]** 인증/인가·라우팅 로직 변경 없음
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` (`execute()` 메서드, `@Roles('editor')`·`@Param('id', ParseUUIDPipe)`·`@WorkspaceId()` 전부 diff 밖 — 미변경)
  - 상세: diff 는 import 문 2줄과 `@ApiBody` 데코레이터 1줄 추가가 전부다. RBAC(`@Roles('editor')`), UUID 파싱, 워크스페이스 스코핑, Graceful Shutdown gate, 마스킹 마커 거부(`resolveTriggerParametersRejectingMasked`) 등 보안에 중요한 런타임 경로는 전혀 손대지 않았다. 하드코딩된 시크릿·SQL/커맨드 인젝션·안전하지 않은 암호화·민감정보 에러 노출 등도 diff 범위 내에서 발견되지 않았다.

- **[INFO]** 리뷰 산출물 파일(consistency check 리포트 6종, `review/consistency/2026/08/22/23_46_23/*`)은 문서 아카이브로 코드 실행과 무관하며 시크릿·인젝션 벡터 없음을 확인함(전수 grep: `sk-`, `AKIA`, `-----BEGIN`, `password=`, `secret=`, `apikey=` 패턴 무검출; 유일한 hit 은 테스트 fixture `apiKey: 'real-value'` 로 실제 자격증명 아님).

## 요약

이번 diff 는 `POST /workflows/:id/execute` 본문에 대한 Swagger 문서(`@ApiBody`)만 추가하고 런타임
검증 경로(`@Body()` 파라미터 타입, `CustomValidationPipe` 스킵 여부)는 의도적으로 그대로 둔 순수
문서화 변경이다. `CustomValidationPipe.toValidate()` 소스를 직접 확인해 "Object 메타타입은 검증을
건너뛴다"는 docstring 의 주장이 사실임을 검증했고, 이 사실을 뒤집을 수 있는 실수(DTO 를 실제 파라미터
타입으로 승격)를 잡아주는 캐너리 테스트(`workflows-execute-body.spec.ts`)도 함께 추가되어 회귀 방지가
되어 있다. 하드코딩된 시크릿, 인젝션 벡터, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 에러 노출 등
새로 도입된 취약점은 없다. 유일하게 주목할 지점은 "이 엔드포인트가 여분 top-level 키를 검증 없이
받아들인다"는 기존(사전 존재) 갭이 공개 API 문서에 정확히 드러난다는 점인데, 이는 회귀가 아니라 투명한
문서화이며 별도 결정 항목으로 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에
이미 등재되어 있다.

## 위험도

NONE
