BLOCK: NO

# Consistency Check Round 3 — chat-channel outbound 회귀 spec draft

**위험도**: MEDIUM — Critical 없음. WARNING 5건은 draft 내부 정합 위주 (스테일 텍스트·동반 갱신 명시 누락). spec PR 전 draft 보강만으로 해소.

## Critical
없음 (Round 1 의 4 CRITICAL + Round 2 의 2 CRITICAL 모두 해소 — revision 3 반영).

## WARNING (5건)

| # | 위배 | 해소 위치 | 본 revision 반영 |
|---|---|---|---|
| W-1 | `renderPresentationNode` 잔존 (영향 평가 항) — 6함수 유지 결정과 모순 | draft §영향 평가 | ✓ revision 3 에서 `renderNode` union 확장 표현으로 교체 |
| W-2 | §1 interface `ChatChannelAdapter` 블록의 `renderNode` JSDoc 보강 누락 | draft §A §1.1 | ✓ revision 3 에서 "동반 갱신" 노트 추가 |
| W-3 | §1.3 주석에 `WebsocketService.executionEvents$` Subject 이름 직접 노출 — CCH-AD-05 facade 추상화 수준 충돌 | draft §결정 1 | ✓ revision 3 에서 "R8 fan-out 경로" 추상화 표현으로 정정 |
| W-4 | EIA-RL-04 보장 근거의 귀속 모호 (실행 엔진 §4.4 vs NotificationDispatcher) | draft §결정 1 | ✓ revision 3 에서 "NotificationDispatcher / WebsocketService 단일 sink" 명시 |
| W-5 | `telegram.md §5.4` 동반 갱신 의무가 갱신안 본문에 미정의 | draft §Spec 갱신안 | ✓ revision 3 에서 §E 항목 신설 |

## INFO (12건 — 권고)

- I-1 ~ I-5: telegram.md §7 표현·R10 문체·per-trigger registry·R10 어휘 — 표현 수준 보강 권고
- I-6: frontmatter `type: spec-draft` 가 plan-lifecycle.md §4 공식 스키마 외 — 운영 차단 아님
- I-7 ~ I-9: §3 표 헤더·CCH-MP-01 "교체" 명시·R10 보강 분류 명시 권고
- I-10: R-CC-13 위치 main HEAD 재확인 권고
- I-11: `execution.node.completed` 이벤트명 WS §4.4 / EIA §5 와 동일 — 의도된 재사용. 주석 권고
- I-12: stale worktree 6건 정리 권고

## Checker 별 위험도

| Checker | Risk |
|---|---|
| Cross-Spec | LOW |
| Rationale-Continuity | MEDIUM |
| Convention-Compliance | MEDIUM |
| Plan-Coherence | LOW |
| Naming-Collision | LOW |

## 결정

**BLOCK: NO** — spec 본문 반영 진행 허용.

Round 1 / Round 2 의 CRITICAL 6건은 revision 3 에서 모두 해소. Round 3 의 WARNING 5건도 draft 내 정합 보강으로 해소 완료. INFO 12건은 spec 반영 시점에 작은 표현 정리로 흡수 가능 (별도 차단 사유 아님).
