---
title: spec draft — Redis 키 규약을 실제에 맞추고 전역 인벤토리를 세운다
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-13
owner: project-planner
status: in-progress
priority: P2
spec_impact:
  - spec/conventions/redis-keys.md
  - spec/5-system/4-execution-engine.md
  - spec/5-system/14-external-interaction-api.md
  - spec/data-flow/15-external-interaction.md
---

## Overview

원 백로그 항목은 "EIA 계열 Redis 키가 실행 엔진 §9.1/§9.2 레지스트리에 없다" 였다. 착수 전
실측해 보니 **그보다 큰 형태**다 — 규약 선언 자체가 실제와 다르고, 레지스트리에는 코드에 없는
항목이 들어 있다.

## 실측 (착수 전 프로브)

### ① §9.1 의 패턴 선언이 실제 키 **전부**와 어긋난다

[`4-execution-engine.md` §9.1](../../spec/5-system/4-execution-engine.md) 은 이렇게 선언한다:

> 모든 Redis 키는 아래 패턴을 따른다: `{service}:{workspaceId}:{resource}:{id}:{sub}`

코드에서 실재하는 Redis 키 계열을 전수로 뽑아 보면 **`workspaceId` 세그먼트를 가진 키가 0개**다:

| 키 | 소유 | 검증 |
|---|---|---|
| `exec:recover:lock` · `exec:cont:seq:<executionId>` | 실행 엔진 (`modules/execution-engine`) | redis 호출 확인 |
| `exec:seq:<executionId>` | **`modules/websocket`** (`ExecutionSeqAllocator`) — 접두는 `exec:` 지만 소유 모듈이 다르다 | redis 호출 확인 |
| `iext:blacklist:<jti>` · `interaction:idempotency:<executionId>:<route>:<key>` | EIA | redis 호출 확인 |
| `eia:rl:interact:<executionId>` · `eia:rl:status:<executionId>` · `eia:notif:rl:<triggerId>` | EIA rate limit | redis 호출 확인 |
| `cc:rl:<triggerId>:<conversationKey>` | chat-channel rate limit | redis 호출 확인 |
| `wh:rl:min:<ip>` · `wh:rl:hour:<ip>` | webhook rate limit | redis pipeline INCR+EXPIRE 확인 |
| `cafe24:install:fail:<ip>` · `cafe24:install:nonce:<mall_id>:<ts>:<hmac>` | Cafe24 설치 | redis 호출 확인 |
| `integration:cache:invalidate` (pub/sub 채널) | integration | `integration-cache-bus.service.ts` 확인 |

**즉 규칙이 예외가 아니라 규칙 쪽이 사실과 다르다.** 실제 관례는
`{도메인}:{용도}:{식별자}` 이고, 워크스페이스 종속이 필요한 키가 아직 없다.

> ⚠️ **이 표에서 한 행을 빼야 했다 — 내가 §9.2 를 비판한 바로 그 결함이었다.**
> 초안은 `background:run:<id>` 를 "Background 노드 소유 Redis 키" 로 올렸는데, `02_01_16`
> consistency 의 checker **셋이 독립으로** 반증했다. 실측하니 그 문자열을 쓰는 자리는
> `websocket.gateway.ts`/`websocket.service.ts` 의 **Socket.IO 브로드캐스트**와 채널 authorizer 다
> — Redis 를 전혀 경유하지 않는 **WS 채널명**이고, SoT 는
> [`6-websocket-protocol.md`](../../spec/5-system/6-websocket-protocol.md) 다.
>
> "실재하지 않는 항목이 레지스트리에 있으면 틀린 설계 전제를 만든다" 고 §9.2 를 지적해 놓고,
> 신설 문서 초안이 **첫 판부터 같은 오류**를 담고 있었다. 형태가 비슷하면(`{도메인}:{용도}:{id}`)
> 종류까지 같다고 넘겨짚은 것이다.

### 재검증 방법 — 그리고 그 방법도 한 번 틀렸다

