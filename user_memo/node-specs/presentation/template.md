# Template (`template`)

> 사용자 정의 템플릿 문자열(HTML/Markdown/Text)을 렌더링하는 노드. 템플릿 내부의 `{{ ... }}` 표현식은 실행 엔진(expression resolver)이 handler 호출 **이전에** 해석하여 문자열로 치환한 뒤 전달합니다. 핸들러 자체는 별도의 Handlebars 엔진을 구동하지 않고 이미 해석된 문자열을 echo합니다. 선택적 버튼 액션도 지원.

- **카테고리**: `presentation`
- **컨테이너**: no
- **Blocking**: **조건부 yes** — `config.buttons`가 비어있지 않으면 `status: "waiting_for_input"` 반환
- **동적 포트**: **yes** (`dynamicPorts.kind = "presentation-buttons"`, `continueId: "continue"`)

## Config 파라메터

출처: `backend/src/nodes/presentation/template/template.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `template` | string | yes (빈 문자열 불가) | `''` | 렌더링할 템플릿 본문. UI 에디터에서 `handlebars` 언어로 작성하지만 실제 엔진은 workflow 표현식(`{{ … }}`)만 지원 | **yes** (string interpolation) |
| `outputFormat` | `'html' \| 'markdown' \| 'text'` | no | `'html'` (schema) / `'text'` (handler fallback) | 다운스트림/UI에서 해석할 포맷 힌트 | — |
| `helpers` | boolean | no | `true` | UI 토글 — 내장 헬퍼 활성화 여부 (현 handler는 이 플래그를 사용하지 않음) | — |
| `buttons` | `ButtonDef[]` | no | `[]` | 템플릿 하단 버튼 | — |

> 스키마 default는 `'html'`이지만 handler는 `config.outputFormat ?? 'text'`로 fallback하므로, 스키마 해석을 거치지 않은 raw config로 실행되는 경우(테스트/직접 호출)는 기본이 `'text'`임에 주의.

`ButtonDef`: carousel 문서 참조.

## Ports

| 방향 | id | label | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 핸들러는 input을 직접 읽지 않음 (`{{ $input.x }}` 같은 expression은 템플릿 내부에서 resolver가 해석) |
| Output (static) | `out` | Output | data | 버튼이 없을 때 |

### 동적 포트 생성 규칙

`presentationButtonPorts()` 기준:

1. `config.buttons[*]` 중 `type === 'port'`마다 포트 추가
2. 하나 이상 있으면 그것을 반환
3. 없고 `link` 타입이 하나라도 존재 → `{ id: "continue", label: "Continue" }`
4. 버튼 자체가 없으면 정적 `out`

## Input

Handler는 `input`을 직접 참조하지 않습니다 (`execute(...[, config])`). 템플릿 안의 `{{ $input.… }}`, `{{ $node["X"].output.… }}`, `{{ $var.… }}` 같은 표현식은 엔진의 expression resolver가 handler 호출 **전에** 해석하여 `config.template`에 최종 문자열을 담아 전달합니다.

- 문자열 전체가 단일 표현식이면 타입 보존(객체/배열) → handler는 `String(config.template)` 전제이므로 이 경우 `String(value)` 결과가 들어올 가능성이 있음. 대부분은 문자열 혼합 템플릿으로 사용.
- 혼합 텍스트+표현식은 항상 문자열로 강제 (객체는 `JSON.stringify`).

## Output

### Case 1: 버튼 없음 — non-blocking

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

### Case 2: 버튼 있음 — 초기 실행 (waiting_for_input)

```json
{
  "config": {
    "outputFormat": "html",
    "buttonConfig": {
      "buttons": [
        { "id": "continue", "label": "Continue", "type": "port" }
      ]
    }
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

### Case 3: 사용자 버튼 클릭 후

port 타입:

```json
{
  "config": { "outputFormat": "html", "buttonConfig": { "buttons": [ … ] } },
  "output": {
    "interaction": {
      "interactionType": "button_click",
      "buttonId": "continue",
      "buttonLabel": "Continue",
      "clickedAt": "2026-04-19T…"
    },
    "previousOutput": { "type": "template", "format": "html", "content": "…" }
  },
  "port": "continue",
  "status": "button_click",
  "meta": { "interactionType": "buttons" }
}
```

link 타입(Continue):

```json
{
  "output": {
    "interaction": { "interactionType": "button_continue", "clickedAt": "…" },
    "previousOutput": { "type": "template", "format": "html", "content": "…" }
  },
  "port": "continue",
  "status": "button_continue",
  "meta": { "interactionType": "buttons" }
}
```

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Welcome Message`라고 가정.

### 버튼 없는 경우:

| 표현식 | 값 | 설명 |
| --- | --- | --- |
| `{{ $node["Welcome Message"].output.content }}` | `"<h1>Hello Alice</h1>"` | 렌더된 최종 문자열 |
| `{{ $node["Welcome Message"].output.format }}` | `"html"` | 출력 포맷 |
| `{{ $node["Welcome Message"].output.type }}` | `"template"` | payload 타입 마커 |
| `{{ $node["Welcome Message"].config.outputFormat }}` | `"html"` | 설정된 포맷 |

### 버튼 클릭 후 (AFTER interaction):

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Welcome Message"].output.interaction.buttonId }}` | `"continue"` | 클릭 버튼 ID |
| `{{ $node["Welcome Message"].output.interaction.buttonLabel }}` | `"Continue"` | 클릭 버튼 라벨 |
| `{{ $node["Welcome Message"].output.interaction.interactionType }}` | `"button_click"` \| `"button_continue"` | 상호작용 종류 |
| `{{ $node["Welcome Message"].output.previousOutput.content }}` | `"<h1>…</h1>"` | 대기 시점의 템플릿 결과 |
| `{{ $node["Welcome Message"].port }}` | `"continue"` | 활성 포트 |
| `{{ $node["Welcome Message"].status }}` | `"button_click"` \| `"button_continue"` | 상태 |

## 주의사항

- 핸들러는 **Handlebars도 다른 템플릿 언어도 실행하지 않습니다**. 표현식은 전적으로 workflow `{{ ... }}` resolver에게 위임됨. UI에서 `language: 'handlebars'`는 에디터 하이라이팅 목적일 뿐.
- `template`이 문자열이 아니거나 빈 문자열이면 validation 실패.
- `helpers` 플래그는 현 handler에서 동작에 영향을 주지 않음 (UI toggle만 존재).
- `outputFormat`의 handler fallback은 `'text'`. schema default(`'html'`)가 적용된 경우와 raw 호출 간 차이가 있으므로 주의.
- **Blocking 조건**: `config.buttons`가 배열이면서 길이 > 0.
- **Blocking 모드에서는 컨테이너 본문 내부에 배치 금지**.
- per-item 버튼 없음 (template은 단일 렌더된 문자열만 제공). global buttons만 지원.
- `button.url`은 `javascript:`/`data:`/`vbscript:` 스킴 차단, `id`에 `__item_` 금지, 총 10개 이하.
- 렌더된 `content`의 HTML sanitize는 수행되지 않음 — 표현식 치환 결과에 신뢰할 수 없는 사용자 입력이 들어간다면 template 작성자가 직접 escape 필요.
