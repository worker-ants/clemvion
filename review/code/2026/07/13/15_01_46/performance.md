# 성능(Performance) Review

대상: §3.2 엣지 실행 상태 스타일 구현 (CHANGELOG.md, globals.css, custom-edge.tsx,
use-edge-execution-state.ts[신규]+테스트, workflow-canvas.tsx, edge-utils.ts+테스트, mdx 문서,
plan/spec-sync-edge-gaps.md, spec/3-workflow-editor/2-edge.md, 이전 두 리뷰 라운드
`review/code/2026/07/13/14_20_12/*`·`14_42_20/*` 산출물 커밋)

## 발견사항

- **[INFO]** 이전 라운드(14_20_12)에서 지적된 "매 tick 전체 엣지 재생성" MEDIUM 이슈는 본 diff에서 실제로 해소됨(재확인)
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts` (disabledKey 계산, per-edge bail-out `if (className === edge.className && state.inactive === prevInactive) return edge;`, 최종 `return changed ? next : edges;`)
  - 상세: 소스를 직접 추적한 결과 두 최적화가 실재한다. (1) **per-edge bail-out** — 계산된 `className`/`edgeInactive`가 직전 값과 동일한 엣지는 원본 객체 참조를 그대로 반환하고, 배열 내 어떤 엣지도 안 바뀌면 원본 배열 참조까지 반환한다. (2) **안정적 disabledKey** — 비활성 노드 집합을 `nodes` 배열 참조가 아니라 disabled id 정렬 join 문자열에 의존시켜, 노드 드래그(위치만 변경)로 `nodes` 참조가 바뀌어도 하위 memo 가 재계산되지 않는다. 이로써 `nodeStatuses`가 매 tick 새 `Map`으로 교체되어도 실제로 상태가 바뀐 소수의 엣지만 새 객체가 되어 `memo(CustomEdge)`의 얕은 비교가 정상 작동한다. `use-edge-execution-state.test.ts`의 2개 테스트("무관한 엣지는 재렌더 간 참조 유지", "early bail-out")가 이 참조 안정성을 renderHook 레벨로 직접 가드한다.
  - 제안: 없음(확인용). 이 bail-out 로직을 리팩터링할 경우 해당 renderHook 테스트가 계속 통과하는지 확인할 것.

- **[INFO]** per-edge bail-out 이후에도 `nodeStatusById`(O(V))·`edges.map`(O(E)) 자체의 순회는 매 tick 여전히 발생
  - 위치: `use-edge-execution-state.ts` (`nodeStatuses.forEach(...)`로 `nodeStatusById` 재구축, 최종 `useMemo`의 `edges.map(...)`)
  - 상세: bail-out 은 "새 객체 생성·리렌더 캐스케이드"를 막을 뿐, 노드 상태 1건이 바뀔 때마다 `nodeStatusById` Map 전체 재구축(O(V))과 모든 엣지에 대한 `resolveEdgeExecutionState` 호출(O(E), 각 O(1) 순수 비교)은 여전히 수행된다. 그래프 규모가 일반적인 워크플로 편집기 캔버스 크기(수십~수백 노드/엣지) 범위에서는 순수 JS 비교 연산이라 무시할 수준이나, Loop/ForEach 본문이 수천 회 반복되며 매 반복마다 다수 노드 상태 전이가 발생하는 극단적 케이스에서는 tick 수 × O(V+E) 가 누적된다. DOM/리렌더 비용은 이미 차단됐으므로 실사용상 위험은 낮음.
  - 제안: 조치 불요(현재 스코프에서 과설계). 그래프가 매우 커지는 시나리오가 실제로 문제가 되면 `updateNodeStatus`가 변경된 nodeId만 전달해 `nodeStatusById`를 증분 갱신하는 방향을 고려.

- **[INFO]** `.edge-flowing` 마칭 점선 애니메이션(`stroke-dasharray` + `animation`)은 SVG paint 속성 애니메이션이라 GPU 합성(compositor-only) 최적화 대상이 아님
  - 위치: `codebase/frontend/src/app/globals.css` `.edge-flowing .react-flow__edge-path`
  - 상세: `transform`/`opacity` 애니메이션과 달리 `stroke-dasharray`는 매 프레임 해당 엣지 path 의 paint 를 다시 계산시킨다(엣지 1개 범위로 국한, 페이지 전체 리플로우는 아님). 실행 중 다수 엣지가 동시에 `flowing` 상태가 되는 대형 워크플로(예: 병렬 브랜치 다수)에서는 동시에 애니메이션 중인 SVG path 수만큼 지속적인 paint 비용이 누적될 수 있다. 기존 hover 하이라이트가 이미 동일 keyframe(`edge-flow`)을 재사용 중이므로 이번 변경이 새로운 패턴을 도입한 것은 아니다.
  - 제안: 조치 불요. 체감 jank 가 보고되면 `will-change: stroke-dasharray` 또는 동시 애니메이션 엣지 수 상한을 검토할 수 있으나 현재 스코프에서는 불필요.

- **[INFO]** `disabledKey`(`ids.sort().join(",")`)의 콤마 구분자는 이론상 캐시 키 충돌 가능 — 성능이 아닌 무효화 정확성 이슈
  - 위치: `use-edge-execution-state.ts` `disabledKey` useMemo
  - 상세: 노드 id 자체에 콤마가 포함될 수 있다면 서로 다른 비활성 집합이 동일 키로 collapse 되어 `disabledNodeIds`가 stale 하게 재사용될 위험이 이론상 존재한다. 저장소의 노드 id 는 UUID/nanoid 류라 실질 위험은 낮다. 캐시 무효화 정확성 문제이지 알고리즘 복잡도 문제는 아니라 성능 리스크로는 낮게 평가.
  - 제안: 조치 불요(INFO). 방어적으로 하려면 `JSON.stringify(ids)` 등 콤마를 구분자로 쓰지 않는 인코딩 고려 가능.

- **[INFO]** N+1 쿼리·블로킹 I/O·서버측 캐싱 해당 없음 — 순수 프런트엔드 파생 상태
  - 상세: 이번 변경 전체가 DB/API 호출이 개입하지 않는 프런트엔드 편집기 상태 파생 로직(useMemo 체인)이다. `resolveEdgeExecutionState`는 O(1) 순수 함수이고 `buildEdgeStyle` 도 O(1)이다. `review/code/2026/07/13/{14_20_12,14_42_20}/*`로 커밋되는 이전 리뷰 세션 산출물(markdown 리포트)과 spec/plan/mdx 문서 변경은 런타임에 로드되지 않는 정적 문서라 성능 영향이 전혀 없다.

## 요약

이전 라운드(14_20_12)에서 성능·부작용·유지보수 3개 리뷰어가 공통 지적한 "실행 tick·노드 드래그마다 캔버스 전체 엣지가 재생성돼 `memo(CustomEdge)`가 무효화되는" MEDIUM 문제는, 자매 훅(`useEdgeHighlighting`)과 동일한 per-edge bail-out + 안정적 disabledKey(정렬 join) 패턴 도입으로 이번 diff에서 실제 소스 레벨로 해소되었으며 renderHook 테스트로 참조 안정성이 가드된다. 알고리즘 복잡도는 O(V+E) per-tick 로 선형이고 DB/API 호출이 없어 N+1·블로킹 I/O 위험도 없다. 잔존 항목(nodeStatusById 매 tick 전체 재구축, stroke-dasharray paint 애니메이션 비용, disabledKey 콤마 충돌 이론적 가능성)은 모두 실사용 규모에서 조치 불요한 INFO 수준이다.

## 위험도
NONE
