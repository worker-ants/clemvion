### 발견사항

- **[WARNING]** 프론트엔드 `CAFE24_RESOURCES` 배열 중복 정의
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx:248–266` / `backend/src/nodes/integration/cafe24/metadata/types.ts:CAFE24_RESOURCES`
  - 상세: 18개 리소스 목록이 프론트엔드와 백엔드에 각각 하드코딩되어 있다. 백엔드 `CAFE24_RESOURCE_LABELS`와 프론트엔드 `CAFE24_RESOURCES` 배열의 레이블 형식(예: `"Store (상점)"`)은 동일하지만 별도 관리된다. 리소스가 추가·삭제될 때 두 곳을 동시에 수정해야 하며, 한쪽만 업데이트되면 UI와 실제 동작이 불일치한다.
  - 제안: 프론트엔드에서 `/integrations/metadata?service=cafe24` 엔드포인트로 동적으로 가져오거나, 백엔드 빌드 시 타입/상수를 프론트엔드 패키지로 공유(shared package)하는 방식을 고려한다.

- **[WARNING]** `MCP_CAPABLE_SERVICE_TYPES_LIST` 가변(mutable) 배열 export
  - 위치: `backend/src/modules/integrations/services/mcp-capable-service-types.ts:18–20`
  - 상세: `as const` 튜플로부터 파생된 배열이지만 `string[]` 타입으로 export되어 import 측에서 `.push()` 등으로 변형 가능하다. "single source of truth" 주석과 취지가 상충한다.
  - 제안: `readonly string[]` 또는 `ReadonlyArray<string>`으로 타입을 좁히거나, query builder가 `string[]`를 요구한다면 호출부에서 `[...MCP_CAPABLE_SERVICE_TYPES]`로 복사하도록 책임을 이동한다.

- **[INFO]** `execution-engine` → `nodes/` 크로스 레이어 의존성 (의도적, 문서화됨)
  - 위치: `backend/src/modules/execution-engine/execution-engine.module.ts:25` / `backend/src/nodes/integration/cafe24/cafe24.module.ts` 주석
  - 상세: `modules/execution-engine`이 `nodes/integration/cafe24`를 직접 임포트한다. `cafe24.module.ts` 주석에 `nodes → modules` 방향 유지 이유가 명시되어 있으므로 의도적 결정이다. 단, 향후 다른 Internal Bridge(Shopify 등)가 추가될 경우 `ExecutionEngineModule`이 여러 노드 모듈을 개별 임포트하게 되어 결합도가 높아질 수 있다.
  - 제안: 현 규모에서는 허용 가능. 두 번째 Internal Bridge 도입 시 `InternalBridgeModule` 같은 집약 모듈 패턴 도입을 검토한다.

- **[INFO]** `node-component.interface.ts`의 동적 타입 임포트
  - 위치: `backend/src/nodes/core/node-component.interface.ts:272`
  - 상세: `cafe24ApiClient?: import('../integration/cafe24/cafe24-api.client').Cafe24ApiClient` — 런타임 순환 의존을 피하기 위한 타입 전용 인라인 임포트다. 기법 자체는 올바르나, 인터페이스 파일 상단에 타입 임포트를 두는 컨벤션과 일관성이 없다.
  - 제안: 파일 상단에 `import type { Cafe24ApiClient } from '../integration/cafe24/cafe24-api.client';`로 분리해 가독성을 높인다.

- **[INFO]** `cafe24ApiClient` optional wiring의 묵시적 비활성화 위험
  - 위치: `backend/src/nodes/ai/ai-agent/ai-agent.component.ts:27–33`
  - 상세: `if (deps.cafe24ApiClient)` 가드를 통해 클라이언트가 없으면 `Cafe24McpToolProvider`가 등록되지 않는다. `Cafe24Module`을 임포트하지 않는 환경(테스트, 새 마이크로서비스 분리 등)에서 기능이 조용히 비활성화된다.
  - 제안: 현재 패턴은 유연성 면에서 적절하다. 다만 `ExecutionEngineService`에서 `cafe24ApiClient`가 주입되지 않을 경우를 감지하는 startup 로그나 `onApplicationBootstrap` 경고를 추가하면 운영 시 추적이 쉬워진다.

- **[INFO]** 신규 외부 패키지 없음 확인
  - 상세: 전체 변경에서 새로운 외부 npm 패키지가 추가되지 않았다. `class-validator`(`Matches`, `MinLength`), `zod`, `lucide-react`(`ShoppingBag`), `@nestjs/*`, `typeorm` 모두 기존 의존성이다.

---

### 요약

이번 변경은 새로운 외부 패키지를 일절 도입하지 않고 기존 `class-validator`, `zod`, `lucide-react`, `@nestjs/*`, `TypeORM` 스택 위에서 완전히 구현되었다. 내부 의존 방향(`nodes → modules`)은 `cafe24.module.ts` 주석에 명시적으로 문서화되어 있으며 의도적 설계다. 주요 주의 사항은 프론트엔드와 백엔드 사이의 18개 리소스 목록 중복인데, 현재는 정적이지만 리소스가 추가될 때마다 양쪽을 동시에 수정해야 하는 유지보수 부채다. 나머지 항목은 스타일 일관성 또는 방어적 코딩 수준의 사항으로, 동작에는 영향이 없다.

### 위험도

**LOW**