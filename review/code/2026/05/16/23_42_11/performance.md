# Performance 리뷰 — 2026-05-16 23:42:11

대상 커밋: `13d21fcd` (fix(review): full-review Critical 7건 + Warning 15건 일괄 조치)

---

### 발견사항

- **[INFO]** `nodeMap` 생성·재사용으로 O(N) → O(1) 룩업 전환 (C-5 해소, 긍정)
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` 라인 3637, 3679, 3735
  - 상세: `planContainerBody` 함수 도입부에서 `new Map(allNodes.map((n) => [n.id, n]))` 을 1회 생성하고, 반복문 내 `allNodes.find((n) => n.id === e.sourceNodeId)` 를 `nodeMap.get(e.sourceNodeId)` 로 교체했다. 기존에는 `orphanEmitEdges` 를 순회할 때마다 O(N) 선형 탐색이 발생했으나 이제 O(1) 로 단축된다. 또한 이전 코드에서는 반환 객체에서도 `new Map(allNodes.map(...))` 을 별도로 한 번 더 생성했는데, 이번 변경으로 동일 `nodeMap` 인스턴스를 재사용해 불필요한 Map 재생성을 제거했다.
  - 제안: 현재 구현은 적절하다. 노드 수가 수천 개를 초과하는 대형 워크플로우에서 의미 있는 성능 향상이 기대된다. 추가 개선이 필요하다면 `allNodes.filter((n) => n.containerId === containerNode.id)` 도 Map 기반으로 전환할 수 있으나 현재 규모에서는 우선순위가 낮다.

- **[INFO]** `sanitizePayloadForWs` unchanged 시 원본 참조 반환 (W-25 해소, 긍정)
  - 위치: `backend/src/modules/websocket/websocket.service.ts` 라인 93–106
  - 상세: 기존 구현은 객체·배열을 항상 새 인스턴스로 복사했다(배열은 `map`, 객체는 `{}`에 할당). 이번 변경으로 자식 노드 중 변경된 것이 없으면 원본 참조를 그대로 반환하는 `mutated` 플래그 패턴을 도입했다. WebSocket emit hot path 에서 페이로드가 크고 credential 키가 드물게 등장하는 일반 케이스에서 불필요한 객체 할당 및 GC 압력이 줄어든다.
  - 제안: 현재 구현은 의도한 최적화를 정확히 달성하고 있다. 객체 브랜치에서 `result = { ...obj }` 를 lazy copy-on-write 방식으로 처리하므로 불필요한 spread 복사도 없다.

- **[INFO]** `statistics.getSummary` 중복 쿼리 통합 (W-21 해소, 긍정)
  - 위치: `backend/src/modules/statistics/statistics.service.ts` 라인 83–543
  - 상세: 기존 구현은 `workflowId` 조건 유무에 따라 동일한 집계 컬럼(`COUNT`, `AVG` 등)을 가진 QueryBuilder 를 두 번 빌드하고 두 번 DB 쿼리를 발행했다. 변경 후에는 단일 QueryBuilder 를 먼저 기본 조건으로 구성한 후 `workflowId` 가 있을 때만 `andWhere` 를 추가하는 방식으로 쿼리를 1회로 통합했다. DB 왕복 1회 절감 효과이며 코드 중복도 제거되었다.
  - 제안: 통합이 올바르게 되었다. 만약 향후 `workflowId` 없는 전체 집계와 특정 워크플로우 집계를 동시에 반환해야 하는 요구가 생기면 두 쿼리를 `Promise.all` 로 병렬 실행하는 방식이 필요하지만 현재 스펙에서는 해당 없다.

- **[INFO]** `executionPath` 조회에 `MAX_EXECUTION_PATH_ROWS = 10_000` 상한 (W-22 해소, 긍정)
  - 위치: `backend/src/modules/executions/executions.service.ts` 라인 20, 127 / `executions.service.spec.ts` 라인 353
  - 상세: ForEach 컨테이너 같은 루프 구조에서 `execution_node_log` 행이 수만 건 이상으로 폭증할 수 있다. `take: MAX_EXECUTION_PATH_ROWS` 가 없으면 결과 전체를 Node.js 힙에 적재하게 되어 OOM 위험이 있다. `10_000` 상한은 UI timeline 에 prefix 만 필요하다는 전제로 정해졌다.
  - 제안: 현재 방어 수단으로 적절하다. 단, `10_000` 이 실제 UI 렌더 한계와 정렬되어 있는지 프런트엔드 측에서 재확인을 권장한다. 상한 초과 여부를 로그에 남기는 INFO 레벨 로깅을 추가하면 운영 중 대규모 실행 탐지에 도움이 된다.

- **[WARNING]** `rawBody: true` 활성화로 인한 메모리 오버헤드 증가
  - 위치: `backend/src/main.ts` 라인 709
  - 상세: `NestFactory.create(AppModule, { rawBody: true })` 는 Express 에서 모든 요청에 대해 raw body 버퍼를 `req.rawBody` 에 보존한다. HMAC 검증에 필요한 webhook 엔드포인트뿐 아니라 전체 애플리케이션의 모든 HTTP 요청에 raw body 버퍼가 추가로 유지된다. 요청 페이로드가 큰 엔드포인트(예: 파일 업로드, 대형 JSON 페이로드)가 있다면 Buffer 가 요청 생애 전체에 걸쳐 힙에 남아 GC 압력을 높인다.
  - 제안: `rawBody: true` 를 글로벌로 유지하는 대신, `RawBodyMiddleware` 를 webhook 경로(`/hooks/*`)에만 선택적으로 적용하는 방식으로 범위를 좁히는 것을 고려한다. NestJS 에서는 `MiddlewareConsumer.apply(json()).forRoutes(...)` 패턴으로 경로별 body parser 를 분리할 수 있다. 단, HMAC 검증 경로가 현재 소수이고 페이로드가 작은 webhook 이라면 실제 영향은 제한적이므로 즉각 수정 우선순위는 낮다.

- **[INFO]** `HMAC_ALLOWED_ALGORITHMS` 를 모듈 수준 `Set` 상수로 정의 (긍정)
  - 위치: `backend/src/modules/hooks/hooks.service.ts` 라인 18
  - 상세: `new Set(['sha256', 'sha512'])` 를 모듈 평가 시점에 한 번만 생성하고 이후 `has()` 로 O(1) 조회한다. 요청마다 새 Set 을 생성하지 않으므로 메모리·CPU 모두 최적이다.
  - 제안: 현재 구현 그대로 유지한다.

- **[INFO]** `V053` 복합 인덱스 `CONCURRENTLY` 생성 (W-63 해소, 긍정)
  - 위치: `backend/migrations/V053__notification_workspace_type_resource_idx.sql`, `.conf`
  - 상세: `notification(workspace_id, type, resource_id, created_at DESC)` 인덱스를 `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 로 생성하고 `.conf` 에 `executeInTransaction=false` 를 명시했다. `hasRecentByResource` 의 idempotency 쿼리 hot path 에 선택도가 높은 복합 인덱스를 추가함으로써 seq scan 회귀를 방지한다. `CONCURRENTLY` 로 인해 마이그레이션 중 테이블 잠금이 없어 운영 중 적용이 가능하다.
  - 제안: 인덱스 컬럼 순서(`workspace_id, type, resource_id, created_at`)는 WHERE 절의 equality 컬럼을 앞에 두고 범위/정렬 컬럼(`created_at`)을 마지막에 배치하는 최적 패턴을 따르고 있다. `title` 컬럼이 쿼리 주석에 언급되어 있으나 인덱스에는 포함되지 않았다. `title` 의 선택도가 낮다면 현재 설계가 합리적이지만, 동일 `(workspace_id, type, resource_id)` 에 대한 `title` 조건이 중요하다면 covering index 에 포함하는 것을 검토할 수 있다.

- **[INFO]** `webhook e2e` 에서 `Date.now()` → `crypto.randomBytes(8).toString('hex')` 전환 (W-41 해소, 긍정)
  - 위치: `backend/test/webhook-trigger.e2e-spec.ts` 라인 74, 95, 112, 134
  - 상세: `Date.now()` 는 밀리초 단위 타임스탬프로 동시 실행 시 충돌 가능성이 있으나, `crypto.randomBytes(8)` 는 64비트 엔트로피를 보장하므로 동시 e2e 실행 환경에서 endpointPath 충돌 위험이 사실상 없어진다. 성능과 직접 연관은 없으나 병렬 테스트 실행 안정성을 높인다.
  - 제안: 현재 구현이 적절하다.

- **[INFO]** `TableHandler.safeEvaluate` 에러 로깅 통합 (W-31 일환, 중립)
  - 위치: `backend/src/nodes/presentation/table/table.handler.ts` 라인 264
  - 상세: `console.error` 3줄을 `logger.error` 1줄로 합쳤다. 합치면서 `JSON.stringify(ctx.$sourceItem)` 와 `JSON.stringify(ctx.$var)` 를 동일 오류 메시지 문자열에 인라인했다. ctx 객체가 대형 JSON 이면 에러 발생 시마다 두 번의 `JSON.stringify` 를 직렬화하게 되며, 이전에도 에러 경로에서 동일 연산이 발생했으므로 성능 변화는 없다.
  - 제안: 에러 경로이므로 현재 영향은 무시할 수 있다. 향후 대형 컨텍스트를 다룰 경우, 로그 레벨 조건부(`if (this.logger.isDebugEnabled())`) 로 직렬화를 지연 평가하는 패턴을 고려한다.

---

### 요약

이번 커밋은 성능 관점에서 전반적으로 긍정적인 변경사항을 포함한다. 핵심 개선은 세 가지다. 첫째, `planContainerBody` 의 O(N) 선형 탐색을 Map 기반 O(1) 룩업으로 전환하여 대형 워크플로우에서 실질적인 CPU 절감이 기대된다. 둘째, `sanitizePayloadForWs` 의 copy-on-write 최적화로 WebSocket emit hot path 의 불필요한 객체 할당이 제거되어 GC 압력이 줄어든다. 셋째, `statistics.getSummary` 의 이중 DB 쿼리가 단일 쿼리로 통합되었다. `executionPath` 상한 도입과 V053 인덱스 추가도 각각 메모리 안전성과 쿼리 성능을 개선한다. 유일한 우려 사항은 `rawBody: true` 글로벌 활성화인데, 현재 webhook 페이로드 크기를 고려하면 즉각적인 위험은 낮으나 향후 고용량 엔드포인트 추가 시 재검토가 필요하다.

---

### 위험도

LOW
