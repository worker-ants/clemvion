---
title: Cafe24 refresh path 잔여 결함 — reactive_401 dedup + worker short-circuit 신뢰성
worktree: fix-cafe24-refresh-dedup-and-shortcircuit-ec6632
branch: claude/fix-cafe24-refresh-dedup-and-shortcircuit-ec6632
status: complete
completed: 2026-05-22
completion_commit: 734ab206
completion_pr: "#227"
---

## 배경

2026-05-19 의 JWT exp fix (`890c47fe`, `0632a9f3`) 배포 이후에도 `mall_id=gehrig0301`
(integrationId=`b74e1adc-d7bf-438f-9555-09719a473eb9`) 통합에서 다음 패턴 401 이
재발 (운영 로그 2026-05-20 14:51):

```
LOG  Cafe24 token expiring or null — proactive refresh ... ttlSec=-85626 source=proactive
WARN Cafe24 API 401 ... GET products: access_token time expired
LOG  Cafe24 401 detected — performAuthRefresh + retry ... source=reactive_401
WARN Cafe24 API 401 ... GET products: access_token time expired
WARN Tool call ... finished with status=error: Cafe24 authentication failed (401)
```

증상의 핵심: proactive / reactive_401 두 경로 모두 enqueue 직후 1초 내 401 로
귀결되며 worker 의 `Cafe24 refresh ... via queue worker` 와 `Cafe24 token refresh
starting` 로그가 **둘 다 부재** = worker 가 한 번도 새로 돌지 않음.

## 원인 (검토 결과)

### A. `reactive_401` 의 `removeOnComplete: { age: 0 }` 가 dedup 을 차단하지 못함

`cafe24-api.client.ts:619-643` 의 2026-05-18 fix 는 `source === 'reactive_401'`
일 때 `removeOnComplete: { age: 0 }` 을 설정하여 "proactive 가 직전에 completed
상태로 남아 dedup 되는 edge case" 를 차단한다고 주석에 명시. 그러나 BullMQ 의
실제 동작 (`addStandardJob-9.lua:22-27`) 은:

```lua
if rcall("EXISTS", jobIdKey) == 1 then
    return handleDuplicatedJob(...)  -- 기존 job 그대로 반환, 신규 옵션 무시
end
```

같은 `jobId` 의 job 이 **completed/failed/active/waiting 어떤 상태든** Redis 에
존재하면 `Queue.add()` 는 기존 job 참조를 그대로 반환한다. 신규 add 의 `removeOnComplete`
옵션은 **새 job 이 생성될 때만 적용**되므로, reactive_401 이 stale completed
proactive job 으로 dedup 되는 것을 막을 수 없다.

`waitUntilFinished` (`job.js`) 는 `scripts.isFinished(jobId)` 를 즉시 폴링해 completed
면 바로 resolve → worker 가 새로 돌지 않음.

### B. worker short-circuit 이 신뢰할 수 없는 expiry source 폴백을 허용

`cafe24-token-refresh.processor.ts:117-128` 의 short-circuit:

```typescript
if (source !== 'reactive_401') {
  const expiresAtMs = resolveTokenExpiry(fresh);
  if (expiresAtMs !== null && expiresAtMs - Date.now() > REFRESH_WINDOW_MS) {
    return;
  }
}
```

`resolveTokenExpiry` (`cafe24-api.client.ts:1462-1489`) 의 폴백 chain:
1. JWT `exp` claim (TZ-immune, 신뢰)
2. `Integration.tokenExpiresAt` (DB column, TZ-bug 가능)
3. `credentials.expires_at` (JSONB mirror, TZ-bug 가능)

2026-05-18 fix 는 (1) 만 보강. `parseJwtExp` 가 null 을 돌려주는 케이스
(access_token 이 JWT 가 아니거나 payload exp 가 비-숫자 등) 에서는 (2)/(3) 의
TZ-bugged 미래 값으로 short-circuit 이 발사 → worker no-op 완료. 그 completed
job 이 60s 잔존하며 후속 proactive/reactive_401 add() 가 dedup → 무한 루프.

## 변경 범위

### 1) `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`

- [x] `refreshViaQueue` 에서 `source === 'reactive_401'` 일 때 jobId 를
      `${integrationId}#reactive-${Date.now()}-${randomSuffix}` 형태로 unique
      화. caller 가 empirical 401 을 받았다는 강한 신호이므로 worker 가 반드시
      새로 돌아야 한다. 다른 source (proactive / background) 는 기존 jobId
      유지 (cross-pod dedup 보호).
- [x] `removeOnComplete: { age: 0 }` 의 분기 로직은 제거 (이제 불필요). 다른
      source 와 동일하게 `{ age: 60 }` 통일.
- [x] 주석 갱신 — 이전의 "dedup 차단막" 설명을 실제 동작 (unique jobId 로 dedup
      자체 우회) 로 정정.

### 2) `codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts`

- [x] short-circuit 판정을 `parseJwtExp(access_token)` 만 사용하도록 변경.
      JWT exp 가 null 이거나 과거면 short-circuit 발사 금지 → 항상 `refreshAccessToken`
      시도. TZ-bugged `tokenExpiresAt` 의 영향 영구 차단.