CRITICAL 지적을 받고 표 전 행을 **"문자열이 있다" 가 아니라 "redis client 메서드에 전달된다"**
로 다시 확인했다. 그 재검증 스크립트가 `wh:rl:` 을 "redis 호출 없음" 으로 표시했는데, 파일을
직접 열어 보니 **pipeline 으로 INCR+EXPIRE 를 원자화하는 정상 Redis 키**였다 — 스크립트의
거짓 음성이다.

> 자동 판정의 **음성**은 부재의 증거가 아니다. CRITICAL 을 고치는 과정에서 두 번째 오분류를
> 만들 뻔했고, 파일을 직접 연 것이 그것을 막았다.

### ② §9.2 가 "실제 사용 중인 키만" 이라 적었는데 **두 항목이 코드에 없다**

같은 절의 각주가 명시적으로 이렇게 말한다:

> 위 표는 **실제 사용 중인 키만** 나열한다. 옛 Phase-1 설계의 … 는 구현되지 않았고 코드에
> 존재하지 않는다

그런데 표에 남아 있는 두 항목이 그 주장에 반한다:

| §9.2 항목 | 실측 |
|---|---|
| `core:{wsId}:rate:{userId}` — "API Rate Limit 카운터" | ❌ **없음.** API rate limit 은 `@nestjs/throttler` 를 **storage 설정 없이** 쓴다 = 기본 in-memory (`app.module.ts:152`) |
| `ws:{wsId}:session:{connId}` — "WebSocket 세션 정보" | ❌ **없음.** `ws-rate-limiter.service.ts` 가 주석에 **"Redis 없이"** 라고 명시 — 소켓이 한 프로세스에 고정돼 프로세스-로컬 상태가 권위다 |

> `exec:run:seq:<executionId>` 는 0건이지만 **결함이 아니다** — 표가 스스로
> "(PR1~PR4 미사용 — 미래 예약)" 이라 밝혀 뒀다. 이건 정직한 항목이다.

### ③ 레지스트리가 둘이고 하나가 양쪽에 중복

EIA 는 자기 표([`data-flow/15` §2.2](../../spec/data-flow/15-external-interaction.md))를 갖고 있고,
`exec:seq:<executionId>` 는 **두 문서 모두에** 등재돼 있다. 반대로 EIA 키 둘은 §9.2 에 없다.
즉 "빠졌다" 가 아니라 **경계가 정의되지 않았다.**

> ⚠️ 이 실측에서 **내 첫 측정이 틀렸다.** 느슨한 정규식(`['"\`][^'"\`]*` + 대상)으로 세니
> `core:` 10파일 · `ws:` 24파일이 나왔는데, 따옴표 시작에 고정해 다시 세니 **둘 다 0건**이었다.
> 그 오탐을 그대로 draft 에 실었으면 "둘 다 실재한다" 는 정반대 결론이 됐다.

## 제안 변경

### 1. `spec/conventions/redis-keys.md` 신설 — 규약 SoT

CLAUDE.md 가 "정식 규약 → `spec/conventions/<name>.md`" 로 지정한 자리다. 키가 **6개 영역에
12계열**로 흩어져 있는데 규칙이 실행 엔진 문서 안에만 있는 것이 지금 어긋남의 근원이다.

담을 것:

- **frontmatter** — 이 저장소의 비-카탈로그 conventions 문서 18개가 예외 없이 갖는 스키마
  (`spec-impl-evidence.md` 가 build 가드로 강제): `id: redis-keys` · `status: implemented` ·
  `code:` 는 키를 소유한 **6개 모듈 다중 glob**(execution-engine · external-interaction ·
  chat-channel · hooks · integrations · common/redis).
- **명명 규칙 (사실 기반)**: **머리 2세그먼트 고정 + 꼬리 가변** — `{도메인}:{용도}:{식별자...}`.
  꼬리는 1~4개다(`interaction:idempotency:<executionId>:<route>:<key>` 는 5세그먼트,
  `cafe24:install:nonce:<mall_id>:<ts>:<hmac>` 는 6세그먼트).
  > 3세그먼트 고정으로 적으면 **이번 착수의 출발점이 된 결함("규칙이 실제와 어긋난다")을
  > 축소된 형태로 재생산**한다 — 초안이 실제로 그렇게 적혀 있었고 `02_13_17` 이 잡았다.
  도메인은 코드 소유 모듈을 가리키는 짧은 접두(`exec`·`eia`·`iext`·`interaction`·`cc`·`wh`·
  `cafe24`·`integration`). **`exec:` 는 예외** — `exec:seq:` 만 `modules/websocket` 소유다.
  > 각주: `external-interaction` **한 모듈이 `iext:`·`interaction:`·`eia:` 세 접두를 쓴다**.
  > 통일을 강제하지 않는다 — 키 포맷 변경은 배포 전환기에 기존 엔트리를 고아로 만든다.
  > 다만 "같은 모듈인데 접두가 셋" 이라는 사실은 적어 둔다(다음 사람이 넷째를 만들지 않도록).
