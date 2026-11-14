---
id: "CLE-TRIG-MANAGE-API"
title: "트리거 관리 — API 와 PATCH 계약"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-TRIG-MANAGE"
ancestors: ["CLE-VISION", "CLE-TRIG", "CLE-TRIG-MANAGE"]
area: "CLE-TRIG"
content_hash: "4597a2c17998b2ef830b8c14ecfd9f9f3c3cc18665bf6b454f658eb0651c92e0"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "262db40938b929e74503cacb8b3f75ae747f02c1b3dda85be43fbc8c49ce1c6b"
etag: "sha256-4a6fd925735e69b3f70985aa2ca132bdac44920697c5a22ce47bd3d682971a4d"
---
## 개요

이 문서는 [트리거 관리](CLE-TRIG-MANAGE.md) 의 하위 문서로 트리거 API(`/api/triggers`)의 경로 목록, `PATCH /api/triggers/:id` 본문 계약(타입 필드 · 원시 `config` · 서버가 만든 값), 응답 형태를 정한다. `config` 를 다시 쓰는 경로의 잠금 · 다시 읽기 · 병합 규칙과 생성 트랜잭션은 [트리거 관리 — 설정 쓰기와 비밀 발급](CLE-TRIG-MANAGE-WRITE.md), 삭제 정책은 [트리거 관리 — 삭제](CLE-TRIG-MANAGE-DELETE.md) 가 정한다.

## API

