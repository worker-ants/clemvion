---
worktree: plan-in-progress-items-b0c80b
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

### 이 결정이 닫는 것과 닫지 **않는** 것

초판은 *"인가 갭을 닫는다"* 고만 썼는데 **그 문장이 실제보다 넓다**(`--spec` cross_spec
WARNING). 정확히는 **자연 만료(`exp`) 경로만** 닫는다.

| 경로 | 이 결정 이후 |
|---|---|
| 토큰 **자연 만료** | **닫힌다** — 소켓이 `exp` 에 끊긴다 |
| **명시적 revoke** (비번 변경 · `token_reuse_detected` 로 family revoke, `1-auth.md` §1.4·§2.3) | **안 닫힌다** — revoke 는 **refresh token family** 를 무효화하고, 이미 발급된 access token 은 자연 `exp` 까지 유효하다. 그 소켓은 **최대 15분** 더 산다 |

즉 *"즉시 종료"* 를 원하면 소켓에 **revoke 신호를 전파하는 별도 메커니즘**(pub/sub 등)이
필요하고, 그것은 이 타이머의 관심사가 아니다. 여기서는 **약속하지 않는다** — 안 되는 방향을
적어 두지 않으면 다음 사람이 이 항목을 "인가 문제 해결됨" 으로 읽는다.

