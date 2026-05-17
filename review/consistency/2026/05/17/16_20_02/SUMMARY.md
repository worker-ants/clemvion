# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도

**MEDIUM** — Spec과 구현 사이의 Socket.IO 관련 다중 drift(WARNING 6건), 동일 파일 동시 수정 경합 위험(plan_coherence WARNING 2건) 존재. 그러나 작동 불가 수준의 충돌 없음. 본 PR 범위(`apply-execution-snapshot.ts` ai_conversation 분기 hydration)와는 모두 무관.

## Critical 위배 (BLOCK 사유)

없음.

## 본 PR 범위와 직접 관련된 발견

- **I-10 (naming_collision)** — `parseHistoryMessages` 임포트 경로. canonical lib 경로 `@/lib/conversation/conversation-utils` 에서 직접 임포트해야 함. 컴포넌트 경로(`@/components/editor/run-results/conversation-utils`) 사용 금지.
- **I-11 (rationale_continuity)** — `apply-execution-snapshot.ts:223-227` ai_conversation 분기의 `setConversationMessages` 미호출은 이번 plan 이 처리하는 정확히 그 항목. 수정 후 spec §Rationale 에 "WS/REST 두 경로 messages 시드 동등 원칙" 추가는 project-planner 위임.

## 본 PR 범위 외 발견 (메모만)

WARNING 6건 (W-1 ~ W-6) 과 INFO 12건은 모두 본 변경 범위 밖이며 별도 plan/project-planner 위임 대상:

| # | 분류 | 요지 |
|---|------|------|
| W-1 | cross_spec / rationale | Socket.IO `auth.token` 방식이 spec §1.2 두 방식 중 어느 것도 아님 |
| W-2 | cross_spec / rationale | `auth.refresh` WS 메시지 미사용 — 재연결 패턴으로 대체 |
| W-3 | rationale | `transports: ["websocket","polling"]` 폴백이 spec 범위 밖 |
| W-4 | cross_spec | `execution.waiting_for_input` payload 필드명 불일치 (`waitingNodeId` vs spec `nodeId`) |
| W-5 | plan_coherence | `use-execution-events.ts` 동시 수정 경합 (`ai-thread-source-mark.md` Phase 3) — 본 PR 은 해당 파일을 수정하지 않으므로 영향 없음 |
| W-6 | plan_coherence | `full-review-fixes-a1b2c3` CORS W-1 미해결 결정 — frontend client 재수정 가능성 |
| I-1 ~ I-9 | cross_spec / convention | `execution.snapshot`·`execution.resumed`·payload 필드 등 spec 미등재 항목 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec §4.4 payload 필드명 drift, snapshot/resumed 이벤트 미등재 |
| rationale_continuity | LOW | Socket.IO Rationale 부재 3건 |
| convention_compliance | LOW | 모두 INFO |
| plan_coherence | MEDIUM | W-5·W-6 — 본 PR 범위와는 무관 |
| naming_collision | NONE | I-10 임포트 경로만 |

## 구현 착수 시 가드

1. `parseHistoryMessages` 를 `@/lib/conversation/conversation-utils` 에서 임포트 (컴포넌트 경로 X) — **I-10**.
2. `setConversationMessages` 시드는 store 가 비어있을 때만 (WS 이벤트로 이미 채워졌다면 덮어쓰지 않음) — `use-execution-events.ts:233-269` 패턴과 동등.

## 권장 후속 (별도 plan)

- W-1·W-2·W-3·W-4 → spec §1.1·§1.2·§1.3·§4.4 와 실제 구현 패턴 일치화 (project-planner 위임).
- I-1 ~ I-3 → spec §4.1·§4.4 에 누락 이벤트·필드 등재.
- W-5 → `ai-thread-source-mark.md` 진행 상태 확인 후 plan 정리.
