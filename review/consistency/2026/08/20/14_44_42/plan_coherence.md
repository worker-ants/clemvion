# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 범위·방법

- Target: `spec/5-system/**`(diff-base `origin/main`) + 연동 `spec/1-data-model.md`·
  `spec/3-workflow-editor/3-execution.md`·`spec/4-nodes/1-logic/12-background.md`
- 실제 diff (`git diff origin/main...HEAD`)를 워킹트리에서 직접 재확인
- 번들에 포함된 `plan/in-progress/eia-inputdata-marker-guard.md`(developer 턴) ·
  `plan/in-progress/spec-draft-inputdata-egress-masking.md`(planner 턴) ·
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(트래커) 전문 확인
- `plan/in-progress/` 전체 목록에서 `inputData`/`카브아웃`/`MASKED_INPUT_DATA_REASON`/`R17`
  키워드로 다른 in-progress 문서와의 충돌 가능성 전수 grep
- `review/code/2026/08/20/14_08_45/{SUMMARY,RESOLUTION}.md` 및 후속 커밋 `b0d841923` 대조
- 코드 SoT(`rerun-modal.tsx`) 를 열어 spec 이 서술하는 가드 동작(토글 ON 시 해제 등)이
  실제로 landed 됐는지 확인

## 발견사항

이번 세션에서 CRITICAL/WARNING 급 plan 정합성 결함은 발견되지 않았다. 참고용 INFO 만 기록한다.

- **[INFO]** 두 plan 문서(`eia-inputdata-marker-guard.md`, `spec-draft-inputdata-egress-masking.md`)가
  `status: in-progress` 로 남아 있고 developer 체크리스트의 마지막 항목("코드 동결 →
  `/ai-review` → `--impl-done` → push")이 미완이다.
  - target 위치: 해당 없음 (plan 상태 메타)
  - 관련 plan: `plan/in-progress/eia-inputdata-marker-guard.md` 체크리스트 최하단
  - 상세: 이는 결함이 아니라 정확히 지금 이 `--impl-done` 호출이 그 체크리스트 항목의
    실행 도중이라는 뜻이다. plan 자신의 "착지 순서" 절이 "spec 커밋(`7da315c10`) → 가드
    구현(`37da9b593`) → 리뷰 fix(`b0d841923`)" 순서로 같은 PR 에서 함께 착지한다고
    명시했고, 실제 git log 가 정확히 그 순서를 따른다. 두 plan 은 같은 worktree 에서 함께
    push 된 뒤 `plan/complete/` 로 이동하는 것이 정합적이다.
  - 제안: 조치 불요. push 직전에 두 plan 의 체크리스트 마지막 항목을 체크하고 `status`
    전환을 진행하면 된다(본 checker 의 역할 밖).

## 정합성이 확인된 지점 (근거)

1. **미해결 결정 우회 없음** — §R17 "닫는 조건"(프런트 마커 가드 선행)은 `spec-sync-external-interaction-api-gaps.md`
   트래커 항목에 등재돼 있었고, 이번 PR 이 그 조건을 실제로 충족(폼 가드 #1181 + Re-run
   모달 + 에디터 히스토리 로드 3개 소비처)한 뒤에만 카브아웃을 닫았다. 트래커 항목도
   같은 날짜(2026-08-20)로 "해소" 처리돼 spec 변경과 plan 서술이 어긋나지 않는다. 별도
   범위로 명시적으로 열어 둔 "잔여 ③"(workflow-assistant LLM 도구 마스킹)은 이번 diff 가
   건드리지 않았고 spec 본문도 "범위 밖 유지"로 정확히 구분한다.
2. **선행 plan 정상 해소** — `--impl-prep`(`12_08_46`) 이 CRITICAL 3(spec 4~7파일 미러
   drift)으로 BLOCK 했고, 그 결론대로 planner 턴이 먼저 실행돼 7개 spec 파일을 갱신한 뒤
   (`--spec` `12_29_59` BLOCK:YES → `12_41_29` BLOCK:NO) developer 턴이 재개했다. 실제 diff
   에 그 7개 파일(`1-data-model.md`·`3-workflow-editor/3-execution.md`·
   `4-nodes/1-logic/12-background.md`·`5-system/{12-webhook,13-replay-rerun,14-external-interaction-api,6-websocket-protocol}.md`)
   전부가 포함돼 있어 선행 조건이 실제로 채워진 뒤 구현이 붙었다.
3. **후속 항목 누락 없음** — `MASKED_INPUT_DATA_REASON` 앵커 상수는 plan 이 예고한 "6개
   참조처 전수 삭제"대로 코드베이스 grep 0건이다(`grep -rn` 확인). frontmatter `code:`
   갱신(13-replay-rerun.md 에 `rerun-modal.tsx`, 14-external-interaction-api.md 에
   `rerun-modal.tsx`+`editor-toolbar.tsx`)도 plan 이 요구한 대로 landed. 리뷰 라운드
   (`14_08_45`)가 낸 CRITICAL 2(중첩 object/array 마커 미검출, Swagger JSDoc 모순)는
   `RESOLUTION.md`+커밋 `b0d841923` 로 처리됐고, 코드(`hasMaskedMarkerLeaf` 를
   `splitMaskedParameters` 가 실제로 사용, `!useOriginalInput` 게이팅)로 재확인했다.
4. **타 in-progress plan 과 충돌 없음** — `inputData` 를 언급하는 다른 in-progress 문서
   (`retry-turn-terminal-guard.md`, `spec-draft-eia-62-waiting-payload.md`)는 각각 retry
   스폰 행(DB `input_data`, 내부 부기용)과 WS 노드 이벤트 payload 크기 문제를 다뤄, 이번
   PR 이 닫은 `Execution.inputData` egress 카브아웃 결정과는 다른 축이라 겹치지 않는다.

## 요약

`Execution.inputData` egress 마스킹 카브아웃 폐지는 트래커에 미리 등재된 조건부 결정을
조건 충족 후 집행한 사례로, developer↔planner 턴 전환·`--impl-prep`/`--spec` 게이트·리뷰
라운드·코드 SoT 가 서로 어긋남 없이 일관되게 맞물려 있다. spec 7파일·frontmatter·구 앵커
삭제·프런트 가드 동작까지 실측으로 교차 확인했고, 다른 in-progress plan 과의 결정 충돌이나
선행 조건 미해소, 후속 누락도 발견되지 않았다.

## 위험도

NONE
