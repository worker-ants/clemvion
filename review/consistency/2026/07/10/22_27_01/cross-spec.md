# Cross-Spec 일관성 검토 — spec-draft-pr874-deferred-docs

검토 대상: `plan/in-progress/spec-draft-pr874-deferred-docs.md` (spec-only 문서 보강 3건)

비교 대상 spec: `spec/7-channel-web-chat/1-widget-app.md`, `spec/conventions/conversation-thread.md`,
`spec/5-system/6-websocket-protocol.md` §4.4.5/§4.4.6, `spec/5-system/14-external-interaction-api.md`
§5.1/§5.3/§R17, `spec/5-system/4-execution-engine.md` §7.4/§7.5/§7.5.1, `spec/2-navigation/_product-overview.md`
EH-DETAIL-12, 그리고 근거 확인을 위해 `codebase/channel-web-chat/src/lib/conversation.ts` · `eia-types.ts` ·
`codebase/backend/src/modules/external-interaction/interaction.service.ts` · `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` ·
`codebase/backend/src/modules/execution-engine/form-interaction.service.ts` · `codebase/backend/src/modules/websocket/websocket.gateway.ts` 를 함께 확인.

---

### 발견사항

- **[WARNING]** (2) "6-way" 프레이밍이 위젯 자신의 "backend 5값" 스코핑과 카디널리티 서술이 어긋남
  - target 위치: draft `### (2)` 신규 blockquote — "…§9.1 의 source 별 **6-way** 시각 매핑과 §9.2 의 3중 구분 신호를
    따르지 않고, `presentation_user`·`ai_user`→**user** / **그 외**→**assistant** 의 2-way 말풍선으로…"
  - 충돌 대상: `spec/7-channel-web-chat/1-widget-app.md` §2 메시지 리스트 행 ("turn `source`([conversation-thread §1.1]
    **백엔드 5값**)를 말풍선 role 로 축약 렌더 — `presentation_user`·`ai_user`→**user**, `ai_assistant`·`ai_tool`·`system`→
    **assistant**"), `codebase/channel-web-chat/src/lib/conversation.ts` (`roleOf` 주석: "wire `source`(백엔드 5값)를
    user/assistant 로 축약"), `codebase/channel-web-chat/src/lib/eia-types.ts` (`TurnSource` union 이 `live | injected |
    presentation_user | ai_user | ai_assistant | ai_tool | system` 7개 리터럴로 정의 — **`system_error` 자체가
    타입에 없음**), `spec/conventions/conversation-thread.md` §1.1.1 ("`system_error` 는 backend thread enum 에
    누적되지 않는 **frontend store / history view 전용** source")
  - 상세: 실제 값 개수를 확인한 결과 — **backend `ConversationTurnSource` (§1.1) = 5값**
    (`presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system`), **frontend-합성 확장(§1.1.1, 에디터/콘솔
    live·history 전용) = 6값** (+ `system_error`). `system_error` 는 backend 가 `conversationThread.turns` 에
    push 하지 않고, **frontend 메인 앱의 WS `node.failed`/`node.completed` 이벤트 리스닝으로만 합성**된다
    (`use-execution-events.ts`). 위젯(`channel-web-chat`)은 이 이벤트 리스닝 자체를 구현하지 않았고
    (`eia-client.ts`/`widget-state.ts`에 `node.failed`/`system_error` 처리 없음), 위젯의 1차 데이터 소스인
    `waiting_for_input.conversationThread.turns`/`getStatus.context.conversationThread` 에도 `system_error`
    가 실릴 수 없다(§1.1.1). 즉 위젯이 실제로 수신 가능한 `source` 값 도메인은 **구조적으로 5값 뿐**이며, `system_error`
    는 위젯에 "도달은 하되 그 외로 뭉뚱그려지는" 6번째 값이 아니라 **애초에 위젯 wire 에 존재할 수 없는 값**이다.
    draft blockquote 의 "§9.1 의 6-way … 를 따르지 않고 … 그 외 → assistant" 표현은 §9.1 표 자체의 행 수(6행, 맞음)를
    정확히 인용하지만, 이를 위젯의 예외 범위 서술에 그대로 얹으면 "위젯이 6개 값을 수신하되 그중 다수를 assistant 로
    뭉뚱그린다"는 인상을 줘 위젯 자신의 명시적 "backend 5값" 스코핑(1-widget-app §2, 코드 주석 2곳)과 표현이 어긋난다.
    기능적으로는 `roleOf` 의 fallback(`USER_TURN_SOURCES` 미포함 시 전부 `assistant`)이 가상의 6번째 값이 와도
    안전하게 처리하므로 **런타임 결함은 아니나**, 본 blockquote 는 `conversation-thread.md` 라는 SoT 문서에
    영구히 남는 서술이라 향후 "위젯도 system_error 인라인 렌더를 지원해야 하는가"류의 오해를 유발할 수 있다.
  - 제안: draft (2) 의 blockquote 를 "§9.1 의 6-row 시각 매핑(backend 5값 + frontend 합성 `system_error`, §1.1.1)"
    처럼 6이 어디서 오는 카운트인지 괄호로 명시하거나, 위젯 스코프 문장은 1-widget-app.md §2 와 동일하게
    "`ai_assistant`·`ai_tool`·`system`(backend 5값 기준)→assistant" 로 구체 열거해 "그 외"의 암묵적 6번째 값
    포함 여부를 없앤다. 부가로 "`system_error` 는 backend enum 에 없어 위젯 wire 에 애초에 도달하지 않는다(§1.1.1)"
    한 구절을 추가하면 향후 위젯 에러 인라인 표시 요청 시 근거를 명확히 한다.

- **[WARNING]** (1) R7 신설 문장 중 "`end_conversation` 으로만 통일하면 비-AI 대기 표면에서 서버가 거부(409)" 주장이
  EIA/execution-engine spec 과 실제 구현 어디에서도 뒷받침되지 않음 — 근거 없는 신규 주장으로 판단
  - target 위치: draft `### (1)` R7 본문 2번째 단락 — "…`cancel` 로만 통일하면 AI 대화 정상 종료 시에도 후속 노드가
    유실되고, `end_conversation` 으로만 통일하면 비-AI 대기 표면에서 서버가 거부(409)해 종료가 실패한다."
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §5.1 (`end_conversation` 명령·`409 STATE_MISMATCH`
    행), §5.1 "적용 노드" 열, `spec/5-system/4-execution-engine.md` §7.5.1 (Publisher 측 사전 검증), 그리고
    `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`assertNodeId`/`assertWaiting`/
    `endAiConversation` 호출부), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`endAiConversation`, `dispatchResumeTurn`, `resumeTurnRegistry`), `codebase/backend/src/modules/execution-engine/form-interaction.service.ts`
    (`processFormResumeTurn`), `codebase/backend/src/modules/websocket/websocket.gateway.ts` (`execution.end_conversation` 핸들러)
  - 상세: EIA §5.1 은 `end_conversation` 의 "적용 노드" 를 "AI Agent / Information Extractor (multi turn)"로 문서화하지만,
    **실제 검증 코드는 이를 강제하지 않는다**. `interaction.service.ts` 의 `end_conversation` 분기는
    `assertNodeId(dto)`(=nodeId 가 존재하기만 하면 통과, 실제 대기 노드와 일치 여부는 미검사) + `assertWaiting(execution)`
    (=execution.status==='waiting_for_input' 인지 만 확인, 노드 타입 무관)만 거치고, `endAiConversation(ctx.executionId)`
    는 **nodeId 파라미터 자체를 받지 않는다**(WS gateway `execution.end_conversation` 핸들러도 동일 — `data.nodeId`
    를 `endAiConversation` 호출에 아예 전달하지 않음). `endAiConversation` 내부는 `resolveWaitingNodeExecutionId`
    로 "현재 waiting 중인 아무 노드"를 찾아 `ai_end_conversation` continuation 메시지를 publish 할 뿐, 그 노드가
    AI Agent/Information Extractor multi-turn 인지 검사하지 않는다. 재개 측 라우팅(`dispatchResumeTurn` /
    `resumeTurnRegistry`, `execution-engine.service.ts` L1840-1920)은 **continuation 메시지의 `type`(`ai_end_conversation`)
    이 아니라 현재 대기 중인 노드의 `node.type`/`blockingInteraction` 으로 핸들러를 선택**한다. 즉 Form 노드가
    대기 중일 때 `end_conversation` 을 보내면 — 클라이언트가 `assertNodeId`/`assertWaiting` 을 통과한 뒤 —
    `dispatchResumeTurn` 이 `blockingInteraction === 'form'` 으로 Form 핸들러(`processFormResumeTurn`)를 선택하고,
    `{type:'ai_end_conversation'}` payload 를 sentinel 불일치로 간주해 "sentinel 없는 폴백 payload... 비정상"
    경고 로그만 남긴 채 그 object 를 그대로 `formData` 로 취급 → 필드 화이트리스트 필터링을 거쳐 (대개 빈)
    `interactionData` 로 **Form 을 "제출된 것"처럼 조용히 재개**시킨다. **`409 STATE_MISMATCH` 로 거부되는 코드
    경로가 확인되지 않는다** — 오히려 침묵 오처리(silent misroute) 가능성이 코드 추적상 더 유력하다. 이는 EIA
    §5.1 STATE_MISMATCH 행의 예시("completed 상태에서 submit_message, 또는 다른 nodeId")에도 "이 시나리오"가
    명시돼 있지 않다는 점과 함께, R7 의 이 주장이 **기존 산문에서 승격된 것이 아니라 draft 가 새로 종합한 추정
    주장**임을 뒷받침한다 (draft 자체가 "신규 결정을 만들지 않고 산문의 근거를 승격"한다고 명시했으므로, 새 사실
    주장이 섞여 들어간 것은 draft 의 스코프 취지와도 어긋난다).
  - 제안: 이 문장은 **추정(미검증)** 으로 취급해야 한다. (a) 해당 문장을 삭제하거나 "정의되지 않은 동작(undefined
    behavior)이 될 수 있다"처럼 결과를 단정하지 않는 표현으로 완화하거나, (b) `end_conversation` 이 실제로 AI
    Agent/Information Extractor multi-turn 대기 노드에만 적용되도록 `interaction.service.ts`/`websocket.gateway.ts`
    측에 노드-타입 가드를 추가하는 **별도 developer 후속 작업**을 열고 그 가드가 반환할 코드(예: 새 `STATE_MISMATCH`
    적용 또는 새 코드)를 EIA §5.1 에 명시한 뒤 R7 이 그 확정된 사실을 인용하도록 순서를 바꾼다. 이번 spec-only PR
    범위에서는 최소 (a) 를 권고 — 이 한 문장을 걷어내도 R7 의 나머지 내용(§2 헤더 행·§3.1 표에서 이미 확립된 booting
    게이팅·graceful/cancel 분기 자체)은 그대로 유효하다.

- **[INFO]** (3) 변경 A/B 는 §8.4·EIA §5.3/§R17·websocket-protocol §4.4.5 와 문구 수준까지 정합
  - target 위치: draft `### (3)` 변경 A(frontmatter `code:`)·변경 B(§4 표 비고 소비처 요약 문장)
  - 충돌 대상: 없음 — 대조 결과 기록용
  - 상세: 변경 B 의 제안 문장("소비처는 (a) rehydration(내부 무손실 재개), (b) SSE `waiting_for_input` emit,
    (c) `GET /api/external/executions/:id`(`getStatus`) REST 읽기 전용 — 세 곳이며, (b)·(c) 공개 표면은
    `redactThreadForPublic` 로 egress 마스킹된다")은 §8.4 "소비처 갱신 (2026-07-09)" 문단의 마지막 문장("소비처는
    (a) rehydration(내부), (b) SSE waiting emit, (c) getStatus REST(읽기 전용) 로 확장됐다")·바로 앞 문장의
    "SSE emit 과 REST `getStatus` 가 공유하는 단일 helper `redactThreadForPublic` 가 egress 시 … 마스킹한다
    (공개 표면 한정, 내부 rehydration/LLM 주입은 faithful 유지)" 와 표현·범위가 정확히 일치한다 — (a) rehydration
    은 마스킹 대상에서 올바르게 제외됐다. EIA §5.3 (`context.conversationThread` 가 durable 스냅샷을 SSE
    와 동일 wire 형식으로 동봉한다는 서술)·§R17 과도 모순 없음. websocket-protocol §4.4.5 (`conversationThread`
    가 `waiting_for_input` payload 에 선택적으로 동봉된다는 서술)와도 정합. 변경 A(frontmatter 에
    `interaction.service.ts` 추가)는 §8.4 가 이미 `getStatus()` 구현체로 이 파일을 인용하고 있어(EIA §5.3 각주도
    동일 파일 링크) 누락 교정으로 타당하다.
  - 제안: 없음 (그대로 반영 가능).

- **[INFO]** (1) R7 의 나머지 내용(booting 게이팅, graceful/cancel 분기 자체, optimistic 종료, 무기한 보존 불변식
  인용)은 §2 헤더 행·§3 상태기계 bullet·§3.1 표·execution-engine §7.4/§7.5 와 이미 정합
  - target 위치: draft `### (1)` R7 본문 1번째·3번째 단락
  - 충돌 대상: 없음 — 대조 결과 기록용
  - 상세: booting 게이팅 근거(미발사 cancel + 중복 webhook)는 1-widget-app.md §2 헤더 행·§3 "헤더 세션 컨트롤(§3.1)"
    bullet 문장과 표현까지 거의 동일하다. optimistic 종료(선 SSE 차단 → `[ended]` 전이 → best-effort 명령, 410
    Gone·409 STATE_MISMATCH·네트워크 실패에도 로컬 유지)와 "execution 무기한 보존 불변식([4-execution-engine
    §7.4·§7.5])" 인용은 §3.1 "대화 종료"/"새 대화" 행과 정확히 대응한다. 410 Gone(`EXECUTION_TERMINATED`)·409
    STATE_MISMATCH 코드 자체는 EIA §5.1 에 실재하는 코드이므로(트리거 조건의 정밀도는 위 WARNING 참고), 이 부분의
    인용은 문제 없다.
  - 제안: 없음 — 위 WARNING 항목(신규 409 근거 문장)만 정리하면 R7 전체가 안전하게 반영 가능.

