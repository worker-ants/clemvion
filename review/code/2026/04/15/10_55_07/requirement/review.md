## 발견사항

### [WARNING] Integration 노드 3종 누락 (spec §2.4 정의 vs 구현 불일치)
- **위치**: `backend/src/nodes/index.ts` → `ALL_NODE_COMPONENTS`
- **상세**: spec §2.4는 Integration 노드를 7종 정의(`http_request`, `database_query`, `slack`, `google_sheets`, `github`, `send_email`, `google_drive`)하나, `ALL_NODE_COMPONENTS`에는 4종만 포함. `google_sheets`, `github`, `google_drive` 컴포넌트가 누락됨.
- **제안**: 미구현 상태면 spec에 `🚧 미구현` 주석 추가(background 노드처럼), 혹은 스텁 컴포넌트 등록 필요.

---

### [WARNING] 모든 configSchema가 플레이스홀더 (`z.object({}).passthrough()`)
- **위치**: 전체 `*.schema.ts` 파일
- **상세**: spec §1.0은 "Zod 스키마는 런타임 검증과 JSON Schema 직렬화의 단일 소스"라 명시하고, `GET /api/v1/nodes/definitions`가 "프론트엔드가 팔레트/설정 폼을 생성"하는 데 쓰인다고 정의함. 그러나 모든 노드의 `configSchema`가 `z.object({}).passthrough()`로, `listDefinitions()` 반환 JSON Schema는 빈 객체에 가까워 실질적인 폼 생성 불가능. 유효성 검증도 항상 통과됨.
- **제안**: 각 노드의 실제 설정 필드(`model`, `prompt`, `conditions`, `url`, `method` 등)를 반영한 구체적인 Zod 스키마 작성 필요.

---

### [WARNING] `text_classifier` 출력 포트가 빈 배열
- **위치**: `backend/src/nodes/ai/text-classifier/text-classifier.schema.ts`
- **상세**: spec §2.3은 `text_classifier`가 "N outputs (카테고리 목록 기반)"을 가진다고 정의하나, `textClassifierNodePorts.outputs = []`로 포트가 없음. 실행 엔진이 출력 포트로 라우팅할 수 없게 됨.
- **제안**: 동적 포트(`dynamic: true`) 또는 최소 기본 출력 포트 정의 필요.

---

### [WARNING] `summaryTemplate` 필드가 `NodeComponentMetadata`에 없음
- **위치**: `backend/src/nodes/core/node-component.interface.ts`, `NodeComponentMetadata`
- **상세**: spec §1.2 Node Definition 속성 테이블에 `summaryTemplate: String`이 명시되어 있으나 인터페이스에 해당 필드가 정의되지 않음. 캔버스 설정 요약 기능(§1.4)을 위한 계약이 누락됨.
- **제안**: `NodeComponentMetadata`에 `summaryTemplate?: string` 추가.

---

### [WARNING] `validateWithZod` 유틸이 사용되지 않음
- **위치**: `backend/src/nodes/core/zod-validator.ts`
- **상세**: `validateWithZod`가 구현되어 있으나 어느 컴포넌트에서도 `NodeHandler.validate()`와 연결되지 않음. spec §4.3의 "validate → execute → 출력 정규화 라이프사이클"이 실현되지 않음.
- **제안**: 각 `NodeComponent`의 `createHandler` 팩토리에서 핸들러의 `validate` 메서드를 `validateWithZod(configSchema)`로 바인딩하거나, `NodeComponent`가 `validate` 함수를 포함하도록 인터페이스 확장 필요.

---

### [INFO] `bootstrap()` 이전에 `listDefinitions()` 호출 시 빈 배열 반환
- **위치**: `backend/src/nodes/core/node-component.registry.ts`
- **상세**: `bootstrap()`은 `ExecutionEngineService.onModuleInit()`에서 호출되므로, 모듈 초기화 타이밍에 따라 `GET /nodes/definitions`가 빈 배열을 반환할 수 있음. 운영 환경보다 테스트나 헬스체크에서 문제가 될 수 있음.
- **제안**: `listDefinitions()` 호출 시 `bootstrap()`이 완료되지 않았으면 경고 로그 출력, 또는 초기화 완료 여부를 나타내는 플래그 추가.

---

### [INFO] `parallel` 노드 누락 (spec §2.1)
- **위치**: `backend/src/nodes/index.ts`
- **상세**: spec §2.1 Logic 노드 12종 중 `parallel`이 `ALL_NODE_COMPONENTS`에 포함되지 않음. `background`처럼 미구현 표시가 spec에도 없음.
- **제안**: spec §2.1의 `parallel` 행에 `🚧 미구현` 주석 추가하여 의도적 누락임을 명시.

---

## 요약

이번 변경은 기존의 수동 핸들러 등록 방식을 `NodeComponentRegistry` 기반 컴포넌트 아키텍처로 전환하는 구조적으로 타당한 리팩터링이다. 그러나 요구사항 충족 관점에서 주요 미비점이 있다: Integration 노드 3종(`google_sheets`, `github`, `google_drive`)이 `ALL_NODE_COMPONENTS`에서 누락되어 있고, 모든 `configSchema`가 빈 passthrough 플레이스홀더여서 spec이 명시한 "프론트엔드 폼 자동 생성" 기능이 실질적으로 동작하지 않는다. `text_classifier`의 출력 포트가 빈 배열인 점도 실행 흐름을 단절시킨다. `summaryTemplate` 필드 누락과 `validateWithZod` 미연결은 spec과 구현 간 계약 불일치를 나타낸다.

## 위험도

**MEDIUM**