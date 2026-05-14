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

> Cafe24 Private 앱의 install_token 기반 흐름은 [§1.2.1](#121-cafe24-private-앱--install_token-기반-흐름) 참고 (`POST /oauth/begin` → App URL 등록 → "테스트 실행" → callback). 부모 다이어그램의 `GET /oauth/:service/start` 는 일반 OAuth 의 표현이며 Cafe24 Private 는 별도 시작 흐름을 가진다.

#### 1.2.1 Cafe24 Private 앱 — install_token 기반 흐름

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant FE as Frontend
  participant Svc as IntegrationOauthService
  participant PG as Postgres
  participant CDev as Cafe24 Developers
  participant Prov as Cafe24 OAuth

  U->>FE: app_type=private + mall_id + client_id/secret 폼 제출
  FE->>Svc: POST /oauth/begin
  Svc->>Svc: install_token = randomBytes(32).hex
  Svc->>PG: INSERT integration (status=pending_install, install_token, credentials ENC)
  Svc-->>FE: { appUrl: .../install/cafe24/:installToken, callbackUrl: ... }
  U->>CDev: appUrl/callbackUrl 등록 → "테스트 실행"
  CDev->>Svc: GET /install/cafe24/:installToken?mall_id=...&hmac=...
  Svc->>PG: SELECT integration WHERE install_token=:installToken AND status=pending_install
  Svc->>Svc: HMAC(client_secret, query) 1회 검증
  alt 검증 성공
    Svc->>PG: INSERT integration_oauth_state (mode=reauthorize, integration_id=...)
    Svc-->>CDev: 302 → cafe24 authorize URL
    Prov-->>Svc: callback { code, state }
    Svc->>PG: SELECT+DELETE state
    Svc->>Prov: token exchange
    alt 토큰 교환 성공
      Svc->>PG: UPDATE integration SET status=connected, install_token=NULL, credentials ENC, token_expires_at, last_rotated_at
    else 토큰 교환 실패
      Svc->>PG: UPDATE integration SET status_reason='oauth_token_exchange_failed', last_error={code,message,at} (status 는 pending_install 유지, install_token 도 유지)
    end
  else HMAC 실패
    Svc-->>CDev: 403 CAFE24_INSTALL_INVALID_HMAC
  else install_token 미존재
    Svc-->>CDev: 404 CAFE24_INSTALL_INVALID_TOKEN
  end
```

`pending_install` 행은 일일 만료 스캐너 (`integration-expiry` 큐) 가 동일하게 처리한다 — `created_at < now - 24h AND status='pending_install'` 인 행을 `status='expired', status_reason='install_timeout', install_token=NULL` 로 전이.

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
  Cron->>PG: SELECT integration WHERE status='pending_install' AND created_at < now - INTERVAL '24h' AND install_token IS NOT NULL
  loop each integration
    Cron->>Q: queue.add({ integrationId, reason: 'token_expiring' | 'pending_install_timeout' })
  end
  Q-->>Scan: job
  alt status='pending_install' 분기 (Cafe24 Private install TTL 만료)
    Scan->>PG: UPDATE integration SET status='expired', status_reason='install_timeout', install_token=NULL
    Scan->>Noti: notify integration_expired (선택 — 사용자에게 cafe24 측 설정 미완 안내)
  else (refresh 흐름)
    alt refresh_token 존재
      Scan->>Prov: refresh token
      Scan->>PG: UPDATE integration SET credentials=ENC(new), token_expires_at, last_rotated_at
    else 만료 처리만
      Scan->>PG: UPDATE integration SET status='expired', status_reason='token_expired'
      Scan->>Noti: notify integration_expired
    end
  end
```

스캐너 한 작업이 두 갈래를 모두 처리한다 — (a) `connected` 토큰 만료 임박 행은 refresh 또는 expired 전이 / (b) `pending_install` 24h 초과 행은 expired (`install_timeout`) 전이. 두 갈래는 별도 큐 메시지로 dispatch 되어 처리 로직이 분리된다 (`{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }`). **하위 호환**: 기존 소비자가 `reason` 미포함 메시지를 받던 경로가 있다면 `reason ?? 'token_expiring'` 으로 기본값 처리한다 — 본 개정 이전의 큐 잔존 메시지가 신규 소비자에서도 안전하게 처리되도록 보장.

---

## 2. Schema 매핑

### 2.1 Postgres

| Sink (table) | 흐름 | read/write 컬럼 | 인덱스 / 제약 |
| --- | --- | --- | --- |
| `integration` | 생성·갱신 | `workspace_id, service_type, name, auth_type, credentials (encrypted JSONB), scope, status, status_reason, install_token (Cafe24 private 전용), token_expires_at, last_used_at, last_rotated_at, last_error, created_by` | `(workspace_id, name) UNIQUE` (V008/V001), `(workspace_id, status)` 배지 카운트 + pending_install TTL 스캐너 조회 겸용, `(workspace_id, service_type)`, `(token_expires_at)` 스캐너용 (V009). `install_token` 컬럼은 V042 추가 |
| `integration_usage_log` | 노드 실행 후 | INSERT `integration_id, node_execution_id, workflow_id, status, error?, duration_ms, at` | V008 `(integration_id, at DESC)`. 보존 90일 일일 배치 정리 |
| `integration_oauth_state` | OAuth start | INSERT `state, service_type, workspace_id, user_id, integration_id (reauthorize/private install 시), mode, requested_scopes, provider_meta (encrypted JSONB), expires_at = now+10m` | one-shot DELETE on callback. `state UNIQUE` (V009). `integration_id` FK → integration ON DELETE CASCADE (V009). `provider_meta` 컬럼 V041 추가 — cafe24 private 의 mall_id/client_id/client_secret 을 callback 까지 캐리. |

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
  [*] --> pending_install: Cafe24 private oauth/begin
  pending_install --> connected: HMAC 검증 + token 교환 성공
  pending_install --> expired: install TTL 24h 만료 (status_reason=install_timeout, install_token=NULL)
  pending_install --> pending_install: callback 실패 (status 보존, last_error/status_reason 갱신)
  [*] --> connected: 생성 / OAuth 성공
  connected --> error: API 호출 실패 (insufficient_scope, auth_failed, network, unknown)
  connected --> expired: 만료 스캐너 OR refresh 실패
  error --> connected: 사용자 재인증 / credentials 수정
  expired --> connected: refresh 성공 OR 수동 재인증
  connected --> [*]: 삭제
  pending_install --> [*]: manual delete
  expired --> [*]: manual delete
```

### 3.2 `status_reason` 매핑

| status | status_reason 후보 |
| --- | --- |
| `error` | `insufficient_scope`, `auth_failed`, `network`, `unknown`, `credentials_unreadable` |
| `expired` | `token_expired`, `refresh_failed`, `install_timeout` |
| `pending_install` | callback 실패 분기 코드: `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired` (모두 snake_case — DB 저장 표기. 동일 의미의 API 에러 코드는 `spec/2-navigation/4-integration.md §10.4` 의 `OAUTH_*` UPPER_SNAKE_CASE) — status 는 보존되지만 사용자가 진단 단서를 볼 수 있도록 채워짐. `resource_not_found` 는 row 자체가 사라진 케이스라 DB 갱신 불가 → 후보값에서 제외 |
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
