---
worktree: plan-in-progress-items-b0c80b (branch claude/ws-token-expired-lifetime)
started: 2026-09-02
owner: planner
spec_impact:
  - spec/5-system/6-websocket-protocol.md
---

# spec draft — WS 소켓 수명을 토큰 수명에 종속시킨다 (`auth.token_expired`)

> 대상: [`spec/5-system/6-websocket-protocol.md`](../../spec/5-system/6-websocket-protocol.md) §1.2 · §4.6 · Rationale
> 착수 근거: [`spec-sync-websocket-protocol-gaps.md`](./spec-sync-websocket-protocol-gaps.md) 잔여 **1종**.
> 사용자 결정 2026-09-02 — 제시된 4안 중 **(a) emit + disconnect + lead time** 채택.

## 배경 — "emit 한 줄 누락" 이 아니라 인가 갭이다

2026-08-31 이 항목을 착수하려던 developer 가 plan 에 없던 사실을 실측했다: **WS 소켓은
핸드셰이크 이후 토큰을 한 번도 재검증하지 않는다.**

| 측정 (2026-09-02 재확인) | 값 |
|---|---|
| access token 수명 (`auth.module.ts`) | **900초 (15분)** |
| `jwtService.verify` 호출부 (`modules/websocket/`) | **1곳** — `handleConnection` 내부 |
| gateway 의 `exp` 참조 | **0건** |
| gateway 의 `setTimeout`/`setInterval` | **0건** |
| `modules/websocket/` 의 auth guard | **없음** (`ws-rate-limit.guard.ts` 뿐) |

→ **한 번 연결된 소켓은 15분짜리 토큰으로 무기한 인가된 채 이벤트를 계속 받는다.**

