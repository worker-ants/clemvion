---
worktree: redis-bullmq-env-hardening-7a47dc
started: 2026-05-19
owner: developer
---

# Redis 인증/TLS 옵션 누락 보강 + .env.example 항목 추가

## 배경

ai-agent-turn-fail-finalize PR (#209) 의 후속 plan §"본 PR 범위 외" 항목.

`redisConfig` (`codebase/backend/src/common/config/redis.config.ts:15-24`) 는 `REDIS_PASSWORD` / `REDIS_TLS` 환경변수를 노출하지만 일부 소비자가 그 옵션을 connection 에 전달하지 않는 불일치 (W-72 와 같은 카테고리의 위험):

- `BullModule.forRootAsync` (`app.module.ts:174-182`) — `host` / `port` 만 전달
- `HealthService` (`health.service.ts:16-19`) — `host` / `port` 만 전달

운영 Redis 에 AUTH 가 도입되면 BullMQ Queue / Worker 가 reconnect loop 에 빠져 일일 스케줄러 (cafe24 background refresh 등) 가 영원히 fire 되지 않고, `/health` 의 redis 체크가 unhealthy 로 떨어진다. 현재는 운영 Redis 가 AUTH 미사용이라 잠복 결함.

다른 소비자 (`cafe24-install-nonce-cache.service.ts:57-66`, `continuation-bus.service.ts:91-98`) 는 이미 password / tls 를 전달 — 본 PR 로 모든 소비자를 일관화.

추가로 `.env.example` 에 `REDIS_PASSWORD` / `REDIS_TLS` 항목 누락 — 운영 가이드 차원에서 보강.

## 변경 범위

### 1) `codebase/backend/src/app.module.ts`

- [ ] `BullModule.forRootAsync` 의 `connection` 옵션에 `password`, `tls` 추가. 기존 `host` / `port` 와 같은 ConfigService 경로 (`redis.password`, `redis.tls`) 에서 읽음. `password` 가 empty/undefined 면 옵션 누락 (ioredis 가 AUTH command skip).

### 2) `codebase/backend/src/modules/health/health.service.ts`

- [ ] Redis client 생성 시 동일하게 `password`, `tls` 옵션 전달. `lazyConnect: true` 는 유지.

### 3) `codebase/backend/.env.example`

- [ ] Redis 섹션에 `# REDIS_PASSWORD=` (선택), `# REDIS_TLS=false` (선택) 항목 주석 형태로 추가.

### 4) 테스트

- [ ] `health.service` 자체에 단위 테스트가 없는 것으로 보이므로 신규 테스트 추가 필요 여부 판단. **결정**: 본 변경은 옵션 전달만 추가하는 1-line scope 라 별도 테스트 추가하지 않고 ConfigService mock 기반 검증은 deferred (별도 spec 정비 작업). 회귀 위험은 BullMQ / Health 의 기존 통합 테스트 (있다면) 와 lint/build 로 커버.

## 결정 사항

- **TLS 옵션 shape**: `{ tls: {} }` 형태로 통일 (다른 소비자와 동일 — `cafe24-install-nonce-cache.service.ts:64`).
- **password empty 처리**: spread + ternary 패턴 (`...(password ? { password } : {})`) — 다른 소비자와 동일.

## 후속 (별도 PR)

본 plan 의 scope 밖.
