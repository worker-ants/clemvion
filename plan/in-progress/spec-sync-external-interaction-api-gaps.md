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
- [x] **Outbound per-trigger rate-limit + 폭주 시 `notificationHealth=degraded`** (§8.4 row 4 / §3.1 EIA-NX-11, 권장) — `OutboundNotificationRateLimiterService`(Redis fixed-window INCR+EXPIRE NX, fail-open) + `NotificationWebhookProcessor` 발송 성공 분기: >60/분이면 healthy 대신 degraded + 폭주 전용 last_error(발송실패 degraded 와 원인 구분). **폐기 없이 발송(무손실)** — throttle 아님. spec §8.4 row4/§3.1 EIA-NX-11 구현됨 flip + §Rationale R-outbound-flood + data-flow/15 §1.4 다이어그램 분기. lint·unit·build·e2e·ai-review(Critical 0)·consistency(BLOCK:NO) 통과. **PR #845**.
- [x] **`GET /api/external/executions/:id` 의 currentNode / context 실값** (§5.3) — **완료/정합 확인 (2026-07-08 재검증)**: `getStatus()` 가 `WAITING_FOR_INPUT` 상태에서 대기 `NodeExecution.outputData` 로부터 `currentNode`(id/type/interactionType)·`context`(buttons=`buttonConfig{buttons,nodeOutput}`, form/ai_conversation=`nodeOutput`)를 SSE `waiting_for_input` wire 와 동일 형식으로 복원(`interaction.service.ts` 의 `getStatus()` — `WAITING_FOR_INPUT` 분기. 라인 인용은 리팩터마다 stale 화돼 심볼로 고정). spec §5.3 "구현 상태(V1)" 노트도 이미 동기화됨. `seq` 는 항상 `0`(`SSE_SEQ_PLACEHOLDER`)이며 이는 **의도된 설계** — REST 단발 응답은 in-memory SSE seq 에 접근 불가, 클라이언트가 SSE `Last-Event-Id` 로 보정(spec §5.3 명시). running(비대기) 상태 currentNode 노출은 spec 이 약속하지 않음(V1 = waiting 한정).
  - **축 분리 주의**: 본 항목은 **런타임 실값**(context 가 null placeholder 가 아닌가)만 종결한다. 그 실값의 **OpenAPI 스키마 표현**(`additionalProperties` 로 뭉개짐)과 **부재 표현 컨벤션**(`null` vs 키 생략)은 별도 축이며 `spec-draft-eia-context-schema-absence-convention.md` 에서 진행한다 — 본 `[x]` 를 "getStatus.context 관련 갭 전부 종결" 로 읽지 말 것.
- [x] **SSE 버퍼 만료 시 `execution.replay_unavailable` emit** (§5.2 / §11 / EIA-IN-07 / EIA-NF-03) — **완료 (2026-07-08)**: `sse-adapter.service.ts` `replayOrSignalUnavailable` 이 재연결 replay 시 재생 가능한 가장 이른 seq 가 `Last-Event-Id+1` 이 아니면(만료 또는 cap 폐기 gap) 부분 replay 대신 `execution.replay_unavailable`(seq=0 control frame) 1회 push → 클라 REST 재조회. `writeSseFrame` 이 seq≤0 시 `id:` 라인 생략(Last-Event-Id 오염 방지). spec-sync: EIA §5.2/§11(EIA-IN-07·EIA-NF-03·vocab)·Rationale R-replay-unavailable + WS §6.2(3곳)·widget-app §3.1·data-flow/15 §1.3 동기화. unit(sse-adapter 6건·writeSseFrame 3건)·lint·build 통과.
  - [ ] **(후속) web-chat 위젯 클라이언트 소비** — 위젯은 이벤트 리스너를 이미 등록(`eia-client.ts`)했으나 `use-widget.ts handleEiaEvent` 에 `execution.replay_unavailable` case 가 없어 no-op. 로컬 시간(>5분) 폴백을 이벤트 기반 감지로 교체하는 클라이언트 작업 필요(spec widget-app §3.1 TODO). channel-web-chat 범위 — 별도.
- [ ] **`getStatus` 일반 `nodeOutput` 키-allowlist** (§R17 잔여) — §R17 이 "conversationConfig 이외의 일반 `nodeOutput` 키-allowlist 만 잔여 항목" 이라 명시했으나 등재된 plan 이 없었다. 현재 `conversationThread`·`ai_message`·`nodeOutput.conversationConfig` 는 `redactThreadForPublic`/`deepRedactSecrets` 로 마스킹되지만 그 외 `nodeOutput` 키는 공개 표면에 그대로 실린다. 도입 시 §R17 잔여 문구 flip. (2026-07-10 consistency `plan-coherence` W3 로 등재 — spec-impl-evidence R-5 "빈 약속 영구 누락" 방지.)
- [x] **host `resetSession` booting 중 중복 webhook 가드** — **결정(2026-07-11) + 위젯 구현 완료**: **single-flight coalesce**(서버 멱등 아님) — booting 중 `resetSession` 은 in-flight `start()` 에 흡수되어 2번째 POST·2번째 execution 미생성. spec lock = [widget-app §R9·§3.1](../../spec/7-channel-web-chat/1-widget-app.md). 구현: `channel-web-chat/use-widget.ts newChat` (commit `e577f1b69`, branch `claude/webchat-widget-coalesce-cancel`). 서버 무변경 항목이라 본 항목 종결.
- [~] **공개 위젯 idle-wait execution GC (EIA-RL-07)** — **결정(2026-07-11) 완료; 구현 부분 완료(위젯 B-1) · 백엔드 잔여**: ①"새 대화" best-effort `cancel`(source, widget-app §R9) = **위젯 구현 완료**(commit `e577f1b69`). ②서버측 **idle-wait timeout backstop**(토큰 영구 만료+grace → `cancelled`/`WEBCHAT_IDLE_TIMEOUT`, EIA-RL-06 형 repeatable sweep) = **미구현(PR-2 대기, Planned)** — EIA §3.4 EIA-RL-07 구현상태 마커. §7.4 무기한 보존 불변식과 정합(§1.1 예약 "타임아웃" 사유 구현). 결정 SoT [`spec-draft-webchat-execution-residuals.md`](./spec-draft-webchat-execution-residuals.md), spec lock = EIA §3.4 EIA-RL-07·§R19. **잔여**: 서버 reaper 구현(별 PR-2).

## 후속 (cross-cutting, 본 spec 밖)
- [x] **Redis fixed-window rate-limiter INCR+EXPIRE 원자화** — `PublicWebhookQuotaService.incrWithWindow` 를 `INCR + EXPIRE ... NX` 단일 pipeline(매 요청)으로 교정해 TTL 유실 self-heal (fail-closed 잠금 창 제거). `ChatChannelRateLimiterService` 는 **이미** 동일 `INCR + EXPIRE NX` 단일 pipeline 패턴이라 무변경(점검 완료). `InteractionRateLimiterService`(item 5)는 Lua EVAL — 세 서비스 모두 원자/self-heal 확보. (PR #843 ai-review concurrency WARNING 후속, `task_fa5c5e84`.)

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__14-external-interaction-api.md 참조.
- 핵심 surface (REST 명령·SSE 스트림·iext/itk 토큰·HMAC 서명·SSRF·secret rotation·idempotency·CORS) 는 구현 완료. 위 항목은 hardening/배율/분산성 갭이며 기능 데드락은 아님.
