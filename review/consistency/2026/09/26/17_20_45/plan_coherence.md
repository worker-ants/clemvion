# Plan 정합성 검토 — `rotate-bot-token-body` impl-prep

## 검토 범위
- target: `spec/5-system/15-chat-channel.md`(주) + `5-system/12-webhook.md` · `5-system/13-replay-rerun.md` · `2-navigation/2-trigger-list.md` · `3-workflow-editor/3-execution.md` · `conventions/swagger.md` (impl-prep 번들, 실제 내용은 origin 과 동일)
- 실작업 plan: `plan/in-progress/rotate-bot-token-body.md` — `rotateBotToken`(triggers) · `continueExecution`(executions) · `receiveWebhook`(hooks) 3개 라우트에 `@ApiBody` 문서 전용 DTO 추가. 런타임 미변경, `spec_impact: none`.

## 발견사항

- **[INFO]** 상위 트래커의 처방 제안과 실제 채택 경로가 다르다 — 근거는 이미 충분
  - target 위치: (해당 없음 — spec 본문 아님, 계획 vs 계획)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:2459` "`rotate-bot-token` 엔드포인트에 OpenAPI 데코레이터가 전무하다" (미해결, `- [ ]`) — 처분 제안이 "`RotateBotTokenDto` **요청 DTO 승격**" 이었다.
  - 상세: `rotate-bot-token-body.md` 는 이 트래커 항목을 직접 "닫는다" 고 선언하면서도, 실제 처방은 요청 DTO를 class-validator 가 붙는 실 DTO 로 **승격하지 않고** `workflows.execute` 선례를 따라 **문서 전용 DTO + `@ApiBody`** 로 우회한다. 전역 `CustomValidationPipe` 가 metatype 이 `Object` 일 때만 검증을 건너뛰므로, 실 DTO 로 타입하면 `whitelist`/`forbidNonWhitelisted` 가 켜져 계약이 바뀐다는 근거를 plan 이 스스로 명시했다 — 트래커의 낡은 처방 문구를 무단으로 어긴 것이 아니라 실측 근거로 갱신한 것이다.
  - 제안: 이 항목을 닫는 커밋/planner 턴에서 트래커의 "처분 제안" 문구를 실제 채택안(문서 전용 DTO)으로 정정해 두면, 다음 사람이 옛 제안(승격)을 다시 시도하지 않는다. 차단 사유 아님 — 기록용 정정 권고.

- **[INFO]** 신규 후속 항목("전역 `@ApiBody` 필수 가드")이 아직 트래커에 미등재
  - target 위치: (해당 없음)
  - 관련 plan: `plan/in-progress/rotate-bot-token-body.md` "안 하는 것" 절 — "전역 가드(«`@Body()` 가 클래스가 아니면 `@ApiBody` 필수») ... 트래커 등재" / 체크리스트 마지막 항목 "트래커 항목 닫기 · 전역 가드 후속 등재" (미체크)
  - 상세: `conventions/swagger.md` §1-7 은 DTO 명명 규칙만 다루고 요청 본문 데코레이터 의무를 규정하지 않는다 — 실측 확인함(§5-4 새 엔드포인트 체크리스트에도 `@ApiBody` 항목 없음). plan 이 이 공백을 인지하고 "가드 신설은 별도 planner 턴" 으로 미뤘는데, `spec-draft-nullable-notation-followups.md` 전체를 grep 해도 이 후속 항목은 아직 등재돼 있지 않다.
  - 제안: plan 자신의 체크리스트에 이미 있는 todo 이므로 새로 만들 필요는 없다 — `--impl-done` 전에 해당 체크박스가 실제로 트래커 등재까지 마쳤는지만 확인.

- **[INFO]** `15-chat-channel.md` frontmatter `pending_plans` 가 이 작업 plan 을 참조하지 않음 (기존에 이미 열려 있던 판단 보류)
  - target 위치: `15-chat-channel.md` frontmatter `pending_plans:` (discord-gateway / slack-socket-mode / visual-ssr-png 3건만)
  - 관련 plan: `plan/in-progress/rotate-bot-token-body.md`(신규) 및 `spec-draft-nullable-notation-followups.md:3820` 부근에 남은 동일 취지의 미해결 메모("`pending_plans:` 가 이 트래커를 cross-reference 하지 않는다 — 판단을 planner 에게 넘김")
  - 상세: `rotate-bot-token-body.md` 가 건드리는 `triggers.controller.ts` 는 `15-chat-channel.md` 의 `code:` glob 범위 안에 있다. 그런데 `pending_plans` 는 지금 "backlog 성 기능 확장" 3건만 나열하고, 진행 중인 기술부채/문서화 plan(`rotate-bot-token-body`, `spec-draft-nullable-notation-followups`)은 넣지 않는 관례로 보인다. `spec_impact: none` 이라 이번 PR 을 막을 사유는 아니지만, `pending_plans` 필드의 포함 기준 자체가 아직 planner 결정 대기 상태라는 점은 재확인됐다.
  - 제안: 차단 아님. planner 가 `pending_plans` 포함 기준을 정할 때 이 사례도 함께 고려.

## 충돌/누락 없음 확인
- `pending_plans` 의 3건(`chat-channel-discord-gateway.md` / `chat-channel-slack-socket-mode.md` / `chat-channel-visual-ssr-png.md`)은 모두 `status: backlog`, 결정 대기 항목(사용자 escalate)이며 요청 본문/OpenAPI 문서화와 무관 — 충돌 없음.
- `spec-draft-nullable-notation-followups.md` 의 다른 미해결 항목들(§5.4.1 표 2행 `setupChannel` 재호출 불확실성, `15-chat-channel.md §5.4` 400 행 누락, `swagger.md §5-4` UUID 파이프 축 누락)은 모두 이번 작업(요청 본문 3곳 문서화)과 별개 축이라 선행조건도 아니고 무효화 대상도 아님.
- `conventions/swagger.md` 에 요청 본문 규칙이 없다는 plan 의 전제는 §1-7·§5-4 실측으로 확인됨 — target 문서와 plan 서술이 일치.
- `dto-class-name-collision` 가드 관점에서 신규 클래스명(`ChatChannelRotateBotTokenRequestDto` 등)이 기존 `ChatChannelRotateBotTokenDto`(응답 DTO)와 충돌하지 않음 — 실측(grep) 확인.
- `backend-lint-gate-broken-on-main.md` 등 선행 인프라 결함은 이미 2026-08-09 해소됨 — 이 plan 의 TEST WORKFLOW 를 막는 잔존 선행조건 없음.

## 요약
`rotate-bot-token-body` plan 은 in-progress 트래커의 관련 항목(§`spec-draft-nullable-notation-followups.md` OpenAPI 데코레이터 항목)을 실측 근거로 타당하게 좁혀 처분하고 있으며, `pending_plans` 3건과는 스코프가 겹치지 않는다. 미해결 결정을 우회하는 CRITICAL 은 없고, 트래커 문구 정정·후속 항목 등재·`pending_plans` 포함 기준 등은 기록 위생 수준의 INFO 로 충분하다.

## 위험도
LOW
