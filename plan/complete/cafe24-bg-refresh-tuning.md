---
worktree: cafe24-bg-refresh-tuning-fb72d5
started: 2026-05-19
owner: developer
---

# Cafe24 background refresh — 주기 단축 + cutoff 마진 격상

## 배경

ai-agent-turn-fail-finalize PR (#209) 의 후속 plan §"본 PR 범위 외" 항목.

`integration-expiry-scanner.service.ts:103` 의 daily cron `'0 0 * * *', tz: 'UTC'` 는 4개 스케줄러 (`connected-expiry`, `pending-install-ttl`, `usage-log-prune`, `cafe24-background-refresh`) 가 공유한다. cafe24 background refresh 는 idle cafe24 통합 (`lastRotatedAt < now - REFRESH_PROACTIVE_THRESHOLD_DAYS=10일`) 를 자동 갱신해 14일 refresh_token 만기를 사전 차단하는 패스.

현재 정책 (10일 cutoff + 24h cron 주기) 의 마진:
- 마진 = `14일 - 10일 - 24h = 3일`. cron 한 번이 누락되면 마진이 즉시 더 줄어든다.
- cron 이 fire 안 되는 회귀 (예: BullMQ Redis AUTH 결함 — 동시 PR 에서 별도 해소) 가 24h 누적되면 마진 2일로 압박.

본 PR 의 목적:
1. cafe24-background-refresh cron 주기 단축 (`'0 0 * * *'` → `'0 */6 * * *'`). 6시간 마다 fire. 다른 3개 daily 스케줄러는 그대로 일일 유지 (그 패스들의 작업 성격 — connected expiry 알림 / pending install TTL / usage log prune — 은 일일 주기로 충분).
2. cutoff 마진 격상 (`REFRESH_PROACTIVE_THRESHOLD_DAYS` 10 → 7). 14일 만기 전 7일 마진 (= 50%) 확보. cron 한 번 누락이 마진에 즉시 영향을 주지 않음.

## 변경 범위

### 1) `codebase/backend/src/modules/integrations/cafe24-token-refresh.constants.ts`

- [x] `REFRESH_PROACTIVE_THRESHOLD_DAYS = 10` → `7`. JSDoc 코멘트의 마진 수치 (`14 - N = 4일 → 7일`) 갱신.

### 2) `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`

- [x] cafe24-background-refresh 만 별도 repeat 객체 (`{ pattern: '0 */6 * * *', tz: 'UTC' }`) 로 분리. 나머지 3개 스케줄러는 기존 `repeat` 변수 그대로 daily 유지.
- [x] `onModuleInit` 안 로그 메시지 (`Registered integration expiry schedulers: ... cafe24-background-refresh (daily 00:00 UTC)`) 를 정확한 주기 (`every 6h`) 로 갱신.
- [x] JSDoc 의 cron 주기 언급 부분 갱신.
- [x] scheduler ID `'cafe24-background-refresh-daily'` 는 **변경하지 않음** — BullMQ `upsertJobScheduler` 가 같은 ID 의 기존 entry 를 갱신만 함. ID 변경 시 옛 daily ID 가 Redis 에 orphan 으로 남아 계속 fire 되는 회귀 위험 (별도 `removeJobScheduler` 코드 추가 필요). 이름은 historical 로 두고 코멘트로 실제 주기 명시.

### 3) 테스트

- [x] `integration-expiry-scanner.service.spec.ts` — `onModuleInit` 의 cafe24-background-refresh 스케줄러 등록 시 `pattern: '0 */6 * * *'` 검증.
- [x] 새 cutoff 값으로 인한 기존 테스트 깨짐 여부 확인. `REFRESH_PROACTIVE_THRESHOLD_DAYS` 를 직접 import 해서 비교하는 케이스는 자동 정합 — 하드코딩된 10일 케이스 발견 시 갱신.

## 결정 사항

- **6h 주기 선택 이유**: 1h 는 쿼리 비용 (idle 통합 풀스캔) 누적 위험 + cutoff (`lastRotatedAt < cutoff`) 가 throttle 역할이라 너무 자주 필요 없음. 24h 는 한 번 누락 시 마진 부족. 6h 가 적절.
- **7일 cutoff 선택 이유**: 14일 만기 / 2 = 50% 마진. 6h cron 4회 분량 누락 (= 24h 누락) 도 흡수.
- **scheduler ID 보존**: BullMQ idempotent upsert 활용. ID 변경 시 orphan 위험.

## 후속 (별도 PR — 본 plan 범위 외)

- `LlmService.withRetry` 의 `Retry-After` 헤더 존중
- spec/2-navigation/4-integration.md / spec/data-flow/integration.md 의 cafe24 background refresh 주기 / cutoff 마진 명시 갱신 (project-planner 위임) — **완료 (commit `c3d8e6fd`, 2026-05-19)**

## 처리 결과

- PR #212 (`bf2c6275` Merge → `bb24e368` 본체) 으로 §1~§3 모든 항목 머지 완료.
- spec 동반 갱신 (commit `c3d8e6fd`) 로 후속 항목 해소.
- 모든 체크박스 `[x]`, 미해결 follow-up 0건.
