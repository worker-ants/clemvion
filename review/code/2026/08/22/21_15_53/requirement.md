# 요구사항(Requirement) Review — masked-marker-test-gaps

## 발견사항

- **[INFO]** 신규 테스트의 대전제(마스킹 마커 재제출 거부의 phase 경계 트레이드오프)는 코드 docstring 뿐 아니라 spec 본문에도 이미 명문화돼 있어 spec fidelity 가 확인됨.
  - 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 Rationale "`masked_value_resubmitted` 검사 시점" (L212-229) — "phase 를 합쳐 한 번에 던지지 않는 이유도 같다 — raw 에서 걸린 뒤에도 resolve 를 강행하면 `coerce_failed` 가 섞여 안내가 다시 흐려진다." / `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 의 `throwIfAny` JSDoc(58-90행)
  - 상세: `reject-masked-resubmission.spec.ts` 에 추가된 `[캐너리] 무관한 필드의 coerce 실패가 ② 마커 검사를 선점한다` 테스트를 실제 구현(`resolveTriggerParametersRejectingMasked` → `throwIfAny(rawHits)` → `resolveTriggerParameters` → `throwIfAny(② 결과)`)과 `coerce-type.ts`/`resolve-trigger-parameters.ts` 를 직접 추적해 재현했다. `schema=[payload(object), count(number)]`, `rawSource={payload: '{"apiKey":"***"}'}, count:'not-a-number'}` 입력에서 ① raw 검사는 빈 배열(문자열 전체가 마커와 불일치) → `resolveTriggerParameters` 진입 → `count` 의 `Number('not-a-number')` → `NaN` → `null` → `coerce_failed` 로 throw → ②(`findMaskedResubmissions(schema, rawSource, resolved)`)는 코드상 도달 불가. 대조군(`count:1`)에서는 동일 payload 가 `['payload']` 로 정확히 잡힘 — vacuous 아님을 직접 확인. `npx jest reject-masked-resubmission.spec.ts` 실행 결과 22/22 통과, `npx tsc --noEmit` 도 이 파일 관련 오류 0건.
  - 제안: 없음(정상). 참고용 기록.

- **[INFO]** plan 문서(`masked-marker-test-gaps.md`, `spec-sync-external-interaction-api-gaps.md`)의 정량 주장(줄 번호 인용·`141줄`)을 실측 대조한 결과 전부 정확함.
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (① 항목 "트래커 L868", ② 항목 "L826-827")
  - 상세: `git show ad3157a71~1:plan/in-progress/spec-sync-external-interaction-api-gaps.md` (이 PR 직전 상태)로 대조한 결과 "`throwIfAny` 의 phase 경계 트레이드오프 미검증" 항목은 실제로 구 파일의 868행, "세 번째 소비처가 생기면 그때." 는 827행이었음 — 인용이 정확히 일치. `ExecutionsService.reRun`(`codebase/backend/src/modules/executions/executions.service.ts:420-560`)도 실측 141줄(560-420+1)로 claim 과 일치.
  - 제안: 없음(정상). 참고용 기록.

- **[INFO]** consistency-check(`review/consistency/2026/08/22/20_57_25/`) 산출물이 SUMMARY 와 개별 checker 파일 간 정합함을 확인.
  - 위치: `review/consistency/2026/08/22/20_57_25/SUMMARY.md`
  - 상세: 5개 checker 파일 전수 grep 결과 CRITICAL/WARNING 마커 0건으로 SUMMARY 의 "Critical 0 · Warning 0" 서술과 일치. SUMMARY 가 지적한 INFO #3(plan 체크리스트에 ① 종결이 명시되지 않음)는 현재 커밋된 `masked-marker-test-gaps.md` `## 작업` 체크리스트(`- [x] ① phase 경계 회귀 테스트 추가 → 트래커 L868 항목 종결`)에 이미 반영돼 해소됨 — stale 하지 않음.
  - 제안: 없음(정상). 참고용 기록.

## 요약

이번 변경은 순수 테스트+plan 문서 갱신(spec_impact: none)이며, 실제 구현(`reject-masked-resubmission.ts`, `resolve-trigger-parameters.ts`, `coerce-type.ts`)을 직접 추적해 새 캐너리 테스트의 시나리오(무관 필드의 `coerce_failed` 가 ② JSON-문자열-마커 검사를 선점하는 phase 경계 트레이드오프)가 실제 코드 동작과 정확히 일치함을 확인했다. 이 트레이드오프는 코드 docstring 뿐 아니라 `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 Rationale 에도 이미 문서화된 의도된 설계라 spec fidelity 위반이 아니다. 신규 테스트에는 vacuous 방지용 대조군이 포함돼 있고 실제 jest 실행(22/22 통과)·tsc 로 재검증했다. plan 문서(`masked-marker-test-gaps.md`, `spec-sync-external-interaction-api-gaps.md`)의 줄 번호·줄 수 인용(L868, L826-827, 141줄)도 git 히스토리 및 실제 소스 대조로 전부 정확함을 확인했다. TODO/FIXME/HACK 등 미완성 표식은 없으며, 반환값·에러 시나리오·엣지 케이스(null/비객체 raw, 빈 스키마, 깊이 상한, 혼합 중첩) 모두 기존 테스트가 커버하고 있고 이번 PR 이 추가한 유일한 갭(phase 경계 트레이드오프)도 이번 PR 자체로 해소됐다. Critical/Warning 급 결함을 발견하지 못했다.

## 위험도

NONE
