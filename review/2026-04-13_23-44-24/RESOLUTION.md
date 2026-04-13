# 코드 리뷰 이슈 조치 내용

## Critical 이슈 조치

| # | 발견사항 | 조치 |
|---|---------|------|
| C1 | `editor-store.ts` → `edge-utils.ts` 레이어 역전 | `edge-utils.ts`를 `lib/utils/edge-utils.ts`로 이동. 모든 import 경로 업데이트 완료 |
| C2 | `use-edge-highlighting.ts` 테스트 전무 | `use-edge-highlighting.test.ts` 작성 (8개 테스트 케이스: 우선순위, 포커스 해제, 클래스 토글, hoveredEdgeNodes, 미존재 edge 처리) |
| C3 | `findSmartPath` 에러 처리 없음 | Phase 3 전체 롤백으로 해당 코드 제거됨 (edge-pathfinding.ts 삭제, pathfinding 패키지 제거) |
| C4 | hover 상태 전역 스토어로 인한 리렌더 폭풍 | `canvas-hover-store.ts` 별도 경량 스토어로 분리. `hoveredNodeId`/`hoveredEdgeId`를 editor-store에서 제거 |
| C5 | `getConnectedEdgeIds` O(E) 선형 탐색 반복 | `useEdgeHighlighting` 내에 `edgeIndex` (nodeId→Set<edgeId>) 역방향 인덱스를 useMemo로 사전 계산, O(1) 조회로 개선 |
| C6 | `editor-store.test.ts` 신규 필드 미반영 | hover 상태가 별도 스토어로 분리되어 editor-store 테스트 변경 불필요. use-edge-highlighting 테스트에서 통합 커버 |

## Warning 이슈 조치

| # | 발견사항 | 조치 |
|---|---------|------|
| W1 | `editor-loader.tsx` race condition | `cancelled` 플래그 추가. useEffect cleanup에서 `cancelled = true` 설정하여 워크플로우 전환 시 이전 비동기 결과 무시 |
| W2 | CSS Injection (동적 `<style>` 태그) | 동적 `<style>` 태그 완전 제거. `node-edge-glow` className + 정적 CSS 규칙으로 대체 |
| W3 | API 응답 ID 미검증 | 해당 이슈는 기존 코드의 범위이므로 이번 변경에서는 미조치 (별도 이슈로 추적 필요) |
| W4 | `arrow-*-bright` 마커가 일반 마커와 동일 색상 | bright 마커 및 레거시 마커 전체 제거. 포트 타입별 단일 마커 세트로 통합 |
| W5 | `resolvePortType` ai_agent 하드코딩 | 현재 동적 포트 시스템의 구조상 불가피. 추후 `NodeDefinition.outputs`에 `portType` 표준화 시 개선 예정 (미조치) |
| W6 | `getMarkerIdForPortType` dead export | 함수 및 관련 테스트 코드 제거 완료 |
| W7 | 동적 `<style>` CSSOM 재계산 | W2와 동일. 정적 CSS로 대체 완료 |
| W8 | `pathfinding@0.4.18` 미유지 패키지 | Phase 3 롤백으로 패키지 제거 완료 |
| W9 | `wouldIntersectNode` dead variable | Phase 3 롤백으로 파일 삭제 완료 |
| W10 | 미존재 edgeId로 `isFocusActive=true` | `useEdgeHighlighting`에서 `hoveredEdgeId` 존재 여부 검증 로직 추가 |
| W11 | `enrichEdgesWithPortData` 테스트 부족 | AI Agent, 컨테이너, 기존 data 보존 테스트 케이스 추가 완료 |
| W12 | `setWorkflow` hover 미초기화 | `setWorkflow`에서 `useCanvasHoverStore.getState().reset()` 호출 추가 |
| W13 | `enrichEdgesWithPortData` 기존 data 손실 | spread 병합 패턴 적용: `{ ...(edge.data ?? {}), ...portData }` |
| W14 | 전역 CSS transition 범위 과다 | `.react-flow__edge path` 전역 transition 규칙 제거. `[data-edge-focus-active]` 조건부 규칙으로 한정 |
| W15 | `className` 문자열 조작 취약 | `Set<string>` 기반 클래스 관리로 변경 (split → Set → add/delete → join) |
| W16 | `isError` 중복 분기 | `isError` 분기 제거. `portColor`가 이미 포트 타입별 색상을 반환하므로 단일 분기로 통합 |
| W17 | CSS 애니메이션 GPU 가속 | `will-change` 없이도 `stroke-dashoffset` 애니메이션은 경량. 현재 수준에서 추가 불필요 (미조치) |
| W18 | `nodeRectsSelector` 참조 불안정 | Phase 3 롤백으로 해당 코드 제거됨 |

## Edge 가운데 마커(포트 라벨링) 제거

사용자 요청에 따라 edge 중간에 표시되던 포트 라벨(True/False/Done/Error 등) 렌더링 코드를 완전히 제거. `EdgeLabelRenderer`, `getBezierPath`, `formatLabel`, `HIDDEN_LABELS` 등 관련 코드 삭제.
