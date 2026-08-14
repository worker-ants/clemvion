### 발견사항

- **[WARNING]** 방금 착지한 spec 커밋(`4b13ca5ae`)이 만족시킨 조건들이 3개 plan 문서에서 갱신되지 않음
  - target 위치: `spec/5-system/14-external-interaction-api.md` · `spec/5-system/6-websocket-protocol.md` ·
    `spec/1-data-model.md` (commit `4b13ca5ae`, `--spec` `15_20_28` BLOCK: NO 확보 후 반영)
  - 관련 plan:
    1. `plan/in-progress/eia-terminal-payload.md` `## 체크리스트` — `[ ] **planner 턴** — §6.2 봉투 +
       data-model §2.14 + §6.2 URL + error.code 옵셔널`
    2. `plan/in-progress/spec-draft-eia-62-waiting-payload.md` `## 체크리스트` — `[ ] /consistency-check
       --spec BLOCK: NO` 및 `[ ] spec 반영 — 7항목 (1)~(7)`
    3. `plan/in-progress/spec-draft-eia-notification-payload-contract.md` L228~237 "소급 정정
       (2026-08-14)" 각주 ②
  - 상세: `4b13ca5ae` 의 diff 를 직접 대조하면 (1)(2)(3)(4)(5)(7) 7항목 전부 spec 에 반영됐다 —
    §6.2 `payload:` 봉투 래퍼 추가, `interaction` 블록 Planned 표기, URL 상대경로화, blockquote
    화살표 재정의(+`status`/`waitingNodeType` 행), `error.code`  `null` 허용 + data-model
    §2.14 동기화, WS §4.4/§R17 strip 범위 확장. 커밋 메시지 자체가 "`--spec` `15_20_28`
    **BLOCK: NO** 확보 후 planner 턴으로 반영" 이라 명시한다 — 즉 BLOCK:NO 도 이미 확보됐다.
    그런데 위 3곳 모두 이 사실을 반영하지 않은 채 남아 있다:
    - (1) `eia-terminal-payload.md` 의 "planner 턴" 체크박스가 `[ ]` 인 채라, 다음 라운드가
      이 문서만 보면 "spec 이 아직 안 고쳐졌다" 로 오판해 `--impl-prep` 재실행을 또 미룰 수 있다
      (이 문서의 "차단 해제 조건" 절이 정확히 이 커밋을 가리키는데도).
    - (2) `spec-draft-eia-62-waiting-payload.md` 자신의 체크리스트도 `[ ]` 그대로다 — 이
      plan 문서는 이미 "체크박스 drift 가 바로 다음 커밋에서 재발했다"(`11_02_18` 지적,
      `a9574f823`)를 자기 이력에 두 번 기록해 뒀는데, 같은 패턴이 스코프를 바꿔(성능 캐너리
      항목 → 이번엔 최상위 "spec 반영" 항목) 세 번째로 재발한 상태다.
    - (3) `spec-draft-eia-notification-payload-contract.md` 의 각주는 "② §6.2 예시에 `payload:`
      봉투 래퍼가 **여전히 빠져** 있어 … 이 항목이 닫히지 않은 잔여다" 라고 쓰여 있는데, 그
      래퍼는 `4b13ca5ae` 가 이미 추가했다 — 이 각주는 이제 **거짓 주장**이다.
  - 제안: 세 문서를 이번 커밋 반영 사실로 동기화한다 — (1)(2)는 해당 체크박스 `[x]` + 커밋
    해시 인용, (3)의 각주는 "해소(`4b13ca5ae`) — payload 래퍼 추가됨" 으로 갱신(단, 아래
    두 번째 발견사항 때문에 완전 해소로 단정하지 말 것).

