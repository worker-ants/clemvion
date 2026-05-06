# Output 변수 일관성 규칙 (Conventions)

모든 노드 개선 문서가 참조하는 **공통 규칙집**입니다. 각 노드 개선 문서는 이 Principle들 중 위반 사항을 식별하고 그에 대한 구체적인 수정안을 제시합니다.

> **설계 목표**: "워크플로우 작성자가 `$node["노드 이름"].output.*` 로 값을 꺼낼 때, **노드 종류를 몰라도 어디에 무엇이 있을지 예측 가능**하도록 한다."

---

## Principle 0 — `NodeHandlerOutput`의 5필드는 불변

모든 노드 핸들러는 `{ config, output, meta?, port?, status? }` 형태의 객체를 반환합니다.
- `config`: 해석된 설정값 (자격증명 제거)
- `output`: 후속 노드에 전달되는 **주 데이터**
- `meta`: **실행 메타데이터** (duration, statusCode, tokens, logs)
- `port`: 라우팅 포트 지시 (string | string[])
- `status`: 흐름 제어 상태 (`waiting_for_input`, `resumed`, `ended` 등)

이 5필드의 의미는 **어떤 노드에서든 동일**해야 합니다.

---

## Principle 1 — `output` 은 "비즈니스 결과물"만 담는다

`output` 아래에는 후속 노드가 로직에 사용할 **도메인 데이터**만 둡니다.

| ✅ `output`에 두는 것 | ❌ `output`에 두지 않는 것 |
| --- | --- |
| 응답 본문 / 분류 결과 / 추출된 필드 | 토큰 수 / duration / HTTP status code |
| 렌더링된 프레젠테이션 뷰 | LLM model 이름 / 디버그 로그 |
| 사용자 입력 / 버튼 클릭 인터랙션 | 실행 횟수 / retry count |

→ 실행 메트릭은 **Principle 2** 에 따라 `meta`에 둡니다.

---

## Principle 1.1 — `config` 와 `output` 은 **직교**한다 (중복 금지)

사용자가 UI에서 설정한 **리터럴 값**은 **`config` 에만** 존재하고, 해당 값을 `output` 에 중복 복사하지 않습니다.

### 1.1.1. 규칙

| 값의 성격 | 저장 위치 |
| --- | --- |
| **사용자가 UI/schema 로 설정한 리터럴 값** (title, submitLabel, layout, chartType, format, columns 정의, fields 정의, systemPrompt, maxTurns, categories 정의 등) | `config` **만** |
| **런타임에 계산/변형/집계/평가된 값** (resolved items (dynamic), evaluated rows, aggregated chart data, rendered template string, LLM response, extracted fields, normalized HTTP response) | `output` **만** |
| **사용자 상호작용 데이터** (form submission, button click, user message) | `output.interaction` |
| **실행 메트릭** (duration, tokens, status code, rowCount) | `meta` (Principle 2) |

### 1.1.2. 식별 기준

다음 질문으로 판단:

> "이 값을 알기 위해 노드를 **실제 실행**해야 하는가?"

- 실행 없이 schema/config 만 보면 알 수 있음 → `config`
- 실행이 필요함 (input/외부 API/사용자 입력에 의존) → `output`

### 1.1.3. 적용 예

- `form.config.title = "User Profile"` → `output` 에 **echo 금지**. 후속 노드가 필요하면 `$node["F"].config.title` 사용.
- `carousel.config.layout = "card"` → `output` 에 echo 금지.
- `chart.config.chartType = "bar"` → `output` 에 echo 금지. 반면 `output.data` 는 input을 집계한 런타임 값이므로 OK.
- `template.config.content = "Hello {{ name }}"` → `output` 에 echo 금지. 반면 `output.rendered = "Hello Alice"` 는 expression resolver 가 해석한 런타임 결과이므로 OK. **이 패턴은 Principle 7 (config echo 원칙) 과 정확히 정합한다 — `config` 는 원본 템플릿, `output` 은 평가 결과.**
- `loop.config.count = 10` → `output` 에 echo 금지. 실제로 실행된 횟수는 `meta.iterations` 또는 `output.iterations.length`.

