## 의존성 코드 리뷰

### 발견사항

- **[INFO]** 새 외부 npm/pip 패키지 추가 없음
  - 위치: 전체 변경사항
  - 상세: 21개 파일 전부 기존 의존성(`@nestjs/*`, `typeorm`, `class-validator`, `@tanstack/react-query`, `lucide-react` 등)만 활용. 번들 크기·빌드 시간에 영향 없음.
  - 제안: 없음

- **[WARNING]** `SUPPORTED_DIMS` ↔ SQL partial HNSW 인덱스 간 cross-layer 동기화 의존성
  - 위치: `rag-search.service.ts:8`, `V021__variable_embedding_dimension.sql`
  - 상세: `const SUPPORTED_DIMS = new Set([768, 1536, 3072])`와 마이그레이션 SQL의 3개 partial 인덱스가 1:1로 대응해야 동작한다. 새 차원 모델을 도입할 때 마이그레이션만 추가하고 `SUPPORTED_DIMS` 업데이트를 빠뜨리면 런타임에서 해당 KB를 warning 로그 한 줄로 조용히 스킵한다. 컴파일 타임이나 테스트 레벨에서 이 계약을 강제하는 장치가 없음.
  - 제안: 해당 constant를 공유 파일(예: `embedding-dimensions.const.ts`)로 분리하고, 마이그레이션 파일명 규칙(`V0xx__add_dim_NNN_hnsw.sql`)이나 마이그레이션 이름 파싱 단위 테스트로 계약을 검증하는 방법을 고려. 단기적으로는 현 주석 수준으로 충분하나 팀이 커지면 누락 리스크 증가.

- **[WARNING]** `KnowledgeBaseModule`에서 `EmbeddingService` 프로바이더 등록 여부 미확인
  - 위치: `knowledge-base.service.ts:37`, `knowledge-base.module.ts` (diff에 미포함)
  - 상세: `KnowledgeBaseService` 생성자에 `EmbeddingService`가 새로 주입되었으나, `knowledge-base.module.ts`가 이번 diff에 포함되지 않았다. `EmbeddingService`가 같은 모듈 providers에 이미 등록되어 있으면 문제없지만, 등록 누락 시 NestJS DI 컨테이너가 런타임에 에러를 던진다.
  - 제안: `knowledge-base.module.ts`에서 `EmbeddingService`가 providers 목록에 있는지 확인. `embedding.service.spec.ts`가 신규 파일인 점을 보면 이미 모듈에 있을 가능성이 높지만 명시적 확인 필요.

- **[INFO]** 내부 모듈 의존 방향은 정상 (순환 없음)
  - 위치: `knowledge-base.service.ts` ← `embedding.service.ts`
  - 상세: `KnowledgeBaseService → EmbeddingService` 단방향. `EmbeddingService`는 `KnowledgeBaseService`를 import하지 않아 순환 의존 없음. `EmbeddingService` 내 기존 `forwardRef(() => WebsocketService)`와도 무관.
  - 제안: 없음

- **[INFO]** `EmbeddingModelCombobox`의 cross-domain API 의존 (`knowledge-base` UI → `llm-configs` API)
  - 위치: `embedding-model-combobox.tsx:32-44`
  - 상세: KB 설정 UI가 `llmConfigsApi.listModels`를 통해 LLM Config 모듈을 호출한다. 기능적으로 적합한 의존이며, default config가 없거나 API 실패 시 일반 텍스트 입력으로 graceful degrade되어 있어 운영 안전성도 양호.
  - 제안: 없음

- **[INFO]** pgvector ≥ 0.5 (HNSW) 런타임 요구사항이 패키지 의존성으로 관리되지 않음
  - 위치: `V021__variable_embedding_dimension.sql:2`
  - 상세: 주석으로만 명시. DB 버전 체크가 없어 구버전 pgvector 환경에서 마이그레이션이 실패한다. 기존 프로젝트의 인프라 관리 방식에 따라 허용 가능한 수준.
  - 제안: `README` 또는 인프라 문서에 pgvector 최소 버전을 명기하거나, CI의 DB 이미지 태그를 `pgvector/pgvector:0.5.0-pg15` 이상으로 고정하는 것을 검토.

---

### 요약

21개 파일 전반에 걸쳐 새로운 외부 npm 패키지 도입은 전혀 없으며, 모든 변경은 기존 의존성 스택 위에서 이루어진다. 내부 모듈 간 의존 방향은 단방향으로 순환 위험이 없다. 가장 주목할 리스크는 `SUPPORTED_DIMS` 상수와 마이그레이션 SQL partial 인덱스 사이의 암묵적 동기화 계약으로, 이를 강제하는 자동화 장치가 없어 향후 차원 추가 시 조용한 기능 누락으로 이어질 수 있다. `KnowledgeBaseModule`의 `EmbeddingService` 등록 여부는 diff 범위 외로 별도 확인이 필요하다.

### 위험도

**LOW**