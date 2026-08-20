# Plan 정합성 검토 — spec/5-system/** (impl-done, `eia-inputdata-marker-guard`)

## 발견사항

없음. 아래 검증 범위에서 미해결 결정과의 충돌, 선행 plan 미해소, 후속 항목 누락을 모두 확인했으나 발견 없음.

## 검증 근거 (요약)

- 대상 diff(`git diff origin/main...HEAD`): `spec/5-system/{6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api}.md` + `spec/1-data-model.md` · `spec/3-workflow-editor/3-execution.md` · `spec/4-nodes/1-logic/12-background.md` — `Execution.inputData` egress 마스킹 카브아웃 폐지(§R17 잔여 ② 종결) + 프런트 마커 가드 신설.
- 이 변경을 뒷받침하는 두 in-progress plan 을 원문 대조:
  - `plan/in-progress/eia-inputdata-marker-guard.md` (developer 트랙) — 체크리스트 전항목 완료(`push → PR` 만 미완). impl-prep BLOCK:YES(CRITICAL 3, spec 미러 4문서 발견) → planner 턴 완료 → impl-prep 재실행 BLOCK:YES(spec-먼저-코드-나중, 예상된 순환) → 구현·회귀·`/ai-review` 3라운드(CRITICAL 0 수렴) → `--impl-done` 3라운드 전부 BLOCK:NO.
  - `plan/in-progress/spec-draft-inputdata-egress-masking.md` (planner 트랙) — 대상 diff 의 7개 spec 파일 변경안이 실제 diff 와 문구 단위로 일치. "착지 순서" 절이 두 plan 을 같은 PR/브랜치로 동시 착지시켜 spec-단독-선행 창을 명시적으로 차단.
  - `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (트래커) — 원 항목(2026-08-17 등재 "닫는 조건: 마커 가드")이 `- [ ]` → `- [x]` 로 정확히 전환되고 해소 근거가 첨부됨. 동시에 이번 구현이 새로 만든 후속 3건(마스킹 게이트 4곳 통합 W4·`inputOverride` 서버측 마커 거부 W6·응답 의미 반전의 외부 소비자 확인 W5)이 모두 미완(`- [ ]`)으로 신규 등재됨 — "후속 항목 누락" 없음.
- `spec_impact`(developer plan) 7파일 = 실제 diff 의 spec 파일 7개와 정확히 일치(Gate C 부합).
- 교차 검색(`MASKED_INPUT_DATA_REASON`, `Execution.inputData`, "가르는 축"/"레벨이 가른다", `dynamic-form-ui`/`masked-markers`, `rerun-modal`/`editor-toolbar`, §R17/"잔여 ②")로 다른 in-progress plan(`eia-terminal-payload.md`·`ie-resume-turn-boundary-cancel.md`·`spec-draft-eia-62-waiting-payload.md`·`spec-sync-stop-editor-and-forbidden-routes.md`·`retry-turn-terminal-guard.md`·`node-output-redesign/**` 등)에 옛 카브아웃 결정을 전제한 서술이나 이번 변경으로 무효화될 후속 항목이 있는지 확인 — 없음. `spec-sync-stop-editor-and-forbidden-routes.md`가 같은 파일(`editor-toolbar.tsx`)을 언급하지만 무관한 관심사(Editor+ 역할 가드)라 충돌 아님.
- 신규 후속 항목(W4/W5/W6) 중복 등재 여부도 grep 으로 확인 — `spec-sync-external-interaction-api-gaps.md` 한 곳에만 존재, 중복 없음.

## 요약

`spec/5-system/**`(및 연계된 `spec/1-data-model.md`·`spec/3-workflow-editor/3-execution.md`·`spec/4-nodes/1-logic/12-background.md`)의 이번 변경은 `plan/in-progress/eia-inputdata-marker-guard.md`·`spec-draft-inputdata-egress-masking.md`·`spec-sync-external-interaction-api-gaps.md` 세 plan 문서에 원문 단위로 완전히 미러돼 있다. §R17 이 명시했던 "닫는 조건"(프런트 마커 가드 3소비처)이 실제로 충족된 뒤 카브아웃을 닫는 흐름이며, developer 턴의 impl-prep 이 spec 미러 누락을 CRITICAL 로 선행 차단해 planner 턴을 강제했고 이번 diff 는 그 planner 턴의 산출물과 정확히 일치한다. 이번 구현이 새로 발견한 부수 결함 3건은 트래커에 미완 항목으로 신규 등재돼 후속 누락이 없고, 다른 in-progress plan 어디에도 이번 결정과 충돌하거나 무효화되는 서술이 남아 있지 않다.

## 위험도

NONE
