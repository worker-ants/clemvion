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

## 미구현 항목
- [ ] in-band 토큰 갱신 — `auth.refresh` (Client→Server) / `auth.refreshed` (Server→Client) WS 메시지 핸들러·emit (현재는 REST refresh + 재연결로 갈음, §1.3)
- [ ] 서버발신 `auth.token_expired` 시스템 이벤트 emit (§4.5)
- [ ] `execution.start` / `execution.stop` WS 명령 + `execution.start.ack` (현재 실행 시작/중단은 REST `POST /workflows/:id/execute` / `POST /executions/:id/stop`, §4.2)
- [ ] `notifications:{userId}` 채널의 `notification.new` emit 경로 (채널 prefix 만 등록, emit 코드 부재, §4.4)
- [ ] `system.maintenance` 시스템 이벤트 emit (§4.5)
- [ ] 서버발신 application-level ping (현재 app ping 은 client→server 방향만, §5)
- [ ] WS 명령 rate-limit (60 msg/min) + `RATE_LIMITED` 코드 (§7.1)
- [ ] 전용 WS 에러 코드 `INVALID_MESSAGE` / `UNKNOWN_TYPE` / `SUBSCRIPTION_LIMIT_EXCEEDED` (현재 한도/권한 거부는 평면 `error` 문자열, §3.3·§3.4·§7.1)
- [ ] (raw-WS 전제) `Sec-WebSocket-Protocol: bearer, {token}` 서브프로토콜 인증 경로 (§1.2) — Socket.IO 전송에선 비적용. 재검토 필요 시에만.
- [ ] (raw-WS 전제) 애플리케이션 레벨 WebSocket close code 매핑 (1000/1001/1008/4000/4001, §8) — Socket.IO 전송에선 비노출. 재검토 필요 시에만.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__6-websocket-protocol.md 참조.
- §1.2 서브프로토콜 인증·§8 close code 는 raw-WS 전제 항목이라 Socket.IO 유지 시 영구 비적용일 수 있다 — 구현보다는 spec 약속 정리 차원의 잔여로 남긴다.
