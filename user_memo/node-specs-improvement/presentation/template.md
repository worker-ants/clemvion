# Template (`template`) — Output 일관성 개선안 (재작성)

- **카테고리**: presentation
- **현 문서**: [../../node-specs/presentation/template.md](../../node-specs/presentation/template.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)
- **관련 Principle**: **Principle 1.1 (`config` ↔ `output` 직교성)** — 최우선, **Principle 4 (블로킹/재개)**, Principle 0, Principle 11

> **요약**: template 은 렌더링 측면에서 **handler 가 no-op** 인 특이 노드입니다. 엔진 expression resolver 가 handler 호출 **이전에** 템플릿 문자열 내 `{{ … }}` 를 이미 해석해 `config.template` 에 최종 문자열을 담아 넘깁니다. 이 "해석된 문자열" 이 바로 템플릿 노드의 **런타임 결과**입니다. 따라서 `output.rendered` (치환 완료된 문자열) 만 유지하고, `format` / 원본 `content` / 판별자 `type` 은 **리터럴 config** 이므로 echo 금지 (Principle 1.1 위반). 이전 초안의 `output.view.{format, content, type}` 은 config echo 였으며, 재작성 안에서 제거합니다.

---

## 1. 현재 Output 구조 요약

Template 은 사용자 정의 템플릿 문자열(HTML/Markdown/Text) 을 렌더링합니다. 실제 표현식 해석은 엔진의 expression resolver 가 수행하며, handler 는 이미 해석된 문자열을 format 과 함께 돌려줍니다. 버튼이 설정되면 blocking 이 됩니다.

### Case A — 버튼 없음 (non-blocking)

```json
{
  "config": { "outputFormat": "html", "template": "<h1>Hello {{ $vars.name }}</h1>" },
  "output": {
    "type": "template",
    "format": "html",
    "content": "<h1>Hello Alice</h1>"
  }
}
```

### Case B — 버튼 있음, 초기 실행 (waiting)

```json
{
  "config": {
    "outputFormat": "html",
    "template": "<h1>Hello {{ $vars.name }}</h1>",
    "buttonConfig": { "buttons": [ { "id": "continue", "label": "Continue", "type": "port" } ] }
  },
  "output": {
    "type": "template",
    "format": "html",
    "content": "<h1>Hello Alice</h1>"
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons" }
}
```

### Case C — port 버튼 클릭 후 (resumed, 현 구현)

```json
{
  "output": {
    "interaction": {
      "interactionType": "button_click",
      "buttonId": "continue", "buttonLabel": "Continue",
      "clickedAt": "2026-04-19T12:34:56.000Z"
    },
    "previousOutput": { "type": "template", "format": "html", "content": "…" }
  },
  "port": "continue",
  "status": "button_click",
  "meta": { "interactionType": "buttons" }
}
```

### Case D — link Continue

```json
{
  "output": {
    "interaction": { "interactionType": "button_continue", "clickedAt": "…" },
    "previousOutput": { "type": "template", "format": "html", "content": "…" }
  },
  "port": "continue",
  "status": "button_continue"
}
```

---

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | Waiting 시 `output.format` | **Principle 1.1 (config echo 금지)** | `format` 은 `config.outputFormat` 리터럴. 후속 노드는 `$node["Tpl"].config.outputFormat` 로 참조해야 함. |
| 2 | Waiting 시 `output.type` 판별자 | **Principle 1.1.4 / 축 4** | 노드 타입은 워크플로우 정의에서 파악. 판별자 불필요. |
| 3 | `output.content` 네이밍 | **Principle 1.1 / Principle 11** | "content" 는 원본 템플릿 문자열(config) 과 혼동 가능. 해석된 문자열은 `output.rendered` 로 명명 (Principle 4.3). |
| 4 | Resumed 시 `output.previousOutput` | **Principle 4.2** | CONVENTIONS 4.2 에 제거 명시. waiting 시점의 `output.rendered` 가 resumed 에도 그대로 유지됨. |
| 5 | `status: 'button_click' \| 'button_continue'` | **Principle 4.1 / 축 9** | `'resumed'` 로 통일. |
| 6 | `output.interaction.interactionType` 필드명 | Principle 4 | `output.interaction.type` 으로 축약. |
| 7 | `clickedAt` top-level 위치 | Principle 4.4 | top-level 은 `receivedAt`. |
| 8 | `outputFormat` default 충돌 (schema=html, handler=text) | Principle 11 (문서화) | 유지 caveat. schema 거치면 html, raw 호출 시 text. |
| 9 | HTML sanitize 미수행 | Principle 7 (안전성) | 유지 caveat. 사용자 책임 — 별도 보안 리뷰 권장. |

