---
worktree: integration-expiry-fixes-1d7c7d
started: 2026-06-10
owner: developer
spec_impact:
  - spec/2-navigation/4-integration.md
  - spec/1-data-model.md
  - spec/data-flow/5-integration.md
  - spec/5-system/16-system-status-api.md
---

# 만료 스캐너 정합 fix 묶음 (V-01 severe + V-07 + V-15)

출처: 전수 감사 보고 [`review/spec-coverage/2026/06/10/12_32_46/SUMMARY.md`](../../review/spec-coverage/2026/06/10/12_32_46/SUMMARY.md). 사용자 결정(2026-06-10): **V-07 = §11.2 채택** (refresh-capable provider 는 passive `integration_expired` 알림 제외).

## V-01 (severe) — makeshop expired 오격하

`integration-expiry-scanner.service.ts` 의 0d 분기가 `isCafe24RefreshCapable` (cafe24 하드코딩) 으로 makeshop 을 제외해, refresh_token 보유 makeshop 통합이 access_token(1h) 만료 시 다음 스캔에서 `expired` 로 잘못 격하됨. spec §11.1 MakeShop note 는 makeshop 을 cafe24 와 동일한 refresh-capable 로 취급해 격하 면제하라고 명시.

- **fix**: `isCafe24RefreshCapable` → `isRefreshCapable` 일반화 (cafe24·makeshop + `credentials.refresh_token` 보유). makeshop 은 큐 enqueue 없이 격하만 면제 (proactive `ensureFreshToken` / reactive_401 이 갱신 담당).

## V-07 (major) — §11.2 채택 (사용자 결정)

§11.1 표/의사코드(refresh-capable 도 알림) vs §11.2(refresh_token 없는 provider 만 발사) 모순을 **§11.2 방향으로 정합**.

- **코드**: (1) `INTEGRATION_STATUS_REASONS` union 에 `token_expired` 추가. (2) refresh_token-less 0d 격하 시 `statusReason = 'token_expired'` (was null). (3) passive `integration_expired` 알림(7d/3d/0d 전부)을 refresh-capable provider 에서 제외 — refresh-capable 은 claim/격하/알림 모두 skip (cafe24 만 safety-net enqueue). 이로써 보고서가 지적한 dedup 키 churn(단수명 토큰 재발사) 도 자연 해소.
- **spec**: §11.1 표 "cafe24 0d → enqueue + 알림" 의 "+ 알림" 제거 + 의사코드 동기. §11.2 유지. data-flow/5-integration.md 동기.

## V-15 (minor) — 큐 레지스트리 동기

`MONITORED_QUEUES` (system-status.constants.ts) 에 `MAKESHOP_REFRESH_QUEUE` 누락 → spec §1 표·data-flow §4 카탈로그와 불일치.

- **fix**: import + `{ name: MAKESHOP_REFRESH_QUEUE, group: 'integration', concurrency: 1 }` 추가. 회귀 테스트로 MONITORED_QUEUES ↔ 카탈로그 동기 보강.

## 체크리스트

- [ ] /consistency-check --impl-prep spec/2-navigation/
- [ ] 단위 테스트 선작성/수정 (scanner: makeshop 면제·token_expired·refresh-capable 알림 제외 / system-status: makeshop 큐 등록)
- [ ] 구현
- [ ] spec 정합 (§11.1·data-flow/5·1-data-model token_expired 확정·16-system-status)
- [ ] e2e (system-status 큐 노출 + 기존 회귀)
- [ ] TEST WORKFLOW (lint→unit→build→e2e)
- [ ] /ai-review + resolution
- [ ] /consistency-check --impl-done spec/2-navigation/
