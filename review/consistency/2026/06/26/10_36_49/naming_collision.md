# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done` · scope: `spec/2-navigation/6-config.md` · diff-base: `origin/main`

---

## 발견사항

### [INFO] spec/2-navigation/6-config.md frontmatter `code:` 배열에 신규 구현 파일 미등재

- **target 신규 식별자**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` (신규 파일), `codebase/backend/src/modules/llm/llm.module.ts` (변경)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/2-navigation/6-config.md` frontmatter lines 1–11. LLM 모듈 경로로는 `codebase/backend/src/modules/llm/llm-preview.service.ts` 만 등재되어 있다.
- **상세**: `LlmModelConfigController` 가 spec §3 Model Config API 의 `POST preview-models`, `POST :id/test`, `GET :id/models` 엔드포인트를 구현하지만, 이 컨트롤러 경로는 spec `code:` 배열에 없다. 이는 식별자 충돌이 아닌 spec 추적 누락이다.
- **제안**: spec frontmatter `code:` 배열에 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 및 `codebase/backend/src/modules/llm/llm.module.ts` 를 추가한다 (planner 역할 작업).

---

### [INFO] 동일 observer 패턴에 두 가지 명명 관례 공존

- **target 신규 식별자**: `ModelConfigService.onConfigInvalidated(listener)` / `invalidationListeners` / `notifyInvalidated(configId)` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/codebase/backend/src/modules/model-config/model-config.service.ts`
- **기존 사용처**: `IntegrationCacheBus` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/codebase/backend/src/common/redis/integration-cache-bus.service.ts`. 동일 in-process Set-of-callbacks 패턴을 `register(invalidator)` / `invalidators` / `runInvalidators(id)` 로 명명한다.
- **상세**: 기능상 동형인 두 패턴이 다른 이름 체계를 쓴다. `IntegrationCacheBus` 는 `register`, `ModelConfigService` 는 `onConfigInvalidated`; `IntegrationCacheBus` 는 `invalidators`, `ModelConfigService` 는 `invalidationListeners`. 실제 식별자 충돌(같은 이름·다른 의미)은 없다 — 클래스 스코프가 완전히 다르다.
- **제안**: 두 패턴이 코드베이스에서 독립 진화해도 큰 문제는 없으나, 향후 공통 추상화(예: `CacheInvalidationBus` 인터페이스)를 도입한다면 명명을 통일하는 리팩토링을 검토한다. 현재 단계에서는 차단 사유 없음.

---

### [INFO] 두 NestJS 컨트롤러가 동일 `@Controller('model-configs')` 프리픽스 공유

- **target 신규 식별자**: `LlmModelConfigController` with `@Controller('model-configs')` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/codebase/backend/src/modules/llm/llm-model-config.controller.ts`
- **기존 사용처**: `ModelConfigController` with `@Controller('model-configs')` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/codebase/backend/src/modules/model-config/model-config.controller.ts`
- **상세**: NestJS 는 복수 컨트롤러가 동일 라우트 프리픽스를 공유하는 것을 허용한다. 핸들러 메서드(`preview-models`, `:id/test`, `:id/models`) 는 이전에 `ModelConfigController` 에 있었고 이번 diff 에서 제거된 뒤 `LlmModelConfigController` 로 이전됐다 — 중복 등록 없음. 단, 두 모듈(`llm`, `model-config`)에 걸쳐 같은 URL 공간을 분담하므로 라우트 테이블 탐색 시 혼동 가능성이 있다. 의도적 설계(C-2 cluster 4 forwardRef 제거)이며 클래스 JSDoc 에 명시됨.
- **제안**: 현 설계가 spec 요구(공개 API 경로 `model-configs` 불변)와 일치하고 실제 라우트 충돌은 없다. 추가 조치 불필요.

---

## 요약

이번 diff 가 도입한 신규 식별자(`LlmModelConfigController`, `onConfigInvalidated`, `notifyInvalidated`, `invalidationListeners`, `onConfigInvalidatedListener`) 는 기존 코드베이스에서 어떤 다른 의미로도 사용되지 않는다. API 엔드포인트 3개(`POST preview-models`, `POST :id/test`, `GET :id/models`)는 신규가 아니라 기존 `ModelConfigController` 에서 `LlmModelConfigController` 로 이전된 것이며, 이전 컨트롤러에서는 해당 핸들러가 제거됐으므로 실제 라우트 중복은 없다. 실질적인 식별자 충돌은 발견되지 않았으며, 3건은 모두 spec 추적 누락·명명 관례 불일치·설계 가시성 관련 INFO 수준 보완 제안이다.

## 위험도

NONE
