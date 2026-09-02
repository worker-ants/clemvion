---
worktree: plan-in-progress-items-b0c80b (branch claude/ws-wontdo-maintenance-appping)
started: 2026-09-02
owner: planner
spec_impact:
  - spec/5-system/6-websocket-protocol.md
---

# spec draft — WS `system.maintenance` · 서버발신 app ping 을 비채택(won't-do) 로 종결

> 대상: [`spec/5-system/6-websocket-protocol.md`](../../spec/5-system/6-websocket-protocol.md)
> 착수 근거: [`spec-sync-websocket-protocol-gaps.md`](./spec-sync-websocket-protocol-gaps.md) 의
> 잔여 3항목 중 **2항목**. 사용자 결정 2026-09-02.

## 배경

2026-06-03 전송계층 정정(raw WS → Socket.IO)에서 raw-WS 초안의 약속들이 **미구현(Planned)**
으로 분리됐고, 2026-07-08 에 그중 4종이 `R-wontdo-rawws-rest` 로 정식 비채택됐다. 그 결정은
**세 항목을 명시적으로 범위 밖**에 뒀다 — 서버발신 `auth.token_expired`(§4.6) ·
`system.maintenance`(§4.6) · 서버발신 app ping(§5).

2026-08-31 그 세 항목을 착수하려던 developer 가 **셋 다 "구현 전에 결정이 먼저" 임을 실측해
등재**했다. 그 실측을 근거로 2026-09-02 사용자가 **뒤 둘을 won't-do 로 종결**하기로 결정했다.

`auth.token_expired` 는 **Planned 로 유지**한다 — 아래 §범위 밖.

## 실측 (2026-09-02, 본 draft 작성 시점)

| 항목 | 측정 | 값 |
|---|---|---|
| `system.maintenance` | `spec/` 등장 | 5곳 (본 문서) |
| | `codebase/backend/src` 등장 | **0건** |
| app ping | §5.1 이 확정한 전송 heartbeat | Socket.IO 내장 `pingInterval` 25s / `pingTimeout` 20s |
| | 구현 방향 | client→server (`handlePing`) — 서버발신 경로 없음 |

즉 `system.maintenance` 는 **발화 주체가 코드에도 spec 에도 없고**, app ping 은 **그 자리를
전송 계층이 이미 채우고 있다.**

## 변경안 — 9개 자리 전수

> 두 항목이 언급되는 자리를 `grep` 으로 **전수 열거**했다. 한 곳씩 고치다 놓치는 것이 이
> 저장소가 반복해 겪은 실패라, 편집 전에 목록을 고정한다.

