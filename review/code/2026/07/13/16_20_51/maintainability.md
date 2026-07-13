# 유지보수성(Maintainability) 리뷰

본 라운드는 직전 ai-review(`review/code/2026/07/13/15_52_56`, 위험도 CRITICAL)의 RESOLUTION 반영 후 상태를 대상으로 한다. 먼저 이전 CRITICAL/WARNING 이 실제로 해소됐는지 코드를 직접 재확인했고, 그 위에서 신규로 발견되는 유지보수성 이슈를 점검했다.

## 이전 라운드 대비 해소 확인 (재검증)

- **[해소 확인]** i18n 하드코딩 CRITICAL — `edge-data-preview.tsx` 가 이제 `useT()` + `dict/{ko,en}/editor.ts` (`edgeDataPreviewTitle`/`edgeDataSize`/`edgeViewFullData`/`edgeNoData`)로 정식 localize됨. 영/한 혼용 하드코딩 문자열 제거 확인.
- **[해소 확인]** 문서(JSDoc/CHANGELOG/spec/plan)가 주장하던 `findNodeResult` ↔ 실제 구현(수동 역순 스캔) 불일치 — `execution-store.ts` 에 `findLatestResultByNodeId(nodeId)` (O(1), `lastIndexByNodeId` 기반 + stale-index 방어 재확인 `row?.nodeId === nodeId`) 신설, `edge-data-preview.tsx` `useEdgeFlowData` 가 이를 반응형 selector 로 소비. JSDoc·CHANGELOG·spec §5·plan 네 곳 모두 `findLatestResultByNodeId` 로 일관되게 정정됨.
- **[해소 확인]** `EdgeDataModal` 인라인 JSON 마크업 재작성 — `run-results/renderers/presentation-renderers.tsx` 의 `JsonContent` 를 import·재사용하도록 교체됨(drift 위험 제거).
- **[해소 확인]** 신규 훅/컴포넌트 테스트 부재 — `use-edge-hover-preview.test.ts`(renderHook 5, fake timer 재진입 취소·지연 숨김·dismiss·unmount cleanup·참조안정) + `edge-data-preview.test.tsx`(RTL 3, 무데이터 미렌더·축약 렌더·클릭 핸들러) 신설로 해소.
- **[해소 확인]** unmount 시 hide-timer 미정리, 훅 반환 객체 비메모이제이션 — `useEffect(() => clearTimer, [clearTimer])` cleanup 추가 + 반환 객체 `useMemo` 래핑 확인.

## 발견사항 (현재 상태 기준 신규/잔존)

- **[WARNING]** 새로 만든 O(1) 공유 selector 가 있음에도, 그 selector 도입의 근거였던 기존 중복 사이트가 그대로 남아 있음(DRY 불완전)
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx:508-513` (`InfoTab`, `latestResult` `useMemo`) vs `codebase/frontend/src/lib/stores/execution-store.ts:712` (`findLatestResultByNodeId`)
  - 상세: 직전 라운드 architecture/performance 리뷰가 지적한 "nodeId 최신 결과 찾기 3중 중복" 문제를 풀기 위해 이번에 `execution-store.ts` 에 공유 selector `findLatestResultByNodeId`를 신설했고, 신규 소비처(`edge-data-preview.tsx` `useEdgeFlowData`)는 이를 정상적으로 사용한다. 하지만 원래 중복의 한 축이던 `node-settings-panel.tsx` `InfoTab`(§1.3 단일 노드 실행 결과 표시)은 여전히 자체 역순 for-루프(`for (let i = nodeResults.length - 1; i >= 0; i--) { if (nodeResults[i].nodeId === nodeId) return nodeResults[i]; }`)를 그대로 유지한다. 즉 "같은 개념(nodeId 최신 결과)"이 이제 스토어 selector 와 컴포넌트 로컬 구현 두 곳에 공존하며, `findLatestResultByNodeId` 가 갖춘 stale-index 방어 로직(`row?.nodeId === nodeId` 재확인)도 `InfoTab` 쪽엔 없다 — 두 구현이 향후 미묘하게 갈라질 위험(divergence)이 남는다. 새 결함은 아니고 이번 PR 스코프 밖(엣지 hover 기능)이라 강제 수정 대상은 아니지만, 공유 추상화를 만든 목적 자체가 이 중복 제거였던 만큼 마이그레이션이 자연스러운 후속이다.
  - 제안: `node-settings-panel.tsx` `InfoTab` 의 `latestResult` 계산을 `useExecutionStore((s) => s.findLatestResultByNodeId(nodeId))` 로 교체해 로컬 스캔 제거. 별도 소규모 후속 커밋으로도 충분.

- **[INFO]** `formatBytes` 단위 임계값 매직 넘버 — 이전 라운드에서 이미 지적·낮은 우선순위로 이월된 항목, 이번 커밋에도 미반영 상태로 남음
  - 위치: `codebase/frontend/src/lib/utils/edge-data-preview.ts` `formatBytes` (`1024`, `1024 * 1024` 리터럴)
  - 상세: 같은 파일 상단의 `MAX_STRING`/`MAX_TOP_ARRAY`/`MAX_TOP_KEYS` 는 이름 있는 상수로 잘 뽑혀 있는데, `formatBytes` 내부만 스타일이 다르다. 기능상 문제는 없다.
  - 제안: `const BYTES_PER_KB = 1024;` 로 추출해 상단 상수 블록과 통일(선택적, 낮은 우선순위 — 이미 팀이 명시적으로 defer 하기로 결정한 항목이므로 강제 아님).

- **[INFO]** `edges` 배열 prop-drilling — 기존에 인지·이월된 항목, 이번 라운드에도 변화 없음
  - 위치: `workflow-canvas.tsx`(`EdgeDataPreviewTooltip`/`EdgeDataModal` 양쪽에 `edges={edges}` 전달) / `edge-data-preview.tsx` `useEdgeFlowData` 내부 `edges.find((e) => e.id === edgeId)`
  - 상세: hover 시점에 이미 `RFEdge`(따라서 `edge.source`)를 쥐고 있음에도 `edgeId` 문자열만 넘겨 하위에서 재탐색한다. RESOLUTION.md 에 "§4-insert/후속으로 이월" 명시된 항목이라 이번 라운드의 새 결함은 아님. 참고로만 유지.

## 요약

직전 라운드의 CRITICAL(i18n 하드코딩)과 WARNING 5건(O(n) 재도입 + 문서-구현 불일치, 무가드 직렬화, JSON 뷰어 재구현, 테스트 부재, null 체크 미흡)이 코드 직접 확인 결과 모두 실질적으로 해소됐다. 특히 `findNodeResult` 서술 불일치는 새 selector(`findLatestResultByNodeId`)를 도입하고 JSDoc/CHANGELOG/spec/plan 네 문서를 일관되게 정정하는 방식으로 제대로 고쳐졌다. 다만 그 selector 도입의 원인이던 중복 로직 중 `node-settings-panel.tsx` 쪽은 마이그레이션되지 않아 DRY 문제가 완전히 해소되지는 않았다(신규 코드 자체는 깨끗하나, 저장소 전체 관점에서는 동일 개념의 두 구현이 여전히 공존). 그 외 매직 넘버·prop-drilling 은 팀이 이미 인지하고 낮은 우선순위로 명시 이월한 항목이라 병합을 막을 사안은 아니다. 핵심 신규 로직(순수 유틸·훅·컴포넌트)은 이름 있는 상수, 단일 책임, 낮은 중첩·복잡도, 테스트 커버리지를 갖춰 전반적으로 유지보수성이 양호하다.

## 위험도

LOW
