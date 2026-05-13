# Data Flow: 외부 통합 (Integration)

> 관련 spec: [Spec 통합 화면](../2-navigation/4-integration.md) · [데이터 모델 §2.10, §2.10.1](../1-data-model.md) · [data-flow 개요](./0-overview.md)

---

## Overview

### System role

외부 SaaS (Google·GitHub 등) 와 통신하기 위한 인증 정보·연결 상태를 저장한다. 노드 실행 시점에 해당
integration 의 credentials 를 가져와 외부 API 호출에 사용하고, 호출 결과는 `integration_usage_log`
에 기록한다. OAuth 토큰은 별도 만료 스캐너가 주기적으로 점검해 `expired` 로 마킹하거나 refresh 한다.

코드 진입점:

- `backend/src/modules/integrations/integrations.service.ts` — CRUD
- `backend/src/modules/integrations/integration-oauth.service.ts` — OAuth start / callback
- `backend/src/modules/integrations/integration-expiry-scanner.service.ts` — 만료 스캐너
- `backend/src/modules/integrations/services/credentials-transformer.ts` — `credentials` JSONB 의 AES 암호화 (entity column transformer)

---

## 1. Source → Sink

### 1.1 Integration 생성 (API Key)

```mermaid
sequenceDiagram
  participant C as Client
  participant Svc as IntegrationsService
  participant PG as Postgres
  C->>Svc: POST /api/integrations { service_type, auth_type='api_key', name, credentials }
  Svc->>Svc: 암호화 transformer 가 credentials JSONB 를 자동 암호화
  Svc->>PG: INSERT integration (workspace_id, service_type, name, auth_type, credentials=ENC, scope, status='connected', created_by)
  Svc-->>C: 201 { integration } (credentials 는 응답 시 redact)
```

### 1.2 OAuth 연결

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant Svc as IntegrationOauthService
  participant PG as Postgres
  participant Prov as OAuth Provider

  C->>Svc: GET /api/integrations/oauth/:service/start
  Svc->>PG: INSERT integration_oauth_state (state, service_type, workspace_id, user_id, expires_at = now+10m)
  Svc-->>C: 302 → provider authorize URL
  Prov-->>C: 302 → callback
  C->>Svc: callback { code, state }
  Svc->>PG: SELECT + DELETE integration_oauth_state
  Svc->>Prov: token exchange
  Prov-->>Svc: { access_token, refresh_token, expires_in, scopes }
  Svc->>PG: INSERT/UPDATE integration (credentials = ENC({access_token, refresh_token, scopes}), token_expires_at, status='connected', last_rotated_at=now)
```

### 1.3 노드 실행에서 호출

```mermaid
sequenceDiagram
  participant H as NodeHandler (http_request, send_email, ...)
  participant Svc as IntegrationsService
  participant PG as Postgres
  participant Ext as External API

  H->>Svc: getIntegration(integrationId)
  Svc->>PG: SELECT integration WHERE id=? (transformer 가 credentials 복호화)
  alt status != 'connected' OR token_expires_at < now
    Svc-->>H: throw INTEGRATION_EXPIRED / INTEGRATION_ERROR
  end
  Svc-->>H: integration with credentials
  H->>Ext: HTTP call
  alt success
    H->>PG: INSERT integration_usage_log (integration_id, node_execution_id, workflow_id, status='success', duration_ms, at)
    H->>PG: UPDATE integration SET last_used_at=now
  else fail
    H->>PG: INSERT integration_usage_log (status='failed', error={code,message}, duration_ms)
    H->>PG: UPDATE integration SET last_error={code,message,at}, status='error' (재시도성 아닐 시), status_reason
  end
