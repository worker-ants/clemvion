# Plan 정합성 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 조사 방법

- `git diff origin/main --stat -- spec/5-system/` 로 실제 target diff 를 먼저 확정: 이번 라운드에서
  `spec/5-system/` 아래 변경은 `14-external-interaction-api.md`(+38/-6)·`6-websocket-protocol.md`(+1/-1)
  **두 파일뿐**. 프롬프트 번들의 방대한 본문 대신 이 실제 diff 를 1차 대상으로 삼았다.
- 이 diff 가 어느 커밋에서 왔는지 `git log`/`git show` 로 추적 — `4c1f89e55`(§R17 미결→결정 교체,
  I1·D 종결) + `9dee1caa0`(잔여 ③ workflow-assistant 항목 추가, `/ai-review 17_12_34` 대응). 둘 다
  이 worktree 의 커밋 이력에 있고, 각각 선행 `--spec`(`16_03_57`→BLOCK:YES→`16_32_42`→BLOCK:YES→
  `16_48_55`→BLOCK:NO) 라운드를 거쳤음을 확인.
- 정본 트래커 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 와 집행 plan
  `plan/in-progress/eia-internal-rest-error-masking.md` 를 전문 대조 — target 이 "결정됨"이라
  쓴 두 항목(I1, D)이 트래커에도 같은 날짜·같은 문구로 닫혀 있는지, target 이 "잔여/범위 밖"으로
  적은 3항목(① WS emit·② inputData/outputData·③ workflow-assistant)이 트래커에 별도 `[ ]` 오픈
  항목으로 정확히 등재돼 있는지 line-by-line 확인.
- `git diff origin/main -- spec/2-navigation/14-execution-history.md spec/4-nodes/1-logic/12-background.md
  spec/conventions/secret-store.md` 로 target 이 인용하는 자매 문서(§R17 밖)도 실제로 짝을 맞춰
  갱신됐는지 확인 (전부 5-system 밖이라 diff scope 엔 없지만 target 이 명시적으로 참조).
- 코드 실측: `redactStoredErrorForResponse` 가 `executions.service.ts`(4곳: `findById` 관문 경유 ·
  `toExecutionDto` · `getChain` · `stop`) 와 `background-runs.service.ts` 에 실제로 걸려 있는지
  `grep` 으로 확인 — target 이 "적용 지점 4곳 + 자매 표면" 이라 쓴 서술과 코드가 일치.
- 이전 라운드 산출물 `review/consistency/2026/08/16/16_48_55/plan_coherence.md` 를 읽어, 그때
  잡힌 INFO 2건(frontmatter `spec_impact`/`code:` 누락)이 이번 target 상태에서 해소됐는지 재검증.
- `plan/in-progress/**` 전체에서 target 이 건드리는 키워드(`Execution.error`·`redactStoredError`·
  `execution.snapshot`·`triggerToken`·"미결"·"향후 secret store 통합 검토")를 grep, 다른 plan 이
  target 이 교체한 구 문구를 전제로 인용하고 있지 않은지 확인.

## 발견사항

발견사항 없음 (CRITICAL/WARNING/INFO 모두 0).

target diff 는 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)의 두 미결 항목(**I1** —
"내부 REST 와 WS 가 같은 `Execution.error` 에 다른 값을 말한다", **D** — `interaction.triggerToken`
secret-store 편입 여부)을 **사용자가 2026-08-16 에 택일한 결과를 그대로 집행**한다. 트래커 쪽도
같은 커밋 이력 안에서 "결정됨 (2026-08-16, 사용자 택일)" 캐비엇으로 짝을 맞춰 닫혀 있어, "plan
이 아직 모르는 target 의 결정"은 없다.

target 이 새로 연 잔여 3항목(① WS `execution.node.*` emit 원문 · ② `inputData`/`outputData` 비대칭 ·
③ workflow-assistant `maskSensitiveFields` 와 값-패턴 마스킹의 의미 충돌)은 전부 **"결정 아님, 트래커
등재"** 로 명시적으로 유보돼 있고, 트래커(`spec-sync-external-interaction-api-gaps.md:213-232`)에도
각각 독립 `[ ]` 항목으로 등재돼 있다 — target 이 이 미결 항목들을 일방적으로 판단하지 않았다.
특히 ③은 "단순 합성이 답이 아니다"를 실측(기존 테스트 RED)으로 반증한 뒤 코드 변경을 **되돌리고**
트래커에만 등재한 이력이 diff 에 남아 있어(9dee1caa0), 결정 우회가 아니라 결정 보류가 실제로
지켜졌음을 코드 레벨에서 확인했다.

자매 문서(`14-execution-history.md`·`12-background.md`·`secret-store.md`, 전부 diff scope 밖)도
target 이 참조를 약속한 대로 실제 편집돼 있고(`git diff origin/main` 으로 확인), frontmatter
`spec_impact`/`code:` 도 이전 라운드(`16_48_55`)가 지적한 두 INFO(“`14-execution-history.md` 가
`spec_impact`/`redact-stored-error.ts` `code:` 목록에서 빠짐”)를 반영해 현재는 둘 다 등재돼 있다 —
재발 없음.

## 요약

target(`spec/5-system/14-external-interaction-api.md`·`6-websocket-protocol.md`)의 이번 diff 는
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`(정본 트래커)와
`plan/in-progress/eia-internal-rest-error-masking.md`(집행 plan)에 사전 등재된 미결 항목(I1·D)의
사용자 택일 결정을 그대로 반영한 것이며, 두 plan 문서가 같은 커밋 이력 안에서 target 과 짝을 맞춰
갱신돼 있다. target 이 새로 연 3개 잔여 항목은 스스로 "결정 아님"으로 명시하고 트래커에 별도
오픈 항목으로 등재해 두어 미해결 결정을 우회하지 않았고, 코드 실측으로도 서술(적용 지점 4곳+자매
표면)과 실제 구현이 일치했다. 다른 `plan/in-progress/**` 문서 중 target 이 교체한 구 문구("미결이다"/
"향후 secret store 통합 검토")를 전제로 인용하는 곳은 없어 후속 항목 무효화 위험도 없다. 이전
라운드(`16_48_55`)가 잡았던 frontmatter 완결성 INFO 2건도 이번 target 상태에서 이미 해소돼 있다.

## 위험도

NONE
