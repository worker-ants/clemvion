## 발견사항

---

### [WARNING] `reExtractDocument` 엔드포인트 — Swagger 문서와 구현 불일치
- **위치**: `knowledge-base.controller.ts` — `reExtractDocument` 메서드
- **상세**: `@ApiAcceptedWrappedResponse(ReEmbedAcceptedDto, ...)` 를 선언하고 있지만, 실제 반환값은 `{ message: 'Graph re-extraction started' }` 단순 객체. `ReEmbedAcceptedDto` 는 `message + documentCount` 두 필드를 가지며, re-embed 용 DTO를 re-extract에 재사용한 것. API 계약상 응답 스키마와 실제 페이로드가 다르다.
- **제안**: `KbReExtractDocumentAcceptedDto` 를 별도 정의하거나, 최소한 `{ message: string }` 을 인라인 타입으로 정확히 명시. `KbReExtractAcceptedDto` 처럼 `documentCount: 1` 을 함께 반환하면 일관성도 확보됨.

---

### [WARNING] 프론트엔드 API 클라이언트 — 응답 언래핑 불일치
- **위치**: `frontend/src/lib/api/knowledge-bases.ts`
- **상세**: `reExtractAll`, `getGraphStats`, `getEntityDetail`, `getGraphVisualization` 는 `(data as { data?: unknown })?.data ?? data` 방어 언래핑을 하지만, `getEntities` · `getRelations` 는 `data` 를 그대로 반환. 백엔드가 `{ data: ... }` 엔벨로프를 일관되게 반환한다면 `getEntities`/`getRelations` 가 이중으로 중첩 반환될 수 있고, 반대라면 나머지 4개가 불필요하게 분기. 실제 동작은 운에 달려 있다.
- **제안**: `apiClient` 의 응답 인터셉터가 `data` 를 unwrap하는지 명확히 확인하고, 모든 메서드를 같은 패턴으로 통일. 인터셉터가 이미 unwrap한다면 방어 분기를 제거하고, 그렇지 않다면 모든 메서드에 명시적 unwrap 추가.

---

### [WARNING] URL 경로 설계 불일치
- **위치**: `knowledge-base.controller.ts` — `GET :id/graph/visualization` vs `GET :id/graph-stats`
- **상세**: 두 그래프 관련 엔드포인트가 다른 구조를 사용. `graph/visualization` 은 `graph/` 네임스페이스 아래 있지만, `graph-stats` 는 루트 레벨 하이픈 형태. REST 일관성 위반이며, 향후 그래프 관련 엔드포인트 추가 시 혼선 유발.
- **제안**: `GET :id/graph/stats` 로 통일하거나, `GET :id/graph-visualization` 으로 변경.

---

### [WARNING] `reExtractDocument` 엔드포인트 — 스로틀 미적용
- **위치**: `knowledge-base.controller.ts` — `reExtractDocument` 메서드
- **상세**: KB 전체 재추출(`reExtractAll`)은 `@Throttle({ default: { limit: 3, ttl: 60_000 } })` 가 적용됐지만, 문서 단건 재추출은 스로틀 없음. LLM API 호출 비용을 감안하면 반복 호출에 취약하다.
- **제안**: 최소한 `@Throttle({ default: { limit: 10, ttl: 60_000 } })` 수준의 제한 추가.

---

### [WARNING] `GraphTraversalSummary` · `origin` 필드 — 검색 API 응답 계약 미반영
- **위치**: `search-result.interface.ts`, `rag-search.service.ts` (diff 일부 생략됨)
- **상세**: `SearchResult.origin?` 와 `RagContext.graphTraversal?` 이 추가되어 실제 응답에 포함되지만, `RagSearchResultDto` 가 이 diff에 포함되지 않아 Swagger 문서에 반영됐는지 확인 불가. 만약 `RagSearchResultDto` 에 `origin` 이 없다면 API 계약에 없는 필드가 조용히 응답에 실려 나간다.
- **제안**: `RagSearchResultDto` 에 `@ApiPropertyOptional` 로 `origin` 추가. `RagContext` 응답 DTO에도 `graphTraversal` 선택 필드 문서화.

---

### [INFO] `GET :id/graph/visualization` — `limit` 파라미터 미검증
- **위치**: `knowledge-base.controller.ts` — `graphVisualization` 메서드
- **상세**: `@Query('limit') limit?: string` 으로 raw string을 받아 `parseInt` 후 NaN 검사만 수행. 서비스 레이어에서 1–200으로 clamp하지만 계약 문서에 범위가 명시되지 않음. `ParseIntPipe` + `@ApiQuery({ minimum: 1, maximum: 200 })` 조합이 없다.
- **제안**: `@Query('limit', new DefaultValuePipe(50), ParseIntPipe)` 또는 별도 Query DTO 사용. `@ApiQuery` 로 범위 명시.

---

### [INFO] Entity 목록 `type` 쿼리 파라미터 — Swagger 미선언
- **위치**: `knowledge-base.controller.ts` — `listEntities` 메서드
- **상세**: `@Query('type') type?: string` 에 대응하는 `@ApiQuery` 데코레이터가 없어 Swagger 문서에서 이 필터 파라미터가 보이지 않는다.
- **제안**: `@ApiQuery({ name: 'type', required: false, enum: ['person', 'organization', 'concept', 'location', 'event', 'other'] })` 추가.

---

### [INFO] `GET :id/entities/:entityId` — 청크 목록 상한 페이지네이션 없음
- **위치**: `graph-query.service.ts` — `getEntityDetail` → `LIMIT 100` 하드코딩
- **상세**: entity 하나가 수백 개 청크에서 등장할 경우 100건에서 잘려도 UI가 알 수 없음. 잘림 여부를 나타내는 플래그도 없다.
- **제안**: 응답에 `truncated: boolean` 플래그 추가 또는 chunk 미리보기 목록도 커서/페이지 기반으로 분리.

---

## 요약

이 PR은 Knowledge Base에 Graph RAG 모드를 추가하는 대규모 신규 API 계약이다. 기존 엔드포인트에 대한 변경은 모두 **가산적(additive)** 이어서 하위 호환성 파괴는 없다. 그러나 `reExtractDocument`의 Swagger DTO 오용(re-embed DTO 재사용, 실제 응답과 불일치), 프론트엔드 API 클라이언트의 응답 언래핑 불일치, URL 경로 일관성 문제(`graph/visualization` vs `graph-stats`)가 계약 신뢰도를 낮춘다. 또한 단건 재추출 엔드포인트의 스로틀 누락은 LLM 비용 관점에서 실질적인 리스크다. 검색 결과에 추가된 `origin`·`graphTraversal` 필드가 Swagger에 반영됐는지 별도 확인이 필요하다.

## 위험도
**MEDIUM**