- **워크스페이스 스코프를 언제 넣는가**: 지금은 어느 키도 안 넣는다. 필요해지는 조건과
  그때 어디에 넣을지를 적는다.
- **유지보수 원칙**: **새 Redis 키/pub-sub 채널을 도입하면 이 인벤토리(또는 소유 문서)에
  등재한다.** 이 한 줄이 없으면 지금 고치는 갭이 그대로 재생산된다 — 실제로
  [`spec-sync-external-interaction-api-gaps.md`](spec-sync-external-interaction-api-gaps.md)
  §R10(SSE/notification 분산 fan-out)이 새 pub/sub 채널을 예고하고 있다.
- **전역 인벤토리**: 위 실측 표. 각 행이 **상세를 어느 문서에서 관리하는지** 가리킨다
  (엔진 키 → §9.2, EIA idempotency/blacklist → data-flow/15 §2.2, **EIA rate-limit 3키 →
  `14-external-interaction-api.md` §8.4**). 인벤토리는 **포인터**이고 TTL·용도 같은 상세는
  소유 문서가 갖는다 — 한 표에 다 넣으면 그 표가 곧 중복 SoT 가 된다.
  > ⚠️ EIA rate-limit 3키는 **어느 spec 에도 리터럴이 없다**(`02_01_16` cross_spec WARNING 1).
  > 포인터가 가리킬 곳이 비어 있으므로 §8.4 에 리터럴 키를 추가해야 포인터가 성립한다 —
  > 그래서 `spec_impact` 에 `14-external-interaction-api.md` 를 넣었다.
- **인접 네임스페이스 각주**: Redis 키가 **아닌데** 형태가 비슷해 혼동되는 것 —
  Socket.IO 채널(`background:run:<id>`·`execution:<id>`·`workflow:<id>`, SoT
  [`6-websocket-protocol.md`](../../spec/5-system/6-websocket-protocol.md)) 과 BullMQ 큐명.
  초안이 실제로 그 혼동을 저질렀으므로 문서에 방지선을 둔다.

### 2. `4-execution-engine.md` §9.1 / §9.2 정정

| 자리 | 변경 |
|---|---|
| §9.1 "모든 Redis 키는 …" | 규약 문서 참조로 대체. 이 문서는 **엔진 키**를 다룬다고 범위를 밝힌다. **heading 텍스트는 그대로 둔다** (아래 앵커 주의) |
| §9.2 `core:{wsId}:rate:{userId}` | **제거** + 각주에 "API rate limit 은 in-memory(`@nestjs/throttler` 기본 storage)" 기록 — 지웠다는 사실과 이유가 남아야 다음 사람이 되살리지 않는다 |
| §9.2 `ws:{wsId}:session:{connId}` | **제거** + "WS 세션은 프로세스-로컬(소켓이 인스턴스에 고정)" 기록 |
| §9.2 각주 "실제 사용 중인 키만" | 유지 — 이번 정정으로 **처음으로 참이 된다** |

> ⚠️ **heading 텍스트 보존** (`02_01_16` INFO 2·7). 두 절의 앵커를 다른 문서가 인바운드로
> 참조한다 — **재실측**: `#91-키-패턴` ← `conventions/execution-context.md` **1건**,
> `#92-용도별-키-정의-및-ttl` ← **5건 / 3파일**(`14-external-interaction-api.md` ·
> `6-websocket-protocol.md` · `data-flow/3-execution.md`). **본문만 교체하고 heading 은
> 건드리지 않는다.**
>
> > 앞서 이 자리에 "3건" 이라 적었는데 **틀렸다** — 파일 단위로 세고 줄 수를 안 셌다
> > (`02_13_17` INFO 1 이 지적, `grep -rn … | wc -l` 로 재확인). 결론(heading 보존)은 같지만
> > 근거 숫자가 틀린 채로 남으면 다음 사람이 검증에 실패한다. 이 세션에서 "수량을 프록시로
> > 셌다" 가 반복된 형태다.

