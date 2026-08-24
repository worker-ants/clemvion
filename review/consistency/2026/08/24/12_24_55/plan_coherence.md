STATUS=success plan_coherence: 발견 없음 (CRITICAL 0 · WARNING 0 · INFO 0) — 위험도 NONE
===REPORT_MARKDOWN_BELOW===
# Plan 정합성 검토 — `spec/conventions/` (impl-done, diff-base `origin/main`)

## 범위 확인

`git diff origin/main...HEAD --stat -- spec/conventions/ codebase/` 실측:

```
spec/conventions/chat-channel-adapter.md  | 15 +++++++++++---
spec/conventions/conversation-thread.md   |  2 +-
codebase/.../websocket.service.ts         | 68 +++++++++++--
codebase/.../websocket.service.spec.ts    | 165 ++++++++++++++++----
```

`spec/conventions/` 안에서 실제로 바뀐 파일은 2개뿐이다:

1. **`chat-channel-adapter.md`** — §1.3 `ChatChannelInternalEvent.output` JSDoc + §3
   `execution.node.completed` 매핑표 행. 둘 다 "wire `output` 은 `NodeHandlerOutput`
   래퍼 전체이고 도메인 값은 `output.output`" 이라는 동일 정정을 같은 파일 두 곳에 미러.
2. **`conversation-thread.md`** — §8.4 정정 blockquote 안의 한 문장 취소선 처리
   (자기-반증형 소정정, CLAUDE.md 예외 조건 1~5 충족: 작성자=developer 본인(`#1208`),
   예고 문장, 실 DB 조회로 반증, 그 문장에 국한, `spec_impact` 명시 + `--impl-done
   spec/conventions/` 게이트).

## 대조한 plan 문서

- `plan/complete/node-output-envelope.md` — 이번 작업의 원 plan (이미 `status: complete`
  로 이동, 이번 세션에서 체크리스트 항목 하나만 갱신 중 — `12_13_36` → `12_24_55` 재실행
  인용). `spec_impact` 프론트매터가 위 두 파일을 정확히 열거하고, 자기-반증형 소정정
  카테고리를 `conversation-thread.md` 한 파일로 명시 제한.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 정본 트래커. 해당 항목
  (`23_29_27` cross_spec CRITICAL "`envelope.output` 은 아직 deny-list 다")이 이미
  `[x] ~~...~~ 해소 (2026-08-24)` 로 갱신돼 있고, 반증된 유예 근거·실측 결과·교훈이 `<details>`
  로 이력 보존됨. 파생 후속 항목(`finalAdapted ?? nodeOutputCache` 폴백, provider spec 3곳의
  `output.rendered` 판정 미정, WS §3.2 채널 표 누락 등)은 전부 `[ ]` 로 별도 등재돼 있고 각각
  "이번 PR 이 안 고친 이유 + 재개 신호"가 기록됨 — 조용히 누락된 후속 항목 없음.
- `plan/in-progress/spec-draft-eia-62-waiting-payload.md` — §R17 이력 blockquote 가
  "2026-08-24 갱신: 그 잔여도 닫혔다" 로 이미 갱신, 구 서술은 취소선 처리. 이번 diff 와
  같은 사실을 서술하며 어긋나지 않음.
- 그 외 `chat-channel-adapter.md`/`conversation-thread.md` 를 참조하는 in-progress plan
  5건(`ai-agent-tool-connection-rewrite.md`, `eia-context-schema-followups.md`,
  `chat-channel-visual-ssr-png.md`, `eia-terminal-payload.md`,
  `spec-draft-eia-notification-payload-contract.md`) — 이번 diff 가 건드린 §1.3 JSDoc·§3
  매핑표 행·§8.4 문장을 인용하는 곳 없음 (grep 0건). 충돌 표면 아님.
- `node-output-redesign/*.md` — `output.output` 표현이 등장하는 곳(`information-extractor.md`,
  `map.md`)은 **다른 레이어**를 가리킨다 (LLM extractor 결과 이중 중첩 폐기 / Map·ForEach
  시작 시점 envelope 노출 여부) — 이번 diff 의 "wire envelope vs `NodeHandlerOutput`
  래퍼" 정정과 이름만 같고 대상이 다르다. 충돌 아님.

## 검토 관점별 판정

1. **미해결 결정과의 충돌** — 없음. 이번 diff 는 사실 정정(래퍼 한 겹 깊이) + 취소선 정정이며,
   어느 plan 도 이 지점을 "결정 필요" 로 열어 두지 않았다. `spec-sync-external-interaction-api-gaps.md`
   의 관련 CRITICAL 항목은 이 작업이 닫으려는 바로 그 항목이고, 이미 `[x]` 로 갱신돼 diff 와 일치.
2. **선행 plan 미해소** — 없음. 이 정정이 전제하는 사실(`resolveButtonInteracton` flat record 는
   `outputData` 에 안 실린다, 실 DB 조회 84행 전수 확인)은 원 plan 본문에 실측으로 기록돼 있고
   트래커에도 동일 실측이 이력으로 복제됨 — drift 없음.
3. **후속 항목 누락** — 없음. 이번 정정이 만드는 후속(예: provider spec 3곳의 `output.rendered`
   판정, `finalAdapted` 폴백 위험)은 이미 `spec-sync-external-interaction-api-gaps.md` 에
   개별 `[ ]` 항목으로 등재돼 있다(각각 planner 소관/재개 신호 명시). `conversation-thread.md`
   frontmatter `code:` 에 `websocket.service.ts` 누락 같은 인접 갭도 별도 INFO 로 이미 추적 중 —
   이번 diff 가 새로 유발한 무추적 후속은 발견되지 않았다.

## 요약

이번 target(`spec/conventions/` diff, 2 파일)은 원 plan(`node-output-envelope.md`)의
`spec_impact` 범위와 정확히 일치하고, 두 정정 모두 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)
와 형제 draft plan(`spec-draft-eia-62-waiting-payload.md`)에 동일 사실로 이미 반영돼 있다.
미해결 결정을 우회하는 서술이 없고, 이 정정이 전제하는 실측(DB 조회)도 plan 본문에 기록돼
있으며, 파생 가능한 후속 항목들은 전부 정본 트래커에 개별 `[ ]` 항목 + 재개 신호로 등재돼
누락이 없다. plan 정합성 관점에서 갱신이 필요한 지점을 찾지 못했다.

## 위험도

NONE
