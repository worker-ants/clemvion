### 발견사항

---

**[WARNING] `IntegrationsModule`이 `nodes/` 레이어를 직접 제공자로 등록**
- 위치: `integrations.module.ts` +47~51
- 상세: `IntegrationsModule`이 `../../nodes/integration/cafe24/cafe24-api.client`를 import하고 provider/export로 등록한다. 동시에 `cafe24-api.client.ts`는 `../../../modules/integrations/entities/integration.entity`에 의존한다(테스트 파일에서 확인). 이 구조는 `modules/integrations ↔ nodes/integration/cafe24` 사이에 양방향 레이어 의존을 만든다. TypeScript `type import`는 런타임 circular을 피하지만, NestJS DI 컨테이너가 `Cafe24ApiClient`를 `IntegrationsModule` 안에서 초기화하는 구조는 레이어 역전이다. 일반적으로 `nodes/`가 `modules/`를 바라보는 단방향이어야 한다.
- 제안: `Cafe24ApiClient`를 `IntegrationsModule`이 아닌 `NodesModule` 또는 별도 `Cafe24Module`로 이동하고, `ExecutionEngineModule`에서 직접 import하거나, `Cafe24ApiClient`를 인터페이스/추상으로 감싸 DI 방향을 역전시킨다.

---

**[WARNING] `ExecutionEngineService`가 특정 Integration 클라이언트를 직접 주입받음**
- 위치: `execution-engine.service.ts` +78, +422, +603
- 상세: `ExecutionEngineService` 생성자에 `cafe24ApiClient: Cafe24ApiClient`가 추가되었다. 이 패턴이 확산되면 새 특수 Integration(Shopify, 네이버 등)마다 생성자 파라미터가 늘어난다. 현재 `HandlerDependencies`에 optional로 넘기는 방식이지만, `ExecutionEngineService` 자체가 Cafe24를 인식하게 된다.
- 제안: `Map<string, IntegrationApiClient>` 형태의 레지스트리 패턴을 사용하거나, `HandlerDependencies`를 직접 빌드하는 팩토리에서 Cafe24 클라이언트를 조립하도록 분리한다.

---

**[WARNING] 테스트 전용 함수 `__resetCafe24LocksForTesting`이 production 모듈에서 export됨**
- 위치: `cafe24-api.client.spec.ts` +4, `index.ts`는 export 미포함 — `cafe24-api.client.ts` 내부에 존재하는 것으로 추정
- 상세: 테스트 파일이 `__resetCafe24LocksForTesting`을 named import로 직접 가져온다. 이 함수가 `cafe24-api.client.ts`의 public export에 남아있으면 프로덕션 번들에 포함되고, 외부에서 내부 상태를 조작할 수 있는 API가 노출된다.
- 제안: jest `jest.mock()` + `__private` 패턴으로 분리하거나, 테스트 전용 파일(`cafe24-api.client.test-utils.ts`)에 격리한다.

---

**[WARNING] `Cafe24ApiClient`가 `DataSource`를 직접 주입받아 DB 레이어에 직접 결합**
- 위치: `cafe24-api.client.spec.ts` makeBeforeEach 블록, 프로덕션 코드 추정
- 상세: `Cafe24ApiClient` 생성자가 `DataSource`를 받아 토큰 갱신 시 직접 transaction을 실행한다. Node-level API 클라이언트가 DB 레이어를 직접 다루는 것은 계층 분리 원칙에 반한다. `IntegrationsService`를 통해 토큰 갱신을 위임하는 것이 자연스럽다.
- 제안: 토큰 갱신 콜백을 `(integration: Integration, newTokens: TokenPayload) => Promise<void>` 형태의 주입형 함수로 추상화하거나, `IntegrationsService.refreshCafe24Token()`에 위임한다.

---

**[WARNING] `process.env` 직접 조작이 테스트 격리를 위협**
- 위치: `integration-oauth.service.cafe24.spec.ts` +44~47, +57~61
- 상세: `process.env.CAFE24_CLIENT_ID` 등을 `beforeEach`/`afterEach`로 설정·삭제한다. Jest 병렬 실행(`--runInBand` 없이) 환경에서 worker 간 환경 변수가 공유되면 테스트 간 오염이 발생할 수 있다.
- 제안: `jest.replaceProperty(process, 'env', ...)` 또는 `ConfigService` 모킹으로 환경 변수 의존성을 제거한다.

---

**[INFO] 전역 `fetch` API 의존 — Node.js ≥18 필요**
- 위치: `cafe24-api.client.ts` (테스트에서 `fetchMock`을 생성자로 주입하는 것으로 확인)
- 상세: 프로덕션 코드가 전역 `fetch`를 사용한다면 Node.js 18 미만에서는 `ReferenceError`가 발생한다. 현재 프로젝트 Node.js 버전 요건이 명시적이지 않으면 잠재적 런타임 오류다.
- 제안: `package.json`의 `engines.node`에 `>=18` 명시 또는 `node-fetch`를 DI로 주입하는 현재 테스트 구조를 프로덕션에도 유지한다.

---

**[INFO] 프론트엔드가 백엔드 `CAFE24_RESOURCES` 목록을 하드코딩으로 복제**
- 위치: `integration-configs.tsx` +248~267
- 상세: `CAFE24_RESOURCES` 배열이 백엔드 `metadata/types.ts`와 프론트엔드 `integration-configs.tsx`에 각각 독립적으로 존재한다. 리소스 추가·삭제 시 두 곳 모두 업데이트해야 하며 누락 시 UI/API 불일치가 발생한다.
- 제안: 백엔드 API 엔드포인트(`GET /integrations/services/cafe24/resources`)를 추가하거나, 공유 타입 패키지(monorepo `packages/` 레이어)에서 단일 소스로 관리한다.

---

**[INFO] 새로운 외부 npm 의존성 없음**
- 위치: 전체 변경사항
- 상세: 모든 변경사항이 기존 의존성(`zod`, `lucide-react`, `@nestjs/*`, 전역 `fetch`)을 사용한다. 신규 외부 패키지 추가가 없어 번들 크기 증가나 라이선스 충돌 위험이 없다.

---

### 요약

이번 변경은 외부 npm 의존성을 전혀 추가하지 않아 라이선스·취약점·번들 크기 관점에서는 문제가 없다. 그러나 **내부 모듈 의존 구조**에 구조적 문제가 있다. `Cafe24ApiClient`가 `nodes/` 레이어에 위치하면서 `IntegrationsModule`의 provider로 등록되어 `modules/integrations ↔ nodes/integration` 간 양방향 결합이 생겼고, `ExecutionEngineService`가 특정 integration 클라이언트를 생성자로 직접 주입받는 패턴은 향후 확장성을 저해한다. `Cafe24ApiClient`가 `DataSource`를 직접 다루는 것도 노드 클라이언트의 책임 범위를 초과한다. 테스트 전용 함수의 public export와 `process.env` 직접 조작 등 테스트 품질 문제도 함께 보완이 필요하다.

### 위험도

**MEDIUM**