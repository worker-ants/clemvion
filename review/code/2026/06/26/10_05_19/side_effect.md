# 부작용(Side Effect) Review — C-2 cluster 4: llm↔model-config forwardRef 순환 제거

## 발견사항

### [WARNING] notifyInvalidated 예외가 DB 커밋 이후 HTTP 호출자에게 전파될 수 있음
- 위치: `/codebase/backend/src/modules/model-config/model-config.service.ts` — `update()` (line ~355), `remove()` (line ~397)
- 상세: `notifyInvalidated(id)` 는 try-catch 없이 DB save/remove 완료 후 호출된다. `clearClientCache` 는 `Map.delete()` 로 절대 throw 하지 않으므로 현재 구독자(LlmService)에는 문제없다. 그러나 `onConfigInvalidated` API 가 공개(public) 이므로 미래 구독자가 실패하면 DB 변경은 이미 커밋된 상태에서 HTTP 응답이 500 으로 터진다. 코드 주석("throw 하지 않는 멱등 무효화여야 한다")은 문서화만 할 뿐 런타임 보호가 없다.
- 제안: `notifyInvalidated` 내부에서 각 listener 호출을 try-catch 로 감싸 실패를 logger.warn 으로 fire-and-forget 처리. 또는 메서드 시그니처를 `private` 내부 전용으로 명확히 유지하고, 외부 구독자 API(`onConfigInvalidated`) JSDoc 에 "동기·비동기 throw 금지" 계약을 강제하는 래퍼(호출 후 catch 로 흡수)를 추가한다.

---

### [WARNING] onModuleInit 의 화살표 함수가 Set 중복 제거를 우회함
- 위치: `/codebase/backend/src/modules/model-config/model-config.service.ts` — `onConfigInvalidated`, `LlmService.onModuleInit()` (`/codebase/backend/src/modules/llm/llm.service.ts` line ~900)
- 상세: `LlmService.onModuleInit()` 는 매 호출마다 새 화살표 함수 `(configId) => this.clearClientCache(configId)` 를 생성해 전달한다. `Set` 은 참조 동일성으로 중복 제거하므로 동일 함수를 등록해도 중복이 걸리지 않는다. 프로덕션에서 NestJS 가 `onModuleInit` 을 1회만 호출하므로 실제 회귀 위험은 없으나, 테스트에서 `service.onModuleInit()` 를 여러 번 직접 호출하면 리스너가 중복 등록되어 캐시가 N 번 무효화될 수 있다. 현재 테스트(`llm.service.spec.ts`)는 각 `it()` 블록에서만 호출하고 `beforeEach` 가 서비스를 재생성하므로 실제 오염은 없지만, 구조적 취약점이다.
- 제안: `LlmService` 에 `private readonly boundInvalidateListener` 필드를 선언해 생성자에서 `this.clearClientCache.bind(this)` 를 1회 할당하고, `onModuleInit` 에서 해당 필드를 전달한다. 이렇게 하면 Set 의 중복 제거 의도가 실제로 동작한다.

---

### [INFO] 두 컨트롤러가 동일 라우트 프리픽스 model-configs 를 공유함
- 위치: `/codebase/backend/src/modules/model-config/model-config.controller.ts` (`@Controller('model-configs')`) 및 `/codebase/backend/src/modules/llm/llm-model-config.controller.ts` (`@Controller('model-configs')`)
- 상세: NestJS 는 HTTP 메서드 + 전체 경로로 라우트를 분리하므로 두 컨트롤러가 동일 prefix 를 가져도 정상 동작한다. 현재 엔드포인트는 겹치지 않는다(CRUD vs preview/test/listModels). 그러나 향후 두 컨트롤러에 동일 경로의 핸들러가 추가될 경우 등록 순서에 따라 silent 우선순위 충돌이 발생할 수 있다(NestJS 는 충돌을 에러로 알리지 않음).
- 제안: 현재는 문제없음. 향후 신규 엔드포인트 추가 시 두 컨트롤러 경로 충돌 여부를 명시적으로 확인하는 주석 또는 e2e 테스트를 유지한다.

---

### [INFO] setDefault 는 캐시 무효화를 트리거하지 않음
- 위치: `/codebase/backend/src/modules/model-config/model-config.service.ts` — `setDefault()` 메서드
- 상세: `setDefault` 는 `notifyInvalidated` 를 호출하지 않는다. 이는 **의도적이며 기존 동작과 동일**하다(구 `ModelConfigController.setDefault` 도 `clearClientCache` 를 호출하지 않았음). `listModels`/`clientCache` 는 configId 를 key 로 사용하므로 "어느 config 가 default 인지" 변경이 캐시 내용에 영향을 주지 않는다. `LlmService.resolveConfig` 는 매번 DB 조회하므로 무효화 불필요.
- 제안: 무조치. 다만, 이 동작을 service 의 `setDefault` JSDoc 에 "캐시 무효화 없음 — configId 캐시와 무관함" 한 줄로 명시하면 향후 유지보수 혼동을 방지할 수 있다.

---

### [INFO] ModelConfigController 생성자 시그니처 변경 (DI 계층 무변)
- 위치: `/codebase/backend/src/modules/model-config/model-config.controller.ts`
- 상세: 생성자가 `(ModelConfigService, LlmService, LlmPreviewService)` 에서 `(ModelConfigService)` 로 축소됐다. NestJS DI 가 자동 해결하므로 런타임 영향은 없다. 수동 인스턴스화하는 테스트 코드는 `model-config.controller.spec.ts` 에서 이미 동기화됐다. 타입 레벨의 breaking change 는 없다.
- 제안: 무조치.

---

### [INFO] ModelConfigService.onConfigInvalidated 가 공개 API 로 노출됨
- 위치: `/codebase/backend/src/modules/model-config/model-config.service.ts`
- 상세: `onConfigInvalidated` 는 `public` 메서드다. 현재 소비자는 `LlmService` 하나이나, 앞으로 다른 서비스가 이를 호출해 의도치 않은 구독자를 추가할 수 있다. `ModelConfigModule` 이 `ModelConfigService` 를 export 하므로 이를 import 하는 모든 모듈이 호출 가능하다.
- 제안: 현재 설계 의도는 명확히 문서화돼 있으므로 즉시 문제는 없다. 향후 `invalidationListeners` 규모가 커지면 가시성을 높이는 `getListenerCount()` 등의 진단 수단 또는 `@Internal()` 관례(파일 내 JSDoc)를 추가한다.

---

## 요약

이 리팩터링은 `model-config ↔ llm` 모듈 간 `forwardRef` 순환을 끊기 위해 3개 엔드포인트를 새 `LlmModelConfigController`(llm 모듈)로 이전하고, `clearClientCache` 역의존을 `ModelConfigService` 옵저버 패턴으로 역전한 구조 변경이다. 공개 라우트·HTTP 응답·캐시 무효화 시점은 모두 보존됐고, 새로운 전역 변수나 파일시스템 부작용, 환경 변수 변경, 의도치 않은 네트워크 호출은 없다. 핵심 주의 사항은 두 가지다: (1) `notifyInvalidated` 호출 시 리스너 예외에 대한 런타임 보호가 없어 미래 구독자 오류가 DB 커밋 후에도 HTTP 오류로 전파될 수 있고, (2) `onModuleInit` 에서 매번 새 화살표 함수를 생성해 등록하므로 Set 의 중복 방어가 무력화된다. 두 항목 모두 현재 프로덕션 동작에는 영향이 없지만, API 계약의 취약점으로 잠재적 회귀 경로가 된다.

## 위험도

LOW
