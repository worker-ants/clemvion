---
worktree: cafe24-jwt-exp-fix-7a3f1c
started: 2026-05-18
owner: developer
---

# Cafe24 토큰 갱신 영구 차단 fix — JWT exp 기반 만료 추출 + 워커 short-circuit 차등 적용

## 문제

운영 보고 (2026-05-18, 사용자 gehrig — mall `gehrig0301`): main HEAD 가 배포된 상태에서도 다음 401 이 반복됨.

```
Cafe24 authentication failed (401) for mall gehrig0301 — access_token time expired...
```

이전 fix (`plan/complete/cafe24-proactive-refresh-fix.md` + L3 자가 회복 + L4 expired 자가 회복) 가 모두 main 에 있는데도 같은 증상.

## 원인 (직접 추적)

스크린샷의 suffix `— access_token time expired` 는 **원본 Cafe24 API 401 응답 body 의 summary** 가 그대로 surface 된 형태. 즉 L3 reactive 자가 회복이 fire 했지만 *실효적 refresh 가 일어나지 않은* 상태에서 retry 가 같은 stale token 으로 두 번째 401 을 받았다.

두 결합 결함:

### C1. `parseTokenExpiresAt` / `refreshAccessToken` 의 TZ 모호성

```ts
// integration-oauth.service.ts:1689, cafe24-api.client.ts:822
const parsed = Date.parse(expiresAtStr);
```

ECMA-262 (ES2015+): timezone designator 가 없는 ISO date-time 은 **서버 local time** 으로 해석. Cafe24 가 `expires_at` 을 TZ-less 형식으로 보내면, production 컨테이너 (UTC) 에서는 의도된 시각과 다른 epoch 로 저장된다 (KST 9h skew 가 대표 예).

### C2. 워커 short-circuit 이 잘못된 `tokenExpiresAt` 를 신뢰

```ts
// cafe24-token-refresh.processor.ts:99-108
const expiresAtMs = resolveTokenExpiry(fresh);
if (expiresAtMs !== null && expiresAtMs - Date.now() > REFRESH_WINDOW_MS) {
  // "no-op — token already fresh" - SKIP REFRESH
  return;
}
```

L2 proactive 와 L3 reactive worker 가 **같은 잘못된 expiry** 를 본 결과 양쪽 모두 refresh 를 건너뜀:

1. L2 `ensureFreshToken`: 미래 ms 반환 → skip → stale token 으로 API 호출 → 401.
2. L3 401 자가 회복 → `performAuthRefresh` → `refreshViaQueue('proactive')` → enqueue.
3. Worker pickup → 동일한 미래 ms → **short-circuit** → refresh 안 함.
4. `waitUntilFinished` 가 `completed` 로 정상 resolve → caller 가 DB 재조회 → **OLD credentials 로 mutate**.
5. retry 가 **같은 OLD access_token** 으로 호출 → 두 번째 401.
6. `triedAuthRetry=true` → markAuthFailed + throw `Cafe24AuthFailedError(401, mallId, errBody)`.

## 해결 방향

Cafe24 의 `access_token` / `refresh_token` 은 **JWT** 이므로 `exp` claim (RFC 7519 정의상 Unix epoch seconds — UTC absolute) 을 만료 시각의 **single source of truth** 로 사용한다. ISO 파싱의 TZ 모호성 원천 제거.

`@nestjs/jwt` 가 이미 `codebase/backend/package.json` deps 에 있어 (`^11.0.2`) 추가 의존성 없음. 단, signature 검증은 본 용도에 불필요 (만료 시각 metadata 추출만 — 토큰 진위는 Cafe24 API 가 호출 시점에 검증). 따라서 자체 helper 로 base64url payload 만 디코드.

## 작업 항목

### 코드

