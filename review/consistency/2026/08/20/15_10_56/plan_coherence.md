# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 범위·방법

- Target: `spec/5-system/**`(diff-base `origin/main`) + 연동 `spec/1-data-model.md`·
  `spec/3-workflow-editor/3-execution.md`·`spec/4-nodes/1-logic/12-background.md`
- 실제 diff(`git diff origin/main...HEAD`)를 워킹트리에서 직접 재확인 — 101 files changed
- 이 worktree 는 이전에도 같은 관점으로 다섯 라운드 검토됐다(`12_08_46` CRITICAL3 →
  `12_29_59`/`12_41_29`(spec) → `12_58_14` → `14_44_42` NONE). 본 라운드(`15_10_56`)는
  `14_44_42` 이후 유일한 신규 커밋 `29d00021d`(15:10:16, 코드리뷰 `14_44_08` W1~W8 fix)가
  만든 **델타**에 집중했다.
- `29d00021d` 전체 diff(`rerun-modal.tsx`·`sanitize-error-message.ts`·
  `executions.service.spec.ts`·`spec/5-system/{13-replay-rerun,14-external-interaction-api}.md`·
  `plan/in-progress/{eia-inputdata-marker-guard,spec-sync-external-interaction-api-gaps}.md`)를
  직접 확인
- `plan/in-progress/` 전체(번들 미포함 58개 포함)를 `inputData`/`카브아웃`/
  `MASKED_INPUT_DATA_REASON`/`마커 가드`/`R17` 키워드로 grep, 매치된 3개 파일
  (`eia-terminal-payload.md`·`ie-resume-turn-boundary-cancel.md`·
  `spec-draft-eia-62-waiting-payload.md`)의 문맥을 열어 이번 PR 결정과 겹치는지 확인
- `MASKED_INPUT_DATA_REASON` 코드베이스 전수 grep으로 앵커 삭제 완료 재확인

## 발견사항

CRITICAL/WARNING 급 plan 정합성 결함 없음. 참고용 INFO 만 기록한다.

- **[INFO]** 두 plan(`eia-inputdata-marker-guard.md`, `spec-draft-inputdata-egress-masking.md`)이
  여전히 `status: in-progress`이고 developer 체크리스트 마지막 항목("코드 동결 →
  `/ai-review` → `--impl-done` → push")이 미완이다.
  - target 위치: 해당 없음 (plan 상태 메타)
  - 관련 plan: `plan/in-progress/eia-inputdata-marker-guard.md` 체크리스트 최하단
  - 상세: `14_44_42` 라운드에서와 동일한 관찰이며 이번 라운드에도 여전히 유효 — 이 호출
    자체가 그 체크리스트 항목("`/ai-review`") 실행 도중이다. `29d00021d`는 직전 코드리뷰
    (`14_44_08`, CRITICAL 0 / WARNING 8)의 fix 커밋이라 plan의 "착지 순서"(spec 먼저 →
    구현 → 리뷰 fix들, 전부 같은 PR)와 여전히 맞물린다.
  - 제안: 조치 불요. push 직전에 체크리스트 마지막 항목 체크 + `status` 전환.

## 정합성이 확인된 지점 (근거)

1. **미해결 결정 우회 없음** — §R17 "닫는 조건"(프런트 마커 가드 선행)이
   `spec-sync-external-interaction-api-gaps.md` 트래커에 등재돼 있었고, 이번 PR이 세 소비처
   (폼 #1181 + Re-run 모달 + 에디터 히스토리 로드) 가드를 실제로 갖춘 뒤에만 카브아웃을
   닫았다. `29d00021d`가 Re-run 모달의 차단 판정을 "값이 비었는가"→"사용자가 건드렸는가"→
   "**건드렸고 그리고 현재 값에 마커가 없다**"(두 조건의 합)로 재조정했고, 이 최종 규칙이
   `spec/5-system/13-replay-rerun.md`·`14-external-interaction-api.md`·plan 체크리스트
   세 곳 모두에 **동일하게** 반영돼 spec-drift(W1)가 실제로 해소됐다 — 코드
   (`rerun-modal.tsx`의 `blockedByMaskedInput = !useOriginalInput && maskedKeys.some((k) =>
   !touchedMaskedKeys.has(k) || hasMaskedMarkerLeaf(paramValues[k]))`)와 spec 문구가
   일치한다.
2. **선행 plan 정상 해소** — `--impl-prep`(`12_08_46`)의 CRITICAL 3(spec 미러 drift)이
   planner 턴(`--spec` `12_29_59`→`12_41_29` BLOCK:NO)으로 먼저 풀린 뒤 developer 턴이
   재개된 순서가 diff(spec 7파일 전부 포함)로 재확인됐고, 이번 델타(`29d00021d`)도 같은
   원칙(코드 판정 변경 시 spec을 즉시 동반 갱신)을 따랐다.
3. **후속 항목 누락 없음** — `29d00021d`가 이번 PR을 막지 않는 후속 3건(마스킹 게이트 4곳
   통합 헬퍼 · `inputOverride` 서버측 마커 거부 · 응답 의미 반전의 외부 소비자 확인)을
   `spec-sync-external-interaction-api-gaps.md`에 신규 등재했다 — 코드리뷰(`14_44_08`)가
   낸 W4/W5/W6를 defer 결정과 함께 트래커에 정확히 이관했다(사유·범위 명시 포함, 근거 없는
   방치가 아니다). `MASKED_INPUT_DATA_REASON`은 여전히 코드베이스 전수 0건.
4. **타 in-progress plan과 충돌 없음** — `inputData`/`R17` 키워드로 매치된 나머지 3개 plan
   (`eia-terminal-payload.md`: §R17 WS 봉투/strip 범위, 이미 `--impl-done` BLOCK:NO로 완료;
   `ie-resume-turn-boundary-cancel.md`: `USER_MESSAGE` 라이브 시그널 마스킹 비대칭 — 이미
   해소 기록; `spec-draft-eia-62-waiting-payload.md`: WS emit 페이로드 크기·`llmCalls` strip)는
   모두 §R17의 **다른 축**(노드 이벤트 strip, WS payload 크기)을 다루며 `Execution.inputData`
   egress 카브아웃 결정과 겹치지 않는다.

## 요약

`14_44_42` 라운드에서 이미 CRITICAL/WARNING 없음으로 판정된 상태에서, 그 이후 유일한 신규
커밋(`29d00021d`, 코드리뷰 `14_44_08`의 W1~W8 fix)이 만든 델타를 재검토했다. 이 커밋은
Re-run 모달의 차단 판정을 "두 조건의 합"으로 강화하면서 그 규칙 변경을 spec 2곳(§10.2·§R17
비교표)과 plan 체크리스트 3곳에 동시 반영해 spec-drift를 스스로 잡았고, 이번 PR을 막지 않는
후속 3건을 트래커에 명시적으로 등재했다. 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락
어느 것도 발견되지 않았다.

## 위험도

NONE
