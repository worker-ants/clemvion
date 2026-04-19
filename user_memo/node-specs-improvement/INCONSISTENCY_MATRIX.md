# 현 상태 불일치 매트릭스

조사 시점 기준 (2026-04-19) `user_memo/node-specs/` 문서의 output/meta/port/status 불일치를 축별로 정리한 표입니다. 각 축에 대응하는 CONVENTIONS.md의 Principle 번호를 함께 표기합니다.

## 축 1 — 응답 데이터 네이밍 (Principle 8)

| 노드 | 현재 경로 | 개선 후 |
| --- | --- | --- |
| `ai_agent` (single) | `output.response` | `output.result.response` |
| `ai_agent` (conditional) | `output.data.response` (+ `output.port`) | `output.result.response`, `port: condId` |
| `text_classifier` (single) | `output.category`, `output.confidence?` | `output.result.category`, `output.result.confidence?` |
| `text_classifier` (multi) | `output.categories` | `output.result.categories` |
| `information_extractor` | `output.output.extracted` | `output.result.extracted` |
| `http_request` | `output.response` | `output.response` (유지) |

## 축 2 — 실행 메트릭 위치 (Principle 2)

| 노드 | 현재 | 개선 후 |
| --- | --- | --- |
| `ai_agent` | `output.metadata.{inputTokens, outputTokens, totalTokens, thinkingTokens, toolCalls}` | `meta.{inputTokens, ...}` |
| `information_extractor` | `meta.{inputTokens, outputTokens, totalTokens, thinkingTokens}` | 그대로 유지 |
| `text_classifier` | `meta.{model, inputTokens, ...}` | 그대로 유지 |
| `http_request` | `meta.{statusCode, duration}` | `meta.{statusCode, durationMs}` — `duration` → `durationMs` 로 명명 통일 |
| `database_query` | `meta.{durationMs}` | `meta.{durationMs, rowCount}` (rowCount도 meta로 이동 검토) |
| `code` | `meta.{success, error, errorCode, stack, logs}` | 그대로 유지 + `meta.durationMs` 추가 |

## 축 3 — 에러 표현 (Principle 3)

| 노드 | 현재 실패 처리 | 개선 후 |
| --- | --- | --- |
| `code` | `meta.success:false, meta.error`, 정상 포트 | error 포트 신설, `output.error`로 이동 |
| `database_query` | port:'error', `output.error:{code,message}` | 유지 (이미 규약 준수) |
| `http_request` | port:'error', `output.response:{error:string}` | `output.error:{code,message,details}` 로 통일 |
| `send_email` | throw on fail (에러 포트 없음) | error 포트 신설, `output.error` |
| `ai_agent` | throw on LLM fail | error 포트 신설, `output.error` |
| `information_extractor` | `port:'error'`, output은 case별로 다름 | `output.error` 로 통일 |
| `text_classifier` | `port:'error'`, `output.error` | 유지 |
| `transform` | throw on config 오류 | 유지 (Pre-flight) |

## 축 4 — 블로킹 재개 (Principle 4, 1.1)

> **중요**: 초안의 `output.view` 래퍼는 **폐기**. Principle 1.1에 따라 `output` 에는 **런타임 계산 값만** 담고 config 리터럴은 echo 하지 않습니다.

