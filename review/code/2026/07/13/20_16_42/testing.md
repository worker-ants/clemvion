### 발견사항

- **[INFO]** 이번 라운드(`20_16_42`) payload 에도 실제 마지막 커밋의 코드 diff 가 빠짐 — harness diff-list 갭 재발(누적 3회차 이상)
  - 위치: 본 세션 `prompt_file` 대상 파일 1~26 전부(review 산출물 md/json 25개 + `spec/3-workflow-editor/2-edge.md` 1개, 전자는 대부분 `20_02_41` 라운드 산출물의 재수록)
  - 상세: `git log --oneline -3` 로 확인한 실제 최신 커밋은 `12ea43d7a`("SoT 상수 3번째 호출부 완성")이며 `git show 12ea43d7a --stat` 로 대조한 결과 이 커밋이 변경한 실제 프로덕션 코드 파일 `codebase/frontend/src/lib/stores/editor-store.ts`(`propagateContainerInMap` 472/477행)는 이번 payload 어디에도 포함돼 있지 않다. `19_42_07/requirement.md`→`20_02_41/architecture.md`·`requirement.md` 가 이미 2회 연속 지적한 것과 동형의 harness 결함이 이번에도 재발했다. Testing 관점에서는 이 갭이 "이번에 추가된 코드에 대응하는 테스트가 있는지"를 diff 만으로 판단할 수 없게 만든다는 점이 핵심이라, 아래 항목들은 모두 작업 트리를 직접 Read/실행해 검증한 결과다.
  - 제안: 이 changeset 의 코드 결함은 아님(architecture/requirement 가 이미 별도 WARNING 으로 추적 중인 orchestrator diff-base 산출 로직 문제). Testing reviewer 입장에서 추가할 점은 없음 — 참고로만 재기재.

- **[INFO/양호]** 실제 최신 커밋(`12ea43d7a`)의 코드 변경은 behavior-preserving 이며 기존 회귀 테스트로 이미 간접 커버됨
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `propagateContainerInMap`(472, 477행) — `'body'`/`'emit'` 문자열 리터럴 → `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` 상수로 치환(값 동일, 순수 리팩터)
  - 상세: `git show 12ea43d7a -- codebase/frontend/src/lib/stores/editor-store.ts` 로 직접 대조한 결과 로직 변경 없이 리터럴만 상수로 치환됐다(`grep -n "'body'\|'emit'"` 결과 `editor-store.ts` 전체에서 상수 정의 외 리터럴 0건, 3개 호출부 전부 상수화 완료 확인). 이 함수의 Rule 1(body 핸들 → target 을 컨테이너로 강제) 분기는 `editor-store.test.ts:308` "컨테이너 진입(body) 엣지 제거 시 자식의 containerId 를 재도출한다" 테스트가 `removeEdge`→`deriveContainerAssignments`→`propagateContainerInMap` 경로로 정확히 이 코드 라인을 실행해 이미 회귀를 잡는다. `npx vitest run edge-utils.test.ts editor-store.test.ts` 를 직접 실행해 재확인한 결과 **158 passed(92+66)** — 커밋 메시지·RESOLUTION.md 의 주장과 정확히 일치, 회귀 없음.
  - 제안: 조치 불요.

- **[INFO]** `propagateContainerInMap` 의 Rule 2(emit 핸들 분기)는 이 특정 호출 경로(`removeEdge`→`deriveContainerAssignments`)에서 직접 단언하는 테스트가 없음 — 낮은 우선순위
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts:477` (`isContainerNode(targetNode) && connection.targetHandle === CONTAINER_EMIT_HANDLE`)
  - 상세: `editor-store.test.ts` 전체에서 `targetHandle: "emit"` 를 쓰는 엣지는 1건(363행 "Loop body 내부 체인 엣지 분할" 테스트)뿐이고, 그 테스트는 `emit` 엣지 자체를 `removeEdge` 하지 않아 이 Rule 2 분기를 이 경로로 직접 실행하지 않는다. 다만 같은 상수(`CONTAINER_EMIT_HANDLE`)는 `detectContainerConflict`/`propagateContainerOnConnect`(onConnect 경로)에서 이미 별도로 테스트되고, 이번 변경 자체가 순수 리터럴→상수 치환(로직 무변경)이라 실질 회귀 리스크는 낮다.
  - 제안: 차단 사유 아님. 여유 있을 때 "컨테이너 loopback(emit) 엣지 제거 시 source 의 containerId 재도출" 테스트 1건을 추가해 Rule 1/Rule 2 대칭 커버리지를 완성하면 이 함수 전체가 이 경로로 완전히 lock 된다.

- **[INFO/양호]** 이전 라운드가 지적한 테스트 관련 항목들의 실제 상태를 재확인 — 전부 변동 없이 정확히 유지됨
  - `buildEdgeSplitPlan(edge, id, null|undefined)` 방어 테스트: `edge-utils.test.ts:510-512` 에 실제 존재 확인(`toBeNull()` 단언 2건).
  - `onDrop`(workflow-canvas.tsx) DOM 배선 통합/e2e 테스트: 여전히 부재 확인(`find . -name "workflow-canvas*"` 결과 소스 파일 1개뿐, 대응 테스트 파일 없음). 기존 합의·이월 사항 그대로, 이번 changeset 이 새로 만든 갭 아님.
  - "노드 복제"(우클릭) phantom-undo: `workflow-canvas.tsx` `handleNodeMenuAction` `case "duplicate"`(451행 `pushUndo()`) + `addNode`(`editor-store.ts:840` 내부 무조건 `get().pushUndo()`) 이중 호출 구조가 코드에 그대로 남아 있음을 직접 확인 — 여전히 무테스트. 다만 `plan/complete/spec-sync-edge-gaps.md` "비고" 섹션에 `task_89a0d3a2` 로 실제 등록돼 있음을 `grep` 으로 확인해, `20_02_41` 라운드가 지적한 "backlog 미등록" WARNING 은 이번 라운드 기준 해소됨.

### 요약

이번 라운드(`20_16_42`)의 diff 는 review 산출물(`20_02_41` 세션의 SUMMARY/RESOLUTION/architecture/documentation/requirement/meta/retry-state)과 이미 이전에 반영된 spec 문서 텍스트만 포함하며, 실제 마지막 코드 커밋(`12ea43d7a`, `editor-store.ts` `propagateContainerInMap` SoT 상수 3번째 호출부 완성)은 payload 에서 빠져 있다 — architecture/requirement 가 이미 2회 연속 지적한 harness diff-list 갭이 그대로 재발한 것으로, 코드 결함이 아니다. 작업 트리를 직접 대조·실행해 검증한 결과 이 커밋의 실질 변경은 순수 리터럴→상수 치환(behavior-preserving)이며 기존 회귀 테스트(`editor-store.test.ts:308`)로 Rule 1 분기가 이미 커버되고, 테스트 스위트를 직접 실행해 158/158 통과(회귀 없음)를 재확인했다. Rule 2(emit) 분기는 이 특정 경로에서 직접 단언하는 테스트가 없어 대칭성이 완전하지 않으나(INFO, 비차단), 로직 변경이 없는 리팩터라 실질 리스크는 낮다. 이전에 식별된 두 테스트 갭(`onDrop` DOM 배선 무테스트, "노드 복제" phantom-undo 무테스트)은 상태 변화 없이 그대로이며, 후자의 backlog 추적 누락 문제는 이번 라운드 기준 canonical plan 등록으로 해소를 확인했다. 신규 CRITICAL/WARNING 은 없다.

### 위험도

NONE
