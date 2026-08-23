STATUS=success security review complete

===REPORT_MARKDOWN_BELOW===

# 보안(Security) 코드 리뷰 — masking-gate-consolidation

## 검토 범위

실제 애플리케이션 코드 변경은 3개 파일이다:

- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/shared/utils/redact-stored-error.ts`

나머지(`plan/**`, `review/consistency/**`, `spec/conventions/egress-masking.md`)는 plan/리뷰
산출물·문서이며 실행 코드가 아니다. `spec/conventions/egress-masking.md` 변경분은 마커 값 대신
심볼 이름만 인용하는 문서 자체 규율("마커 리터럴을 적지 않는다")을 그대로 지키고 있어 시크릿
노출은 없다.

이번 PR 은 egress 마스킹(`inputData`/`outputData`/`error` 세 컬럼)을 4곳에 흩어져 있던 손계산
로직을 `redact-stored-error.ts` 의 헬퍼 둘(`redactStoredFieldsForResponse`,
`redactNodeExecutionRow`)로 통합하는 **순수 리팩터**다. 동작 무변경을 목표로 하며, 실제로
`redactStoredFieldsForResponse` 의 구현은 종전 각 호출부가 하던
`redactStoredDataForResponse(inputData)` / `redactStoredDataForResponse(outputData)` /
`redactStoredErrorForResponse(error)` 세 호출을 그대로 감싼 것이고, `redactNodeExecutionRow` 도
`executions.service.ts` 에 있던 `maskIfPresent` 3중 호출 + copy-on-change 로직을 그대로
이동·제네릭화한 것이다. 두 마스킹 원시 함수(`redactStoredDataForResponse`,
`redactStoredErrorForResponse`) 자체는 이번 diff 에서 변경되지 않았다(`deepRedactSecrets` 위임
그대로).

## 발견사항

- **[INFO]** 마스킹 게이트 통합이 기능적으로 완전히 동등함을 확인 — 신규 취약점 없음
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` (`redactStoredFieldsForResponse`,
    `redactNodeExecutionRow`), 호출부 `codebase/backend/src/modules/executions/executions.service.ts`
    (`toResponseExecution`/`toExecutionDto`/`findById` 노드 루프), 호출부
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`
    (`toNodeExecutionDto`)
  - 상세: `redactStoredFieldsForResponse(row)` 는 `row.inputData`/`row.outputData`/`row.error`
    세 필드를 각각 기존 마스커(`redactStoredDataForResponse`/`redactStoredErrorForResponse`)로
    넘기는 얇은 래퍼이고, 대상 필드 이름·순서·부재 시 `null` 정규화가 종전 호출부 4곳(3곳은 이번
    diff 로 확인, 4번째 `background-runs.service.ts` 포함)과 1:1 일치한다. `redactNodeExecutionRow`
    도 `maskIfPresent` 로직(부재 시 원본 보존 + copy-on-change)을 그대로 옮겼을 뿐 판정 조건을
    바꾸지 않았다. plan 문서(`plan/in-progress/masking-gate-consolidation.md`)가 기록한 뮤테이션
    검증(M1: 헬퍼에서 `inputData` 마스킹 제거 → 5개 표면 RED, M2: copy-on-change 파기 →
    2개 RED, 둘 다 `tsc` 선검증 통과)도 마스킹이 실제로 걸리고 있음을 뒷받침한다. 즉 이 리팩터가
    egress 마스킹을 우회하거나 약화시키는 경로를 열지 않는다.
  - 제안: 없음(양성 확인).

- **[INFO]** 인가(authorization) 로직은 이번 diff 의 변경 범위 밖 — 영향 없음 확인
  - 위치: `background-runs.service.ts` `verifyBackgroundRunOwnership`/`verifyExecutionAccess`,
    `executions.service.ts` `verifyOwnership`/`verifyWorkflowOwnership`/`isOwnerOrAdmin`
  - 상세: 워크스페이스 격리(IDOR 차단) 함수들은 이번 diff 의 변경 hunk 에 포함되지 않았고,
    마스킹 헬퍼 교체는 이 함수들의 호출 순서·조건에 개입하지 않는다. NotFound 통일(ID
    enumeration 차단), `JwtPayload.role` 대신 `getMemberRole` 로 대상 워크스페이스 role 을
    재조회하는 방어(RR-PL-06 주석)도 그대로 보존.
  - 제안: 없음.

- **[INFO]** SQL 쿼리 전부 파라미터 바인딩 — 인젝션 경로 없음
  - 위치: `background-runs.service.ts` `verifyBackgroundRunOwnership`/`findBackgroundNodeExecution`
    (JSONB `#>>` 표현식도 `:backgroundRunId` 바인딩), `executions.service.ts` `computeChainDepth`
    (raw SQL 이지만 `$1`/`$2` 파라미터화)
  - 상세: 이번 diff 로 신규/변경된 쿼리는 없으며, 기존 쿼리들도 모두 TypeORM
    QueryBuilder 파라미터 또는 `$N` 플레이스홀더를 사용해 문자열 결합이 없다.
  - 제안: 없음.

## 확인한 항목 (문제 없음)

- 하드코딩된 시크릿/API 키/토큰: 3개 코드 파일 및 diff 전체에서 발견 안 됨.
- 에러 메시지 노출: `NotFoundException`/`BadRequestException` 페이로드는 `code`/일반화된
  `message` 만 사용(예: `'Execution not found'`, `'cursor must be a valid opaque token'`) — 스택
  트레이스·내부 경로·DB 상세 노출 없음. 이번 diff 가 이 패턴을 바꾸지 않음.
  `spec/conventions/egress-masking.md` 자신도 "DB 는 원문을 보존, egress 만 마스킹"(§R17)이라는
  기존 정책을 재확인할 뿐 바꾸지 않는다.
  \n- 암호화/해시: 이번 diff 는 암호화·해시 관련 코드를 다루지 않는다(마스킹은 값 치환이지 해시가
  아니며, 이 구분은 기존 SoT 문서에 이미 명시돼 있다).
- 의존성: 신규 패키지·라이브러리 도입 없음.
- 입력 검증: `decodeCursor` 등 사용자 입력 검증 로직은 이번 diff 범위 밖(변경 없음).

## 요약

이번 변경은 `inputData`/`outputData`/`error` 세 컬럼에 대한 egress 마스킹 로직을 4개 호출부에서
공유 헬퍼(`redactStoredFieldsForResponse`, `redactNodeExecutionRow`)로 통합하는 순수 리팩터로,
기존 마스킹 원시 함수(`deepRedactSecrets` 경유)를 그대로 감싸므로 마스킹 커버리지·조건에 변화가
없다. SQL 쿼리는 전부 파라미터 바인딩이고, 인가(IDOR 차단) 로직은 diff 범위 밖에서 그대로
보존되며, 하드코딩된 시크릿이나 새로운 인젝션·에러 노출 경로도 발견되지 않았다. 오히려 이
통합은 향후 "자매 호출부 하나가 마스킹 갱신에서 빠지는" 클래스의 CRITICAL(트래커가 인용한
`14_08_45` C2)을 구조적으로 줄이는 방향이라 보안 관점에서 긍정적인 변경이다.

## 위험도

NONE
