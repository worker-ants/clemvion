# Requirement Review — C-2 cluster 4: llm↔model-config forwardRef 순환 제거

## 발견사항

### [SPEC-DRIFT] `spec/data-flow/7-llm-usage.md` line 50: 컨트롤러 파일명 스테일
- **[WARNING]**
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/data-flow/7-llm-usage.md` line 50
- 상세: spec 본문이 "부속 엔드포인트 (`model-config.controller.ts`)" 로 명기하고 있으나, 본 변경으로 3개 LLM 부속 엔드포인트(`preview-models`, `:id/test`, `:id/models`)는 `llm-model-config.controller.ts` 로 이전됐다. 코드가 합리적·의도적 구조 개선이므로 파일명 참조만 낡았다. 코드 되돌리기가 아니라 spec 갱신이 필요하다.
- 제안: 코드 유지 + spec 반영. `spec/data-flow/7-llm-usage.md` line 50의 `model-config.controller.ts` → `llm-model-config.controller.ts` (부속 엔드포인트 소유자) 로 갱신.

### [SPEC-DRIFT] `spec/data-flow/7-llm-usage.md` line 54: 캐시 무효화 경로 서술 스테일
- **[WARNING]**
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/data-flow/7-llm-usage.md` line 54
- 상세: spec 본문이 "config 수정/삭제 시 controller 가 `LlmService.clearClientCache(id)` 를 호출해 … 무효화한다" 고 기술하나, 본 변경 후 실제 경로는 `ModelConfigService.update/remove` → `notifyInvalidated(id)` → `LlmService.onModuleInit` 에 등록된 리스너(`clearClientCache`) 다. controller 직접 호출이 아닌 옵저버 패턴으로 역전됐다. 구현이 옳고 spec만 낡았다.
- 제안: 코드 유지 + spec 반영. `spec/data-flow/7-llm-usage.md` line 54를 "config 수정/삭제 시 `ModelConfigService`가 `notifyInvalidated(id)` 로 리스너들에 통지하고, `LlmService.onModuleInit` 에 등록된 `clearClientCache` 리스너가 client·listModels 캐시를 무효화한다" 로 갱신.

### [SPEC-DRIFT] `spec/2-navigation/6-config.md` frontmatter `code:` 누락
- **[WARNING]**
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/2-navigation/6-config.md` frontmatter lines 4–12
- 상세: `code:` 배열에 `codebase/backend/src/modules/llm/llm-preview.service.ts` 는 있지만, 본 변경으로 신규 생성된 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 가 누락돼 있다. 이 파일은 `model-configs` 라우트의 LLM 부속 엔드포인트를 소유하므로 spec 코드 링크의 단일 진실에 포함돼야 한다.
- 제안: 코드 유지 + spec 반영. `spec/2-navigation/6-config.md` frontmatter `code:` 배열에 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 추가.

### [INFO] `notifyInvalidated` 리스너 예외 전파 미방어
- **[INFO]**
- 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` — `notifyInvalidated` 메서드 (라인 ~3029)
- 상세: `notifyInvalidated` 가 리스너를 순회 호출할 때 try-catch 없이 호출한다. 현재 유일한 리스너인 `clearClientCache` 는 `Map.delete` 와 `Map.keys()` 순회뿐이므로 예외가 발생하지 않는다. 그러나 향후 리스너가 추가될 경우 리스너 예외가 `update/remove` 호출 스택 전체를 실패시킬 수 있다. 코드 주석("리스너는 throw 하지 않는 멱등 무효화여야 한다")이 계약을 문서화하지만 코드 레벨 방어는 없다.
- 제안: 현재 사용 패턴에서 실제 문제는 아니다. 향후 리스너 추가 시 `try-catch` 로 리스너별 예외를 격리하고 `logger.warn` 으로 흡수하는 방식을 검토한다.

### [INFO] `POST :id/test` — `@HttpCode(HttpStatus.OK)` 미선언
- **[INFO]**
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` lines 378–393 (`testConnection` 핸들러)
- 상세: `@Post` 핸들러에 `@HttpCode(HttpStatus.OK)` 가 없어 NestJS 기본값 201 이 반환된다. 같은 컨트롤러의 `previewModels`(`@HttpCode(HttpStatus.OK)` 선언됨)와 불일치한다. 단, 이것은 기존 `ModelConfigController`의 `testConnection` 도 동일하게 `@HttpCode` 를 선언하지 않았으므로 **verbatim 이전**의 결과다 — 회귀 아님. spec 의 API 표가 HTTP 상태코드를 명시하지 않는다.
- 제안: 이 이슈는 본 변경 범위 밖의 기존 패턴이다. 별건으로 수정하거나 유지할 수 있다.

---

## 요약

C-2 cluster 4 리팩토링(llm↔model-config forwardRef 순환 제거)은 기능 요구사항을 완전히 충족한다. LLM 부속 3 엔드포인트(`preview-models`, `:id/test`, `:id/models`)가 `LlmModelConfigController` 로 verbatim 이전돼 라우트·데코레이터·응답 계약이 불변하며, 캐시 무효화는 옵저버 패턴으로 역전돼 model-config → llm 역의존이 완전히 제거됐다. 발견된 이슈 전체가 SPEC-DRIFT(코드가 옳고 spec 문서가 낡음) 또는 INFO 수준이며, 코드 롤백이나 수정이 필요한 CRITICAL/WARNING 결함은 없다. SPEC-DRIFT 3건은 `spec/data-flow/7-llm-usage.md`(컨트롤러 파일명·캐시 무효화 경로 서술)과 `spec/2-navigation/6-config.md`(frontmatter code 누락)를 `project-planner` 가 갱신해 해소해야 한다.

---

## 위험도

LOW
