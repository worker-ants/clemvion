# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** 언마운트 시 pending hide-timer 미정리
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-hover-preview.ts` (`useEdgeHoverPreview`, `hideTimer` / `scheduleHide`)
  - 상세: `scheduleHide()` 가 `setTimeout(() => setPreview(null), HIDE_DELAY_MS)` 를 예약하고 `hideTimer` ref 에 저장하지만, 훅에는 언마운트 시 `clearTimeout` 하는 `useEffect` cleanup 이 없다. `WorkflowCanvas` 가 훅을 호출하는 컴포넌트라 일반적인 편집기 세션 중엔 거의 언마운트되지 않지만, 라우트 이탈·워크플로 전환 등으로 엣지 hover-leave 직후(200ms 이내) 캔버스가 언마운트되면 이미 사라진 컴포넌트에 대해 `setPreview(null)` 이 호출된다. React 18 은 이를 콘솔 경고 없이 무시하므로 크래시는 없지만, 클로저(`hideTimer`, `setPreview`)가 타이머 만료 시점까지 살아있어 의도치 않게 GC 를 지연시키는 잔여 부작용이다.
  - 제안: `useEffect(() => () => clearTimer(), [clearTimer])` 를 훅에 추가해 언마운트 시 pending 타이머를 명시적으로 정리.

## 요약

이번 변경은 워크플로 편집기에 엣지 hover 데이터 미리보기 툴팁 + 전체 데이터 모달을 추가하는 순수 프런트엔드 기능으로, 신규 컴포넌트(`edge-data-preview.tsx`)·훅(`use-edge-hover-preview.ts`)·순수 유틸(`lib/utils/edge-data-preview.ts`)이 전부 새 파일이라 기존 함수/컴포넌트 시그니처를 변경하지 않았다. `workflow-canvas.tsx` 의 기존 콜백(`onEdgeMouseEnter`/`onEdgeMouseLeave`)은 React Flow 에 넘기는 시그니처(`(event, edge) => void`)를 그대로 유지한 채 내부 로직만 추가했고, 외부에 노출되는 공개 API·환경 변수·네트워크 호출·전역 변수는 전혀 도입되지 않았다. 데이터는 이미 클라이언트에 있는 `useExecutionStore.nodeResults` 를 read-only 로 조회할 뿐이고, `summarizeDataForPreview`/`formatBytes` 는 입력을 변형하지 않는 순수 함수이며 순환 참조 등 직렬화 실패도 try/catch 로 흡수해 예외를 외부로 전파하지 않는다. 유일한 소소한 지적 사항은 hide-timer 언마운트 정리 누락으로, 실질 위험은 낮다(React 18 에서 크래시·경고 없음).

## 위험도
LOW
