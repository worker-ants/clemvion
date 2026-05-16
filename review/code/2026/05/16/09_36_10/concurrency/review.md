# Cafe24 Concurrency Review (2026-05-16)

---

## Critical (race 가 실제 데이터 손상 / auth_failed 오격하로 이어짐)

### [C-1] waitUntilFinished 타임아웃 시 stale token 으로 API 호출 → 401 → markAuthFailed 오격하

**위치:** `cafe24-api.client.ts` L369–403 (`refreshViaQueue`), L615–631 (`executeWithRateLimit`)

**시나리오:**

1. Worker 가 정상적으로 refresh 를 완료해 DB 에 새 token 을 썼다.
2. `waitUntilFinished` 가 30s 타임아웃으로 reject 된다 (Redis 이벤트 누락, 네트워크 순간 단절).
3. `refreshViaQueue` 의 catch 블록은 DB 에서 integration 을 다시 읽는다 — 이 시점에 `status='connected'`, `statusReason=null` 이므로 auth_failed 분기를 타지 않는다.
4. 대신 `Cafe24TransportFailedError` 가 throw 된다 (L386).
5. 호출자 (`call()`) 는 이 에러를 그대로 올려보내고, 호출자의 catch 레이어가 transport error 로 처리한다.

**실제 문제:** L386 에서 throw 하기 전에 DB re-read 는 있다 (L377–385). `status !== 'error'` 이면 `TransportFailedError` 로 throw 한다. 이 자체는 markAuthFailed 를 트리거하지 않는다 — **여기까지는 오격하가 없다.**

그러나 **두 번째 경로**가 있다: worker 가 아직 실행 중인데 타임아웃으로 caller 가 먼저 timeout reject 를 받은 뒤, `integration.credentials` 는 갱신되지 않은 채 그대로 `executeWithRateLimit` 로 진입하면 old token 으로 Cafe24 를 호출하게 된다. Cafe24 가 401 을 반환하면 `executeWithRateLimit` L615 에서 `markAuthFailed` 가 호출된다. 이 시점에 worker 는 여전히 in-flight 상태일 수 있고, worker 가 성공적으로 refresh 를 마친 뒤 DB 에 `status='connected'` 를 쓰더라도 `markAuthFailed` 가 이미 `status='error'` 를 썼으면 **후속 API 호출이 모두 차단**된다.

더 정확히는, `waitUntilFinished` timeout → catch L371 → DB read L377 → `status='connected'` → TransportFailedError throw → `call()` 은 에러를 올려보내고 `executeWithRateLimit` 는 실행되지 않는다. 그러므로 401→markAuthFailed 경로는 **이 타임아웃 케이스에서는 직접 발생하지 않는다.**

하지만 timeout 이후 caller 가 새 `call()` 을 다시 시도하면 (재시도 로직이 있거나 새 workflow 실행) integration 의 in-memory reference 는 갱신되지 않았으나 DB 는 이미 refreshed 상태일 수 있다. `call()` 은 `withIntegrationLock` 내에서 `ensureFreshToken` 을 호출하므로 DB 에서 `findOne` 으로 재조회하지 않는 한 stale credentials 를 사용한다. **`call()` 이 integration 파라미터를 외부에서 받으므로, 이 파라미터가 캐시된 stale 객체면 refresh 가 완료된 후에도 old access_token 으로 401 을 유발할 수 있다.**

**재현 단계:**
1. 두 pod 이 같은 integration 에 대해 `call()` 을 거의 동시에 호출
2. Pod A 가 `refreshViaQueue` 로 job enqueue, worker 는 Pod B 에서 실행
3. Pod A 에서 `waitUntilFinished` 가 30s 타임아웃
4. Worker (Pod B) 는 2s 후 refresh 완료 → DB 에 새 token 저장
5. Pod A 는 TransportFailedError 를 반환 → 상위 재시도 로직이 stale `integration` 객체로 즉시 재호출
6. old access_token → 401 → `markAuthFailed` → `status='error'`
7. Pod B 가 쓴 새 token 은 DB 에 있으나 integration 상태는 `error(auth_failed)` 로 격하됨

**권장 fix:** `waitUntilFinished` timeout 시 catch 에서 DB re-read 를 하고, fresh 결과로 `integration` 객체를 갱신한 뒤 throw 하거나 (token 이 이미 새 것이면 throw 하지 않고 진행). 현재 L377–385 는 `status='error'` 만 확인하고 **token 갱신 성공 여부(tokenExpiresAt 변화)를 확인하지 않는다.** 다음을 추가:

