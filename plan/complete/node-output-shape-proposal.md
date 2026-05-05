# Proposal: 노드 핸들러 output shape 통일

> **Status**: ✅ 확정 (5개 쟁점 모두 결정 완료). 아래 "확정된 결정사항" 섹션을 기준으로 Phase 1~3 진행.

## 확정된 결정사항

1. **`output` 필드명 + wrapper**: Engine의 `$node[key] = { output: ... }` wrapper를 제거한다. Handler는 `{ config, output, meta?, port?, status? }`를 반환하고, expression은 `$node["X"].output.<field>` / `$node["X"].config.<field>` / `$node["X"].meta.<field>` 로 접근한다.
2. **Port selector 통일**: 기존 `{ port, data }` 패턴의 `data` 필드를 `output`으로 rename한다. 모든 handler가 동일한 top-level shape를 가지며, `applyPortSelection`은 `output.output`을 downstream input으로 전달하고 `output.port`를 `_selectedPort`에 기록한다.
3. **Passthrough 노드 config**: `variable-declaration` / `variable-modification` / `manual-trigger`는 노드 설정 전체를 `config`에 echo한다. `manual-trigger`는 설정이 없으므로 `config: {}`.
4. **민감 정보 정책**: `config`에는 `integrationId` UUID, 액션 이름, 파라미터만 echo한다. credentials 객체(access_token, password, api_key 등)는 handler 내부에서만 사용하고 반환 전에 제거한다.
5. **기존 워크플로우 migration**: Phase 3 배포 전 `backend/scripts/migrate-node-output-refs.ts` 실행. `.output.<moved field>` → `.config.<moved field>` 자동 rewrite + dry-run/apply/audit 지원.

## 문제 정의

현재 27개 핸들러의 `execute()` 반환 shape가 제각각이다. 대표 사례:

- **Send Email** — `{ messageId, accepted, rejected, to, cc, subject, bodyType, status, durationMs }` (config + output + meta 혼재)
- **Slack** — `{ action, status, durationMs, ts, channel, ... }` (config + output + meta 혼재)
- **HTTP Request** — `{ port: 'success', data: { response, meta: { statusCode, duration } } }` (port selector가 root에 등장)
- **Database Query** — `{ rows, rowCount, fields, query, queryType, durationMs, status }`
- **Map/Merge/Split** — bare array (primitive)
- **Transform** — bare transformed object
- **ForEach** — `{ arrayField, items }` (config echo + output 섞임)
- **Form/PDF/AI Conversation** — `{ type, status: 'waiting_for_input', ...custom fields }`

문제:
1. **downstream 표현식이 불명확**: `$node["SendEmail"].output.subject`가 echoed config인지 output인지 한눈에 구분 안 됨
2. **config와 output의 경계가 없음**: 동일 위계에서 혼재
3. **바닐라 원시값 반환**(map/merge/split)은 일관된 metadata(durationMs, port 등) 부착이 불가
4. **blocking / port 플래그**가 root에 흩어져 downstream 해석이 어려움

---

## 제안: 통일된 반환 shape

모든 핸들러는 다음 규격을 따르는 객체를 반환한다.

```ts
export interface NodeHandlerOutput {
  /** 해석 완료된(=expression resolved) 입력 설정 — 디버깅·downstream 참조용 echo */
  config: Record<string, unknown>;

  /** 실제 생산된 값 (domain shape). 배열·객체·문자열 등 자유 */
  output: unknown;

  /** 부가 실행 정보 (없으면 생략). durationMs, 외부 서비스 상태코드 등 */
  meta?: Record<string, unknown>;

  /** 엔진 라우팅 디렉티브. 기존 {port, data} 패턴을 root로 끌어올림 */
  port?: string;

  /** 엔진 흐름 제어 디렉티브 — 'waiting_for_input', 'requires_integration', 'requires_playwright' */
  status?: string;
}
```

### 엔진 연동 (expression-resolver 변경)

현재:
```ts
// expression-resolver.service.ts:46
$node[resolvedKey] = { output };   // output = nodeOutputCache[id]
```

