# 부작용(Side Effect) Review

대상: `spec/3-workflow-editor/2-edge.md` §1.3(입력 포트 역방향 연결 확인 + 기존 엣지 재연결/분리) 구현 및 3회차 누적 리뷰 산출물, 총 33개 파일. 코드 부작용 관점에서 실질 대상은 `use-edge-reconnect.ts`(신규)/`workflow-canvas.tsx`/`editor-store.ts`/`edge-utils.ts`와 그 테스트이며, 나머지(CHANGELOG/spec/plan/mdx/`review/code/.../12_40_48`·`13_06_50` 하위 산출물)는 문서·이전 리뷰 기록 갱신으로 코드 부작용과 무관하다.

## 발견사항

- **[INFO]** 이전 라운드 CRITICAL(자기연결/무효 핸들 드롭이 기존 엣지를 오삭제) 해소 확인
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`
  - 상세: `onReconnectEnd` 판정이 "success 플래그"(과거 `onReconnectStart`+ref)가 아니라 **드롭 위치**(`connectionState.toNode`)로 재설계되어 있다. `toNode`가 `null`(pane)일 때만 `removeEdge`를 호출하므로, 자기연결처럼 `isValidConnection`이 `false`를 반환해 `onReconnect`가 애초에 호출되지 않는 경우(핸들/노드 위 드롭)는 `toNode`가 존재해 삭제되지 않는다. `use-edge-reconnect.test.ts`에 회귀 가드 케이스("무효 핸들 드롭이면 삭제하지 않는다")가 명시적으로 존재해 향후 판정 로직이 다시 success-플래그 방식으로 되돌아가는 회귀를 잡는다. 모듈 스코프 `ref`/전역 플래그가 제거되어 컴포넌트 인스턴스 경계를 넘는 상태도 없다.
  - 제안: 없음(확인 목적).

- **[INFO]** `EditorState` 공개 인터페이스에 `onReconnect`/`removeEdge` 추가 — additive, 하위 호환
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` (`interface EditorState`)
  - 상세: 기존 필드 제거·시그니처 변경 없이 순수 추가이며, 단일 `create<EditorState>((set, get) => ({...}))` 팩토리 내부에서 전 필드가 함께 정의되므로 부분 목(mock) 타입 불일치 위험이 없다. `useEditorStore.setState()`로 부분 시딩하는 기존 테스트들(`__tests__` 13개 파일에서 사용 확인)은 zustand의 `Partial<T>` merge 방식이라 이번 추가로 깨지지 않는다. 신규 store 메서드명은 `removeEdge`로, 기존 `workflowsApi.deleteEdge`(`/edges/:id` 즉시 REST DELETE, 여전히 미호출 dead code)와 겹치지 않음을 grep으로 재확인 — 이전 라운드 WARNING(네이밍 충돌)이 실제로 해소되어 있다.
  - 제안: 없음.

- **[INFO]** `<ReactFlow>`에 `onReconnect`/`onReconnectEnd` 배선 — 구조적 엣지(컨테이너 `body`/`emit`)도 드래그 재연결·detach 표면에 포함됨(기존 라운드에서 이미 수용된 항목, 변화 없음)
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (`onReconnect={handleReconnect}` / `onReconnectEnd={onReconnectEnd}`)
  - 상세: 개별 엣지에 `reconnectable:false` opt-out이 없어(재확인: `custom-edge.tsx`/`editor-store.ts` 어디에도 `reconnectable` 키 없음), 컨테이너 진입(`body`)·loopback(`emit`) 처럼 구조적으로 의미가 고정된 엣지도 드래그로 재연결·삭제할 수 있다. `Delete` 키 삭제는 기존에도 가능했고, 저장·실행 시 서버측 `CONTAINER_MISSING_EMIT` 등 구조 검증이 이중 방어로 남아 즉각적인 데이터 무결성 위험은 아니다. 3회 연속 라운드에서 동일하게 관찰·수용된 항목으로 이번 diff로 상태가 달라지지 않았다.
  - 제안: 의도된 동작이면 조치 불요. 구조적 필수 배선을 재연결 대상에서 제외하려면 향후 `reconnectable:false` 부여 검토.

