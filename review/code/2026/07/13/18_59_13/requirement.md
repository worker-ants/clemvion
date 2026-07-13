## 발견사항

이번 변경은 `spec/3-workflow-editor/2-edge.md` §4.1(엣지 분할/중간 노드 삽입)의 신규 구현이며, 착수 전 `consistency-check --impl-prep`(`review/consistency/2026/07/13/18_06_53`, BLOCK:NO, WARNING 5건)와 `/ai-review` 1회차(`review/code/2026/07/13/18_32_28`, CRITICAL 1 + WARNING 6)를 이미 거쳐 그 결과가 코드·spec·plan·유저가이드에 전부 반영된 상태다. 1회차에서 CRITICAL 로 지적된 결함이 이번 diff 에서 실제로 고쳐졌는지, 그리고 spec 본문과 line-level 로 여전히 일치하는지를 코드 추적으로 재검증했다.

- **[INFO]** 1회차 CRITICAL(컨테이너 새 노드 body 재편입)이 실제로 해소됐음을 코드 추적으로 확인
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `buildEdgeSplitPlan` (`if (definition?.isContainer) return null;`)
  - 상세: 1회차에서는 새로 삽입되는 노드가 컨테이너(Loop/ForEach/Map, `outputs:[{id:'body'},{id:'done'}]`, backend 스키마 `loop.schema.ts`/`foreach.schema.ts`/`map.schema.ts` 로 직접 확인)일 때 `firstOutputHandleId` 가 `body` 를 그대로 골라 `newToTarget.sourceHandle==='body'` 가 되고, `onConnect`→`propagateContainerOnConnect` Rule 1 이 발동해 원본 target 노드가 새 컨테이너의 body 자식으로 조용히 재편입되거나(또는 이미 다른 컨테이너 소속이면 `detectContainerConflict` 거부로 반쪽 그래프)되는 실결함이 있었다. 이번 diff 는 `buildEdgeSplitPlan` 최상단에 `definition?.isContainer` 가드를 추가해 컨테이너 새 노드는 분할 없이 노드만 추가하도록 막았고, 회귀 테스트(`edge-utils.test.ts` "새 노드 자체가 컨테이너면 null — body 재편입 위험 제외")로 `{outputs:[body,done], isContainer:true}` 케이스가 `null` 을 반환함을 검증한다. `firstInputHandleId`/`firstOutputHandleId`(예약 `emit` 제외/미제외 정확히 대칭) 도 함께 확인.
  - 제안: 없음(정상 수정 확인).

- **[INFO]** onConnect ×2 "항상 성공" 원자성 주장을 `detectContainerConflict`/`evaluateConnection` 소스까지 추적해 재검증
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `detectContainerConflict`(:247)·`evaluateConnection`(:620)·`isSelfConnection`/`isDuplicateConnection`; `edge-utils.ts` `buildEdgeSplitPlan`
  - 상세: (1) `sourceToNew.sourceHandle`은 원본 `edge.sourceHandle` 보존 값인데, `isContainerBoundaryEdge(edge)` 가드가 원본이 `sourceHandle==='body'` 인 엣지를 이미 배제하므로 Rule 1(`isContainerNode(sourceNode)&&sourceHandle==='body'`)에 걸리지 않는다. (2) `sourceToNew.targetHandle`은 `firstInputHandleId`(예약 `emit` 제외) 산출값이라 Rule 2(`targetHandle==='emit'`)에 걸리지 않는다. (3) `newToTarget.sourceHandle`은 `firstOutputHandleId`인데 새 노드가 `isContainer` 면 이미 `null` 반환(위 항목)이라 `body` 가 나올 수 없다. (4) `newToTarget.targetHandle`은 원본 `edge.targetHandle` 보존값인데 `isContainerBoundaryEdge(edge)` 가 `targetHandle==='emit'` 원본도 배제한다. (5) 새 노드 id 는 `crypto.randomUUID()` 로 신규 생성되어 자기연결(`isSelfConnection`)·중복(`isDuplicateConnection`) 모두 원천적으로 불가능. 결과적으로 `detectContainerConflict`의 두 거부 분기 중 어느 것도 두 신규 Connection 에 도달할 경로가 없어 spec/CHANGELOG 의 "onConnect 두 번이 항상 성공" 주장이 코드 레벨에서 실제로 성립한다 — WARNING #2(비원자적 mutation)의 "구성적 해소" 도 사후 서술이 아니라 검증 가능한 사실이다.
  - 제안: 없음(정상).

- **[INFO]** `isContainerBoundaryEdge` 의 `done` 오배제 수정도 backend 스키마와 대조해 확인
  - 위치: `edge-utils.ts` `CONTAINER_SOURCE_HANDLES = new Set(["body"])`(`done` 제거) / `parallel.schema.ts`(`outputs:[{id:'done', type:'data'}]`, `isContainer` 미설정)
  - 상세: Parallel Branch 노드는 컨테이너가 아니면서 동명 `done` 출력을 일반 데이터 포트로 쓴다(`parallel.schema.ts:91`). 1회차에는 `CONTAINER_SOURCE_HANDLES` 에 `done` 이 포함돼 이 데이터 엣지의 분할이 조용히 막혔으나, 이번 diff 는 `{body}` 만 남기고 `done` 을 제외해 해결했다. 테스트(`isContainerBoundaryEdge` "done 은 경계가 아니다")로 확인.
  - 제안: 없음(정상).

