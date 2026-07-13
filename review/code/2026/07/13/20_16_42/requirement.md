### 발견사항

- **[WARNING]** harness diff-list 갭이 이번(3회 연속: 19_42_07 → 20_02_41 → 20_16_42) 라운드에서도 미해결로 재발
  - 위치: `review/code/2026/07/13/20_16_42/_prompts/*.md` (본 세션 payload, 파일 1~26)
  - 상세: 직접 `git diff origin/main..HEAD --stat` 로 확인한 결과 이 브랜치는 76개 파일(코드 3개 소스+3개 테스트+CHANGELOG+MDX 4개+plan 1개+review 65개)을 변경했는데, 이번 payload 는 review 산출물(25개) + `spec/3-workflow-editor/2-edge.md`(1개)뿐이고 실제 소스(`edge-utils.ts`/`editor-store.ts`/`workflow-canvas.tsx`/테스트)는 여전히 포함되지 않는다. 특히 직전 커밋 `12ea43d7a`("SoT 상수 3번째 호출부 완성", `editor-store.ts` 4줄 diff)조차 이번 payload 에 없다 — 앞선 두 라운드(`19_42_07/requirement.md`, `20_02_41/requirement.md`)가 이미 이 결함을 WARNING 으로 지적하며 "orchestrator diff-base 로직 점검"을 권고했으나 3회째 그대로 재발했다. 신뢰성 리스크(실제 코드 결함을 조용히 놓칠 위험)가 계속 누적되고 있다.
  - 제안: 본 리뷰도 diff 를 신뢰하지 않고 실제 작업 트리를 직접 대조했다(아래 "확인된 사항" 참조, 결함 없음). orchestrator 의 diff-base 산출 로직(브랜치 전체 diff vs 세션 단위 diff)을 이번엔 실제로 수정할 것을 재차 권고한다 — 3회 연속 동일 권고가 무시된 것은 코드 문제는 아니나 harness 신뢰성 문제로 별도 escalation 이 필요해 보인다.

- **[정합성 확인 — 문제 없음]** spec `2-edge.md` §4.1 / R-3 서술과 실제 코드가 line-level 로 정확히 일치함을 직접 소스 대조로 재확인
  - `codebase/frontend/src/lib/utils/edge-utils.ts:137-138` `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` export, `247-248` `CONTAINER_SOURCE_HANDLES`/`CONTAINER_TARGET_HANDLES`(`isContainerBoundaryEdge`), `291-327` `buildEdgeSplitPlan`(컨테이너 경계 제외 `308` + 컨테이너 새 노드 제외 `309: definition?.isContainer` 가드) — spec 서술과 정확히 일치.
  - `codebase/frontend/src/lib/stores/editor-store.ts:24-25` import, `269/283`(`detectContainerConflict`), `334/342`(`propagateContainerOnConnect`), `473/477`(`propagateContainerInMap`) 세 곳 **전부** 상수 사용 확인(`grep`으로 `'body'`/`'emit'` 원시 리터럴 잔존 0건) — RESOLUTION(20_02_41→12ea43d7a)의 "3번째 호출부 완성" 주장이 실제로 이행됨.
  - `editor-store.ts:249-252` JSDoc "COUPLING (§4.1 edge split)" 상호 forward-pointer 주석 실존 확인.
  - `plan/complete/spec-sync-edge-gaps.md:39` 에 `task_78c80fec`·`task_89a0d3a2` 둘 다 등록 확인 — RESOLUTION(20_02_41) WARNING #2 "반영" 주장이 실제로 이행됨.
  - `workflow-canvas.tsx:609-611,726-727`(`buildAndAddNode` 단일 pushUndo 체크포인트 주석 + 실제 로직), `739-741`(`removeEdge`/`onConnect`×2 skipUndo) — R-3 "undo 단일 체크포인트 실측 보강" 서술과 일치.
  - `edge-utils.test.ts:510-512` `buildEdgeSplitPlan(edge, id, null|undefined)` 방어 테스트 실존(RESOLUTION #7 반영 확인).
  - 테스트 수: `edge-utils.test.ts` 92 + `editor-store.test.ts` 66 = **158**(`it(` 카운트 직접 재확인) — 여러 RESOLUTION 문서의 "158 tests" 주장과 일치.
  - `CHANGELOG.md`, `connecting-nodes.mdx`/`.en.mdx`("엣지 위에 노드를 놓아 중간에 끼우기"/"Dropping a node onto an edge to insert it") 모두 실존·내용 일치 확인.
  - `edge-utils.ts`/`editor-store.ts`/`workflow-canvas.tsx` 전체에서 TODO/FIXME/HACK/XXX 없음(직접 grep 확인).

- **[INFO]** "노드 복제"(우클릭) phantom-undo 잔존 결함은 실재하며 스코프 밖 판단이 정확함
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:449-473`(`handleNodeMenuAction` `case "duplicate"` — `pushUndo()`(451행) 후 `addNode(newNode)`(472행) 호출), `editor-store.ts:839-840`(`addNode` 내부 무조건 `get().pushUndo()`)
  - 상세: 직접 소스 대조 결과 이 이중 `pushUndo` 는 실제로 존재해 §4.1 이 고친 것과 동일 근본 원인의 sibling 버그다. `plan/complete/spec-sync-edge-gaps.md` 비고에 `task_89a0d3a2` 로 이미 등록돼 있어 §4.1 changeset 자체의 결함으로 재기표할 필요는 없다 — 추적 위치가 확인됨.

### 요약

이번 라운드(20_16_42)의 requirement payload 는 25개 review 산출물(md/json)과 `spec/3-workflow-editor/2-edge.md` 1개 문서 diff 뿐이며, 실제 구현 코드(`edge-utils.ts`/`editor-store.ts`/`workflow-canvas.tsx` 및 테스트)는 3회 연속(19_42_07→20_02_41→20_16_42) 동일한 harness diff-list 갭으로 payload 에서 누락됐다(WARNING, review-infra 이슈 — orchestrator diff-base 산출 로직 점검이 재차 무시됨). 이를 우회해 작업 트리를 직접 Read/grep 한 결과, spec §4.1·R-3 가 서술하는 모든 규칙(포트 선택, 컨테이너 새 노드/경계 엣지 제외, `done` 예외, 원자성 근거, undo 단일 체크포인트, SoT 상수 3개 호출부 전부 적용, JSDoc 상호 forward-pointer)이 실제 코드와 line-level 로 정확히 일치하며, 이전 라운드들이 지적한 모든 WARNING(SoT 상수화 3번째 호출부, `task_89a0d3a2` canonical plan 등록)이 실제로 해소돼 있음을 확인했다. TODO/FIXME/HACK 등 미완성 표식, 반환값 누락, 미검증 에러 경로는 발견되지 않았다. 유일한 잔여 결함(노드 복제 phantom-undo)은 §4.1 스코프 밖이며 별도 backlog(`task_89a0d3a2`)로 정확히 추적되고 있다. 신규 CRITICAL 은 없다.

### 위험도

LOW