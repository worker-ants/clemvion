---
worktree: cafe24-refresh-fix-a8c2f1
started: 2026-05-16
owner: developer / 사용자 본인 (gehrig)
---

# Cafe24 access_token 자동 갱신 회복 + 백그라운드 갱신 + BullMQ 직렬화

## 문제

운영 신고 (2026-05-16): Cafe24 통합이 연결 직후 한 번은 정상 호출되다가, 약 2시간 뒤부터 모든 호출이 다음 오류로 실패.

```
{ "error": { "code": "CAFE24_AUTH_FAILED",
  "message": "Cafe24 authentication failed (401) for mall gehrig0301 — access_token time expired. (invalid_token)" } }
```

기대 동작 (`spec/2-navigation/4-integration.md §10.5`): 노드 실행 직전 만료 확인 → 만료됐으면 갱신 후 호출, refresh 실패 시에만 `expired` 전이.

## 원인

두 곳에 걸친 결합 결함:

1. `IntegrationOAuthService.handleCallback` (initial OAuth callback) 는 `Integration.tokenExpiresAt` 컬럼만 set 하고 `credentials.expires_at` JSONB 미러는 **쓰지 않았다**. preview 경유 신규 통합 생성 (`integrations.service.ts:281`) 도 동일.
2. `Cafe24ApiClient.ensureFreshToken` 의 proactive-refresh 게이트는 `credentials.expires_at` **만** 읽었다. JSONB 미러가 비어있으면 `if (!creds.expires_at) return;` 로 조용히 빠져나가 refresh 가 **한 번도 트리거되지 않음**.

결과: 갓 연결된 행은 Cafe24 의 access_token TTL (2시간) 이 지나는 순간부터 stale token 을 그대로 송신 → 서버 401 → `markAuthFailed` → `error(auth_failed)`. 사용자가 reauthorize 하기 전까지 사용 불가. refresh path 자체 (`refreshAccessToken`) 는 `credentials.expires_at` 를 정상적으로 write 했으므로 일단 한 번이라도 refresh 가 돌면 그 다음부터는 self-heal 했지만, 게이트 자체가 fire 하지 않아 첫 refresh 가 영원히 일어나지 않았다.

## 조치

### 코드

- `cafe24-api.client.ts:ensureFreshToken` — expiry 판정 소스를 `Integration.tokenExpiresAt` (spec §10.5 canonical column) 우선, `credentials.expires_at` 폴백으로 변경. 헬퍼 `resolveTokenExpiry()` 신설.
- `integration-oauth.service.ts:handleCallback` — `credentials.expires_at` 를 `exchange.tokenExpiresAt` 에서 미러로 동시 기록. refresh path 가 생성하는 credentials 형태와 일치.

### 테스트

- `cafe24-api.client.spec.ts` — 회귀 케이스 추가: `tokenExpiresAt` 만 set 되고 `credentials.expires_at` 가 없을 때 proactive refresh 가 fire 하는지 검증. 기존 30s/1s window 테스트 두 건은 `tokenExpiresAt` 도 함께 set 하도록 갱신 (canonical column 우선이 되었으므로).
- `integration-oauth.service.cafe24.spec.ts` — handleCallback 의 preview 저장이 `credentials.expires_at` 미러를 포함하는지 검증.

검증:

- `npx jest --testPathPatterns=cafe24` → 48 / 48 통과.
- `npx jest` (backend 전체) → 3581 / 3581 통과.
- `npm run build` → 통과.
- `npm run lint` → 변경 영역 무경고. 기존 1건 (third-party-oauth.controller.spec.ts:430) 은 본 작업 이전부터 존재 (out of scope).

## 사용자 액션

이미 `error(auth_failed)` 로 격하된 통합은 reauthorize 가 필요하다 — 새 access_token + refresh_token 발급. 본 fix 가 배포된 이후 갓 연결한 통합은 2시간 경계에서 자동으로 갱신된다.

## Rationale 메모

