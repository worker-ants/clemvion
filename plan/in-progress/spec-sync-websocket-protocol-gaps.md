---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# websocket-protocol — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/6-websocket-protocol.md

## 배경

spec 초안은 raw/native WebSocket 프로토콜을 전제했으나 구현은 Socket.IO (namespace `/ws`) 기반이다. 본 spec 의 transport 서술은 Socket.IO 현실에 맞춰 정정했고, 아래 항목은 코드에 실재 부재하는 약속이라 미구현(Planned)으로 분리했다.

## 미구현 항목 (잔여 — 실 기능 backlog)
- [ ] 서버발신 `auth.token_expired` 시스템 이벤트 emit (§4.5)
- [x] `notifications:{userId}` 채널의 `notification.new` emit 경로 — **완료** (`spec-sync-data-flow-8-notifications-gaps.md` PR1, `WebsocketService.emitNotificationEvent`). §4.4 spec 본문 "계획·미구현" 배지 flip 은 `plan/in-progress/spec-update-notifications-ws-emit.md`(planner) 위임.
- [ ] `system.maintenance` 시스템 이벤트 emit (§4.5)
- [ ] 서버발신 application-level ping (현재 app ping 은 client→server 방향만, §5)
- [x] WS 명령 rate-limit (socket 당 60 msg/min) + `RATE_LIMITED` 코드 (§7.1) — `WsRateLimiterService`(in-memory per-socket fixed-window) + `WsRateLimitGuard`(class-level, `WsException` → `exception` 이벤트). lint·unit·build·e2e 통과.
- [x] 전용 WS 에러 코드 `INVALID_MESSAGE` / `UNKNOWN_TYPE` / `SUBSCRIPTION_LIMIT_EXCEEDED` (§3.3·§3.4·§7.1) — `WsErrorCode` enum 확장. subscribe ack `code` additive, 미등록 이벤트 `onAny` → `error{code}`. spec §7.1/§3.3/§3.4/§7.2 + `3-error-handling.md §1.5` 동기화. lint·unit·build·e2e 통과.

## 비채택 (won't-do) — 종결 2026-07-08 (사용자 결정)
> spec 본문 표기 _(비채택 won't-do)_ 로 전환 + Rationale `R-wontdo-rawws-rest` 기록 (6-websocket-protocol.md). "언젠가 구현" backlog 가 아니라 현 아키텍처에서 도입하지 않기로 확정한 항목.

- [x] **[won't-do] in-band 토큰 갱신** — `auth.refresh`/`auth.refreshed` WS 메시지 핸들러·emit (§1.3). **REST 대체 충분**: REST `/auth/refresh` + Socket.IO 재연결이 정식 세션유지 모델. in-band 갱신 이득 < 별도 WS auth 프로토콜 유지 비용.
- [x] **[won't-do] `execution.start`/`execution.stop`/`execution.start.ack` WS 명령** (§4.2). **REST 대체 충분**: 시작=REST `POST /workflows/:id/execute`·중단=REST `POST /executions/:id/stop` 정식. WS 시작/중단은 순수 중복 표면. (continue/step 은 별개 브레이크포인트 로드맵 — 미포함)
- [x] **[won't-do] `Sec-WebSocket-Protocol: bearer, {token}` 서브프로토콜 인증** (§1.2). **raw-WS 전제**: Socket.IO 는 서브프로토콜을 앱에 노출 안 함. query/auth 두 위치가 인증 완결. 전송 교체 없는 한 구현 대상 부재.
- [x] **[won't-do] 애플리케이션 레벨 WebSocket close code 매핑** (1000/1001/1008/4000/4001, §8). **raw-WS 전제**: Socket.IO 는 close code 를 앱에 노출 안 함. `disconnect`/`connect_error` 로 재연결 판단.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__6-websocket-protocol.md 참조.
- 위 4종 won't-do 는 전송계층이 Socket.IO 로 확정된 이상 raw-WS 2종은 영구 미도입, REST 대체 2종은 의도적 미도입이라 "Planned" 표기가 잘못된 기대를 남겨 명시 종결함. 잔여 3종(auth.token_expired·system.maintenance·server ping)만 실 backlog.
