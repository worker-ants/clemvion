# Plan 정합성 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 발견사항

- **[WARNING]** `HANDOFF-eia-terminal-payload.md` 가 이미 해소된 두 차단을 미해결로 서술
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.2 blockquote (`waitingNodeType` 행) + `codebase/backend/src/modules/external-interaction/interaction.service.ts` (strip/redact 순서 JSDoc)
  - 관련 plan: `plan/in-progress/HANDOFF-eia-terminal-payload.md` §「🚫 차단 1」§「⚠️ 차단 2」§「재개 절차」2~4단계
  - 상세: 이 문서는 HEAD `9482cc0c0` 시점에 "두 게이트 결과 확보 후 push 직전 중단" 상태를 기록한 것인데, 현재 HEAD 는 `462455a52`(문서 시점보다 1커밋 앞)로 이미 두 차단을 모두 해소했다 — (1) §6.2 `waitingNodeType` 행을 철회하고 "외부 소비 매핑 없음 — `interactionType` 으로 분기" 로 재작성(차단 1 처방과 정확히 일치), (2) REST `getStatus` 경로 A/B 실측을 완료하고 `review/code/2026/08/14/16_44_37/RESOLUTION.md` 를 작성(차단 2 처방과 정확히 일치). 그러나 `HANDOFF-eia-terminal-payload.md` 본문은 여전히 이 둘을 "🚫"/"⚠️" 로 미해결 표기하고, 「재개 절차」 2~4단계("planner 턴 실행" · "RESOLUTION.md 작성" · "`--impl-done` 재실행")를 앞으로 할 일로 서술한다. 이 consistency 검토 자체가 사실상 그 4단계("`--impl-done` 재실행")에 해당하는 실행으로 보이므로, 이 문서가 실제 방치된 것이라기보다 **갱신 타이밍이 이 검토 라운드 뒤로 밀린 것**일 가능성이 크다. 다만 이 상태로 커밋/push 되면 다음에 이 문서를 읽는 세션이 이미 끝난 작업을 다시 하거나 "아직 차단됨" 으로 오판할 수 있다.
  - 제안: 이번 라운드가 `BLOCK: NO` 로 확정되면 push 전에 `HANDOFF-eia-terminal-payload.md` 의 게이트 표·차단 1/2·재개 절차를 "해소 완료(`462455a52`)" 로 갱신하거나, 더 이상 재개할 것이 없다면 문서를 정리(archive 또는 삭제)할 것.

- **[WARNING]** `spec-draft-eia-62-waiting-payload.md` 체크리스트가 §6.2 blockquote 항목(3)의 사후 정정을 기록하지 않음
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.2 blockquote (`node.type → waitingNodeType` 매핑 행)
  - 관련 plan: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` §체크리스트 "spec 반영 — **7항목** `(1)`~`(7)` 전부 (커밋 `4b13ca5ae`) ... `--impl-done` `15_36_59` 가 **BLOCK: NO**"
  - 상세: 이 plan 의 변경 제안 (3)("SSE 필드명 매핑 blockquote 정정")은 커밋 `4b13ca5ae` 로 반영됐고 체크리스트는 그 시점의 `--impl-done`(`15_36_59`)이 BLOCK:NO 였다는 근거로 "완료" 로 닫혀 있다. 그런데 (3)에서 함께 넣은 `node.type → waitingNodeType` 매핑 행은 **그 자체가 틀린 서술**이었음이 이후 라운드(`16_44_43` consistency CRITICAL)에서 드러나 `462455a52` 로 재정정됐다(WS §4.4 소유 필드를 EIA 외부 소비 필드로 잘못 넘겼던 것 — 개발자 본인이 "planner 턴에서 내가 넣은 §6.2 blockquote 행이 틀렸다" 고 커밋 메시지에 명시). 즉 체크박스가 "완료" 를 가리키는 시점 이후에 그 완료 판정의 근거였던 실제 문서 내용이 실질적으로 뒤집혔는데, 이 plan 문서에는 그 정정 이력이 각주로 남아 있지 않다 — 같은 파일 안에 이미 여러 차례("`REST getStatus` 경로도 쟀다" 등) 사후 정정을 각주로 붙이는 관례가 있는 것과 대비된다.
  - 제안: 체크리스트 (3) 항목 아래에 "**소급 정정 (`462455a52`)** — `waitingNodeType` 행은 WS 내부 전용으로 재정정됨(consistency `16_44_43` CRITICAL)" 한 줄 각주를 추가해, 다음 사람이 `4b13ca5ae` 만 보고 §6.2 blockquote 의 현재 형태를 오판하지 않게 할 것.

## 요약

target(`spec/5-system/`)의 이번 diff(§6.2 `waitingNodeType` 행 철회 + `Planned` 표기 통일 + strip/redact 순서 JSDoc 실측 병기)는 그 자체로 `plan/in-progress` 의 미해결 결정을 우회하거나 선행 조건을 무시하지 않는다 — 오히려 `HANDOFF-eia-terminal-payload.md` 가 명시적으로 요구한 두 차단(waitingNodeType SoT 상충, REST 이중 순회 미실측)을 정확히 그 처방대로 해소한 정합적인 후속 커밋이다. 교차 참조도 대체로 건강하다: `retry-turn-terminal-guard.md` #2(`cancelledBy` 누락)·`spec-sync-external-interaction-api-gaps.md` 의 `getStatus` 일반 키 allowlist 잔여·`backend-lint-gate-broken-on-main.md` 의 (b) 결정 이력 모두 target 변경과 모순 없이 여전히 유효한 상태로 남아 있고, `eia-terminal-payload.md` 자체의 실제 스코프(error 객체화·durationMs·result.outputs)는 아직 착수 전임이 체크리스트에 정확히 반영돼 있다. 다만 게이트 통과 속도가 문서 갱신 속도를 앞질러, `HANDOFF-eia-terminal-payload.md`(차단 현황 stale)와 `spec-draft-eia-62-waiting-payload.md`(완료 표시된 항목의 사후 정정 미기록) 두 곳에 "체크박스/서술이 최신 커밋을 따라잡지 못한" 흔적이 남아 있다 — 이 저장소가 반복적으로 겪어 온 "체크박스 drift" 패턴의 재발이며, push 전에 정리할 것을 권한다.

## 위험도

LOW
