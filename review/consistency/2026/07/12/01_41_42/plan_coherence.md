# Plan 정합성 검토 — spec/7-channel-web-chat (impl-done)

## 조사 범위 메모

`_prompts/plan_coherence.md` 가 첨부한 "관련 plan" 5건(`ai-agent-tool-connection-rewrite.md` ·
`cafe24-backlog-residual.md` · `chat-channel-discord-gateway.md` · `chat-channel-slack-socket-mode.md` ·
`chat-channel-visual-ssr-png.md`)은 전부 `channel-web-chat`(임베드 위젯)과 무관한 영역(AI Agent 일반 도구,
Cafe24, **chat-channel**=Discord/Slack/Telegram 봇 채널)이다 — "channel" 문자열 매칭에 의한 오선정으로 보인다.
따라서 실제 `plan/in-progress/` 디렉터리를 직접 열어(`ls` + grep) target 과 실질적으로 겹치는 문서를 재선별했다:

- `eia-command-waiting-surface-guard.md` (EIA 대기표면↔명령 가드, 완료)
- `eia-context-schema-followups.md` (EIA context 스키마 후속, 대부분 완료)
- `spec-sync-external-interaction-api-gaps.md` (EIA 미구현 surface 추적 — EIA-RL-07·coalesce 항목 포함)
- `spec-draft-pr874-deferred-docs.md` (PR #874 문서 보강 3건)
- `webchat-multiturn-restore-test.md` (본 세션이 속한 진행 중 plan 자체)
- `webchat-widget-presentation-followups.md` (presentation truncation 배너 후속)
- `plan/in-progress/node-output-redesign/{table,carousel}.md` (rowsTotalCount/itemsTotalCount 필드 기원)

아래 발견사항은 이 재선별 집합 기준이다.

## 발견사항

- **[WARNING]** `spec-draft-pr874-deferred-docs.md` 가 완료됐음에도 `plan/in-progress/` 에 잔류
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §R7, `spec/conventions/conversation-thread.md` §9 서두 blockquote·§8.2·frontmatter `code:`·§4 표 park 행
  - 관련 plan: `plan/in-progress/spec-draft-pr874-deferred-docs.md`
  - 상세: 이 plan 의 3개 변경안(①R7 신설 ②conversation-thread §9 위젯 스코프 예외 ③frontmatter/§4 표 미러)은 이미 PR #899(commit `52f46f95f`, origin/main 반영 확인)로 전부 머지됐다. target 문서를 직접 확인한 결과 R7 본문·§9 blockquote(5값 구체 열거 + `system_error` 미도달 명시 포함)·§8.2 cross-ref 가 모두 존재해 plan 의 "consistency-check 반영 결과" 표(W1/W2/W3)까지 그대로 실현돼 있다. 그런데도 plan 파일의 체크리스트 마지막 두 항목("doc-guard(spec-link-integrity) 통과", "commit + PR")이 `[ ]` 미체크 상태로 `in-progress/` 에 남아, 이 spec 영역에 아직 미해결 작업이 있는 것처럼 보인다.
  - 제안: `project-planner` 가 두 잔여 체크박스를 실제 상태(둘 다 이미 충족 — commit `52f46f95f` 존재, doc-guard 는 그 PR CI 통과분)로 마감하고 `plan/complete/` 로 이동. 새로 착수하는 에이전트가 이 문서를 "아직 열려있는 web-chat 문서 작업"으로 오인해 중복 작업하거나, 반대로 R7/§9 예외가 미반영 상태라고 오판할 위험을 차단한다.

- **[INFO]** carousel 잘림 배너·총 개수 노출 — target 의 carve-out 이 plan 의 미해결 항목과 일치(정합 확인, 조치 불요)
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 메시지 리스트 행 각주, §R8 마지막 문단
  - 관련 plan: `plan/in-progress/webchat-widget-presentation-followups.md` 미구현 항목 1(총 개수 노출 — table 부분 해소, carousel 잔여)·2(카루셀 잘림 배너 미구현)
  - 상세: target 은 "table 배너 한정 — carousel 은 잘림 배너 자체가 미구현이라 별도 후속으로 추적한다"고 정직하게 비목표 처리했고, plan 도 동일하게 carousel 항목을 미체크(`[ ]`)로 열어둔 상태다. plan 의 "착수 조건"(project-planner 가 §2 에 표시 계약을 먼저 정의)도 이번 table 파트에 한해 이미 충족됐다(§2/R8 parity, PR #921). 충돌·누락 없음 — 향후 carousel 배너 신설 시 이 plan 항목이 여전히 유효한 진입점이라는 점만 참고.

- **[INFO]** EIA-RL-07 idle-wait reaper·single-flight coalesce·`replay_unavailable` 미배선 — target·plan 상태 일치(조치 불요)
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "구현 상태" 안내, §R9; `spec/7-channel-web-chat/3-auth-session.md` §R6 마지막 항목
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — "host resetSession booting 중 중복 webhook 가드"(✅), "공개 위젯 idle-wait execution GC (EIA-RL-07)"(✅), "(후속) web-chat 위젯 클라이언트 소비"(미해결 `[ ]`, `execution.replay_unavailable` 미배선)
  - 상세: target 이 "모두 구현됨"이라 주장하는 A(coalesce)·B-1(cancel)·EIA-RL-07 reaper 는 plan 에서도 전부 `[x]` 로 일치한다. 반대로 target §3.1 이 "소비 분기는 아직 미배선(no-op)"이라 밝힌 `execution.replay_unavailable` 클라이언트 소비는 plan 에서도 미체크 항목으로 정확히 남아있다 — 과장도 은폐도 없다.

## 요약

target(`spec/7-channel-web-chat/**`)이 `plan/in-progress/` 의 미해결 결정을 우회하거나 선행 조건을 무시하는 CRITICAL 급 충돌은 발견되지 않았다. 프롬프트가 첨부한 5개 "관련 plan"은 실제로는 chat-channel(Discord/Slack/Telegram)·AI Agent 도구·Cafe24 등 무관 영역이었고, 실제 관련 plan(EIA 대기표면 가드, EIA context 스키마 후속, EIA gaps 트래커, PR #874 문서 보강, presentation truncation 후속, multi-turn 복원 테스트 자신)을 직접 대조한 결과 target 의 carve-out·"구현 상태" 서술은 모두 해당 plan 의 실제 체크 상태와 일치했다(과장·은폐 없음). 유일한 실질 발견은 `spec-draft-pr874-deferred-docs.md` 가 PR #899 로 이미 완료됐음에도 `plan/in-progress/`에 잔류해 향후 혼선을 줄 수 있다는 하우스키핑 WARNING이다.

## 위험도
LOW
