# Cafe24 Testing Review (2026-05-16)

## Critical (위험한 갭 — 회귀 가능성 높음)

### [CRITICAL] refreshViaQueue — waitUntilFinished timeout 분기 미검증
- **위치**: `cafe24-api.client.spec.ts` — `queue-backed refresh` describe 블록
- **상세**: `refreshViaQueue` 의 catch 블록 (L371-388)은 두 가지 다른 이유로 실패할 수 있다. (1) worker 가 `markAuthFailed` 를 호출해 row 가 `error(auth_failed)` 상태인 경우 → `Cafe24AuthFailedError` throw. (2) timeout (`REFRESH_JOB_WAIT_TIMEOUT_MS`) 만료인데 row 가 여전히 `connected` 상태인 경우 → `Cafe24TransportFailedError` throw. 현재 테스트(`surfaces Cafe24AuthFailedError when worker marks integration as auth_failed`)는 케이스 (1)만 검증한다. 케이스 (2) — timeout 인데 `connected` 상태 — 는 단 하나의 케이스도 없다. 이 경로는 Redis 가 느릴 때 / Cafe24 API 가 느릴 때 실제로 발생하며, `TransportFailedError` 가 아닌 `AuthFailedError` 로 잘못 처리되거나 그 반대 위험이 있다.
- **제안**: timeout 후 DB row 가 `connected` (정상)인 케이스와 `error(other_reason)` 케이스를 각각 테스트 추가. `Cafe24TransportFailedError` 로 surfacing 되는지 검증.

### [CRITICAL] refreshViaQueue — `queue.add` 자체가 throw 하는 경우 미검증
- **위치**: `cafe24-api.client.spec.ts` — `queue-backed refresh` describe 블록
- **상세**: `refreshViaQueue` L352에서 `queue.add()` 가 실패(Redis 장애, 연결 끊김)하면 `Cafe24TransportFailedError` 가 surfacing 되어야 하는데, 현재 코드는 이 예외를 잡지 않아 원래 Error 가 그대로 propagate 된다. 이는 caller 의 error classification 과 맞지 않을 수 있으며 테스트가 없다.
- **제안**: `queue.add` 가 `new Error('ECONNREFUSED')` 를 throw 하는 케이스 테스트 추가. `call()` 이 어떤 에러 타입으로 reject 되는지 검증.

### [CRITICAL] refreshViaQueue — DB findOne null 반환 ('Integration vanished during refresh') 미검증
- **위치**: `cafe24-api.client.spec.ts` — `queue-backed refresh` describe 블록
- **상세**: 워커 성공 후 `findOne` 이 `null` 을 반환하는 경로(L393-397: `throw new Cafe24TransportFailedError('Integration vanished during refresh')`)가 테스트되지 않는다. 이 경로는 새 코드 경로로 실제 운영에서 integration 삭제 타이밍이 맞을 때 발생 가능.
- **제안**: `integrationRepo.findOne.mockResolvedValue(null)` (워커 성공 후 재조회) 케이스 추가. `Cafe24TransportFailedError` 로 reject 되는지 검증.

### [CRITICAL] Cafe24TokenRefreshProcessor — refreshAccessToken throw 후 BullMQ failed 마킹 흐름 미검증
- **위치**: `cafe24-token-refresh.processor.spec.ts`
- **상세**: `refreshAccessToken` 이 예외를 throw 하면 `process()` 가 그대로 re-throw 해 BullMQ 가 job 을 failed 로 마킹해야 한다. 현재 테스트는 `refreshAccessToken` 이 성공하거나 short-circuit 하는 케이스만 검증하고, `refreshAccessToken` 자체가 `Cafe24AuthFailedError` 를 throw 했을 때 `process()` 가 그 에러를 BullMQ 에 propagate 하는지(즉, `.catch()` 로 삼키지 않는지) 검증하는 테스트가 없다.
- **제안**: `cafe24ApiClient.refreshAccessToken.mockRejectedValue(new Cafe24AuthFailedError(...))` 케이스 추가. `processor.process(job)` 이 reject 되는지 검증. 이 흐름이 없으면 refresh 실패가 silently no-op 되는지 여부를 코드 리뷰만으로 확인해야 하는 위험이 있다.