권한은 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) 의 트리거 행을 따른다. 목록 응답 형식은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 목록 응답 규칙을 따른다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/triggers` | 트리거 생성(편집자 이상). `webhook`·`manual` 유형만 받는다. `schedule` 은 스케줄 API 가 자동으로 만들므로 받지 않는다. 트리거 화면 "웹훅 추가" 모달이 이 경로로 웹훅 트리거를 만든다. 본문 `workflowId` 가 같은 워크스페이스의 워크플로우가 아니면 400 `VALIDATION_ERROR`(`details[].field='workflowId'`)다([데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)). 본문에 EIA 알림 웹훅 설정(`notification`, 저장 위치 `config.notification`)이 있으면 서버가 알림 서명 시크릿(`wsk_<64hex>`)을 발급해 시크릿 저장소에 넣고 `config.notification.signing` 에는 평문 대신 트리거 id 로 정해지는 시크릿 참조(`secretRef`)를 남긴다. 발급 규칙의 기준은 [EIA 알림 웹훅 「시크릿 교체」](../CLE-IX/CLE-EIA-NOTIFY.md#시크릿-교체) 다. 원시 `config` 로는 `notification` 을 보낼 수 없어서([PATCH 본문 계약](#patch-본문-계약)) 옛 평문 `signing.secret` 은 생성으로 들어오지 않는다. 본문의 인터랙션 설정(`interaction`)이 켜져 있고(`enabled: true`) 전략이 `per_trigger` 면 서버가 트리거 단위 토큰(`itk_*`)도 발급해 `config.interaction.triggerToken` 에 저장한다. 발급한 평문은 이 생성 응답의 `data.secrets` 에 한 번만 실린다(`notificationSigningSecret`, `interactionToken`). 이후 응답에는 실리지 않는다. 발급한 비밀이 없는 응답에는 `secrets` 키가 없다([응답 형태](#응답-형태)). 행 INSERT · 시크릿 저장소 쓰기 · 첫 비밀 발급은 한 트랜잭션이라 하나라도 실패하면 행이 남지 않는다. 감사 기록은 커밋 직후 트랜잭션 밖에서 남긴다([동시 쓰기 직렬화](CLE-TRIG-MANAGE-WRITE.md#동시-쓰기-직렬화)) |
| GET | `/api/triggers` | 목록. 쿼리: `type`, `status`, `search`, `page`, `limit`, `sort`, `order`, `interactionEnabled`. `interactionEnabled`(boolean, 선택)는 `config.interaction.enabled` 가 일치하는 트리거만 돌려주는 JSONB 필터로, [웹채팅 운영 콘솔](../CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) 목록이 쓴다. `sort`·`order` 는 `PaginationQueryDto` 로 받지만 `findAll` 이 무시하고 `created_at DESC` 로 고정 정렬한다(반영은 미구현) |
| GET | `/api/triggers/:id` | 상세 |
| PATCH | `/api/triggers/:id` | 수정. 활성/비활성 토글도 이 경로로 한다(`{ isActive: boolean }`). 별도 `/toggle` 경로는 없다. 이 요청으로 서버가 알림 서명 시크릿이나 트리거 단위 토큰을 처음 발급하면 평문은 이 응답의 `data.secrets` 에 한 번만 실린다(`notificationSigningSecret`, `interactionToken`, [PATCH 본문 계약](#patch-본문-계약)). 이 응답을 받지 못했으면 알림 서명 시크릿은 `rotate-secret`, 트리거 단위 토큰은 `revoke-token` 으로 새로 받는다 |
| GET | `/api/triggers/:id/history` | 호출 이력 |
| DELETE | `/api/triggers/:id` | 삭제. 권한·연쇄 삭제·확인 절차는 [트리거 관리 — 삭제](CLE-TRIG-MANAGE-DELETE.md) |
| POST | `/api/triggers/:id/chat-channel/rotate-bot-token` | 채팅 채널 봇 토큰 재발급(24시간 유예). 이 경로가 봇 토큰을 바꾸는 유일한 경로다. 응답 계약은 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md). 감사: `trigger.chat_channel_bot_token_rotated` |
| POST | `/api/triggers/:id/notification/rotate-secret` | EIA 알림 웹훅 HMAC 시크릿 교체. 응답 `{ data: { secret, rotatedAt } }`. 트리거 설정 잠금 안에서 쓴다([동시 쓰기 직렬화](CLE-TRIG-MANAGE-WRITE.md#동시-쓰기-직렬화)). 기준은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md). 감사: `trigger.notification_secret_rotated` |
| POST | `/api/triggers/:id/interaction/revoke-token` | 트리거 단위 토큰(`itk_*`) 재발급. 응답 `{ data: { token } }`. 기존 토큰을 곧바로 무효로 하고 새 토큰을 평문으로 한 번 응답한다. 옛 토큰으로 연 SSE 스트림은 서버가 닫는다. 닫는 범위는 모든 서버 인스턴스이고 닫는 방식은 [EIA 데이터와 흐름 「트리거 단위 토큰」](../CLE-IX/CLE-EIA-DATA.md#트리거-단위-토큰) 이 정한다. 엔드포인트 이름과 달리 폐기만 하지 않는다. 기준은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md). 감사: `trigger.interaction_token_revoked` |

감사 action 의 정의는 [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) 가 정한다. 생성 · PATCH 가 첫 비밀을 발급하면 새 action 없이 그 요청의 `trigger.created` · `trigger.updated` 기록 `details.issuedSecrets` 에 발급한 종류 이름을 남긴다.

서버가 새로 만든 비밀의 평문은 응답마다 놓이는 자리가 다르다. 생성 · PATCH 응답의 `data` 는 트리거 리소스다. 그래서 일회성 값을 리소스 필드와 섞지 않으려고 `data.secrets` 아래에 둔다(`data.secrets.notificationSigningSecret`, `data.secrets.interactionToken`). `rotate-secret` · `revoke-token` 응답은 그 동작만의 응답이라 평문을 `data` 에 바로 둔다(`data.secret`, `data.token`).

웹훅 인증 자격 증명의 키 재생성은 트리거가 아니라 인증 설정이 맡는다. `POST /api/auth-configs/:id/regenerate`([외부 호출 인증 설정](CLE-TRIG-AUTHCFG.md))로 한곳에서 한다.

### PATCH 본문 계약

`PATCH /api/triggers/:id` 본문은 다음 부분 갱신 키를 모두 선택으로 top-level 에서 받는다.

| 키 | 규칙 |
|----|------|
| `name` | 트리거 이름 |
| `isActive` | 활성 상태 |
| `endpointPath` | 엔드포인트 경로. v4 UUID |
| `authConfigId` | 인증 설정 연결. `null` 을 받는다. 소속 검증은 백엔드 `triggers.service` 가 `authConfigsService.findById(id, workspaceId)` 로 한다. 호출자 워크스페이스의 인증 설정이 아니면(없거나 다른 워크스페이스 소속이면 둘을 구분하지 않음) 400 `AUTH_CONFIG_NOT_FOUND`, `details: { field: 'authConfigId', code: 'INVALID_FIELD' }`. 코드 카탈로그는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) |
| `config` | 그 밖의 JSONB 키. 트리거 설정 잠금 안에서 다시 읽은 행의 `config` 위에 `config` 바로 아래 키 단위로 병합한다(아래 원시 `config` 항목). 타입 키(`notification` · `interaction` · `chatChannel`), 시크릿 참조 · 평문 필드와 서버가 만든 값, `secret://` 로 시작하는 값은 받지 않는다(아래). `config` 자체가 `null` 이면 보내지 않은 것으로 보고 저장된 `config` 를 바꾸지 않는다. 조회 응답의 `config` 에는 저장된 타입 키가 들어 있어 그대로 되보내면 400 이다. 타입 설정은 최상위 필드로 보낸다 |
| `notification` / `interaction` / `chatChannel` | EIA 알림 웹훅 · 인터랙션 · 채팅 채널 설정. `config.*` 아래가 아니라 별도 top-level 키로 받는다. 원시 `config` 아래로 보내면 400 이다(아래). 백엔드 `triggers.service`(`mergeExternalConfig`)가 `config` JSONB 안의 같은 이름 키로 합친다. 키를 보내면 그 객체를 통째로 교체한다. 부분 병합이 아니므로 사용자가 정하는 필드는 전체를 다시 보내야 한다. 서버가 만든 값(`interaction.triggerToken`, `notification.signing.secretRef`, 채팅 채널의 시크릿 참조)은 요청으로 받지 않고 서버가 정한다(아래). 기준은 `update-trigger.dto.ts` 와 `triggers.service.ts mergeExternalConfig` 다 |

