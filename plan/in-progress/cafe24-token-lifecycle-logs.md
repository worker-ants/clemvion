---
worktree: cafe24-token-lifecycle-logs-196308
started: 2026-05-19
owner: developer
---

# Cafe24 API 호출 — access_token 유효시간 확인·갱신 로그 가시화

## 배경

운영에서 cafe24 백그라운드 갱신이 의도대로 동작하는지 디버깅하는 과정에서, 현재 토큰 lifecycle 의 핵심 transition 이 로그로 노출되지 않음을 확인:

- `ensureFreshToken` (`cafe24-api.client.ts:551`) — token TTL 평가 결과 / refresh 여부 결정 로그 없음
- `refreshAccessToken` (`:759`) — 시작 / 성공 로그 없음 (실패 401/403 만 warn)
- `executeWithRateLimit` (proactive ensureFreshToken 직후) — 정상 진입 / 401 자가회복 가시성 부족

운영 SRE 가 다음 질문에 답하려면 로그가 필요:
- "토큰이 매 호출 직전 갱신 시도되고 있는가? 아니면 캐시 신뢰만 하고 있는가?"
- "이 통합이 마지막으로 refresh 된 시각은 언제인가?"
- "401 자가회복 흐름이 실제로 fire 되는가?"

본 PR 은 토큰 lifecycle 의 핵심 transition 4개 (skip-fresh / refresh-trigger / refresh-success / refresh-fail) 에 일관된 로그 prefix 와 metric 친화적 구조화 메시지를 추가한다.

## 변경 범위

### 1) `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`

#### `ensureFreshToken` 분기에 로그 추가

- [ ] **skip (fresh)** — `debug` 레벨: `Cafe24 token fresh — skip refresh (integrationId=X mall_id=Y ttlSec=N)`. 정상 호출 마다 발사되므로 debug 로.
- [ ] **refresh trigger (proactive)** — `log` (info) 레벨: `Cafe24 token expiring or null — proactive refresh (integrationId=X mall_id=Y ttlSec=N|null source=proactive)`. 비흔히 발생 (2h 마다 1회 정도). 운영 인사이트 가치 높음.
- [ ] **null tokenExpiresAt 분기** — `log` 레벨 + `ttlSec=null source=proactive_null_expiry` 라벨로 분기 가시화.

#### `refreshAccessToken` 시작/성공 로그

- [ ] **시작** — `log` 레벨: `Cafe24 token refresh starting (integrationId=X mall_id=Y app_type=Z)`. 큐 worker 경로와 in-process fallback 경로 양쪽에서 동일 발사 — caller stack 으로 구분.
- [ ] **성공** — `log` 레벨: `Cafe24 token refresh succeeded (integrationId=X mall_id=Y newExpiresAt=ISO refreshTokenRotated=true|false)`. 새 expires_at 동봉으로 다음 refresh 시점 예측 가능.
- [ ] **실패 (이미 warn 있음)** — message 에 `integrationId` 추가하여 검색성 향상.

#### `executeWithRateLimit` 401 자가회복

- [ ] **401 트리거** — `log` 레벨: `Cafe24 401 detected — performAuthRefresh + retry (integrationId=X mall_id=Y retryCount=N)`. 이미 존재하는 warn 들과 충돌하지 않도록 message prefix 통일.

### 2) `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`

- [ ] `enqueueCafe24BackgroundRefresh` 의 enqueue 성공 로그 (`Cafe24 background refresh: enqueued N/M`) 는 이미 있음. 별도 보강 없음. 각 enqueue 실패 warn 메시지에 `integrationId` 가 이미 있음 — 변경 없음.

### 3) 테스트

- [ ] `cafe24-api.client.spec.ts` — 신규 로그가 도입되어도 기존 assertion 영향 없음. 새 로그 자체에 대한 assertion 은 추가하지 않음 (로그는 운영 진단용, contract 가 아님). 다만 회귀 가드로 `ensureFreshToken` 호출 시 `logger.log` 가 최소 1회 호출되는지 정도의 smoke test 는 검토.
- [ ] **결정**: 본 PR 은 로그 보강이라 contract test 추가 안 함. 기존 테스트 4047 회귀 없음을 확인하는 것으로 충분.

## 결정 사항

- **로그 레벨 분리**:
  - `debug` — 정상 path (token fresh skip). 매 호출 발사되므로 production noise 회피.
  - `log` (info) — refresh trigger / success / 401 trigger. 디버깅 인사이트 가치 높고 발사 빈도가 낮음.
  - `warn` — 실패 (기존). 그대로 유지.
- **공통 prefix**: `Cafe24 token …` 으로 통일해 운영 로그 grep 친화적.
- **구조화 라벨**: `integrationId=X mall_id=Y ttlSec=N source=...` 형태로 key=value pairs. JSON 로깅 환경에서 파싱 가능.
- **mall_id 동봉**: credentials.mall_id 가 운영자 식별의 1차 키. 단 로그에서 access_token / refresh_token 자체는 절대 노출하지 않음 (이미 sanitize 가 있지만 본 PR 의 신규 로그가 새 노출 경로를 만들지 않도록 명시 점검).

## 후속 (별도 PR — 본 plan 범위 외)

- spec 갱신 follow-up (cron 6h, 7일 cutoff, status machine waiting_for_input → failed 전이) — project-planner 위임 진행 중 (Task #13).
