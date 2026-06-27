# Code Review 통합 보고서

**대상 브랜치**: `claude/mc-test-authz-7b3bbc`
**검토 일시**: 2026-06-27
**변경 개요**: `LlmModelConfigController.testConnection` 에 `@Roles('editor')` 추가 + `@ApiForbiddenResponse` Swagger 선언 + 단위/e2e 테스트 보강 + spec §3·R-7·LLM Client §8.3 동행

---

## 전체 위험도

**LOW** — Critical 0건, Warning 4건. 인가 갭 차단 자체는 보안·spec 완전 일치. 경고 항목은 테스트 커버리지 갭(W1), 테스트 구현 결합(W2), 매직 스트링 확산(W3), CHANGELOG 누락(W4)으로 즉각적 장애 위험 없음.

> 실행 메모: Workflow router 매핑 버그로 reviewers:[] 반환 → fallback 평문 Agent fan-out 으로 8개 reviewer 재실행.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | Testing | e2e 케이스 H 가 spec §3·R-7 전체를 SoT 로 참조하면서 `POST preview-models` viewer→403 단언 누락 — `previewModels` `@Roles('editor')` 가 향후 제거돼도 이 e2e 에서 잡히지 않음 | `codebase/backend/test/workspace-rbac.e2e-spec.ts` 케이스 H | 케이스 H 에 viewer→`preview-models` 403 단언 추가 |
| W2 | Testing | `editorTest.body.data.success` 단언이 authz 목적을 초과해 "미존재 config → catch 흡수 → `200 { success: false }`" 구현 세부에 결합 | `codebase/backend/test/workspace-rbac.e2e-spec.ts` editor 블록 | body/200 단언 제거, authz 단언(`not.toBe(403)`)만 유지 |
| W3 | Maintainability | `Reflect.getMetadata('roles', ...)` 키 문자열이 테스트에 매직 스트링으로 하드코딩 | `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` | `roles.guard.ts` 의 `ROLES_KEY` 상수 import 참조로 교체 |
| W4 | Documentation | CHANGELOG 에 `:id/test` Viewer→Editor+ breaking behavior change 미기재 | `CHANGELOG.md` `## Unreleased` | breaking change 항목 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 처분 |
|---|----------|----------|------|
| I1 | Security | `@Query('type')` 런타임 열거형 강제 없음 (pre-existing) | 별건 — defer |
| I2 | Security | `previewModels` apiKey 로그 마스킹 확인 (pre-existing) | 별건 — defer |
| I3 | API Contract | `testConnection` 미존재 config → 200 + `{success:false}` (pre-existing best-effort) | 현행 유지 |
| I4 | API Contract | breaking change 외부 공지 권장 | W4 CHANGELOG 로 일부 충족 |
| I5 | API Contract | `listModels` 페이지네이션 미적용 (pre-existing) | 별건 — defer |
| I6 | API Contract/Doc | `listModels` workspace membership 403 미문서화 | 인라인 주석으로 의도 명시 (반영) |
| I7 | Testing | `X-Workspace-Id` 미전송 시 RolesGuard false 경로 미테스트 (pre-existing guard) | 별건 — defer |
| I8 | Testing | admin/owner 계층 긍정 경로 미검증 (케이스 C·D·E 가 커버) | 추가 불필요 |
| I9 | Maintainability | 테스트 설명 언어 혼용 | 영어 통일 (반영) |
| I10 | Maintainability | `@Throttle` 매직 넘버 반복 (pre-existing) | 별건 — defer |
| I11 | Maintainability | `not.toBe(403)` + `toBe(200)` 중복 단언 | W2 와 함께 정리 (반영) |
| I12 | Documentation | e2e-spec 파일 상단 JSDoc invariants 에 케이스 H 미기재 | 반영 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `@Roles('editor')` 인가 갭 봉쇄 확인. I1·I2 (pre-existing) |
| api_contract | LOW | I3·I4·I5·I6 모두 INFO, 차단 없음 |
| requirement | LOW | spec §3·R-7 완전 일치 |
| testing | LOW | W1 preview-models e2e 누락, W2 body 단언 결합 |
| scope | NONE | 범위 이탈 없음 |
| side_effect | LOW | 의도된 인가 변경 외 부작용 없음 |
| maintainability | LOW | W3 매직 스트링, I9·I10·I11 |
| documentation | LOW | W4 CHANGELOG 누락, I12 |

---

## 발견 없는 에이전트

- **scope** — 변경 범위가 핵심 의도(testConnection Editor+ 가드)와 일관. 무관 수정·포맷팅 혼입 없음.
- **side_effect** — 의도하지 않은 전역 상태·외부 호출·이벤트 흐름 변경 없음.

---

## 라우터 결정

라우터 미사용 — Workflow router 매핑 버그로 fallback 평문 Agent fan-out 실행.

**실행된 reviewer (8명)**: security, api_contract, requirement, testing, scope, side_effect, maintainability, documentation

**제외된 reviewer (6명)**: performance(성능 특성 불변)·architecture(구조 유지)·dependency(신규 의존성 없음)·database(스키마/쿼리 무변)·concurrency(동시성 무관)·user_guide_sync(최종 사용자 가이드 무변)

---

STATUS=success CRITICAL=0 WARNING=4 RISK=low PATH=/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/review/code/2026/06/27/11_46_32/SUMMARY.md
