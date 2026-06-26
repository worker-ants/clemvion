# Architecture Review — C-2 cluster 4: llm↔model-config forwardRef 순환 제거

## 발견사항

- **[WARNING]** `notifyInvalidated` 에 에러 핸들링 없음 — 리스너 throw 시 이후 리스너 건너뜀 + 뮤테이션 실패
  - 위치: `/codebase/backend/src/modules/model-config/model-config.service.ts` — `notifyInvalidated` 메서드 (for-of 루프)
  - 상세: 문서는 "리스너는 throw 하지 않는 멱등 무효화여야 한다"고 명시하지만 `notifyInvalidated` 내부에는 강제 장치가 없다. 리스너가 예외를 던지면 (a) 루프가 중단되어 남은 리스너에 통지되지 않고, (b) 예외가 `update`/`remove` 까지 전파되어 저장 성공 후에도 HTTP 500을 반환할 수 있다. 현재 단일 소비자(`LlmService.clearClientCache`)는 동기 `Map.delete`여서 실질 위험은 낮지만, 향후 리스너가 추가될 경우 무음 부분 실패 또는 롤백 없는 뮤테이션 오류 경로가 된다.
  - 제안: `try { listener(configId) } catch (err) { this.logger.warn(...) }` 패턴으로 각 리스너를 격리하거나, 리스너 타입을 `(): void` 대신 명시적 fire-and-forget 계약으로 변경. 최소한 `notifyInvalidated` 전체를 `try/catch` 로 감싸 저장 결과가 리스너 오류로 오염되지 않도록 한다.

- **[WARNING]** Split Controller 패턴 — `model-configs` 라우트가 두 모듈의 컨트롤러에 분산
  - 위치: `/codebase/backend/src/modules/llm/llm-model-config.controller.ts` (`@Controller('model-configs')`) + `/codebase/backend/src/modules/model-config/model-config.controller.ts` (`@Controller('model-configs')`)
  - 상세: 동일한 라우트 프리픽스를 가진 두 컨트롤러가 서로 다른 모듈에 등록되어 있다. NestJS는 기술적으로 이를 허용하지만, `model-configs` API의 전체 엔드포인트 목록을 파악하려면 두 모듈을 모두 탐색해야 한다. 새 엔드포인트 추가 시 개발자가 양쪽 컨트롤러를 인지하지 못하면 라우트 충돌이 조용히 발생할 수 있다. 이 구조는 "단일 라우트 → 단일 컨트롤러" 라는 NestJS 관례를 깬다. 현재는 양쪽 모두에 JSDoc 주석이 있어 맥락을 설명하지만, 이는 런타임에 강제되지 않는다.
  - 제안: 단기적으로는 현행 유지(기능·API 불변 요건 충족). 장기적으로 `LlmModelConfigController`를 별도 라우트 프리픽스(예: `llm/model-configs`)로 분리하거나, 순환 없이 단일 컨트롤러에서 두 서비스를 모두 사용할 수 있는 Facade/adapter 계층을 고려. 최소한 `llm.module.ts`에 "두 컨트롤러가 동일 prefix를 공유함" 주석을 추가한다.

- **[INFO]** `onConfigInvalidated` 공개 API가 구체 함수 타입 — 인터페이스 추상화 없음
  - 위치: `/codebase/backend/src/modules/model-config/model-config.service.ts` — `onConfigInvalidated(listener: (configId: string) => void): void`
  - 상세: 현재 단일 소비자(`LlmService`)이므로 실용적 선택이다. 그러나 향후 다양한 소비자(예: 감사 로그 서비스, 알림 서비스)가 구독할 경우, 함수 참조 동일성 비교(Set dedup)가 의도와 다르게 동작하거나 언서브스크라이브 메커니즘이 필요해질 수 있다.
  - 제안: 현재 범위에서는 수용 가능. 소비자가 2개 이상이 되는 시점에 `IConfigInvalidationListener` 인터페이스 또는 NestJS `EventEmitter2` 도입을 검토한다.

- **[INFO]** 언서브스크라이브(unsubscribe) 메커니즘 없음
  - 위치: `/codebase/backend/src/modules/model-config/model-config.service.ts` — `invalidationListeners` Set
  - 상세: 리스너 해제 수단이 없다. 싱글턴 서비스 생애주기에서는 문제없지만, 테스트 환경에서 `beforeEach`마다 서비스를 재생성하지 않으면 리스너가 축적될 수 있다. 현재 스펙 테스트는 `Test.createTestingModule`로 격리하므로 실제 영향은 없다.
  - 제안: 현재 범위에서는 수용 가능. 테스트에서 서비스를 장기 공유할 경우에는 `removeConfigInvalidatedListener` 추가를 고려한다.

- **[INFO]** `LlmModelConfigController` 명명 및 배치의 검색성(discoverability) 저하
  - 위치: `/codebase/backend/src/modules/llm/llm-model-config.controller.ts`
  - 상세: 컨트롤러가 `llm/` 모듈에 위치하지만 `model-configs` 라우트를 서빙한다. `model-config/` 디렉터리를 탐색하는 개발자는 일부 엔드포인트를 찾지 못할 수 있다. JSDoc에 맥락이 상세히 기재되어 있어 의도는 명확하나, IDE에서 `model-configs` 라우트를 추적할 때 혼란이 생길 수 있다.
  - 제안: 양 컨트롤러 파일 상단에 상호 참조 주석을 명시한다. 이미 JSDoc에 부분적으로 반영되어 있으나, `ModelConfigController`에도 "LLM 엔드포인트는 `llm/llm-model-config.controller.ts` 참조" 라는 `@see` 링크를 추가하면 더 명확하다.

## 요약

이번 리팩터링은 `llm ↔ model-config` 양방향 forwardRef 순환을 Observer 패턴으로 역전하고 엔드포인트 재배치로 제거한 아키텍처적으로 올바른 변경이다. `ModelConfigController`의 단일 책임(순수 CRUD)이 회복되고, 모듈 간 의존 방향이 단방향(llm → model-config)으로 정리되었으며, 공개 API와 동작은 완전히 보존된다. 주요 우려 사항은 두 가지다: `notifyInvalidated`의 에러 격리 부재(리스너 실패가 저장 트랜잭션을 오염할 수 있음)와 동일 라우트 프리픽스를 공유하는 Split Controller 패턴(장기적으로 라우트 충돌 위험 및 API 가시성 저하). 두 이슈 모두 즉각적인 기능 회귀를 유발하지는 않지만 향후 유지보수에서 숨은 위험이 될 수 있으므로 개선을 권장한다.

## 위험도

LOW
