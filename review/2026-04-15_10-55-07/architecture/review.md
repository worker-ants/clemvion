### 발견사항

---

**[WARNING] `forwardRef` 사용 — 잠재적 순환 모듈 의존성**
- 위치: `nodes.module.ts`
- 상세: `NodesModule`이 `ExecutionEngineModule`을 `forwardRef`로 임포트하여 `NodeComponentRegistry`를 주입받는다. `ExecutionEngineModule`은 `NodesModule`을 직접 임포트하지 않지만, `ExecutionEngineService`가 `../../nodes`를 정적 TypeScript import로 참조한다. `forwardRef`가 필요한 이유가 명확하지 않으며, 이는 설계상 순환 의존 신호다.
- 제안: `NodeComponentRegistry`를 `ExecutionEngineModule`이 아닌 별도의 `NodeRegistryModule`(또는 `NodesModule` 자체)에 소속시켜 단방향 의존 그래프를 유지할 것.

---

**[WARNING] 레이어 경계 위반 — `nodes/core`가 `modules/`에 하향 의존**
- 위치: `node-component.interface.ts`, `node-component.registry.ts`
- 상세: `src/nodes/core/`는 도메인 코어처럼 구성되어 있으나, `LlmService`, `RagSearchService`, `IntegrationsService`, `WorkflowExecutor`를 직접 import한다. 코어 레이어가 응용 서비스 레이어를 참조하는 것은 의존성 역전 원칙(DIP) 위반이다. 새 서비스 추가 시마다 `HandlerDependencies` 인터페이스를 수정해야 한다.
- 제안: `HandlerDependencies`의 각 필드를 추상 인터페이스(예: `ILlmService`, `IRagSearchService`)로 정의하고 `modules/` 내에서 구현체와 바인딩할 것. 또는 핸들러 팩토리 패턴 대신 NestJS DI를 직접 활용하는 방식을 검토할 것.

---

**[WARNING] `NodeComponentRegistry`의 이중 책임 (SRP 위반)**
- 위치: `node-component.registry.ts`
- 상세: `bootstrap()`(핸들러 등록)과 `listDefinitions()`(프론트엔드 메타데이터 직렬화)은 서로 다른 변경 원인을 갖는다. 현재 하나의 클래스가 실행 엔진 부트스트랩과 API 응답 직렬화를 동시에 담당한다.
- 제안: `listDefinitions()` 관련 로직을 `NodeDefinitionService` 등 별도 서비스로 분리하거나, 최소한 메서드를 명확히 그룹핑할 것.

---

**[WARNING] 모든 configSchema가 `z.object({}).passthrough()` 플레이스홀더**
- 위치: `ai-agent.schema.ts`, `code.schema.ts`, `transform.schema.ts` 외 다수
- 상세: Zod를 도입한 핵심 목적(런타임 검증 + JSON Schema 직렬화)이 현재 구현에서 달성되지 않는다. `passthrough()`는 임의 객체를 통과시키므로 `validate()`, `listDefinitions()`의 실질적 가치가 없다. 프론트엔드가 이 응답으로 폼을 생성하면 빈 스키마만 수신한다.
- 제안: 각 노드별 실제 config 필드를 Zod로 정의할 것. 최소한 `google_sheets`, `github`, `google_drive` 노드처럼 스펙에 키 설정이 명시된 노드부터 적용할 것.

---

**[WARNING] `bootstrap()` 호출이 서비스 메서드에 매립됨**
- 위치: `execution-engine.service.ts:registerHandlers()`
- 상세: `NodeComponentRegistry.bootstrap()`이 `ExecutionEngineService.onModuleInit()` → `registerHandlers()`를 통해 호출된다. 레지스트리의 초기화가 실행 엔진 서비스의 생명주기에 종속되어, 테스트 시 `bootstrap()` 미호출로 인한 런타임 오류 위험이 있다(spec 파일에서 `NodeComponentRegistry`는 mock 없이 실제 인스턴스를 주입함).
- 제안: `NodeComponentRegistry`가 `OnModuleInit`을 직접 구현하고 `ALL_NODE_COMPONENTS`와 의존성을 생성자 주입으로 받아 자체 초기화하는 구조를 고려할 것.

---

**[INFO] OCP 관점에서 컴포넌트 등록 패턴은 우수**
- 위치: `src/nodes/index.ts`
- 상세: 새 노드 추가 시 `ALL_NODE_COMPONENTS` 배열에 항목만 추가하면 되며, 기존 코드를 수정할 필요가 없다. 핸들러 팩토리(`createHandler`) 패턴도 의존성 주입을 명시적으로 관리하는 좋은 접근이다.

---

**[INFO] `src/nodes/` 위치가 NestJS 모듈 관례와 불일치**
- 위치: `backend/src/nodes/`
- 상세: NestJS 프로젝트에서 `src/modules/` 외부에 도메인 로직을 두는 것은 관례에서 벗어난다. 팀원이 새 노드를 추가할 때 올바른 위치를 혼동할 수 있다. 스펙 문서에는 경로가 명확히 기술되어 있으나, 모듈 경계 내 일관성 확보를 고려할 것.

---

### 요약

이번 변경은 노드 컴포넌트 아키텍처를 수동 핸들러 등록 방식에서 선언적 컴포넌트 레지스트리 패턴으로 전환하는 의미 있는 리팩터링으로, OCP 측면에서의 확장성과 코드 응집도는 향상되었다. 그러나 핵심적인 구조 문제가 남아 있다: `src/nodes/core/`가 도메인 코어처럼 위치하면서도 여러 응용 서비스를 직접 의존하는 레이어 역전, `NodesModule`↔`ExecutionEngineModule`의 `forwardRef` 사용으로 드러나는 순환 의존 설계, 그리고 Zod 도입의 핵심 가치인 런타임 검증이 전 노드에서 플레이스홀더(`passthrough()`)로 미완성 상태인 점이 주요 위험 요소다. 전체적으로 방향성은 올바르나 레이어 경계 재정비와 스키마 구체화가 선행되어야 안정적인 아키텍처가 된다.

### 위험도

**MEDIUM**