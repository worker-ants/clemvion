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

## 축 4 — 블로킹 재개 (Principle 4)

| 노드 | 현재 waiting | 현재 resumed | 개선 후 waiting | 개선 후 resumed |
| --- | --- | --- | --- | --- |
| `form` | `status:'waiting_for_input'`, `output:null` | `status:'submitted'`, `output:{submittedData}` | `status:'waiting_for_input'`, `output:{view:{type:'form',...}}` | `status:'resumed'`, `output:{view,interaction:{type:'form_submitted',data}}` |
| `carousel` | `status:'waiting_for_input'`, `output:{type:'carousel',items,...}` | `status:'button_click'`, `output:{interaction,previousOutput,selectedItem?}` | `status:'waiting_for_input'`, `output:{view:{type:'carousel',...}}` | `status:'resumed'`, `output:{view,interaction:{type:'button_click',data:{buttonId,...,selectedItem?}}}` |
| `chart` | 동상 | 동상 | 동상 | 동상 |
| `table` | 동상 | 동상 | 동상 | 동상 |
| `template` | 동상 | 동상 | 동상 | 동상 |
| `ai_agent` (multi) | `status:'waiting_for_input'`, `output:{conversationConfig, _multiTurnState}` | `status:'ended'` 또는 조건 port, `output.data.response` | `status:'waiting_for_input'`, `output:{view:{type:'chat',messages},_resumeState}` | `status:'resumed'` (턴 진행 중) / `status:'ended'` (종료), `output:{view, interaction:{type:'message_received',data}} / {result}` |
| `information_extractor` (multi) | 동상 | 조건 port, `output.output.extracted` | 동상 | `status:'ended'`, `output:{result:{extracted,endReason,turnCount}}` |

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
