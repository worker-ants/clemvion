## 발견사항

### [WARNING] `config.fields` — cafe24 노드와 form 노드 동일 속성명, 다른 스키마

- **target 신규 식별자**: `cafe24NodeConfig.fields: Record<string, unknown>` — Cafe24 API 호출 파라미터 키-값 맵
- **기존 사용처**: `form` 노드 `config.fields: FormField[]` — 폼 렌더링용 필드 정의 배열 (`spec/3-workflow-editor/1-node-common.md` 참조, form 노드 설정)
- **상세**: 두 노드 모두 `config.fields`를 사용하지만 타입(Record vs. FormField[])과 의미(API 파라미터 vs. 폼 필드 정의)가 근본적으로 다름. 워크플로 표현식에서 `$node["X"].config.fields`를 참조할 때 노드 타입을 반드시 구분해야 하며, 설정 패널·자동완성 구현 시 타입 가드 없이 진행하면 오작동 가능
- **제안**: 서로 다른 node type의 config이므로 runtime 충돌은 없음. 단, frontend 설정 패널 구현 시 `nodeType === 'cafe24'`와 `nodeType === 'form'` 분기를 명시적으로 두고, 타입스크립트 인터페이스도 각각 독립 선언할 것

---

### [WARNING] `resource = 'application'` 열거값 — 프로젝트 내 "application" 개념과 의미 혼동 가능

- **target 신규 식별자**: `cafe24NodeConfig.resource` 열거값 `'application'` ("Cafe24 앱 관리 API")
- **기존 사용처**: 프로젝트 아키텍처 전반에서 "Application" = 이 웹 애플리케이션 자체. `spec/0-overview.md` 시스템 구성도, NestJS 앱 엔트리포인트 등
- **상세**: `application` 값은 "Cafe24 앱 관리 API (앱스토어 등록 등)"를 의미하지만, 맥락 없이 코드를 보는 개발자가 프로젝트의 애플리케이션 자체로 오해할 여지 있음. `spec/4-nodes/4-integration/4-cafe24.md §1`과 `spec/conventions/cafe24-api-metadata.md §1`에 이미 ⚠ 주석으로 경고가 삽입되어 있음
- **제안**: spec 주석으로 이미 처리됨. 구현 시 `application.ts` 메타데이터 파일 최상단에 동일 경고 JSDoc 주석 복사하여 IDE 레벨에서도 가시화할 것

---

### [INFO] `scopeType` — `Node.category`와의 명명 충돌 이미 선제 회피

- **target 신규 식별자**: `Cafe24OperationMetadata.scopeType: 'read' | 'write'`
- **기존 사용처**: `Node.category: Enum` (logic/flow/ai/integration/data/presentation) — `spec/1-data-model.md §2.6`
- **상세**: `category`로 명명했다면 Node.category와 의미 충돌. `scopeType`으로 이미 회피됨. `cafe24-api-metadata.md §2` 인터페이스 주석에 "Node.category 와의 명명 충돌 회피" 사유 명기됨
- **제안**: 현행 명명 유지

---

### [INFO] `operation` config 속성 — 범용 용어 선점

- **target 신규 식별자**: `cafe24NodeConfig.operation: string` — Cafe24 API endpoint 식별자
- **기존 사용처**: 기존 어떤 노드의 `config` 속성에도 `operation`이 사용되지 않음. MCP/REST/DB 맥락에서 범용 용어이나 노드 config 레벨에서는 새로운 도입
- **상세**: 충돌 없음. 미래 다른 integration 노드가 `config.operation`을 다른 의미로 쓸 경우의 선점 이슈 가능성
- **제안**: 현행 명명 유지

---

## 요약

cafe24 spec의 신규 식별자는 전반적으로 기존 코드베이스와 충돌이 없거나, 충돌 가능성이 있는 경우(`application` 열거값, `scopeType`)에는 이미 spec 내 경고 주석과 명명 근거가 포함되어 있다. 가장 주의할 지점은 `config.fields`의 다중 사용으로, node type 간 격리가 보장되어야 하며 frontend 자동완성·타입 가드 구현 시 반드시 분기 처리가 필요하다. 에러 코드(`CAFE24_*`), meta 필드(`callUsage`, `callRemain`, `callLimit`), 클래스명(`Cafe24McpBridge`, `Cafe24ApiClient`) 모두 충돌 없음.

## 위험도

**LOW**