### [CRITICAL] enqueueCafe24BackgroundRefresh — lastRotatedAt NULL 통합 제외 여부 미검증
- **위치**: `integration-expiry-scanner.service.spec.ts` — `enqueueCafe24BackgroundRefresh` describe 블록
- **상세**: 프로덕션 코드(`integration-expiry-scanner.service.ts` L185)에서 `lastRotatedAt: LessThan(cutoff)` 조건을 사용한다. TypeORM 에서 `LessThan` 은 SQL `< cutoff` 이고, NULL 은 비교에서 FALSE 로 평가되므로 `lastRotatedAt IS NULL` 인 통합은 **제외**된다. 이는 아직 한 번도 refresh 된 적 없는 신규 통합(예: 최초 OAuth 완료 직후)이 backgroundRefresh 대상에서 누락될 수 있음을 의미한다. 이 의도(NULL = 미대상)가 spec 과 일치하는지 테스트로 명시되어 있지 않다. NULL 이 포함되어야 한다면 `Or(LessThan(cutoff), IsNull())` 수정이 필요하고, 제외가 올바르다면 그 의도를 테스트로 문서화해야 한다.
- **제안**: `lastRotatedAt: null` 인 connected cafe24 통합이 enqueue 대상인지 아닌지를 명시하는 테스트 추가. 현재 스캐너 cutoff 조건과 실제 동작을 고정.

### [CRITICAL] enqueueCafe24BackgroundRefresh — status='error' 통합 제외 여부 미검증
- **위치**: `integration-expiry-scanner.service.spec.ts` — `enqueueCafe24BackgroundRefresh` describe 블록
- **상세**: 프로덕션 쿼리는 `status: 'connected'` 를 조건으로 걸지만, `status='error'` 인 통합이 cutoff 를 만족할 때 완전히 제외되는지 테스트가 없다. 잘못된 쿼리 수정이 이 케이스를 활성화시킬 경우 이미 `auth_failed` 상태인 통합을 백그라운드 refresh 큐로 넣어 reauthorize UX 흐름과 충돌할 수 있다.
- **제안**: `status='error'` 인 cafe24 통합 row 를 `find` mock 에 포함시키고 enqueue 되지 않음을 검증하는 테스트 추가.

---

## High (커버리지 갭)

### [WARNING] refreshViaQueue — status='error' but statusReason != 'auth_failed' 케이스 미검증
- **위치**: `cafe24-api.client.spec.ts` — `surfaces Cafe24AuthFailedError when worker marks integration as auth_failed`
- **상세**: 현재 테스트는 `statusReason === 'auth_failed'` 조건만 검증한다. L380-386 에서 `fresh.statusReason !== 'auth_failed'` 이면 `Cafe24TransportFailedError` 가 throw 된다. 예를 들어 미래에 `statusReason = 'rate_limited'` 처럼 다른 이유로 error 상태가 되는 경우 TransportError 로 처리되는지 명시적 테스트가 없다.
- **제안**: waitUntilFinished reject + `status='error', statusReason='network_timeout'` 케이스 추가. `Cafe24TransportFailedError` 가 throw 됨을 검증.

### [WARNING] handleInstall — pending_install status 이후의 OAuth flow 상태 전이 미검증
- **위치**: `integration-oauth.service.cafe24.spec.ts` — `handleInstall` describe 블록
- **상세**: `handleInstall` 이 `pending_install` row 를 찾으면 OAuth authorize URL 로 redirect 하는 경로(`stateRepo.save` 가 `mode='reauthorize'` 로 생성)는 테스트된다. 그러나 `pending_install` 이 recovery 경로에서 처리될 때 `integrationId` 가 state 에 올바르게 기록되어 `handleCallback` 이 이후에 행 찾기에 성공하는지 end-to-end 연결은 테스트되지 않는다.
- **제안**: `handleInstall` 반환 URL + `stateRepo.create` 인자에서 `integrationId` 가 `pending_install` row 의 ID 와 일치하는지 검증하는 어설션 추가.

