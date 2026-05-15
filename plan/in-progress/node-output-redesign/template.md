# Template output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. `config.template` (raw `{{ }}` 보존) ↔ `output.rendered` (expression resolver 평가 결과) 는 Principle 7 (config echo 원칙) 의 가장 명확한 사례. PR #49 으로 frontend run-results drawer 의 Template preview 글로벌 버튼 바 렌더링도 정상 동작. 잔여 권고 없음 (HTML sanitize 부재는 별도 P1 보안 트랙).

> 대상 spec: `spec/4-nodes/6-presentation/5-template.md` (§5 출력 구조)

## 현재 output (spec 인용)

§5.1 Non-blocking (버튼 없음):

```json
{
  "config": {
    "outputFormat": "html",
    "template": "<h1>Hello {{ $vars.name }}</h1>"
  },
  "output": { "rendered": "<h1>Hello Alice</h1>" }
}
```

§5.4 Waiting (블로킹):

```json
{
  "config": { "outputFormat": "html", "template": "<h1>Hello {{ $vars.name }}</h1>", "buttons": [{...}], "buttonConfig": { "buttons": [{...}] } },
  "output": { "rendered": "<h1>Hello Alice</h1>" },
  "meta": { "interactionType": "buttons", "durationMs": 0 },
  "status": "waiting_for_input"
}
```

§5.5.a Resumed (port 클릭): waiting `output.rendered` immutable + `output.interaction.{type, data, receivedAt}`.

## 진단

Template 은 expression resolver 가 `config.template` 을 평가한 결과를 `output.rendered` 로 노출하는 단순 노드. blocking 가능.

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `output.rendered: string` | 적절 (output) | expression resolver 가 평가한 최종 문자열. `config.template` (raw) 과 직교 (Principle 7 — `config` echo 원칙의 정확한 사례) |
| `output.interaction.{type, data, receivedAt}` (resumed) | 적절 | Principle 4.4 / 4.5 |
| `meta.interactionType: 'buttons'` (블로킹 시) | 적절 (meta) | |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.{outputFormat, template, helpers, buttons}` (raw echo) | 적절 | Principle 7 — `template` 은 `{{ }}` 보존 |
| `config.buttonConfig.buttons` (runtime) | 적절 — Carousel/Table/Chart 와 동일 | per-item 버튼 미지원 |
| `port: <button.id>` / `'continue'` | 적절 | Principle 5 / 6 |

부적절 항목 없음. **Template 은 Principle 1.1.3 의 핵심 사례** — spec §5 head footnote 가 명시: "Principle 7 (config echo 원칙) 과 정확히 정합 — `config` 는 원본 템플릿, `output` 은 평가 결과".

추가 점검:

1. **HTML sanitize caveat** (spec §1 footnote): `output.rendered` 는 sanitize 되지 않음. 신뢰할 수 없는 입력이 `{{ }}` 로 치환되는 경우 템플릿 작성자가 직접 escape 책임. 별도 P1 보안 트랙 — output 구조 자체에는 영향 없음.

2. **outputFormat default 불일치** (spec §1 footnote): schema default `'html'` vs handler-fallback `'text'`. 정상 실행 경로는 schema 거치므로 `'html'`. 단위 테스트 직접 호출 시 `'text'` 만 관찰. output 구조 영향 없음.

3. **노-op renderer** — 핸들러는 별도 템플릿 엔진 (Handlebars 등) 실행 안 함. expression resolver 가 모든 일을 함. spec §4 step 2 명시. 단순함 유지.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
// Non-blocking
{
  "config": { "outputFormat": "html" | "markdown" | "text", "template": <raw — {{ }} 보존> },
  "output": { "rendered": <evaluated string> }
}

// Waiting (블로킹)
{
  "config": { ..., "buttons": [<raw>], "buttonConfig": { "buttons": [<runtime>] } },
  "output": { "rendered": <evaluated string> },
  "meta": { "interactionType": "buttons", "durationMs": <number> },
  "status": "waiting_for_input"
}

// Resumed
{
  "config": {...},
  "output": {
    "rendered": <evaluated string>,                  // immutable snapshot
    "interaction": { "type": "button_click" | "button_continue", "data": {...}, "receivedAt": <ISO8601> }
  },
  "meta": { ... },
  "port": "<button.id>" | "continue",
  "status": "resumed"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- Template 은 conventions Principle 7 (raw config ↔ evaluated output) 의 가장 명확한 사례 — `config.template = "Hello {{ name }}"` ↔ `output.rendered = "Hello Alice"`.
- 다른 Presentation 노드 (Carousel/Chart) 가 백엔드 HTML 생성을 폐지한 것과 달리 Template 은 본질적 기능이 "템플릿 → 렌더된 문자열" 이므로 `output.rendered` 자체가 비즈니스 데이터.
- HTML sanitize 부재는 별도 P1 보안 트랙 — output 구조 영향 없음.
- 블로킹 모드는 다른 Presentation 노드와 동일한 패턴 (waiting → resumed, `output.interaction`, `meta.interactionType: 'buttons'`).
