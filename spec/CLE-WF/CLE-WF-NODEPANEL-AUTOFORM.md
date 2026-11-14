---
id: "CLE-WF-NODEPANEL-AUTOFORM"
title: "노드 포트와 설정 패널 — auto-form"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-NODEPANEL"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-NODEPANEL"]
area: "CLE-WF"
content_hash: "131590a9d4d798f667cf4d6676b865409c5a46b2b6f9a32b3e8b147e366a4c57"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "72c0d473d4eee132f513511011cb647103397bbebcc176f1ccffb53f0cd4bdbb"
etag: "sha256-5a19f6b7d9818916df36f234d21a26ef232ec60ddea7d1ec0a50c8bb56fe6990"
---
## 개요

이 문서는 [노드 포트와 설정 패널](CLE-WF-NODEPANEL.md) 의 하위 문서로 설정 패널 Settings 탭의 노드별 설정 폼을 그리는 방식을 정한다. 수작업 폼과 스키마 기반 auto-form(`SchemaForm`, `UiHint`) 두 트랙, UiHint 어휘, 위젯 어휘, 트랙 배정 현황을 다룬다. 패널 구성 · 공통 필드 · 에러 처리 정책 설정은 부모 문서가 정한다.

## 두 트랙

Settings 탭의 노드별 설정 폼은 두 트랙으로 그린다(`node-configs/index.tsx` 의 `NodeConfigRenderer`).

