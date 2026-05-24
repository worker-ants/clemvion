---
worktree: (assigned at impl-start)
started: 2026-05-24
owner: developer (TBD)
status: backlog
---

# Slack impl follow-up — e2e + carousel/chart/table PNG (Phase 6)

본 plan 은 `chat-channel-slack-impl` 의 Phase 5 직후 후속 작업.

## 진입 조건

- [ ] `chat-channel-slack-impl` plan complete (Phase 1~5 완료)
- [ ] docker compose e2e infra 가 본 worktree 에 setup 가능

## 산출물 범위

1. **e2e tests** — `codebase/backend/test/chat-channel-slack.e2e-spec.ts`
   - signing verify (HMAC + replay window)
   - url_verification challenge 200 응답
   - DM message → execution 시작 + chat.postMessage 호출
   - block_actions → click_button → response_url 갱신
   - file_shared → files.info 보강 → form submit (TBD)

2. **Phase 6 — `_overview.md §1 supported` 승격**
   - `_overview.md §2` 에서 `slack` 제거 + `§1 supported (v1)` 추가
   - `slack.md` frontmatter `status: partial → implemented`
   - `chat-channel-impl` plan complete 이동

3. **v2 후보 (별 plan)**
   - `chat-channel-form-native-modal` — Slack `views.open` modal 단일 step Form
   - `chat-channel-visual-ssr-png` — chart/table/carousel PNG (Telegram 와 공유)
   - Socket Mode 지원 (R-S-3)

## 참조

- Spec: `spec/4-nodes/7-trigger/providers/slack.md`
- 선행 plan: `plan/complete/chat-channel-slack-impl.md`