§1.2 가 서술하는 복구 경로(*"연결 중 토큰 만료: 클라이언트는 `connect_error` 를 받으면 REST
`/auth/refresh` … 재연결"*)는 **새 연결 시도에서만 발화**하므로 이미 연결된 소켓에는 적용되지
않는다. 즉 그 문장은 **살아있는 소켓의 만료를 다루지 않는다.**

## 결정

**소켓 수명은 토큰 수명에 종속된다.** 서버는 핸드셰이크에서 검증한 토큰의 `exp` 를 읽어
소켓별 타이머를 걸고, 만료 **60초 전**에 `auth.token_expired` 를 1회 emit 한 뒤 `exp` 도달
시 `disconnect()` 한다.

### ⚠️ 서버 동작만으로는 성립하지 않는다 — 클라이언트 계약이 필수다

초판은 서버 쪽만 적고 *"클라이언트가 재발급 + 재연결하므로 끊김이 보이지 않는다"* 고 썼다.
`--spec` cross_spec 이 **CRITICAL 로 차단**했고, 확인하니 그 문장이 성립하지 않는다:

| 실측 (2026-09-02) | 값 |
|---|---|
| FE 의 `auth.token_expired` 구독 | **0건** (유일 히트는 integration `statusReason` — 별개 네임스페이스) |
| `ws-client.ts` 의 `on("disconnect")` 재연결 경로 | **없음** — `connect_error` 핸들러만 있다 |
| `ws-client.ts` 의 `reconnection` | `true` / `Infinity` — **그러나 서버발신 disconnect 엔 적용되지 않는다** |

Socket.IO 는 **서버가 `disconnect()` 를 호출한 경우**(클라이언트 reason `"io server
disconnect"`) 자동 재연결을 발화하지 않는다 — 클라이언트가 명시적으로 `socket.connect()` 를
불러야 한다. 즉 서버 변경만 넣으면 **사용자는 조용히 연결을 잃고**, 이 저장소가 이미 한 번
회귀로 겪은 disconnect UX 경로(`use-execution-events.ts`)로 떨어진다.

**그래서 이 결정은 서버·클라이언트 양쪽 계약이다.** spec 에 다음을 함께 적는다:

1. **사전 통지 경로 (정상)** — 클라이언트는 `auth.token_expired` 를 구독하고, 통지 창(60초)
   안에 REST `/auth/refresh` → `socket.auth.token` 교체 → **명시적 `socket.connect()`** 를
   수행한다. 이 경로가 성공하면 사용자에게 끊김이 보이지 않는다.
2. **fallback (통지를 놓친 경우)** — 백그라운드 탭·일시 정지 등으로 통지를 못 받았으면
   `disconnect` 이벤트의 reason 이 `"io server disconnect"` 인지 확인해 같은 재발급 + 명시
   재연결을 수행한다. **자동 재연결에 기대지 않는다**는 것이 이 fallback 의 존재 이유다.
3. **§6.1 예외 명문화** — *"재연결은 Socket.IO 내장 reconnection 에 위임"* 이라는 기존 서술에
   **서버발신 disconnect 는 그 대상이 아니다**를 예외로 적는다.

### 기각된 대안 (사용자에게 제시한 4안)

| 안 | 기각 사유 |
|---|---|
| **(b)** emit 만, disconnect 없음 | *"만료됐다"* 고 알리고도 그 소켓을 **인가된 채로 둔다** — 갭을 문서화할 뿐 닫지 않는다 |
| **(c)** 명령마다 재검증(guard) | 명령은 막지만 **수신을 못 막는다.** WS 는 push 중심이라 구독만 하는 소켓은 만료 토큰으로 계속 데이터를 받는다 |
| **(d)** won't-do | 인가 갭을 알고도 방치하는 것 |

### 왜 lead time 인가 · 왜 60초인가

disconnect 만 하면 **현재 살아남던 소켓이 예고 없이 끊기는 동작 변경**이다. 사전 통지가 있으면
클라이언트가 만료 전에 REST 재발급 + 재연결을 마쳐 사용자에게는 끊김이 보이지 않는다.

60초는 **15분 토큰의 약 6.7%**(60/900) 이고, 클라이언트가 REST refresh → `auth.token` 교체 → 재연결에 쓰는
시간(수백 ms 규모)의 넉넉한 배수다. 더 길면 만료 전 유효 창을 그만큼 깎고, 더 짧으면 네트워크
지연·백그라운드 탭에서 갈아탈 시간이 모자란다.

### payload 를 `{ message }` → `{ message, expiresAt }` 로

사전 통지가 성립하려면 클라이언트가 **마감 시각**을 알아야 한다. `message` 만으로는 "지금
갈아타야 하는가, 1분 남았는가" 를 구별할 수 없다.

**미구현(Planned) 이벤트라 wire 호환 부담이 없다** — 지금 정의하는 것이 가장 싸다.

형식은 **ISO 8601 문자열**(`expiresAt: string`)로 고정한다. 선례는 **`_retryState.expiresAt`**
(§4.2 `RETRY_STATE_NOT_FOUND` 의 TTL) 이다 — **실제 구현된 살아있는 필드**다.

> **초판은 `auth.refreshed.expiresAt` 을 선례로 인용했는데 그것은 §1.3 에서 비채택(won't-do)
> 확정된 죽은 참고 예시다** — emit·handler 0건. 죽은 예시를 활성 선례처럼 인용하면 다음
> 사람이 그것을 따라 쓴다.

이 문서 안에서 `expiresAt` 이 **세 가지 의미**를 갖게 되므로 §4.6 표에 명시적으로 가른다:

| 필드 | 의미 | 상태 |
|---|---|---|
| `_retryState.expiresAt` | AI retry 상태의 TTL | **구현됨** |
| `auth.refreshed.expiresAt` | 새 토큰의 만료 시각 | 비채택(won't-do) |
| **`auth.token_expired.expiresAt`** | **이 소켓이 강제 종료되는 시각** | 본 결정 |

## 변경안 — spec 8곳 · plan 3곳 전수

> **직전 draft 가 "9개 자리 전수" 라 적고 `spec/` 안에서만 세다 checker 에 잡혔다.** 이번엔
> 처음부터 `spec/`·`plan/` 양쪽을 센다. 아래는 `grep -rn "auth\.token_expired"` 전수 결과에서
> **변경 불요를 판정한 것까지 함께** 적은 것이다 — "안 고친다" 도 판정이다.
>
> **초판은 그래도 좁았다.** `auth.token_expired` 라는 **이름**으로만 셌기 때문에, 그 이름이
> 등장하지 않지만 이 결정이 깨뜨리는 §6.1(재연결 위임)·§9.2(재연결 트리거)를 못 봤다.
> cross_spec 이 CRITICAL 로 잡았다 — **"전수" 의 축이 이름이면 계약은 안 걸린다.**

| # | 위치 | 변경 |
|---|---|---|
| 1 | `6-websocket-protocol.md` §1.2 `:52` | "연결 중 토큰 만료" 서술을 **새 모델**로 교체 (타이머·사전 통지·disconnect·타이머 해제) |
| 2 | 〃 §1.3 | REST 재발급 모델은 그대로. §1.2 의 만료 동작으로 가는 **상호 참조 한 줄** 추가 |
| 3 | 〃 §4.6 표 `:871` | payload `{ message }` → **`{ message, expiresAt }`**, 설명을 사전 통지 + disconnect 로 |
| 4 | 〃 `:1090` 잔여 목록 | *"제품 결정이 선행한다"* → **결정 완료, 구현 대기**로 |
| 5 | 〃 `:1123` `R-wontdo-maintenance-appping` 범위 밖 | 원문 보존 + **결정 완료 포인터** |
| 6 | 〃 §6.1 `:951-962` | *"재연결은 Socket.IO 내장 reconnection 에 위임"* 에 **예외 명문화** — 서버발신 `disconnect()` 는 자동 재연결 대상이 아니다 |
| 7 | 〃 §9.2 `:1042-1050` | 재연결 트리거에 **`auth.token_expired` 수신 경로 + `"io server disconnect"` fallback** 추가 |
| 8 | 〃 Rationale 신설 | `R-ws-socket-lifetime-binds-token` — 기각 3안 · lead time 근거 · **revoke 카브아웃** · **타이머가 프로세스 로컬이라 R10/R15/R19 의 분산 불일치 클래스가 아님** 을 함께 싣는다 |
| — | 〃 `:28` 전송 계층 안내 | **변경 없음** — 구현 전까지 `auth.token_expired` 는 여전히 Planned 다 |
| — | 〃 frontmatter | **변경 없음** — `status: partial`·`pending_plans` 둘 다 그대로 |
| — | `spec/1-data-model.md:300` | **변경 없음** — 그 줄이 스스로 *"별개 네임스페이스"* 라 명시 |
| — | `spec/data-flow/8-notifications.md:347` | **변경 없음** — 점 표기 예시일 뿐 상태 주장 아님 |
| 9 | `spec-sync-websocket-protocol-gaps.md:23~49` | 항목의 *"developer 권한 밖 … 여기서 멈춘다"* 블록 → **결정 기록 + 구현 착수 가능**으로 |
| 10 | 〃 `:87` "남은 하나에만 적용된다" | ⓐⓑ 대기 → **결정 완료**로 |
| — | `spec-sync-external-interaction-api-gaps.md:343` | **변경 없음** — 절번호 이동 이력 기록이지 상태 주장 아님 |

## 구현 메모 (developer 트랙 — 본 draft 범위 밖)

**backend** — 핸드셰이크에서 `exp` 를 읽어 소켓별 `setTimeout` 둘(사전 통지·만료),
`handleDisconnect` 에서 **둘 다 해제**한다(해제 누락은 소켓당 타이머 누수다). 서버는 재발급을
추적하지 않는다 — 갱신된 토큰은 **새 소켓**으로 오고, 옛 소켓은 자기 `exp` 에 끊긴다.

> **분산·재시작 내성은 이 타이머의 관심사가 아니다.** 타이머는 소켓을 들고 있는 프로세스에
> 로컬이고, 그 프로세스가 죽으면 **소켓 자체가 끊겨** 클라이언트가 새 핸드셰이크로 새 타이머를
> 받는다. 이웃 spec 의 R10/R15/R19 가 다루는 "다중 인스턴스 간 상태 불일치" 클래스가 아니다.

**frontend** — 이쪽이 없으면 결정이 성립하지 않는다(위 §클라이언트 계약). `ws-client.ts` 에
`auth.token_expired` 구독과 `disconnect` reason 분기를 넣고, 둘 다 REST 재발급 → `auth.token`
교체 → **명시적 `connect()`** 로 수렴시킨다. 현재 FE 구독 0건이라 **전부 신규**다.

## Rationale (본 draft 의 결정 근거)

**왜 spec 을 먼저 고치는가** — 이 변경은 *"현재 살아남던 소켓이 끊긴다"* 는 관측 가능한 동작
변경이다. 구현이 먼저 들어가면 클라이언트 입장에서 근거 없는 회귀로 보인다. §1.2 가 그 전이를
먼저 적어야 한다.

**왜 `status: partial` 을 유지하는가** — 결정이 내려졌을 뿐 구현은 없다. spec 약속과 구현
사이 갭은 그대로이므로 배지도 그대로다. 구현 PR 이 flip 한다.

**왜 `2-api-convention.md §10.4` 는 안 고치는가** — 그 절은 재연결을 3줄로 요약하고 *"상세
프로토콜은 6-websocket-protocol.md 참조"* 로 위임한다. 이번 예외는 **상세 쪽 계약**이므로 §6.1·
§9.2 가 정본이다. 요약에 예외를 복제하면 두 곳이 갈릴 자리를 새로 만든다 — 이 저장소가 반복해
데인 형태다. (§10.4 의 "지수 백오프 1s/2s/4s…30s" 서술은 `ws-client.ts` 실제값과 이미 어긋나
있는데, 그 선재 drift 는 본 draft 범위 밖이다.)

**왜 lead time 값을 spec 에 박는가** — 이 문서는 이미 `pingInterval` 25s / `pingTimeout` 20s
같은 전송 상수를 본문에 고정한다. 클라이언트가 "몇 초 안에 갈아타야 하는가" 를 알아야 하므로
관측 가능한 계약이고, 구현 자유도로 두면 클라이언트가 최악값을 가정하게 된다.

## 체크리스트

- [x] `--spec` 1R — **BLOCK: YES** (cross_spec CRITICAL: 클라이언트 재연결 계약 부재). 서버
      동작만 적고 *"끊김이 보이지 않는다"* 고 단언했는데 **FE 구독 0건 · `disconnect` 재연결
      경로 없음 · Socket.IO 는 서버발신 disconnect 에 자동 재연결 안 함** 이었다. draft 에
      클라이언트 계약 3항을 추가하고 변경표를 6곳 → 8곳(§6.1·§9.2)으로 넓혔다.
- [x] `--spec` 2R — **BLOCK: NO** (Critical 0 · WARNING 4). 넷 다 반영:
      revoke 카브아웃 · 죽은 선례(`auth.refreshed.expiresAt`) 교체 · `expiresAt` 3중 의미 표 ·
      §10.4 스코프 판단. INFO 의 산술 오류("4%" → **약 6.7%**)도 정정.
- [x] spec 반영 (§1.2 · §1.3 · §4.6 · §6.1 · §9.2 · Rationale 신설) — `#1265` (`6ffadb1f4`)
- [x] tracker plan 갱신 (`spec-sync-websocket-protocol-gaps.md` 2곳) — 같은 커밋
- [ ] 구현 — **developer 트랙, 별 PR 로 이관**:
      [`ws-token-expired-socket-lifetime-impl.md`](./ws-token-expired-socket-lifetime-impl.md).
      이 항목은 그쪽에서 닫힌다(여기서는 포인터만 유지 — 지우면 이 draft 가 무엇을 남겼는지
      추적이 끊긴다).
