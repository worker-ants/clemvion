---
worktree: (TBD)
started: 2026-05-23
owner: project-planner
---

# spec drift: WS Protocol `buttonConfig.timeout` · `nodeOutput.type` — Presentation 공통 규약과 직접 모순

## 발견 출처

- 검토 세션: `review/consistency/2026/05/23/10_28_45/SUMMARY.md` (BLOCK: YES, C2 + C3)
- consistency-check `--impl-prep spec/4-nodes/` 결과 — 본 worktree (`render-presentation-button-click-fix-683f3a`) 와 직접 무관해 분리 plan 으로 격리.

## 위배 요지 1 — `buttonConfig.timeout` / `timeoutAction` (C2)

- `spec/5-system/6-websocket-protocol.md §4.4` — `buttonConfig: { timeout: 300, timeoutAction: "cancel" }` 예시
- `spec/4-nodes/6-presentation/0-common.md §3·§6.1` — "버튼 클릭 시까지 무제한 대기 (외부 cancel/종료 외에는 타임아웃 없음)"

## 위배 요지 2 — `buttonConfig.nodeOutput.type` 판별자 (C3)

- `spec/5-system/6-websocket-protocol.md §4.4` — `buttonConfig.nodeOutput: { "type": "carousel", ... }` 예시
- `spec/4-nodes/6-presentation/0-common.md §4` — "노드 판별용 `type:` 래퍼는 사용하지 않는다 (Principle 1.1.4)"

## 해결 방향 (project-planner 결정 필요)

### C2
- (A) WS spec §4.4 예시에서 `timeout` / `timeoutAction` 제거 (현 구현·다른 spec 모두 무제한 대기를 따르므로 spec 예시만 stale).
- (B) Presentation 공통 규약 §3 에 타임아웃 정책 공식 도입 + 모든 관련 노드 spec 일괄 갱신.

(A) 가 자연스러움.

### C3
- (A) WS spec §4.4 의 `nodeOutput` 예시에서 `type` 판별자 제거 + 실제 output shape 으로 교체.
- (B) `nodeOutput` 별도 스키마를 Presentation 공통 규약 §7 에 명시.

(A) 가 자연스러움.

## 관련 후속

- 동일 SUMMARY 의 W3 (`buttonConfig` 레이어 기술 혼용 — `config.buttonConfig` vs WS payload top-level) 도 함께 명료화 권고.

## 처리 우선순위

MEDIUM — Presentation 영역과 직접 인접하나 본 fix (frontend isSelected 가드 + backend normalizeButtonIds) 와는 독립. WS protocol spec 차기 갱신 시 묶어 처리.
