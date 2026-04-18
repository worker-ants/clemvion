# Template (`template`)

> 사용자 정의 템플릿(HTML/Markdown/Text)을 렌더링하는 노드. 템플릿 안의 `{{ ... }}` 표현식은 expression resolver가 사전 평가합니다. 선택적 버튼 액션 포함.

- **카테고리**: `presentation`
- **컨테이너**: no
- **Blocking**: yes (버튼이 있을 때만)
- **동적 포트**: yes (`presentation-buttons`)

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `template` | string | yes | `''` | 렌더링할 템플릿 본문 (handlebars-like; expression resolver가 사전 평가) | yes (전체 본문) |
| `outputFormat` | `'html' \| 'markdown' \| 'text'` | no | `'html'` | 출력 형식 (UI 렌더러가 사용) | no |
| `helpers` | boolean | no | `true` | 내장 헬퍼 활성화 (UI 힌트, 핸들러는 사용 안 함) | no |
| `buttons` | `Button[]` | no | `[]` | 액션 버튼 | (label/url) |

`Button`: Carousel/Table/Chart와 동일.

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | (참조용 — 데이터는 expression으로 template 안에 주입) |
| Output | `out` | Output | (버튼 없을 때) 즉시 진행 |
| Output | `<button.id>` | (button.label) | **동적** — 클릭된 버튼 |
| Output | `continue` | Continue | link만 있을 때 |

## Input

핸들러는 input을 직접 사용하지 않습니다. expression resolver가 `template` 안의 `{{ ... }}` 표현식들을 사전 평가하므로, 결과적으로 핸들러 시점에는 이미 텍스트가 채워진 `template` 문자열이 들어옵니다.

## Output

### Case 1: 버튼 없음 (즉시 진행)

config: `{ template: "<h1>Hello {{ $input.name }}</h1>", outputFormat: "html" }`
input: `{ name: "Alice" }`

(expression resolver가 `template`을 미리 해석하여 `<h1>Hello Alice</h1>`로 변환된 상태로 핸들러에 전달)

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

### Case 2: 버튼 있음 → 사용자 입력 대기

```json
{
  "config": {
    "outputFormat": "html",
    "buttonConfig": {
      "buttons": [{ "id": "btn_ok", "label": "OK", "type": "port" }]
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

| 필드 | 설명 |
| --- | --- |
| `output.type` | 항상 `"template"` |
| `output.format` | 출력 포맷 |
| `output.content` | 렌더링된 본문 (expression 해석 완료된 문자열) |
| `config.buttonConfig` | (버튼 있을 때) |
| `status` | (버튼 있을 때) `"waiting_for_input"` |
| `meta.interactionType` | (버튼 있을 때) `"buttons"` |
| `port` (제출 후) | 클릭된 버튼 ID |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Greeting`이라고 가정.

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Greeting"].output.content }}` | `"<h1>Hello Alice</h1>"` | 렌더링된 본문 |
| `{{ $node["Greeting"].output.format }}` | `"html"` | 포맷 |
| `{{ $node["Greeting"].output.type }}` | `"template"` | UI 마커 |
| `{{ $node["Greeting"].port }}` | `"btn_ok"` | (버튼 클릭 후) |

## 주의사항

- `template` 안에서 `{{ $input.* }}`, `{{ $node[...].output.* }}`, `{{ $var.* }}` 등 모든 expression 변수 사용 가능 — expression resolver가 사전 평가.
- `helpers: true`는 schema에는 있으나 핸들러에서는 사용되지 않음 (UI에서만 의미). Handlebars 헬퍼는 expression engine에서 지원하는 필터(`upper`, `lower`, `default`)로만 가능.
- `outputFormat`은 핸들러가 출력에 그대로 echo하지만 실제 변환(예: markdown → HTML)은 UI 렌더러가 수행.
- 버튼 한 개라도 있으면 blocking.
- 출력 content는 escape되지 않은 raw 문자열 — outputFormat이 `html`이면 사용자 입력이 들어간 부분에서 XSS 위험 가능. 신뢰할 수 없는 데이터를 직접 삽입하지 마세요.
