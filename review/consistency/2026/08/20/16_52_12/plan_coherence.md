### 발견사항

발견 없음.

검토 근거 (target: `spec/5-system/` + spec_impact 전 7개 spec 파일 vs `plan/in-progress/**`):

- **미해결 결정과의 충돌** — `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의
  "workflow-assistant LLM 도구 masking 우선순위" 미결 항목(라인 237~253, "어느 의미가
  우선하는지는 별도 결정")과 target `14-external-interaction-api.md` §R17 을 대조했다. target 은
  이 표면을 **"잔여 ③ (범위 밖 유지)"** 로 명시적으로 카브아웃하고 동일한 미결 사유("어느
  의미가 우선하는지는 별도 결정이라 분리했다")를 그대로 인용한다(§R17 라인 1607~1613) — target
  이 그 미해결 결정을 우회하거나 일방적으로 결정짓지 않았다.
- **선행 plan 미해소** — target 이 전제하는 선행 조건("프런트 마커 가드가 세 소비처(폼 프리필
  ·Re-run 모달·에디터 히스토리 로드)에 갖춰졌다")은 같은 워크트리의 `plan/in-progress/
  eia-inputdata-marker-guard.md` 자체가 이 PR 에서 구현을 완료했다(체크리스트 전항목 완료,
  `--impl-done` 5라운드 BLOCK:NO). 외부 plan 에 미해소 전제가 남아 target 을 뒷받침하지 못하는
  경우는 없었다.
- **후속 항목 누락** — target 변경(§R17 잔여 ② 종결 + `1-data-model.md`·`13-replay-rerun.md`·
  `3-workflow-editor/3-execution.md`·`12-webhook.md`·`6-websocket-protocol.md`·
  `4-nodes/1-logic/12-background.md` 6개 파일 동반 수정)이 남기는 후속 항목은 모두
  `spec-sync-external-interaction-api-gaps.md` 에 이미 개별 체크박스로 등재돼 있다 — 예:
  "`inputData` 마스킹 게이트 4곳 단일 헬퍼 통합"(라인 315), "`inputOverride` 서버측 마커 리터럴
  거부"(라인 322), "응답 의미 반전의 외부 소비자 확인"(라인 329), "Re-run 차단 판정 순수 함수
  추출"(라인 335), "마커 미러 계약 테스트(backend↔frontend)"(라인 346), "프리필 가드 후속
  3건"(라인 357). target 이 새로 만들거나 무효화했는데 미반영된 후속 항목은 발견되지 않았다.
  같은 트래커의 해당 항목(라인 281)도 "→ 해소 (2026-08-20)" 로 `[x]` 체크돼 target 과 plan 이
  동기화돼 있다.

추가로 대조한 것: `spec-draft-inputdata-egress-masking.md`(이 변경을 사전 설계한 planner
plan)의 "문서별 변경안" ①~⑦ 전항목을 실제 target diff(`git diff origin/main`)와 줄 단위로
대조 — 7개 파일 모두 draft 가 기술한 변경안대로 반영됐고 draft 밖 추가 변경이나 draft 미반영
잔여는 없었다(`MASKED_INPUT_DATA_REASON` 코드/spec 전수 0건 확인 포함). `retry-turn-terminal-guard.md`
의 `inputData[RETRY_STATE_KEY]`(in-memory 전용, 응답 노출 전 delete)는 이름만 겹치는 무관한
내부 메커니즘이라 충돌 대상이 아니다.

### 요약

target(`spec/5-system/` 6개 + `spec/1-data-model.md`·`spec/3-workflow-editor/3-execution.md`·
`spec/4-nodes/1-logic/12-background.md`)은 `plan/in-progress/eia-inputdata-marker-guard.md`
(구현)·`plan/in-progress/spec-draft-inputdata-egress-masking.md`(설계)·
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`(트래커)와 완전히 정합한다.
미해결로 남겨 둔 결정(workflow-assistant 마스킹 우선순위)은 target 이 우회하지 않고 카브아웃
캐비엇으로 그대로 보존했고, 이 변경이 파생시키는 후속 작업은 전부 트래커에 개별 항목으로
이미 등재돼 있다. push 전 최종 라운드로서 plan 정합성 관점의 차단 사유는 없다.

### 위험도
NONE
