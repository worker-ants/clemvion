# 테스트(Testing) 리뷰 — Database · HTTP 연결 테스터

## 검증 방법

- 프롬프트 diff + 저장소 원본(`Read`)을 대조. 프롬프트 크기 제한으로 생략된 `database-connection-tester.spec.ts` · `http-connection-tester.spec.ts` 전문과 `integrations.service.spec.ts` diff(`git diff 74087dff6 --`)는 직접 열어 확인.
- 저장소 트리는 **읽기 전용**으로만 사용(뮤테이션 없음). `npx jest`로 신규/영향 spec을 실행해 GREEN 확인(아래 §실행 결과). Write/Edit 도구를 이 세션에서 호출하지 않았으므로 원복 이슈 없음.
- 리뷰 도중 `git status --short`에 `plan/in-progress/integration-db-http-testers.md`가 `M`으로 나타났다 — 이 세션이 만든 변경이 아니다(diff 확인 결과 체크리스트 "TEST WORKFLOW" 항목을 `[x]`로 갱신한 것으로, 병행 중인 developer 세션의 정상 진행으로 보인다). 코드 결함이 아니므로 별도 조치하지 않았고, 관측한 그대로 기록만 남긴다.

## 실행 결과 (참고)

```
jest database-connection-tester.spec.ts http-connection-tester.spec.ts integrations.service.spec.ts
  Test Suites: 3 passed, 3 total / Tests: 174 passed, 174 total

jest http-request.handler.spec.ts database-query.handler.spec.ts http-safety.spec.ts (회귀, 이 PR에서 diff 없음)
  Test Suites: 3 passed, 3 total / Tests: 167 passed, 167 total
```

## 발견사항

- **[INFO]** `clampMessage`의 방어 분기(`!raw` → `'Unknown error'`)가 어느 호출부에서도 실제로 도달하지 않는 죽은 경로다.
  - 위치: `codebase/backend/src/modules/integrations/clamp-message.ts:11`
  - 상세: 두 테스터 모두 `err instanceof Error ? err.message : String(err)` 형태로 항상 문자열을 넘기므로(`database-connection-tester.ts:110`, `http-connection-tester.ts:183`) `raw`가 `undefined`이거나 빈 문자열인 경우가 실제로 발생하지 않는다. `database-connection-tester.spec.ts`의 "드라이버 메시지는 길이를 제한한다" 테스트도 이 분기는 건드리지 않는다. 전용 `clamp-message.spec.ts`가 없어 이 분기가 의도대로 동작하는지(예: 향후 호출부가 늘어 실제로 `undefined`를 넘기게 됐을 때) 검증할 안전망이 없다.
  - 제안: 우선순위는 낮음(3줄짜리 순수 함수, 방어적 코드). 다만 이후 새 호출부가 추가될 가능성이 있다면 `clampMessage(undefined)` / `clampMessage('')` 를 직접 찌르는 짧은 spec 하나로 이 분기를 명시적으로 고정해 두는 편이 안전하다.