```typescript
// timeout/transport error catch 내부
const fresh = await this.integrationRepository.findOne({ where: { id: integration.id } });
if (fresh && resolveTokenExpiry(fresh) !== null &&
    (resolveTokenExpiry(fresh)! - Date.now()) > REFRESH_WINDOW_MS) {
  // Worker 가 이미 refresh 완료 — 성공으로 처리
  integration.credentials = fresh.credentials;
  integration.tokenExpiresAt = fresh.tokenExpiresAt;
  integration.status = fresh.status;
  // throw 하지 않고 계속 진행
  return;
}
```

---

## High

### [H-1] jobId dedup + removeOnComplete(age:60) race — waitUntilFinished hang 가능성

**위치:** `cafe24-api.client.ts` L352–370 (`refreshViaQueue`)

**시나리오:**

1. Caller A 가 `queue.add({ jobId: integrationId })` 호출 → Job 이 enqueue 됨.
2. Worker 가 즉시 job 을 처리해 **60초 내**에 완료. `removeOnComplete: { age: 60 }` 에 의해 completed 상태로 60초간 유지.
3. Caller B 가 약 59초 후 `queue.add({ jobId: integrationId })` 호출 → BullMQ 가 completed job 의 jobId 를 재사용 불가로 보고 **새 job 을 생성**하거나 completed job 참조를 반환.
4. BullMQ 의 실제 동작: completed job 이 존재하면 같은 jobId 로 add 시 **새 job 이 추가되지 않고 completed job 의 참조를 반환** (BullMQ v5 동작). Caller B 는 이 참조에 `waitUntilFinished` 를 걸면 이미 completed 이므로 즉시 resolve 됨 — 이 자체는 안전.
5. **문제:** completed job 이 age 60 으로 이미 Redis 에서 제거된 직후에 Caller B 가 `queue.add` 를 호출하면 **새 job** 이 생성된다. Caller B 는 새 job 의 참조를 받아 `waitUntilFinished` 를 시작한다. 그런데 이 새 job 은 이미 token 이 fresh 한 상태 (60초 사이 refresh 완료)에서 worker 에 도달하면 processor 의 short-circuit (L95–101) 으로 `return` 한다. 이 경우 job 은 `completed` 상태로 정상 종료 → `waitUntilFinished` resolve 됨. 이 경우도 안전.
6. **실제 hang 경로:** QueueEvents 가 닫히거나 (shutdown 중) Redis 이벤트가 누락된 경우 `waitUntilFinished` 는 타임아웃까지 hang 한다. 이 자체는 C-1 에서 다뤘으나, `REFRESH_JOB_WAIT_TIMEOUT_MS` 값이 스펙에 명시되지 않고 상수 파일에서만 정의된다. 타임아웃이 짧으면 C-1 오격하 위험이 높아지고, 길면 Worker thread 가 idle block 된다.

**권장 fix:** `REFRESH_JOB_WAIT_TIMEOUT_MS` 값을 spec §10.5 에 명시. Worker 의 short-circuit 은 올바르게 구현되어 있음 — 변경 불필요.

---

### [H-2] source 'background' vs 'proactive' dedup race — source 검증 우회

**위치:** `cafe24-api.client.ts` L352–367 / `integration-expiry-scanner.service.ts` L200–210 / `cafe24-token-refresh.processor.ts` L85–90

**시나리오:**

1. 사용자가 통합을 활발히 사용 중 (`proactive` refresh 가 jobId로 enqueue 됨, 아직 worker pickup 전).
2. 백그라운드 스캐너가 같은 integrationId 에 대해 `source: 'background'` 로 `queue.add` 호출.
3. BullMQ dedup: 기존 `proactive` job 이 대기 중이므로 새 add 는 기존 job 참조를 반환 — **job data 는 `proactive` 그대로 유지** (나중에 add 된 data 가 기존 job 을 덮어쓰지 않는 것이 BullMQ 의 기본 동작).
4. Worker 가 job 을 처리할 때 `source = 'proactive'` 로 읽음 → L85 의 `source === 'background'` 조건 미해당 → `status !== 'connected'` 검증 없이 refresh 진행.
5. 반대 케이스: `background` job 이 먼저 enqueue 되고 `proactive` 가 나중에 add 되면, BullMQ 는 기존 `background` job 참조를 반환 → worker 는 `source='background'` 로 실행 → `status='connected'` 검증을 통과해야 refresh 진행.

