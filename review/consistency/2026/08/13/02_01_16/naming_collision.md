STATUS=success naming_collision review complete — 1 CRITICAL, 1 INFO
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-redis-key-registry.md`

## 발견사항

- **[CRITICAL]** `background:run:<id>` — 신설 Redis 키 레지스트리가 기존 **WebSocket 채널명**을 Redis 키로 오분류해 등재한다
  - target 신규 식별자: target 의 "실측" 표(§① "코드에서 실재하는 Redis 키 계열을 전수로 뽑아 보면…")가
    `background:run:<id>` 를 `exec:recover:lock`·`iext:blacklist:<jti>` 등과 나란히 "Redis 키" 로 등재하고
    소유를 "Background 노드" 로 적는다. target 의 §제안 변경 1 은 이 실측 표를 그대로
    `spec/conventions/redis-keys.md` 의 "전역 인벤토리" 본문으로 옮긴다고 명시한다
    ("담을 것 … **전역 인벤토리**: 위 실측 표").
  - 기존 사용처: `background:run:<id>` 는 Redis 키가 아니라 **Socket.IO 브로드캐스트 채널명**이다.
    - [`spec/5-system/6-websocket-protocol.md:150`](../../../../../spec/5-system/6-websocket-protocol.md) — "채널별 인가 전략" 표에
      `background:run:{id}` 를 `execution:{executionId}`·`workflow:{workflowId}`·`kb:{documentId}` 와
      같은 행으로 등재(**WS 채널** 네임스페이스).
    - [`spec/4-nodes/1-logic/12-background.md:273,277,332`](../../../../../spec/4-nodes/1-logic/12-background.md),
      [`spec/data-flow/3-execution.md:144,230`](../../../../../spec/data-flow/3-execution.md),
      [`spec/3-workflow-editor/3-execution.md:708,710`](../../../../../spec/3-workflow-editor/3-execution.md) — 전부
      "WebSocket 채널" 로 서술.
    - 구현: `codebase/backend/src/modules/websocket/websocket.service.ts:599`
      (`const channel = \`background:run:${backgroundRunId}\`;`) → `websocket.gateway.ts:980-982`
      의 `broadcastToChannel()` 이 `this.server.to(channel).emit(...)` 로 **Socket.IO room emit** 만
      한다. 저장소 전수 검색(`redis-adapter`/`socket.io-redis`/`createAdapter`) 결과 Socket.IO 는
      Redis adapter 를 쓰지 않는다 — 이 "채널" 은 **프로세스-로컬**이며 Redis 를 전혀 경유하지 않는다.
  - 상세: 두 SoT 후보가 같은 문자열을 다른 자원 유형으로 주장하게 된다 — `6-websocket-protocol.md`
    는 이를 "인가가 필요한 WS 구독 채널" 로, target 이 신설하려는 `redis-keys.md` 는 "Redis 키"(TTL·
    fail-open 정책 등 Redis 고유 속성을 갖는 자원)로 등재한다. target 문서 스스로가 이번 착수
    동기로 든 문제("규약 SoT 가 실제와 달라 오해를 낳는다")를 **같은 초안 안에서 재생산**하는
    셈이다. 이 항목이 그대로 `spec/conventions/redis-keys.md` 에 들어가면: (1) 다음 사람이 "Redis
    미가용 시 이 채널이 fail-open/fail-closed 되는가" 를 묻게 만드는 잘못된 전제를 세우고,
    (2) target 이 새로 도입하는 도메인 접두 `background`(Redis 도메인 접두 목록의 8개 중 하나)가
    실제로는 **WS 채널 네임스페이스**에서 이미 다른 의미로 쓰이고 있어, 향후 실제 Redis 키를
    `background:*` 로 짓는 사람이 두 네임스페이스를 혼동할 여지를 만든다.
  - 제안: 전역 인벤토리 표에서 `background:run:<id>` 행을 **제거**한다(Redis 키가 아니므로).
    대신 §9.1 정정 또는 새 규약 문서 서두에 "Redis 키가 아닌 인접 네임스페이스" 각주로
    WebSocket 채널명(`background:run:<id>` 등, SoT: `6-websocket-protocol.md`)을 한 줄
    참조만 남기는 편이 이 draft 가 이미 쓰고 있는 "포인터만 갖는다" 원칙과 일치한다.
    같은 실측 방법론(따옴표 고정 재검색)을 이 표의 8행 전체에도 한 번 더 적용해 검증할 것 —
    이 draft 는 이미 한 번 느슨한 정규식으로 오탐(`core:`/`ws:` 각 0건을 10/24파일로 오판)을
    겪었다고 스스로 기록했는데, 그 교정 뒤에도 같은 클래스의 오분류(자원 **존재**는 맞지만
    **유형**이 틀림)가 한 행 남아 있었던 셈이다.