| 노드 | 현재 waiting | 현재 resumed | 개선 후 waiting | 개선 후 resumed |
| --- | --- | --- | --- | --- |
| `form` | `status:'waiting_for_input'`, `output:null` | `status:'submitted'`, `output:{submittedData}` | `status:'waiting_for_input'`, `output:{}` | `status:'resumed'`, `output:{interaction:{type:'form_submitted',data,receivedAt}}` |
| `carousel` (static) | `status:'waiting_for_input'`, `output:{type:'carousel',items,layout,rendered}` | `status:'button_click'`, `output:{interaction,previousOutput,selectedItem?}` | `status:'waiting_for_input'`, `output:{}` | `status:'resumed'`, `output:{interaction:{type,data:{buttonId,buttonLabel,selectedItem?,clickedAt?},receivedAt}}` |
| `carousel` (dynamic) | `output:{type,items,layout,rendered}` | 동상 | `output:{items}` (런타임 resolve) | `output:{items, interaction}` |
| `table` (static) | `output:{type,columns,rows,totalRows,rendered}` | `output:{interaction,previousOutput}` | `output:{rows}` | `output:{rows, interaction}` |
| `table` (dynamic) | 동상 | 동상 | `output:{rows,totalRows}` | `output:{rows,totalRows,interaction}` |
| `chart` | `output:{type,chartType,data,title?}` | `output:{interaction,previousOutput}` | `output:{data}` | `output:{data,interaction}` |
| `template` | `output:{type,format,content}` | `output:{interaction,previousOutput}` | `output:{rendered}` | `output:{rendered,interaction}` |
| `ai_agent` (multi) | `status:'waiting_for_input'`, `output:{conversationConfig, _multiTurnState}` | `status:'ended'` 또는 조건 port, `output.data.response` | `status:'waiting_for_input'`, `output:{messages}`, `_resumeState` | `status:'resumed'` (턴 진행 중): `output:{messages,interaction:{type:'message_received',data,receivedAt}}`, `_resumeState` / `status:'ended'` (종료): `output:{result:{response,messages}}`, `port:<cond>` |
| `information_extractor` (multi) | 동상 | 조건 port, `output.output.extracted` | `status:'waiting_for_input'`, `output:{messages,partial?}`, `_resumeState` | `status:'ended'`, `output:{result:{extracted,endReason,turnCount}}`, `port:'completed'\|'user_ended'\|'max_turns'` |

**핵심 변경점 (기존 초안 대비)**:
- `output.view.{type,title,fields,layout,chartType,format,columns,...}` 중 **리터럴 config** 은 전부 제거. 후속 노드는 `$node["X"].config.*` 로 참조.
- `output.view` 래퍼 자체 폐기 — runtime 필드를 `output` 최상위에 직접 배치.
- `output.view.type` 판별자 폐기 — 노드 타입은 워크플로우 정의에서 이미 식별됨.
- 현재 presentation 노드의 `output.type` 판별자도 동일 이유로 폐기.

## 축 5 — Container 최종 output (Principle 9)

| 노드 | 현재 | 개선 후 |
| --- | --- | --- |
| `loop` | `[r0, r1, ...]` (엔진 오버라이트) | `{iterations:[...], count:N}` |
| `foreach` | `[r0, r1, ...]` | `{items:[...], count:N}` |
| `map` | `[r0, r1, ...]` | `{mapped:[...], count:N}` |
| `parallel` | `[b0, b1, ...]` | `{branches:[...], count:N}` |
| `filter` | `{match:[], unmatched:[]}` | 유지 (이미 구조화됨) |
| `split` | `[{index,value},...]` | `{items:[{index,value},...], count:N}` |
| `merge` | array \| object \| {in_0,in_1} | 유지 (strategy로 선택, 현재도 명확) |

## 축 6 — Pass-through 노드 (Principle 1, 9)

| 노드 | 현재 output | 개선 후 |
| --- | --- | --- |
| `if_else` | input 그대로 | `{passthrough: <input>}` — 명시적으로 래핑 |
| `switch` | input 그대로 (+meta.matchedCase) | `{passthrough: <input>, matchedCase}` |
| `variable_declaration` | input 그대로 | `{passthrough: <input>, declared: [names]}` |
| `variable_modification` | input 그대로 | `{passthrough: <input>, modified: [names]}` |
| `background` | input 그대로 | `{passthrough: <input>, backgroundRunId}` |

> **주의**: pass-through 래핑은 breaking change. 하위호환이 중요하면 input 그대로 유지하되 문서에 "input pass-through" 명시만 통일. 현실적 중간안은 `output = input` 유지하고 부가 정보는 `meta` 로 이동.

**채택안**: input을 그대로 유지하되, 부가 정보(matchedCase, 선언된 변수명 등)는 **`meta` 로 일괄 이동**. 이는 Principle 1에 부합하고 breaking change가 작음.

## 축 7 — 동적 포트 네이밍 (Principle 6)

| 노드 | 현재 ID 규칙 | 개선 후 |
| --- | --- | --- |
| `switch` | `config.cases[].id` + `default` | 유지 |
| `text_classifier` | `class_${index}` + `fallback`, `error` | 유지 |
| `parallel` | `branch_${index}` + `done` | 유지 |
| `ai_agent` | `config.conditions[].id` + sys ports | 유지 (단, reserved word 검증 추가) |
| `carousel` | 글로벌: `button.id`, per-item: `${button.id}__item_${idx}` | 유지 (per-item suffix 공식화) |
| `info_extractor` | `completed`/`user_ended`/`max_turns`/`error` (multi) or `out`/`error` | 유지 |

