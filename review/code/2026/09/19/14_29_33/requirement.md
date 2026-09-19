# 요구사항(Requirement) 리뷰 — Database · HTTP 연결 테스트

## 발견사항

- **[INFO]** spec §5.4 본문이 쿼리 대기(10초)를 명시하지 않는다 — 코드·CHANGELOG·사용자 가이드는 "연결 10초 + 쿼리 10초"를 명시적으로 구현·서술하는데, spec 문장은 "연결 대기는 10초"만 적고 `SELECT 1` 자체의 대기 상한은 언급하지 않는다.
  - 위치: `spec/2-navigation/4-integration.md` §5.4 "테스트: 저장된(또는 입력한) 자격증명으로 **일회성 연결**을 열어 `SELECT 1` 을 실행하고 닫는다. 연결 대기는 10초." 문장 / 코드는 `codebase/backend/src/modules/integrations/database-connection-tester.ts:40-41`(`connectionTimeoutMillis`·`query_timeout` 각 `DB_TEST_TIMEOUT_MS`), `:62-64`(mysql `connectTimeout` + `query({..., timeout})`)
  - 상세: 실제 동작(연결 10초 + 쿼리 10초, 최대 20초 대기 가능)은 CHANGELOG.md(`Database — 일회성 연결을 열어 SELECT 1 을 실행하고 닫는다(연결 · 쿼리 각 10초)`)와 `integration-management.mdx`(+en) 가이드(`Database waits up to 10 seconds each for the connection and for SELECT 1`)에는 정확히 반영돼 있으나, spec 본문 문장 자체는 "연결 대기"만 언급해 쿼리 쪽 상한이 spec 만 읽으면 드러나지 않는다. 코드가 틀린 것은 아니고(오히려 인증 뒤 멈춘 서버에 대비하는 합리적 설계, plan 문서에도 그 의도가 적혀 있음), spec 문장이 서술을 덜 한 회색지대에 가깝다.
  - 제안: 코드 변경 불필요. spec 반영 시(§5.4) "연결·쿼리 각 10초"로 문장을 보강하는 편집을 고려(수정은 project-planner 몫).

