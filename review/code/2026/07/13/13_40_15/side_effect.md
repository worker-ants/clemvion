# 부작용(Side Effect) Review

대상: `spec/3-workflow-editor/2-edge.md` §1.3(입력 포트 역방향 연결 확인 + 기존 엣지 재연결/분리) 최종 diff, `origin/main...HEAD` 4개 커밋(`d13257909`~`77850f5f9`) 누적, 46개 변경 파일. 실질 코드 부작용 대상은 `use-edge-reconnect.ts`(신규)/`workflow-canvas.tsx`/`editor-store.ts`/`edge-utils.ts`와 그 테스트이며, CHANGELOG/spec/plan/mdx·`review/code/2026/07/13/{12_40_48,13_06_50,13_27_36}/*` 산출물은 문서·리뷰 이력 기록으로 코드 부작용과 무관하다. 이 diff 는 이미 3회의 ai-review 사이클(HIGH→MEDIUM→LOW)을 거쳐 수렴한 최종본이며, 아래는 코드를 직접 읽어 독립 재검증한 결과다.

## 발견사항

- **[INFO]** `onReconnect`/`removeEdge` — 로컬 zustand 상태만 변경, 네트워크 호출 없음(기존 `onConnect`/`removeNode` 패턴과 일관)
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onReconnect`(L771 부근), `removeEdge`(L806 부근)
  - 상세: 두 메서드 모두 `set()` 으로 `edges`/`nodes`/`isDirty` 만 갱신하고 `pushUndo()` 로 undo 스택에 적재할 뿐, 저장(Ctrl+S) 전까지 서버에 반영되지 않는다. 직접 코드 확인 결과 신규 함수 어디에도 `fetch`/`apiClient`/`workflowsApi` 호출이 없다.
  - 제안: 없음.

- **[INFO]** 신규 store 메서드명 `removeEdge` — 기존 `workflowsApi.deleteEdge`(즉시 REST DELETE)와의 명명 충돌이 리네임으로 실제 해소됨을 재확인
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts:100`(JSDoc), `codebase/frontend/src/lib/api/workflows.ts:147`
  - 상세: `grep -rn deleteEdge codebase/frontend/src`로 직접 확인한 결과, 코드 내 `deleteEdge` 잔존은 `workflowsApi.deleteEdge`(`/edges/:id` 즉시 DELETE, 여전히 호출부 없는 dead code) 단 한 곳뿐이고 신규 store 메서드는 `removeEdge`로 일관되게 명명·전파돼 있다(인터페이스/구현/`use-edge-reconnect.ts`/`workflow-canvas.tsx`/양쪽 테스트). 이전 라운드(12_40_48) WARNING이 지적한 "local-only vs 즉시 네트워크 DELETE" 프로파일 충돌은 실제로 해소됐다.
  - 제안: 없음(확인 목적).

- **[INFO]** `EditorState` 공개 인터페이스에 `onReconnect`/`removeEdge` 추가 — additive, 기존 소비자 영향 없음
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `interface EditorState`
  - 상세: 기존 필드 제거·시그니처 변경 없는 순수 추가다. `useEditorStore.setState()`로 부분 시딩하는 기존 테스트(zustand `Partial<T>` merge)와도 충돌 없음을 `editor-store.test.ts` 신규 `describe` 블록(`onReconnect (§1.3)` 6케이스, `removeEdge (§1.3 detach)` 2케이스)에서 확인.
  - 제안: 없음.

- **[INFO]** `<ReactFlow>`에 `onReconnect`/`onReconnectEnd` 배선 — 구조적 엣지(컨테이너 `body`/`emit`)도 드래그 재연결·detach 표면에 기본 포함됨
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`(`onReconnect={handleReconnect}` / `onReconnectEnd={onReconnectEnd}`)
  - 상세: `custom-edge.tsx`/`editor-store.ts` 어디에도 `reconnectable` 키가 없어(grep 재확인) 개별 엣지 단위 opt-out이 없다. 컨테이너 진입(`body`)·loopback 수집(`emit`)처럼 구조적으로 의미가 고정된 배선도 일반 데이터 엣지와 동일하게 드래그로 재연결·분리(detach)할 수 있게 됐다. 다만 `Delete` 키로 지우는 것은 이전부터 가능했던 동작이고, 저장/실행 시점의 서버측 `CONTAINER_MISSING_EMIT` 구조 검증이 이중 방어로 남아 즉각적인 데이터 무결성 위험은 아니다.
  - 제안: 의도된 동작이면 조치 불요. 구조적 필수 배선을 보호하고 싶다면 엣지 data 에 `reconnectable: false` 부여를 검토.

- **[INFO]** `onReconnect`/`removeEdge` — 실제 상태 변화가 없어도 무조건 `pushUndo()` 실행
  - 위치: `editor-store.ts` `onReconnect`, `removeEdge`
  - 상세: 끝점을 원래 포트로 되돌리는 "제자리 재연결"이나 존재하지 않는 `edgeId`에 대한 `removeEdge` 호출도 undo 스냅샷을 하나 남긴다. Ctrl+Z 1회가 무변화 상태를 되돌리는 데 그쳐 기능 영향은 미미하며, 기존 `onConnect`/`removeNode`와 일관된 패턴이다.
  - 제안: 우선순위 낮음.

- **[INFO]** `firstInputHandleId` 내부 동작 변경 — 공개 시그니처 동일(`(definition) => string | null`), 유일 호출부(`buildAutoConnectConnection`) 회귀 없음
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts`(`RESERVED_INPUT_HANDLE_IDS = new Set(["emit"])`)
  - 상세: 첫 입력 포트가 예약 포트(`emit`)면 건너뛰도록 반환값 로직만 바뀌었다. 시그니처가 그대로라 다른 소비자 영향 없음. 현재 `loop`/`foreach`/`map` 컨테이너의 첫 입력이 항상 `'in'`이라 실질 회귀는 없고, 신규 테스트 2건(예약 포트 skip / 예약 포트만 있을 때 `null`)으로 커버된다. 자동 연결 시 latent 컨테이너 충돌(orphan 노드) 위험을 코드 레벨에서 선제 차단하는 방향이라 side-effect 관점에서는 강화다.
  - 제안: 없음.

