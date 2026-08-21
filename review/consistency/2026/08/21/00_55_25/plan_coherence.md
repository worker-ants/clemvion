# Plan 정합성 검토 — `spec-update-masked-reject-framing.md`

## 발견사항

- **[WARNING] 선행 plan(`spec-draft-inputoverride-marker-reject.md`)이 target 의 정정 1 을 못 따라간다**
  - target 위치: `plan/in-progress/spec-update-masked-reject-framing.md` "정정 1 — `1-manual-trigger.md` §6: 검사 시점이 낡았다"
  - 관련 plan: `plan/in-progress/spec-draft-inputoverride-marker-reject.md` "spec 변경 7곳" 항목 5(a)
  - 상세: target 은 `1-manual-trigger.md` §6 reason 표의 시점 서술을 *"adapter `resolveTriggerParameters` **직후**"* → *"**전후**(raw 우선 검사 → resolve → 재검사)"* 로 정정한다. 그런데 이 정정의 **원인**이 된 선행 plan `spec-draft-inputoverride-marker-reject.md`(같은 worktree, `status: in-progress`) 자체가 항목 5(a)에서 지금도 *"시점은 `adapter resolveTriggerParameters` **직후**"* 라고 명시적으로 지시한다(320행대). 즉 target 이 "폐기된 설계" 라고 부르는 문구가 그 설계를 지시한 선행 plan 문서에는 그대로 남아 있다. target 본문이 스스로 경고하는 위험("이 문장을 그대로 두면 다음 사람이 이것만 보고 검사를 '직후' 한 곳으로 되돌린다")이 target 자신이 아니라 **선행 plan 파일**에서 그대로 재현될 수 있다 — 두 in-progress 문서가 같은 worktree 안에서 서로 다른 시점을 지시하는 상태다.
  - 제안: `spec-draft-inputoverride-marker-reject.md` 항목 5(a)에 target 의 정정을 반영하는 후속 각주를 달거나("→ `spec-update-masked-reject-framing.md` 로 정정됨"), 해당 plan 을 target 정정과 함께 완료 처리해 `plan/complete/` 로 이동한다. 최소한 stale 지시가 단독으로 읽히지 않게 표시할 것.

- **[WARNING] `spec/1-data-model.md:471` 이 target 정정 2 와 같은 계열의 "재제출 경로" 프레이밍을 그대로 두고 있고, target 의 `spec_impact`/정정 2 범위에서 빠졌다**
  - target 위치: `plan/in-progress/spec-update-masked-reject-framing.md` "정정 2 — 자매 두 곳의 '재제출 경로 한정'" — target 은 *"둘만 안 따라갔다"* 고 명시하며 `3-error-handling.md:193`·`12-webhook.md:312` 두 곳만 스코프로 잡는다. frontmatter `spec_impact` 도 이 두 파일 + `1-manual-trigger.md` 뿐이다.
  - 관련 plan: `plan/in-progress/spec-draft-inputoverride-marker-reject.md` "spec 변경 7곳" 항목 6(`1-data-model.md §2.13` 갱신 지시)
  - 상세: `git log` 로 이력을 추적하면, `spec/1-data-model.md:471`(`input_data` 행의 "2026-08-20 부터는 서버도 2층으로 거부한다 — **재제출 경로에서** 값 leaf 가 마커와 정확히 일치하면 400 …")은 커밋 `3e96f4b44`(§R17 을 아직 "출처" 기준·"재제출 경로 한정" 으로 서술하던 **원래** planner 턴)에서 작성됐다. 그 직후 커밋 `871d3fcb0`("거부 범위의 판정 기준을 '출처' 에서 '저작 주체' 로 정정 — impl-prep W1", `23_33_00` 게이트 대응)이 같은 "재제출 한정" 프레이밍을 `spec/5-system/14-external-interaction-api.md`·`spec/4-nodes/7-trigger/1-manual-trigger.md`·`spec/3-workflow-editor/3-execution.md` 세 곳에서 고쳤지만 **`spec/1-data-model.md` 는 diff 에 없다**. 이후 developer 커밋 `50f799efd`(§R17 표 행 동기화, target 의 W3 절이 다루는 그 커밋)도 이 파일을 건드리지 않았다. 즉 `1-data-model.md:471` 은 "출처(재제출 여부)가 기준" 이라는 **폐기된 판정 기준**을 지금도 그대로 서술하는 세 번째 자리이고, target 의 "이 둘만 안 따라갔다" 는 문장은 grep 범위가 `3-error-handling.md`/`12-webhook.md` 로 좁아 이 자리를 놓친 것으로 보인다. 이 문장은 `spec-draft-inputoverride-marker-reject.md` 항목 6 이 지시해 만들어진 문장이라, 정정 2 가 "자매 두 곳" 을 잡을 때 쓴 grep 기준(`재제출 경로 한정`이라는 정확 문자열)이 이 자리의 변형 문구(`재제출 경로에서`)를 통과시킨 것과 같은 형태다 — target 본문이 스스로 경계하는 "자매 발산이 반복된다" 패턴의 재발 후보다.
  - 제안: `spec/1-data-model.md` 를 target 의 `spec_impact` 에 추가하고, 471행의 "재제출 경로에서" 를 정정 2 와 같은 기준("Manual 실행 경로에서" 또는 "Manual 파라미터 저작 주체 기준")으로 함께 정정한다. 정정 2 의 grep 스윕을 `재제출.*(한정|경로)` 등 변형 포함 패턴으로 재실행해 네 번째 자리가 없는지 재확인 권장.

- **[INFO] target frontmatter `spec_impact` 가 W3 절이 "승인 범위 안에 명시적으로 편입" 한다고 선언한 `14-external-interaction-api.md` 를 누락**
  - target 위치: frontmatter `spec_impact` 목록 vs 본문 "⚠️ 절차 위반을 먼저 적는다 (W3)" 절
  - 관련 plan: 없음 (target 문서 내부 정합성)
  - 상세: W3 절은 developer 커밋 `50f799efd` 가 `spec/5-system/14-external-interaction-api.md` 표 행을 직접 고친 것을 "이 드래프트의 승인 범위 안에 명시적으로 편입한다" 고 선언한다. 그런데 frontmatter `spec_impact` 리스트에는 이 파일이 없다. `spec_impact` 를 SoT 로 삼는 후속 감사(spec-coverage 등)가 이 편입을 못 볼 수 있다.
  - 제안: `spec_impact` 에 `spec/5-system/14-external-interaction-api.md` 추가.

## 요약

target 문서는 자신이 직접 지적하는 "자매 발산" 패턴을 두 겹으로 재현하고 있다. (1) target 이 고치는 §6 시점 서술의 원인이 된 선행 plan(`spec-draft-inputoverride-marker-reject.md`)이 여전히 낡은 지시("직후")를 담고 있어, target 이 spec 은 고쳐도 plan 기록은 stale 상태로 남는다. (2) target 이 "재제출 경로 한정" 오프레이밍을 잡을 때 쓴 grep 범위가 좁아, 같은 계열의 문구가 `spec/1-data-model.md:471`(같은 선행 plan 이 만든 자리)에 하나 더 남아 있는 것을 놓쳤다. 두 건 모두 spec 본문의 정확성보다는 "다음 사람이 stale 지시를 원본으로 오인" 하는 문서-계보(lineage) 리스크이며, target 이 이미 서술한 방법론(문구 전수 grep, 선행 plan 갱신)을 한 단계 더 적용하면 해소된다. CRITICAL 급의 미해결 결정 충돌은 발견되지 않았다.

## 위험도
MEDIUM
