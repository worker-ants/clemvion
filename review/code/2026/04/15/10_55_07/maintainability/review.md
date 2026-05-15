## 유지보수성 코드 리뷰

### 발견사항

---

**[INFO]** 노드 컴포넌트 아키텍처 도입 — 등록 로직 중앙화
- **위치**: `execution-engine.service.ts`, `nodes/core/node-component.registry.ts`
- **상세**: 기존 `registerHandlers()`에 하드코딩된 핸들러 배열을 `NodeComponentRegistry.bootstrap()`으로 교체하여 핸들러 추가 시 `ALL_NODE_COMPONENTS` 배열 한 곳만 수정하면 되는 구조로 개선됨. 유지보수성 관점에서 긍정적 변화.
- **제안**: 유지

---

**[WARNING]** 순환 의존성 해소를 위한 `forwardRef` 사용 — 설계 냄새
- **위치**: `nodes.module.ts:9`, `execution-engine.module.ts`
- **상세**: `NodesModule` → `ExecutionEngineModule` → `NodeComponentRegistry`, 그리고 `NodesController`가 `NodeComponentRegistry`를 직접 주입받기 위해 `forwardRef` 순환이 발생. 이는 모듈 경계 설계가 적절하지 않음을 시사함. `GET /nodes/definitions`는 실행 엔진과 무관한 메타데이터 조회이므로 `NodeComponentRegistry`를 독립 모듈(`NodeComponentsModule` 등)로 분리하는 것이 바람직.
- **제안**: `NodeComponentRegistry`를 별도 모듈로 분리하고 `ExecutionEngineModule`과 `NodesModule` 양쪽에서 import하면 순환 참조 없이 해결 가능.

---

**[WARNING]** 모든 스키마가 `z.object({}).passthrough()` — 스키마 미구현 상태
- **위치**: 모든 `*.schema.ts` 파일 (ai-agent, text-classifier, information-extractor, code, transform, workflow, http-request, slack, send-email, database-query, filter 등)
- **상세**: `configSchema`가 전부 `z.object({}).passthrough()`로 선언되어 있어 런타임 검증이 사실상 비활성화된 상태. `listDefinitions()`로 반환되는 JSON Schema도 의미 있는 내용을 포함하지 않아 프론트엔드가 실제 폼 생성에 활용 불가. 이 상태로 `GET /api/v1/nodes/definitions`를 노출하면 클라이언트 측에서 혼란이 생길 수 있음.
- **제안**: 스키마가 아직 미구현임을 명확히 할 것. API 응답에 `"schemaStatus": "pending"` 같은 필드를 추가하거나, 완성될 때까지 엔드포인트를 내부용으로 표시.

---

**[WARNING]** `NodeComponentMetadata.category` 타입 중복 선언
- **위치**: `node-component.interface.ts:37-46`
- **상세**: `category` 타입이 `NodeCategory | 'trigger' | 'logic' | 'flow' | 'ai' | 'integration' | 'data' | 'presentation'` 형태로 선언되어 있음. `NodeCategory` 엔티티 enum이 이미 동일 값들을 포함한다면 중복이며, 두 정의가 분리되어 있으면 나중에 한쪽만 수정될 위험이 있음.
- **제안**: `NodeCategory` enum을 단일 소스로 사용하거나, `NodeComponentMetadata`의 category를 `NodeCategory`로만 타입 지정.

---

**[INFO]** `NodeComponentRegistry.bootstrap()`은 `OnModuleInit`이 아닌 서비스 메서드로 호출됨
- **위치**: `execution-engine.service.ts:148-155` (`registerHandlers` → `this.componentRegistry.bootstrap(...)`)
- **상세**: `bootstrap()`이 두 번 호출되면 `Duplicate node component registration` 예외가 발생하는 방어 코드는 있으나, 호출 책임이 `ExecutionEngineService.onModuleInit()`에 묻혀 있어 Registry의 생명주기가 불분명함. 테스트에서 `bootstrap()`을 빠뜨리면 `handlerRegistry`가 비어있는 채로 동작함.
- **제안**: `NodeComponentRegistry` 자체를 `OnModuleInit`으로 만들고 `ALL_NODE_COMPONENTS`와 `deps`를 모듈에서 provide받아 자체 초기화하거나, `bootstrap` 미호출 시 조기 실패하는 guard를 `getComponent()`/`listDefinitions()`에 추가.

---

**[INFO]** 테스트(`execution-engine.service.spec.ts`)에 `NodeComponentRegistry` mock 없이 실 클래스 사용
- **위치**: `execution-engine.service.spec.ts:188`
- **상세**: `NodeComponentRegistry`가 providers에 실 클래스로 추가됨. spec에서 `bootstrap()`이 호출되지 않으면 내부 `components` map이 비어 있고, 호출되면 실제 핸들러가 생성되어 단위 테스트의 격리성이 약해짐.
- **제안**: spec에서 `NodeComponentRegistry`를 mock(`{ bootstrap: jest.fn(), listDefinitions: jest.fn(), ... }`)으로 교체.

---

**[INFO]** `package-lock.json`의 `"peer": true` 플래그 대량 제거
- **위치**: `package-lock.json` 전반
- **상세**: 자동 생성 파일이므로 직접적 유지보수 이슈는 없으나, `npm install` 재실행 시 동일 결과가 재현되는지 확인 필요. `zod ^4.3.6` 추가와 함께 의존성 트리가 재계산된 정상적인 변화로 보임.

---

### 요약

이번 변경은 노드 핸들러 등록 로직을 컴포넌트 기반 아키텍처로 전환한 의미 있는 리팩터링이다. `NodeComponentRegistry`를 도입해 새 노드 추가 시 단일 파일(`ALL_NODE_COMPONENTS`)만 수정하면 되는 구조는 유지보수성을 크게 개선한다. 다만 `NodesModule`과 `ExecutionEngineModule` 간의 `forwardRef` 순환 참조는 모듈 경계 재설계가 필요한 설계 냄새이며, 모든 configSchema가 `passthrough()` 스텁 상태여서 `listDefinitions()` API가 실질적인 가치를 제공하지 못하는 상태다. Registry의 초기화 책임과 테스트 격리 문제도 이후 신뢰성 있는 테스트 작성을 위해 개선이 필요하다.

### 위험도

**LOW**