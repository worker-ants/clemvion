# Code Review 통합 보고서 (review-2, fresh)

## 전체 위험도
**LOW** — 순수 behavior-preserving 리팩터. WARNING 1건(`required: []` 누락, spec §5.1)은 본 RESOLUTION 에서 해소. 나머지는 INFO.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 | 상태 |
|---|----------|----------|------|------|------|
| 1 | 요구사항 | `buildConditionTools` 의 `parameters.required` 누락 — spec §5.1 (L323) 은 `required: []` 를 명시. 기존 핸들러에서도 동일 누락이 이번 리팩터로 그대로 이전됨. JSON Schema 상 생략 ≡ `required: []` 이라 런타임 무영향이나 spec 권위 기준 fix. | `ai-condition-evaluator.ts` `buildConditionTools` | `parameters` 에 `required: []` 추가. | ✅ FIXED (RESOLUTION.md) |

## 참고 (INFO) — 요약

- 보안: `condition.prompt` 비새니타이징 삽입(pre-existing, admin 신뢰), `sanitizeId` 충돌 가능성(pre-existing), `reason` char 단위 절단(spec 의도 부합). 모두 수용/후속.
- 요구사항: plan 체크박스 미갱신(본 PR 처리), `condToolName` export(테스트용, 의도적).
- 유지보수성: JSDoc KO/EN 혼재, `indexOf` O(n), 가드 중복 — 모두 후속.
- 테스트: `CONDITION_REASON_MAX_CHARS` 비export(#16, 본 PR 처리), `extractConditionReason([])` 케이스(#15, 본 PR 처리), `condToolName('')` 경계(낮은 우선순위).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | prompt injection(pre-existing, admin 신뢰), sanitizeId 충돌 — 모두 INFO |
| requirement | LOW | `required: []` 누락(WARNING, 해소), plan 체크박스(INFO) |
| scope | NONE | M-1 1단계 목적에 정확히 부합 |
| side_effect | NONE | 공개 API 변경 없음, 이동·승격 안전 |
| maintainability | NONE | 모두 INFO |
| testing | LOW | 16→ 단위 테스트, 소수 갭 INFO(본 PR 처리) |

## 권장 조치사항 / 처리

1. **(WARNING 해소)** `required: []` 추가 — spec §5.1 정합. ✅
2. **(INFO 처리)** `CONDITION_REASON_MAX_CHARS` export + 테스트 참조, `extractConditionReason([])` 케이스 추가. ✅
3. **(본 PR 처리)** plan M-1 체크박스 갱신. 
4. **(planner 위임)** spec §6.1 3.a 구현 포인터 갱신(SPEC-DRIFT).
5. **(후속 후보)** sanitizeId uniqueness, JSDoc 통일, DI 전환 — `ai/shared/` 승격 단계.

## 라우터 결정

routing_status=done: 실행 `security`/`requirement`/`scope`/`side_effect`/`maintainability`/`testing` (6, 전체 강제 포함), 제외 없음(performance·architecture 등 router skip).
