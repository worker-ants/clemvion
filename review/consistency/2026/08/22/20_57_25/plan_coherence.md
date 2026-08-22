# Plan 정합성 검토 — spec/5-system (--impl-prep)

## 검토 범위·방법

`plan/in-progress/masked-marker-test-gaps.md`(현재 worktree 의 정본 plan)와 그 상위 트래커
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`(마커 재제출 거부 PR 이월 항목
절)를 target `spec/5-system/`(특히 `14-external-interaction-api.md` §R17, 교차참조되는
`spec/4-nodes/7-trigger/1-manual-trigger.md` §6/Rationale)와 대조했다. 프롬프트 번들이
컨텍스트 예산으로 `14-external-interaction-api.md` 본문을 생략했으므로 `Read`/`grep` 로 해당
spec 원문과 `codebase/backend/.../reject-masked-resubmission.ts` 실제 코드, 현재 워크트리의
uncommitted diff, `git log` 이력을 직접 실측했다.

## 발견사항

이번 라운드에서 CRITICAL/WARNING 급 불일치는 발견되지 않았다. 아래는 실측으로 확인한
정합성 근거이며, 하나의 낮은 완결성 메모만 남긴다.

- **[INFO]** plan 체크리스트가 트래커 ①항목 종결을 명시적으로 나열하지 않음
  - target 위치: `plan/in-progress/masked-marker-test-gaps.md` `## 작업` 절 두 번째 불릿
    (`- [ ] ② 유예 근거 교체 · ③ 실측값 갱신 · 조건부 항목 종결 — 트래커`)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L888
    (`throwIfAny` 의 phase 경계 트레이드오프 미검증)
  - 상세: 이 plan 의 "작업" 체크리스트 문구가 트래커에서 닫아야 할 항목으로 ②·③·조건부
    항목만 나열하고 ①(throwIfAny phase 경계) 트래커 항목 종결은 별도로 적혀 있지 않다.
    다만 **실측 결과 이미 해소돼 있다** — 현재 워크트리의 uncommitted diff 를 직접 읽으면
    `spec-sync-external-interaction-api-gaps.md` L888 이 이미 `[x]` 로 바뀌어 있고
    ("닫았다 (2026-08-22, `masked-marker-test-gaps`)" 노트 포함), 대응 회귀 테스트
    (`[캐너리] 무관한 필드의 coerce 실패가 ② 마커 검사를 선점한다`)도
    `reject-masked-resubmission.spec.ts` 에 실제로 추가되어 있다(대조군 포함, plan 의 "검증
    기준" 요구와 일치하는 형태). 즉 **결과물은 정합하나, plan 문서 자체의 체크리스트 문구가
    그 사실을 반영하지 않아** 이후 이 plan 을 다시 읽는 사람이 "① 트래커 항목도 닫혔는지"를
    별도로 확인해야 하는 사소한 추적성 공백이 있다.
  - 제안: `masked-marker-test-gaps.md` 의 `## 작업` 불릿을 "① phase 경계 회귀 테스트 추가 +
    트래커 종결" 처럼 명시하거나, 완료 후 PR 설명에 ①/②/③ 트래커 상태를 함께 적어 두면
    다음 사람이 두 문서를 대조할 필요가 없어진다. 강제 조치는 불필요 — 실제 산출물은 이미
    올바르다.

## 교차검증한 정합성 (참고)

- **미해결 결정과의 충돌 없음**: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 Rationale
  (`masked_value_resubmitted` 검사 시점 — raw 우선 + resolve 후 재검사, 2026-08-21)과
  `reject-masked-resubmission.ts` 의 `throwIfAny` docstring 이 이미 이 PR 이 테스트로
  고정하려는 phase 경계 트레이드오프를 정확히 서술하고 있다 — plan 이 target 을 거슬러 새
  결정을 내리는 것이 아니라 **이미 문서화된 의도된 설계를 회귀 테스트로 고정**하는 작업이라
  스코프가 target 과 일치한다.
- **선행 plan 미해소 없음**: plan 의 "함께 닫는 것 — 조건부 항목" 절이 전제하는 "PR #1194
  머지" 는 `git log`(`bdcfdc514`, 2026-08-22) 로 확인되고, `spec/conventions/egress-masking.md`
  §3("이 문서는 기계가 지키지 않는다" + 알려진 stale 트리거)도 실제로 존재해 plan 의 전제가
  허구가 아니다.
  후속 PR #1195(`923b5892e`, 코스메틱 4건)도 이미 머지돼 있어 이 plan 이 가정하는 baseline 이
  현재 `main` 과 어긋나지 않는다.
- **후속 항목 누락 없음(중복 작업 검사)**: `plan/in-progress/**` 전체에서
  `throwIfAny`/`findMaskedResubmissions`/`resolveTriggerParametersRejectingMasked`/
  `reject-masked-resubmission`/`reRun` 을 언급하는 다른 in-progress plan 은 없다 — 병행
  작업과의 스코프 충돌 위험이 없다.
- **측정 주장 재검증**: plan ③ 항목의 "`ExecutionsService.reRun` 실측 141줄" 을
  `executions.service.ts` 에서 직접 라인 카운트(L420~L560)해 확인 — 정확하다.
- **§R17 wrapper/base 분리 설계**와 plan 의 "base 에 넣지 않은 것은 의도" 서술이
  `spec/5-system/14-external-interaction-api.md` §R17(L1582-1611)·
  `1-manual-trigger.md`(L191-202)·코드 JSDoc 세 곳 모두 동일 논지로 일치한다.

## 요약

`masked-marker-test-gaps.md`(현재 작업 plan)는 상위 트래커
`spec-sync-external-interaction-api-gaps.md`의 이월 항목을 실측 기반으로 재판정하고, target
spec(`14-external-interaction-api.md` §R17 및 그 미러 `1-manual-trigger.md`)이 이미
문서화한 의도된 설계를 회귀 테스트로 고정하는 작업이다. 미해결 결정을 우회하거나
선행조건을 무시하는 지점, 다른 plan 과 충돌하는 지점은 발견되지 않았다. plan 이 전제한
사실(PR #1194/#1195 머지, `egress-masking.md` 신설, `reRun` 141줄)은 모두 `git log`·코드
실측으로 검증됐고, 트래커 항목 ①/②/③ 및 조건부 항목의 종결도 이미(uncommitted 상태로)
정확히 반영돼 있다. 유일한 메모는 plan 문서 자체의 체크리스트 문구가 이미 달성된 ①번
트래커 종결을 명시적으로 언급하지 않는다는 완결성 공백(INFO)이다.

## 위험도

LOW