§1.2 가 서술하는 복구 경로(*"연결 중 토큰 만료: 클라이언트는 `connect_error` 를 받으면 REST
`/auth/refresh` … 재연결"*)는 **새 연결 시도에서만 발화**하므로 이미 연결된 소켓에는 적용되지
않는다. 즉 그 문장은 **살아있는 소켓의 만료를 다루지 않는다.**

## 결정

**소켓 수명은 토큰 수명에 종속된다.** 서버는 핸드셰이크에서 검증한 토큰의 `exp` 를 읽어
소켓별 타이머를 걸고, 만료 **60초 전**에 `auth.token_expired` 를 1회 emit 한 뒤 `exp` 도달
시 `disconnect()` 한다.

### 기각된 대안 (사용자에게 제시한 4안)

| 안 | 기각 사유 |
|---|---|
| **(b)** emit 만, disconnect 없음 | *"만료됐다"* 고 알리고도 그 소켓을 **인가된 채로 둔다** — 갭을 문서화할 뿐 닫지 않는다 |
| **(c)** 명령마다 재검증(guard) | 명령은 막지만 **수신을 못 막는다.** WS 는 push 중심이라 구독만 하는 소켓은 만료 토큰으로 계속 데이터를 받는다 |
| **(d)** won't-do | 인가 갭을 알고도 방치하는 것 |

### 왜 lead time 인가 · 왜 60초인가

disconnect 만 하면 **현재 살아남던 소켓이 예고 없이 끊기는 동작 변경**이다. 사전 통지가 있으면
클라이언트가 만료 전에 REST 재발급 + 재연결을 마쳐 사용자에게는 끊김이 보이지 않는다.

60초는 **15분 토큰의 4%** 이고, 클라이언트가 REST refresh → `auth.token` 교체 → 재연결에 쓰는
시간(수백 ms 규모)의 넉넉한 배수다. 더 길면 만료 전 유효 창을 그만큼 깎고, 더 짧으면 네트워크
지연·백그라운드 탭에서 갈아탈 시간이 모자란다.

### payload 를 `{ message }` → `{ message, expiresAt }` 로

사전 통지가 성립하려면 클라이언트가 **마감 시각**을 알아야 한다. `message` 만으로는 "지금
갈아타야 하는가, 1분 남았는가" 를 구별할 수 없다.

**미구현(Planned) 이벤트라 wire 호환 부담이 없다** — 지금 정의하는 것이 가장 싸다.

## 변경안 — spec 6곳 · plan 3곳 전수

> **직전 draft 가 "9개 자리 전수" 라 적고 `spec/` 안에서만 세다 checker 에 잡혔다.** 이번엔
> 처음부터 `spec/`·`plan/` 양쪽을 센다. 아래는 `grep -rn "auth\.token_expired"` 전수 결과에서
> **변경 불요를 판정한 것까지 함께** 적은 것이다 — "안 고친다" 도 판정이다.

| # | 위치 | 변경 |
|---|---|---|
| 1 | `6-websocket-protocol.md` §1.2 `:52` | "연결 중 토큰 만료" 서술을 **새 모델**로 교체 (타이머·사전 통지·disconnect·타이머 해제) |
| 2 | 〃 §1.3 | REST 재발급 모델은 그대로. §1.2 의 만료 동작으로 가는 **상호 참조 한 줄** 추가 |
| 3 | 〃 §4.6 표 `:871` | payload `{ message }` → **`{ message, expiresAt }`**, 설명을 사전 통지 + disconnect 로 |
| 4 | 〃 `:1090` 잔여 목록 | *"제품 결정이 선행한다"* → **결정 완료, 구현 대기**로 |
| 5 | 〃 `:1123` `R-wontdo-maintenance-appping` 범위 밖 | 원문 보존 + **결정 완료 포인터** |
| 6 | 〃 Rationale 신설 | `R-ws-socket-lifetime-binds-token` |
| — | 〃 `:28` 전송 계층 안내 | **변경 없음** — 구현 전까지 `auth.token_expired` 는 여전히 Planned 다 |
| — | 〃 frontmatter | **변경 없음** — `status: partial` 유지 |
| — | `spec/1-data-model.md:300` | **변경 없음** — 그 줄이 스스로 *"별개 네임스페이스"* 라 명시 |
| — | `spec/data-flow/8-notifications.md:347` | **변경 없음** — 점 표기 예시일 뿐 상태 주장 아님 |
| 7 | `spec-sync-websocket-protocol-gaps.md:23` | 항목의 *"developer 권한 밖 … 여기서 멈춘다"* 블록 → **결정 기록 + 구현 착수 가능**으로 |
| 8 | 〃 `:87` "남은 하나에만 적용된다" | ⓐⓑ 대기 → **결정 완료**로 |
| — | `spec-sync-external-interaction-api-gaps.md:343` | **변경 없음** — 절번호 이동 이력 기록이지 상태 주장 아님 |

## 구현 메모 (developer 트랙 — 본 draft 범위 밖)

핸드셰이크에서 `exp` 를 읽어 소켓별 `setTimeout` 둘(사전 통지·만료), `handleDisconnect` 에서
**둘 다 해제**한다(해제 누락은 소켓당 타이머 누수다). 서버는 재발급을 추적하지 않는다 —
갱신된 토큰은 **새 소켓**으로 오고, 옛 소켓은 자기 `exp` 에 끊긴다.

## Rationale (본 draft 의 결정 근거)

**왜 spec 을 먼저 고치는가** — 이 변경은 *"현재 살아남던 소켓이 끊긴다"* 는 관측 가능한 동작
변경이다. 구현이 먼저 들어가면 클라이언트 입장에서 근거 없는 회귀로 보인다. §1.2 가 그 전이를
먼저 적어야 한다.

**왜 `status: partial` 을 유지하는가** — 결정이 내려졌을 뿐 구현은 없다. spec 약속과 구현
사이 갭은 그대로이므로 배지도 그대로다. 구현 PR 이 flip 한다.

**왜 lead time 값을 spec 에 박는가** — 이 문서는 이미 `pingInterval` 25s / `pingTimeout` 20s
같은 전송 상수를 본문에 고정한다. 클라이언트가 "몇 초 안에 갈아타야 하는가" 를 알아야 하므로
관측 가능한 계약이고, 구현 자유도로 두면 클라이언트가 최악값을 가정하게 된다.
