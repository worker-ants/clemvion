---
worktree: redis-client-factory-5dae24
started: 2026-06-02
owner: developer
parent: plan/complete/eia-distributed-seq-counter.md
---

# PR 3/3 — INFO-12: 공유 Redis command 연결 (8→1)

> PR #413 분산 seq counter `/ai-review`(08_12_43) INFO-12. ai-review backlog 3건 중 3번째.
> 사용자 결정: **공유 단일 client (연결 8→1)**.

## 배경

8개 서비스가 각자 `new Redis(config)` 로 독립 연결을 만들어 인스턴스당 Redis 연결이 모듈 수만큼
누적. 모두 **command-only** (get/set/del/incr/expire/pipeline/SET NX — blocking·pub/sub 없음)이라
단일 연결 multiplexing 안전.

## 변경

- 신규 `common/redis/redis-connection.provider.ts` — `RedisConnectionProvider` (lazy 단일 command
  연결, `getClient()`/`getClientOrNull()`, config 중앙화, `onModuleDestroy` 단일 quit, lazyConnect).
- 신규 `common/redis/redis.module.ts` — `@Global() RedisModule`. app.module 등록.
- 8개 소비자 migration (각자 `new Redis()` 제거 → provider 주입, degrade `if(!redis)` 보존,
  자체 `.quit()`/onModuleDestroy 제거 — 공유 client 는 소비자가 종료 안 함):
  - [x] interaction-token (blacklist degrade)
  - [x] idempotency.interceptor (injectedRedis seam 유지)
  - [x] cafe24-install-nonce-cache
  - [x] public-webhook-quota
  - [x] channel-conversation
  - [x] execution-seq-allocator (lazy getClient → provider 위임, in-memory degrade 유지)
  - [x] continuation-bus lockClient (BullMQ Queue 는 별도 — 미변경)
  - [x] health.service
- 4개 spec migration (quit/lazy-mock 패턴 → provider mock). injectedRedis seam 쓰는 spec 은 무영향.

## 검증

- [x] invariant: 소비자 quit 0 / `new Redis(` 잔여 0 / 8 소비자 provider 주입 / build 0
- [x] lint / unit(backend 5452) / build
- [x] e2e — PASS 140 (공유 연결 런타임 검증; 최신 origin/main 리베이스 후 재통과)
- [x] /ai-review (11_23_34, rebase 후 단일 커밋) — HIGH Critical 1/Warning 11 전부 fix + RESOLUTION (11_11_19 은 stale-ref false 폐기)
- [ ] PR

## 비고

BullMQ 연결(`maxRetriesPerRequest: null` 필요)은 본 provider 가 관리하지 않음 — command-only 한정.
