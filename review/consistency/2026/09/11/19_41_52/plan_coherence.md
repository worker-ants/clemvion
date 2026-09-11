# Plan 정합성 검토 — spec/5-system/ (impl-done, `impl-chat-channel-binder-t2`)

## 검토 경위

`spec/5-system/` 스코프 델타는 0(정상 — 이 PR 은 `spec_impact: none` 을 내건 순수 코드
이동). 실제 target 은 `codebase/backend/src/modules/triggers/` 의
`ChatChannelBinderService`/`buildTriggerCallbackUrl` 추출 diff(8파일/1130줄)이며, 절대경로
워킹트리(`git -C .../impl-chat-channel-binder-t2-7e9b70`)로 직접 확인했다. 프롬프트가 예산
초과로 생략한 `plan/in-progress/impl-chat-channel-binder-t2.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md`, `spec/5-system/15-chat-channel.md`,
관련 `spec/conventions/*.md`, `spec/data-flow/14-chat-channel.md` 는 모두 워킹트리에서
직접 Read/grep 했다.

이전 라운드(`--impl-prep`, `review/consistency/2026/09/11/17_39_32/plan_coherence.md`)가
낸 WARNING 2건 + INFO 1건은 커밋 `7e9aaa736`(`docs(plan): --impl-prep 후속 5건 등재`)으로
전부 durable 트래커(`spec-draft-nullable-notation-followups.md`)에 planner/developer 소유로
정확히 이관됐음을 실측으로 확인했다 — 재발 아님. 이번 라운드는 그 이관 자체의 정확성과,
그 사이 4라운드 `/ai-review` 를 거치며 새로 생긴 gap 을 검토했다.

## 발견사항

