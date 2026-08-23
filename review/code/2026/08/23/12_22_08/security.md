# 보안(Security) 코드 리뷰

## 검토 대상 요약
이번 변경은 다음 세 가지로 구성된다.

1. `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` — `ExecuteWorkflowDto.input` 필드에 JSDoc 설명 확장 + `@ApiPropertyOptional({ deprecated: true })` 추가. **런타임 로직 변경 없음** (컨트롤러의 `@Body()` 파라미터는 여전히 인라인 `Object` 타입이라 이 DTO 는 OpenAPI 스키마 생성 전용).
2. `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts` — 위 `deprecated` 플래그가 `input` 에만 걸리고 `parameterValues` 에는 걸리지 않음을 확인하는 신규 unit 테스트(대조군 포함) 추가.
3. `plan/**`, `review/consistency/**`, `spec/conventions/swagger.md` — 결정 기록 문서·consistency-check 산출물·Swagger 컨벤션 문서 개정. 코드 실행 경로에 영향 없는 순수 문서 변경.

전반적으로 **OpenAPI 문서 메타데이터 + 테스트 + 문서** 변경이며, 인증/인가·입력 검증·암호화·에러 처리 로직을 다루는 실제 실행 코드는 이번 diff 에 포함되지 않는다.

## 발견사항

- **[INFO]** `POST /workflows/:id/execute` 본문이 전역 `CustomValidationPipe` 를 계속 우회한다 (신규 도입 아님, 기존 상태의 명시적 유지)
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (파일 상단 클래스 docstring, 게이트 `10`~`24`행 — "이 본문은 지금까지 한 번도 검증된 적이 없다" / "이 엔드포인트는 유저 가이드에도 실린 공개 API 라 ... 여기서는 문서만 고치고 런타임은 한 줄도 바꾸지 않는다")
  - 상세: `@Body()` 파라미터가 인라인 `Object` 타입으로 남아 있어 `ExecuteWorkflowDto` 에 데코레이터를 달아도 `CustomValidationPipe.toValidate()` 가 검증을 건너뛴다. 즉 `parameterValues`/`input` 외의 임의 top-level 키가 조용히 무시되며 계속 통과한다(캐너리: `workflows-execute-body.spec.ts` `[캐너리] 여분 top-level 키를 실은 본문도 파이프를 통과한다`). 이는 이번 PR 이 새로 만든 취약점이 아니라, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 선행 결정(`execute-body-dto`, 2026-08-22)에서 이미 "거부로 바꾸면 공개 API 계약 축소이므로 사용자 판단 필요"로 분류돼 있었고, 이번 PR(`swagger-decisions.md` ①)이 "거부하지 않는다 — 현행 유지"로 **명시적으로 재확인**한 것이다. 실측 근거(1st-party 클라이언트는 정확히 `{input, parameterValues}` 만 보냄, 위험은 미지의 외부 클라이언트)도 트래커에 기록돼 있다.
  - 제안: 코드 관점의 조치는 불필요 — 사용자가 이미 택일했고 되살릴 조건(여분 키를 실제로 보내는 외부 클라이언트가 없다는 관측 데이터)까지 명시돼 있다. 참고로만 기록한다.

- **[INFO]** `input`/`parameterValues` 모두 값-레벨 마스킹 마커(`MASKED_VALUE_RESUBMITTED`) 거부 규칙이 두 필드 JSDoc/description 에 정확히 동일하게 반영돼 있는지 확인
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:32-38`(parameterValues), `:60-67`(input)
  - 상세: 두 `@ApiPropertyOptional` description 모두 "마커 거부 대상"을 명시하고, `workflows-execute-body.spec.ts` 의 `[가드] 마커 거부 규칙이 두 필드 description 에 모두 드러난다` 테스트가 두 필드 모두 `'마커'` 문자열 포함을 강제한다. 컨트롤러가 `parameterValues ?? input.parameters` 로 합류시킨 뒤 `resolveTriggerParametersRejectingMasked` 를 한 번만 호출하는 구조와 일치하며, 한쪽 문서만 갱신돼 클라이언트가 다른 경로로 마스킹 마커를 재제출할 수 있는 문서-실동작 불일치 위험은 이번 변경으로 발생하지 않는다. 정상.

- **[INFO]** OpenAPI 스키마 노출 범위 (`deprecated: true` 플래그)
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:66`
  - 상세: `deprecated: true` 는 표준 OpenAPI 메타데이터로, 내부 back-compat 경로의 존재를 Swagger 문서 소비자에게 알린다. `spec/conventions/swagger.md §0` 에 따라 Swagger UI 자체가 `NODE_ENV=production` 에서 기본 비노출(`isSwaggerEnabled`)이므로, 이 정보가 무인증 정찰에 추가로 노출되는 경로는 이번 변경으로 새로 생기지 않는다.
  - 제안: 조치 불필요.

- 인젝션·하드코딩 시크릿·인증/인가 우회·안전하지 않은 암호화·에러 메시지 정보 노출·취약 의존성 관련 변경 사항 없음. `plan/**`, `review/consistency/**` 산출물 및 `spec/conventions/swagger.md` 개정은 서술형 문서로, 실행 코드·시크릿·자격증명을 포함하지 않는다.

## 요약
이번 diff 는 `ExecuteWorkflowDto.input` 필드에 `deprecated: true` OpenAPI 플래그와 JSDoc 을 추가하고 이를 고정하는 unit 테스트 1건을 더한 것이 실질적인 코드 변경의 전부이며, 나머지는 plan/consistency-report/spec 컨벤션 문서다. 명시적으로 "런타임 무변경"을 목표로 설계됐고 캐너리 테스트(`@Body()` 파라미터가 여전히 `Object` 타입, DTO 로 바뀌면 파이프가 모든 요청을 거부한다는 대조군)로 그 경계를 지키고 있다. 유일하게 눈에 띄는 보안 관련 사실은 `execute` 엔드포인트가 여전히 전역 validation pipe 를 우회해 임의 top-level 키를 조용히 수락한다는 기존 상태인데, 이는 이번 PR 이전부터 있던 상태이고 사용자가 이미 "현행 유지"로 명시 결정·기록했으므로 신규 취약점이 아니다. Critical/Warning 급 보안 결함은 발견되지 않았다.

## 위험도
NONE
