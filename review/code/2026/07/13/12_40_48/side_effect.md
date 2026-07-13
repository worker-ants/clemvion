# 부작용(Side Effect) Review

대상: `plan/in-progress/spec-sync-edge-gaps.md` §1.3 (엣지 역방향 연결 확인 + 기존 엣지 재연결/분리 구현), 12개 변경 파일.

## 발견사항

- **[WARNING]** 신규 store 메서드 `deleteEdge` 가 기존 `workflowsApi.deleteEdge` 와 이름 충돌 — 부작용 프로파일이 정반대
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts:99,794`(신규 `deleteEdge: (edgeId) => void`) vs `codebase/frontend/src/lib/api/workflows.ts:147`(기존 `deleteEdge: (edgeId: string) => apiClient.delete(\`/edges/${edgeId}\`)`)
  - 상세: 이번 diff 가 도입한 store `deleteEdge`는 로컬 Zustand 상태만 바꾸는 순수 mutator다(undo 가능, 실제 서버 반영은 이후 `saveCanvas` 저장 시점). 그런데 동일한 이름의 `workflowsApi.deleteEdge`가 이미 `/edges/:id` 에 **즉시 DELETE 요청**을 보내는 네트워크 호출로 존재한다(`createEdge`/`deleteEdge` 둘 다 grep 결과 현재 호출부 없는 dead code — bulk `saveCanvas` 로 대체된 legacy 개별-엣지 REST로 보임). 두 함수는 이름이 동일하지만 하나는 local-only(저장 전까지 서버 미반영, undo 가능), 다른 하나는 즉시·비가역 네트워크 부작용이라, 향후 유지보수자나 신규 배선 시 어느 `deleteEdge`를 참조하는지 혼동하면 저장/undo 관례를 건너뛰고 실수로 즉시 서버 삭제를 트리거할 위험이 있다.
  - 제안: store 메서드를 `removeEdge` 등으로 구분되는 이름으로 바꾸거나, 미사용 상태인 `workflowsApi.deleteEdge`/`createEdge`(개별 엣지 REST, 현재 아무도 호출하지 않음)를 제거해 혼동 소지를 없앨 것.

- **[INFO]** `<ReactFlow>`에 `onReconnect*` 콜백을 배선하면서 구조적 엣지(컨테이너 `body`/`emit`)도 기본적으로 드래그 재연결/분리 대상이 됨
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`(`onReconnectStart`/`onReconnect`/`onReconnectEnd` 배선), `defaultEdgeOptions`/`custom-edge.tsx` 에 `reconnectable` opt-out 없음
  - 상세: React Flow 는 `onReconnect` 계열 prop 이 주어지면 별도 설정이 없는 한 모든 엣지의 끝점 앵커를 자동 렌더해 드래그로 재연결·detach 가능하게 한다. 이번 변경은 어떤 엣지 타입도 `reconnectable: false` 로 제외하지 않아, 컨테이너 진입(`body`)·loopback 수집(`emit`) 처럼 저장 시 `CONTAINER_MISSING_EMIT` 검증을 트리거하는 구조적 배선도 실수로 드래그해 분리/재연결될 수 있다. 다만 선택 후 Delete 로 지우는 것은 기존에도 가능했던 동작이라 완전히 새로운 데이터 무결성 위험은 아니고, 우발적 드래그 제스처로 트리거되는 상호작용 표면이 넓어졌다는 점만 참고 사항.
  - 제안: 의도된 동작이면 무시 가능. 컨테이너 필수 배선을 드래그 재연결에서 제외하고 싶다면 해당 엣지 data 에 `reconnectable: false` 부여를 검토.

- **[INFO]** `firstInputHandleId` 기존 export 함수의 동작(반환값 로직) 변경 — 시그니처는 동일
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts`(`RESERVED_INPUT_HANDLE_IDS` 도입)
  - 상세: 시그니처(`(definition) => string | null`)는 그대로지만 첫 입력 포트가 예약 포트(`emit`)면 건너뛰도록 내부 동작이 바뀌었다. grep 확인 결과 유일한 호출부는 `buildAutoConnectConnection`(§1.2 자동 연결)뿐이고, 현재 모든 노드 정의에서 첫 입력이 `emit` 인 경우가 없어 실질 회귀는 없다. 의도된 latent-risk 보강이며 신규 테스트 2건으로 커버됨.
  - 제안: 없음(정보성). 신규 컨테이너 노드 추가 시 계약 유지 여부만 유의.

