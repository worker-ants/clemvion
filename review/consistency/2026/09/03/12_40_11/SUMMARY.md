# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 CRITICAL/WARNING 0건. INFO 4건만 존재.

## 전체 위험도
**LOW** — WS `auth.token_expired` 타이머 하드닝 리팩터(3파일/248줄)는 wire 계약·spec 계약을 바꾸지 않으며, 실질 위반 없이 스타일/문서 수준 INFO 관찰만 남음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 신규 상수 `MSG_AUTH_TOKEN_EXPIRING`(진행형)이 같은 파일의 이벤트 타입 `AUTH_TOKEN_EXPIRED`(완료형)와 시제 불일치 | `codebase/backend/src/modules/websocket/websocket-events.types.ts:314` | 필수 아님. 후속 정리 시 `MSG_AUTH_TOKEN_EXPIRED` 또는 `MSG_AUTH_TOKEN_EXPIRY_NOTICE` 로 시제 정렬 고려 |
| 2 | convention_compliance | `changePassword` 엔드포인트의 `@ApiUnauthorizedResponse` 설명이 신규 분기된 두 401 사유(`PASSWORD_REQUIRED` vs `PASSWORD_INVALID`)를 구분하지 않음 | `codebase/backend/src/modules/users/users.controller.ts` `POST /users/me/change-password` | description 에 두 코드를 명시하거나 spec §2.3 note 링크 추가. developer 턴에서 조치 가능 |
| 3 | convention_compliance | `spec/5-system/2-api-convention.md` 에 `## Overview` 헤더 부재(기존 구조, 이번 diff 대상 아님) | `spec/5-system/2-api-convention.md` 최상단 | 이번 PR 조치 대상 아님. 별도 문서 정리 turn 에서 헤더 신설 고려 |
| 4 | plan_coherence | "배포 런북" 참조가 plan 에 3건 누적됐지만 그런 실체 문서가 저장소에 없음(현재는 plan 자체가 트래커 역할) | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` | 차단 사유 아님. 운영 위험 deferral 이 더 늘면 별도 ops 문서로 수렴 고려 |
| 5 | naming_collision | 신규 `MSG_AUTH_TOKEN_EXPIRING` 이 `MSG_` 접두인데 기존 message-constant 관례는 `_MESSAGE` 접미(공식 규약 부재, 표본 2건뿐) | `codebase/backend/src/modules/websocket/websocket-events.types.ts:314` | 강제 아님. 다음 접촉 시 `AUTH_TOKEN_EXPIRING_MESSAGE` 로 접미 통일 고려 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | wire 계약(이벤트명·payload shape·60초 리드타임) 불변, `token_expired` 네임스페이스(Integration.status_reason)와 spec 이 이미 분리 확인. INFO 1건(상수 시제) |
| Rationale Continuity | NONE | `R-ws-socket-lifetime-binds-token` 결정 유지, 기각된 3대안 재도입 없음, `unref()`↔shutdown drain(§11) 레이어 분리로 충돌 아님, 트레이드오프는 개발자가 자체 문서화 |
| Convention Compliance | LOW | error-codes.md/audit-actions.md/swagger.md 패턴 준수. INFO 2건(Swagger 401 설명 미분화, 무관한 기존 구조 이슈) |
| Plan Coherence | LOW | 5개 미완 항목 모두 명시적 deferral(planner 턴/결정 필요)로 lifecycle 규칙상 in-progress 잔류 정상. INFO 1건(배포 런북 미실체화) |
| Naming Collision | NONE | 신규 식별자 2개(`MSG_AUTH_TOKEN_EXPIRING`, `clearExpiryTimers`) 전체 backend 유일 정의, 기존 요구사항ID/엔티티/endpoint/이벤트명/ENV/경로 어느 축과도 충돌 없음. INFO 1건(명명 접두/접미 스타일) |

## 권장 조치사항
1. (선택, developer 턴) `users.controller.ts` 의 `changePassword` `@ApiUnauthorizedResponse` description 을 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 두 코드로 명시 분리.
2. (선택, 후속 정리) `MSG_AUTH_TOKEN_EXPIRING` 명명을 이벤트 타입 시제(`AUTH_TOKEN_EXPIRED`) 또는 프로젝트 관례(`_MESSAGE` 접미)에 맞춰 재고려 — 둘 중 하나만 적용해도 충분, 필수 아님.
3. (보류) `spec/5-system/2-api-convention.md` `## Overview` 헤더 신설은 별도 문서 정리 turn 으로 이월.
4. (모니터링) `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 의 "배포 런북" 참조 3건 — 실체 문서가 없는 상태이므로 유사 항목이 더 늘면 실제 ops 문서 위치를 하나 정해 수렴.

차단 사유 없음 — 위 4개 INFO 항목은 모두 선택적 후속 조치이며 이번 diff 를 되돌리거나 즉시 수정할 필요는 없다.
