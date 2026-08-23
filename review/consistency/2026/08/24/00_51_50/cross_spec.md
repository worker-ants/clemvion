# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 방법 메모

전달받은 `_prompts/cross_spec.md` 번들은 컨텍스트 예산 초과로 `git diff` 본문 자체와
`spec/5-system/` 내 다수 파일(`14-external-interaction-api.md` 등 18개), `spec/` 전역
93개 파일이 절단돼 있었다. 절단을 신뢰하지 않고 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/sse-nodeoutput-allowlist-3b6219`)에서
`git diff origin/main...HEAD`(spec·code 양쪽), `git log --oneline`, 관련 spec 원문·코드를
직접 Read/grep 으로 재구성했다.

**실제 diff 범위** (review 산출물 제외, HEAD 기준):
- `spec/5-system/14-external-interaction-api.md` (+64/-6, §R17 nodeOutput allowlist 범위 확대·정정)
- `spec/5-system/6-websocket-protocol.md` (+1/-1, §4.4 wire caveat 갱신)
- `spec/conventions/conversation-thread.md` (+10/-1, 자기-반증형 소정정)
- `codebase/backend/src/modules/websocket/websocket.service.ts` — `toFanoutEnvelope` 에
  `allowlistFanoutNodeOutput` 단계 신설 (strip → nodeOutput allowlist → routing 첨부)
- `codebase/backend/src/shared/utils/node-output-allowlist.ts` — `NODE_OUTPUT_ALLOWED_KEYS`
  에 chat-channel wire 전용 4키(`payload`·`title`·`rendered`·`nodeType`) 추가
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` (JSDoc 정정만)

`git log`(`16f3e3625`→`a9532bca0`)로 확인한 바, 이 diff 는 이미 5라운드의 consistency/code
리뷰를 거쳐 발견된 CRITICAL 1건(`23_29_27`, `envelope.output` 잔여 서술 누락)·WARNING 다수를
모두 fix 커밋으로 반영한 뒤의 상태다. 본 라운드는 그 수렴 이후의 **독립 재검증**이다.

## 발견사항

### WARNING

- **[WARNING]** `egress-masking.md` §2 파이프라인 순서 서술이 신설 4단계를 반영하지 않음
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.4 wire caveat / `spec/5-system/14-external-interaction-api.md` §R17 (`toFanoutEnvelope` 에 `allowlistFanoutNodeOutput` 단계가 strip 과 routing 첨부 사이에 신설됐음을 서술)
  - 충돌 대상: `spec/conventions/egress-masking.md` §2 "마스킹은 한 번" — "`WebsocketService.toFanoutEnvelope` 은 `maskWireEnvelope`(wire 단계) → `stripExternalOnlyFields` → `attachRoutingContext` 순" (3단계, 실측 재확인 — 현재 HEAD 에도 그대로)
  - 상세: `egress-masking.md` 는 자신을 "이 저장소의 마스킹 **좌표계** SoT"로 선언하고(§Overview "SoT 분리" 표: "마스킹 정책·적용 범위·잔여 갭"은 EIA §R17 소관이되, **파이프라인 구조**는 자신이 소유), §2 에서 `toFanoutEnvelope` 의 호출 순서를 3단계로 열거한다. 그런데 실제 코드(`websocket.service.ts` `toFanoutEnvelope`)는 이번 diff 로 `strip → allowlistFanoutNodeOutput → attachRoutingContext` 4단계가 됐고, target 문서(EIA §R17 신규 절·WS §4.4 caveat)는 이 신규 단계를 정확히 서술하는데 `egress-masking.md` §2 순서 열거·§1 좌표계 표(4행 소비처)에는 반영되지 않았다. §3 "이 문서는 기계가 지키지 않는다" 절이 최근(2026-08-23) 두 건의 표 갱신 실례를 기록해 두었으나 이번 nodeOutput allowlist 건은 그 목록에도 없다. `egress-masking.md` 를 SoT 로 참조하는 독자는 `toFanoutEnvelope` 파이프라인을 3단계로 오인할 수 있다.
  - 비고: 이미 `23_29_27` convention_compliance 라운드에서 WARNING 으로 지적됐고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(176행)에 planner 소관 미체크 항목으로 등재돼 의도적으로 이번 PR 범위 밖으로 defer 됐다(자기-반증형 소정정 5조건 중 "developer 자신이 그 문서에 쓴 문장"이 아니므로 developer 직접 수정 불가). **push 를 막을 사유는 아니나, 현재 HEAD 시점에도 미해소 상태**이므로 본 라운드에서도 재확인 결과를 기록한다.
  - 제안: 조치는 planner 턴에서 `egress-masking.md` §2 순서 문장에 `allowlistFanoutNodeOutput` 단계 추가 + §1 표 4행 소비처 갱신. 이번 target PR 은 이미 plan 트래커에 등재 완료 상태라 추가 조치 불요.

