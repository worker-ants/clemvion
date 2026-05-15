### 발견사항

---

**[INFO]** `zod ^4.3.6` 프로덕션 의존성 추가
- 위치: `backend/package.json`
- 상세: Zod v4는 2025년 출시된 주요 버전으로 API가 안정적이며 MIT 라이선스(프로젝트 호환). `@anthropic-ai/sdk`의 peer dependency가 `"^3.25.0 || ^4.0.0"`으로 선언되어 있어 버전 호환성도 확인됨. `z.toJSONSchema()`는 v4에서 추가된 기능으로 v3로는 대체 불가하므로 추가가 정당함.
- 제안: 이상 없음.

---

**[WARNING]** `NodesModule` ↔ `ExecutionEngineModule` 순환 의존성 도입
- 위치: `nodes.module.ts` / `execution-engine.module.ts`
- 상세: `NodesModule`이 `ExecutionEngineModule`을 `forwardRef()`로 import하여 `NodeComponentRegistry`를 사용하고, `ExecutionEngineModule`은 이미 다른 경로로 `NodesModule`과 연결되어 있는 구조. NestJS에서 `forwardRef()`로 순환 의존성을 해소할 수 있지만, 초기화 순서 문제로 인해 런타임에 `undefined` 주입 오류가 발생할 수 있으며 모듈 구조를 파악하기 어렵게 만듦.
- 제안: `NodeComponentRegistry`를 `NodesModule`과 `ExecutionEngineModule` 양쪽에 의존하지 않는 별도 `NodeRegistryModule`(또는 `SharedModule`)로 분리하면 순환 의존성을 제거할 수 있음.

---

**[WARNING]** 모든 노드 configSchema가 `z.object({}).passthrough()` (빈 스키마)
- 위치: `backend/src/nodes/**/*.schema.ts` (전체)
- 상세: `ai_agent`, `http_request`, `database_query`, `send_email` 등 실질적인 설정이 필요한 노드들까지 전부 `z.object({}).passthrough()`로 선언되어 있음. `listDefinitions()` 엔드포인트가 반환하는 `configSchema`가 `{}` (모든 값 허용)이 되어 프론트엔드 폼 자동 생성 기능이 실질적으로 동작하지 않음. 또한 `validateWithZod()` 유틸리티가 존재하지만 어떤 핸들러에서도 사용되지 않고 있어 선언된 Zod 스키마가 런타임 검증에 연결되지 않은 상태.
- 제안: 단기적으로 플레이스홀더임을 주석으로 명시하고, 실제 configSchema 구현을 별도 태스크로 추적할 것. `validateWithZod()`를 각 컴포넌트의 `NodeHandler.validate()`에 연결하는 표준 패턴 수립 필요.

---

**[INFO]** `peer` 플래그 대량 제거 (package-lock.json)
- 위치: `backend/package-lock.json` (`@nestjs/common`, `typeorm`, `pg`, `bullmq`, `class-transformer`, `class-validator` 등 다수)
- 상세: npm이 이전에 일부 직접 의존성 패키지에 `"peer": true` 메타데이터를 잘못 부여했던 것이 이번 `npm install`(zod 추가)로 재해소된 것으로 보임. 실제 동작에는 영향 없으나 lock 파일 diff가 과도하게 커짐.
- 제안: 이상 없음. 의도된 정리로 판단.

---

**[INFO]** `browserslist`, `@colordx/core`, `cssnano-preset-default` 등 마이너/패치 버전 자동 업그레이드
- 위치: `backend/package-lock.json`
- 상세: 이 패키지들은 `@nestjs-modules/mailer`의 트랜지티브 의존성으로, 백엔드 서버에서 CSS 처리에 관여하지 않아 실질적 영향 없음. 모두 패치/마이너 범위 내 업그레이드이며 보안 이슈 없음.
- 제안: 이상 없음.

---

### 요약

핵심 변경은 `zod ^4.3.6` 추가와 이를 활용한 `NodeComponentRegistry` 도입이다. Zod v4는 MIT 라이선스이고 `@anthropic-ai/sdk`와 버전 호환되며, `z.toJSONSchema()` 사용을 위해 v4가 필수이므로 의존성 추가 자체는 적절하다. 그러나 두 가지 구조적 문제가 있다: `NodesModule`과 `ExecutionEngineModule`의 순환 의존성(`forwardRef()`) 도입, 그리고 모든 노드의 configSchema가 빈 `passthrough()` 스키마여서 `GET /api/v1/nodes/definitions`가 유의미한 JSON Schema를 반환하지 못하는 점. lock 파일의 대부분 변경(peer 플래그 제거, 트랜지티브 의존성 버전 업)은 npm 재해소 과정에서 발생한 정상적인 노이즈이다.

### 위험도

**MEDIUM**