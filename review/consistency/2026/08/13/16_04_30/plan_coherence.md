# Plan 정합성 검토 — spec-draft-eia-notification-payload-contract.md

## 발견사항

- **[WARNING]** `node-output-redesign/README.md` P0 항목의 EIA §6.3 교차참조가 target 의 §6.3
  재구성을 반영하지 못한 채 남아 있다
  - target 위치: `## 결정 — 필드 집합은 1곳, 봉투는 채널별 1곳, 나머지는 포인터로` §(1)·(2)·(3),
    체크리스트 `- [ ] EIA §6.3 신설(필드 집합) + §6.x 봉투 1회 + §6.4/§6.5 를 참조로 축약`
  - 관련 plan: `plan/in-progress/node-output-redesign/README.md:372` — "Phase E · P0 — ai-agent
    error 컨트랙트" 항목의 `(EIA cross-ref)`: *"본 P0 가 ai-agent `output.error` shape 을
    신설할 경우 [Spec External Interaction API §6.3] 의 `execution.failed` payload `error`
    필드 매핑에 영향. 착수 전 EIA §6.3 호환성 확인 후 SSE payload spec 동기화 필요."*
  - 상세: 현재 `spec/5-system/14-external-interaction-api.md` 의 §6.3 은
    `execution.completed`(result.outputs/finalNodeId/finalPort) 전용이고, `error` 필드는
    §6.4(`execution.failed`)에 있다 — 즉 이 cross-ref 는 **오늘도 절 번호가 어긋나 있다**
    (§6.3 이 아니라 §6.4 를 가리켰어야 함, target 과 무관한 선재 오류). target 이 결정한
    재구성(§6.3 을 "종결 이벤트가 실어 나르는 사실" 단일 규범 표로 신설하고 `error` 필드를
    그 표에 편입, §6.4/§6.5 는 참조로 축약)이 실행되면 **§6.3 이 실제로 `error` 필드의
    거처가 되어 이 cross-ref 의 절 번호가 우연히 맞게 된다** — 그러나 그 사이 §6.3 의
    성격 자체가 "completed 전용 payload" 에서 "3종 종결 이벤트 공유 필드 집합" 으로 바뀌므로,
    P0 착수 시점에 이 cross-ref 를 그대로 읽으면 옛 §6.3(완료 전용 result 구조)을 전제로
    호환성을 판단할 위험이 있다. target 의 후속 목록(§"후속 (developer)" 6건)에는 이
    교차참조 갱신/재확인이 포함돼 있지 않다.
  - 제안: target 의 `후속 (developer)` 절 또는 `spec-sync-external-interaction-api-gaps.md`
    에 "P0(ai-agent error 컨트랙트) 착수 전 `node-output-redesign/README.md:372` 의 EIA
    §6.3 cross-ref 를 재구성된 §6.3(신규 필드 표)·§6.4(envelope) 기준으로 재검증" 항목을
    한 줄 추가할 것. 급한 항목은 아니다 — target 의 재구성이 이 cross-ref 를 깨뜨리지 않고
    오히려 절 번호 오류를 결과적으로 상쇄하지만, 참조 대상의 **의미**가 바뀌는 것은 target
    문서 자신도 인지하지 못하고 있다.

## 확인했으나 문제 없음 (참고)

- `retry-turn-terminal-guard.md` **#2**(`EXECUTION_CANCELLED` payload 에 `cancelledBy` 추가,
  P2, 미완료) — target 의 후속 목록이 "`failRetryExecution` 의 `cancelledBy` 누락 → 그 plan
  #2 에서 집행" 이라 정확히 지목하며, 완료 시 target §(1) 표의 "경로 1곳 누락" 캐비엇도 함께
  해제된다고 명시한다. 두 문서 상호 정합 확인됨(선행 plan 미해소 항목이지만 target 이 이미
  올바르게 의존관계로 인지·기록하고 있어 별도 지적 불요).
- `pending_plans:`(`spec-sync-external-interaction-api-gaps.md`,
  `spec-sync-websocket-protocol-gaps.md`) — 두 문서 모두 §6.x 필드 내용이 아니라 §5.x
  구조·에러코드·won't-do 항목을 다루고 있어 target 의 결정과 충돌 없음.
- `spec-draft-eia-r8-alignment.md`(같은 EIA 문서, §R8 idempotency 캐시 대상) — target 이
  건드리는 §6.x 종결 이벤트 payload 와는 다른 절이라 충돌 없음. 이 세션의 worktree
  (`eia-r8-cache-scope-4ae434`)가 그 plan 의 developer 턴도 최근 수행했다는 사실은 그
  plan 자체의 사후 기록(§체크리스트 마지막 항목)에 이미 반영돼 있다.
- `spec-update-node-cancellation-shutdown-classification.md` §"추가 위임 #4(2)" —
  `node-cancellation.md §5.1` 의 `meta.success=false`(node-level, `execution.node.cancelled`)
  에 대한 미해결 논의로, target 이 다루는 execution-level 종결 이벤트(§4.1 상단 3행)와는
  같은 §4.1 표 안에서도 다른 행이라 충돌 없음.
- `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 삭제 결정 — plan/in-progress 전체에서
  이 필드들을 기능적으로 요구하는 다른 항목 없음(grep 0건, target 자신 외).
- `chat-channel-discord-gateway.md`/`chat-channel-slack-socket-mode.md`/
  `chat-channel-visual-ssr-png.md` — `EiaEvent`/`chat-channel-adapter.md §1.2` 필드 열거에
  의존하지 않음(backlog 상태이거나 다른 절 참조).

## 요약

target 문서(`spec-draft-eia-notification-payload-contract.md`)는 종결 이벤트 payload 필드
집합을 EIA §6.3 로 단일화하는 draft 로, 3회 반려 이력을 근거로 구조적 해법을 택했고, 선행
plan(`retry-turn-terminal-guard.md` #2)에 대한 의존을 정확히 인지·연결해 두었다. `plan/in-progress/**`
전수 대조 결과 이 draft 가 다른 plan 의 미해결 결정을 우회하거나 선행 조건을 무시하는 사례는
없었다. 유일한 갭은 `node-output-redesign/README.md` 의 EIA P0(ai-agent error 컨트랙트)
교차참조가 §6.3 의 재구성(성격 변화)을 반영하도록 재검증 항목으로 남지 않았다는 점이며, 이는
target 의 재구성이 그 참조를 깨뜨리기보다는 절 번호 오류를 우연히 상쇄하는 쪽이라 차단 사유는
아니다.

## 위험도

LOW
