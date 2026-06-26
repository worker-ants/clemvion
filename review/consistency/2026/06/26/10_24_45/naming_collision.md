# 신규 식별자 충돌 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
대상 spec: `spec/2-navigation/6-config.md` (spec 변경 없음 — 구현 diff만 분석)

---

## 발견사항

### 발견사항 없음 (CRITICAL / WARNING 해당 없음)

아래는 확인된 INFO 수준 항목이다.

---

- **[INFO]** 두 컨트롤러가 동일 라우트 프리픽스 `model-configs` 를 공유
  - target 신규 식별자: `LlmModelConfigController` — `@Controller('model-configs')`
  - 기존 사용처: `/codebase/backend/src/modules/model-config/model-config.controller.ts:66` — `ModelConfigController` 도 동일 `@Controller('model-configs')` 선언
  - 상세: NestJS 는 같은 프리픽스를 가진 두 컨트롤러를 정상 등록한다. 핸들러 경로가 겹치지 않으면 런타임 충돌 없음 — `ModelConfigController` 는 CRUD 핸들러(`GET /`, `POST /`, `PATCH /:id` 등)만 보유하고, `LlmModelConfigController` 는 `POST /preview-models`, `POST /:id/test`, `GET /:id/models` 만 보유하므로 실제 경로 겹침은 없다. `@ApiTags('Model Config')` 도 양쪽 모두 선언해 Swagger 그룹이 자연스럽게 합산된다. 다만 두 컨트롤러가 서로 다른 모듈(llm vs model-config)에 나뉘어 있어 프리픽스만 보고 "어느 컨트롤러가 담당하는가"를 직관적으로 파악하기 어려운 점이 있다.
  - 제안: 현재 구조는 의도적 설계(forwardRef 순환 해소)이며 충돌 없음. 유지해도 무방. 향후 핸들러 추가 시 두 컨트롤러 간 경로 중복 여부를 명시적으로 확인하는 단위 테스트(`Reflect.getMetadata('path', ...)` 기반)를 추가하면 예방이 강화된다.

---

- **[INFO]** `onConfigInvalidated` 메서드명의 `on*` 네이밍 스타일
  - target 신규 식별자: `ModelConfigService.onConfigInvalidated(listener)` (`/codebase/backend/src/modules/model-config/model-config.service.ts:59`)
  - 기존 사용처: NestJS 코드베이스 내 `onModuleInit`, `onModuleDestroy` 등 — `on*` 은 주로 NestJS 라이프사이클 훅 이름으로 쓰인다
  - 상세: `onConfigInvalidated` 는 "무효화 이벤트 발생 시 호출된다"는 뜻이 아니라 "무효화 이벤트가 발생할 때 호출될 리스너를 **등록**한다"는 구독 API다. `on*` 패턴이 "등록 API"에 쓰인 것은 Node.js `EventEmitter.on(event, listener)` 관례와 일치하므로 혼동 소지는 낮지만, `subscribe*` / `registerInvalidationListener` 같은 동사형 이름과 비교했을 때 NestJS 라이프사이클 훅(`OnModuleInit.onModuleInit`)과 혼동될 여지가 있다. 현재 코드베이스에서 `onConfigInvalidated` 와 동일 시그니처가 다른 의미로 사용되는 사례는 없다 — 순수 명명 스타일 이슈.
  - 제안: 변경 불필요. 현재 이름이 `EventEmitter.on()` 관례와 일치하며 스펙 충돌도 없음.

---

## 요약

이번 diff 가 도입하는 신규 식별자(`LlmModelConfigController`, `onConfigInvalidated`, `notifyInvalidated`, `invalidationListeners`, `onConfigInvalidatedListener`)는 기존 코드베이스 어디에서도 동일 이름으로 다른 의미로 사용되는 사례가 없다. API endpoint 관점에서 `POST /model-configs/preview-models`, `POST /model-configs/:id/test`, `GET /model-configs/:id/models` 세 경로는 구 `ModelConfigController` 에서 그대로 이전된 것이므로 추가나 충돌이 아니다. 두 컨트롤러가 `model-configs` 라우트 프리픽스를 공유하는 점은 NestJS 에서 허용되는 패턴이며 핸들러 경로 겹침도 없다. 실질적 식별자 충돌은 없다.

## 위험도

NONE
