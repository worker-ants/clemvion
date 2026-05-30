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
│  │   → Order Processing  POST /api/hooks/order 📋 ⋮  │ │
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
| 인증 (AuthConfig 연결 상태) | 연결된 AuthConfig 의 타입 뱃지 (HMAC / Bearer / API Key / Basic Auth). 데이터 출처: 목록 응답의 `authConfigId` ([§3 GET /api/triggers](#3-api)) 와 워크스페이스 AuthConfig 목록([`GET /api/auth-configs`](./6-config.md#3-api))을 사전 조회한 `id → type` 매핑. **미설정 (`authConfigId == null`)**: `webhook` 타입은 외부 HTTP 노출 + 무인증이라 보안에 취약 → 경고 아이콘(⚠) + "인증 없음" 표시 (Rationale R-15). `schedule` / `manual` 타입은 inbound HTTP 인증이 해당 없음(N/A)이므로 `-` 로 표시 (경고 비대상). 셀의 "인증" 은 §2.3 의 "인증 설정" 상세 카드(AuthConfig binding 편집)와 동일 자원을 가리키는 목록 요약 표시다 |
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
| Overview | `isActive` | read-only (배지) | drawer 안에서는 활성 상태를 배지로만 표시한다 (편집 토글 없음). 활성/비활성 전환은 [§2.1](#21-트리거-목록-항목) ⋮ 행 액션 "활성/비활성 토글" 로 수행 (Rationale R-16). API 편집 경로 자체 (PATCH body `{ isActive }` 와 `/toggle`) 는 양쪽 모두 유지 (Rationale R-4) |
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
| Chat Channel | `inboundSigning` (provider-issued plaintext) | edit (입력) — 생성 시점만 | slack / discord 한정. 사용자가 외부 portal (Slack 앱 Basic Information / Discord Developer Portal General Information) 에서 발급된 값을 입력. 응답에 strip — 내부 `inboundSigningRef` 만 보관 ([Spec Chat Channel §4.1](../5-system/15-chat-channel.md#41-triggerconfigchatchannel)). telegram 은 server-issued 라 본 필드 미사용. 변경 (rotation) 은 v1 미정의 — 별 spec 대기. PATCH body 의 `config.chatChannel.inboundSigning` / `inboundSigningPlaintext` 직접 변경은 400 `VALIDATION_ERROR` (`details.field='inboundSigningPlaintext'`). 정당화 — [R-CC-10](../5-system/15-chat-channel.md#r-cc-10-bot-token-변경-single-path-rotate-api-only) 의 외부 provider 등록 token 패턴과 자원 성격이 달라 single-path 가 아니라 별 결정 사안 |
| Chat Channel | `botToken` | edit (입력) + rotate 액션 (single-path) | write-only — 응답에는 `hasBotToken: boolean` 만 노출 ([Spec Chat Channel §5.4.2](../5-system/15-chat-channel.md#542-응답-dto-derived-필드--hasbottoken)). 마스킹 placeholder ("•••• \<last4\>"). 형식 검증 `^\d{6,}:[A-Za-z0-9_-]{30,}$` ([Spec Chat Channel §5.4](../5-system/15-chat-channel.md#54-bot-token-rotation-api-응답-계약)). 변경 시 **항상 `POST /api/triggers/:id/chat-channel/rotate-bot-token`** 만 사용 (24h grace). PATCH body 의 `botTokenRef` 변경은 차단 — 400 `VALIDATION_ERROR` (`details.field='botTokenRef'`). 정당화 Rationale [R-CC-10](../5-system/15-chat-channel.md#r-cc-10-bot-token-변경-single-path-rotate-api-only) |
| Chat Channel | `botIdentity.username` | read-only | `setupChannel()` 의 `getMe` 캐시 결과. trigger 활성화 시점에 자동 갱신 |
| Chat Channel | `uiMapping.formMode` | edit | enum: `multi_step` (v1 은 이것만). 향후 `single_page` 추가 가능 |
| Chat Channel | `uiMapping.visualNode` | edit | enum: `text` / `photo` / `auto`, default `auto`. Carousel/Chart/Table 시각 렌더 모드. 상세 [Convention §2.3](../conventions/chat-channel-adapter.md#23-chatchannelconfig) + [Spec Chat Channel R-CC-11](../5-system/15-chat-channel.md#r-cc-11-uimappingvisualnode-enum-교체-text_onlytext--auto-신설) |
| Chat Channel | `uiMapping.buttonLayout` | edit | enum: `auto` / `vertical` / `horizontal`, default `auto` |
| Chat Channel | `rateLimitPerMinute` | edit | integer override, default 60 (CCH-NF-03). 텔레그램 group rate limit 정합 |
| Chat Channel | `languageHints` | edit | `Record<string, string>` — `groupChatRefusal` / `executionStarted` / `executionCompleted` / `executionStillRunning` / `help` 등 봇 자체 안내 메시지 i18n |
| Chat Channel | `chatChannelHealth` / `chatChannelLastError` / `chatChannelSetupAt` / `chatChannelRotatedAt` | read-only (시스템 계산) | API 응답 시 camelCase. DB 컬럼은 snake_case (`chat_channel_health` 등 — [Spec 데이터 모델 §2.8](../1-data-model.md#28-trigger)). degraded 상태에서도 트리거 자동 비활성화 안 함 (CCH-SE-01 / WH-MG-09) |

내부 ref (`botTokenRef`, `inboundSigningRef`) 는 사용자에게 노출하지 않음 — `hasBotToken: boolean` 만 응답에 포함. UI 매트릭스에서도 표기 X (보안 — CCH-SE-03 의 UI 차원 적용).

권한 게이트: 각 edit 토글은 `editor` 이상에서만 노출. `viewer` 는 모든 카드가 read 모드로 보임. `admin`/`owner` 는 동작은 동일 (audit log 의 actor 식별만 다름).

### 2.4 Webhook URL 형식

```
{base_url}/api/hooks/{endpoint_path}
```

- `base_url`: SaaS의 경우 서비스 도메인, 셀프 호스팅의 경우 설정된 도메인. 프론트엔드는 `NEXT_PUBLIC_WEBHOOK_BASE_URL`(명시 override) → `NEXT_PUBLIC_API_URL`에서 후행 `/api` 제거 → `window.location.origin` 순으로 base 를 결정한다 (webhook 엔드포인트는 백엔드가 서빙하므로 base 는 백엔드 origin). 구현: `codebase/frontend/src/lib/utils/webhook-url.ts`. 정본 형식은 [Spec Webhook WH-EP-02](../5-system/12-webhook.md#31-webhook-엔드포인트).
- `endpoint_path`: Trigger.endpoint_path 값

---

## 3. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/triggers | 목록 조회 (쿼리: type, status, search, page, limit, sort, order). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| GET | /api/triggers/:id | 트리거 상세 조회 |
| PATCH | /api/triggers/:id | 트리거 수정 (활성/비활성 토글 포함 — body `{ isActive: boolean }`). 별도 `/toggle` 서브경로는 없다 |
| GET | /api/triggers/:id/history | 호출 이력 조회 |
| DELETE | /api/triggers/:id | 트리거 삭제 — 자세한 권한·cascade·확인 UX 는 [§4 삭제 정책](#4-삭제-정책) |
| POST | /api/triggers/:id/chat-channel/rotate-bot-token | Chat Channel bot token rotation (24h grace). 본 endpoint 는 [Spec Chat Channel §5.4](../5-system/15-chat-channel.md#54-bot-token-rotation-api-응답-계약) 가 single-path SoT — PATCH body 의 `config.chatChannel.botTokenRef` 직접 변경은 차단됨 ([R-CC-10](../5-system/15-chat-channel.md#r-cc-10-bot-token-변경-single-path-rotate-api-only)) |

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

### R-1. workflowId 를 v1 read-only 로 잠근 이유

§2.3.1 매트릭스에서 `workflowId` 변경을 v1 에서 잠그는 이유:

1. 실행 이력은 `execution.trigger_id` FK 로 트리거를 가리킨다. 트리거의 workflowId 가 변하면 같은 trigger_id 의 이력이 둘 이상의 workflow 에 걸치게 되어 통계·필터링이 의미를 잃는다.
2. 새 workflow 의 Manual Trigger 노드 input schema 가 기존과 다르면 schedule.parameter_values 가 유효하지 않게 될 수 있다 ([Spec 데이터 모델 §2.9](../1-data-model.md#29-schedule)).
3. 사용자 흐름상 "트리거를 다른 워크플로에 옮기고 싶다" 는 요구는 빈도가 낮고, "이전 트리거 비활성 + 새 트리거 생성" 으로 우회 가능.

v1.1 이후 위 영향을 해소할 마이그레이션 계획이 마련되면 본 조항 해제.

### R-2. Webhook HMAC secret 입력 vs. rotate 분리

§2.3.1 의 `hmacSecret` 행은 "입력 변경 (v1)" 과 "rotate 액션 (v1.1 후속)" 을 분리했다. 이유:

- EIA notification secret 은 외부 수신자가 보유한 키를 사전에 교체 동기화하기 위한 grace 기간이 필요 ([Spec EIA §7](../5-system/14-external-interaction-api.md#7-시크릿-회전--token-revoke)) — 단순 입력 교체는 grace 가 없어 즉시 단절.
- v1 은 secret 을 모르는 채로 분실·재발급 시나리오만 다룬다 (UX 가 단순). grace 패턴이 필요한 운영 환경은 v1.1 후속.
- API 도 동일 분리: `PATCH /api/triggers/:id { config.hmacSecret }` (v1) vs `POST /api/triggers/:id/auth/rotate-secret` (v1.1).

**TBD (미결정)**: v1.1 rotate 의 응답 shape (신규 secret 평문 반환 vs masked digest), grace 기간 (24h 표준 vs 가변), 경로 세그먼트 (`/auth/` vs `/webhook-auth/`) 는 아직 확정하지 않는다. EIA outbound notification secret 의 rotate 응답 형식이 먼저 합의되면 본 spec 의 v1.1 행도 동일 패턴을 차용한다.

### R-3. 삭제 confirmation 텍스트를 type 별로 분기한 이유

사용자가 "트리거 삭제" 의 부수 효과를 type 마다 다르게 인지해야 한다.

- webhook: 외부 호출자가 즉시 404 — 사용자에게 가시적인 영향.
- schedule: cascading 으로 schedule 도 사라짐 — `data-flow/10-triggers.md §1.4` 가 정의한 동작을 UX 로 노출.
- manual: workflow 자체는 살아남고 트리거 진입점만 사라짐 — 사용자 안심.

이 3 분기를 1 문구로 묶으면 schedule cascading 같은 중요한 사실이 묻히므로 분리.

### R-4. `isActive` 편집 경로를 PATCH body 와 `/toggle` 양쪽 모두 유지

§2.3.1 의 `isActive` 행은 PATCH body 도 받고, §3 의 `PATCH /api/triggers/:id/toggle` 도 살아 있다. 둘 다 같은 결과 (단순 부울 토글) 이지만 분리 유지 이유:

- `/toggle` 은 단일 행 액션 (목록의 inline button) 용으로, 본문 없이 호출 가능 (idempotent — 매 호출마다 부정 토글이 아니라 백엔드가 현재 상태와 반대로 set) — 클라이언트가 현재 상태를 모르는 케이스에 적합.
- PATCH body `{ isActive: true|false }` 는 다른 필드와 함께 한 트랜잭션으로 갱신할 때 사용 (예: 이름·activation 동시 갱신).
- 양쪽 모두 audit log 를 emit 하며 action 동사는 호출한 endpoint 가 결정 (`/toggle` 은 `trigger.toggle`, PATCH 는 `trigger.update`).

향후 사용 통계에서 `/toggle` 호출이 의미 있게 감소하면 deprecate 검토. 현 시점에서는 단순성 우선.

본 R-4 는 **API 편집 경로의 이원화** 결정이다. drawer **UI 표현**은 별개 축으로, 상세 drawer 안에서 `isActive` 는 read-only 배지로만 표시하고 토글은 §2.1 ⋮ 행 액션으로만 제공한다 (Rationale R-16). 즉 PATCH body 경로는 API 계약상 살아 있되, drawer 화면에는 inline 토글 컨트롤을 노출하지 않는다.

### R-5. schedule 삭제 confirmation interp 변수: `{{cron}}`

§4.2 의 schedule 타입 본문 텍스트 interp 변수는 `{{cron}}` 을 사용한다. 이유:

- cron 표현식 (`0 9 * * *` 등) 은 사용자가 어떤 스케줄인지 즉시 식별 가능.
- scheduleId 는 내부 UUID 로 사용자에게 의미 없음.
- 양쪽 모두 동일한 schedule 행을 가리키나, confirmation UX 의 목적이 "이 작업이 무엇을 삭제하는지" 식별이므로 사람 가독성 우선.

### R-6. 호출 이력 진입을 별도 Dialog 로 분리

§2.1 의 ⋮ 메뉴에서 "상세 보기" 와 "호출 이력" 은 **별도 Dialog** 로 분리한다:

- **상세 보기** — 메타 / Webhook 인증 / External Interaction / Schedule **카드** 가 한 화면에 보이는 풀 detail drawer (`SlideDrawer`, 우측 슬라이드). 편집·cron 확인·EIA 설정 등이 목적. Recent Calls 는 본 drawer 에 포함되지 않음 (Rationale R-7).
- **호출 이력** — Recent Calls **만** 빠르게 보고 닫는 가벼운 modal (`Dialog`, 중앙 정렬). 다른 메타·인증·EIA 정보가 시야에서 사라져 "이 트리거가 최근에 잘 호출되고 있는가" 만 빠르게 확인하는 시나리오에 부합. modal 안의 "전체 상세 보기" 버튼으로 detail drawer 로 승격 가능.

### R-8. Chat Channel 을 별도 카드로 분리

§2.3 의 상세 drawer 에서 `config.chatChannel` 설정은 Webhook Configuration 카드에 흡수하지 않고 **별도 "Chat Channel" 카드로 분리**한다. Webhook Configuration 은 endpoint URL·auth·HTTP 메서드 등 "외부 호출 인터페이스" 가 주제이고, Chat Channel 은 봇 identity·UI 매핑·언어 hint·health 등 "어댑터 동작·외부 provider 연결" 이 주제로 의미 차원이 다르다. 별도 카드로 분리해야 "어디서 무엇을 편집해야 하는지" 가 명확하다.

내부 ref (`botTokenRef`, `inboundSigningRef`) UI 미노출 정책은 [CCH-SE-03](../5-system/15-chat-channel.md#34-신뢰성--보안) 의 UI 차원 적용 — secret store ref 는 backend 내부 식별자로 사용자에게 노출 가치 없음. UI 는 `hasBotToken: boolean` 만 받아 "등록 됨 / 안 됨" 표시.

행 표시 ([§2.1](#21-트리거-목록-항목)) 의 chip + health badge 는 WH-MG-09 의 "동일 영역" 요구를 본 §2.1 행 표시 위치로 해석. drawer 카드 분리는 그와 독립 (행 / 카드 두 위치 모두 표시).

### R-7. detail drawer 에서 Recent Calls 카드 제거

detail drawer 에는 Recent Calls 카드를 두지 않는다 (호출 이력은 별도 Dialog 로만 제공 — R-6).

근거:

- §2.1 의 ⋮ 메뉴가 이미 "상세 보기 (drawer)" 와 "호출 이력 (Dialog)" 을 별도 진입점으로 노출 — 사용자가 어느 쪽이든 명시적으로 선택 가능. drawer 가 호출 이력을 추가로 노출할 가치가 적음.
- drawer 가 `GET /api/triggers/:id/history` 를 호출하지 않아 drawer 오픈 시 round-trip 1회 감소.
- drawer 는 "편집 가능한 메타" 에 집중. 호출 이력은 ⋮ 메뉴 → 호출 이력 으로 진입.

### R-12. Chat Channel `provider` / `inboundSigning` 필드 정책

§2.3.1 의 `Chat Channel | provider` 행은 v1 에서 `telegram` / `slack` / `discord` 를 지원한다 (`providers/_overview.md §1` 단일 진실). 변경하려면 트리거 삭제·재생성.

`Chat Channel | inboundSigning` 행: slack / discord 는 사용자 입력 (provider-issued plaintext) 으로 받는다. telegram 은 server-issued 라 본 필드 미사용. 변경 (rotation) 은 v1 미정의이며 PATCH 로 차단한다 (`config.chatChannel.inboundSigning` / `inboundSigningPlaintext`, `botTokenRef` 차단과 같은 위치).

slack/discord `inboundSigning` 은 v1 에서 보수적으로 변경 차단한다 — provider-issued / server-stored 자원 성격이 [R-CC-10](../5-system/15-chat-channel.md#r-cc-10-bot-token-변경-single-path-rotate-api-only) 의 외부 provider 등록 token (single-path rotate 적용 근거) 과 달라, 향후 rotation API 도입 시 별도 결정 사안이다.

### R-13. 호출 이력 Dialog 항목에 실행 상세 drill-down Link

동작:

- 각 호출 이력 항목을 `<Link href="/workflows/:workflowId/executions/:executionId">` 로 감싼다. workflowId 는 trigger row 가 이미 알고 있으므로 Dialog 의 부모(`TriggersPage`)가 `historyTarget.workflowId` 로 동봉해 prop 전달.
- 시작 시각은 primary text 로 표시해 "어떤 항목을 클릭하는 중인지" 시각적 강조. 우측에 `ChevronRight` 아이콘으로 navigable affordance 표시.
- 항목 클릭 시 `onClose()` 호출 → 페이지 라우팅과 함께 dialog 가 자연스럽게 닫힌다.
- `workflowId` prop 이 비어 있는 회귀 케이스 (workspace 응답에서 workflow_id null 등) 에서는 row 가 read-only `<div>` 로 폴백 — Link 미생성.

항목 전체를 Link 로 만든 이유: 시작 시각/상태 영역 전체가 클릭 타깃이라 도달성이 좋고, 별도 "보기" 버튼이 늘지 않아 modal 의 가벼움 (R-6 의 의도) 을 유지한다. workflowId 는 클라이언트가 이미 알고 있어 backend 가 link URL 을 동봉할 필요가 없다.

### R-14. authConfigId v1 — inline 인증 필드 제거

Webhook 수신 인증은 `/authentication` (AuthConfig) 자격증명을 binding 하는 단일 경로(`authConfigId`)로 동작한다.

- **인라인 인증 필드 없음**: `authType` / `hmacHeader` / `hmacSecret` / `bearerToken` 인라인 행은 두지 않고, `Auth Config | authConfigId` 단일 행만 둔다. 인라인 `authType` enum (`none`/`hmac`/`bearer`) 은 AuthConfig.type 4값 (`api_key`/`bearer_token`/`basic_auth`/`hmac`) 으로 대체된다. "인증 없음" 은 `authConfigId IS NULL` 로 표현된다.
- **자격증명 회전**: inbound webhook 인증 자격증명 회전은 `POST /api/auth-configs/:id/regenerate` 로 일원화한다. inbound webhook auth 와 outbound notification HMAC 은 별개 endpoint·별개 secret 이므로 EIA notification rotation 과 독립이다.

근거: AuthConfig 도메인이 발행·회전·RBAC·통계·마스킹을 이미 책임하므로, 인증을 단일 SoT (`authConfigId`) 로 정리하는 게 일관적이다. 상세 근거는 [Spec Webhook Rationale "inline auth path 폐지"](../5-system/12-webhook.md#rationale).

### R-15. 외부 노출 webhook 무인증 경고 표시

§2.1 목록의 "인증" 요소는 `webhook` 트리거가 `authConfigId == null` 인 경우 경고 아이콘을 표시한다. (강제 차단이 아니라 가시적 위험 신호.)

근거:

- webhook 은 외부에 공개된 HTTP 진입점이다 ([§2.4 Webhook URL 형식](#24-webhook-url-형식)). 인증(AuthConfig) 이 binding 되지 않으면 URL 을 아는 누구나 워크플로 실행을 트리거할 수 있어 무단 실행·자원 남용·데이터 주입에 노출된다.
- `schedule` / `manual` 트리거는 외부 HTTP 진입점이 아니다 (schedule 은 내부 cron sweep, manual 은 인증된 UI/API 호출). 무인증이어도 외부 노출 위험이 없으므로 경고 비대상 — `-` (N/A) 표시.
- 경고는 차단이 아니라 신호다. [WH-SC-01](../5-system/12-webhook.md) 은 "인증 없음" 을 지원되는 공개 옵션으로 두고 `endpointPath` 의 UUID 가 사실상 capability token 역할을 겸한다고 정의한다. 본 경고는 그 결정을 바꾸지 않으며, 사용자가 무인증을 **의도적으로 선택했는지** 확인하도록 돕는 가시성 장치일 뿐이다 (강제 인증 아님). AuthConfig binding 정책 자체는 [§2.3.1 Auth Config 행](#231-필드-권한-매트릭스) + [R-14](#r-14-authconfigid-v1--inline-인증-필드-제거) 가 SoT.

### R-16. drawer 안 `isActive` 는 read-only 배지, 편집은 §2.1 ⋮ 행 액션 단일 경로

§2.3.1 매트릭스의 Overview `isActive` 는 `read-only (배지)` 이다. 상세 drawer 는 활성 상태를 배지로만 표시하고, 활성/비활성 **전환 컨트롤**은 [§2.1](#21-트리거-목록-항목) 목록의 ⋮ 행 액션 "활성/비활성 토글" 한 곳에서만 제공한다.

근거:

- **단일 편집 경로**: detail drawer 는 `isActive` 를 read-only Badge 로 렌더하고, 토글은 목록 ⋮ 행 액션 (→ `PATCH /api/triggers/:id { isActive }`) 으로 동작한다.
- **§2.1 동등 선언과 정합**: §2.1 은 ⋮ 행 액션이 "동일 API" 로 동등 기능을 제공함을 이미 명시한다. 따라서 drawer 안에 별도 토글이 없어도 사용자는 전환 수단을 잃지 않으며, 편집 진입점을 한 곳으로 모아 "어디서 켜고 끄는지" 가 명확해진다.
- **R-4 와의 구분**: [R-4](#r-4-isactive-편집-경로를-patch-body-와-toggle-양쪽-모두-유지) 는 **API 편집 경로** (PATCH body + `/toggle`) 이원화 결정이고, 본 R-16 은 **drawer UI 표현** 결정이다. 두 축은 독립 — API 계약상 PATCH body `{ isActive }` 경로는 그대로 살아 있다.
