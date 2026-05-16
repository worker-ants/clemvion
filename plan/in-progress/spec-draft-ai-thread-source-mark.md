---
worktree: ai-thread-source-mark-7c4f2a
started: 2026-05-16
owner: planner
status: completed
---

# Spec Draft — AI 대화 메시지 source 마커 (완료, spec 반영됨)

본 draft 는 `/consistency-check --spec` 통과 후 spec/ 본문에 반영 완료.

- 일관성 검토: `review/consistency/2026/05/16/09_42_54/SUMMARY.md` (BLOCK: NO, WARNING 1건 — 모두 §4.4.6 명확화 문장으로 해소)
- 반영된 파일:
  - `spec/5-system/6-websocket-protocol.md` — §4.1 표, §4.4 JSON 예시 두 곳, §4.4 페이로드 필드표, §4.4.6 신규 절(매핑 표 포함), Rationale 신규 항목
  - `spec/conventions/conversation-thread.md` — §5.1 보강 문단, §9 CHANGELOG
  - `spec/3-workflow-editor/3-execution.md` — §8.1 `execution.ai_message` 행 동기화
- 후속: backend·frontend 구현은 `plan/in-progress/ai-thread-source-mark.md` 참조.
