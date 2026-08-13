# Plan 정합성 검토 — spec-draft-eia-notification-payload-contract.md

## 검토 방법

target 문서(전문 확인) + `plan/in-progress/**` 번들 중 target 이 직접 인용하거나 `spec_impact`
가 겹치는 문서를 전수 확인:

- `retry-turn-terminal-guard.md` (target 이 **#2** 를 명시 인용) — 전문
- `spec-sync-external-interaction-api-gaps.md` / `spec-sync-websocket-protocol-gaps.md`
  (target frontmatter `pending_plans:`) — 전문
- `node-output-redesign/README.md` (target 후속 항목이 인용) — 관련 절
- `eia-context-schema-followups.md` / `spec-draft-eia-r8-alignment.md` /
  `spec-update-node-cancellation-shutdown-classification.md` — 원본 파일 직접 열람(번들 예산
  절단으로 프롬프트에는 없었음)
- `plan/in-progress/**` grep(`cancelledBy`/`EIA §6`/`fanoutEnvelope`/`line 536`/`ai_message`/
  `notification-fanout.service.ts`/`chat-channel.dispatcher.ts`/`chat-channel/types.ts`/
  `interaction-stream.controller.ts`)로 target 이 건드리는 코드·spec 자리를 다루는 다른 plan
  전수 스캔 — 위 목록 밖 추가 매치 없음
- target 의 `spec_impact` 4개 파일을 인용하는 다른 in-progress plan 14개 전수 확인(섹션 단위
  대조: `3-execution.md §9`(stop-editor plan) vs target `§8.1`, `chat-channel-adapter.md §2.3`
  (visual-ssr-png) vs target `§1.2` 등 — 전부 다른 절이라 내용 충돌 없음)
- 실측: `spec/5-system/14-external-interaction-api.md` §6 도입부(552~554행)가 실제로 비어
  있음을 확인(target 의 삽입 지점 전제 성립)

## 발견사항

- **[INFO]** `retry-turn-terminal-guard.md` **#2**(`cancelledBy` 추가)가 target 을 역참조하지 않음
  - target 위치: `## 후속 (developer)` 마지막 항목("`failRetryExecution` 의 `cancelledBy` 누락 →
    `retry-turn-terminal-guard.md` **#2** 에서 집행")
  - 관련 plan: `plan/in-progress/retry-turn-terminal-guard.md` §"코드 — 우선순위 순" 표 #2
    ("`EXECUTION_CANCELLED` payload 에 spec §4.1 필수 `cancelledBy` 추가", P2)
  - 상세: 링크는 target → retry-turn-terminal-guard.md 방향으로만 있다. #2 자체 항목 텍스트는
    "spec §4.1 이 `'user'|'system'|'timeout'` 닫힌 union 을 필수로 요구" 라고만 적어, target 이
    이번에 그 계약(닫힌 union·`error.code` 매핑)을 EIA §6 도입부로 이관한다는 사실을 모른다.
    #2 를 target draft 머지 **이전**에 집행해도 값 자체(닫힌 3값 union)는 동일해 실동작 충돌은
    없지만, 구현자가 "spec §4.1" 만 보고 EIA §6 도입부(새 SoT)를 놓칠 여지가 남는다.
  - 제안: `retry-turn-terminal-guard.md` #2 항목에 한 줄("EIA 쪽 정본은 §6 도입부 — target draft
    머지 후 그쪽을 확인할 것") 역포인터 추가. 낮은 비용, 낮은 위험이라 차단 사유는 아니다.

- **[INFO]** `node-output-redesign/README.md:372` cross-ref 의 섹션 번호가 이미 어긋나 있다
  - target 위치: `## 후속 (developer)` — "`node-output-redesign/README.md:372` 의 EIA §6.3
    cross-ref 재검증 — 절 번호는 그대로지만 §6.3 이 참조하는 내용의 성격이 바뀐다"
  - 관련 plan: `plan/in-progress/node-output-redesign/README.md:372`
  - 상세: 그 줄은 "ai-agent `output.error` shape ↔ **`execution.failed`** payload `error` 필드"
    라 서술하면서 인용 절을 **§6.3** 이라 적는다. 그런데 현재 spec 실측 결과 `execution.failed`
    는 **§6.4** 다(§6.3 은 `execution.completed`). 즉 "절 번호는 그대로" 라는 target 의 전제와
    달리, 그 cross-ref 는 target 의 리라이트 이전부터 이미 잘못된 절 번호를 가리키고 있었다.
    target 의 재검증 후속 항목이 이 cross-ref 를 다시 열어보긴 하겠지만, 목적을 "성격이
    바뀌었는지" 로만 좁혀 적어 두면 "번호 자체가 처음부터 틀렸다" 는 별개 사실을 놓치기 쉽다.
  - 제안: 재검증 시 절 번호(§6.3→§6.4)도 함께 정정 대상에 포함하도록 target 또는 후속 처리
    시점에 한 줄 명시. 차단 사유 아님(이미 후속 항목이 그 자리를 열게 되어 있다).

미해결 결정과의 정면 충돌, 선행 plan 미해소, 후속 항목 완전 누락 — 이 세 축에서 CRITICAL/
WARNING 급 항목은 발견되지 않았다. 특히:

- `spec-update-node-cancellation-shutdown-classification.md` 최상단의 미해결 (a)/(b) 결정
  (SIGTERM/timeout 유발 abort 를 `cancelled` 로 재정의할지)은 target 이 다루는 종결 이벤트
  payload 구조(필드 집합·봉투)와 축이 다르다 — target 은 기존에 이미 구현·문서화된
  `cancelledBy: 'timeout'` (`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT`) 닫힌 3값
  union 을 그대로 이관할 뿐 새 값을 추가하거나 그 결정을 선점하지 않는다.
- target 이 제안하는 `error.{code,message,nodeId,details?}` 형태는 target 이 새로 결정하는 것이
  아니라 현재 `spec/5-system/14-external-interaction-api.md:662-668`(§6.4)에 **이미 그대로
  문서화**돼 있던 내용이다 — node-output-redesign/README.md:372 가 우려하는 "ai-agent
  `output.error`(node-scope, `{code,message,details}`)와의 shape 충돌"은 EIA 쪽이 execution-scope
  라 `nodeId` 를 추가로 필요로 하는 것으로, 서로 다른 레이어의 계약이라 충돌이 아니다.
- `spec-sync-external-interaction-api-gaps.md` / `spec-sync-websocket-protocol-gaps.md`
  (target frontmatter 의 `pending_plans:`) 는 §6 종결 이벤트와 무관한 항목(분산 SSE fan-out,
  `auth.token_expired` emit 등)만 열려 있어 target 의 전제 조건과 충돌하지 않는다.
- target 의 `spec_impact` 4개 파일을 공유하는 다른 14개 in-progress plan 은 전부 다른 섹션
  (`3-execution.md §9`/`§4` vs target `§8.1`, `chat-channel-adapter.md §2.3` vs target `§1.2`,
  EIA §5.x/§R8/§3.x vs target `§6`)을 다뤄 문면 충돌이 없다.

## 요약

target 은 반려 5회를 거치며 자신이 건드리는 자리(EIA §6 전 구간·WS §4.1·chat-channel-adapter
§1.2·3-execution.md §8.1)를 이미 grep 으로 전수 확인했고, `pending_plans:` 로 명시한 두 gap
tracker 와 `retry-turn-terminal-guard.md` #2 참조도 실제로 무해하게 정합한다. 발견된 두 항목은
모두 이미 target 자신의 후속 체크리스트가 포괄하는 범위 안의 **정밀도 보강**(역포인터 한 줄,
섹션 번호 재확인 시 번호 자체도 검사)이라 별도 plan 갱신이나 결정 합의 없이도 이번 PR 진행에
지장이 없다. 미해결 결정 우회나 선행 plan 미해소, 실질적 후속 누락은 확인되지 않았다.

## 위험도

LOW
