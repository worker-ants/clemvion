# Plan 정합성 검토 — `spec/5-system/` (impl-done, diff-base `origin/main`)

## 검토 범위 및 방법

target = `spec/5-system/` (impl-done). 이번 PR 의 주제는 `Execution.inputData` egress
마스킹 카브아웃 폐지(§R17) — `plan/in-progress/eia-inputdata-marker-guard.md`(developer) +
`plan/in-progress/spec-draft-inputdata-egress-masking.md`(planner draft) 가 같은 worktree
에서 함께 착지하는 구조다.

프롬프트 번들(`_prompts/plan_coherence.md`)이 컨텍스트 예산 초과로 다수 plan 파일 본문을
절단했으므로(`node-output-redesign/*` 등 다수), 해당 파일들은 실제 워크트리(`plan/in-progress/**`)
에서 직접 열어 확인했다. `git diff origin/main --stat`(target worktree)로 실제 반영 파일
집합도 대조했다.

## 발견사항

없음 — CRITICAL/WARNING 대상 발견 없음.

- **[INFO]** 두 짝 plan 의 체크리스트가 완결 상태 — `push → PR` 만 미체크
  - target 위치: (해당 없음 — plan 상태 관찰)
  - 관련 plan: `plan/in-progress/eia-inputdata-marker-guard.md` §범위 마지막 줄
    (`- [ ] push → PR`), `plan/in-progress/spec-draft-inputdata-egress-masking.md`
  - 상세: developer/planner 두 plan 모두 나머지 항목이 전부 `[x]`(`--impl-prep`/`--spec`/
    `--impl-done` 3라운드 BLOCK:NO, `/ai-review` 3라운드 CRITICAL 0 수렴 포함)이고, 유일한
    미체크 항목이 "push → PR" 이다. `spec_impact` 7개 파일(`14-external-interaction-api.md`·
    `1-data-model.md`·`13-replay-rerun.md`·`3-workflow-editor/3-execution.md`·
    `12-webhook.md`·`6-websocket-protocol.md`·`4-nodes/1-logic/12-background.md`)이
    실제 `git diff origin/main --stat` 결과와 정확히 일치한다(7파일 전부 변경 확인).
  - 제안: 조치 불요. 이번 검토가 그 push 직전 게이트이므로 정상 흐름.

- **[INFO]** §R17 잔여 ③(workflow-assistant LLM 도구 마스킹 축 우선순위)은 target 이 의도적으로
  미해결 상태로 유지 — 정합
  - target 위치: `spec/5-system/14-external-interaction-api.md` §Rationale R17,
    "잔여 ③ (범위 밖 유지)" 불릿
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    "`workflow-assistant LLM 도구가 inputData·outputData·error 세 필드를 더 약한 마스킹으로
    내보낸다`" (미체크, `17_12_34` requirement W1 등재) — "값-패턴 vs 접미 힌트 마스킹 중
    무엇이 우선인지는 별도 결정" 이라 명시
  - 상세: target 문서가 이 축을 "별도 결정" 으로 명시적으로 열어 두고 이번 PR 범위 밖으로
    선언한 서술이, 실제 tracker 의 미해결 상태와 정확히 대응한다. 결정을 일방적으로 내리거나
    선행조건을 무시한 흔적 없음.
  - 제안: 조치 불요.

## 교차 확인한 잠재 충돌 후보 (결과: 충돌 없음)

- `plan/in-progress/eia-terminal-payload.md`(`Execution.error`/`durationMs`/`result.outputs`
  종결 payload 정리) — 체크리스트 전항목 완료, 이번 PR 의 diff 파일 집합과 겹치지 않음
  (`retry-turn.service.ts` 등 미변경 확인). 자매 plan 상호참조(`retry-turn-terminal-guard.md`)도
  이번 PR 범위 밖.
- `plan/in-progress/eia-context-schema-followups.md`(`getStatus.context` 스키마화 후속) —
  `inputData` 무관, `context`/DTO 위치 정규화 잔여 1건(조건부 트리거 미도달, 비차단)만 open.
- `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 의 `inputData` 언급은 WS emit
  payload **크기**(strip 성능) 맥락이며 egress 마스킹 대상 여부와는 다른 축 — 충돌 없음.
- `plan/in-progress/retry-turn-terminal-guard.md` 의 `spawnedRow.inputData[RETRY_STATE_KEY]`
  는 엔진 내부 재시도 상태 저장 메커니즘(DB 원문)이며 egress 응답 마스킹과 무관 — 충돌 없음.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `inputData` 카브아웃 항목이
  `[x]` **"→ 해소 (2026-08-20)"** 로 최신화돼 있고, 이번 PR 이 등재하는 신규 후속 4건(헬퍼 통합·
  `inputOverride` 서버측 마커 거부·외부 소비자 확인·마커 미러 계약 테스트)이 모두 비차단·
  defer 사유와 함께 등재됨. target 문서가 이 후속들을 완료로 잘못 선언하지 않음.

## 요약

target(`spec/5-system/`)의 `Execution.inputData` 카브아웃 폐지 서술은 개발 plan
(`eia-inputdata-marker-guard.md`)·spec draft plan(`spec-draft-inputdata-egress-masking.md`)·
추적 tracker(`spec-sync-external-interaction-api-gaps.md`)와 문서 간 완전히 정합한다.
§R17 이 명시했던 "닫는 조건"(프런트 마커 가드 3소비처)이 실제로 충족됐고, spec 반영 대상
7개 파일이 plan 의 "미러 전수" 표와 `git diff` 실측이 정확히 일치한다. 유일하게 열려 있는
결정 항목(§R17 잔여 ③, workflow-assistant 도구 마스킹 축 우선순위)은 target 이 스스로
"범위 밖" 으로 명시해 우회하지 않았고, 이번 PR 이 새로 등재한 후속 4건도 tracker 에 defer
사유와 함께 정확히 기록돼 있다. Plan 정합성 관점에서 차단 사유를 찾지 못했다.

## 위험도
NONE
