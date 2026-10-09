---
id: "CLE-EIA-NOTIFY"
title: "EIA 알림 웹훅"
type: "feature"
version: 2
status: "approved"
requirements: ["REQ-EIANOTI-001", "REQ-EIANOTI-002", "REQ-EIANOTI-003", "REQ-EIANOTI-004", "REQ-EIANOTI-005", "REQ-EIANOTI-006", "REQ-EIANOTI-007", "REQ-EIANOTI-008", "REQ-EIANOTI-009", "REQ-EIANOTI-010", "REQ-EIANOTI-011", "REQ-EIANOTI-012", "REQ-EIANOTI-013", "REQ-EIANOTI-014", "REQ-EIANOTI-015", "REQ-EIANOTI-016", "REQ-EIANOTI-017", "REQ-EIANOTI-018", "REQ-EIANOTI-019", "REQ-EIANOTI-020", "REQ-EIANOTI-021", "REQ-EIANOTI-022", "REQ-EIANOTI-023", "REQ-EIANOTI-024", "REQ-EIANOTI-025", "REQ-EIANOTI-026", "REQ-EIANOTI-027", "REQ-EIANOTI-028", "REQ-EIANOTI-029", "REQ-EIANOTI-030", "REQ-EIANOTI-031", "REQ-EIANOTI-032", "REQ-EIANOTI-033", "REQ-EIANOTI-034", "REQ-EIANOTI-035", "REQ-EIANOTI-036", "REQ-EIANOTI-037"]
basis_superseded: false
parent: "CLE-IX"
ancestors: ["CLE-VISION", "CLE-IX"]
area: "CLE-IX"
content_hash: "009c84dd2bdb25c84b81850f12fcee6b98b69c4c08d151a83be9d169b1fae58f"
read_as: "approved_fallback"
task: "CLE-T-M6PERB"
source_paths: ["spec/5-system/14-external-interaction-api.md", "spec/data-flow/15-external-interaction.md"]
mirror_sha256: "d7f9159018d7111c5717a00c333a9ce3b78a38ac2470513fbe8cf5cfd28e324a"
etag: "sha256-1a7272f69a3c94a85f84658f8eda76c001fd83b93f8e46b37a3a549c9c3d8242"
---
> 구현 상태: 부분 구현 · 원문: `spec/5-system/14-external-interaction-api.md` (§3.1, §6, §8.1·§8.2, Rationale R2·R6·R12·R-outbound-flood), `spec/data-flow/15-external-interaction.md` (§1.4 발송 사실) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

EIA 알림 웹훅(Outbound Notification Webhook, `config.notification`)은 실행 이벤트를 트리거에 등록한 외부 URL 로 HMAC 서명해 보내는 채널이다. 서버 간 자동화처럼 SSE 연결을 유지하기 어려운 호출자가 입력 대기·종료 같은 사건을 받는 데 쓴다. 인앱 알림([알림](../CLE-OBS/CLE-OBS-NOTIFY.md))과는 다른 기능이다.

이 문서는 알림 웹훅의 계약을 정한다. 구독할 수 있는 이벤트, 헤더와 서명, 이벤트 봉투, 종결 이벤트의 필드 집합과 `execution.cancelled` 행동 계약, 이벤트별 payload, 재시도와 실패 처리, 폭주 감지, SSRF 방지, 시크릿 교체가 여기 있다. 종결 이벤트 필드 집합과 채널별 봉투는 SSE·WebSocket 도 이 문서를 기준으로 삼는다.

범위 밖: 트리거 등록 페이로드와 채널 공통 규칙은 [External Interaction API](CLE-EIA.md), SSE 로 같은 이벤트를 받는 방법은 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md), 발송 파이프라인의 큐·저장소·시크릿 승격 흐름은 [EIA 데이터와 흐름](CLE-EIA-DATA.md), 값 가리기 정책은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.

## 요구사항

