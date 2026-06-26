# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

해당 없음.

## 매트릭스 적재 및 분석

매트릭스 행 19개 전체를 대상으로 분석했다. 변경 파일 전체 목록:

- `codebase/backend/src/modules/llm/llm-model-config.controller.ts` (신규)
- `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` (신규)
- `codebase/backend/src/modules/llm/llm.module.ts` (수정)
- `codebase/backend/src/modules/llm/llm.service.ts` (수정)
- `codebase/backend/src/modules/llm/llm.service.spec.ts` (수정)
- `codebase/backend/src/modules/model-config/model-config.controller.ts` (수정)
- `codebase/backend/src/modules/model-config/model-config.controller.spec.ts` (수정)
- `codebase/backend/src/modules/model-config/model-config.module.ts` (수정)
- `codebase/backend/src/modules/model-config/model-config.service.ts` (수정)
- `codebase/backend/src/modules/model-config/model-config.service.spec.ts` (수정)
- `plan/in-progress/refactor/02-architecture.md` (수정)

### 각 trigger 매칭 결과

| 매트릭스 행 ID | 판정 | 근거 |
|---|---|---|
| new-node | 불일치 | 변경 파일이 `codebase/backend/src/nodes/**` 경로 아님 (`modules/` 하위) |
| node-schema-change | 불일치 | 동일 |
| new-ui-string | 불일치 | TSX 파일 변경 없음 |
| integration-provider-change | 불일치 (semantic) | 신규/변경 provider 없음 — 순수 내부 아키텍처 리팩토링 |
| new-userguide-section-dir | 불일치 | `codebase/frontend/src/content/docs/` 하위 변경 없음 |
| backend-api-change | semantic 판단 — **비해당** | `llm-model-config.controller.ts`·`model-config.controller.ts` 가 glob `codebase/backend/src/**/*.controller.ts` 에 형식 매칭되나 trigger가 `match: "semantic"`. 커밋 메시지 "behavior-preserving (라우트·응답·캐시 무효화 시점 불변)", "공개 API 무변"이 명시돼 있고, 3개 엔드포인트는 verbatim 이전(신규 라우트·DTO 없음). 새 컨트롤러에 Swagger jsdoc(target 1) 완비. API 노출 변경 없으므로 user-guide 페이지 갱신 불요(target 2). |
| new-warning-code | 불일치 (semantic) | warningRules 변경 없음 |
| new-error-code | 불일치 | `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음 |
| new-cross-cutting-enum | 불일치 (semantic) | cross-cutting enum 추가 없음 |
| new-backend-ui-zod-value | 불일치 (semantic) | zod ui.label/hint/group 신규 값 없음 |
| new-handler-output-field | 불일치 (semantic) | handler output field 변경 없음 |
| auth-session-flow-change | 불일치 | 변경 파일이 `codebase/backend/src/modules/auth/**` 아님 |
| auth-config-type-enum-change | 불일치 (semantic) | AuthConfig type enum 변경 없음 |
| expression-language-change | 불일치 | `codebase/packages/expression-engine/**` 변경 없음 |
| run-debug-flow-change | 불일치 (semantic) | 실행·디버깅 흐름 사용자 노출 변경 없음 (순수 모듈 DI 구조 리팩토링) |
| env-runtime-change | 불일치 (semantic) | 환경 변수·기동 방법 변경 없음 |
| spec-major-change | 불일치 | `plan/` 파일이 변경됐으나 `spec/` 파일 변경 없음 |
| userguide-gui-flow-section | 불일치 (semantic) | docs MDX 파일 변경 없음 |
| spec-defect-found | 불일치 (semantic) | spec 결함 발견 없음 |

## 요약

매트릭스 19개 trigger 전체를 검토한 결과, 이번 변경 집합은 어떤 trigger 에도 유효하게 매칭되지 않는다. 이 변경은 `llm` ↔ `model-config` 모듈 간 forwardRef 순환을 제거하는 순수 내부 아키텍처 리팩토링으로, 공개 API(라우트·응답·HTTP 계약)가 불변하고 사용자 노출 기능(노드·UI 문자열·통합 설정·표현식·실행흐름·인증)에 영향을 주지 않는다. 매트릭스 trigger 19개 중 매칭 0건, 누락 0건.

## 위험도

NONE
