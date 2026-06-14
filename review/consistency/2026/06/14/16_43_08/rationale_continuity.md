# Rationale 연속성 검토 결과

## 발견사항

발견된 CRITICAL 또는 WARNING 항목 없음.

### [INFO] `reconcile()` fail-open vs `onModuleInit()` fail-fast 의 비대칭 — Rationale 명시 보완 제안
- target 위치: `terminal-revoke-reconciler.service.ts` `onModuleInit()` (no try/catch → propagates) vs `reconcile()` (try/catch → swallow)
- 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` `## Rationale R15` — "잔여 위험: sweep 도 Redis(BullMQ) 장애 시 다음 tick 까지 지연"
- 상세: `onModuleInit()`은 scheduler 등록 실패 시 에러를 전파해 부팅을 차단한다(fail-fast). `reconcile()` / `process()`는 sweep 실행 실패를 swallow 한다(fail-open). 이 비대칭은 테스트("Redis 장애 시 fail-fast (부팅 거부)")로 의도가 확인되지만, R15 본문에는 sweep 자체의 fail-open 동작은 기록돼 있어도 scheduler 등록 실패의 fail-fast 정책은 명시되어 있지 않다.
- 제안: R15 의 잔여 위험 문단 끝에 "scheduler 등록(onModuleInit) 실패는 서버 부팅을 차단한다 — sweep 기반 durable 보강이 구조적으로 결여된 상태로 부팅하지 않음을 보장하기 위함" 한 줄 추가로 비대칭 의도를 명문화한다.

---

## 요약

이번 구현 변경(diff `fc5d832b...HEAD`)은 EIA §3.4 EIA-RL-06 의 terminal token revoke at-least-once 보강을 위해 `TerminalRevokeReconcilerService`(BullMQ repeatable scheduler)와 `InteractionTokenService.reconcileTerminalRevocations()`를 추가한다. 검토 결과, R15 에서 명시적으로 기각한 "전용 outbox 테이블 신설"을 채택하지 않고 `execution_token` 을 implicit outbox source 로 사용하는 방식을 그대로 따랐으며, R10 의 단일 sink + facade 계층 원칙, R15 의 BullMQ repeatable 전역 1회 패턴(login-history-pruner 선례), R2/R5 의 채널 분리 원칙을 모두 위반하지 않는다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회는 발견되지 않았다. INFO 등급의 Rationale 기술 보완 제안 1건이 있다.

## 위험도

NONE
