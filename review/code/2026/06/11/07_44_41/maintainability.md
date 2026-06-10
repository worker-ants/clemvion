# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] `broadcastCredentialChange` 래퍼 메서드가 가치 없는 thin wrapper
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `broadcastCredentialChange` (라인 ~1069–1073)
- 상세: 본 메서드는 `await this.integrationCacheBus.publish(integrationId)` 한 줄만 호출하며, 이름이 달라지는 것 외에 별도 로직이 전혀 없다. 현재 두 군데(`remove`, `rotate`)에서 호출되지만, 각 호출 지점에 직접 `await this.integrationCacheBus.publish(id)` 를 쓰는 것과 완전히 동일하다. 메서드 javadoc 이 길어 메서드 자체가 의미있어 보이지만 실제로는 추상화 없이 이름만 바뀐다. 향후 `broadcastCredentialChange` 에 retry/로깅 등 실제 로직이 추가될 예정이라면 유지가 정당하지만, 현재 상태로는 네이밍 vs. 직접 호출의 trade-off 를 의식하지 않은 과설계 냄새가 있다.
- 제안: 현재 상태가 단순 위임에 그친다면 래퍼를 제거하고 `await this.integrationCacheBus.publish(id)` 를 직접 쓰거나, 메서드를 유지할 경우 "fail-safe + audit 로그 같은 횡단 관심사를 추후 여기 집중할 예정" 임을 주석으로 명시해 존재 이유를 분명히 한다.

### [WARNING] `onModuleDestroy` 의 임시 변수 `s` — 의도 불명의 단문자 네이밍
- 위치: `codebase/backend/src/common/redis/integration-cache-bus.service.ts` — `onModuleDestroy` 라인 ~605–608
- 상세: `const s = this.subscriber` 에서 `s` 는 컨텍스트 없이 단독으로 읽으면 subscriber 를 가리킨다는 것을 알기 어렵다. 동일 파일 내 다른 지역 변수들(`base`, `sub`, `client`, `err`)은 모두 의미 있는 이름을 사용한다. 이 패턴은 "null 을 먼저 할당해 race 방지" 목적의 기법인데, 그 의도가 변수명에 반영되지 않는다.
- 제안: `const sub = this.subscriber;` 로 변경하면 단 한 글자 차이지만 가독성이 크게 향상된다.

### [WARNING] e2e 테스트의 busy-wait 루프 — 가독성·유지보수성 저하
- 위치: `codebase/backend/test/integration-cache-invalidate.e2e-spec.ts` — `waitForBroadcast` 함수 (라인 ~2482–2493)
- 상세: `while (true)` + `eslint-disable-next-line no-constant-condition` + `setTimeout(50ms)` 조합의 busy-polling 루프가 사용됐다. eslint 억제 주석이 필요하다는 것 자체가 코드 의도가 도구와 충돌함을 시사한다. 더 나아가, 이 패턴은 테스트 코드베이스에서 재사용 가능성이 있음에도 인라인 helper 로만 존재한다.
- 제안: `while (!condition && !timeout)` 형태로 리팩터링해 eslint 억제 없이 쓸 수 있게 하거나, e2e 헬퍼 모듈(`test/helpers/`)에 `waitUntil(predicate, timeoutMs)` 제네릭 helper 로 추출해 다른 e2e 테스트와 재사용한다.

### [WARNING] `makeProvider` 에서 `base` 지역 변수가 파라미터의 단순 복사
- 위치: `codebase/backend/src/common/redis/integration-cache-bus.service.spec.ts` — `makeProvider` 함수 (라인 ~78–87)
- 상세: `const base = client;` 는 파라미터를 그대로 다시 이름 붙인 것으로, 실질적 차이가 없다. 반환 객체에 `base` 를 포함시키는 이유는 테스트 호출부에서 편의상 destructuring 하기 위함인데, 이 경우 파라미터 `client` 자체를 반환해도 동일하다. 또한 반환 타입의 `base: FakeRedis | null` 필드는 실제로 테스트에서 거의 사용되지 않는다(호출부에서 `const { provider } = makeProvider(client)` 형태가 대부분).
- 제안: `base` 필드를 반환 타입에서 제거하고, 필요한 곳에서는 `client` 를 그대로 참조한다. 또는 `makeProvider` 를 `provider` 만 반환하도록 단순화한다.

