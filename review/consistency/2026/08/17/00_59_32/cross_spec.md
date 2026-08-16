# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done)

## 검토 범위

target: `spec/5-system/{1-auth,3-error-handling,6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api,15-chat-channel,...}.md` + `spec/1-data-model.md` (egress 값-패턴 마스킹 확장 — `outputData` 컬럼 신규 편입, WS `execution.node.*`/비-종결 `execution.*` emit 값-마스킹 신설, `nodeName`→`nodeLabel` 표기 정정). 구현: `codebase/backend/src/modules/executions/executions.service.ts` · `.../background-runs/background-runs.service.ts` · `.../websocket/websocket.service.ts` · `.../shared/utils/{redact-stored-error,sanitize-error-message}.ts`.

`_prompts/cross_spec.md` 는 `spec/5-system/{15-chat-channel,2-api-convention,4-execution-engine,5-expression-language,1-auth,8-embedding-pipeline,9-rag-search,10-graph-rag,11-mcp-client,17-agent-memory,_product-overview,7-llm-client,16-system-status-api}.md` + git diff 원문이 예산 초과로 절단되어 있었다 — 아래 발견은 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-masking-followups-3cd512`)를 절대경로로 직접 열어 실측했다 (`git diff origin/main...HEAD`, 관련 코드/스펙 Read).

---

## 발견사항

- **[CRITICAL] WS `execution.node.*` emit 의 `input` 필드가, 같은 PR 이 REST 에서 명시적으로 비대상 처리한 `NodeExecution.inputData` 를 마스킹한다 — parity 원칙의 자기모순**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 신설 캐비엇("값-패턴 마스킹 (강제됨 — 결정 2026-08-16)" — "대상은 특정 필드가 아니라 payload 전체이며, 아래 열거는 대표 예시다: `error`(node.failed) · `output`/`**input**`(node.completed) · `message`(ai_message)")
  - 충돌 대상: 같은 PR 의 `spec/5-system/13-replay-rerun.md`(신설 캐비엇 "`inputData` 는 egress 마스킹 대상이 아니다") · `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ②"("`inputData` 는 마스킹하지 않는다 ... 재제출되는 값") · 구현 `codebase/backend/src/modules/executions/executions.service.ts` 의 `MASKED_INPUT_DATA_REASON`(및 `nodeExecutions[]` map 의 "노드 레벨에서도 `inputData` 는 비대상 — 상위와 같은 이유" 주석 + 대응 테스트 `executions.service.spec.ts` ⑤)
  - 상세: `execution-engine.service.ts` 의 `NODE_COMPLETED`/`NODE_FAILED` emit 은 둘 다 `input: nodeExecution.inputData` 를 payload 에 싣는다(예: line 6121, 6382). 이 값은 REST `GET /executions/:id` 의 `nodeExecutions[].inputData` 로 나가는 **바로 그 컬럼**이며, 이 PR 은 REST 경로에서 "재제출 시 `***` 가 실제 값이 되는 조용한 기능 오염"을 근거로 이 컬럼을 **의도적으로 마스킹 제외**했다(`executions.service.ts` `maskIfPresent`/`MASKED_INPUT_DATA_REASON`, 대칭 테스트로 고정). 그런데 같은 PR 이 신설한 `WebsocketService.maskWireEnvelope`(`emitNodeEvent`/`emitExecutionEvent` 공용 초크포인트)는 `WIRE_PRESERVED_FIELDS = new Set(['llmCalls'])` 하나만 예외로 두고 **payload 전체**를 `deepRedactSecretsPreserving` 로 마스킹한다 — `input` 필드에 필드-단위 예외가 없다. 실제로 `websocket.service.spec.ts` 신설 테스트 ①이 이를 직접 고정한다: `emitNodeEvent(..., { error: LEAKY_ERROR, input: LEAKY_INPUT })` 호출 후 `expect(JSON.stringify(fanout.payload.input)).not.toContain('user:pw')` — **`input` 이 마스킹됨을 스스로 단언**한다.
    같은 execution·같은 노드의 같은 DB 값(`NodeExecution.inputData`)이 **REST 로 읽으면 원문, WS 라이브 emit 으로 받으면 `***`** 로 갈린다. 이 PR 이 WS 값-마스킹을 도입한 근거는 명시적으로 "boundary masking parity — 수신 인구가 `GET /api/executions/:id` 와 동일"([WS §4.1] · [EIA §R17])인데, 정작 `inputData` 항목에서는 그 parity 가 역방향으로 깨진다. 에디터가 타임라인을 WS 라이브 이벤트로 먼저 그리고 이후 REST 재조회로 갱신/병합하면(흔한 패턴 — `execution.snapshot` 재구독 등) 같은 노드의 `input` 표시값이 새로고침 타이밍에 따라 달라지는 UI 비일관성이 생기고, 향후 어떤 소비자가 WS 라이브 `input` 을 재사용하는 기능을 만들면 REST 경로가 피하려 했던 바로 그 "`***` 가 실제 값이 되는" 오염이 재발한다.
  - 제안: `WIRE_PRESERVED_FIELDS`(또는 별도 마스킹 제외 목록)에 `input` 을 추가해 `NodeExecution.inputData` 를 실은 필드를 REST 와 동일하게 비대상 처리하거나, 반대로 "WS 라이브 `input` 은 마스킹하되 REST 는 안 한다"를 **의도된 비대칭**으로 결정한다면 그 근거(왜 이 필드만 boundary-parity 원칙의 예외인지)를 `6-websocket-protocol.md` §4.1 과 `14-external-interaction-api.md` §R17 양쪽에 명시해야 한다 — 현재는 어느 쪽도 이 비대칭을 언급하지 않는다.

