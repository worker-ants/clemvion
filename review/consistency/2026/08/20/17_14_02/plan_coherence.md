# Plan 정합성 검토 — `spec/5-system/` (`eia-inputdata-marker-guard` / `spec-draft-inputdata-egress-masking`)

## 검토 방법
prompt 번들이 컨텍스트 예산으로 대부분 truncate 되어(`plan/in-progress/**` 64개 중 완전 본문 3개만
포함, `git diff` 자체도 truncate), 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/eia-inputdata-marker-guard`)에서 직접 `git log`·`git diff --stat`·`grep`·spec 파일 `Read` 로
재확인했다. 확인한 것: (a) 완전 포함된 3개 plan(`eia-inputdata-marker-guard.md`·
`spec-draft-inputdata-egress-masking.md`·`spec-sync-external-interaction-api-gaps.md`) 본문
전수, (b) 이전 라운드 plan_coherence 산출물(`12_29_59`·`12_41_29`)의 발견사항이 현재 해소됐는지,
(c) target 7개 spec 파일의 실제 커밋된 내용이 두 plan 의 서술과 일치하는지, (d) 다른
in-progress plan 이 "카브아웃"·`MASKED_INPUT_DATA_REASON` 등 이번에 뒤집힌 결론을 여전히
인용하는지.

## 발견사항

없음.

- 이전 plan_coherence 라운드(`12_41_29`)가 지적한 유일한 WARNING — "형제 plan
  `eia-inputdata-marker-guard.md` 의 `spec_impact`/체크리스트가 확장된 7파일 스코프를
  반영 못함" — 은 현재 두 plan 의 frontmatter `spec_impact` 가 모두 동일한 7개 파일
  (`14-external-interaction-api.md`·`1-data-model.md`·`13-replay-rerun.md`·
  `3-workflow-editor/3-execution.md`·`12-webhook.md`·`6-websocket-protocol.md`·
  `4-nodes/1-logic/12-background.md`)로 갱신돼 **해소됨**을 확인했다.
- 같은 라운드의 INFO — §R17 "프리필 왕복" 문단의 "두 사례가 정확히 그 두 갈래다" 문장이
  §R17 flip 후 stale 해진다는 지적 — 도 현재 spec 에서 "두 사례는 이제 **같은 갈래**(마커
  가드)이고, 도달한 경로만 다르다" 로 재작성돼 **해소됨**을 확인했다.
- `MASKED_INPUT_DATA_REASON` 코드/spec 전수 삭제 주장(plan 상 "6곳 전수 삭제") — 실제
  `codebase/`·`spec/` grep 0건으로 확증.
- 7개 spec 파일 diff(`git diff --stat origin/main...HEAD -- spec/5-system/` = 4파일,
  나머지 3파일은 `spec/5-system/` 밖)가 plan 이 선언한 파일 집합과 정확히 일치.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(마스터 트래커)의
  "`inputData` egress 마스킹 — 프런트 마커 가드가 선행돼야 한다" 항목이 `[x]` 로 닫히고
  "→ 해소 (2026-08-20)" 각주까지 갖췄으며, 이번 작업 중 새로 드러난 후속(게이트 4곳 헬퍼
  통합·`inputOverride` 서버측 리터럴 거부·응답 의미 반전의 외부 소비자 확인 등)은 전부
  **새 `[ ]` 항목으로 등재**돼 있어 "완료로 뭉개서 후속이 조용히 사라지는" 패턴이 없다.
- 트래커의 별도 open 항목 "workflow-assistant LLM 도구가 `inputData`·`outputData`·`error`
  를 더 약한 마스킹으로 내보낸다"(잔여 ③, `explore-tools.service.ts`)는 이번 변경 범위
  밖이며, §R17 본문도 "**잔여 ③ (범위 밖 유지)**" 로 명시적으로 갈라 둬 이번 flip 이
  그 표면까지 해결된 것처럼 과잉 서술하지 않는다 — 결정 충돌 없음.
- 다른 in-progress plan(`retry-turn-terminal-guard.md`·`eia-terminal-payload.md`·
  `eia-context-schema-followups.md`·`ws-event-types-extract.md` 등, budget 로 본문
  truncate)에 대해 filename/keyword grep 을 수행한 결과 "카브아웃"·`MASKED_INPUT_DATA_REASON`·
  `inputData` 마스킹 결정을 인용하는 곳은 이번 작업의 3개 plan 뿐이었다 — 결론을 뒤집힌
  줄 모르고 전제로 쓰는 stale 참조 없음.
- 두 plan(`eia-inputdata-marker-guard.md`·`spec-draft-inputdata-egress-masking.md`)의
  체크리스트는 "push → PR" 한 항목만 미완이고 나머지는 전부 `[x]`— target(spec) 변경과
  구현 완료 상태가 정합한다.

## 요약
이번 impl-done 대상(`spec/5-system/` 4파일 + 연관 3파일)은 §R17 이 스스로 명시한 "닫는
조건"(프런트 마커 가드)이 실제로 충족된 뒤에 진행된 **예고된 전환**이며, 미해결 결정을
우회하지 않았고 선행 조건(폼 가드 #1181 · Re-run 모달 가드 · 에디터 히스토리 가드)이 모두
같은 브랜치에서 함께 착지했다. 이전 두 차례 plan_coherence 라운드가 잡은 spec_impact drift 와
stale 문장은 모두 갱신돼 남아 있지 않고, 이번 작업이 새로 만든 후속 항목들은 마스터
트래커에 열린 체크박스로 정확히 등재돼 있다. plan 정합성 관점에서 추가로 갱신해야 할
plan 문서나 미반영된 후속 항목을 찾지 못했다.

## 위험도
NONE