제안:
```ts
// nodeOutputCache[id]는 이미 NodeHandlerOutput 구조이므로 그대로 expose
$node[resolvedKey] = output as Record<string, unknown>;
```

그러면 expression에서:

| 목적 | 이전 | 제안 |
|------|------|------|
| 이메일 `messageId` 접근 | `$node["SendEmail"].output.messageId` | `$node["SendEmail"].output.messageId` (동일) |
| 이메일 보낸 subject 확인 | `$node["SendEmail"].output.subject` | `$node["SendEmail"].config.subject` |
| HTTP 상태 코드 | `$node["HTTP"].output.data.meta.statusCode` | `$node["HTTP"].meta.statusCode` |
| HTTP 응답 본문 | `$node["HTTP"].output.data.response` | `$node["HTTP"].output.response` |
| 어떤 port가 선택됐나 | (참조 불가) | `$node["IfElse"].port` |
| DB rows | `$node["DB"].output.rows` | `$node["DB"].output.rows` (동일) |
| DB 쿼리 echo | `$node["DB"].output.query` | `$node["DB"].config.query` |
| 실행 시간 | `$node["DB"].output.durationMs` | `$node["DB"].meta.durationMs` |

**port/status 처리**:
- `applyPortSelection(resultObj)` — `resultObj.port`를 현재 root에서 읽음. 제안 shape에서도 `port`가 root에 있으니 로직 변경 없음. `data`는 `output`으로 rename.
- blocking 체크 `output.status === 'waiting_for_input'`도 root 접근이라 동일하게 유지.

---

## 핸들러별 Before → After 매핑

| # | 핸들러 | config | output | meta | port/status |
|---|--------|--------|--------|------|-------------|
| 1 | ai-agent (단일턴) | `{ systemPrompt, userMessage, model }` | `response` (string) | `{ tokensUsed, finishReason }` | — |
| 2 | ai-agent (멀티턴 진입) | 좌동 | `{ type: 'ai_conversation', interactionType, conversationConfig }` | `{ _multiTurnState }` | `status: 'waiting_for_input'` |
| 3 | ai-agent (조건 라우팅) | 좌동 | `response` | `{ tokensUsed, matchedCondition }` | `port: '<cond>'` |
| 4 | information-extractor | `{ schema, text }` | `extracted` | `{ tokensUsed }` | — |
| 5 | text-classifier | `{ classes, text, fallback }` | `{ class, confidence }` | `{ tokensUsed }` | `port: 'class_<n>' \| 'fallback'` |
| 6 | code | `{ language, source }` | `result` | `{ success, error?, stack? }` | — |
| 7 | transform | `{ operations }` | `transformed` (object) | — | — |
| 8 | workflow (async) | `{ targetWorkflowId, mode: 'async' }` | `{ executionId }` | `{ status }` | — |
| 9 | workflow (sync/inline) | `{ targetWorkflowId, mode: 'sync' }` | `subExecutionOutput` | `{ subExecutionId, status }` | — |
| 10 | database-query | `{ integrationId, query, queryType, parameters }` | `{ rows, rowCount, fields }` | `{ durationMs }` | — |
| 11 | http-request | `{ method, url, authentication, integrationId? }` | `response` | `{ statusCode, durationMs, headers? }` | `port: 'success' \| 'error'` |
| 12 | send-email | `{ integrationId, to, cc, subject, bodyType }` | `{ messageId, accepted, rejected }` | `{ durationMs }` | — (성공 시 status 생략) |
| 13 | slack | `{ integrationId, action, ...action params }` | action-specific (ts, channels, file, ...) | `{ durationMs }` | — |
| 14 | filter | `{ condition }` | `{ match, unmatched }` | — | — |
| 15 | foreach | `{ arrayField }` | `items` | — | — |
| 16 | if-else | `{ condition }` | input passthrough (객체) | — | `port: 'true' \| 'false'` |
| 17 | loop | `{ count, maxIterations }` | `null` (loop은 child nodes가 출력을 생성) | — | — |
| 18 | map | `{ expression, arrayField }` | mapped array | — | — |
| 19 | merge | `{ outputFormat }` | merged (array \| object \| indexed) | — | — |
| 20 | split | `{ arrayField, preserveParent }` | split array | — | — |
| 21 | switch | `{ expression, cases }` | input passthrough | `{ matchedCase: string, evaluatedValue }` | `port: '<case>' \| 'default'` |
| 22 | variable-declaration | `{ declarations }` | input passthrough | — | — |
| 23 | variable-modification | `{ modifications }` | input passthrough | — | — |
| 24 | carousel | `{ items, layout, buttonConfig? }` | `{ type: 'carousel', items, layout, rendered }` | — | `status: 'waiting_for_input'` (버튼 있을 때만) |
| 25 | chart | `{ chartType, title, config, buttonConfig? }` | `{ type: 'chart', data }` | — | `status: 'waiting_for_input'` (조건부) |
| 26 | form | `{ formConfig }` | `{ type: 'form' }` | — | `status: 'waiting_for_input'` (항상) |
| 27 | pdf | `{ fileName, pageSize, orientation, template }` | `{ type: 'pdf' }` | — | `status: 'requires_playwright'` (항상) |
| 28 | table | `{ columns, buttonConfig? }` | `{ type: 'table', rows, totalRows, rendered }` | — | `status: 'waiting_for_input'` (조건부) |
| 29 | template | `{ template, format, buttonConfig? }` | `{ type: 'template', content }` | — | `status: 'waiting_for_input'` (조건부) |
| 30 | manual-trigger | `{}` | input passthrough | — | — |

