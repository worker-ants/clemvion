# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] 테스트 fixture helper 중복 — `baseConfig()` vs `cfg()`
- **위치**: `codebase/backend/src/modules/model-config/model-config.service.spec.ts`
- **상세**: `update` describe 블록(line ~2503)의 `baseConfig()` 와 새로 추가된 `onConfigInvalidated / notifyInvalidated` describe 블록(line ~2209)의 `cfg()` 가 동일한 `ModelConfig` 형태를 반환하는 거의 동일한 factory 함수다. 두 함수 모두 `id: 'cfg-1'`, `workspaceId: 'ws-1'`, `kind: 'chat'`, `provider: 'openai'` 등 동일 기본값을 가지며 `Partial<ModelConfig>` override 패턴까지 동일하다. 파일 내 두 곳에서 분리 관리하면 향후 엔티티 스키마 변경 시 두 곳을 모두 갱신해야 하는 부담이 생긴다.
- **제안**: `cfg()` / `baseConfig()` 중 하나로 통일하거나 `describe` 블록 외부 상단에 모듈 공통 fixture factory 로 추출한다.

### [INFO] `@Throttle` 설정이 3개 메서드에 그대로 반복
- **위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `previewModels`, `testConnection`, `listModels` 세 메서드
- **상세**: `@Throttle({ default: { limit: 10, ttl: 60_000 } })` 리터럴이 동일하게 3회 복사되어 있다. 현재는 세 메서드가 같은 값을 쓰므로 문제없지만 한쪽만 변경하면 불일치가 발생할 수 있다.
- **제안**: 파일 상단에 `const LLM_THROTTLE = { default: { limit: 10, ttl: 60_000 } } as const;` 상수로 추출하고 `@Throttle(LLM_THROTTLE)` 로 참조한다.

### [INFO] `testConnection` POST 핸들러에 `@HttpCode` 명시 누락
- **위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `testConnection` 메서드
- **상세**: `@Post('preview-models')` 에는 `@HttpCode(HttpStatus.OK)` 가 명시되어 있지만 `@Post(':id/test')` 에는 `@HttpCode` 가 없다. NestJS `@Post` 의 기본 응답 코드는 201 Created 이므로 클라이언트 입장에서는 테스트 성공 응답이 201로 내려올 수 있다. 원본 `ModelConfigController` 에서도 동일하게 누락되어 있었으므로 이번 이전(verbatim)에서 새로 생긴 이슈는 아니지만, 재배치 시 함께 교정할 기회였다.
- **제안**: `testConnection` 에도 `@HttpCode(HttpStatus.OK)` 를 추가하고 Swagger 응답 데코레이터도 200 기준으로 명시한다.

### [INFO] 테스트 spec에서 `dto as any` 캐스팅 사용
- **위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` — `previewModels` 테스트 케이스 (line 97)
- **상세**: `controller.previewModels(dto as any)` 로 타입을 우회한다. `PreviewModelListDto` 를 직접 구성하거나 `as PreviewModelListDto` 캐스팅을 쓰는 것이 의도를 더 명확히 전달한다.
- **제안**: `dto`를 `PreviewModelListDto` 타입으로 직접 선언하거나 `as PreviewModelListDto` 로 교체하여 타입 안전성을 유지한다.

### [INFO] `llm.service.spec.ts` listener 추출 방식의 가독성
- **위치**: `codebase/backend/src/modules/llm/llm.service.spec.ts` — `onModuleInit` 두 번째 테스트 케이스 (line ~717)
- **상세**: `mockModelConfigService.onConfigInvalidated.mock.calls[0][0] as (configId: string) => void` 방식으로 listener 를 추출한다. `jest.Mock` 의 `mock.lastCall` 이나 명시적 변수 캡처 패턴에 비해 호출 인덱스(`[0][0]`)가 fragile 하게 느껴지며 향후 다른 개발자가 의도를 파악하는 데 시간이 걸린다.
- **제안**: `let capturedListener: (configId: string) => void;` 를 선언하고 `mockModelConfigService.onConfigInvalidated.mockImplementation((fn) => { capturedListener = fn; });` 패턴으로 명시적으로 캡처하면 가독성이 높아진다.

---

## 요약

이번 변경은 `llm ↔ model-config` 모듈 간 `forwardRef` 순환 의존을 제거하는 구조적 리팩토링으로, 유지보수성 측면에서 전반적으로 긍정적이다. 새로 추가된 `LlmModelConfigController` 는 thin controller 패턴을 준수해 각 메서드가 단일 책임을 가지며, 클래스 수준 JSDoc 이 설계 결정의 이유를 명확히 설명한다. `ModelConfigService` 의 `onConfigInvalidated` / `notifyInvalidated` 옵저버 훅은 경량 패턴으로 의도가 잘 드러난다. 다만 테스트 파일에서 동일 구조의 fixture factory 가 두 개로 분리된 점(WARNING)과 일부 사소한 일관성 이슈(INFO 4건)는 향후 유지보수 시 혼란의 씨앗이 될 수 있으므로 보완을 권장한다.

## 위험도

LOW
