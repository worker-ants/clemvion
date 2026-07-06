# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 실질적 CRITICAL/WARNING 급 spec 모순은 없으나, `notification.new` emit 미구현 항목이 자매 plan 문서 2곳에 중복 등재되어 있어 PR1 완료 시 한쪽이 stale 로 남을 위험(WARNING)이 있음. 또한 `convention_compliance` / `naming_collision` 체커 결과 파일이 디스크에 존재하지 않아 재시도가 필요함.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `notification.new` emit 미구현 항목이 두 개의 독립 in-progress plan(`spec-sync-data-flow-8-notifications-gaps.md`, `spec-sync-websocket-protocol-gaps.md`)에 중복 추적됨. PR1 착수 계획은 전자만 갱신 대상으로 명시해, 머지 후 후자가 stale("미구현"으로 방치)로 남을 위험 | `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` | `plan/in-progress/spec-sync-websocket-protocol-gaps.md` §4.4 `notification.new` emit | 두 plan 에 상호 참조 한 줄씩 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 제안 |
|---|---------|------|------|
| 1 | cross_spec | WS emit 도입 시 `notifications:{userId}` channel authorizer 사전 배치 전제(§3.3 Rationale)와 정합 | 통합 테스트로 authorizer 가드 확인. 완료 후 WS §4.4 Planned 배지 정합화 planner 위임 |
| 2 | cross_spec | PR1 완료 시 `spec/data-flow/8-notifications.md` "미구현(Planned)" 배지 2건 stale | 머지 후 planner 세션에서 Planned 배지 제거 + plan 체크박스 처리 |
| 3 | cross_spec | PR3 defer `team_invite` 발사와 초대 RBAC 정합은 현시점 영향 없음 | PR3 착수 시 재검토 |
| 4 | plan_coherence | PR1 emit 인프라가 §4.6 follow-up 전제 일부 충족, 연결 미기재 | PR1 완료 노트에 재사용 가능 한 줄 추가(선택) |
| 5 | (통합) | `convention_compliance`, `naming_collision` output 파일 디스크 미존재 — 내용 검증 불가 | 재시도 또는 직접 Agent fan-out |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | PR1 이 spec 이 이미 명시한 "to-be" 설계를 그대로 구현. 데이터 모델/API/WS 프로토콜 3문서 정합 확인 |
| rationale_continuity | 재시도 필요 | output 파일 디스크 미존재 |
| convention_compliance | 재시도 필요 | output 파일 디스크 미존재 |
| plan_coherence | LOW | notification.new emit gap 자매 plan 2곳 중복(WARNING 1) + §4.6 연결 미기재(INFO 1) |
| naming_collision | 재시도 필요 | output 파일 디스크 미존재 |

## 판정
BLOCK: NO. cross_spec=NONE, plan_coherence=LOW(cross-ref WARNING 만). 재시도 필요 3체커는 디스크-write 갭(알려진 flakiness)이며, 본 변경은 소규모·spec 문서화 to-be 설계 직역이라 진행. WARNING #1 은 착수 시 두 plan 상호 참조로 해소.