- **[INFO]** 이전 라운드(12_40_48) CRITICAL — reconnect 드래그를 자기연결(무효) 핸들에 드롭 시 기존 엣지 오삭제 — 해소를 코드로 직접 재확인
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`
  - 상세: `onReconnectEnd`가 "success 플래그"(과거 `onReconnectStart`+ref 방식) 대신 **드롭 위치**(`connectionState.toNode`)로 판정하도록 재설계돼 있다 — `if (!connectionState.toNode) removeEdge(edge.id);`. 자기연결처럼 `isValidConnection`이 false라 `onReconnect` 콜백 자체가 호출되지 않아도, `toNode`가 존재(=핸들/노드 위 드롭)하면 삭제되지 않는다. `use-edge-reconnect.test.ts`에 회귀 가드 케이스("무효 핸들 드롭이면 삭제하지 않는다")가 존재. 모듈/전역 스코프 플래그도 남아 있지 않다(`useRef` 조차 제거됨, 훅은 순수 콜백 조합).
  - 제안: 없음(확인 목적).

- **[INFO]** 파일시스템 부작용 — `review/code/2026/07/13/{12_40_48,13_06_50,13_27_36}/*` 신규 파일 커밋
  - 상세: 프로젝트 관례상 `review/`는 gitignore 대상이 아니라 SUMMARY/RESOLUTION 포함 커밋 대상이며, 이전 리뷰 라운드의 근거 기록이라 코드에 영향을 주는 부작용이 아니다.
  - 제안: 없음.

CHANGELOG.md·`spec/3-workflow-editor/2-edge.md` §1.3·`plan/in-progress/spec-sync-edge-gaps.md`·`connecting-nodes*.mdx`·`containers-and-tools*.mdx`는 서술/문서 갱신이며 코드 부작용과 무관하다(`onReconnectStart` 잔존 서술 등 이전 라운드가 지적한 문서-코드 불일치는 현재 diff에서 `onReconnect`/`onReconnectEnd` 두 콜백 서술로 정정 완료, grep으로 코드에 `onReconnectStart` 부재 확인).

## 요약

이 변경은 React Flow의 `onReconnect`/`onReconnectEnd` 콜백을 얇은 오케스트레이션 훅(`use-edge-reconnect.ts`)과 store 메서드(`onReconnect`/`removeEdge`) 두 곳에 배선하는 순수 프런트엔드 편집기 확장이다. 코드를 직접 읽어 재검증한 결과, 신규 전역 변수·환경 변수 읽기/쓰기·의도치 않은 네트워크 호출은 없고, store 변경은 기존 `onConnect`/`removeNode`와 일관된 로컬(zustand) 상태 변경(저장 전까지 서버 미반영)이다. 1차 리뷰가 지적한 CRITICAL(자기연결/무효 핸들 드롭 시 엣지 오삭제)은 성공 플래그 대신 드롭 위치(`connectionState.toNode`) 기반 판정으로 재설계돼 실제로 해소됐고, 신규 store 메서드가 기존 `workflowsApi.deleteEdge`(즉시 REST DELETE)와 이름이 겹치던 문제도 `removeEdge`로 개명해 해소됐다(둘 다 grep으로 직접 재확인). `EditorState` 인터페이스 확장은 additive라 기존 소비자에 영향이 없다. 남은 항목은 세 라운드에 걸쳐 일관되게 관찰된 낮은 우선순위 사항뿐이다 — `<ReactFlow>` reconnect 배선이 구조적(컨테이너 `body`/`emit`) 엣지까지 opt-out 없이 드래그 재연결/detach 대상에 포함시키는 점(서버측 `CONTAINER_MISSING_EMIT` 이중 검증으로 즉각 위험 아님)과 상태 무변화 시에도 실행되는 `pushUndo()`(영향 미미). 신규 결함은 발견되지 않았다.

## 위험도
NONE
