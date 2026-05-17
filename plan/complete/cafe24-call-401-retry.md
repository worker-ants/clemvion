---
worktree: cafe24-401-refresh-a3f2c1
started: 2026-05-17
owner: developer
---

# PLAN: Cafe24 `call()` 401 자동 재시도+갱신

## 배경

사용자 보고 — 최초 OAuth 연동 직후 MCP 호출은 정상이지만, access_token 이 만료된 후
(refresh_token 은 유효) 다시 시도하면 401 만 받고 토큰 갱신이 일어나지 않는다.
integration 상태가 `error/auth_failed` 로 전이되어 사용자가 재인증을 강제당함.

`pingConnection()` (연결 테스트 버튼 경로) 은 이미 자가 회복 패턴이 있으나,
`executeWithRateLimit()` (실 노드/MCP 호출 경로) 에는 그 패턴이 없다.

## 갭 위치

- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`
- `executeWithRateLimit()` (line ~989) 의 401/403 분기:
  - 현재: 즉시 `markAuthFailed(integration, reason, errBody)` + `Cafe24AuthFailedError` throw, 재시도 없음
  - 목표: 401 시 `refreshViaQueue/refreshAccessToken` 1회 → 새 토큰으로 1회 재시도 → 그래도 401 이면 `markAuthFailed`. 403 은 기존 동작 유지 (insufficient_scope 분기 + 즉시 격하).

## 참조 패턴

같은 파일의 `pingConnection()` (line 359-439):
1. `ensureFreshToken` proactive
2. `rawPing` 1차 → 401 시
3. `refreshAccessToken` 명시적 호출 → 1회 재시도
4. 재시도도 401 이면 `markAuthFailed`
5. 403 은 어느 시점이든 `CAFE24_INSUFFICIENT_SCOPE` (status 격하 안 함 — `pingConnection` 한정 정책)

본 작업은 `call() → executeWithRateLimit` 경로에 위 1~4 와 동등한 패턴을 이식.
**단, 403 의 status 격하 정책은 기존 `executeWithRateLimit` 의 동작 (insufficient_scope 분기 +
`markAuthFailed`) 을 그대로 유지** — 노드 실행 중 403 은 사용자에게 즉시 신호가 필요.

## 작업 항목

### 코드

- [x] `executeWithRateLimit` 401 분기에 inline 자가 회복 (`triedAuthRetry` boolean 인자 추가, **inline 방식 채택** — helper 추출은 §REVIEW 후속 commit `refactor(cafe24): performAuthRefresh helper 추출`)
  - refresh 경로는 `ensureFreshToken` 과 동일하게 `refreshQueue` 있으면 `refreshViaQueue('proactive')`, 없으면 `refreshAccessToken` 직접 호출 (테스트 환경 fallback)
  - refresh 실패 시 그대로 throw (refresh 단계가 이미 `markAuthFailed` 호출)
  - refresh 성공 시 새 access_token 으로 `executeWithRateLimit` 1회만 재호출 (`triedAuthRetry=true`, attempt counter 리셋 — 429 retry 와 별개)
  - 재귀 무한 retry 차단: `triedAuthRetry=true` 진입 시 401 분기에서 격하로 직진
- [x] 403 분기는 기존 그대로 (insufficient_scope/auth_failed markAuthFailed + throw). 변경 없음.
- [x] `tokenExpiresAt` NULL 안전 보강 (`ensureFreshToken` line 551-560) — 이미 있음. 검토만.
- [x] `refreshViaQueue('proactive')` 의 source label 그대로. 새 source label 추가 안 함.

### 테스트 (TDD — 코드 전에 작성)

`cafe24-api.client.spec.ts` 의 `describe('auth failure')` 블록 재구성 + 신규 케이스 추가:

- [x] **T-1**: expired access_token 으로 `call()` → 1차 401 → refresh 성공 → 1회 재시도 성공 → `success` (status connected 유지, markAuthFailed 미호출)
- [x] **T-2**: 401 → refresh 성공 → 재시도도 401 → `markAuthFailed('auth_failed')` + throw
- [x] **T-3**: 401 → refresh 자체 401 (invalid_grant) → refresh 단계 격하 + throw, 재시도 없음
- [x] **T-4**: 403 + INSUFFICIENT_SCOPE 시그널 → 즉시 `markAuthFailed('insufficient_scope')` + throw (회귀 보호)
- [x] **T-5**: 403 (시그널 없음) → 즉시 `markAuthFailed('auth_failed')` + throw, refresh 시도 없음 (회귀 보호, "on 403" it 로 표현)
- [x] 추가 회귀: surface 메시지 (401 retry 후 throw), 401 + INSUFFICIENT_SCOPE echo → 'auth_failed' (insufficient_scope 무시)

### 문서·플랜

- [x] **spec §6.1 / §8.4 / §10.5 / Rationale 갱신 완료** — 본 PR 안에서 project-planner skill 로 직접 반영 (단일 PR 통합 결정, 2026-05-17 사용자 응답). 임시 노트 `spec-draft-...` / `spec-update-...` 는 spec 본문 흡수 후 삭제.
- [x] `spec/4-nodes/4-integration/4-cafe24.md` §6.1 전면 교체 + §4 step 9 reactive 보강 + §6 표 보정 + CHANGELOG
- [x] `spec/5-system/11-mcp-client.md` §8.4 본문 + line 69 안내문 (단일 commit 원자 반영)
- [x] `spec/2-navigation/4-integration.md` §10.5 신규 bullet + 갱신 실패 bullet 보강 + Rationale 신규 절
- [x] spec draft consistency-check 세션: `review/consistency/2026/05/17/21_06_13/` (BLOCK: NO)
- [x] 구현 착수 직전 `/consistency-check --impl-prep` 재실행 (`review/consistency/2026/05/17/21_19_47/`): BLOCK NO. Warning 2건은 §6 상태 전이 표 + §8.4 마지막 문장 후속 정밀화로 즉시 해소 (별 commit).

### 검증

- [x] TEST WORKFLOW (lint · unit 3875/3875 · build · e2e 93/93)
- [x] REVIEW WORKFLOW (/ai-review) — `review/code/2026/05/17/21_45_15/` (Critical 0, Warning 12, Info 22)
- [ ] RESOLUTION.md 작성

## 비목표

- spec 본문 직접 수정 (developer skill 의 spec read-only 룰)
- 403 분기 동작 변경
- rate limit (429) 처리 변경
- 새 동시성 코드 추가 (`refreshViaQueue` jobId dedup + `withIntegrationLock` 으로 이미 보호)
- `cafe24-backlog-residual.md` B-5-8 alt (handleCallback/BullMQ refresh unit/integration 보강) — 별 plan, 본 PR 와 무관

## 처리 후

모든 체크박스 완료 시 본 plan 을 `plan/complete/` 로 `git mv` (PR 머지 직전 별 commit).
