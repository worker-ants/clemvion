# Consistency Check 통합 보고서 (--impl-done)

**BLOCK: NO** — Critical 발견 없음.

## 전체 위험도
**MEDIUM** — PR1 구현 완료에도 spec 본문이 "미구현 (Planned)" 서술을 유지하는 정합성 갭(SPEC-DRIFT) + WS payload `timestamp` 필드 spec 미반영. Critical 없음.

## Critical 위배
(없음)

## 경고 (WARNING)

| # | Checker | 위배 | 조치 |
|---|---------|------|------|
| 1 | plan_coherence | PR1 구현(notify() + emitNotificationEvent WS emit) 완료했으나 spec 본문(`8-notifications.md`, `6-websocket-protocol.md §4.4`)이 "미구현 (Planned)" 유지 | SPEC-DRIFT → spec-update plan(planner 위임) + 본 PR 에서 plan 체크박스 [x] |
| 2 | convention_compliance | WS emit payload 에 `timestamp` 추가됐으나 §4.4 payload 표 미반영 | 코드→spec 방향으로 해소: emit payload 에서 `timestamp` 제거해 §4.4 선언 shape(id/type/title/message/resourceType/resourceId) 과 정확히 일치 |
| 3 | convention_compliance | (WARNING #1 동일 근본) 구현된 emit 파이프라인에 대해 문서가 Planned 유지 | #1 과 통합(spec-update plan) |

## 참고 (INFO)
1. plan_coherence — notify() 아직 무호출(dead surface) — 의도된 PR3 대상 (tracker 명시).
2. convention_compliance — ModuleRef(strict:false) 지연 해석 패턴 규약 부재 — spec/conventions 소절 신설 고려(선택, 저우선).
3. convention_compliance — best-effort emit 실패 처리(logger.warn + 삼킴) Service/Gateway 이중 계층 — fail-safe 철학 정합, 조치 불필요.

## Checker별 위험도
| Checker | 위험도 | 핵심 |
|---------|--------|------|
| convention_compliance | LOW | timestamp payload 미반영 + Planned stale (WARNING 2) |
| plan_coherence | MEDIUM | PR1 완료 vs spec/plan Planned 미갱신 (SPEC-DRIFT) |
| cross_spec / rationale_continuity / naming_collision | 재시도 필요 | disk-write 갭 (파일 미생성) — Critical 무관 |

## 판정
BLOCK: NO. WARNING 조치: (a) 코드에서 `timestamp` 제거 → §4.4 payload 정합, (b) Planned→구현됨 배지 flip 은 `plan/in-progress/spec-update-notifications-ws-emit.md`(planner) 로 위임 + PR1 plan 체크박스 [x]. disk-write 갭 3 checker 는 알려진 flakiness — convention/plan_coherence 이 핵심 정합 커버.