> ⚠️ **옛 패턴 문자열의 댕글링 참조 2곳** (`02_13_17` cross_spec WARNING 2). §9.1 본문을
> 교체하면 같은 파일의 **L1179(§9.2 각주)** 와 **L1183(§9.3 도입부)** 에 남은
> `` `{service}:{workspaceId}:{resource}` `` 인용이 사라진 텍스트를 가리킨다. 실측으로
> 세 자리(L1149 선언 · L1179 · L1183)를 확인했다 — **함께 갱신한다.**

> `core:` 제거 각주에 **교차 참조 한 줄**을 단다 (`02_01_16` plan_coherence WARNING 3):
> [`cafe24-backlog-residual.md`](cafe24-backlog-residual.md) 의 A-3 follow-up(Layer 1 분산
> throttle store)이 착지하면 **유사 키가 재도입된다**. "없앴으니 영원히 없다" 가 아니라
> "지금은 in-memory 이고, Layer 1 착지 시 재검토" 로 적어야 그 턴이 이 각주를 근거로
> 되살리기를 망설이지 않는다.

### 3. `data-flow/15` §2.2 — 규약 문서 역참조 한 줄

EIA 표는 그대로 두고(상세 소유는 여기가 맞다) 규약 문서를 가리키는 줄만 추가한다.

## 체크리스트

- [ ] `consistency-check --spec` **재실행** BLOCK: NO 확인 (1차 `02_01_16` 은 **BLOCK: YES**
      — `background:run:` 오분류. 아래 조치 후 재검증)
- [ ] `spec/conventions/redis-keys.md` 신설
      - [ ] frontmatter (`id`/`status`/`code` 6모듈 다중 glob) — build 가드 강제 대상
      - [ ] 명명 규칙 + `external-interaction` 3접두 각주
      - [ ] 워크스페이스 스코프 조건
      - [ ] **유지보수 원칙**("새 키/채널 도입 시 등재")
      - [ ] 포인터 인벤토리 (Redis 키만)
      - [ ] **인접 네임스페이스 각주**(WS 채널·BullMQ 큐 — 초안이 실제로 혼동한 자리)
      - [ ] 구조는 `error-codes.md` 형식 참고(Overview + 책임 경계)
- [ ] `4-execution-engine.md` §9.1 범위 한정 + 규약 참조 — **heading 텍스트 보존**
- [ ] `4-execution-engine.md` §9.2 phantom 2건 제거 + 사유 각주 + A-3 follow-up 교차 참조
      — **heading 텍스트 보존**
- [ ] `14-external-interaction-api.md` §8.4 에 rate-limit 3키 리터럴 추가(포인터가 가리킬 곳)
- [ ] `data-flow/15` §2.2 규약 역참조 한 줄
- [ ] `backend-lint-gate-broken-on-main.md` 의 원 항목 종결 + "실측으로 형태가 커졌다" 기록
- [ ] `4-execution-engine.md` **L1179 각주 · L1183 §9.3 도입부**의 옛 패턴 인용 동반 갱신
- [ ] 후속 항목 등재 — **두 갈래로 갈라서** (`02_13_17` plan_coherence WARNING):
      - `chat-channel`·`cafe24` → **역참조만** (소유 문서에 리터럴이 이미 있다)
      - **`webhook` → EIA §8.4 와 동형 처리 필요** — `12-webhook.md` 에 `wh:rl:*` 리터럴이
        **0건**이라(실측) 역참조만 달면 EIA 에서 이미 반증된 **빈 포인터**가 된다

## Rationale

### 왜 단일 표로 합치지 않는가