**실제 위험:** `status='error'` 또는 `status='expired'` 인 integration 에 대해 `proactive` 가 먼저 enqueue 된 뒤 background 가 dedup 으로 같은 job 을 재사용하면, worker 는 `source='proactive'` 로 실행되어 status 검증을 건너뛴다. 이 통합에 대해 `refreshAccessToken` 이 호출되고, refresh_token 이 여전히 유효하면 `status='connected'` 로 자동 회복된다 — **사용자가 의도적으로 재인증 흐름을 기대하는 상황에서 refresh 로 우회될 수 있다.**

**권장 fix:** Processor 에서 source 와 무관하게 `status` 를 검증하는 대신, 두 source 를 모두 허용하되 `status` 검증을 `background` 전용으로 두고 `proactive` 는 **caller 측에서 이미 connected 임을 보장**한다. 또는 BullMQ `updateData` 를 사용해 나중에 add 된 job 의 `source` 를 병합하는 커스텀 방식 — 단, 이는 BullMQ API 범위를 벗어나므로 processor 측에서 양쪽 source 를 모두 처리하는 설계로 단순화하는 것이 낫다:

```typescript
// processor: source 무관하게 status 확인
if (fresh.status !== 'connected') {
  this.logger.log(`Refresh skipped: integration ${integrationId} status=${fresh.status}`);
  return;
}
```

---

### [H-3] handleCallback 의 transaction 내 findOne+save — READ COMMITTED 에서 lost update

**위치:** `integration-oauth.service.ts` L593–640

**시나리오:**

두 callback 이 서로 다른 OAuth state (별도의 `begin` 호출) 를 통해 같은 `integrationId` 를 거의 동시에 완료하는 경우 (예: 브라우저 탭을 두 개 열고 각각 reauthorize 흐름을 진행):

1. Tx A 시작: `findOne(integrationId)` → row 를 읽음.
2. Tx B 시작: `findOne(integrationId)` → **같은 row 를 읽음** (PostgreSQL READ COMMITTED 에서는 다른 트랜잭션의 미완료 write 가 보이지 않음).
3. Tx A: `save()` → token A 를 씀, commit.
4. Tx B: `save()` → token B 를 씀, commit. **Tx A 의 write 는 덮어씌워짐 (lost update).**

두 OAuth callback 이 모두 성공하면 DB 에는 마지막 write 의 token 만 남고, 앞선 callback 의 token 은 사라진다. Cafe24 는 token rotation 으로 앞선 token 을 무효화했을 가능성이 있어, 살아남은 token 도 실제로는 유효하지 않을 수 있다.

**실제 발생 확률:** state 소비가 `DELETE...RETURNING` 으로 원자적으로 처리되므로, 같은 state 로 두 callback 이 성공하는 것은 불가능. 그러나 두 개의 **별도 state** (두 번의 reauthorize begin) 가 같은 integrationId 를 참조하는 경우는 가능하다. 현재 code 에서는 `IntegrationOAuthState` 에 integrationId 는 있으나 "같은 integrationId 에 대한 중복 state 생성" 을 막는 로직이 없다.

**권장 fix:** transaction 내 findOne 에 pessimistic write lock 적용:
```typescript
const integration = await repo.findOne({
  where: { id: record.integrationId!, workspaceId: record.workspaceId },
  lock: { mode: 'pessimistic_write' },
});
```
또는 `integrationId` + `reauthorize mode` 에 대한 중복 state 생성을 `begin()` 에서 방지 (old state 가 있으면 upsert 또는 reject).

---

## Medium (이론적 가능성)

### [M-1] integrationLocks Map 의 cleanup race

**위치:** `cafe24-api.client.ts` L184–204 (`withIntegrationLock`)

**분석:**

```typescript
const tracked = next.catch(() => undefined);
integrationLocks.set(integrationId, tracked);
tracked.finally(() => {
  if (integrationLocks.get(integrationId) === tracked) {
    integrationLocks.delete(integrationId);
  }
}).catch(() => undefined);
```

Node.js 는 단일 스레드이므로 Promise microtask queue 처리 중에 선점이 없다. `finally` 콜백이 실행될 때 `integrationLocks.get(id) === tracked` 비교는 동기적으로 안전하다. 새 `call()` 이 먼저 `integrationLocks.set(id, newTracked)` 를 했으면 비교가 false 로 평가되어 delete 가 건너뛰어진다 — **설계대로 동작**.

