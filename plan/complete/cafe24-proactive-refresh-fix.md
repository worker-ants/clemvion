---
worktree: cafe24-refresh-fix-a8c2f1
started: 2026-05-16
owner: developer / 사용자 본인 (gehrig)
---

# Cafe24 access_token 자동 갱신 회복

## 문제

운영 신고 (2026-05-16): Cafe24 통합이 연결 직후 한 번은 정상 호출되다가, 약 2시간 뒤부터 모든 호출이 다음 오류로 실패.

```
{ "error": { "code": "CAFE24_AUTH_FAILED",
  "message": "Cafe24 authentication failed (401) for mall gehrig0301 — access_token time expired. (invalid_token)" } }
```

기대 동작 (`spec/2-navigation/4-integration.md §10.5`): 노드 실행 직전 만료 확인 → 만료됐으면 갱신 후 호출, refresh 실패 시에만 `expired` 전이.

## 원인

두 곳에 걸친 결합 결함:

1. `IntegrationOAuthService.handleCallback` (initial OAuth callback) 는 `Integration.tokenExpiresAt` 컬럼만 set 하고 `credentials.expires_at` JSONB 미러는 **쓰지 않았다**. preview 경유 신규 통합 생성 (`integrations.service.ts:281`) 도 동일.
2. `Cafe24ApiClient.ensureFreshToken` 의 proactive-refresh 게이트는 `credentials.expires_at` **만** 읽었다. JSONB 미러가 비어있으면 `if (!creds.expires_at) return;` 로 조용히 빠져나가 refresh 가 **한 번도 트리거되지 않음**.

결과: 갓 연결된 행은 Cafe24 의 access_token TTL (2시간) 이 지나는 순간부터 stale token 을 그대로 송신 → 서버 401 → `markAuthFailed` → `error(auth_failed)`. 사용자가 reauthorize 하기 전까지 사용 불가. refresh path 자체 (`refreshAccessToken`) 는 `credentials.expires_at` 를 정상적으로 write 했으므로 일단 한 번이라도 refresh 가 돌면 그 다음부터는 self-heal 했지만, 게이트 자체가 fire 하지 않아 첫 refresh 가 영원히 일어나지 않았다.

## 조치

### 코드

- `cafe24-api.client.ts:ensureFreshToken` — expiry 판정 소스를 `Integration.tokenExpiresAt` (spec §10.5 canonical column) 우선, `credentials.expires_at` 폴백으로 변경. 헬퍼 `resolveTokenExpiry()` 신설.
- `integration-oauth.service.ts:handleCallback` — `credentials.expires_at` 를 `exchange.tokenExpiresAt` 에서 미러로 동시 기록. refresh path 가 생성하는 credentials 형태와 일치.

### 테스트

- `cafe24-api.client.spec.ts` — 회귀 케이스 추가: `tokenExpiresAt` 만 set 되고 `credentials.expires_at` 가 없을 때 proactive refresh 가 fire 하는지 검증. 기존 30s/1s window 테스트 두 건은 `tokenExpiresAt` 도 함께 set 하도록 갱신 (canonical column 우선이 되었으므로).
- `integration-oauth.service.cafe24.spec.ts` — handleCallback 의 preview 저장이 `credentials.expires_at` 미러를 포함하는지 검증.

검증:

- `npx jest --testPathPatterns=cafe24` → 48 / 48 통과.
- `npx jest` (backend 전체) → 3581 / 3581 통과.
- `npm run build` → 통과.
- `npm run lint` → 변경 영역 무경고. 기존 1건 (third-party-oauth.controller.spec.ts:430) 은 본 작업 이전부터 존재 (out of scope).

## 사용자 액션

이미 `error(auth_failed)` 로 격하된 통합은 reauthorize 가 필요하다 — 새 access_token + refresh_token 발급. 본 fix 가 배포된 이후 갓 연결한 통합은 2시간 경계에서 자동으로 갱신된다.

## Rationale 메모

- `tokenExpiresAt` 컬럼을 canonical 로 정의한 이유 (spec §10.5 도 동일):
  - 원자 4-field UPDATE 에서 컬럼이 마지막에 write 되고, transaction 안에서 컬럼·JSONB 가 일관적으로 갱신된다.
  - 만료 스캐너 (`integration-expiry-scanner.service.ts`) 가 `tokenExpiresAt` 만 본다 — proactive refresh 와 만료 알림이 같은 SoT 를 공유.
  - JSONB 미러는 다른 provider (google/github) 가 갖지 않을 수도 있어, 컬럼 폴백이 더 portable.
- 401 에 대한 reactive refresh + retry 는 본 fix 범위에서 제외. spec §10.5 가 proactive 만 명시했고, refresh_token 자체가 무효화된 케이스를 reactive 가 마스킹하면 진단이 어려워진다. 추후 robustness 보강이 필요해지면 별개 plan 으로 분리한다.

## 후속 follow-up

- 없음. 본 plan 은 단일 PR 로 완결.