12계열 × 6영역을 한 표에 모으면 TTL·용도·fail 정책이 전부 그 표로 따라와야 하고, 그러면
각 영역 문서와 **이중 SoT** 가 된다. 이 저장소가 이미 겪은 형태다 — `exec:seq` 가 두 문서에
중복 등재돼 있는 것이 그 증상이다. 인벤토리는 **포인터만** 갖는다.

### 왜 규칙을 실제에 맞추나 (거꾸로가 아니라)

`{service}:{workspaceId}:...` 를 지키도록 코드를 고치는 선택지도 있다. 채택하지 않는다:

- 실재 키 12계열 중 **워크스페이스 종속이 자연스러운 것이 없다** — 전부 execution·trigger·ip·
  전역 단위 책임이다. `executionId` 는 이미 전역 유일 UUID 라 workspace 세그먼트가 정보를
  더하지 않는다(§9.2 각주가 이미 같은 논증을 편다).
- 키 포맷 변경은 **배포 전환기에 기존 엔트리를 전부 고아로 만든다**. 이득 없는 마이그레이션이다.

즉 규칙이 코드보다 뒤에 쓰였고 한 번도 지켜진 적이 없다 — **지켜진 적 없는 규칙은 규칙이
아니라 오해의 원천**이다.

> **계보**: 같은 문서 `## Rationale` 의 "실행 컨텍스트 in-memory + DB durable — Redis context
> store 미채택" 이 Phase-1 설계를 폐기했다고 적는다. `{service}:{workspaceId}:…` 패턴은 그
> **폐기된 설계의 유일한 생존 흔적**이다 — 워크스페이스 단위로 실행 상태를 Redis 에 두려던
> 전제에서 나온 형태다. 그 전제가 사라졌으므로 패턴만 남아 있을 이유도 없다.
> (`02_01_16` rationale_continuity INFO 4)

### 실재하지 않는 항목을 지우는 것이 왜 중요한가

§9.2 는 "여기 있는 건 실제로 쓰인다" 를 명시적으로 약속한다. 그 약속이 거짓이면 이 표를 읽고
"WS 세션이 Redis 에 있으니 다중 인스턴스에서 공유되겠다" 같은 **틀린 설계 전제**를 세우게 된다.
실제로는 프로세스-로컬이라 인스턴스 간 공유가 없다 — 정반대다.

### consistency `02_01_16` 노트 (BLOCK: YES → 조치)

| # | 지적 | 처분 |
|---|---|---|
| CRITICAL | `background:run:<id>` 는 Redis 키가 아니라 WS 채널 | **반영** — 인벤토리에서 제거, 인접 네임스페이스 각주로 분리. 전 행을 "redis client 호출" 기준으로 재검증했고, 그 재검증 자체의 거짓 음성(`wh:rl:`)도 파일 직접 확인으로 잡았다 |
| W1 | EIA rate-limit 3키의 포인터 대상이 비어 있음 | **반영** — §8.4 에 리터럴 추가를 범위에 넣고 `spec_impact` 확장 |
| W2 | 신설 문서 frontmatter 계획 누락 | **반영** — `id`/`status`/`code`(6모듈 glob) 명시 |
| W3 | `core:` 제거 각주가 A-3 follow-up 과 어긋날 소지 | **반영** — "Layer 1 착지 시 재검토" 교차 참조 |
| W4 | 유지보수 원칙 부재 | **반영** — "새 키/채널 도입 시 등재" |
| INFO 1 | `iext`/`interaction`/`eia` 3접두 병존 | **반영** — 각주로 기록(통일 강제는 안 함, 마이그레이션 비용) |
| INFO 2·7 | §9.1/§9.2 앵커 인바운드 | **반영** — heading 보존을 체크리스트에 명시. 인바운드 실측: §9.1 1건 · §9.2 3건 |
| INFO 4 | §9.1 패턴의 Phase-1 계보 | **반영** — Rationale 에 "폐기된 설계의 유일한 생존 흔적" 링크 |
| INFO 3 | 타 영역 소유 문서 역참조 부재 | **후속 등재** — 이번 범위 밖 |
| INFO 5·6 | throttler 각주 stale 가능성 · 문서 구조 | **반영** — W3 각주에 흡수 / 체크리스트에 형식 참고 |