- **[CRITICAL] `outputData` egress 마스킹(REST) 및 WS `output` 값-마스킹이 `NodeHandlerOutput.config` 의 "raw 그대로 echo" 계약(Principle 7)을 침해할 수 있다**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "적용 범위는 총칭이 아니라 열거다"(2026-08-16 갱신, `outputData` 를 `redactStoredDataForResponse` 대상에 신규 편입) · `spec/1-data-model.md` §"Execution.error ↔ NodeExecution.error 관계" 응답 마스킹 행 · `spec/5-system/6-websocket-protocol.md` §4.1 신설 캐비엇("대상은 ... payload 전체 ... `output`(node.completed)")
  - 충돌 대상: `spec/conventions/node-output.md` Principle 0/1.1/7("`NodeHandlerOutput.config` 는 워크플로우 작성자가 설정한 원본 값을 **그대로 echo**" · "`code.config.code` ... 그대로 echo(디버깅・후속 노드 참조 목적)" · "`ai_agent.config.systemPrompt` 가 수천 줄일 경우에도 **그대로 echo**(디버깅 목적)") — 이 문서는 이번 diff 로 수정되지 않았다
  - 상세: `NodeExecution.outputData` DB 컬럼은 핸들러가 반환하는 **canonical `{config, output, meta?, port?, status?}` 객체 전체**를 그대로 담는다 — `execution-engine.service.ts`: `const output = await this.executeWithRetry(...)`(핸들러의 raw return, 즉 `NodeHandlerOutput`) → `nodeExecution.outputData = output`(예: line 6103, 6148, 6360) → 같은 값이 `NODE_COMPLETED`/`NODE_FAILED` WS emit 의 `output` 필드로도 나간다(line 6120, 6381; 별개 주석 "NodeExecution.outputData 는 canonical `{config, output, ...}` 형태로 저장" — `seedSingleNodePredecessorOutputs` 부근에서도 재확인됨). Code 노드는 `config.code`에 사용자가 작성한 **원문 소스 코드**를 그대로 echo 한다(`code.handler.ts` `config: { code: rawConfigForEcho.code, ... }`).
    이 PR 이 새로 건 `redactStoredDataForResponse`/`deepRedactSecrets`(REST)와 `maskWireEnvelope`/`deepRedactSecretsPreserving`(WS)는 **키 이름이 아니라 값의 정규식 패턴**으로 마스킹한다 — `SECRET_LEAK_PATTERNS` 에는 `/\bAuthorization:[^\r\n]*/gi`(리터럴 `Authorization:` 이후 줄 끝까지 전부 치환)가 포함된다. Code 노드 작성자가 외부 API 를 호출하는 아주 흔한 패턴, 예:
    ```js
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    ```
    은 unquoted 객체 키 `Authorization:` 를 문자 그대로 포함하므로, 위 정규식이 `Authorization:` 부터 그 줄 끝까지를 `***` 로 치환한다. 이 코드 본문은 `outputData.config.code` 로 저장·echo 되며, 이번 PR 이후 REST 응답(`GET /executions/:id` 의 `outputData`/`nodeExecutions[].outputData`)과 WS `execution.node.completed`(`output` 필드, `.config` 를 포함한 전체 객체)에서 **부분적으로 뭉개진 채로** 노출된다 — `node-output.md` Principle 7 이 "디버깅・후속 노드 참조 목적"으로 보장하는 "그대로(raw, byte-identical) echo" 계약을 어긴다. 같은 위험이 `ai_agent.config.systemPrompt`/`config.userPrompt`(사용자가 예시로 인증 헤더 형식을 프롬프트에 적어 넣는 경우) 에도 적용된다.
    (참고: 내부 엔진의 `$node["X"].config.*` 표현식 평가는 DB/컨텍스트 캐시의 원문을 그대로 쓰므로 워크플로우 **실행 자체의 정확성**은 영향받지 않는다 — 이 마스킹은 egress-only 다. 문제는 API/WS 로 노출되는 **표시값**이 Principle 7 이 명시한 "디버깅용 raw echo" 보장과 어긋난다는 점이다.)
  - 이번 라운드까지의 code-review(`review/code/2026/08/16/23_50_03`, `review/code/2026/08/17/00_47_01` 등)와 이전 cross_spec 라운드(`review/consistency/2026/08/16/23_49_05`, `2026/08/17/00_22_23`, `00_47_04`, `22_22_36`) 어디에도 `config.code`/`rawConfig`/Principle 7 언급이 없다 — 이번에 처음 지목된 갭이다.
  - 제안: (a) `redactStoredDataForResponse`/`maskWireEnvelope` 가 `outputData.config`(및 WS `output.config`) 하위 트리를 순회하지 않도록 `preserveKeys`(이미 존재하는 `WIRE_PRESERVED_FIELDS`/`deepRedactSecretsPreserving` 메커니즘)를 `config` 로 확장하거나, (b) Principle 7 의 "절대 echo 금지" 목록(자격증명・URL 내장 credential)에 "값-패턴 마스킹의 대상이 될 수 있는 문자열"을 흡수하도록 `node-output.md` 를 함께 갱신해 어느 쪽이 우선인지 명시한다. 현재 target 은 이 트레이드오프를 인지하거나 언급하지 않는다.