- **[WARNING]** "인용 오귀속 (L472·673)" plan 항목이 두 곳 중 한 곳만 집행됨 — `L472` 잔존
  - target 위치: `spec/5-system/14-external-interaction-api.md:472` (§5.3 `GET
    /api/external/executions/:id` REST 응답의 `conversationThread` 주석)
  - 관련 plan: `plan/in-progress/eia-terminal-payload.md` "함께 넘기는 spec 항목" 표 —
    `인용 오귀속 (L472·673) | "Conversation Thread §4.4.6" 이 실제로는
    6-websocket-protocol.md 헤딩을 가리킨다 (INFO 3)` / 커밋 메시지 "(1)(2)(6) §6.2 … 
    'Conversation Thread §4.4.6' 오귀속을 WS 문서로 재지정"
  - 상세: `origin/main` 대비 diff 를 직접 확인했다. 이 문서엔 동일한 오서술
    `[Conversation Thread §4.4.6 / §5.1](../conventions/conversation-thread.md)` 이 원래
    두 곳(§5.3 REST 응답 L472, §6.2 SSE/webhook 예시 옛 L673)에 있었다. 커밋은 §6.2 쪽만
    `[WS §4.4.6](./6-websocket-protocol.md) / [Conversation Thread §5.1](../conventions/conversation-thread.md)`
    로 분리·정정했고(현재 L681), **§5.3 REST 쪽(L472)은 원문 그대로 방치**됐다 — 지금도
    `../conventions/conversation-thread.md` 하나의 링크에 "§4.4.6" 과 "§5.1" 을 함께
    걸고 있다. 직접 확인한바 `spec/conventions/conversation-thread.md` 에는 `§4.4`/`§4.4.6`
    헤딩이 **존재하지 않는다**(최상위 헤딩은 §1~§8, §5.1 만 유효) — 즉 이 링크의 "§4.4.6"
    부분은 지금도 깨진 앵커를 가리킨다. 커밋 메시지는 "오귀속을 WS 문서로 재지정" 이라
    완료를 선언하지만 실제로는 원 지적 두 곳 중 한 곳만 닫혔다.
  - 제안: L472 도 L681 과 동일한 패턴(`[WS §4.4.6](./6-websocket-protocol.md#44-…) /
    [Conversation Thread §5.1](../conventions/conversation-thread.md)`)으로 분리 정정할 것.
    이후 `eia-terminal-payload.md` 표의 "INFO 3" 항목을 닫을 때 "L673 만 닫혔었다" 는
    사실을 커밋 메시지나 plan 각주에 남겨, 위 첫 번째 발견사항의 (3) 각주를 "완전 해소"로
    성급히 표기하지 않게 할 것.

- **[INFO]** 이전 라운드(`15_20_28`)가 지적한 두 항목이 이번 커밋에서도 그대로 남아 있음(추적 계속)
  - target 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` (4)·(5) 절
  - 관련 plan: 같은 문서 자신
  - 상세: (a) "R-CC-15 확인" 선결 조건이 여전히 (4) 절 산문에만 있고 독립 체크박스가 없다.
    (b) (5) 절 제목이 여전히 "nullable `nodeId`" 만 언급하고 `code` 를 언급하지 않는다.
    다만 실제 spec 반영은 두 항목 모두 정확히 됐다 — `1-data-model.md §2.14` 는 이미
    `code: "ERROR_CODE" | null` 을 담고 있고, `15-chat-channel.md` 의 `?? ''` fallback 이
    `null` 을 안전 흡수함은 이전 라운드가 직접 확인해 뒀다. 즉 **spec 정확성 문제는 아니고**
    plan 문서 자체의 추적 위생 문제만 이월된 상태다.
  - 제안: 이번 라운드에서 강제할 사안은 아니나, 위 두 WARNING 을 정리하는 같은 턴에 함께
    닫으면 저비용이다.

### 요약

이번 라운드가 검토한 target 은 `4b13ca5ae`(spec/5-system/14-external-interaction-api.md ·
6-websocket-protocol.md · spec/1-data-model.md) — `--spec` `15_20_28` BLOCK:NO 를 받은
`spec-draft-eia-62-waiting-payload.md` 의 7항목을 실제로 착지시킨 planner 커밋이다.
diff 를 직접 대조한 결과 7항목의 실질 내용(payload 봉투·interaction Planned 표기·URL
상대경로화·blockquote 재정의·error.code null 허용·data-model 동기화·strip SoT 확장)은
**정확히 반영**됐고, "미해결 결정과의 충돌"·"선행 plan 미해소" 급 문제는 없다. 다만 두 가지
"후속 항목 누락" 이 남았다 — ① 이 커밋이 만족시킨 조건(BLOCK:NO 확보·7항목 반영·§6.2 payload
래퍼 추가)을 최소 3개 plan 문서(`eia-terminal-payload.md`·`spec-draft-eia-62-waiting-payload.md`
자신·`spec-draft-eia-notification-payload-contract.md`)가 아직 반영하지 않아 다음 라운드가
"아직 안 고쳐졌다" 로 오판할 위험이 있고(이 plan 체인이 이미 여러 번 자인한 "체크박스 drift"
패턴의 재발), ② 커밋이 완료를 선언한 "인용 오귀속(L472·673)" 수정이 실제로는 두 곳 중 한
곳(L681, 옛 L673)만 닫혔고 §5.3 REST 응답의 L472 는 여전히 존재하지 않는 앵커
(`conversation-thread.md#4.4.6`)를 가리키는 채로 남아 있다 — 이건 plan 항목이 스스로
"완료" 로 자칭하는 순간 실제로는 절반만 실행된, 검증 가능한 잔여다.

### 위험도
MEDIUM