**유지되는 사항**:

- `output.rendered` — expression resolver 가 해석한 **최종 문자열**. handler 호출 시점에 이미 `{{ }}` 가 치환 완료된 결과이므로 "런타임 값" 에 해당 (Principle 1.1.2 식별 기준).
- handler no-op 특성 — 의도된 설계 (expression resolver 재사용).

template 고유의 특징 — **handler 는 no-op renderer** — 는 유지:

- `config.template` 은 엔진이 이미 표현식 치환 완료한 문자열.
- Handler 는 `output.rendered = String(config.template)` 을 반환.
- Handlebars / Mustache / 기타 템플릿 엔진 실행 없음.
- UI 에디터의 `language: 'handlebars'` 는 하이라이팅 전용.

---

## 3. 제안된 Output 구조

### 3.1. Waiting (`status: "waiting_for_input"`)

**Before**

```json
{
  "output": {
    "type": "template",
    "format": "html",
    "content": "<h1>Hello Alice</h1>"
  },
  "status": "waiting_for_input"
}
```

**After**

```json
{
  "config": {
    "outputFormat": "html",
    "template": "<h1>Hello {{ $vars.name }}</h1>",
    "buttonConfig": {
      "buttons": [ { "id": "continue", "label": "Continue", "type": "port" } ]
    }
  },
  "output": {
    "rendered": "<h1>Hello Alice</h1>"
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons", "durationMs": 0 }
}
```

핵심:

- `output.rendered` — expression resolver 가 치환한 **최종 문자열**. 런타임 값 (Principle 1.1.2: 실행해야만 알 수 있음).
- `output.type` / `output.format` / `output.content` **모두 제거** (Principle 1.1).
- `output.view` 래퍼 없음 (Principle 1.1.4).
- 프런트 / 후속 노드는 `config.outputFormat` 에서 format 을 조회 (`'html' | 'markdown' | 'text'`).
- 원본 템플릿 문자열 (`<h1>Hello {{ $vars.name }}</h1>`) 이 필요하면 `config.template` 참조.

> **네이밍 결정**: 기존 `output.content` (해석된 문자열) 은 `output.rendered` 로 변경. 이유:
> - `content` 는 원본 템플릿 / 해석 결과 / 기타 "콘텐츠" 를 모두 의미할 수 있어 모호.
> - CONVENTIONS Principle 4.3 표는 template 의 runtime 값을 `{ rendered }` 로 명시.
> - `rendered` 는 "이미 해석/렌더된" 이라는 의미가 명확.

### 3.2. Non-blocking (버튼 없음) — 동일 구조

```json
{
  "config": { "outputFormat": "html", "template": "…" },
  "output": {
    "rendered": "<h1>Hello Alice</h1>"
  }
}
```

> status 없음 (undefined). 구조는 waiting 과 동일.

### 3.3. Resumed — port 버튼 클릭

```json
{
  "config": { "outputFormat": "html", "template": "…", "buttonConfig": { /* … */ } },
  "output": {
    "rendered": "<h1>Hello Alice</h1>",
    "interaction": {
      "type": "button_click",
      "data": {
        "buttonId": "continue",
        "buttonLabel": "Continue"
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "continue",
  "status": "resumed",
  "meta": { "interactionType": "buttons", "durationMs": 8500 }
}
```