1. **수작업 폼 트랙**: `node-configs/override-registry.ts` 의 `OVERRIDE_REGISTRY` 에 등록한 노드는 직접 만든 폼 컴포넌트(`node-configs/*-configs.tsx`)로 그린다.
2. **auto-form 트랙(기본 경로)**: 등록하지 않은 노드는 백엔드 zod 스키마의 `.meta({ ui: UiHint })` 힌트를 읽어 `SchemaForm`(`auto-form/schema-form.tsx`)이 폼을 자동으로 만든다. 스키마는 `GET /api/nodes/definitions` 로 불러온다([노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 의 메타데이터 API).

이 문서 본문(두 트랙 배정 · `visibleWhen` · `clearFields` 예약 키 · 수작업 폼 강제 위젯)에 대응하는 요구사항은 부모 문서의 [요구사항](CLE-WF-NODEPANEL.md#요구사항) 과 [하위 문서](CLE-WF-NODEPANEL.md#하위-문서) 절에 있다.

노드를 수작업 폼에서 auto-form 으로 옮기려면 레지스트리에서 항목을 빼고 백엔드 스키마에 충분한 `ui` 힌트를 더한다.

## UiHint 어휘

기준은 백엔드 `nodes/core/node-component.interface.ts` 의 `UiHint` 다.

| 키 | 뜻 |
| --- | --- |
| `widget` | 그릴 위젯 id([위젯 어휘](#위젯-어휘)) |
| `label` / `placeholder` / `hint` | 라벨, 플레이스홀더, 항상 보이는 캡션. `hint` 는 필드 도움말과 함께 쓸 수 있다. |
| `order` | 폼 안 정렬 순서. 작을수록 먼저 나온다. |
| `hidden` | auto-form 에서 숨긴다. 스키마 검증은 그대로 한다. |
| `visibleWhen` | 조건부 표시. `{ field, equals }`, `{ field, notEquals }`, `{ field, oneOf }` 세 형태다. `equals` 는 단일 값 엄격 비교 전용이고 배열 허용 목록은 `oneOf` 를 쓴다. |
| `required` / `requiredWhen` | UI 필수 표시(별표). `requiredWhen` 은 `{ field, equals }` 한 형태이고 `equals` 는 단일 값(`===`)이나 배열(허용 목록)이다. 실행 시 강제는 `NodeHandler.validate()` 가 맡는다. |
| `clearFields` | 이 필드 값이 바뀌면 함께 비울 설정 키 목록(모드 전환 등). 예약 키(`__proto__` 등)는 prototype pollution 을 막으려고 비우지 못한다. |
| `group` / `collapsible` | 섹션 묶음과 접기 토글 여부 |
| `options` / `language` / `multiline` / `rows` / `itemLabel` / `itemDefault` | 위젯별 보조 옵션 |

## 위젯 어휘

위젯 id 와 컴포넌트의 대응은 프론트엔드 `auto-form/widget-registry.ts` 가 기준이다. 모두 21종이다.

| 분류 | widget id |
| --- | --- |
| 기본 입력(10) | `text`, `textarea`, `number`, `select`, `multiselect`, `checkbox`, `expression`(표현식 에디터), `kv`, `kv-expression`, `code` |
| 공용 선택기(4) | `llm-config-selector`, `kb-selector`, `mcp-server-selector`, `workflow-selector`(`auto-form/selector-widgets.tsx`). AI 어시스턴트가 후보를 조회하는 계약은 [AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md) 가 정한다. |
| 모델 설정 선택기(2) | `chat-config-selector`, `embedding-config-selector`. `/models` 에 등록한 Chat·Embedding 모델 설정(ModelConfig)을 고른다. 저장 형태는 `config.id` 로 `llm-config-selector` 와 같다. 후보는 워크스페이스 모델 설정을 종류별로 조회한다(`modelConfigsApi.list("chat"\|"embedding")`). 노드의 `llmConfigId` 와 **독립**이고, 실행 시 고른 설정의 provider·자격 증명·기본 모델로 바로 해석한다(`auto-form/config-selector-widgets.tsx`). AI 어시스턴트 후보 선택기 대상이 아니다(`UserActionWidget` 에 없다). 모델 설정은 [모델 설정](../CLE-AI/CLE-AI-MODELS.md) 이 정한다. |
| 배열 편집(2) | `field-array`, `button-list` |
| 수작업 폼 강제(3) | `integration-selector`, `condition-builder`, `table-grid`. `UnsupportedWidget` 으로 대응돼 auto-form 만으로는 그릴 수 없다. 이 위젯을 쓰는 노드는 수작업 폼 트랙에 남아야 한다. |

## 트랙 배정 현황

- **auto-form 으로 옮긴 노드**: `split`, `map`, `foreach`, `merge`, `carousel`, `ai_agent`, `text_classifier`, `information_extractor`
- **수작업 폼에 남은 노드**(`OVERRIDE_REGISTRY` 기준): `manual_trigger`, `if_else`, `switch`, `loop`, `variable_declaration`, `variable_modification`, `parallel`, `filter`, `workflow`, `http_request`, `database_query`, `send_email`, `cafe24`, `makeshop`, `transform`, `code`, `table`, `chart`, `form`, `template`. 필드 사이 부수 효과(예: table 의 열·행 동기화)처럼 auto-form 이 표현하지 못하는 요구가 남은 노드들이다.

## 구현 위치

- `codebase/frontend/src/components/editor/settings-panel/node-configs/**` (수작업 폼, `override-registry.ts`)
- `codebase/frontend/src/components/editor/settings-panel/auto-form/**` (`schema-form.tsx`, `widget-registry.ts`, 선택기 위젯)
- `codebase/backend/src/nodes/**/*.schema.ts`

## Rationale

번호는 부모 문서 [노드 포트와 설정 패널](CLE-WF-NODEPANEL.md#rationale) 의 Rationale 번호를 이어 쓴다.

### R-2. 설정 폼은 수작업 폼과 auto-form 두 트랙으로 그린다 (2026-06-10)

auto-form(SchemaForm, UiHint DSL, 위젯 레지스트리, override 레지스트리)은 구현이 먼저였고 여러 명세가 조각조각 인용해 왔다(Switch 의 `requiredWhen`, AI 에이전트 노드의 `visibleWhen`, AI 어시스턴트의 선택기 위젯 등). 이 문서를 시스템 전체의 기준으로 두고 두 트랙 전략, UiHint 어휘, 위젯 21종, 트랙 배정 현황을 한곳에서 관리한다. 노드 명세마다 프론트엔드 설정 UI 경로를 따로 적지 않고 이 문서의 구현 위치 한곳에 모은다. 유지 부담을 줄이려는 결정이다.

### R-3. 텍스트 분류기·정보 추출기 노드를 auto-form 으로 옮겼다 (2026-06-11)

두 AI 노드의 수작업 폼(`ai-configs.tsx`)은 zod 스키마가 드러낸 필드(대화 맥락 5개, 에이전트 메모리 7개, 시스템 맥락 2개, few-shot `examples`, `enumValues`, `maxCollectionRetries`)를 그리지 못해 사용자는 Code 탭 JSON 으로만 설정할 수 있었다. 두 스키마는 이미 이 필드 전부를 auto-form 위젯(`field-array`, `llm-config-selector`, `multiselect`, `expression`, `visibleWhen` 조건 등)으로 표현할 UI 힌트를 내보내고 있었다. 그래서 `ai_agent` 처럼 `OVERRIDE_REGISTRY` 에서 빼 auto-form 으로 옮기고 수작업 컴포넌트는 없앴다. 백엔드 스키마는 바꾸지 않았다. 누락은 수작업 폼이 스키마 힌트를 무시해서 생긴 것이었다.
