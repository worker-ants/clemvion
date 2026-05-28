---
worktree: eia-jti-tracking-<slug>
started: 2026-05-21
owner: developer
---

# EIA — iext JTI tracking 인프라

> 작성일: 2026-05-21
> 상위: [`plan/complete/external-interaction-api.md`](../complete/external-interaction-api.md) §"완료 후 잔여"
> 관련 spec: [`spec/5-system/14-external-interaction-api.md`](../../spec/5-system/14-external-interaction-api.md) §3.3 EIA-AU-04 / §8.3

## 배경

PR2 (#230) 의 P6 `NotificationFanout` 은 terminal event (`execution.completed`/`failed`/`cancelled`) 발송 시 해당 execution 의 `iext_*` 토큰을 즉시 invalidate 해야 한다는 spec §EIA-AU-04 의무를 v1 에서 **exp 자연 무효화로 충족** 했다 — execution 종료 후에도 iext 의 ttl (default 1h) 까지는 토큰이 valid 한 상태로 남는다.

본 plan 은 그 잔여 위험을 해소: terminal 이벤트 시 jti 를 추적해 `iext:blacklist:<jti>` 에 즉시 등록.

## 결정 사항 (사용자 합의 필요)

- [ ] **저장 위치**: (a) Execution 엔티티에 발급된 jti list 컬럼 (`iext_jtis TEXT[]`) / (b) 별도 테이블 `execution_token` (PK = jti, FK = execution_id) / (c) Redis SET `exec:jtis:<id>` (영속성 없음, terminal hook 시 잃을 위험)
- [ ] **refresh 시 jti 갱신**: refresh-token endpoint 호출 시 old jti blacklist + new jti 추가. 모두 동일 execution 의 list 에 기록.
- [ ] **revoke 시점**: terminal event emit 직후 (NotificationFanout 의 handle() 안) — Spec EIA-AU-04 "즉시" 의무.

## 관련 문서

- [Spec EIA §3.3 EIA-AU-04](../../spec/5-system/14-external-interaction-api.md) — terminal 시 즉시 blacklist 의무
- [Spec EIA §8.3](../../spec/5-system/14-external-interaction-api.md) — 토큰 family 분리
- `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts` — fanout 위치, v1 은 TODO 주석
- `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `revokePerExecution` 이미 구현됨, 호출만 누락

## 진행 메모 (2026-05-29)

PR-E1 (#237) 이 인프라 전체 — V060 migration / `ExecutionToken` entity / `InteractionTokenService.{issue,refresh,revokeAll}PerExecution` / 모듈 등록 / 단위 테스트 — 를 이미 main 에 머지함. 결정 사항은 (b) `execution_token` 테이블로 확정·구현됨.

**그러나 잔여 버그 발견**: `NotificationFanout.handle()` 에서 terminal revoke (`revokeAllForExecution`) 호출이 `notification` config / subscribed 게이트의 **early return 뒤**에 위치 → `interaction.enabled=true` 이면서 `notification` 미설정 (per_execution 기본 시나리오) 트리거는 종료 시 토큰이 **전혀 invalidate 되지 않음**. EIA-AU-04 (필수) 미충족 — plan 이 해소하려던 바로 그 잔여 위험이 남아 있었음. `NotificationFanout` 에 단위 테스트가 0건이라 미검출.

**조치**: revoke 호출을 triggerId 확인 직후·notification 게이트 위로 hoist (notification 설정과 독립). `NotificationFanout` 단위 테스트 신설로 회귀 방지. e2e (terminal → 401) 추가.

## 작업 단위

### 1. 결정 사항 합의 — ✅ (b) execution_token 테이블로 확정 (PR-E1 #237)

위 (a)/(b)/(c) 선택 — 권장: (b) `execution_token` 테이블. Execution row 자체를 update 하지 않아 row 크기 폭주 회피. FK CASCADE 로 cleanup 자동.

### 2. Migration — ✅ (PR-E1 #237)

- [x] V060 — `execution_token` 테이블 신설 (`V060__execution_token_jti_tracking.sql`)
  - `jti TEXT PRIMARY KEY` / `execution_id UUID NOT NULL REFERENCES execution(id) ON DELETE CASCADE`
  - `issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` / `exp_at TIMESTAMPTZ NOT NULL`
  - 인덱스: `idx_execution_token_execution_id (execution_id)`

### 3. 백엔드 구현 — ✅

- [x] `InteractionTokenService.issuePerExecution` — jti 발급 후 `execution_token` INSERT (PR-E1)
- [x] `InteractionTokenService.refreshPerExecution` — old jti blacklist + old row 삭제 + new jti INSERT (PR-E1)
- [x] `NotificationFanout.handle` — terminal event 시 `revokeAllForExecution` 호출. **본 PR 에서 notification config / triggerId 게이트 위로 hoist** 해 interaction-only 트리거도 EIA-AU-04 충족 (PR-E1 의 잔여 버그 수정)
- [x] 단위 테스트: 발급/refresh/terminal blacklist 흐름 (token spec) + `NotificationFanout` spec 신설(게이트·라이프사이클) + `InteractionGuard` blacklisted→401 매핑
- [x] ~~e2e~~ → **결정적 단위 테스트 4-seam 체인으로 대체**: fanout terminal→`revokeAllForExecution` (fanout spec) → Redis blacklist SET (token spec) → `verifyPerExecution` blacklisted (token spec) → guard 401 `TOKEN_REVOKED` (guard spec). async 실행엔진+fanout 타이밍 의존 e2e 는 flaky 하고 기존 `external-interaction.e2e-spec.ts` 의 "async dispatch 미검증" 설계와도 상충 — 단위 체인이 더 결정적. 기존 e2e 127건 회귀 0 확인

### 4. 검증 — ✅

- [x] backend lint + unit(5016) + build(docker 포함) + e2e(127)
- [x] `/ai-review` — router 가 6 reviewer 선별(security/requirement/scope/side_effect/maintainability/testing). Critical 0, Warning 조치 완료. SUMMARY/RESOLUTION: `review/code/2026/05/29/00_41_07/`

## 수용 기준 — ✅

- [x] terminal event emit 시 해당 execution 의 모든 iext_* 즉시 invalidate (notification 설정·triggerId 유무 무관)
- [x] refresh 흐름에서 old jti 즉시 blacklist
- [x] execution CASCADE delete 시 execution_token 자동 정리 (V060 FK)

## Follow-up

- `plan/in-progress/spec-fix-eia-token-error-codes.md` — ai-review 가 발견한 spec §5.1 토큰 에러 코드 갭(`TOKEN_REVOKED` 누락, `SCOPE_MISMATCH` 403/401 불일치) + terminal revoke 신뢰성(outbox/fail-open 정책) 명시 → project-planner.