- waiting 시점의 `rendered` 를 **그대로 유지** (immutable snapshot).
- `interaction.data` 에 버튼 정보 (Principle 4.5).

### 3.4. Resumed — link 타입 Continue

```json
{
  "output": {
    "rendered": "<h1>Hello Alice</h1>",
    "interaction": {
      "type": "button_continue",
      "data": {
        "buttonId": "docs",
        "buttonLabel": "Docs",
        "url": "https://docs.example.com/guide"
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "continue",
  "status": "resumed"
}
```

### 3.5. Handler 는 no-op renderer 임을 명시

- `TemplateHandler.execute()` 는 `config.template` 을 `String()` 으로 강제한 뒤 `output.rendered` 에 담음. 별도 템플릿 엔진 실행 없음.
- 객체/배열이 전달될 경우(단일 표현식 결과 타입 보존) `String(value)` 결과가 그대로 들어감 — `[object Object]` 가 될 수 있으므로 사용자는 혼합 텍스트+표현식 형태 사용 권장.
- 이 동작은 output 구조 변경과 **독립적**.

### 3.6. `outputFormat` fallback caveat 유지

- schema default = `'html'`, handler fallback = `'text'`.
- schema 를 거친 정상 실행 경로에서는 `'html'` 이 적용되지만, handler 직접 호출(테스트 등) 에서는 `'text'` 가 됨.
- output 구조 변경 후에도 동일. 문서에서 주의사항으로 유지.
- 신규 구조에서는 `format` 이 `config.outputFormat` 에서만 읽히므로 사용자 혼란은 줄어듦.

### 3.7. HTML sanitize caveat 유지

- template handler 는 `rendered` 를 sanitize 하지 않음. 신뢰할 수 없는 입력이 `{{ }}` 로 치환될 경우 template 작성자가 직접 escape 필요.
- 보안 이슈이지만 output 구조 통일과 독립. 별도 P1 이슈로 추적 권장.

---

## 4. 마이그레이션 영향도

### 4.1. Expression 경로 변화

