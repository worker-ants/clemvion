# Plan 정합성 검토 — `spec/5-system/` (impl-done, `impl-setup-error-code-ddd078`)

## 검토 범위 요약

- target scope(`spec/5-system/`) 델타: 0 파일 (정상 — 이번 PR 은 `spec/conventions/chat-channel-adapter.md`
  1개 파일만 건드렸고, 그것도 코드가 반증한 문장의 정정이라 planner 턴/`ESCALATE=spec`
  경로(커밋 `3c47885a3`)로 이미 처리됨).
- 실제 구현 diff: 21개 파일 — `chat-channel-input-rules.ts`(핵심 판별 로직) · adapter 3종
  (slack/discord/telegram) · `chat-channel/types.ts`(헬퍼 신설) · `triggers.controller.ts` ·
  `backend-labels.ts` · 테스트 6종 · 유저가이드 mdx 4개.
- 대응하는 작업 plan: `plan/in-progress/impl-setup-error-code.md` (owner: developer, 이번
  worktree 소유).
- 이 구현이 따라가는 선행 planner 결정: `plan/complete/spec-draft-setup-error-classification.md`
  (`#1323`, spec 커밋 `8964a7114`) — `spec_impact: none` 으로 명시된 순수 구현 턴.

## 확인한 정합성 포인트 (전부 일치 — 문제 없음)

1. **구현 vs target spec §5.4 실패 응답 표** (`spec/5-system/15-chat-channel.md:354-368`) —
   `400 BOT_TOKEN_INVALID` / `502 CHAT_CHANNEL_SETUP_FAILED` 분류, `code` 우선 판별,
   응답 본문에 provider 원문 미포함 방침이 diff(`chat-channel-input-rules.ts`)와 정확히 일치.
2. **401/403 fallback 유지 여부** — spec(`chat-channel-adapter.md §1.1.2`)과 tracker
   (`spec-draft-nullable-notation-followups.md` 「CCA §1.1.2 의 401/403 fallback 제거
   판정」)가 공통으로 "착수 신호는 켜졌으나 제거하지 말 것"이라 판단했고, 실제 diff
   (`chat-channel-input-rules.ts`)도 `isCredentialRejectedError(err) || /\b(401|403)\b/.test(message)`
   로 fallback 을 **유지**했다. 결정·spec·코드 3자가 일치.
3. **`getCodeFromStatus` 502 미대응 잔여** — `impl-setup-error-code.md` 체크리스트와
   `spec-draft-nullable-notation-followups.md`(2911행) 양쪽에 "현재 도달 불가, 두 번째
   호출자 생기면 처리" 로 동일하게 등재. 코드(`http-exception.filter.ts`)도 502 분기
   부재 + `default: 'INTERNAL_ERROR'` 로 서술과 일치함을 직접 확인.
4. **`teardownChannel`/`revokeBotToken` 미부착·swagger 404/200 잔여·`3-error-handling.md §1`
   중앙 카탈로그 미등재** — 전부 이 PR 의 스코프 밖으로 명시적으로 유예되고
   `spec-draft-nullable-notation-followups.md` 에 개별 항목(owner 표시 포함)으로 등재됨.
   유예 근거도 프록시가 아니라 구체적 조건(소비자 부재·spec drift 회피)으로 적혀 있음.
5. **CCA frontmatter "미구현" 주석 stale** — developer 가 쓴 문장이 아니므로 자기-반증형
   소정정 예외에 해당하지 않는다고 스스로 판단해 `ESCALATE=spec`(`--spec` BLOCK: NO,
   커밋 `3c47885a3`)로 정정 — governance 경계(§자기-반증형 소정정) 준수.
6. **Slack 5값 화이트리스트·Node 시스템 에러 4번째 `code` 의미** — spec 미반영 상태이지만
   각각 `spec-draft-nullable-notation-followups.md` 에 planner 소유 항목으로 이미 등재됨
   (신규 누락 아님).
7. 다른 `plan/in-progress/*`(chat-channel-discord-gateway·slack-socket-mode·visual-ssr-png,
   auth-guard-reflection-hardening 등) 를 grep 했으나 이 PR 의 결정과 충돌하거나 이 PR 이
   무효화해야 할 후속 항목은 발견되지 않음.

## 발견사항

없음 — CRITICAL/WARNING/INFO 모두 해당 사항 없음.

## 요약

`impl-setup-error-code.md` 는 자신이 만든 모든 곁가지 발견(필터 미변경·telegram 부착 위치·
`code` 4중 의미·뮤테이션 생존)을 그 자리에서 별도 트래커 항목으로 등재했고, 그 항목들이
`spec-draft-nullable-notation-followups.md` 에 owner·재개 신호와 함께 실재함을 직접 확인했다.
target(`spec/5-system/`)과의 델타가 0인 것은 이 PR 이 이미 커밋된 planner 결정(`#1323`)을
뒤늦게 구현으로 따라잡는 성격이기 때문이며, 유일한 spec 편집(`chat-channel-adapter.md`)도
governance 경계를 지키며 별도 커밋으로 분리 처리됐다. 미해결 결정 우회, 미해소 선행조건,
후속 항목 누락 어느 관점에서도 문제를 찾지 못했다.

## 위험도

NONE