| # | 위치 | 변경 |
|---|---|---|
| 1 | `:28` 전송 계층 안내 | raw-WS 전제 분류에서 두 항목을 **Planned → 비채택** 쪽으로 이동. `auth.token_expired` 만 Planned 로 남긴다 |
| 2 | `:872` §4.6 표 행 | `system.maintenance` _(계획·미구현)_ → **_(비채택 won't-do)_** + 설명을 "발화 주체 부재" 로 교체 |
| 3 | `:945` §5 방향 정정 노트 | *"서버가 주기적으로 app `ping` 을 push 하는 경로는 미구현 (Planned)"* → **비채택(won't-do)** + 근거 포인터 |
| 4 | `:1086` Planned 분리 목록 | 목록 자체는 **2026-06-03 시점 기록이라 보존**. 아래 하위 불릿에 이번 전이를 추가 |
| 5 | `:1086` 하위 불릿 신설 | **Planned → 비채택 won't-do (2026-09-02)** 2종 전이 기록 |
| 6 | `:1089` 잔여 목록 | 3항목 → **`auth.token_expired` 1항목** |
| 7 | `:1104` `R-wontdo-rawws-rest` 의 "범위 밖" | **원문 보존 + 후속 갱신 주석**. 2026-07-08 시점엔 참이었다 |
| 8 | Rationale 신설 | `R-wontdo-maintenance-appping` 항목 |
| 9 | frontmatter | **변경 없음** — `status: partial` 유지(`auth.token_expired` 잔존), `pending_plans` 유지 |

### 신설 Rationale 본문 (안)

```markdown
### R-wontdo-maintenance-appping. `system.maintenance` emit · 서버발신 app ping 비채택 (결정 2026-09-02)

`R-wontdo-rawws-rest`(2026-07-08)가 **범위 밖으로 남겨 둔** 3항목 중 2항목을 정식
비채택(won't-do)으로 종결한다. 그 결정이 이 둘을 다루지 않은 것은 "트리거 소스 설계가
필요하다" 였는데, 2026-08-31 착수 시도에서 **설계가 필요한 것이 아니라 대상이 없다**는 것이
실측됐다.

- **§4.6 `system.maintenance` emit — 발화 주체가 존재하지 않는다**
  - 실측(2026-09-02): `system.maintenance` 는 **`spec/` 에만 5곳, 백엔드 코드 0건**.
    유지보수를 선언하는 관리자 API·설정·스케줄이 어디에도 없고 계획에도 없다.
  - payload 의 `scheduledAt` 은 **사람이 미래 시점을 선언**해야 성립한다. 그 표면을 만드는
    것은 spec-impl 갭 메우기가 아니라 **신규 제품 기능**이다.
  - 유일한 기존 후보인 `onApplicationShutdown(signal)`(SIGTERM)에 배선하는 안은 **기각**한다 —
    SIGTERM 은 사전 예고가 없어 `scheduledAt`("예정된")이 표현하는 사건과 다르다. 거기 묶으면
    payload 가 약속하는 것보다 **좁은 보장을 넓은 이름으로** 내보내게 된다.
- **§5 서버발신 app ping — 전송 계층이 이미 그 자리를 채운다**
  - §5.1 이 *"전송 계층 heartbeat 는 Socket.IO/Engine.IO 내장 ping/pong (`pingInterval` 25s /
    `pingTimeout` 20s)"* 로 확정했다. 그 위의 앱 레벨 서버발신 ping 은 **소비처도 주기도
    정의되지 않은 주기적 브로드캐스트**를 하나 더 만든다.
  - 이 줄은 `R-wontdo-rawws-rest` 가 종결한 2종(서브프로토콜 인증·raw close code)과 **같은
    raw-WS 초안 전제**에서 왔다(`:1083` 이 "서버발신 30s/10s app ping" 을 그 초안 약속 목록에
    함께 적는다). 그때는 범위 밖으로 뒀고, 이번에 다시 물으니 답이 같다.
- **폐기 대안**
  - *두 항목을 Planned 로 계속 두는 안* → 주인 없는 Planned 배지는 **잘못된 기대(언젠가
    구현)** 를 남긴다. 이 문서가 2026-07-08 에 4종에 대해 이미 같은 판단을 했다.
  - *`system.maintenance` 를 위해 관리자 API 를 먼저 만드는 안* → 순서가 뒤집힌다. 운영상
    필요가 생겨 관리자 표면이 만들어지면 그때 이 이벤트를 **재등재하는 비용은 작다**(payload
    형태가 이 문서에 남아 있다).
- **범위 밖(잔여 유지)**: 서버발신 `auth.token_expired`(§4.6)는 **Planned 로 남는다.**
  이 항목만은 "트리거 부재" 가 아니라 **실재하는 인가 갭**이다 — 소켓이 핸드셰이크 이후
  토큰을 재검증하지 않아 만료된 토큰으로도 무기한 이벤트를 받는다. 소켓 수명을 토큰 수명에
  종속시킬지는 제품 결정이라 별도 planner 턴에서 다룬다(실측·선택지는
  `plan/in-progress/spec-sync-websocket-protocol-gaps.md`).
```

## Rationale (본 draft 의 결정 근거)

**왜 spec 본문에서 지우지 않고 _(비채택 won't-do)_ 표기로 남기는가** — 2026-07-08 선례가
그렇게 했다(*"삭제하지 않고 본문에서 표기 분리"*). payload 형태를 남겨 두면 나중에 재도입할
때 계약을 다시 설계하지 않아도 되고, 지운 항목은 "논의된 적 없는 것" 과 구별되지 않는다.

**왜 `:1104` 원문을 고치지 않는가** — 그 문장은 **2026-07-08 시점에 참이었던 결정 기록**이다.
고쳐 쓰면 그 결정이 처음부터 이 둘을 포함했던 것처럼 읽힌다. 이 저장소는 "선례에 없는 근거를
소급 부여" 하는 것을 결함으로 다룬다. 대신 **후속 갱신 주석**을 붙여 오독을 막는다 — 같은
문서가 이미 쓰는 패턴이다(`### llmCalls 외부 수신자 strip` 의 *"(2026-08-14 갱신)"*).

**왜 `status: partial` 을 유지하는가** — `auth.token_expired` 가 Planned 로 남으므로 spec 본문의
약속과 구현 사이 갭이 여전히 존재한다. `pending_plans` 가 가리키는 plan 도 그 한 항목 때문에
`in-progress` 에 남는다.

**왜 별도 Rationale 항목인가** — 기존 `R-wontdo-rawws-rest` 에 두 줄을 끼워 넣는 편이 짧지만,
그 항목은 *"본 결정에 포함되지 않는다"* 고 스스로 적고 있다. 거기 추가하면 2026-07-08 결정이
이 둘까지 판단한 것으로 기록이 바뀐다. **다른 날짜의 다른 결정**이므로 항목을 나눈다.
