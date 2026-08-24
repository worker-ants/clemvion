# Rationale 연속성 검토 — node-output-envelope (spec/conventions/, impl-done)

대상: `spec/conventions/chat-channel-adapter.md` / `spec/conventions/conversation-thread.md` (diff `origin/main...HEAD`),
교차 참조: `spec/5-system/6-websocket-protocol.md` §4.1 · `spec/5-system/14-external-interaction-api.md` §R17 ·
`spec/5-system/15-chat-channel.md` CCH-MP-06

## 발견사항

- **[WARNING]** "래퍼/도메인값 구분" 원칙 스윕(commit `feb1967a2`)이 같은 문서 안의 세 번째 형제 서술을 놓쳤다
  - target 위치: `spec/conventions/chat-channel-adapter.md` §3 "EIA / Internal Event → renderNode 매핑" 표, `execution.node.completed` (chat-channel-internal) 행 (파일 기준 382행) — `template: \`output.rendered\` 를 \`text\` 1건 (MarkdownV2 escape)`
  - 과거 결정 출처: 같은 파일 §1 `ChatChannelInternalEvent.output` 필드 JSDoc (파일 기준 178~189행, 이번 diff 로 추가) — *"**`NodeHandlerOutput` 래퍼 전체**(= `NodeExecution.outputData`)다 — 도메인 값은 한 겹 아래인 `output.output` 이다 … 종전 주석은 이 필드를 `NodeHandlerOutput.output` 이라 적었다 — **한 겹 얕았다**"*. 같은 정정이 `spec/5-system/6-websocket-protocol.md` §4.1 표(`execution.node.completed` 행)와 `spec/5-system/15-chat-channel.md` CCH-MP-06 에도 이번 diff 로 반영됐다.
  - 상세: §3 매핑표의 `execution.node.completed` 행은 입력 payload 컬럼을 `node.type … + output` 으로 명시하는데, 이 `output` 은 바로 위 §1 에서 "래퍼 전체" 라고 막 정정한 그 필드와 동일 객체다(같은 `ChatChannelInternalEvent`). 그런데 세 번째 컬럼(출력 규칙)은 여전히 `template: output.rendered` — 한 겹 얕은 서술을 그대로 남겼다. 커밋 `feb1967a2` 의 메시지("래퍼/도메인값 구분을 형제 문서 둘에도")는 정확히 이 종류의 누락(§4.1 만 고치고 같은 주장을 담은 형제를 안 고침)을 발견해 두 곳(같은 파일의 §1 JSDoc, `15-chat-channel.md` CCH-MP-06)을 고쳤다고 적었지만, **같은 파일 안의 세 번째 형제(§3 표)는 스윕 대상에서 빠졌다** — `git blame` 확인 결과 이 행은 2026-06-04 최초 작성 이후 이번 diff 에서 손대지 않았다.
  - 코드 실측: `codebase/backend/src/modules/chat-channel/providers/{telegram,discord,slack}-message.renderer.ts` 의 `extractRendered`는 `nodeOutput.rendered → nodeOutput.payload.rendered → nodeOutput.output.rendered` 순으로 훑는 방어적 구현이라 **런타임 파손은 없다** — 이는 같은 커밋이 §1 JSDoc 정정문에서 이미 밝힌 것과 동일한 사정이다. 다만 그 정정문 자신이 "이 주석을 SoT 로 믿고 `output.rendered` 를 직접 읽으면 `undefined` 다" 라고 경고한 바로 그 위험이 §3 표에 그대로 남아 있다.
  - 제안: §3 표의 `template` 셀을 `output.output.rendered`(경로) + "wire `output` 은 `NodeHandlerOutput` 래퍼 전체이며 렌더러는 legacy flat fallback(`output.rendered`)도 함께 훑는다" 로 정정하고, §1 JSDoc·WS §4.1·CCH-MP-06 과 동일한 "2026-08-24 정정" 각주를 붙인다. 이번 커밋이 이미 "과잉 정정은 하지 않았다"고 명시한 경계(진짜 `NodeHandlerOutput` 자체를 서술하는 자리는 그대로 둔다)와 구분해, §3 표는 **wire 맥락**이므로 정정 대상에 포함되어야 한다.