### [WARNING] Cafe24ApiClient 재시도 횟수 — 2회 429 retry 후 3번째에 성공하는 경우
- **위치**: `cafe24-api.client.spec.ts` — `rate limiting` describe 블록
- **상세**: 현재 테스트는 첫 번째 429 → 두 번째 성공 (1 retry) 과 3회 모두 429 (MAX_RATE_LIMIT_RETRIES 도달) 두 케이스를 테스트한다. 정확히 2번째 retry(=마지막 허용 retry)에서 성공하는 경우 — `res.retries === 2` — 가 누락되어 있다. 경계값(attempt === MAX_RATE_LIMIT_RETRIES - 1 에서 성공)이 `retries` 카운터에 올바르게 반영되는지 불명확.
- **제안**: 2회 429 + 3번째 성공 케이스 추가. `res.retries === 2` 검증.

### [WARNING] Cafe24McpToolProvider — 동시 buildTools 두 번 호출 (multi-turn) 시 sidCount 정확성
- **위치**: `cafe24-mcp-tool-provider.spec.ts` — `cleanup` describe 블록
- **상세**: 코드 L177-180: `newForThisExecution` 가 false 이면 `retainSid` 를 호출하지 않는다. 그러나 `cleanup()` 은 항상 `releaseSid` 를 한 번만 호출한다. multi-turn AI Agent (같은 executionId 로 `buildTools` 가 두 번 호출) 에서 sidCount 가 올바른지 테스트가 없다. 잘못된 경우 두 번째 buildTools 가 sid 를 다시 retain 하지 않아 cleanup 후 matches 가 false 가 되어야 하는데 count 가 음수가 될 수 있다.
- **제안**: 같은 executionId 로 `buildTools` 를 두 번 호출 → `cleanup` 한 번 → `matches()` 가 false 가 되는지 검증하는 테스트 추가.

### [WARNING] Cafe24McpToolProvider — Cafe24TransportFailedError 에러 envelope 변환 미검증
- **위치**: `cafe24-mcp-tool-provider.spec.ts` — `execute` describe 블록
- **상세**: `classifyError` 에서 `Cafe24TransportFailedError` → `CAFE24_TRANSPORT_FAILED` 변환이 있으나(production 코드 L513-519), 이에 대한 테스트가 없다. `Cafe24AuthFailedError`, `Cafe24RateLimitedError` 만 테스트됨.
- **제안**: `apiClient.call.mockRejectedValue(new Cafe24TransportFailedError(...))` 케이스 추가. `res.status === 'error'`, `code === 'CAFE24_TRANSPORT_FAILED'` 검증.

### [WARNING] Cafe24Handler — logUsage 가 실패해도 result 가 변하지 않는지 미검증
- **위치**: `cafe24.handler.spec.ts` — `execute — runtime` describe 블록
- **상세**: production 코드에서 `logUsage` 실패 처리 방식(throw or swallow)이 테스트되지 않는다. `logUsage` 가 throw 하면 handler 가 에러 포트를 반환하는지 아니면 성공 포트를 반환하는지 불명확.
- **제안**: `integrationsService.logUsage.mockRejectedValue(new Error('db down'))` 케이스 추가. 결과 port 가 success 인지 에러인지 명시.

### [WARNING] integration-oauth.service — provider_mismatch (state.provider != route provider) 분기 미검증
- **위치**: `integration-oauth.service.spec.ts` — `handleCallback` describe 블록
- **상세**: 점검 대상 12번 항목에서 요구된 `provider mismatch` 분기 — 예를 들어 state 가 `provider='google'` 인데 route 가 `cafe24` 콜백으로 들어오는 경우 — 에 대한 테스트가 없다. 이 분기가 production 코드에 존재하는지, 존재한다면 어떤 에러를 throw 하는지 테스트로 명시되지 않음.
- **제안**: state 의 `provider` 와 route `provider` 가 다른 경우 `BadRequestException` 이 throw 되는지 검증.

### [WARNING] enqueueCafe24BackgroundRefresh — serviceType 다른 통합이 cutoff 만족 시 제외 여부
- **위치**: `integration-expiry-scanner.service.spec.ts` — `enqueueCafe24BackgroundRefresh`
- **상세**: 쿼리가 `serviceType: 'cafe24'` 필터를 갖고 있으나, 다른 serviceType(예: `google`)이 cutoff 를 만족해도 enqueue 되지 않는다는 것을 테스트하는 케이스가 없다. 쿼리 필터 오탈자 수정 시 회귀 감지 불가.
- **제안**: `serviceType: 'google'` row 를 find mock 에 포함시키고 enqueue 되지 않음을 검증.

