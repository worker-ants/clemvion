# 요구사항(Requirement) 충족 리뷰 — Database · HTTP 연결 테스트

대상: `plan/in-progress/integration-db-http-testers.md` 구현분. `dispatchTest` 에 `database`·`http` transport tester 를 등록해
실제 접속으로 연결을 확인하고(spec `spec/2-navigation/4-integration.md` §5.3·§5.4·§9.2), rotate 부분 저장·닫기 상한·동시 상한(2)을
함께 도입한 변경.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` Database 연결 테스트의 대기 상한이 "연결"과 "쿼리" 각각 별도 10초인데, spec §5.4 본문은 "연결
  대기는 10초" 만 적어 쿼리 대기(추가 10초)를 언급하지 않는다.
  - 위치: `spec/2-navigation/4-integration.md:499` (spec) vs
    `codebase/backend/src/modules/integrations/database-connection-tester.ts:72-73`(`connectionTimeoutMillis` ·
    `query_timeout` 각각 `DB_TEST_TIMEOUT_MS`), `:96`(mysql2 `connection.query({ timeout: DB_TEST_TIMEOUT_MS })`).
  - 상세: 코드와 그 자신의 unit spec 이 이 설계를 명시적으로 의도한 것으로 확인된다 —
    `database-connection-tester.spec.ts:71` 테스트 이름 자체가 "10초 대기(연결 · 쿼리)" 라 적고, `MockedClient` 호출
    인자에 `connectionTimeoutMillis`·`query_timeout` 둘 다를 단언한다. `closeWithin` 의 docstring(`database-connection-tester.ts:29-33`)도
    "인증 뒤 멈춘 서버에 쿼리가 매달리는" 시나리오를 막으려는 의도임을 설명한다 — 연결만 막고 쿼리를 안 막으면 인증
    통과 후 응답 없는 서버에 대해 테스트가 사실상 무기한 대기했을 것이므로, 이 추가 타임아웃은 스펙이 뜻한 안전장치를
    실제로 완성한 것이다. 즉 **코드가 옳고 spec 본문이 그 정교화를 놓쳤다** — worst-case 대기가 10초가 아니라 최대
    20초(+ 닫기 유예 1초)라는 사실이 스펙 독자에게 드러나지 않는다.
  - 제안: 코드는 유지. `spec/2-navigation/4-integration.md §5.4` 의 "연결 대기는 10초" 문구를 "연결과 쿼리를 각각 최대
    10초까지 기다린다" 로 갱신할 것(반영은 `project-planner` 경로).

- **[INFO]** 이미 트래커에 등재된 항목 — 재조사 결과 새 결함이 아니라 알려진 gap 이므로 재플래그하지 않고 참고만 남김
  (모두 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 owner·rationale 과 함께 open 상태로 존재):
  - `rotate()` 가 테스트 실패를 `BadRequestException`(400, `INTEGRATION_TEST_FAILED`)으로 던지는데
    `spec/2-navigation/4-integration.md §9.4` 는 422 라고 적는다(`integrations.service.ts` rotate, 실제 400 코드는 이 diff
    이전부터 존재 — 이번 PR 로 이 코드 경로가 처음 자주 발생하게 됐을 뿐). 세부 `code`(`DB_AUTH_FAILED` 등)도 rotate 응답에는
    실리지 않고 `INTEGRATION_TEST_FAILED` 로 뭉개진다 — followups 4760행에 정확히 이 상태로 등재돼 있다.
  - 신규 `DB_CONNECT_FAILED` 가 기존 노드 런타임 `DB_CONNECTION_ERROR`(`codebase/backend/src/nodes/core/error-codes.ts:32`)와
    철자가 거의 같은데 모집합이 반대(기존은 인증 실패 포함, 신규는 `DB_AUTH_FAILED` 로 분리) — `naming_collision.md` WARNING,
    followups 미등재 확인했으나 spec §5.4 본문(499행 근처)에 이미 "모집합이 다르다" 는 대비 문장이 반영돼 있어(§5.4:
    "`DB_CONNECT_FAILED` 는 노드 런타임의 `DB_CONNECTION_ERROR` … 와 모집합이 다르다") 실질적으로 해소된 상태다.
  - spec §5.3 필드 표는 `auth_type` 값으로 `none`/`api_key`/`bearer`/`basic` 을 나열하지만 실제
    `service-registry.ts:470-497`(`http` 서비스)에는 `none` variant 자체가 없고(`api_key`·`bearer_token`·`basic` 만 등록),
    `bearer` 도 실제로는 `bearer_token` 이다 — followups 4773행에 "none·default_headers 가 레지스트리에 없다" 로 이미 등재.
    `resolveHttpCredentials`(`http-credentials.ts`)의 `case 'bearer_token'` 자체는 레지스트리 실제 값과 일치하므로 이 PR 의
    코드 결함은 아니고, spec 표기(`bearer`) 쪽이 낡은 것으로 보인다.
  - HTTP 4xx(401/403 제외) 성공-but-미확인 안내 메시지가 등록 마법사·상세 페이지 어느 쪽에서도 사용자에게 노출되지 않는다
    (`test-step.tsx`/`integrations/[id]/page.tsx` 가 고정 토스트로 덮어씀) — followups 4788행에 UX 결정 대상으로 이미 등재.
  - `preview-test` 가 워크스페이스/역할 검사 없이 인증된 사용자에게 임의 host 로의 실접속 오라클이 된다는 점 —
    `/ai-review 13_58_22` security WARNING 으로 이미 등재, followups 4799행에 결정 대기.

## 정합성 확인 — 문제 없음으로 판정한 항목 (검토 흔적)

- **SSRF 우회 가능성 점검**: `testDatabaseConnection` 의 `if (creds.host)` 가드는 `host` 가 빈 문자열이면 SSRF 검사를
  건너뛰지만, `dispatchTest`(`integrations.service.ts:1536`)가 `validateCredentials` 를 항상 먼저 호출해 빈 문자열도
  "필수 필드 없음" 으로 거부한다(`service-registry.ts:806`, `value === ''` 를 미충족으로 처리) — 세 호출 경로
  (preview-test·`:id/test`·rotate) 모두 `dispatchTest` 를 거치므로 실제 우회 경로 없음.
- **리다이렉트 홉 계수**: `followRedirectsSafely`(`http-redirect.ts`) 의 `hops>=MAX_REDIRECT_HOPS` 체크가 홉을 팔로우하기
  *전* 에 걸려 있어 정확히 5홉을 따라가고 6번째에서 차단한다 — unit spec(`http-connection-tester.spec.ts:296-304`,
  `fetch` 호출 6회 단언) 과 handler 회귀 테스트(`http-request.handler.handler.spec.ts:1156`, 같은 6회 단언)가 off-by-one
  없음을 뮤테이션 감도까지 확인.
  (오탈자 정정: 파일명은 `http-request.handler.spec.ts`.)
- **동시 상한 배선**: `CONNECTION_TEST_MAX_CONCURRENCY=2` 가 `dispatchTest` 의 tester 호출 지점 한 곳
  (`integrations.service.ts:1545`)을 감싸 mcp·email·database·http 넷 모두에 균일 적용됨을 확인 — CHANGELOG 주장과 일치.
- **rotate 부분 저장**: `{ id, ...changes }` 로만 `save` 하고 `Object.assign(entity, changes)` 로 응답을 구성 — 동시
  `logUsage` 의 원자적 `lastUsedAt` UPDATE 를 되돌리지 않는다는 주석의 주장을 unit(`integrations.service.spec.ts`
  "테스트 동안 logUsage 가 쓴 lastUsedAt 을 옛 값으로 되돌리지 않는다") + e2e(`integration-connection-test.e2e-spec.ts` E)
  양쪽이 실측으로 뒷받침.
- **HTTP Request 노드 리팩터 등가성**: `http-request.handler.ts` 에서 인라인이던 리다이렉트 루프·`buildHttpCredentials`
  본문이 `followRedirectsSafely`/`resolveHttpCredentials` 로 옮겨졌을 뿐 조건(`authentication === 'integration'` 게이트,
  실패 시 `IntegrationError` 로 변환)과 5홉 상한이 그대로 보존됐다 — 동작 변경 없는 순수 추출.
- **드라이버 인증 판별**: PG `/^28[0-9A-Z]{3}$/`(SQLSTATE class 28), MySQL
  `ER_ACCESS_DENIED_ERROR`/`ER_DBACCESS_DENIED_ERROR` 판별이 spec §5.4 문구와 정확히 일치, 그 밖은 `DB_CONNECT_FAILED` 로
  귀결 — unit spec 이 두 드라이버 각각 인증/비인증 실패를 모두 표로 커버.
- **반환값 완전성**: `testDatabaseConnection`/`testHttpConnection`/`followRedirectsSafely` 세 함수 모두 모든 분기에서
  `Promise<IntegrationTestResult>`(또는 `RedirectOutcome`) 를 반환하며 undefined 로 빠지는 경로가 없다. TODO/FIXME/HACK/XXX
  주석은 diff 전체에서 0건(`git diff codebase/ | grep TODO\|FIXME\|HACK\|XXX` 0건).
- **DTO 계약**: `PreviewTestResultDto.code?: string` 신설이 `TestConnectionResultDto` 와 같은 필드로 맞춰졌고,
  `assertMatchesContract` 로 preview 실패 두 경로(Database·HTTP)를 배선해 뮤턴트(필드 제거) 시 RED 가 됨을 plan 실측이
  뒷받침한다 — 오래 열려 있던 `spec-draft-nullable-notation-followups.md` WARNING#1 을 정확히 닫는다.

## 요약

Database·HTTP 연결 테스트 구현은 spec §5.3·§5.4·§9.2 의 상태 코드·SSRF 처리·리다이렉트 추종·타임아웃·"확인 못 함" 4xx 안내 ·
`base_url` 부재 처리 등 행위 명세와 line-level 로 정확히 일치하며, 구조 검증 선행으로 인한 SSRF/필수필드 우회 가능성도
실제로는 막혀 있음을 호출 경로 추적으로 확인했다. rotate 의 부분 컬럼 저장·동시 상한 2·닫기 그레이스 등 이전 리뷰 라운드가
지적한 결함들도 이번 커밋에서 전용 유닛/e2e 로 재현·고정돼 있다. 유일한 신규 발견은 SPEC-DRIFT 성격의 문서 갭 하나
(Database 쿼리 타임아웃이 spec §5.4 본문에 미반영, 코드·테스트는 의도적으로 옳다)이며, 그 밖에 발견한 문서-코드 불일치
(rotate 400 vs spec 422, `bearer` vs `bearer_token`, HTTP `none` auth 미등록, 4xx 안내 미노출, preview-test 오라클 위험)는
모두 이미 `spec-draft-nullable-notation-followups.md` 에 owner·rationale 과 함께 등재된 기지(旣知) 항목이라 재차 CRITICAL 로
격상하지 않았다. 기능 완전성·엣지 케이스·에러 시나리오·반환값 관점에서 이 diff 자체가 새로 도입한 결함은 발견되지 않았다.

## 위험도

LOW
