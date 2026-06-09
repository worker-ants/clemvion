---
worktree: (complete)
started: 2026-06-02
completed: 2026-06-10
owner: developer
parent: plan/complete/eia-distributed-seq-counter.md
spec_impact: none
---

# ai-review backlog — 분산 seq counter PR(#413) 후속 3건

> PR #413(분산 seq counter)의 `/ai-review`(review/code/2026/06/02/08_12_43) 에서 식별된
> backlog 항목 중 사용자가 선택한 3건을 **각각 별도 PR** 로 처리.
> 미선택: W-3(JWT fallback 하드닝, 보안 결정 필요), W-2(SANITIZE_CACHE, 계측 선행).

## PR 1/3 — INFO-11: no-floating-promises warn → error (lint 강화)

- **목적**: await 누락(floating promise)을 빌드 전 lint 에서 차단. PR #413 의 async emit
  await 마이그레이션 리스크 class 를 영구 조기 검출.
- [x] `codebase/backend/eslint.config.mjs`: `'warn'` → `'error'`
- [x] 기존 위반 정리 — **런타임 src 위반 0**, 전부 `execution-engine.service.spec.ts` 의
      fire-and-forget 테스트 패턴 23곳 → `void` 명시 (의미 보존; await 는 flushPromises 타이밍 깨짐)
- [x] TEST WORKFLOW: lint ✓ / unit(backend 5455) ✓ / build ✓ / e2e (진행)
  - e2e 면제 불가 — `.spec.ts`·config 변경은 화이트리스트 회색지대(PROJECT.md §e2e 면제)
- [x] /ai-review + PR — **머지 #416** (`build(eslint): no-floating-promises warn → error`)

## PR 2/3 — INFO-5/9: ai-agent TOOL_CALL emit facade 단일화

- `ai-agent.handler.ts` 의 `TOOL_CALL_STARTED`/`COMPLETED` 직접 `WebsocketService` 호출 →
  `ExecutionEventEmitter` facade 경유. handler 생성처 배선 필요.
- [x] 완료 — **머지 #421** (`refactor(ai-agent): TOOL_CALL emit 을 ExecutionEventEmitter facade
      경유로 단일화`). emit 은 `ai-agent.handler.ts` 의 `eventEmitter?.emitExecution(...)` 단일
      sink 으로 통합, 생성처(`ai-agent.component.ts`)에서 `ExecutionEventEmitter` 배선.

## PR 3/3 — INFO-12: Redis client factory 공유

- 독립 `new Redis()` 8개 모듈 → 공유 `RedisClientFactory`/`REDIS_PROVIDER` 토큰. 연결 누적 해소.
- [x] 완료 — **머지 #422** (`refactor(redis): 8개 소비자의 독립 Redis 연결을 공유 단일 command
      연결로 통합`). 공유 `RedisConnectionProvider` (`common/redis/`) 도입, 8개 소비자 전환.

---

**완료 (2026-06-10)**: 3건 모두 별도 PR(#416·#421·#422)로 origin/main 머지 완료. 작업 PR 안에서
plan 이동이 누락돼 `in-progress/` 에 방치돼 있던 것을 라이프사이클 정리로 `complete/` 이동.
