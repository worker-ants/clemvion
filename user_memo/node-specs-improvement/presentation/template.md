# Template (`template`) — Output 일관성 개선안

- **카테고리**: presentation
- **현 문서**: [../../node-specs/presentation/template.md](../../node-specs/presentation/template.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)
- **관련 Principle**: **Principle 4 (블로킹/재개)**, Principle 0, Principle 11

> **요약**: template 은 렌더링 측면에서 **handler 가 no-op** 인 특이 노드입니다. workflow expression resolver 가 handler 호출 **이전에** 템플릿 문자열 내의 `{{ … }}` 를 이미 해석해 `config.template` 에 최종 문자열을 담아 넘겨주고, handler 는 그 문자열을 echo 할 뿐입니다. 이 특성은 view 구조 통일과 무관하며, waiting/resumed 컨트랙트는 carousel/table/chart 와 동일하게 통일됩니다.

---

## 1. 현재 Output 구조 요약

Template 은 사용자 정의 템플릿 문자열(HTML/Markdown/Text) 을 렌더링합니다. 실제 표현식 해석은 엔진의 expression resolver 가 수행하며, handler 는 이미 해석된 문자열을 format 과 함께 돌려줍니다. 버튼이 설정되면 blocking 이 됩니다.

### Case A — 버튼 없음 (non-blocking)

