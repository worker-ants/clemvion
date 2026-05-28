# Code Review 통합 보고서

커밋: `840db52d` — fix(external-interaction): terminal jti revoke 를 notification config 게이트 위로 hoist

대상 파일:
- `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts`
- `codebase/backend/src/modules/external-interaction/notification-fanout.service.spec.ts`
- `codebase/backend/src/modules/external-interaction/interaction.guard.spec.ts`

## 전체 위험도

**MEDIUM** — EIA-AU-04 핵심 버그 픽스는 올바르나, triggerId 없는 terminal event 에서 revoke 가 여전히 skip 되는 경로와 spec §5.1 에러 코드 불일치가 미결.

## Critical

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `triggerId` 없는 terminal event 에서 revoke skip. spec EIA-AU-04 는 triggerId 조건 없음 | `notification-fanout.service.ts` triggerId guard 직후 | triggerId early-return 위로 terminal revoke 호출. 해당 경로 테스트 추가 |
| 2 | 요구사항 | spec §5.1 에러 표에 `TOKEN_REVOKED` 누락, `SCOPE_MISMATCH` 403(spec) vs 401(impl) 불일치 | `interaction.guard.ts` `mapReason()` + spec §5.1 | project-planner 위임 (follow-up plan) |
| 3 | 보안 | `revokeAllForExecution` fail-open — Redis/DB 장애 시 토큰 최대 1h 유효. 노출 빈도 증가 | catch 블록 | 실패 에스컬레이션(알람) / 정책 spec 명시 |
| 4 | 보안 | 테스트 픽스처 `itk_secret` 리터럴이 실값처럼 보임 (기존 코드) | `interaction.guard.spec.ts` | 목적 명확한 이름 권장 (블로커 아님) |
| 5 | 테스트 | `onModuleInit`/`onModuleDestroy` 구독 라이프사이클 미커버 | `notification-fanout.service.spec.ts` | subscribe/unsubscribe 케이스 2건 추가 |
| 6 | 테스트 | 일부 조합 케이스 갭 | spec 파일 | 조합 케이스 추가 권장 |
| 7 | 유지보수성 | 단일 `describe` 그룹화 부재 | spec 파일 | 중첩 describe (선택) |

## 참고 (INFO) 주요 항목

- INFO#6 (요구사항): EIA-AU-04 "즉시 invalidate" 가 NotificationFanout 단일 RxJS 구독에 의존 — process 재시작 시 in-flight terminal event 소실 가능. outbox/after-commit 검토 (§3.4/§9.3 spec 명시) → project-planner.
- security: 핵심 수정 방향 올바름, OWASP A07(broken auth) 부분 해소.
- scope: 범위 이탈 없음 (NONE).

## 에이전트별 위험도

| 에이전트 | 위험도 |
|----------|--------|
| security | LOW |
| requirement | MEDIUM |
| scope | NONE |
| side_effect | LOW |
| maintainability | LOW |
| testing | LOW |

## 라우터 결정

`routing_status=done`. 실행 6명: security, requirement, scope, side_effect, maintainability, testing (전원 router_safety 강제 포함).

제외 8명: performance / architecture / documentation / dependency / database / concurrency / api_contract / user_guide_sync — 변경이 내부 service 로직 재정렬 + 테스트 신설에 한정되어 해당 관점 무관으로 판정.

> **주의**: database·concurrency reviewer 가 skip 됨. revoke 호출 위치 이동에 따른 추가 쿼리 빈도(W1 해소 시 모든 terminal event 에서 execution_token SELECT)는 본 리뷰에서 깊게 검토되지 않음 — empty-result 시 단일 인덱스 lookup 으로 제한해 완화.
