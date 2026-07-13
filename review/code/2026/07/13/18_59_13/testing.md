# 테스트(Testing) Review

대상: 엣지 분할(mid-insert) 구현 — `workflow-canvas.tsx`(`onDrop`), `edge-utils.ts`(`buildEdgeSplitPlan`/`findEdgeIdAtPoint`/`isContainerBoundaryEdge`/`firstOutputHandleId`), `editor-store.ts`(`removeEdge` `{skipUndo}`) + 대응 테스트 `edge-utils.test.ts`/`editor-store.test.ts`. (CHANGELOG/spec/plan/유저가이드/이전 리뷰라운드 산출물은 문서·프로세스 파일이라 테스트 관점 분석 대상에서 제외.)

## 발견사항

- **[WARNING]** `onDrop` 통합 배선 자체를 실행하는 테스트가 전혀 없다
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onDrop` (L706-740), `findEdgeIdAtPoint`→`targetEdge` 탐색→`buildAndAddNode`→`if (newId && targetEdge) { removeEdge; onConnect; onConnect }` 시퀀스
  - 상세: `workflow-canvas.tsx` 에 대한 component/RTL 테스트 파일 자체가 저장소에 없다(`find ... -iname "*test*"` 결과 `workflow-canvas.*` 부재). 따라서 이 PR 이 추가한 실질 배선 로직(hit-test 결과로 `edges` 배열에서 엣지를 찾는 부분, `newId && targetEdge` 가드, `removeEdge(skipUndo)` 후 `onConnect`×2 순서)은 어떤 자동 테스트로도 실행되지 않는다. 검증은 순수 헬퍼(`buildEdgeSplitPlan` 등) 단위테스트 + 수동/코드리뷰 추론(JSDoc "원자성" 주장)에만 의존한다. 라운드 1의 CRITICAL(새 노드가 컨테이너면 body 재편입)이 바로 이 통합 지점 근방에서 나온 결함이었다는 점에서, 배선 자체의 회귀(예: 가드 순서 실수, `targetEdge.id` 대신 `droppedEdgeId` 오사용, skipUndo 누락 등)는 향후에도 테스트로 못 잡는다.
  - 제안: RESOLUTION.md #4 가 이미 "canvas RTL 하네스 부재로 이월"을 기록해 인지된 부채이며 §1.2/§1.3 과 동일한 기존 한계이므로 즉시 차단 사유는 아니다. 다만 최소 비용으로, 실제 `useEditorStore` 인스턴스에 대해 `removeEdge(id,{skipUndo:true})` → `onConnect(sourceToNew,{skipUndo:true})` → `onConnect(newToTarget,{skipUndo:true})` 시퀀스를 그대로 재현하는 **store-레벨 통합 테스트**(컴포넌트/DOM 불필요, `buildEdgeSplitPlan` 이 만든 plan 을 그대로 넘기기만 하면 됨)를 추가해 "onConnect 2회가 항상 성공한다(toast.error 미호출, 최종 edges 2개)"는 불변식을 JSDoc 주석이 아닌 assertion 으로 고정할 것을 권장.

- **[WARNING]** 컨테이너 body 내부(경계 아님) 체인 엣지 분할 시 containerId 전파의 통합 테스트 부재
  - 위치: `editor-store.ts` `removeEdge`(전역 재도출 `deriveContainerAssignments`) + `onConnect`(증분 전파 `propagateContainerOnConnect`) 조합, `buildEdgeSplitPlan` 은 이 상호작용을 모른 채 Connection 만 조립
  - 상세: `buildEdgeSplitPlan` 단위테스트는 "컨테이너 **경계** 엣지"(원본 `sourceHandle==='body'`/`targetHandle==='emit'`)와 "새 노드 **자체**가 컨테이너"인 케이스만 커버한다. 그러나 실사용에서 흔할 시나리오 — **같은 컨테이너에 이미 속한 두 평범한 노드 사이의 일반 데이터 엣지**(예: Loop body 내부 `A(containerId=L) → B(containerId=L)`, 둘 다 body/emit 이 아닌 plain 핸들)를 분할하는 경우 — 는 `removeEdge`(엣지 제거 후 **전역** `deriveContainerAssignments` 재도출)와 이어지는 `onConnect`×2(각각 **증분** `propagateContainerOnConnect`)가 순차 실행되며, 새로 삽입된 노드가 최종적으로 올바른 `containerId=L` 을 상속받는지는 코드 추적으로는 정상 동작하는 것으로 보이나(체인 양 끝이 각각 body/emit 앵커로 재도출되고, 첫 `onConnect` 가 A→N 을 통해 L 을 N 에 전파) 이를 잠그는 store-레벨 테스트가 전혀 없다. `deriveContainerAssignments` 자체가 "16-pass fixed point + O(N) 최적화(W-23)"로 이미 한 번 성능 버그를 겪은 복잡한 로직이고, 3개의 개별 zustand 액션(비원자적 시퀀스)이 얽히는 지점이라 향후 리팩터가 이 상호작용을 조용히 깨뜨려도 현재 테스트 스위트는 검출하지 못한다.
  - 제안: `editor-store.test.ts` 에 "Loop 컨테이너 body 내부 체인 엣지를 분할하면 새 노드가 컨테이너 소속을 상속한다" 류의 통합 테스트 1건 추가(§1.3 재연결 테스트가 `deriveContainerAssignments` 를 이미 이런 식으로 검증하는 패턴을 재사용 가능).

- **[INFO]** `buildEdgeSplitPlan(edge, id, null/undefined)` 최상위 방어 분기 직접 테스트 부재
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `buildEdgeSplitPlan` 시그니처의 `definition: ... | null | undefined`
  - 상세: `firstInputHandleId`/`firstOutputHandleId` 각각의 null/undefined 케이스는 개별 테스트가 있으나, `buildEdgeSplitPlan` 자체를 `definition=null`/`undefined` 로 직접 호출하는 테스트는 없다. 실사용 호출부(`workflow-canvas.tsx` `onDrop`)에서는 `buildAndAddNode` 가 먼저 `getNodeDefinition(nodeType)` 존재를 확인해 실패 시 `newId` 를 반환하지 않으므로(`if (!definition) return undefined`), 이 분기는 사실상 도달 불가능하지만 타입 시그니처가 명시적으로 허용하는 만큼 방어적 회귀 테스트 1개를 추가하면 완전성이 높아진다.
  - 제안: `expect(buildEdgeSplitPlan(edge, "N", null)).toBeNull()` 1건 추가(우선순위 낮음).

- **[INFO/양호]** `findEdgeIdAtPoint` 의 `doc` 파라미터 주입 설계
  - 위치: `edge-utils.ts` `findEdgeIdAtPoint(clientX, clientY, doc = ... document ...)`, `edge-utils.test.ts` `fakeDoc`
  - 상세: 전역 `document` 대신 `Pick<Document, "elementFromPoint">` 를 주입 가능하게 해 jsdom 의 실제 레이아웃/히트테스트 구현 없이도 순수 단위테스트가 가능하다. `fakeDoc`/`doc` 목이 실제 DOM 계약(`elementFromPoint`→`Element|null`, `closest`→`Element|null`, `getAttribute`→`string|null`)을 정확히 흉내내며 과도한 mock 없이 필요한 최소 표면만 구현했다 — Mock 적절성·테스트 용이성(의존성 주입) 관점에서 모범적인 패턴.

- **[INFO/양호]** `removeEdge` 시그니처 확장의 하위 호환성
  - 위치: `editor-store.ts` `removeEdge: (edgeId: string, opts?: { skipUndo?: boolean }) => void`
  - 상세: `opts` 를 옵셔널로 추가해 기존 호출부·기존 테스트("엣지를 제거하고 undo 스냅샷을 남긴다", "컨테이너 진입(body) 엣지 제거 시 자식의 containerId 를 재도출한다")가 시그니처 변경 없이 그대로 통과한다. 회귀 테스트 관점에서 안전한 확장 방식.

- **[INFO]** CHANGELOG 테스트 개수 서술과 실제 diff 정합성 확인
  - 위치: `CHANGELOG.md` "테스트: `firstOutputHandleId`(2)·`isContainerBoundaryEdge`(4)·`buildEdgeSplitPlan`(8)·`findEdgeIdAtPoint`(4) + `removeEdge` skipUndo 1"
  - 상세: `edge-utils.test.ts`/`editor-store.test.ts` diff 의 실제 `it()` 블록 수를 센 결과 각 항목 모두 서술된 개수와 정확히 일치한다(firstOutputHandleId 2, isContainerBoundaryEdge 4, buildEdgeSplitPlan 8, findEdgeIdAtPoint 4, removeEdge skipUndo 1). 문서-테스트 정합성 양호, 별도 조치 불요.

- **[INFO/양호]** 테스트 가독성 — spec 근거·회귀 이력 명시
  - 위치: `edge-utils.test.ts` 신규 `describe` 블록 전반(예: `"새 노드 자체가 컨테이너면 null — body 재편입 위험 제외 (R-3, ai-review CRITICAL)"`)
  - 상세: 각 `it()` 설명이 spec 섹션(§4.1)·근거(R-3)·발견 경위(라운드 1 CRITICAL)를 함께 명시해, 왜 이 테스트가 존재하는지와 어떤 회귀를 막는지가 테스트 코드만으로 파악된다. 자기서술적(self-documenting) 회귀 테스트의 좋은 예.

## 요약

핵심 순수 헬퍼(`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`)는 문서화된 분기(핸들 보존·emit 제외·트리거·sink·컨테이너 경계·컨테이너 신규노드·다중 출력)를 빠짐없이 커버하고, 라운드 1에서 발견된 CRITICAL(컨테이너 새 노드의 body 재편입)도 전용 회귀 테스트로 잠갔다. `findEdgeIdAtPoint` 의 `doc` 의존성 주입, `removeEdge` 옵셔널 파라미터를 통한 하위 호환 확장, 정확한 테스트 개수 문서화 등 테스트 용이성·회귀 안전성 면에서 전반적으로 양호하다. 다만 실제 `onDrop` 통합 배선(hit-test→plan→`removeEdge`+`onConnect`×2 시퀀스)을 실행하는 테스트가 전무하고 — 이는 canvas RTL 하네스 부재라는 기존 부채로 이미 인지·이월된 사항이나 — 특히 컨테이너 body 내부의 평범한 체인 엣지를 분할할 때 `containerId` 가 `removeEdge`(전역 재도출)와 `onConnect`(증분 전파)의 조합을 거쳐 올바르게 전파되는지를 검증하는 store-레벨 통합 테스트가 없다는 점은, 순수 함수 단위테스트만으로는 잡을 수 없는 잔여 리스크로 남는다. 이 상호작용이 정확히 라운드 1 CRITICAL 이 나온 근방이라는 점에서 추가 회귀 테스트 투자 가치가 있다.

## 위험도
MEDIUM
