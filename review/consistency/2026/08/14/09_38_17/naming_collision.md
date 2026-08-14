STATUS=success naming_collision review complete — 1 CRITICAL, 2 WARNING

===REPORT_MARKDOWN_BELOW===

# 신규 식별자 충돌 검토 — `spec-draft-eia-62-waiting-payload.md`

## 발견사항

### [CRITICAL] `turnDebug` — 같은 이벤트 payload 안에서 두 자리가 서로 다른 shape 으로 공존한다

- **target 신규 식별자**: 최상위(top-level) `turnDebug: { llmCalls, metadata }` — target 은
  "AI turn1 은 추가로 `turnDebug: { llmCalls, metadata }`" 로 실측 필드를 §6.2 예시에
  그대로 옮겨 적자고 제안한다 (`plan/in-progress/spec-draft-eia-62-waiting-payload.md`
  "표면별" 항목, 소스: `ai-turn-orchestrator.service.ts:615-623`).
- **기존 사용처**:
  - `spec/5-system/6-websocket-protocol.md:449` — `nodeOutput.meta.turnDebug` 를 명시적으로
    **정의·소유**한다: "`interactionType ∈ {ai_conversation, ai_form_render}` 시 존재 …
    항목 shape: `{ turnIndex, ragSources[], ragDiagnostics?, llmCalls?, toolCalls?,
    totalDurationMs? }`" — **배열**이고, `metadata` 키가 아니라 `turnIndex`/`totalDurationMs`
    를 갖는다. 같은 문서 `:394` 의 blockquote 는 "WS 내부 부가 식별자
    (`waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`/`startedAt`)는 본 §4.4 가
    소유한다" 고 명시적으로 오너십을 선언한다 — `turnDebug` 는 이 목록엔 없지만
    `nodeOutput.meta.turnDebug` 자체가 이미 이 문서(WS §4.4)와
    `spec/4-nodes/3-ai/1-ai-agent.md` §7~§8 이 공유하는 정본 필드다.
  - `codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts:82-98`
    (`buildConversationMetaFromResumeState`) — `turnDebug: state.turnDebugHistory ?? []`
    을 반환하고, 이 반환값이 `ai-turn-orchestrator.service.ts:612` 에서
    `nodeOutput.meta = buildConversationMetaFromResumeState(resumeState)` 로 그대로
    들어간다. 즉 **같은 emit 호출 하나 안에** `nodeOutput.meta.turnDebug`(배열) 와
    top-level `turnDebug`(단일 객체, `:615-623`) 가 **동시에** 존재한다.
- **상세**: target 문서의 "표면별" 서술 자체가 이 사실을 그대로 옮기고 있다 —
  "AI → `nodeOutput: { interactionType, config?, conversationConfig, meta }`, turn1 은
  추가로 `turnDebug: { llmCalls, metadata }`" 라고 적어, `nodeOutput`(그 안에 이미
  `meta.turnDebug[]` 를 포함) 과 별개로 top-level `turnDebug` 를 나열한다. 이건 정확한
  실측이지만, **동일 이름 `turnDebug` 가 §6.2 예시 안에서 두 자리·두 shape 으로 동시에
  등장**하게 된다는 사실을 target 문서 어디에서도 지적·주석하지 않는다. §6.2 를 이 상태로
  재작성하면, WS §4.4 표(정본)를 이미 읽은 독자·외부 통합자가 "`nodeOutput.meta.turnDebug`"
  와 새로 등장한 top-level "`turnDebug`" 를 같은 것으로 오인하기 쉽다 — 배열 vs 단일 객체,
  `totalDurationMs` vs `metadata.{model,inputTokens,outputTokens}` 로 파서가 다르게
  분기해야 하는데 이름만으로는 구분되지 않는다.
- **제안**: §6.2 재작성 시 (a) top-level `turnDebug` 를 다른 이름(예: `turnDebugSnapshot`
  또는 `initialTurnDebug`)으로 바꾸거나, (b) 최소한 인접 주석으로
  "`nodeOutput.meta.turnDebug`(WS §4.4 소유, 배열, 누적)와 다른 필드 — 본 필드는 turn1
  전용 단발 스냅샷" 이라 명시해 두 정본(EIA §6.2·WS §4.4)이 같은 이름을 다른 뜻으로 쓰고
  있음을 봉인한다. planner 턴으로 넘길 때 이 항목을 (1)의 "실측 shape 교체" 작업 범위에
  명시적으로 포함시킬 것.

### [WARNING] `interaction` 블록의 endpoint 키 네이밍 — §4.1 과 §6.2 가 같은 개념을 다른 스키마로 적는다

- **target 신규 식별자**: target 제안 (2) — `interaction` 블록을 "삭제하지 않고 Planned 로
  표기" 하며 URL 을 "`§4.1 endpoints` 와 같은 **상대경로**로 적는다" (target 본문).
