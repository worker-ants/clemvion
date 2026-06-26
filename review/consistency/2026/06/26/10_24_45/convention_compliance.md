# Convention Compliance Review

scope: `spec/2-navigation/6-config.md` (impl-done, diff-base=origin/main)

---

## 발견사항

### [WARNING] spec frontmatter `code:` 에 신규 구현 파일 미등재

- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/2-navigation/6-config.md` frontmatter `code:` 섹션
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 필드는 "본 spec 이 약속한 surface 의 구현 경로" 를 열거해야 한다
- **상세**: 이번 diff 로 신설된 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 는 `spec/2-navigation/6-config.md §3 Model Config API` 의 `preview-models` / `:id/test` / `:id/models` 엔드포인트를 직접 구현한다(파일 JSDoc 에도 "API 계약 SoT: spec/2-navigation/6-config.md §3" 명시). 그러나 spec frontmatter 의 `code:` 는 llm 모듈에서 `llm-preview.service.ts` 만 참조하며 신규 컨트롤러를 포함하지 않는다. `spec-code-paths.test.ts` 가드는 `codebase/backend/src/modules/model-config/**` 글로브가 여전히 매칭되므로 **빌드 차단은 발생하지 않지만**, spec evidence 가 의미상 불완전하다.
- **제안**: spec frontmatter `code:` 에 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 를 추가하거나, `codebase/backend/src/modules/llm/llm-model-config*` 글로브로 커버한다. llm.service.ts 의 `onModuleInit`(캐시 무효화 구독)도 이 spec surface 의 일부이므로 llm 모듈 글로브(`codebase/backend/src/modules/llm/**`)로 확장하는 것도 고려할 수 있다.

---

### [WARNING] `LlmModelConfigController` 전체 핸들러에 `@ApiUnauthorizedResponse` 누락

- **target 위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `previewModels`, `testConnection`, `listModels` 세 메서드 모두
- **위반 규약**: `spec/conventions/swagger.md §2-4` — "보호된 엔드포인트는 기본적으로 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })`를 포함합니다."
- **상세**: 컨트롤러 클래스에 `@ApiBearerAuth('access-token')` 가 선언돼 Bearer 인증 보호를 받지만, 세 핸들러 모두 `@ApiUnauthorizedResponse` 를 선언하지 않는다. Swagger 문서에서 401 응답이 누락된다.
- **제안**: 세 핸들러 각각에 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 를 추가한다. 동일 패턴의 기존 컨트롤러(`auth-configs.controller.ts` 등)를 참고한다.

---

### [WARNING] `testConnection` POST 핸들러 `@HttpCode(HttpStatus.OK)` 누락 — Swagger 문서와 실제 상태코드 불일치

- **target 위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts`, `testConnection` 메서드 (67번째 줄 내외)
- **위반 규약**: `spec/conventions/swagger.md §2-4` — "200 OK (조회/수정) → `@ApiOkResponse`", `§5-4` 체크리스트
- **상세**: `testConnection` 은 `POST :id/test` 핸들러로 `@ApiOkWrappedResponse(ModelTestConnectionResultDto, ...)` 를 선언해 200 을 문서화하지만, `@HttpCode(HttpStatus.OK)` 가 없어 NestJS 기본값인 **201** 이 실제 응답으로 전송된다. 같은 컨트롤러의 `previewModels` 는 `@HttpCode(HttpStatus.OK)` 를 올바르게 보유하므로 컨트롤러 내에서 불일치가 발생한다. (원래 `ModelConfigController` 의 `:id/test` 핸들러도 동일하게 `@HttpCode` 가 없었으므로, 기존 버그를 그대로 이전한 형태다.)
- **제안**: `testConnection` 핸들러에 `@HttpCode(HttpStatus.OK)` 를 추가한다. 참고: `previewModels` 핸들러 패턴과 일치시키면 된다.

---

## 요약

`spec/2-navigation/6-config.md` 의 문서 구조(Overview / 본문 / Rationale 3섹션) 와 명명 규약(`id: config`, `status: implemented`)은 준수됐다. 구현 diff 의 파일명(`llm-model-config.controller.ts`)·클래스명(`LlmModelConfigController`)·라우트 prefix(`model-configs`)·DTO 위치(`dto/responses/`)·공용 래퍼(`ApiOkWrappedResponse`) 도 규약과 일치한다. 그러나 세 가지 규약 위반이 있다: ① spec frontmatter `code:` 가 신규 컨트롤러를 포함하지 않아 spec-impl-evidence 규약상 의미 불완전, ② 보호 엔드포인트의 `@ApiUnauthorizedResponse` 전면 누락(swagger 규약), ③ `testConnection` POST 핸들러의 `@HttpCode(HttpStatus.OK)` 부재로 Swagger 문서(200)와 실제 HTTP 응답(201)이 불일치. 시스템 라우팅·기능 계약에는 영향이 없으나 API 문서 신뢰도와 spec evidence 정합성에 직결된다.

## 위험도

LOW
