# 아키텍처(Architecture) 리뷰

대상: `workflow-canvas.tsx`(§1.2 onConnectEnd 배선), `edge-utils.ts`(+test, 순수 헬퍼 2종 추가), `plan/in-progress/spec-sync-edge-gaps.md`(체크박스 갱신)

## 발견사항

- **[WARNING]** `workflow-canvas.tsx` 의 책임 팽창(God Component 경향) 지속
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` 전체(1150줄), 특히 신규 `onConnectEnd`(L318-345)·`NodeSearchPopupState.source`(L104-107)
  - 상세: 이 컴포넌트는 이미 컨텍스트 메뉴 3종 상태머신, 검색 팝업, 키보드 단축키, 단일 노드 실행, DnD, 삭제 확인 다이얼로그, undo 등 다수의 상호 독립적 관심사를 한 함수 컴포넌트에 모아두고 있다. 이번 변경은 여기에 "드래그-드롭 자동 연결" 이라는 새 상호작용 흐름(상태 필드 확장 + 콜백 추가 + 기존 `handleAddNodeFromSearch`/`buildAndAddNode` 수정)을 더 얹었다. 순수 판정 로직(`isConnectionDroppedOnPane`/`firstInputHandleId`)은 `edge-utils.ts` 로 잘 분리했지만, 오케스트레이션(팝업 상태 전이 + `onConnect` 트리거)은 여전히 이 단일 파일에 귀속된다. 같은 plan 문서(`spec-sync-edge-gaps.md`) 의 미구현 항목 §1.3(입력 포트 역방향 드래그 + 재연결 모드)이 다음 순서로 예정되어 있어, 유사한 상태/콜백이 또 이 파일에 추가될 가능성이 높다.
  - 제안: 신규 기능만 놓고 보면 즉시 리팩터가 필요한 수준은 아니지만, §1.3 착수 전에 "드래그 종료 → 팝업 오픈 → 자동 연결" 오케스트레이션을 `useConnectionDragToCreate` 류의 전용 훅으로 추출해 컴포넌트 자체의 순수 렌더/배선 책임과 분리하는 것을 고려할 것. (기존 M-1 god-handler 분할 사례와 동일한 패턴.)

- **[INFO]** `NodeSearchPopupState.source` 필드가 방향성 비대칭 — §1.3 확장 시 재설계 소지
  - 위치: `workflow-canvas.tsx` L104-107(`source?: { nodeId: string; handleId: string | null }`), L142-157(`handleAddNodeFromSearch`)
  - 상세: 현재 `source` 는 항상 "출력 포트에서 시작해 새 노드의 입력으로 들어간다" 는 단방향 가정만 인코딩한다. §1.3(입력 포트에서 시작하는 역방향 드래그)이 구현되면, 새 노드가 `target` 이 아니라 `source` 역할이 되는 경우도 다뤄야 하므로 이 필드 하나로는 부족해 `role: 'source' | 'target'` 등으로 재구성해야 할 가능성이 크다. 지금 당장의 버그는 아니고 §1.2 스코프에서는 정상 동작하지만, 다음 spec 항목이 이미 예정되어 있는 만큼 "이 타입은 곧 확장될 것" 이라는 점을 인지해 둘 필요가 있다.
  - 제안: §1.3 구현 착수 시 `source` 필드를 방향 태그 있는 유니온으로 먼저 재설계하고 §1.2 로직을 그 위에 재배치할 것. 지금 이대로 두어도 무방(선반영 불필요).

- **[INFO]** `getNodeDefinition(nodeType)` 이중 조회 — 경미한 DRY 위반
  - 위치: `workflow-canvas.tsx` L143(`buildAndAddNode` 내부에서 1회) / L148(`handleAddNodeFromSearch` 에서 재조회)
  - 상세: `handleAddNodeFromSearch` 가 `buildAndAddNode` 호출 후 동일한 `nodeType` 에 대해 `getNodeDefinition` 을 다시 호출해 `firstInputHandleId` 에 넘긴다. 전역 레지스트리 조회 자체는 저렴하지만, 두 협력 함수가 "이 nodeType 의 definition" 이라는 동일 정보를 각자 재조회하는 결합 방식이라 향후 definition 조회 로직이 바뀌면(예: 비동기화) 두 곳을 동시에 손봐야 한다.
  - 제안: `buildAndAddNode` 가 `{ id, definition }` 형태로 반환하거나, `handleAddNodeFromSearch` 상단에서 definition 을 한 번만 조회해 양쪽에 전달하도록 정리하면 두 함수 간 암묵적 재조회 결합을 없앨 수 있다. 우선순위 낮음.

## 검토했으나 문제 없음으로 판단한 지점 (참고)

- `handleAddNodeFromSearch` 가 `onConnect` 스토어 액션을 직접 호출해 `isValidConnection`(드래그 중 커서 힌트 전용) 을 우회하는 구조를 처음엔 검증 우회로 의심했으나, `editor-store.ts` 확인 결과 실제 연결 유효성(자기연결·중복·컨테이너 충돌)은 전부 `onConnect` 내부에서 재검증되고 `isValidConnection` 은 드래그 중 UI 힌트 전용 함수다. 신규 노드는 아직 어떤 컨테이너에도 속하지 않으므로 `detectContainerConflict` 도 항상 통과한다 — 코드 주석의 "항상 통과" 주장이 실제로 성립한다. 레이어 책임(스토어=권위 있는 mutation 게이트, 컴포넌트=오케스트레이션) 분리가 올바르게 유지되고 있다.
- `edge-utils.ts` 는 이미 port-color 판정·자기연결/중복 판정·stale edge 정리 등 "엣지 도메인 순수 로직" 을 모아두는 응집된 모듈이었고, 이번에 추가된 2개 함수도 같은 도메인(연결 판정)에 속해 모듈 경계를 흐트러뜨리지 않는다. 순환 의존성도 발견되지 않았다(`edge-utils.ts` → `node-definitions`/`resolve-dynamic-ports` 단방향).
- `firstInputHandleId` 가 정적 `definition.inputs` 만 참조하고 동적 포트 해석(`resolveDynamicPorts`)을 쓰지 않는 점은, 코드베이스 전반에서 입력 포트가 애초에 동적이지 않다는 불변식(동적 포트는 출력에만 존재, `dropStaleEdges` 의 `validInputs`/`validOutputs` 구현 비대칭이 이를 뒷받침)과 일치해 리키 추상화가 아니다.

## 요약

§1.2 요구사항(출력 포트 드래그 → 빈 영역 드롭 시 노드 추가 팝업 + 자동 연결) 구현은 순수 판정 로직을 `edge-utils.ts` 로 적절히 분리하고, 실제 연결 mutation 은 스토어의 기존 `onConnect` 게이트(자기연결/중복/컨테이너 충돌 검증 포함)에 위임해 레이어 책임 분리를 잘 지켰다. 다만 오케스트레이션 코드가 이미 다관심사인 `workflow-canvas.tsx` 에 계속 누적되고 있고, 새로 추가된 `NodeSearchPopupState.source` 필드는 다음 예정 항목(§1.3 역방향 드래그)에서 방향성 재설계가 필요할 가능성이 있다 — 지금 당장 결함은 아니지만 확장성 관점에서 주시할 지점이다.

## 위험도
LOW
