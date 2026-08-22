# Plan 정합성 검토 — masked-marker-cosmetic-followups (spec/4-nodes/7-trigger/)

## 검토 방법

`plan/in-progress/**` 전체에서 `masked|resubmission|trigger-parameter|manual-trigger|reject-masked|MASKED_VALUE_RESUBMITTED|resolveTriggerParameters|re-run.dto|REASON_TO_DETAIL|masked-reject-callers-guard` 를 grep. 매치된 유일한 실질 문서는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(마커 재제출 거부 PR 이월 항목 절)이며, 이를 전문 대조했다. 이 PR 자체가 그 절을 44줄 갱신하고 `plan/complete/masked-marker-cosmetic-followups.md`(95줄 신설)를 만들었음을 `git diff origin/main...HEAD --stat -- plan/` 로 확인했다.

## 발견사항

이번 target(코드 diff 4파일 + spec frontmatter 1줄)이 구현한 코스메틱 4건과 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "마커 재제출 거부 PR 의 이월 항목" 절을 1:1 대조한 결과, 아래 4건이 정확히 대응하며 **같은 diff 안에서 plan 도 동시에 `[x]` 로 갱신**됐다:

| target 변경 | plan 항목(라인) | 상태 |
|---|---|---|
| `re-run.dto.ts` Swagger description 확장 | L785-790 | `[x]` 닫힘, `masked-marker-cosmetic-followups` 귀속 |
| `resolve-trigger-parameters.ts` base 함수 JSDoc(wrapper 역참조 + 근거) | L802-808 | `[x]` 닫힘, 동일 |
| `trigger-parameter.types.ts` `REASON_TO_DETAIL` 형제 3종 JSDoc | L809-814 | `[x]` 닫힘, 동일 |
| `workflows.controller.ts` 한/영 주석 통일 | L815-820 | `[x]` 닫힘, 동일 |

미해결 결정(`result.outputs` emit, 분산 SSE fan-out, `inputData` 마스킹 게이트 통합, Re-run 차단 판정 순수 함수 추출, `findMaskedResubmissions` 단위 테스트, `throwIfAny` phase 트레이드오프, `execute()` DTO 승격, `egress-masking.md` 신설)는 전부 target diff 범위 밖이며, target 도 이들을 건드리지 않았다 — 일방적 우회 없음.

- **[INFO]** 이번 diff 자체가 "마커 리터럴을 산문으로 재기술한 지점 3곳"(Swagger description·`REASON_TO_DETAIL` JSDoc·base JSDoc)을 새로 만들었고, plan 은 이를 이미 스스로 등재했다(L825-834, `19_36_12` requirement W1) — SoT(`@workflow/masked-markers`) 링크 없이 산문 재기술이라 값이 바뀌면 기계가 아니라 사람이 찾아야 하는 drift 다. plan 은 이를 **PR #1194(`spec/conventions/egress-masking.md` 신설)가 머지되면 흡수, 늦게 들어오거나 철회되면 이 항목이 유일한 기록**이라고 명시적으로 조건부 처리해 뒀다.
  - target 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`(JSDoc), `resolve-trigger-parameters.ts`(JSDoc), `re-run.dto.ts`(Swagger description)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L825-834
  - 상세: 실측 결과(`gh pr view 1194`) PR #1194 는 아직 `OPEN`(미머지) — plan 이 예상한 "흡수 실패" 분기가 현재 유효 상태다. 새로운 갭은 아니며, plan 이 이미 정확히 이 상황을 전제로 기록을 남겨 두었다(정보 유실 방지 목적). 별도 조치 불요, 다음 PR #1194 진행 상황을 추적할 때 참고할 포인터로만 남긴다.
  - 제안: 조치 불요. #1194 머지 여부에 따라 plan 항목이 자동으로 처분되도록 이미 설계돼 있음.

## 요약

target(마스킹 마커 시리즈 코스메틱 4건)은 정본 트래커 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "마커 재제출 거부 PR 의 이월 항목" 절에 등재된 4개 저비용 이월 항목을 정확히 처분하며, 같은 changeset 안에서 plan 자체도 갱신되어 있어(44줄, `[x]` 4건 + 신규 drift 항목 1건 등재 + `plan/complete/masked-marker-cosmetic-followups.md` 작성) plan-target 정합성이 이례적으로 높다. target 이 우회하는 "결정 필요" 항목이 없고, target 이 전제하는 선행 조건(마커 재제출 거부 wrapper·`@workflow/masked-markers` 공유 패키지·`INVALID_TRIGGER_PARAMETERS` 에러코드 통일)은 모두 이전 세션에서 이미 해소되어 origin/main 에 반영된 상태다. 이번 diff 가 만든 유일한 부작용(마커 리터럴 산문 재기술 3곳 증가)도 plan 이 사전에 인지하고 조건부 처분 경로(PR #1194)를 명시해 뒀다.

## 위험도

NONE
