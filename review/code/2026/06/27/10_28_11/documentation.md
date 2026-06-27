# Documentation Review — refactor-02 C-2 cluster 4

## 발견사항

### [WARNING] `testConnection` 엔드포인트에 `@Roles` 및 `@ApiForbiddenResponse` 누락

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/codebase/backend/src/modules/llm/llm-model-config.controller.ts` line 77–95 (`testConnection`)
- 상세: `POST /api/model-configs/:id/test` 는 spec/2-navigation/6-config.md §3 의 "mutation (POST / PATCH / DELETE) 은 Editor+" 규칙에 따라 Editor+ 권한이 필요하다. 같은 파일의 `previewModels` (POST)는 `@Roles('editor')` + `@ApiForbiddenResponse`가 선언되어 있고, `model-config.controller.ts` 의 모든 POST/PATCH/DELETE 도 동일 패턴을 따른다. 그러나 `testConnection`에는 두 데코레이터가 모두 없어 Swagger 문서에 403 응답이 표시되지 않고, 실제 권한 가드도 선언되지 않은 상태다.
- 제안: `testConnection` 메서드에 `@Roles('editor')` 와 `@ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })` 를 추가해 `previewModels` 및 `model-config.controller.ts` 의 mutation 패턴과 일치시킨다.

---

### [INFO] `spec/5-system/7-llm-client.md` code 프런트매터에 `llm-model-config.controller.ts` 미등록

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/5-system/7-llm-client.md` 프런트매터 `code:` 목록
- 상세: `llm-model-config.controller.ts` 는 llm 모듈에 속하며 llm 서비스 계층(`LlmService`, `LlmPreviewService`)을 직접 주입해 공개 API를 노출한다. 현재 이 파일은 `spec/2-navigation/6-config.md` 의 code 목록에만 등록되어 있다. llm-client spec 관점에서 컨트롤러는 서비스 계층의 진입점이므로, llm-client.md 의 code 목록에도 추가하면 spec ↔ 구현 추적이 단일 경로로 유지된다. `spec/2-navigation/6-config.md` 가 API Surface SoT 역할을 하고 `spec/5-system/7-llm-client.md` 는 서비스/인터페이스 계층 SoT 이므로, 컨트롤러를 navigation spec 만에 두는 것도 논리적으로 수용 가능하다 — 팀 규약에 따라 결정.
- 제안: `spec/5-system/7-llm-client.md` 의 `code:` 에 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 를 추가하거나, 현행 분류(navigation spec 소속)가 의도적임을 Rationale 에 한 줄 명시한다.

---

### [INFO] `spec/data-flow/7-llm-usage.md` Overview "코드 진입점" 목록에 새 컨트롤러 미반영

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/data-flow/7-llm-usage.md` Overview 섹션 "코드 진입점"
- 상세: Overview "코드 진입점" 목록은 서비스 파일 5종을 나열하지만 `llm-model-config.controller.ts` 는 없다. §1.1 본문에서는 이미 새 파일명을 언급하고 있어 이중 기록이 되지만, Overview 가 컨트롤러를 제외하는 패턴을 유지하는 것이라면 현행대로 두어도 일관성은 있다.
- 제안: 패턴이 "서비스/팩토리만 나열"이라면 현행 유지. 컨트롤러도 진입점으로 간주한다면 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 항목을 추가한다.

---

## 긍정 사항

- **클래스 JSDoc 우수**: `LlmModelConfigController` 의 클래스 레벨 주석은 설계 결정의 "왜"를 명확히 설명하고 있으며(`forwardRef 순환 → 단방향 의존 전환`), `ModelConfigService.invalidationListeners` / `onConfigInvalidated` / `notifyInvalidated` 도 각각 상세한 JSDoc을 갖추고 있다.
- **Swagger 데코레이터 완결성**: 세 엔드포인트의 `@ApiOperation`, `@ApiParam`, `@ApiQuery`, `@ApiBody`, 응답 타입, 오류 응답(`Unauthorized`, `NotFound`)이 빠짐없이 선언되어 있다 (`testConnection`의 `Forbidden` 누락은 위 WARNING 에서 지적).
- **Spec 3종 동기화 완료**: `spec/2-navigation/6-config.md`, `spec/5-system/7-llm-client.md`, `spec/data-flow/7-llm-usage.md` 가 forwardRef 제거 사실 및 컨트롤러 재배치를 일관되게 반영한다.
- **Rationale 갱신 정확**: llm-client.md 와 data-flow spec 모두 "종전 forwardRef 순환 → 옵저버 역전 → 단방향" 의 근거와 결과를 구체적으로 기술하고 있다.

---

## 요약

이번 변경은 `LlmModule ↔ ModelConfigModule` forwardRef 순환 제거를 위해 부속 엔드포인트를 `LlmModelConfigController` 로 재배치하고 세 개의 spec 파일을 동기화한 리팩토링이다. 문서화 측면에서 spec과 코드의 정합은 전반적으로 양호하고 클래스 주석·Swagger 데코레이터도 충실하다. 단, `testConnection` (POST) 엔드포인트에 spec이 요구하는 Editor+ 권한을 나타내는 `@Roles('editor')` 와 `@ApiForbiddenResponse` 가 누락되어 Swagger 문서와 spec 간 불일치가 있다. `previewModels` 와 `model-config.controller.ts` 가 모두 같은 패턴을 일관되게 적용하는 상황에서 `testConnection` 만 예외여서 누락으로 판단된다.

## 위험도

LOW
