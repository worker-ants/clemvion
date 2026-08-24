### 발견사항

- **[WARNING]** 자기-반증형 소정정 게이트(`--impl-done spec/conventions/`)의 실행 증거가 plan 체크리스트에 아직 인용되지 않았다 — 단, 본 라운드 자체가 그 게이트의 실행이다
  - target 위치: `spec/conventions/conversation-thread.md` §8.4 정정 blockquote (커밋 `e6a017a18`) — 자기-반증형 소정정 대상 문장
  - 관련 plan: `plan/complete/node-output-envelope.md` frontmatter `spec_impact` 두 번째 블록("자기-반증형 소정정 — 이 한 파일에만", "게이트는 `--impl-done spec/conventions/` (조건 5)")과 `## 작업` 체크리스트
  - 상세: 직전 라운드(`review/consistency/2026/08/24/12_02_30/plan_coherence.md`)가 동일한 결함을 WARNING 으로 지적했다 — 이 PR 이 원용한 CLAUDE.md 「자기-반증형 소정정」 예외의 필수 게이트(`--impl-done` 을 `spec/conventions/` 스코프로 사후 실행)가 이 PR 의 편집(`e6a017a18`, 2026-08-24T10:50)에 대해 실행된 기록이 그 시점까지 없었다. **본 라운드(`12_13_36`, `mode: --impl-done, scope=spec/conventions/`)가 바로 그 누락된 게이트의 실행이다** — `meta.json` 으로 확인. 즉 이 결함은 이 라운드가 열리는 것 자체로 절차적으로는 해소되는 중이다. 다만 `plan/complete/node-output-envelope.md` 는 이 라운드가 시작되기 전에 이미 `complete/` 로 확정·커밋된 상태라, 체크리스트에는 여전히 `10_44_28`(spec/5-system 스코프 `--impl-prep`) 인용만 있고 이번 `12_13_36`(spec/conventions 스코프 `--impl-done`) 인용이 없다. 선례 `plan/complete/sse-nodeoutput-allowlist.md` 는 같은 예외를 원용하면서 게이트 실행 라운드(`00_26_17`)를 체크리스트에 명시적으로 인용해 증거를 남겼는데, 이번 PR 은 그 패턴을 아직 따르지 못했다.
  - 제안: 본 라운드가 `BLOCK: NO` 로 수렴하면, 후속 커밋으로 `plan/complete/node-output-envelope.md` 의 `## 작업` 체크리스트에 `12_13_36 (--impl-done spec/conventions/, BLOCK: NO)` 항목을 추가해 게이트 이행 증거를 소급 기록할 것. `BLOCK: YES` 로 나오면 완료 처리 자체를 재검토해야 한다.

### 교차 확인 — 발견되지 않은 항목

- `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 와 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (둘 다 이번 diff 로 함께 갱신됨) 는 "`envelope.output` 잔여" 서술을 취소선+각주로 정확히 정정했고, `plan/complete/sse-nodeoutput-allowlist.md`·`spec/5-system/14-external-interaction-api.md`(§R17)·`spec/5-system/6-websocket-protocol.md`(§4.4 caveat)와 서술이 전부 동기화되어 있다 — "envelope.output 은 이종 payload 라 닫을 수 없다"는 반증된 유예 근거가 target 문서군 어디에도 정본으로 남아 있지 않다.
- target scope(`spec/conventions/`)에서 실제로 바뀐 두 파일 — `chat-channel-adapter.md` §1.3 `ChatChannelInternalEvent.output` JSDoc, `conversation-thread.md` §8.4 취소선 정정 — 을 참조하는 다른 `plan/in-progress/**` 문서(`ai-agent-tool-connection-rewrite.md`, `eia-context-schema-followups.md`, `eia-terminal-payload.md`, `chat-channel-visual-ssr-png.md`, `chat-channel-discord-gateway.md`, `chat-channel-slack-socket-mode.md`, `spec-draft-eia-notification-payload-contract.md`)를 전수 확인했으나, 참조 지점이 모두 편집 범위 밖 섹션(§1.2, §2.3, §3 등)이거나 무관한 주제(WebSocket gateway 백로그, ConversationThread v2 정책 등)라 충돌 없음.
- `spec-sync-external-interaction-api-gaps.md` 에 이번 작업이 새로 등재한 두 미해결 항목(`finalAdapted ?? nodeOutputCache` flat-view 폴백, `background:run:{id}` 채널 §3.2 표 누락)은 완료로 위장하지 않고 정직하게 미체크(`[ ]`) 상태로 남겨져 있다 — "후속 항목 누락" 에 해당하지 않는다.
- `node-output-redesign/**` (README 확인) 의 `NodeHandlerOutput` 5필드 invariant·D2/D6 wrapper 결정과, 이번 PR 이 §4.1/§1.3 에 명시한 "wire `output` = `NodeHandlerOutput` 래퍼, 도메인 값은 `output.output`" 서술은 개념적으로 상충하지 않고 오히려 같은 wrapper 모델을 재확인한다.

### 요약

이번 라운드가 검토하는 target(`spec/conventions/chat-channel-adapter.md` §1.3 JSDoc 정정, `conversation-thread.md` §8.4 취소선 정정)은 `plan/in-progress/**` 의 미해결 결정을 우회하거나 선행 조건을 건너뛰지 않았고, 관련 정본 트래커·형제 plan·형제 spec 문서 전부가 같은 정정으로 동기화되어 있다. 유일한 잔여는 절차적 bookkeeping 갭이다 — 이 PR 이 원용한 「자기-반증형 소정정」 예외의 필수 후행 게이트(`--impl-done spec/conventions/`)를 **본 라운드 자신이 지금 수행하는 중**인데, 이미 `complete/` 로 이동·커밋된 plan 문서의 체크리스트는 아직 이 라운드의 ID 를 인용하지 못한 상태다. 실질 충돌·중복 작업·후속 누락은 확인되지 않았다.

### 위험도
LOW
