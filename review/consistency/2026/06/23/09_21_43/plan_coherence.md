# Plan 정합성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target 영역: `spec/7-channel-web-chat/`
검토 일시: 2026-06-23

---

## 발견사항

### [INFO] `web-chat-console.md` plan 이 `0-architecture.md` `pending_plans:` 에 미등록
- target 위치: `spec/7-channel-web-chat/0-architecture.md` frontmatter `pending_plans:` 배열
- 관련 plan: `plan/in-progress/web-chat-console.md` (본 worktree에서 신설)
- 상세: `0-architecture.md §4.1`(위젯 동봉·버전잠금)과 `§R8 carve-out`(same-origin 미리보기)은 이번 worktree 커밋(`edc233db`, `1716bc63`)에서 추가된 내용으로 `web-chat-console.md` plan 이 직접 유발한 변경이다. 그러나 `0-architecture.md` frontmatter 의 `pending_plans:` 에는 `channel-web-chat-impl.md`, `channel-web-chat-followups.md`, `fix-webchat-sse-field-map.md`, `webchat-eager-start.md` 만 있고 `web-chat-console.md` 는 없다. `5-admin-console.md` 에는 정상 등록돼 있으나, `0-architecture.md` 도 이 plan 의 영향권이므로 등록이 누락됐다.
- 제안: `spec/7-channel-web-chat/0-architecture.md` frontmatter `pending_plans:` 에 `plan/in-progress/web-chat-console.md` 를 추가한다.

### [INFO] `spec/0-overview.md §8` 문서 맵 갱신 — plan Phase 0 체크박스 미표시
- target 위치: `plan/in-progress/web-chat-console.md` Phase 0 체크박스 (`EDIT spec/0-overview.md §8`)
- 관련 plan: `plan/in-progress/web-chat-console.md` §Phase 0
- 상세: `spec/0-overview.md` 의 문서 맵 행(line 140)이 `5-admin-console.md` 를 포함하도록 이미 갱신됐으나 (`1716bc63` 커밋), plan 의 Phase 0 체크박스 목록에 `EDIT spec/0-overview.md §8` 항목이 `[ ]` 로 남아 있다(완료 표시 미갱신).
- 제안: `plan/in-progress/web-chat-console.md` Phase 0 의 해당 항목을 `[x]` 로 표시하거나, 이번 커밋에서 아직 미완료인 경우 plan 상태를 정확히 반영한다.

### [INFO] `webchat-eager-start.md` "plan complete 이동" 항목이 아직 `in-progress` 유지 중
- target 위치: `spec/7-channel-web-chat/1-widget-app.md`, `3-auth-session.md` frontmatter `pending_plans:`
- 관련 plan: `plan/in-progress/webchat-eager-start.md` (마지막 체크박스 `[ ] plan complete 이동`)
- 상세: `webchat-eager-start.md` 는 구현·테스트·ai-review·consistency-check --impl-done 이 모두 완료됐고 "비차단 backlog 잔여로 in-progress 유지"라는 주석이 있다. target spec 들이 `pending_plans:` 에 이 plan 을 참조하고 있어 `status: partial` 유지의 근거가 된다. 이는 plan-lifecycle 규약의 의도된 동작이며 충돌은 아니다. 다만 비차단 backlog 항목 중 일부가 이미 별도 PR 에서 해소됐으므로(예: M2 firstMessage 잔재 → `rag-webchat-doc-strings` 에서 해소) plan 의 backlog 행을 최신화하면 이력 추적이 명확해진다.
- 제안: `webchat-eager-start.md` backlog 항목 중 해소된 것을 `[x]` 또는 취소선으로 표시(강제 아님, 추적 편의).

### [INFO] `fix-webchat-sse-field-map.md` "plan complete 이동" 항목 동일 패턴
- target 위치: `spec/7-channel-web-chat/0-architecture.md` frontmatter `pending_plans:`
- 관련 plan: `plan/in-progress/fix-webchat-sse-field-map.md` (마지막 체크박스 `[ ] plan complete 이동`)
- 상세: `webchat-eager-start.md` 와 동일한 패턴 — 구현·리뷰·impl-done 전부 완료이나 비차단 followup 때문에 `in-progress` 유지. `0-architecture.md` 의 `pending_plans:` 에 정상 등재돼 있으며 spec `status: partial` 의 한 근거다. 이 plan 이 `complete/` 로 이동하면 `0-architecture.md` frontmatter 도 정합 갱신이 필요하다.
- 제안: 추적 메모 수준. 이동 시 `0-architecture.md` frontmatter 를 동반 갱신할 것.

---

## 요약

`spec/7-channel-web-chat/` target 문서들은 진행 중 plan(`web-chat-console.md`, `channel-web-chat-impl.md`, `webchat-eager-start.md`, `fix-webchat-sse-field-map.md`, `channel-web-chat-followups.md`)과 대체로 정합하다. 미해결 결정을 우회하거나 선행 plan 이 해소되지 않은 상태에서 가정을 전제하는 CRITICAL·WARNING 수준 충돌은 발견되지 않았다. 유일한 실질적 개선 사항은 `0-architecture.md` frontmatter `pending_plans:` 에 `web-chat-console.md` 미등록(INFO)이며, 나머지는 plan 완료 이동 시 동반 갱신 권고 수준이다.

---

## 위험도

NONE
