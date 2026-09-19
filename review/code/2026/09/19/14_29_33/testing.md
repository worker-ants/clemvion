# 테스트(Testing) 리뷰 — Database · HTTP 연결 테스트

## 발견사항

- **[WARNING]** `resolveHttpCredentials` 의 `INTEGRATION_INCOMPLETE` 세 분기(필수 필드 누락)가 새 공유 모듈에서 테스트되지 않는다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-credentials.ts:44-51`(api_key: location/key_name/value 누락), `:67-73`(bearer_token: token 누락), `:86-92`(basic: username/password 누락)
  - 상세: 이 함수는 이번 PR 에서 핸들러 전용 private 로직에서 **핸들러·연결 테스터 공용의 독립 모듈**로 승격됐다(순환 import 회피 목적, 파일 주석에 명시). 그런데 새로 추가된 `http-connection-tester.spec.ts` 는 `INTEGRATION_AUTH_UNSUPPORTED`(지원하지 않는 인증 방식, 파일 325번째 줄 부근 테스트)만 검증하고 세 개의 `INTEGRATION_INCOMPLETE` 분기는 하나도 exercise 하지 않는다. 기존 `http-request.handler.spec.ts` 도 `location/key_name/value`·`token`·`username/password` 를 갖춘 happy-path 만 테스트하며 누락 시나리오(`buildHttpCredentials` → `IntegrationError`)에 대한 테스트가 없다(grep 결과 두 spec 파일 모두 `INTEGRATION_INCOMPLETE`/`is missing` 문자열 매치 0건).
    이 코드가 지금은 `preview-test`·`:id/test` 응답의 `code` 필드로 그대로 노출되므로(연결 테스터가 `resolved.code`/`resolved.message` 를 그대로 반환), 이 세 분기 중 하나가 깨져도(예: 조건 반전·`&&`→`||` 뮤테이션) 어떤 테스트도 RED 가 되지 않는다.
  - 제안: `http-connection-tester.spec.ts` 에 api_key/bearer_token/basic 각각의 필수 필드 누락 케이스(3~4개) 를 추가하거나, `http-credentials.ts` 전용 `.spec.ts` 를 신설해 순수함수인 `resolveHttpCredentials` 를 직접 테스트한다(mock 불필요라 비용이 낮다).

- **[INFO]** `clampMessage` 의 `!raw → 'Unknown error'` 폴백 분기가 새 공유 유틸에서 테스트되지 않는다
  - 위치: `codebase/backend/src/modules/integrations/clamp-message.ts:11`
  - 상세: `clampMessage` 는 이번 PR 에서 `integrations.service.ts` 내부 함수에서 `database-connection-tester.ts`·`http-connection-tester.ts`·(기존) email 테스터가 공유하는 독립 모듈로 승격됐다. 그런데 두 신규 spec(`database-connection-tester.spec.ts`·`http-connection-tester.spec.ts`) 은 모두 "길이 제한(truncation)" 분기만 테스트하고, `raw` 가 falsy(`undefined` 또는 빈 문자열)일 때 `'Unknown error'` 를 반환하는 분기는 어느 호출자에서도 검증하지 않는다(`grep -rn "Unknown error"` 결과 clamp-message.ts 자신의 정의뿐). `err.message === ''` 인 Error(드문 경우지만 일부 드라이버가 발생시킴)가 들어오면 이 분기가 조용히 원본 메시지 대신 고정 문자열로 바꿔버리는데, 이를 깨는 뮤테이션(예: `'Unknown error'` 문자열 변경, `!raw` → `raw === undefined`)이 있어도 전체 테스트 스위트가 잡아내지 못한다.
  - 제안: 전용 `clamp-message.spec.ts` 를 하나 추가해 (1) `undefined` → `'Unknown error'`, (2) 빈 문자열 → `'Unknown error'`, (3) 정확히 상한 길이 경계값, (4) 상한 초과를 표로 묶어 테스트한다. 순수 함수라 비용이 매우 낮다.

- **[INFO]** 새로 추출된 순수 모듈 3개에 전용 spec 파일이 없다 — 커버리지는 간접적으로만 확보된다
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-connection.ts`, `codebase/backend/src/nodes/integration/http-request/http-credentials.ts`, `codebase/backend/src/nodes/integration/http-request/http-redirect.ts`
  - 상세: 세 모듈 모두 "노드 실행과 연결 테스터가 같은 로직을 쓰게" 하려고 의존성 없는 순수 함수로 새로 분리됐다(각 파일 상단 주석에 그 의도가 명시돼 있음). 현재는 오직 두 소비자(handler, connection-tester)의 spec 을 통해서만 간접적으로 커버되는데, 이는 실제로 잘 동작한다(예: `buildPgConnection`/`buildMysqlSsl` 의 `require`/`verify-full` SSL 매핑은 `database-query.handler.spec.ts` 가, `MAX_REDIRECT_HOPS` off-by-one 은 `http-request.handler.spec.ts` + `http-connection-tester.spec.ts` 양쪽이 커버). 다만 두 소비자 중 하나가 리팩터로 깨져도 "어느 모듈이 문제인지"를 스택트레이스로만 좁혀야 하고, 모듈 자체의 계약(순수 입출력)을 문서화하는 테스트가 없다.
  - 제안: 필수는 아니나, 세 모듈이 "공용 SoT" 로 설계된 의도를 반영해 최소한의 직접 spec(특히 `http-credentials.ts` 는 위 WARNING 과 겹치므로 우선순위 높음)을 두면 향후 회귀를 더 빠르게 국소화할 수 있다.

