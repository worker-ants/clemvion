---
id: trigger-list
status: spec-only
code: []
---

# Spec: 트리거 목록 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#32-trigger-list-트리거-목록) · [Spec 레이아웃](./_layout.md) · [데이터 모델 - Trigger](../1-data-model.md#28-trigger)

---

## 1. 화면 구조

```
┌─────────────────────────────────────────────────────────┐
│  Triggers                                               │
│                                                         │
│  ┌──────────────────┐  ┌────────────────────────┐       │
│  │ 🔍 Search...     │  │ Type: All ▼           │       │
│  └──────────────────┘  └────────────────────────┘       │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ● order-webhook          Webhook    Active          │ │
│  │   → Order Processing     POST /hooks/order  📋  ⋮  │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ ● daily-report  [Schedule] Schedule   Active          │ │
│  │   → Daily Report Gen     0 9 * * *  Next: 09:00 ⋮  │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ ○ manual-test            Manual     Inactive        │ │
│  │   → Test Workflow                             ⋮     │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 기능 상세

### 2.1 트리거 목록 항목

| 요소 | 설명 |
|------|------|
| 상태 아이콘 | Active(●) / Inactive(○) |
| 트리거 이름 | 사용자가 지정한 트리거 이름 |
| 유형 뱃지 | Webhook / Schedule / Manual |
| 연결된 워크플로우 | "→ 워크플로우 이름" 형태로 표시. 클릭 시 해당 에디터로 이동 |
| 상세 정보 | Webhook: HTTP 메서드 + 경로, Schedule: Cron 표현식 |
| Schedule 태그 | Schedule 유형 트리거에 `[Schedule]` 태그 표시 + Cron 표현식 + 다음 실행 시각 |
| Chat Channel 칩 / Health 배지 | Webhook 트리거 중 `config.chatChannel` 가 설정된 행에만 표시. provider 칩 (`Telegram` 등 — provider 별 brand color) + `chatChannelHealth` 배지 (healthy / degraded / unknown). [WH-MG-09](../5-system/12-webhook.md) 의 "동일 영역" 은 본 §2.1 행 표시를 의미 (drawer 카드 분리와 독립). `notificationHealth` 배지와 동일 영역·동일 형식으로 나란히 배치. `degraded` 도 트리거 자동 비활성화 안 함 (CCH-SE-01) |
| URL 복사 버튼(📋) | Webhook 트리거에만 표시. 전체 URL을 클립보드에 복사 |
| 더보기(⋮) | 4 항목 드롭다운: ① 상세 보기 (drawer 오픈, 모든 역할 가시 — 메타·인증·Schedule·EIA 카드 노출. **호출 이력은 본 drawer 에 포함되지 않음** — Rationale R-7), ② 활성/비활성 토글 (`editor`+), ③ 호출 이력 (**별도 Dialog** 로 Recent Calls **만** 표시 — 메타·인증·EIA·Schedule 카드는 노출되지 않음. **각 호출 항목은 시작 시각·상태와 함께 `/workflows/:workflowId/executions/:executionId` 로 drill-down 하는 Link 로 동작** — Rationale R-13. 모든 역할 가시. Rationale R-6 참조), ④ 삭제 (`editor`+, [§4 확인 다이얼로그](#4-삭제-정책)). Schedule 타입은 추가로 "스케줄 관리에서 편집" 항목 표시 (→ `/schedules?triggerId=…` 딥링크). 트리거 "수정" 은 별도 항목이 아니라 ①의 drawer 안에서 [§2.3.1 필드 권한 매트릭스](#231-필드-권한-매트릭스) 의 카드별 edit 토글로 수행 |

### 2.2 필터

| 필터 | 옵션 |
|------|------|
| 유형 | 전체 / Webhook / Schedule / Manual |
| 상태 | 전체 / Active / Inactive |

### 2.3 트리거 상세 패널 (항목 클릭 시)

우측 슬라이드 패널로 상세 정보를 표시한다.

| 섹션 | 내용 |
|------|------|
| 기본 정보 | 이름, 유형, 상태, 연결된 워크플로우 |
| Webhook 상세 | 전체 URL, HTTP 메서드, 인증 방식, Content-Type |
| Schedule 상세 | Cron 표현식 (읽기 전용), 타임존, 다음 실행 예정 시각. "스케줄 관리에서 편집" 링크 → Schedule 화면으로 이동 |
| **Chat Channel 상세** | `config.chatChannel` 설정 트리거에만 표시. provider, 봇 username (`botIdentity.username`), Bot Token 상태 (마스킹 + 재발급 액션), `uiMapping` (formMode / visualNode / buttonLayout), `rateLimitPerMinute`, `languageHints`, health 상태 (`chatChannelHealth` + `chatChannelLastError` + `chatChannelSetupAt` + `chatChannelRotatedAt`). 별도 카드로 분리 (Webhook 상세 카드와 형제 위치, Rationale R-8). 상세 필드 권한은 §2.3.1 매트릭스 |
| 인증 설정 | 연결된 AuthConfig 정보 |

> **호출 이력은 본 drawer 에 포함되지 않는다.** §2.1 의 ⋮ 메뉴 "호출 이력" 항목이 여는 별도 Dialog 가 동일 데이터를 더 가벼운 modal 로 제공한다 (Rationale R-6 / R-7).

### 2.3.1 필드 권한 매트릭스

상세 드로어는 카드별 "편집" 토글로 read 모드 ↔ edit 모드를 전환한다. `editor` 미만 역할은 edit 토글 자체가 노출되지 않는다.

| 카드 | 필드 | 모드 | 비고 |
|------|------|------|------|
| Overview | `name` | edit | `PATCH /api/triggers/:id { name }`. 1~120 자, 워크스페이스 내 unique 강제는 백엔드 (충돌 시 409) |
| Overview | `type` | read-only | 생성 후 변경 불가. 변경하려면 삭제·재생성 |
| Overview | `isActive` | edit (토글 버튼) | §2.1 행 액션과 동등 — 동일 API. PATCH body 와 `/toggle` 양쪽 모두 허용 (Rationale R-4) |
| Overview | `workflowId` | read-only (v1) | 변경 가능하게 만들 경우 cascading 영향 (실행 이력 trigger_id 보존, 새 workflow 의 input schema 불일치 가능) 검토 필요. v1 은 잠금 (Rationale R-1) |
| Webhook Configuration | `endpointPath` | edit | `PATCH /api/triggers/:id { endpointPath }`. 변경 시 옛 URL 은 즉시 404 — 다이얼로그 경고 후 진행. `(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`) |
| Webhook Configuration | `httpMethod` | read-only | v1 은 POST 고정 |
| Webhook Configuration | `contentType` | read-only | v1 은 `application/json` 고정 |
| Webhook Configuration | URL (전체) | read-only (자동 계산) | `endpointPath` 변경 시 자동 갱신, 직접 입력 불가 |
| Schedule Configuration | `cronExpression` | read-only | 편집은 Schedule 화면에서만 ([Spec Schedule](./3-schedule.md)). 본 카드는 "스케줄 관리에서 편집" 링크만 표시 |
| Schedule Configuration | `timezone` | read-only | 위 동일 |
| Schedule Configuration | `nextRunAt` | read-only (시스템 계산) | sweep 시점에 갱신 |
| External Interaction (Notification) | `url` / `events` / `signing` / `retry` | edit | [Spec EIA §4](../5-system/14-external-interaction-api.md#4-trigger-config) 참조 — 별 plan `eia-trigger-edit-ui` 가 구현 |
| External Interaction (Interaction) | `enabled` / `tokenStrategy` | edit | 동상 |
| Auth Config | `authConfigId` | edit | [Authentication 메뉴](./6-config.md#part-a-authentication-인증-설정) 에서 발급한 AuthConfig 셀렉터로 트리거에 binding. `PATCH /api/triggers/:id { authConfigId }` (소속 검증은 backend `triggers.service`). `null` = 인증 없음. 인증 자료(secret/token/password) 의 편집·Reveal·Regenerate 는 Authentication 메뉴에서만 — 본 drawer 는 binding 만 관리. 셀렉터는 워크스페이스 AuthConfig 목록 드롭다운 + "인증 없음" + "+ 새 인증 설정 만들기" (→ `/authentication`) 로 구성 (Rationale R-14) |
| Chat Channel | `provider` | read-only (생성 후 변경 불가) | v1 은 `telegram` / `slack` / `discord` ([`providers/_overview.md §1`](../4-nodes/7-trigger/providers/_overview.md#1-supported-providers-v1) 단일 진실). 변경하려면 트리거 삭제·재생성 |
| Chat Channel | `inboundSigning` (provider-issued plaintext) | edit (입력) — 생성 시점만 | slack / discord 한정. 사용자가 외부 portal (Slack 앱 Basic Information / Discord Developer Portal General Information) 에서 발급된 값을 입력. 응답에 strip — 내부 `inboundSigningRef` 만 보관 ([Spec Chat Channel §4.1](../5-system/15-chat-channel.md#41-triggerconfigchatchannel)). telegram 은 server-issued 라 본 필드 미사용. 변경 (rotation) 은 v1 미정의 — 별 spec 대기. PATCH body 의 `config.chatChannel.inboundSigning` / `inboundSigningPlaintext` 직접 변경은 400 `VALIDATION_ERROR` (`details.field='inboundSigningPlaintext'`). 정당화 — [R-CC-10](../5-system/15-chat-channel.md#r-cc-10-bot-token-변경-single-path-rotate-api-only-2026-05-23) 의 외부 provider 등록 token 패턴과 자원 성격이 달라 single-path 가 아니라 별 결정 사안 |
| Chat Channel | `botToken` | edit (입력) + rotate 액션 (single-path) | write-only — 응답에는 `hasBotToken: boolean` 만 노출 ([Spec Chat Channel §5.4.2](../5-system/15-chat-channel.md#542-응답-dto-derived-필드--hasbottoken)). 마스킹 placeholder ("•••• \<last4\>"). 형식 검증 `^\d{6,}:[A-Za-z0-9_-]{30,}$` ([Spec Chat Channel §5.4](../5-system/15-chat-channel.md#54-bot-token-rotation-api-응답-계약)). 변경 시 **항상 `POST /api/triggers/:id/chat-channel/rotate-bot-token`** 만 사용 (24h grace). PATCH body 의 `botTokenRef` 변경은 차단 — 400 `VALIDATION_ERROR` (`details.field='botTokenRef'`). 정당화 Rationale [R-CC-10](../5-system/15-chat-channel.md#r-cc-10-bot-token-변경-single-path-rotate-api-only-2026-05-23) |
| Chat Channel | `botIdentity.username` | read-only | `setupChannel()` 의 `getMe` 캐시 결과. trigger 활성화 시점에 자동 갱신 |
| Chat Channel | `uiMapping.formMode` | edit | enum: `multi_step` (v1 은 이것만). 향후 `single_page` 추가 가능 |
| Chat Channel | `uiMapping.visualNode` | edit | enum: `text` / `photo` / `auto`, default `auto`. Carousel/Chart/Table 시각 렌더 모드. 상세 [Convention §2.3](../conventions/chat-channel-adapter.md#23-chatchannelconfig) + [Spec Chat Channel R-CC-11](../5-system/15-chat-channel.md#r-cc-11-uimappingvisualnode-enum-교체-text_onlytext--auto-신설-2026-05-23) |
| Chat Channel | `uiMapping.buttonLayout` | edit | enum: `auto` / `vertical` / `horizontal`, default `auto` |
| Chat Channel | `rateLimitPerMinute` | edit | integer override, default 60 (CCH-NF-03). 텔레그램 group rate limit 정합 |
| Chat Channel | `languageHints` | edit | `Record<string, string>` — `groupChatRefusal` / `executionStarted` / `executionCompleted` / `executionStillRunning` / `help` 등 봇 자체 안내 메시지 i18n |
| Chat Channel | `chatChannelHealth` / `chatChannelLastError` / `chatChannelSetupAt` / `chatChannelRotatedAt` | read-only (시스템 계산) | API 응답 시 camelCase. DB 컬럼은 snake_case (`chat_channel_health` 등 — [Spec 데이터 모델 §2.8](../1-data-model.md#28-trigger)). degraded 상태에서도 트리거 자동 비활성화 안 함 (CCH-SE-01 / WH-MG-09) |

내부 ref (`botTokenRef`, `inboundSigningRef`) 는 사용자에게 노출하지 않음 — `hasBotToken: boolean` 만 응답에 포함. UI 매트릭스에서도 표기 X (보안 — CCH-SE-03 의 UI 차원 적용).

권한 게이트: 각 edit 토글은 `editor` 이상에서만 노출. `viewer` 는 모든 카드가 read 모드로 보임. `admin`/`owner` 는 동작은 동일 (audit log 의 actor 식별만 다름).

### 2.4 Webhook URL 형식

```
{base_url}/hooks/{endpoint_path}
```

- `base_url`: SaaS의 경우 서비스 도메인, 셀프 호스팅의 경우 설정된 도메인
- `endpoint_path`: Trigger.endpoint_path 값

---

## 3. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/triggers | 목록 조회 (쿼리: type, status, search, page, limit, sort, order). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| GET | /api/triggers/:id | 트리거 상세 조회 |
| PATCH | /api/triggers/:id | 트리거 수정 |
| PATCH | /api/triggers/:id/toggle | 활성/비활성 토글 |
| GET | /api/triggers/:id/history | 호출 이력 조회 |
| DELETE | /api/triggers/:id | 트리거 삭제 — 자세한 권한·cascade·확인 UX 는 [§4 삭제 정책](#4-삭제-정책) |
| POST | /api/triggers/:id/chat-channel/rotate-bot-token | Chat Channel bot token rotation (24h grace). 본 endpoint 는 [Spec Chat Channel §5.4](../5-system/15-chat-channel.md#54-bot-token-rotation-api-응답-계약) 가 single-path SoT — PATCH body 의 `config.chatChannel.botTokenRef` 직접 변경은 차단됨 ([R-CC-10](../5-system/15-chat-channel.md#r-cc-10-bot-token-변경-single-path-rotate-api-only-2026-05-23)) |

> Webhook 인증 자격증명의 회전은 트리거가 아니라 AuthConfig 책임 — `POST /api/auth-configs/:id/regenerate` ([Spec 설정 §3](./6-config.md#3-api)) 로 일원화한다. 과거 v1.1 예약 행 `POST /api/triggers/:id/auth/rotate-secret` 은 신설되지 않은 채 본 PR 에서 폐기됐다 (Rationale R-14).

> `PATCH /api/triggers/:id` 본문은 다음 부분 갱신 키를 받는다 (모두 optional): `name`, `isActive`, `endpointPath`, `authConfigId` (top-level — AuthConfig binding, `null` 허용. 소속 검증은 backend `triggers.service` 가 `authConfigsService.findById(id, workspaceId)` 로 수행, 미스매치 시 400 `VALIDATION_ERROR` 또는 `AUTH_CONFIG_NOT_FOUND`), `config` (Deep merge — `config.notification` / `config.interaction` / `config.chatChannel.uiMapping` / `config.chatChannel.rateLimitPerMinute` / `config.chatChannel.languageHints` 등 서브 키 단위 부분 갱신). **인증 관련 inline 키 (`config.authType` / `hmacHeader` / `hmacSecret` / `bearerToken`) 는 제거됨** — 인증은 `authConfigId` binding 으로만 (Rationale R-14). **`config.chatChannel.botTokenRef` 는 PATCH 로 변경 불가** — single-path 정책에 따라 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 사용. 위반 시 400 `VALIDATION_ERROR` (`details.field='botTokenRef'`). **`config.chatChannel.inboundSigning` / `inboundSigningPlaintext` 도 PATCH 로 변경 불가** (slack signing secret / discord public key rotation API 는 v1 미정의 — 별 spec 대기). 위반 시 400 `VALIDATION_ERROR` (`details.field='inboundSigningPlaintext'`). 상세 [Spec Chat Channel §5.4.1](../5-system/15-chat-channel.md#541-bot-token-변경-single-path-정책).
> Schedule 타입 트리거에 대한 PATCH 는 `name`, `isActive` 만 허용한다 — `endpointPath` / `config` / `authConfigId` 변경은 400 `VALIDATION_ERROR` (`details.field='type'`, Schedule 동기화 [Spec 데이터 모델 §2.9.1](../1-data-model.md#291-trigger--schedule-동기화-규칙) 보호).
> `(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`). 길이/이름 검증 실패는 400 `VALIDATION_ERROR` ([Spec 에러 처리](../5-system/3-error-handling.md)).
> Webhook 인증 자격증명 (secret/token/password) 은 trigger 응답에 노출되지 않는다 — AuthConfig 응답에서 `***<last4>` 마스킹 ([Spec 데이터 모델 §2.17.2](../1-data-model.md#2172-마스킹노출-정책)).

> **참고**: 트리거 생성은 워크플로우 에디터에서 수행. 트리거 목록 화면에서는 관리(조회/수정/삭제)만 담당.
> **참고**: Schedule 유형 트리거는 Trigger 화면에서 직접 생성할 수 없다. Schedule 화면에서만 생성 가능하며, 생성 시 자동으로 Trigger가 등록된다. ([스케줄 관리](./3-schedule.md#3-trigger-자동-생성-규칙) 참조)

---

## 4. 삭제 정책

### 4.1 권한

| 역할 | 트리거 삭제 |
|------|------------|
| viewer | 불가 (⋮ 메뉴에 삭제 항목 미노출) |
| editor | 가능 (자신의 워크스페이스 한정) |
| admin / owner | 가능 |

API 게이트는 [Spec 인증 §3](../5-system/1-auth.md#3-rbac) 의 `trigger.delete` permission 으로 보호되며 audit log 의 `trigger.delete` action 항목으로 기록된다 ([Spec data-flow audit](../data-flow/1-audit.md)).

### 4.2 확인 다이얼로그

삭제 액션 클릭 시 모달을 띄운다. 모달은 트리거 type 에 따라 본문 텍스트가 분기된다.

| `Trigger.type` | 본문 텍스트 (i18n 키 `triggers.delete.confirm.*`) |
|---------------|--------------------------------------------------|
| `webhook` | "이 트리거를 삭제하면 `{url}` 로 들어오는 모든 호출이 즉시 404 가 됩니다." |
| `schedule` | "이 트리거를 삭제하면 연결된 스케줄도 함께 삭제됩니다 (cron `{{cron}}`). 다음 실행 예정 시각: `{{nextRunAt}}`." ([Spec 데이터 모델 §2.9.1](../1-data-model.md#291-trigger--schedule-동기화-규칙)). Rationale R-5 참조 |
| `manual` | "이 트리거에 연결된 워크플로 (`{workflowName}`) 는 보존되며, 트리거를 통한 외부 실행 진입점만 사라집니다." |

오삭제 방지: 사용자가 트리거 이름을 정확히 타이핑해야 "삭제" 버튼이 활성화된다 (본 spec 이 이 패턴을 최초 도입; 후속 spec 정비 PR 에서 [`spec/2-navigation/_layout.md`](./_layout.md) 또는 별 convention 으로 끌어올린다).

### 4.3 cascade 동작

| 연관 엔티티 | 동작 | 근거 |
|------------|------|------|
| `schedule` | trigger 가 schedule 타입이면 CASCADE 삭제 (FK CASCADE on `schedule.trigger_id`) | [data-flow/10-triggers.md §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화) + [§2.1 Postgres](../data-flow/10-triggers.md#21-postgres) |
| `execution.trigger_id` | SET NULL (실행 이력은 보존) — 트리거 삭제로 과거 실행 통계·감사 추적이 끊기지 않게 함 | [data-flow/10-triggers.md §2.1](../data-flow/10-triggers.md#21-postgres) |
| `auth_config_id` | trigger 측 FK 만 끊김 — `auth_config` row 자체는 삭제 안 됨 (다른 트리거가 공유 가능) | [Spec 인증](../5-system/1-auth.md) |
| Outbound `notification.*` 채널 | 트리거에 종속이므로 다음 발송 시도가 중단된다 — `notificationHealth` 값은 row 가 없으므로 별도 cleanup 불필요 | [Spec EIA §7.1](../5-system/14-external-interaction-api.md#71-trigger-엔티티-확장) |
| Inbound interaction 토큰 (per_trigger) | 트리거 삭제로 즉시 무효 — 별도 revoke 호출 불필요 | 동상 |

### 4.4 결과·에러

- 성공: `204 No Content` (응답 본문 없음, 표준 패턴). 클라이언트는 목록·상세 query 를 invalidate.
- 동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND` — 클라이언트는 무시 가능 (사용자에게 토스트 1회).
- Schedule 타입을 schedule 화면이 아닌 trigger 화면에서 삭제: 본 §4.3 에 따라 schedule cascade 와 함께 삭제. (Schedule 화면에서 삭제하는 경로도 동일 결과 — [data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화) 가 양방향 동기화 정의.)

---

## Rationale

### R-1. workflowId 를 v1 read-only 로 잠근 이유 (2026-05-22)

§2.3.1 매트릭스에서 `workflowId` 변경을 v1 에서 잠그는 이유:

1. 실행 이력은 `execution.trigger_id` FK 로 트리거를 가리킨다. 트리거의 workflowId 가 변하면 같은 trigger_id 의 이력이 둘 이상의 workflow 에 걸치게 되어 통계·필터링이 의미를 잃는다.
2. 새 workflow 의 Manual Trigger 노드 input schema 가 기존과 다르면 schedule.parameter_values 가 유효하지 않게 될 수 있다 ([Spec 데이터 모델 §2.9](../1-data-model.md#29-schedule)).
3. 사용자 흐름상 "트리거를 다른 워크플로에 옮기고 싶다" 는 요구는 빈도가 낮고, "이전 트리거 비활성 + 새 트리거 생성" 으로 우회 가능.

v1.1 이후 위 두 영향을 해소할 마이그레이션 계획이 마련되면 본 조항 해제. 사전 일관성 검토 세션: `review/consistency/2026/05/22/11_59_25/`.

### R-2. Webhook HMAC secret 입력 vs. rotate 분리 (2026-05-22)

§2.3.1 의 `hmacSecret` 행은 "입력 변경 (v1)" 과 "rotate 액션 (v1.1 후속)" 을 분리했다. 이유:

- EIA notification secret 은 외부 수신자가 보유한 키를 사전에 교체 동기화하기 위한 grace 기간이 필요 ([Spec EIA §7](../5-system/14-external-interaction-api.md#7-시크릿-회전--token-revoke)) — 단순 입력 교체는 grace 가 없어 즉시 단절.
- v1 은 secret 을 모르는 채로 분실·재발급 시나리오만 다룬다 (UX 가 단순). grace 패턴이 필요한 운영 환경은 v1.1 후속.
- API 도 동일 분리: `PATCH /api/triggers/:id { config.hmacSecret }` (v1) vs `POST /api/triggers/:id/auth/rotate-secret` (v1.1).

**TBD (의식적 미결정)**: v1.1 rotate 의 응답 shape (신규 secret 평문 반환 vs masked digest), grace 기간 (24h 표준 vs 가변), 경로 세그먼트 (`/auth/` vs `/webhook-auth/`) 는 본 spec PR 에서 확정하지 않는다. [`plan/in-progress/eia-secret-rotation-revoke-api.md`](../../plan/in-progress/eia-secret-rotation-revoke-api.md) 가 EIA outbound notification secret 의 rotate 응답 형식을 먼저 합의하면 본 spec 의 v1.1 행도 동일 패턴을 차용한다.

### R-3. 삭제 confirmation 텍스트를 type 별로 분기한 이유 (2026-05-22)

사용자가 "트리거 삭제" 의 부수 효과를 type 마다 다르게 인지해야 한다.

- webhook: 외부 호출자가 즉시 404 — 사용자에게 가시적인 영향.
- schedule: cascading 으로 schedule 도 사라짐 — `data-flow/10-triggers.md §1.4` 가 정의한 동작을 UX 로 노출.
- manual: workflow 자체는 살아남고 트리거 진입점만 사라짐 — 사용자 안심.

이 3 분기를 1 문구로 묶으면 schedule cascading 같은 중요한 사실이 묻히므로 분리.

### R-4. `isActive` 편집 경로를 PATCH body 와 `/toggle` 양쪽 모두 유지 (2026-05-22)

§2.3.1 의 `isActive` 행은 PATCH body 도 받고, §3 의 `PATCH /api/triggers/:id/toggle` 도 살아 있다. 둘 다 같은 결과 (단순 부울 토글) 이지만 분리 유지 이유:

- `/toggle` 은 단일 행 액션 (목록의 inline button) 용으로, 본문 없이 호출 가능 (idempotent — 매 호출마다 부정 토글이 아니라 백엔드가 현재 상태와 반대로 set) — 클라이언트가 현재 상태를 모르는 케이스에 적합.
- PATCH body `{ isActive: true|false }` 는 다른 필드와 함께 한 트랜잭션으로 갱신할 때 사용 (예: 이름·activation 동시 갱신).
- 양쪽 모두 audit log 를 emit 하며 action 동사는 호출한 endpoint 가 결정 (`/toggle` 은 `trigger.toggle`, PATCH 는 `trigger.update`).

향후 사용 통계에서 `/toggle` 호출이 의미 있게 감소하면 deprecate 검토. 현 시점에서는 단순성 우선.

### R-5. schedule 삭제 confirmation interp 변수: `{{scheduleId}}` → `{{cron}}` (2026-05-22)

§4.2 의 schedule 타입 본문 텍스트 interp 변수를 초기 draft 의 `{{scheduleId}}` 에서 `{{cron}}` 으로 변경. 이유:

- cron 표현식 (`0 9 * * *` 등) 은 사용자가 어떤 스케줄인지 즉시 식별 가능.
- scheduleId 는 내부 UUID 로 사용자에게 의미 없음.
- 양쪽 모두 동일한 schedule 행을 가리키나, confirmation UX 의 목적이 "이 작업이 무엇을 삭제하는지" 식별이므로 사람 가독성 우선.

발견 경로: Plan A 구현 후 `review/code/2026/05/22/12_36_58/` ai-review W6 (requirement-reviewer) 에서 spec ↔ 코드 불일치로 지적. 코드가 이미 `{{cron}}` 으로 구현되어 있어 spec 을 코드에 맞추는 것이 변경 최소.

### R-6. 호출 이력 진입을 별도 Dialog 로 분리 (2026-05-22)

§2.1 의 ⋮ 메뉴에서 "상세 보기" 와 "호출 이력" 이 초기 PR #265 (Plan A) 에서 둘 다 같은 drawer 를 열도록 임시 구현되어 사용자에게 동일 동작으로 보였다. 사용자 보고 후 분리 방식을 검토한 결과 **별도 Dialog** 채택:

- **상세 보기** — 메타 / Webhook 인증 / External Interaction / Schedule **카드** 가 한 화면에 보이는 풀 detail drawer (`SlideDrawer`, 우측 슬라이드). 편집·cron 확인·EIA 설정 등이 목적. Recent Calls 는 본 drawer 에 포함되지 않음 (Rationale R-7).
- **호출 이력** — Recent Calls **만** 빠르게 보고 닫는 가벼운 modal (`Dialog`, 중앙 정렬). 다른 메타·인증·EIA 정보가 시야에서 사라져 "이 트리거가 최근에 잘 호출되고 있는가" 만 빠르게 확인하는 시나리오에 부합. modal 안의 "전체 상세 보기" 버튼으로 detail drawer 로 승격 가능.

같은 drawer 의 anchor scroll 또는 focus 모드 (다른 카드 collapse) 도 검토했으나, 분리감이 약하고 사용자가 두 항목의 차이를 인지하기 어려워 거부.

발견 경로: PR #265 머지 후 사용자가 "두 항목이 동일 동작" 으로 보고. 분리 방식 옵션 3종 (별도 Dialog / Drawer focus / 항목 제거) 비교 후 시각 분리가 가장 명확한 별도 Dialog 채택. 본 정정 PR (`plan/in-progress/trigger-row-history-dialog.md`).

### R-8. Chat Channel 을 별도 카드로 분리 (2026-05-23)

§2.3 의 상세 drawer 에서 `config.chatChannel` 설정을 Webhook Configuration 카드에 흡수하지 않고 **별도 "Chat Channel" 카드로 분리**.

대안:
1. **(채택) 별도 카드**: Webhook Configuration 은 endpoint URL·auth·HTTP 메서드 등 "외부 호출 인터페이스" 가 주제. Chat Channel 은 봇 identity·UI 매핑·언어 hint·health 등 "어댑터 동작·외부 provider 연결" 이 주제로 의미 차원이 다름. 별도 카드로 분리해야 사용자가 "어디서 무엇을 편집해야 하는지" 가 명확.
2. **(기각) Webhook Configuration 카드 안에 흡수**: 카드 한 개당 필드가 18개 가까이 되어 가독성 저하. 또 chat channel 미설정 트리거에는 빈 섹션이 노출되는 문제.
3. **(기각) collapsible sub-section**: 분리감이 약함. 사용자가 "Chat Channel" 이라는 명시적 카드 제목을 봐야 mental model 형성에 도움.

내부 ref (`botTokenRef`, `inboundSigningRef`) UI 미노출 정책은 [CCH-SE-03](../5-system/15-chat-channel.md#34-신뢰성--보안) 의 UI 차원 적용 — secret store ref 는 backend 내부 식별자로 사용자에게 노출 가치 없음. UI 는 `hasBotToken: boolean` 만 받아 "등록 됨 / 안 됨" 표시.

행 표시 ([§2.1](#21-트리거-목록-항목)) 의 chip + health badge 는 WH-MG-09 의 "동일 영역" 요구를 본 §2.1 행 표시 위치로 해석. drawer 카드 분리는 그와 독립 (행 / 카드 두 위치 모두 표시).

### R-7. detail drawer 에서 Recent Calls 카드 제거 (2026-05-22)

R-6 이 호출 이력 진입을 별도 Dialog 로 분리한 직후, drawer 안에도 Recent Calls 카드가 남아 있어 동일 데이터가 두 위치에 중복 표시되었다. 사용자가 PR #266 머지 후 "drawer 의 Recent Calls 는 별도 Dialog 와 중복이라 제거 가능해 보인다" 고 보고 — 본 PR 에서 drawer 의 Recent Calls 카드를 제거한다.

근거:

- §2.1 의 ⋮ 메뉴가 이미 "상세 보기 (drawer)" 와 "호출 이력 (Dialog)" 을 별도 진입점으로 노출 — 사용자가 어느 쪽이든 명시적으로 선택 가능. drawer 가 호출 이력을 추가로 노출할 가치가 적음.
- drawer 의 `GET /api/triggers/:id/history` 호출이 사라져 drawer 오픈 시 1회 round-trip 감소.
- 본 PR 머지 후 drawer 에서 호출 이력을 보고 싶은 사용자는 drawer 를 닫고 ⋮ 메뉴 → 호출 이력 으로 진입 (1 클릭 추가). 비용은 작고, drawer 가 "편집 가능한 메타" 에 집중하는 단순성이 더 크다.

또한 본 PR 에서 drawer 의 영문 하드코딩 라벨들 (`Trigger Details`, `Overview`, `Webhook Configuration`, `Schedule Configuration`, `External Interaction`, `Cron Expression`, `Timezone`, `Next Run`, `HTTP Method`, `URL`, `Active`/`Inactive`, EIA 카드의 `Notification (Outbound)` / `Interaction (Inbound REST + SSE)` / `Events` / `Algorithm` / `Retry attempts` / `Token strategy` / `Endpoints` 등) 을 i18n dict (`triggers.detail.*`, `triggers.externalInteraction.*`) 의 t() 호출로 일괄 교체한다. 본 정정 사이클의 사용자 보고 항목.

### R-12. PR #300 정합 catch-up — `provider` 행의 "v1 telegram 만" 문구 제거 + `inboundSigning` PATCH 차단 명시 (2026-05-24)

§2.3.1 의 `Chat Channel | provider` 행 비고가 PR #300 (`feat(chat-channel): slack + discord providers (v1 supported)`) 머지 후에도 "v1 은 `telegram` 만" 으로 남아 있어 `providers/_overview.md §1` 의 supported 선언 (telegram / slack / discord) 과 spec-internal drift 가 발생했다.

본 catch-up:
- (a) `provider` 행 비고: "v1 은 `telegram` 만. 변경하려면 트리거 삭제·재생성" → "v1 은 `telegram` / `slack` / `discord` (`_overview.md §1` 단일 진실). 변경하려면 트리거 삭제·재생성"
- (b) §2.3.1 매트릭스에 `Chat Channel | inboundSigning` 행 신설 — slack / discord 의 사용자 입력 (provider-issued plaintext) 입력 흐름 명시. telegram 은 server-issued 라 본 필드 미사용. 변경 (rotation) v1 미정의.
- (c) §3 PATCH 노트에 `config.chatChannel.inboundSigning` / `inboundSigningPlaintext` 차단 명시. `botTokenRef` 차단 문구와 같은 위치.

새 결정 신설 아님 — (a) 는 PR #300 정합, (b)(c) 는 spec gap fill (slack/discord 입력 흐름과 PATCH 차단 정책 누락분 정합 보강). slack/discord `inboundSigning` 의 single-path 정책 적용 여부는 v1 단계에서는 보수적 차단 — provider-issued / server-stored 자원 성격이 [R-CC-10](../5-system/15-chat-channel.md#r-cc-10-bot-token-변경-single-path-rotate-api-only-2026-05-23) 의 외부 provider 등록 token (single-path 적용 근거) 과 다르므로 향후 rotation API 도입 시 별 결정 사안.

발견 경로: `plan/in-progress/trigger-create-multi-provider-ui.md` GUI 구현 착수 직전 `/consistency-check --impl-prep` (`review/consistency/2026/05/24/18_21_47/SUMMARY.md` C-1 / W-3) 가 BLOCK. 사용자 결정 (2026-05-24) 으로 본 구현 PR 안에 spec 정정 commit 을 함께 포함.

### R-13. 호출 이력 Dialog 항목에 실행 상세 drill-down Link 추가 (2026-05-26)

§2.1 ⋮ 메뉴 ③ "호출 이력" Dialog 의 각 항목은 R-6 채택 시점에서 시작 시각 + 상태 Badge **표시 전용** 으로 정의되었고, 실행 상세 페이지로 진입할 수단이 누락되어 사용자가 "최근 실패가 났는데 왜 실패했는지 / payload 가 무엇이었는지" 확인하려면 dialog 를 닫고 `/workflows/:workflowId/executions` 목록을 다시 찾아 들어가야 했다.

본 정정:

- 각 호출 이력 항목을 `<Link href="/workflows/:workflowId/executions/:executionId">` 로 감싼다. workflowId 는 trigger row 가 이미 알고 있으므로 Dialog 의 부모(`TriggersPage`)가 `historyTarget.workflowId` 로 동봉해 prop 전달.
- 시작 시각은 muted text → primary text 로 승격해 "어떤 항목을 클릭하는 중인지" 시각적 강조. 우측에 `ChevronRight` 아이콘으로 navigable affordance 표시.
- 항목 클릭 시 `onClose()` 호출 → 페이지 라우팅과 함께 dialog 가 자연스럽게 닫힌다.
- `workflowId` prop 이 비어 있는 회귀 케이스 (workspace 응답에서 workflow_id null 등) 에서는 row 가 read-only `<div>` 로 폴백 — Link 미생성. silent 회귀.

대안:

1. **(채택) 항목 자체를 Link 로 변환**: 시작 시각/상태 영역 전체가 클릭 타깃이라 Fitts's law 상 도달성 최대. 별도 "보기" 버튼이 추가되지 않아 modal 의 가벼움 (R-6 의 핵심 의도) 유지.
2. **(기각) "보기" 버튼을 각 row 우측에 추가**: 버튼이 row 마다 하나씩 늘어나 dialog 가 시각적으로 빽빽해짐. R-6 의 "가벼운 modal" 톤 손상.
3. **(기각) backend 가 history 응답에 link URL 을 동봉**: workflowId 는 이미 클라이언트가 알고 있어 round-trip 가치 없음. API 계약을 늘리는 비용 > 이득.
4. **(기각) 풋터의 "전체 상세 보기" 버튼으로만 진입**: 기존 버튼은 detail drawer 진입용이라 의미가 다름. 실행 단건 drill-down 은 row 단위가 자연스럽다.

발견 경로: 사용자 보고 (2026-05-26) — "/triggers 페이지 호출 이력 dialog 의 목록 항목에서 실행 상세 페이지로 갈 방법이 보이지 않는다". R-6 정의가 항목 단위 진입을 의도적으로 막은 결정은 아니었으므로 (당시 시나리오는 "최근 호출 잘 되고 있는가" 만 보는 1차 진입) drill-down 보강은 R-6 의 의도와 양립.

### R-14. authConfigId v1 격상 — inline 인증 필드 제거 (2026-05-28)

`/authentication` (AuthConfig) 자격증명을 Webhook 수신 인증에 실제로 wiring 하면서, §2.3.1 의 인증 필드 모델을 다음과 같이 바꿨다.

- **인라인 인증 4행 제거**: `authType` / `hmacHeader` / `hmacSecret` / `bearerToken` 행을 삭제하고, `Auth Config | authConfigId` 단일 행을 **v1.1 후속 → v1 활성** 으로 격상.
- **R-2 (Webhook HMAC secret 입력 vs rotate) TBD 번복**: R-2 는 "v1 은 인라인 `authType` 으로 충분, rotate 는 v1.1 후속" 으로 미뤘으나, AuthConfig wiring 이 실제 구현되면서 그 전제가 무효화됐다. 인증은 `authConfigId` binding 단일 경로로 정리하고, 인라인 `authType` enum (`none`/`hmac`/`bearer`) 3값은 AuthConfig.type 4값 (`api_key`/`bearer_token`/`basic_auth`/`hmac`) 으로 대체된다. "인증 없음" 은 `authConfigId IS NULL` 로 표현되므로 인라인 `none` 값도 제거된다.
- **R-2 의 EIA 선행 합의 조건 무효화**: R-2 의 v1.1 rotate 는 `/auth/rotate-secret` 예약 행 + `eia-secret-rotation-revoke-api.md` 합의를 조건으로 했으나, 본 PR 에서 **예약 행 자체를 폐기** (§3) 하고 inbound webhook 인증 자격증명 회전을 `POST /api/auth-configs/:id/regenerate` 로 일원화한다. inbound webhook auth 와 outbound notification HMAC 은 별개 endpoint·별개 secret 이므로, EIA notification rotation (`eia-secret-rotation-revoke-api.md`) 합의 대기는 본 결정과 독립이다.

격상 근거: AuthConfig 도메인이 발행·회전·RBAC·통계·마스킹을 이미 책임하므로, 인라인 path 와 외부 AuthConfig 두 경로가 공존하던 모호함을 단일 SoT (`authConfigId`) 로 정리하는 게 일관적. 상세 6가지 근거는 [Spec Webhook Rationale "inline auth path 폐지"](../5-system/12-webhook.md#rationale).

후속 영향: `plan/in-progress/trigger-drawer-tests.md` 의 케이스 6 ("authType 별 i18n 렌더링 hmac/bearer/none") 은 삭제되는 인라인 authType 에 의존하므로 무효화 — 해당 케이스는 AuthConfig selector 기준으로 재작성해야 한다 (구현 단계에서 처리).

사전 일관성 검토: `review/consistency/2026/05/28/13_56_08/SUMMARY.md` (BLOCK: NO, C-2/C-5 해소).