- **기존 사용처**: `spec/5-system/14-external-interaction-api.md:250-261` (§4.1) 은
  **이미** 같은 개념(execution 상호작용용 token + endpoint 목록)을 다음 shape 으로
  정의하고 있다:
  ```jsonc
  "interaction": {
    "token": "...", "expiresAt": "ISO8601",
    "endpoints": { "stream": "...", "submit": "...", "status": "...", "cancel": "...", "refresh": "..." }
  }
  ```
  반면 현재 §6.2(`:658-668`)의 `interaction` 블록은 `submitUrl`/`streamUrl`/`statusUrl`/
  `cancelUrl` 처럼 **평평한 `*Url` 접미사 키**를 쓰고, `refresh`(§5.5 토큰 갱신) 대응
  필드가 아예 없다.
- **상세**: target 이 "§4.1 endpoints 와 같은 상대경로로" 라고만 적어, (i) URL 값만
  상대경로로 바꾸고 기존 `submitUrl`/`streamUrl`/… 키 이름은 유지하는 것인지, (ii) §4.1
  의 `endpoints: { submit, stream, status, cancel, refresh }` 중첩 구조 자체를 재사용하는
  것인지 명확히 하지 않는다. (i) 로 읽으면 같은 문서 안에 "interaction 상호작용
  endpoint" 를 가리키는 두 가지 서로 다른 키 컨벤션(`interaction.submitUrl` vs
  `interaction.endpoints.submit`)이 계속 공존하게 되고, `refresh` 누락도 그대로 남는다.
- **제안**: planner 턴에서 이 항목을 처리할 때 §4.1 의 `endpoints.{stream,submit,status,
  cancel,refresh}` 네이밍을 그대로 재사용할지, 기존 `*Url` 평면 키를 유지한 채 값만
  상대경로로 바꿀지 **명시적으로 결정**하고 그 결정을 §6.2 옆에 한 줄로 남길 것. 후자를
  택하더라도 `refresh` 엔드포인트 누락 여부는 별도로 확인할 것(Planned 로 표기하더라도
  4개가 아니라 5개 세트인지 결정 필요).

### [WARNING] `1-data-model.md §2.14` 인용 — 실제 그 번호는 `NodeExecution`, 대상 서술은 `Execution.error`

- **target 신규 식별자/참조**: target 변경 제안 (5) — "`1-data-model.md` §2.14 —
  `Execution.error` 구조에 nullable `nodeId`".
- **기존 사용처**: `spec/1-data-model.md:539` — §2.14 의 실제 제목은 **`NodeExecution`**
  이다. `Execution` 엔티티는 §2.13(`:458`)이고, target 이 고치려는 `{nodeId, code,
  message}` 구조 테이블은 §2.14 헤딩 아래 별도 소제목 없이 끼워진 "**Execution.error ↔
  NodeExecution.error 관계**" 표(`:556-563`, 특히 `:562` 행)다.
- **상세**: 물리적 위치(§2.14 헤딩 아래)는 target 의 인용과 맞지만, §2.14 라는 번호
  자체는 spec 안에서 이미 `NodeExecution` 엔티티에 배정된 식별자라 "§2.14 —
  `Execution.error` 구조" 라는 target 의 표현은 **번호와 서술 대상이 어긋난다.** planner
  가 이 지시만 보고 §2.14 헤딩 바로 아래(NodeExecution 필드 표, `:541-554`)의 `error`
  행(`{ code, message, stack? }`, `:552`)을 고치는 실수를 유발할 수 있다 — 그건
  `NodeExecution.error` 이지 target 이 의도한 `Execution.error` 관계 표가 아니다.
- **제안**: planner 인계 시 "§2.14 안의 **`Execution.error ↔ NodeExecution.error 관계`**
  표(`:556-563`)" 처럼 표 제목까지 명시해 절 번호만으로 오독되지 않게 할 것.

## 요약

target 문서(`spec-draft-eia-62-waiting-payload.md`)가 §6.2 예시에 그대로 옮겨 적으려는
실측 필드 대부분(`waitingNodeId`·`waitingNodeType`·`waitingNodeLabel`·`nodeExecutionId`·
`startedAt`·`buttonConfig`·`nodeOutput`)은 이미 `6-websocket-protocol.md` §4.4 가
소유·정의한 것과 값·의미가 일치해 충돌이 없다. 다만 **`turnDebug` 만은 실제로 같은
emit 안에서 두 자리(‑`nodeOutput.meta.turnDebug` 배열 vs top-level `turnDebug` 단일
객체)에 다른 shape 으로 등장**하는데, target 은 이 사실을 있는 그대로 옮기면서도 이름
충돌 자체는 지적·주석하지 않아 그대로 spec 화하면 정본 문서(WS §4.4) 독자에게 혼선을
줄 수 있다(CRITICAL). 그 외 `interaction` 블록의 endpoint 키 컨벤션이 §4.1 과 §6.2 사이에서
이미 어긋나 있고 target 의 수정 지시가 이를 완전히 해소하지 않는 점, `1-data-model.md`
§2.14 인용이 그 절의 실제 제목(`NodeExecution`)과 서술 대상(`Execution.error`)이
어긋나는 점은 WARNING 으로 남긴다. 요구사항 ID·API endpoint·이벤트명·환경변수·파일
경로 축에서는 그 외 새로운 충돌을 찾지 못했다.

## 위험도

HIGH
