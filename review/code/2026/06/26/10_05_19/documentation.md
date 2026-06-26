# 문서화(Documentation) 리뷰 결과

## 발견사항

### [WARNING] spec 문서 동기화 미완성 — 신규 컨트롤러가 spec에 미등재
- **위치**: `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4 섹션 (구현 완료 후 "planner 후속" 미완)
- **상세**: plan 파일 자체에서 두 spec 문서의 업데이트가 필요하다고 명시되어 있으나 이번 커밋에 포함되지 않음.
  1. `spec/2-navigation/6-config.md` frontmatter `code:` 항목에 `llm-model-config.controller.ts` 미등재 (plan의 "WARNING #1")
  2. `spec/data-flow/7-llm-usage.md` — 컨트롤러 파일명(`model-config.controller.ts` → 부속 엔드포인트는 `llm-model-config.controller.ts`)과 캐시 무효화 서술(controller 직접 호출 → `ModelConfigService.onConfigInvalidated` 옵저버 → `LlmService.clearClientCache`) 현행화 미완료 (plan의 "INFO #6·#7")
- **제안**: 코드가 이미 live 상태이므로 해당 spec 파일을 빠른 후속 커밋으로 현행화. 신규 컨트롤러가 spec 문서에 없으면 spec-impl coverage audit 에서 false negative 가 발생할 수 있음.

---

### [INFO] `LlmService.onModuleInit()` 공개 메서드에 JSDoc 없음
- **위치**: `codebase/backend/src/modules/llm/llm.service.ts` 라인 900–909
- **상세**: `onModuleInit()` 은 `OnModuleInit` 인터페이스의 공개 구현 메서드이며 서비스의 캐시 무효화 연결 진입점이다. 동 파일 내 다른 공개 메서드(`embed`, `testConnection`, `resolveEmbedding`, `hasDefaultLlmConfig`)는 모두 JSDoc을 보유하고 있으나 이 메서드만 인라인 주석으로만 처리됨.
- **제안**: 아래와 같은 간략한 JSDoc 추가.
  ```typescript
  /**
   * NestJS 모듈 초기화 훅 — ModelConfigService 에 LLM 캐시 무효화 리스너를 등록한다.
   * config update/remove 시 clientCache·listModelsCache 가 자동 소거된다.
   * (refactor 02 C-2 cluster 4: forwardRef 순환 제거를 위한 옵저버 역전)
   */
  ```

---

### [INFO] `notifyInvalidated()` 에서 리스너 예외 처리 정책이 문서화되지 않음
- **위치**: `codebase/backend/src/modules/model-config/model-config.service.ts` `private notifyInvalidated()` 메서드
- **상세**: `invalidationListeners` 필드 JSDoc에 "리스너는 throw 하지 않는 멱등 무효화여야 한다"라고 계약을 명시했으나, `notifyInvalidated()` 메서드 자체에서 이를 강제하거나, 리스너가 예외를 던질 경우 이후 리스너가 호출되지 않는 side-effect가 문서화되지 않음. 현재 구현(`for...of` 루프)은 예외 발생 시 나머지 리스너를 건너뜀.
- **제안**: 메서드 JSDoc에 "@throws — 리스너는 throw 금지(계약). throw 시 이후 리스너 건너뜀" 주의사항 추가, 또는 방어적 `try/catch` + 경고 로그 래핑 권장.

---

### [INFO] `LlmService.listModels()` 메서드에 JSDoc 없음
- **위치**: `codebase/backend/src/modules/llm/llm.service.ts` `async listModels()` 메서드
- **상세**: 메서드 시그니처에 `opts?: { type?: 'chat' | 'embedding' }` 선택 파라미터가 있으나 JSDoc이 없어 `opts.type`의 필터링 의미와 cache 동작(5분 TTL), timeout(30초) 등이 소비자 입장에서 불명확. 같은 레이어의 `testConnection`, `embed` 는 JSDoc을 보유.
- **제안**: `@param`, `@returns`, 캐시 TTL/timeout 동작 서술을 포함하는 JSDoc 추가.

---

## 요약

이번 변경(llm ↔ model-config forwardRef 순환 제거, C-2 cluster 4)은 전반적으로 문서화 품질이 높다. `LlmModelConfigController` 클래스 레벨 JSDoc이 라우트 프리픽스 보존 이유·의존 방향·CRUD 분리·spec SoT까지 명확히 서술하고, `ModelConfigService.invalidationListeners` 필드와 `onConfigInvalidated` 메서드도 설계 결정(EventEmitter2 미도입, 경량 훅, 멱등 제약)을 충분히 설명한다. 모듈 파일과 service 파일의 인라인 주석도 이전과의 차이를 명확히 표시하고 있다. 핵심 미비 사항은 plan에서 이미 인지하고 있는 spec 문서 동기화(WARNING)이며, 이외에는 `LlmService.onModuleInit()`·`listModels()` 의 JSDoc 부재와 `notifyInvalidated()` 의 예외 정책 미문서화가 소규모 INFO 수준으로 남는다.

## 위험도

LOW