## 잘 짜여진 부분 (참고)

- `database-connection-tester.spec.ts`/`http-connection-tester.spec.ts` 는 성공·SSRF 차단·인증 실패·그 외 연결 실패·타임아웃·닫기 실패(`finally`) 를 pg/mysql 양쪽 드라이버에 대해 `it.each` 로 대칭적으로 커버하고, 리다이렉트 추종·초과(off-by-one, `MAX_REDIRECT_HOPS + 1` 로 정확한 경계 검증)·리다이렉트 대상의 SSRF 차단(URL 가드·DNS 가드 각각)까지 별도 케이스로 나눠 검증한다. `pg.end()`/`mysql.end()` "닫기 실패해도 결과를 바꾸지 않는다" 케이스는 리소스 누수 방지 로직에 대한 좋은 회귀 테스트다.
- `integrations.service.spec.ts` 의 동시 실행 상한 테스트(`CONNECTION_TEST_MAX_CONCURRENCY`)는 mock 을 수동으로 pending 시켜 `peak` 동시 실행 수를 실측하고, 상한 해제 후 다음 대기 작업이 순서대로 시작되는지까지 확인한다 — 인위적 지연이나 `setTimeout` 경합 없이 결정적으로 짜여 있고, `finally` 로 mock 을 리셋해 다른 테스트로의 오염을 막는다(테스트 격리 양호).
- `rotate` 의 부분 컬럼 저장 회귀는 `Object.keys(saved).sort()` 로 저장 페이로드의 컬럼 화이트리스트를 정확히 단언해, 향후 "전체 엔티티 저장으로 되돌리는" 회귀를 확실히 잡는다. e2e 쪽(`integration-connection-test.e2e-spec.ts` E)도 부분 객체 저장에서 TypeORM 컬럼 암호화 transformer 가 실제로 걸리는지를 평문 미노출 단언까지 포함해 확인한다 — unit mock 만으로는 검증 불가능한 지점을 e2e 로 정확히 메웠다.
- `PreviewTestResultDto.code?` 신규 선언은 `assertMatchesContract(result, await contractForDto(PreviewTestResultDto))` 로 두 실패 케이스(DB_AUTH_FAILED·HTTP_BLOCKED)에서 계약 검증까지 배선돼 있어, DTO 선언 누락이 재발하면 즉시 RED 가 된다.
- plan 문서(`plan/in-progress/integration-db-http-testers.md`)에 뮤테이션 테스트 실측표(10+14+3개 뮤턴트, 생존 1건은 동치 뮤턴트로 판별 근거까지 기록)가 있어 이 리뷰가 직접 재현하지 않아도 분기 커버리지 주장을 신뢰할 근거가 된다.

## 요약

Database·HTTP 연결 테스터 본체(성공/실패/SSRF/리다이렉트/타임아웃/동시성/원자적 rotate 저장)에 대한 테스트는 unit·e2e 모두 매우 촘촘하고, mock 사용도 실제 드라이버 에러 shape 을 반영해 적절하며, 테스트 격리·가독성도 양호하다. 다만 이번 PR 이 재사용을 위해 새로 독립시킨 두 공용 모듈(`http-credentials.ts` 의 `INTEGRATION_INCOMPLETE` 세 분기, `clamp-message.ts` 의 `'Unknown error'` 폴백)은 정작 그 자신에 대한 직접 테스트가 없고, 두 소비자(handler·tester) 스펙 어디에서도 exercise 되지 않는 갭이 있다 — 특히 `http-credentials.ts` 쪽은 공개 API(`preview-test`/`:id/test`)의 `code` 응답에 그대로 실리는 경로라 회귀 시 조용히 틀린 응답을 돌려줄 수 있다.

## 위험도
LOW
