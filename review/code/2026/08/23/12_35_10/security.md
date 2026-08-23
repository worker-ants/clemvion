# 보안(Security) 코드 리뷰

## 검토 대상 요약

이번 diff 는 크게 세 부류로 구성된다.

1. `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` — `ExecuteWorkflowDto.input`
   필드에 `@ApiPropertyOptional({ deprecated: true })` 플래그와 JSDoc 보강. **런타임 로직 변경
   없음** — 컨트롤러의 `@Body()` 파라미터는 여전히 인라인 `Object` 타입이라 이 DTO 는 OpenAPI
   스키마 생성에만 쓰인다 (파일 상단 클래스 docstring, 실측 확인).
2. `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts` — 위 `deprecated`
   플래그가 `input` 에만 걸리고 `parameterValues` 에는 걸리지 않음을 확인하는 대조군 포함 unit
   테스트 1건 추가.
3. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`,
   `plan/in-progress/swagger-decisions.md`, `spec/conventions/swagger.md`,
   `review/code/2026/08/23/12_22_08/**`, `review/consistency/2026/08/23/11_59_11/**` — 사용자
   결정 3건(여분 키 미거부 유지·`input` deprecation·DTO description 길이 규칙 비강제화)의 기록,
   직전 리뷰 세션·consistency-check 세션의 산출물 커밋, `swagger.md` 컨벤션 개정. 실행 코드 경로에
   영향 없는 순수 문서 변경.

실제 컨트롤러 코드(`workflows.controller.ts`)를 직접 확인했다 — `body?.parameterValues ??
body.input.parameters` 로 두 필드를 한 번 합류시킨 뒤 `resolveTriggerParametersRejectingMasked`
를 단일 호출하는 구조는 이번 diff 로 전혀 바뀌지 않았다. 즉 마스킹 마커 재제출 거부 로직·입력
검증 경계 모두 무변경이다.

## 발견사항

- **[INFO]** `POST /workflows/:id/execute` 본문이 전역 `CustomValidationPipe` 를 계속 우회한다
  (신규 도입 아님, 기존 상태를 사용자가 이번 PR 에서 "현행 유지"로 명시 재확인).
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (클래스 docstring,
    게이트 10~24행)
  - 상세: `@Body()` 파라미터가 인라인 `Object` 타입으로 남아 있어 `CustomValidationPipe.toValidate()`
    가 이 요청 본문의 검증을 건너뛴다 — `parameterValues`/`input` 외 임의 top-level 키가 조용히
    통과한다. 이는 이번 PR 이 새로 만든 취약점이 아니라 선행 결정
    (`plan/in-progress/spec-sync-external-interaction-api-gaps.md` `execute-body-dto`,
    2026-08-22)에서 "거부로 바꾸면 공개 API 계약 축소라 사용자 판단 필요"로 이미 분류돼 있었고,
    이번 PR(`swagger-decisions.md` ①)이 "거부하지 않는다 — 현행 유지"로 사용자가 택일해
    명시적으로 재확인·종결한 것이다. 실측 근거(1st-party 클라이언트는 정확히
    `{input, parameterValues}` 만 전송, 위험은 미지의 외부 클라이언트)와 되살릴 조건(외부
    클라이언트의 여분 키 전송 관측 데이터 확보 시 재검토)까지 트래커에 기록돼 있다.
  - 제안: 코드 관점 조치 불필요 — 이미 사용자 결정·기록. 참고로만 남긴다.

- **[INFO]** `input`/`parameterValues` 두 필드 모두 값-레벨 마스킹 마커
  (`MASKED_VALUE_RESUBMITTED`) 거부 규칙이 description 에 동일하게 반영돼 있는지 확인.
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:32-38`
    (`parameterValues`), `:60-67`(`input`)
  - 상세: 두 `@ApiPropertyOptional.description` 모두 "마커 거부 대상"을 명시하고,
    `workflows-execute-body.spec.ts` 의 `[가드] 마커 거부 규칙이 두 필드 description 에 모두
    드러난다` 테스트가 양쪽 모두 `'마커'` 문자열 포함을 강제한다. 컨트롤러가 두 필드를 한 번만
    합류시켜 마스킹 검사를 단일 호출로 처리하는 구조(위 검토 대상 요약에서 직접 확인)와 일치한다.
    `input` 에 `deprecated: true` 를 추가하고 description 문구를 바꿨어도(`신규 통합은
    parameterValues 를 쓴다` 문구 추가) 마커 거부 문구 자체는 그대로 남아 있어, 한쪽 문서만
    갱신돼 클라이언트가 마커 규칙을 놓치는 문서-실동작 불일치 위험은 없다. 정상.
  - 제안: 없음.

- **[INFO]** OpenAPI 스키마에 `deprecated: true` 플래그 추가에 따른 정찰(reconnaissance) 노출
  여부.
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:66`
  - 상세: `deprecated: true` 는 표준 OpenAPI 메타데이터로, `input` 이 back-compat 레거시 경로임을
    Swagger 문서 소비자에게 알린다. 새로운 내부 정보를 추가로 노출하지 않으며(이미 description 에
    "레거시 봉투"라고 명시돼 있었다), `spec/conventions/swagger.md` 의 Swagger UI 프로덕션
    비노출 정책과도 무관한 순수 스키마 필드다.
  - 제안: 조치 불필요.

- **[INFO]** 이번 diff 로 새로 커밋된 `review/code/2026/08/23/12_22_08/**` 및
  `review/consistency/2026/08/23/11_59_11/**` 산출물 파일 — 리뷰/consistency-check 세션의 표준
  출력물이며 시크릿·자격증명·내부 인프라 정보를 포함하지 않는다. `_retry_state.json` 등에
  절대경로가 노출되지만 로컬 워크트리 경로일 뿐 자격증명이 아니다.
  - 위치: `review/code/2026/08/23/12_22_08/_retry_state.json` 등
  - 제안: 조치 불필요.

- 인젝션(SQL/XSS/커맨드/LDAP/경로 탐색)·하드코딩된 시크릿·인증/인가 우회·안전하지 않은 해시/암호화·
  민감정보 노출 에러 처리·신규 취약 의존성 도입에 해당하는 변경 사항은 이번 diff 에서 발견되지 않았다.
  `plan/**`, `review/**` 산출물 및 `spec/conventions/swagger.md` 개정은 서술형 문서로 실행 코드·
  시크릿을 포함하지 않는다.

## 요약

이번 diff 의 실질 코드 변경은 `ExecuteWorkflowDto.input` 필드에 OpenAPI `deprecated: true`
플래그와 JSDoc 을 추가하고 이를 고정하는 대조군 포함 unit 테스트 1건을 더한 것이 전부이며, 컨트롤러의
마스킹 마커 거부 로직·`@Body()` 파라미터 타입·전역 validation pipe 우회 여부는 모두 무변경임을
소스(`workflows.controller.ts`)에서 직접 확인했다. 유일하게 눈에 띄는 보안 관련 기존 상태 —
`execute` 엔드포인트가 전역 `CustomValidationPipe` 를 우회해 여분 top-level 키를 조용히 수락하는
것 — 는 이번 PR 이전부터 있던 상태이고, 사용자가 이번 PR 에서 "현행 유지"로 명시 결정·기록했으므로
신규 취약점이 아니다. 나머지 변경(plan 문서, 직전 리뷰/consistency 세션 산출물 커밋,
`spec/conventions/swagger.md` DTO description 길이 규칙 개정)은 실행 코드에 영향이 없는 순수
문서 변경이다. Critical/Warning 급 보안 결함은 발견되지 않았다.

## 위험도
NONE
