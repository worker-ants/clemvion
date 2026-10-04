---
id: "CLE-ENG-REDIS"
title: "Redis 키 명명 규약"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ENG"
ancestors: ["CLE-VISION", "CLE-ENG"]
area: "CLE-ENG"
content_hash: "1ebdfbb26a74438e1dd63736fb2b3d724c6b63a6561eb25e999d87e0b77dfac6"
read_as: "approved_fallback"
task: "CLE-T-V22XN8"
source_paths: ["spec/conventions/redis-keys.md"]
mirror_sha256: "7844a4e1cc4f828ca6102440b62fbd205f4cd97d119b7b6f9312c6d79dbf6c66"
etag: "sha256-9b19efbc88e08a7266d30abb8652bd12be36509a8f55bf9107d00b2c59146323"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/redis-keys.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Redis 키 이름의 형태(Redis 키 형식, `{도메인}:{용도}[:{식별자}...]`)를 정한다. 이 문서가 정하는 것은 넷이다.

1. 키 형태 규칙
2. 키에 워크스페이스 세그먼트를 넣을지 가리는 기준
3. 새 키를 만들 때의 등재 의무
4. 이름 모양이 비슷하지만 Redis 키가 아닌 인접 이름의 구분

범위 밖:

- 지금 있는 Redis 키와 pub/sub 채널의 전체 목록(인벤토리)과 BullMQ 큐 목록은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 이 단일 기준이다.
- 키별 용도·TTL·실패 정책은 그 키를 소유한 문서가 정한다. 실행 엔진 키는 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md), EIA 키는 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 과 [External Interaction API](../CLE-IX/CLE-EIA.md), 채팅 채널 키는 [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md), 웹훅 요청 빈도 제한 키는 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md), Cafe24 설치 키는 [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) 가 정한다. 한 표에 상세까지 모으면 그 표가 두 번째 기준이 된다.
- BullMQ 가 큐마다 안에서 만드는 `bull:<queue>:*` 키는 라이브러리 표준이라 이 규약 밖이다.

## 규칙

