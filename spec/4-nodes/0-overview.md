# Spec: 노드 시스템 설계 개요

> 관련 문서: [PRD 노드 시스템](../../prd/3-node-system.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md) · [Logic 노드](./1-logic-nodes.md) · [Flow 노드](./2-flow-nodes.md) · [AI 노드](./3-ai-nodes.md) · [Integration 노드](./4-integration-nodes.md) · [Data 노드](./5-data-nodes.md)

---

## 1. 노드 아키텍처

### 1.1 노드 추상 구조

모든 노드는 다음의 공통 인터페이스를 따른다:

```
┌─────────────────────────────────────────┐
│              Node Instance              │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │         Node Definition         │    │
│  │  - type: string                 │    │
│  │  - category: logic|flow|ai|integration|data │
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
| category | Enum | `logic` / `flow` / `ai` / `integration` / `data` |
| displayName | String | UI 표시 이름 |
| description | String | 노드 설명 |
| icon | String | 아이콘 식별자 |
| color | String | 카테고리 컬러 코드 |
| inputPorts | PortDef[] | 입력 포트 정의 |
| outputPorts | PortDef[] | 출력 포트 정의 (동적 여부 포함) |
| configSchema | JSONSchema | 설정 폼 스키마 |
| defaultConfig | Object | 설정 기본값 |

### 1.3 포트 정의 (PortDef)

| 속성 | 타입 | 설명 |
|------|------|------|
| id | String | 포트 식별자 (예: `in`, `true`, `case_0`) |
| label | String | UI 표시 이름 |
| type | Enum | `data` / `control` / `error` |
| dynamic | Boolean | 동적 추가/제거 가능 여부 |
| required | Boolean | 연결 필수 여부 |

---

## 2. 노드 전체 목록

### 2.1 Logic 노드 (11종)

| type | 표시 이름 | 아이콘 | 입력 | 출력 | 키 설정 |
|------|-----------|--------|------|------|---------|
| `if_else` | If/Else | 🔀 | 1 | 2 (true/false) | 조건식 |
| `switch` | Switch | 🔀 | 1 | N+1 (cases+default) | 케이스 목록 |
| `loop` | Loop | 🔄 **컨테이너** | 1 | 2 (body/done) | 반복 횟수, break 조건 |
| `variable_declaration` | Variable | 📝 | 1 | 1 | 변수명, 타입, 초기값 |
| `variable_modification` | Set Variable | ✏️ | 1 | 1 | 대상 변수, 새 값 |
| `split` | Split | ✂️ | 1 | 1 | 분리 대상 필드 |
| `map` | Map | 🗺️ | 1 | 1 | 변환 표현식 |
| `foreach` | ForEach | 🔁 **컨테이너** | 1 | 2 (body/done) | 대상 배열, 에러 정책 |
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

### 2.4 Integration 노드 (7종)

| type | 표시 이름 | 아이콘 | 입력 | 출력 | 키 설정 |
|------|-----------|--------|------|------|---------|
| `http_request` | HTTP Request | 🌐 | 1 | 2 (success/error) | method, url, headers, body, responseType |
| `database_query` | Database Query | 🗄️ | 1 | 1 | integrationId, query, parameters, queryType |
| `slack` | Slack | 💬 | 1 | 1 | integrationId, action, actionConfig |
| `google_sheets` | Google Sheets | 📊 | 1 | 1 | integrationId, action, spreadsheetId, range |
| `github` | GitHub | 🐙 | 1 | 1 | integrationId, action, owner, repo, actionConfig |
| `send_email` | Send Email | 📧 | 1 | 1 | integrationId, to, subject, body, bodyType |
| `google_drive` | Google Drive | 📁 | 1 | 1 | integrationId, action, folderId, fileId |

### 2.5 Data 노드 (2종)

| type | 표시 이름 | 아이콘 | 입력 | 출력 | 키 설정 |
|------|-----------|--------|------|------|---------|
| `transform` | Transform | 🔄 | 1 | 1 | operations (변환 체인) |
| `code` | Code | 💻 | 1 | 1 | language, code |

---

## 3. 카테고리 시각 구분

| 카테고리 | 색상 | 용도 |
|----------|------|------|
| Logic | `#3B82F6` (파랑) | 데이터 흐름 제어, 변수 관리 |
| Flow | `#8B5CF6` (보라) | 워크플로우 간 연결 |
| AI | `#10B981` (초록) | AI/LLM 기반 처리 |
| Integration | `#F97316` (주황) | 외부 서비스 연동 |
| Data | `#06B6D4` (시안) | 데이터 변환, 코드 실행 |
| Custom (마켓) | `#F59E0B` (앰버) | 마켓플레이스 설치 노드 |

---

## 4. 노드 플러그인 인터페이스

마켓플레이스를 통한 커스텀 노드 개발을 위한 표준 인터페이스.

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

```
execute(input: JSON, config: JSON, context: ExecutionContext) → JSON
```

| 파라미터 | 설명 |
|----------|------|
| input | 이전 노드로부터 받은 입력 데이터 |
| config | 노드 설정 패널에서 지정한 설정 값 |
| context | 실행 컨텍스트 (변수, 실행 ID, Integration 접근 등) |
| 반환값 | 다음 노드로 전달할 출력 데이터 |

---

## 5. 노드 실행 샌드박싱

| 항목 | 설명 |
|------|------|
| 실행 격리 | 각 노드는 독립된 실행 컨텍스트에서 수행 |
| 타임아웃 | 노드별 실행 시간 제한 (기본: 30초, 설정 가능) |
| 메모리 제한 | 노드별 메모리 사용량 제한 |
| 네트워크 접근 | Integration을 통해서만 외부 접근 (커스텀 노드 제한) |
| 파일 시스템 | 읽기 전용 (임시 디렉토리만 쓰기 가능) |
