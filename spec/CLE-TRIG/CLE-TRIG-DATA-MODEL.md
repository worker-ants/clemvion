---
id: "CLE-TRIG-DATA-MODEL"
title: "트리거 데이터와 흐름 — 엔티티"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-TRIG-DATA"
ancestors: ["CLE-VISION", "CLE-TRIG", "CLE-TRIG-DATA"]
area: "CLE-TRIG"
content_hash: "4fbcc82ac8ea2b233420d44ce97dcddd9e010316412bd88a9b1452fbd9170cd7"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "9def7b91456a44c3b78d7357241c815a86b3673c43c5d87e5e3b999f8c883d45"
etag: "sha256-049d742b1ce0d2dc8ecd649fe5fe83bb30d7c6382fff3bd921fedb4a1c972b11"
---
## 개요

이 문서는 [트리거 데이터와 흐름](CLE-TRIG-DATA.md) 의 하위 문서로 트리거 · 스케줄 · 인증 설정 엔티티의 컬럼과 제약, 인덱스, 트리거와 스케줄의 동기화 규칙을 정한다. 코드 위치는 부모 문서의 [구현 위치](CLE-TRIG-DATA.md#구현-위치) 에 모아 둔다.


## Trigger

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace (CASCADE) |
| workflow_id | UUID | FK → Workflow (CASCADE, 같은 워크스페이스). 같은 워크스페이스의 워크플로우만 가리킨다. 저장 전에 거부하고 DB 의 복합 FK 도 막는다([데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)) |
| type | Enum | `webhook` / `schedule` / `manual`. 채팅 채널은 별도 유형이 아니라 `webhook` 트리거의 `config.chatChannel` 변형이다([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md)) |
| name | String | 트리거 이름. 스케줄 유형이면 스케줄 이름도 이 값이다 |
| is_active | Boolean | 활성 상태 |
| config | JSONB | 트리거별 설정([config 서브 필드](#config-서브-필드)) |
| endpoint_path | String? | 웹훅 URL 경로(`type=webhook`). 라우팅 키가 전역이라 전역에서 유일하다(V132). 한 번 쓴 경로는 그 워크스페이스 소유로 영구 예약된다([WebhookEndpointReservation](CLE-TRIG-DATA-ENDPOINT.md#webhookendpointreservation)) |
| auth_config_id | UUID? | FK → AuthConfig (SET NULL, 같은 워크스페이스). 웹훅 인증. NULL 이면 인증 없음 |
| last_triggered_at | Timestamp? | 마지막 실행 시각 |
| notification_health | VARCHAR(16) | `unknown` / `healthy` / `degraded` 세 값만 받는다(CHECK 제약, V059). EIA 알림 웹훅 발송 건강도. 기본 `unknown`. `degraded` 가 되는 원인은 [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 의 「재시도와 실패 처리」 와 「폭주 감지」 가 정한다 |
| notification_last_error | Text? | EIA 알림 웹훅 발송 건강도가 마지막으로 `degraded` 가 된 이유(잘릴 수 있음). 발송 실패면 그 실패 사유이고 폭주면 폭주 전용 문구다. 응답에서는 자격 증명 모양을 가린다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md#310-트리거-응답의-마지막-오류-2026-10-05)) |
| notification_secret_v2 | Text? | EIA 알림 웹훅 HMAC 시크릿 교체의 24시간 유예 동안 쓰는 새 시크릿. NOT NULL 이면 발송 쪽이 주 시크릿(트리거 id 로 다시 만든 참조 `secret://triggers/<id>/notification-signing` 이 가리키는 값. 저장된 `config.notification.signing.secretRef` 는 있는지만 본다)과 이 값으로 각각 서명해 `v1=` 를 두 개 싣는다. 저장 형태는 시크릿 참조(`secret://`)가 아니라 컬럼에 담긴 평문이고 승격하면 컬럼을 `null` 로 비운다. 이 예외의 조건과 근거는 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 의 저장소 예외 필드 등재가 정한다. 교체 흐름은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) |
| notification_rotated_at | Timestamp? | 시크릿 교체 시작 시각(유예 종료 판정용) |
| chat_channel_health | VARCHAR(16) | `unknown` / `healthy` / `degraded` 세 값만 받는다(CHECK 제약, V062). 채팅 채널의 동작 상태. `degraded` 가 되는 원인은 [채팅 채널 「채널 건강도」](../CLE-CHAT/CLE-CHAT-CORE.md#채널-건강도) 가 정한다. 기본 `unknown`. 값 집합과 저장 형태는 `notification_health` 와 같다 |
| chat_channel_last_error | Text? | 채팅 채널이 마지막으로 `degraded` 가 된 이유(잘릴 수 있음). 어댑터 실패(렌더 · 발송 · 채널 설정)면 그 에러 메시지이고 그 밖의 원인은 서버가 정한 문구다. 화면은 번역하지 않고 그대로 보여 준다([다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md#규칙) 규칙 3). 새로 저장되는 값에서는 프로바이더 API 클라이언트가 자기 실패 문장의 봇 토큰을 지우고 응답에서는 자격 증명 모양을 가린다(한계까지 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md#310-트리거-응답의-마지막-오류-2026-10-05)) |
| chat_channel_setup_at | Timestamp? | `setupChannel()` 성공 시각. setup 을 하지 않았으면 NULL |
| chat_channel_token_v2 | Text? | 봇 토큰 재발급의 24시간 유예 동안 **옛** 봇 토큰을 백업한 시크릿 참조(`secret://triggers/{id}/bot-token.v2`). 토큰이 아니라 참조만 둔다. primary 로 올리는 단계는 없고 유예가 끝나면 지운다. `notification_secret_v2` 와 이름 패턴은 같지만 등급(평문 대 참조)과 뜻(새 값 대 옛 값)이 다르다. 기준은 [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) |
| chat_channel_rotated_at | Timestamp? | 봇 토큰 재발급 시작 시각(유예 종료 판정용) |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

EIA 컬럼의 동작은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md), 채팅 채널 컬럼의 동작은 [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) 이 정한다.

### config 서브 필드

| 서브 필드 | 내용 | 기준 문서 |
|-----------|------|----------|
| `notification` | EIA 알림 웹훅 설정 | [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) |
| `interaction` | 외부 인터랙션 설정 | [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) |
| `chatChannel` | 외부 채팅 플랫폼 어댑터 설정 | [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) |

- 응답 전용 파생 필드 `hasBotToken: boolean` 은 `botTokenRef IS NOT NULL` 이면 `true` 다. DB 컬럼이 아니다. 기준은 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 이다.
- 웹훅 인증 키는 `config` 에 두지 않는다. 인증은 `auth_config_id` 로만 한다([웹훅](CLE-TRIG-WEBHOOK.md)).
- `config` 를 다시 쓰는 경로는 트리거 설정 잠금(`trigger-config:<id>` advisory lock)을 잡고 다시 읽은 뒤 병합한다. 이 규칙은 [트리거 관리](CLE-TRIG-MANAGE.md) 가 정한다.

### 제약과 인덱스

- `type` CHECK 제약: `CHECK (type IN ('webhook','schedule','manual'))`(V001).
- `notification_health` CHECK 제약 `chk_trigger_notification_health`: `unknown` · `healthy` · `degraded` 만 받는다(V059).
- `chat_channel_health` CHECK 제약 `chk_trigger_chat_channel_health`: 같은 세 값만 받는다(V062).
- `endpoint_path` CHECK 제약 `chk_trigger_endpoint_path_uuid`: NULL 이거나 v4 UUID 형식이어야 한다. V102 가 `NOT VALID` 로 더했고 V103 이 기존 행을 검증했다. 요청 본문 검증을 거치지 않는 쓰기도 DB 가 막는다.
- `(workspace_id, type)` 인덱스(V002).
- `(endpoint_path)` UNIQUE, 전역, `WHERE endpoint_path IS NOT NULL`(V132). V002 의 `(workspace_id, endpoint_path)` UNIQUE 를 바꿨다. 그 전에 V131 이 기존 중복을 정리했다.
- `(workflow_id)` 인덱스(V111). 워크플로우 삭제 경로(트리거 자원 정리의 열거, FK CASCADE)용이다.
- `(auth_config_id)` 부분 인덱스(V126). 인증 설정 사용처 조회와 FK SET NULL 용이다.
- `(notification_health)` 부분 인덱스, `WHERE notification_health = 'degraded'`(V061). 발송 건강도가 `degraded` 인 트리거를 전체 스캔 없이 찾으려고 만들었다.
- `(id, workspace_id)` UNIQUE(V139, `uq_trigger_id_workspace_id`). 스케줄 `trigger_id` 복합 FK 의 참조 대상이다.
- 복합 FK `fk_trigger_workflow_id`(V141) · `fk_trigger_auth_config_id`(V142). 워크플로우와 인증 설정이 트리거와 같은 워크스페이스에 있어야 한다. `auth_config_id` 의 SET NULL 은 그 컬럼만 비운다([데이터 모델 개요 「참조의 소속」](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)).
- BEFORE DB 트리거 `trg_trigger_reserve_endpoint_path` 가 엔드포인트 경로 예약을 강제한다([WebhookEndpointReservation](CLE-TRIG-DATA-ENDPOINT.md#webhookendpointreservation)).

모든 테이블의 인덱스 목록은 [데이터 모델 개요 「인덱스 목록」](../CLE-PLAT/CLE-PLAT-DATA.md#인덱스-목록) 에도 있다. 이 문서의 테이블에 인덱스를 더하거나 지우면 두 문서를 함께 고친다.

## Schedule

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace (CASCADE) |
| trigger_id | UUID | FK → Trigger (CASCADE, 같은 워크스페이스). NOT NULL, 1:1 |
| cron_expression | String | Cron 표현식 |
| timezone | String | 시간대(IANA). 지정하지 않았을 때의 폴백은 [스케줄](CLE-TRIG-SCHEDULE.md) 이 정한다 |
| is_active | Boolean | 활성 상태. 발사 여부는 이 값으로 판정한다 |
| next_run_at | Timestamp? | 다음 실행. 화면 표시용 정보성 값이다. Cron 파싱이 실패하면 NULL 이고 발사는 BullMQ job scheduler 가 하므로 NULL 이어도 실행에 영향이 없다([다음 실행 계산](CLE-TRIG-DATA-FLOW.md#다음-실행-계산)) |
| last_run_at | Timestamp? | 마지막 실행 시각 |
| parameter_values | JSONB | 워크플로우 수동 트리거 노드 스키마에 대응하는 파라미터 값 맵. 값 문자열에 `{{ $now }}`, `{{ $schedule.* }}` 같은 제한 표현식을 쓸 수 있다. 기본값 `{}`(V011) |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

스케줄 테이블에는 이름 컬럼이 없다. 스케줄 이름은 연결된 트리거의 `name` 에 있다.

스케줄 생성 요청의 `workflowId` 는 연결 트리거의 `workflow_id` 가 된다. 그래서 Trigger 의 `workflow_id` 와 같은 제약을 받는다([참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)).

인덱스: `(workspace_id, next_run_at)`(V110). 목록 조회가 `workspace_id` 등치로 들어와 `next_run_at` 으로 정렬하는 모양에 맞춘다. 발사 뒤 UPDATE 가 쓰는 `next_run_at` 이 이 인덱스의 뒤 컬럼이다. 근거는 아래 [Rationale](#rationale) 의 "스케줄 인덱스". `(trigger_id)` 인덱스(V106)는 트리거 목록이 Cron 표현식과 다음 실행을 함께 읽는 배치 조회(`WHERE trigger_id IN (...)`)에 쓴다. `trigger_id` 의 복합 FK 는 `fk_schedule_trigger_id` 다. V145 가 `NOT VALID` 로 더했고 V147 이 검증했다.

### 트리거와 스케줄 동기화

스케줄은 트리거의 1:1 종속 서브타입이다. 두 행의 라이프사이클과 상태는 동기화된다.

| 이벤트 | 스케줄 쪽 | 트리거 쪽 |
|--------|----------|----------|
| 스케줄 생성(`POST /api/schedules`) | 트리거를 저장한 뒤 스케줄을 저장한다. 순차이고 한 트랜잭션이 아니라 중간에 실패하면 고아 트리거가 남을 수 있다. 활성이면 `registerJob` 으로 BullMQ 에 등록한다 | 먼저 만든다(`type='schedule'`, 같은 이름·워크플로우·활성 상태) |
| 스케줄 이름 변경 | 스케줄 행에는 이름이 없다 | 스케줄 수정 API 가 `trigger.name` 을 바꾼다 |
| 스케줄 활성 토글 | `schedule.is_active` 를 바꾸고 활성이면 `registerJob`, 비활성이면 `removeJob` | `trigger.is_active` 를 같은 값으로 바꾼다 |
| 트리거 활성 토글(`PATCH /api/triggers/:id { isActive }`) | `syncScheduleActivation()` 이 `schedule.is_active` 를 같은 값으로 저장하고 `registerJob`/`removeJob` 을 부른다 | 트리거 행을 먼저 바꾼다 |
| 스케줄 Cron·시간대 변경 | 스케줄을 바꾸고 `next_run_at` 을 다시 계산한 뒤 `registerJob` 으로 job scheduler 를 upsert 한다 | 없음 |
| 스케줄 삭제 | `removeJob` 으로 BullMQ 작업을 해제하고 연결된 트리거를 함께 지운다 | 행 삭제 커밋 뒤 그 트리거의 `secret_store` 비밀을 정리한다 |
| 트리거(`type='schedule'`) 직접 생성 | 없음 | 금지(API 가 거부) |
| 트리거(`type='schedule'`) 직접 삭제(`DELETE /api/triggers/:id`) | FK CASCADE 로 스케줄 행이 함께 지워진다 | 지우기 전에 `removeJob(schedule.id)` 로 BullMQ job scheduler 엔트리(`schedule:<id>`)를 해제한다(`triggers.service.ts` `remove()`). `secret_store` 비밀은 행 삭제 커밋 뒤에 지운다 |
| 워크플로우·워크스페이스 삭제(FK CASCADE) | FK CASCADE 로 트리거에 이어 스케줄 행이 지워진다 | 지우기 전에 스케줄 유형 트리거마다 `removeJob(schedule.id)` 를 부른다. 트리거 직접 삭제와 같은 해제다 |

- 제약: `Schedule.trigger_id` 는 NOT NULL 이고 트리거와 1:1 이다. 스케줄 유형 트리거에는 스케줄이 정확히 하나 있다.
- 트리거 쪽 활성 토글로 `schedule.is_active` 가 함께 바뀌므로 트리거 쪽 비활성화로도 발사가 멈춘다. 생성 두 단계 중간 실패로 스케줄 행이 없는 고아 트리거는 경고 로그를 남기고 건너뛴다.
- 스케줄 유형 트리거 PATCH 가 `name`·`isActive` 만 받는 것은 이 동기화를 지키기 위해서다([트리거 관리](CLE-TRIG-MANAGE.md)).

## AuthConfig

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace (CASCADE) |
| name | String | 인증 설정 이름 |
| type | Enum | `api_key` / `bearer_token` / `basic_auth` / `hmac` |
| config | JSONB(암호화) | 인증 설정 상세. 운영 환경에서 새로 쓰는 값은 AES-256-GCM 으로 암호화한다([통합 데이터와 흐름 「암호화」](../CLE-INT/CLE-INT-DATA.md#암호화)). 유형별 스키마는 아래 표, 필드 마스킹은 [외부 호출 인증 설정](CLE-TRIG-AUTHCFG.md) |
| ip_whitelist | String[]? | 허용 IP 목록. 각 항목은 단일 IP 또는 CIDR(예: `10.0.0.0/8`, `2001:db8::/32`; 단일 IP 는 `/32`·`/128` 호스트로 취급). 저장(create/update) 때 항목마다 형식을 검증하고 단일 IP·CIDR(IPv4·IPv6)이 아니면 400 으로 거부한다. 런타임 평가와 같은 수용 기준이다. 웹훅 수신 때 `auth_config_id` 가 연결된 트리거에만 시행한다([웹훅](CLE-TRIG-WEBHOOK.md)) |
| is_active | Boolean | 활성 상태. `false` 면 연결된 웹훅 호출은 401 `AUTH_FAILED` |
| last_used_at | Timestamp? | 마지막 사용 시각. 웹훅 인증 성공 때 fire-and-forget 으로 갱신한다 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

`auth_config.workspace_id` 에는 조회 경로 때문에 인덱스를 뒀다(V127, [데이터 모델 개요 「인덱스 목록」](../CLE-PLAT/CLE-PLAT-DATA.md#인덱스-목록)). `(id, workspace_id)` UNIQUE(V136, `uq_auth_config_id_workspace_id`)는 트리거 `auth_config_id` 복합 FK 의 참조 대상이다. `type` CHECK 제약 `auth_config_type_check` 는 네 유형만 받는다. V001 이 세 값으로 만들었고 V065 가 `hmac` 을 더했다.

### config JSONB 스키마

`config` 는 `type` 에 따라 모양이 다르다. 자동 발급하는 비밀 값은 제품이 만들고 접두사로 출처를 알린다.

| type | config 스키마 | 자동 발급 |
|------|--------------|-----------|
| `api_key` | `{ key: string, headerName?: string = "X-API-Key" }` | `key` = `wfk_<hex24>` |
| `bearer_token` | `{ token: string }` | `token` = `wft_<hex32>` |
| `basic_auth` | `{ username: string, password: string }` | 없음(사용자 입력) |
| `hmac` | `{ secret: string, header: string = "X-Hub-Signature-256", algorithm: "sha256" \| "sha512" }` | `secret` = `whs_<hex32>` |

비밀 값 접두사는 `wfk_`(API 키), `wft_`(Bearer 토큰), `whs_`(HMAC 시크릿)다. 로그와 디버깅에서 접두사로 자격 증명 종류를 알아보되 평문 자체는 가린다. 인증 설정 밖의 비밀·토큰 접두사(`wsk_` EIA 알림 웹훅 HMAC 시크릿, `iext_` 실행 단위 인터랙션 JWT, `itk_` 트리거 단위 토큰)는 [External Interaction API](../CLE-IX/CLE-EIA.md) 가 정한다.

`config` 는 통합 `credentials` 와 같은 AES-256-GCM transformer 를 쓴다. 인증 설정은 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 의 저장소 예외 필드라 시크릿 참조(`secret://`)를 쓰지 않는다. transformer 가 읽는 키는 통합 암호화 키 `INTEGRATION_ENCRYPTION_KEY` 다. 키가 없을 때의 동작과 암호화가 보장되는 범위는 [통합 데이터와 흐름 「암호화」](../CLE-INT/CLE-INT-DATA.md#암호화) 가 정한다.

## Rationale

### 스케줄을 트리거의 서브타입으로 둔 이유

웹훅·수동과 같은 "실행 시작점" 모델로 통일하려는 것이다. `execution.trigger_id` 한 컬럼으로 모든 진입 경로를 추적할 수 있고 실행 내역에서 `trigger.type` 만 보면 진입 경로를 알 수 있다. 스케줄의 Cron 메타데이터는 별도 행에 두어 스케줄 화면이 직접 다룬다.

### 역방향 동기화를 TriggersService 의 private 메서드로 둔 이유 (2026-06-10)

트리거 → 스케줄 방향의 `is_active` 동기화를 `TriggersService.update()` 안에서 할지, 별도 도메인 이벤트(`TriggerStateChangedEvent`)로 할지 중 앞의 것을 골랐다. 이벤트 방식은 발행·구독 인프라를 더하는 데 비해 소비자가 `SchedulesService` 하나뿐이라 과하다. 그리고 동기 호출이어야 PATCH 응답 시점에 BullMQ 반영이 보장된다. `syncScheduleActivation()` 을 private 메서드로 뺀 것은 `update()` 본문이 커지는 것을 막기 위해서다. 모듈 의존은 `TriggersModule → SchedulesModule` 한 방향 import(`ScheduleRunnerService` export)로 풀었다. `ExecutionEngineModule` 이 `TriggersModule` 을 참조하지 않아 순환이 없다.

### 트리거 `(workflow_id)` 인덱스 (2026-09-18)

워크플로우 삭제 한 번이 `trigger` 를 세 번 찾는다. 트리거 자원 정리의 외부 해제용 열거(트랜잭션 밖), `secret_store` 비밀을 지울 트리거 열거(`workflow` 행 잠금 안), FK `ON DELETE CASCADE` 다. 앞의 둘은 트리거 삭제 자원 정리(2026-09-17)가 더했고 그 전에는 CASCADE 한 번이었다. `workflow_id` 가 선두인 인덱스가 없어 세 번 다 전체 테이블을 훑었다. 이 셋 말고 `workflow_id` 로 트리거를 찾는 곳은 없다(grep 전수).

실측(PostgreSQL 18, V001~V110 적용, 워크스페이스당 워크플로우 5개, 워크플로우당 트리거 4개, 워밍 뒤 1회):

| 트리거 수 | 열거 `SELECT id … WHERE workflow_id = ?` | CASCADE `trigger_workflow_id_fkey`(측정 때 이름. V141 에서 복합 FK `fk_trigger_workflow_id` 로 바뀌었다) | `DELETE FROM workflow` 전체 |
|---|---|---|---|
| 20,000 | Seq Scan, 0.63 ms | 0.67 ms | 2.33 ms |
| 80,000 | Seq Scan, 2.26 ms | 2.19 ms | 3.68 ms |
| 320,000 | Parallel Seq Scan, 7.52 ms | 11.05 ms | 12.64 ms |
| 320,000 + `(workflow_id)` | Bitmap Index Scan, 0.04 ms | 0.05 ms | 1.26 ms |

테이블 크기에 비례하던 비용이 사라진다. 인덱스 크기는 320,000행에서 4.5 MB(테이블 41 MB)다. `workflow_id` 는 1차 범위에서 바뀌지 않으므로([트리거 관리](CLE-TRIG-MANAGE.md)) 쓰기 비용은 INSERT 때뿐이다. 단일 컬럼인 이유는 세 쿼리가 모두 `workflow_id` 등치 하나뿐이라 복합 인덱스가 줄 것이 없기 때문이다(아래 스케줄 인덱스 결정의 "선두는 술어 컬럼").

같은 부류 전수: `workflow`·`workspace` 를 참조하는 FK 29개를 카탈로그로 대조하면 선두 인덱스가 없는 것이 `trigger.workflow_id` 포함 7개다. 트리거만 삭제 경로의 조회가 세 배가 된 자리이고 나머지 여섯은 CASCADE 한 번뿐이라 이 결정에 넣지 않았다. 그 여섯의 처분은 [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md) 가 정한다.

### 스케줄 인덱스 `(next_run_at, is_active)` → `(workspace_id, next_run_at)` (2026-09-04)

스케줄의 옛 부분 인덱스 `(next_run_at, is_active) WHERE is_active` 는 어떤 쿼리도 쓰지 않았다. 목록 조회는 `WHERE workspace_id = ?` 로 들어오고 `is_active` 를 걸지 않아, Postgres 가 부분 인덱스를 쓰는 조건(쿼리 술어가 인덱스 술어를 함의)을 만족하지 못한다.

네 후보를 실측으로 비교했다(PostgreSQL 18.4, 200,000행, 5회 중앙값, 목록 쿼리 기준).

| 후보 | 계획 | 시간 |
|---|---|---|
| 옛 `(next_run_at, is_active) WHERE is_active` | Parallel Seq Scan | 5.99 ms |
| DROP(인덱스 없음) | Parallel Seq Scan | 5.92 ms |
| `(next_run_at)`, 부분 조건만 제거 | Index Scan Backward | 12.77 ms |
| `(workspace_id, next_run_at)` | Index Scan Backward | 0.30 ms |

- 기각한 대안, 부분 조건만 제거(`(next_run_at)`): 직관적이지만 실측이 반증했다. 정렬 컬럼이 선두라 플래너가 인덱스를 잡은 뒤 `next_run_at` 순으로 훑으며 `workspace_id` 로 거른다. 20행을 채우려고 39,797 엔트리를 버려 인덱스가 없을 때보다 2.2배 느리다. 이 쿼리의 술어는 `workspace_id` 등치이고 `next_run_at` 은 정렬일 뿐이라 선두는 `workspace_id` 여야 한다.
- 기각한 대안, `(workspace_id)` 단독: 크기는 작지만(1.02 ms) 정렬을 인덱스가 주지 못해 워크스페이스의 모든 행을 읽고 top-N 정렬을 한다. 워크스페이스당 행이 늘수록 차이가 벌어진다.
- 기각한 대안, 단순 DROP: 쓰이지 않는 것을 치우는 데서 멈추면 진짜 빈틈이 남는다. 스케줄에는 `workspace_id` 인덱스가 아예 없어 목록 조회가 매번 전체 테이블을 훑고 있었다. 부분 인덱스는 그 사실을 가리는 장식이었다.

교체 비용은 부분 인덱스에서 전체 인덱스로 바뀌며 늘어나는 2.6 MB(200,000행 기준)다. 구현은 V110 이다.

### 인증 설정 도메인 결정

- `hmac` 유형: 웹훅 HMAC 서명 검증을 트리거 인라인 `config.secret` 대신 인증 설정으로 흡수했다. 발급·키 재생성·통계·권한·필드 마스킹을 다른 인증 유형과 같은 라이프사이클로 모은다. 근거는 [웹훅](CLE-TRIG-WEBHOOK.md) 의 "인라인 인증 경로 폐지" 결정이다.
- `none` 을 넣지 않는다: 인증 설정 유형에는 `none` 이 없다. 인증 없음은 `Trigger.auth_config_id IS NULL` 로 나타내고 `type='none'` 인 인증 설정 행은 의미가 없다. 통합의 `auth_type='none'`(통합은 있지만 자격 증명이 필요 없는 공용 MCP 서버 등)과는 다른 개념이다. 인증 설정은 "행 없음 = 인증 없음", 통합은 "행 있음 + auth_type=none" 이다. 두 도메인이 같은 단어를 다른 뜻으로 쓰지 않도록 인증 설정에는 `none` 을 두지 않는다.
- Bearer 토큰 자동 발급만 허용하는 근거는 [외부 호출 인증 설정](CLE-TRIG-AUTHCFG.md) 에 있다.
- TypeScript 타입 이름을 나눈다: 인증 설정 유형(`api_key`/`bearer_token`/`basic_auth`/`hmac`)과 통합 `auth_type`(`oauth2`/`api_key`/`bearer_token`/`basic`/…)은 일부 문자열(`api_key`/`bearer_token`)이 겹치지만 별개 도메인이다. 코드에서는 `AuthConfigType` 과 `IntegrationAuthType` 유니온을 따로 정의해 섞이지 않게 한다. 특히 Basic 인증은 인증 설정이 `basic_auth`(inbound 웹훅용), 통합이 `basic`(외부 서비스 연결용)으로 일부러 다르게 쓴다. 두 도메인의 자원 성격이 다르다.
- transformer 를 함께 쓴다: 인증 설정 `config` 는 통합 `credentials` 와 같은 AES-256-GCM transformer 를 쓴다. 인증 설정은 자기 테이블 컬럼을 transformer 로 암호화하므로 시크릿 참조(`secret://`)를 쓰지 않는다([시크릿 저장소 「저장소 예외 필드」](../CLE-INT/CLE-INT-SECRET.md#저장소-예외-필드)). 암호화가 보장되는 범위는 [통합 데이터와 흐름 「암호화」](../CLE-INT/CLE-INT-DATA.md#암호화) 가 정한다. 이 transformer 의 키를 시크릿 저장소의 마스터키와 따로 두는 이유는 [시크릿 저장소 「R13. 통합 암호화 키를 마스터키와 따로 둔다」](../CLE-INT/CLE-INT-SECRET.md#r13-통합-암호화-키-integration_encryption_key-를-마스터키와-따로-두고-production-에서-키-없이-기동하지-않는다-2026-10-10) 에 있다.
- `ip_whitelist` 를 저장 때 검증한다: 잘못된 IP·CIDR 이 DB 에 들어가면 런타임 평가에서 조용히 fail-closed 불일치로만 드러나, 설정한 사람이 의도와 다른 차단을 디버깅하기 어렵다. 그래서 저장 때 형식을 검증해 400 으로 일찍 돌려준다. 검증 기준은 런타임 `AuthConfigsService.parseIp` 와 같은 `ip-address`(`Address4`/`Address6.isValid`)를 다시 쓴다. 저장 때 검증을 통과한 값은 런타임이 늘 파싱할 수 있어 저장과 평가의 수용 범위가 어긋나지 않는다. class-validator 의 `@IsIP` 는 CIDR 를 거부하므로 단일 IP 와 CIDR 를 함께 받는 커스텀 `@IsIpOrCidr` 를 쓴다.
