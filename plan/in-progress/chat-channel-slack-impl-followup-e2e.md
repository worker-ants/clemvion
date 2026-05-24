---
worktree: spec-slack-discord-chat-channel-bb4d35
started: 2026-05-24
owner: developer
status: completed
---

# Slack impl follow-up — e2e + user guide + supported 승격 ✅

본 plan 은 `chat-channel-slack-impl` 의 Phase 5 직후 후속 작업.

## 진입 조건 ✅

- [x] `chat-channel-slack-impl` plan complete (Phase 1~5 완료, commit `e58fdd60`)
- [x] 동일 worktree (`spec-slack-discord-chat-channel-bb4d35`) 에서 stacked 진행

## 산출물 ✅

1. **e2e tests** ✅
   - `codebase/backend/test/chat-channel-slack.e2e-spec.ts` 신설
   - signing verify (HMAC + replay window 10분 케이스) — 4 case
   - url_verification challenge 응답 (signing 미설정 legacy path)
   - group chat 차단 (channel_type=channel → 202 ignored)
   - 미지원 envelope → 202 ignored
   - 외부 chat.postMessage 호출은 fake server 없이는 검증 불가 — `chat_channel_health` 갱신만 결과로 받음. 본 e2e 는 HooksController + signing + parser dispatch flow 에 집중.

2. **User guide page** ✅
   - `codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx` (ko)
   - `codebase/frontend/src/content/docs/06-integrations-and-config/slack.en.mdx` (en)
   - 6 sections: 앱 만들기 / manifest 설정 (OAuth scopes / Event Subs / Interactivity / Slash) / clemvion 연결 / 사용 방법 / v1 한계 / 트러블슈팅

3. **`_overview.md §1 supported` 승격** ✅
   - `_overview.md §1` 표에 `slack` 행 추가 (supported v1)
   - `_overview.md §2` 에서 `slack` 제거 (discord 만 잔존)
   - `slack.md` frontmatter `status: partial → implemented` + `code:` 에 e2e + user guide 경로 추가

4. **v2 후보 (별 plan — 미생성)**
   - `chat-channel-form-native-modal` — Slack `views.open` modal 단일 step Form
   - `chat-channel-visual-ssr-png` — chart/table/carousel PNG (Telegram 와 공유)
   - `chat-channel-slack-socket-mode` — Socket Mode 지원 (R-S-3)
   - `chat-channel-auth-revoke-cron` — bot token 24h grace 종료 cron (CCH-SE-04-C, Slack/Telegram 공유)

## 참조

- Spec: `spec/4-nodes/7-trigger/providers/slack.md`
- 선행 plan: `plan/complete/chat-channel-slack-impl.md`
- e2e 산출: `codebase/backend/test/chat-channel-slack.e2e-spec.ts`
- user guide: `codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx`(en)
