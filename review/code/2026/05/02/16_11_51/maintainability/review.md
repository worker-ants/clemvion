### 발견사항

---

**[CRITICAL] `refreshKbStats` 메서드 완전 중복**
- 위치: `graph-extraction.service.ts` 및 `graph-query.service.ts` (각각 `refreshKbStats` private method)
- 상세: 동일한 SELECT + UPDATE SQL이 두 서비스에 복사·붙여넣기됨. `graph-query.service.ts`의 주석에서 스스로 "동일한 로직"임을 인정하면서도 의존성 문제를 이유로 중복을 허용함. 이 SQL이 변경될 경우(예: 새 통계 컬럼 추가) 한 곳만 수정하면 버그가 발생함.
- 제안: `graph-stats.repository.ts` 또는 `KnowledgeBaseRepository`의 공유 메서드로 추출. 또는 `GraphQueryService`를 `GraphExtractionService`에 주입하거나(이미 `forwardRef` 패턴이 존재), `DataSource`를 받는 단독 `KbStatsHelper` 유틸리티 클래스로 분리.

---

**[WARNING] `assertGraphMode` / `assertGraphKb` 동일한 가드 로직 중복**
- 위치: `knowledge-base.service.ts:assertGraphMode`, `graph-query.service.ts:assertGraphKb`
- 상세: 두 메서드 모두 `kb.ragMode !== 'graph'`를 검사하고 동일한 에러 코드 `KB_NOT_GRAPH_MODE`와 동일한 메시지를 던짐. 에러 메시지 변경이나 에러 코드 리팩토링 시 두 파일을 모두 수정해야 함.
- 제안: 에러 생성 로직을 공유 헬퍼나 `KnowledgeBaseGuard` 레이어로 통합. 최소한 에러 코드와 메시지를 상수로 추출.

---

**[WARNING] `EntityType` 유니온 타입 두 곳에서 독립 정의**
- 위치: `entity.entity.ts:1-7` (TypeScript 타입) vs `graph-extraction.prompt.ts:35-45` (JSON Schema enum 배열)
- 상세: `'person' | 'organization' | 'concept' | 'location' | 'event' | 'other'` 목록이 두 파일에 별도로 정의됨. 새 entity type 추가 시 반드시 두 파일을 동기화해야 하는데, 컴파일 타임 에러가 발생하지 않아 drift 위험이 높음.
- 제안: `ENTITY_TYPES` 상수 배열을 `entity.entity.ts`에서 export하고, `EntityType = typeof ENTITY_TYPES[number]`로 파생. `graph-extraction.prompt.ts`의 JSON Schema enum도 이 배열을 참조. `graph-query.service.ts`의 `ALLOWED_ENTITY_TYPES`도 동일하게 통합.

---

**[WARNING] API 응답 정규화 패턴 4회 중복**
- 위치: `knowledge-bases.ts` — `reExtractAll`, `getGraphStats`, `getEntityDetail`, `getGraphVisualization`
- 상세: `(data as { data?: unknown })?.data ?? data` 패턴이 4개의 API 메서드에 반복됨. 기존의 래핑된 응답 포맷과 직접 응답 포맷을 모두 처리하는 이 로직은 API 응답 형식이 일관되지 않다는 근본 문제를 숨기며, 변경 시 4개를 모두 수정해야 함.
- 제안: `unwrapApiData<T>(raw: unknown): T` 헬퍼 함수로 추출하거나, `apiClient` 인터셉터에서 일관된 응답 구조를 보장.

---

**[WARNING] `knowledge-bases/page.tsx` 폼 상태 11개 분산**
- 위치: `knowledge-bases/page.tsx:45-65`
- 상세: KB 생성 폼 하나를 위해 11개의 `useState`가 page 컴포넌트 최상단에 나열됨. `llmConfigs` 정규화 IIFE까지 포함해 컴포넌트 로직이 폼, 목록, 삭제 확인을 모두 담당하며 비대해짐.
- 제안: `CreateKbFormDialog` 컴포넌트로 분리해 폼 상태와 submit 로직을 캡슐화.

---

**[WARNING] `<select>` 인라인 스타일 문자열 반복**
- 위치: `knowledge-bases/page.tsx:183, 236`, `entity-list.tsx:84`, `graph-visualization.tsx:111`
- 상세: `"h-9 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"` 동일 className이 4곳 이상 복사됨. 테마 변경 시 모두 수정 필요.
- 제안: 프로젝트에 이미 `Button`, `Input`, `ConfirmModal` 등 UI 컴포넌트가 있으므로 `NativeSelect` 또는 shadcn `Select` 컴포넌트로 통합.

