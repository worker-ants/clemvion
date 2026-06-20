### 발견사항

- **[INFO]** `bootstrapArgs` 헬퍼가 `mock.calls[0]`을 무조건 구조분해한다 — `bootstrap`이 한 번도 호출되지 않으면 `calls[0]`이 `undefined`라 런타임 에러 발생
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-m5-node-di/codebase/backend/src/modules/execution-engine/node-bootstrap.service.spec.ts` L34-37
  - 상세: 현재 세 테스트 케이스 모두 `onModuleInit()`을 먼저 호출하므로 실제로는 문제없다. 그러나 `bootstrapArgs`가 호출 횟수를 전제로 동작하므로, 이 헬퍼를 재사용하는 미래 테스트에서 순서를 틀리면 에러 위치가 불분명해진다.
  - 제안: 헬퍼 내부에 `expect(componentRegistry.bootstrap).toHaveBeenCalled()` 사전단언을 추가하거나, 네이밍을 `getBootstrapArgsAfterInit`처럼 전제를 명시하는 형태로 바꾸면 의도가 명확해진다. 현재는 조치 필수 수준 아님.

- **[INFO]** 정렬 결정성 테스트가 `ALL_NODE_COMPONENTS`의 모든 원소가 `NODE_CATEGORIES`에 속한 카테고리를 갖는다는 것을 전제한다
  - 위치: `node-bootstrap.service.spec.ts` L147-170 (정렬 테스트)
  - 상세: `orderOf`가 Map miss 시 `Number.MAX_SAFE_INTEGER` fallback을 반환하는 로직과 동일하게 테스트 코드도 구현되어 있다. `nodes.integration.spec.ts`의 "assigns every node to a category registered in NODE_CATEGORIES" 케이스가 이미 별도로 이 전제를 검증하므로 중복 단언이 없어도 된다. 다만 정렬 테스트에서 "알 수 없는 카테고리를 가진 컴포넌트가 뒤로 밀리는지"를 별도 케이스로 확인하면 `sortComponents`의 fallback 경로가 완전히 커버된다 (현재 미커버).
  - 제안: 미지 카테고리 컴포넌트 1개를 포함한 인위적 배열로 `sortComponents`의 fallback 경로를 가드하는 케이스 추가 권장. 현재 미커버이지만 `Number.MAX_SAFE_INTEGER` fallback이 단순한 수치비교라 위험도는 낮다.

- **[INFO]** `node-components.module.spec.ts`에 `moduleRef.close()` 호출이 있지만 `afterEach`/`afterAll`가 아닌 테스트 본문 끝에 위치한다 — 테스트가 중간에 실패하면 모듈이 닫히지 않는다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-m5-node-di/codebase/backend/src/nodes/node-components.module.spec.ts` L35
  - 상세: NestJS `Test.createTestingModule` 관례상 `afterEach`에서 닫는 것이 표준이다. 현재 테스트 케이스가 1개뿐이어서 실질 누수는 없지만, 케이스가 추가될 때 패턴이 잘못 복제될 수 있다.
  - 제안: `afterAll(() => moduleRef.close())` 패턴으로 리팩터 권장. 현재 위험도는 낮음.

- **[INFO]** `node-components.module.spec.ts`의 단일 테스트 케이스가 "DI 주입 카탈로그 = 정적 spread"를 중복 type 없음까지 포함해 검증하지만, `NodeComponentsModule`이 빈 배열이나 `undefined`를 제공할 경우(즉 `useValue` 설정 오류)를 명시적으로 가드하지 않는다
  - 위치: `node-components.module.spec.ts` L26-33
  - 상세: `expect(injected).toHaveLength(ALL_NODE_COMPONENTS.length)` 단언이 사실상 비어있음 케이스를 가드하므로 실용적 커버리지는 충분하다. 별도 테스트 불요.

- **[INFO]** 카테고리별 `index.ts` 배열(AI_COMPONENTS, DATA_COMPONENTS 등 신규 파일)에 대한 단위 테스트가 없다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-m5-node-di/codebase/backend/src/nodes/ai/index.ts`, `data/index.ts`, `flow/index.ts`, `integration/index.ts`, `logic/index.ts`, `presentation/index.ts`, `trigger/index.ts`
  - 상세: 각 `<CATEGORY>_COMPONENTS` 배열은 단순 집합 선언이라 자체 로직이 없다. `nodes.integration.spec.ts`가 `ALL_NODE_COMPONENTS`(= 카테고리 배열들의 spread)를 순회하며 메타데이터 불변을 전수 검증하므로, 개별 카테고리 배열에 대한 별도 테스트는 실용적으로 불필요하다. 단지 특정 카테고리가 `ALL_NODE_COMPONENTS`에서 누락되는 drift를 잡는 테스트가 없다는 점은 설계 의도(카테고리 추가 시 `nodes/index.ts`에 spread 한 줄 추가)에 의해 수동 게이트로 남는다.
  - 제안: 카테고리 배열을 `ALL_NODE_COMPONENTS`에 spread하는 수가 `NODE_CATEGORIES` 수와 일치하는지 단언하면 새 카테고리 추가 시 `nodes/index.ts` 갱신 누락을 자동으로 잡을 수 있다. 현재 레이어1 범위에서는 INFO 수준.

### 요약

M-5 레이어1 DI 전환에 대한 테스트 커버리지는 전반적으로 양호하다. `node-bootstrap.service.spec.ts`는 (1) DI 주입 집합 전달, (2) 정렬 결정성, (3) deps 전달 회귀 가드의 3가지 핵심 경로를 독립 케이스로 커버하며, 공통 픽스처를 `setup` / `bootstrapArgs` 헬퍼로 추출해 가독성도 충분하다. `node-components.module.spec.ts`는 실제 NestJS DI 배선으로 "useValue 등록 → @Inject 주입"이 동작하는지를 probe 패턴으로 검증하며, 정적 spread와의 집합 동등성까지 단언해 두 소비처(정적 + DI) 간 drift를 구조적으로 차단한다. e2e 부팅 스모크(205 tests)가 교차 모듈 DI 주입 실검증을 보완한다. 보완이 필요한 지점은 (a) `sortComponents`의 알 수 없는 카테고리 fallback 경로 미커버, (b) `bootstrapArgs` 헬퍼의 묵시적 호출 전제, (c) `moduleRef.close` 위치 관례 미준수로, 모두 INFO 수준으로 즉각 조치가 필요한 결함은 없다. 테스트 가용성(testability) 측면에서는 DI 주입으로 전환함으로써 오히려 테스트에서 컴포넌트 목록을 자유롭게 오버라이드할 수 있는 구조가 갖춰졌다.

### 위험도

LOW