### 1.1.4. 예외 — `output.view` 타입 판별자 패턴은 **사용하지 않는다**

기존 초안에서 제안했던 `output.view.type = 'form' | 'carousel' | ...` 판별자는 **폐기**합니다. 노드 종류는 `$node["X"]` 로 접근하는 시점에 이미 워크플로우 정의상 알 수 있으므로 판별자는 불필요한 중복입니다.

---

## Principle 2 — `meta` 는 "실행 메트릭"만 담는다

| 분류 | 필수/권장 필드 |
| --- | --- |
| **공통** | `meta.durationMs: number` |
| **LLM 계열** | `meta.model`, `meta.inputTokens`, `meta.outputTokens`, `meta.totalTokens`, `meta.thinkingTokens?`, `meta.toolCalls?` |
| **HTTP** | `meta.statusCode`, `meta.durationMs` |
| **DB** | `meta.durationMs`, `meta.rowCount` |
| **Code** | `meta.durationMs`, `meta.success`, `meta.logs?`, `meta.error?`, `meta.errorCode?` |
| **Container** | `meta.iterations?`, `meta.branches?`, `meta.matchedCount?` |

> `ai_agent` 가 현재 사용하는 `output.metadata.*` 는 **폐지**합니다. 모든 토큰/모델 정보는 `meta.*` 로 이동.

---

## Principle 3 — 에러 컨트랙트 통일

### 3.1. 분류

| 종류 | 처리 방식 |
| --- | --- |
| **Pre-flight 에러** (config 오류, credential 누락, SSRF 차단 등) | `throw` → 엔진이 실행 실패로 마킹 |
| **Runtime 에러** (외부 API 실패, 쿼리 실패 등) | `port: 'error'` + `output.error` |
| **예상 가능한 비즈니스 실패** (매칭 없음, 빈 결과 등) | 정상 `port` 유지, 결과가 비어있음을 명시 |

### 3.2. `output.error` 표준 형태

```json
{
  "output": {
    "error": {
      "code": "HTTP_5XX" | "DB_QUERY_FAILED" | "LLM_TIMEOUT" | ...,
      "message": "사람이 읽는 메시지",
      "details": { /* optional, 노드별 */ }
    }
  },
  "port": "error"
}
```

- `code` 는 `UPPER_SNAKE_CASE`.
- `message` 는 국제화 고려 없음 (로그/디버깅용 원문).
- `details` 는 선택적, 노드별 스키마.

### 3.3. 에러 포트 보유 노드

반드시 `error` 포트를 갖는 노드: `http_request`, `database_query`, `send_email`, `ai_agent`, `information_extractor`, `text_classifier`, `code`, `workflow` (sub-workflow 실패 시).
`transform` 은 pre-flight(config) 검증만 수행 → throw.

---

## Principle 4 — 블로킹/재개 컨트랙트 통일

### 4.1. 상태 전이

```
[실행 시작]
   │
   ├─ 블로킹 노드 도달
   │     ↓
   │  status: "waiting_for_input"
   │  output: { view: {...} }         ← 렌더링용 뷰
   │  (엔진이 실행을 일시 중지)
   │
   ├─ 사용자 입력 수신
   │     ↓
   │  status: "resumed"                ← 통일된 resumed 상태
   │  output: {
   │    view: {...},                   ← 이전 뷰 그대로 유지 (immutable snapshot)
   │    interaction: {
   │      type: "form_submitted" | "button_click" | "message_received",
   │      data: {...},                 ← type별 payload
   │      receivedAt: ISO8601
   │    }
   │  }
   │
   └─ (multi-turn LLM의 경우) 조건 만족 시
         ↓
      status: "ended"
      port: <condition_id> | "user_ended" | "max_turns" | "out"
      output: { result: {...}, ... }   ← 최종 결과
```