원칙:
- `config` = 노드 선언 시점에 UI로 설정한 값 (resolve 후). 민감정보(credentials)는 제외 — `integrationId` UUID만 포함.
- `output` = 하위 노드·사용자가 접근하고 싶어 할 "결과물". primitive/array/object 무엇이든 가능.
- `meta` = 실행 시 발생한 부가 정보 — 주로 관측·로깅 용도. 없으면 생략.
- `port`·`status` = 엔진 디렉티브. downstream에서 읽기는 허용하지만 일반 use case 아님.

---

## 엔진 변경 사항

1. **`node-handler.interface.ts`**
   - `NodeHandlerOutput` 인터페이스 추가
   - `NodeHandler.execute` 반환형을 `Promise<NodeHandlerOutput>`로 변경

2. **`execution-engine.service.ts`**
   - `applyPortSelection(output)` — 현재 `output.port` + `output.data`를 읽음. 제안 shape에선 `output.port` + `output.output`을 읽어 `_selectedPort` 세팅. 호환성 유지 위해 `output.data`도 fallback 허용(이행기).
   - blocking 체크 `output.status === 'waiting_for_input'` 로직 유지 (root 접근).
   - `contextService.setNodeOutput(execId, nodeId, finalOutput)` — 그대로.

3. **`expression/expression-resolver.service.ts`**
   - `$node[key] = { output: nodeOutputCache[id] }` → `$node[key] = nodeOutputCache[id]` (wrapper 제거)
   - 결과: expression에서 `$node["X"].output`이 handler의 `output` 필드를 가리키게 됨

4. **테스트 코드 업데이트**
   - 각 핸들러 spec의 assert 경로를 `output.config.*` / `output.output.*` / `output.meta.*` 형태로 조정
   - expression-resolver spec의 `$node["X"].output` 가정 조정

---

## 마이그레이션 전략 (3 phase)

### Phase 1 — 계약 도입 (non-breaking)
- `NodeHandlerOutput` 인터페이스 추가
- 엔진이 **양쪽 shape 모두 수용** — 제안 shape면 그대로 저장, legacy shape면 자동 adapter로 감싸서 `{ config: {}, output: legacyReturn }` 형태로 저장
- Expression resolver는 `$node[key]`가 이미 `config`/`output` 키를 갖고 있으면 spread, 없으면 현재처럼 `{ output }`로 wrap
- 이 Phase에서는 기존 워크플로우/expression이 그대로 동작

