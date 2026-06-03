---
id: template
status: implemented
code:
  - codebase/backend/src/nodes/presentation/template/template.handler.ts
  - codebase/backend/src/nodes/presentation/template/template.schema.ts
  - codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx
  - codebase/frontend/src/lib/utils/node-config-summary.ts
---

# Spec: Template

> 관련 문서: [Presentation 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../conventions/node-output.md)

사용자 정의 템플릿 문자열에 표현식(`{{ }}`) 을 바인딩하여 HTML / Markdown / Text 콘텐츠를 생성한다. 핸들러는 **no-op renderer** 로, 표현식 해석은 엔진 expression resolver 가 핸들러 호출 **이전에** 수행한다 (CONVENTIONS Principle 7 — `config.template` 은 raw 원본 문자열을 echo, `output.rendered` 는 평가 결과).

`buttons` 가 1개 이상 설정되면 [Blocking Mode](./0-common.md#3-blocking-mode-실행-흐름) 로 진입한다.

ButtonDef 구조 / 유효성 / 포트 토폴로지 / 출력 cap / 캔버스 요약은 [공통 규약](./0-common.md) 에 정의된 것을 그대로 따른다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| template | String | ✓ | `""` | 템플릿 본문 문자열. `{{ }}` 표현식 지원. 엔진 expression resolver 가 핸들러 호출 전에 치환 |
| outputFormat | Enum | ✗ | `html` | `html` / `markdown` / `text` |
| helpers | Boolean | ✗ | `true` | 내장 헬퍼 활성화 (UI 노출 — expression resolver 의 헬퍼 등록 토글) |
| buttons | ButtonDef[] | ✗ | `[]` | 글로벌 버튼 정의. 1개 이상 시 Blocking Mode. ButtonDef 구조는 [공통 §1](./0-common.md#1-buttondef-구조) |

> 버튼 클릭 시까지 무제한 대기한다 (외부 cancel/종료 외에 타임아웃 없음).

> **outputFormat 기본값 caveat** — schema (`templateNodeConfigSchema`) default 는 `html` 이지만, handler 가 `config.outputFormat` 미지정 입력을 직접 받을 경우 fallback 은 `text`. 정상 실행 경로는 schema 를 거치므로 `html` 이 적용되며, 직접 호출 (단위 테스트 등) 에서만 `text` 가 관찰된다.

> **HTML sanitize caveat** — `output.rendered` 는 sanitize 되지 않는다. 신뢰할 수 없는 입력이 `{{ }}` 로 치환되는 경우, 템플릿 작성자가 직접 escape 해야 한다 (별도 P1 보안 트랙).

> Source of truth: `codebase/backend/src/nodes/presentation/template/template.schema.ts` (export `templateNodeConfigSchema`)

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Template Settings                   │
│  ──────────────────────────────────  │
│  Output Format: [html ▼]             │
│  ☑ Enable Built-in Helpers           │
│  ──────────────────────────────────  │
│  Template:                           │
│  ┌────────────────────────────────┐  │
│  │ 1│ <h1>{{title}}</h1>          │  │
│  │ 2│ <p>Generated: {{date}}</p>  │  │
│  │ 3│                             │  │
│  │ 4│ {{#each items}}             │  │
│  │ 5│   <div>{{this.name}}</div>  │  │
│  │ 6│ {{/each}}                   │  │
│  └────────────────────────────────┘  │
│                                      │
│  ─── Rendered Preview ───────────── │
│  ┌────────────────────────────────┐  │
│  │ Monthly Report                 │  │
│  │ Generated: 2026-03-29          │  │
│  └────────────────────────────────┘  │
│                                      │
│  ▶ Buttons (0)                       │
└──────────────────────────────────────┘
```

- 코드 에디터: Handlebars 구문 강조, `{{` 입력 시 입력 데이터 필드 자동완성
- 하단 Rendered Preview: 마지막 실행 데이터 기준 미리보기
- `▶ Buttons` 접이식 섹션: [Carousel §6](./1-carousel.md#6-버튼-설정-ui) 와 동일한 ButtonDef 카드 편집기

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 입력 데이터 (`{{ $input.* }}` 표현식 컨텍스트로 사용) |

### 3.2 출력 포트

[공통 §2 포트 토폴로지](./0-common.md#2-포트-토폴로지-non-blocking-vs-blocking) 참조. 버튼 유무에 따라:

| 케이스 | 포트 구성 |
|--------|-----------|
| `buttons === []` (Non-blocking) | `out` (단일 출력) |
| `buttons` 에 port 타입 1+ | 글로벌 동적 포트 `<button.id>` (UUID v4) — `out` 제거 |
| `buttons` 가 link 타입 only | `continue` (자동 생성) — `out` 제거 |

> Template 은 per-item 버튼이 없다 (Carousel 전용). `itemButtons` 같은 동적 포트 변형 없음.

## 4. 실행 로직

1. **(엔진)** Expression resolver 가 `config.template` 내 `{{ }}` 토큰을 현재 실행 컨텍스트(`$input`, `$node[*]`, `$var`, ...) 로 치환한 문자열을 핸들러에 전달. 원본 raw 문자열은 `context.rawConfig.template` 으로 유지.
2. **(핸들러)** `config.template` 을 `String()` 으로 강제하여 `output.rendered` 에 담는다 — 별도 템플릿 엔진(Handlebars/Mustache) 실행 없음 (no-op renderer).
3. `outputFormat` 결정: `rawConfig.outputFormat ?? config.outputFormat ?? 'text'` (handler-fallback 은 `'text'`, schema default 는 `'html'` — §1 caveat).
4. `config.buttons` 처리:
   - `Array.isArray(buttons) && buttons.length > 0` → **Blocking Mode** 진입 (§5.4): [공통 §3](./0-common.md#3-blocking-mode-실행-흐름) 흐름. `buttonConfig: { buttons }` 를 config echo 에 포함, `status: 'waiting_for_input'`, `meta.interactionType: 'buttons'`.
   - 그 외 → **Non-blocking** (§5.1): `status` 미설정, `out` 포트로 출력 전달.
5. (Blocking) 사용자 클릭 후 [공통 §4.2 / CONVENTIONS §4.4–4.5](./0-common.md#42-resumed-버튼-클릭--폼-제출-후) 에 따라 `status: 'resumed'` + `output.interaction.{type, data, receivedAt}` 가 추가되며 (§5.5), waiting 시점의 `output.rendered` 는 immutable snapshot 으로 그대로 유지된다.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지. `config.template` 은 raw 원본 (`{{ }}` 보존), `output.rendered` 는 expression resolver 가 평가한 결과 (Principle 7, 1.1.3).
>
> Template 은 비-블로킹(§5.1) / waiting(§5.4) / resumed(§5.5) 세 케이스로 구성된다. 별도 에러 포트는 없다 — 모든 검증 실패는 pre-flight throw (§6).

### 5.1 Case: Non-blocking (버튼 없음)

```json
{
  "config": {
    "outputFormat": "html",
    "template": "<h1>Hello {{ $vars.name }}</h1>"
  },
  "output": {
    "rendered": "<h1>Hello Alice</h1>"
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.outputFormat` | `'html'` / `'markdown'` / `'text'` | config echo (Principle 7) | 사용자가 설정한 출력 포맷. `output` 에 echo 금지 (Principle 1.1) |
| `config.template` | string | config echo | **raw** 원본 템플릿 (`{{ }}` 보존). `context.rawConfig.template` 그대로 |
| `output.rendered` | string | runtime — expression resolver | `{{ }}` 치환 완료된 최종 문자열 |

> `meta.durationMs` 는 엔진이 모든 노드에 공통 주입한다. `port` / `status` 미설정 — 단일 `out` 포트로 출력.

**Expression 접근 예**:
- `$node["Tpl"].config.template` → `"<h1>Hello {{ $vars.name }}</h1>"` (raw)
- `$node["Tpl"].config.outputFormat` → `"html"`
- `$node["Tpl"].output.rendered` → `"<h1>Hello Alice</h1>"` (평가 결과)

### 5.4 Case: Waiting (버튼 설정 시 — Blocking Mode 진입)

```json
{
  "config": {
    "outputFormat": "html",
    "template": "<h1>Hello {{ $vars.name }}</h1>",
    "buttons": [
      { "id": "approve", "label": "Approve", "type": "port" }
    ],
    "buttonConfig": {
      "buttons": [
        { "id": "approve", "label": "Approve", "type": "port" }
      ]
    }
  },
  "output": {
    "rendered": "<h1>Hello Alice</h1>"
  },
  "meta": {
    "interactionType": "buttons",
    "durationMs": 0
  },
  "status": "waiting_for_input"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.outputFormat` | enum | config echo | (§5.1과 동일) |
| `config.template` | string | config echo | (§5.1과 동일) — raw `{{ }}` 보존 |
| `config.buttons` | ButtonDef[] | config echo | 사용자 정의 버튼 배열 |
| `config.buttonConfig.buttons` | ButtonDef[] | handler 생성 | [공통 §3](./0-common.md#3-blocking-mode-실행-흐름) 의 `buttonConfig` 페이로드 (`NodeExecution` 보존용) |
| `output.rendered` | string | runtime | 평가된 최종 문자열 (immutable — resumed 시점에도 유지) |
| `meta.interactionType` | `'buttons'` | handler return | 인터랙션 타입 분류자 |
| `meta.durationMs` | number | handler return | 핸들러 실행 시간 (waiting 진입 직전) |
| `status` | `'waiting_for_input'` | handler return | 블로킹 대기 상태 ([공통 §3](./0-common.md#3-blocking-mode-실행-흐름)) |

> `port` 미설정 — 사용자가 어떤 버튼을 클릭할지 결정될 때까지 라우팅 보류. 클릭 시 §5.5 로 전이.

### 5.5 Case: Resumed (사용자 인터랙션 후)

[공통 §4.2](./0-common.md#42-resumed-버튼-클릭--폼-제출-후) / [CONVENTIONS §4.4–4.5](../../conventions/node-output.md) 에 따라, waiting 시점의 `output.rendered` 는 그대로 유지하고 `output.interaction` 이 추가된다.

#### 5.5.a port 타입 버튼 클릭

```json
{
  "config": {
    "outputFormat": "html",
    "template": "<h1>Hello {{ $vars.name }}</h1>",
    "buttons": [
      { "id": "approve", "label": "Approve", "type": "port" }
    ],
    "buttonConfig": {
      "buttons": [
        { "id": "approve", "label": "Approve", "type": "port" }
      ]
    }
  },
  "output": {
    "rendered": "<h1>Hello Alice</h1>",
    "interaction": {
      "type": "button_click",
      "data": {
        "buttonId": "approve",
        "buttonLabel": "Approve"
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "meta": {
    "interactionType": "buttons",
    "durationMs": 8500
  },
  "port": "approve",
  "status": "resumed"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (§5.4와 동일) | config echo | |
| `output.rendered` | string | runtime — immutable snapshot | waiting 시점 값 그대로 (§5.4 = §5.5) |
| `output.interaction.type` | `'button_click'` | engine resume | port 타입 버튼 클릭 (CONVENTIONS §4.5) |
| `output.interaction.data.buttonId` | string | engine resume | 클릭된 버튼의 `config.buttons[i].id` |
| `output.interaction.data.buttonLabel` | string | engine resume | 클릭된 버튼의 `config.buttons[i].label` (평가 후) |
| `output.interaction.receivedAt` | ISO8601 | engine resume | 클릭 수신 시각 |
| `meta.durationMs` | number | engine | waiting 진입 ~ 클릭 수신 까지의 총 wall-clock 시간 |
| `port` | `<button.id>` | engine | 클릭된 port 버튼의 ID 로 라우팅 |
| `status` | `'resumed'` | engine | (CONVENTIONS §4.1 — `'button_click'` 등은 폐기, `'resumed'` 로 통일) |

**Expression 접근 예**:
- `$node["Tpl"].output.rendered` → `"<h1>Hello Alice</h1>"` (waiting/resumed 동일)
- `$node["Tpl"].output.interaction.data.buttonId` → `"approve"`
- `$node["Tpl"].port` → `"approve"`
- `$node["Tpl"].status` → `"resumed"`

#### 5.5.b link 타입 버튼 Continue (link 전용 시)

```json
{
  "config": {
    "outputFormat": "html",
    "template": "<h1>Hello {{ $vars.name }}</h1>",
    "buttons": [
      { "id": "docs", "label": "Docs", "type": "link", "url": "https://docs.example.com/guide" }
    ],
    "buttonConfig": {
      "buttons": [
        { "id": "docs", "label": "Docs", "type": "link", "url": "https://docs.example.com/guide" }
      ]
    }
  },
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
  "meta": {
    "interactionType": "buttons",
    "durationMs": 12340
  },
  "port": "continue",
  "status": "resumed"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `output.interaction.type` | `'button_continue'` | engine resume | link 전용 시 Continue 클릭 (CONVENTIONS §4.5) |
| `output.interaction.data.url` | string | engine resume | 클릭된 link 버튼의 평가된 URL |
| `port` | `'continue'` | engine | link 전용 자동 생성 포트 |

> link + port 혼합 케이스에서 link 버튼은 새 탭으로 URL 을 열고 실행 상태를 변경하지 않는다 — `'continue'` 포트는 **link 만 존재할 때** 자동 생성되어 그때만 발화한다 ([공통 §2 포트 토폴로지](./0-common.md#2-포트-토폴로지-non-blocking-vs-blocking) 의 Continue 행).

## 6. 에러 코드

Template 은 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 pre-flight (config 검증) 단계에서 throw 된다 (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `template` 미설정 / 빈 문자열 | `Template 본문을 입력해야 합니다.` | warningRule (캔버스 배지) + handler.validate (`evaluateMetadataBlockingErrors`) |
| `template` 이 string 아님 | `template must be a string` | handler.validate |
| `outputFormat` 이 enum 미일치 | `outputFormat must be one of: html, markdown, text` | handler.validate |
| `buttons[*]` 검증 실패 (label/url/id) | `buttons[i].id is required` 등 (`validateButtons` 위임) | handler.validate (`validateTemplateConfig`) |
| 글로벌 버튼 ID 중복 / 시스템 예약어 충돌 | (공통 §1.1 / Principle 6) | frontend 거부 + validateButtons |

> Template 핸들러는 `output.error` / `port: 'error'` 를 반환하지 않는다. expression resolver 단계의 표현식 평가 실패는 엔진 레벨 에러로 throw 되어 실행 전체가 실패 처리된다.

## 7. 캔버스 요약

[공통 §5 캔버스 요약](./0-common.md#5-캔버스-요약) — `Template` 행 인용. `summaryTemplate` 은 단일 정적 문자열이라 config 분기(버튼 유무)가 불가하므로 `{{outputFormat}} · {{buttons.length}} buttons` 로 통일한다 (버튼 0개 시 `html · 0 buttons`). 줄 수(`N lines`)는 summaryTemplate DSL 이 개행 카운트를 지원하지 않아 표시하지 않는다.

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| Template | `{{outputFormat}} · {{buttons.length}} buttons` | `html · 2 buttons` |

> Run Results Drawer 렌더링은 [공통 §6.5](./0-common.md#65-template) 참조 (HTML iframe 샌드박스 / Markdown 변환 / Text `<pre>`).

## Rationale

### R-1. 캔버스 요약 단일 포맷 채택 (2026-06-03)

초기 spec 은 버튼 유무에 따라 `{outputFormat} · {N} lines`(버튼 없음) / `{outputFormat} · {N} buttons`(버튼 있음) 두 변형을 명세했다. `summaryTemplate` 은 단일 정적 문자열이라 config(버튼 유무) 분기가 불가하고, "N lines"(템플릿 개행 수)는 summaryTemplate DSL 이 개행 카운트를 지원하지 않는다. 따라서 `{{outputFormat}} · {{buttons.length}} buttons` 단일 포맷으로 통일했다 (버튼 0개 시 `html · 0 buttons` — 차선이나 일관적). `0-common.md §5` inline 노트와 동기화.