| Before | After | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["Tpl"].output.type` | — (제거) | **Yes** | 판별자 폐기. |
| `$node["Tpl"].output.format` | `$node["Tpl"].config.outputFormat` | **Yes** | config 리터럴로 이동. 필드명도 `outputFormat` 로 변경. |
| `$node["Tpl"].output.content` | `$node["Tpl"].output.rendered` | **Yes (high)** | 네이밍 변경. template 출력에서 가장 흔한 접근 경로. |
| `$node["Tpl"].output.interaction.buttonId` | `$node["Tpl"].output.interaction.data.buttonId` | **Yes** | |
| `$node["Tpl"].output.interaction.buttonLabel` | `$node["Tpl"].output.interaction.data.buttonLabel` | **Yes** | |
| `$node["Tpl"].output.interaction.interactionType` | `$node["Tpl"].output.interaction.type` | **Yes** | |
| `$node["Tpl"].output.interaction.clickedAt` | `$node["Tpl"].output.interaction.receivedAt` | **Yes** | top-level 명칭 변경. |
| `$node["Tpl"].output.previousOutput.content` | `$node["Tpl"].output.rendered` | **Yes** | resumed 시점 rendered 는 waiting 과 동일 (immutable). |
| `$node["Tpl"].output.previousOutput.format` | `$node["Tpl"].config.outputFormat` | **Yes** | |
| `$node["Tpl"].status === "button_click"` | `$node["Tpl"].status === "resumed" && $node["Tpl"].output.interaction.type === "button_click"` | **Yes** | |
| `$node["Tpl"].status === "button_continue"` | `$node["Tpl"].status === "resumed" && $node["Tpl"].output.interaction.type === "button_continue"` | **Yes** | |
| `$node["Tpl"].port === "continue"` | 유지 | No | |
| `$node["Tpl"].config.outputFormat` | 유지 | No | 이제 format 의 유일한 참조 경로. |
| `$node["Tpl"].config.template` | 유지 | No | 원본 템플릿 문자열 (해석 완료). |

### 4.2. 영향도 매트릭스

| 영역 | 영향 수준 | 세부 |
| --- | --- | --- |
| 기존 워크플로우 expression (`output.content`) | **HIGH** | `output.rendered` 로 이름 변경. 다음 노드(email body, slack message, http_request body 등) 에서 광범위 사용. |
| 기존 워크플로우 expression (`output.format`) | **MEDIUM** | `config.outputFormat` 로 이동. |
| 프런트엔드 template 뷰어 | **MEDIUM** | `output.rendered` 로 경로 전환. `config.outputFormat` 로 format 조회. sanitize 정책 동일. |
| 엔진 resume 경로 | **HIGH** | `previousOutput` 제거, waiting 시점 rendered 보존, interaction 3-필드 정규화. |
| 템플릿 표현식 해석 | **NONE** | expression resolver 경로는 불변 — handler 호출 전에 `config.template` 이 이미 해석됨. |
| 테스트 | **MEDIUM** | handler unit + e2e. no-op 특성상 로직 복잡도 낮음. |

### 4.3. 마이그레이션 전략

1. **P0 — Handler 변경**: `TemplateHandler.execute()` 가 blocking / non-blocking 둘 다 `output: { rendered }` 만 반환. `type` / `format` / `content` 제거.
2. **P0 — Engine resume 경로**:
   - `previousOutput` 제거.
   - waiting 시점의 `rendered` 를 resumed 에서도 유지 (immutable).
   - interaction 을 `{ type, data, receivedAt }` 3-필드로 재정렬.
3. **P0 — Status 전이**: `button_click` / `button_continue` → `'resumed'` 고정.
4. **P1 — Expression migration script**:
   - `\.output\.type\b` (template 문맥) → 제거
   - `\.output\.format\b` → `.config.outputFormat`
   - `\.output\.content\b` → `.output.rendered`
   - `\.output\.interaction\.interactionType` → `.output.interaction.type`
   - `\.output\.interaction\.(buttonId|buttonLabel)` → `.output.interaction.data.$1`
   - `\.output\.interaction\.clickedAt` → `.output.interaction.receivedAt`
   - `\.output\.previousOutput\.content` → `.output.rendered`
   - `\.output\.previousOutput\.format` → `.config.outputFormat`
   - status 리터럴 치환.
5. **P1 — outputFormat fallback 정합성 (선택)**: handler fallback 을 `'html'` 로 변경해 schema default 와 일치시키거나, schema default 를 제거하고 handler 에서 일관된 fallback 적용.
6. **P1 — sanitize 정책 (보안 별도 트랙)**: `rendered` 에 대한 optional sanitize 옵션 도입 검토 (`config.sanitize: boolean`).
7. **P2 — 과거 이력 호환 뷰어**.

---

## 5. 근거

### 5.1. Principle 1.1.3 — template 이 직접 예시에 포함됨

> `template.config.content = "Hello {{ name }}"` → output 에 echo 금지. 반면 `output.rendered = "Hello Alice"` 는 expression resolver 가 해석한 런타임 결과이므로 OK.

CONVENTIONS 1.1.3 에 template 이 직접 예시로 명시되어 있으며, **output 필드명이 `rendered`** 로 규정되어 있습니다. 본 제안은 이 조항의 구체화.

### 5.2. Principle 1.1.2 — 식별 기준

> "이 값을 알기 위해 노드를 실제 실행해야 하는가?"

- `outputFormat` (html/markdown/text) — schema 만 봐도 알 수 있음 → `config`.
- `template` 원본 문자열 — schema 에 작성된 리터럴 → `config`. (단, 이 리터럴은 엔진 expression resolver 를 거쳐 치환된 형태로 handler 에 넘어옴.)
- `rendered` (해석된 최종 문자열) — `{{ }}` 치환 결과는 runtime 컨텍스트에 의존 → `output`.

### 5.3. Principle 4.3 — template 의 waiting output 공식 정의

> | `template` | `{ rendered }` | 템플릿 문자열이 engine 의 expression resolver 로 **해석된 결과**. `content` / `format` 은 config. |

CONVENTIONS 4.3 표에 정확히 `{ rendered }` 로 명시되어 있고, `content` / `format` 은 config 로 분류됩니다.

### 5.4. Principle 4.2 — previousOutput 제거

> 현재 carousel/chart/table/template의 `output.previousOutput` → **제거**.

waiting 시점의 `rendered` 는 resumed 시점에도 동일 `output.rendered` 로 유지되므로 별도 스냅샷 키 불필요.

### 5.5. Principle 4.4 — Resumed 시 waiting output 보존

> Waiting 시점 output 을 그대로 유지 (immutable snapshot) 하고 `output.interaction` 을 추가.

template 의 경우 `output.rendered` 가 그대로 유지되고, `output.interaction` 이 추가됨.

### 5.6. Handler no-op 특성과 output 구조 통일의 독립성

Template 의 특이성(handler 가 표현식을 직접 해석하지 않고 resolver 에 위임) 은 **입력** 측 이야기입니다. output 구조 통일은 **출력** 측 변화이므로 서로 독립입니다. 개선안은 handler 의 내부 로직을 건드리지 않고 output 키 네이밍만 변경합니다:

```ts
// Before (pseudocode)
return {
  output: { type: 'template', format: fmt, content: String(config.template) },
  status: buttonsExist ? 'waiting_for_input' : undefined,
  ...
};