- **[WARNING] `spec/1-data-model.md` 의 Execution/NodeExecution 엔티티 필드 표(§2.13 `output_data`, §2.14 `output_data`)가 신규 egress 마스킹을 언급하지 않는다**
  - target 위치: `spec/1-data-model.md` line 472(Execution.output_data) · line 551(NodeExecution.output_data)
  - 충돌 대상: 같은 파일의 "Execution.error ↔ NodeExecution.error 관계" 절(line 564, 이번 diff 로 갱신) — 이 절만 "`outputData` 도 SoT(EIA §R17)에 따라 마스킹 대상"임을 설명하고, 정작 `output_data` 필드 자체의 정의 행에는 그 사실이 없다
  - 상세: `error` 필드는 전용 관계 절이 있어 마스킹 정책이 명확히 문서화되지만, `output_data` 는 필드 정의 한 줄("실행 최종 출력 데이터"/"노드 출력 데이터")뿐이라 그 절을 따라가지 않는 독자는 `output_data` 가 여전히 원문이라고 오해할 수 있다. `DTO`(`ExecutionDto.outputData`/`NodeExecutionSummaryDto.outputData`) 주석은 이번 PR 로 갱신됐지만 데이터 모델 SoT 문서의 1차 정의 행은 그대로다.
  - 제안: §2.13/§2.14 의 `output_data` 행에 "응답 마스킹은 [EIA §R17] 참조" 각주를 추가하거나, "Execution.error ↔ NodeExecution.error 관계" 절 제목/범위를 `outputData` 까지 포괄하도록 넓힌다.

---

## 요약

이번 라운드는 신규 egress 값-패턴 마스킹 표면(`outputData` REST 편입 + WS `execution.node.*`/비-종결 `execution.*` emit 마스킹)을 다루는데, 그 구현이 필드-단위가 아니라 "payload 전체"를 정규식으로 훑는 방식이라 두 개의 구체적·검증된 충돌을 만든다 — (1) 같은 PR 이 REST 에서 명시적으로 비대상 처리한 `NodeExecution.inputData` 를 WS 라이브 emit 에서는 마스킹해 같은 데이터가 표면마다 다르게 보이고(자기 PR 의 parity 원칙과 정면 모순, 자체 테스트로 확인됨), (2) 전혀 별개 영역인 `conventions/node-output.md` Principle 7 이 보장하는 `NodeHandlerOutput.config`(Code 노드 소스 코드・AI Agent 프롬프트 등) raw echo 계약이 흔한 실사용 패턴(`Authorization:` 헤더 구성 코드)에서 부분적으로 뭉개질 수 있다. 두 항목 모두 실제 코드 경로(라인 번호 포함)와 target 이 스스로 작성한 테스트로 뒷받침되며, 이전 code-review/consistency 라운드에서는 지목되지 않았다. 그 외 `nodeName`→`nodeLabel` 정정, `inputData` 비대상 논지, ingestion-vs-egress 계층 분리 설명 등은 코드·다른 spec 영역과 정합했다.

## 위험도

CRITICAL
