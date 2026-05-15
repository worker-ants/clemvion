### 발견사항

---

**[INFO] `graph-extraction.service.ts` — `persistExtraction` 메서드의 `xmax = 0` 트릭 미설명**
- 위치: `graph-extraction.service.ts` UPSERT 블록 (`RETURNING id, (xmax = 0) AS inserted`)
- 상세: PostgreSQL 전용 `xmax = 0` 해킹으로 INSERT/UPDATE 여부를 판별하는 로직인데, 이 표현식이 왜 작동하는지 설명이 없다. TypeORM의 일반적인 UPSERT와 다른 이유(inserted count를 알아야 하기 때문)도 불분명.
- 제안: `xmax = 0` 줄 위에 `-- xmax=0 means the row was newly inserted (not updated); PostgreSQL internal hint` 한 줄 추가.

---

**[INFO] `graph-extraction.service.ts` — 클래스 JSDoc의 `refreshKbStats` 중복 로직 언급**
- 위치: `graph-query.service.ts:296–320` (`refreshKbStats` private method)
- 상세: `graph-query.service.ts`의 `refreshKbStats` 주석에 "GraphExtractionService 와 동일한 로직"이라고 기술되어 있는데, 두 서비스에 동일 SQL이 중복 존재하는 이유(순환 의존 방지)가 명확히 적혀 있어 양호하다. 다만 `graph-extraction.service.ts`에는 이 내용이 없어 비대칭.
- 제안: `graph-extraction.service.ts`의 `refreshKbStats`에도 동일 이유 주석 추가 (이미 `graph-query.service.ts`에는 있음).

---

**[INFO] `document-embedding.processor.ts` — `maybeChainGraphExtraction` 주석의 "작은 read" 주장**
- 위치: `document-embedding.processor.ts:99` (`// documentId 만으로 KB.rag_mode 를 조회 — 작은 read 라 큐 처리량에 영향 없음.`)
- 상세: 이 주석은 성능상 우려가 없다는 주장인데, 임베딩 큐가 병렬 처리될 때 모든 문서마다 JOIN 쿼리가 발생한다는 사실을 빠뜨리고 있다. 독자는 이 결정이 의도적 트레이드오프임을 알기 어렵다.
- 제안: "concurrency 3 기준 초당 최대 3회 쿼리 — KB 정보는 캐시하지 않아도 DB 부하 무시 가능 수준" 등으로 구체화하거나 삭제.

---

**[INFO] `graph-extraction.queue.ts` — `isKbBatch` 필드의 JSDoc이 영어/한국어 혼용**
- 위치: `graph-extraction.queue.ts:18`
- 상세: 파일 내 JSDoc과 인터페이스 주석이 일부 한국어, 일부 영어로 혼용되어 있다. 나머지 큐 파일(`document-embedding.queue.ts` 등)이 어느 언어를 사용하는지 기준이 불명확.
- 제안: 프로젝트 전반의 백엔드 코드 주석 언어 기준을 CLAUDE.md나 이 파일 첫 줄에 명시하거나, 기존 파일의 규칙을 따라 통일.

---

**[WARNING] `knowledge-base.controller.ts` — `reExtractDocument` 응답 타입 미기재**
- 위치: `knowledge-base.controller.ts` `reExtractDocument` 핸들러
- 상세: 반환 타입이 `any`에 준하는 인라인 객체(`{ message: 'Graph re-extraction started' }`)로 처리되어 있고, Swagger 응답 DTO가 `ReEmbedAcceptedDto`를 재사용하고 있다. `ReEmbedAcceptedDto`는 `documentCount`를 포함하지만 실제 응답은 `message`만 있어 Swagger 문서와 실제 응답 형태가 불일치.
- 제안: 전용 DTO(`DocumentReExtractAcceptedDto`) 또는 실제 반환값과 일치하는 Swagger 데코레이터로 수정하고 반환 타입을 명시.

---

**[WARNING] `knowledge-bases.ts` (frontend API client) — `update` 메서드 파라미터 타입 불일치**
- 위치: `frontend/src/lib/api/knowledge-bases.ts:144–153`
- 상세: `update` 메서드의 `payload` 타입에 `extractionLlmConfigId`, `maxHops`, `vectorSeedTopK`, `expandedChunkLimit`가 추가되었는데, 모두 `required` 필드로 선언되어 있다(`Partial<>` 미적용). 실제 PATCH 의미상 선택적이어야 하는데 타입 정의가 그렇지 않아 오해를 유발한다.
- 제안: `Partial<{...}>` 또는 각 필드에 `?` 추가.