### 4.2. 폐기할 필드 / 구조

- `_multiTurnState` → `_resumeState`로 통일. 노출되지 않는 internal 필드임을 문서에 명시.
- 현재 form의 `output.submittedData` → `output.interaction.data` 로 이동.
- 현재 carousel/chart/table/template의 `output.previousOutput` → **제거**. 이전 뷰 정보는 `config` + output의 런타임 필드 조합으로 재구성 가능 (Principle 1.1).
- 초안의 `output.view` 래퍼 → **폐기** (Principle 1.1.4). 런타임 값은 `output` 최상위에 직접 배치.
- 초안의 `output.view.type` 판별자 → **폐기** (Principle 1.1.4). 노드 타입은 워크플로우 정의에서 파악.
- 현재 presentation 노드의 `output.type: 'carousel'|'table'|...` 판별자 → **폐기** (동일 이유).
- 현재 presentation 노드의 `output.rendered` (HTML snapshot) → **프런트 렌더링용** 이라면 유지 가능하나, 후속 노드 로직이 참조할 런타임 값이 아니면 `meta.rendered` 로 이동 검토.

### 4.3. Waiting 상태의 `output` 내용 (노드별)

`output` 에는 **이 실행 시점에 계산된 런타임 값만** 담습니다. 리터럴 config 필드는 echo 금지 (Principle 1.1).

| 노드 | Waiting `output` | 런타임 필드 설명 |
| --- | --- | --- |
| `form` | `{}` (빈 객체) | 폼 렌더링에 계산할 값 없음. fields/title/submitLabel 등은 모두 `config` 참조. |
| `carousel` (static) | `{}` | `items` 가 literal config. 런타임 계산 없음. 후속 노드는 `config.items` 참조. |
| `carousel` (dynamic) | `{ items }` | `source` 표현식 해석 + `titleField`/`descriptionField`/`imageField` 매핑으로 **런타임 생성**된 items 배열. `config.items` 와 독립. |
| `table` (static) | `{ rows }` | 핸들러가 `columns[*].field` 기준으로 row 필터링 → 런타임 정규화됨. |
| `table` (dynamic) | `{ rows, totalRows }` | dataSource 에서 per-row expression 평가 결과. `totalRows` 는 slice 된 페이지 길이. |
| `chart` | `{ data }` | input 을 xAxis 기준으로 **런타임 집계**한 `[{x, y}, ...]`. chartType/title 은 config. |
| `template` | `{ rendered }` | 템플릿 문자열이 engine 의 expression resolver 로 **해석된 결과**. `content` / `format` 은 config. |
| `ai_agent` (multi) | `{ messages }` | 대화 누적. 런타임 상태. |
| `information_extractor` (multi) | `{ messages, partial? }` | 대화 + 부분적으로 수집된 extracted 필드 (있을 경우). |

### 4.4. Resumed 상태의 `output` 내용

Waiting 시점 output 을 **그대로 유지** (immutable snapshot) 하고 `output.interaction` 을 추가:

```json
{
  "output": {
    ...waiting 시점과 동일한 런타임 필드,
    "interaction": {
      "type": "form_submitted" | "button_click" | "button_continue" | "message_received",
      "data": { /* interaction type별 payload, 아래 참조 */ },
      "receivedAt": "2026-04-19T12:34:56.789Z"
    }
  },
  "status": "resumed",
  "port": "<선택된 포트>"
}
```

### 4.5. `interaction.data` payload 규격