- **[INFO]** `onReconnect`/`removeEdge` — 실제 변경 여부와 무관하게 항상 `pushUndo()` 호출(기존 관찰 재확인)
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onReconnect`, `removeEdge`
  - 상세: 제자리 재연결(끝점을 원래 포트로 되돌림)이나 존재하지 않는 `edgeId`에 대한 `removeEdge` 호출도 무조건 undo 스냅샷을 하나 남긴다. 기능 영향은 미미(Ctrl+Z 1회가 무변화 상태를 스킵)하며 기존 `onConnect`/`removeNode` 패턴과 일관된 의도된 동작이다.
  - 제안: 우선순위 낮음. 필요 시 "실제 변경 시에만 pushUndo" 최적화 고려.

- **[INFO]** `firstInputHandleId` 동작 변경 — 시그니처 동일(`(definition) => string | null`), 유일 호출부(`buildAutoConnectConnection`) 영향 없음
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` (`RESERVED_INPUT_HANDLE_IDS`)
  - 상세: 첫 입력 포트가 예약 포트(`emit`)면 건너뛰도록 내부 판정만 바뀌었고 공개 시그니처는 그대로다. 현재 `loop`/`foreach`/`map` 컨테이너의 첫 입력이 항상 `'in'`이라 실질 동작 회귀는 없으며, 신규 테스트 2건(`emit` 건너뛰기, 예약 포트만 있을 때 `null`)으로 커버된다. 자동 연결 시 latent 컨테이너 충돌(orphan 노드) 위험을 코드 레벨에서 선제 차단하는 것이라 side-effect 관점에서는 긍정적 강화다.
  - 제안: 없음.

- **[INFO]** `review/code/2026/07/13/{12_40_48,13_06_50}/*` 신규 파일 커밋 — 예상된 파일시스템 부작용
  - 위치: `review/code/2026/07/13/12_40_48/*`, `review/code/2026/07/13/13_06_50/*`
  - 상세: 이전 두 리뷰 라운드의 SUMMARY/RESOLUTION/각 리뷰어 산출물·retry state가 신규 파일로 추가된다. 이 저장소 관례상 `review/`는 gitignore 대상이 아니라 커밋 대상이며(과거 세션 확인됨), 코드에 영향을 주는 부작용이 아니라 리뷰 이력 기록이다.
  - 제안: 없음.

CHANGELOG.md·`plan/in-progress/spec-sync-edge-gaps.md`·`spec/3-workflow-editor/2-edge.md`·`connecting-nodes*.mdx`·`containers-and-tools*.mdx` 변경은 서술/문서 갱신이며, 이전 라운드가 지적한 `onReconnectStart` 문서 잔재(SPEC-DRIFT)와 plan의 옛 이름 `deleteEdge` 서술은 현재 diff에서 실제로 정정되어 있음을 확인했다(`onReconnect`/`onReconnectEnd` 두 콜백, `removeEdge`로 일관).

## 요약

이번 변경은 React Flow의 `onReconnect`/`onReconnectEnd` 콜백을 얇은 오케스트레이션 훅(`use-edge-reconnect.ts`)과 store 메서드(`onReconnect`/`removeEdge`) 두 곳에 배선하는 순수 프런트엔드 편집기 확장으로, 신규 전역 변수·환경 변수 읽기/쓰기·의도치 않은 네트워크 호출은 발견되지 않았고 store 상태 변경은 기존 `onConnect`/`removeNode` 패턴과 일관된 zustand 로컬 상태 변경(저장 전까지 서버 미반영)이다. 3회차 누적 diff를 검토한 결과 1차 라운드의 CRITICAL(자기연결/무효 핸들 드롭 시 엣지 오삭제)과 신규 store 메서드 명명 충돌(`deleteEdge`↔`workflowsApi.deleteEdge`)은 드롭-위치 기반 판정 재설계와 `removeEdge` 개명으로 코드 레벨에서 실제로 해소되었으며, 2차 라운드의 문서-코드 불일치(`onReconnectStart` 잔재, plan의 옛 이름)도 정정되어 있다. `EditorState` 인터페이스 확장은 additive이며 기존 소비자에 영향이 없다. 잔존 항목(구조적 `body`/`emit` 엣지가 드래그 재연결/detach 표면에 기본 포함, 무변화 시에도 `pushUndo` 실행)은 세 라운드에 걸쳐 일관되게 INFO로 관찰·수용된 낮은 우선순위 사항으로, 서버측 구조 검증이라는 이중 방어가 남아있어 즉각적 위험이 아니다.

## 위험도

NONE