- `tokenExpiresAt` 컬럼을 canonical 로 정의한 이유 (spec §10.5 도 동일):
  - 원자 4-field UPDATE 에서 컬럼이 마지막에 write 되고, transaction 안에서 컬럼·JSONB 가 일관적으로 갱신된다.
  - 만료 스캐너 (`integration-expiry-scanner.service.ts`) 가 `tokenExpiresAt` 만 본다 — proactive refresh 와 만료 알림이 같은 SoT 를 공유.
  - JSONB 미러는 다른 provider (google/github) 가 갖지 않을 수도 있어, 컬럼 폴백이 더 portable.
- 401 에 대한 reactive refresh + retry 는 본 fix 범위에서 제외. spec §10.5 가 proactive 만 명시했고, refresh_token 자체가 무효화된 케이스를 reactive 가 마스킹하면 진단이 어려워진다. 추후 robustness 보강이 필요해지면 별개 plan 으로 분리한다.

## 후속 follow-up

- 없음. 본 plan 은 단일 PR 로 완결.

---

## Phase 2 — 백그라운드 갱신 + 멀티 인스턴스 race 방지 (2026-05-16 추가)

### 동기

Phase 1 fix 머지 직전 다음 두 한계가 드러남:

1. **idle 통합 14일 만료**: proactive refresh 는 API 호출 직전 lazy 라서, 통합이 14일 이상 idle 이면 refresh_token 자체가 만료되어 사용자가 재인증해야 한다.
2. **멀티 인스턴스 race**: 두 backend pod 이 같은 통합에 대해 같은 시점에 refresh 를 시도하면 Cafe24 `/oauth/token` 에 같은 old refresh_token 으로 동시 요청이 발생. last-write-wins 로 한쪽 토큰 orphan 또는 false `auth_failed` 격하 가능. 기존 in-memory `withIntegrationLock` 은 같은 pod 에서만 직렬화.

### 설계

**새 BullMQ 큐 `cafe24-token-refresh`** 도입:

- jobId = integrationId — 같은 통합에 대한 동시 enqueue 가 클러스터 전체에서 단일 worker 실행으로 dedup. 모든 호출자가 동일 job 결과를 `waitUntilFinished` 로 공유.
- Worker (`Cafe24TokenRefreshProcessor`) 가 실제 Cafe24 HTTP 요청 + 4-field atomic DB UPDATE 를 단일 instance 에서만 수행 → race 원천 봉쇄.
- 큐 이름·상수는 `modules/integrations/cafe24-token-refresh.constants.ts` 에 두어 `nodes → modules` 의존 방향 보존.

**프로액티브 경로 (`Cafe24ApiClient.ensureFreshToken`):**

- 큐가 바인딩되면 (`refreshQueue && refreshQueueEvents`) `refreshViaQueue` 로 위임 — enqueue + `waitUntilFinished(30s)` + DB 재로드 + 호출자 reference 갱신.
- 큐 미바인딩 시 (테스트 등) 레거시 in-process `refreshAccessToken` fallthrough — 기존 unit test fixture 호환.
- Worker 가 `markAuthFailed` 처리한 경우 — DB 재로드 시 `status='error'` 발견 → `Cafe24AuthFailedError` 로 surface (기존 의미 유지).

**백그라운드 스캐너 (`integration-expiry-scanner` 새 잡):**

- 새 잡 `JOB_CAFE24_BACKGROUND_REFRESH` — 일일 00:00 UTC. `IntegrationExpiryScannerService.enqueueCafe24BackgroundRefresh` 가 `lastRotatedAt < now - REFRESH_PROACTIVE_THRESHOLD_DAYS` (기본 10일) AND `status='connected'` AND `service_type='cafe24'` 인 통합을 스캔해 같은 refresh 큐로 enqueue.
- jobId dedup 이 적용되므로 동시 proactive call 과 자동 충돌 회피.
- refresh_token 14일 만료 대비 4일 안전 마진 — 사용자가 통합을 만들고 무한 idle 해도 자동으로 살아있는 상태 유지.

**Module wiring:**

- `Cafe24Module` — registerQueue + Processor + QueueEvents provider + OnApplicationShutdown 으로 QueueEvents close.
- `IntegrationsModule` — registerQueue (스캐너의 enqueue 용). BullMQ 의 multi-module registerQueue 는 같은 Redis queue 를 가리킴.

