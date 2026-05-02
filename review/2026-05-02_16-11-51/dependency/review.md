필요한 정보를 모두 수집했습니다.

---

## 의존성 리뷰 결과

### 발견사항

- **[INFO]** 새 외부 패키지 없음 — 전체 변경은 기존 의존성만 활용
  - 위치: `frontend/package.json`, `backend/package.json`
  - 상세: `@xyflow/react`, `@nestjs/bullmq`, `typeorm`, `class-validator` 등 모든 import가 PR 이전부터 `package.json`에 선언되어 있음. 순수 내부 조합만으로 기능을 구현한 점은 긍정적.

- **[WARNING]** `proOptions={{ hideAttribution: true }}` — React Flow Pro 라이선스 미확인
  - 위치: `frontend/src/components/knowledge-base/graph-visualization.tsx:147`
  - 상세: `hideAttribution: true`는 React Flow의 free tier에서 사용 금지된 옵션임. 동일 옵션이 `workflow-canvas.tsx`에도 이미 존재하므로 신규 이슈는 아니지만, 이번 PR에서 다시 동일 패턴을 추가함. React Flow Pro 구독이 없으면 ToS 위반 가능성이 있음.
  - 제안: 프로젝트의 `@xyflow/react` 라이선스 티어(Pro/기타)를 확인하고, 무료 플랜이라면 attribution 제거를 중단하거나 Pro 구독을 검토.

- **[WARNING]** `DocumentEmbeddingProcessor` → `GRAPH_EXTRACTION_QUEUE` 교차 도메인 결합
  - 위치: `backend/src/modules/knowledge-base/queues/document-embedding.processor.ts:15,39`
  - 상세: 임베딩 완료 이벤트에서 그래프 추출 큐로 체이닝하기 위해 embedding processor가 `graph-extraction.queue.ts`를 직접 import·inject. 두 기능 도메인이 processor 레벨에서 단방향 결합됨. Graph RAG 기능을 비활성화하거나 큐 이름이 변경될 경우 embedding processor도 함께 수정해야 함.
  - 제안: `KnowledgeBaseService.processDocumentEmbedded(docId)` 같은 facade를 두어 embedding processor가 KB 서비스를 호출하고, KB 서비스 내에서 graph 큐 여부를 결정하도록 분리. 또는 현재 구조를 유지한다면 `graph-extraction.queue.ts`의 상수만 별도 shared constants 파일로 분리.

- **[WARNING]** `refreshKbStats` 로직 이중 구현
  - 위치: `graph-extraction.service.ts:302`, `graph-query.service.ts:306`
  - 상세: 동일한 SQL(`COUNT(*) FROM entity/relation WHERE knowledge_base_id`)이 두 서비스에 각각 `private refreshKbStats`로 중복 선언됨. 두 서비스가 서로를 주입하지 않는 이유(순환 의존 회피)는 타당하나, 통계 갱신 SQL이 한쪽에서만 수정될 경우 드리프트 발생.
  - 제안: `KbStatsService` 같은 경량 전용 서비스로 추출하거나, `KnowledgeBaseService`에 `refreshStats(kbId)` 메서드를 두어 두 서비스가 공통 호출하도록 정리.

- **[INFO]** `forwardRef(() => WebsocketService)` 순환 의존 — 기존 패턴 답습
  - 위치: `graph-extraction.service.ts:41`
  - 상세: `EmbeddingService`, `ExecutionEngineService`와 동일한 `forwardRef` 패턴. 신규 문제가 아니며 NestJS에서 권장하는 방법으로 처리됨.

- **[INFO]** `knowledge-bases/page.tsx` → `llmConfigsApi` 런타임 의존 추가
  - 위치: `frontend/src/app/(main)/knowledge-bases/page.tsx:11,60`
  - 상세: KB 생성 다이얼로그에서 graph 모드 선택 시 `/llm-configs` 엔드포인트를 추가 호출. `enabled: showDialog && formRagMode === 'graph'` 조건부 fetch로 불필요한 호출은 방지함. 다만 `llmConfigsApi.getAll()`의 반환 구조 파싱을 `(data as { data?: LlmConfigData[] } | undefined)?.data`로 두 번 방어하는 패턴이 반복됨 — API 응답 구조가 래핑되어 있다면 `apiClient` 인터셉터나 공통 헬퍼로 통일하는 것이 바람직함.

### 요약

이번 PR은 외부 패키지를 전혀 추가하지 않고 기존 `@xyflow/react`, `@nestjs/bullmq`, `typeorm`, `class-validator` 등만으로 Graph RAG 기능을 구현한 점에서 의존성 관리 면에서 절제된 변경임. 주요 위험은 기술적 패키지 문제가 아니라 **React Flow Pro 라이선스 적합성**(이미 workflow editor에서도 동일하게 사용 중인 기존 문제), **embedding → graph 큐 교차 결합**, **`refreshKbStats` 로직 중복**으로 요약됨. 라이선스 사항을 확인하고 나머지 두 구조적 문제는 후속 리팩토링 과제로 관리하면 충분함.

### 위험도

**LOW** (외부 패키지 신규 추가 없음 · 라이선스 이슈는 기존 코드와 동일한 상황 · 내부 결합은 기능 동작에는 무해하나 유지보수 부채)