---
id: redis-keys
status: implemented
code:
  - codebase/backend/src/modules/execution-engine/**/*.ts
  - codebase/backend/src/modules/external-interaction/**/*.ts
  - codebase/backend/src/modules/chat-channel/**/*.ts
  - codebase/backend/src/modules/hooks/**/*.ts
  - codebase/backend/src/modules/integrations/**/*.ts
  - codebase/backend/src/modules/websocket/execution-seq-allocator.service.ts
  - codebase/backend/src/common/redis/**/*.ts
---

# Redis 키 명명 규약 (Conventions)

## Overview

Redis **키 이름의 형태**와 **어느 문서가 어떤 키를 소유하는지**만 정의한다. 책임 경계:

- **키별 용도·TTL·fail 정책**: 각 소유 문서가 SoT. 본 문서는 **포인터만** 갖는다.
  한 표에 상세까지 모으면 그 표가 곧 두 번째 SoT 가 된다.
- **실행 엔진 키의 상세**: [`5-system/4-execution-engine.md §9.2`](../5-system/4-execution-engine.md#92-용도별-키-정의-및-ttl) (SoT).
- **EIA 키의 상세**: [`data-flow/15-external-interaction.md §2.2`](../data-flow/15-external-interaction.md) ·
  [`5-system/14-external-interaction-api.md §8.4`](../5-system/14-external-interaction-api.md) (SoT).
- **BullMQ 큐**: [`4-execution-engine.md §9.3`](../5-system/4-execution-engine.md) — 큐가 내부적으로
  만드는 `bull:<queue>:*` 는 라이브러리 표준이라 본 규약 범위 밖.

본 문서가 **유일하게 소유**하는 것: ① 키 형태 규칙, ② 워크스페이스 스코프 판단 기준,
③ 전역 인벤토리(포인터), ④ 새 키 도입 시의 등재 의무.

## 1. 키 형태 — 머리 2세그먼트 고정 + 꼬리 가변

```
{도메인}:{용도}[:{식별자}...]
```

- **도메인**: 코드에서 그 키를 소유한 모듈을 가리키는 짧은 접두.
- **용도**: 그 도메인 안에서 무엇을 저장하는지.
- **식별자**: 0~4개. 고정 개수가 아니다.

세그먼트 수를 고정으로 적지 않는 이유는 실제 키가 3~6세그먼트로 갈리기 때문이다 —
`exec:recover:lock`(3)부터 `cafe24:install:nonce:<mall_id>:<ts>:<hmac>`(6)까지 있다.

## 2. 워크스페이스 스코프 — 지금은 어느 키도 쓰지 않는다

**현재 실재하는 키 중 `workspaceId` 세그먼트를 가진 것은 없다.** 전부 execution·trigger·IP·
전역 단위 책임이고, `executionId`·`triggerId` 는 이미 전역 유일 UUID 라 워크스페이스 세그먼트가
정보를 더하지 않는다.

넣어야 하는 조건은 하나다 — **키 수준의 워크스페이스 격리가 필요할 때**(예: 워크스페이스별
쿼터·격리된 네임스페이스 열거). 그때는 도메인 바로 뒤에 넣는다: `{도메인}:{workspaceId}:{용도}:…`.

## 3. 전역 인벤토리 (포인터)

| 키 | 소유 모듈 | 상세 SoT |
|---|---|---|
| `exec:recover:lock` · `exec:cont:seq:<executionId>` | `modules/execution-engine` | [엔진 §9.2](../5-system/4-execution-engine.md#92-용도별-키-정의-및-ttl) |
| `exec:seq:<executionId>` | **`modules/websocket`** (`ExecutionSeqAllocator`) — 접두는 `exec:` 지만 소유가 다르다 | [엔진 §9.2](../5-system/4-execution-engine.md#92-용도별-키-정의-및-ttl) |
| `iext:blacklist:<jti>` · `interaction:idempotency:<executionId>:<route>:<key>` | `modules/external-interaction` | [data-flow/15 §2.2](../data-flow/15-external-interaction.md) |
| `eia:rl:interact:<executionId>` · `eia:rl:status:<executionId>` · `eia:notif:rl:<triggerId>` | `modules/external-interaction` | [EIA §8.4](../5-system/14-external-interaction-api.md) |
| `chat-channel:<triggerId>:<conversationKey>` · `chat-channel-lock:<triggerId>:<conversationKey>:formsubmit` | `modules/chat-channel` | [data-flow/14 §2.2](../data-flow/14-chat-channel.md) |
| `cc:rl:<triggerId>:<conversationKey>` · `cc:dedup:<triggerId>:<idempotencyKey>` | `modules/chat-channel` | [data-flow/14 §2.2](../data-flow/14-chat-channel.md) |
| `wh:rl:min:<ip>` · `wh:rl:hour:<ip>` | `modules/hooks` | [webhook](../5-system/12-webhook.md) |
| `cafe24:install:fail:<ip>` · `cafe24:install:nonce:<mall_id>:<ts>:<hmac 앞 8자>` | `modules/integrations` | [Cafe24 §9.8](../4-nodes/4-integration/4-cafe24.md#98-private-앱-app-url-hmac-검증) |
| `integration:cache:invalidate` (pub/sub 채널) | `common/redis` | [엔진 §9.2](../5-system/4-execution-engine.md#92-용도별-키-정의-및-ttl) |

> **한 모듈이 접두 셋을 쓴다** — `external-interaction` 이 `iext:`·`interaction:`·`eia:` 를
> 병용한다. 통일을 강제하지 않는다(키 포맷 변경은 배포 전환기에 기존 엔트리를 고아로 만든다).
> 다만 넷째가 생기지 않도록 사실을 남긴다.

## 4. 인접 네임스페이스 — Redis 키가 **아닌데** 형태가 비슷한 것

다음은 `{도메인}:{용도}:{id}` 꼴이지만 **Redis 를 경유하지 않는다.** 인벤토리에 넣지 않는다.

| 이름 | 실체 | SoT |
|---|---|---|
| `background:run:<id>` · `execution:<id>` · `workflow:<id>` | **Socket.IO 채널** (`server.to(channel).emit()`) | [WebSocket §채널](../5-system/6-websocket-protocol.md) |
| `bg:<executionId>:<backgroundRunId>` | **in-memory Map 라우팅 키** (`_contextKey`) | [execution-context 원칙 4](./execution-context.md) |
| `bull:<queue>:*` | BullMQ 내부 키 (라이브러리 표준) | [엔진 §9.3](../5-system/4-execution-engine.md) |

## 5. 새 키를 도입하면 등재한다

새 Redis 키나 pub/sub 채널을 만들면 **§3 인벤토리에 한 줄, 상세는 소유 문서에** 적는다.
이 의무가 없으면 인벤토리는 만들어진 시점의 스냅샷으로 굳는다.

## Rationale

### 왜 규칙을 코드에 맞췄나 (반대가 아니라)

종전 규약은 [`4-execution-engine.md` §9.1](../5-system/4-execution-engine.md#91-키-패턴) 이
**"모든 Redis 키는 `{service}:{workspaceId}:{resource}:{id}:{sub}` 를 따른다"** 고 선언했다.
실측하면 그 패턴을 따르는 키가 **하나도 없다** — 13계열 전부가 워크스페이스 비종속이다.

코드를 규칙에 맞추는 선택지는 채택하지 않았다:

- 실재 키 중 **워크스페이스 종속이 자연스러운 것이 없다.** `executionId` 는 이미 전역 유일
  UUID 라 워크스페이스 세그먼트가 정보를 더하지 않는다(§9.2 각주가 이미 같은 논증을 편다).
- 키 포맷 변경은 **배포 전환기에 기존 엔트리를 전부 고아로 만든다.** 이득 없는 마이그레이션이다.

그 패턴은 **폐기된 Phase-1 설계의 생존 흔적**이다 — 실행 상태를 워크스페이스 단위로 Redis 에
두려던 전제에서 나왔고, 그 전제는 같은 문서 Rationale("실행 컨텍스트 in-memory + DB durable —
Redis context store 미채택")이 이미 폐기했다. 전제가 사라졌으므로 형태만 남아 있을 이유도 없다.

**지켜진 적 없는 규칙은 규칙이 아니라 오해의 원천이다.**

### 왜 인벤토리가 포인터만 갖나

13계열이 6개 모듈에 흩어져 있다. TTL·용도·fail 정책까지 한 표로 모으면 각 영역 문서와
이중 SoT 가 되고, 그 둘이 어긋나는 순간 어느 쪽이 참인지 판정할 근거가 없어진다.
인벤토리의 일은 **"이 키가 어디 사는지"** 까지다.

### 왜 인접 네임스페이스를 명시하나

이 문서의 초안이 실제로 `background:run:<id>`(Socket.IO 채널)를 Redis 키로 잘못 등재했다.
형태가 같으면 종류도 같다고 넘겨짚기 쉽다 — 그 혼동을 문서 안에서 미리 끊는다.
