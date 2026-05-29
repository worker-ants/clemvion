---
worktree: telegram-guide-realign-14fa1e
started: 2026-05-23
completed: 2026-05-29
owner: developer
---

# Plan — Telegram 유저 가이드 정정 (spec PR #281 반영)

> ✅ 완료 (2026-05-29). 본 plan 의 4 mdx 정정 본체는 PR #282 (`2c6c8d4b`) 에서 spec PR #281 의 4 P1 결정 (health enum `healthy`·`visualNode` enum·single-path rotate + 24h grace·secret store 암호화 문구) 을 반영하며 완료됐고, "후속" 의 GUI 격상은 UI 구현 머지 (#283 `c619c62b`, 이후 Slack/Discord 다중 provider #308) 로 달성됨. 정정 대상 4 파일 (telegram.mdx/en, triggers.mdx/en) 이 현재 spec SoT 와 정렬됨을 확인 — health enum (`unknown`/`healthy`/`degraded`, `ok`/`error` 잔재 없음)·`visualNode` 3-옵션 매트릭스 + legacy `text_only` read-time normalize 안내·rotate single-path + 24h grace·AES-256-GCM secret store + `hasBotToken` derived 필드 모두 반영. plan 만 `in-progress/` 에 잔류해 있던 stale 상태를 grooming 으로 `complete/` 이동 ([plan-lifecycle §6.1](../../.claude/docs/plan-lifecycle.md)).

## 배경

`spec-telegram-chat-channel-ui-polish` (PR #281, 머지 완료) 가 텔레그램 chat channel 의 4 P1 결정을 spec 에 확정한 직후, 사용자 가이드 4 mdx 파일이 outdated 상태로 남았다. 본 plan 은 그 4 파일을 spec SoT 에 맞춰 정렬한다.

후속 plan 1 (UI 구현) 머지 후 본 가이드는 다시 "GUI 단계 안내" 로 격상될 예정. 그 사이에도 사용자가 실제로 따라갈 수 있도록 "현재 API 호출로만 등록 가능" 을 명시한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx` | §2 GUI 부재 callout · curl 예시로 교체 · §3 `visualNode` enum 3-옵션 매트릭스 + legacy `text_only` 안내 · §5 health enum (`ok`→`healthy`, `error` 제거) · §6 single-path + 24h grace 명시 · §7 secret store 평문 stub 잔재 문구 정정 |
| `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.en.mdx` | KO 와 동일 정정 (KO/EN parity) |
| `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` | "Chat Channel 연결" 절 GUI 부재 callout · curl 예시 · health enum 정정 · single-path · visual enum cross-link · Chart 행을 "v1 fallback + v2 격상 예정" 으로 정확화 |
| `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` | KO 와 동일 정정 |

## 의도된 boundary

- frontend UI 코드 변경은 본 plan 범위 밖 — 후속 plan 1 (UI 구현) 담당.
- backend code 변경 없음 — 가이드 문서만.
- spec 변경 없음 — spec PR #281 이미 머지됨.

## 후속

- UI 구현 plan 머지 후 본 가이드의 GUI 부재 callout 제거 + GUI 단계 안내로 격상.