```json
{
  "config": { "outputFormat": "html" },
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

### Case C — port 버튼 클릭 후 (resumed)

```json
{
  "output": {
    "interaction": {
      "interactionType": "button_click",
      "buttonId": "continue", "buttonLabel": "Continue",
      "clickedAt": "2026-04-19T…"
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

carousel/table/chart 와 동일한 패턴 + template 고유 caveat.

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | Waiting 시 `output` flat | **Principle 4.3** | `output.view.type: 'template'` 필요. |
| 2 | Resumed 시 `previousOutput` 네이밍 | **Principle 4.2** | → `output.view` 이동. |
| 3 | `status: 'button_click' \| 'button_continue'` | **Principle 4.1 / 축 9** | `'resumed'` 통일. |
| 4 | `output.interaction.interactionType` | Principle 4 | → `output.interaction.type`. |
| 5 | `clickedAt` top-level 위치 | Principle 4.1 | interaction 래퍼 레벨은 `receivedAt`. |
| 6 | `outputFormat` default 충돌 (schema=html, handler=text) | Principle 11 (문서화) 유지 caveat | schema 를 거치면 `'html'`, raw 호출 시 `'text'`. 문서화만 보강. |
| 7 | HTML sanitize 미수행 | Principle 7 (안전성) 유지 caveat | 사용자 책임 — 별도 보안 리뷰 권장. |

template 고유의 특징 — **handler 는 no-op renderer** — 는 유지:

- `config.template` 은 엔진이 이미 표현식 치환 완료한 문자열.
- Handler 는 `{ type: 'template', format, content: String(config.template) }` 를 반환.
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
  "output": {
    "view": {
      "type": "template",
      "format": "html",
      "content": "<h1>Hello Alice</h1>"
    }
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons", "durationMs": 0 }
}
```

- `view.type: 'template'` — Principle 4.3 판별자.
- `format` (`'html' | 'markdown' | 'text'`) + `content` (이미 expression 치환된 최종 문자열) 이 view 내부로 이동.

### 3.2. Non-blocking — 동일 래퍼

```json
{
  "output": {
    "view": {
      "type": "template",
      "format": "html",
      "content": "<h1>Hello Alice</h1>"
    }
  }
}
```

### 3.3. Resumed — port 버튼 클릭

```json
{
  "output": {
    "view": {
      "type": "template",
      "format": "html",
      "content": "<h1>Hello Alice</h1>"
    },
    "interaction": {
      "type": "button_click",
      "data": {
        "buttonId": "continue",
        "buttonLabel": "Continue",
        "clickedAt": "2026-04-19T12:34:56.000Z"
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "continue",
  "status": "resumed"
}
```

### 3.4. Resumed — link Continue

```json
{
  "output": {
    "view": { "type": "template", "format": "html", "content": "…" },
    "interaction": {
      "type": "button_continue",
      "data": { "clickedAt": "2026-04-19T12:34:56.000Z" },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "continue",
  "status": "resumed"
}
```

### 3.5. Handler 는 no-op renderer 임을 명시

- `TemplateHandler.execute()` 는 `config.template` 을 `String()` 으로 강제한 뒤 `output.view.content` 에 담음. 별도 템플릿 엔진 실행 없음.
- 객체/배열이 전달될 경우(단일 표현식 결과 타입 보존) `String(value)` 결과가 그대로 들어감 — `[object Object]` 가 될 수 있으므로 사용자는 혼합 텍스트+표현식 형태 사용 권장.
- 이 동작은 Principle 4 의 view 구조 변경과 **독립적**.

### 3.6. `outputFormat` fallback caveat 유지

- schema default = `'html'`, handler fallback = `'text'`.
- schema 를 거친 정상 실행 경로에서는 `'html'` 이 적용되지만, handler 직접 호출(테스트 등) 에서는 `'text'` 가 됨.
- view 구조 변경 후에도 동일. 문서에서 주의사항으로 유지.

### 3.7. HTML sanitize caveat 유지

- template handler 는 `content` 를 sanitize 하지 않음. 신뢰할 수 없는 입력이 `{{ }}` 로 치환될 경우 template 작성자가 직접 escape 필요.
- 이는 보안 이슈이지만 본 view 구조 통일과 독립. 별도 P1 이슈로 추적 권장 (예: `content` 는 XSS 위험이 있으므로 엔진 레벨에서 선택적 sanitize 정책 도입).

---

## 4. 마이그레이션 영향도

### 4.1. Expression 경로 변화

| Before | After | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["Tpl"].output.type` | `$node["Tpl"].output.view.type` | **Yes** | |
| `$node["Tpl"].output.format` | `$node["Tpl"].output.view.format` | **Yes** | |
| `$node["Tpl"].output.content` | `$node["Tpl"].output.view.content` | **Yes (high)** | template 출력에서 가장 흔한 접근 경로. |
| `$node["Tpl"].output.interaction.buttonId` | `$node["Tpl"].output.interaction.data.buttonId` | **Yes** | |
| `$node["Tpl"].output.interaction.buttonLabel` | `$node["Tpl"].output.interaction.data.buttonLabel` | **Yes** | |
| `$node["Tpl"].output.interaction.interactionType` | `$node["Tpl"].output.interaction.type` | **Yes** | |
| `$node["Tpl"].output.interaction.clickedAt` | `$node["Tpl"].output.interaction.data.clickedAt` (+`.receivedAt` top) | **Yes** | |
| `$node["Tpl"].output.previousOutput.content` | `$node["Tpl"].output.view.content` | **Yes** | |
| `$node["Tpl"].output.previousOutput.format` | `$node["Tpl"].output.view.format` | **Yes** | |
| `$node["Tpl"].status === "button_click"` | `$node["Tpl"].status === "resumed" && $node["Tpl"].output.interaction.type === "button_click"` | **Yes** | |
| `$node["Tpl"].status === "button_continue"` | `$node["Tpl"].status === "resumed" && $node["Tpl"].output.interaction.type === "button_continue"` | **Yes** | |
| `$node["Tpl"].port === "continue"` | 유지 | No | |
| `$node["Tpl"].config.outputFormat` | 유지 | No | |

### 4.2. 영향도 매트릭스

| 영역 | 영향 수준 | 세부 |
| --- | --- | --- |
| 기존 워크플로우 expression | **HIGH** | `output.content` 는 다음 노드(email, slack, http_request 등)의 body 로 빈번히 사용됨. |
| 프런트엔드 template 뷰어 | **MEDIUM** | `output.view.content` 로 경로 전환. sanitize 정책 동일. |
| 엔진 resume 경로 | **HIGH** | carousel/table/chart 와 동일 수정. |
| 템플릿 표현식 해석 | **NONE** | expression resolver 경로는 불변 — handler 호출 전에 `config.template` 이 이미 해석됨. |
| 테스트 | **MEDIUM** | handler unit + e2e. no-op 특성상 로직 복잡도 낮음. |

### 4.3. 마이그레이션 전략

1. **P0 — Handler 변경**: `TemplateHandler.execute()` 가 blocking / non-blocking 둘 다 `output.view` 구조로 반환. `content` / `format` 을 view 아래로.
2. **P0 — Engine resume 경로**: carousel/table/chart 와 동일 — `previousOutput → view`, interaction `{ type, data, receivedAt }`, status `'resumed'`.
3. **P1 — Expression migration script**:
   - `\.output\.(type|format|content)` → `.output.view.$1`
   - `\.output\.previousOutput\.` → `.output.view.`
   - `\.output\.interaction\.interactionType` → `.output.interaction.type`
   - `\.output\.interaction\.(buttonId|buttonLabel|clickedAt)` → `.output.interaction.data.$1`
   - status 리터럴 치환.
4. **P1 — outputFormat fallback 정합성 (선택)**: handler fallback 을 `'html'` 로 변경해 schema default 와 일치시키거나, schema default 를 제거하고 handler 에서 일관된 fallback 적용.
5. **P1 — sanitize 정책 (보안 별도 트랙)**: `content` 에 대한 optional sanitize 옵션 도입 검토 (`config.sanitize: boolean`).
6. **P2 — 과거 이력 뷰어 호환**.

---

## 5. 근거

### 5.1. Principle 4 통일

Principle 4.3 의 예시:

> `template.view`: `{ type: 'template', format, content }`

본 제안은 이 shape 을 정확히 따릅니다. 5개 presentation 노드 공통의 상태 전이 다이어그램에 합류.

### 5.2. Handler no-op 특성과 view 구조 통일의 독립성

Template 의 특이성(handler 가 표현식을 직접 해석하지 않고 resolver 에 위임) 은 **입력** 측 이야기입니다. view 구조 통일은 **출력** 측 변화이므로 서로 독립입니다. 개선안은 handler 의 내부 로직을 건드리지 않고 output 래핑만 변경합니다:

```ts
// Before (pseudocode)
return {
  output: { type: 'template', format: fmt, content: String(config.template) },
  status: buttonsExist ? 'waiting_for_input' : undefined,
  ...
};

// After (pseudocode)
return {
  output: {
    view: { type: 'template', format: fmt, content: String(config.template) }
  },
  status: buttonsExist ? 'waiting_for_input' : undefined,
  meta: { interactionType: 'buttons', durationMs: 0 },
  ...
};
```

### 5.3. `content` 의 의미 보존

`content` 는 "UI 에 표시될 최종 문자열" 이며 type-first downstream 소비자(email body, HTTP request body, 다른 노드의 prompt) 가 그대로 사용합니다. view 래퍼로 이동해도 문자열 자체는 변경되지 않으므로 downstream 노드는 expression 경로만 업데이트하면 됩니다.

### 5.4. 5개 노드 공통 구조

```
waiting:  { status: 'waiting_for_input', output: { view: { type: 'template', format, content } } }
resumed:  { status: 'resumed', output: { view, interaction: { type, data, receivedAt } } }
non-blocking: { output: { view: { type: 'template', format, content } } }
```

template 이 통합되면 form/carousel/table/chart/template 모두 아래 원칙을 준수:

- `output.view.type` 으로 UI 종류 판별
- `output.view.*` 로 렌더 payload 접근 (`fields` / `items` / `rows` / `data` / `content`)
- `output.interaction.type` 으로 사용자 입력 종류 판별 (`form_submitted` / `button_click` / `button_continue`)
- `output.interaction.data.*` 로 인터랙션 payload 접근
- `output.interaction.receivedAt` 로 시각 접근
- `status ∈ {undefined, 'waiting_for_input', 'resumed'}` 로 흐름 제어

### 5.5. Caveat 존속 이유

- `outputFormat` schema vs handler default 불일치: 실무 영향이 작고 view 구조와 독립이므로 별도 이슈.
- HTML sanitize 부재: 보안 리뷰 필요 영역. view 구조 통일과 독립.
- Handler no-op renderer 특성: 의도된 설계 (expression resolver 재사용). 유지.

---

## 6. 참조

- [CONVENTIONS.md — Principle 4, Principle 11](../CONVENTIONS.md)
- [INCONSISTENCY_MATRIX.md 축 4 / 축 9](../INCONSISTENCY_MATRIX.md)
- 현 구현: `backend/src/nodes/presentation/template/template.handler.ts`, `.schema.ts`
- 표현식 해석: `backend/src/modules/execution-engine/expression/*` (handler 호출 전 `config.template` 치환)
- 동적 포트 해석: `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` → `presentationButtonPorts()`
