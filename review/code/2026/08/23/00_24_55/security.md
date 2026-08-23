# 보안(Security) 코드 리뷰

## 개요

이번 diff 는 `POST /workflows/:id/execute` 요청 본문을 위한 **OpenAPI 문서화 전용 DTO**
(`ExecuteWorkflowDto`)를 신설하고, 컨트롤러에 `@ApiBody({ type: ExecuteWorkflowDto, required: false })`
데코레이터 1개만 추가한 것이 실질 코드 변경 전부다. `@Body()` 파라미터 자체는 여전히 기존 인라인
타입(`{ input?: Record<string, unknown>; parameterValues?: Record<string, unknown> }`)을 유지하며,
`workflows.controller.ts:workflows.controller.ts` `execute()` 메서드의 런타임 로직(RBAC `@Roles('editor')`,
`ParseUUIDPipe`, `@WorkspaceId()`, Graceful Shutdown gate, `resolveTriggerParametersRejectingMasked()`
호출부)은 diff 범위 밖으로 전혀 손대지 않았다. 직접 소스를 열어 확인한 결과(`sed -n '240,330p'
codebase/backend/src/modules/workflows/workflows.controller.ts`)와 diff 내용이 일치했다.

나머지 파일(`plan/complete/execute-body-openapi.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`,
`review/code/2026/08/23/00_07_27/*`, `review/consistency/2026/08/22/23_46_23/*`)은 이번 PR 의 이전 리뷰/
consistency-check 라운드 산출물과 plan 기록으로, 실행되는 애플리케이션 코드가 아니다. 전수
grep(`sk-`, `AKIA`, `-----BEGIN`, `password=`, `secret=`, `apikey=`)으로 하드코딩 시크릿 여부를
확인했고 검출 없음 — 유일한 hit 은 테스트 fixture 문자열 `apiKey: 'real-value'`(`workflows-execute-body.spec.ts`)
로 실제 자격증명이 아니다.

이 라운드는 직전 라운드(`00_07_27`, Critical 0 · Warning 3)의 W1(마커 거부 규칙 description 누락)·
W3(OpenAPI 노출 자체를 검증하는 가드 부재) 수정을 반영한 재검토다. 두 수정 모두 diff 에서 실제로
반영된 것을 확인했다(`input` description 에 "그 값도 동일한 마커 거부 대상" 문구 추가, 신규
`describe('POST /workflows/:id/execute OpenAPI 노출', ...)` 블록으로 실 컨트롤러 메타데이터 기반
가드 4건 추가).

### 발견사항

- **[INFO]** `POST /workflows/:id/execute` 본문은 이번 변경 이후에도 여전히 스키마 검증을 받지 않는다 (사전 존재 상태, 회귀 아님)
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:31-39`(`parameterValues`), `:41-58`(`input`); `codebase/backend/src/modules/workflows/workflows.controller.ts:256`(`@ApiBody`)
  - 상세: `ExecuteWorkflowDto` 는 두 필드를 `type: 'object', additionalProperties: true` 로 정확히 문서화했는데, 이는 `@Body()` 파라미터가 여전히 인라인 `Object` 타입이라 `CustomValidationPipe.toValidate()` 가 검증을 통째로 스킵하는 현실을 그대로 반영한 것이다. 공개 API 문서에 "이 엔드포인트는 임의의 top-level 키를 검증 없이 허용한다"는 사실이 명시적으로 드러나므로, 외부 클라이언트/공격자 입장에서 이 표면이 스키마 강제가 느슨함을 더 쉽게 식별할 수 있게 된다. 다만 취약 표면 자체는 이번 PR 이전부터 존재했고 실제 동작은 바뀌지 않았으며, "여분 키를 400 으로 거부할 것인가"는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 별도 결정 항목으로 이미 등재되어 있다(제품 판단 필요 항목으로 적절히 분리됨).
  - 제안: 신규 이슈가 아니므로 이번 PR 차단 사유는 아니다. 트래커 항목의 우선순위 결정 시 "공개 문서화로 발견 가능성이 높아졌다"는 점을 참고 권장.

- **[INFO]** 마스킹 마커 리터럴을 문서에 노출하지 않은 것은 양호한 정보 최소화 설계
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:32-36`(`parameterValues` description), `:52-55`(`input` description)
  - 상세: 두 필드의 `description` 모두 "마스킹 마커와 정확히 일치하는 값은 400 `MASKED_VALUE_RESUBMITTED` 로 거부"라고만 서술하고 실제 마커 문자열(예약어 리터럴)은 인용하지 않는다. 마커 문자열이 공개 Swagger 문서에 노출되면 공격자가 정확히 그 문자열을 피해 마스킹 우회를 시도하기 쉬워지므로, 리터럴을 적지 않은 선택은 타당하다. 별도 조치 불필요.

