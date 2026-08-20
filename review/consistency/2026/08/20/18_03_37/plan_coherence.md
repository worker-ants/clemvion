# Plan 정합성 검토 — `spec/5-system/` (impl-done)

## 발견사항

없음. `plan/in-progress/**` 를 전수 스캔한 결과 target(`spec/5-system/` 및 연쇄 파일
`spec/1-data-model.md` · `spec/3-workflow-editor/3-execution.md` ·
`spec/4-nodes/1-logic/12-background.md`)의 변경과 충돌하거나, target 이 전제하는 선행
조건을 아직 해소하지 않은 plan, 또는 target 변경으로 무효화됐는데 반영되지 않은 후속
항목을 찾지 못했다.

### 확인한 근거

- **미해결 결정 우회 여부**: `spec/5-system/14-external-interaction-api.md` §R17 은
  "잔여 ③"(workflow-assistant LLM 도구 `explore-tools.service.ts` 의 `inputData`/
  `outputData`/`error` 약한 마스킹)을 **명시적으로 범위 밖으로 유지**하고 있고, 이는
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md:237` 의 열린 `[ ]` 항목
  (마스킹 의미 우선순위 결정 미완)과 정확히 일치한다 — target 이 이 미해결 결정을 일방적
  으로 대신 내리지 않았다.
- **선행 plan 미해소 여부**: target 이 전제하는 조건("프런트가 마커를 감지해 재입력을
  강제하는 가드")은 `plan/in-progress/eia-inputdata-marker-guard.md` 의 체크리스트가
  실제로 완결한 상태다(Re-run 모달 3-조건 가드, 에디터 히스토리 로드 차단, backend 두
  관문 마스킹, `MASKED_INPUT_DATA_REASON` 코드 전수 삭제 — codebase/spec 전수 grep
  0건으로 확인). `git diff --stat origin/main...HEAD -- spec/` 의 7개 변경 파일이
  `spec-draft-inputdata-egress-masking.md`·`eia-inputdata-marker-guard.md` 양쪽
  frontmatter `spec_impact` 7파일과 정확히 일치한다.
- **후속 항목 누락 여부**: `spec/5-system/13-replay-rerun.md`·`14-external-interaction-api.md`
  frontmatter `code:` 에 신규 소비처(`rerun-modal.tsx`·`editor-toolbar.tsx`·
  `masked-markers.ts`)가 모두 등재됐고, `spec/6-websocket-protocol.md` §4.1 의 "가르는
  축은 레벨" 프레임 폐기가 인접 plan(`spec-sync-websocket-protocol-gaps.md`) 어디에도
  의존하는 서술을 남기지 않았다. `spec-draft-eia-62-waiting-payload.md`·
  `retry-turn-terminal-guard.md` 에 남은 `inputData` 언급은 각각 WS payload 크기/성능
  조사, DB 컬럼 내부 재시도 상태 키로 본 변경과 무관한 축이라 충돌 없음.
  `38b4669bd`(라운드4 fix) 에서 `3-workflow-editor/3-execution.md` §8 "WS 이벤트에는
  inputData 미포함" 서술을 실측 정정한 추가 hunk 는 원 draft 의 8-항목 변경안 목록에는
  없었으나, 해당 커밋 메시지 자체가 발견 경위·근거를 설명하고 있어 plan 문서 미기재가
  추적성을 해치지 않는다(INFO 수준 미만으로 판단, 별도 발견사항으로 등재하지 않음).

## 요약

target(`spec/5-system/` 및 연쇄 3개 파일)의 `Execution.inputData` egress 마스킹 카브아웃
폐지는 `plan/in-progress/eia-inputdata-marker-guard.md`(developer)·
`spec-draft-inputdata-egress-masking.md`(planner draft)가 기록한 결정·집행과 완전히
일치하며, 열려 있는 유일한 인접 결정(§R17 잔여 ③ workflow-assistant 마스킹 의미 우선순위)은
target 이 침범하지 않고 범위 밖으로 명시했다. 코드 식별자(`MASKED_INPUT_DATA_REASON`)·
frontmatter `code:` 등재·연쇄 spec 파일(1-data-model·3-execution·12-background) 전부가
plan 이 약속한 대로 동기화됐다. Plan 정합성 관점에서 차단 사유 없음.

## 위험도

NONE
