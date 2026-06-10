---
id: nodes-overview
status: partial
code:
  - codebase/backend/src/nodes/core/**
  - codebase/backend/src/nodes/index.ts
  - codebase/frontend/src/lib/api/node-definitions.ts
  - codebase/frontend/src/lib/stores/node-definitions-store.ts
pending_plans:
  - plan/in-progress/marketplace-and-plugin-sdk.md
---

# Spec: 노드 시스템 설계 개요

> 관련 문서: [PRD 노드 시스템](./_product-overview.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md) · [Trigger 노드](./7-trigger/0-common.md) · [Logic 노드](./1-logic/0-common.md) · [Flow 노드](./2-flow/0-common.md) · [AI 노드](./3-ai/0-common.md) · [Integration 노드](./4-integration/0-common.md) · [Data 노드](./5-data/0-common.md) · [Presentation 노드](./6-presentation/0-common.md)

---

## 1. 노드 아키텍처

### 1.0 노드 컴포넌트 구조 (Backend)

노드는 `codebase/backend/src/nodes/<category>/<type>/` 폴더에 컴포넌트 단위로 구성된다. 각 노드 컴포넌트는 구조 정의와 실행 로직을 한 폴더에 응집시킨다.

```
codebase/backend/src/nodes/
├── core/
│   ├── node-component.interface.ts   # NodeComponent 타입, Ports 타입, HandlerDependencies
│   ├── node-component.registry.ts    # 모든 컴포넌트 부트스트랩 + metadata/JSON schema 조회
│   ├── node-handler.interface.ts     # NodeHandler, ExecutionContext, NodeHandlerOutput 등 실행 계약
│   ├── node-handler.registry.ts      # node type → handler 인스턴스 매핑 저장소
│   ├── workflow-executor.interface.ts # sub-workflow 실행을 위한 engine <-> 노드 계약
│   ├── nested-value.util.ts          # 다수 노드에서 공유되는 경로 기반 getter/setter
│   ├── zod-validator.ts              # Zod 스키마를 ValidationResult로 어댑팅
│   ├── ...                           # 주요 파일 발췌 — 전체 목록은 아래 비고 참조
│   └── index.ts                      # core 공개 API re-export
├── <category>/
│   ├── _shared/ or _base/            # (선택) 카테고리 내 공유 유틸/베이스 클래스
│   └── <type>/
│       ├── <type>.schema.ts      # Zod configSchema + metadata + ports
│       ├── <type>.component.ts   # NodeComponent 번들 (createHandler 팩토리 포함)
│       ├── <type>.handler.ts     # NodeHandler.execute 실행 로직
│       ├── <type>.handler.spec.ts
│       └── index.ts
└── index.ts                          # ALL_NODE_COMPONENTS 배열
```

- 위 `core/` 트리는 **주요 파일 발췌**다. 그 외에 `categories.ts`(카테고리 메타데이터 단일 소스 — §3) · `port-id.util.ts`(동적 포트 slug 검증·해석 — §1.3) · `button-slug.util.ts` · `node-type-metadata.ts` · `node-types.constants.ts` · `metadata-validation.ts` · `truncate-output.util.ts` · `condition-evaluator.util.ts` · `dry-run.util.ts` · `error-codes.ts` · `graph-warning-rule.ts` 가 `core/` 에 함께 위치한다.
- **`<type>.schema.ts`** — 노드의 구조(input/output/config)를 Zod로 선언한다. `NodeComponentMetadata`, `NodePorts`, `defaultConfig`도 동일 파일에서 export 한다. Zod 스키마는 런타임 검증과 JSON Schema 직렬화의 단일 소스로 사용된다.
- **`<type>.component.ts`** — schema/metadata와 handler 팩토리를 묶은 `NodeComponent` 객체를 export 한다. `createHandler(deps)`는 LLM/RAG/Integration/WorkflowExecutor 등 의존성을 주입받아 `NodeHandler` 인스턴스를 생성한다.
- **`<type>.handler.ts`** — 노드 실행 로직(`NodeHandler.execute`)을 담는다. 한 노드의 스키마·컴포넌트·핸들러·테스트가 동일 디렉터리에 co-locate 된다.
- 카테고리 내부에서만 공유되는 유틸/베이스 클래스는 `<category>/_shared/`·`<category>/_base/` 또는 `<category>/shared/`에 배치한다. (예: `integration/_base/integration-handler-base.ts`, `logic/_shared/condition-eval.util.ts`, `presentation/_shared/button.types.ts`, `ai/shared/system-context-prefix.ts`) — 디렉터리 prefix 컨벤션(`_` 유무)은 카테고리별로 혼재한다.
- `execution-engine` 모듈은 오케스트레이션(그래프 탐색·표현식 해석·state machine·큐 등)만 담당하며, 개별 노드의 실행 로직은 포함하지 않는다.

`NodeComponentRegistry`는 서버 부팅 시 `ALL_NODE_COMPONENTS` 배열을 순회하며 각 컴포넌트의 `createHandler(deps)`를 호출하여 `NodeHandlerRegistry`에 등록한다. 또한 `listDefinitions()`를 통해 메타데이터, 포트, JSON Schema를 프론트엔드에 제공한다.

#### 메타데이터 API

- `GET /api/nodes/definitions` — `{ definitions, categories }` 객체를 반환한다. `definitions`는 등록된 모든 노드의 `{ metadata, ports, configSchema, defaultConfig, inputSchema?, outputSchema?, extras? }` 배열이며, 스키마는 Zod v4의 `z.toJSONSchema()`로 직렬화된 JSON Schema 포맷이다. `extras?` 는 컴포넌트별 부가 데이터로, 현재 cafe24 노드만 operations-by-resource 카탈로그 전달에 사용한다 ([cafe24 API 메타데이터 규약](../conventions/cafe24-api-metadata.md) 참조). `metadata` 직렬화 시 backend 전용 `validateConfig` 함수는 strip 되며, 프론트엔드는 캔버스 배지용 선언적 `warningRules` 만 받는다. `categories`는 `{ id, label, icon, color, order }[]` 형태의 카테고리 메타데이터 배열로, 프론트엔드 팔레트의 섹션 헤더(레이블·bullet 색상·아이콘)를 렌더링하는 단일 소스다. 프론트엔드는 본 엔드포인트로 노드 팔레트, 설정 폼, 포트 카탈로그를 구성한다.

### 1.1 노드 추상 구조

모든 노드는 다음의 공통 인터페이스를 따른다:

```
┌─────────────────────────────────────────┐
│              Node Instance              │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │         Node Definition         │    │
│  │  - type: string                 │    │
│  │  - category: trigger|logic|flow|ai|integration|data|presentation │
│  │  - icon: string                 │    │
│  │  - color: string                │    │
│  │  - inputPorts: PortDef[]        │    │
│  │  - outputPorts: PortDef[]       │    │
│  │  - configSchema: JSONSchema     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Node Config (JSONB)      │    │
│  │  - (노드 유형별 설정 데이터)     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Execution Logic          │    │
│  │  execute(input) → output        │    │
│  │  validate(config) → errors      │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 1.2 노드 정의(Definition) 속성

| 속성 | 타입 | 설명 |
|------|------|------|
| type | String | 고유 식별자 (예: `if_else`, `ai_agent`) |
| category | Enum | `trigger` / `logic` / `flow` / `ai` / `integration` / `data` / `presentation` |
| displayName | String | UI 표시 이름 |
| description | String | 노드 설명 |
| icon | String | 아이콘 식별자 |
| color | String | 카테고리 컬러 코드 |
| inputPorts | PortDef[] | 입력 포트 정의 |
| outputPorts | PortDef[] | 출력 포트 정의 (동적 여부 포함) |
| configSchema | JSONSchema | 설정 폼 스키마 |
| defaultConfig | Object | 설정 기본값 |
| summaryTemplate | String | 캔버스에 표시할 설정 요약 텍스트 생성 규칙. 아래 §1.4 참조 |

### 1.3 포트 정의 (PortDef)

| 속성 | 타입 | 설명 |
|------|------|------|
| id | String | 포트 식별자 (예: `in`, `true`, `case_0`) |
| label | String | UI 표시 이름 |
| type | Enum | `data` / `control` / `error` |
| dynamic | Boolean | 동적 추가/제거 가능 여부 |
| required | Boolean | 연결 필수 여부 |

**포트 ID 생성 규칙:**
- 정적 포트: 노드 정의에서 고정 문자열 (`in`, `out`, `true`, `false`, `body`, `done` 등)
- 동적 포트: config 항목(switch case, classifier category, presentation button 등)이 보유한 **stable slug id** 를 포트 ID 로 사용한다. slug 는 `^[a-zA-Z0-9_-]{1,64}$` 형식이며, 형식을 벗어나면 인덱스 기반 fallback(`case_0`, `branch_1` 등)으로 떨어진다. 포트 이름 변경, 재정렬, 다른 포트 삭제 등 편집 작업에도 **기존 slug id 는 불변**이므로 포트에 연결된 엣지가 편집 이후에도 유지된다. 검증·해석 단일 출처는 backend `nodes/core/port-id.util.ts` 와 frontend `lib/node-definitions/resolve-dynamic-ports.ts` 가 lockstep 으로 보유한다. (UUID v4 는 사용하지 않는다.)

### 1.4 캔버스 설정 요약 (summaryTemplate)

캔버스에서 노드의 설정 내용을 한 줄로 요약 표시하는 규칙. 각 노드 유형별로 `summaryTemplate`을 정의한다.

> 상세: [캔버스 §5.3 노드 설정 요약](../3-workflow-editor/0-canvas.md#53-노드-설정-요약-configuration-summary)

| 항목 | 설명 |
|------|------|
| 표시 위치 | 노드 본체 3번째 줄 (아이콘+유형명, 사용자 레이블 아래). 컨테이너는 헤더 바 우측 |
| 최대 길이 | 40자 초과 시 ellipsis. 호버 시 툴팁 |
| 줌 의존성 | 줌 50% 미만에서 숨김 |
| 미설정 표시 | 필수 config 미완료 시 `⚠ Not configured` (앰버색) |
| 업데이트 | config 변경 시 실시간 (2초 디바운스) |

각 노드 유형별 구체적인 요약 포맷은 해당 노드 스펙 문서의 "캔버스 요약" 항목에 정의된다.

#### 1.4.1 템플릿 문법 (filter DSL)

`summaryTemplate` 은 config 경로 보간과 파이프 필터를 지원한다. 문법: `{{ path | filter:arg | filter2 }}`. **경로는 config-relative** 다 — `config` 자체가 해석 루트이므로 `{{ mode }}` 로 쓰며 `{{ config.mode }}` 로 쓰지 않는다 (후자는 undefined → 빈 문자열 렌더). 해석 단일 출처는 `codebase/packages/node-summary/src/evaluator.ts` (`renderSummaryTemplate`).

| filter | 효과 | 예시 |
|--------|------|------|
| `upper` | 대문자 변환 | `{{ method &#124; upper }}` |
| `lower` | 소문자 변환 | `{{ method &#124; lower }}` |
| `default:LIT` | 값이 비어 있으면 리터럴 문자열 출력 | `{{ mode &#124; default:sync }}` |
| `fallback:path` | 값이 비어 있으면 다른 config 경로의 값으로 대체 | `{{ workflowName &#124; fallback:workflowId }}` |

표 셀 예시의 `&#124;` 는 Markdown 표 구분자 충돌 방지를 위한 파이프 HTML entity 이다. `default:` 는 리터럴 문자열을, `fallback:` 은 다른 config 경로를 인수로 받는다. 필터는 좌→우로 연쇄 적용된다.

길이(문자 수 / 항목 수)는 파이프 필터가 아니라 **경로 세그먼트 `.length`** 로 표현한다 — 배열·문자열 위에서 `{{ to.length }}` 처럼 쓰면 길이 숫자를 반환한다 (예: `{{ to.length }} recipients · {{ subject }}`). 표기는 [캔버스 §5.3](../3-workflow-editor/0-canvas.md#53-노드-설정-요약-configuration-summary) 의 노드별 요약 포맷 표와 정렬된다.

---

## 2. 노드 전체 목록

### 2.0 Trigger 노드 (1종)

| type | 표시 이름 | 아이콘 | 입력 | 출력 | 키 설정 |
|------|-----------|--------|------|------|---------|
| `manual_trigger` | Manual Trigger | ⚡ | 0 | 1 (out) | 없음 (패스스루) |

> 상세: [Trigger 노드](./7-trigger/0-common.md)

### 2.1 Logic 노드 (12종)

| type | 표시 이름 | 아이콘 | 입력 | 출력 | 키 설정 |
|------|-----------|--------|------|------|---------|
| `if_else` | If/Else | 🔀 | 1 | 2 (true/false) | 조건식 |
| `switch` | Switch | 🔀 | 1 | N+1 (cases+default) | 케이스 목록 |
| `loop` | Loop | 🔄 **컨테이너** | 1+`emit` | 2 (body/done) | 반복 횟수, break 조건 |
| `variable_declaration` | Variable | 📝 | 1 | 1 | 변수명, 타입, 초기값 |
| `variable_modification` | Set Variable | ✏️ | 1 | 1 | 대상 변수, 새 값 |
| `split` | Split | ✂️ | 1 | 1 | 분리 대상 필드 |
| `map` | Map | 🗺️ **컨테이너** | 1+`emit` | 2 (body/done) | 변환 대상 배열, 에러 정책 |
| `filter` | Filter | 🔽 | 1 | 2 (match/unmatched) | 대상 배열, 필터 조건 |
| `foreach` | ForEach | 🔁 **컨테이너** | 1+`emit` | 2 (body/done) | 대상 배열, 에러 정책 |
| `parallel` | Parallel | ⚡ | 1 | N | 분기 수 |
| `merge` | Merge | 🔗 | N | 1 | 병합 전략 |
| `background` | Background | 🌙 **컨테이너** | 1 | 2 (main/bg) | 알림 설정 |

### 2.2 Flow 노드 (1종)

| type | 표시 이름 | 아이콘 | 입력 | 출력 | 키 설정 |
|------|-----------|--------|------|------|---------|
| `workflow` | Workflow | 📂 | 1 | 1 | 대상 워크플로우, 파라미터, 동기/비동기 |

### 2.3 AI 노드 (3종)

| type | 표시 이름 | 아이콘 | 입력 | 출력 | 키 설정 |
|------|-----------|--------|------|------|---------|
| `ai_agent` | AI Agent | 🤖 | 1 | 1 | 프롬프트, 모델, KB, 도구 |
| `text_classifier` | Text Classifier | 🏷️ | 1 | N | 카테고리 목록, 모델 |
| `information_extractor` | Info Extractor | 🔍 | 1 | 1 | 출력 스키마, 모델 |

### 2.4 Integration 노드 (5종)

| type | 표시 이름 | 아이콘 | 입력 | 출력 | 키 설정 |
|------|-----------|--------|------|------|---------|
| `http_request` | HTTP Request | 🌐 | 1 | 2 (success/error) | method, url, headers, body, responseType |
| `database_query` | Database Query | 🗄️ | 1 | 1 | integrationId, query, parameters, queryType |
| `send_email` | Send Email | 📧 | 1 | 1 | integrationId, to, subject, body, bodyType |
| `cafe24` | Cafe24 | 🛍️ | 1 | 2 (success/error) | integrationId, resource, operation, parameters |
| `makeshop` | MakeShop | 🛒 | 1 | 2 (success/error) | integrationId, resource, operation, fields ([§5-makeshop.md](./4-integration/5-makeshop.md)) |

### 2.5 Data 노드 (2종)

| type | 표시 이름 | 아이콘 | 입력 | 출력 | 키 설정 |
|------|-----------|--------|------|------|---------|
| `transform` | Transform | 🔄 | 1 | 1 | operations (변환 체인) |
| `code` | Code | 💻 | 1 | 2 | language, code |

### 2.6 Presentation 노드 (5종)

| type | 표시 이름 | 아이콘 | 입력 | 출력 | 키 설정 |
|------|-----------|--------|------|------|---------|
| `carousel` | Carousel | 🎠 | 1 | 1 (out) 또는 N (동적 버튼 포트) | titleField, descriptionField, imageField, layout, buttons |
| `table` | Table | 📋 | 1 | 1 (out) 또는 N (동적 버튼 포트) | columns, pagination, pageSize, sortBy, buttons |
| `chart` | Chart | 📊 | 1 | 1 (out) 또는 N (동적 버튼 포트) | chartType, dataField, xAxis, yAxis, groupBy, buttons |
| `form` | Form | 📝 | 1 | 1 | fields, title, submitLabel |
| `template` | Template | 📄 | 1 | 1 (out) 또는 N (동적 버튼 포트) | template, outputFormat, helpers, buttons |

---

## 3. 카테고리 시각 구분

| 카테고리 | 색상 | 용도 |
|----------|------|------|
| Trigger | `#F59E0B` (앰버) | 워크플로우 시작점 |
| Logic | `#3B82F6` (파랑) | 데이터 흐름 제어, 변수 관리 |
| Flow | `#8B5CF6` (보라) | 워크플로우 간 연결 |
| AI | `#10B981` (초록) | AI/LLM 기반 처리 |
| Integration | `#F97316` (주황) | 외부 서비스 연동 |
| Data | `#06B6D4` (시안) | 데이터 변환, 코드 실행 |
| Presentation | `#EC4899` (핑크) | 시각적 콘텐츠 생성, 사용자 입력 |

> 구현된 `NodeCategory` enum 은 위 7개(`trigger`/`logic`/`flow`/`ai`/`integration`/`data`/`presentation`)뿐이며, 동일 메타데이터(label·color·icon·order)는 `nodes/core/categories.ts` 의 `NODE_CATEGORIES` 가 단일 소스로 보유한다. 아래 §4 의 `custom` (마켓플레이스 설치 노드) 카테고리는 **미구현 (Planned)** — enum 에 존재하지 않는다.

---

## 4. 노드 플러그인 인터페이스 (미구현 / Planned)

> **구현 상태**: 본 절(마켓플레이스 플러그인 패키지·`manifest.json`·동적 노드 로딩)은 **아직 구현되지 않은 계획**이다. 현재 노드는 전부 빌트인이며 `nodes/index.ts` 의 `ALL_NODE_COMPONENTS` 정적 배열로 부팅 시 부트스트랩된다 — 런타임 플러그인/마켓플레이스 로딩 경로는 존재하지 않는다. 단, 빌트인·향후 플러그인 노드가 공유하는 §4.3 실행 인터페이스(핸들러 계약)는 이미 빌트인에 적용된 현행 계약이다.

마켓플레이스를 통한 커스텀 노드 개발을 위한 표준 인터페이스(계획).

### 4.1 플러그인 패키지 구조

```
my-custom-node/
├── manifest.json       # 노드 메타데이터
├── config-schema.json  # 설정 폼 JSON Schema
├── icon.svg            # 노드 아이콘
├── executor.js         # 실행 로직 (서버사이드)
└── settings-ui.js      # 커스텀 설정 UI (선택)
```

### 4.2 manifest.json

```json
{
  "type": "my_custom_node",
  "category": "custom",
  "displayName": "My Custom Node",
  "description": "Does something custom",
  "version": "1.0.0",
  "author": "developer@example.com",
  "inputPorts": [{ "id": "in", "label": "Input" }],
  "outputPorts": [{ "id": "out", "label": "Output" }],
  "dependencies": []
}
```

### 4.3 실행 인터페이스

빌트인 노드와 커스텀 플러그인 노드 모두 동일한 핸들러 인터페이스를 사용한다. 상세 계약(validate → execute → 출력 정규화 라이프사이클, 레지스트리 패턴, 리트라이 정책)은 [실행 엔진 §5. 노드 핸들러 계약](../5-system/4-execution-engine.md#5-노드-핸들러-계약)을 참조한다.

```
execute(input: JSON, config: JSON, context: ExecutionContext) → JSON
```

| 파라미터 | 설명 |
|----------|------|
| input | 이전 노드로부터 받은 입력 데이터 |
| config | 노드 설정 패널에서 지정한 설정 값 (**expression 평가 후**) |
| context | 실행 컨텍스트 (변수, 실행 ID, Integration 접근, **`rawConfig` (원본 config — `NodeHandlerOutput.config` echo 용)** 등). 상세는 [실행 엔진 §6.1](../5-system/4-execution-engine.md#61-컨텍스트-구조) |
| 반환값 | 다음 노드로 전달할 출력 데이터 |

---

## 5. 노드 실행 샌드박싱

본 절의 샌드박싱은 **현재 `code` 노드(임의 JS 실행)에만 적용**된다 — 일반 노드는 in-process 핸들러로 실행되며 별도 메모리/FS 격리를 두지 않는다.

| 항목 | 설명 | 구현 상태 |
|------|------|-----------|
| 실행 격리 | `code` 노드는 `node:vm` 컨텍스트에서 격리 실행하며 제한된 글로벌(`JSON`/`Math`/`Date` 등)만 노출하고 `Reflect`/`Proxy`/`globalThis`/`SharedArrayBuffer`/`Atomics` 등은 차단한다 (`nodes/data/code/code.handler.ts` `buildSandbox`) | 구현됨 (code 노드) |
| 타임아웃 | `code` 노드 실행 시간 제한 (기본 30초, config 로 설정 가능). sub-workflow 호출은 별도로 기본 300초 타임아웃 (`execution-engine.service.ts`) | 구현됨 (code 노드 / sub-workflow) |
| 네트워크 접근 | `code` 노드 sandbox 에는 `fetch`/`http` 등 네트워크 API 를 노출하지 않는다. 외부 호출은 Integration 노드를 통해서만 가능 | 구현됨 (code 노드) |
| 메모리 제한 | 노드별 메모리 사용량 제한 | **미구현 (Planned)** |
| 파일 시스템 | 읽기 전용 (임시 디렉토리만 쓰기 가능) — `code` sandbox 는 `fs`/`require` 미노출이나 명시적 FS 정책은 없음 | **미구현 (Planned)** |