- **[INFO]** EIA 소유 Redis 키가 리터럴 접두 3종(`iext`·`interaction`·`eia`)으로 흩어져 있는데
  target 의 "도메인 접두" 규칙은 이를 명시적으로 다루지 않는다
  - target 신규 식별자: §제안 변경 1 "명명 규칙 (사실 기반)" — "도메인은 코드 소유 모듈을 가리키는
    짧은 접두(`exec`·`eia`·`iext`·`cc`·`wh`·`cafe24`·`background`·`integration`)". `eia` 와 `iext`
    를 **별개 도메인 접두**로 병렬 나열한다.
  - 기존 사용처: 실측 표 자체에서 `iext:blacklist:<jti>` 와 `interaction:idempotency:<...>` 를
    "EIA" 한 행에, `eia:rl:interact:<executionId>` 등을 "EIA rate limit" 별행에 묶는다 — 즉
    셋 다 `external-interaction` 모듈 소유인데 리터럴 접두가 `iext`/`interaction`/`eia` 로
    셋이다(코드: `interaction-token.service.ts` 등 `iext:` · `idempotency.interceptor.ts` `interaction:`
    · `interaction-rate-limiter.service.ts`/`outbound-notification-rate-limiter.service.ts` `eia:`).
  - 상세: "도메인 = 짧은 접두 하나" 라는 규칙 서술과, 한 모듈이 리터럴 접두 3개를 쓰는 실측
    사실이 이 초안 안에서 나란히 있다. 충돌이라기보다 규칙 서술이 예외를 명시하지 않는
    미완결 상태 — 다음 사람이 새 EIA 키를 지을 때 `eia:`/`iext:`/`interaction:` 중 어느 것을
    따라야 하는지 규약 문서만 보고는 알 수 없다.
  - 제안: `spec/conventions/redis-keys.md` 본문에 "동일 소유 모듈이 리터럴 접두 여러 개를
    쓰는 예"로 EIA 를 명시하고(레거시 사유·통일하지 않는 이유), 신규 키 작성 시 어느 접두를
    따를지 한 줄 지침을 추가할 것을 권장(필수 아님, target 의 다른 정정과 함께 반영 가능).

## 요약

target 이 신설하려는 `spec/conventions/redis-keys.md` 의 전역 인벤토리는 착수 시 실측을 두 번
교정한 끝에도(느슨한 정규식 오탐 정정 포함) 한 행이 여전히 틀려 있다 — `background:run:<id>` 는
Redis 키가 아니라 `spec/5-system/6-websocket-protocol.md` §채널별 인가 전략에 이미 등재된
Socket.IO 브로드캐스트 채널명이며, Socket.IO 는 Redis adapter 없이 프로세스-로컬로 동작해 Redis 를
전혀 경유하지 않는다(코드 확인: `websocket.service.ts`→`websocket.gateway.ts` 의
`server.to(channel).emit()`). 이 draft 가 스스로 "지켜진 적 없는 규칙은 오해의 원천" 이라 지적한
문제와 같은 클래스의 결함을 자신의 SoT 후보 안에 들여오는 셈이라 CRITICAL 로 판정한다 — 이 한 행만
빼면 나머지 7개 키/채널 계열(`exec:*`·`iext:blacklist`·`interaction:idempotency`·`eia:rl:*`·
`eia:notif:rl:*`·`cc:rl:*`·`wh:rl:*`·`cafe24:install:*`·`integration:cache:invalidate`)은 전부
코드에서 리터럴 검증됐고 신규 파일 경로(`spec/conventions/redis-keys.md`)도 기존 컨벤션 폴더
명명과 충돌하지 않는다. 부가로 EIA 모듈의 리터럴 접두 3종 병존은 규약 서술을 완성하는 선에서
INFO 로 남긴다.

## 위험도

MEDIUM