### [INFO] `subscribe + register` describe 블록 내 반복적인 test fixture 구성
- 위치: `codebase/backend/src/common/redis/integration-cache-bus.service.spec.ts` — `describe('subscribe + register')` 내 각 `it` 블록 (라인 ~131–217)
- 상세: 5개의 `it` 블록 중 4개가 각각 `const sub = makeFakeRedis()`, `const base = makeFakeRedis()`, `base.duplicate.mockReturnValue(sub)`, `const { provider } = makeProvider(base)`, `const bus = new IntegrationCacheBus(provider)` 를 동일하게 반복한다. `beforeEach` 로 공통 setup 을 추출하면 테스트 본문의 의도가 더 명확해진다.
- 제안: `beforeEach` 에서 `sub`, `base`, `bus` 를 초기화하고 각 `it` 블록은 고유 동작만 기술하도록 리팩터링한다. 단, 각 케이스가 독립적임을 보장하는 것이 중요하므로 공유 state mutation 에 유의한다.

### [INFO] `HandlerDependencies` 인터페이스에서 `integrationCacheBus` 만 inline import 사용
- 위치: `codebase/backend/src/nodes/core/node-component.interface.ts` — `HandlerDependencies` 인터페이스 (라인 ~1461–1466)
- 상세: `integrationCacheBus` 필드는 `agentMemoryService` 와 동일하게 `import(...)` 인라인 타입으로 선언된다. 파일 상단에는 이미 여러 서비스가 명시적 import 로 선언되어 있다(`LlmService`, `IntegrationsService` 등). 인라인 import 는 순환 의존성 회피 목적으로 사용되는 패턴인데, 동일 목적의 두 필드(`agentMemoryService`, `integrationCacheBus`)가 모두 인라인 import 를 쓰는 것은 일관성 있다. 다만 상단 명시적 import 와의 혼재가 신규 기여자에게는 "왜 어떤 건 위에, 어떤 건 인라인이냐?" 라는 의문을 줄 수 있다.
- 제안: 코드 상단 import 섹션 인근에 주석으로 "인라인 import 는 순환 의존 방지용" 임을 한 줄 명시하거나, 파일 내 일관된 방향(전부 top-level import 또는 전부 inline)으로 통일 여부를 검토한다. 현재 방향은 무해하므로 INFO 등급.

### [INFO] e2e 테스트 `CHANNEL` 상수가 `INTEGRATION_CACHE_INVALIDATE_CHANNEL` 를 import 하지 않고 문자열로 재선언
- 위치: `codebase/backend/test/integration-cache-invalidate.e2e-spec.ts` — 라인 ~2426
- 상세: `const CHANNEL = 'integration:cache:invalidate'` 로 하드코딩된 문자열이 e2e 테스트에서 선언된다. `integration-cache-bus.service.ts` 에서 `INTEGRATION_CACHE_INVALIDATE_CHANNEL` 를 export 하고 있음에도 import 하지 않는다. 채널명이 변경되면 두 곳을 모두 수정해야 한다.
- 제안: `import { INTEGRATION_CACHE_INVALIDATE_CHANNEL } from '../src/common/redis/integration-cache-bus.service'` 로 상수를 import 해 단일 진실 원칙을 지킨다. 다만 e2e 테스트가 src 를 직접 import 하는 것이 프로젝트 컨벤션상 허용되는지 확인이 필요하다.

---

## 요약

전반적으로 코드는 명확하게 구조화되어 있고 모든 파일에 목적이 잘 기술된 JSDoc 이 첨부되어 있다. 클래스 분리(`IntegrationCacheBus`), fail-safe 패턴, 상수화(`INTEGRATION_CACHE_INVALIDATE_CHANNEL`), Optional 주입 등 유지보수성을 높이는 설계 결정들이 일관되게 적용됐다. 주요 개선 여지는 세 곳이다: (1) `broadcastCredentialChange` 는 현재 상태로는 기여도가 없는 thin wrapper 이므로 직접 호출로 인라인하거나 향후 확장 의도를 명시해야 한다. (2) e2e `waitForBroadcast` 의 busy-wait 루프가 eslint 억제를 유발하며, 재사용 가능한 helper 로 추출할 여지가 있다. (3) 테스트 fixture 코드 중복이 `describe('subscribe + register')` 블록 내에 다수 반복되어 `beforeEach` 로 추출하면 가독성이 향상된다. INFO 등급 발견사항들은 무해하지만 신규 기여자의 인지 부담을 줄일 수 있는 점들이다.

## 위험도

LOW