---

**[INFO] `graph-visualization.tsx` — `arrangeOnCircle` 배치 알고리즘 선택 이유 주석**
- 위치: `graph-visualization.tsx:44–69`
- 상세: 원형 배치를 선택한 이유("단순 원형 배치 — 추가 라이브러리 불필요")는 주석으로 있지만, 기존에 force-layout이나 dagre 같은 대안을 검토했다가 배제했다는 컨텍스트가 없다. 향후 개발자가 이 결정을 재검토할 때 기준이 불명확.
- 제안: 현재 주석으로 충분하면 유지. 다만 P2 기능이라는 표시를 API 주석처럼 컴포넌트에도 추가하면 추적이 용이.

---

**[INFO] `V025__graph_rag.sql` — 마이그레이션 롤백 절차 부재**
- 위치: `V025__graph_rag.sql` 전체
- 상세: Flyway 마이그레이션이라 되돌리기가 어렵다는 점은 알려진 사실이나, `knowledge_base`에 추가된 컬럼들이 NOT NULL with DEFAULT임에도 롤백 절차(해당 컬럼 DROP 순서 등)가 SQL 파일이나 스펙 문서에 어디에도 없다.
- 제안: 마이그레이션 파일 상단 주석에 `-- DOWN: ALTER TABLE knowledge_base DROP COLUMN rag_mode ...` 형태로 롤백 쿼리를 선택적으로 기재하거나, `spec/5-system/10-graph-rag.md`에 롤백 절차 섹션 추가.

---

**[INFO] `en.ts` / `ko.ts` — `graphVizTruncated` 메시지의 `N` placeholder 미처리**
- 위치: `en.ts:1673` (`"Truncated — showing top N entities only"`)
- 상세: 실제 limit 값을 보여줄 수 있음에도 하드코딩된 `N`으로 표기. `ko.ts`의 대응 메시지는 "노드 수가 한도를 초과해 일부만 표시 중"으로 구체적인 수치가 없어 사용자에게 덜 유용.
- 제안: `{{limit}}` placeholder를 추가하거나, `GraphVisualization` 컴포넌트에서 실제 limit 값을 문자열에 직접 삽입하도록 수정.

---

**[INFO] `entity.entity.ts` — `GraphEntity` 클래스 이름의 네이밍 불일치**
- 위치: `entity.entity.ts:22`
- 상세: DB 테이블/SQL은 `entity`인데 TypeORM 클래스는 `GraphEntity`로 네이밍되어 있다. 이 불일치의 이유(TypeScript 내장 `Entity` 타입/데코레이터와 충돌 방지)가 주석 없이 암묵적이다. 새 개발자가 `@Entity('entity')`와 클래스명 `GraphEntity`의 불일치를 보고 혼란스러울 수 있다.
- 제안: 클래스 상단에 `// Named GraphEntity (not Entity) to avoid collision with TypeORM's @Entity decorator identifier` 한 줄 추가.

---

### 요약

전반적으로 Graph RAG 도입에 따른 문서화 수준은 양호하다. SQL 마이그레이션 파일의 섹션별 주석, DTO의 `@ApiProperty` 데코레이터, 핵심 서비스 클래스의 JSDoc, i18n 키 쌍(en/ko) 모두 체계적으로 관리되고 있다. 다만 몇 가지 개선이 필요한 지점이 있다: (1) `reExtractDocument` 컨트롤러의 Swagger 응답 DTO가 실제 반환값과 불일치하는 것이 가장 실질적인 문제이고, (2) frontend API `update` 메서드의 신규 파라미터가 required로 잘못 타입 지정되어 있으며, (3) `xmax = 0` PostgreSQL 트릭처럼 독자가 오해할 수 있는 비표준 관용구에 설명이 보강되면 유지보수성이 높아진다. `GraphEntity` 클래스 네이밍 불일치 이유, 마이그레이션 롤백 절차 기재도 선택적으로 추가하면 좋다.

### 위험도

**LOW**