### Phase 2 — 핸들러 점진 마이그레이션
- 카테고리 단위로 PR 분리: integration → logic → ai → presentation → data → trigger
- 각 핸들러를 제안 shape로 리팩터. 테스트 함께 수정
- 카테고리별로 TEST WORKFLOW + REVIEW WORKFLOW 수행
- 기존 shape도 **여전히 동작**해야 하므로 adapter가 방패 역할

### Phase 3 — adapter 제거 (breaking)
- 모든 핸들러가 제안 shape를 준수하는 것을 확인한 뒤
- 엔진의 legacy shape adapter 제거
- 워크플로우 JSON 내 expression은 사전 migration 스크립트로 일괄 변환 가능:
  - `$node["X"].output.<field>` — 그대로 유지 (handler output shape가 같은 경로로 접근 가능)
  - 단, `config` 필드로 이동한 항목(예: `$node["SendEmail"].output.subject` → `$node["SendEmail"].config.subject`)은 자동 치환 필요
- 또는 이행 기간 이후 사용자에게 문서로 안내 + 워크플로우 로더에서 경고

### Phase 1만 이번에 도입한다면
- 리스크 최소. 핸들러/expression 모두 기존 동작 유지
- 이후 마이그레이션 속도는 팀 여력에 맞춰

---

## 논쟁 포인트 / 결정이 필요한 사항

1. **`output` 이름 충돌**: 엔진의 `$node["X"].output` wrapper를 제거할지(제안) vs. 유지 후 `$node["X"].output.output`을 감수할지 vs. handler 반환 키를 `result`로 바꿀지(`$node["X"].output.result` — wrapper 유지, 충돌 회피)
   - **권장**: wrapper 제거. 최종 상태 가장 깔끔.
2. **port selector의 `data` → `output` rename**: `if-else`가 현재 `{ port, data }` 반환. 제안에선 `{ config, output, port }`. `data` 사용하는 handler 전부 영향.
3. **passthrough 노드**(variable-*, manual-trigger): `config`는 비어도 괜찮은가? 아니면 `declarations` 등을 `config`에 넣을 것인가?
   - **권장**: `{ declarations }` / `{ modifications }` 등 의미 있는 설정은 모두 `config`에 기록해 감사·디버깅 용도 활용.
4. **민감정보 처리**: `config`에 echo되는 값에서 credentials는 어떻게 제외?
   - **권장**: integration 핸들러는 `integrationId` UUID만 echo. credential 자체는 절대 echo 금지.
5. **primitive output**: transform이 스칼라 반환하면? 예: `42`
   - **답**: `output: 42` — 가능. `output`은 `unknown`으로 선언돼 있어 자유.
6. **기존 워크플로우의 expression 호환**: Phase 3 진입 시 자동 마이그레이션 스크립트 필요 여부.
   - **권장**: 워크플로우 DB에서 `expression` 문자열 검색 + 사전 rewrite. 동시에 에디터에서 경고 표시.

---

## 제안 요약

1. 모든 핸들러가 `{ config, output, meta?, port?, status? }` 를 반환하는 단일 계약으로 통일
2. 엔진 expression resolver의 `$node[key]` wrapper를 제거해 `$node["X"].output` / `$node["X"].config` / `$node["X"].meta` 접근을 가능하게 함
3. Phase 1(adapter 도입) → Phase 2(핸들러 점진 마이그레이션) → Phase 3(adapter 제거) 3단계 롤아웃
4. 결과: downstream expression 가독성 향상, 모든 노드의 실행 결과가 동일한 형태로 관찰·디버깅 가능

---

## 후속 단계

- [ ] 본 제안서에 대한 리뷰 후 결정(논쟁 포인트 5개 확정)
- [ ] 결정된 내용을 `spec/4-nodes/` + `spec/5-system/4-execution-engine.md`에 반영
- [ ] Phase 1 엔진 adapter + `NodeHandlerOutput` 도입 PR
- [ ] Phase 2: 카테고리별 핸들러 마이그레이션 PRs
- [ ] Phase 3: adapter 제거 + 워크플로우 자동 migration