- **[WARNING]** HTTP 테스터의 메시지 클램프(`clampMessage`) 경로가 DB 테스터와 달리 unit spec에서 검증되지 않는다 — 대칭 커버리지 갭.
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:183` (`message: clampMessage(describeFailure(err))`) vs. `codebase/backend/src/modules/integrations/database-connection-tester.spec.ts:185-191`("드라이버 메시지는 길이를 제한한다")
  - 상세: DB 테스터 쪽은 드라이버 에러 메시지가 `MCP_ERROR_MESSAGE_MAX_LEN`을 넘으면 잘리는지를 명시적으로 단언하는 테스트가 있다(`x.repeat(MCP_ERROR_MESSAGE_MAX_LEN + 50)` → `toHaveLength(MCP_ERROR_MESSAGE_MAX_LEN)`). `http-connection-tester.spec.ts`에는 이 대칭 테스트가 없다 — "전송 실패는 HTTP_CONNECT_FAILED"(`http-connection-tester.spec.ts:156-169`)·"대기 초과"(`:171-183`) 테스트 모두 짧은 메시지만 사용한다. `last_error` JSONB 컬럼 팽창 방지가 이 함수의 명시된 목적(`clamp-message.ts:5`)인 만큼, HTTP 쪽에서 회귀가 생겨도(예: `clampMessage` 호출이 실수로 빠지는 뮤턴트) 이 spec 파일만으로는 못 잡는다. 실제로 plan(`plan/in-progress/integration-db-http-testers.md`)의 뮤테이션 표에도 HTTP 쪽 14개 뮤턴트 목록에 clamp 관련 뮤턴트가 없다 — 이 축은 애초에 뮤테이션 대상에도 없었다.
  - 제안: DB 테스터의 패턴을 그대로 이식 — 긴 에러 메시지(`describeFailure`가 반환할 법한 형태, 예: `TypeError` + `cause`)를 던지는 케이스 하나를 추가해 `result.message`가 `MCP_ERROR_MESSAGE_MAX_LEN`을 넘지 않음을 단언.

- **[INFO]** 새로 추출된 공유 순수 모듈(`database-connection.ts`, `http-credentials.ts`)에 전용 unit spec이 없다.
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-connection.ts`, `codebase/backend/src/nodes/integration/http-request/http-credentials.ts`
  - 상세: `buildPgConnection`/`buildMysqlSsl`/`DB_HOST_BLOCKED_MESSAGE`와 `resolveHttpCredentials`는 두 소비자(신규 테스터 spec, 기존 핸들러 spec — `database-query.handler.spec.ts`·`http-request.handler.spec.ts`, 이번 diff에 포함되지 않음)를 통해서만 간접적으로 커버된다. 두 소비자 모두 이 diff에서 회귀 없이 GREEN(§실행 결과)이라 현재는 문제 없지만, 순수 로직을 공유 모듈로 뽑아낸 설계 의도(plan 문서: "테스트가 노드와 다르게 붙이면 테스트 통과가 실행 성공을 뜻하지 않는다")를 생각하면 그 모듈 자체를 정면으로 겨냥하는 spec이 없다는 점은 — 두 소비자 spec이 우연히 같은 잘못된 가정을 공유할 경우 놓칠 여지를 남긴다.
  - 제안: 필수는 아님(TS 타입 + 두 소비자 교차검증으로 사실상 커버). 여력이 되면 `database-connection.spec.ts` / `http-credentials.spec.ts`를 얇게 하나씩 추가해 SSOT 모듈을 직접 문서화하는 것을 권장.

- **[INFO]** e2e(`integration-connection-test.e2e-spec.ts`)는 SSRF 차단 배선만 검증하고, 실제 pg/mysql2 드라이버로 성공적으로 연결하는 happy path는 어떤 계층에서도 라이브 소켓으로 검증되지 않는다.
  - 위치: `codebase/backend/test/integration-connection-test.e2e-spec.ts` (전체), `codebase/backend/src/modules/integrations/database-connection-tester.ts:37-50`(`probePostgres`)
  - 상세: e2e 환경이 `ALLOW_PRIVATE_HOST_TARGETS`를 켜지 않아(파일 상단 주석에 명시) 사설 host를 향한 A·C 케이스는 전부 `DB_HOST_BLOCKED`로 막히는 경로만 본다. 실제 `pg.Client`/`mysql2.createConnection` 옵션 형태가 맞는지는 unit spec의 mock 단언(`toHaveBeenCalledWith(...)`)과 TS 타입 체크로만 보증된다 — 이는 plan 문서에 의식적 트레이드오프로 이미 기록돼 있어(`plan/in-progress/integration-db-http-testers.md` "e2e" 절) 새로운 지적이라기보다 확인 차원의 기록.
  - 제안: 조치 불요(구조적으로 e2e 샌드박스가 사설 host를 항상 막아 대안이 마땅치 않음). 다만 향후 `pg`/`mysql2` 메이저 버전 업그레이드 시 옵션 키 이름이 바뀌는 회귀는 이 테스트 스위트로는 못 잡는다는 점을 인지하고 있을 필요.

