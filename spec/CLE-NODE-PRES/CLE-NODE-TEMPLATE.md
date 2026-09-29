---
id: "CLE-NODE-TEMPLATE"
title: "Template 노드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-TEMPLATE-001", "REQ-TEMPLATE-002", "REQ-TEMPLATE-003", "REQ-TEMPLATE-004", "REQ-TEMPLATE-005", "REQ-TEMPLATE-006", "REQ-TEMPLATE-007", "REQ-TEMPLATE-008", "REQ-TEMPLATE-009", "REQ-TEMPLATE-010", "REQ-TEMPLATE-011", "REQ-TEMPLATE-012", "REQ-TEMPLATE-013", "REQ-TEMPLATE-014", "REQ-TEMPLATE-015", "REQ-TEMPLATE-016"]
basis_superseded: false
parent: "CLE-NODE-PRES"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-PRES"]
area: "CLE-NODE-PRES"
content_hash: "ab3374eb42ac45a293909fcf2c3a88ae176473de6f5ebe33be2f738c1f7eb7c9"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/6-presentation/5-template.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "b28b1b077ad2af42a19529fb5de1513e775a8c34227113031ab7d70ebcc89e96"
etag: "sha256-870f6f77ad287623707a9699287075ffe2409f1b2bd40ef166ad4aba220d0fb3"
---
> 구현 상태: 구현됨 (Handlebars 블록 구문·내장 헬퍼 지원 여부는 [미결 사항](#미결-사항)) · 원문: `spec/4-nodes/6-presentation/5-template.md`, `spec/4-nodes/_product-overview.md` (§9.5) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Template 노드(Template, `template`)는 사용자가 적은 템플릿 문자열에 표현식(`{{ }}`)을 채워 HTML·Markdown·Text 내용을 만드는 노드다. 핸들러는 **아무것도 바꾸지 않는 렌더러(no-op renderer)** 다. 표현식 해석은 엔진 표현식 해석기가 핸들러를 부르기 **전에** 한다. 설정 에코의 `config.template` 에는 원래 템플릿 문자열을, 출력 값의 `output.rendered` 에는 평가 결과를 싣는다.

`buttons` 가 1개 이상이면 블로킹 모드로 들어간다. Presentation 노드 가운데 백엔드가 만든 문자열(`rendered`)을 출력 값에 싣는 노드는 Template 뿐이다.

범위 밖:

- 버튼 정의·버튼 편집기·포트 구성·블로킹 모드 흐름·재개 출력 규격: [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md)
- 실행 결과 드로어의 Template 표시(HTML 샌드박스 iframe, Markdown 변환, Text `<pre>`): [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#실행-결과-드로어-표시)
- 표시 도구 `render_template`: [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#표시-도구-모드)
- 표현식 문법·내장 변수: [표현식 언어](../CLE-WF/CLE-WF-EXPR.md)

## 요구사항

- REQ-TEMPLATE-001 WHEN 템플릿 본문에 표현식(`{{ }}`)이 있으면 THE SYSTEM SHALL 핸들러를 부르기 전에 엔진 표현식 해석기가 현재 실행 컨텍스트로 치환한다. (원본: ND-TP-01)
- REQ-TEMPLATE-002 WHEN 사용자가 출력 포맷을 고르면 THE SYSTEM SHALL `html`·`markdown`·`text` 가운데 하나를 받는다. (원본: ND-TP-02)
- REQ-TEMPLATE-003 WHEN 노드가 결과를 내면 THE SYSTEM SHALL 치환이 끝난 문자열을 `output.rendered` 로 다운스트림에 전달한다. (원본: ND-TP-04)
- REQ-TEMPLATE-004 WHEN 사용자가 버튼을 설정하면 THE SYSTEM SHALL 링크 버튼과 포트 버튼을 노드당 최대 5개까지 라벨·스타일·URL(링크 버튼)과 함께 받는다. (원본: ND-TP-05)
- REQ-TEMPLATE-005 WHEN 버튼이 1개 이상 있으면 THE SYSTEM SHALL 실행을 입력 대기로 멈추고 사용자가 누른 버튼의 포트로 실행을 재개한다. (원본: ND-TP-06)
- REQ-TEMPLATE-006 WHEN 입력 데이터가 배열이 아닌 객체이면 THE SYSTEM SHALL 그 최상위 키를 표현식 컨텍스트의 최상위 변수로 펼쳐 `{{ name }}` 이 `{{ $input.name }}` 과 같게 동작하게 한다.
- REQ-TEMPLATE-007 IF 펼칠 키가 `$` 내장 변수 같은 기존 컨텍스트 키와 이름이 같으면 THE SYSTEM SHALL 기존 키를 덮어쓰지 않는다.
- REQ-TEMPLATE-008 IF 입력 데이터가 배열이나 원시값이면 THE SYSTEM SHALL 최상위 변수로 펼치지 않는다.
- REQ-TEMPLATE-009 WHEN 핸들러가 실행되면 THE SYSTEM SHALL `config.template` 을 `String()` 으로 바꿔 `output.rendered` 에 담고 별도 템플릿 엔진은 돌리지 않는다.
- REQ-TEMPLATE-010 WHEN 설정 에코를 만들면 THE SYSTEM SHALL `config.template` 에 `{{ }}` 를 보존한 원래 문자열을 싣는다.
- REQ-TEMPLATE-011 WHEN `outputFormat` 이 설정되어 있지 않으면 THE SYSTEM SHALL 스키마 기본값 `html` 을 쓴다.
- REQ-TEMPLATE-012 WHEN 재개 출력을 만들면 THE SYSTEM SHALL 입력 대기 시점의 `output.rendered` 를 그대로 두고 `output.interaction` 을 더한다.
- REQ-TEMPLATE-013 IF 표현식 평가가 실패하면 THE SYSTEM SHALL 엔진 수준 에러로 던져 실행 전체를 실패 처리한다.
- REQ-TEMPLATE-014 IF `template` 이 비어 있거나 없으면 THE SYSTEM SHALL 노드 경고 규칙으로 캔버스에 알리고 설정 검증에서 거부한다.
- REQ-TEMPLATE-015 IF 설정 검증에 실패하면 THE SYSTEM SHALL 실행 전 검증 단계에서 에러를 던지고 `output.error` 나 `port: 'error'` 는 쓰지 않는다.
- REQ-TEMPLATE-016 WHEN 링크 버튼과 포트 버튼이 섞여 있고 사용자가 링크 버튼을 누르면 THE SYSTEM SHALL 새 탭에서 URL 만 열고 실행 상태는 바꾸지 않는다.

Handlebars 블록 구문과 내장 헬퍼(ND-TP-03), 입력 대기 기한(타임아웃)은 정의가 갈린다. [미결 사항](#미결-사항) 참조.

제품 요구사항 원문(ND-TP-01~06)의 우선순위는 모두 필수다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `template` | String | ✓ | `""` | 템플릿 본문 문자열. 표현식을 쓸 수 있고 엔진 표현식 해석기가 핸들러를 부르기 전에 치환한다 |
| `outputFormat` | Enum | ✗ | `html` | `html` / `markdown` / `text` |
| `helpers` | Boolean | ✗ | `true` | 내장 헬퍼 사용(UI 에 보임). 원문은 "표현식 해석기의 헬퍼 등록 토글" 로 적는다. 실제 효과는 [미결 사항](#미결-사항) 참조 |
| `buttons` | ButtonDef[] | ✗ | `[]` | 전역 버튼 정의. 1개 이상이면 블로킹 모드. 구조는 [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#버튼-정의) |

**`outputFormat` 기본값 차이**: 스키마(`templateNodeConfigSchema`) 기본값은 `html` 이다. 핸들러가 `config.outputFormat` 없는 입력을 직접 받으면 `text` 로 대신한다. 정상 실행 경로는 스키마를 거치므로 `html` 이 쓰이고 단위 테스트처럼 핸들러를 직접 부를 때만 `text` 가 보인다.

**HTML sanitize 주의**: `output.rendered` 는 sanitize 하지 않는다. 신뢰할 수 없는 입력이 `{{ }}` 로 들어가면 템플릿 작성자가 직접 escape 해야 한다. sanitize 는 별도 보안 과제로 다룬다. 실행 결과 드로어는 HTML 을 샌드박스 iframe 안에서 그리고 외부 스크립트 실행을 막는다.

스키마 단일 기준은 `codebase/backend/src/nodes/presentation/template/template.schema.ts` 의 `templateNodeConfigSchema` 다.

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 옵션 | 맨 위 | Output Format 드롭다운, "Enable Built-in Helpers" 체크 | 출력 포맷과 헬퍼 사용을 정한다 |
| Template | 옵션 아래 | 줄 번호가 있는 코드 에디터 | Handlebars 구문 강조. `{{` 를 입력하면 입력 데이터 필드를 자동완성한다 |
| Rendered Preview | Template 아래 | 렌더링 미리보기 | 마지막 실행 데이터로 결과를 미리 보여 준다 |
| Buttons 섹션 | 맨 아래 | 전역 버튼 편집기 | [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#버튼-편집기) 의 버튼 편집기를 쓴다 |

원문 화면 예시의 템플릿은 `<h1>{{title}}</h1>`, `<p>Generated: {{date}}</p>` 와 `{{#each items}} <div>{{this.name}}</div> {{/each}}` 블록을 담는다. `{{title}}`·`{{date}}` 는 [입력 펼치기](#실행-로직) 규칙으로 동작한다. `{{#each}}` 블록이 동작하는지는 [미결 사항](#미결-사항) 참조.

## 포트

**입력 포트:**

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 입력 데이터. `{{ $input.* }}` 표현식 컨텍스트로 쓴다 |

**출력 포트:**

포트 구성의 공통 규칙은 [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#포트-구성) 이 정한다.

| 경우 | 포트 구성 |
|------|-----------|
| `buttons === []`(표시 전용) | `out`(단일 출력) |
| `buttons` 에 포트 버튼 1개 이상 | 전역 동적 포트 `<button.id>`. `out` 은 없다 |
| `buttons` 가 링크 버튼뿐 | `continue`(자동 생성). `out` 은 없다 |

Template 에는 항목 버튼이 없다. `itemButtons` 같은 동적 포트 변형도 없다.

## 실행 로직

1. **(엔진)** 표현식 해석기가 `config.template` 안의 `{{ }}` 토큰을 현재 실행 컨텍스트(`$input`, `$node[*]`, `$var` 등)로 치환해 핸들러에 넘긴다. 원래 문자열은 `context.rawConfig.template` 에 남긴다.
   - **입력 펼치기(Template 전용)**: 입력 데이터(nodeInput)가 **배열이 아닌 객체**이면 엔진이 그 최상위 키를 표현식 컨텍스트의 최상위 변수로 펼친다. 그래서 `{{ name }}` 이 `{{ $input.name }}` 과 같게 동작한다. 화면 예시의 `{{title}}`·`{{date}}` 가 이 규칙에 기댄다. `$` 내장 변수 같은 **기존 컨텍스트 키와 이름이 같으면 기존 키가 이긴다**(덮어쓰지 않음, `Object.hasOwn` 검사). 입력이 배열이나 원시값이면 펼치지 않는다. 이 동작은 `NODE_TYPES.TEMPLATE` 분기에서만 하고 다른 노드에는 적용하지 않는다.
2. **(핸들러)** `config.template` 을 `String()` 으로 바꿔 `output.rendered` 에 담는다. Handlebars·Mustache 같은 별도 템플릿 엔진은 돌리지 않는다.
3. `outputFormat` 을 정한다: `rawConfig.outputFormat ?? config.outputFormat ?? 'text'`. 핸들러 대체값은 `'text'`, 스키마 기본값은 `'html'` 이다.
4. `config.buttons` 를 처리한다.
   - `Array.isArray(buttons) && buttons.length > 0` 이면 **블로킹 모드**로 들어간다([Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#블로킹-모드-실행-흐름)). 설정 에코에 `buttonConfig: { buttons }` 를 넣고 `status: 'waiting_for_input'`, `meta.interactionType: 'buttons'` 를 돌려준다.
   - 그 밖에는 **표시 전용**이다. `status` 를 두지 않고 `out` 포트로 출력한다.
5. (블로킹) 사용자가 버튼을 누르면 `status: 'resumed'` 와 `output.interaction.{type, data, receivedAt}` 이 더해지고 입력 대기 시점의 `output.rendered` 는 바뀌지 않는 스냅샷으로 남는다.

## 출력 구조

JSON 예시는 `undefined` 필드를 생략한다. 노드 출력의 다섯 필드 밖의 최상위 키는 쓰지 않는다. `config.template` 은 `{{ }}` 를 보존한 원문이고 `output.rendered` 는 표현식 해석기가 평가한 결과다. 경우는 표시 전용, 입력 대기, 재개 세 가지다. 에러 포트는 없고 모든 검증 실패는 실행 전에 던진다.

### 표시 전용(버튼 없음)

```json
{
  "config": {
    "outputFormat": "html",
    "template": "<h1>Hello {{ $var.name }}</h1>"
  },
  "output": {
    "rendered": "<h1>Hello Alice</h1>"
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.outputFormat` | `'html'` / `'markdown'` / `'text'` | 설정 에코 | 사용자가 정한 출력 포맷. 출력 값에 싣지 않는다 |
| `config.template` | string | 설정 에코 | `{{ }}` 를 보존한 **원래** 템플릿. `context.rawConfig.template` 그대로 |
| `output.rendered` | string | 런타임(표현식 해석기) | `{{ }}` 치환이 끝난 최종 문자열 |

`meta.durationMs` 는 엔진이 모든 노드에 공통으로 넣는다. `port`·`status` 는 두지 않고 `out` 포트 하나로 출력한다.

표현식 접근 예:

- `$node["Tpl"].config.template` → `"<h1>Hello {{ $var.name }}</h1>"`(원문)
- `$node["Tpl"].config.outputFormat` → `"html"`
- `$node["Tpl"].output.rendered` → `"<h1>Hello Alice</h1>"`(평가 결과)

### 입력 대기(버튼이 있을 때)

```json
{
  "config": {
    "outputFormat": "html",
    "template": "<h1>Hello {{ $var.name }}</h1>",
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
| `config.outputFormat` | enum | 설정 에코 | 표시 전용과 같다 |
| `config.template` | string | 설정 에코 | 표시 전용과 같다. `{{ }}` 원문 보존 |
| `config.buttons` | ButtonDef[] | 설정 에코 | 사용자 정의 버튼 배열 |
| `config.buttonConfig.buttons` | ButtonDef[] | 핸들러 생성 | 블로킹 모드 흐름의 `buttonConfig` 페이로드(`NodeExecution` 보존용) |
| `output.rendered` | string | 런타임 | 평가한 최종 문자열. 재개 때도 바뀌지 않는다 |
| `meta.interactionType` | `'buttons'` | 핸들러 반환 | 대기 표면 |
| `meta.durationMs` | number | 핸들러 반환 | 입력 대기 직전까지의 핸들러 실행 시간 |
| `status` | `'waiting_for_input'` | 핸들러 반환 | 입력 대기 상태 |

`port` 는 두지 않는다. 사용자가 어느 버튼을 누를지 정해질 때까지 라우팅을 미룬다. 누르면 재개로 넘어간다.

### 재개(사용자 입력 후)

입력 대기 시점의 `output.rendered` 를 그대로 두고 `output.interaction` 을 더한다.

**포트 버튼 클릭:**

```json
{
  "config": {
    "outputFormat": "html",
    "template": "<h1>Hello {{ $var.name }}</h1>",
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
| `config.*` | 입력 대기와 같다 | 설정 에코 | |
| `output.rendered` | string | 런타임, 바뀌지 않는 스냅샷 | 입력 대기 시점 값 그대로 |
| `output.interaction.type` | `'button_click'` | 엔진 재개 | 포트 버튼 클릭 |
| `output.interaction.data.buttonId` | string | 엔진 재개 | 누른 버튼의 `config.buttons[i].id` |
| `output.interaction.data.buttonLabel` | string | 엔진 재개 | 누른 버튼의 `config.buttons[i].label`(평가 후) |
| `output.interaction.receivedAt` | ISO8601 | 엔진 재개 | 클릭 수신 시각 |
| `meta.durationMs` | number | 엔진 | 입력 대기 시작부터 클릭 수신까지의 전체 시간 |
| `port` | `<button.id>` | 엔진 | 누른 포트 버튼의 ID 로 라우팅 |
| `status` | `'resumed'` | 엔진 | 재개 상태. `'button_click'` 같은 옛 상태 값은 쓰지 않는다 |

표현식 접근 예:

- `$node["Tpl"].output.rendered` → `"<h1>Hello Alice</h1>"`(입력 대기와 재개가 같다)
- `$node["Tpl"].output.interaction.data.buttonId` → `"approve"`
- `$node["Tpl"].port` → `"approve"`
- `$node["Tpl"].status` → `"resumed"`

**링크 버튼만 있을 때 Continue 클릭:**

```json
{
  "config": {
    "outputFormat": "html",
    "template": "<h1>Hello {{ $var.name }}</h1>",
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
| `output.interaction.type` | `'button_continue'` | 엔진 재개 | 링크 버튼만 있을 때 Continue 클릭 |
| `output.interaction.data.url` | string | 엔진 재개 | 누른 링크 버튼의 평가한 URL |
| `port` | `'continue'` | 엔진 | 링크 버튼 전용 자동 포트 |

링크 버튼과 포트 버튼이 섞여 있으면 링크 버튼은 새 탭에서 URL 을 열고 실행 상태를 바꾸지 않는다. 계속 포트(`continue`)는 **링크 버튼만 있을 때** 자동으로 생기고 그때만 켜진다.

## 에러 코드

Template 은 **런타임 에러 포트가 없다**. 모든 검증 실패는 실행 전 설정 검증 단계에서 던진다.

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `template` 이 없거나 빈 문자열 | `Template body must be entered.`(화면 한국어: "Template 본문을 입력해야 합니다.") | 노드 경고 규칙(캔버스 배지) + `handler.validate`(`evaluateMetadataBlockingErrors`) |
| `template` 이 문자열이 아님 | `template must be a string` | `handler.validate` |
| `outputFormat` 이 enum 에 없음 | `outputFormat must be one of: html, markdown, text` | `handler.validate` |
| `buttons[*]` 검증 실패(label·url·id) | `buttons[i].id is required` 등(`validateButtons` 위임) | `handler.validate`(`validateTemplateConfig`) |
| 전역 버튼 ID 중복, 시스템 예약어 충돌 | [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#유효성-검증) 규칙 | 프런트엔드 거부 + `validateButtons` |

Template 핸들러는 `output.error` 나 `port: 'error'` 를 돌려주지 않는다. 표현식 해석 단계의 평가 실패는 엔진 수준 에러로 던져져 실행 전체가 실패한다.

## 설정 요약

| 설정 요약 포맷 | 예시 |
|----------------|------|
| `{{outputFormat}} · {{buttons.length}} buttons`(`summaryTemplate`) | `html · 2 buttons` |

`summaryTemplate` 은 정적 문자열 하나라 버튼 유무로 나눌 수 없으므로 한 포맷으로 통일한다. 버튼이 없으면 `html · 0 buttons` 로 보인다. 템플릿 줄 수(`N lines`)는 `summaryTemplate` 문법이 줄바꿈 세기를 지원하지 않아 보여 주지 않는다([Rationale](#설정-요약을-한-포맷으로-통일한다-2026-06-03)).

## 미결 사항

- **Handlebars 를 지원하는가**: 제품 요구사항 ND-TP-01 은 "Handlebars 스타일 템플릿으로 입력 데이터 바인딩" 을, ND-TP-03 은 "내장 Handlebars 헬퍼 제공(if, each, formatDate, formatNumber 등)" 을 구현됨으로 적었다. 설정 화면 예시도 `{{#each items}}` 블록과 Handlebars 구문 강조를 보여 준다. 그런데 실행 로직은 엔진 표현식 해석만 하는 no-op 렌더러이고 Handlebars·Mustache 를 돌리지 않는다고 적는다. 현재 구현(`template.handler.ts`)에서 `helpers` 플래그는 설정 에코 말고 어디서도 쓰이지 않는다. 지금 동작(표현식만)에 맞춰 ND-TP-01·03, 화면 예시, `helpers` 설명을 고칠지, Handlebars 를 새로 들일지 결정 필요.
- **입력 대기 기한(타임아웃)**: 요구사항 원문(ND-TP-06)은 "선택적 타임아웃 지원(무제한 가능)" 을 적고 이 노드 원문은 외부 취소나 종료 말고는 기한 없이 기다린다고 적는다. 결정은 [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#미결-사항) 에서 함께 한다.
- **버튼 있는 Template 의 채팅 채널 전달**: Template 도 버튼이 있으면 입력 대기에 들어간다. 그런데 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 은 입력 대기 이벤트 앞에 보내는 시각 메시지 규칙에 carousel·table·chart 만 적고 [Telegram 어댑터](../CLE-CHAT/CLE-CHAT-TELEGRAM.md) 의 template 행은 표시 전용과 AI 경로만 적는다. 현재 구현의 Telegram 렌더러는 template 도 처리한다. 문서만 보면 버튼 달린 Template 본문이 채널로 나가는지 알 수 없다. 어댑터 규약의 버튼 대기 규칙에 template 을 더할지 결정 필요.

## 구현 위치

- `codebase/backend/src/nodes/presentation/template/template.component.ts`
- `codebase/backend/src/nodes/presentation/template/template.handler.ts` (no-op 렌더러, `validateTemplateConfig`)
- `codebase/backend/src/nodes/presentation/template/template.schema.ts` (`templateNodeConfigSchema`, `warningRules`)
- `codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx`
- `codebase/frontend/src/lib/utils/node-config-summary.ts` (설정 요약)

## Rationale

### 설정 요약을 한 포맷으로 통일한다 (2026-06-03)

처음 명세는 버튼 유무에 따라 `{outputFormat} · {N} lines`(버튼 없음)와 `{outputFormat} · {N} buttons`(버튼 있음) 두 포맷을 적었다. 그런데 `summaryTemplate` 은 정적 문자열 하나라 설정(버튼 유무)으로 나눌 수 없다. "N lines"(템플릿 줄 수)는 `summaryTemplate` 문법이 줄바꿈 세기를 지원하지 않는다. 그래서 `{{outputFormat}} · {{buttons.length}} buttons` 한 포맷으로 통일했다. 버튼이 0개일 때 `html · 0 buttons` 로 보이는 것은 차선이지만 일관된다.