---

## Medium / 개선

### [INFO] Cafe24ApiClient 6인자 생성자 — 테스트 fixture burden
- **위치**: `cafe24-api.client.spec.ts` L76-82, L539-550
- **상세**: `Cafe24ApiClient` 의 6개 인자(repo, dataSource, fetch, sleep, queue, queueEvents)로 인해 두 개의 별도 beforeEach 블록이 필요하다(queue 없는 클라이언트 vs queue 있는 클라이언트). 큐 있는 경로 테스트에서 queueEvents 는 `{}` 로 전달되고 실제 BullMQ `QueueEvents` 와 형상 차이가 있다. `waitUntilFinished` 를 `queue.add` 가 반환하는 job 객체에서 mock 으로 직접 제공하는 방식이라 실제 `QueueEvents` 와의 API 차이가 false-positive 를 만들 수 있다.
- **제안**: `refreshQueue` + `refreshQueueEvents` 를 단일 `RefreshQueueAdapter` 인터페이스로 묶으면 테스트 fixture 단순화 가능. 단기 개선: `makeQueuedClient()` 헬퍼 함수로 중복 setup 코드 추출.

### [INFO] __resetCafe24LocksForTesting 호출 일관성
- **위치**: `cafe24-api.client.spec.ts` L58
- **상세**: 최상위 `beforeEach` 에서만 `__resetCafe24LocksForTesting()` 을 호출한다. `queue-backed refresh` 내부 `beforeEach` (L539)에서는 호출하지 않는다. 이 describe 블록의 `queuedClient` 는 별도 인스턴스이므로 잠금 Map 오염 위험은 낮지만, 테스트 순서 의존성 위험이 있다. 내부 `beforeEach` 에서도 호출하는 것이 명시적으로 안전.
- **제안**: `queue-backed refresh` describe 블록의 `beforeEach` 에 `__resetCafe24LocksForTesting()` 추가.

### [INFO] Mock 적절성 — sleep mock 의 jitter 검증 취약성
- **위치**: `cafe24-api.client.spec.ts` L198-203 (rate limiting)
- **상세**: jitter 검증을 `[7000, 7500)` 구간으로 하는데, `Math.random()` 이 mock 되지 않아 테스트가 실행될 때마다 다른 값이 나온다. 이 구간 검증은 실제로 7499ms 이상이면 통과하지 못하는데 표준편차가 충분히 작아 실패 확률이 낮지만 결정론적이지 않다. 또한 jitter 파라미터(`500ms`)가 변경되면 테스트가 조용히 지나칠 수 있다.
- **제안**: `Math.random` 을 mock 해 결정론적 jitter 검증, 또는 jitter 가 `[0, 500)` 범위임을 별도 수학적 검증으로 분리.

### [INFO] integration-expiry-scanner — run() 에서 status='error' 통합 처리 범위 검증 부재
- **위치**: `integration-expiry-scanner.service.spec.ts` — `run` describe 블록
- **상세**: `run()` 의 TypeORM 쿼리는 `status: Not(In(['expired', 'error']))` 이므로 `error` 상태 통합은 `tokenExpiresAt` 기반 알림 대상에서 제외된다. 이 동작(error 통합이 scan 대상이 아님)을 명시하는 테스트가 없다. `run` spec 에 `status='error'` 행을 포함한 케이스가 없어 해당 조건이 변경되면 조용히 회귀할 수 있다.
- **제안**: `status='error'` 통합이 run() 에서 무시되는지(count=0, save 미호출)를 검증하는 테스트 추가.

### [INFO] e2e 시나리오 — Cafe24 전용 e2e 테스트 없음
- **위치**: `/Volumes/project/private/clemvion/backend/test/` 디렉토리
- **상세**: `integration-credentials.e2e-spec.ts` 는 `http` serviceType 에 대한 e2e 만 검증하며, Cafe24 OAuth 플로우 전체(begin → handleInstall → handleCallback → consumePreviewToken → connected)에 대한 e2e 가 존재하지 않는다. 이는 BullMQ + Redis 인프라와 실제 PostgreSQL JSONB 저장이 맞물리는 경로를 전혀 통합 검증하지 않는다는 의미다.
- **제안**: 단기: private app의 `handleInstall → handleCallback` 경로를 위한 integration test (DB 포함, BullMQ mock). 중기: `docker-compose.e2e.yml` 에 Redis 포함 Cafe24 e2e 시나리오 추가. 우선순위 시나리오: (1) private app 정상 install 플로우, (2) HMAC 실패 시 403, (3) background refresh 큐 → 토큰 갱신 후 API 호출 성공.

