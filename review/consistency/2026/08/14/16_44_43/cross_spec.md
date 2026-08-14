# Cross-Spec 일관성 검토 — `spec/5-system/`(diff: `1-data-model.md` / `6-websocket-protocol.md` / `14-external-interaction-api.md`)

## 발견사항

- **[CRITICAL]** `waitingNodeType` 필드의 오너십(SoT)이 WS 문서와 EIA 문서에서 정반대로 선언됨
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.2 (commit `4b13ca5ae`, 본 PR 신규 추가) — 필드명 매핑 blockquote:
    ```
    > 위젯/SDK 는 어느 채널에서든 아래 오른쪽을 읽는다:
    > - `node.id` → **`waitingNodeId`** (평면; ...)
    > - `node.type` → **`waitingNodeType`** (평면)
    > - `node.interactionType` → **`interactionType`** (평면)
    ...
    > `waitingNodeLabel` · `nodeExecutionId` · `startedAt` 도 평면으로 실리지만 **WS 내부 부가
    > 식별자**라 [WS §4.4] 가 소유한다 — 본 절은 외부 클라이언트 소비 필드만 다룬다.
    ```
    (§6.2, L697-719 부근)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.4 본문(L395, 본 PR 미변경) + Rationale "§4.4 wire 필드 caveat"(L973-983, 본 PR 미변경):
    ```
    ...외부 클라이언트가 소비하는 필드 매핑의 SoT 는 [EIA §6.2 blockquote]이며,
    WS 내부 부가 식별자(`waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`/`startedAt`)는
    본 §4.4 가 소유한다.
    ```
    그리고 Rationale (2026-08-13 갱신 각주): "그쪽에는 WS 전용 부가 필드(`waitingNodeType` 류)가
    **없어서** 나눌 것이 없었다."
  - 상세: 두 문서는 원래 "오너십 분리"로 3중 복제·drift 를 피하기로 명시적으로 합의했다 — WS §4.4
    가 `waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`/`startedAt` **4개 전부**를 WS-owned
    internal identifier 로, EIA §6.2 는 외부 소비 필드만 다루는 것으로 스코프를 나눴다(WS
    Rationale 3곳이 이 4개 세트를 명시). 그런데 본 PR(commit `4b13ca5ae`)이 EIA §6.2 에
    `node.type → waitingNodeType` 행을 **신규 추가**하면서 "위젯/SDK 가 읽는다"고 선언하고,
    바로 다음 문단에서 "WS 소유 내부 식별자"를 `waitingNodeLabel`/`nodeExecutionId`/`startedAt`
    **3개로 축소**해 `waitingNodeType` 을 암묵적으로 EIA 쪽으로 재배정했다. 이 재배정이 WS 문서에
    반영되지 않아, WS §4.4 본문·Rationale(둘 다 본 PR 에서 손대지 않음)은 여전히 `waitingNodeType`
    을 "WS 내부 전용이라 EIA 밖" 이라고 3곳에서 반복 선언 중이다 — 두 문서가 동일 필드의
    귀속(누가 SoT 인가)을 정반대로 말하는 상태.
    또한 양쪽이 공통으로 "참조 구현(SoT)"로 인용하는
    `codebase/channel-web-chat/src/lib/eia-events.ts` `parseWaitingForInput` 은 실제로
    `waitingNodeType` 을 전혀 읽지 않는다(`interactionType` 만 사용, `ev.waitingNodeType` 참조
    없음 — `eia-types.ts` 타입 선언에만 존재). 즉 EIA §6.2 의 "위젯/SDK 는 ... 읽는다" 라는
    새 주장은 같은 절이 인용하는 참조 구현으로 반증된다. (`waitingNodeType` 을 실제로 읽는 코드는
    내부 에디터 WS 채널의 `use-execution-events.ts` 뿐이며, 이는 WS §4.4 의 관할 범위와 일치한다
    — 오히려 원래의 "4개 전부 WS 소유" 쪽이 코드 실태와 맞는다.)
  - 제안: 다음 중 하나로 정합화.
    (a) WS §4.4 본문 + Rationale 2곳에서 `waitingNodeType` 을 WS-owned 목록에서 빼고
        EIA §6.2 를 SoT 로 넘긴다 — 단 이 경우 `parseWaitingForInput`/`eia-types.ts` 가
        실제로 이 필드를 소비하도록 위젯 코드도 함께 갱신하거나, "현재 미소비 이지만 wire 계약상
        보장" 이라고 명시해야 한다.
    (b) (더 낮은 비용) EIA §6.2 의 신규 `node.type → waitingNodeType` 행과 "위젯/SDK 가 읽는다"
        서술을 철회하고, `waitingNodeLabel`/`nodeExecutionId`/`startedAt` 과 함께 원래의
        4개 WS-owned 제외 목록으로 되돌린다 — 참조 구현 실태와 일치하며 원래의 "오너십 분리"
        설계 의도(3중 복제 회피)도 보존된다.

## 요약

본 PR 의 `spec/5-system/` diff 는 대부분 코드 실태를 정확히 따라잡는 방향(Socket.IO 정합, `llmCalls`
strip 범위 확장 — WS fanout + EIA REST `getStatus` 양쪽·깊이 무관, `error.code`/`nodeId` nullable
정정, §6.2 봉투 래퍼 정합)이며, 교차 검증한 코드(`strip-external-only-fields.ts`,
`websocket.service.ts`, `interaction.service.ts`, `MAX_SANITIZE_DEPTH`/`MAX_REDACT_DEPTH` 경계
연산자)와 인접 spec(`3-error-handling.md`, `4-execution-engine.md`, `15-chat-channel.md`
CCH-ERR-04, `conventions/node-output.md` §3.2, `2-api-convention.md` §5.4)이 모두 정합했다.
다만 EIA §6.2 에 이번에 새로 추가된 `waitingNodeType` 필드명 매핑 행이, 바로 옆 문단이 재확인하는
"WS §4.4 소유" 원칙 및 WS 문서 자체의 3곳 반복 선언과 정반대로 그 필드를 외부-소비 SoT 쪽으로
재배정해 버려, "오너십 분리로 drift 회피" 설계가 이번 수정에서 스스로 깨졌다 — 두 문서를 함께
참조하는 독자(특히 SDK 구현자)에게 상충하는 지침을 준다.

## 위험도
CRITICAL
