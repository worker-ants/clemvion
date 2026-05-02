### 발견사항

---

**[WARNING] `PATCH /knowledge-bases/:id` — embeddingModel 변경 시 embeddingDimension 미초기화**
- 위치: `knowledge-base.service.ts` `update()` / `knowledge-base.controller.ts`
- 상세: `embeddingModel`을 변경해도 `embeddingDimension`이 기존 값 그대로 유지된다. RAG 검색은 `(embeddingModel, embeddingDimension)` 키로 그룹핑하므로, 모델 변경 후 재임베딩 전까지 쿼리는 새 모델로 임베딩되지만 검색 SQL은 구 차원 조건(`vector_dims = old_dim`)으로 실행된다. 모델이 같은 차원을 유지하면 의미적 불일치(구 모델 청크 vs 신 모델 쿼리), 차원이 바뀌면 pgvector 타입 오류가 발생할 수 있다. 이 위험이 API 응답에 전혀 표현되지 않는다.
- 제안: `update()` 응답에 `{ reEmbedRequired: boolean }` 플래그를 추가하거나, `embeddingModel`이 바뀔 경우 `embeddingDimension`을 NULL로 함께 초기화(재임베딩 전까지 검색 skip 처리)하여 잘못된 결과가 반환되지 않도록 한다.

---

**[WARNING] `GET /llm-configs/:id/models?type=` — @ApiQuery 누락**
- 위치: `llm-config.controller.ts:209`
- 상세: 새로 추가된 `?type` 쿼리 파라미터에 `@ApiQuery({ name: 'type', required: false, enum: ['chat', 'embedding'] })` 데코레이터가 없다. OpenAPI 스펙에 파라미터가 노출되지 않아 API 클라이언트 자동 생성 시 누락된다.
- 제안: `@ApiQuery({ name: 'type', required: false, enum: ['chat', 'embedding'], description: '모델 타입 필터' })` 추가.

---

**[WARNING] SUPPORTED_DIMS 화이트리스트 — 클라이언트에 불투명한 silent skip 계약**
- 위치: `rag-search.service.ts:8` `const SUPPORTED_DIMS = new Set([768, 1536, 3072])`
- 상세: `embeddingDimension`이 768/1536/3072 외의 값이면 해당 KB가 검색에서 조용히 제외된다. 응답은 200 OK + 빈 배열이며, 어떤 KB가 왜 제외됐는지 클라이언트에 전달되지 않는다. 사용자가 지원되지 않는 차원의 커스텀 모델을 설정하면 원인을 알 수 없는 검색 0건이 발생한다.
- 제안: 검색 응답에 `skippedKbs?: string[]` 필드를 포함하거나, 지원되지 않는 차원의 KB가 포함된 경우 400/422를 반환하도록 상류(KB 생성·모델 변경 시점)에서 차원 허용 여부를 검증한다. 또는 `POST /knowledge-bases/:id/re-embed` 전 검증 엔드포인트를 제공한다.

---

**[WARNING] `POST /knowledge-bases/:id/re-embed` — 재임베딩 중 검색 일시 중단이 문서화되지 않음**
- 위치: `knowledge-base.service.ts` `reEmbedAll()`
- 상세: `reEmbedAll`은 먼저 `embedding_dimension = NULL`로 초기화한 뒤 비동기 재임베딩을 트리거한다. NULL 초기화 이후 재임베딩 완료 전 기간에는 해당 KB가 RAG 검색에서 완전히 제외된다(silent skip). 이 동작이 202 응답 스펙이나 API 문서에 명시되어 있지 않다.
- 제안: `@ApiOperation.description`에 "재임베딩 진행 중에는 해당 KB가 검색 대상에서 제외됩니다" 문구 추가. 프론트엔드 확인 모달에도 동일 안내 필요(`kbReembedConfirmMessage` i18n 키 업데이트).

---

**[INFO] `KbReEmbedAcceptedDto` vs `ReEmbedAcceptedDto` — 유사 작업 간 응답 구조 불일치**
- 위치: `knowledge-base-response.dto.ts:98~117`
- 상세: 문서 단위 재임베딩(`ReEmbedAcceptedDto`)은 `{ message }` 단순 구조이고, KB 단위 재임베딩(`KbReEmbedAcceptedDto`)은 `{ message, documentCount }`이다. 동일 리소스의 유사 작업이 다른 응답 형태를 갖는다.
- 제안: `ReEmbedAcceptedDto`도 `chunkCount` 등의 카운트 필드를 포함하도록 확장하거나, 두 DTO를 명확히 분리·문서화하여 의도적 차이임을 명시한다.

---

**[INFO] `UpdateKnowledgeBaseDto.embeddingModel` — 허용 값 미검증**
- 위치: `update-knowledge-base.dto.ts:31`
- 상세: `embeddingModel`은 `@IsString() @MaxLength(100)` 외 아무 검증이 없다. 존재하지 않는 모델명이나 chat 모델 ID가 입력돼도 400이 반환되지 않는다. 검증은 첫 임베딩 시도 시 실패하므로 오류 추적이 어렵다.
- 제안: 즉시 검증이 어렵다면(커스텀 모델 허용 정책 때문에), 적어도 API 설명(`@ApiPropertyOptional.description`)에 "LLM Config에 등록된 embedding 타입 모델 ID를 권장"을 명시한다.

---

### 요약

이번 변경은 가변 차원 임베딩 지원이라는 기술적으로 복잡한 요구사항을 추가하면서도 기존 API와의 하위 호환성을 대체로 잘 유지하고 있다. 신규 응답 필드(`embeddingDimension`)는 nullable optional로 추가되었고, 신규 엔드포인트(`POST /:id/re-embed`)는 적절한 202 상태 코드와 role 기반 인가를 갖추고 있다. 그러나 `embeddingModel` PATCH 시 `embeddingDimension`이 초기화되지 않아 RAG 검색이 의미적 불일치 또는 타입 오류 상태로 동작할 수 있고, SUPPORTED_DIMS 화이트리스트와 재임베딩 중 검색 일시 중단이 API 계약에 명시되지 않아 클라이언트가 원인을 파악하기 어려운 silent failure를 유발한다. `GET /llm-configs/:id/models?type=` 파라미터의 Swagger 누락도 API 문서 정합성을 깨뜨린다.

### 위험도
**MEDIUM**