| `interaction.type` | `data` shape | 적용 노드 |
| --- | --- | --- |
| `form_submitted` | `{ [fieldName]: value }` (제출된 필드 값) | `form` |
| `button_click` | `{ buttonId, buttonLabel, selectedItem? }` | `carousel`, `table`, `chart`, `template` |
| `button_continue` | `{ buttonId, buttonLabel, url }` | link 타입 버튼의 Continue 포트 (presentation 노드) |
| `message_received` | `{ content, role: "user" }` | `ai_agent`, `information_extractor` multi-turn |

---

## Principle 5 — `port` 활성화 모델

| 형태 | 의미 | 사용 노드 |
| --- | --- | --- |
| `port: undefined` | 기본 단일 출력 (노드 정의상 outputs가 1개) | `transform`, `send_email`, `manual_trigger` |
| `port: string` | 복수 출력 중 하나 선택 | `if_else`, `switch`, `http_request`, `database_query`, `ai_agent` 등 |
| `port: string[]` | 복수 출력 동시 활성화 (fan-out) | `parallel` (handler), `text_classifier` (multi-label) |

**금지**: `port` 를 출력 포트 ID 이외의 값으로 사용 (예: 현재 ai_agent가 `output.port` 를 조건 ID 선택에 사용하는 패턴은 Principle 8과 함께 제거).

---

## Principle 6 — 동적 포트 ID 네이밍

- **글로벌 버튼**: `config.buttons[i].id` 그대로 사용. 사용자가 설정한 ID.
- **Per-item 버튼** (carousel static 모드 등): `${buttonId}__item_${index}` — carousel이 이미 사용 중인 suffix를 공식 규칙으로 승격. 엔진이 `__item_\d+$` 패턴을 분리하여 원본 포트로 라우팅.
- **시스템 포트 예약어**: `out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`. 사용자 설정 ID가 이 값과 충돌하면 프런트엔드에서 거부.
- **동적으로 생성되는 포트**: `class_0` / `class_1` (classifier), `branch_0` / `branch_1` (parallel) 처럼 `<prefix>_<index>` 형식.

---

## Principle 7 — `config` echo 원칙 (NodeHandlerOutput.config)

> `NodeHandlerOutput.config` 는 워크플로우 작성자가 설정한 **원본(pre-evaluation) 값** 을 그대로 echo 하는 필드입니다. expression(`{{ ... }}`) 이 포함된 필드는 평가 전 형태를 echo 하고, **평가 결과는 `output.*` 에 둡니다**.
>
> 후속 노드는:
> - `$node["X"].config.<field>` — 노드가 **어떻게 설정됐는가** (원본 템플릿)
> - `$node["X"].output.<field>` — 노드가 **무엇을 실제로 생산/사용했는가** (평가 결과)
>
> 두 영역의 직교성은 Principle 1.1 의 핵심 전제입니다. 핸들러가 `context.rawConfig` 를 echo 함으로써 이 직교성이 유지됩니다 (PRD `ENG-RC-*`, Spec [실행 엔진 §5.5](../../spec/5-system/4-execution-engine.md)).

**항상 echo** (NodeHandlerOutput.config 에 raw 형태로): 사용자가 UI 에서 설정한 **비민감** 값
- `method`, `url` (credential 제거된 raw 형태), `queryType`, `mode`, `model`, `systemPrompt` (raw — `{{ }}` 포함 가능), `userPrompt` (raw), `subject` (raw), `body` (raw), `fields`, `title`, `submitLabel`, `layout`, `items`, `columns`, `chartType`, `conditions`, `categories`, `iterationLimit`, `branchCount`, `maxTurns`, `maxCollectionRetries`, `outputFormat` 등.

**절대 echo 금지**:
- 자격증명 (password, apiKey, token, secret, oauth credentials).
- 코드 본문 (`code.config.code` — 이미 `expression-exclusions`에 등록되어 있음).
- URL 내 임베디드 credential (`https://user:pass@host` → `https://host` 로 sanitize).
- 파일 업로드 원본 바이너리 (reference만).