### 코드

- 신규 `modules/integrations/cafe24-token-refresh.constants.ts` — 큐 이름, 임계 상수, job data 타입.
- 신규 `nodes/integration/cafe24/cafe24-token-refresh.processor.ts` — Worker. DB 재확인 short-circuit, status 보호, attempts=1.
- 수정 `cafe24-api.client.ts` — Optional@InjectQueue + Optional@Inject(QueueEvents). `refreshViaQueue` 헬퍼. 기존 `refreshAccessToken` 는 worker 가 직접 호출하는 entry point 로 유지.
- 수정 `cafe24.module.ts` — registerQueue, Processor provider, QueueEvents provider, OnApplicationShutdown.
- 수정 `integrations.module.ts` — registerQueue (enqueue 용).
- 수정 `integration-expiry-scanner.service.ts` — `JOB_CAFE24_BACKGROUND_REFRESH`, `enqueueCafe24BackgroundRefresh()`, scheduler 등록.

### 테스트

- `cafe24-token-refresh.processor.spec.ts` — 6 케이스: 만료 token refresh / 이미 fresh 일 때 short-circuit / 통합 없을 때 skip / serviceType 방어 / background+non-connected skip / proactive+expired status 는 시도.
- `cafe24-api.client.spec.ts` — 3 케이스 추가: 큐 경로 라우팅 (jobId + re-fetch) / worker 가 markAuthFailed 했을 때 Cafe24AuthFailedError surface / token 여전히 fresh 면 enqueue skip.
- `integration-expiry-scanner.service.spec.ts` — 4 케이스 추가: process 라우팅 (JOB_CAFE24_BACKGROUND_REFRESH) / enqueue 동작 (cutoff 계산, jobId dedup) / 후보 없을 때 0 / 부분 실패 생존.

검증:

- `npx jest` (backend 전체) → 3594 / 3594 통과 (+13 new).
- `npm run build` → 통과.
- lint 무경고 (변경 영역). 기존 unrelated error 1건은 out of scope.

### Rationale 메모

- **왜 BullMQ?** 사용자 명시 요청. 대안 (PostgreSQL advisory lock, redlock) 보다 BullMQ 가 이미 스택에 있고, 백그라운드 갱신 스케줄러와 같은 인프라 공유로 운영 면 단순. waitUntilFinished 의 latency (1~2s) 는 refresh 가 어차피 Cafe24 HTTP round-trip 을 포함하므로 obscured.
- **attempts=1**: refresh 실패는 거의 terminal (invalid_grant). retry 가 같은 401 을 반복 → markAuthFailed → 사용자 알림 중복. 호출자 다음 시도 (다음 API call 또는 다음 일일 스캐너) 에 위임.
- **lastRotatedAt 10일 임계**: 14일 refresh_token 만료 대비 4일 margin. 더 짧게 잡으면 (예: 1일) Cafe24 leaky bucket 에 부담 (각 통합 매일 refresh). 10일은 안전 + 부하 균형.
- **`Cafe24Module.onApplicationShutdown` 에서 QueueEvents close**: factory provider 가 만든 인스턴스는 NestJS 의 일반 useClass/useExisting 라이프사이클을 거치지 않아 명시 close 가 필요. Redis 커넥션 leak 방지.
- **status='error' 통합 자동 회복 안 함 (background 경로)**: Phase 1 에서 어차피 사용자가 한 번 reauthorize 해야 한다. 자동 회복은 사용자 의도 우회. proactive 경로는 호출자 (workflow 노드 등) 가 status 검증을 이미 수행한 후 도착하므로 그대로 시도.

### 사용자 액션

- Phase 2 머지 후 즉시 새 BullMQ 큐가 살아남. 신규 통합은 자동으로 보호 받음.
- 기존 `error(auth_failed)` 통합은 여전히 사용자 reauthorize 가 필요 (자동 회복 안 함).
- 14일 이상 idle 통합은 다음 일일 백그라운드 패스 (00:00 UTC) 에서 자동 갱신.
