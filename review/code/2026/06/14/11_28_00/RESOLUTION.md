# RESOLUTION — 11_28_00

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #2 | 코드 | 29a24c5d | `buildTypeConfig(state, mode)` 헬퍼 추출 — `buildAuthConfigPayload`·`buildAuthConfigUpdatePayload` 조립 로직 중복 제거 |
| #3 | 코드 | 29a24c5d | `validateAndProceed()` 공통 검증 헬퍼 추출 — `handleCreate`·`handleUpdate` 중복 제거 |
| #5 | 코드 | 29a24c5d | `update()` 구조분해로 `id`/`workspaceId`/`type` 명시 제외 (서비스 직접 호출 type 변경 의도 차단) |
| #6 | 코드 | 29a24c5d | 서비스 spec 4개 update 테스트 → `describe('update — shallow-merge·비밀값 보호')` 별도 블록 이동; 테스트 명 의미론 정정 |
| #7 | 코드 | 29a24c5d | `formStateFromAuthConfig` bearer_token 케이스 테스트 추가 |
| #1 | — | (보류) | Fat Component 추출 → 보류·후속 항목 참조 |
| #4 | — | (보류) | 11개 `useState` 통합 → 보류·후속 항목 참조 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 passed)
- e2e   : 통과 (190/190)

## 보류·후속 항목

- WARNING 1·4 → `plan/in-progress/spec-sync-config-gaps.md` God Component 분리 후속 항목에 기록 (ai-review 2026-06-14 WARNING 1·4 재확인 — edit 폼 `useState` 통합 포함). create+edit 통합 리팩토링은 별도 PR 에서 수행. 현재 편집 폼 PR 에서 create 경로까지 건드리는 대규모 구조 리팩토링은 scope 이탈·회귀 위험으로 **의도적 분리**.
- INFO #14 (유저 가이드 페이지 신설): `codebase/frontend/src/content/docs/06-integrations-and-config/auth-config.mdx` 신설 — 후속 plan 으로 기록.