- **[INFO]** DTO 에 class-validator 데코레이터가 전혀 없어 오용 시 회귀 위험 — 캐너리 테스트로 이 라우트에 한해 완화됨
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts`(클래스 전체), `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts`(캐너리 + 대조군 블록)
  - 상세: `ExecuteWorkflowDto` 는 이름상 DTO 지만 실제로는 Swagger 스키마 홀더일 뿐이다. 향후 다른 개발자가 이 클래스를 `@Body()` 파라미터 타입으로 잘못 재사용하면, 데코레이터 부재로 `validate()` 가 빈 객체조차 전부 거부하거나(데코레이터 없이 사용) `forbidNonWhitelisted: true` 로 여분 키가 400 이 되는(데코레이터 추가 시) 두 갈래 중 하나로 계약이 조용히 깨질 수 있다. `workflows-execute-body.spec.ts` 의 캐너리(파라미터 타입이 `Object` 유지 확인, 여분 키 패스스루 확인)와 대조군(DTO 를 실제 파라미터 타입으로 썼을 때 3가지 케이스 전부 거부됨을 확인)이 이 특정 라우트에 대해서는 회귀를 RED 로 잡아준다. 다만 이 보호는 이 파일/라우트에 스코프돼 있고 다른 엔드포인트에서의 오용까지는 막지 못한다(가능성 낮음 — 클래스명이 파일에 로컬화, docstring 경고 명확).
  - 제안: 현재 수준(docstring + 캐너리)으로 충분. 조치 불요.

- **[INFO]** 인증/인가·라우팅·마커 거부 로직 변경 없음
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` (`execute()` 메서드 본문 — diff 밖, 미변경 확인)
  - 상세: 실질 diff 는 import 2줄 + `@ApiBody` 데코레이터 1줄 + 주석이 전부다. `@Roles('editor')`, `ParseUUIDPipe`, `@WorkspaceId()`, Graceful Shutdown 503 gate, `resolveTriggerParametersRejectingMasked()` 호출 등 보안에 중요한 런타임 경로는 소스 직접 확인 결과 전혀 손대지 않았다. SQL/커맨드/경로 인젝션, 안전하지 않은 암호화, 민감정보 에러 노출도 diff 범위 내에서 발견되지 않았다.

- **[INFO]** 신규 커밋되는 plan/review 산출물 파일들에 시크릿·인젝션 벡터 없음
  - 위치: `plan/complete/execute-body-openapi.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `review/code/2026/08/23/00_07_27/*`, `review/consistency/2026/08/22/23_46_23/*`
  - 상세: 문서 아카이브로 코드 실행과 무관. 전수 grep(`sk-`, `AKIA`, `-----BEGIN`, `password=`, `secret=`, `apikey=`) 무검출, 유일한 hit 은 테스트 fixture `apiKey: 'real-value'` (실 자격증명 아님).

## 요약

이번 diff 는 `POST /workflows/:id/execute` 본문에 Swagger 문서(`@ApiBody`)만 추가하고 런타임 검증
경로(`@Body()` 파라미터 타입, `CustomValidationPipe` 스킵 여부)는 의도적으로 그대로 둔 순수 문서화
변경이며, 직전 라운드(`00_07_27`) 리뷰의 Warning 3건(마커 거부 규칙 누락·plan 체크리스트·OpenAPI 노출
검증 가드 부재)이 모두 반영돼 있음을 소스에서 직접 확인했다. 신규 도입된 인젝션 취약점·하드코딩
시크릿·인증/인가 우회·안전하지 않은 암호화·민감정보 에러 노출은 없다. 유일하게 주목할 지점은
"이 엔드포인트가 여분 top-level 키를 검증 없이 받아들인다"는 기존(사전 존재) 갭이 공개 API 문서에
더 명확히 드러난다는 점인데, 이는 회귀가 아니라 투명한 문서화이며 별도 결정 항목으로 트래커에
이미 등재되어 있다.

## 위험도

NONE
