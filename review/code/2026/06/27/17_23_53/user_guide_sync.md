# User Guide Sync Review

## 발견사항

### [INFO] `spec/5-system/7-llm-client.md` code: 글로브에 `list-models-cap.ts` 미등록

- 변경 파일: `spec/5-system/7-llm-client.md` (trigger glob `spec/5-*/**` 매칭)
- 매트릭스 항목: `spec-major-change` — "status: implemented 이면 code: 글로브 ≥1 매치 보장"
- 누락된 동반 갱신: `spec/5-system/7-llm-client.md` 의 `code:` frontmatter 항목
- 상세: 해당 spec 파일의 §5.5 본문이 `MAX_MODEL_LIST_SIZE, llm/list-models-cap.ts` 를 이름으로 명시했으나, frontmatter `code:` 목록에 `codebase/backend/src/modules/llm/list-models-cap.ts` 가 없다. 현재 `code:` 에 `llm.service.ts` / `llm-preview.service.ts` 가 있어 `≥1 매치` 조건은 충족하므로 테스트 차단은 아니다. 그러나 spec 본문이 구현 파일을 직접 참조하는데 code: 글로브에서 누락되면 spec-impl-evidence 커버리지 추적의 회색 지대를 남긴다.
- 제안: `spec/5-system/7-llm-client.md` frontmatter `code:` 목록에 `codebase/backend/src/modules/llm/list-models-cap.ts` 1행 추가. 기능 차단 없이 커버리지를 명확히 할 수 있다.

---

## 비매칭 판정 (영역 무관)

아래 trigger 는 모두 매칭되지 않음:

| 검사 항목 | 판정 이유 |
|---|---|
| `new-node` / `node-schema-change` | `codebase/backend/src/nodes/**` 변경 없음 |
| `new-ui-string` | `.tsx` 파일 변경 없음 |
| `integration-provider-change` | 신규/변경 provider 없음 — cap·throttle 상수 추출은 내부 방어 코드이며 provider schema 무변경 |
| `new-userguide-section-dir` | frontend docs 디렉토리 신규 생성 없음 |
| `new-warning-code` | `capModelList` 의 `Logger.warn` 은 인프라 로그이고 비즈니스 warningRules warningCode 아님 |
| `new-error-code` | `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음 |
| `new-cross-cutting-enum` | `MODEL_TYPE_ENUM` 은 기존 인라인 값(`chat`/`embedding`)을 DTO 파일로 추출한 리팩터링이며 값 자체 추가 없음 |
| `new-backend-ui-zod-value` | 신규 `ui.label`/`hint`/`group` 값 없음 |
| `new-handler-output-field` | 신규 `output.result.*` 키 없음 |
| `auth-session-flow-change` | `workspaces.controller.ts` 변경은 throttle 상수 참조 교체만이며 인증·권한·세션 흐름 미변경, `auth` 모듈 파일 없음 |
| `auth-config-type-enum-change` | AuthConfig type enum 변경 없음 |
| `expression-language-change` | expression-engine 변경 없음 |
| `run-debug-flow-change` | 실행·디버깅 흐름 변경 없음 |
| `env-runtime-change` | 환경 변수·기동 방법 변경 없음 |
| `userguide-gui-flow-section` | 신규 GUI 흐름 절 없음 |
| `spec-defect-found` | spec 자체 누락·오류 없음 |

**`backend-api-change` trigger 매칭 검토**:
- `llm-model-config.controller.ts`, `model-type.ts`, `workspaces.controller.ts` 가 controller/DTO 패턴에 매칭.
- 대상 요구사항 "controller·DTO 의 swagger jsdoc" → 세 파일 모두 `@ApiOperation`, `@ApiParam`, `@ApiQuery`, `@ApiOkWrappedResponse` 등 jsdoc 이 완비됨.
- "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" → cap(500건 상한)은 정상 provider 응답(수십 건)에서는 절대 도달하지 않는 silent 방어 가드이며 사용자 안내 갱신을 필요로 하지 않음. `enumName` 추가는 OpenAPI named enum 개선이며 행동 변경 없음.
- 결론: swagger jsdoc 목표 충족됨, user-guide 갱신 불필요. 추가 지적 사항 없음.

**`spec/data-flow/7-llm-usage.md` 변경**: `spec/data-flow/**` 경로는 `spec-major-change` trigger 글로브(`spec/2-*/**`, `spec/3-*/**`, `spec/4-*/**`, `spec/5-*/**`, `spec/conventions/**`) 어디에도 해당하지 않음. 매트릭스에서 커버되는 trigger 없음.

**`spec/2-navigation/6-config.md` spec-major-change 검토**: `status: implemented`, `code:` 에 `codebase/backend/src/modules/llm/llm-preview.service.ts` 및 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 포함 — 본 PR 에서 두 파일 모두 수정됨. ≥1 매치 조건 충족. frontmatter 정합 문제 없음.

---

## 요약

매트릭스 19개 trigger 중 `backend-api-change`(semantic), `spec-major-change`(glob) 2개가 매칭됐다. `backend-api-change` 는 swagger jsdoc 완비 확인으로 목표 충족. `spec-major-change` 는 두 spec 파일의 frontmatter(`status`, `code:`, `pending_plans`)가 일관성을 유지하며 조건을 충족하나, `spec/5-system/7-llm-client.md` 본문이 `list-models-cap.ts` 를 직접 명시함에도 `code:` 글로브에서 누락된 점이 INFO 1건이다. docs MDX·i18n dict·backend-labels 의 동반 갱신 누락은 없음.

## 위험도

LOW