// After (pseudocode)
return {
  output: { rendered: String(config.template) },
  status: buttonsExist ? 'waiting_for_input' : undefined,
  meta: { interactionType: 'buttons', durationMs: 0 },
  ...
};
```

### 5.7. `rendered` 의 의미 보존

`rendered` (구 `content`) 는 "UI 에 표시될 최종 문자열" 이며 type-first downstream 소비자(email body, HTTP request body, 다른 노드의 prompt) 가 그대로 사용합니다. 문자열 자체는 변경되지 않으므로 downstream 노드는 expression 경로만 업데이트하면 됩니다.

### 5.8. 5개 presentation 노드 공통 구조 수렴

```
waiting      : { status: 'waiting_for_input', output: { rendered } }
resumed      : { status: 'resumed', output: { rendered, interaction: { type, data, receivedAt } } }
non-blocking : { output: { rendered } }
```

template 이 통합되면 form/carousel/table/chart/template 모두 아래 원칙을 준수:

- **config 리터럴은 `output` echo 금지** (Principle 1.1).
- **노드 타입 판별자 없음** (Principle 1.1.4).
- **상호작용은 `output.interaction.{type, data, receivedAt}`** (Principle 4.4, 4.5).
- **status ∈ `{undefined, 'waiting_for_input', 'resumed'}`** (Principle 4.1).

노드별 런타임 필드 요약:

| 노드 | waiting 시 output |
| --- | --- |
| form | `{}` |
| carousel (static) | `{}` |
| carousel (dynamic) | `{ items }` |
| table (static) | `{ rows }` |
| table (dynamic) | `{ rows, totalRows }` |
| chart | `{ data }` |
| template | `{ rendered }` |

### 5.9. Caveat 존속 이유

- `outputFormat` schema vs handler default 불일치: 실무 영향이 작고 output 구조와 독립. 별도 이슈.
- HTML sanitize 부재: 보안 리뷰 필요 영역. output 구조 통일과 독립.
- Handler no-op renderer 특성: 의도된 설계 (expression resolver 재사용). 유지.

---

## 6. 참조

- [CONVENTIONS.md — Principle 1.1, Principle 4, Principle 11](../CONVENTIONS.md)
- [INCONSISTENCY_MATRIX.md 축 4 / 축 7.5 / 축 9](../INCONSISTENCY_MATRIX.md)
- 현 구현: `backend/src/nodes/presentation/template/template.handler.ts`, `.schema.ts`
- 표현식 해석: `backend/src/modules/execution-engine/expression/*` (handler 호출 전 `config.template` 치환)
- 동적 포트 해석: `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` → `presentationButtonPorts()`
