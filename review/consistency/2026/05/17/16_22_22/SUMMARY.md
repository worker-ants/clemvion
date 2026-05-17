# Consistency Check (impl-prep) 통합 보고서

**Scope**: `spec/data-flow/` 전체. dismiss endpoint 구현 착수 직전 검토.

**BLOCK: PARTIAL** — Critical 3건 중 C-3 만 본 dismiss 작업의 차단 사유 (해소 후 진행). C-1·C-2 는 **사전 결함** 으로 본 작업과 의존성 없음 (dismiss 는 HTTP REST 전용, WebSocket emit 없음). 별도 follow-up plan 으로 분리.

---

## Critical 위배

| # | Checker | 위배 | 본 작업 영향 | 조치 |
|---|---------|------|--------|------|
| C-1 | Cross-Spec | WebSocket 이벤트명 `notification:new` (8-notifications.md) vs `notification.new` (6-websocket-protocol.md §4.4) | **없음** — dismiss endpoint 는 HTTP REST 만, WebSocket emit 안 함. follow-up phase (spec §4.6) 에서 함께 검토 | `plan/in-progress/notification-websocket-name-sync.md` 신설로 분리 |
| C-2 | Cross-Spec | WebSocket 채널명 `user:<userId>` (8-notifications.md) vs `notifications:{userId}` (6-websocket-protocol.md §4.4) | **없음** — 같은 이유 | 동일 plan 으로 분리 |
| C-3 | Convention Compliance | `8-notifications.md §2.1` 표의 마이그레이션 번호 `V<NNN>` / `V<NNN+1>` placeholder — 본 dismiss 작업이 도입한 placeholder | **있음** — spec 본문이 latest 상태를 기술해야 하므로 실제 번호 확정 필요 | `ls backend/migrations/` 결과 V054 가 현행 최신. spec 의 V`<NNN>`/`<NNN+1>` 을 `V055` / `V056` 으로 확정. 본 작업 안에서 즉시 해소 |

## Warning — 본 작업과 직접 관련된 것만

| # | Checker | 위배 | 본 작업 처리 |
|---|---------|------|---------|
| W-9 | Naming Collision | `hasRecentByResource` mock 누락 (SUMMARY W-75) | dismiss 신규 메서드 mock 추가 시 같이 보강 |
| W-8 | Naming Collision | V052 (integration_action_required CHECK) 마이그레이션 존재 확인 | `ls backend/migrations/ \| grep V052` 로 확인 — V052 존재 (`V052__notification_type_integration_action_required.sql`). 해소. |

본 작업 영역 밖 Warning (W-1 `integration_action_required` 행 미등재, W-2 `notification_preferences` 컬럼 표 누락, W-3 `5-integration.md §1.4` 알림 경로 누락, W-4 도메인 카운트 13→12, W-5 링크 텍스트, W-6 상태 전이 분리, W-7 Swagger 헬퍼 spec 혼입, W-10 cafe24-token-refresh 큐 미등재, W-11 cafe24 notification.md 명칭 혼동) 은 모두 사전 결함 또는 spec 정비 사항. follow-up plan `plan/in-progress/data-flow-spec-housekeeping.md` (별도) 으로 분리. 본 dismiss 작업의 의존 사항 아님.

## 결정

C-3 즉시 해소 + W-9 자연 흡수. C-1·C-2 + 나머지 Warning 은 분리 plan 으로 follow-up. 본 dismiss 구현 진행.

---

## 출처

- Checker 상세: `cross_spec.md` · `rationale_continuity.md` · `convention_compliance.md` · `plan_coherence.md` · `naming_collision.md`
- 원본 sub-agent 응답: stdout (system policy 로 sub-agent file Write 차단된 상태에서 main 이 직접 작성)