그러나 **메모리 누수 가능성**: `tracked.finally(...).catch(...)` 체인은 새 Promise 객체를 생성하지만 어디에도 참조되지 않는다. Node.js GC 는 Promise 체인을 루트 없이도 alive 로 유지할 수 있다. 실제로는 `tracked` 자체가 `integrationLocks` 에 참조되어 있어, `tracked` 가 settle 되면 finally 가 실행되고 Map 에서 제거된다 — 정상적으로 clean 된다.

**잠재적 문제:** `integrationId` 가 Map 에 남아있는 동안 (task 가 아직 in-flight) 프로세스가 shutdown 되면 Map 이 소멸하고 체인이 resolved 되더라도 finally 는 실행되지 않는다. 이는 정상 종료 시나리오에서 무해하다.

**위험도:** 낮음. 현재 cleanup 패턴은 Node.js 단일 스레드 특성 상 안전하다.

---

### [M-2] dispatchRepository.insert 23505 catch 패턴

**위치:** `integration-expiry-scanner.service.ts` L381–391 (`claimThreshold`)

```typescript
try {
  await this.dispatchRepository.insert({ integrationId, threshold, tokenExpiresAt });
  return true;
} catch (err) {
  if ((err as { code?: string })?.code === '23505') return false;
  throw err;
}
```

**분석:** UNIQUE 위반(23505)을 catch 해 idempotent 처리하는 패턴은 올바르다. PostgreSQL 의 `READ COMMITTED` 에서 두 pod 이 동시에 insert 를 시도하면 하나는 성공하고 나머지는 23505 로 reject 된다.

**잠재적 문제:** TypeORM 의 일부 버전에서는 23505 코드가 `err.code` 대신 `err.driverError.code` 에 있을 수 있다. `(err as { code?: string })?.code` 가 undefined 를 반환하면 두 번째 조건이 false 로 평가되어 의도치 않게 throw 한다 — **조건 분기가 항상 false 로 평가되어 모든 duplicate insert 에서 에러가 throw 될 수 있다.**

실제로는 같은 코드베이스의 `createPrivatePendingIntegration` (L1102–1116) 이 `err.driverError?.code` 패턴을 사용하는 것과 불일치.

**권장 fix:**
```typescript
const pgCode = (err as { code?: string; driverError?: { code?: string } })
  ?.driverError?.code ?? (err as { code?: string })?.code;
if (pgCode === '23505') return false;
```

---

### [M-3] expirePendingInstalls bulk UPDATE — PostgreSQL READ COMMITTED 에서의 안전성

**위치:** `integration-expiry-scanner.service.ts` L254–273 (`expirePendingInstalls`)

**분석:** 코드 주석은 단일 atomic bulk UPDATE 로 TOCTOU race 를 막는다고 주장한다. PostgreSQL READ COMMITTED 에서의 동작:

- UPDATE 의 WHERE 절은 **row-level 잠금** 과 함께 실행된다. `status='pending_install'` AND TTL 조건에 매칭되는 각 row 에 대해 row lock 을 획득한 뒤 갱신한다.
- Cafe24 callback 이 같은 row 를 `UPDATE ... SET status='connected'` 로 이미 commit 했다면, 만료 스캐너의 UPDATE 는 그 row 를 다시 읽을 때 최신 값을 확인 — `status='connected'` 이므로 WHERE 절 `status='pending_install'` 에 매칭되지 않아 **건너뛴다.** 정확히 의도한 동작.
- Cafe24 callback 이 concurrent 하게 실행 중이면 (commit 전), 만료 스캐너는 callback 의 row lock 이 해제될 때까지 기다린 뒤 최신 상태를 재평가한다. Callback 이 commit 하면 `status='connected'` → WHERE 미매칭 → 건너뜀. Callback 이 rollback 하면 `status='pending_install'` 유지 → TTL 만 남은 시간 기준으로 재평가.

**결론:** 주석의 주장은 PostgreSQL READ COMMITTED + row-level locking 의 실제 동작에 근거가 있다. 안전하다.

**단, 한 가지 edge case:** 만료 스캐너 UPDATE 가 `install_token_issued_at` 이 아닌 `COALESCE(install_token_issued_at, created_at)` 을 사용하므로, V044 이전 row (install_token_issued_at = NULL) 는 `created_at` 기준으로 만료된다. `createPrivatePendingIntegration` 의 existingPending 재사용 분기가 `installTokenIssuedAt` 을 갱신하지 않는 경우 (credentials 가 변경되지 않아 `needNewToken = false`) 기존 TTL 이 유지된다 — 의도한 동작.

