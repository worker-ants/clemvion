# Rationale 연속성 검토 결과

## 대상

- 검토 모드: `--impl-prep` (구현 착수 전), scope=`spec/5-system/`
- 실질 target: `plan/in-progress/masked-marker-test-gaps.md` (spec_impact: none) — `resolveTriggerParametersRejectingMasked` 의 phase 경계 회귀 테스트 추가, `findMaskedResubmissions` 직접 단위 테스트 유예 근거 교체, `ExecutionsService.reRun` 리팩터 defer, 조건부 항목(egress-masking §3) 종결
- 대조한 spec Rationale: `spec/5-system/14-external-interaction-api.md` §R17, `spec/4-nodes/7-trigger/1-manual-trigger.md` `## Rationale`, `spec/5-system/3-error-handling.md`, `spec/1-data-model.md` (`input_data` 행), `spec/conventions/egress-masking.md` §3·`## Rationale`
- 대조한 코드: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`(+`.spec.ts`), `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
- 대조한 plan SoT: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (L824-827, L868 — 유예 조건 원문)

## 발견사항

없음 — CRITICAL/WARNING 없음.

- **[INFO]** 유예 근거 교체가 정본 트래커에도 동반 갱신되는지는 실행 단계에서 재확인 필요
  - target 위치: `plan/in-progress/masked-marker-test-gaps.md` §② "유예는 유지하되 근거를 교체한다"
  - 과거 결정 출처: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L826-827 (`findMaskedResubmissions` 직접 단위 테스트 부재 — "세 번째 소비처가 생기면 그때")
  - 상세: 이 항목 자체는 spec `## Rationale` 이 아니라 plan 트래커에 있어 본 checker 의 1차 관할(spec Rationale) 밖이지만, 논리적으로는 "과거 유예 조건 → 새 근거로 교체" 패턴이라 연속성 관점에서 언급해 둔다. plan 은 이미 작업 목록에 "② 유예 근거 교체 · ③ 실측값 갱신 · 조건부 항목 종결 — 트래커"를 별도 체크박스로 명시해 두었으므로 구조적으로는 올바르게 처리되고 있다.
  - 제안: 구현 완료 시 `spec-sync-external-interaction-api-gaps.md` L826-827 문구가 실제로 "분기 전수가 상위 경유로 이미 덮여 있어 추가분이 중복"으로 교체됐는지, 그리고 L868 항목이 신규 테스트 추가로 체크되는지 확인.

## 정합성 확인 (참고 — 위반 아님)

아래는 발견사항이 아니라, target 계획이 기존 spec Rationale 과 **정합**함을 확인한 근거다 (연속성 검토가 통과했음을 보이기 위해 기록):

1. **phase 경계 트레이드오프 회귀 테스트 (①)** 는 `spec/4-nodes/7-trigger/1-manual-trigger.md` `## Rationale`의 "phase 를 합쳐 한 번에 던지지 않는 이유도 같다 — raw 에서 걸린 뒤에도 resolve 를 강행하면 `coerce_failed` 가 섞여 안내가 다시 흐려진다" 및 "이 문장을 '직후' 한 지점으로 되돌리지 말 것" 과 `spec/5-system/14-external-interaction-api.md` §R17 의 동일 서술을 **그대로 고정**하는 작업이다. 과거에 기각된 대안("두 phase 통합", "resolve 직후 단일 검사")을 재도입하는 것이 아니라, 그 기각을 기계적으로 지키기 위한 회귀 테스트 추가다. 코드 주석(`reject-masked-resubmission.ts` L81-89)의 서술과도 정확히 일치한다.
2. **`findMaskedResubmissions` 단위 테스트 유예 근거 교체 (②)** 는 과거 결정("3번째 소비처가 생기면")을 무근거로 뒤집는 것이 아니라, 조건이 검증 가능한 주장임을 인지하고 실측(분기별 상위 경유 커버리지 표)으로 재판정한 뒤 **근거 교체 사실 자체를 명시적으로 기록**하겠다고 선언한다 — Rationale 연속성 관점 3번째 항목("결정의 무근거 번복")이 요구하는 정확히 그 절차를 따른다.
3. **CI 가드 정합성**: `repo-guards/__tests__/masked-reject-callers-guard.ts` 의 `ALLOWED_DIRECT_CALLERS` 는 현재 wrapper 소비처가 여전히 `resolveTriggerParametersRejectingMasked` 1개·호출부 2곳(`workflows.controller.ts`, `executions.service.ts`)임을 코드 레벨에서도 강제하고 있어, plan 의 "소비처는 여전히 함수 1개" 서술과 어긋나지 않는다.
4. **조건부 항목 종결**: `spec/conventions/egress-masking.md` §3 "이 문서는 기계가 지키지 않는다"는 실제로 "알려진 stale 트리거" 절에서 정본 트래커의 미체크 항목("`inputData` 마스킹 게이트 4곳을 단일 헬퍼로 통합")을 인용하고 있어, plan 이 근거로 든 "PR #1194 가 그 클래스를 소유하므로 조건부 항목을 닫는다"는 주장은 실제 spec 본문과 부합한다.
5. **데이터 모델 정합**: `spec/1-data-model.md` 의 `input_data` 행이 2026-08-20 마커 가드 전환 이력을 명시하고 있고, plan 의 테스트 추가 대상 함수·경로가 정확히 그 SoT(`EIA §R17`)를 가리켜 별도 SoT 분기가 생기지 않는다.

## 요약

target(마커 시리즈 잔여 테스트 갭 plan)은 spec 변경이 없는(`spec_impact: none`) 순수 테스트 보강 작업이며, 검토 결과 `spec/5-system/14-external-interaction-api.md` §R17 과 `spec/4-nodes/7-trigger/1-manual-trigger.md` `## Rationale` 에 이미 명문화된 "phase 미통합" 원칙·"raw 우선 + resolve 후 재검사" 결정을 뒤집거나 우회하지 않고, 오히려 그 결정이 향후 "선의로 되돌려지는 것"을 막기 위한 회귀 테스트를 추가하는 작업이다. 두 번째 항목(`findMaskedResubmissions` 유예 유지)도 과거 유예 조건을 실측으로 재검증한 뒤 근거를 명시적으로 교체하겠다고 선언해, 본 checker 가 우려하는 "무근거 번복" 패턴을 정확히 피하고 있다. 기각된 대안의 재도입, 합의 원칙 위반, invariant 우회는 발견되지 않았다.

## 위험도

NONE
