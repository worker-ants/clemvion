---
worktree: followup-conversation-reconcile
branch: worktree-followup-conversation-reconcile
status: in-progress
---

# conversation reconcile 후속 (PR #428 ai-review INFO 처리)

PR #428(user 발화 버블 중복 수정) 머지 후, RESOLUTION.md 의 보류·후속 항목 처리.
사용자 지시: "전부 진행".

## 조사 결과 (영향 범위 판정)

- **I-1 (서버 에러 toast 노출)**: backend 가 이미 에러를 큐레이션함
  (`InvalidExecutionStateError`/`RetryLastTurnError` — `error.message` 는 하드코딩
  user-facing, 내부 ID·detail 은 server-log 전용). 즉 "내부 실행 ID 노출" 은 현재
  실제로 발생하지 않음. 프론트 `InteractionAck` 는 `{ success, error? }` 로
  errorCode 필드가 없어, 완전한 errorCode→i18n 매핑은 ack 계약(backend+spec+
  frontend) 변경이 필요한 별도 cross-stack 작업. 보안 결함이 아니므로 본 PR 범위
  밖 — 별도 enhancement 후보로 기록.
- **I-3 (raw LLM payload)**: `llmCalls[].requestPayload/responsePayload` 는 의도된
  개발자 디버그 surface (LLM Information 패널). 코드 버그 아님 — spec 문서화 갭 +
  접근제어(제품 결정). spec 에 현재 계약/주의를 명문화하되 redaction/접근제어
  정책은 제품 결정이라 발명하지 않음 (open item 으로 표기).

## Phase A — spec 명문화 (project-planner) ✅
- [x] I-4/I-15: conversation-thread.md §9.7 `user_message` 행 stamp-reconcile 명문화
  (식별자 비노출, 동작만) + 6-websocket-protocol.md §4.4 Reconciliation 노트 동반 갱신
- [x] I-3: 6-websocket-protocol.md §4.4 `llmCalls[]` raw payload 노트 + Rationale 항목
  (접근제어/마스킹은 open item — 정책 발명 X)
- [x] consistency-check --spec: 1차 BLOCK:YES(frontmatter 누락 등) → 수정 →
  재검 BLOCK:NO (review/consistency/2026/06/03/08_04_41/SUMMARY.md)
- [x] (INFO I-5) fix-duplicate-user-bubble.md → plan/complete/ 이동

## Phase B — 방어 테스트·리팩토링 (developer)
- [ ] I-7: `appendOptimisticUserMessage` 의 reconcile 매칭을 순수 헬퍼
  (`findReconcilableOptimisticIdx` 등) 로 분리
- [ ] I-5/I-13: `receivedAt=""` + optimisticPending 버블 조합 방어 테스트
- [ ] I-6: 동일 content 연속 전송 시 trade-off(첫 pending 흡수) 동작 테스트
- [ ] TEST WORKFLOW (lint·unit·build·e2e)
- [ ] /ai-review + SUMMARY + fix

## 보류·후속 (별도 PR/이슈 후보)
- I-1 errorCode→i18n ack 계약 cross-stack enhancement (보안 결함 아님, 낮은 우선순위)
- I-3 LLM Information 패널 접근제어 (제품 결정 필요)