---

### [M-4] tryRecoverByMallId 의 TOCTOU — HMAC 검증 시점과 사용 시점 간 race

**위치:** `integration-oauth.service.ts` L1311–1362

**시나리오:**

1. `tryRecoverByMallId` 가 `integrationRepository.find(...)` 로 N 개 row 를 읽음.
2. 읽은 후 `validated.length === 1` 을 확인하고 그 row 를 반환.
3. `handleInstall` 이 반환된 row 를 사용해 OAuth state 를 생성.
4. **반환 시점과 사용 시점 사이**에 다른 worker 가 그 row 를 `status='expired'` 로 전이시켰다면?

**영향:** `handleInstall` 은 반환된 `target.status` 를 확인한다 (L1240). `status !== 'pending_install'` 이면 frontend 상세 페이지로 redirect 한다. 이 redirect 는 데이터 손상이 아닌 UX 이슈 — expired row 에 대해 OAuth flow 를 시작하려 했으나 post-install navigation 으로 처리됨.

**실제 위험:** 낮음. 만료 스캐너는 일일 batch 이고 row 전이가 즉각적이지 않다. 그러나 status 확인이 find 시점의 스냅샷을 사용하므로 이론적으로 stale 읽기.

**권장 fix:** 별도 수정 불필요. 현재 `handleInstall` 의 status 분기가 stale row 를 post-install navigation 으로 안전하게 처리.

---

### [M-5] Cafe24McpToolProvider 의 executionState Map — 싱글턴 상태의 동시 접근

**위치:** `cafe24-mcp-tool-provider.ts` L51–68, L94–184

**분석:** `ownedSidCounts` 와 `executionState` 는 class instance 레벨의 Map 이다. `Cafe24McpToolProvider` 가 NestJS singleton 이면 모든 동시 AI Agent 실행이 같은 Map 을 공유한다.

Node.js 는 단일 스레드이므로 JavaScript 레벨의 Map 접근에서 race 는 발생하지 않는다. 단, `buildTools` 와 `cleanup` 이 `async` 이므로 `await` 지점에서 다른 코루틴이 실행될 수 있다:

```typescript
// buildTools L177–180
const newForThisExecution = !state.sidToIntegration.has(sid);
state.sidToIntegration.set(sid, integration);
state.sidToOpMap.set(sid, opMap);
if (newForThisExecution) this.retainSid(sid);
```

이 코드 블록은 `await` 없이 동기적으로 실행되므로 다른 코루틴이 중간에 끼어들 수 없다. `retainSid` 와 `releaseSid` 도 동기적.

**잠재적 문제:** `cleanup` 이 `executionId` 없이 호출되면 no-op 처리한다 (L396–403). 이 방어 코드는 올바르다.

**위험도:** 낮음. 단일 스레드 이벤트 루프 특성 상 현재 구현은 thread-safe.

---

### [M-6] applicationShutdown 시 waitUntilFinished 와 QueueEvents.close() 충돌

**위치:** `cafe24.module.ts` L76–84 (`onApplicationShutdown`)

**시나리오:**

1. Shutdown 신호 수신 → `Cafe24Module.onApplicationShutdown` 호출 → `queueEvents.close()` 실행.
2. 이 시점에 in-flight `waitUntilFinished` 가 있다면 QueueEvents 가 닫히면서 이벤트 수신이 중단됨.
3. `waitUntilFinished` 는 `REFRESH_JOB_WAIT_TIMEOUT_MS` 까지 hang 하다가 타임아웃으로 reject.
4. Worker 는 shutdown 으로 job 처리를 완료하거나 중단.

**영향:** Shutdown 이 graceful 하지 않을 수 있다. Worker 가 refresh 를 성공적으로 완료했더라도 Caller 는 timeout 에러를 받고 auth_failed 로 오격하될 위험이 있다 (C-1 참조).

**권장 fix:** `onApplicationShutdown` 에서 `queueEvents.close()` 를 호출하기 전에 in-flight `waitUntilFinished` 들이 완료될 때까지 대기하거나, NestJS `enableShutdownHooks` + HTTP server 의 graceful timeout 을 `REFRESH_JOB_WAIT_TIMEOUT_MS` 보다 크게 설정.