1. Redis 키는 `{도메인}:{용도}[:{식별자}...]` 형태다. 머리 두 세그먼트(도메인·용도)는 고정이고 꼬리 식별자는 0~4개다.
2. 도메인은 그 키를 소유한 코드 모듈을 가리키는 짧은 접두다. 용도는 그 도메인 안에서 무엇을 저장하는지다.
3. 새 키는 규칙 1 을 따른다. 규칙보다 먼저 있던 예외 두 계열은 이름을 바꾸지 않는다([규칙 밖의 기존 키](#규칙-밖의-기존-키)).
4. 키에 워크스페이스 세그먼트(`workspaceId`)는 **키 수준의 워크스페이스 격리가 필요할 때만** 넣는다. 예: 워크스페이스별 쿼터, 격리된 네임스페이스 열거.
5. 워크스페이스 세그먼트를 넣을 때는 도메인 바로 뒤에 둔다: `{도메인}:{workspaceId}:{용도}:…`.
6. 한 모듈이 이미 쓰는 접두를 더 늘리지 않는다. 이미 여러 접두를 쓰는 모듈에 통일을 강제하지는 않는다.
7. 새 Redis 키나 pub/sub 채널을 만들면 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 에 한 줄을 더하고 용도·TTL·실패 정책은 소유 문서에 적는다. 이 의무가 없으면 목록은 만든 시점의 스냅샷으로 굳는다.
8. 이름 모양이 비슷해도 Redis 를 거치지 않는 이름은 Redis 키 목록에 넣지 않는다([인접 이름](#redis-키가-아닌-인접-이름)).
9. PostgreSQL advisory lock 키 계열을 새로 들이면 [인접 이름](#redis-키가-아닌-인접-이름) 표에 올린다.

## 키 형태

```text
{도메인}:{용도}[:{식별자}...]
```

- **도메인**: 코드에서 그 키를 소유한 모듈을 가리키는 짧은 접두.
- **용도**: 그 도메인 안에서 무엇을 저장하는지.
- **식별자**: 0~4개. 개수가 정해져 있지 않다.

세그먼트 수를 고정하지 않는 이유는 실제 키가 3~6세그먼트로 갈리기 때문이다. `exec:recover:lock`(3세그먼트)부터 `cafe24:install:nonce:<mall_id>:<ts>:<hmac>`(6세그먼트)까지 있다.

## 워크스페이스 세그먼트

지금 있는 Redis 키 중 `workspaceId` 세그먼트를 가진 것은 없다. 모두 실행·트리거·IP·전역 단위 책임이다. `executionId`·`triggerId` 는 이미 전역에서 유일한 UUID 라 워크스페이스 세그먼트가 정보를 더하지 않는다.

이 판단의 대상은 Redis 키다. [인접 이름](#redis-키가-아닌-인접-이름)의 PostgreSQL advisory lock 키는 대상이 아니다. 그중 `exec-cap:<workspaceId>` 는 규칙 4 의 조건(워크스페이스별 쿼터)에 정확히 들어맞는 사례다. 예외로 볼 일이 아니다. 워크스페이스 단위 동시 실행 제한을 직렬화하는 키이기 때문이다.

## 규칙 밖의 기존 키

### 한 모듈이 여러 접두를 쓴다

- `modules/external-interaction` 은 `iext:`·`interaction:`·`eia:` 를 쓴다.
- `modules/chat-channel` 은 긴 접두(`chat-channel:`·`chat-channel-lock:`)와 약어(`cc:`)를 함께 쓴다.

통일을 강제하지 않는다. 키 형식을 바꾸면 배포 전환기에 기존 엔트리가 모두 고아가 된다. 대신 모듈마다 접두가 더 늘지 않게 이 사실을 남긴다(규칙 6).

### 형태 규칙의 예외 두 계열

| 키 | 규칙 1 과 다른 점 |
| --- | --- |
| `chat-channel:<triggerId>:<conversationKey>` | 머리 두 세그먼트 중 **용도가 없다**. 도메인 다음이 바로 식별자다 |
| `chat-channel-lock:<triggerId>:<conversationKey>:formsubmit` | 반대로 **용도를 꼬리에** 둔다 |

둘 다 규약보다 먼저 있던 키이고 위와 같은 이유로 이름을 바꾸지 않는다. 이 표는 예외가 어디까지인지 그은 선이다. 새 예외를 허용하는 근거로 쓰지 않는다. 새 키는 규칙 1 을 따른다.

## Redis 키가 아닌 인접 이름

다음 이름은 `{도메인}:{용도}:{id}` 꼴이지만 Redis 를 거치지 않는다. Redis 키 목록에 넣지 않는다.

| 이름 | 실체 | 기준 문서 |
| --- | --- | --- |
| `background:run:<id>` · `execution:<id>` · `workflow:<id>` | **Socket.IO 채널** (`server.to(channel).emit()`) | [WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md) |
| `bg:<executionId>:<backgroundRunId>` | **메모리 Map 라우팅 키** (`_contextKey`) | [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) |
| `bull:<queue>:*` | BullMQ 내부 키(라이브러리 표준) | [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) |
| `trigger-config:<triggerId>` · `exec-cap:<workspaceId>` (`workspaceId` 가 없으면 `<workflowId>`) | **PostgreSQL advisory lock 키**. `pg_advisory_xact_lock(hashtext(<키>))` 에 넣는 문자열 | [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) · [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) |

advisory lock 키는 계열이 달라도 한 공간을 쓴다. `hashtext()` 는 int4(32비트)를 내므로 접두가 달라도 모든 계열이 같은 키 공간을 나눠 쓴다. 해시가 충돌해도 결과는 과직렬화(관계없는 두 요청이 서로를 기다림)뿐이라 정합성은 깨지지 않는다. 새 계열을 들이면 이 표에 올린다(규칙 9). 계열이 늘어 불필요한 대기가 관측되면 키 공간 분리를 다시 검토한다.

이 표는 같은 모양의 이름을 모두 담지는 않는다. 현재 구현에는 같은 꼴의 이름이 더 있다.

- Socket.IO 채널 `kb:<documentId>`·`notifications:<userId>` (`modules/websocket/websocket.service.ts`)
- 사용자 단위 요청 빈도 제한의 추적 키 `user:<userId>` (`common/guards/user-throttler.guard.ts`). 요청 빈도 제한은 메모리 카운터라 Redis 키가 아니다([비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md))
- 에이전트 메모리 추출 큐의 BullMQ 작업 ID `agent-memory:<workspaceId>:<scopeKey>` (`modules/agent-memory/agent-memory.service.ts`). BullMQ 내부 키(`bull:<queue>:*`)의 일부로 저장된다

## 구현 위치

- `codebase/backend/src/modules/execution-engine/**/*.ts`
- `codebase/backend/src/modules/external-interaction/**/*.ts`
- `codebase/backend/src/modules/chat-channel/**/*.ts`
- `codebase/backend/src/modules/hooks/**/*.ts`
- `codebase/backend/src/modules/integrations/**/*.ts`
- `codebase/backend/src/modules/websocket/execution-seq-allocator.service.ts`
- `codebase/backend/src/common/redis/**/*.ts`

## Rationale

### 규칙을 코드에 맞춘 이유

예전 규약은 실행 엔진 문서에서 "모든 Redis 키는 `{service}:{workspaceId}:{resource}:{id}:{sub}` 를 따른다" 고 선언했다. 실측하면 그 패턴을 따르는 키가 하나도 없었다. 실재 키 전부가 워크스페이스와 무관하다.

코드를 규칙에 맞추는 선택지는 택하지 않았다.

- 실재 키 중 워크스페이스에 묶이는 것이 자연스러운 키가 없다. `executionId` 는 이미 전역 유일 UUID 라 워크스페이스 세그먼트가 정보를 더하지 않는다.
- 키 형식을 바꾸면 배포 전환기에 기존 엔트리가 모두 고아가 된다. 이득 없는 마이그레이션이다.

그 패턴은 버린 Phase-1 설계가 남긴 흔적이다. 실행 상태를 워크스페이스 단위로 Redis 에 두려던 전제에서 나왔다. 그 전제는 "실행 컨텍스트는 메모리 + DB 영속, Redis context store 는 택하지 않음" 결정([실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) Rationale)으로 이미 버렸다. 전제가 사라졌으니 형태만 남겨 둘 이유도 없다. 지켜진 적 없는 규칙은 규칙이 아니라 오해의 원천이다.

### 목록은 위치만, 상세는 소유 문서에 두는 이유

Redis 키는 7개 모듈(`execution-engine`·`websocket`·`external-interaction`·`chat-channel`·`hooks`·`integrations`·`common/redis`)에 흩어져 있다. TTL·용도·실패 정책까지 한 표에 모으면 각 영역 문서와 기준이 둘이 되고 둘이 어긋나는 순간 어느 쪽이 맞는지 판정할 근거가 없어진다. 전역 목록이 맡는 일은 "이 키가 어디 있는지" 까지다.

NERV 로 옮기면서 전역 목록은 이 문서에서 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 으로 옮겼다. 실행 엔진 키의 용도·TTL 도 그 문서가 정한다. 이 문서에는 이름 규칙만 남겼다.

### 인접 이름을 따로 적는 이유

이 규약의 초안이 `background:run:<id>`(Socket.IO 채널)를 Redis 키로 잘못 올린 일이 있었다. 이름 모양이 같으면 종류도 같다고 넘겨짚기 쉽다. 그 혼동을 문서 안에서 미리 끊는다.
