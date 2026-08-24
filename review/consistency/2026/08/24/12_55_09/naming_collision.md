# 신규 식별자 충돌 검토 — spec/conventions/ (impl-done)

## 검토 범위 확정

`git diff origin/main...HEAD --stat -- spec/conventions/`:

```
spec/conventions/chat-channel-adapter.md | 15 ++++++-
spec/conventions/conversation-thread.md  | 13 ++++--
```

target 스코프(`spec/conventions/`) 안에서 실제로 바뀐 spec 파일은 이 둘뿐이다(그 외 271개
bundle 파일은 프롬프트 예산상 생략됐으나, `--stat` 로 diff 자체가 없음을 확인했으므로 신규
식별자 후보가 아니다). 관련 sibling 문서(`spec/5-system/14-external-interaction-api.md`,
`spec/5-system/15-chat-channel.md`, `spec/5-system/6-websocket-protocol.md`)와 코드
(`codebase/backend/src/modules/websocket/websocket.service.ts` +
`websocket.service.spec.ts`)도 diff 로 직접 확인해 대조군으로 썼다.

## 변경 성격

이번 PR 은 **기존 필드의 wrapper 깊이 오서술을 정정**하는 문서 수정이다 — wire 상의
`output`(fanout envelope 최상위)이 도메인 값이 아니라 `NodeHandlerOutput` **래퍼 전체**이고,
실제 도메인 값(`rendered`/`error` 등)은 한 겹 더 아래 `output.output` 이라는 사실을 문서에
반영한다. 코드 쪽은 이미 그 depth 로 동작 중이던 것을 spec 서술이 뒤늦게 따라잡은 것이고,
추가로 내부 helper 함수 `narrowTopLevelNodeOutput` 하나가 새로 생겼다.

## 신규 식별자 목록과 충돌 여부

| 신규/변경 표기 | 종류 | 충돌 검사 |
|---|---|---|
| `output.output.rendered` / `payload.output.output.error` | 필드 경로 표기(dot-path) | 새 타입/엔티티가 아니라 기존 `output` 필드 내부의 실제 nesting 을 명시한 것. 코드(`extractRendered`, telegram/discord/slack 각 renderer)가 이미 `rendered → payload.rendered → output.rendered` 순으로 조회하는 legacy fallback 을 보유 — spec 서술이 기존 구현과 일치하도록 정정됐을 뿐 새 계약이 아님. 충돌 없음 |
| `narrowTopLevelNodeOutput` (`websocket.service.ts:182`) | 신규 함수(비-export, 모듈 내부 private) | `grep -rn "narrowTopLevelNodeOutput" codebase/` 결과 정의 1곳 + 호출 2곳(`allowlistFanoutNodeOutput` 내부)뿐. 기존 식별자와 동명 충돌 없음. spec 문서에는 노출되지 않는 구현 세부(JSDoc 안에서만 `{@link}` 참조) — spec 레벨 신규 식별자 아님 |
| `allowlistFanoutNodeOutput` / `allowlistNodeOutputKeys` | 기존 식별자(변경 없음) | PR 이전부터 존재(`node-output-allowlist.ts`, `interaction.service.ts` 등에서 이미 사용). 재정의 아님 |
| CCH-MP-06 (`spec/5-system/15-chat-channel.md`) | 기존 요구사항 ID, 본문 문구만 수정 | ID 신설 없음. `output.rendered` → `output.output.rendered` 로 본문 dot-path 만 정정. 요구사항 ID 충돌 없음 |
| `execution.node.completed`/`.failed` (WS §4.1 표) | 기존 이벤트명, 필드 설명만 정정 | 이벤트명 자체는 변경 없음(EIA §6.1 5종 whitelist 도 불변, diff 로 확인). 이벤트/메시지명 충돌 없음 |
| 신규 spec 파일 | 없음 | `spec/conventions/` 에 새 파일 추가 없음(--stat 로 확인). 파일 경로 충돌 검사 대상 자체가 없음 |
| 신규 ENV/설정키 | 없음 | diff 전체(코드 포함)에 새 환경변수·config key 도입 없음 |
| 신규 API endpoint | 없음 | REST/webhook endpoint 신설 없음. 기존 `execution.node.completed`/`.failed`/`waiting_for_input` 표면의 서술 정정뿐 |

## 발견사항

이번 diff 범위 안에서 CRITICAL/WARNING 수준의 신규 식별자 충돌은 발견되지 않았다. 참고용
INFO 한 건만 기록한다.

- **[INFO]** `turnDebug` 이름 충돌은 이 PR 의 범위 밖(별건으로 이미 분리·추적됨)
  - target 신규 식별자: 없음 — 이 PR 자체는 `turnDebug` 를 도입하지 않음
  - 기존 사용처: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` (다른 worktree
    `eia-r8-cache-scope-4ae434` 소속, 이번 프롬프트의 관련 컨텍스트 번들로만 포함)가 top-level
    `turnDebug`(AI turn1 waiting emit, `ai-turn-orchestrator.service.ts:615`) 와
    `nodeOutput.meta.turnDebug`(WS §4.4:449 정본 배열)의 동명이의 충돌을 이미 CRITICAL 로
    식별해 "별건 — planner 인계" 로 등재해 두었다.
  - 상세: 이번 `node-output-envelope` PR 의 diff(`spec/conventions/chat-channel-adapter.md`,
    `conversation-thread.md`)는 `turnDebug` 를 전혀 언급하지 않으므로 이 충돌을 새로 만들지도,
    악화시키지도 않는다. 다만 같은 `output`/`nodeOutput` wrapper-depth 주제를 다루는 인접
    작업이라 향후 세션이 두 이슈를 혼동하지 않도록 짚어 둔다.
  - 제안: 조치 불필요(이 PR 범위 밖). `turnDebug` 리네임은 기존에 등재된 별건 트래커에서
    처리.

## 요약

target(`spec/conventions/`) 안에서 실제로 변경된 두 파일(`chat-channel-adapter.md`,
`conversation-thread.md`)은 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·
파일 경로를 하나도 신설하지 않았다. 변경 내용은 전부 기존 `output` 필드의 wrapper 깊이
오서술(한 겹 얕게 적혀 있던 것)을 실제 구현(`NodeHandlerOutput` 래퍼 → `output.output`)에
맞춰 정정한 것이며, 코드 쪽에서 새로 추가된 유일한 식별자(`narrowTopLevelNodeOutput`)도
비-export 모듈 내부 함수로 기존 식별자와 충돌하지 않는다. sibling 문서
(EIA/websocket-protocol/chat-channel spec)와도 대조했으나 동일하게 기존 필드 서술 정정
수준이라 신규 식별자 충돌 위험은 확인되지 않았다.

## 위험도

NONE
