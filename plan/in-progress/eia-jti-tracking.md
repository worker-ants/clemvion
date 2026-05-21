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

## 작업 단위

### 1. 결정 사항 합의

위 (a)/(b)/(c) 선택 — 권장: (b) `execution_token` 테이블. Execution row 자체를 update 하지 않아 row 크기 폭주 회피. FK CASCADE 로 cleanup 자동.

### 2. Migration

- [ ] V0XX (V059 다음 슬롯) — `execution_token` 테이블 신설
  - `jti TEXT PRIMARY KEY`
  - `execution_id UUID NOT NULL REFERENCES execution(id) ON DELETE CASCADE`
  - `issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `exp_at TIMESTAMPTZ NOT NULL` — jti exp 의 ISO timestamp
  - 인덱스: `(execution_id)` 단일

### 3. 백엔드 구현

- [ ] `InteractionTokenService.issuePerExecution` — jti 발급 후 `execution_token` INSERT
- [ ] `InteractionTokenService.refreshPerExecution` — old jti blacklist + new jti INSERT (단일 트랜잭션)
- [ ] `NotificationFanout.handle` — terminal event 시 해당 execution 의 모든 jti 조회 + `revokePerExecution` 호출 (ttl = max(exp - now, 1))
- [ ] 단위 테스트: 발급/refresh/terminal blacklist 흐름 cover
- [ ] e2e: terminal 후 같은 iext_* 로 interact 호출 시 401 TOKEN_REVOKED

### 4. 검증

- [ ] backend lint + unit + build + e2e
- [ ] `/ai-review` (작은 변경이라 router 가 보통 testing + security + database 만 선별)

## 수용 기준

- terminal event emit 후 1초 이내 해당 execution 의 모든 iext_* 가 invalidate
- refresh 흐름에서 old jti 즉시 blacklist
- execution CASCADE delete 시 execution_token 자동 정리
