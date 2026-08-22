# Plan 정합성 검토 — `spec/4-nodes/7-trigger/`

## 검토 범위 요약

- Target: `spec/4-nodes/7-trigger/1-manual-trigger.md` · `0-common.md` · `providers/_overview.md` · `providers/discord.md` (spec 자체는 이번 diff 에서 미변경 — `git diff origin/main --stat` 확인, spec 파일 0건)
- 실제 diff: `trigger-parameter.types.ts`(REASON_TO_DETAIL JSDoc 3건 추가) · `resolve-trigger-parameters.ts`(base JSDoc 에 wrapper 역참조 추가) · `re-run.dto.ts`(Swagger description 확장) · `workflows.controller.ts`(주석 한국어 통일) · `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(트래커 4항목 `[x]`)
- 정본 plan: `plan/in-progress/masked-marker-cosmetic-followups.md` (owner: developer, spec_impact: none)

## 발견사항

- **[INFO]** `egress-masking` convention 문서화 결정이 여전히 미해결 상태로 유지되며, 이번 diff 가 그 표면을 소폭 더 넓힌다
  - target 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 (해당 spec 자체는 미변경)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:858-867` — *"egress 마스킹 규약이 정식 `spec/conventions/**` 문서 없이 코드 JSDoc 산문에만 있다"* (consistency `15_35_56` W1 등재, **planner 턴** 필요, `spec/conventions/egress-masking.md`(가칭) 신설 여부는 아직 미결정)
  - 상세: 이번 diff 는 `REASON_TO_DETAIL` 3항목 JSDoc, `resolveTriggerParameters` base 의 wrapper 역참조 JSDoc, `ReRunRequestDto` Swagger description 등 마스킹/트리거 파라미터 검증 규약에 대한 산문 설명을 **세 곳 더 추가**한다. 이는 트래커가 이미 지적한 *"산문 규약 표류"* 패턴과 같은 방향이다 — 결정 자체를 우회하거나 모순되게 내리는 것은 아니지만(코스메틱-4 항목은 트래커에서 별도로 planner-불요 항목으로 명시적으로 분리돼 있었다), 나중에 planner 가 `spec/conventions/egress-masking.md` 로 통합할 때 옮겨야 할 산문 지점이 하나 더 늘었다.
  - 제안: 액션 불요(이번 PR 스코프 안에서 결정 우회는 없음). 다만 `spec-sync-external-interaction-api-gaps.md:858-867` 항목에 "코스메틱 PR 이 산문 지점을 3곳 추가함(REASON_TO_DETAIL ×3, base JSDoc, Swagger description)"을 한 줄 보태 두면, 추후 planner 턴이 통합 대상 목록을 다시 grep 하지 않아도 된다.

## 정합성 확인 (충돌 없음 — 참고용)

- 트래커 `spec-sync-external-interaction-api-gaps.md:785-828` 의 코스메틱 4항목 서술은 실제 diff(Swagger description·base JSDoc·`REASON_TO_DETAIL` 3종·주석 한국어화)와 **1:1 일치**. 트래커가 `[x]` 로 닫은 4개 항목 = diff 가 건드린 4개 위치.
- `masked-marker-cosmetic-followups.md` "함께 하지 않는 것" 표(`ExecutionsService.reRun` 구조·`findMaskedResubmissions` 단위 테스트·`throwIfAny` phase 회귀 테스트)는 트래커 `:821-828` 의 여전히 열린 3항목과 정확히 대응 — 배제 사유도 트래커 서술과 일치. 일방적 결정 아님.
- 선행 조건(`INVALID_TRIGGER_PARAMETERS` 로의 re-run 에러코드 통일, PR #1193/`f65ca193c`)은 이미 `origin/main` HEAD 에 병합돼 있고, target spec §6 표(`1-manual-trigger.md:206-207`)도 통일된 코드를 반영 중 — 이번 diff 의 Swagger description(`INVALID_TRIGGER_PARAMETERS` 언급)이 전제하는 상태와 정합.
- "wrapper 함수명이 spec 본문에 없다" 트래커 항목(`:833-842`, `origin/main` 에 이미 반영)이 요구한 wrapper 명시·base 미포함 이유·CI 가드 언급이 target spec §6(`1-manual-trigger.md:215-226`)에 이미 존재 — 이번 diff 의 base JSDoc 신규 텍스트와 spec 서술이 동일한 근거(Webhook·Schedule 공유, `masked-reject-callers-guard`)를 사용해 표류 없음.
- `plan/in-progress/node-output-redesign/manual-trigger.md` 의 stale line 인용(`1-manual-trigger.md:65`, `0-common.md:75`)은 실제 파일과 대조 시 각 ±1줄 이내로 여전히 정확 — target 최근 확장(§6/§7/Rationale 의 마커 재제출 서술)이 그 인용 지점보다 뒤에 있어 drift 없음.
- 다른 `plan/in-progress/**` 파일 전수 grep(`REASON_TO_DETAIL`·`reject-masked-resubmission`·`masked-reject-callers-guard`·`resolveTriggerParametersRejectingMasked`) 결과 이번 두 파일(`spec-sync-external-interaction-api-gaps.md`, `masked-marker-cosmetic-followups.md`) 외 참조 없음 — 무효화되거나 새로 만들어야 할 타 plan 후속 항목 없음.

## 요약

이번 코스메틱 diff(Swagger description·base JSDoc·`REASON_TO_DETAIL` JSDoc·주석 한국어화)는 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)가 명시적으로 "planner 턴 불요"로 분류해 둔 4항목만 정확히 건드리며, 서술·범위·선행조건(에러코드 통일 PR #1193 병합) 모두 target spec 및 다른 in-progress plan 과 충돌 없이 정합한다. 유일한 관찰 사항은 별도 트래커 항목(`egress-masking` convention 통합, planner 턴 대기 중)이 여전히 미결정 상태이고 이번 diff 가 그 통합 대상 산문을 소폭 늘렸다는 점인데, 이는 결정을 우회한 것이 아니라 이미 등재된 별개 항목의 범위가 약간 넓어진 것뿐이라 INFO 수준이다.

## 위험도

LOW
