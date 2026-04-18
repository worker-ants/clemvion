### 발견사항

- **[INFO]** 신규 외부 패키지 없음 — 모든 신규 `import`는 내부 모듈 또는 기존 의존성
  - 위치: 전체 변경 파일
  - 상세: `zod`(백엔드), `react`, `@xyflow/react`, `@workflow/expression-engine` 등 기존 의존성만 사용. 번들 크기·빌드 시간에 영향 없음.
  - 제안: 해당 없음

- **[INFO]** `resolve-nested-path.ts` → `@/lib/node-definitions/types` 의존성 추가
  - 위치: `resolve-nested-path.ts:4`
  - 상세: `import type`만 사용하므로 런타임 비용 없음. 단, `resolve-nested-path`는 표현식 엔진의 핵심 유틸인데 노드 정의 타입에 결합됨. 향후 패키지 분리 시 주의 필요.
  - 제안: 현재 모노레포 구조에서는 허용 범위. 타입만 임포트하므로 실질적 위험 없음.

- **[WARNING]** `edge-utils.ts`의 `dropStaleEdges` — 빈 출력 포트 노드에서 유효성 검사 우회
  - 위치: `edge-utils.ts` `dropStaleEdges` 내 `if (sourceOutputs.size > 0 && edge.sourceHandle)` 조건
  - 상세: `resolveDynamicPorts`가 빈 배열을 반환하는 노드(출력 포트가 없는 노드)는 `sourceOutputs.size === 0`이 되어 검사가 완전히 생략됨. 이는 "알 수 없는 타입" 폴백과 동일한 분기를 사용하는데, 정의는 있으나 현재 구성상 출력이 없는 노드의 경우 낡은 엣지가 제거되지 않을 수 있음. `def`가 존재하는 경우와 없는 경우의 폴백 로직을 분리하는 것이 더 명확함.
  - 제안:
    ```ts
    if (!def) { /* permissive */ return true; }
    // def가 있으면 set.size === 0도 검증 통과(실제로 출력 없는 노드)
    if (set.size > 0 && edge.sourceHandle && !set.has(edge.sourceHandle)) return false;
    ```

- **[INFO]** `enrichInfoExtractorOutputSchema` 내 `JSON.parse(JSON.stringify(...))` 딥 클론
  - 위치: `use-expression-context.ts:88`
  - 상세: `useMemo` 내부에서 노드별로 호출되므로 대규모 스키마가 아닌 이상 실질적 성능 문제는 없음. 단, 스키마 객체가 순환 참조를 포함하면 런타임 오류 발생(현재 Zod에서 생성된 JSON Schema는 순환 없으므로 안전).
  - 제안: 현재 수준에서는 허용. 필요 시 `structuredClone`으로 교체 가능(Node.js 17+, 최신 브라우저 지원).

- **[INFO]** `useNodeDefinitionsStore` 의존성이 `use-expression-context`에 추가됨
  - 위치: `use-expression-context.ts:4`
  - 상세: `useMemo` 의존성 배열에 `nodeDefinitions`가 정확히 추가되어 있음. 스토어가 로딩 중일 때 `definitions`가 `{}`이면 스키마가 없는 채로 렌더링되므로 UX 저하는 없고 graceful degradation 동작.
  - 제안: 해당 없음

---

### 요약

이번 변경은 외부 npm 패키지를 전혀 추가하지 않으며, 신규 내부 의존성(`resolve-dynamic-ports`, `node-definitions/types`, `node-definitions-store`)도 모두 이미 프로젝트에 존재하는 모듈이다. 번들 크기·라이선스·보안 취약점 관점에서 위험 요소가 없다. 유일한 실질적 이슈는 `dropStaleEdges`에서 `def`가 있음에도 출력 포트 수가 0인 노드를 "알 수 없는 타입"과 동일하게 처리하는 미묘한 논리 결합으로, 운영 중 엣지 누락보다 잔존 엣지 허용 쪽으로 편향되는 보수적 선택이나 코드 가독성 측면에서 분리를 권장한다.

### 위험도

**LOW**