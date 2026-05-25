# 변경 범위(Scope) 리뷰

**리뷰 일시**: 2026-05-25
**대상 브랜치**: claude/undici-autoselectfamily-b938d3
**작업 의도**: chat-channel 비-blocking presentation 노드 outbound 회귀 수정 (CCH-MP-06 + CCH-MP-01 보강)

---

## 발견사항

### [INFO] 파일 1 — chat-channel.dispatcher.spec.ts
- **위치**: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` (라인 349+)
- **상세**: `execution.node.completed` 이벤트에 대한 `toEiaEvent` 변환 테스트 신설. template/carousel/table/chart 4종 비-blocking 케이스, 비-presentation 노드 sub-filter 제외, blocking 케이스 제외, base 가드 테스트 포함. 모두 작업 의도(CCH-AD-07 / CCH-MP-06)와 직접 관련.
- **제안**: 해당 없음. 의도 범위 내.

### [INFO] 파일 2 — chat-channel.dispatcher.ts
- **위치**: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`
- **상세**: `ChatChannelInternalEvent` 임포트 추가, `SUBSCRIBED_EVENTS`에 `execution.node.completed` 추가, `PRESENTATION_NODE_TYPES` Set 신설, `toEiaEvent` 반환 타입 union 확장, `execution.node.completed` case 추가. 모두 작업 의도와 직결된 최소 변경.
- **제안**: 해당 없음.

### [INFO] 파일 3 — discord-message.renderer.ts
- **위치**: `codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts`
- **상세**: `renderDiscordEvent` 함수 서명에 `ChatChannelInternalEvent` union 추가, `execution.ai_message` 분기를 `renderAiMessage` 로 추출, `execution.node.completed` 분기 신설. `renderAiMessage` 에서 `presentations[]` sequential 발송 처리. `renderPresentationPayload` / `renderPresentationByType` 내부 헬퍼 신설.
- **제안**: 해당 없음. CCH-MP-06 + CCH-MP-01 보강의 Discord provider 구현으로 범위 내.

### [INFO] 파일 4 — slack-message.renderer.ts
- **위치**: `codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.ts`
- **상세**: Discord renderer 와 동일한 패턴의 Slack 구현. 구조 및 로직이 discord 구현과 거의 동일하며 작업 의도 범위 내.
- **제안**: 해당 없음.

### [INFO] 파일 5 — telegram-message.renderer.spec.ts
- **위치**: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.spec.ts` (라인 556+)
- **상세**: `execution.node.completed` 4종 케이스 테스트 + `execution.ai_message presentations[]` sequential 발송 테스트 신설. 작업 의도 범위 내.
- **제안**: 해당 없음.

### [INFO] 파일 6 — telegram-message.renderer.ts
- **위치**: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts`
- **상세**: `renderTelegramMessages` 서명 확장, `execution.ai_message` 분기를 `renderAiMessage` 로 추출, `execution.node.completed` 분기 신설, 헬퍼 함수 신설. 작업 의도 범위 내.
- **제안**: 해당 없음.

### [INFO] 파일 7 — types.ts
- **위치**: `codebase/backend/src/modules/chat-channel/types.ts`
- **상세**: `PresentationPayload` 임포트 추가, `EiaAiMessageEvent`에 `presentations?: PresentationPayload[]` 필드 추가, `ChatChannelInternalEvent` union 타입 신설, `EiaNodeCompletedEvent` 인터페이스 신설, `ChatChannelAdapter.renderNode` 서명 union 확장. 작업 의도(CCH-MP-01 보강 + CCH-AD-07)의 타입 계층 구현으로 범위 내.
- **제안**: 해당 없음.

### [INFO] 파일 8~13 — 문서(mdx) 6개
- **위치**: `codebase/frontend/src/content/docs/06-integrations-and-config/` 하위 6개 파일 (discord.en.mdx, discord.mdx, slack.en.mdx, slack.mdx, telegram.en.mdx, telegram.mdx)
- **상세**: 각 채널별 사용자 문서에 AI Agent render 도구 / Template 노드의 outbound 동작을 설명하는 섹션 추가. 비-blocking presentation 발화 기능을 사용자에게 안내하는 내용으로 구현 변경과 직접 대응.
- **제안**: 해당 없음.

### [INFO] 파일 14 — plan/complete/spec-draft-chat-channel-template-render-outbound.md
- **위치**: `plan/complete/spec-draft-chat-channel-template-render-outbound.md`
- **상세**: 작업 완료로 plan 문서가 `in-progress/` 에서 `complete/` 로 이동. plan-lifecycle 정책상 구현 완료 후 `git mv` 로 이동하는 것이 정상 절차.
- **제안**: 해당 없음.

### [INFO] 파일 15~34 — review/consistency/** 산출물 (20개 파일)
- **위치**: `review/consistency/2026/05/25/16_53_45/`, `17_05_36/`, `17_13_11/` 하위 파일들
- **상세**: consistency-check 3회 라운드 산출물 (각 checker 결과 + _retry_state.json + meta.json + SUMMARY.md). 이 파일들은 developer SKILL.md 의 "구현 착수 직전 consistency-check --impl-prep 의무" 절차의 결과물이므로 PR 에 포함되는 것이 정상.
- **제안**: 해당 없음.

---

## 요약

이번 변경의 작업 의도는 chat-channel 채널에서 비-blocking presentation 노드(carousel/table/chart/template) 발화 누락 회귀를 수정하고(CCH-MP-06), AI Agent `render_*` 도구 호출 결과의 sequential 발송을 추가(CCH-MP-01 보강)하는 것이다. 변경된 34개 파일은 모두 이 두 가지 목적에 직결된 파일들이다. 핵심 구현 변경(dispatcher, renderer 3종, types), 테스트(spec/renderer spec), 사용자 문서(mdx 6종), plan 라이프사이클 관리(plan complete 이동), consistency-check 산출물(review/consistency 3회 라운드)로 구성되며, 어느 파일도 작업 의도와 무관한 리팩토링·기능 확장·포맷팅 변경을 포함하지 않는다. 범위 일탈 없음.

---

## 위험도

NONE
