# User Guide Sync Review

리뷰 범위: `origin/main..HEAD` (③ model-config polish, 2 commits — cc5b7c8b9 + da62c9be1)

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` 로드 완료 (19 rows). 변경 파일 전체 목록 (`git diff --name-only origin/main HEAD`):

- `codebase/backend/src/common/constants/throttle.ts` (신규)
- `codebase/backend/src/modules/llm/list-models-cap.spec.ts` (신규)
- `codebase/backend/src/modules/llm/list-models-cap.ts` (신규)
- `codebase/backend/src/modules/llm/llm-model-config.controller.ts` (수정)
- `codebase/backend/src/modules/llm/llm-preview.service.spec.ts` (수정)
- `codebase/backend/src/modules/llm/llm-preview.service.ts` (수정)
- `codebase/backend/src/modules/llm/llm.service.spec.ts` (수정)
- `codebase/backend/src/modules/llm/llm.service.ts` (수정)
- `codebase/backend/src/modules/model-config/dto/model-type.ts` (신규)
- `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (수정)
- `spec/2-navigation/6-config.md` (수정)
- `spec/5-system/2-api-convention.md` (수정)
- `spec/5-system/7-llm-client.md` (수정)
- `spec/data-flow/7-llm-usage.md` (수정)
- `plan/in-progress/mc-config-polish.md` 및 review/ 파일들

## 발견사항

해당 없음.

아래 각 매트릭스 행에 대해 변경 set 을 점검하였다.

### 제외 행 (trigger 매칭 없음)

| 행 id | 이유 |
|---|---|
| `new-node` | 변경 파일이 `codebase/backend/src/nodes/**` 외부 (`modules/llm/`, `modules/model-config/`, `common/constants/`). |
| `node-schema-change` | 동일 이유. |
| `new-ui-string` | 프론트엔드 TSX 파일 변경 없음. |
| `integration-provider-change` | semantic — 신규 provider 추가 없음. 기존 LLM 서비스에 방어적 캡(silent 500) 추가한 것으로 새 통합/제공자가 아님. |
| `new-userguide-section-dir` | `codebase/frontend/src/content/docs/` 하위 신규 디렉토리 없음. |
| `new-warning-code` | `list-models-cap.ts` 의 `logger?.warn(...)` 은 서버 내부 Logger warn (NestJS) — 사용자 가시 `warningRules` 코드 아님. |
| `new-error-code` | `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음. |
| `auth-session-flow-change` | `codebase/backend/src/modules/auth/**` 변경 없음. `workspaces.controller.ts` 의 throttle 상수 교체는 인증/세션 흐름 변경이 아님. |
| `auth-config-type-enum-change` | `MODEL_TYPE_ENUM` 은 listModels 필터이며, AuthConfig type enum 과 무관. |
| `expression-language-change` | `codebase/packages/expression-engine/**` 변경 없음. |
| `run-debug-flow-change` | 실행·디버깅 흐름 변경 없음. |
| `env-runtime-change` | 환경 변수·기동 방법 변경 없음. |
| `new-cross-cutting-enum` | `MODEL_TYPE_ENUM` 은 `interaction-type-registry.md` 대상 cross-cutting enum 아님. |
| `new-backend-ui-zod-value` | 변경된 파일에 zod ui.label/hint/group/itemLabel 값 없음. |
| `new-handler-output-field` | output.result.* 신규 키 없음. |
| `userguide-gui-flow-section` | `codebase/frontend/src/content/docs/` 파일 변경 없음. |
| `spec-defect-found` | 해당 없음. |

### 경계 행 — `backend-api-change` (semantic, 매칭됨)

- trigger 파일: `llm-model-config.controller.ts` (`*.controller.ts` glob), `workspaces.controller.ts`, `model-config/dto/model-type.ts` (`**/dto/**`)
- targets:
  1. "controller·DTO 의 swagger jsdoc" — **이미 처리됨.** RESOLUTION I-3 조치로 `@ApiTooManyRequestsResponse` 3 핸들러 추가 적용.
  2. "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" — **해당 없음.** 이번 변경의 user-facing 노출:
     - rate limit 10/min: 기존 동작 유지, 상수를 DRY 추출한 것뿐 (silent refactor).
     - model list cap 500: silent 하드캡으로 응답 계약(`ModelInfo[]`) 무변경. 정상 provider(수십 개)는 닿지 않으며, RESOLUTION I-15 에서 사용자 결정(B)으로 "silent 선택"이 명시됨. 사용자 가이드에 노출할 신규 동작 아님.
     - `ModelTypeFilter` DTO 추출: 내부 refactoring, 외부 계약 무변경.
  - 결론: swagger jsdoc target 충족; user-guide page target 은 "API 노출 변경이 사용자 안내에 영향" 조건 불충족 (모두 internal/silent 변경).

### 경계 행 — `spec-major-change` (glob, 매칭됨)

- trigger 파일: `spec/2-navigation/6-config.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/7-llm-client.md` (각각 `spec/2-*/**`, `spec/5-*/**` 글로브 매칭)
- targets: "frontmatter code: / status: / pending_plans: 정합 갱신", "status: implemented 이면 code: 글로브 ≥1 매치 보장"
- 이 행의 대상은 **spec 자체 frontmatter 정합**이며 user-guide MDX 갱신이 아님.
- RESOLUTION I-17 로 `spec/5-system/7-llm-client.md` frontmatter `code:` 에 `list-models-cap.ts` 등록 완료. 다른 spec 변경(api-convention, 6-config)은 기존 spec 본문 보강으로 frontmatter 무변경 정합 범위.
- user-guide sync 관점: 이 행은 유저 가이드 MDX 동반 갱신을 요구하지 않음 — 영역 외.

## 요약

매트릭스 19개 trigger 전체 점검. 변경 set 은 백엔드 인프라 리팩터링(throttle 상수 DRY 추출, model list cap 유틸리티 신설, DTO 타입 추출)과 그에 따른 spec 보강·테스트 추가로 구성된다. `backend-api-change` 행과 `spec-major-change` 행이 파일 패턴으로 매칭되나, 각각의 user-guide 갱신 target 조건(사용자 가시 행동 변화·user-guide MDX 갱신)이 이번 변경에 적용되지 않는다. 신규 UI 문자열·i18n dict 변경·backend-labels 변경·docs MDX 변경·신규 섹션 디렉토리·auth 흐름 변경·warningCode/errorCode 추가 중 해당 항목이 없어 동반 갱신 누락 없음. 매칭 trigger 2건 / 누락 0건.

## 위험도

NONE
