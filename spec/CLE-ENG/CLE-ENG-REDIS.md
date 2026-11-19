---
id: "CLE-ENG-REDIS"
title: "Redis 키 명명 규약"
type: "convention"
version: 6
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ENG"
ancestors: ["CLE-VISION", "CLE-ENG"]
area: "CLE-ENG"
content_hash: "f40ebd16719d0f5ae0e5382180336d58ea08856b4551c128d2af126d2bcf530f"
read_as: "approved_fallback"
task: "CLE-T-GTG3NQ"
source_paths: ["spec/conventions/redis-keys.md"]
mirror_sha256: "acb83e4c60b7ef396b0372cb2ca00a2972ea32bbe63aac27862166ad79fa2660"
etag: "sha256-4898bded6c3211817ebbea0e67306a4e67a5282e7ce90cc4c244ddd7a8e9f29c"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/redis-keys.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Redis 키 이름의 형태(Redis 키 형식, `{도메인}:{용도}[:{식별자}...]`)를 정한다. 이 문서가 정하는 것은 다섯이다.

1. 키 형태 규칙
2. 키에 워크스페이스 세그먼트를 넣을지 가리는 기준
3. 새 키를 만들 때의 등재 의무
4. 이름 모양이 비슷하지만 Redis 키가 아닌 인접 이름의 구분과 PostgreSQL advisory lock 키 계열의 목록·키 모양·해시 함수
5. 라이브러리가 형식을 정하는 이름(`bull:<queue>:*` · `ws:sio` 채널)의 범위와 접두 예외

범위 밖:

- 지금 있는 Redis 키와 pub/sub 채널의 전체 목록(인벤토리)과 BullMQ 큐 목록은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 이 단일 기준이다.
- 키별 용도·TTL·실패 정책은 그 키를 소유한 문서가 정한다. 실행 엔진 키는 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md), EIA 키는 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 과 [External Interaction API](../CLE-IX/CLE-EIA.md), 채팅 채널 키는 [채팅 채널 데이터와 흐름 — 저장 모델과 상태](../CLE-CHAT/CLE-CHAT-DATA-STORE.md#redis-키), 웹훅 요청 빈도 제한 키는 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md), Cafe24 설치 키는 [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md), Passkey 인증 챌린지 기록 키는 [가입과 로그인 — Passkey 로그인 인증과 counter 역행 「Passkey 인증 챌린지 기록」](../CLE-ACCT/CLE-ACCT-SIGNIN-PKAUTH.md#passkey-인증-챌린지-기록), WebSocket adapter 채널은 [WebSocket 연결과 채널 구독 — 메시지 · 구독 · 에러 「4.6 여러 서버 인스턴스에서의 전달」](../CLE-API/CLE-API-WS-MSG.md#46-여러-서버-인스턴스에서의-전달) 이 정한다. 한 표에 상세까지 모으면 그 표가 두 번째 기준이 된다.
- 라이브러리가 이름을 정하는 키 · 채널(`bull:<queue>:*`, `ws:sio` 채널)은 형태 규칙 밖이다([라이브러리가 이름을 정하는 것](#라이브러리가-이름을-정하는-것)).

## 규칙

1. Redis 키는 `{도메인}:{용도}[:{식별자}...]` 형태다. 머리 두 세그먼트(도메인·용도)는 고정이고 꼬리 식별자는 0~4개다.
2. 도메인은 그 키를 소유한 코드 모듈을 가리키는 짧은 접두다. 용도는 그 도메인 안에서 무엇을 저장하는지다. 소유 모듈과 도메인이 다른 기존 이름은 [규칙 밖의 기존 키](#규칙-밖의-기존-키) 에 적는다.
3. 새 키는 규칙 1 을 따른다. 규칙보다 먼저 있던 예외 두 계열은 이름을 바꾸지 않는다([규칙 밖의 기존 키](#규칙-밖의-기존-키)). 라이브러리가 형식을 정하는 이름은 규칙 1 밖이다([라이브러리가 이름을 정하는 것](#라이브러리가-이름을-정하는-것)).
4. 키에 워크스페이스 세그먼트(`workspaceId`)는 **키 수준의 워크스페이스 격리가 필요할 때만** 넣는다. 예: 워크스페이스별 쿼터, 격리된 네임스페이스 열거.
5. 워크스페이스 세그먼트를 넣을 때는 도메인 바로 뒤에 둔다: `{도메인}:{workspaceId}:{용도}:…`.
6. 한 모듈이 이미 쓰는 접두를 더 늘리지 않는다. 이미 여러 접두를 쓰는 모듈에 통일을 강제하지는 않는다. 예외는 Socket.IO Redis adapter 채널 접두 `ws:sio` 하나다([한 모듈이 여러 접두를 쓴다](#한-모듈이-여러-접두를-쓴다)). 이 예외를 새 접두를 더하는 근거로 쓰지 않는다.
7. 새 Redis 키나 pub/sub 채널을 만들면 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 에 한 줄을 더하고 용도·TTL·실패 정책은 소유 문서에 적는다. 이 의무가 없으면 목록은 만든 시점의 스냅샷으로 굳는다.
8. 이름 모양이 비슷해도 Redis 키가 아닌 이름은 Redis 키 목록에 넣지 않는다([인접 이름](#redis-키가-아닌-인접-이름)).
9. PostgreSQL advisory lock 키 계열을 새로 들이면 [인접 이름](#redis-키가-아닌-인접-이름) 표에 키 모양과 해시 함수를 올린다. 새 계열의 해시는 64비트 `hashtextextended(<키>, 0)` 를 쓴다.

## 키 형태

```text
{도메인}:{용도}[:{식별자}...]
```

- **도메인**: 코드에서 그 키를 소유한 모듈을 가리키는 짧은 접두.
- **용도**: 그 도메인 안에서 무엇을 저장하는지.
- **식별자**: 0~4개(규칙 1). 몇 개를 둘지는 키마다 다르다.

세그먼트 수를 고정하지 않는 이유는 실제 키가 3~6세그먼트로 갈리기 때문이다. `exec:recover:lock`(3세그먼트)부터 `cafe24:install:nonce:<mall_id>:<ts>:<hmac>`(6세그먼트)까지 있다.

식별자 하나에 콜론이 들어갈 수 있다. 채팅 채널 서명 검증 실패 한도 키 `cc:sigfail:<triggerId>:<clientIp>` 는 클라이언트 IP 가 IPv6 이면 그 세그먼트 안에 콜론이 여럿 있다(IPv4 매핑 주소는 IPv4 표기로 바꿔 넣는다). 그래서 세그먼트 수는 키 문자열을 콜론으로 나눈 개수가 아니라 키를 만드는 함수가 이어 붙인 값의 개수로 센다. 채팅 채널 모듈은 이 키를 만들기만 하고 콜론으로 쪼개 읽지 않는다.

## 워크스페이스 세그먼트

지금 있는 Redis 키 중 `workspaceId` 세그먼트를 가진 것은 없다. 모두 실행·트리거·IP·전역 단위 책임이다. `executionId`·`triggerId` 는 이미 전역에서 유일한 UUID 라 워크스페이스 세그먼트가 정보를 더하지 않는다.

이 판단의 대상은 Redis 키다. [인접 이름](#redis-키가-아닌-인접-이름)의 PostgreSQL advisory lock 키는 대상이 아니다. 그중 `exec-cap:<workspaceId>` 는 규칙 4 의 조건(워크스페이스별 쿼터)에 정확히 들어맞는 사례다. 예외로 볼 일이 아니다. 워크스페이스 단위 동시 실행 제한을 직렬화하는 키이기 때문이다.

## 규칙 밖의 기존 키

### 한 모듈이 여러 접두를 쓴다

- `modules/external-interaction` 은 `iext:`·`interaction:`·`eia:` 를 쓴다.
- `modules/chat-channel` 은 긴 접두(`chat-channel:`·`chat-channel-lock:`)와 약어(`cc:`)를 함께 쓴다.
- `modules/websocket` 은 `exec:seq`(이벤트 순번 키)와 `ws:sio`(Socket.IO Redis adapter 채널 접두)를 쓴다.

통일을 강제하지 않는다. 키 형식을 바꾸면 배포 전환기에 기존 엔트리가 모두 고아가 된다. 대신 모듈마다 접두가 더 늘지 않게 이 사실을 남긴다(규칙 6).

`ws:sio` 는 `websocket` 모듈이 접두를 하나 더 쓴 것이라 규칙 6 의 예외다. adapter 채널은 실행 이벤트 말고도 지식 저장소 · 인앱 알림 · Background 채널의 패킷을 싣기 때문에 `exec:` 아래에 두면 뜻이 틀린다. 이 예외는 라이브러리가 형식을 정하는 채널의 접두에만 둔다. 우리가 이름을 정하는 키에 새 접두를 더하는 근거로 쓰지 않는다.

### 소유 모듈과 도메인이 다른 채널

pub/sub 채널 `integration:cache:invalidate` 는 `common/redis` 의 캐시 무효화 버스가 소유하지만 도메인은 `integration` 이다. 무효화 대상이 통합 자격 증명이라 그 뜻을 이름에 담았다. 이름을 바꾸면 배포 전환기에 옛 인스턴스가 무효화를 받지 못하므로 그대로 둔다. 규칙 2 의 예외는 이 채널 하나다.

### 형태 규칙의 예외 두 계열

| 키 | 규칙 1 과 다른 점 |
| --- | --- |
| `chat-channel:<triggerId>:<conversationKey>` | 머리 두 세그먼트 중 **용도가 없다**. 도메인 다음이 바로 식별자다 |
| `chat-channel-lock:<triggerId>:<conversationKey>:formsubmit` | 반대로 **용도를 꼬리에** 둔다 |

둘 다 규약보다 먼저 있던 키이고 위와 같은 이유로 이름을 바꾸지 않는다. 이 표는 우리가 이름을 정한 키의 예외가 어디까지인지 그은 선이다. 새 예외를 허용하는 근거로 쓰지 않는다. 새 키는 규칙 1 을 따른다. 라이브러리가 형식을 정하는 이름은 다음 절에서 따로 다룬다.

### 라이브러리가 이름을 정하는 것

| 이름 | 정하는 라이브러리 | 우리가 정하는 부분 |
| --- | --- | --- |
| `bull:<queue>:*` | BullMQ | 큐 이름 |
| `ws:sio#/ws#[<채널>#]` · `ws:sio-request#/ws#` · `ws:sio-response#/ws#[<서버 uid>#]` | `@socket.io/redis-adapter` | 접두 `ws:sio`(adapter 의 `key` 옵션) |

이 절의 이름은 형식을 라이브러리가 정하므로 우리가 이름을 정한 앞 절의 두 계열과 종류가 다르다. `ws:sio` 채널 이름은 `#` 로 나뉘고 namespace(`/ws`)와 Socket.IO 채널 이름이 들어가서 규칙 1(형태)과 규칙 3(새 키는 규칙 1)을 따르지 않는다. 우리가 고를 수 있는 것은 접두뿐이다. 규칙 7 의 등재 의무는 그대로다. 목록은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 에 있다. `bull:<queue>:*` 키는 한 줄씩 올리지 않고 큐 목록으로 대신한다.

`ws:sio` 채널은 옛 `ws:{wsId}:session:{connId}` 연결 상태 키와 다르다. 연결 상태는 Redis 에 두지 않는다.

## Redis 키가 아닌 인접 이름

다음 이름은 `{도메인}:{용도}:{id}` 꼴이지만 Redis 키가 아니다. Redis 키 목록에 넣지 않는다. PostgreSQL advisory lock 키 계열의 키 모양과 해시 함수는 이 표가 정본이다. 그 키로 잠그는 기능 문서는 언제 잠그는지만 적고 이 표를 링크한다.

| 이름 | 실체 | 기준 문서 |
| --- | --- | --- |
| `background:run:<id>` · `execution:<id>` · `workflow:<id>` | **Socket.IO 채널** (`server.to(channel).emit()`). Redis 키가 아니다. 서버 인스턴스가 여럿이면 채널 이름이 adapter 채널 이름 `ws:sio#/ws#<채널>#` 안에 실려 Redis 를 지난다([라이브러리가 이름을 정하는 것](#라이브러리가-이름을-정하는-것)) | [WebSocket 연결과 채널 구독 — 메시지 · 구독 · 에러](../CLE-API/CLE-API-WS-MSG.md) §4.2 · §4.6 |
| `bg:<executionId>:<backgroundRunId>` | **메모리 Map 라우팅 키** (`_contextKey`) | [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) |
| `trigger-config:<triggerId>` · `exec-cap:<workspaceId>` (`workspaceId` 가 없으면 `<workflowId>`) | **PostgreSQL advisory lock 키**. `pg_advisory_xact_lock(hashtext(<키>))` 에 넣는 문자열. 해시는 32비트 `hashtext()` 다 | [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) · [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) |
| `makeshop-pending:<workspaceId>:<client_id 의 SHA-256 hex>` | **PostgreSQL advisory lock 키**. `pg_advisory_xact_lock(hashtextextended(<키>, 0))` 에 넣는 문자열. 해시는 64비트 `hashtextextended(<키>, 0)` 다. MakeShop `oauth/begin` 이 같은 `(workspace_id, client_id)` 의 설치 대기 행 재사용을 줄 세운다 | [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md#설치-대기-행-재사용의-권한) |

`makeshop-pending` 키의 마지막 세그먼트는 `client_id` 원문이 아니라 그 SHA-256 hex 다. `client_id` 는 암호화해 저장하는 자격 증명의 값이라 키 문자열에 원문을 넣지 않는다.

advisory lock 키는 계열이 달라도 한 공간을 쓴다. 모든 계열은 `pg_advisory_xact_lock(bigint)` 의 한 키 공간을 나눠 쓴다. `hashtext()` 계열은 int4(32비트)를 내므로 그 안의 int4 범위에만 놓이고 `hashtextextended()` 계열은 64비트 전체에 퍼진다. 그래서 64비트 계열의 키는 32비트 계열의 키와도, 64비트 계열의 키끼리도 거의 겹치지 않는다. 해시가 충돌해도 결과는 과직렬화(관계없는 두 요청이 서로를 기다림)뿐이라 정합성은 깨지지 않는다. 새 계열을 들이면 64비트 해시를 쓰고 이 표에 올린다(규칙 9). 계열이 늘어 불필요한 대기가 관측되면 키 공간 분리를 다시 검토한다.

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
- `codebase/backend/src/modules/websocket/ws-redis-adapter.ts`
- `codebase/backend/src/modules/auth/webauthn/webauthn-auth-challenge.service.ts`
- `codebase/backend/src/common/redis/**/*.ts`

## Rationale

### 규칙을 코드에 맞춘 이유

예전 규약은 실행 엔진 문서에서 "모든 Redis 키는 `{service}:{workspaceId}:{resource}:{id}:{sub}` 를 따른다" 고 선언했다. 실측하면 그 패턴을 따르는 키가 하나도 없었다. 실재 키 전부가 워크스페이스와 무관하다.

코드를 규칙에 맞추는 선택지는 택하지 않았다.

- 실재 키 중 워크스페이스에 묶이는 것이 자연스러운 키가 없다. `executionId` 는 이미 전역 유일 UUID 라 워크스페이스 세그먼트가 정보를 더하지 않는다.
- 키 형식을 바꾸면 배포 전환기에 기존 엔트리가 모두 고아가 된다. 이득 없는 마이그레이션이다.

그 패턴은 버린 초기 설계가 남긴 흔적이다. 실행 상태를 워크스페이스 단위로 Redis 에 두려던 전제에서 나왔다. 그 전제는 "실행 컨텍스트는 메모리 + DB 영속, Redis context store 는 택하지 않음" 결정([실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) Rationale)으로 이미 버렸다. 전제가 사라졌으니 형태만 남겨 둘 이유도 없다. 지켜진 적 없는 규칙은 규칙이 아니라 오해의 원천이다.

### 목록은 위치만, 상세는 소유 문서에 두는 이유

Redis 키는 여러 모듈(`execution-engine`·`websocket`·`external-interaction`·`chat-channel`·`hooks`·`integrations`·`auth`·`common/redis` 등)에 흩어져 있다. TTL·용도·실패 정책까지 한 표에 모으면 각 영역 문서와 기준이 둘이 되고 둘이 어긋나는 순간 어느 쪽이 맞는지 판정할 근거가 없어진다. 전역 목록이 맡는 일은 "이 키가 어디 있는지" 까지다.

NERV 로 옮기면서 전역 목록은 이 문서에서 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 으로 옮겼다. 실행 엔진 키의 용도·TTL 도 그 문서가 정한다. 이 문서에는 이름 규칙만 남겼다.

### 인접 이름을 따로 적는 이유

이 규약의 초안이 `background:run:<id>`(Socket.IO 채널)를 Redis 키로 잘못 올린 일이 있었다. 이름 모양이 같으면 종류도 같다고 넘겨짚기 쉽다. 그 혼동을 문서 안에서 미리 끊는다.

### 새 advisory lock 계열은 64비트 해시를 쓴다 (2026-10-29)

`makeshop-pending` 계열은 32비트 `hashtext()` 대신 64비트 `hashtextextended(<키>, 0)` 로 잠근다. 관계없는 키가 같은 락에 걸릴 확률을 줄이려는 것이다. 해시가 겹쳐도 정합성은 깨지지 않지만 관계없는 요청이 서로를 기다리게 된다. 키 공간이 32비트에서 64비트로 넓어지면 그런 겹침은 훨씬 드물어진다.

기존 `trigger-config`·`exec-cap` 계열은 바꾸지 않는다. 해시 함수를 바꾸면 배포 전환기에 옛 판과 새 판의 서버가 같은 키를 서로 다른 락 번호로 잡는다. 그동안은 두 서버가 서로를 막지 못한다. 앞으로 들이는 계열은 64비트를 쓴다(규칙 9).

### 식별자에 콜론이 들어가는 키는 값 개수로 센다 (2026-11-14)

IPv6 주소에는 콜론이 들어 있다. 그래서 `cc:sigfail:<triggerId>:<clientIp>` 를 콜론으로 나누면 IP 종류에 따라 세그먼트 수가 달라지고 [키 형태](#키-형태) 의 세그먼트 수를 셀 수 없다. 채팅 채널 모듈은 이 키를 만들기만 하고 콜론으로 나눠 읽지 않으므로 IP 값을 인코딩하지 않았다. 키를 나눠 읽는 코드가 생기면 인코딩을 다시 정한다.

### WebSocket adapter 채널 접두를 규약 예외로 둔 이유 (2026-11-14)

NERV Task `CLE-T-GDR39Z`. Socket.IO Redis adapter 의 채널 이름 형식은 라이브러리가 정하고 우리가 바꿀 수 없다. 우리가 고르는 것은 접두뿐이다. 연결 상태는 Redis 에 두지 않는다는 2026-08-13 결정([비동기 큐와 Redis 키 목록 「지운 키 두 개 (2026-08-13)」](../CLE-PLAT/CLE-PLAT-QUEUE.md#지운-키-두-개-2026-08-13))은 그대로 두고 채널 발행 패킷만 `ws:sio` 채널로 전달한다. 인접 이름 표는 Socket.IO 채널을 «Redis 를 거치지 않는다» 고 적었다. adapter 를 건 뒤로는 서버 인스턴스가 여럿이면 채널 이름이 adapter 채널 이름 안에 실려 Redis 를 지나므로 «Redis 키가 아니다» 로 고쳤다. 규칙 8 도 같은 이유로 고쳤다. adapter 를 걸기로 한 결정과 기각한 대안은 [WebSocket 연결과 채널 구독 — 메시지 · 구독 · 에러 「여러 서버 인스턴스 전달에 Socket.IO Redis adapter 를 쓴 이유 (2026-11-14)」](../CLE-API/CLE-API-WS-MSG.md#여러-서버-인스턴스-전달에-socketio-redis-adapter-를-쓴-이유-2026-11-14) 에 있다. `bull:<queue>:*` 는 Redis 키인데도 인접 이름 표(Redis 키가 아닌 이름)에 있었다. 라이브러리가 이름을 정하는 이름을 한 절로 모으면서 그 행을 새 절로 옮겼다. 규칙 6 의 예외는 라이브러리가 형식을 정하는 채널 접두 하나로 좁혔다. 접두를 고를 수 있는 우리 키에까지 예외를 넓히면 규칙 6 이 막으려던 접두 늘리기가 다시 열린다.