- REQ-EIANOTI-001 WHEN 트리거에 `notification.url` 이 설정돼 있고 구독한 이벤트가 발생하면 THE SYSTEM SHALL 그 URL 로 이벤트를 HTTP POST 한다. (원본: EIA-NX-01)
- REQ-EIANOTI-002 WHEN 구독 이벤트를 등록하면 THE SYSTEM SHALL `execution.waiting_for_input`·`execution.completed`·`execution.failed`·`execution.cancelled`·`execution.ai_message` 다섯 가지 안에서만 받는다. (원본: EIA-NX-02)
- REQ-EIANOTI-003 WHEN 알림을 보내면 THE SYSTEM SHALL 본문을 HMAC 으로 서명해 `X-Clemvion-Signature: t=<unix>,v1=<hex>` 헤더로 싣는다. (원본: EIA-NX-03)
- REQ-EIANOTI-004 WHEN 서명 알고리즘을 설정 값으로 드러내면 THE SYSTEM SHALL `hmac-sha256`·`hmac-sha512` 두 값만 받고 웹훅 인바운드 검증의 `sha256`·`sha512` 표기와 나눈다. (원본: EIA-NX-03, §8.2)
- REQ-EIANOTI-005 WHEN 같은 이벤트를 다시 보내면 THE SYSTEM SHALL 처음과 같은 `X-Clemvion-Delivery` UUID 를 싣는다. (원본: EIA-NX-04)
- REQ-EIANOTI-006 WHEN `waiting_for_input`·`ai_message` 알림을 보내기 직전이면 THE SYSTEM SHALL 실행 상태를 다시 읽고 이미 종료된 실행이면 보내지 않는다. (원본: EIA-NX-05)
- REQ-EIANOTI-007 WHEN 수신 측이 응답하면 THE SYSTEM SHALL `2xx` 만 성공으로 본다. (원본: EIA-NX-06)
- REQ-EIANOTI-008 IF 응답이 `2xx` 가 아니거나 10초 안에 오지 않으면 THE SYSTEM SHALL 1초에서 시작해 4배씩 늘어나는 간격(1초 · 4초 · 16초 · 64초 …)으로 다시 보내되 첫 시도를 포함한 총 시도 횟수를 `notification.retry.maxAttempts`(기본 5, 상한 10, 0 은 1 로 본다)로 제한한다. (원본: EIA-NX-06)
- REQ-EIANOTI-009 IF 마지막 시도까지 실패하면 THE SYSTEM SHALL 트리거의 발송 건강도(`notification_health`)를 `degraded` 로 바꾸고 `notification_last_error` 를 기록하되 트리거를 끄지 않는다. (원본: EIA-NX-07)
- REQ-EIANOTI-010 WHEN 알림을 보내면 THE SYSTEM SHALL 봉투에 그 실행의 이벤트 순번(`seq`)을 싣는다. (원본: EIA-NX-08)
- REQ-EIANOTI-011 IF `notification.url` 이 `https://` 가 아니면 THE SYSTEM SHALL 거부하되, 개발 환경 변수 `ALLOW_HTTP_HOOKS=1` 일 때만 `http://` 를 허용한다. (원본: EIA-NX-09)
- REQ-EIANOTI-012 IF `notification.url` 이 사설 IP·loopback·메타데이터 주소로 풀리면 THE SYSTEM SHALL 등록할 때와 보내기 직전에 모두 거부한다. (원본: EIA-NX-10)
- REQ-EIANOTI-013 WHEN 알림 URL 을 검증하면 THE SYSTEM SHALL 워크스페이스 단위 허용·차단 목록을 함께 적용한다. (원본: EIA-NX-10) (미구현)
- REQ-EIANOTI-014 WHEN 한 트리거의 발송 성공이 분당 60건을 넘으면 THE SYSTEM SHALL 알림을 버리거나 늦추지 않고 보내되 발송 건강도를 `degraded` 로, `notification_last_error` 를 폭주 전용 메시지로 기록한다. (원본: EIA-NX-11)
- REQ-EIANOTI-015 WHEN 폭주가 멎어 분당 60건 이내로 발송에 성공하면 THE SYSTEM SHALL 발송 건강도를 `healthy` 로 되돌린다. (원본: R-outbound-flood)
- REQ-EIANOTI-016 WHEN `POST /api/triggers/:id/notification/rotate-secret` 이 호출되면 THE SYSTEM SHALL 새 서명 시크릿을 만들어 응답에 한 번만 평문으로 싣고 24시간 동안 옛 시크릿과 함께 쓴다. (원본: EIA-NX-12)
- REQ-EIANOTI-017 WHEN 시크릿 교체가 일어나면 THE SYSTEM SHALL 감사 로그에 `trigger.notification_secret_rotated` 를 남긴다. (원본: EIA-NX-12)
- REQ-EIANOTI-018 WHILE 시크릿 교체 유예 24시간 동안 THE SYSTEM SHALL 옛 시크릿과 새 시크릿으로 각각 서명한 `v1=` 두 개를 함께 싣는다. (원본: data-flow §1.4)
- REQ-EIANOTI-019 IF 주 알림 서명 시크릿이 없거나 가져오지 못하면 THE SYSTEM SHALL 서명 없이 보내지 않고 발송 건강도를 `degraded` 로 바꾼다. 유예 중인 새 시크릿(`notification_secret_v2`)만 있어도 그 값 하나로 서명해 보내지 않는다. (원본: data-flow §1.4)
- REQ-EIANOTI-020 IF 이벤트에 `triggerId` 가 없거나(수동 실행) 트리거가 삭제됐으면 THE SYSTEM SHALL 알림을 보내지 않는다. (원본: data-flow §1.4)
- REQ-EIANOTI-021 WHEN 트랜잭션이 커밋되면 THE SYSTEM SHALL 평균 200ms 안에 알림 HTTP POST 를 시도한다. (원본: EIA-NF-01)
- REQ-EIANOTI-022 WHEN 알림을 보내면 THE SYSTEM SHALL 최소 한 번 전달을 보장하고, 수신 측이 `X-Clemvion-Delivery` 로 중복을 거르고 `seq` 로 정렬할 수 있게 한다. (원본: EIA-RL-01)
- REQ-EIANOTI-023 WHEN 종결 이벤트(`completed`·`failed`·`cancelled`)를 보내면 THE SYSTEM SHALL 종결 이벤트 필드 집합 표에 있는 필드만 싣는다. (원본: §6)
- REQ-EIANOTI-024 WHEN `execution.cancelled` 를 보내면 THE SYSTEM SHALL `result.cancelledBy` 에 `user`·`system`·`timeout` 중 하나를 싣는다. (원본: §6)
- REQ-EIANOTI-025 WHEN 시스템이 실행을 취소하면 THE SYSTEM SHALL `execution.cancelled` 에 사유를 가르는 `error.code` 를 함께 싣는다. (원본: §6)
- REQ-EIANOTI-026 WHEN 사용자가 실행을 취소하면 THE SYSTEM SHALL `execution.cancelled` 에 `error` 키를 싣지 않는다. (원본: §6)
- REQ-EIANOTI-027 WHEN `execution.failed` 를 보내면 THE SYSTEM SHALL `error` 를 모든 경로에서 `{ code, message, nodeId, details? }` 객체로 싣고, 분류할 코드나 노드가 없으면 `code`·`nodeId` 를 `null` 로 둔다. (원본: §6, §6.4)
- REQ-EIANOTI-028 WHEN `execution.failed` 의 `error.message`·`error.details` 를 내보내면 THE SYSTEM SHALL 자격 증명 값을 가리고 `code`·`nodeId` 는 원문 그대로 둔다. (원본: §6.4)
- REQ-EIANOTI-029 WHEN 종결 이벤트를 보내면 THE SYSTEM SHALL 영속한 `durationMs` 를 싣고 알 수 없으면 `null` 로 둔다. (원본: §6)
- REQ-EIANOTI-030 WHEN 입력 대기·AI 메시지 이벤트를 밖으로 보내면 THE SYSTEM SHALL 디버그 전용 필드(`llmCalls` 등 원본 LLM 요청·응답)를 깊이와 관계없이 뺀다. (원본: §6.2, §6.5)
- REQ-EIANOTI-031 WHEN `execution.ai_message` 에 표시물이 있으면 THE SYSTEM SHALL WebSocket payload 의 `presentations[]` 를 그대로 전달한다. (원본: §6.5)
- REQ-EIANOTI-032 WHEN `execution.completed` 를 보내면 THE SYSTEM SHALL 실행 결과 출력(`result.outputs`)을 싣는다. (원본: §6) (미구현)
- REQ-EIANOTI-033 WHEN `waiting_for_input` 알림을 보내면 THE SYSTEM SHALL 인터랙션 안내 블록(`submitUrl`·`streamUrl`·`statusUrl`·`cancelUrl`·`token`·`expiresAt`·`expectedCommands`)을 싣는다. (원본: §6.2) (미구현)
- REQ-EIANOTI-034 WHEN 트리거 조회 · 생성 · 수정 응답이 `notificationLastError` 를 돌려주면 THE SYSTEM SHALL 저장값은 두고 응답에서 자격 증명 모양을 가린다. ([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md#310-트리거-응답의-마지막-오류-2026-10-05))
- REQ-EIANOTI-035 WHEN 시크릿 교체 유예 중에 `rotate-secret` 이 다시 호출되면 THE SYSTEM SHALL 앞서 만든 새 시크릿을 이번 새 시크릿으로 덮어쓰고 24시간 유예를 그 시각부터 다시 시작한다. ([시크릿 교체](#시크릿-교체))
- REQ-EIANOTI-036 WHEN 매시 승격 작업이 유예가 끝난 새 시크릿을 승격하면 THE SYSTEM SHALL 시크릿 교체와 같은 트리거 설정 잠금을 잡고 잠금 안에서 읽은 `notification_secret_v2` 가 처음 고른 값과 같을 때만 같은 잠금 안에서 그 값을 정식 참조로 옮기고 비운다. ([시크릿 교체](#시크릿-교체))
- REQ-EIANOTI-037 WHEN EIA 알림 웹훅 설정(`config.notification`)이 있는 트리거를 만들거나 PATCH 로 EIA 알림 웹훅 설정을 처음 붙이면 THE SYSTEM SHALL 알림 서명 시크릿을 발급해 시크릿 저장소에 넣고 평문을 그 응답에 한 번만 싣는다. 호출자가 원시 `config` 로 보냈거나 다시 읽은 행에 남아 있는 평문 `signing.secret`(옛 키)이 있으면 그 값을 쓰고 발급하지 않는다. ([시크릿 교체](#시크릿-교체), 응답 위치: [트리거 관리 「API」](../CLE-TRIG/CLE-TRIG-MANAGE.md#api))

## 구독 이벤트

| 이벤트 | 기본 구독 예시 | 설명 |
|---|---|---|
| `execution.waiting_for_input` | 예 | 실행이 입력 대기에 들어갔다 |
| `execution.completed` | 예 | 실행이 완료됐다 |
| `execution.failed` | 예 | 실행이 실패했다 |
| `execution.cancelled` | 예 | 실행이 취소됐다 |
| `execution.ai_message` | 아니오 | AI 응답. 양이 많아 명시적으로 구독할 때만 보낸다 |

이 다섯 가지 밖의 이벤트(노드 이벤트, `execution.message` 등)는 알림 웹훅으로 보내지 않는다(`FANOUT_EVENTS` 화이트리스트). SSE 는 더 많은 이벤트를 보낸다. 대응은 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) 에 있다.

## 헤더와 서명

```
POST <notification.url>
Content-Type:           application/json
X-Clemvion-Event:       execution.waiting_for_input
X-Clemvion-Execution-Id: <uuid>
X-Clemvion-Trigger-Id:   <uuid>
X-Clemvion-Workflow-Id:  <uuid>
X-Clemvion-Delivery:     <uuid>            # 다시 보내도 같다
X-Clemvion-Timestamp:    <unix>
X-Clemvion-Signature:    t=<unix>,v1=<hex>
```

서명 계산 규칙(Stripe 방식):

```
signed_payload = "{timestamp}.{rawBody}"
signature      = HMAC_SHA256(secret, signed_payload)   // hmac-sha512 면 SHA-512
header value   = "t={timestamp},v1={hex(signature)}"
```

- 알고리즘 기본값은 `hmac-sha256`, 다른 값은 `hmac-sha512` 뿐이다(`notification-signature.util.ts`).
- 시크릿 교체 유예 중에는 새 시크릿으로도 서명해 `v1=` 를 두 개 싣는다(`t=<unix>,v1=<hex>,v1=<v2hex>`).
- 서명 스킴 버전은 별개 축이다. 헤더의 `v1=` 가 그 버전이고, 새 스킴을 들이면 `v2=` 를 함께 적는다. 지금 발행하는 것은 `v1=` 뿐이다. 이 `v2` 는 시크릿 교체용 `notification_secret_v2` 컬럼과 이름만 겹치고 관계가 없다.
- 검증 측 헬퍼 `verifySignatureHeader`(±5분 허용)는 SDK·e2e 가 다시 쓸 수 있게 export 돼 있다.

수신 측 검증 규칙:

- 타이밍 안전 비교를 쓴다.
- `timestamp` 가 현재 시각 ±5분 밖이면 거부한다(재전송 공격 방지).
- 시크릿 교체 유예(24시간) 중에는 옛 시크릿과 새 시크릿을 둘 다 시도하고 하나라도 맞으면 통과시킨다.
- 알고리즘은 `hmac-sha256`·`hmac-sha512` 두 값만 받는다. 웹훅 인바운드 HMAC 검증([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md))의 `sha256`·`sha512` 와 같은 두 알고리즘이고 표기만 다르다.
- 서명 헤더 누락·형식 오류·시간 창 초과·서명 불일치는 모두 같은 401 메시지로 답한다. 어떤 알고리즘을 쓰는지 새지 않게 하려는 것이다.

## 이벤트 봉투

엔진이 만드는 이벤트는 하나지만 받는 채널마다 최종 형태가 다르다. `payload` 래퍼는 알림 웹훅에만 있다.

| 채널 | 최종 형태 |
|---|---|
| WebSocket(에디터, 내부) | `{ executionId, …필드 집합, seq, timestamp }` 평면 |
| SSE | 위 평면 객체 + `triggerId`·`workflowId`. `payload` 래퍼 없음 |
| 알림 웹훅 | `{ type, executionId, triggerId, workflowId, seq, timestamp, payload: { …SSE 와 같은 평면 객체 } }` |

- 알림 웹훅은 키 다섯 개(`executionId`·`seq`·`timestamp`·`triggerId`·`workflowId`)가 바깥 봉투와 `payload` 안에 두 번 나온다. 결함으로 보지 않는다. 지금 구조가 그렇다. 바깥 `workflowId` 는 트리거 행에서, 안쪽은 실행 라우팅 컨텍스트에서 온다.
- 이 `payload` 이벤트 봉투는 REST 응답의 `data` 응답 봉투와 다른 것이다. 이름만 비슷하고 서로 참조하지 않는다.
- 평면은 봉투 차원의 말이다. `executionId`·`seq`·`timestamp` 가 필드 집합과 같은 층에 온다는 뜻이지 필드 집합 안의 중첩을 펴라는 뜻이 아니다. `result.cancelledBy` 의 `result` 는 세 채널 모두에서 그대로다.
- 여러 문서가 같은 필드를 나열하면 저마다 두 번째 기준이 된다. 그래서 필드 집합·봉투·`cancelled` 행동 계약은 이 문서에만 두고 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)·[채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)·[에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md) 은 여기를 가리킨다.

## 종결 이벤트 필드 집합

`execution.completed`·`execution.failed`·`execution.cancelled` 가 싣는 필드는 이 표가 전부다. 표에 없는 필드는 보내지 않는다.

| 필드 | 이벤트 | 상태 | 비고 |
|---|---|---|---|
| `status` | 세 가지 | 구현됨 | `completed` \| `failed` \| `cancelled` |
| `error` | `failed`, `cancelled`(시스템 취소만) | 구현됨 | `{ code, message, nodeId, details? }`. `code`·`nodeId` 는 `null` 일 수 있다. `failed` 는 모든 경로에서 객체다(`toTerminalErrorPayload` 로 일원화). `cancelled` 는 `{ code, message }` 를 손으로 만들어 `nodeId`·`details` 가 없다 |
| `result.cancelledBy` | `cancelled` | 구현됨 | 종결 발행 타입이 필수 필드로 강제한다. 세 이벤트의 필수 필드는 모두 타입이 강제한다 |
| `result.outputs` | `completed` | 미구현(Planned) | 발행 직전에 데이터가 있지만 payload 에 넣지 않는다 |
| `durationMs` | 세 가지 | 구현됨 | 밀리초. 알 수 없으면 `null`(형제 `error.code` 와 같은 부재 표현). 엔티티를 읽지 않는 취소 경로는 UPDATE 문 안에서 SQL 로 계산해 `RETURNING` 으로 받아 싣는다(DB 와 전송 값이 같다). `markQueueWaitTimeout` 의 값은 큐 대기 시간이다(`started_at` 이 admission 전 시각). WebSocket 문서는 같은 값을 `duration` 으로 적는다. 이름만 다르고 같은 값이다 |

`finalNodeId`·`finalPort`·`nodeCount`·`failedNodeId` 는 싣지 않는다. 엔진에 그런 개념 자체가 없다. 풍부한 종결 데이터가 필요하면 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) 의 상태 조회를 쓴다.

## `execution.cancelled` 행동 계약

- `result.cancelledBy` 는 닫힌 세 값 union 이다. `"user"` \| `"system"` \| `"timeout"`. 넓히지 않는다. 새 사유는 새 값을 만들지 않고 `error.code` 로 나눈다.
- 시스템 취소에는 `error: { code, message? }` 가 함께 온다. `cancelledBy` 만으로 가를 수 없는 사유를 `error.code` 가 나눈다.

  | `cancelledBy` | `error.code` | 사유 |
  |---|---|---|
  | `system` | `RESUME_*`(`CHECKPOINT_MISSING`·`FAILED`·`INCOMPATIBLE_STATE`) | rehydration 실패([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)) |
  | `timeout` | `EXECUTION_QUEUE_WAIT_TIMEOUT` | admission 큐 대기 5분 초과([큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md)) |
  | `timeout` | `WEBCHAT_IDLE_TIMEOUT` | 공개 위젯 입력 대기 회수([External Interaction API](CLE-EIA.md)) |

- 일반 사용자 취소에는 `error` 키가 없다. `null` 도 싣지 않는 부재다([HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 부재 표현).
- 같은 취소 전이를 여러 종결자가 각자 관측하면 저마다 `execution.cancelled` 를 낸다. 단일 발행 관문이 없다. payload 값은 모두 DB 정본을 읽어 같으므로 모순은 없고 중복만 생긴다. 수신 측은 `executionId` 와 종결 여부로 멱등하게 처리한다.
- `cancelled` 의 `error` 는 자격 증명 가리기 대상이 아니다. 시스템 취소 경로가 `{ code, message }` 를 손으로 만들고 `toTerminalErrorPayload` 를 거치지 않기 때문이다. 지금은 모두 정적 상수 문자열이라 유출 위험이 없지만 구조적 보장은 아니다.

## 이벤트별 payload

### `execution.waiting_for_input`

아래는 논리 구조 표기다. 실제 필드 이름은 이어지는 대응 목록이 기준이다.

```jsonc
// 알림 웹훅 봉투 기준. SSE 는 payload 래퍼 없이 안쪽 객체가 그대로 온다
{
  "type":        "execution.waiting_for_input",
  "executionId": "uuid",
  "triggerId":   "uuid",
  "workflowId":  "uuid",
  "seq":         42,
  "timestamp":   "ISO8601",
  "payload": {
    "node": {
      "id":              "uuid",
      "type":            "form" | "carousel" | "table" | "chart" | "template" | "ai_agent" | "information_extractor",
      "interactionType": "form" | "buttons" | "ai_conversation"
    },
    // interaction 블록은 미구현(Planned). 아래 필드는 아직 싣지 않는다
    "interaction": {
      "submitUrl":  "/api/external/executions/{id}/interact",
      "streamUrl":  "/api/external/executions/{id}/stream",
      "statusUrl":  "/api/external/executions/{id}",
      "cancelUrl":  "/api/external/executions/{id}/cancel",
      "token":      "iext_<jwt>",     // per_execution 일 때만. per_trigger 면 생략
      "expiresAt":  "ISO8601",
      "expectedCommands": ["submit_form"]
                       | ["click_button"]
                       | ["submit_message", "end_conversation"]
    },
    "context": {
      "formConfig":         { /* form 노드일 때 */ },
      "buttonConfig":       { /* 버튼 노드일 때 */ },
      "conversationConfig": { /* AI 멀티턴일 때 */ },
      "conversationThread": { /* 선택. 대화 스레드 스냅샷 */ }
    }
  }
}
```

- `interaction` 블록은 미구현이다. URL 네 개·`token`·`expiresAt`·`expectedCommands` 를 지금은 어떤 발행 경로도 싣지 않는다. 클라이언트는 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) 의 엔드포인트를 직접 구성해야 한다. URL 은 구현될 때의 형태를 상대 경로로 적었다. 절대 URL 이나 `/v1/` 버전 구간은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 위반이다.
- `expectedCommands` 는 "다음에 보낼 만한" 명령을 알려 주는 권장 힌트다. 서버가 강제하는 대기 표면별 허용 명령과 다를 수 있다. `ai_conversation`·`ai_form_render` 대기 중에는 서버가 네 명령을 모두 받지만(`render_form` 응답을 `submit_form` 으로, 낡은 `button_click` 은 다시 park, [Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md)), `expectedCommands` 는 그중 권장 명령만 나열한다. 서버 강제 매트릭스는 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 의 명령 사전 검증이 정한다(불일치는 `409 STATE_MISMATCH`).
- `formConfig`·`buttonConfig`·`conversationConfig`·`conversationThread` 의 모양은 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 의 입력 대기 이벤트와 같다. `conversationConfig.messages[].source` 가 없으면 `live` 로 보는 폴백도 그 문서가 정한다. 대화 스레드의 매핑 근거는 [대화 스레드](CLE-IX-THREAD.md) 다.
- 디버그 전용 필드(`nodeOutput.meta.turnDebug[].llmCalls` 등 원본 LLM 요청·응답)는 필드 이름 기준으로 깊이와 관계없이 빠진다. 입력 대기 `nodeOutput` 의 키 허용 목록과 값 가리기는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.

**실제 필드 이름.** 필드 이름은 채널과 관계없이 같다. 알림 웹훅도 SSE 도 아래 오른쪽 이름을 싣는다. 두 채널의 차이는 `payload` 래퍼가 있느냐뿐이다. fanout 은 이름을 바꾸지 않는다(`notification-fanout.service.ts` 가 `payload: event.payload` 로 그대로 감싼다). 위젯과 SDK 는 어느 채널에서든 오른쪽을 읽는다.

| 논리 표기 | 실제 필드 |
|---|---|
| `node.id` | 대기 노드 ID(`waitingNodeId`, 평면). `submit_message` 의 `nodeId` 로 그대로 쓴다 |
| `node.interactionType` | `interactionType`(평면) |
| `context.conversationConfig` | `nodeOutput.conversationConfig` |
| `context.buttonConfig` | `buttonConfig`(평면) |
| `context.formConfig` | `nodeOutput.formConfig`(없으면 `nodeOutput` 자체) |
| `context.conversationThread` | `conversationThread`(평면) |
| 논리 표기에 없음 | `status`: 리터럴 `"waiting_for_input"` 이 평면으로 함께 온다 |

`node.type` 에는 외부 소비용 대응이 없다. `waitingNodeType` 이 평면으로 실리기는 하지만 내부 WebSocket 의 부가 식별자(에디터 타임라인 관측용)다. 외부 클라이언트는 노드 종류 대신 `interactionType` 으로 가른다. 참조 구현 `parseWaitingForInput` 이 `waitingNodeType` 을 읽지 않는 것이 그 근거다(실제 소비처는 내부 에디터의 `use-execution-events.ts` 뿐). `waitingNodeType`·`waitingNodeLabel`·`nodeExecutionId`·`startedAt` 도 평면으로 실리지만 같은 이유로 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 이 정한다. 이 문서는 외부 클라이언트가 읽는 필드만 다룬다. 참조 구현은 `codebase/channel-web-chat/src/lib/eia-events.ts` 의 `parseWaitingForInput` 이다.

외부로 나가는 `interactionType` 은 세 값이다. 엔진 내부의 `ai_form_render` 가 알림·SSE 에서 어떻게 보이는지는 [인터랙션 타입 레지스트리](CLE-IX-TYPES.md#미결-사항) 의 미결 사항이다.

### `execution.completed`

`status` 와 `durationMs` 를 싣는다. `result.outputs` 는 아직 싣지 않는다.

```jsonc
// 알림 웹훅 봉투 기준. SSE 는 payload 래퍼 없이 안쪽 객체가 그대로 온다
{
  "type":        "execution.completed",
  "executionId": "uuid",
  "triggerId":   "uuid",
  "workflowId":  "uuid",
  "seq":         99,
  "timestamp":   "ISO8601",
  "payload": {
    "status": "completed",
    // result.outputs: Planned
    "durationMs": 4242
  }
}
```

### `execution.failed`

`status`·`error`·`durationMs` 를 싣는다.

```jsonc
{
  "type": "execution.failed", /* …completed 와 같은 바깥 봉투… */
  "payload": {
    "status": "failed",
    "error": {
      "code":    "EXECUTION_TIMEOUT" | "EXECUTION_TIME_LIMIT_EXCEEDED" | "MAX_ITERATIONS_EXCEEDED" | "CYCLE_DETECTED" | ... | null,
      "message": "사람이 읽는 메시지",
      "nodeId":  "uuid" | null,
      "details": { ... }    // 노드 종류별 상세
    },
    "durationMs": 4242
  }
}
```

- `error.code` 는 엔진 수준 에러 코드이거나 노드 수준 실패의 노드 에러 코드(예: `LLM_TIMEOUT`)다. 엔진 코드 목록은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md), 노드 코드 목록은 `codebase/backend/src/nodes/core/error-codes.ts` 에 있다. `EXECUTION_TIMEOUT` 은 Code 노드 스크립트 타임아웃, `EXECUTION_TIME_LIMIT_EXCEEDED` 는 엔진의 누적 실행 시간 한도 초과다.
- `code` 는 `null` 일 수 있다. 코드를 만드는 경로는 여럿이다(sentinel `ErrorPortFallbackError`·`ExecutionTimeLimitError`, 늘 붙는 `WORKER_HEARTBEAT_TIMEOUT`, 취소 계열 `RESUME_*`·`EXECUTION_QUEUE_WAIT_TIMEOUT`·`WEBCHAT_IDLE_TIMEOUT`). 그러나 일반 `catch` 경로에는 분류할 코드가 없어 "항상 있다" 를 약속할 수 없다. 수신 측 처리는 정해져 있다. [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 은 `error.code === null` 을 내부 실패 안내로 대신한다.
- `failed` 의 `error` 는 모든 발행 경로에서 객체다(`toTerminalErrorPayload` 로 발행 네 곳을 일원화). 다만 배포 경계에서 다시 재생되는 옛 이벤트는 문자열을 실을 수 있다. 그래서 채팅 채널 디스패처와 에디터 프런트엔드는 문자열을 받는 분기를 일부러 남긴다. 그 분기는 지울 대상이 아니다.
- `message`·`details` 는 자격 증명 패턴(`Bearer …`, 자격 증명이 든 URI 등)을 `***` 로 가린다. `code`·`nodeId` 는 원문 그대로다. JSON 형태의 `message` 는 가린 뒤 다시 직렬화하므로 공백 같은 서식이 달라질 수 있다(파싱은 된다). 범위와 남은 갭은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.

### `execution.cancelled`

바깥 봉투는 `completed` 와 같고, `payload` 에 `status`·`result.cancelledBy`·`durationMs` 를 싣는다. 시스템 취소면 `error` 가 함께 온다. `cancelledBy` 값·`error.code` 대응·사용자 취소의 `error` 부재는 [`execution.cancelled` 행동 계약](#executioncancelled-행동-계약) 이 정한다.

- `durationMs`: 취소 경로 여섯 곳 중 네 곳은 엔티티를 읽지 않는 raw UPDATE 라 JS 로 계산할 수 없다. UPDATE 문 안에서 SQL 로 계산하고 `RETURNING` 으로 받아 싣는다. DB 와 전송 값이 같다. 알 수 없으면 `null` 이다.
- 마지막 턴 재시도 처리 중 사용자가 Stop 하면, CANCELLED 분기의 `COALESCE` UPDATE 에 `RETURNING` 을 붙여 DB 가 실제로 고른 값을 다시 읽어 싣는다. `COALESCE` 가 어느 쪽을 골랐는지는 DB 만 알기 때문이다.
- 검증 범위: 이 메커니즘은 mock 단위 테스트까지 확인했다. `COALESCE` 식이 실제 Postgres 에서 어느 값을 고르는지는 아직 실 DB 로 확인하지 않았다.
- 취소 경로의 값은 실행 시간보다 대기 시간에 가깝다. `EXECUTION_QUEUE_WAIT_TIMEOUT`(admission 전부터의 큐 대기), park 취소(기한 없는 대기), 공개 위젯 입력 대기 회수(유예 기본 1시간) 셋 다 그렇다. `started_at` 이 실행 시작 시각이 아닌 생성 시각이기 때문이다. "종결까지의 경과" 라는 정의와는 맞지만, 수신 측이 실행 소요 시간으로 읽으면 오해할 수 있다.

### `execution.ai_message`

[WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 의 `execution.ai_message` payload 를 담고, 표준 봉투(`triggerId`·`workflowId`·`timestamp`·`seq`)만 더한다.

- WebSocket payload 의 `presentations?: PresentationPayload[]`(AI Agent `render_*` 표시 도구를 부른 턴에만 있음, [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md))도 그대로 전달한다. 외부 SDK 는 이 필드가 있으면 채팅 UI 에서 텍스트와 함께 인라인으로 그릴 수 있다.
- 디버그 전용 `llmCalls`(원본 LLM 요청·응답)는 fanout 지점에서 빠져 외부 수신자(SSE 포함)에게 가지 않는다. 인증된 내부 WS(에디터) 전용이다.
- 어시스턴트 텍스트는 `message` 필드로 온다(`text` 가 아니다). 그 밖에 `nodeId`·`turnCount`·`presentations?` 가 온다. 참조 구현은 `eia-events.ts` 의 `parseAiMessage` 다.
- AI 텍스트(`message`·`messages[]`·`presentations[]`)는 발행 지점에서 자격 증명 값을 가린다. 내부 WS·채팅 채널에도 같이 적용된다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)).

## 재시도와 실패 처리

| 항목 | 값 |
|---|---|
| 성공 기준 | HTTP `2xx` |
| 타임아웃 | 10초 |
| 시도 횟수 | `notification.retry.maxAttempts` 는 첫 시도를 포함한 총 시도 횟수다. 기본 5, 상한 10 이다. 0 은 1(큐 재시도 없음)로 본다. 이 값을 발송 큐(`notification-webhook`) 작업의 `attempts` 로 넘긴다. 기본값이면 큐 재시도는 네 번이다 |
| 간격 | 1초에서 시작해 4배씩 늘어난다(1s · 4s · 16s · 64s …). 간격 수는 총 시도 횟수보다 하나 적다. 설정 값 `backoff: "exponential"` 은 이 간격을 뜻한다. BullMQ 내장 `exponential`(2배씩 늘어남)과는 이름만 같다. 내장 전략으로는 4배 간격을 낼 수 없어 사용자 정의 전략을 쓴다. 워커 `settings.backoffStrategy`(`NotificationWebhookProcessor`)가 `1000·4^(attemptsMade-1)` 을 돌려준다. 작업 옵션 `backoff.type = NOTIFICATION_BACKOFF_TYPE` 이 이 전략을 가리킨다 |
| 같은 이벤트 식별 | `X-Clemvion-Delivery` UUID(다시 보내도 같다) |
| 최종 실패 | 발송 건강도 `degraded` + `notification_last_error`(500자로 자름). 트리거를 자동으로 끄지 않는다(사용자 승인 필요). 발송 건강도 배지는 트리거 상세 화면에 보인다. 실패 기록(`notificationLastError`)은 트리거 REST 응답에만 실리고 자격 증명 모양은 가린다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md#310-트리거-응답의-마지막-오류-2026-10-05)) |
| 낡은 알림 차단 | 발송 직전 실행 상태를 다시 읽어 이미 종료면 진행 중 이벤트(`waiting_for_input`·`ai_message`)를 보내지 않는다 |

발송 건강도(`notification_health`)는 `unknown`(확인 안 됨)·`healthy`(정상)·`degraded`(저하됨) 세 값이다. 발송 파이프라인(`NotificationFanout` → `NotificationDispatcher` → `notification-webhook` 큐 → `NotificationWebhookProcessor`)과 큐 설정은 [EIA 데이터와 흐름](CLE-EIA-DATA.md) 에 있다. `notification.retry` 설정의 뜻(시도 횟수와 간격)은 위 표가 정하고 다른 문서는 이 표를 가리킨다.

## 폭주 감지

트리거당 분당 60건 한도는 발송을 줄이거나 늦추는 데 쓰지 않는다. 폭주를 알리는 표시다.

- 발송에 성공(2xx)할 때마다 `OutboundNotificationRateLimiterService.consume(triggerId)` 가 트리거당 분당 발송 수를 센다(Redis 고정 윈도우 `INCR`+`EXPIRE NX`, fail-open). 키는 `eia:notif:rl:<triggerId>` 다.
- 60건을 넘으면 `healthy` 대신 `notification_health='degraded'` 와 폭주 전용 `notification_last_error`(`Outbound rate exceeded …`)를 기록한다. 초과분도 버리지 않고 계속 보낸다. 수신 엔드포인트의 부하만 알린다.
- 마지막 시도까지 실패한 발송과 폭주가 같은 `degraded` 를 쓴다. 원인은 `notification_last_error` 로 가른다.
- 카운트는 발송 성공 분기에서 올린다. 실패·재시도 경로는 발송 실패 쪽 `degraded` 가 맡으므로 폭주 카운트에서 사실상 빠진다.

## SSRF 방지

`notification.url` 을 등록할 때(`TriggersService.assertNotificationUrlSafe`)와 보내기 직전(`checkSsrfSafeUrl`)에 두 번 검증한다.

- 호스트 이름이 사설 IP(10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fe80::/10, fc00::/7)나 loopback·메타데이터 서비스 IP(169.254.169.254 등)로 풀리면 거부한다.
- DNS rebinding 방어: 등록 때 IP 와 실제 발송 때 IP 가 다르면 발송을 거부한다. 비용이 커서 선택 사항이고, `NOTIFICATION_ENFORCE_DNS_REBIND_GUARD=1` 일 때만 켠다(기본 꺼짐).
- 워크스페이스 단위 허용·차단 목록(원문 표기 `workspace_settings.notification_url_allow_pattern`)을 설정할 수 있어야 한다. [미결 사항](#미결-사항) 참조.
- URL 은 `https://` 만 받는다. 개발 환경에서 `ALLOW_HTTP_HOOKS=1` 일 때만 `http://` 를 허용한다.

## 시크릿 교체

`POST /api/triggers/:id/notification/rotate-secret` 은 알림 서명 시크릿(notification signing secret, `wsk_*`)을 새로 만든다.

- 새 시크릿 `wsk_<64hex>` 를 만들어 응답에 한 번만 평문으로 싣는다. 호출자는 이 값을 외부 검증 측에 배포한다.
- 24시간 유예 동안 옛 시크릿과 새 시크릿으로 모두 서명한다. 수신 측은 둘 다 시도한다.
- 평문을 한 번 돌려주는 특권 작업이라 누가 언제 했는지 남아야 한다. 감사 액션은 `trigger.notification_secret_rotated` 다([감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md)).
- 유예가 끝나면 매시 승격 작업이 새 시크릿을 시크릿 저장소 정식 참조로 승격한다. 저장 형태(`notification_secret_v2` 평문 컬럼)와 승격 흐름은 [EIA 데이터와 흐름](CLE-EIA-DATA.md), 저장 형태 예외의 기준은 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 가 정한다.
- 유예 중에 `rotate-secret` 을 다시 부르면 앞서 만든 새 시크릿(`notification_secret_v2`)을 이번 값으로 덮어쓴다. 24시간 유예도 그 시각부터 다시 시작한다. 덮어쓴 값은 더는 서명에 쓰지 않는다. 수신 측은 주 시크릿과 마지막으로 받은 새 시크릿만 알면 된다.
- 교체와 승격은 같은 트리거 설정 잠금(`acquireTriggerConfigLock`)을 잡는다. 승격은 잠금 안에서 읽은 `notification_secret_v2` 가 처음 고른 값과 같을 때만 그 값을 정식 참조로 옮기고 비운다. 옮기기도 이 확인 뒤에 같은 잠금 안에서 한다. 먼저 옮기면 그사이 다시 교체해 덮인 옛 값이 주 시크릿이 된다. 값이 다르면 그 사이 다시 교체한 것이라 옮기지도 비우지도 않는다. 새 값은 다시 시작한 유예가 끝난 뒤에 승격한다. 잠금 자체의 규칙은 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화) 가 정한다. 승격 조건은 이 문서가 정하고 다른 문서는 여기를 가리킨다.
- 첫 시크릿은 서버가 발급한다. 발급하는 경우는 두 가지다. 하나는 EIA 알림 웹훅 설정(`config.notification`)이 있는 트리거를 만들 때다. 다른 하나는 PATCH 로 EIA 알림 웹훅 설정을 처음 붙일 때다. 트리거 설정 잠금 안에서 다시 읽은 행에 `signing.secretRef` 가 없으면 처음 붙이는 것으로 본다. 값이 있어도 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md#규칙) 규칙 24 의 형식(`secret://` 문자열)이 아니면 없는 것으로 본다. 참조가 없어도 그 행에 옛 평문 `signing.secret` 이 있으면 처음 붙이는 것이 아니다. 서버는 발급하지 않고 그 평문을 시크릿 저장소로 옮긴다. 통째 교체로 옛 평문이 사라지면 수신 측이 쓰던 시크릿이 유예 없이 바뀌기 때문이다. 이 판정과 시크릿 저장소 쓰기(발급이나 옮기기)는 같은 잠금 안에서 한다. 서버는 `wsk_<64hex>` 를 만들어 시크릿 저장소에 넣는다. 참조는 트리거 id 로 정해진다(`secret://triggers/<triggerId>/notification-signing`). `config` 에는 시크릿 대신 참조(`signing.secretRef`)만 남는다.
- 발급한 평문은 그 요청의 응답에만 한 번 싣는다. 응답 안의 위치와 발급하지 않은 응답의 키 생략은 [트리거 관리 「API」](../CLE-TRIG/CLE-TRIG-MANAGE.md#api) 가 정한다.
- 호출자가 원시 `config` 로 평문 `signing.secret`(옛 키)를 보냈으면 그 값을 쓰고 발급하지 않는다. 그 평문을 시크릿 저장소로 옮기는 처리는 [EIA 데이터와 흐름](CLE-EIA-DATA.md) 이 정한다.
- 참조가 이미 있으면 PATCH 로 EIA 알림 웹훅 설정을 바꿔도 서버는 새로 발급하지 않는다. `signing.secretRef` 는 PATCH 뒤에도 남는다. 서버는 행의 값을 복사하지 않고 트리거 id 로 참조를 다시 만들어 싣는다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약)).

## 미결 사항

- **워크스페이스 알림 URL 허용 목록**: [SSRF 방지](#ssrf-방지) 와 요구사항 목록은 워크스페이스 단위 허용·차단 목록을 약속하고(원문 우선순위는 필수) `workspace_settings.notification_url_allow_pattern` 을 이름으로 든다. [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 의 워크스페이스 설정 키에는 이 값이 없고 `workspace_settings` 테이블도 없으며, 현재 구현도 없다(분석 단계 확인). 미구현으로 두고 설정 키 이름을 정할지, 요구사항에서 뺄지 결정 필요.
- **`ai_form_render` 가 외부에서 어떻게 보이는가**: [인터랙션 타입 레지스트리](CLE-IX-TYPES.md#미결-사항) 참조.

## 구현 위치

- `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts` (단일 싱크 구독, `FANOUT_EVENTS` 화이트리스트, 종료 시 토큰 폐기, `retry.maxAttempts` 를 큐 시도 횟수로 넘김)
- `codebase/backend/src/modules/external-interaction/notification-dispatcher.service.ts` (BullMQ 적재, `NOTIFICATION_BACKOFF_TYPE`)
- `codebase/backend/src/modules/external-interaction/notification-dispatcher.types.ts` (`NOTIFICATION_BACKOFF_TYPE`, 4배 간격 계산 `notificationBackoffDelayMs`)
- `codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts` (HTTP POST·재시도·서명·SSRF·낡은 알림 검사·발송 건강도)
- `codebase/backend/src/modules/external-interaction/notification-signature.util.ts` (서명 계산, `verifySignatureHeader`)
- `codebase/backend/src/modules/external-interaction/outbound-notification-rate-limiter.service.ts` (폭주 감지 카운터)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`create` · `update` 의 첫 시크릿 발급, `rotateNotificationSecret`, `promoteRotatedNotificationSecrets`, `assertNotificationUrlSafe`)
- `codebase/backend/src/modules/triggers/notification-signing-secret-ref.ts` (트리거 id 로 알림 서명 시크릿 참조를 만든다)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (`acquireTriggerConfigLock`, 교체와 승격이 함께 잡는 잠금)
- `codebase/backend/src/modules/triggers/notification-secret-rotator.service.ts` (매시 승격 작업)
- `codebase/backend/src/shared/utils/terminal-error-payload.ts` (`toTerminalErrorPayload`)
- `codebase/backend/src/shared/utils/terminal-duration.ts` (종결 이벤트 `durationMs`)
- `codebase/channel-web-chat/src/lib/eia-events.ts` (`parseWaitingForInput`·`parseAiMessage` 참조 구현)

## Rationale

### 알림 응답으로 인터랙션을 받지 않는다

인터랙션은 별도 인바운드 채널로 나누고 알림은 순수 통보로 한정한다. 알림의 HTTP 응답 본문으로 인터랙션 결과를 받는 방식(예: `waiting_for_input` 알림에 200 OK 와 폼 데이터를 돌려주면 그대로 폼 제출로 처리)은 채택하지 않았다.

- HTTP 응답 한 번은 양방향 대화(AI 멀티턴의 여러 턴)를 표현할 수 없다.
- "알림 한 번 = 응답 한 번" 의 비대칭 모델이 되어 모든 노드를 같은 모델로 묶기 어렵다.
- 재시도 때 같은 인터랙션 응답을 여러 번 보내는 모호함이 생긴다. 서버는 첫 응답만 의미 있게 처리해야 하지만, 클라이언트는 "성공 = 인터랙션 반영" 으로 오해할 수 있다.
- 서명 검증 직후 곧바로 비즈니스 응답을 요구하는 동기 모델은 클라이언트 구현 부담이 크다.

### 알림이 실패해도 트리거를 끄지 않는다

마지막 시도까지 실패해도 발송 건강도만 `degraded` 로 표시하고 트리거는 끄지 않는다. EIA 알림 웹훅은 트리거의 부수 기능이다. 자동으로 끄면 본체(워크플로우 실행)까지 멈추게 되어 사용자 의도와 다를 수 있다. 저하 표시와 인앱 알림, 화면의 명시적 비활성화 버튼이 알맞고, 자동 차단에는 사용자 확인이 필요하다. 다만 2026-10-09 기준 저하 신호는 발송 건강도 배지와 `notification_last_error` 뿐이다. 발송 저하를 알리는 인앱 알림 유형은 없다([알림](../CLE-OBS/CLE-OBS-NOTIFY.md#알림-유형)).

### 서명 알고리즘 표기를 인바운드와 나눈다

트리거의 인바운드 웹훅 HMAC 검증([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md))은 인증 설정 메타 `AuthConfig.config.algorithm: 'sha256' | 'sha512'` 를 쓴다. 알림 서명은 `signing.algorithm: 'hmac-sha256' | 'hmac-sha512'` 로 적는다. 인바운드는 외부 발신자(GitHub 등)의 서명 헤더 형식(`X-Hub-Signature-256: sha256=...`)과 맞아야 하고, 아웃바운드는 자체 서명 헤더(`X-Clemvion-Signature: t=...,v1=...`)의 알고리즘 식별자 뜻이 분명하도록 `hmac-` 접두사를 붙인다. 두 경로 모두 허용 알고리즘은 SHA-256·SHA-512 두 가지다.

- 둘 다 `sha256` 으로 맞추는 안: 아웃바운드 표기에서 HMAC 서명이라는 것이 드러나지 않아, 나중에 다른 서명 방식(예: Ed25519)을 더할 때 식별자가 모호해진다.
- 둘 다 `hmac-sha256` 으로 맞추는 안: 인바운드는 외부 발신자가 정한 형식(`sha256=<hex>`)과 맞아야 해서 기존 표기를 바꾸면 호환성이 깨진다.

인바운드 값의 출처는 인증 설정 메타다. 트리거 설정에는 없다. 트리거의 옛 인라인 인증 키(`authType`·`secret`·`bearerToken`·`hmacHeader`·`hmacAlgorithm`)는 `V066__trigger_config_strip_inline_auth.sql` 로 제거됐고 `triggers.service.ts` 가 저장할 때 걷어 낸다. 출처가 바뀌어도 인바운드 `sha256` 과 아웃바운드 `hmac-` 접두사를 나눈다는 결론은 같다.

### 폭주는 저하 표시로 알린다

트리거당 분당 60건을 넘어도 알림을 버리거나 늦추지 않고 보내며, 성공했을 때 초과했으면 `degraded` 로만 표시한다(결정 2026-07-07).

- 버리기·늦추기 안을 기각했다. 폭주 감지 요구사항은 초과분도 버리지 않고 그대로 보낸다고 정한다. EIA 알림 웹훅은 실행 결과의 부수 통지라 잃으면 관측성을 잃는다. 그래서 발송을 줄이거나 늦추지 않고 "폭주 감지 → 건강도 표시" 로 구현한다.
- 발송 실패와 폭주가 `degraded` 를 함께 쓴다. `flooded` 같은 새 값을 두는 안은 V059 CHECK 제약·UI·기록의 세 군데 마이그레이션을 부르는데, 두 상태 모두 "이 트리거의 알림 발송이 정상이 아니다" 라는 같은 운영 신호라 이득이 작다. 원인은 `notification_last_error` 로 가른다.
- `healthy` 복귀: 폭주가 멎어 분당 60건 이내로 발송에 성공하면 다음 성공이 `healthy` 로 되돌린다. `degraded` 는 폭주가 이어지는 동안만 유지되는 일시 신호다.

### 종결 이벤트 필드를 약속한 만큼만 둔다

- `finalNodeId`·`finalPort`·`nodeCount`·`failedNodeId` 는 엔진에 개념 자체가 없다(발행 로직 0건). 설계된 적 없는 필드를 문서만 약속하고 있었다. 되살리지 않는다.
- `error.code` 를 억지로 채우는 대체 코드는 넣지 않는다. 의미 없는 코드가 의미 있는 코드와 같은 자리에 섞이면 수신 측이 가를 수 없기 때문이다. 그래서 "코드 없음" 을 부재로 전한다. 부재 표현은 형제 필드 `nodeId` 와 같은 `null` 이다([HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 부재 표현에서 키 생략과 택일하고 근거를 남긴다).
- 필드 집합·봉투·`cancelled` 행동 계약은 이 문서 한 곳에만 둔다. 같은 필드를 여러 문서에 나열하면 저마다 두 번째 기준이 되고, 실제로 그렇게 됐다. 다른 문서는 여기를 가리키기만 한다(선례: Redis 키 목록의 포인터 원칙, [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md)).

### 첫 시크릿 발급 · 시도 횟수 · 유예 중 재교체 (2026-10-09)

승인된 스펙의 일관성 재검토에서 이 문서가 정하지 않은 동작 세 가지가 드러났다. 세 가지는 사용자 결정(2026-10-09)이다. 작업은 NERV Task `CLE-T-M6PERB` 가 맡고 코드도 같은 Task 에서 고친다. 사용자에게 제시한 선택지와 답은 그 Task 의 결정 기록에 있다.

- **첫 시크릿은 서버가 발급한다.** 이 문서의 이전 판은 생성 때 서버가 첫 시크릿을 발급하는지를 [External Interaction API](CLE-EIA.md#미결-사항) 의 미결 사항으로 미뤘다. [External Interaction API](CLE-EIA.md#트리거-등록과-웹훅-응답) 의 요구사항(승인 전 초안)은 트리거를 만들면 `wsk_*` 를 생성 응답에서 한 번 평문으로 보여 준다고 적는다. 결정할 때 코드는 트리거를 만들면서 시크릿을 발급하지 않았다. 그래서 호출자가 시크릿을 보내지 않은 트리거에는 주 시크릿이 없었다. 이런 트리거는 발송할 때마다 저하로 처리됐다. `rotate-secret` 으로 받은 새 시크릿도 승격되는 24시간 뒤에야 서명에 쓰였다. 생성 뒤 PATCH 로 EIA 알림 웹훅 설정을 처음 붙인 트리거도 같았다. 사용자는 먼저 그 요구사항대로 생성 때 서버가 발급하는 쪽을 골랐다. 이때 함께 제시한 다른 안은 그 요구사항을 지금 동작에 맞춰 고치는 것이었다. 이어서 사용자는 PATCH 로 처음 붙일 때도 발급하는 쪽을 골랐다. 이때 함께 제시한 다른 안은 «생성 때만» 과 «발급하지 않음(지금 동작을 스펙으로)» 이었다. 호출자가 원시 `config` 로 보낸 평문 `signing.secret` 은 지금처럼 그 값을 쓴다. 호출자가 보낸 평문의 처리는 바꾸지 않았다. 저장된 행에 남은 옛 평문은 PATCH 가 발급하지 않고 시크릿 저장소로 옮긴다. 통째 교체로 그 평문이 사라지면 수신 측이 쓰던 시크릿이 유예 없이 바뀌기 때문이다. PATCH 가 처음 붙이는지는 잠금 안에서 다시 읽은 행의 `signing.secretRef` 와 옛 평문으로 판정한다. 기준은 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md#규칙) 규칙 24 와 같다. `secret://` 문자열이면 있다고 본다. 형식이 틀린 옛 값을 있다고 읽으면 첫 시크릿을 발급하지 않아 발송이 계속 저하로 처리된다. 이 판정 기준, 옛 평문 옮기기, 잠금 안 발급은 사용자에게 묻지 않고 기본값으로 정해 알렸다.
- **발급한 평문은 `data.secrets.notificationSigningSecret` 에 싣는다.** 이 위치도 같은 결정에서 정했다. 성공 응답은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 응답 봉투(`{ data }`)를 따른다. [External Interaction API](CLE-EIA.md#트리거-등록-페이로드-확장) 의 생성 응답 예시에는 봉투 없이 최상위 `secrets` 블록이 있고 키 이름도 `notification.secret` 으로 다르다. 그 예시는 승인 전 초안이라 기준으로 삼지 않았다. 발급하지 않은 응답에는 `secrets` 키를 싣지 않는다. 발급한 응답에서만 생기는 일회성 값이기 때문이다. 위치와 키 생략의 기준은 [트리거 관리 「API」](../CLE-TRIG/CLE-TRIG-MANAGE.md#api) 다. 응답 모양은 그 응답을 내는 API 문서 한 곳에 둔다. 이 문서의 요구사항과 [시크릿 교체](#시크릿-교체) 는 그곳을 가리킨다. 같은 위치를 두 문서에 적으면 한쪽만 고쳐 낡기 쉽다.
- **`retry.maxAttempts` 를 발송 큐에 넘긴다.** 이 값은 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 에서 편집할 수 있는 설정이다. 결정할 때 발송은 이 값을 읽지 않고 시도 횟수를 5로 고정했다. 사용자는 설정을 반영하는 쪽을 골랐다. 함께 제시한 다른 안은 `retry` 를 입력에서 빼는 것이었다. 값의 뜻은 첫 시도를 포함한 총 시도 횟수다. BullMQ 작업 옵션 `attempts` 와 같은 뜻이다. 입력은 0 부터 10 까지 받고 0 은 1(큐 재시도 없음)로 본다. 이 뜻으로 이 문서의 미결 사항 «재시도 횟수와 간격 수» 를 정리하고 항목을 지웠다. 기본 5 면 큐 재시도는 네 번이고 간격은 1초 · 4초 · 16초 · 64초다. `backoff: "exponential"` 은 BullMQ 내장 지수 백오프(2배씩 늘어남)가 아니다. 1초에서 시작해 4배씩 늘어나는 간격이다. 이름이 같아 헷갈리기 쉬워서 [재시도와 실패 처리](#재시도와-실패-처리) 표에 뜻을 적었다. 이 뜻은 그 표 한 곳에 두고 [EIA 데이터와 흐름](CLE-EIA-DATA.md) 은 그 표를 가리킨다. 같은 필드를 여러 문서에 적으면 저마다 두 번째 기준이 된다는 [종결 이벤트 필드를 약속한 만큼만 둔다](#종결-이벤트-필드를-약속한-만큼만-둔다) 와 같은 이유다.
- **유예 중 재교체는 덮어쓴다.** 유예 중에 다시 교체하면 어떻게 되는지는 문서에 없었다. 결정할 때 교체는 잠금 없이 `notification_secret_v2` 와 `notification_rotated_at` 만 바꿨다. 사용자는 앞의 새 시크릿을 덮어쓰고 24시간 유예를 다시 시작하는 쪽을 골랐다. 함께 제시한 다른 안은 유예 중 재교체를 409 로 거부하는 것이었다. 새 시크릿을 담는 컬럼은 하나라서 덮어써도 수신 측이 함께 시도하는 시크릿은 주 시크릿과 마지막 새 시크릿 둘이다. 교체와 승격은 같은 트리거 설정 잠금을 잡는다. 결정할 때 승격은 잠금 밖에서 대상을 골랐다. 그리고 잠금 안에서 `notification_secret_v2` 가 그대로인지 보지 않고 비웠다. 그 사이 교체가 끼면 호출자가 방금 받은 새 시크릿이 승격되지 않고 지워질 수 있었다. 그래서 승격은 잠금 안에서 읽은 값이 처음 고른 값과 같을 때만 비운다. 승격 조건은 이 문서의 요구사항 한 곳에 둔다. [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 는 교체도 같은 잠금을 잡는다는 것만 적고 이 조건을 가리킨다. 같은 조건을 두 문서의 요구사항에 적으면 한쪽만 고쳐 낡기 쉽다.