**선택적 echo** (크기 문제):
- `form.config.fields` 가 매우 클 경우 → 그대로 echo (정의상 구조 정보).
- `ai_agent.config.systemPrompt` 가 수천 줄일 경우에도 그대로 echo (디버깅 목적).

**`config` (raw) ↔ `output` (evaluated) 관계** (Principle 1.1 재확인):
- 모든 raw config 필드는 **`output` 에 복사되지 않습니다**.
- expression 평가 결과는 `output.*` 에 단일 보존 (Principle 8.2 의 카테고리별 네이밍 원칙을 따름).
- expression 미사용 필드 (예: `mode`, `chartType`) 는 raw 와 evaluated 가 동일하므로 본 변경의 영향 없음.

### 핸들러 구현 가이드

```ts
// 표준 패턴 — 핸들러는 context.rawConfig 를 echo, evaluated 값으로 동작.
async execute(input, config /* evaluated */, context /* { rawConfig, ... } */) {
  const evaluatedSubject = config.subject as string;          // "Hello Alice"
  const evaluatedBody = config.body as string;
  await sendMail({ subject: evaluatedSubject, body: evaluatedBody, ... });

  return {
    config: {
      // raw 를 echo. 사용자가 expression 으로 작성했다면 "{{ name }}" 을 그대로.
      integrationId: context.rawConfig?.integrationId,
      to: context.rawConfig?.to,
      subject: context.rawConfig?.subject,                    // "Hello {{ name }}"
      body: context.rawConfig?.body,
      bodyType: context.rawConfig?.bodyType,
    },
    output: {
      messageId: info.messageId,
      // evaluated 값. 후속 노드가 실제 발송된 내용을 참조.
      subject: evaluatedSubject,
      body: evaluatedBody,
      bodyType: config.bodyType,
    },
  };
}
```

---

## Principle 8 — 이중/불필요한 중첩 제거

### 8.1. 금지 패턴

- ❌ `output.output.extracted.*` (현재 `information_extractor`)
- ❌ `output.data.*` 를 "본 결과" 의 1차 wrapper로 사용 (현재 `ai_agent` conditional)
- ❌ `output.metadata.tokens` (현재 `ai_agent`) → `meta.tokens` 로 이동

### 8.2. 통일된 1차 네이밍

| 개념 | 권장 위치 |
| --- | --- |
| LLM의 응답 텍스트/객체 | `output.result.response` (ai_agent) |
| 분류된 카테고리 | `output.result.category` (single) / `output.result.categories` (multi) |
| 추출된 필드 | `output.result.extracted` |
| HTTP 응답 본문 | `output.response` (그대로 유지, 이미 관용적) + `output.responseHeaders` |
| HTTP 요청 본문 (evaluated) | `output.requestBody`, `output.requestBodyType` (Principle 7 — config 의 raw 와 직교) |
| DB 쿼리 결과 | `output.rows`, `output.rowCount`, `output.fields`, `output.insertId?` (그대로 유지) |
| 이메일 전송 결과 | `output.messageId`, `output.accepted`, `output.rejected`, `output.subject`, `output.body`, `output.bodyType` (subject·body 는 Principle 7 — config 의 raw 와 직교) |
| 코드 실행 결과 | `output.result` |
| 프레젠테이션 뷰 | `output.view` (Principle 4 참고) |

> 규칙: **LLM 계열 노드 (ai_agent, text_classifier, information_extractor) 는 `output.result` 아래에 도메인 결과를 모은다.** 이 한 문장이면 3개 노드 모두 일관됩니다.

---

## Principle 9 — Container 노드의 `output` 오버라이트 컨트랙트

Container 노드 (`loop`, `foreach`, `map`, `parallel`) 는 핸들러가 반환하는 `output` 과 엔진이 반복/병렬 실행 후 덮어쓰는 `output` 이 **다릅니다**. 이 규칙을 명문화합니다.

### 9.1. 컨트랙트

