# Plan 정합성 검토 — `spec/5-system/` (+ spec_impact 전체) vs `plan/in-progress/**`

## 검토 방법

- Target: `plan/in-progress/spec-draft-inputoverride-marker-reject.md` 가 정의한 "spec 변경
  7곳(+선택 1)" 을 실제 spec 파일(디스크, `Read`/`grep` 직접 확인 — 번들이 예산 초과로 생략한
  `14-external-interaction-api.md` 포함)과 대조.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 해당 트래커 항목
  (`14_44_08` W6, W5, W4)과 target 의 정합성 확인.
- `plan/in-progress/**` 전체(41개 파일)에서 `inputOverride`/`MASKED_VALUE_RESUBMITTED`/
  `masked_value_resubmitted`/`resolveTriggerParameters` 키워드로 미해결 결정·후속 항목 누락
  가능성이 있는 다른 plan 을 grep — 겹치는 문서는 위 두 파일뿐.

## 발견사항

없음. 아래는 대조 결과 요약이다(발견사항이 아니라 검증 로그).

Target plan(`spec-draft-inputoverride-marker-reject.md`)의 "spec 변경 7곳(+선택 1)" 전항목이
실제 spec 파일에 반영돼 있고, 서술이 서로 어긋나지 않는다:

| # | 대상 | 상태 |
|---|---|---|
| 1 | `14-external-interaction-api.md §R17` — 서버측 행 + 범위 문장("재제출 경로 한정", webhook/schedule 비대상) | 반영 확인 (`:1573-1583`) |
| 2 | `3-error-handling.md §1.7` — `MASKED_VALUE_RESUBMITTED` 등재 + re-run 을 세 번째 소비처로 추가 | 반영 확인 |
| (선택 8) | `3-error-handling.md §1.3` — `INVALID_INPUT`(400) 행 + `RERUN_` prefix 미부여 각주 | 반영 확인 |
| 3 | `13-replay-rerun.md §8.1` — `INVALID_INPUT` 행에 `details[]` 카탈로그 인용 | 반영 확인 |
| 4 | `13-replay-rerun.md §10.2` — "서버가 2층으로 막는다" 로 클라이언트-전용 전제 갱신 | 반영 확인 |
| 5 | `4-nodes/7-trigger/1-manual-trigger.md §6` — reason 표에 `masked_value_resubmitted` 행 + 응답 봉투 문장에 "Manual re-run" 추가 | 반영 확인 |
| 6 | `1-data-model.md §2.13` · `3-workflow-editor/3-execution.md §2.2` — "서버가 2층으로도 거부" 서술 추가 | 반영 확인 |
| 7 | `12-webhook.md §5.2` — 3종→4종 카탈로그 개수 갱신 + `MASKED_VALUE_RESUBMITTED` 를 기존 `INVALID_SCHEMA` 패턴("헬퍼는 매핑하나 이 경로엔 미발생")으로 등재 | 반영 확인 |

트래커(`spec-sync-external-interaction-api-gaps.md`) 측 정합성:

- W6("`inputOverride` 서버측 마커 리터럴 거부") 항목은 `[ ]` 미해소로 남아 있고, 그 안의
  "→ 착수함(2026-08-20): `spec-draft-inputoverride-marker-reject.md`(planner) → 구현. 이
  체크박스는 **구현이 머지될 때** 닫는다" 문구가 target 의 현재 상태(spec 명문화만 완료,
  코드 구현은 별도 PR)와 정확히 일치한다 — spec-only 커밋으로 조기에 체크되지 않았다.
- W5("`Execution.inputData` 응답 의미 반전의 외부 소비자 확인")는 target plan 의 "왜 지금인가"
  절이 제시한 출처(저장소 소유자 직접 답변, 2026-08-20)를 근거로 트래커에서도 동일 문구로
  `[x]` 종결돼 있어 양쪽이 어긋나지 않는다.
- W4("`inputData` 마스킹 게이트 4곳을 단일 헬퍼로 통합")는 target 의 범위 밖으로 유지되고
  있고, target 문서 어디에도 이를 완료했다는 오서술이 없다.
- `spec-sync-external-interaction-api-gaps.md` 의 "§R17 재서술 시 열린 항목을 지우지 말 것"
  계열 우려(다른 in-progress plan 인 `spec-draft-eia-62-waiting-payload.md` 가 낸 W9 와 같은
  형태의 위험)에 대해서도, target 이 추가한 §R17 서버측 행은 기존 "`getStatus` 일반
  `nodeOutput` 키 allowlist(미구현·잔여)" 불릿을 삭제하지 않고 보존했다(`:1690` 그대로 존재).

`plan/in-progress/**` 41개 파일 전체를 `inputOverride`/`MASKED_VALUE_RESUBMITTED`/
`masked_value_resubmitted`/`resolveTriggerParameters` 로 grep 한 결과, 이 주제를 다루는
문서는 target 자신과 트래커 두 파일뿐이다 — 다른 in-progress plan 이 이 변경과 충돌하는
미해결 결정을 갖고 있지 않다. (`spec-draft-eia-62-waiting-payload.md` 가 같은 `§R17` 절을
동시에 건드리고 있으나, 다른 worktree(`eia-r8-cache-scope-4ae434`)의 병렬 작업이라 본 검토
관점(동시 작업 경합)에서 제외한다 — 다루는 하위 내용도 겹치지 않는다: 그쪽은 secret-shape
치환 서술·`llmCalls` strip 범위 정정이고, 이번 target 은 마커 거부·재제출 경로다.)

## 요약

Target(`spec/5-system/` 및 spec_impact 전체 7개 파일)은 자신을 낳은 plan
(`spec-draft-inputoverride-marker-reject.md`)이 선언한 "spec 변경 7곳(+선택 1)" 을 빠짐없이,
문서 상호 인용까지 정확히 반영하고 있고, 상위 트래커(`spec-sync-external-interaction-api-gaps.md`)
의 W6 항목 상태(spec 완료·구현 대기)와도 정합하다. 이 변경이 다른 in-progress plan 의 미해결
결정을 우회하거나 선행 조건을 건너뛰거나 후속 항목을 무효화하는 지점은 발견되지 않았다.

## 위험도

NONE
