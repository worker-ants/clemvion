# 문서화(Documentation) 리뷰 — assistant-mask-leak (3라운드, `17_53_08`)

## 컨텍스트

이번 라운드는 앞선 두 차례 `/ai-review`(`16_46_56`: CRITICAL 0·WARNING 4 → 전부 반영, `17_14_18`:
CRITICAL 0·WARNING 1 → 반영)와 세 차례 consistency-check(`16_09_25` BLOCK:YES →
`16_21_45` BLOCK:NO → `17_34_06` impl-done BLOCK:NO·WARNING 2)를 거친 뒤의 재검토다.
`17_34_06` 이 낸 WARNING 2건(§4.1.1 좌표계 링크 누락, `redactAssistantFields` 자매 헬퍼
교차 인용 누락)은 현재 HEAD(커밋 `22423fdf4`)에서 실제로 반영돼 있음을 소스로 직접
확인했다 — `spec/3-workflow-editor/4-ai-assistant.md:259` 에
`[Egress 마스킹 좌표계](../conventions/egress-masking.md)` 링크가 있고,
`explore-tools.service.ts:78-82` JSDoc 에 `redactStoredFieldsForResponse` 를 명시
교차 인용하는 "## 자매 — 이름이 닮았지만 강도가 다르다" 절이 있다. 재차 지적하지 않는다.

CHANGELOG 항목, `mask-sensitive-fields.util.ts`/`explore-tools.service.ts` 의 JSDoc·인라인
주석, `tool-definitions.ts`/`system-prompt.ts` 설명 문자열 미반영(의도적 미조치, 과다
마스킹 방향이라 안전)도 두 차례 라운드에서 이미 검증·처분됐고 현재 코드로 재확인해도
동일 상태라 재론하지 않는다.

## 발견사항

- **[WARNING]** `status: complete` 로 `plan/complete/` 에 있는 planner 턴 plan 문서에
  이미 완료된 작업을 가리키는 미체크 항목이 그대로 남아 있다
  - 위치: `plan/complete/spec-update-assistant-masking.md:67`
    (`- [ ] (developer 턴 재개) 코드는 \`3aaa4cd19\` 에 이미 있음 → TEST WORKFLOW ·
    \`--impl-done\` · \`/ai-review\``)
  - 상세: 이 파일은 frontmatter `status: complete`(`:3`)·`completed: 2026-08-23`(`:6`) 로
    이미 `plan/complete/` 로 옮겨져 있는데, "작업" 체크리스트의 마지막 항목만 `- [ ]` 로
    미체크 상태다. 그런데 그 항목이 요구하는 세 가지(TEST WORKFLOW·`--impl-done`·
    `/ai-review`)는 이미 전부 수행 완료됐다는 증거가 이 diff 자체 안에 있다 — 자매
    developer plan `plan/complete/assistant-mask-leak.md` 의 "최종 게이트" 표(`:213-223`)가
    `--impl-done`(`17_34_06`) BLOCK NO, `/ai-review` 1R(`16_46_56`)·2R(`17_14_18`) 반영,
    TEST WORKFLOW PASS 를 전부 기록하고 있고, 그 세 게이트의 실제 산출물
    (`review/consistency/2026/08/23/17_34_06/**`, `review/code/2026/08/23/{16_46_56,
    17_14_18}/**`)도 diff 에 포함돼 있다. `git log --oneline -- plan/complete/
    spec-update-assistant-masking.md` 로 확인하면 이 파일은 커밋 `fec63b483`(2라운드 fix
    커밋) 이후 한 번도 갱신되지 않았고, 그 뒤 나온 3라운드 게이트(`--impl-done` `17_34_06`,
    이번 3차 `/ai-review`)의 결과가 이 체크리스트에 반영되지 않았다. 사용자 메모리에 이미
    기록된 "체크와 `complete/` 이동은 한 동작" 패턴과 정확히 같은 종류의 누락이다 — 다른
    이 저장소의 `plan/complete/*.md` 표본(`spec-draft-eia-fanout-masking.md`,
    `masking-gate-consolidation.md`, `eia-secret-masking-residuals.md`)에는 미체크
    항목이 없어, `status: complete` 문서는 체크리스트도 전부 닫혀 있어야 한다는 이 저장소의
    확립된 관례에서 이 파일만 벗어나 있다. 다음 사람이 이 문서만 열어 보면 "developer 턴이
    아직 재개되지 않았다" 로 오독할 수 있다.
  - 제안: 해당 줄을 `- [x] (developer 턴 재개) …` 로 체크하고, 실제로 언제·어느 게이트로
    완료됐는지(`--impl-done` `17_34_06` BLOCK:NO, `/ai-review` 1R/2R/3R)를 한 줄
    덧붙이거나 `assistant-mask-leak.md` "최종 게이트" 표로 상호 참조를 남긴다.

## 확인했지만 문제 없음 (재확인)

- `CHANGELOG.md:116-144` — 신설 항목이 값 축 신설·포맷 변경(`****<last4>`→`***`)·
  `DEFAULT_SENSITIVE_KEYS` token 계열 확장 세 가지를 정확히 설명하고, 바로 아래
  기존 예고 항목(`:146`)과 상호 참조한다. 1라운드 WARNING #4 반영 그대로 유지.
- `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1(`:259-266`) 및 `:1435` 결정 메모 표,
  `spec/5-system/14-external-interaction-api.md` §R17 잔여③(`:1646-1668`, 원 경고를
  취소선으로 보존한 채 "결정 완료" 로 flip), `spec/2-navigation/_product-overview.md:265`
  EH-NAV-04, `spec/conventions/egress-masking.md` §1 표 2행 + `code:` 두 파일 등재 —
  전부 코드 실제 동작과 일치함을 소스로 재확인.
- `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts:97-105` 의
  `it.each` 가 `mask-sensitive-fields.util.spec.ts` 와 동일한 8종(camelCase+snake_case)으로
  이미 맞춰져 있어, 2라운드 maintainability INFO(5종만 있던 비대칭)가 실제로 해소됨.
- `redactAssistantFields`(`explore-tools.service.ts:53-104`)는 클래스 JSDoc(`:106-118`) 및
  클래스 선언(`:121-122`) 위에 배치되어 1라운드 WARNING #3(JSDoc 배치 결함)이 해소된
  상태를 유지.

## 요약

3라운드째 재검토에서도 코드·spec·CHANGELOG·JSDoc 수준의 문서화 결함은 남아 있지 않다 —
직전 consistency-check(`17_34_06`)가 낸 WARNING 2건은 이미 커밋에 반영돼 있고, 앞선
두 차례 `/ai-review` 의 WARNING 도 전부 해소가 코드로 재확인된다. 다만 이번 diff 안에
있는 두 plan 문서 중 하나(`plan/complete/spec-update-assistant-masking.md`)는 이미
`status: complete` 로 `plan/complete/` 에 위치하면서도 "developer 턴 재개" 를 요구하는
체크박스 하나가 미체크로 남아 있고, 그 요구가 실제로는 diff 자체(자매 plan·리뷰 산출물)로
이미 완료됐음이 증명된다 — 사소하지만 이 저장소가 반복 지적해 온 "체크와 완료 이동은
한 동작" 패턴과 같은 종류의 누락이라 WARNING 으로 기록한다.

## 위험도

LOW