- 인라인 인증 키(`config.authType` / `hmacHeader` / `hmacSecret` / `bearerToken`)는 없다. 웹훅 인증은 `authConfigId` 연결로만 받는다.
- 채팅 채널의 비밀은 PATCH 로 바꿀 수 없다. `chatChannel.botTokenRef`(ref), `chatChannel.botToken`(평문), `chatChannel.inboundSigning`, `inboundSigningPlaintext` 를 바꾸려 하면 400 `VALIDATION_ERROR` 다. 봇 토큰은 재발급 API(`POST /api/triggers/:id/chat-channel/rotate-bot-token`)로만 바꾼다. 거부 응답의 모양과 이 규칙의 기준은 [채팅 채널 §봇 토큰 변경 단일 경로](../CLE-CHAT/CLE-CHAT-CORE.md#봇-토큰-변경-단일-경로) 다. Slack signing secret·Discord public key 회전 API 는 v1 에 정의되지 않았다.
- `chatChannel` 이 실린 PATCH 는 사용자가 보낸 비밀을 받지도 쓰지도 않는다. `botToken` 과 Slack·Discord 의 `inboundSigningPlaintext` 는 요청 전후로 같다. `botTokenRef` 는 "통째로 교체" 규칙과 상관없이 사라지지 않는다(트리거 id 에서 다시 유도한다). Telegram 의 서버 발급 inbound signing 은 예외다. `setupChannel()` 을 다시 부를 때마다 새로 발급·저장되며 이것이 정상이다.
- `interaction` · `notification` 이 실린 PATCH 에서 서버가 만든 두 값은 서버가 잠금 안에서 다시 읽은 행을 보고 정한다. 알림 서명 시크릿 참조(`notification.signing.secretRef`)는 그 행에 참조가 있으면 행의 값을 복사하지 않고 `notificationSigningSecretRef(triggerId)` 로 다시 만들어 싣는다. 참조가 없을 때와 트리거 단위 토큰(`interaction.triggerToken`, `itk_*`)의 처리는 아래 항목이 정한다. top-level `interaction` · `notification` 본문에 두 값을 실으면 전역 검증 파이프(`whitelist` + `forbidNonWhitelisted`)가 400 `VALIDATION_ERROR` 로 거부한다. 목적도 방식도 위 `botTokenRef` 보존과 같다. 두 참조는 저장값 대신 트리거 id 로 다시 만든다. 시크릿을 바꾸려면 시크릿 교체(`rotate-secret`)를 쓴다.
- PATCH 가 `notification` 을 실었는데 잠금 안에서 다시 읽은 행에 `signing.secretRef` 가 없으면 서버는 그 행의 옛 평문 `signing.secret` 을 시크릿 저장소로 옮기거나 첫 알림 서명 시크릿(`wsk_<64hex>`)을 발급한다. 어느 쪽인지는 [EIA 알림 웹훅 「시크릿 교체」](../CLE-IX/CLE-EIA-NOTIFY.md#시크릿-교체) 가 정한다. EIA 알림 웹훅 설정을 처음 붙일 때가 발급하는 경우다. 판정과 시크릿 저장소 쓰기(발급이나 옮기기)는 같은 트리거 설정 잠금 안에서 한다. 평문은 그 PATCH 응답의 `data.secrets.notificationSigningSecret` 에 한 번만 실리고 발급한 비밀이 없는 응답에는 `secrets` 키가 없다. 생성 때와 같은 규칙이다. 이 응답을 받지 못했으면 `rotate-secret` 으로 새 시크릿을 받는다.
- 이미 저장된 옛 평문 `signing.secret` 은 지금처럼 읽고 시크릿 저장소로 옮긴다. 옮기기 전까지는 발송할 때 그 평문으로 서명한다. 옮기는 시점은 둘이다. `notification` 이 실린 PATCH 는 위 항목대로 잠금 안에서 옮긴다(`settle`). 그 밖의 PATCH 는 저장한 뒤 정규화(`migrateLegacyPlaintext`)에서 옮긴다. 새 평문은 받지 않는다. 옛 키 `signing.secret` 은 원시 `config` 로만 들어왔고 원시 `config` 의 `notification` 은 400 이기 때문이다. 갈래별 처리는 [EIA 알림 웹훅 「시크릿 교체」](../CLE-IX/CLE-EIA-NOTIFY.md#시크릿-교체) 와 [EIA 데이터와 흐름 「트리거 확장」](../CLE-IX/CLE-EIA-DATA.md#트리거-확장) 이 정한다.
- 최상위 필드 `interaction` 이 실린 PATCH 는 트리거 단위 토큰을 PATCH 결과의 인터랙션 설정과 잠금 안에서 다시 읽은 행으로 정한다. 트리거를 만들 때의 발급 조건은 [API](#api) 표의 POST 행에 있다.
  - 결과 전략이 `per_trigger` 이고 행에 토큰이 있으면 그 토큰을 이어받는다. 인터랙션을 끈 뒤 다시 켜도 같은 토큰이 통한다.
  - 결과 전략이 `per_trigger` 이고 인터랙션이 켜져 있는데(`enabled: true`) 행에 토큰이 없으면 새 토큰을 발급한다. 인터랙션을 `per_trigger` 로 처음 켤 때와 다른 전략에서 `per_trigger` 로 돌아올 때가 이 경우다. 평문은 그 PATCH 응답의 `data.secrets.interactionToken` 에 한 번만 실린다.
  - 결과 전략이 `per_trigger` 가 아니면 저장된 토큰을 지운다. 그래서 `per_trigger` 로 돌아와도 옛 토큰은 되살아나지 않고 새 토큰이 발급된다.
  - 결과 `interaction` 이 객체가 아니면 그 값을 그대로 저장하고 저장된 토큰도 함께 사라진다. `interaction: null` 을 보냈을 때가 이 경우다.
  - 인터랙션을 끄는 PATCH(결과 `enabled` 가 `true` 가 아님)는 토큰 값을 남긴다. 인터랙션 가드는 `interaction.enabled === true` 인 트리거에서만 토큰을 받으므로 꺼 둔 동안 그 토큰은 통하지 않는다.
  - 토큰을 지우거나 인터랙션을 끈 PATCH 는 커밋 뒤 그 토큰으로 연 SSE 스트림을 모든 서버 인스턴스에서 닫는다([EIA 데이터와 흐름 「트리거 단위 토큰」](../CLE-IX/CLE-EIA-DATA.md#트리거-단위-토큰)).
  - 발급된 토큰을 바꾸려면 트리거 단위 토큰 재발급(`revoke-token`)을 쓴다. 첫 발급 응답을 받지 못했을 때도 같다.
- 요청 본문의 `config` 키 아래(이 문서에서 «원시 `config`». top-level `chatChannel` · `notification` · `interaction` 과 다른 위치)에는 아래 세 가지를 실을 수 없다. 생성도 같다. 있으면 400 `VALIDATION_ERROR` 이고 응답은 원시 `config` 경로를 담은 단일 object 다(`details: { field: 'config.<경로>', code: 'INVALID_FIELD' }`). 세 검사는 아래 순서로 하고 처음 걸린 하나만 보고한다. 스케줄 유형 트리거는 `config` 를 받지 않으므로 그 거부(`details.field='type'`)가 셋보다 먼저 난다.
  1. 내부 필드: [채팅 채널 「봇 토큰 변경 단일 경로」](../CLE-CHAT/CLE-CHAT-CORE.md#봇-토큰-변경-단일-경로) 의 차단 필드와 `notification.signing.secretRef` · `interaction.triggerToken` 이다. 있으면 값과 상관없이(자기 트리거의 시크릿 참조나 토큰이어도) 거부한다(예: `details: { field: 'config.chatChannel.botTokenRef', code: 'INVALID_FIELD' }`). `interaction.triggerToken` 은 서버가 만드는 값이라 호출자가 정하지 못한다. 원시 `config` 에는 `setupChannel()` 과 평문 제거가 돌지 않아 평문이 JSONB 에 남는다. 시크릿 참조는 다른 트리거의 비밀을 가리킬 수 있다. 시크릿 저장소의 `resolve` 는 참조만 보고 `rotate` 는 같은 워크스페이스 안의 다른 트리거 행을 가리지 못한다. 그래서 그대로 두면 봇 토큰 재발급이 그 트리거의 비밀을 덮어쓴다([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 규칙 23). 이미 저장된 행은 읽는 쪽이 참조를 트리거 id 로 다시 만들고([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 규칙 24) `rotate` 는 다른 워크스페이스의 행을 거부한다(같은 문서 규칙 25).
  2. 타입 키: 원시 `config` 바로 아래의 `notification` · `interaction` · `chatChannel` 키다. 값과 상관없이(`null` 이나 빈 객체여도) 거부한다(예: `config.notification`). 타입 키가 둘 이상이면 `notification`, `interaction`, `chatChannel` 순서로 따져 처음 걸린 키 하나만 보고한다. 이 세 설정은 위 표의 top-level 키로만 받는다. 그래서 타입 필드가 거치는 검사와 처리(본문 검증, 등록 시점 EIA 알림 웹훅 URL 검사, 채널을 나중에 붙이기와 `provider` 바꾸기의 거부, 서버가 만든 값의 처리)를 원시 `config` 로 건너뛸 수 없다. 1 의 경로는 모두 이 세 키 아래에 있다. 1 을 먼저 검사하므로 그런 요청의 `details.field` 는 1 의 경로다.
  3. `secret://` 값: 원시 `config` 아래 어디든(중첩 객체와 배열 원소 포함) `secret://` 로 시작하는 문자열 값이다. 키 이름은 보지 않고 값만 본다(예: `config.custom.ref`). 경로는 키를 점으로 잇고 배열 원소는 `[<index>]` 로 적는다(예: `config.custom.refs[0]`). 다른 `details.field` 의 표기(예: `nodes[1].containerId`)와 같다. 이런 값이 여럿이면 키 순서대로 깊이 우선으로 훑어 처음 만난 하나만 보고한다. 거부 메시지는 고정 문구이고 받은 값을 싣지 않는다. 1 의 경로 목록은 사람이 더하는 목록이라 새 참조 슬롯을 빠뜨려도 테스트가 실패하지 않는다. 2 가 막지 못하는 다른 키 아래의 참조는 이 검사가 잡는다.
- PATCH 의 원시 `config` 는 트리거 설정 잠금 안에서 다시 읽은 행의 `config` 위에 `config` 바로 아래 키 단위로 병합한다. 보낸 키는 그 값으로 통째로 바꾸고 키 아래는 병합하지 않는다. 보내지 않은 키는 그대로 두고 값이 `null` 인 키는 지운다. 타입 키는 원시 `config` 로 받지 않으므로 저장된 `notification` · `interaction` · `chatChannel` 은 이 병합으로 바뀌지 않는다. 그 세 키는 위 표의 top-level 키로만 바뀐다. 그래서 원시 `config` 는 트리거 단위 토큰을 건드리지 않는다. 생성은 저장된 값이 없으므로 병합하지 않고 위 세 검사를 거친 원시 `config` 를 저장한다. 옛 인라인 인증 키(`authType` · `secret` · `bearerToken` · `hmacHeader` · `hmacAlgorithm`)는 생성과 PATCH 모두 저장 전에 지운다(`stripInlineAuthKeys`).
- 채팅 채널이 없는 트리거에 PATCH 로 채널을 나중에 붙이면 400(`details.field='chatChannel'`, `details.code='INVALID_FIELD'`)이다. 최초 설정은 생성 요청에서만 한다.
- 채팅 채널 `provider` 를 바꾸면 400(`details.field='provider'`, `details.code='INVALID_FIELD'`)이다. 허용하면 다른 채널 프로바이더의 토큰을 새 어댑터에 넘기게 된다.
- 스케줄 유형 트리거 PATCH 는 `name`, `isActive` 만 받는다. `endpointPath` / `config` / `authConfigId` 등을 바꾸려 하면 400 `VALIDATION_ERROR`(`details.field='type'`, `details.code='INVALID_FIELD'`)다. 트리거와 스케줄의 동기화를 지키기 위해서다([트리거 데이터와 흐름](CLE-TRIG-DATA.md)).
- 엔드포인트 경로가 전역 UNIQUE 를 어기거나 다른 워크스페이스가 예약한 경로(지웠거나 바꾼 경로)면 409 `RESOURCE_CONFLICT`(`details.code=TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)다. 길이·이름 검증 실패는 400 `VALIDATION_ERROR` 다.
- 웹훅 인증 자격 증명(secret / token / password)은 트리거 응답에 나가지 않는다. 인증 설정 응답은 필드 마스킹(`***<last4>`)을 한다([외부 호출 인증 설정](CLE-TRIG-AUTHCFG.md)).

### 응답 형태

`TriggerDto.workflow` 는 키 생략형이다([HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 부재 표현 기준 (b)). (b) 로 판정한 근거는 소비자가 부재를 정상 경로로 다룬다는 점이다. 상세 매핑은 `workflow?.name ?? workflowName ?? ""` 로 읽는다(`lib/api/triggers.ts`).

- 이 필드가 빠지는 응답은 생성 응답뿐이다. 목록·상세·수정 응답에는 채워진다(`update()` 는 `findById` 로 시작한다).
- PATCH 는 일반 경로와 `chatChannel` 이 실린 경로 모두 `workflow` 를 채운다. `chatChannel` 재조회는 `workflow` 관계를 함께 싣는다.
- e2e 가 네 반환 경로를 다섯 케이스(양성 4, 생성 음성 1)로 고정한다. PATCH 는 일반과 `chatChannel` 두 케이스다. 스케줄 쪽 자매 참조도 같은 방식으로 고정한다([스케줄](CLE-TRIG-SCHEDULE.md)).
- 이 캐너리가 고정하는 것은 계약이 아니라 현재 구현이다([Rationale](#rationale) «응답 형태 캐너리가 고정하는 것은 구현이다»).
- 이 참조는 `id` 와 `name` 을 담는다. 스케줄 응답의 자매 참조는 `name` 하나만 담는다. 이 차이는 의도한 것이다(스케줄 화면은 이름만 표시한다). 한쪽을 다른 쪽으로 바꾸지 않는다.

`secrets` 도 키 생략형이다([HTTP API 규약 §5.5](../CLE-API/CLE-API-CONV.md#55-부재-표현-null-과-키-생략) 기준 (b)). 그 응답에서만 생기는 일회성 값이기 때문이다. 서버가 첫 비밀을 발급한 생성 · PATCH 응답에만 `secrets` 가 있다. 안의 `notificationSigningSecret` · `interactionToken` 도 키 생략형이고 그 응답이 실제로 발급한 것만 실린다. 응답 DTO 는 `TriggerIssuedSecretsDto` 다. 평문이 놓이는 자리는 [API](#api) 표 아래 문단이 정한다.

## 구현 위치

- `codebase/backend/src/modules/triggers/triggers.controller.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts` (원시 `config` 의 병합 `mergeRawConfig`)
- `codebase/backend/src/modules/triggers/triggers.module.ts`
- `codebase/backend/src/modules/triggers/trigger-config-internal-fields.ts` (원시 `config` 의 검사 `assertRawConfigAccepted`. 내부 필드 경로, 타입 키, `secret://` 값을 이 순서로 거부한다)
- `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`, `codebase/backend/src/modules/triggers/dto/responses/trigger-secret-issue-response.dto.ts` (생성 · PATCH 응답과 일회성 평문 묶음 `TriggerIssuedSecretsDto`. [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 규칙 4 의 예외 응답이다)
- `codebase/backend/src/modules/triggers/dto/**`
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap*.ts` (409 계약을 AST 로 강제한다. `endpointPath` 를 쓰는 `save()` 는 래핑돼야 한다)
- `codebase/backend/src/repo-guards/__tests__/fixtures/endpoint-path-save*.ts` (위 가드가 잡아야 하는 미래핑 형태의 대조군)
- `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` (응답 형태의 다섯 케이스)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (스케줄 유형에 대한 `TriggerDto.workflow` 계약. 목록·PATCH)
- `codebase/backend/src/shared/testing/trigger-workflow-ref*.ts` (단언의 정본: 키셋 `['id','name']`·비밀 컬럼 목록)
- `codebase/backend/test/trigger-config-internal-fields.e2e-spec.ts` (원시 `config` 에 다른 트리거의 봇 토큰 참조를 심고 재발급해도 그 트리거의 비밀이 그대로인지)
- `codebase/backend/test/trigger-raw-config-contract.e2e-spec.ts` (원시 `config` 계약. 타입 키 · `secret://` 값의 거부와 검사 순서, PATCH 의 `config` 바로 아래 키 단위 병합, 외부 인터랙션 카드가 응답의 `signing` 을 되보내도 저장된 `secretRef` 와 알림 서명 시크릿이 그대로인지)

## Rationale

### 활성 상태 편집 경로를 PATCH 하나로 둔 이유

활성/비활성 전환은 `PATCH /api/triggers/:id` 에 `{ isActive: boolean }` 을 실어 하는 단일 경로다. 별도 `PATCH /api/triggers/:id/toggle` 을 두는 안은 채택하지 않았다.

- 단일 경로 우선: 같은 결과(부울 전환)에 엔드포인트를 둘 두면 권한·감사·테스트 표면이 두 배가 된다. 행 액션도 다른 필드 편집도 모두 한 경로를 쓴다.
- 현재 상태를 모르는 문제가 없다: 행 토글은 목록이 이미 그린 현재 `isActive` 를 알고 있으므로 그 반대 값을 보낸다. 본문 없는 멱등 토글이 필요할 만큼 클라이언트가 상태를 모르는 경우는 v1 화면에 없다.
- 감사: 활성 전환도 `trigger.updated` 로 남긴다. 별도 `trigger.toggle` 동사는 없다.

상세 드로어의 표현은 별개 축이다([트리거 관리 — 화면](CLE-TRIG-MANAGE-UI.md#드로어-안-활성-상태를-배지로만-둔-이유)).

### 응답 형태 캐너리가 고정하는 것은 구현이다

[응답 형태](#응답-형태)의 e2e 캐너리(`trigger-workflow-ref.e2e-spec.ts`)는 `TriggerDto.workflow` 가 생성 응답에서만 빠진다는 것을 양성 4, 음성 1 로 고정한다. 그 음성 단언이 고정하는 것은 계약이 아니라 현재 구현이다.

규약은 이 필드를 키 생략형으로 선언하라고만 요구한다(`@ApiPropertyOptional()` + `field?: T`). 어느 응답 경로에서 빠지는지는 정하지 않는다. 그래서 생성 응답도 `workflow` 를 싣게 바꾸는 것은 계약 위반이 아니라 추가 개선이다. 다만 지금은 음성 케이스가 그 변경을 RED 로 막는다. 이것은 의도한 프로세스 게이트다(응답 형태 절을 함께 고치지 않고는 동작을 바꿀 수 없다).

기각한 대안은 음성 케이스를 지우는 것이다. 음성 케이스가 없으면 "부재는 생성 응답에만 있다" 는 경계 주장 자체가 근거를 잃는다. 양성 4건은 "채워진다" 만 말하고 "어디서는 안 채워진다" 는 말하지 않는다.

`chatChannel` 이 실린 PATCH 에서 관계가 빠졌던 회귀를 막는 것은 음성 케이스가 아니라 양성 케이스(`chatChannel` 포함 PATCH)다. 두 축을 섞어 "음성 케이스가 없으면 그 회귀가 다시 샌다" 로 적지 않는다.

재검토 신호: 생성 응답을 optimistic update 로 화면에 그대로 쓰기 시작하면 `workflow.name` 이 필요해진다. 그때 맞는 판단은 "테스트가 막으니 못 한다" 가 아니라 "응답 형태 절과 이 결정을 함께 고친다" 이다. 스케줄 쪽 자매 참조도 같은 신호를 [스케줄](CLE-TRIG-SCHEDULE.md) 에 적어 두었다.

### 원시 `config` 계약 (2026-10-31)

사용자가 2026-10-31 에 아래를 정했다(세 질문 모두 권장안). 이 결정으로 미결 사항 «원시 `config` 의 계약» 을 닫았다. 원시 `config` 는 생성 · 수정 본문의 `config` 키다([PATCH 본문 계약](#patch-본문-계약)).

결정의 바탕이 된 사실은 다음과 같다.

- 앱 화면(`codebase/frontend/src/lib/api/triggers.ts`)과 웹채팅 콘솔은 원시 `config` 를 보내지 않고 top-level 키만 보낸다.
- 백엔드는 원시 `config` 에서 `notification` · `interaction` · `chatChannel` 세 키 말고는 읽지 않는다.
- 사용자 가이드의 채팅 채널 API 예시는 `"config":{"chatChannel":…}` 로 적혀 있어 top-level `chatChannel` 로 고쳤다.
- 고치기 전 구현은 `config ?? fresh.config` 였다. 원시 `config` 만 보낸 PATCH 가 저장된 `chatChannel` · `notification` · `interaction` 을 지울 수 있었고 PATCH 본문 계약 표의 «부분 갱신» 과 달랐다.
- 원시 `config` 의 세 키는 타입 필드 검사를 거치지 않아 채널을 나중에 붙이거나 `provider` 를 바꾸거나 등록 시점 EIA 알림 웹훅 URL 검사를 건너뛸 수 있었다.

결정은 다음과 같다.

- **타입 키를 원시 `config` 로 받지 않는다.** 원시 `config` 바로 아래에 `notification` · `interaction` · `chatChannel` 이 있으면 값과 상관없이 400 이다. 위 우회가 모두 닫히고 옛 평문 `notification.signing.secret` 을 새로 받는 길도 닫힌다(그 키는 원시 `config` 로만 들어왔다). 앱 화면과 웹채팅 콘솔은 이 거부에 걸리지 않는다. 기각한 대안 A: `chatChannel` · `interaction` 만 거부하고 `notification` 은 받되 top-level 과 같은 URL 검사를 더하는 안. 옛 평문 `signing.secret` 입력 경로가 남는다. 기각한 대안 B: 세 키를 받되 top-level 타입 필드와 같은 검사와 처리(본문 검증, URL 검사, 채널 붙이기와 `provider` 바꾸기의 거부, 시크릿 판정)를 거치게 하는 안. 옛 평문도 계속 받고 입력 경로가 둘로 남으며 구현이 크다.
- **[시크릿 저장소 R9](../CLE-INT/CLE-INT-SECRET.md#r9-리소스-설정의-시크릿-참조는-요청-본문으로-받지-않는다-2026-10-04) 가 미룬 안을 채택했다.** R9(2026-10-04)는 세 키를 통째로 막는 안을 원시 `config` 의 다른 계약(옛 평문 입력 등)을 함께 바꾼다는 이유로 범위에서 뺐다. 기각이 아니라 유보였고 이번에 사람이 채택했다.
- **이미 저장된 옛 평문은 계속 읽고 옮긴다.** 저장된 행에 남은 옛 평문 `signing.secret` 은 발송 때 서명에 쓰고 시크릿 저장소로 옮긴다(`notification` 이 실린 PATCH 는 잠금 안의 `settle`, 그 밖의 PATCH 는 저장 뒤 `migrateLegacyPlaintext`). 읽기나 옮기기까지 없애면 수신 측이 이미 쓰고 있는 시크릿이 유예 없이 바뀐다.
- **원시 `config` 는 `config` 바로 아래 키 단위로 병합한다.** 표의 «부분 갱신» 문구에 구현을 맞췄다. 병합의 기준은 다른 `config` 쓰기와 같이 잠금 안에서 다시 읽은 행이다. 타입 키는 늘 저장값이 남는다. 본문의 `config` 자체가 `null` 이면 보내지 않은 것으로 본다(수정 DTO 가 `null` 을 통과시키고 종전에도 200 · 무변경이었다). 조회 응답의 `config` 를 그대로 되보내는 저장소 밖 클라이언트는 이제 타입 키 때문에 400 을 받으므로 배포 안내에 적었다. 기각한 대안 A: 교체를 유지하되 세 타입 키만 저장값을 지키는 안. 원시 `config` 가 그 밖의 키 전체를 바꾸고 표의 문구를 «그 밖의 키 전체 교체» 로 고친다. 기각한 대안 B: 통째 교체를 유지하고 스펙 문구만 고치는 안(비권장). 세 키가 사라지는 동작이 계약으로 남고 `chatChannel.inboundSigningRef` 가 사라지면 인바운드 서명 검증이 fail-open 된다. 이미 저장된 행에 참조가 없는 경우는 [채팅 채널 데이터 「인바운드 서명 자료 참조가 없는 행」](../CLE-CHAT/CLE-CHAT-DATA.md#인바운드-서명-자료-참조가-없는-행) 이 다룬다.
- **`secret://` 값을 위치와 상관없이 거부한다.** 내부 필드 거부(`CONFIG_INTERNAL_FIELDS`)는 사람이 더하는 경로 목록이라 새 `*Ref` 슬롯을 목록에 넣지 않아도 테스트가 실패하지 않는다([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 규칙 22 와 R9 가 남긴 위험). 타입 키 거부로 타입 키 아래의 참조 슬롯은 모두 막히지만 다른 키 아래에 참조를 심는 길은 남는다. 값 검사는 슬롯 이름과 상관없이 잡는다. 경로 목록 거부는 그대로 두고 먼저 검사하므로 기존 거부의 `details.field` 는 바뀌지 않는다. 기각한 대안은 값 검사 없이 경로 목록만 유지하는 안이다.
- 이 결정으로 지운 요구사항과 번호 처리는 [트리거 관리](CLE-TRIG-MANAGE.md#원시-config-계약-2026-10-31) 에 적었다.
