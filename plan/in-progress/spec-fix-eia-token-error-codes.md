---
worktree: TBD
started: 2026-05-29
owner: project-planner
---

# EIA — spec §5.1 토큰 에러 코드 정합 + terminal revoke 신뢰성 명시

> 작성일: 2026-05-29
> 출처: `review/code/2026/05/29/00_41_07/SUMMARY.md` (eia-jti-tracking 구현 중 ai-review 가 발견한 spec 갭)
> 관련 spec: [`spec/5-system/14-external-interaction-api.md`](../../spec/5-system/14-external-interaction-api.md) §5.1 / §3.3 / §3.4 / §9.3

## 배경

`plan/complete/eia-jti-tracking.md` 구현 중 ai-review 가 코드와 spec 본문 간 불일치 2건 + 신뢰성 미명시 1건을 발견. 모두 **spec 수정 영역** (developer 권한 밖) 이라 별도 plan 으로 분리.

## 작업 단위

### 1. spec §5.1 에러 표에 `TOKEN_REVOKED` 추가

- [ ] 현재 구현 `InteractionGuard.mapReason()` 는 blacklisted (terminal revoke) jti 에 대해 `401 TOKEN_REVOKED` 를 반환하나, spec §5.1 에러 표에 해당 코드가 누락. `401 Unauthorized | TOKEN_REVOKED | execution 종료(또는 refresh)로 토큰이 즉시 무효화됨` 행 추가.
- [ ] `X-Refresh-Token-Url` 헤더 동봉 여부도 표/본문에 명시 (현 구현은 동봉).

### 2. `SCOPE_MISMATCH` HTTP status 정합 (spec 403 vs 구현 401)

- [ ] spec §5.1 은 `403 Forbidden | SCOPE_MISMATCH`, 구현·e2e (test D) 는 `401 + TOKEN_SCOPE_MISMATCH`. 둘 중 하나로 통일 결정 필요.
- [ ] 권장: 토큰류 실패는 모두 401 로 통일 (정보 노출 최소화 — §8.2 "algorithm leak 차단" 정신과 일치). 그 경우 spec §5.1 의 403 행을 401 `TOKEN_SCOPE_MISMATCH` 로 수정. 코드명도 `SCOPE_MISMATCH` → `TOKEN_SCOPE_MISMATCH` 로 spec 반영.
- [ ] 결정 후 spec 수정 + (코드명 변경 시) developer 위임으로 guard·e2e 동기화.

### 3. terminal revoke 신뢰성 명시 (EIA-AU-04 vs 단일 RxJS 구독)

- [ ] 현 구현: terminal 토큰 revoke 는 `NotificationFanout` 의 단일 in-memory RxJS 구독 (`executionEvents$`) 에 의존. process 재시작으로 in-flight terminal event 가 소실되면 revoke 누락 → 토큰이 ttl(기본 1h) 까지 잔존.
- [ ] fail-open 정책 (Redis/DB 장애 시 warn 후 진행) 도 spec 에 의도적 트레이드오프로 명시되어 있지 않음.
- [ ] §3.4 / §9.3 에 다음을 결정·명시: (a) at-least-once revoke 보장을 위한 outbox/after-commit 전환 여부, (b) revoke 실패 시 알람 에스컬레이션 정책, (c) 잔여 위험(ttl 단축 등) 허용 범위.
- [ ] 결정이 outbox 전환이면 후속 구현 plan 신설.

## 수용 기준

- spec §5.1 에 `TOKEN_REVOKED` 명시, `SCOPE_MISMATCH` status/code 가 구현과 일치
- terminal revoke 신뢰성·fail-open 트레이드오프가 §3.4/§9.3 에 문서화
- 코드명 변경이 수반되면 guard·e2e 동기화 (developer 위임)
