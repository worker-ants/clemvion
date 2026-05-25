BLOCK: NO

# Consistency Check (impl-prep) — chat-channel outbound 구현 착수 전

**위험도**: LOW — Critical 없음. 진행 허용.

## Critical
없음.

## WARNING (4건)

| # | 위배 | 처리 |
|---|---|---|
| W-1 | Flyway "PR-A" 식별자 spec 미정의 | 본 PR scope 밖 — spec swagger/migration 보강 별도 plan 후보 |
| W-2 | `hasBotToken` Swagger `readOnly` 의무 미명시 | 본 PR scope 밖 — spec swagger 보강 별도 plan |
| W-3 | `botToken`/`inboundSigningPlaintext` Swagger `writeOnly` 의무 미명시 | 본 PR scope 밖 — spec swagger 보강 별도 plan |
| W-4 | R-CC-16(d) 후속 구현 plan 파일 미작성 | **본 PR 진행 — 같은 worktree 에서 구현이 이어지므로 plan 파일 신설 불필요. plan/in-progress/spec-draft-chat-channel-template-render-outbound.md 가 이미 spec+구현 모두 추적 중** |

## INFO (15건 — 권고)

본 PR 의 구현에서 흡수 가능한 항목:
- I-2: blocking 필터 표현식 명확화 — `event.output?.status === 'waiting_for_input'` 사용 권장 → 구현 단계에서 반영
- I-15: `ChatChannelInternalEvent` 타입 미구현 → 본 PR 의 핵심 구현 작업

다른 INFO 들은 본 PR scope 밖 (Swagger 보강, MERGED plan 정리, stale worktree 정리 등).

## 결정

**BLOCK: NO** — 구현 착수 허용.

본 PR scope:
- types.ts: `EiaAiMessageEvent.presentations?` + `ChatChannelInternalEvent` 신설
- chat-channel.dispatcher.ts: SUBSCRIBED_EVENTS 확장 + presentation 노드 sub-filter
- 3 provider renderer (telegram / discord / slack): node.completed 분기 + ai_message presentations[] sequential 발송
- 단위 테스트 동반

WARNING W-1~W-3 (Swagger / Flyway) 은 본 회귀 fix 와 직교 — 별도 plan 으로 trace.
