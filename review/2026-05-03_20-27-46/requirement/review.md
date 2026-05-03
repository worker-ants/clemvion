### 발견사항

- **[WARNING]** API 에러 상태 미처리 → 빈 그래프 화면으로 폴스루
  - 위치: `graph-visualization.tsx:57–68` (`isLoading / !data` 분기)
  - 상세: `useQuery`의 `isError` 를 소비하지 않아, API 호출 실패 시 `!data` 조건에 걸려 `graphVizEmpty` 메시지를 출력한다. 사용자는 "데이터 없음"과 "오류 발생"을 구분할 수 없다.
  - 제안: `const { data, isLoading, isError } = useQuery(...)` 로 `isError` 를 추출하고, 오류 전용 UI(경고 아이콘 + 재시도 버튼)를 별도 분기로 추가.

- **[WARNING]** 노드 라벨 스프라이트 위치가 고정값(y=8)이어서 대형 노드와 겹침 가능
  - 위치: `graph-3d-renderer.tsx:106` (`sprite.position.set(0, 8, 0)`)
  - 상세: `nodeRelSize=5`, `nodeVal=√mentionCount * 2` 공식으로 mentionCount=100인 노드의 구 반지름은 약 `5 * √20 ≈ 22`인데, 라벨 오프셋은 고정 8이므로 구 내부에 묻힌다. 스펙은 "노드 크기는 mention_count 비례"를 명시하므로 라벨 위치도 그에 맞게 스케일돼야 한다.
  - 제안: `sprite.position.set(0, Math.sqrt(Math.max(n.mentionCount, 1)) * 2 + 6, 0)` 처럼 nodeVal 공식과 동기화.

- **[WARNING]** `"Loading 3D graph…"` 및 조작 안내 문자열이 i18n 미적용
  - 위치: `graph-visualization.tsx:31`, `graph-visualization.tsx:131`
  - 상세: 파일 전반이 `useT()` 훅 기반 i18n을 사용하는데, 동적 로더 fallback 문자열(`"Loading 3D graph…"`)과 하단 조작 힌트(`"드래그로 회전 · 휠로 줌 · 노드 클릭 시 카메라 이동"`)만 하드코딩돼 있다. 다국어 요구사항이 있다면 누락이다.
  - 제안: i18n 키 추가(`knowledgeBases.graphViz3dLoading`, `knowledgeBases.graphVizHint`) 후 `t()` 호출로 교체.

- **[WARNING]** 테스트에서 에러 케이스 미커버
  - 위치: `graph-visualization.test.tsx` 전체
  - 상세: 로딩·빈 데이터·정상·truncated 4가지 케이스만 존재하고, API 실패(reject) 케이스가 없다. 위의 폴스루 버그(WARNING #1)가 테스트 레벨에서 검출되지 않는 이유이기도 하다.
  - 제안: `apiMock.getGraphVisualization.mockRejectedValue(new Error("500"))` 케이스 추가, `graphVizError` 텍스트가 표시되는지 assert.

- **[INFO]** `TYPE_COLOR` 상수 두 파일에 중복 정의
  - 위치: `graph-visualization.tsx:17–24`, `graph-3d-renderer.tsx:17–24`
  - 상세: 동일한 hex 값 6개가 두 곳에 존재. 하나가 변경되면 legend 색과 노드 색이 불일치해 스펙(`legend 색상과 동일`)을 위반할 수 있다.
  - 제안: `graph-constants.ts` 같은 공유 모듈로 추출하여 단일 출처로 관리.

- **[INFO]** `width === 0` 구간에서 blank dark 직사각형 노출
  - 위치: `graph-visualization.tsx:106–113` (`width > 0 ? <Graph3DRenderer> : null`)
  - 상세: ResizeObserver가 마운트 직후 한 마이크로태스크 뒤에 발화하므로, 짧은 시간 동안 로딩 스피너도 없이 어두운 배경만 보인다. 기능 오류는 아니지만 UX 완성도 관점에서 빈 상태로 인식될 수 있다.
  - 제안: `width === 0` 일 때도 `<Loader2>` 스피너를 표시하거나, CSS `visibility: hidden`으로 레이아웃 자리만 잡도록 처리.

- **[INFO]** `zoomToFit` 대기 시간(1200ms)이 매직 넘버
  - 위치: `graph-3d-renderer.tsx:90` (`window.setTimeout(..., 1200)`)
  - 상세: 스펙 한도인 200노드 그래프에서 force simulation 안정화까지 1.2초가 충분한지 실측값 없이 추정됨. 과소하면 fit이 부정확하고, 과대하면 응답감이 떨어진다.
  - 제안: `react-force-graph-3d`의 `onEngineStop` 콜백을 사용해 시뮬레이션 수렴 직후에 `zoomToFit` 호출(`fgRef.current?.d3ReheatSimulation()` + `onEngineStop` 방식).

---

### 요약

3D 전환 구현은 스펙(2.7.3)의 핵심 요구사항(3D force-directed, entity type 색상, mention_count 비례 크기, spritetext 라벨, truncated 경고, SSR-safe dynamic import)을 대부분 충족한다. 그러나 API 에러 상태를 빈 그래프로 폴스루하는 구조적 누락이 가장 심각하며, 이를 검출할 테스트도 부재해 요구사항 방어선이 없는 상태다. 라벨 위치 고정값 문제는 대형 그래프(high-mentionCount entity)에서 시각적 완성도를 해치며, i18n 미적용 문자열과 TYPE_COLOR 중복은 유지보수 위험을 내포한다.

### 위험도

**MEDIUM**