- **[WARNING]** `spec-draft-nullable-notation-followups.md` 의 `spec_impact` frontmatter 가
  같은 커밋에서 추가한 본문 항목의 편집 대상 파일 2개를 누락 — 이 파일 스스로 이미 한 번
  겪은 실패 모드의 재발
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` frontmatter
    `spec_impact`(8~26행) vs 본문 2313~2333행("`setupChatChannel` 귀속 표기 3곳이 T2 이동으로
    낡는다", 오늘 `7e9aaa736` 로 신규 등재)
  - 관련 plan: 동일 파일. `owner: planner` — 이 frontmatter 는 planner 만 갱신 가능
  - 상세: 신규 등재된 W2 항목 본문은 정정 대상을 `spec/conventions/secret-store.md` ·
    `spec/conventions/chat-channel-adapter.md` · `spec/data-flow/14-chat-channel.md` **3곳**으로
    명시하고 각 파일의 현재 문구(`` `triggers.service.ts.setupChatChannel` 구현체 ``,
    `` `TriggersService.setupChatChannel` ``, 구현 파일 목록의 `triggers.service.ts` 귀속)를
    실측으로 인용한다(직접 확인 결과 셋 다 HEAD 에 그대로 남아 있음 — 정확한 인용). 그런데
    `spec_impact` 목록에는 이 셋 중 `secret-store.md` 만 있고 `chat-channel-adapter.md` ·
    `data-flow/14-chat-channel.md` 는 **없다**. 이 파일 자신이 8~14행 주석에서 정확히 같은
    실패 모드를 이미 경고했다 — *"아래 셋은 본문 항목이 정정을 요구하는 파일 — 빠지면
    `--spec`/`--impl-done` 번들 스코프에서 누락된다"* (`review/consistency/2026/09/06/16_29_00`
    INFO#2 로 소급 등재했던 바로 그 사고). `chat-channel-adapter.md` 는 이 파일 안에서
    이미 완료 처리된 다른 항목들(2136·2450행, `[x]`)의 편집 대상이기도 해 **반복 누락**이다.
  - 제안: planner 가 이 트래커를 다음에 열 때 `spec_impact` 에
    `spec/conventions/chat-channel-adapter.md` · `spec/data-flow/14-chat-channel.md` 두 줄을
    추가할 것. T2 자신은 `spec/` 쓰기 권한이 없어 고칠 수 없다 — 이 발견은 다음 planner 턴을
    위한 것이다.

- **[WARNING]** T2 plan 체크리스트가 이미 끝난 후속 등재 작업을 미완료로 표시 —
  `plan/complete/` 이동 시 "후속 등재 안 됨" 으로 오독될 수 있다
  - target 위치: `plan/in-progress/impl-chat-channel-binder-t2.md:184`
    (`` - [ ] `--impl-prep` W1~W4 후속 등재 (planner 3건 · developer 2건) ``)
  - 관련 plan: 동일 파일 + `spec-draft-nullable-notation-followups.md`(2213·2313·2335·2344행)
  - 상세: 실측 결과 이 체크박스가 가리키는 작업은 커밋 `7e9aaa736`(18:04, "docs(plan):
    --impl-prep 후속 5건 등재")에서 **이미 완료**됐다 — W1(code: 재갱신 8개 대상),
    W2(귀속 표기 3곳), W3(rotate-bot-token OpenAPI 갭), W4(`getAppBaseUrl()` fallback 이중화)
    전부 durable 트래커에 planner/developer 태그·날짜와 함께 등재돼 있음을 직접 확인했다.
    그 뒤 4개 커밋(`92f4b0607`·`8f43b1f56`·`68bb34e73`·`628942b8d`)이 더 있었지만 어느 것도
    이 plan 파일의 체크박스를 갱신하지 않았다. 이 프로젝트가 반복 지적해 온 "체크박스 ≠
    실제 상태" 실패 모드와 같은 형태이며, 지금 상태로 `plan/complete/` 로 이동하면 다음
    사람이 "후속 등재가 안 됐다" 고 오판하거나 중복 등재를 시도할 위험이 있다.
  - 제안: 마무리 커밋에서 이 항목을 `[x]` 로 갱신(근거: `7e9aaa736` 커밋 해시 + 트래커
    4항목 위치 인용).

## 검증했으나 문제 없음 (참고)

- T2 diff 의 실제 호출부 3곳(`triggers.service.ts:448,565,855` → `this.chatChannelBinder.*`)이
  plan 설계 절의 서술("호출자 3곳")과 정확히 일치.
- `spec/5-system/15-chat-channel.md` frontmatter `code:` 는 신규 파일 2개를 여전히 포함하지
  않음 — W1 으로 이미 정확히 추적된 상태이고 developer 범위 밖이라 이 PR 이 손대지 않은
  것이 맞다.
- 이 PR 이 기반하는 최근 PATCH 비밀-쓰기 금지 결정(`df1962e25`·`c0f2a885c`·`fad828884`)은
  모두 HEAD 의 조상이며, 이동된 `setupChatChannel`/`teardownChatChannel` 이 그 결정을
  우회하거나 재해석하지 않는다(순수 이동 — 동작 델타 주장 없음).
- `plan/in-progress/` 의 다른 트래커(`harness-review-gate-followups.md`,
  `spec-sync-external-interaction-api-gaps.md`, `backend-lint-gate-broken-on-main.md`)가
  담고 있는 `triggers.service.ts` 관련 줄번호 인용은 전부 이미 `[x]` 로 닫힌 과거 증거
  인용이거나 이번 이동과 무관한 사건(리뷰어 뮤테이션 사고)이라 T2 의 라인 이동으로 인한
  live 참조 훼손은 없다.

## 요약

`impl-chat-channel-binder-t2` 는 미해결 결정을 우회하지도, 다른 plan 의 사전 조건을
무시하지도 않는다 — 이전 라운드가 지적한 두 spec-drift 항목(frontmatter `code:` 갭,
`setupChatChannel` 귀속 표기 3곳)은 커밋 `7e9aaa736` 으로 durable 트래커에 정확히
planner/developer 소유로 이관됐다. 다만 그 이관 자체에서 두 가지 부수 오차가 남았다 —
(1) 트래커의 `spec_impact` frontmatter 가 새로 등재한 본문 항목의 실제 편집 대상 파일
2개(`chat-channel-adapter.md`·`data-flow/14-chat-channel.md`)를 빠뜨렸고(이 파일 스스로
경고해 온 실패 모드의 재발), (2) T2 plan 자신의 체크리스트가 이미 끝난 후속 등재 작업을
미완료로 표시하고 있다. 둘 다 코드 diff 나 spec 본문의 실질적 오류가 아니라 plan
bookkeeping 층의 사소한 어긋남이며, `plan/complete/` 이동 전 한 줄씩 정정하면 해소된다.

## 위험도

LOW