- 핸들러가 `output: null` 을 반환하면, 엔진은 **반드시** 덮어씁니다.
- 핸들러가 non-null 값을 반환하면, 엔진은 **덮어쓰지 않습니다**.
- pass-through (input을 그대로 output에 복사) 는 혼란을 야기하므로 **금지**.

### 9.2. 노드별 최종 output

| 노드 | 엔진이 덮어쓰는 최종 output |
| --- | --- |
| `loop` | `{ iterations: [...], count: N }` — 각 iteration의 body 서브그래프 결과 |
| `foreach` | `{ items: [...], count: N }` — 각 아이템 처리 결과 |
| `map` | `{ mapped: [...], count: N }` — transform 결과 배열 |
| `parallel` | `{ branches: [branch_0_result, branch_1_result, ...], count: N }` |

> 현재 `loop`이 단순 배열, `foreach`도 단순 배열, `parallel`도 단순 배열을 각각 다른 의미로 쓰는 상태 → 위 구조로 통일.

### 9.3. 반복 중(body 내부) 접근

- `$loop.index`, `$loop.iteration`, `$loop.isFirst`, `$loop.isLast` 는 그대로 유지.
- `$item`, `$itemIndex` 도 그대로 유지 (Principle 4와 무관).

---

## Principle 10 — 빈/null 입력 fallback 정책

| 입력 상태 | 기대 동작 |
| --- | --- |
| 배열 기대 필드가 `undefined` 또는 `null` | **`[]` 로 fallback**. throw 금지. |
| 객체 기대 필드가 `undefined` 또는 `null` | **`{}` 로 fallback**. throw 금지. |
| 배열 기대 필드가 primitive (숫자/문자열) | throw — 타입 mismatch는 명백한 오류 |
| 필수 config 필드 missing | throw (Pre-flight, Principle 3.1) |

> 현재 `filter` 가 non-array 입력에 throw하는 동작은 유지 (명백한 사용자 실수). 단, `null`/`undefined` 는 `[]` 로 처리.

---

## Principle 11 — 출력 예시 문서화 규칙

각 노드 문서의 "Output" 섹션은 다음 형식으로 작성됩니다.

```markdown
### Case: <케이스 이름>

```json
{
  "config": { ... },
  "output": { ... },
  "meta": { ... },
  "port": "...",
  "status": "..."
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| output.result.X | ... | ... |
```

- `undefined` 필드는 JSON 예시에서 **생략**.
- 선택적 필드는 표에 `?` 표기.
- Case별로 분리 (성공 / 에러 / 재개 등).

---

## Principle 참조 매트릭스 (요약)

| # | 한 줄 요약 | 주된 영향 노드 |
| --- | --- | --- |
| 0 | 5-필드 invariant | 모든 노드 |
| 1 | `output`은 비즈니스 데이터만 | ai_agent |
| **1.1** | **`config` ↔ `output` 직교성 (중복 금지)** | **form, carousel, chart, template, ai_agent(multi), information_extractor(multi), manual_trigger, loop, parallel, workflow** |
| 2 | `meta`는 실행 메트릭만 | ai_agent, text_classifier, code |
| 3 | 에러 컨트랙트 통일 | send_email, code, transform |
| 4 | 블로킹 재개 구조 통일 | form, carousel, chart, table, template, ai_agent(multi), information_extractor(multi) |
| 5 | `port` 활성화 모델 | 모든 동적 포트 노드 |
| 6 | 동적 포트 네이밍 | carousel, ai_agent, switch, text_classifier |
| 7 | Config echo 원칙 (NodeHandlerOutput.config 전용) | http_request, ai_agent, database_query |
| 8 | 중첩 제거 | information_extractor, ai_agent |
| 9 | Container 오버라이트 명문화 | loop, foreach, map, parallel |
| 10 | Null/빈 fallback | filter, foreach, split, map, merge |
| 11 | Output 문서화 규칙 | 모든 노드 (문서 레벨) |
