---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# external-interaction-api — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/14-external-interaction-api.md

## 미구현 항목
- [ ] **Outbound notification backoff 배율** (§3.1 EIA-NX-06 / §6.6) — spec 본래 의도는 base-4 간격 (1s/4s/16s/64s/256s) 이나 현 구현은 BullMQ default `exponential` (base delay 1s, base*2^n → 1s/2s/4s/8s/16s). 4배율은 custom backoff strategy 필요. (`notification-dispatcher.service.ts` `delay: 1000`)
- [ ] **분산(다중 인스턴스) SSE / notification fan-out** (§R10) — 현재 `SseAdapter`·`NotificationFanout` 모두 단일 sink `WebsocketService.executionEvents$` 를 in-process(in-memory) RxJS 구독만 하고 Redis pub/sub 발행/구독이 없음. 코드 주석상 "v1 single-instance, 분산 fan-out follow-up". 다중 인스턴스에서 외부 SSE 클라이언트가 임의 인스턴스 접속 가능하려면 Redis pub/sub 도입 필요.
- [ ] **Per-execution / per-trigger rate-limit 및 `RATE_LIMITED` 429** (§5.1 에러 표 / §8.4 / §3.1 EIA-NX-11) — inbound `/interact` (분당 60), status 조회 (분당 120), outbound notification (trigger 당 분당 60) rate-limit 미구현. 구현된 유일한 429 는 SSE 동시연결 초과(`TOO_MANY_CONNECTIONS`). `RATE_LIMITED` 코드·`Retry-After` 헤더 부재.
- [ ] **`GET /api/external/executions/:id` 의 currentNode / context / seq 실값** (§5.3) — 현재 `getStatus()` 가 `currentNode: null`, `context: null`, `seq: 0` placeholder 고정 반환. 노드 context·최신 seq 노출 미구현.
- [ ] **SSE 버퍼 만료 시 `execution.replay_unavailable` emit** (§5.2 / §11 / EIA-IN-07 / EIA-NF-03) — 버퍼 내(5분) 재전송은 구현됨. 만료/누락분 silent drop 이며 만료 신호 emit 은 기존부터 계획·미구현으로 표기됨 (본 audit 신규 아님, 추적 보존).

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__14-external-interaction-api.md 참조.
- 핵심 surface (REST 명령·SSE 스트림·iext/itk 토큰·HMAC 서명·SSRF·secret rotation·idempotency·CORS) 는 구현 완료. 위 항목은 hardening/배율/분산성 갭이며 기능 데드락은 아님.
