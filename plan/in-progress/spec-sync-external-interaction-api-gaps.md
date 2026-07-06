---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# external-interaction-api — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/14-external-interaction-api.md

## 미구현 항목
- [x] **Outbound notification backoff 배율** (§3.1 EIA-NX-06 / §6.6) — base-4 (1s/4s/16s/64s/256s) custom BullMQ backoffStrategy 로 구현. worker `settings.backoffStrategy` + `NOTIFICATION_BACKOFF_TYPE`. spec §3.1/§6.6/data-flow-15 동기화. lint·unit·build·e2e 통과.
- [ ] **분산(다중 인스턴스) SSE / notification fan-out** (§R10) — 현재 `SseAdapter`·`NotificationFanout` 모두 단일 sink `WebsocketService.executionEvents$` 를 in-process(in-memory) RxJS 구독만 하고 Redis pub/sub 발행/구독이 없음. 코드 주석상 "v1 single-instance, 분산 fan-out follow-up". 다중 인스턴스에서 외부 SSE 클라이언트가 임의 인스턴스 접속 가능하려면 Redis pub/sub 도입 필요.
- [x] **Inbound per-execution rate-limit 및 `RATE_LIMITED` 429** (§5.1 / §8.4 rows 1·3) — `/interact` 60/분·status 120/분 (execution 당). `InteractionRateLimiterService`(Redis fixed-window, fail-open) + `InteractionRateLimitGuard` + `@RateLimit`. `429 RATE_LIMITED` + `Retry-After`. spec §5.1/§8.4/§3.1 EIA-NX-11 + §2-api-convention §7 + user-guide triggers.mdx/en.mdx 동기화. lint·unit·build·e2e 통과.
- [ ] **Outbound per-trigger rate-limit + 폭주 시 `notificationHealth=degraded`** (§8.4 row 4 / §3.1 EIA-NX-11, 권장) — inbound 와 분리한 잔여. 초과 시 동작(큐 적재 + degraded 표시)이 health 표면과 결합돼 카운터+degraded 를 한 벌로 후속 구현. (rate-limit 인프라 `InteractionRateLimiterService` 는 재사용 가능.)
- [ ] **`GET /api/external/executions/:id` 의 currentNode / context / seq 실값** (§5.3) — 현재 `getStatus()` 가 `currentNode: null`, `context: null`, `seq: 0` placeholder 고정 반환. 노드 context·최신 seq 노출 미구현.
- [ ] **SSE 버퍼 만료 시 `execution.replay_unavailable` emit** (§5.2 / §11 / EIA-IN-07 / EIA-NF-03) — 버퍼 내(5분) 재전송은 구현됨. 만료/누락분 silent drop 이며 만료 신호 emit 은 기존부터 계획·미구현으로 표기됨 (본 audit 신규 아님, 추적 보존).

## 후속 (cross-cutting, 본 spec 밖)
- [ ] **Redis fixed-window rate-limiter INCR+EXPIRE 원자화** — item 5 에서 `InteractionRateLimiterService.incrWithWindow` 는 원자 Lua EVAL 로 구현했으나, 동일 비원자 패턴(INCR 후 별도 EXPIRE)을 쓰는 기존 컴포넌트 `PublicWebhookQuotaService`(`codebase/backend/src/modules/hooks/`)·`ChatChannelRateLimiterService` 는 그대로다. 크래시/네트워크 단절 시 TTL-less 키 영구 잔류(fail-closed 잠금) 이론 위험 — 동일 Lua EVAL 로 통일. (ai-review concurrency + impl-done plan_coherence WARNING 발. session task `task_fa5c5e84` 로도 chip 발급.)

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__14-external-interaction-api.md 참조.
- 핵심 surface (REST 명령·SSE 스트림·iext/itk 토큰·HMAC 서명·SSRF·secret rotation·idempotency·CORS) 는 구현 완료. 위 항목은 hardening/배율/분산성 갭이며 기능 데드락은 아님.