---

**[WARNING] `extractDocument` 메서드 과도한 책임**
- 위치: `graph-extraction.service.ts:extractDocument`
- 상세: 단일 메서드에서 ① 문서/KB 조회, ② 상태 전이(processing), ③ 기존 매핑 삭제, ④ 청크 로딩, ⑤ LLM config 해결, ⑥ 청크별 LLM 호출 루프, ⑦ KB 통계 갱신, ⑧ 완료/에러 상태 전이, ⑨ WebSocket emit을 모두 처리함. 테스트 작성과 오류 추적이 어렵고, 이미 `callLlmForChunk`와 `persistExtraction`으로 일부 분리했지만 여전히 과도.
- 제안: `prepareExtraction` (상태 초기화+클린업), `runExtractionLoop` (청크 순회), `finalizeExtraction` (통계+상태 갱신) 등으로 단계 분리.

---

**[WARNING] entity-list.tsx 인라인 모달 패턴**
- 위치: `entity-list.tsx:165-248`
- 상세: Entity 상세 미리보기가 `fixed inset-0` 인라인 div로 구현됨. 동일 파일에서 `ConfirmModal` 컴포넌트를 사용하는 것과 불일치. 포커스 트랩, ESC 핸들링, 접근성 속성이 없음.
- 제안: `ConfirmModal`과 같은 방식으로 `EntityDetailDialog` 컴포넌트로 추출하거나 Radix `Dialog`를 사용.

---

**[INFO] `ChunkEntity` vs `GraphEntity`/`GraphRelation` 네이밍 불일치**
- 위치: `chunk-entity.entity.ts:8`, `entity.entity.ts:23`, `relation.entity.ts:18`
- 상세: TypeORM `@Entity` 데코레이터와의 충돌을 피하려고 `GraphEntity`, `GraphRelation`으로 네이밍했으나, 같은 목적의 `ChunkEntity`는 "Graph" 접두사 없이 정의됨. 세 신규 엔티티의 네이밍 컨벤션이 불일치.
- 제안: `GraphChunkEntity`로 일관되게 변경.

---

**[INFO] SQL 내 매직 넘버 `LIMIT 100`**
- 위치: `graph-query.service.ts:getEntityDetail` (SQL `LIMIT 100`)
- 상세: entity 상세의 청크 미리보기 상한이 하드코딩됨. `MAX_CHUNK_CHARS = 8_000`처럼 named constant로 추출되어야 함.
- 제안: `const ENTITY_CHUNK_PREVIEW_LIMIT = 100`으로 추출.

---

**[INFO] `graph-visualization.tsx` 레이아웃 로직 매직 넘버**
- 위치: `graph-visualization.tsx:arrangeOnCircle`, `toEdges`
- 상세: `radius = 320`, `node.label.length * 8 + 40`, `Math.max(120, ..., 240)`, `Math.min(e.weight, 4)` 등 시각화 레이아웃 관련 수치가 함수 내에 흩어져 있음.
- 제안: 파일 상단에 `LAYOUT` 또는 `VIZ_CONFIG` 상수 객체로 묶어서 조정이 용이하게.

---

**[INFO] `knowledge-base-response.dto.ts` 파일 크기 증가**
- 위치: `knowledge-base-response.dto.ts`
- 상세: 기존 KB 관련 DTO에 Graph 관련 DTO 8개가 추가되어 파일이 비대해짐. 장기적으로 그래프 관련 기능이 계속 확장될 경우 파일 탐색이 어려워짐.
- 제안: `graph-response.dto.ts`로 분리하는 것을 고려 (즉각 필요한 이슈는 아님).

---

### 요약

Graph RAG 기능 추가 자체는 구조적으로 잘 설계되어 있고 DB 제약, 상태 전이, 큐 패턴 등이 일관성 있게 구현되었다. 다만 유지보수성 관점에서 가장 심각한 문제는 `refreshKbStats`의 완전 중복으로, 코드가 스스로 이를 인정하면서도 묵인했다는 점이 특이하다. 그 외에 `EntityType` 이중 정의, API 응답 정규화 패턴 반복, 프론트엔드 폼 상태 비대화가 주요 개선 포인트이며, 이 중 `refreshKbStats`와 `EntityType` 동기화 문제는 기능 확장 시 실제 버그로 이어질 가능성이 높다.

### 위험도

**MEDIUM** — 현재 작동에는 문제없으나, `refreshKbStats` 중복과 `EntityType` 이중 정의는 확장 시 silent bug로 이어질 수 있는 구조적 취약점이다.