- **[INFO]** `EditorState` 인터페이스에 `onReconnect`/`deleteEdge` 신규 메서드 추가 — additive, 하위 호환
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts`(`interface EditorState`)
  - 상세: 공개 store 인터페이스 확장이나 기존 메서드 제거·시그니처 변경은 없어 기존 소비자(컴포넌트·테스트)에 영향 없음. `useEditorStore.setState()` 로 부분 시딩하는 기존 테스트 패턴(zustand `Partial<T>` merge)과도 충돌 없음을 확인했다.
  - 제안: 없음.

- **[INFO]** `useEdgeReconnect` 훅의 `successful` ref — 컴포넌트 인스턴스 스코프 내부 상태, 전역 아님
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`
  - 상세: `useRef` 로 캔버스 컴포넌트 인스턴스에 스코프된 로컬 플래그이며 전역·모듈 스코프 변수가 아니다. 단일 포인터 드래그 제스처를 전제로 하며(React Flow 재연결 제스처 자체가 단일 상호작용), 동시에 두 재연결 제스처가 겹치는 멀티터치 시나리오는 다루지 않지만 React Flow 상호작용 모델과 일치해 실질 위험은 낮다.
  - 제안: 없음(참고).

- **[INFO]** store `onReconnect`/`deleteEdge` 는 저장(Ctrl+S) 전까지 로컬 상태만 변경 — 네트워크 호출 없음, 기존 `onConnect`/`removeNode` 패턴과 일관
  - 위치: `editor-store.ts` 신규 메서드
  - 상세: 두 메서드 모두 `set()` 으로 zustand 공유 store 만 변경하고 `isDirty:true` 로 표시할 뿐 즉시 서버에 반영하지 않는다. spec 본문("실제로 저장하는 순간 서버에 확정")·기존 `onConnect`/`removeNode`(존재하지 않는 id 로 호출돼도 무조건 `pushUndo`+`isDirty:true`) 패턴과 정확히 일치하는 의도된 공유 상태 변경이라 새로운 문제는 아니다.
  - 제안: 없음.

CHANGELOG.md·plan/spec·mdx 문서 변경은 서술 정정/등재이며 코드 부작용과 무관.

## 요약

이번 변경은 React Flow 의 기존 `onReconnect*` 콜백 체계를 얇은 오케스트레이션 훅(`useEdgeReconnect`)과 store 메서드(`onReconnect`/`deleteEdge`) 두 곳에 배선하는 순수 프런트엔드 편집기 확장으로, 신규 전역 변수·환경 변수·의도치 않은 네트워크 호출은 발견되지 않았고 store 변경은 기존 `onConnect`/`removeNode` 패턴과 일관된 의도된 공유 상태(zustand) 변경이다. 다만 신규 store 메서드 `deleteEdge` 가 부작용 프로파일이 정반대(local-only vs 즉시 네트워크 DELETE)인 기존 미사용 `workflowsApi.deleteEdge` 와 완전히 동일한 이름을 가져, 향후 오배선 시 저장/undo 관례를 건너뛰는 의도치 않은 네트워크 부작용으로 이어질 수 있는 명명 충돌이 유일하게 조치를 권할 만한 항목이다. 그 외 `<ReactFlow>` reconnect 배선이 구조적(컨테이너 body/emit) 엣지까지 기본 재연결 대상으로 넓히는 점과 `firstInputHandleId` 동작 변경은 실질 위험이 낮은 참고 사항이다.

## 위험도

LOW