### 요약

draft 3건 중 (3)은 §8.4/EIA §5.3·R17/websocket-protocol §4.4.5 와 문구 수준까지 완전히 정합해 그대로 반영 가능하다.
(1) R7 은 기존에 §2·§3·§3.1 산문에 흩어져 있던 결정(booting 게이팅, graceful/cancel 분기, optimistic 종료, 무기한
보존 불변식)을 정확히 승격했으나, "`end_conversation` 통일 시 서버가 409 로 거부한다"는 신규 종합 문장 하나는 EIA
§5.1·execution-engine §7.5.1 의 명시 서술 어디에도 없고, `interaction.service.ts`/`execution-engine.service.ts`/
`websocket.gateway.ts` 코드 추적 결과 실제로는 노드-타입 무관 generic waiting 체크만 있어 이 시나리오에서 클린한
409 보다는 침묵 오처리(빈 데이터로 Form 재개 등) 가능성이 더 커 보인다 — draft 자체가 표방한 "신규 결정 없음" 원칙에
어긋나는 새 사실 주장이므로 삭제 또는 완화를 권고한다. (2) 는 §9.1 이 6-row 인 것 자체는 정확하나, 그 "6-way"
프레이밍을 위젯 예외 서술에 그대로 얹으면 위젯 자신의 명시적 "backend 5값" 스코핑(1-widget-app §2·코드 주석·
`TurnSource` 타입 정의 — `system_error` 부재)과 카디널리티 표현이 어긋난다(기능적 결함은 아니나 SoT 문서에
영구 서술로 남는 정밀도 문제). 두 WARNING 모두 target 문구를 국소적으로 정정하면 나머지 구조(스코프 경계·§9.3~9.5
준수·frontmatter/§4 표 갱신)는 그대로 채택 가능한 수준이다.

### 위험도

MEDIUM

STATUS: DONE