- **[INFO]** 이미 같은 PR 의 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 등재·추적 중인 항목들(재-flag 불필요, 확인만): (1) rotate 실패 응답 상태 코드 400 vs spec 422 vs `5-system/11-mcp-client.md` 400 불일치 — e2e D 는 의도적으로 상태 코드를 미단언, (2) `resolveHttpCredentials` 가 `none` 인증 케이스를 다루지 않음 — 서비스 레지스트리에 `http`+`none` 변형이 없어 구조 검증 단계(`INTEGRATION_INVALID_SERVICE`)에서 먼저 걸러지므로 현재는 도달 불가, (3) `CONNECTION_TEST_MAX_CONCURRENCY=2` 대기열이 무제한 길이라는 잔여 위험, (4) 새 `DB_*`/`HTTP_*` 결과 코드가 프런트 지역화 사전(`backend-labels.ts`/`INTEGRATION_ERROR_CODE_TO_I18N`)에 없어 영문 원문이 그대로 노출되는 점, (5) HTTP 4xx(401·403 외)·`base_url` 없음의 "확인 못 함" 성공 메시지가 등록 Step3/`Test connection` UI 에서 버려지는 점. 다섯 모두 `plan/in-progress/spec-draft-nullable-notation-followups.md`(각 2026-09-19 등재분)에 owner·후속 조건과 함께 이미 기록돼 있어 이번 리뷰에서 새로 지적할 결함이 아니다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4760` 이하 신규 항목 6개
  - 상세/제안: 해당 없음(확인용 기재).

## 점검한 것 (결함 없음 확인)

- **Database 테스터** (`database-connection-tester.ts`): SSRF 가드(`assertSafeOutboundHostResolved`, host 미해석 시 `DB_HOST_BLOCKED` — 원본 host/IP 는 `logger.warn` 에만, 클라이언트 메시지는 `DB_HOST_BLOCKED_MESSAGE` 일반화) → 조기 반환이라 이후 generic catch 로 안 새어 나감 → pg/mysql 프로브(연결 10s + 쿼리 10s, 반드시 `finally` 로 close, close 실패는 무시하고 결과 불변) → 인증 판별(`isAuthFailure`: PG SQLSTATE class 28 정규식 `^28[0-9A-Z]{3}$`, MySQL `ER_ACCESS_DENIED_ERROR`/`ER_DBACCESS_DENIED_ERROR`) → `DB_AUTH_FAILED`/`DB_CONNECT_FAILED` 분기, 메시지는 `clampMessage`. 노드(`database-query.handler.ts`)와 SSRF 가드·SSL 매핑(`buildPgConnection`/`buildMysqlSsl`, `database-connection.ts`)을 공유해 "테스트 통과 = 실행 성공" 전제가 깨지지 않는다. driver 기본값(`?? 'postgres'`)도 구조 검증(`missingDbFields`)이 선행돼 실질적으로 안전.
- **HTTP 테스터** (`http-connection-tester.ts`): `resolveHttpCredentials`(구조 검증 실패 → `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED`) → `base_url` 없음 시 호출 없이 성공+안내 → 형식 오류 URL 은 `HTTP_CONNECT_FAILED`(SSRF 차단 문구와 구분) → preflight SSRF(`assertSafeOutboundUrl`+`assertSafeOutboundHostResolved`) → `fetch(redirect:'manual')` → `followRedirectsSafely`(최대 5홉, 홉마다 SSRF 재검증, 노드 핸들러와 공유 모듈) → `classify`(401/403 `HTTP_AUTH_FAILED`, 5xx `HTTP_SERVER_ERROR`, 그 밖 4xx 성공+안내, 2xx/Location 없는 3xx 성공) → 타임아웃(`AbortSignal.timeout` 이 리다이렉트 체인 전체에 공유)·전송 실패는 `HTTP_CONNECT_FAILED`(원인 포함, `clampMessage`). spec §5.3 결과 매트릭스와 line-level 로 일치.
- **리다이렉트 공유 모듈** (`http-redirect.ts`): `http-request.handler.ts`(노드 실행)와 `http-connection-tester.ts`가 같은 `followRedirectsSafely`/`MAX_REDIRECT_HOPS=5`를 사용 — 회귀 테스트(`http-request.handler.spec.ts` fetch 호출 6회 단언, `http-connection-tester.spec.ts` 동일 단언)로 hop 계산의 off-by-one 이 없음을 확인. 실제로 `npx jest`로 두 spec 을 실행해 208개/44개 테스트 모두 통과 확인.
- **동시성 상한** (`integrations.service.ts` `CONNECTION_TEST_MAX_CONCURRENCY=2`, `pLimit`): `dispatchTest` 의 `transportTesters`(mcp·email·database·http) 경로에만 적용, `entityTesters`(cafe24·makeshop)는 범위 밖 — CHANGELOG·주석의 서술과 일치. `IntegrationsService` 는 기본 스코프(싱글턴)라 "프로세스 전체 상한"이라는 문서 주장과 실제가 맞는다. `integrations.service.spec.ts` 의 동시성 테스트(peak == 2, 큐잉 순서)로 실측.
- **rotate 부분 저장** (`integrations.service.ts` `rotate()`): 엔티티 전체 `save()` 대신 `{id, ...changes}` 부분 객체 저장 + `Object.assign(entity, changes)` 로 응답 재구성 — 동시 `logUsage` 의 원자적 `update` 가 되돌아가는 문제를 해소. unit(`저장 컬럼 6개만`) + e2e(`E. rotate 성공` — 부분 저장에도 암호화 transformer 가 걸리는지 실제 DB 로 확인)로 검증됨.
- **DTO 계약**: `PreviewTestResultDto.code?: string` 신규 선언 + `assertMatchesContract` 두 곳(Database·HTTP) 배선 — 오래된 "값은 있는데 선언이 없다" 드리프트가 이 PR 에서 닫혔고, `spec-draft-nullable-notation-followups.md:3591-3596` 에 처분 근거가 함께 기록됨.
- **spec fidelity**: `spec/2-navigation/4-integration.md` §5.3/§5.4/§9.2/§14.1/Rationale 변경분과 코드를 대조 — 결과 코드 이름(`DB_HOST_BLOCKED`/`DB_AUTH_FAILED`/`DB_CONNECT_FAILED`/`HTTP_AUTH_FAILED`/`HTTP_SERVER_ERROR`/`HTTP_CONNECT_FAILED`/`HTTP_BLOCKED`), 기본값 없음(모든 필드 구조 검증 선행), 타임아웃(10초), 리다이렉트 5홉, "그 밖 4xx 는 성공" 규칙, `base_url` 빈 값 처리, SSRF 메시지 일반화 원칙까지 line-level 로 일치. §9.2 preview-test 행의 "실제 호출: Email·MCP·HTTP·Database / 구조 검증만: Cafe24·MakeShop·Google·GitHub·Webhook" 서술과 `integrations.controller.ts` JSDoc/Swagger 설명 갱신도 일치.
- **TODO/FIXME**: 신규 파일(`clamp-message.ts`, `database-connection-tester.ts`, `http-connection-tester.ts`, `http-redirect.ts`, `http-credentials.ts`, `database-connection.ts`) 및 `integrations.service.ts` diff 에 TODO/FIXME/HACK/XXX 없음(grep 확인).
- **회귀 방지**: `integration-cache-invalidate.e2e-spec.ts`(rotate 가 이제 실제 HTTP 를 걸므로 fixture 에서 `base_url` 제거 — 대상은 broadcast 라 무관), `integration-connection-test.e2e-spec.ts`(A~E, 사설 host/loopback 이 preview-test·`:id/test`·rotate 세 경로 모두에서 막힘 + rotate 성공 시 부분 저장 확인) 신규 e2e 로 배선 검증.

## 검증 방법

- `Read`/`Grep` 으로 신규 6개 모듈 전문과 `integrations.service.ts`/`integrations.controller.ts`/DTO/스펙 diff 전체를 대조.
- `npx jest`(backend, mutation 없이 실행만) 로 `database-connection-tester.spec.ts`+`http-connection-tester.spec.ts`(44 passed), `integrations.service.spec.ts`+`http-request.handler.handler.spec.ts`(208 passed) 확인. 저장소 파일은 수정하지 않았음 — `git status --short` 로 세션 시작 전 상태(`plan/in-progress/integration-db-http-testers.md` M, 리뷰 산출물 두 디렉터리 `??`)와 동일함을 확인, 내가 추가한 변경 없음.

## 요약

Database·HTTP 연결 테스터 신규 구현은 `spec/2-navigation/4-integration.md` §5.3·§5.4·§9.2·§14.1 및 Rationale 신설 항과 결과 코드·타임아웃·리다이렉트 홉 수·SSRF 가드·기본값 없음(구조 검증 선행)까지 line-level 로 일치한다. 이전 리뷰 라운드에서 지적된 동시성 상한 부재·rotate 전체 엔티티 덮어쓰기·리다이렉트 로직 중복은 이번 커밋(`eebf0286a`)에서 `pLimit(2)`·부분 컬럼 `save`·공유 `followRedirectsSafely` 로 모두 해소됐고 unit·e2e 양쪽에서 실측 검증됐다. TODO/FIXME 잔존이나 반환값 누락, 에러 시나리오 미정의는 발견되지 않았다. 유일한 미세 간극은 spec §5.4 문장이 "연결 대기 10초"만 언급하고 쿼리 대기 10초는 명시하지 않는 점인데(코드·CHANGELOG·가이드는 정확히 서술) 기능 결함이 아닌 spec 서술 보강 대상(INFO)이며, 그 밖에 이미 이 PR 자체가 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재해 둔 다섯 건(동시성 큐 무제한, DNS 스레드풀 잔여 위험, 지역화 사전 누락, "확인 못 함" UX 미노출, rotate 상태 코드 spec 간 불일치)은 이미 추적 중이라 재지적하지 않았다.

## 위험도

NONE