### [INFO] PR #52 expires_at JSONB 미러 누락 회귀 테스트 보강
- **위치**: `integration-oauth.service.cafe24.spec.ts` L866-869 (`handleCallback — cafe24 stub flow`)
- **상세**: `credentials.expires_at` 미러 관련 회귀 테스트(`expect(typeof creds.expires_at).toBe('string')`)는 올바르게 있다. 그러나 이 회귀 보호는 `OAUTH_STUB_MODE=true` 경로에만 있고, real fetch path(`OAUTH_STUB_MODE` 미설정, L1074-1147)에서는 `credentials.expires_at` 가 저장되는지 확인하지 않는다. `cafe24 token exchange uses Basic auth ONLY` 테스트에서는 `creds.expires_at` 를 검증하지 않는다.
- **제안**: real fetch 경로 테스트에 `expect(typeof creds.expires_at).toBe('string')` 어설션 추가.

### [INFO] Cafe24MCP — execute 에서 toolCallId가 항상 응답에 포함되는지 검증 부재
- **위치**: `cafe24-mcp-tool-provider.spec.ts` — `execute` describe 블록
- **상세**: 에러 케이스(`CAFE24_MISSING_FIELDS`, `CAFE24_AUTH_FAILED`, `CAFE24_RATE_LIMITED`)에서 반환된 `AgentToolResult.toolCallId` 가 input `call.id` 와 일치하는지 검증하는 어설션이 없다. `toolCallId` 불일치는 AI Agent 대화 스레드에서 tool call 매칭 실패를 유발한다.
- **제안**: 에러 케이스 각각에서 `expect(res.toolCallId).toBe(call.id)` 어설션 추가.

---

## 종합 의견

Cafe24 통합 테스트 커버리지는 정상 경로(happy path)와 주요 오류 타입(AuthFailed, RateLimited, TransportFailed), OAuth 콜백 분기, HMAC 검증, private app 중복 방지, install_token recovery 등 주요 분기에 걸쳐 **상당히 높은 수준**이다. 특히 회귀 보호 목적의 주석이 달린 테스트들(`expires_at 미러 누락`, `Basic auth 전용`, `scope 배열 처리`, `post-install navigation`)은 실제 운영 버그를 명확히 고정하고 있어 가독성과 의도 표현 측면에서 모범적이다. 그러나 **BullMQ 큐 경로의 분기 커버리지에 구조적 갭**이 있다: `refreshViaQueue` 의 (1) `queue.add` 실패, (2) timeout 후 connected 상태, (3) 워커 완료 후 `findOne` null 반환 세 경로가 모두 미검증 상태로, 이 세 경로는 Redis 장애나 배포 타이밍 이슈 발생 시 실제로 트리거될 수 있는 운영 경로다. 또한 `enqueueCafe24BackgroundRefresh` 에서 `lastRotatedAt IS NULL` 통합 처리 의도가 테스트로 명시되지 않아 TypeORM `LessThan(null)` 의 실제 SQL 동작과 스펙 의도 사이에 잠재적 괴리가 있다. e2e 레이어에서 Cafe24 전용 시나리오가 전무한 점도 멀티 인스턴스 refresh race 보호와 BullMQ 통합 경로의 종단 간 검증 공백으로 남는다. 이 갭들을 고려할 때 **현재 테스트 스위트는 단위 테스트 품질은 HIGH, BullMQ 큐 통합 경로 커버리지는 LOW** 로 평가된다.

---

## 위험도

**HIGH** — BullMQ 큐 경로의 세 가지 미검증 분기가 운영 환경 Redis 장애나 타이밍 이슈에서 예측할 수 없는 에러 타입으로 surfacing 될 수 있으며, Cafe24TokenRefreshProcessor 의 throw propagation 미검증은 refresh 실패 시 BullMQ retry 정책이 의도대로 동작하는지 보장하지 못한다.