- [x] `resolveTokenExpiry` import 는 유지 (다른 경로에서 여전히 사용) 하되 본
      파일에서는 사용 안 함 — `parseJwtExp` 직접 import.

### 3) `codebase/backend/src/nodes/integration/cafe24/cafe24.module.ts`

- [x] `cafe24RefreshQueueEventsProvider` 의 `connection` 에 `password` / `tls`
      spread 추가. 다른 4개 Redis client 와 동일 패턴 (`...(password ? { password
      } : {})`, `...(tls ? { tls: {} } : {})`).

### 4) 테스트

- [x] `cafe24-api.client.spec.ts` — reactive_401 의 jobId 가 `${id}#reactive-...`
      형태 (정규식 매치) 인지, proactive/background 는 그대로인지 검증. 기존
      `removeOnComplete.age=0` assertion 은 새 동작 (`{ age: 60 }` 통일) 로 갱신.
- [x] `cafe24-token-refresh.processor.spec.ts` — TZ-bugged `tokenExpiresAt`
      (미래) + access_token JWT exp **null** (parseJwtExp fail 시뮬레이션) 시나리오
      에서 source='background' / source='proactive' 둘 다 short-circuit 발사하지
      않고 refreshAccessToken 호출되는지 검증.
- [x] 기존 `resolveTokenExpiry` JWT exp 우선 회귀 테스트는 그대로 유지.

## 결정 사항

- **reactive_401 의 cluster-wide serialization 손실 risk**: unique jobId 채택
  시 두 pod 가 동시에 empirical 401 을 받으면 각자 worker 를 돌릴 수 있다. 그러나
  worker 내부의 `dataSource.transaction` `pessimistic_write` row lock 이 PostgreSQL
  레벨에서 직렬화하며 (B-4-3 defense-in-depth), 후착 worker 가 Cafe24 `/oauth/token`
  을 호출하는 시점엔 선착 worker 가 이미 refresh_token rotation 을 끝낸 상태라
  invalid_grant 받고 markAuthFailed → 본래 의도와 다르게 status='error' 격하될
  위험. 하지만 empirical 401 시점엔 caller-side `withIntegrationLock` 이 in-process
  직렬화하므로 동일 pod 내 race 는 차단. cross-pod 동시 401 은 (a) 발생 빈도가
  매우 낮고 (proactive 가 정상 작동하면 reactive_401 자체가 거의 안 일어남), (b)
  발생하더라도 한 pod 만 invalid_grant 격하되어 사용자가 reauth 하면 회복되는
  fail-safe 한 결과라 dedup 손실 비용을 감수한다. 본 PR 의 최우선 목표는 "dedup
  으로 refresh 가 영원히 안 되는 회귀" 의 영구 차단.

- **worker short-circuit 폴백 제거의 trade-off**: JWT exp 가 null (Cafe24 가 향후
  opaque token 도입 / payload format 변경) 인 경우 worker 는 항상 refresh 시도
  한다 → Cafe24 `/oauth/token` 호출 빈도 약간 증가. 그러나 BG cron 의 `lastRotatedAt
  < cutoff` 게이트 + caller-side `ensureFreshToken` 의 `REFRESH_WINDOW_MS` 게이트가
  엔트리 throttle 역할을 하므로 호출 증가는 미미. 안전성 (refresh 회귀 영구
  차단) 이 비용보다 큼.

## 체크리스트

- [x] 1) cafe24-api.client.ts — reactive_401 unique jobId
- [x] 2) cafe24-token-refresh.processor.ts — JWT exp 한정 short-circuit
- [x] 3) cafe24.module.ts — QueueEvents AUTH/TLS
- [x] 4) 테스트 갱신/추가
- [x] lint / unit / build / e2e 통과
- [x] /ai-review 완료

## 완료 정리 (2026-05-22)

- 본체 구현: PR #227 / commit `734ab206` (`fix(cafe24): refresh path 잔여 결함 — reactive_401 dedup + worker JWT-only + QueueEvents AUTH`).
- 후속 spec Rationale 갱신: `plan/complete/spec-fix-resolve-token-expiry-rationale.md` 로 별도 완료.
- 운영 DB 회복 SQL (`mall_id=gehrig0301`): plan 범위 외 — 사용자가 직접 수행.
- 본 plan 의 모든 in-scope 체크박스 `[x]`, in-scope follow-up 0건이므로 `complete/` 이동.
- 노트: 이상적으로는 본체 PR #227 commit 내에 plan 이동이 포함됐어야 함 (plan-lifecycle.md §3). 이번 정리는 사후 보정으로 단독 commit 으로 진행.

## 후속 (별도 PR — 본 plan 범위 외, 완료)

- 운영 DB 의 `mall_id=gehrig0301` 즉시 회복 SQL — 사용자가 직접 실행 (plan 범위 외).
- spec `## Rationale` 갱신 — `plan/complete/spec-fix-resolve-token-expiry-rationale.md` 로 완료됨.
