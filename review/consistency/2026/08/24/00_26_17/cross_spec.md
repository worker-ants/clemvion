# Cross-Spec 일관성 검토 — `spec/conventions/` (impl-done, diff-base=origin/main)

## 검토 방법 메모

전달받은 `_prompts/cross_spec.md` 번들은 컨텍스트 예산 초과로 `node-output.md` /
`error-codes.md` / `swagger.md` / `secret-store.md` / `node-cancellation.md` 및
**git diff 본문**이 절단되어 있었다. 이 절단을 신뢰하지 않고, 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/sse-nodeoutput-allowlist-3b6219`)에서
`git diff origin/main...HEAD`·해당 spec 원문·대상 코드(`node-output-allowlist.ts`,
`websocket.service.ts`, `websocket.service.spec.ts`, `button-interaction.service.ts`)를
직접 Read/grep 하여 재구성했다.

**실제 diff 범위** (`spec/conventions/` 스코프, review/ 산출물 제외):
- `spec/conventions/conversation-thread.md` (+5/-1) — target
- `spec/5-system/14-external-interaction-api.md` (+64/-6) — 같은 커밋에서 동반 갱신
- `spec/5-system/6-websocket-protocol.md` (+1/-1) — 같은 커밋에서 동반 갱신

target(`conversation-thread.md`)은 §4 durable park resume 절의 예고 문장
(`SSE·fanout 이 잔여다`)을 취소선 처리하고, "자기-반증형 소정정" 블록을 추가해
`execution.node.completed`/`.failed`의 `envelope.output`만 잔여로 좁혔다. 이 문장은
`#1205`에서 developer 본인이 쓴 것으로 `git log`(`16f3e3625`)로 확인되며, CLAUDE.md
§자기-반증형 소정정의 5조건(작성자 동일·예고 문장·실측 반증·문장 국한·spec_impact 명시)
경로에 해당한다.

## 발견사항

교차 검증한 항목과 결과는 다음과 같다 (전부 정합 확인, 결함 없음):

1. **데이터 모델 / API 계약** — target 이 참조하는 `NODE_OUTPUT_ALLOWED_KEYS` 13키
   (`node-output-allowlist.ts`)가 `spec/5-system/14-external-interaction-api.md` §R17
   표·`spec/conventions/node-output.md`(`_resumeState`/`_retryState` internal 예외 서술)와
   1:1 일치. `websocket.service.ts`의 `toFanoutEnvelope`가 `waiting_for_input`의
   `nodeOutput`/`buttonConfig.nodeOutput`에만 allowlist 를 걸고 `envelope.output`은
   deny-list 그대로 두는 구현이 target 및 EIA §R17 정정 블록의 서술과 정확히 일치.
2. **요구사항 ID (`R17`)** — `spec/1-data-model.md`·`5-system/12-webhook.md`·
   `7-channel-web-chat/1-widget-app.md` 등 8개 문서가 `EIA §R17`을 참조하지만 전부
   같은 절(마스킹 정책·적용 범위)을 가리키는 상호참조이며, 로컬 재정의로 인한 충돌 없음.
