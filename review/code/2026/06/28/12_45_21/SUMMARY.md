# Code Review 통합 보고서

> 세션: `review/code/2026/06/28/12_45_21`
> 대상: WH-EP-05-2 — webhook/manual-trigger 400 응답 `error.details[]` surface 구현

## 전체 위험도

**LOW** — 기능 구현 완전성·보안·범위·부작용 모두 이상 없음. CHANGELOG 누락(client-visible API 변경) 및 복수의 문서/유지보수 INFO가 남아 있으나 차단 수준 발견사항 없음.

## Critical 발견사항

_없음._

## 경고 (WARNING)

_없음._

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | DOCUMENTATION | CHANGELOG 미업데이트 — `errors[]` → `details[]` 는 client-visible API surface 변경이나 Unreleased 섹션에 항목 없음 | `CHANGELOG.md` | Unreleased 섹션에 "webhook/manual-trigger 400 응답 필드별 사유가 `errors[]` 에서 `error.details[]` 로 이동, field code UPPER_SNAKE_CASE" 추가 권장 |
| 2 | MAINTAINABILITY / TESTING | e2e B3에서 `UPDATE node SET config = $1 ...` 직접 DB 조작 — 스키마 변경 시 조용히 깨질 수 있고 다른 e2e와 이질적 | `codebase/backend/test/webhook-trigger.e2e-spec.ts` (B3) | `setupNodeWithParameters(db, wfId, parameters)` 헬퍼 추출 후속 작업 |
| 3 | DOCUMENTATION | `TriggerParameterDefinition` / `TriggerParameterValidationError` 기존 인터페이스에 JSDoc 없음 — 신규 추가 인터페이스와 품질 격차 | `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` L3–13 | 간단한 한 줄 JSDoc 추가 (후속 작업) |
| 4 | DOCUMENTATION | `toTriggerParameterErrorDetails` JSDoc에 `invalid_schema`가 런타임 webhook/manual 경로에서 미도달임이 미기재 | 동 파일 L65–73 | `@remarks invalid_schema is mapped for completeness; not reachable from runtime webhook/manual-trigger paths` 추가 (선택) |
| 5 | DOCUMENTATION | `workflows.controller.ts` 인라인 주석의 spec 참조가 파일 경로 미포함 (`manual-trigger §6`) — `hooks.service.ts`(`spec 12-webhook §5.2`)와 형식 불일치 | `codebase/backend/src/modules/workflows/workflows.controller.ts` L302–307 | `spec/4-nodes/7-trigger/1-manual-trigger.md §6` 형식으로 통일 (필수 아님) |
| 6 | SECURITY | `TriggerParameterValidationException` super() 메시지에 내부 reason 문자열 포함 — 현재 catch-rethrow 구조상 클라이언트 미노출이나 방어적 설계 관점 개선 권장 | `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` L157–161 | `super('Trigger parameter validation failed')` 로 단순화하고 내부 상세는 `this.errors` 에만 보관 (비긴급) |
| 7 | TESTING | 단위 테스트에서 `response.errors` 가 `undefined` 임을 단언하지 않음 — e2e(B3)에는 구 포맷 회귀 단언 존재하나 unit 레벨 미존재 | `hooks.service.spec.ts`, `workflows.controller.spec.ts` | 각 단위 테스트에 `expect(response.errors).toBeUndefined()` 추가 권장 (선택적 보강) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `TriggerParameterValidationException` super() 메시지 내 내부 reason 포함 (방어적 개선 권장, 현재 미노출). `errors`→`details` 교체는 오히려 정보 은닉 개선. |
| requirement | NONE | WH-EP-05-2 요구사항 완전 구현. 두 경로 모두 spec line-level 일치. CRITICAL/WARNING 없음. |
| scope | NONE | 전 변경 파일이 WH-EP-05-2 단일 목표에 귀속. 범위 이탈 없음. |
| side_effect | NONE | 순수 additive 리팩터링. 전역 상태·파일시스템·네트워크·환경변수·이벤트 부작용 없음. |
| maintainability | LOW | e2e 직접 DB 조작 이질성, 기존 인터페이스 JSDoc 부재, 주석 spec 참조 불일치 — 모두 INFO, 차단 없음. |
| testing | NONE | 세 reason 분기 모두 unit 단언, 두 실서비스 경로 단위 테스트, e2e B3 MISSING+COERCION 실검증. 커버리지 충분. |
| documentation | LOW | CHANGELOG 누락(client-visible 변경), 기존 인터페이스 JSDoc 부재, `invalid_schema` 미도달 미기재, spec 참조 경로 불일치. 차단 없음. |

## 발견 없는 에이전트

- **scope**: 범위 이탈 없음
- **side_effect**: 의도치 않은 부작용 없음
- **requirement**: Critical/Warning 발견사항 없음
- **testing**: 커버리지 충분, 차단 발견사항 없음

## 권장 조치사항

1. **CHANGELOG.md 업데이트** — `errors[]` → `error.details[]` 는 client-visible 변경이므로 Unreleased 섹션에 항목 추가 (INFO #1, 실질적 위험 가장 높음).
2. **e2e B3 DB 조작 헬퍼 추출** — `setupNodeWithParameters(db, wfId, parameters)` 추출로 스키마 변경 취약성 제거 (INFO #2, 후속 작업).
3. **기존 인터페이스 JSDoc 추가** — `TriggerParameterDefinition`·`TriggerParameterValidationError` 에 간단한 JSDoc (INFO #3, 후속 작업).
4. **`invalid_schema` 미도달 note 추가** — `toTriggerParameterErrorDetails` JSDoc 에 `@remarks` (INFO #4, 선택).
5. **단위 테스트 구 포맷 회귀 단언 추가** — `response.errors` undefined 단언 (INFO #7, 선택적 보강).
6. **`TriggerParameterValidationException` super() 단순화** — 방어적 설계 개선, 비긴급 (INFO #6, 선택).
7. **`workflows.controller.ts` 주석 spec 경로 통일** — `spec/4-nodes/7-trigger/1-manual-trigger.md §6` (INFO #5, 선택).

## 라우터 결정

라우터 선별 실행 (`routing_status=done`).

- **실행 (강제 포함)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명 — 전원 router_safety 강제 포함)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (전원)
- **제외**: 7명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 미선택 |
| architecture | 라우터 미선택 |
| dependency | 라우터 미선택 |
| database | 라우터 미선택 |
| concurrency | 라우터 미선택 |
| api_contract | 라우터 미선택 |
| user_guide_sync | 라우터 미선택 |