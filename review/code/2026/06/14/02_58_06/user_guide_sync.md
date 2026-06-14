# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

해당 없음.

변경 파일은 다음 두 개다.

- `codebase/backend/src/modules/workflows/workflows.service.ts` — `findAll` 정렬 로직에 `sort='last_run'` 분기 추가 (correlated subquery)
- `codebase/backend/src/modules/workflows/workflows.service.spec.ts` — 위 분기에 대한 단위 테스트 3건 추가

매트릭스 전체 19개 row 에 대해 순차 매칭한 결과:

| 매트릭스 row | 판정 | 근거 |
|---|---|---|
| `new-node` (glob: `codebase/backend/src/nodes/**`) | 불일치 | 변경 파일은 `src/modules/workflows/` — `src/nodes/` 아님 |
| `node-schema-change` (glob: 동일) | 불일치 | 동일 이유 |
| `new-ui-string` (semantic: TSX 한국어 리터럴) | 불일치 | TSX 파일 변경 없음 |
| `integration-provider-change` (semantic) | 불일치 | 통합 provider 변경 없음 |
| `new-userguide-section-dir` (glob: `docs/*/`) | 불일치 | docs 디렉토리 변경 없음 |
| `backend-api-change` (semantic: controller·DTO) | 경계 검토 후 불일치 | controller·DTO 파일 변경 없음. `QueryWorkflowDto` 의 `sort` 필드는 기존 API 에 이미 존재하며, 이번 변경은 service 레이어의 내부 쿼리 분기 구현. Swagger jsdoc/DTO 변경이 없어 trigger 조건 불충족. `sort='last_run'` 이 DTO 에서 신규 허용값으로 추가된다면 DTO 변경이 별도 필요하나, 해당 변경은 본 diff 에 없음 |
| `new-warning-code` (semantic) | 불일치 | 신규 warningRules 없음 |
| `new-error-code` (glob: `error-codes.ts`) | 불일치 | `error-codes.ts` 변경 없음 |
| `new-cross-cutting-enum` (semantic) | 불일치 | 신규 enum 값 없음 |
| `new-backend-ui-zod-value` (semantic) | 불일치 | `ui.label`/`hint`/`group` 변경 없음 |
| `new-handler-output-field` (semantic) | 불일치 | handler output field 변경 없음 |
| `auth-session-flow-change` (glob: `src/modules/auth/**`) | 불일치 | auth 파일 변경 없음 |
| `auth-config-type-enum-change` (semantic) | 불일치 | AuthConfig 변경 없음 |
| `expression-language-change` (glob: `packages/expression-engine/**`) | 불일치 | 변경 없음 |
| `run-debug-flow-change` (semantic: 실행·디버깅 흐름) | 불일치 | 워크플로 목록 정렬은 실행·디버깅 흐름이 아님 |
| `env-runtime-change` (semantic) | 불일치 | 환경 변수·기동 방법 변경 없음 |
| `spec-major-change` (glob: `spec/{2,3,4,5}-**.md` 등) | 불일치 | spec 파일 변경 없음 |
| `userguide-gui-flow-section` (glob: `02-nodes/**.mdx` 등, semantic) | 불일치 | docs MDX 변경 없음 |
| `spec-defect-found` (semantic) | 불일치 | spec 결함 발견 아님 |

## 요약

매트릭스 19개 trigger 전체를 검토했으며, 이번 변경(workflows 서비스 `last_run` 정렬 구현 + 단위 테스트 추가)은 어느 trigger 에도 매칭되지 않는다. 노드 추가·UI 문자열·인증 흐름·표현식·에러/경고 코드·docs 섹션 중 어느 것도 변경되지 않았다. 매칭 0건, 누락 0건.

## 위험도

NONE
