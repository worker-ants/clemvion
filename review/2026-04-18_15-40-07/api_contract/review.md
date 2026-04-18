### 발견사항

- **[INFO]** `outputSchema` 필드 추가는 additive 변경 — 하위 호환성 유지
  - 위치: `ai-agent.component.ts`, `information-extractor.component.ts`, `text-classifier.component.ts`
  - 상세: `NodeComponent` 인터페이스에 `outputSchema`를 추가하는 것은 기존 클라이언트에 영향 없는 non-breaking 변경. 노드 정의 API 엔드포인트가 이 필드를 직렬화하여 응답에 포함시킨다면 새 필드가 추가되는 수준.
  - 제안: 문제 없음.

- **[WARNING]** `outputSchema` 구조 불일치 — 노드 타입 간 응답 형식 비일관성
  - 위치: `ai-agent.schema.ts` vs `information-extractor.schema.ts`
  - 상세: `ai_agent`의 outputSchema는 `{ response, status, messages, ... }` 플랫 구조인 반면, `information_extractor`의 outputSchema는 `{ config, output: { extracted }, meta }` 중첩 구조. 같은 `outputSchema` 계약이지만 실제 형태가 노드 타입별로 크게 다름. 이를 소비하는 프론트엔드 코드(`use-expression-context.ts`)가 `information_extractor`에만 특수 처리(`enrichInfoExtractorOutputSchema`)를 적용하는 것이 이를 방증.
  - 제안: 노드 정의 API 문서에 각 노드 타입의 outputSchema 구조를 명시하거나, 공통 래퍼(`{ output, config, meta }`)로 통일하는 방향 검토.

- **[INFO]** `dropStaleEdges` — API 계약 무관, 클라이언트 전용 로직
  - 위치: `edge-utils.ts`, `editor-loader.tsx`
  - 상세: 서버에서 저장된 edge를 로드 시점에 클라이언트가 필터링하는 로직. 서버 API 응답 자체는 변경되지 않으며 계약 영향 없음. 단, 스테일 edge를 서버에 동기화하지 않아 재로드 시마다 필터링이 반복됨.
  - 제안: 중요 수준 아님. 필요 시 백그라운드로 서버 상태 정리하는 API 호출 고려.

---

### 요약

이번 변경은 HTTP API 엔드포인트 계약에 직접적인 breaking change를 유발하지 않는다. 백엔드의 `outputSchema` 추가는 기존 `configSchema`와 동일한 패턴의 additive 변경이며, 프론트엔드 변경은 모두 클라이언트 내부 자동완성 및 edge 정리 로직이다. 다만 `ai_agent`와 `information_extractor`의 outputSchema 구조가 상이하여, 이를 범용적으로 소비하는 클라이언트 측에서 노드 타입별 분기 처리가 필요해지는 계약 복잡도 증가가 존재한다.

### 위험도

LOW