- **[INFO]** spec fidelity — §4.1 4개 불릿 + `## Rationale` R-3(후속 보강 포함) 이 코드와 line-level 로 일치
  - 위치: `spec/3-workflow-editor/2-edge.md` §4.1, `## Rationale` R-3 ↔ `edge-utils.ts`/`workflow-canvas.tsx`/`editor-store.ts`
  - 상세: "포트 선택"(첫 입력/첫 출력, 원본 핸들 보존, 다중 출력은 첫 출력만) · "적용 범위"(입출력 모두 있을 때만, 없으면 null→노드만 추가, `0-canvas.md` 일반 팔레트 드롭 fallback 참조로 정정돼 §4.2 자기참조 오독 문제도 해소됨) · "컨테이너 새 노드 제외" · "컨테이너 경계 엣지 제외(`done` 예외)" · "연결·불변식(원자성)" · "Undo(단일 체크포인트)" 6개 서술이 함수 시그니처·핸들 셋·조건 분기와 정확히 대응한다. R-3 Rationale 은 impl-prep WARNING(#1~#5, `18_06_53`)의 반영과 ai-review 1회차 CRITICAL 의 후속 보강을 모두 정확히 기록하고 있다. `pending_plans` 에서 완료된 `spec-sync-edge-gaps.md` 가 제거되고 `plan/complete/`로 이동한 것도 plan-lifecycle 관례와 일치.
  - 제안: 없음(정상).

- **[INFO]** Undo 원자성(단일 체크포인트) 재검증
  - 위치: `editor-store.ts` `buildAndAddNode`(무조건 1회 `pushUndo`) → `workflow-canvas.tsx` `onDrop`(`removeEdge`/`onConnect`×2 전부 `{skipUndo:true}`)
  - 상세: `pushUndo` 스냅샷은 노드 추가 직전 상태(원본 엣지 존재, 신규 노드/엣지 없음)를 1회만 캡처하므로 `undo()` 1회로 삽입 전체(노드+엣지 2개 제거, 원본 엣지 복원)가 정확히 되돌아간다. `editor-store.test.ts` 신규 테스트("{skipUndo:true} 면 엣지는 제거하되 undoStack 은 늘리지 않는다")로 `removeEdge` 쪽 skipUndo 동작도 별도 확인됨.
  - 제안: 없음(정상).

- **[INFO]** 1회차 WARNING 중 잔여(WARNING #4 통합 테스트 부재)는 의도적 이월이며 새 결함 아님
  - 위치: `workflow-canvas.tsx` `onDrop`(L707-744)
  - 상세: `onDrop` 의 "hit-test→plan 조립→removeEdge/onConnect 연쇄" 전체를 실제 컴포넌트 레벨에서 실행하는 테스트는 여전히 없다(canvas RTL 하네스 부재, §1.2/§1.3 때부터의 기존 갭). RESOLUTION.md 가 "canvas RTL 하네스 부재는 §1.2/§1.3/§3.2 기존 갭"으로 명시하고, CRITICAL #1 이 실제 발생하던 지점(`buildEdgeSplitPlan`, 순수 함수 레벨)에는 회귀 테스트를 추가해 그 결함 자체는 커버했다. 스코프 확장(전체 onDrop e2e)은 별도 이월로 문서화돼 있어 은폐된 미완성이 아니다.
  - 제안: 신규 결함 아님. 향후 canvas RTL 하네스 마련 시 함께 커버 권장(기존 이월 방침 유지).

- **[INFO]** TODO/FIXME/HACK/XXX 미검출
  - 위치: 변경된 소스 5개 파일(`grep -ni "TODO\|FIXME\|HACK\|XXX"`) 전체
  - 상세: 미완성 표식 없음.

## 요약
팔레트 노드를 기존 엣지 위에 드롭해 엣지를 분할·삽입하는 §4.1 기능은 의도한 대로 완전히 구현됐다. 특히 이전 ai-review 1회차에서 발견된 CRITICAL(컨테이너 새 노드 드롭 시 body 재편입/반쪽 그래프)은 `buildEdgeSplitPlan`의 `definition?.isContainer` 가드로 실제 해소됐음을 backend 노드 스키마(loop/foreach/map/parallel)까지 대조해 코드 레벨로 재검증했고, "onConnect 두 번이 항상 성공"한다는 원자성 주장도 `detectContainerConflict`의 두 거부 분기가 신규 Connection 에 도달할 수 없음을 직접 추적해 확인했다. `isContainerBoundaryEdge`의 `done` 오배제 수정(Parallel Branch)도 검증됐다. `spec/3-workflow-editor/2-edge.md` §4.1·`## Rationale` R-3은 코드와 line-level로 일치하며 impl-prep WARNING 5건·ai-review WARNING 6건이 모두 spec/코드/유저가이드/plan에 반영됐다. 잔여 미해결 항목(onDrop 통합 테스트 부재)은 기존에 알려진 스코프 밖 갭으로 명시적으로 이월됐을 뿐 은폐된 결함이 아니다. CRITICAL/WARNING 급 결함 없음.

## 위험도
NONE