## 그 외 확인한 항목 (문제 없음 — 참고용)

- **결정 번복 + 새 Rationale 동반 (모범 사례)**: `spec/5-system/14-external-interaction-api.md` §R17 의 `execution.node.completed`/`.failed` `envelope.output` 행이 "deny-list 유지(잔여)" → "fail-closed allowlist" 로 뒤집혔다. 직전 유예 근거("이종 payload, 목록을 걸면 `{}`")는 취소선으로 보존하고 "재정정(2026-08-24)" 블록에 (a) 무엇이 틀렸는지(그 flat record 는 `nodeOutputCache` 에만 들어가고 `outputData` 가 되는 것은 `buildResumedStructuredOutput` 의 `NodeHandlerOutput`) (b) 실측 근거(e2e 285건 후 실 DB 조회, top-level 키 분포표) (c) 잔존 위험(`ai-turn-orchestrator.service.ts` 의 `finalAdapted ?? nodeOutputCache[node.id]` 폴백, `[잔여 고정]` 캐너리로 명시 고정) (d) 외부 수신자 영향 고지까지 전부 갖췄다. `codebase/backend/src/modules/websocket/websocket.service.spec.ts` 의 이전 `[잔여]` 캐너리도 실제로 뒤집혀 `[캐너리]` 통과 단언으로 교체됐다 — 결정 번복 후 캐너리 방치(반복 지적된 결함 유형)가 재발하지 않았다.
- **합의 원칙 위반 여부**: `getStatus` terminal `result`/`error` = "작성자가 정의한 워크플로 출력이라 allowlist 를 걸지 않는다"는 §R17 원칙은 이번 diff 가 건드리지 않았고, 새로 allowlist 가 걸린 `envelope.output` 은 `NodeHandlerOutput` 래퍼 레벨에만 적용되며 도메인 값(`output.output`)은 그대로 유지돼 원칙과 층이 달라 충돌하지 않는다. "내부 WS(에디터)는 대상이 아니다" invariant([WS §4.4](spec/5-system/6-websocket-protocol.md) strip-only 결정)도 이번 diff 의 신규 캐너리가 "내부 WS 는 원문 유지"를 직접 재확인한다.
- **자기-반증형 소정정 거버넌스**: `conversation-thread.md` 의 취소선 정정은 CLAUDE.md 예외 조건(developer 자신이 쓴 예고 문장을 실측으로 반증)을 충족하는 형태로 적용됐고, API 계약 문서(EIA/WS)는 별도로 `--impl-done spec/5-system/` → `spec/conventions/` 게이트를 순차 실행해 사후 그물을 통과시켰다(commit `970cac5cf`, `feb1967a2`).
- **암묵적 가정 충돌**: 없음. fail-open degraded 정책(Redis 장애 시 in-memory fallback, `data-flow/15-external-interaction.md`)과 이번 egress 필터링은 별개 축이라 충돌하지 않는다.

## 요약

이번 target(`spec/conventions/` 스코프)의 핵심 변경 — EIA §R17 "envelope.output" allowlist 확대, WS §4.1/CCH-MP-06 래퍼-도메인값 구분 정정, conversation-thread.md 자기반증형 소정정 — 은 실측 근거·잔존 위험 고지·캐너리 갱신·형제 문서 동기화를 갖춘 Rationale 연속성 모범 사례다. 다만 그 형제-동기화 스윕(commit `feb1967a2`, "래퍼/도메인값 구분을 형제 문서 둘에도")이 정작 **같은 파일(`chat-channel-adapter.md`) 안의 세 번째 형제 서술**(§3 매핑표 `execution.node.completed` 행의 `output.rendered`)은 놓쳤다 — 방금 §1 JSDoc 에서 스스로 경고한 "SoT 로 믿고 얕게 읽으면 undefined" 위험이 200행 아래 표에 그대로 남은 자기모순이다. 런타임 파손은 없으나(렌더러가 방어적 fallback 순회) 문서 SoT 로서는 결함이라 WARNING 1건으로 보고한다.

## 위험도

LOW