- [ ] `codebase/backend/src/modules/integrations/jwt-exp.ts` 신규 — `parseJwtExp(token)` 헬퍼. JWT payload 의 `exp` claim 을 epoch ms 로 반환. 비-JWT / exp 누락 / 비-숫자 면 null. signature 검증 없음.
- [ ] `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 의 `parseTokenExpiresAt` 갱신 — cafe24 분기 precedence: **JWT exp** → 표준 `expires_in` → `expires_at` ISO (TZ designator 누락 시 `+09:00` 부여로 정규화) → 2h fallback.
- [ ] `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 의 `refreshAccessToken` 의 expiresAt 계산 (line 818-824) 동일 precedence 패턴 적용.
- [ ] `codebase/backend/src/modules/integrations/cafe24-token-refresh.constants.ts` 의 `Cafe24RefreshJobData.source` 에 새 값 `'reactive_401'` 추가.
- [ ] `codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts` 의 `process` 갱신 — `job.data.source === 'reactive_401'` 이면 short-circuit guard skip (항상 refresh 시도).
- [ ] `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 의 `performAuthRefresh` 가 `refreshViaQueue` 호출 시 source 를 `'reactive_401'` 로 전달. (`refreshTokenViaQueue` 의 public 진입은 기존 'proactive'/'background' 유지)
- [ ] `refreshViaQueue` 가 source='reactive_401' 일 때 enqueue 옵션 `removeOnComplete: { age: 0 }` 적용 — BullMQ jobId dedup edge case 대응 (proactive 완료 job 이 60s 잔존 → 다음 reactive_401 add 가 stale completed job 으로 dedup 되어 worker 실행 누락되는 케이스 차단).

### 테스트 (TDD — 코드 전 작성)

- [ ] `codebase/backend/src/modules/integrations/jwt-exp.spec.ts` 신규 — 정상 JWT(exp 있음, exp 없음) / 잘못된 segment 수 / base64 오류 / JSON 오류 / exp 비-숫자 / 빈 문자열 / null / undefined.
- [ ] `codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` 보강 — (a) access_token 이 JWT 일 때 응답의 `expires_at` 보다 JWT exp 가 우선 적용 (b) JWT 비정상이면 `expires_at` ISO fallback (c) TZ-less ISO 가 KST 보정으로 해석됨.
- [ ] `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` 보강 — refresh 응답의 access_token 이 JWT 면 JWT exp 가 응답 body 의 `expires_at` 보다 우선 채택.
- [ ] `codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts` 보강 — source='reactive_401' 일 때 token 이 fresh 로 보여도 refresh 수행 / source='proactive' 일 때 종전 short-circuit 유지.
- [ ] `cafe24-api.client.spec.ts` 통합 회귀 — stale `tokenExpiresAt` + 401 응답 → worker 가 reactive_401 로 호출되어 short-circuit 안 함 → retry 성공.

### 문서

- [ ] `plan/in-progress/spec-update-cafe24-jwt-exp.md` 신규 — spec §10.5 + Rationale 갱신 제안 (project-planner 위임).
- [x] 본 plan (`plan/in-progress/cafe24-jwt-exp-fix.md`) 작성.

### 검증

- [ ] `cd codebase/backend && npm run lint` — 변경 영역 무경고.
- [ ] `cd codebase/backend && npm test -- jwt-exp` 통과.
- [ ] `cd codebase/backend && npm test -- cafe24` 통과.
- [ ] `cd codebase/backend && npm test -- integration-oauth` 통과.
- [ ] `cd codebase/backend && npm test` (전체) 통과.
- [ ] `cd codebase/backend && npm run build` 통과.
- [ ] `make e2e-test` 통과.

### Review

- [ ] `/ai-review` 실행. Warning 이상 이슈 조치.
- [ ] `review/code/.../RESOLUTION.md` 작성 (조치 항목 + TEST 결과 e2e 명시).

## Rationale

- **왜 JWT exp 가 결정적**: Cafe24 응답 표기 (TZ 포함/누락) 의 흔들림에 영향받지 않는 단일 SoT. 토큰 자체에 issuer 가 서명·박아둔 값이라 token 과 분리될 수 없음. `exp` 는 RFC 7519 사실상 강제 claim.
- **signature 검증 안 하는 이유**: 본 용도는 *우리가 받은 토큰의 만료 시각* 추출이지 위조 방어가 아님 (그건 Cafe24 API 가 호출 시점에 검증). Cafe24 의 JWT public key 가 공개되지 않은 것으로 알려져 있어 구조적으로 검증 불가.
- **TZ 보정 fallback (`+09:00`) 의 위치**: JWT 디코드가 비정상으로 null 인 케이스 (예: Cafe24 가 future 에 opaque token 전환) 안전망. KST 부여는 Cafe24 본사 운영 기준 timezone 으로 합리적 추정.
- **워커 short-circuit 차등 적용 (`reactive_401` source)**: short-circuit 자체는 proactive 경로의 thundering herd 방지에 유효 (매 API 호출이 enqueue → 같은 jobId dedup → 워커 1회만 실제 refresh — 본 short-circuit 없어도 동작하지만 약간의 effort 절약). reactive_401 은 caller 가 *empirical 401* 을 받았다는 신호이므로 DB 의 expiresAt 을 신뢰하면 안 됨 → short-circuit skip.
- **`removeOnComplete: { age: 0 }` for reactive_401**: BullMQ jobId dedup 이 60s 잔존 completed job 으로 dedup 시키면 worker 가 다시 안 돈다. age:0 이면 완료 즉시 제거 → 다음 reactive_401 add 가 새 job 생성. 같은 시점의 cross-pod reactive_401 동시성은 jobId dedup 으로 여전히 보호 (BullMQ 가 waiting/active 상태 job 을 같은 jobId 에 반환).
- **`refresh_token` exp 활용 (잔여 follow-up)**: 본 fix 범위 밖. `enqueueCafe24BackgroundRefresh` 의 `lastRotatedAt < now - 10d` 휴리스틱 대신 `refresh_token.exp - now < 4d` 직접 사용 가능 — 별도 plan 으로 분리.
- **마이그레이션**: 기존 row 의 (잘못된) `tokenExpiresAt` 은 본 fix 배포 후 다음 refresh 사이클에 자동 정정 (worker 가 force=true 로 refresh 실행 → 4-field atomic UPDATE 가 새 JWT exp 기반 값으로 덮어씀). 별도 SQL backfill 불필요.

## 처리 후

체크박스 모두 `[x]` + follow-up 0 건이면 `git mv plan/in-progress/cafe24-jwt-exp-fix.md plan/complete/cafe24-jwt-exp-fix.md` 를 본 PR 의 마지막 commit (`chore(plan): mark cafe24-jwt-exp-fix complete`) 에 포함.

## 출처

- 사용자 보고 2026-05-18 — 스크린샷 + "main HEAD 배포 상태" 명시.
- 동일 mall (`gehrig0301`) 의 이전 보고: `plan/complete/cafe24-proactive-refresh-fix.md`.