## 축 7.5 — config ↔ output 중복 (Principle 1.1, 신규)

기존 1차 제안에서 `output.view.*` 또는 `output.*` 에 config 리터럴 값을 echo 한 케이스를 식별하고 제거 대상으로 확정.

| 노드 | 제거 대상 경로 | 이유 | 대체 |
| --- | --- | --- | --- |
| `form` | `output.view.title`, `output.view.submitLabel`, `output.view.fields` | 전부 리터럴 config | `$node["F"].config.title` / `.submitLabel` / `.fields` 로 참조 |
| `carousel` | `output.view.layout`, `output.type`, `output.view.type` | 리터럴 config / 불필요 판별자 | `$node["C"].config.layout`; 타입은 워크플로우 정의에서 식별 |
| `carousel` (static) | `output.view.items` | 리터럴 config (static 모드) | `$node["C"].config.items` 로 참조 |
| `carousel` (dynamic) | 유지 | `items` 가 런타임 resolve 된 값 | `$node["C"].output.items` |
| `table` | `output.type`, `output.view.type` | 불필요 판별자 | 유지하지 않음 |
| `table` (static) | `output.view.rows` 에서 pure config 필터 부분 | 핸들러가 `columns[*].field` 기준 필터링한 **런타임 정규화** 결과이므로 `output.rows` 유지 | 유지 |
| `chart` | `output.view.chartType`, `output.view.title`, `output.type` | 전부 리터럴 config / 판별자 | `$node["Ch"].config.chartType` / `.title` |
| `template` | `output.view.format`, `output.type` | 리터럴 config / 판별자 | `$node["T"].config.outputFormat` |
| `ai_agent` (multi) | `output.view.maxTurns`, `output.view.type` | 리터럴 config / 판별자 | `$node["A"].config.maxTurns` |
| `information_extractor` (multi) | `output.view.maxTurns`, `output.view.maxCollectionRetries`, `output.view.type` | 리터럴 config / 판별자 | `$node["I"].config.maxTurns` / `.maxCollectionRetries` |
| `manual_trigger` | `output.parameters` (schema 정의 echo) | 스키마 정의는 config | 해석된 **값**만 `output` (또는 `output.request.*` 하위) |
| `loop` | `output.count` | config.count 와 동일 | `meta.iterations` 로 실제 실행 횟수만 기록 |
| `parallel` | `output.count` | config.branchCount 와 동일 | `meta.branches` 로 실제 완료 분기 수만 |
| `workflow` | `meta.subWorkflowId` | config.workflowId 와 동일 | config 로부터 참조 |

**보존 (현재 제안대로 유지)**:
- `foreach.output.count` / `map.output.count` — 실제 반복된 항목 수 (input 길이에 따라 변동)
- `table (dynamic).output.totalRows` — slice 된 페이지 길이 (pageSize 외부의 상수 아님)
- `form.interaction.data` — 사용자 런타임 입력
- 모든 `output.result.*` (LLM 응답 / 추출 필드 / 분류 결과) — 전부 런타임

## 축 8 — Config echo 기밀성 (Principle 7)

| 노드 | 누락 우려 필드 | 개선 |
| --- | --- | --- |
| `http_request` | URL 내 `user:pass@` 임베디드 credential | URL sanitize |
| `database_query` | `integrationId` 만 echo하므로 안전 | 유지 |
| `send_email` | `bcc`, `attachments` 는 schema에는 있으나 핸들러 미사용 — echo 여부 불명확 | 핸들러 수정 시점에 echo 대상 명시 |
| `ai_agent` | `systemPrompt` 크기 무제한 echo | 유지하되 주의 문서화 |
| `form` / `carousel` / `table` | 전체 설정 echo | 유지 |

## 축 9 — `status` 값 사전 (Principle 4)

### 현재 사용 중인 값
`waiting_for_input`, `submitted`, `button_click`, `button_continue`, `ended`, `requires_integration`, `running` (암묵)

### 개선 후 허용 값 (enum)
- `waiting_for_input` — 블로킹 대기 (공통)
- `resumed` — 사용자 입력 받아 재개됨 (공통)
- `ended` — multi-turn 종료 (LLM 계열)
- `requires_integration` — integration이 연결되지 않아 준비 필요 (send_email 등)
- **없음 (`undefined`)** — 일반 완료 상태 (대부분의 노드)

→ `submitted`, `button_click`, `button_continue` 는 `status` 에서 제거하고 `output.interaction.type` 으로 표현 (Principle 4).
