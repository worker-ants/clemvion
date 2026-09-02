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
- [x] 종결 3종의 `durationMs`(본 문서 표기 `duration`) — **본 문서는 더 이상 SoT 가 아니다.**
      > ✅ **완료 확인 (2026-08-28 `plan-audit`)** — EIA 트래커 :22 '[x] durationMs emit — 완료(2026-08-15, 0f0050dea+0dce2a83f)'. spec 14-EIA '종결 이벤트의 필드 집합' durationMs 행=구현됨. execution-event-emitter.service.ts:32-41,146 이 3종 payload 에 적재(#1171).
      > 적대적 재검증 통과(반증 시도 실패). 원 서술은 이력이라 그대로 둔다.
      2026-08-13 부터 필드 계약은 [EIA §6 도입부](../../spec/5-system/14-external-interaction-api.md#종결-이벤트의-필드-집합-normative)
      가 소유하며, 이 항목의 추적도 그쪽 트래커(`spec-sync-external-interaction-api-gaps.md`)가
      정본이다. 여기 남기는 것은 WS 쪽에서 찾는 사람을 위한 포인터다
- [ ] 서버발신 `auth.token_expired` 시스템 이벤트 emit (§4.6 — 2026-08-31 절번호 이동 전 §4.5)

      > **⚠ "emit 한 줄 추가" 가 아니다 — 착수 전 결정이 필요하다 (2026-08-31 실측 등재).**
      >
      > 이 항목을 착수하려다 **plan 에 없던 사실**을 실측했다: **WS 소켓은 핸드셰이크
      > 이후 토큰을 한 번도 재검증하지 않는다.**
      >
      > | 측정 | 값 |
      > |---|---|
      > | `jwtService.verify` 호출부 | `websocket.gateway.ts:156` **단 1곳** (`handleConnection` 내부) |
      > | gateway 의 `exp` 참조 | **0건** |
      > | gateway 의 `setTimeout`/`setInterval` | **0건** |
      > | `src/modules/websocket/` 의 guard | `ws-rate-limit.guard.ts` 뿐 — **auth guard 없음** |
      >
      > 결과: **한 번 연결된 소켓은 토큰이 만료돼도 무기한 살아 있고 계속 이벤트를 받는다.**
      > §1.2 가 서술하는 복구 경로(*"연결 중 토큰 만료: 클라이언트는 `connect_error` 를 받으면
      > REST `/auth/refresh` … 재연결"*)는 **새 연결 시도에서만 발화**하므로 이미 연결된
      > 소켓에는 적용되지 않는다 — 즉 §1.2 의 그 문장은 살아있는 소켓의 만료를 **다루지 않는다**.
      >
      > **그래서 결정이 필요한 것**: 이 이벤트를 emit 한 뒤 **disconnect 하는가**.
      > - 안 끊으면 *"토큰 만료됨"* 을 알리고도 그 소켓은 계속 인가된 채로 남는다 —
      >   위 갭이 그대로다.
      > - 끊으면 **현재 살아남던 소켓이 끊기는 동작 변경**이다. §4.6 payload 는 `{ message }`
      >   뿐이고 disconnect 를 말하지 않으며, §1.3 이 *REST 재발급 + 재연결*을 정식 모델로
      >   확정했으므로 방향은 정합하지만 **spec 본문이 그 전이를 적고 있지 않다**.
      >
      > developer 권한 밖(제품 semantics + 동작 변경)이라 여기서 멈춘다. planner 턴이
      > §1.2·§4.6 에 (a) 소켓 수명이 토큰 수명에 종속되는가 (b) 사전 통지 lead time 이
      > 있는가 두 가지를 적어 주면 구현은 작다(핸드셰이크에서 `exp` 를 읽어 소켓별 타이머,
      > `handleDisconnect` 에서 해제).
- [x] `notifications:{userId}` 채널의 `notification.new` emit 경로 — **완료** (`spec-sync-data-flow-8-notifications-gaps.md` PR1, `WebsocketService.emitNotificationEvent`). §4.5 spec 본문 "계획·미구현" 배지 flip 은 `plan/in-progress/spec-update-notifications-ws-emit.md`(planner) 위임.
- [x] WS 명령 rate-limit (socket 당 60 msg/min) + `RATE_LIMITED` 코드 (§7.1) — `WsRateLimiterService`(in-memory per-socket fixed-window) + `WsRateLimitGuard`(class-level, `WsException` → `exception` 이벤트). lint·unit·build·e2e 통과.
- [x] 전용 WS 에러 코드 `INVALID_MESSAGE` / `UNKNOWN_TYPE` / `SUBSCRIPTION_LIMIT_EXCEEDED` (§3.3·§3.4·§7.1) — `WsErrorCode` enum 확장. subscribe ack `code` additive, 미등록 이벤트 `onAny` → `error{code}`. spec §7.1/§3.3/§3.4/§7.2 + `3-error-handling.md §1.5` 동기화. lint·unit·build·e2e 통과.

## 비채택 (won't-do) — 2026-07-08 4종 · 2026-09-02 2종 (각 사용자 결정)
> spec 본문 표기 _(비채택 won't-do)_ 로 전환 + Rationale 기록 (6-websocket-protocol.md). "언젠가 구현" backlog 가 아니라 현 아키텍처에서 도입하지 않기로 확정한 항목.
> 근거 항목: 2026-07-08 4종 = `R-wontdo-rawws-rest` · 2026-09-02 2종 = `R-wontdo-maintenance-appping`.

- [x] **[won't-do] in-band 토큰 갱신** — `auth.refresh`/`auth.refreshed` WS 메시지 핸들러·emit (§1.3). **REST 대체 충분**: REST `/auth/refresh` + Socket.IO 재연결이 정식 세션유지 모델. in-band 갱신 이득 < 별도 WS auth 프로토콜 유지 비용.
- [x] **[won't-do] `execution.start`/`execution.stop`/`execution.start.ack` WS 명령** (§4.2). **REST 대체 충분**: 시작=REST `POST /workflows/:id/execute`·중단=REST `POST /executions/:id/stop` 정식. WS 시작/중단은 순수 중복 표면. (continue/step 은 별개 브레이크포인트 로드맵 — 미포함)
- [x] **[won't-do] `Sec-WebSocket-Protocol: bearer, {token}` 서브프로토콜 인증** (§1.2). **raw-WS 전제**: Socket.IO 는 서브프로토콜을 앱에 노출 안 함. query/auth 두 위치가 인증 완결. 전송 교체 없는 한 구현 대상 부재.
- [x] **[won't-do] 애플리케이션 레벨 WebSocket close code 매핑** (1000/1001/1008/4000/4001, §8). **raw-WS 전제**: Socket.IO 는 close code 를 앱에 노출 안 함. `disconnect`/`connect_error` 로 재연결 판단.

### 2026-09-02 추가 종결 2종

> 2026-07-08 결정이 "트리거 소스 설계가 필요하다" 며 범위 밖에 뒀던 3종 중 2종. 2026-08-31
> 착수 시도의 실측이 **설계가 필요한 게 아니라 대상이 없다**는 것을 보였고, 그 실측을 근거로
> 사용자가 종결을 결정했다.

- [x] **[won't-do] `system.maintenance` 시스템 이벤트 emit** (§4.6). **발화 주체 부재**: 실측(2026-09-02) `system.maintenance` 는 `spec/` 에만 있고 **백엔드 코드 0건** — 유지보수를 선언하는 관리자 API·설정·스케줄이 없고 계획에도 없다. payload 의 `scheduledAt` 은 사람이 미래 시점을 선언해야 성립하므로 그 표면 신설은 갭 메우기가 아니라 **신규 제품 기능**이다. 유일 후보인 `onApplicationShutdown`(SIGTERM)은 **사전 예고가 없어** `scheduledAt` 과 다른 사건이라 기각. payload 형태는 재도입 대비로 spec §4.6 에 남긴다.
- [x] **[won't-do] 서버발신 application-level ping** (§5). **전송 계층이 이미 채움**: §5.1 이 Socket.IO/Engine.IO 내장 ping/pong(`pingInterval` 25s / `pingTimeout` 20s)으로 확정. 그 위의 앱 레벨 서버발신 ping 은 소비처도 주기도 정의되지 않은 주기적 브로드캐스트를 하나 더 만든다. 2026-07-08 종결된 raw-WS 2종과 **같은 초안 전제**에서 온 잔재다.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__6-websocket-protocol.md 참조.
- 2026-07-08 4종 + 2026-09-02 2종 won't-do 는 "Planned" 표기가 잘못된 기대(언젠가 구현)를 남겨 명시 종결한 것이다. **잔여는 `auth.token_expired` 1종**이며 그것만 실 backlog 다.
  > **~~"실 backlog" 를 "착수 가능" 으로 읽지 말 것 (2026-08-31 정정). 셋을 착수하려고~~**
  > ~~열어 보니 **세 개 모두 구현 앞에 결정이 하나씩 있다**. 요약: `auth.token_expired` =~~
  > ~~소켓 수명이 토큰 수명에 종속되는가(동작 변경) · `system.maintenance` = 유지보수를~~
  > ~~선언하는 주체가 없다(설계) · server ping = 위 4종과 같은 won't-do 가 답일 수 있다(처분).~~
  >
  > **(2026-09-02 갱신)** 위 세 결정 중 **둘이 내려졌다** — `system.maintenance`·server ping 은
  > 각각 그 실측대로 won't-do 로 종결됐다(§비채택). 원 서술은 그 조사의 이력이라 취소선으로
  > 남긴다.
  >
  > **남은 하나에만 적용된다**: `auth.token_expired` 는 여전히 착수 전 결정이 필요하다 —
  > **소켓 수명이 토큰 수명에 종속되는가**(ⓐ)와 **사전 통지 lead time 을 두는가**(ⓑ). 둘 다
  > 제품 semantics + 동작 변경이라 developer 권한 밖이다. 정해지면 구현은 작다(핸드셰이크에서
  > `exp` 를 읽어 소켓별 타이머, `handleDisconnect` 에서 해제).