### INFO

- **[INFO]** `execution.node.completed`/`.failed` 의 `envelope.output` deny-list 잔여는 문서 간 정확히 일치
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 표 2행("SSE/fanout `execution.node.completed`/`.failed` 의 `envelope.output`" — deny-list 유지) / `spec/5-system/6-websocket-protocol.md` §4.4 caveat("`execution.node.*` 의 `envelope.output` 은 이 좁히기 대상이 아니다")
  - 충돌 대상: 없음 — `spec/5-system/6-websocket-protocol.md` §4 이벤트 표(187행 `execution.node.completed` = `NodeHandlerOutput.output` 그대로)·`plan/in-progress/spec-sync-external-interaction-api-gaps.md`(신규 CRITICAL 트래커 항목)·`websocket.service.spec.ts` 의 `[잔여]` 캐너리 테스트 세 곳 모두 같은 경계선(`waiting_for_input` 표면만 닫힘, `node.*` 표면은 잔여)을 공유
  - 상세: 실측(`git -C <worktree> grep`)으로 `websocket.service.ts` 의 `allowlistFanoutNodeOutput` 이 `envelope.nodeOutput`·`envelope.buttonConfig.nodeOutput` 두 자리만 좁히고 `envelope.output` 은 건드리지 않음을 확인 — 문서 서술과 코드 동작이 정확히 일치한다. 기록 목적으로만 남긴다.
  - 제안: 조치 불요

- **[INFO]** chat-channel wire 전용 4키 추가가 `spec/5-system/15-chat-channel.md` §(c)와 코드 양쪽에 정합
  - target 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts` `NODE_OUTPUT_ALLOWED_KEYS`(신규 `payload`·`title`·`rendered`·`nodeType`)
  - 충돌 대상: 없음 — `spec/5-system/15-chat-channel.md` 703행 "(c) `renderPresentationByType` shape 처리 우선순위"(`nodeOutput.payload` → `.output` → `.config` → flat)와 `discord-message.renderer.ts`/`telegram-message.renderer.ts` 의 `extractRendered`(`nodeOutput.rendered`/`nodeOutput.payload.rendered`)·`nodeOutput.title`·`buttonConfig.nodeOutput?.nodeType` 실측이 allowlist 4키와 1:1 대응
  - 상세: `node-output-allowlist.ts` 주석이 이 4키의 SoT 로 인용하는 `spec/5-system/15-chat-channel.md` §(c) 섹션이 실제로 존재하며 서술 방향이 일치한다(이전 라운드 `00_26_17` W1 이 지적한 "지어낸 인용"은 이미 `f86038aae` 로 수정 완료 — 그 문구는 더 이상 §R17 을 SoT 로 잘못 귀속하지 않고 §R17 표의 "별도 갈래(carve-out)" 서술로 정정돼 있음을 재확인).
  - 제안: 조치 불요

## 요약

target(`spec/5-system/6-websocket-protocol.md` §4.4 · `14-external-interaction-api.md` §R17,
동반 `conversation-thread.md`)이 이번 diff 로 서술하는 "SSE/fanout `waiting_for_input`
표면은 REST 와 동일 강도로 닫혔고, `execution.node.*` 의 `envelope.output` 만 잔여"라는
경계선은 코드(`websocket.service.ts`·`node-output-allowlist.ts`)·테스트 캐너리
(`websocket.service.spec.ts`)·plan 트래커(`spec-sync-external-interaction-api-gaps.md`)·
인접 spec(`15-chat-channel.md` §(c), chat-channel 렌더러 코드)과 전수 대조한 결과 CRITICAL 급
모순은 발견되지 않았다. 유일한 잔존 이슈는 `spec/conventions/egress-masking.md` §2 의
파이프라인 순서 서술이 이번 PR 이 추가한 `nodeOutput allowlist` 단계를 반영하지 못한
WARNING 1건인데, 이는 앞선 `23_29_27` 라운드에서 이미 발견돼 planner 소관으로 plan
트래커에 명시적으로 등재·defer 된 것을 재확인한 것으로, 현재 HEAD 에도 미해소 상태임을
기록한다(신규 발견 아님, push 차단 사유 아님). 나머지는 전부 기록 목적 INFO 다.

## 위험도

LOW
