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

### 4.2. 폐기할 필드

- `_multiTurnState` → `_resumeState`로 통일. 노출되지 않는 internal 필드임을 문서에 명시.
- 현재 form의 `output.submittedData` → `output.interaction.data` 로 이동.
- 현재 carousel/chart/table/template의 `output.previousOutput` → `output.view` 로 이동 (이전 뷰를 재사용한다는 의미는 동일).

### 4.3. Waiting 상태의 기본 view

- `form.view`: `{ type: 'form', fields, title, submitLabel }`
- `carousel.view`: `{ type: 'carousel', items, layout }`
- `chart.view`: `{ type: 'chart', chartType, data, title? }`
- `table.view`: `{ type: 'table', columns, rows, totalRows }`
- `template.view`: `{ type: 'template', format, content }`
- `ai_agent.view` / `information_extractor.view`: `{ type: 'chat', messages: [...] }`

모든 presentation/multi-turn 블로킹 노드는 `output.view.type` 으로 종류를 식별 가능해야 합니다.

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

## Principle 7 — Config echo 원칙

**항상 echo**: 사용자가 UI에서 설정한 **비민감** 값
- `method`, `url` (credential 제거된 버전), `queryType`, `mode`, `model`, `systemPrompt`, `fields`, `title`, `submitLabel`, `layout`, `items`, `columns`, `chartType`, `conditions`, `categories`, `iterationLimit`, `branchCount` 등.

**절대 echo 금지**:
- 자격증명 (password, apiKey, token, secret, oauth credentials).
- 코드 본문 (`code.config.code` — 이미 `expression-exclusions`에 등록되어 있음).
- URL 내 임베디드 credential (`https://user:pass@host` → `https://host` 로 sanitize).
- 파일 업로드 원본 바이너리 (reference만).

**선택적 echo** (크기 문제):
- `form.config.fields` 가 매우 클 경우 → 그대로 echo (정의상 구조 정보).
- 그러나 `ai_agent.config.systemPrompt` 가 수천 줄일 경우에도 그대로 echo (디버깅 목적).

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
| HTTP 응답 본문 | `output.response` (그대로 유지, 이미 관용적) |
| DB 쿼리 결과 | `output.rows`, `output.rowCount`, `output.fields`, `output.insertId?` (그대로 유지) |
| 이메일 전송 결과 | `output.messageId`, `output.accepted`, `output.rejected` (그대로 유지) |
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
| 2 | `meta`는 실행 메트릭만 | ai_agent, text_classifier, code |
| 3 | 에러 컨트랙트 통일 | send_email, code, transform |
| 4 | 블로킹 재개 구조 통일 | form, carousel, chart, table, template, ai_agent(multi), information_extractor(multi) |
| 5 | `port` 활성화 모델 | 모든 동적 포트 노드 |
| 6 | 동적 포트 네이밍 | carousel, ai_agent, switch, text_classifier |
| 7 | Config echo 원칙 | http_request, ai_agent, database_query |
| 8 | 중첩 제거 | information_extractor, ai_agent |
| 9 | Container 오버라이트 명문화 | loop, foreach, map, parallel |
| 10 | Null/빈 fallback | filter, foreach, split, map, merge |
| 11 | Output 문서화 규칙 | 모든 노드 (문서 레벨) |
