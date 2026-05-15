### 발견사항

---

**[CRITICAL] `refreshKbStats` 로직 중복 — SRP / DRY 위반**
- 위치: `graph-extraction.service.ts:~320`, `graph-query.service.ts:~300`
- 상세: 동일한 COUNT SQL과 `UPDATE knowledge_base SET entity_count / relation_count`가 두 서비스에 각각 구현되어 있습니다. 코드 주석에서도 "동일 helper를 둔다"고 인정하고 있어 의도적 중복이지만, 이는 SQL 수정 시 두 곳을 동시에 바꿔야 하는 유지보수 부채를 만듭니다.
- 제안: `GraphStatsRepository` 혹은 `GraphStatsHelper` 단일 클래스로 추출하고 양 서비스에서 주입.

---

**[WARNING] 임베딩 레이어의 그래프 추출 큐 직접 참조 — OCP 위반**
- 위치: `document-embedding.processor.ts` — `maybeChainGraphExtraction`, `@InjectQueue(GRAPH_EXTRACTION_QUEUE)`
- 상세: 임베딩 완료 이벤트 핸들러가 `GRAPH_EXTRACTION_QUEUE`를 직접 알고 있습니다. 향후 임베딩 완료 후 다른 후처리(예: 문서 분류, 요약 생성)가 추가될 때마다 이 프로세서를 수정해야 합니다. 임베딩 도메인이 그래프 도메인을 알아야 할 이유가 없습니다.
- 제안: `EventEmitter2` 기반의 내부 이벤트(예: `document.embedded`)를 발행하고, `GraphExtractionListener`가 이를 구독하는 방식으로 두 도메인을 분리.

---

**[WARNING] `forwardRef` — 순환 의존성 징후**
- 위치: `graph-extraction.service.ts:53` — `@Inject(forwardRef(() => WebsocketService))`
- 상세: `forwardRef`는 순환 의존성이 있을 때만 필요합니다. `GraphExtractionService → WebsocketService → GraphExtractionService`로 이어지는 순환이 존재한다면 모듈 경계 설계를 재검토해야 합니다. 현재 `EmbeddingService`도 동일한 패턴을 쓰고 있어 `WebsocketModule`의 임포트 구조가 의존성 역방향을 만들고 있을 가능성이 높습니다.
- 제안: `WebsocketService`를 직접 주입하는 대신, 이벤트 이미터를 통한 단방향 의존으로 전환.

---

**[WARNING] `KnowledgeBaseController` God Controller화**
- 위치: `knowledge-base.controller.ts`
- 상세: 이번 PR에서 CRUD, 재임베딩, 그래프 재추출, entity CRUD, relation CRUD, 그래프 시각화, 그래프 통계까지 하나의 컨트롤러에 추가되었습니다. `KnowledgeBaseService`와 `GraphQueryService`를 동시에 주입받아 라우팅 역할도 수행합니다.
- 제안: `@Controller('knowledge-bases/:id')`를 기반으로 `GraphController` (또는 `/knowledge-bases/:id/graph` prefix 서브컨트롤러)를 분리.

---

**[WARNING] 프론트엔드 API 응답 파싱 방어 코드 반복**
- 위치: `knowledge-bases.ts` — `reExtractAll`, `getGraphStats`, `getEntityDetail`, `getGraphVisualization` 등
- 상세: `(data as { data?: unknown })?.data ?? data` 패턴이 4군데 이상 반복됩니다. API 응답 envelope 구조(`{ data: ... }`)가 일관되지 않아 클라이언트에서 매번 방어적 언래핑을 해야 합니다.
- 제안: `apiClient` interceptor 레벨에서 envelope을 일관되게 unwrap하거나, 모든 엔드포인트의 응답 구조를 통일.

---

**[INFO] `document.graph_extraction_status` 기본값 `pending` — vector KB에서 노이즈**
- 위치: `V025__graph_rag.sql:23`, `document.entity.ts:40`
- 상세: vector 모드 KB의 문서는 이 컬럼이 영구적으로 `'pending'`에 머뭅니다. 이는 의미론적으로 "아직 추출 안 됨"과 "추출 불필요"가 구분되지 않아, 통계 쿼리(`graph_extraction_status = 'completed'` 집계)에서 vector KB 문서가 분모에 포함됩니다.
- 제안: `NULL` (미해당)을 기본값으로 사용하고, graph 모드 KB 문서에만 `'pending'`을 명시적으로 설정.

---

**[INFO] `ragMode` 불변성이 코드 레벨에서만 보장**
- 위치: `update-knowledge-base.dto.ts`, `knowledge-base.service.ts:update`
- 상세: `ragMode` 불변성은 DTO에서 필드를 제외하는 방식으로만 강제됩니다. DB 레벨 트리거나 서비스 레벨의 명시적 검증이 없어, 향후 raw SQL 직접 업데이트 시 무결성이 깨질 수 있습니다.
- 제안: `knowledge_base`에 `GENERATED ALWAYS AS (...) STORED` 또는 서비스 `update` 메서드에서 `ragMode` 변경 시도를 400으로 명시 차단.

---

### 요약

Graph RAG 도입의 전체 아키텍처 방향성 — DB 스키마 설계, 서비스 분리, DTO/응답 구조 — 은 명확하고 일관성 있게 구현되었습니다. 그러나 두 가지 구조적 문제가 장기 유지보수성을 저하시킵니다. 첫째, `refreshKbStats`의 중복 구현은 단일 책임 원칙을 위반하며 즉시 추출이 필요합니다. 둘째, 임베딩 프로세서가 그래프 추출 큐를 직접 참조하는 구조는 임베딩·그래프 두 도메인을 강하게 결합시켜, 향후 추가 후처리 단계가 생길 때마다 임베딩 프로세서를 수정해야 하는 OCP 위반을 만듭니다. `forwardRef` 사용과 컨트롤러의 비대화는 추가적인 경보 신호입니다.

### 위험도
**MEDIUM**