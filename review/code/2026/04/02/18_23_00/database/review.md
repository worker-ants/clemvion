### 발견사항

- **[INFO]** `$execution.startedAt` 값이 DB 저장값과 불일치
  - 위치: `expression-resolver.service.ts` — `buildExpressionContext()` 내 `$execution.startedAt`
  - 상세: `startedAt: new Date().toISOString()`으로 표현식 컨텍스트 빌드 시점의 현재 시각을 사용. DB의 `Execution.startedAt` 컬럼에 저장된 실제 실행 시작 시각과 다를 수 있음. 특히 노드가 여러 개일 때 각 노드마다 다른 `startedAt`이 노출됨
  - 제안: `ExecutionContext`에 실제 실행 시작 시각을 포함시키거나, `Execution` 엔티티를 조회하여 실제 값을 사용

- **[INFO]** `nodeMap` 옵셔널 처리로 인한 표현식 미해석 경로 존재
  - 위치: `execution-engine.service.ts` — `executeNode()` 시그니처 `nodeMap?: Map<string, Node>`
  - 상세: `nodeMap`이 없으면 `node.config` 원본을 그대로 사용. 호출 경로에 따라 DB에서 로드된 노드 데이터를 기반으로 표현식이 해석되지 않을 수 있음. 현재 코드에서는 `processNode` 호출 시에만 `nodeMap`을 전달하고 있어 정상 동작하나, 향후 다른 실행 경로 추가 시 실수 가능성 있음
  - 제안: `nodeMap`을 필수 파라미터로 변경하거나, 없을 경우 경고 로그 추가

### 요약

이번 변경은 표현식 엔진 패키지 추가와 UI 컴포넌트 교체가 주를 이루며, 직접적인 DB 스키마 변경, 마이그레이션, 쿼리 로직 변경은 없다. `ExpressionResolverService`는 이미 DB에서 로드된 `nodeMap`과 메모리 내 `nodeOutputCache`를 활용하여 추가 DB 쿼리 없이 표현식 컨텍스트를 구성하므로 N+1 문제나 커넥션 누수 우려는 없다. 다만 `$execution.startedAt`이 DB 저장값 대신 현재 시각으로 노출되는 점은 표현식 기반 로직에서 시각 관련 처리 시 예상치 못한 결과를 낳을 수 있어 주의가 필요하다.

### 위험도
LOW