---

## 확인했지만 안전 (race-free) 인 항목

### [SAFE-1] withIntegrationLock + BullMQ worker 의 데드락 가능성 — 없음

**시나리오:** `call()` 이 `withIntegrationLock` 안에서 `ensureFreshToken` → `refreshViaQueue` → `waitUntilFinished` 를 호출. Worker 가 같은 프로세스의 `integrationLocks` mutex 를 다시 요구하지 않는가?

**확인:** `Cafe24TokenRefreshProcessor.process()` 는 `cafe24ApiClient.refreshAccessToken(fresh)` 를 직접 호출하며, `withIntegrationLock` 을 사용하지 않는다. `refreshAccessToken` 은 HTTP fetch + TypeORM transaction 이지 `withIntegrationLock` 을 재진입하지 않는다. **데드락 없음.**

### [SAFE-2] handleCallback 의 DELETE...RETURNING 원자성

`DELETE FROM integration_oauth_state WHERE state = $1 RETURNING *` 는 PostgreSQL 에서 원자적으로 실행된다. 두 concurrent callback 이 같은 state 값으로 도착해도 하나만 row 를 반환받고 나머지는 빈 배열을 받아 `OAUTH_STATE_MISMATCH` 에러를 반환한다. **Race-free.**

### [SAFE-3] refreshAccessToken 의 4-field atomic UPDATE

`dataSource.transaction` 내에서 `findOne` + `save` 로 credentials, tokenExpiresAt, status, lastRotatedAt 을 한 트랜잭션에 업데이트. BullMQ `jobId` dedup 으로 같은 integrationId 에 대한 refresh 가 worker 레벨에서 직렬화되므로 두 worker 가 동시에 `refreshAccessToken` 을 실행하는 경우가 없다 (단, 직렬화는 BullMQ 큐 레벨 — 두 Pod 에서 각각 큐 없이 직접 `refreshAccessToken` 을 호출하는 경로는 없음을 Cafe24Module 의 `refreshQueue` 필수 주입으로 확보). **Race-free** (BullMQ path 한정).

### [SAFE-4] createPrivatePendingIntegration 의 UNIQUE 제약 race

`idx_integration_cafe24_workspace_mall` partial UNIQUE index 가 concurrent INSERT 를 DB 레벨에서 차단하고 23505 를 `ConflictException` 으로 변환한다 (L1099–1116). **Race-free.**

### [SAFE-5] enqueueCafe24BackgroundRefresh 의 enqueue 에러 격리

각 integration 에 대한 enqueue 를 독립 try-catch 로 감싸 실패해도 다음 integration 으로 진행한다 (L199–220). BullMQ retry 는 본 job 전체에 적용. **설계 의도에 부합.**

### [SAFE-6] 만료 스캐너 Cafe24 백그라운드 refresh — worker 중복 실행 없음

`enqueueCafe24BackgroundRefresh` 는 `cafe24RefreshQueue` 에 `jobId = integrationId` 로 enqueue 만 하고 결과를 기다리지 않는다. Worker (`Cafe24TokenRefreshProcessor`) 가 실제 refresh 를 담당. BullMQ dedup 으로 같은 integrationId 에 대한 중복 실행 없음. **설계 올바름.**

---

## 종합 의견

PR #56 의 BullMQ 기반 멀티 인스턴스 race 보호는 방향이 올바르고 핵심 설계(jobId dedup, worker-side short-circuit, DELETE...RETURNING 원자 소비)는 견고하다. 발견된 가장 중요한 이슈는 **waitUntilFinished 타임아웃 시 stale token 으로의 fallback** 경로다 (C-1). 이 경로에서 token 갱신 성공 여부를 확인하지 않고 TransportFailedError 를 throw 하면, 상위 재시도 로직이 old token 으로 API 를 호출해 불필요한 401→markAuthFailed 격하를 유발할 수 있다. catch 블록에서 `resolveTokenExpiry` 기반 재확인을 추가하면 이 경로를 닫을 수 있다. 그 외 source dedup race (H-2), handleCallback lost update (H-3), 23505 catch 패턴 불일치 (M-2) 는 운영 중 단속적으로 나타날 수 있는 문제로 수정을 권장한다. Cafe24McpToolProvider 의 동시 접근은 Node.js 단일 스레드 특성 덕분에 현재 구조에서는 추가 보호가 필요하지 않다.

---

## 위험도

**HIGH**