3. **잔여 갭 추적** — target 이 "잔여는 정본 트래커에 등재" · "`websocket.service.spec.ts`
   의 `[잔여]` 캐너리가 고정"이라 주장한 두 근거를 모두 실측: `plan/in-progress/
   spec-sync-external-interaction-api-gaps.md` 에 미체크 항목(`envelope.output` 잔여)이
   있고, `websocket.service.spec.ts:931` 에 `[잔여] execution.node.* 의 envelope.output
   은 아직 allowlist 를 지나지 않는다` 캐너리 테스트가 실존.
4. **버튼 재개 shape 반례** — EIA §R17 정정 블록의 "allowlist 를 그대로 걸면 `{}`가
   된다"는 주장을 `button-interaction.service.ts`의 `updatedOutput` 리터럴
   (`{type, buttonId, buttonLabel, clickedAt, selectedItem, nodeOutput, _selectedPort}`)
   로 대조 — 13키 어느 것과도 겹치지 않아 주장이 실측과 일치.
5. **동반 문서 정합** — `6-websocket-protocol.md` §4.4 wire caveat 갱신문(“`nodeOutput`
   키 집합은 공유하지 않는다” / “`envelope.output`은 이 좁히기 대상이 아니다”)이 EIA
   §R17 갱신·target 정정과 동일한 경계선을 서술 — 3개 동반 문서 간 모순 없음.
6. **chat-channel 소비 경로** — `spec/5-system/15-chat-channel.md` CCH-MP-04(버튼/시각형
   presentation, `waiting_for_input` 경유)와 CCH-MP-06(`execution.node.completed` 경유,
   비-blocking)의 구분이 이번 allowlist 적용 범위(전자만 강화, 후자는 잔여)와 정확히
   대응 — chat-channel 쪽 서술이 새로 stale 해지지 않았음.
7. **egress-masking.md 와의 경계** — `egress-masking.md`는 "마스킹 정책·적용 범위·잔여
   갭의 SoT는 EIA §R17"이라 명시하고 리터럴을 중복 기술하지 않아, 이번 target 정정이
   그쪽에 drift 를 만들지 않음.
8. **stale 잔존 문구 부재** — `getStatus 한 출구에 한정` / `SSE/fanout 이 잔여다` 류의
   구 문구가 `spec/**` 전체에서 target·EIA·WS 세 파일 밖에는 재등장하지 않음
   (grep 전수 확인) — 다른 영역에 갱신 누락된 미러가 없음.

CRITICAL·WARNING 급 충돌은 발견되지 않았다.

### INFO

- **[INFO]** 정정 블록 재배치로 인한 문장 이동
  - target 위치: `spec/conventions/conversation-thread.md` §4 "소비처 갱신 (2026-07-09)" 문단
  - 충돌 대상: 없음 (동일 문서 내부)
  - 상세: 원문 마지막 문장("따라서 'park resume 전용'은 저장 목적의 서술이고, 소비처는
    (a)(b)(c)로 확장됐다")이 base 문단에서 신설 blockquote 정정 블록의 마지막 줄로
    이동했다. 내용은 그대로 보존되고 논리적으로도 정정 이후 위치가 더 자연스러우나,
    "자기-반증형 소정정은 그 문장에 국한하고 인접 서술은 건드리지 않는다"(CLAUDE.md
    조건 4)를 엄격히 읽으면 인접 문장의 위치 이동은 경계선상이다. 기능적 모순은 없으므로
    cross-spec 관점 조치는 불요 — rationale-continuity 관점에서 참고만 되면 된다.
  - 제안: 조치 불요 (기록 목적)

## 요약

target(`spec/conventions/conversation-thread.md`)의 이번 diff 는 developer 가 자신이
`#1205`에서 남긴 예고("SSE/fanout 은 잔여")를 같은 날 실측으로 반증하고 정정한
자기-반증형 소정정이며, 같은 커밋에서 `spec/5-system/14-external-interaction-api.md`
§R17과 `spec/5-system/6-websocket-protocol.md` §4.4가 동반 갱신되어 세 문서가 "waiting
표면은 닫혔고 `execution.node.*`의 `envelope.output`만 잔여"라는 동일한 경계선을
정확히 공유한다. 코드(`node-output-allowlist.ts`·`websocket.service.ts`·
`button-interaction.service.ts`)와 테스트 캐너리(`websocket.service.spec.ts:931`),
plan 트래커(`spec-sync-external-interaction-api-gaps.md`)까지 대조한 결과 문서 간
모순, 요구사항 ID 충돌, API 계약 불일치, chat-channel/egress-masking 등 인접 spec
과의 drift 는 발견되지 않았다. 유일한 관찰은 정정 블록 내부 문장 재배치(INFO, 기능
영향 없음)뿐이다.

## 위험도

NONE
