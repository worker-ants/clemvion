### 발견사항

**[INFO]** `memory/kb-embedding-model-selection.md` 진행 상황이 미완료 상태
- 위치: `memory/kb-embedding-model-selection.md`, 마지막 줄
- 상세: `(작업 중. 완료 시 갱신.)` 상태 그대로 PR에 포함됨. 작업 완료 후 갱신되지 않았음
- 제안: 완료 상태 및 결과 요약으로 업데이트

**[INFO]** `SUPPORTED_DIMS` 상수에 대한 유지보수 지침이 코드 내 주석과 마이그레이션 파일에 분산 기재됨
- 위치: `rag-search.service.ts:7-8`, `V021__variable_embedding_dimension.sql:30`
- 상세: 새 차원 추가 절차("신규 마이그레이션 + `SUPPORTED_DIMS` 추가")가 각각 다른 파일에 따로 적혀 있어 한 쪽만 보면 절차를 놓칠 수 있음. 현재는 두 파일이 서로를 언급하지 않음
- 제안: 둘 중 하나에 "절차는 V021 SQL 파일 주석 참조" 또는 역방향 링크 추가

**[INFO]** `EmbeddingModelCombobox` 컴포넌트 주석이 ko/en 혼용
- 위치: `embedding-model-combobox.tsx:16-19`
- 상세: 파일 내 주석만 한국어로 작성되어 있고 컴포넌트 자체 JSDoc은 없음. 인터페이스(`EmbeddingModelComboboxProps`)에 prop 설명이 없음
- 제안: 허용 가능한 수준. 단, `disabled` prop이 컴포넌트 시그니처에 있으나 실제 동작에 대한 언급이 없으므로 `disabled` prop이 UI에 미치는 영향을 한 줄 추가하면 명확해짐

**[INFO]** `KbReEmbedAcceptedDto` JSDoc 클래스 설명이 `ReEmbedAcceptedDto`와 기능적으로 구분되지 않음
- 위치: `knowledge-base-response.dto.ts:107-113`
- 상세: `ReEmbedAcceptedDto`(문서 단위 재임베딩)와 `KbReEmbedAcceptedDto`(KB 전체 재임베딩)가 나란히 정의되어 있는데, `/** KB 단위 재임베딩 접수 결과 */` 주석만으로 두 DTO의 범위 차이(문서 vs. KB 전체)가 충분히 구분됨. 문제없음

**[INFO]** `reEmbedAll` 서비스 메서드 주석이 "비동기 큐" 표현을 사용하나 실제 구현은 큐가 없음
- 위치: `knowledge-base.service.ts:109-112` (주석 `// - 모든 문서를 비동기 재임베딩 큐에 던지고`)
- 상세: 실제 구현은 fire-and-forget(`processDocument(...).catch(...)`)이지, 큐잉 시스템이 아님. "큐에 던진다"는 표현은 독자에게 별도 큐 인프라가 있다는 오해를 줄 수 있음
- 제안: `// - 모든 문서에 대해 비동기 re-embedding 을 fire-and-forget 으로 실행하고, 처리 수만 즉시 반환`으로 수정

**[INFO]** `embedding.service.ts` 차원 검증 주석의 spec 참조 경로 확인 필요
- 위치: `embedding.service.ts:137` (`spec 8-embedding-pipeline.md §5.3`)
- 상세: 주석이 `spec/5-system/8-embedding-pipeline.md`를 `spec 8-embedding-pipeline.md`로 축약 표기. 마이그레이션 SQL 파일의 표기(`spec/5-system/8-embedding-pipeline.md §5.3`)와 형식이 다름
- 제안: 일관성을 위해 전체 경로로 통일

**[INFO]** `llm-config.controller.ts` `@ApiQuery` 데코레이터 누락
- 위치: `llm-config.controller.ts:209-219`
- 상세: `@Query('type') type?: string` 파라미터가 추가되었으나 Swagger `@ApiQuery({ name: 'type', enum: ['chat', 'embedding'], required: false })` 데코레이터가 없음. `@ApiOperation`의 `description`에 텍스트로만 언급되어 있어 Swagger UI에서 자동 생성된 인터랙티브 파라미터 입력창이 없음
- 제안: `@ApiQuery({ name: 'type', enum: ['chat', 'embedding'], required: false, description: 'chat 또는 embedding 모델만 필터링' })` 추가

**[INFO]** `update-knowledge-base.dto.ts`의 `embeddingModel` 변경 시 재임베딩 필요 여부가 API 레벨에서만 기술됨
- 위치: `update-knowledge-base.dto.ts:31-34`
- 상세: `description`에 "차원이 달라지면 KB 재임베딩이 필요합니다"라고 명시되어 있어 Swagger에는 잘 나타남. 문제없음

**[INFO]** `spec/` 문서 업데이트 여부 확인 불가
- 위치: `memory/kb-embedding-model-selection.md:6` 에서 참조한 `spec/5-system/8-embedding-pipeline.md`, `spec/9-rag-search.md`
- 상세: 이번 변경이 spec 미구현분을 구현했다면, spec 문서에 구현 완료 표시 또는 실제 구현 방식(partial HNSW 인덱스, `SUPPORTED_DIMS` 화이트리스트) 반영이 권장됨. 리뷰 범위에 spec 파일이 포함되지 않아 확인 불가
- 제안: 해당 spec 섹션에 "V021 마이그레이션으로 구현, `SUPPORTED_DIMS` 화이트리스트로 차원 관리" 등 구현 메모 추가 검토

---

### 요약

전반적으로 문서화 품질이 양호합니다. SQL 마이그레이션 파일은 각 DDL 변경의 이유와 운영 고려사항까지 상세히 기술되어 있고, DTO/컨트롤러의 Swagger 어노테이션도 충실합니다. 핵심 미비점은 두 가지입니다: (1) `listModels` 엔드포인트에 `?type` 쿼리 파라미터에 대한 `@ApiQuery` 데코레이터가 없어 Swagger UI에서 파라미터가 노출되지 않으며, (2) `reEmbedAll` 서비스 주석의 "큐" 표현이 실제 구현(fire-and-forget)과 달라 혼동을 줄 수 있습니다. 나머지는 info 수준의 일관성 개선 사항입니다.

### 위험도

**LOW**