- **[INFO]** e2e 테스트 D의 rotate 실패 상태 코드 단언이 범위(`>=400, <500`)로 느슨하다.
  - 위치: `codebase/backend/test/integration-connection-test.e2e-spec.ts:152-153`
  - 상세: spec 문서 간 400/422 불일치가 트래커로 넘겨진 상태라 의도적으로 정확한 코드를 단언하지 않는다(파일 상단 주석 및 plan에 명시). 테스트 자체의 결함이 아니라 알려진 갭의 정직한 반영.
  - 제안: 트래커 결정이 나면 이 단언을 정확한 상태 코드로 좁힐 것(이미 계획됨, 별도 조치 불요).

## 긍정적으로 평가할 점

- `database-connection-tester.spec.ts` · `http-connection-tester.spec.ts` 모두 분기(성공·SSRF 차단·인증 실패·일반 연결 실패·타임아웃·닫기 실패·리다이렉트 추종/초과/리다이렉트 대상 차단·4xx/5xx 경계값)를 빠짐없이 `it.each`로 표 형태로 커버하고, plan에 기록된 뮤테이션 테스트(DB 10개 전부 RED, HTTP 14개 중 13 RED·1 GREEN 동치 뮤턴트로 설명)로 실측 검증까지 돼 있다.
- 차단된 host/IP가 응답 메시지에 새지 않는지(`not.toContain('internal.db')`, `not.toContain('10.0.0.9')` 등)를 정보 유출 회귀 테스트로 명시적으로 잡고 있다 — 보안에 민감한 메시지 클램프 목적과 맞아떨어지는 좋은 테스트 설계.
- `jest.mock(..., () => ({ ...jest.requireActual(...), fnA: jest.fn() }))` 패턴으로 `SSRF_BLOCKED_CLIENT_MESSAGE` 같은 실제 상수는 mock하지 않고 그대로 가져와 assert함 — 문자열 하드코딩 중복으로 인한 drift 위험을 피했다.
- `integrations.service.spec.ts`에 추가된 4개 테스트가 `dispatchTest` 배선(preview-test·`:id/test`·rotate)과 `PreviewTestResultDto` 응답 계약(`assertMatchesContract`)까지 함께 검증해, DTO에 `code?` 필드를 추가한 변경(파일 4)의 회귀 안전망 역할을 한다.
- 기존 `http-request.handler.spec.ts`·`database-query.handler.spec.ts`·`integration-cache-invalidate.e2e-spec.ts`는 로직 추출/이동 리팩터링에도 diff 없이 그대로 GREEN — 공유 모듈 추출이 행동 보존적임을 실측으로 확인했다(§실행 결과).

## 요약

새로 추가된 Database·HTTP 연결 테스터는 unit spec 두 개가 성공·SSRF 차단·인증 실패·타임아웃·리다이렉트·상태 코드 경계값을 촘촘히 커버하고, plan에 기록된 뮤테이션 테스트로 실효성까지 확인됐다. `integrations.service.spec.ts`의 배선 테스트와 신규 e2e(`integration-connection-test.e2e-spec.ts`)가 dispatchTest 세 경로(preview-test·`:id/test`·rotate)의 SSRF 차단을 교차 검증하며, 기존 핸들러 spec들은 공유 모듈 추출 이후에도 회귀 없이 통과한다(직접 실행 확인). 유일하게 실질적인 갭은 HTTP 테스터 쪽에 DB 테스터와 대칭되는 메시지 클램프(길이 제한) 테스트가 빠져 있다는 점이며, 나머지는 방어적 죽은 코드·공유 순수 모듈의 간접 커버리지·e2e 환경 제약으로 인한 의식적 트레이드오프 수준의 INFO다.

## 위험도

LOW
