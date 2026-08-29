# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**NONE** — `websocket-events.types.ts` 의 `NotificationEventType` → `InAppNotificationEventType` 개명(+ re-export 3곳 갱신) 및 export-default 검출 테스트 하드닝뿐인 codebase-only 변경. `spec/**` 는 이 diff 에서 전혀 수정되지 않았고, 5개 checker 전원이 CRITICAL/WARNING 없이 NONE 위험도로 수렴했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `<도메인>EventType` 명명 패턴(`ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`/`KbEventType`/`InAppNotificationEventType`)이 `spec/conventions/**` 에 정식 문서화되어 있지 않음 | `codebase/backend/src/modules/websocket/websocket-events.types.ts` | 강제 조치 불요. 향후 WS 이벤트 관련 convention 문서(예: 신설 `spec/conventions/websocket-events.md` 또는 `spec/5-system/6-websocket-protocol.md` Rationale)에 이 명명 패턴을 한 문단으로 명문화하면 재발 방지에 도움 — project-planner 턴 소관 |
| 2 | plan_coherence | `ws-event-types-extract.md` 의 `plan/complete/` 이동이 `spec/conventions/egress-masking.md:89` dead link 캐비엇 때문에 여전히 막혀 있음 (target `spec/data-flow/` 와 무관, 이번 diff 가 악화시키지 않음) | `plan/in-progress/ws-event-types-extract.md` `## 체크리스트` 마지막 미체크 항목 | 조치 불요 — plan 이 이미 정확히 self-track 중. 다음 planner 턴에서 `egress-masking.md:89` 캐비엇 처리 + `complete/` 이동을 함께 처리 |
| 3 | naming_collision | 신규 식별자 `InAppNotificationEventType` 도입은 기존 동명이의 충돌(`NotificationEventType` vs `triggers/dto/notification-config.dto.ts` 의 동명 타입, `18_53_27` naming W3 로 기등재)을 새로 만든 것이 아니라 **해소**한 것 | `codebase/backend/src/modules/websocket/websocket-events.types.ts`, `websocket.service.ts` | 조치 불요 — 기록 목적. 향후 유사 동명이의 재발 시 같은 disambiguation(도메인 접두 rename) 패턴을 선례로 참조 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/**` 미변경. 개명 대상 식별자는 어느 spec 문서에서도 이름으로 인용되지 않음(전수 grep 0건). 개명은 `notification-config.dto.ts` 동명 타입과의 잠재 오import 위험을 해소하는 방향 |
| rationale_continuity | NONE | spec Rationale 어디에도 이 enum 명명 관련 결정 없음. plan(`ws-event-types-extract.md`)이 이전 세션(`18_53_27`)이 이연해 둔 개명 항목을 근거와 함께 집행한 연속성이 명시적으로 추적됨 |
| convention_compliance | NONE (INFO 1건) | spec/data-flow/** 미변경, 옛 식별자 spec 참조 없음(grep 0건). 개명은 기존 `<도메인>EventType` 패턴을 따름. 다만 그 패턴이 정식 문서화되어 있지 않다는 INFO |
| plan_coherence | NONE (INFO 1건) | 소유 plan 이 diff 내용을 동일 날짜에 "완료"로 정확히 갱신. spec 영향 주장(`spec_impact: none`) 실측 재검증 통과. 별도의 `complete/` 이동 차단은 기존 이슈로 이미 정확히 추적 중 |
| naming_collision | NONE (INFO 1건) | 신규 식별자 `InAppNotificationEventType` 은 전 코드베이스에서 사전 사용례 없이 무충돌. rename 전파 6곳 완전성 확인. 기존 동명이의 위험을 오히려 낮춤 |

## 권장 조치사항
1. (BLOCK 해소 불요 — Critical 없음)
2. project-planner 턴에서 여유 있을 때 `<도메인>EventType` 명명 패턴을 convention 문서로 명문화 (INFO #1)
3. project-planner 턴에서 `egress-masking.md:89` dead link 캐비엇 정리 후 `ws-event-types-extract.md` 를 `plan/complete/` 로 이동 (INFO #2, 이번 PR 과 무관한 선행 이슈)