```

### 1.4 OAuth 만료 스캐너 (BullMQ `integration-expiry`)

```mermaid
sequenceDiagram
  participant Cron as Cron sweep
  participant Q as integration-expiry queue
  participant Scan as IntegrationExpiryScanner
  participant Prov as OAuth Provider
  participant PG as Postgres
  participant Noti as NotificationsService

  Cron->>PG: SELECT integration WHERE token_expires_at < now + Δ AND status='connected'
  loop each integration
    Cron->>Q: queue.add({ integrationId })
  end
  Q-->>Scan: job
  alt refresh_token 존재
    Scan->>Prov: refresh token
    Scan->>PG: UPDATE integration SET credentials=ENC(new), token_expires_at, last_rotated_at
  else 만료 처리만
    Scan->>PG: UPDATE integration SET status='expired', status_reason='token_expired'
    Scan->>Noti: notify integration_expired
  end
```

---

## 2. Schema 매핑

### 2.1 Postgres

| Sink (table) | 흐름 | read/write 컬럼 | 인덱스 / 제약 |
| --- | --- | --- | --- |
| `integration` | 생성·갱신 | `workspace_id, service_type, name, auth_type, credentials (encrypted JSONB), scope, status, status_reason, token_expires_at, last_used_at, last_rotated_at, last_error, created_by` | `(workspace_id, name) UNIQUE` (V008/V001), `(workspace_id, status)` 배지 카운트, `(workspace_id, service_type)`, `(token_expires_at)` 스캐너용 (V009) |
| `integration_usage_log` | 노드 실행 후 | INSERT `integration_id, node_execution_id, workflow_id, status, error?, duration_ms, at` | V008 `(integration_id, at DESC)`. 보존 90일 일일 배치 정리 |
| `integration_oauth_state` | OAuth start | INSERT `state, service_type, workspace_id, user_id, expires_at = now+10m` | one-shot DELETE on callback. `state UNIQUE` (V009) |

### 2.2 Redis

| 큐 | producer | consumer | payload |
| --- | --- | --- | --- |
| `integration-expiry` | `IntegrationExpiryScanner` cron sweep | 동일 module 내 processor | `{ integrationId, reason }` |

### 2.3 외부

| Sink | 흐름 |
| --- | --- |
| OAuth provider | authorize / token / refresh |
| Service API | 노드 실행 본체 호출 (Google API, GitHub API, HTTP, ...) |

---

## 3. 상태 전이

### 3.1 `integration.status`

```mermaid
stateDiagram-v2
  [*] --> connected: 생성 / OAuth 성공
  connected --> error: API 호출 실패 (insufficient_scope, auth_failed, network, unknown)
  connected --> expired: 만료 스캐너 OR refresh 실패
  error --> connected: 사용자 재인증 / credentials 수정
  expired --> connected: refresh 성공 OR 수동 재인증
  connected --> [*]: 삭제
```

### 3.2 `status_reason` 매핑

| status | status_reason 후보 |
| --- | --- |
| `error` | `insufficient_scope`, `auth_failed`, `network`, `unknown` |
| `expired` | `token_expired`, `refresh_failed` |
| `connected` | NULL |

---

## 4. 외부 의존

| 의존 | 방향 | 참고 |
| --- | --- | --- |
| Execution 도메인 | cross-ref | 노드 실행 진입점 — `http_request`, `database_query`, `send_email` |
| Notifications | cross-ref | `integration_expired` 알림 |
| Audit | cross-ref | `integration.create/update/delete` 액션 |

---

## Rationale

### `credentials` JSONB AES 암호화

평문 저장 시 DB dump / replica 가 노출되면 외부 시스템 자격증명이 통째로 새어 나간다. TypeORM
`transformer` (`credentials-transformer.ts`) 를 column 단에서 적용해 ORM 경계에서 자동으로 암호화/복호화한다.
응답 직렬화 시 controller / DTO 단에서 `credentials` 필드를 redact 한다.

### `last_error` 도 암호화

OAuth 응답 본문에 token 일부가 포함될 수 있어 `last_error` 도 동일 transformer 로 암호화한다
(`integration.entity.ts:71~77`).

### `integration_usage_log` 보존 90일

상세 페이지의 "Recent activity" 는 최근 30~90일 데이터만 의미가 있다. 90일 이상 누적되면 row 수가
폭증하고 검색 성능이 떨어지므로 일일 배치로 정리한다 (`spec/1-data-model.md §2.10.1`).
